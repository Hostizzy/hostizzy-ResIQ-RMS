// ResIQ DB — Database service layer (Supabase via proxy)

        // account_type ('managed' | 'host') is the source of truth. is_external is
        // the older boolean meaning the same thing, kept in sync by a database
        // trigger. Reading through this means the app behaves correctly whether or
        // not sql/account-type-and-host-profiles.sql has been applied.
        window.accountTypeOf = function(o) {
            if (o?.account_type) return o.account_type;
            return o?.is_external ? 'host' : 'managed';
        };
        window.isHostAccount = (o) => window.accountTypeOf(o) === 'host';

        // 160 bits from the CSPRNG, base36. The feed URL is pasted into Airbnb
        // and fetched by their servers, so a guessable token would expose a
        // property's occupancy to anyone who tried.
        function _newFeedToken() {
            const bytes = crypto.getRandomValues(new Uint8Array(20));
            return Array.from(bytes, b => b.toString(36).padStart(2, '0')).join('');
        }

        // The statuses that represent money an owner has earned. The old list
        // was ['confirmed', 'checked_in', 'completed'] — underscore and a word
        // the app never writes. Bookings are 'checked-in' and 'checked-out'
        // (app.html bookingStatus), so that filter matched only bookings that
        // had not started yet, and pending payout read zero for everyone.
        const OWNER_EARNING_STATUSES = ['confirmed', 'checked-in', 'checked-out'];

        const db = {
            // ─── Multi-Tenant Scoping ─────────────────────────────
            // Default-deny: queries return [] until initScope() explicitly
            // establishes a scope. Prevents data leaks if a query fires
            // before login completes.
            _ownerId: '__deny__',
            _ownerPropertyIds: [],
            // Set for Hostizzy staff whose role is 'admin'. Only they see
            // self-signup hosts' data; everyone else on the team is scoped to
            // Hostizzy's own book.
            _isSuperAdmin: false,

            async initScope(user) {
                if (user.userType === 'owner') {
                    if (!user.id) {
                        // Owner accounts MUST have an id — without it we'd fall through
                        // to the staff path and leak every other tenant's data.
                        this._ownerId = '__deny__';
                        this._ownerPropertyIds = [];
                        console.error('[db.initScope] Owner account has no id — blocking all queries.');
                        if (typeof showToast === 'function') {
                            showToast('Account misconfigured', 'Please contact support — your account is missing an owner id.', '❌');
                        }
                        return;
                    }
                    this._ownerId = user.id;
                    const { data } = await supabase.from('properties').select('id').eq('owner_id', user.id);
                    this._ownerPropertyIds = (data || []).map(p => p.id);
                } else if (user.owner_id) {
                    // Team member belonging to an owner
                    this._ownerId = user.owner_id;
                    const { data } = await supabase.from('properties').select('id').eq('owner_id', user.owner_id);
                    this._ownerPropertyIds = (data || []).map(p => p.id);
                } else if (user.userType === 'staff' || user.userType === 'admin') {
                    // Hostizzy internal staff. Not "sees everything" any more:
                    // a self-signup host's bookings are that host's own
                    // business, and their guests never agreed to appear in
                    // Hostizzy's operational views. Ordinary staff see
                    // Hostizzy's book — properties with no owner, plus managed
                    // owners' properties — and nothing belonging to a host.
                    //
                    // A super admin still sees everything, for support.
                    this._ownerId = null;
                    // An explicit flag, not the role. role governs what someone
                    // may DO in Hostizzy's book; this governs whether they see
                    // other people's businesses. Falls back to role === 'admin'
                    // only while sql/super-admin-flag.sql is unapplied, so the
                    // deploy and the migration need not be simultaneous.
                    this._isSuperAdmin = (typeof user.is_super_admin === 'boolean')
                        ? user.is_super_admin
                        : (user.role === 'admin');
                    this._ownerPropertyIds = this._isSuperAdmin
                        ? null
                        : await this._hostizzyPropertyIds();
                } else {
                    // Unknown user type — deny by default rather than leak data
                    this._ownerId = '__deny__';
                    this._ownerPropertyIds = [];
                    console.error('[db.initScope] Unknown userType, denying access:', user.userType);
                }
            },

            // Every property that is Hostizzy's own business: unowned, or
            // belonging to a managed owner. Deliberately NOT expressed as
            // "not in (host ids)" — a NULL owner_id does not satisfy a NOT IN,
            // so Hostizzy's own unassigned stock would vanish from its own app.
            async _hostizzyPropertyIds() {
                const { data: owners, error: ownerErr } = await supabase
                    .from('property_owners')
                    .select('id, account_type, is_external');
                if (ownerErr) throw ownerErr;

                const hostIds = new Set(
                    (owners || [])
                        .filter(o => (typeof accountTypeOf === 'function'
                            ? accountTypeOf(o)
                            : (o.account_type || (o.is_external ? 'host' : 'managed'))) === 'host')
                        .map(o => String(o.id))
                );

                const { data: props, error: propErr } = await supabase
                    .from('properties')
                    .select('id, owner_id');
                if (propErr) throw propErr;

                return (props || [])
                    .filter(p => p.owner_id == null || !hostIds.has(String(p.owner_id)))
                    .map(p => p.id);
            },

            async refreshPropertyScope() {
                if (this._ownerId) {
                    const { data } = await supabase.from('properties').select('id').eq('owner_id', this._ownerId);
                    this._ownerPropertyIds = (data || []).map(p => p.id);
                } else if (this._ownerId === null && !this._isSuperAdmin) {
                    // Staff scope goes stale when a property changes hands, so
                    // recompute it here too rather than only at login.
                    this._ownerPropertyIds = await this._hostizzyPropertyIds();
                }
            },

            clearScope() {
                // Reset to the deny sentinel so a logged-out client cannot
                // accidentally see data from a previous session.
                this._ownerId = '__deny__';
                this._ownerPropertyIds = [];
                this._isSuperAdmin = false;
            },

            // Returns true when the current scope is the deny sentinel set by initScope
            _isDenied() {
                return this._ownerId === '__deny__';
            },

            // Several tables hang off a reservation by booking_id rather than
            // carrying property_id — payments, guest_documents, communications,
            // guest_meal_preferences. Scoping them means resolving the caller's
            // booking ids first. Mirrors what the jwt_* RLS policies do in SQL.
            //
            // Returns null for Hostizzy staff (unscoped by design), or an array
            // for everyone else. An empty array means "this caller owns nothing"
            // — callers must return early rather than pass it to .in(), because
            // an empty IN list in PostgREST matches every row.
            async _scopedBookingIds() {
                if (this._ownerPropertyIds == null) return null;
                if (this._ownerPropertyIds.length === 0) return [];
                const { data, error } = await supabase
                    .from('reservations')
                    .select('booking_id')
                    .in('property_id', this._ownerPropertyIds);
                if (error) throw error;
                return (data || []).map(r => r.booking_id).filter(Boolean);
            },

            // Pre-auth lookup: identify a user by their just-authenticated
            // email so the caller can build a session and call initScope().
            // Bypasses the multi-tenant scope on purpose — the user is not
            // logged in yet, so we have no scope to apply. Safe because the
            // email is the user's own Firebase identity and at most one row
            // can match. Used by js/auth.js login and js/app.js session
            // restore, both before initScope() runs.
            async findUserByEmail(email) {
                if (!email) return null;
                const team = await supabase.from('team_members').select('*').eq('email', email).limit(1);
                if (team.error) {
                    console.error('[db.findUserByEmail] team_members query failed:', team.error.message);
                }
                if (team.data && team.data.length > 0) return { ...team.data[0], _kind: 'staff' };
                const owner = await supabase.from('property_owners').select('*').eq('email', email).limit(1);
                if (owner.error) {
                    console.error('[db.findUserByEmail] property_owners query failed:', owner.error.message);
                }
                if (owner.data && owner.data.length > 0) return { ...owner.data[0], _kind: 'owner' };
                return null;
            },

            // ─── Core Queries (auto-scoped) ──────────────────────
            async getTeamMembers() {
                if (this._isDenied()) return [];
                let query = supabase.from('team_members').select('*');
                if (this._ownerId) query = query.eq('owner_id', this._ownerId);
                const { data, error } = await query;
                if (error) throw error;
                return data || [];
            },
            async getProperties() {
                if (this._isDenied()) return [];
                let query = supabase.from('properties').select('*').order('name');
                if (this._ownerId) {
                    query = query.eq('owner_id', this._ownerId);
                } else if (this._ownerPropertyIds) {
                    // Staff below super admin: Hostizzy's own book only.
                    if (this._ownerPropertyIds.length === 0) return [];
                    query = query.in('id', this._ownerPropertyIds);
                }
                const { data, error } = await query;
                if (error) throw error;
                return data || [];
            },
            async getReservations() {
                if (this._isDenied()) return [];
                let query = supabase.from('reservations').select('*').order('check_in', { ascending: false });
                if (this._ownerPropertyIds) {
                    query = query.in('property_id', this._ownerPropertyIds.length > 0 ? this._ownerPropertyIds : [-1]);
                }
                const { data, error } = await query;
                if (error) throw error;
                return data || [];
            },
            async getReservation(bookingId) {
                const { data, error } = await supabase.from('reservations').select('*').eq('booking_id', bookingId).single();
                if (error) throw error;
                return data;
            },
            async getRevenueSharePercent(propertyId) {
                const { data, error } = await supabase
                    .from('properties')
                    .select('revenue_share_percent, name')
                    .eq('id', propertyId)
                    .single();
                if (error) throw error;
                // No silent default. A missing rate is a configuration bug — surface it
                // loudly so the property gets fixed instead of fabricating a 20% commission.
                if (data?.revenue_share_percent == null) {
                    const msg = `Property "${data?.name || propertyId}" has no revenue_share_percent set. Commission cannot be computed — please set a rate on the property before saving reservations.`;
                    console.error(msg);
                    if (typeof showToast === 'function') showToast(msg, 'error');
                    return null;
                }
                return data.revenue_share_percent;
            },

            async saveReservation(reservation) {
                if (reservation.id) {
                    const { data, error } = await supabase
                        .from('reservations')
                        .update(reservation)
                        .eq('id', reservation.id)
                        .select();
                    if (error) {
                        console.error('Update error:', error);
                        throw error;
                    }
                    return data?.[0];
                } else {
                    const { id, ...cleanReservation } = reservation;
                    const { data, error } = await supabase
                        .from('reservations')
                        .insert([cleanReservation])
                        .select();
                    if (error) {
                        console.error('Insert error:', error);
                        throw error;
                    }
                    return data?.[0];
                }
            },
            async deleteReservation(bookingId) {
                const { error } = await supabase.from('reservations').delete().eq('booking_id', bookingId);
                if (error) throw error;
            },
            async updateReservation(reservationId, updates) {
                const { data, error } = await supabase
                    .from('reservations')
                    .update(updates)
                    .eq('id', reservationId)
                    .select();
                if (error) throw error;
                return data?.[0];
            },
            async getPayments(bookingId) {
                const { data, error } = await supabase
                    .from('payments')
                    .select('*')
                    .eq('booking_id', bookingId)
                    .order('payment_date', { ascending: false });
                if (error) throw error;
                return data || [];
            },
            // payments has no property_id — a payment hangs off a reservation by
            // booking_id. Scoping it by property_id threw
            // "column payments.property_id does not exist", but only ever for a
            // scoped caller: staff have _ownerPropertyIds = null, so the filter
            // was skipped and the bug stayed invisible until the first host
            // opened Properties. jwt_payments_select gets this right in SQL;
            // this is the same hop done client-side.
            async getAllPayments() {
                if (this._isDenied()) return [];

                const bookingIds = await this._scopedBookingIds();
                if (bookingIds && bookingIds.length === 0) return [];

                let query = supabase
                    .from('payments')
                    .select('*')
                    .order('payment_date', { ascending: false });
                if (bookingIds) query = query.in('booking_id', bookingIds);
                const { data, error } = await query;
                if (error) throw error;
                return data || [];
            },
            async savePayment(payment) {
                const { data, error } = await supabase
                    .from('payments')
                    .insert([payment])
                    .select();
                if (error) throw error;
                return data?.[0];
            },
            async updatePayment(id, payment) {
                const { data, error } = await supabase
                    .from('payments')
                    .update(payment)
                    .eq('id', id)
                    .select();
                if (error) throw error;
                return data?.[0];
            },
            async deletePayment(id) {
                const { error } = await supabase.from('payments').delete().eq('id', id);
                if (error) throw error;
            },
            async saveProperty(property) {
                if (property.id) {
                    const { data, error } = await supabase.from('properties').update(property).eq('id', property.id).select();
                    if (error) throw error;
                    return data?.[0];
                } else {
                    const { data, error } = await supabase.from('properties').insert([property]).select();
                    if (error) throw error;
                    return data?.[0];
                }
            },
            async deleteProperty(id) {
                const { error } = await supabase.from('properties').delete().eq('id', id);
                if (error) throw error;
            },

            // ─── Rooms ───────────────────────────────────────
            // Optional children of a property. A property with no rooms is
            // sold whole — which is every property until an owner adds some.
            // Scoping matters here: /api/db-proxy talks to Supabase with the
            // SERVICE ROLE key, which bypasses RLS. The rooms RLS policies
            // protect the Flutter app (real user JWT) but NOT the browser, so
            // the owner filter has to be applied here or one owner's browser
            // receives every other owner's rooms.
            async getRooms(propertyId) {
                if (this._isDenied()) return [];

                let query = supabase.from('rooms').select('*').order('sort_order');

                if (propertyId != null) {
                    // Asking for a specific property — refuse if it isn't ours.
                    if (!this._ownsProperty(propertyId)) return [];
                    query = query.eq('property_id', propertyId);
                } else if (this._ownerPropertyIds) {
                    // No property given: restrict to this owner's properties.
                    // [-1] is an id that cannot exist, so an owner with none
                    // gets an empty set rather than everything.
                    query = query.in('property_id',
                        this._ownerPropertyIds.length > 0 ? this._ownerPropertyIds : [-1]);
                }

                const { data, error } = await query;
                if (error) {
                    // The rooms migration may not have been run yet. Treat that
                    // as "no rooms", so every property stays whole-place and
                    // nothing breaks.
                    console.warn('[db.getRooms] rooms unavailable:', error.message);
                    return [];
                }
                return data || [];
            },

            // null _ownerPropertyIds means Hostizzy staff — unscoped by design.
            _ownsProperty(propertyId) {
                if (this._isDenied()) return false;
                if (this._ownerPropertyIds == null) return true;
                return this._ownerPropertyIds.some(id => String(id) === String(propertyId));
            },
            async saveRoom(room) {
                // Same reason as getRooms: the proxy bypasses RLS, so without
                // this an owner could create or edit a room on someone else's
                // property just by changing the id in the request.
                if (room.property_id != null && !this._ownsProperty(room.property_id)) {
                    throw new Error('That property is not yours.');
                }

                if (room.id) {
                    // Confirm the room we're editing sits under one of our
                    // properties, not just that the payload claims it does.
                    const { data: existing } = await supabase.from('rooms')
                        .select('property_id').eq('id', room.id).maybeSingle();
                    if (existing && !this._ownsProperty(existing.property_id)) {
                        throw new Error('That room is not yours.');
                    }
                    const { data, error } = await supabase.from('rooms')
                        .update({ ...room, updated_at: new Date().toISOString() })
                        .eq('id', room.id).select();
                    if (error) throw error;
                    return data?.[0];
                }

                const { id, ...clean } = room;
                const { data, error } = await supabase.from('rooms').insert([clean]).select();
                if (error) throw error;
                return data?.[0];
            },
            async deleteRoom(id) {
                const { data: existing } = await supabase.from('rooms')
                    .select('property_id').eq('id', id).maybeSingle();
                if (existing && !this._ownsProperty(existing.property_id)) {
                    throw new Error('That room is not yours.');
                }
                const { error } = await supabase.from('rooms').delete().eq('id', id);
                if (error) throw error;
            },

            // ─── Outbound iCal feed tokens ───────────────────
            // Minted on demand so a property that never uses channel sync
            // never carries a live secret. Regenerating simply overwrites,
            // which instantly invalidates the old URL.
            async ensureFeedToken(kind, id) {
                const table = kind === 'room' ? 'rooms' : 'properties';
                const { data: existing } = await supabase.from(table)
                    .select('ical_feed_token').eq('id', id).maybeSingle();
                if (existing?.ical_feed_token) return existing.ical_feed_token;

                const token = _newFeedToken();
                const { error } = await supabase.from(table)
                    .update({ ical_feed_token: token }).eq('id', id);
                if (error) throw error;
                return token;
            },
            async regenerateFeedToken(kind, id) {
                const table = kind === 'room' ? 'rooms' : 'properties';
                const token = _newFeedToken();
                const { error } = await supabase.from(table)
                    .update({ ical_feed_token: token }).eq('id', id);
                if (error) throw error;
                return token;
            },
            // Team members belong to an owner. Hosts manage their own caretakers,
            // so every write is checked against the caller's scope rather than
            // trusting that the UI only ever offered them their own rows.
            // A null _ownerId means Hostizzy staff — unscoped by design.
            async _ownsTeamMember(id) {
                if (this._isDenied()) return false;
                if (this._ownerId == null) return true;
                const { data } = await supabase
                    .from('team_members').select('owner_id').eq('id', id).maybeSingle();
                return !!data && String(data.owner_id) === String(this._ownerId);
            },
            async saveTeamMember(member) {
                if (this._isDenied()) throw new Error('Not permitted');

                // Only a super admin may grant or revoke super admin. The web
                // app reaches Postgres as the SERVICE ROLE, so RLS is not in
                // the way here — without this check any staff member could
                // hand it to themselves from the browser console.
                if ('is_super_admin' in member && !this._isSuperAdmin) {
                    throw new Error('Only a super admin can change super admin access');
                }

                if (member.id) {
                    if (!(await this._ownsTeamMember(member.id))) throw new Error('Not permitted');
                    // Never write the primary key back.
                    const { id, ...changes } = member;
                    const { data, error } = await supabase.from('team_members').update(changes).eq('id', id).select();
                    if (error) throw error;
                    return data?.[0];
                }
                // Scoped callers can only ever create members under themselves.
                // is_super_admin is never set on creation — it is granted
                // deliberately afterwards, by someone who already has it.
                const { is_super_admin, ...safe } = member;
                const row = this._ownerId == null ? safe : { ...safe, owner_id: this._ownerId };
                const { data, error } = await supabase.from('team_members').insert([row]).select();
                if (error) throw error;
                return data?.[0];
            },
            async deleteTeamMember(id) {
                if (!(await this._ownsTeamMember(id))) throw new Error('Not permitted');
                const { error} = await supabase.from('team_members').delete().eq('id', id);
                if (error) throw error;
            },
            // Round 6 — monthly revenue targets (singleton row id=1)
            // revenue_targets is a SINGLE row (id=1) holding Hostizzy's own
            // company-wide targets. There is no per-owner version of it, so a
            // host must neither see nor edit it — reading it would show them
            // Hostizzy's revenue goals, and writing would change them for
            // everyone. Returns null for a scoped caller so the UI can hide it.
            async getRevenueTargets() {
                if (this._ownerId) return null;
                const { data, error } = await supabase
                    .from('revenue_targets')
                    .select('tier_1, tier_2, tier_3, updated_at, updated_by_email')
                    .eq('id', 1)
                    .maybeSingle();
                if (error) throw error;
                // Fallback defaults if the row was never seeded
                return data || { tier_1: 4000000, tier_2: 5000000, tier_3: 6000000 };
            },
            async updateRevenueTargets({ tier_1, tier_2, tier_3, updated_by_email }) {
                if (this._ownerId) throw new Error('Not permitted');
                const payload = {
                    tier_1: Number(tier_1),
                    tier_2: Number(tier_2),
                    tier_3: Number(tier_3)
                };
                if (updated_by_email) payload.updated_by_email = updated_by_email;
                const { data, error } = await supabase
                    .from('revenue_targets')
                    .update(payload)
                    .eq('id', 1)
                    .select();
                if (error) throw error;
                return data?.[0];
            },
            async bulkUpdateReservations(bookingIds, updates) {
                const { error } = await supabase
                    .from('reservations')
                    .update(updates)
                    .in('booking_id', bookingIds);
                if (error) throw error;
            },

            // Property Expenses Functions
            async getPropertyExpenses(propertyId, settlementMonth = null) {
                let query = supabase.from('property_expenses').select('*').eq('property_id', propertyId).order('expense_date', { ascending: false });
                if (settlementMonth) query = query.eq('settlement_month', settlementMonth);
                const { data, error } = await query;
                if (error) throw error;
                return data || [];
            },
            async getAllExpenses(propertyIds = null) {
                let query = supabase.from('property_expenses').select('*').order('expense_date', { ascending: false });
                // Use explicit propertyIds if provided, otherwise use scoped IDs
                const filterIds = (propertyIds && propertyIds.length > 0) ? propertyIds : this._ownerPropertyIds;
                if (filterIds) {
                    query = query.in('property_id', filterIds.length > 0 ? filterIds : [-1]);
                }
                const { data, error } = await query;
                if (error) throw error;
                return data || [];
            },
            async saveExpense(expense) {
                if (expense.id) {
                    const { data, error } = await supabase.from('property_expenses').update(expense).eq('id', expense.id).select();
                    if (error) throw error;
                    return data?.[0];
                } else {
                    const { id, ...cleanExpense } = expense;
                    const { data, error } = await supabase.from('property_expenses').insert([cleanExpense]).select();
                    if (error) throw error;
                    return data?.[0];
                }
            },
            async deleteExpense(expenseId) {
                const { error } = await supabase.from('property_expenses').delete().eq('id', expenseId);
                if (error) throw error;
            },

            // Owner Portal Functions (first set removed — use getOwners/getOwner/createOwner/updateOwner below)
            async getPayoutRequests(ownerId = null) {
                let query = supabase
                    .from('payout_requests')
                    .select('*')
                    .order('requested_at', { ascending: false });
                if (ownerId) {
                    query = query.eq('owner_id', ownerId);
                }
                const { data, error } = await query;
                if (error) throw error;
                return data || [];
            },
            async savePayoutRequest(payout) {
                const { data, error} = await supabase
                    .from('payout_requests')
                    .insert([payout])
                    .select();
                if (error) throw error;
                return data?.[0];
            },
            async updatePayoutStatus(payoutId, status, notes) {
                const updates = {
                    status: status,
                    processed_at: new Date().toISOString(),
                    // Same integer-vs-UUID trap as payments.created_by:
                    // processed_by is INT REFERENCES team_members(id).
                    processed_by: (typeof creatorId === 'function') ? creatorId(currentUser) : (currentUser?.id ?? null),
                    admin_notes: notes
                };
                const { data, error } = await supabase
                    .from('payout_requests')
                    .update(updates)
                    .eq('id', payoutId)
                    .select();
                if (error) throw error;
                return data?.[0];
            },
            // An owner's properties come from properties.owner_id — the same
            // source auth-exchange mints into the JWT and every jwt_* RLS
            // policy reads. property_owners.property_ids is a denormalised
            // copy that only the owner portal ever maintained, and the two had
            // drifted. Single source of truth, resolved here once.
            async getOwnerPropertyIds(ownerId) {
                const { data, error } = await supabase
                    .from('properties')
                    .select('id')
                    .eq('owner_id', ownerId);
                if (error) throw error;
                return (data || []).map(p => p.id);
            },
            // Assign this owner exactly these properties, by writing
            // properties.owner_id — the source of truth. Order matters: claim
            // first, release second, so a failure between the two leaves the
            // owner with a superset rather than with nothing. Losing a property
            // silently is far worse than briefly holding one too many.
            async setOwnerProperties(ownerId, propertyIds) {
                const ids = (propertyIds || []).map(Number).filter(Number.isFinite);

                if (ids.length > 0) {
                    const { error } = await supabase
                        .from('properties')
                        .update({ owner_id: ownerId })
                        .in('id', ids);
                    if (error) throw error;
                }

                // Release anything this owner holds that is no longer selected.
                let release = supabase
                    .from('properties')
                    .update({ owner_id: null })
                    .eq('owner_id', ownerId);
                if (ids.length > 0) {
                    release = release.not('id', 'in', `(${ids.join(',')})`);
                }
                const { error: releaseErr } = await release;
                if (releaseErr) throw releaseErr;
            },
            async getOwnerRevenue(ownerId, startDate = null, endDate = null) {
                const propertyIds = await this.getOwnerPropertyIds(ownerId);
                if (propertyIds.length === 0) {
                    return { totalRevenue: 0, hostizzyCommission: 0, netEarnings: 0, totalBookings: 0, bookings: [] };
                }
                let query = supabase
                    .from('reservations')
                    .select('*')
                    .in('property_id', propertyIds)
                    .in('status', OWNER_EARNING_STATUSES);
                if (startDate) query = query.gte('check_in', startDate);
                if (endDate) query = query.lte('check_in', endDate);
                const { data, error } = await query;
                if (error) throw error;
                const totalRevenue = data.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0);
                const hostizzyCommission = data.reduce((sum, r) => sum + (parseFloat(r.hostizzy_revenue) || 0), 0);
                return {
                    totalRevenue,
                    hostizzyCommission,
                    netEarnings: totalRevenue - hostizzyCommission,
                    totalBookings: data.length,
                    bookings: data
                };
            },
            async getOwnerPendingPayout(ownerId) {
                const propertyIds = await this.getOwnerPropertyIds(ownerId);
                if (propertyIds.length === 0) return 0;
                const { data: reservations } = await supabase
                    .from('reservations')
                    .select('total_amount, taxes, hostizzy_revenue, ota_service_fee, payout_eligible, host_payout')
                    .in('property_id', propertyIds)
                    .eq('payment_status', 'paid')
                    .in('status', OWNER_EARNING_STATUSES);
                // totalEarned = SUM(host_payout) — post-Round-4 canonical "net to owner".
                // Legacy rows (host_payout still null) fall back to
                // payout_eligible − hostizzy_revenue, then to derived-from-total.
                // Uses `!= null` so a legitimate zero is preferred over the fallback.
                const totalEarned = reservations.reduce((sum, r) => {
                    if (r.host_payout != null) {
                        return sum + (parseFloat(r.host_payout) || 0);
                    }
                    let payoutEligible = (r.payout_eligible != null) ? parseFloat(r.payout_eligible) : null;
                    if (payoutEligible == null || isNaN(payoutEligible)) {
                        payoutEligible = (parseFloat(r.total_amount) || 0)
                                       - (parseFloat(r.taxes) || 0)
                                       - (parseFloat(r.ota_service_fee) || 0);
                    }
                    return sum + Math.max(payoutEligible - (parseFloat(r.hostizzy_revenue) || 0), 0);
                }, 0);
                const { data: payouts } = await supabase
                    .from('payout_requests')
                    .select('amount')
                    .eq('owner_id', ownerId)
                    .eq('status', 'completed');
                const totalPaidOut = payouts.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
                return Math.max(totalEarned - totalPaidOut, 0);
            },
            async getOwnerBookings(ownerId) {
                const propertyIds = await this.getOwnerPropertyIds(ownerId);
                if (propertyIds.length === 0) return [];
                const { data, error } = await supabase
                    .from('reservations')
                    .select('*')
                    .in('property_id', propertyIds)
                    .order('check_in', { ascending: false});
                if (error) throw error;
                return data || [];
            },
            // The owner/host directory is a Hostizzy-staff view. A scoped caller
            // (a host, or a caretaker belonging to one) may only ever see their
            // own record — never the rest of the tenant list.
            async getOwners() {
                if (this._isDenied()) return [];
                let query = supabase
                    .from('property_owners')
                    .select('*')
                    .order('created_at', { ascending: false });
                if (this._ownerId) query = query.eq('id', this._ownerId);
                const { data, error } = await query;
                if (error) throw error;
                // Staff below super admin do not see self-signup hosts in the
                // directory either — the Hosts view is theirs to approve and
                // support, not the whole team's to browse.
                if (this._ownerId == null && !this._isSuperAdmin) {
                    return (data || []).filter(o => (typeof accountTypeOf === 'function'
                        ? accountTypeOf(o)
                        : (o.account_type || (o.is_external ? 'host' : 'managed'))) !== 'host');
                }
                return data || [];
            },
            async getOwner(ownerId) {
                const { data, error } = await supabase
                    .from('property_owners')
                    .select('*')
                    .eq('id', ownerId)
                    .single();
                if (error) throw error;
                return data;
            },
            async createOwner(ownerData) {
                const { data, error } = await supabase
                    .from('property_owners')
                    .insert([ownerData])
                    .select();
                if (error) throw error;
                return data?.[0];
            },
            async updateOwner(ownerId, ownerData) {
                const { data, error } = await supabase
                    .from('property_owners')
                    .update(ownerData)
                    .eq('id', ownerId)
                    .select();
                if (error) throw error;
                return data?.[0];
            },
            async deleteOwner(ownerId) {
                const { error } = await supabase
                    .from('property_owners')
                    .delete()
                    .eq('id', ownerId);
                if (error) throw error;
            },

            // ─── Enquiries / Leads ───────────────────────────
            // Enquiries carry property_id, but it is nullable — an enquiry that
            // hasn't been matched to a property yet belongs to whoever received
            // it, which is Hostizzy. A scoped caller sees only enquiries for
            // their own properties, never the unassigned pile.
            async getEnquiries() {
                if (this._isDenied()) return [];
                let query = supabase
                    .from('enquiries')
                    .select('*')
                    .order('created_at', { ascending: false });
                if (this._ownerPropertyIds) {
                    if (this._ownerPropertyIds.length === 0) return [];
                    query = query.in('property_id', this._ownerPropertyIds);
                }
                const { data, error } = await query;
                if (error) throw error;
                return data || [];
            },

            // guest_documents and guest_meal_preferences both hang off a
            // reservation by booking_id. Both were being read unscoped from
            // documents.js, guests.js and meals.js, so a host saw every
            // tenant's KYC and meal choices.
            async getGuestDocuments({ columns = '*', guestType = null } = {}) {
                if (this._isDenied()) return [];
                const bookingIds = await this._scopedBookingIds();
                if (bookingIds && bookingIds.length === 0) return [];

                let query = supabase
                    .from('guest_documents')
                    .select(columns)
                    .order('submitted_at', { ascending: false });
                if (guestType) query = query.eq('guest_type', guestType);
                if (bookingIds) query = query.in('booking_id', bookingIds);
                const { data, error } = await query;
                if (error) throw error;
                return data || [];
            },

            async getMealPreferences(columns = '*') {
                if (this._isDenied()) return [];
                const bookingIds = await this._scopedBookingIds();
                if (bookingIds && bookingIds.length === 0) return [];

                let query = supabase
                    .from('guest_meal_preferences')
                    .select(columns)
                    .order('submitted_at', { ascending: false });
                if (bookingIds) query = query.in('booking_id', bookingIds);
                const { data, error } = await query;
                if (error) throw error;
                return data || [];
            },
            async getEnquiry(id) {
                const { data, error } = await supabase
                    .from('enquiries')
                    .select('*')
                    .eq('id', id)
                    .single();
                if (error) throw error;
                return data;
            },
            async saveEnquiry(enquiry) {
                if (enquiry.id) {
                    const { data, error } = await supabase
                        .from('enquiries')
                        .update({ ...enquiry, updated_at: new Date().toISOString() })
                        .eq('id', enquiry.id)
                        .select();
                    if (error) throw error;
                    return data?.[0];
                } else {
                    const { id, ...clean } = enquiry;
                    const { data, error } = await supabase
                        .from('enquiries')
                        .insert([clean])
                        .select();
                    if (error) throw error;
                    return data?.[0];
                }
            },
            async updateEnquiryStatus(id, status, extra = {}) {
                const updates = { status, updated_at: new Date().toISOString(), ...extra };
                const { data, error } = await supabase
                    .from('enquiries')
                    .update(updates)
                    .eq('id', id)
                    .select();
                if (error) throw error;
                return data?.[0];
            },
            async deleteEnquiry(id) {
                const { error } = await supabase
                    .from('enquiries')
                    .delete()
                    .eq('id', id);
                if (error) throw error;
            },

            // ─── Communications (Supabase-backed) ───────────
            // Existing table schema: booking_id, guest_name, guest_phone,
            // message_type, template_used, message_content, sent_by, sent_at
            // New columns: recipient_email, subject, status, scheduled_for, created_at
            async getCommunications() {
                if (this._isDenied()) return [];
                const bookingIds = await this._scopedBookingIds();
                if (bookingIds && bookingIds.length === 0) return [];

                let query = supabase
                    .from('communications')
                    .select('*')
                    .order('sent_at', { ascending: false });
                if (bookingIds) query = query.in('booking_id', bookingIds);
                const { data, error } = await query;
                if (error) throw error;
                return data || [];
            },
            async saveCommunication(message) {
                const { id, ...clean } = message;
                const { data, error } = await supabase
                    .from('communications')
                    .insert([clean])
                    .select();
                if (error) throw error;
                return data?.[0];
            },

            // ─── Multi-Tenant: Owner Approval ────────────────────
            async getPendingOwners() {
                return supabase.from('property_owners').select('*')
                    .eq('is_external', true).eq('status', 'pending')
                    .order('created_at', { ascending: false });
            },
            async approveOwner(ownerId) {
                return supabase.from('property_owners')
                    .update({ status: 'approved', is_active: true })
                    .eq('id', ownerId)
                    .select();
            },
            async rejectOwner(ownerId) {
                return supabase.from('property_owners')
                    .update({ status: 'rejected', is_active: false })
                    .eq('id', ownerId)
                    .select();
            }
        };
