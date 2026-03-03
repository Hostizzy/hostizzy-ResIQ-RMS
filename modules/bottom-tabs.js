/**
 * ResIQ Bottom Tab Navigation
 * Enhanced mobile/tablet bottom navigation with:
 * - Active state indicators with animated pill
 * - Badge counts for notifications/pending items
 * - Long-press for quick actions
 * - Haptic feedback integration
 * - Tablet-optimized wider layout
 * - Only shows on mobile (<= 768px) and tablet (769-1024px)
 */

const BOTTOM_TABS_CSS = `
/* =============================================
   BOTTOM TAB BAR — Premium Native Design
   ============================================= */
.resiq-bottom-tabs {
    display: none;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 9999;
    background: rgba(255, 255, 255, 0.97);
    -webkit-backdrop-filter: saturate(180%) blur(20px);
    backdrop-filter: saturate(180%) blur(20px);
    border-top: 0.5px solid rgba(0, 0, 0, 0.08);
    padding-bottom: env(safe-area-inset-bottom, 0px);
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

[data-theme="dark"] .resiq-bottom-tabs {
    background: rgba(15, 23, 42, 0.97);
    border-top-color: rgba(255, 255, 255, 0.06);
}

.resiq-bottom-tabs.hidden-tabs {
    transform: translateY(100%);
}

.resiq-bottom-tabs-inner {
    display: flex;
    align-items: center;
    justify-content: space-around;
    max-width: 480px;
    margin: 0 auto;
    height: 64px;
    padding: 0 8px;
    position: relative;
}

/* Show on tablet */
@media (min-width: 769px) and (max-width: 1024px) {
    .resiq-bottom-tabs { display: flex !important; }
    .resiq-bottom-tabs-inner {
        max-width: 540px;
        height: 68px;
    }
}

/* Show on mobile */
@media (max-width: 768px) {
    .resiq-bottom-tabs { display: flex !important; }
}

/* Hide on desktop */
@media (min-width: 1025px) {
    .resiq-bottom-tabs { display: none !important; }
}

/* --- Tab Button --- */
.resiq-tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    height: 100%;
    padding: 8px 4px 6px;
    gap: 4px;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
    position: relative;
    border: none;
    background: none;
    color: #94a3b8;
    transition: color 0.25s ease;
    outline: none;
    min-width: 56px;
}

[data-theme="dark"] .resiq-tab {
    color: #64748b;
}

.resiq-tab:active {
    transform: scale(0.92);
    transition: transform 0.08s ease;
}

.resiq-tab.active {
    color: var(--primary, #0891b2);
}

[data-theme="dark"] .resiq-tab.active {
    color: #22d3ee;
}

/* --- Icon --- */
.resiq-tab-icon {
    position: relative;
    width: 40px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 16px;
    transition: background 0.3s ease;
}

.resiq-tab.active .resiq-tab-icon {
    background: rgba(8, 145, 178, 0.12);
}

[data-theme="dark"] .resiq-tab.active .resiq-tab-icon {
    background: rgba(34, 211, 238, 0.15);
}

.resiq-tab-icon svg {
    width: 24px;
    height: 24px;
    stroke-width: 1.8;
    transition: stroke-width 0.2s ease;
}

.resiq-tab.active .resiq-tab-icon svg {
    stroke-width: 2.2;
}

/* --- Label --- */
.resiq-tab-label {
    font-size: 11px;
    font-weight: 500;
    line-height: 1;
    letter-spacing: 0.1px;
    white-space: nowrap;
}

.resiq-tab.active .resiq-tab-label {
    font-weight: 700;
    color: var(--primary, #0891b2);
}

[data-theme="dark"] .resiq-tab.active .resiq-tab-label {
    color: #22d3ee;
}

/* --- Active indicator pill --- */
.resiq-tab-indicator {
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 3px;
    background: var(--primary, #0891b2);
    border-radius: 0 0 6px 6px;
    transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.resiq-tab.active .resiq-tab-indicator {
    width: 24px;
}

/* --- Badge --- */
.resiq-tab-badge {
    position: absolute;
    top: -2px;
    right: 0px;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    border-radius: 8px;
    background: #ef4444;
    color: white;
    font-size: 9px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    border: 2px solid rgba(255, 255, 255, 0.97);
    animation: badgePop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

[data-theme="dark"] .resiq-tab-badge {
    border-color: rgba(15, 23, 42, 0.97);
}

@keyframes badgePop {
    0% { transform: scale(0); }
    50% { transform: scale(1.2); }
    100% { transform: scale(1); }
}

.resiq-tab-badge:empty,
.resiq-tab-badge[data-count="0"] {
    display: none;
}

/* --- FAB in center --- */
.resiq-tab-fab {
    position: relative;
    width: 50px;
    height: 50px;
    border-radius: 16px;
    background: linear-gradient(135deg, #0891b2, #0e7490);
    color: white;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 16px rgba(8, 145, 178, 0.4), 0 2px 4px rgba(0, 0, 0, 0.1);
    transform: translateY(-6px);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    -webkit-tap-highlight-color: transparent;
    outline: none;
    flex-shrink: 0;
}

.resiq-tab-fab:active {
    transform: translateY(-6px) scale(0.9);
    box-shadow: 0 2px 8px rgba(8, 145, 178, 0.25);
}

.resiq-tab-fab svg {
    width: 26px;
    height: 26px;
    stroke-width: 2.5;
}

/* --- Long-press tooltip --- */
.resiq-tab-tooltip {
    position: absolute;
    bottom: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%) scale(0.8);
    background: #0f172a;
    color: white;
    padding: 6px 12px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s ease, transform 0.2s ease;
    z-index: 10;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.resiq-tab-tooltip.visible {
    opacity: 1;
    transform: translateX(-50%) scale(1);
}

.resiq-tab-tooltip::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 5px solid transparent;
    border-top-color: #0f172a;
}

/* --- Layout adjustments when tabs are visible --- */
@media (max-width: 1024px) {
    body.has-bottom-tabs .container {
        padding-bottom: calc(72px + env(safe-area-inset-bottom, 0px)) !important;
    }
    body.has-bottom-tabs .mobile-nav {
        display: none !important;
    }
}
`;

