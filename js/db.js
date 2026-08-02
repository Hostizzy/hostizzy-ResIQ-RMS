// ResIQ DB — Database service layer (Supabase via proxy)

        const db = {
            // ─── Multi-Tenant Scoping ─────────────────────────────
            // Default-deny: queries return [] until initScope() explicitly
            // establishes a scope. Prevents data leaks if a query fires
            // before login completes.
            _ownerId: '__deny__',
            _ownerPropertyIds: [],

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
                    // Hostizzy internal staff — no scope, sees everything
                    this._ownerId = null;
                    this._ownerPropertyIds = null;
                } else {
                    // Unknown user type — deny by default rather than leak data
                    this._ownerId = '__deny__';
                    this._ownerPropertyIds = [];
                    console.error('[db.initScope] Unknown userType, denying access:', user.userType);
                }
            },

            async refreshPropertyScope() {
                if (this._ownerId) {
                    const { data } = await supabase.from('properties').select('id').eq('owner_id', this._ownerId);
                    this._ownerPropertyIds = (data || []).map(p => p.id);
                }
            },

            clearScope() {
                // Reset to the deny sentinel so a logged-out client cannot
                // accidentally see data from a previous session.
                this._ownerId = '__deny__';
                this._ownerPropertyIds = [];
            },

            // Returns true when the current scope is the deny sentinel set by initScope
            _isDenied() {
                return this._ownerId === '__deny__';
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
                if (this._ownerId) query = query.eq('owner_id', this._ownerId);
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
            async getAllPayments() {
                let query = supabase
                    .from('payments')
                    .select('*')
                    .order('payment_date', { ascending: false });
                if (this._ownerPropertyIds) {
                    query = query.in('property_id', this._ownerPropertyIds.length > 0 ? this._ownerPropertyIds : [-1]);
                }
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
            async getRooms(propertyId) {
                if (this._isDenied()) return [];
                let query = supabase.from('rooms').select('*').order('sort_order');
                if (propertyId != null) query = query.eq('property_id', propertyId);
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
            async saveRoom(room) {
                if (room.id) {
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
                const { error } = await supabase.from('rooms').delete().eq('id', id);
                if (error) throw error;
            },
            async saveTeamMember(member) {
                if (member.id) {
                    const { data, error } = await supabase.from('team_members').update(member).eq('id', member.id).select();
                    if (error) throw error;
                    return data?.[0];
                } else {
                    const { data, error } = await supabase.from('team_members').insert([member]).select();
                    if (error) throw error;
                    return data?.[0];
                }
            },
            async deleteTeamMember(id) {
                const { error} = await supabase.from('team_members').delete().eq('id', id);
                if (error) throw error;
            },
            // Round 6 — monthly revenue targets (singleton row id=1)
            async getRevenueTargets() {
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
                    processed_by: currentUser?.id,
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
            async getOwnerRevenue(ownerId, startDate = null, endDate = null) {
                let query = supabase
                    .from('reservations')
                    .select('*')
                    .eq('owner_id', ownerId)
                    .in('status', ['confirmed', 'checked_in', 'completed']);
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
                const { data: reservations } = await supabase
                    .from('reservations')
                    .select('total_amount, taxes, hostizzy_revenue, ota_service_fee, payout_eligible, host_payout')
                    .eq('owner_id', ownerId)
                    .eq('payment_status', 'paid')
                    .in('status', ['confirmed', 'checked_in', 'completed']);
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
                const { data, error } = await supabase
                    .from('reservations')
                    .select('*')
                    .eq('owner_id', ownerId)
                    .order('check_in', { ascending: false});
                if (error) throw error;
                return data || [];
            },
            async getOwners() {
                const { data, error } = await supabase
                    .from('property_owners')
                    .select('*')
                    .order('created_at', { ascending: false });
                if (error) throw error;
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
            async getEnquiries() {
                const { data, error } = await supabase
                    .from('enquiries')
                    .select('*')
                    .order('created_at', { ascending: false });
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
                const { data, error } = await supabase
                    .from('communications')
                    .select('*')
                    .order('sent_at', { ascending: false });
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
