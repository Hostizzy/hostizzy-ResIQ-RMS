/**
 * ResIQ In-App Notification Center
 * Full-screen notification panel with:
 * - Grouped notifications (Today, Yesterday, Earlier)
 * - Notification types with icons and colors
 * - Swipe to dismiss
 * - Mark as read
 * - Notification sounds
 * - Push notification integration
 * - Smart notification generation based on data
 */

const NOTIF_CSS = `
.resiq-notif-panel {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: 380px;
    max-width: 100vw;
    z-index: 10002;
    background: var(--surface, #ffffff);
    box-shadow: -4px 0 20px rgba(0, 0, 0, 0.12);
    transform: translateX(100%);
    transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1);
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

[data-theme="dark"] .resiq-notif-panel {
    background: var(--surface, #1e293b);
    box-shadow: -4px 0 20px rgba(0, 0, 0, 0.4);
}

.resiq-notif-panel.open {
    transform: translateX(0);
}

@media (max-width: 768px) {
    .resiq-notif-panel {
        width: 100vw;
    }
}

.resiq-notif-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.3);
    z-index: 10001;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s ease;
}

.resiq-notif-backdrop.active {
    opacity: 1;
    pointer-events: auto;
}

/* Header */
.resiq-notif-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border, #e2e8f0);
    flex-shrink: 0;
    background: var(--surface, #ffffff);
}

[data-theme="dark"] .resiq-notif-header {
    background: var(--surface, #1e293b);
}

.resiq-notif-title {
    font-size: 18px;
    font-weight: 700;
    color: var(--text-primary, #0f172a);
    display: flex;
    align-items: center;
    gap: 8px;
}

.resiq-notif-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 22px;
    height: 22px;
    padding: 0 6px;
    border-radius: 11px;
    background: var(--primary, #0891b2);
    color: white;
    font-size: 12px;
    font-weight: 700;
}

.resiq-notif-actions {
    display: flex;
    align-items: center;
    gap: 8px;
}

.resiq-notif-action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: 8px;
    border: none;
    background: var(--background-alt, #f1f5f9);
    cursor: pointer;
    color: var(--text-secondary, #475569);
    transition: background 0.2s ease;
}

.resiq-notif-action-btn:active {
    background: var(--border, #e2e8f0);
}

.resiq-notif-action-btn svg {
    width: 18px;
    height: 18px;
}

/* Tabs */
.resiq-notif-tabs {
    display: flex;
    padding: 0 20px;
    border-bottom: 1px solid var(--border, #e2e8f0);
    flex-shrink: 0;
}

.resiq-notif-tab {
    padding: 10px 16px;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-tertiary, #94a3b8);
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: color 0.2s, border-color 0.2s;
    border: none;
    background: none;
}

.resiq-notif-tab.active {
    color: var(--primary, #0891b2);
    border-bottom-color: var(--primary, #0891b2);
}

/* List */
.resiq-notif-list {
    flex: 1;
    overflow-y: auto;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
}

/* Group header */
.resiq-notif-group {
    padding: 8px 20px 4px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-tertiary, #94a3b8);
    background: var(--background-alt, #f1f5f9);
    position: sticky;
    top: 0;
    z-index: 1;
}

[data-theme="dark"] .resiq-notif-group {
    background: rgba(255, 255, 255, 0.03);
}

/* Notification item */
.resiq-notif-item {
    display: flex;
    gap: 12px;
    padding: 14px 20px;
    border-bottom: 1px solid var(--border-light, #f1f5f9);
    cursor: pointer;
    transition: background 0.15s ease;
    position: relative;
}

.resiq-notif-item:active {
    background: var(--background-alt, #f1f5f9);
}

.resiq-notif-item.unread {
    background: rgba(8, 145, 178, 0.04);
}

.resiq-notif-item.unread::before {
    content: '';
    position: absolute;
    left: 8px;
    top: 50%;
    transform: translateY(-50%);
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--primary, #0891b2);
}

.resiq-notif-icon {
    width: 38px;
    height: 38px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.resiq-notif-icon svg {
    width: 18px;
    height: 18px;
}

.resiq-notif-content {
    flex: 1;
    min-width: 0;
}

.resiq-notif-item-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary, #0f172a);
    line-height: 1.3;
    margin-bottom: 2px;
}

.resiq-notif-item-body {
    font-size: 13px;
    color: var(--text-secondary, #475569);
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.resiq-notif-time {
    font-size: 11px;
    color: var(--text-tertiary, #94a3b8);
    white-space: nowrap;
    flex-shrink: 0;
    margin-top: 2px;
}

/* Empty state */
.resiq-notif-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    color: var(--text-tertiary, #94a3b8);
    text-align: center;
}

.resiq-notif-empty svg {
    width: 48px;
    height: 48px;
    margin-bottom: 12px;
    opacity: 0.4;
}

.resiq-notif-empty-text {
    font-size: 15px;
    font-weight: 500;
    margin-bottom: 4px;
}

.resiq-notif-empty-sub {
    font-size: 13px;
}

/* Quick action buttons in notification */
.resiq-notif-item-actions {
    display: flex;
    gap: 6px;
    margin-top: 8px;
}

.resiq-notif-item-action {
    padding: 5px 10px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    border: 1px solid var(--border, #e2e8f0);
    background: var(--surface, #ffffff);
    cursor: pointer;
    color: var(--text-secondary, #475569);
    transition: background 0.15s;
}

.resiq-notif-item-action:active {
    background: var(--background-alt, #f1f5f9);
}

.resiq-notif-item-action.primary {
    background: var(--primary, #0891b2);
    color: white;
    border-color: var(--primary, #0891b2);
}
`;