// SVG icons (inline to avoid dependency on Lucide load timing)
const TAB_ICONS = {
    home: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    calendar: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>',
    plus: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>',
    creditCard: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>',
    bell: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>',
    grid: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>',
};

const DEFAULT_TABS = [
    { id: 'home', label: 'Home', icon: 'home', view: 'home' },
    { id: 'bookings', label: 'Bookings', icon: 'calendar', view: 'reservations' },
    { id: 'fab', label: '', icon: 'plus', isFab: true, action: 'newBooking' },
    { id: 'payments', label: 'Payments', icon: 'creditCard', view: 'payments' },
    { id: 'notifications', label: 'Alerts', icon: 'bell', action: 'toggleNotifications' },
];

class BottomTabs {
    constructor() {
        this.tabs = DEFAULT_TABS;
        this.activeTab = 'home';
        this.badges = {};
        this.element = null;
        this.longPressTimer = null;
        this._injected = false;
    }

    init() {
        if (this._injected) return;
        this._injectCSS();
        this._render();
        this._bindEvents();
        this._injected = true;

        // Sync with existing state
        const lastView = localStorage.getItem('lastView');
        if (lastView) {
            this._syncActiveTab(lastView);
        }
    }

    _injectCSS() {
        const style = document.createElement('style');
        style.id = 'resiq-bottom-tabs-css';
        style.textContent = BOTTOM_TABS_CSS;
        document.head.appendChild(style);
    }

    _render() {
        this.element = document.createElement('nav');
        this.element.className = 'resiq-bottom-tabs';
        this.element.id = 'resiqBottomTabs';
        this.element.setAttribute('role', 'navigation');
        this.element.setAttribute('aria-label', 'Main navigation');

        const inner = document.createElement('div');
        inner.className = 'resiq-bottom-tabs-inner';

        this.tabs.forEach(tab => {
            if (tab.isFab) {
                const fab = document.createElement('button');
                fab.className = 'resiq-tab-fab';
                fab.id = `resiq-tab-${tab.id}`;
                fab.setAttribute('aria-label', 'New Booking');
                fab.innerHTML = TAB_ICONS[tab.icon] || '';
                inner.appendChild(fab);
            } else {
                const btn = document.createElement('button');
                btn.className = `resiq-tab${this.activeTab === tab.id ? ' active' : ''}`;
                btn.id = `resiq-tab-${tab.id}`;
                btn.setAttribute('role', 'tab');
                btn.setAttribute('aria-selected', this.activeTab === tab.id ? 'true' : 'false');
                btn.setAttribute('aria-label', tab.label);

                btn.innerHTML = `
                    <div class="resiq-tab-indicator"></div>
                    <div class="resiq-tab-icon">
                        ${TAB_ICONS[tab.icon] || ''}
                        <span class="resiq-tab-badge" data-tab="${tab.id}" data-count="0"></span>
                    </div>
                    <span class="resiq-tab-label">${tab.label}</span>
                `;
                inner.appendChild(btn);
            }
        });

        this.element.appendChild(inner);
        document.body.appendChild(this.element);
        document.body.classList.add('has-bottom-tabs');
    }

