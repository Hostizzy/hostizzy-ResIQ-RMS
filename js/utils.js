// ResIQ Utils — Performance utilities, formatting, theme, toast/modal

        // ==========================================
        // DATE / TIMEZONE HELPERS
        // ==========================================

        /** Current moment as a Date shifted into IST. Used by dashboards
         *  and revenue-target math so day-of-month boundaries match what
         *  Indian operators see on their phone clock. */
        function getISTNow() {
            return new Date(Date.now() + 5.5 * 60 * 60 * 1000);
        }

        /** Today's date in IST as a YYYY-MM-DD string — the same format
         *  reservation rows store check_in / check_out in. */
        function getTodayKeyIST() {
            return getISTNow().toISOString().split('T')[0];
        }

        // ==========================================
        // PERFORMANCE UTILITIES
        // ==========================================

        /**
         * Debounce function - delays execution until after wait milliseconds of inactivity
         * @param {Function} func - Function to debounce
         * @param {number} wait - Milliseconds to wait
         * @returns {Function} Debounced function
         */
        function debounce(func, wait = 300) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        }

        /**
         * Data Cache with TTL (Time To Live)
         * Reduces unnecessary database queries by caching data in memory
         */
        const dataCache = {
            reservations: { data: null, timestamp: null, ttl: 5 * 60 * 1000 }, // 5 min
            payments: { data: null, timestamp: null, ttl: 5 * 60 * 1000 },
            guests: { data: null, timestamp: null, ttl: 5 * 60 * 1000 },
            properties: { data: null, timestamp: null, ttl: 10 * 60 * 1000 }, // 10 min

            get(key, forceRefresh = false) {
                const cache = this[key];
                if (!cache) return null;

                const isExpired = Date.now() - (cache.timestamp || 0) > cache.ttl;
                if (forceRefresh || !cache.data || isExpired) {
                    return null; // Needs refresh
                }

                console.log(`📦 Cache HIT for ${key} (age: ${Math.round((Date.now() - cache.timestamp) / 1000)}s)`);
                return cache.data;
            },

            set(key, data) {
                if (this[key]) {
                    this[key].data = data;
                    this[key].timestamp = Date.now();
                    console.log(`💾 Cache SET for ${key}`);
                }
            },

            invalidate(key) {
                if (this[key]) {
                    this[key].data = null;
                    this[key].timestamp = null;
                    console.log(`🗑️ Cache INVALIDATED for ${key}`);
                }
            },

            invalidateAll() {
                Object.keys(this).forEach(key => {
                    if (this[key]?.data !== undefined) {
                        this[key].data = null;
                        this[key].timestamp = null;
                    }
                });
                console.log('🗑️ Cache CLEARED');
            }
        };

        /**
         * Haptic Feedback System - Native-feeling interactions
         * Uses Web Vibration API (works in TWA and all modern browsers)
         */
        function triggerHaptic(type = 'light') {
            if ('vibrate' in navigator) {
                switch(type) {
                    case 'light':
                        navigator.vibrate(10);
                        break;
                    case 'medium':
                        navigator.vibrate(20);
                        break;
                    case 'heavy':
                        navigator.vibrate(30);
                        break;
                    case 'success':
                        navigator.vibrate([10, 50, 10]);
                        break;
                    case 'error':
                        navigator.vibrate([20, 100, 20, 100, 20]);
                        break;
                    case 'warning':
                        navigator.vibrate([15, 75, 15]);
                        break;
                }
            }
        }

        // Theme Management
        function initializeTheme() {
            const savedTheme = localStorage.getItem('theme') || 'light';
            applyTheme(savedTheme);
        }

        function toggleTheme() {
            const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            applyTheme(newTheme);
            localStorage.setItem('theme', newTheme);
        }

        function applyTheme(theme) {
            document.documentElement.setAttribute('data-theme', theme);

            // Update theme icons
            const lightIcon = document.querySelector('.theme-icon-light');
            const darkIcon = document.querySelector('.theme-icon-dark');

            if (lightIcon && darkIcon) {
                if (theme === 'dark') {
                    lightIcon.style.display = 'none';
                    darkIcon.style.display = 'block';
                } else {
                    lightIcon.style.display = 'block';
                    darkIcon.style.display = 'none';
                }
            }

            // Update meta theme-color for mobile browsers
            const metaThemeColor = document.querySelector('meta[name="theme-color"]');
            if (metaThemeColor) {
                metaThemeColor.setAttribute('content', theme === 'dark' ? '#1e293b' : '#0891b2');
            }
        }

        // Initialize theme on page load
        initializeTheme();

        // ============================================
        // FINANCIAL UTILITY FUNCTIONS
        // ============================================

        // ==========================================
        // ROOMS
        // ==========================================

        /**
         * Group rooms by property so a render loop can look one up without a
         * query per row. Pass the result of db.getRooms().
         */
        function indexRoomsByProperty(rooms) {
            const byProperty = {};
            (rooms || []).forEach(r => {
                (byProperty[r.property_id] = byProperty[r.property_id] || []).push(r);
            });
            return byProperty;
        }

        /**
         * What to show for a booking's room, or '' when there is nothing worth
         * saying.
         *
         * The important case is the middle one. On a property sold by the room,
         * room_id being NULL does not mean "unspecified" — it means the whole
         * place was sold to one group, which blocks every room. That is a
         * different booking from a single-room one and has to look different.
         *
         * On a property with no rooms configured, every booking is the whole
         * place by definition, so saying so is noise. Returns ''.
         */
        function roomLabelFor(reservation, roomsByProperty) {
            const rooms = roomsByProperty?.[reservation?.property_id];
            if (!rooms || rooms.length === 0) return '';
            if (reservation.room_id == null) return 'Entire place';
            const room = rooms.find(r => String(r.id) === String(reservation.room_id));
            return room ? room.name : 'Room removed';
        }

        /**
         * How much of a property is sold on a given day.
         *
         * Mirrors resiq_availability() in sql/rooms-and-conflict-guard.sql. If
         * these two ever disagree the calendar will offer a date the save
         * trigger then rejects, so the parent/child rule is stated once here
         * and must be changed in both places together:
         *
         *   - a booking with room_id NULL is the WHOLE property, and takes
         *     every room with it
         *   - a booking on any single room leaves the others sellable, but
         *     makes the whole place unsellable
         *   - cancelled bookings are already filtered out before this point
         *
         * `rooms` empty means a whole-place property: capacity of one.
         */
        function computeDayOccupancy(dayBookings, rooms) {
            const bookings = dayBookings || [];
            const total = (rooms && rooms.length) ? rooms.length : 1;
            const wholeTaken = bookings.some(b => b.room_id == null);

            if (!rooms || rooms.length === 0) {
                return {
                    sold: bookings.length > 0 ? 1 : 0,
                    total: 1,
                    wholeTaken: bookings.length > 0,
                    wholeSellable: bookings.length === 0,
                    freeRooms: [],
                };
            }

            const soldRoomIds = new Set(
                bookings.filter(b => b.room_id != null).map(b => String(b.room_id))
            );
            const sold = wholeTaken ? total : soldRoomIds.size;
            const freeRooms = wholeTaken
                ? []
                : rooms.filter(r => !soldRoomIds.has(String(r.id)));

            return {
                sold,
                total,
                wholeTaken,
                // The entire place can only be sold when nothing at all is booked.
                wholeSellable: !wholeTaken && soldRoomIds.size === 0,
                freeRooms,
            };
        }

        /**
         * True for someone who signed up themselves and runs their own
         * property, as opposed to a Hostizzy-managed owner or Hostizzy staff.
         */
        function isSelfServeHost() {
            return typeof currentUser !== 'undefined'
                && currentUser?.userType === 'owner'
                && typeof isHostAccount === 'function'
                && isHostAccount(currentUser);
        }

        /**
         * Hide the parts of the UI that only mean something inside Hostizzy's
         * managed-property arrangement: commission rate, the managed-by toggle,
         * the calculated Hostizzy revenue, and "who received this payment"
         * (Hostizzy vs the owner). A host has no commission arrangement and
         * collects every payment themselves, so these are at best noise and at
         * worst imply we are taking a cut.
         *
         * Mark elements with class="hostizzy-only". Safe to call repeatedly.
         */
        function applyHostFieldVisibility(root) {
            if (!isSelfServeHost()) return;
            (root || document).querySelectorAll('.hostizzy-only')
                .forEach(el => { el.style.display = 'none'; });
        }

        /**
         * The id to stamp on rows that record who created them.
         *
         * payments.created_by is an INTEGER referencing team_members.id. A
         * Hostizzy staff member's id is that integer, so it fits. A host's id
         * is a property_owners UUID, and Postgres rejects it outright:
         *   invalid input syntax for type integer: "6a6e7278-..."
         *
         * Returns the id only when it is genuinely numeric. A host's payment
         * carries no creator id rather than failing to save. (Proper
         * attribution for hosts needs a created_by_email text column — the
         * meals table already does it that way.)
         */
        function creatorId(user) {
            const id = user?.id;
            return (id != null && /^\d+$/.test(String(id))) ? Number(id) : null;
        }

        /**
         * Calculate balance for a reservation.
         * New system (is_legacy = false): balance = total_amount - paid_amount
         * Legacy system (is_legacy = true, OTA): balance = (total_amount - ota_service_fee) - paid_amount
         * Legacy system (is_legacy = true, Direct): balance = total_amount - paid_amount
         */
        function getBalance(reservation) {
            const total = parseFloat(reservation.total_amount) || 0;
            const paid = parseFloat(reservation.paid_amount) || 0;
            const otaFee = parseFloat(reservation.ota_service_fee) || 0;
            const isOTA = reservation.booking_source && reservation.booking_source !== 'DIRECT';

            // For OTA bookings, the receivable is total minus OTA's cut
            // (OTA keeps their service fee, so we never collect it)
            if (isOTA && otaFee > 0) {
                return (total - otaFee) - paid;
            }
            return total - paid;
        }

        /**
         * Calculate host payout (what property receives after OTA takes their cut).
         * For OTA bookings: total_amount - ota_service_fee
         * For Direct bookings: total_amount
         */
        function getHostPayout(reservation) {
            const total = parseFloat(reservation.total_amount) || 0;
            const otaFee = parseFloat(reservation.ota_service_fee) || 0;
            return total - otaFee;
        }

        /**
         * Calculate Hostizzy revenue (commission) for a reservation.
         * Base = (stay_amount - ota_service_fee + extra_guest_charges) * revenue_share%
         * Revenue share is on pre-tax base, excluding OTA's cut.
         */
        function calculateHostizzyRevenueAmount(stayAmount, extraGuestCharges, otaServiceFee, revenueSharePercent) {
            const base = (stayAmount - otaServiceFee + extraGuestCharges);
            return (base * revenueSharePercent) / 100;
        }

        // ============================================
        // SMART NUMBER FORMATTING
        // ============================================

        function formatCurrency(amount, options = {}) {
            const {
                showSymbol = true,
                showDecimals = false,
                compact = true
            } = options;

            const value = parseFloat(amount) || 0;
            const absValue = Math.abs(value);

            let formatted = '';

            if (compact) {
                if (absValue >= 10000000) {
                    // Crores (10M+)
                    formatted = `${(value / 10000000).toFixed(showDecimals ? 2 : 1)}Cr`;
                } else {
                    // Always use Lakhs for consistency
                    formatted = `${(value / 100000).toFixed(2)}L`;
                }
            } else {
                formatted = Math.round(value).toLocaleString('en-IN');
            }

            return showSymbol ? `₹${formatted}` : formatted;
        }

        // Format percentage (e.g., 85.5 → "85.5%")
        function formatPercentage(value) {
            const num = parseFloat(value) || 0;
            return `${num.toFixed(1)}%`;
        }

        // Booking Source Badge Helper
        function getBookingSourceBadge(source) {
            if (!source) return '<span style="color: var(--text-secondary); font-size: 12px;">N/A</span>';

            const badges = {
                'DIRECT': { emoji: '🟢', color: '#10b981', label: 'Direct' },
                'AIRBNB': { emoji: '🔵', color: '#2563eb', label: 'Airbnb' },
                'AGODA/BOOKING.COM': { emoji: '🟡', color: '#f59e0b', label: 'Agoda/Booking' },
                'MMT/GOIBIBO': { emoji: '🟠', color: '#f97316', label: 'MMT/Goibibo' },
                'OTHER': { emoji: '⚪', color: '#64748b', label: 'Other' }
            };

            const badge = badges[source] || badges['OTHER'];

            return `
                <span style="
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    padding: 4px 8px;
                    background: ${badge.color}15;
                    color: ${badge.color};
                    border-radius: 4px;
                    font-size: 12px;
                    font-weight: 600;
                    white-space: nowrap;
                ">
                    ${badge.emoji} ${badge.label}
                </span>
            `;
        }

        // Toast Notifications
        function showToast(title, message, icon = '🔔') {
            // Haptic feedback based on icon
            if (icon === '✅') haptic('success');
            else if (icon === '❌') haptic('error');
            else if (icon === '⚠️') haptic('warning');
            else haptic('light');
            const toast = document.getElementById('notificationToast');
            document.getElementById('toastIcon').textContent = icon;
            document.getElementById('toastTitle').textContent = title;
            document.getElementById('toastMessage').textContent = message;
            toast.classList.add('show');
            setTimeout(() => {
                toast.classList.remove('show');
            }, 5000);
        }

        function hideToast() {
            document.getElementById('notificationToast').classList.remove('show');
        }

        /**
         * Show a generic modal with custom content
         */
        function showModal(title, content, onClose = null) {
            // Create modal element if it doesn't exist
            let modal = document.getElementById('genericModal');

            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'genericModal';
                modal.className = 'modal';
                document.body.appendChild(modal);
            }

            // Set modal content
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h2 style="margin: 0;">${title}</h2>
                        <button class="close-btn" onclick="closeGenericModal()">&times;</button>
                    </div>
                    <div class="modal-body" style="max-height: 70vh; overflow-y: auto;">
                        ${content}
                    </div>
                </div>
            `;

            // Show modal
            modal.classList.add('active');

            // Store onClose callback
            if (onClose) {
                modal._onClose = onClose;
            }
        }

        /**
         * Close the generic modal
         */
        function closeGenericModal() {
            const modal = document.getElementById('genericModal');
            if (modal) {
                modal.classList.remove('active');

                // Call onClose callback if it exists
                if (modal._onClose) {
                    modal._onClose();
                    delete modal._onClose;
                }
            }
        }