const NOTIF_ICONS = {
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>',
    bellOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.7 3A6 6 0 0 1 18 8a21.3 21.3 0 0 0 .6 5"/><path d="M17 17H3s3-2 3-9a4.67 4.67 0 0 1 .3-1.7"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/><line x1="2" x2="22" y1="2" y2="22"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>',
};

// Notification type definitions
const NOTIF_TYPES = {
    booking: { color: 'rgba(8, 145, 178, 0.12)', iconColor: '#0891b2', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>' },
    payment: { color: 'rgba(5, 150, 105, 0.12)', iconColor: '#059669', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>' },
    checkin: { color: 'rgba(59, 130, 246, 0.12)', iconColor: '#3b82f6', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" x2="3" y1="12" y2="12"/></svg>' },
    checkout: { color: 'rgba(245, 158, 11, 0.12)', iconColor: '#f59e0b', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>' },
    document: { color: 'rgba(168, 85, 247, 0.12)', iconColor: '#a855f7', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>' },
    alert: { color: 'rgba(220, 38, 38, 0.12)', iconColor: '#dc2626', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>' },
    info: { color: 'rgba(8, 145, 178, 0.08)', iconColor: '#0891b2', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="16" y2="12"/><line x1="12" x2="12.01" y1="8" y2="8"/></svg>' },
    whatsapp: { color: 'rgba(37, 211, 102, 0.12)', iconColor: '#25D366', icon: '<svg viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>' },
};

class NotificationCenter {
    constructor() {
        this._injected = false;
        this._notifications = [];
        this._panel = null;
        this._backdrop = null;
        this._isOpen = false;
        this._activeFilter = 'all';
        this._storageKey = 'resiq_notifications';

        // Load from localStorage
        try {
            const stored = localStorage.getItem(this._storageKey);
            if (stored) this._notifications = JSON.parse(stored);
        } catch (e) { /* ignore */ }
    }

    init() {
        if (this._injected) return;
        const style = document.createElement('style');
        style.id = 'resiq-notif-css';
        style.textContent = NOTIF_CSS;
        document.head.appendChild(style);

        this._createPanel();
        this._injected = true;

        // Sync existing notifications from global array
        this._syncExistingNotifications();

        // Generate smart notifications periodically
        this._startSmartNotifications();
    }

    _createPanel() {
        // Backdrop
        this._backdrop = document.createElement('div');
        this._backdrop.className = 'resiq-notif-backdrop';
        this._backdrop.addEventListener('click', () => this.close());
        document.body.appendChild(this._backdrop);

        // Panel
        this._panel = document.createElement('div');
        this._panel.className = 'resiq-notif-panel';
        this._panel.innerHTML = `
            <div class="resiq-notif-header">
                <div class="resiq-notif-title">
                    Notifications
                    <span class="resiq-notif-count" id="resiqNotifCount">0</span>
                </div>
                <div class="resiq-notif-actions">
                    <button class="resiq-notif-action-btn" title="Mark all read" id="resiqNotifMarkAll">${NOTIF_ICONS.check}</button>
                    <button class="resiq-notif-action-btn" title="Close" id="resiqNotifClose">${NOTIF_ICONS.close}</button>
                </div>
            </div>
            <div class="resiq-notif-tabs">
                <button class="resiq-notif-tab active" data-filter="all">All</button>
                <button class="resiq-notif-tab" data-filter="booking">Bookings</button>
                <button class="resiq-notif-tab" data-filter="payment">Payments</button>
                <button class="resiq-notif-tab" data-filter="alert">Alerts</button>
            </div>
            <div class="resiq-notif-list" id="resiqNotifList"></div>
        `;
        document.body.appendChild(this._panel);

        // Bind events
        this._panel.querySelector('#resiqNotifClose').addEventListener('click', () => this.close());
        this._panel.querySelector('#resiqNotifMarkAll').addEventListener('click', () => this.markAllRead());
        this._panel.querySelectorAll('.resiq-notif-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this._panel.querySelectorAll('.resiq-notif-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this._activeFilter = tab.dataset.filter;
                this._render();
            });
        });
    }

    /** Add a notification */
    add(notification) {
        const notif = {
            id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: notification.type || 'info',
            title: notification.title,
            body: notification.body,
            timestamp: new Date().toISOString(),
            read: false,
            actions: notification.actions || [],
            data: notification.data || {},
            ...notification,
        };

        this._notifications.unshift(notif);

        // Keep max 100 notifications
        if (this._notifications.length > 100) {
            this._notifications = this._notifications.slice(0, 100);
        }

        this._save();
        this._render();
        this._updateBadge();

        // Show toast for new notifications
        if (typeof window.showToast === 'function' && !this._isOpen) {
            window.showToast(notif.title, notif.body, '');
        }

        return notif;
    }

    toggle() {
        if (this._isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    open() {
        this._isOpen = true;
        this._backdrop.classList.add('active');
        this._panel.classList.add('open');
        this._render();

        if (window.nativeApp?.haptic) window.nativeApp.haptic('light');
    }

    close() {
        this._isOpen = false;
        this._backdrop.classList.remove('active');
        this._panel.classList.remove('open');
    }

    markAsRead(id) {
        const notif = this._notifications.find(n => n.id === id);
        if (notif) {
            notif.read = true;
            this._save();
            this._render();
            this._updateBadge();
        }
    }

    markAllRead() {
        this._notifications.forEach(n => n.read = true);
        this._save();
        this._render();
        this._updateBadge();
    }

    clear() {
        this._notifications = [];
        this._save();
        this._render();
        this._updateBadge();
    }

    get unreadCount() {
        return this._notifications.filter(n => !n.read).length;
    }

    _render() {
        const list = this._panel?.querySelector('#resiqNotifList');
        if (!list) return;

        let filtered = this._notifications;
        if (this._activeFilter !== 'all') {
            filtered = filtered.filter(n => n.type === this._activeFilter);
        }

        if (filtered.length === 0) {
            list.innerHTML = `
                <div class="resiq-notif-empty">
                    ${NOTIF_ICONS.bellOff}
                    <div class="resiq-notif-empty-text">No notifications</div>
                    <div class="resiq-notif-empty-sub">You're all caught up!</div>
                </div>
            `;
            return;
        }

        // Group by date
        const groups = this._groupByDate(filtered);
        let html = '';

        for (const [label, items] of Object.entries(groups)) {
            html += `<div class="resiq-notif-group">${label}</div>`;
            for (const notif of items) {
                const typeConfig = NOTIF_TYPES[notif.type] || NOTIF_TYPES.info;
                const timeStr = this._formatTime(notif.timestamp);
                const actionsHTML = notif.actions?.length ? `
                    <div class="resiq-notif-item-actions">
                        ${notif.actions.map(a => `
                            <button class="resiq-notif-item-action ${a.primary ? 'primary' : ''}" data-notif-id="${notif.id}" data-action="${a.id}">${a.label}</button>
                        `).join('')}
                    </div>
                ` : '';

                html += `
                    <div class="resiq-notif-item ${notif.read ? '' : 'unread'}" data-id="${notif.id}">
                        <div class="resiq-notif-icon" style="background: ${typeConfig.color}; color: ${typeConfig.iconColor};">
                            ${typeConfig.icon}
                        </div>
                        <div class="resiq-notif-content">
                            <div class="resiq-notif-item-title">${notif.title}</div>
                            <div class="resiq-notif-item-body">${notif.body || ''}</div>
                            ${actionsHTML}
                        </div>
                        <div class="resiq-notif-time">${timeStr}</div>
                    </div>
                `;
            }
        }

        list.innerHTML = html;

        // Bind click handlers
        list.querySelectorAll('.resiq-notif-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = item.dataset.id;
                this.markAsRead(id);
                const notif = this._notifications.find(n => n.id === id);
                if (notif?.data?.view) {
                    this.close();
                    if (typeof window.showView === 'function') window.showView(notif.data.view);
                }
            });
        });

        list.querySelectorAll('.resiq-notif-item-action').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const notifId = btn.dataset.notifId;
                const actionId = btn.dataset.action;
                const notif = this._notifications.find(n => n.id === notifId);
                const action = notif?.actions?.find(a => a.id === actionId);
                if (action?.callback) action.callback(notif);
                this.markAsRead(notifId);
            });
        });

        // Update count
        const countEl = this._panel.querySelector('#resiqNotifCount');
        if (countEl) {
            const count = this.unreadCount;
            countEl.textContent = count;
            countEl.style.display = count > 0 ? 'inline-flex' : 'none';
        }
    }

    _groupByDate(notifications) {
        const groups = {};
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today.getTime() - 86400000);

        for (const notif of notifications) {
            const date = new Date(notif.timestamp);
            const notifDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

            let label;
            if (notifDate.getTime() === today.getTime()) label = 'Today';
            else if (notifDate.getTime() === yesterday.getTime()) label = 'Yesterday';
            else label = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

            if (!groups[label]) groups[label] = [];
            groups[label].push(notif);
        }
        return groups;
    }

    _formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'now';
        if (diffMins < 60) return `${diffMins}m`;
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h`;
        return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    }

    _updateBadge() {
        const count = this.unreadCount;

        // Update our bottom tabs badge
        if (window.ResIQBottomTabs) {
            window.ResIQBottomTabs.setBadge('notifications', count);
        }

        // Update existing notification badge in navbar
        const badge = document.getElementById('notificationBadge');
        if (badge) {
            badge.textContent = count;
            badge.style.display = count > 0 ? 'inline-flex' : 'none';
        }
    }

    _save() {
        try {
            localStorage.setItem(this._storageKey, JSON.stringify(this._notifications));
        } catch (e) { /* ignore quota exceeded */ }
    }

    /** Sync with any existing global notifications array */
    _syncExistingNotifications() {
        if (window.notifications && Array.isArray(window.notifications)) {
            window.notifications.forEach(n => {
                if (!this._notifications.find(existing => existing.title === n.title && existing.body === n.message)) {
                    this._notifications.push({
                        id: `notif_sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        type: n.type || 'info',
                        title: n.title,
                        body: n.message || n.body,
                        timestamp: n.timestamp || new Date().toISOString(),
                        read: n.read || false,
                        data: n.data || {},
                    });
                }
            });
            this._save();
        }
    }

    /** Generate smart notifications based on app data */
    _startSmartNotifications() {
        // Check for actionable items every 5 minutes
        setInterval(() => this._generateSmartNotifications(), 300000);
        // First check after 10 seconds
        setTimeout(() => this._generateSmartNotifications(), 10000);
    }

    _generateSmartNotifications() {
        const reservations = window.allReservations || window.state?.reservations || [];
        const today = new Date().toISOString().split('T')[0];
        const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

        // Today's check-ins
        const todayCheckins = reservations.filter(r => r.check_in === today && r.status === 'confirmed');
        if (todayCheckins.length > 0) {
            const existingCheckin = this._notifications.find(n =>
                n.type === 'checkin' && n.data?.date === today && n.data?.auto === true
            );
            if (!existingCheckin) {
                this.add({
                    type: 'checkin',
                    title: `${todayCheckins.length} check-in${todayCheckins.length > 1 ? 's' : ''} today`,
                    body: todayCheckins.map(r => r.guest_name).join(', '),
                    data: { view: 'reservations', date: today, auto: true },
                    actions: [
                        { id: 'view', label: 'View All', primary: true, callback: () => {
                            if (typeof window.showView === 'function') window.showView('reservations');
                            this.close();
                        }}
                    ]
                });
            }
        }

        // Tomorrow's check-ins
        const tomorrowCheckins = reservations.filter(r => r.check_in === tomorrow && r.status === 'confirmed');
        if (tomorrowCheckins.length > 0) {
            const existingTomorrow = this._notifications.find(n =>
                n.type === 'checkin' && n.data?.date === tomorrow && n.data?.auto === true
            );
            if (!existingTomorrow) {
                this.add({
                    type: 'checkin',
                    title: `${tomorrowCheckins.length} check-in${tomorrowCheckins.length > 1 ? 's' : ''} tomorrow`,
                    body: tomorrowCheckins.map(r => r.guest_name).join(', '),
                    data: { view: 'reservations', date: tomorrow, auto: true },
                });
            }
        }

        // Overdue payments
        const overduePayments = reservations.filter(r =>
            r.payment_status === 'Overdue' || r.payment_status === 'Pending'
        );
        if (overduePayments.length > 0) {
            const existingPayment = this._notifications.find(n =>
                n.type === 'payment' && n.data?.overdueCount === overduePayments.length && n.data?.auto === true
            );
            if (!existingPayment) {
                const totalDue = overduePayments.reduce((sum, r) =>
                    sum + ((r.total_amount || 0) - (r.paid_amount || 0)), 0
                );
                this.add({
                    type: 'payment',
                    title: `${overduePayments.length} pending payment${overduePayments.length > 1 ? 's' : ''}`,
                    body: `Total outstanding: ₹${totalDue.toLocaleString('en-IN')}`,
                    data: { view: 'payments', overdueCount: overduePayments.length, auto: true },
                    actions: [
                        { id: 'view', label: 'View Payments', primary: true, callback: () => {
                            if (typeof window.showView === 'function') window.showView('payments');
                            this.close();
                        }}
                    ]
                });
            }
        }
    }

    destroy() {
        this._panel?.remove();
        this._backdrop?.remove();
        document.getElementById('resiq-notif-css')?.remove();
        this._injected = false;
    }
}

const notificationCenter = new NotificationCenter();
window.ResIQNotificationCenter = notificationCenter;
export default notificationCenter;