    _bindEvents() {
        this.tabs.forEach(tab => {
            const el = document.getElementById(`resiq-tab-${tab.id}`);
            if (!el) return;

            // Tap
            el.addEventListener('click', (e) => {
                e.preventDefault();
                this._handleTap(tab);
            });

            // Long press (for non-FAB tabs)
            if (!tab.isFab) {
                let pressTimer;
                el.addEventListener('touchstart', () => {
                    pressTimer = setTimeout(() => {
                        this._handleLongPress(tab, el);
                    }, 500);
                }, { passive: true });
                el.addEventListener('touchend', () => clearTimeout(pressTimer), { passive: true });
                el.addEventListener('touchmove', () => clearTimeout(pressTimer), { passive: true });
            }
        });
    }

    _handleTap(tab) {
        // Haptic feedback
        if (window.nativeApp?.haptic) {
            window.nativeApp.haptic(tab.isFab ? 'medium' : 'light');
        } else if (window.triggerHaptic) {
            window.triggerHaptic(tab.isFab ? 'medium' : 'light');
        }

        if (tab.isFab) {
            if (typeof window.openReservationModal === 'function') {
                window.openReservationModal();
            }
            return;
        }

        if (tab.action === 'toggleNotifications') {
            if (window.ResIQNotificationCenter) {
                window.ResIQNotificationCenter.toggle();
            } else if (typeof window.toggleNotificationCenter === 'function') {
                window.toggleNotificationCenter();
            }
            return;
        }

        if (tab.view) {
            this.setActive(tab.id);
            if (typeof window.showView === 'function') {
                window.showView(tab.view);
            }
        }
    }

    _handleLongPress(tab, el) {
        if (window.nativeApp?.haptic) {
            window.nativeApp.haptic('medium');
        }

        // Show tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'resiq-tab-tooltip';
        tooltip.textContent = this._getLongPressLabel(tab);
        el.appendChild(tooltip);
        requestAnimationFrame(() => tooltip.classList.add('visible'));

        setTimeout(() => {
            tooltip.classList.remove('visible');
            setTimeout(() => tooltip.remove(), 200);
        }, 1500);
    }

    _getLongPressLabel(tab) {
        const labels = {
            home: 'Dashboard Overview',
            bookings: 'All Reservations',
            payments: 'Payment Tracker',
            notifications: 'Notification Center',
        };
        return labels[tab.id] || tab.label;
    }

    setActive(tabId) {
        this.activeTab = tabId;
        this.tabs.forEach(tab => {
            const el = document.getElementById(`resiq-tab-${tab.id}`);
            if (!el || tab.isFab) return;
            el.classList.toggle('active', tab.id === tabId);
            el.setAttribute('aria-selected', tab.id === tabId ? 'true' : 'false');
        });
    }

    /** Sync active tab based on view name */
    _syncActiveTab(viewName) {
        const viewToTab = {
            home: 'home',
            reservations: 'bookings',
            payments: 'payments',
        };
        const tabId = viewToTab[viewName];
        if (tabId) {
            this.setActive(tabId);
        }
    }

    setBadge(tabId, count) {
        this.badges[tabId] = count;
        const badge = this.element?.querySelector(`.resiq-tab-badge[data-tab="${tabId}"]`);
        if (badge) {
            badge.textContent = count > 99 ? '99+' : count;
            badge.dataset.count = count;
            badge.style.display = count > 0 ? 'flex' : 'none';
        }
    }

    /** Hide tabs (e.g., when keyboard opens or modal is active) */
    hide() {
        this.element?.classList.add('hidden-tabs');
    }

    show() {
        this.element?.classList.remove('hidden-tabs');
    }

    destroy() {
        this.element?.remove();
        document.getElementById('resiq-bottom-tabs-css')?.remove();
        document.body.classList.remove('has-bottom-tabs');
        this._injected = false;
    }
}

const bottomTabs = new BottomTabs();

// Hook into existing showView to sync active tab
const _origShowView = window.showView;
if (typeof _origShowView === 'function') {
    window.showView = async function(viewName) {
        bottomTabs._syncActiveTab(viewName);
        return _origShowView.call(this, viewName);
    };
}

// Auto-sync when showView is defined later
const showViewInterval = setInterval(() => {
    if (typeof window.showView === 'function' && window.showView !== bottomTabs._patchedShowView) {
        const orig = window.showView;
        bottomTabs._patchedShowView = async function(viewName) {
            bottomTabs._syncActiveTab(viewName);
            return orig.call(this, viewName);
        };
        window.showView = bottomTabs._patchedShowView;
        clearInterval(showViewInterval);
    }
}, 500);
setTimeout(() => clearInterval(showViewInterval), 10000);

window.ResIQBottomTabs = bottomTabs;
export default bottomTabs;
