// ResIQ Offline — IndexedDB, sync queue, WhatsApp templates, lazy loading

        // Lazy Loading System
        const loadedViews = new Set();
        const viewLoadingState = {};

        function markViewAsLoaded(viewName) {
            loadedViews.add(viewName);
            viewLoadingState[viewName] = false;
        }

        function isViewLoaded(viewName) {
            return loadedViews.has(viewName);
        }

        function showViewLoadingSpinner(viewName) {
            const viewEl = document.getElementById(`${viewName}View`);
            if (!viewEl) return;

            // Check if loading spinner already exists
            if (!viewEl.querySelector('.view-loading-spinner')) {
                const spinner = document.createElement('div');
                spinner.className = 'view-loading-spinner';
                spinner.innerHTML = `
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 400px; gap: 16px;">
                        <div class="loading-spinner" style="width: 48px; height: 48px; border-width: 4px;"></div>
                        <div style="color: var(--text-secondary); font-size: 14px;">Loading ${viewName}...</div>
                    </div>
                `;
                viewEl.appendChild(spinner);
            }
        }

        function hideViewLoadingSpinner(viewName) {
            const viewEl = document.getElementById(`${viewName}View`);
            if (!viewEl) return;

            const spinner = viewEl.querySelector('.view-loading-spinner');
            if (spinner) {
                spinner.remove();
            }
        }

        // WhatsApp Message Templates
        const whatsappTemplates = {
            booking_confirmation: (booking) => `🏠 *Booking Confirmation - ResIQ by Hostizzy*

    Hi ${booking.guest_name}! 👋

    Your booking is *CONFIRMED* ✅

    📋 *Booking Details:*
    🆔 Booking ID: *${booking.booking_id}*
    🏡 Property: *${booking.property_name}*
    📅 Check-in: *${formatDate(booking.check_in)}*
    📅 Check-out: *${formatDate(booking.check_out)}*
    🛏️ Nights: *${booking.nights}*
    👥 Guests: *${booking.number_of_guests}*

    💰 *Payment Summary:*
    Total Amount: ₹${Math.round(booking.total_amount).toLocaleString('en-IN')}
    Paid: ₹${Math.round(booking.paid_amount || 0).toLocaleString('en-IN')}
    ${(booking.paid_amount || 0) < booking.total_amount ?
    `Balance Due: ₹${Math.round(booking.total_amount - (booking.paid_amount || 0)).toLocaleString('en-IN')}` :
    'Fully Paid ✅'}

    📍 Property address & directions will be shared 24 hours before check-in.

    For any queries, reply here or call us! 📞

    Thank you for choosing Hostizzy! 🙏
    _Powered by ResIQ_`,

                payment_reminder: (booking) => `💰 *Payment Reminder*

    Hi ${booking.guest_name},

    This is a friendly reminder for your upcoming booking:

    🆔 Booking ID: *${booking.booking_id}*
    🏡 Property: *${booking.property_name}*
    📅 Check-in: *${formatDate(booking.check_in)}*

    💳 *Payment Details:*
    Total Amount: ₹${Math.round(booking.total_amount).toLocaleString('en-IN')}
    Already Paid: ₹${Math.round(booking.paid_amount || 0).toLocaleString('en-IN')}
    *Pending Balance: ₹${Math.round(booking.total_amount - (booking.paid_amount || 0)).toLocaleString('en-IN')}*

    Please complete the payment at your earliest convenience.

    🏦 *Payment Options:*
    - UPI: hostizzy@paytm
    - Bank Transfer
    - Cash on arrival

    Reply with payment confirmation! ✅

    Thank you! 🙏`,

                check_in_instructions: (booking) => `🏠 *Check-in Instructions*

    Hi ${booking.guest_name}! 👋

    Your check-in is scheduled for *${formatDate(booking.check_in)}*

    📍 *Property:*
    ${booking.property_name}

    🔑 *Check-in Process:*
    ⏰ Check-in time: 2:00 PM
    📞 Call our property manager 30 mins before arrival
    🚗 Parking: Available on premises

    🏠 *Property Manager Contact:*
    We'll share contact details closer to check-in date.

    Have a wonderful stay! 🌟

    Need any help? Just reply to this message! 📱`,

                thank_you: (booking) => `🙏 *Thank You for Staying with Us!*

    Hi ${booking.guest_name},

    Thank you for choosing *${booking.property_name}* for your stay!

    We hope you had a wonderful experience! ⭐

    📝 *We'd love your feedback:*
    Your review helps us improve and helps other guests make informed decisions.

    🎁 *Special Offer:*
    Book your next stay with us and get 10% OFF!
    Use code: *RETURNGUEST10*

    Looking forward to hosting you again! 🏠

    Warm regards,
    Team Hostizzy 💚`,

                custom: (booking) => `Hi ${booking.guest_name},

    [Type your message here]

    Booking ID: ${booking.booking_id}
    Property: ${booking.property_name}

    Team Hostizzy 🏠`
            };
        let offlineDB = null;
        let isOnline = navigator.onLine;
        let syncInProgress = false;
        // Global state for home screen
        const state = {
            reservations: [],
            properties: [],
            payments: []
        };

        // IndexedDB Setup
        const DB_NAME = 'HostizzyOfflineDB';
        const DB_VERSION = 1;

        async function initOfflineDB() {
            return new Promise((resolve, reject) => {
                const request = indexedDB.open(DB_NAME, DB_VERSION);

                request.onerror = () => reject(request.error);

                request.onsuccess = () => {
                    offlineDB = request.result;
                    console.log('IndexedDB initialized');
                    resolve(offlineDB);
                };

                request.onupgradeneeded = (event) => {
                    const db = event.target.result;

                    if (!db.objectStoreNames.contains('pendingReservations')) {
                        const reservationStore = db.createObjectStore('pendingReservations', { keyPath: 'tempId' });
                        reservationStore.createIndex('timestamp', 'timestamp', { unique: false });
                        reservationStore.createIndex('syncStatus', 'syncStatus', { unique: false });
                    }

                    if (!db.objectStoreNames.contains('pendingPayments')) {
                        const paymentStore = db.createObjectStore('pendingPayments', { keyPath: 'tempId' });
                        paymentStore.createIndex('timestamp', 'timestamp', { unique: false });
                        paymentStore.createIndex('syncStatus', 'syncStatus', { unique: false });
                    }

                    if (!db.objectStoreNames.contains('pendingEdits')) {
                        const editStore = db.createObjectStore('pendingEdits', { keyPath: 'tempId' });
                        editStore.createIndex('timestamp', 'timestamp', { unique: false });
                        editStore.createIndex('syncStatus', 'syncStatus', { unique: false });
                    }
                };
            });
        }

        async function saveToOfflineDB(storeName, data) {
            if (!offlineDB) await initOfflineDB();

            return new Promise((resolve, reject) => {
                const transaction = offlineDB.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);

                const item = {
                    ...data,
                    tempId: 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                    timestamp: Date.now(),
                    syncStatus: 'pending'
                };

                const request = store.add(item);
                request.onsuccess = () => resolve(item);
                request.onerror = () => reject(request.error);
            });
        }

        async function getAllFromOfflineDB(storeName, status = null) {
            if (!offlineDB) await initOfflineDB();

            return new Promise((resolve, reject) => {
                const transaction = offlineDB.transaction([storeName], 'readonly');
                const store = transaction.objectStore(storeName);

                let request;
                if (status) {
                    const index = store.index('syncStatus');
                    request = index.getAll(status);
                } else {
                    request = store.getAll();
                }

                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => reject(request.error);
            });
        }

        async function deleteFromOfflineDB(storeName, tempId) {
            if (!offlineDB) await initOfflineDB();

            return new Promise((resolve, reject) => {
                const transaction = offlineDB.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.delete(tempId);

                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        }

        async function countPendingItems() {
            const stores = ['pendingReservations', 'pendingPayments', 'pendingEdits'];
            let total = 0;

            for (const store of stores) {
                const items = await getAllFromOfflineDB(store, 'pending');
                total += items.length;
            }

            return total;
        }

        function updateSyncIndicator() {
            const indicator = document.getElementById('syncIndicator');
            const dot = indicator.querySelector('.sync-dot');
            const status = document.getElementById('syncStatus');
            const syncBtn = document.getElementById('manualSyncBtn');
            const banner = document.getElementById('offlineBanner');

            if (syncInProgress) {
                indicator.className = 'sync-indicator syncing';
                dot.className = 'sync-dot syncing';
                status.textContent = 'Syncing...';
                syncBtn.style.display = 'none';
                banner.classList.remove('show');
            } else if (isOnline) {
                indicator.className = 'sync-indicator online';
                dot.className = 'sync-dot online';
                status.textContent = 'Online';
                syncBtn.style.display = 'none';
                banner.classList.remove('show');
            } else {
                indicator.className = 'sync-indicator offline';
                dot.className = 'sync-dot offline';
                status.textContent = 'Offline';
                syncBtn.style.display = 'inline-block';
                banner.classList.add('show');
            }

            updatePendingCount();
        }

        async function updatePendingCount() {
            try {
                const count = await countPendingItems();
                const badge = document.getElementById('pendingCount');

                if (count > 0) {
                    badge.textContent = count;
                    badge.style.display = 'inline-block';
                } else {
                    badge.style.display = 'none';
                }
            } catch (error) {
                console.error('Error counting pending items:', error);
            }
        }

        // Online/Offline Detection
        window.addEventListener('online', () => {
            console.log('Network: Online');
            isOnline = true;
            updateSyncIndicator();
            showToast('Connection Restored', 'You are back online. Syncing data...', '✅');
            setTimeout(() => autoSync(), 1000);
        });

        window.addEventListener('offline', () => {
            console.log('Network: Offline');
            isOnline = false;
            updateSyncIndicator();
            showToast('No Connection', 'You are offline. Changes will be saved locally.', '⚠️');
        });

        async function autoSync() {
            if (syncInProgress || !isOnline) return;

            try {
                const pendingCount = await countPendingItems();
                if (pendingCount === 0) return;

                console.log(`Auto-syncing ${pendingCount} pending items...`);
                await syncAllPendingData();
            } catch (error) {
                console.error('Auto-sync error:', error);
            }
        }

        async function manualSync() {
            if (syncInProgress) return;
            if (!isOnline) {
                showToast('Cannot Sync', 'You are offline', '❌');
                return;
            }

            try {
                const pendingCount = await countPendingItems();
                if (pendingCount === 0) {
                    showToast('Nothing to Sync', 'All data is up to date', 'ℹ️');
                    return;
                }

                await syncAllPendingData();
            } catch (error) {
                console.error('Manual sync error:', error);
                showToast('Sync Failed', error.message, '❌');
            }
        }

        async function syncAllPendingData() {
            if (syncInProgress) return;

            syncInProgress = true;
            updateSyncIndicator();

            let successCount = 0;
            let failCount = 0;

            try {
                // Sync reservations
                const pendingReservations = await getAllFromOfflineDB('pendingReservations', 'pending');
                for (const item of pendingReservations) {
                    try {
                        await syncReservation(item);
                        successCount++;
                    } catch (error) {
                        console.error('Failed to sync reservation:', error);
                        failCount++;
                    }
                }

                // Sync payments
                const pendingPayments = await getAllFromOfflineDB('pendingPayments', 'pending');
                for (const item of pendingPayments) {
                    try {
                        await syncPayment(item);
                        successCount++;
                    } catch (error) {
                        console.error('Failed to sync payment:', error);
                        failCount++;
                    }
                }

                // Sync edits
                const pendingEdits = await getAllFromOfflineDB('pendingEdits', 'pending');
                for (const item of pendingEdits) {
                    try {
                        await syncEdit(item);
                        successCount++;
                    } catch (error) {
                        console.error('Failed to sync edit:', error);
                        failCount++;
                    }
                }

                if (failCount === 0) {
                    showToast('Sync Complete', `Successfully synced ${successCount} items`, '✅');
                } else {
                    showToast('Partial Sync', `Synced ${successCount}, ${failCount} failed`, '⚠️');
                }

                await loadReservations();
                await loadPayments();
                await loadDashboard();

            } catch (error) {
                console.error('Sync error:', error);
                showToast('Sync Failed', error.message, '❌');
            } finally {
                syncInProgress = false;
                updateSyncIndicator();
            }
        }

        async function syncReservation(item) {
            const { tempId, timestamp, syncStatus, ...reservationData } = item;
            const result = await db.saveReservation(reservationData);
            await deleteFromOfflineDB('pendingReservations', tempId);
        }

        async function syncPayment(item) {
            const { tempId, timestamp, syncStatus, ...paymentData } = item;
            const result = await db.savePayment(paymentData);
            await recalculatePaymentStatus(paymentData.booking_id);
            await deleteFromOfflineDB('pendingPayments', tempId);
        }

        async function syncEdit(item) {
            const { tempId, timestamp, syncStatus, booking_id, updates, table } = item;

            const { error } = await supabase
                .from(table)
                .update(updates)
                .eq('booking_id', booking_id);

            if (error) throw error;
            await deleteFromOfflineDB('pendingEdits', tempId);
        }
