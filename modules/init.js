/**
 * ResIQ Module Initializer
 * Master entry point that initializes all ES modules
 * and integrates them with the existing monolithic app
 */

// Import all modules
import store from './state.js';
import bottomTabs from './bottom-tabs.js';
import swipeGestures from './swipe-gestures.js';
import bottomSheet from './bottom-sheet.js';
import skeletonLoader from './skeleton-loading.js';
import pageTransitions from './page-transitions.js';
import notificationCenter from './notification-center.js';
import qrCheckin from './qr-checkin.js';
import whatsappDeep from './whatsapp-deep.js';
import aiAssist from './ai-assist.js';
import router from '../views/router.js';

// Import Web Components (self-registering)
import './components/stat-card.js';
import './components/status-badge.js';
import './components/empty-state.js';

/**
 * Initialize all modules after the main app has loaded
 * Wait for DOM + auth + initial data
 */
function initModules() {
    console.log('🚀 ResIQ Modules: Initializing...');

    // 1. Core infrastructure
    store.state.currentView = localStorage.getItem('lastView') || 'home';
    console.log('  ✓ State store');

    // 2. UI modules (order matters for z-index stacking)
    skeletonLoader.init();
    console.log('  ✓ Skeleton loading');

    pageTransitions.init();
    console.log('  ✓ Page transitions');

    bottomSheet.init();
    console.log('  ✓ Bottom sheets');

    bottomTabs.init();
    console.log('  ✓ Bottom tab navigation');

    swipeGestures.init();
    console.log('  ✓ Swipe gestures');

    // 3. Feature modules
    notificationCenter.init();
    console.log('  ✓ Notification center');

    qrCheckin.init();
    console.log('  ✓ QR check-in');

    whatsappDeep.init();
    console.log('  ✓ WhatsApp deep integration');

    aiAssist.init();
    console.log('  ✓ AI assist / Smart suggestions');

    // 5. Initialize router (History API, lazy-loading)
    // Capture the original showView before modules patch it
    if (typeof window.showView === 'function' && !window._originalShowView) {
        window._originalShowView = window.showView;
    }
    router.init();

    // Wire router to bottom tabs sync
    router.onNavigate((view) => {
        bottomTabs._syncActiveTab(view);
        store.state.currentView = view;
    });
    console.log('  ✓ View router');

    // 6. Wire up integration hooks
    wireIntegrations();

    console.log('🎉 ResIQ Modules: All initialized!');
}

/**
 * Wire up cross-module integrations and hooks into the existing app
 */
