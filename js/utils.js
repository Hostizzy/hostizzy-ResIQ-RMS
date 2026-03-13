// ResIQ Utils — Performance utilities, formatting, theme, toast/modal

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
            const isLegacy = reservation.is_legacy === true;

            if (isLegacy && isOTA) {
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
