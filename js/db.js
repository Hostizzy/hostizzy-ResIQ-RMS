// ResIQ DB — Database service layer (Supabase via proxy)

        const db = {
            async getTeamMembers() {
                const { data, error } = await supabase.from('team_members').select('*');
                if (error) throw error;
                return data || [];
            },
            async getProperties() {
                const { data, error } = await supabase.from('properties').select('*').order('name');
                if (error) throw error;
                return data || [];
            },
            async getReservations() {
                const { data, error } = await supabase.from('reservations').select('*').order('check_in', { ascending: false });
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
                .select('revenue_share_percent')
                .eq('id', propertyId)
                .single();
            return data?.revenue_share_percent || 20; // Default 20% if not set
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
                const { data, error } = await supabase
                    .from('payments')
                    .select('*')
                    .order('payment_date', { ascending: false });
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
                if (propertyIds && propertyIds.length > 0) query = query.in('property_id', propertyIds);
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

            // Owner Portal Functions
            async getOwners() {
                const { data, error } = await supabase
                    .from('property_owners')
                    .select('*')
                    .order('name');
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
            async saveOwner(owner) {
                if (owner.id) {
                    const { data, error } = await supabase
                        .from('property_owners')
                        .update(owner)
                        .eq('id', owner.id)
                        .select();
                    if (error) throw error;
                    return data?.[0];
                } else {
                    const { data, error } = await supabase
                        .from('property_owners')
                        .insert([owner])
                        .select();
                    if (error) throw error;
                    return data?.[0];
                }
            },
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
                    .select('total_amount, hostizzy_revenue, ota_service_fee, payout_eligible')
                    .eq('owner_id', ownerId)
                    .eq('payment_status', 'paid')
                    .in('status', ['confirmed', 'checked_in', 'completed']);
                const totalEarned = reservations.reduce((sum, r) => {
                    const payoutEligible = parseFloat(r.payout_eligible) || ((parseFloat(r.total_amount) || 0) - (parseFloat(r.ota_service_fee) || 0));
                    return sum + (payoutEligible - (parseFloat(r.hostizzy_revenue) || 0));
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
            }
        };