function wireIntegrations() {
    // Hook: When notification bell is clicked in the navbar, use our panel
    const existingBellBtn = document.querySelector('.notification-bell-btn');
    if (existingBellBtn) {
        // Replace existing onclick
        existingBellBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            notificationCenter.toggle();
        };
    }

    // Hook: Override toggleNotificationCenter
    window.toggleNotificationCenter = () => notificationCenter.toggle();

    // Hook: Enhance addNotification to also add to our center
    const origAddNotification = window.addNotification;
    window.addNotification = function(title, message, type, action) {
        // Call original if it exists
        if (typeof origAddNotification === 'function') {
            origAddNotification.call(this, title, message, type, action);
        }
        // Also add to our notification center
        notificationCenter.add({
            type: type || 'info',
            title: title,
            body: message,
            data: action || {},
        });
    };

    // Hook: Bottom sheet for quick actions (replace existing if present)
    const existingQuickActions = window.openQuickActions;
    window.openQuickActions = function() {
        bottomSheet.openQuickActions();
    };

    // Hook: WhatsApp functions - enhance with deep integration
    const origSendWhatsAppReminder = window.sendWhatsAppReminder;
    window.sendWhatsAppReminder = function(bookingId) {
        // Find the reservation
        const reservations = window.allReservations || window.state?.reservations || [];
        const reservation = reservations.find(r => r.booking_id === bookingId);
        if (reservation) {
            whatsappDeep.openComposer(reservation, 'payment_reminder');
        } else if (typeof origSendWhatsAppReminder === 'function') {
            origSendWhatsAppReminder.call(this, bookingId);
        }
    };

    const origOpenWhatsAppDirect = window.openWhatsAppDirect;
    window.openWhatsAppDirect = function(bookingId) {
        const reservations = window.allReservations || window.state?.reservations || [];
        const reservation = reservations.find(r => r.booking_id === bookingId);
        if (reservation) {
            whatsappDeep.openComposer(reservation, 'booking_confirmation');
        } else if (typeof origOpenWhatsAppDirect === 'function') {
            origOpenWhatsAppDirect.call(this, bookingId);
        }
    };

    // Hook: Virtual keyboard hides bottom tabs
    if (window.visualViewport) {
        let lastHeight = window.visualViewport.height;
        window.visualViewport.addEventListener('resize', () => {
            const currentHeight = window.visualViewport.height;
            const diff = lastHeight - currentHeight;
            if (diff > 100) {
                // Keyboard opened
                bottomTabs.hide();
            } else if (diff < -100) {
                // Keyboard closed
                bottomTabs.show();
            }
            lastHeight = currentHeight;
        });
    }

    // Hook: Sync state store with global data changes
    const syncStateFromGlobals = () => {
        if (window.allReservations) {
            store.state.reservations = window.allReservations;
        }
        if (window.allPayments) {
            store.state.payments = window.allPayments;
        }
        if (window.state?.properties) {
            store.state.properties = window.state.properties;
        }
    };

    // Sync periodically (global mutations aren't observable)
    setInterval(syncStateFromGlobals, 5000);

    // Hook: Auto-attach swipe gestures when views render
    store.subscribe('currentView', (view) => {
        setTimeout(() => {
            if (view === 'reservations') {
                swipeGestures.attachToReservationCards();
            } else if (view === 'payments') {
                swipeGestures.attachToPaymentCards();
            }
        }, 500);
    });

    // Hook: Bottom tabs FAB opens quick actions on long-press
    const fabBtn = document.getElementById('resiq-tab-fab');
    if (fabBtn) {
        let fabLongPress;
        fabBtn.addEventListener('touchstart', () => {
            fabLongPress = setTimeout(() => {
                bottomSheet.openQuickActions();
            }, 600);
        }, { passive: true });
        fabBtn.addEventListener('touchend', () => clearTimeout(fabLongPress), { passive: true });
        fabBtn.addEventListener('touchmove', () => clearTimeout(fabLongPress), { passive: true });
    }

    // Update bottom tabs badges based on data
    const updateBadges = () => {
        const reservations = window.allReservations || [];
        const today = new Date().toISOString().split('T')[0];
        const pendingCheckins = reservations.filter(r =>
            r.check_in === today && r.status === 'confirmed'
        ).length;
        bottomTabs.setBadge('bookings', pendingCheckins);

        // Notification badge
        bottomTabs.setBadge('notifications', notificationCenter.unreadCount);
    };

    setInterval(updateBadges, 30000);
    setTimeout(updateBadges, 3000);
}

/**
 * Wait for the main app to be ready then initialize
 */
function waitForApp() {
    let initialized = false;

    // Check if the main app is loaded (login complete, mainApp visible)
    const checkReady = () => {
        const mainApp = document.getElementById('mainApp');
        return mainApp && !mainApp.classList.contains('hidden');
    };

    if (checkReady()) {
        initModules();
        initialized = true;
    }

    // Observe mainApp visibility changes (login/logout cycles)
    // Don't disconnect — keep watching so modules re-init after logout→login
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                if (checkReady() && !initialized) {
                    initialized = true;
                    initModules();
                } else if (!checkReady() && initialized) {
                    // mainApp hidden (logout) — mark as needing re-init
                    initialized = false;
                }
            }
        }
    });

    const mainApp = document.getElementById('mainApp');
    if (mainApp) {
        observer.observe(mainApp, { attributes: true });
    }
}

// Start
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForApp);
} else {
    waitForApp();
}

// Export for manual control
window.ResIQModules = {
    store,
    router,
    bottomTabs,
    swipeGestures,
    bottomSheet,
    skeletonLoader,
    pageTransitions,
    notificationCenter,
    qrCheckin,
    whatsappDeep,
    aiAssist,
    reinit: initModules,
};
