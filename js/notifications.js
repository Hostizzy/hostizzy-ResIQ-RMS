// ResIQ Notifications — Notification center, browser push, preferences

        // Notification System
        let notifications = [];
        let notificationPreferences = {
            browserNotifications: false,
            soundEnabled: true,
            checkIns: true,
            payments: true,
            documentExpiry: true,
            systemAlerts: true
        };

        // Load preferences and notifications
        function loadNotificationPreferences() {
            const saved = localStorage.getItem('notificationPreferences');
            if (saved) {
                notificationPreferences = JSON.parse(saved);
            }
            const savedNotifications = localStorage.getItem('notifications');
            if (savedNotifications) {
                notifications = JSON.parse(savedNotifications);
                updateNotificationBadge();
            }
        }

        function saveNotificationPreferences() {
            localStorage.setItem('notificationPreferences', JSON.stringify(notificationPreferences));
        }

        function saveNotifications() {
            localStorage.setItem('notifications', JSON.stringify(notifications));
        }

        // Toggle Notification Center
        function toggleNotificationCenter() {
            const dropdown = document.getElementById('notificationDropdown');
            dropdown.classList.toggle('active');

            // Mark all as read when opened
            if (dropdown.classList.contains('active')) {
                notifications.forEach(n => n.read = true);
                saveNotifications();
                updateNotificationBadge();
            }
        }

        // Add Notification
        function addNotification(title, message, type = 'info', action = null) {
            // Check preferences
            if (!notificationPreferences[type] && type !== 'info') {
                return;
            }

            const notification = {
                id: Date.now(),
                title,
                message,
                type,
                action,
                timestamp: new Date().toISOString(),
                read: false
            };

            notifications.unshift(notification);
            if (notifications.length > 50) {
                notifications = notifications.slice(0, 50); // Keep only 50 most recent
            }

            saveNotifications();
            renderNotifications();
            updateNotificationBadge();

            // Show browser notification if enabled
            if (notificationPreferences.browserNotifications) {
                showBrowserNotification(title, message, type);
            }
        }

        // Render Notifications
        function renderNotifications() {
            const listEl = document.getElementById('notificationList');
            if (!listEl) return;

            if (notifications.length === 0) {
                listEl.innerHTML = `
                    <div style="text-align: center; padding: 40px 20px; color: var(--text-secondary);">
                        <div style="margin-bottom: 8px;"><i data-lucide="bell-off" style="width: 48px; height: 48px; opacity: 0.3;"></i></div>
                        <div>No notifications</div>
                    </div>
                `;
                return;
            }

            const typeIcons = {
                checkIns: '🔵',
                payments: '💰',
                documentExpiry: '📄',
                systemAlerts: '⚠️',
                info: 'ℹ️'
            };

            listEl.innerHTML = notifications.map(notif => `
                <div class="notification-item ${notif.read ? '' : 'unread'}" onclick="handleNotificationClick('${notif.id}')">
                    <div style="display: flex; align-items: start;">
                        <span class="notification-icon">${typeIcons[notif.type] || 'ℹ️'}</span>
                        <div class="notification-content">
                            <div class="notification-title">${notif.title}</div>
                            <div class="notification-message">${notif.message}</div>
                            <div class="notification-time">${formatNotificationTime(notif.timestamp)}</div>
                            ${notif.action ? `
                                <div class="notification-actions">
                                    <button class="notification-action-btn" onclick="event.stopPropagation(); handleNotificationAction('${notif.id}', '${notif.action}')">
                                        ${notif.action === 'viewReservation' ? 'View Booking' : notif.action === 'viewPayment' ? 'View Payment' : 'View'}
                                    </button>
                                    <button class="notification-action-btn" onclick="event.stopPropagation(); dismissNotification('${notif.id}')">
                                        Dismiss
                                    </button>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `).join('');
        }

        // Update Badge
        function updateNotificationBadge() {
            const badge = document.getElementById('notificationBadge');
            if (!badge) return;

            const unreadCount = notifications.filter(n => !n.read).length;

            if (unreadCount > 0) {
                badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
                badge.style.display = 'block';
            } else {
                badge.style.display = 'none';
            }
        }

        // Clear All Notifications
        function clearAllNotifications() {
            if (confirm('Clear all notifications?')) {
                notifications = [];
                saveNotifications();
                renderNotifications();
                updateNotificationBadge();
            }
        }

        // Handle Notification Click
        function handleNotificationClick(notifId) {
            const notif = notifications.find(n => n.id == notifId);
            if (!notif) return;

            notif.read = true;
            saveNotifications();
            renderNotifications();
            updateNotificationBadge();
        }

        // Handle Notification Action
        function handleNotificationAction(notifId, action) {
            const notif = notifications.find(n => n.id == notifId);
            if (!notif) return;

            // Close dropdown
            document.getElementById('notificationDropdown').classList.remove('active');

            // Execute action
            if (action === 'viewReservation') {
                showView('reservations');
            } else if (action === 'viewPayment') {
                showView('payments');
            } else if (action === 'viewDocuments') {
                showView('guestDocuments');
            }

            // Dismiss notification
            dismissNotification(notifId);
        }

        // Dismiss Notification
        function dismissNotification(notifId) {
            notifications = notifications.filter(n => n.id != notifId);
            saveNotifications();
            renderNotifications();
            updateNotificationBadge();
        }

        // Format Time
        function formatNotificationTime(timestamp) {
            const now = new Date();
            const time = new Date(timestamp);
            const diffMs = now - time;
            const diffMins = Math.floor(diffMs / 60000);

            if (diffMins < 1) return 'Just now';
            if (diffMins < 60) return `${diffMins}m ago`;

            const diffHours = Math.floor(diffMins / 60);
            if (diffHours < 24) return `${diffHours}h ago`;

            const diffDays = Math.floor(diffHours / 24);
            if (diffDays < 7) return `${diffDays}d ago`;

            return time.toLocaleDateString();
        }

        // Browser Notifications
        async function requestBrowserNotificationPermission() {
            if (!('Notification' in window)) {
                console.log('Browser notifications not supported');
                return false;
            }

            if (Notification.permission === 'granted') {
                notificationPreferences.browserNotifications = true;
                saveNotificationPreferences();
                return true;
            }

            if (Notification.permission !== 'denied') {
                const permission = await Notification.requestPermission();
                if (permission === 'granted') {
                    notificationPreferences.browserNotifications = true;
                    saveNotificationPreferences();
                    showToast('Success', 'Browser notifications enabled!', '✅');
                    return true;
                }
            }

            return false;
        }

        function showBrowserNotification(title, body, type) {
            if (!('Notification' in window) || Notification.permission !== 'granted') {
                return;
            }

            const icon = '/assets/logo-192.png';
            const notification = new Notification(title, {
                body,
                icon,
                badge: icon,
                tag: `resiq-${type}`,
                requireInteraction: type === 'systemAlerts'
            });

            notification.onclick = function() {
                window.focus();
                notification.close();
            };
        }

        // Initialize notifications
        loadNotificationPreferences();
        renderNotifications();
