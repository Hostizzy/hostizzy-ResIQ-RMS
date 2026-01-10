/**
 * Native App Utilities
 * Provides native-like functionality for PWA
 * Version: 1.0.0
 */

// ============================================
// HAPTIC FEEDBACK
// ============================================

/**
 * Trigger haptic feedback (vibration) for button taps
 * Works on iOS and Android
 */
function haptic(type = 'light') {
    if (!navigator.vibrate) return;

    const patterns = {
        light: [10],
        medium: [20],
        heavy: [30],
        success: [10, 50, 10],
        warning: [20, 100, 20],
        error: [30, 100, 30],
        selection: [5]
    };

    navigator.vibrate(patterns[type] || patterns.light);
}

/**
 * Add haptic feedback to all buttons
 */
function enableHapticFeedback() {
    // Add to all buttons
    document.addEventListener('click', (e) => {
        const button = e.target.closest('button, .btn, [role="button"]');
        if (button && !button.disabled) {
            haptic('light');
        }
    }, { passive: true });

    // Add to all links
    document.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (link) {
            haptic('selection');
        }
    }, { passive: true });
}

// ============================================
// PULL TO REFRESH
// ============================================

let pullToRefreshState = {
    startY: 0,
    currentY: 0,
    dragging: false,
    threshold: 80
};

/**
 * Enable pull-to-refresh on specified element
 */
function enablePullToRefresh(element, onRefresh) {
    if (!element) return;

    let pullIndicator = document.createElement('div');
    pullIndicator.className = 'pull-to-refresh-indicator';
    pullIndicator.innerHTML = `
        <div class="pull-to-refresh-spinner">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="23 4 23 10 17 10"></polyline>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
            </svg>
        </div>
    `;
    element.insertBefore(pullIndicator, element.firstChild);

    element.addEventListener('touchstart', (e) => {
        if (element.scrollTop === 0) {
            pullToRefreshState.startY = e.touches[0].clientY;
            pullToRefreshState.dragging = true;
        }
    }, { passive: true });

    element.addEventListener('touchmove', (e) => {
        if (!pullToRefreshState.dragging) return;

        pullToRefreshState.currentY = e.touches[0].clientY;
        const pullDistance = pullToRefreshState.currentY - pullToRefreshState.startY;

        if (pullDistance > 0 && element.scrollTop === 0) {
            const opacity = Math.min(pullDistance / pullToRefreshState.threshold, 1);
            const rotation = (pullDistance / pullToRefreshState.threshold) * 360;

            pullIndicator.style.opacity = opacity;
            pullIndicator.style.transform = `translateY(${Math.min(pullDistance * 0.5, 60)}px) rotate(${rotation}deg)`;

            if (pullDistance > pullToRefreshState.threshold) {
                pullIndicator.classList.add('ready');
            } else {
                pullIndicator.classList.remove('ready');
            }
        }
    }, { passive: true });

    element.addEventListener('touchend', () => {
        if (!pullToRefreshState.dragging) return;

        const pullDistance = pullToRefreshState.currentY - pullToRefreshState.startY;

        if (pullDistance > pullToRefreshState.threshold) {
            // Trigger refresh
            pullIndicator.classList.add('refreshing');
            haptic('medium');

            if (onRefresh) {
                onRefresh().finally(() => {
                    setTimeout(() => {
                        pullIndicator.classList.remove('refreshing', 'ready');
                        pullIndicator.style.opacity = '0';
                        pullIndicator.style.transform = 'translateY(0)';
                    }, 500);
                });
            }
        } else {
            pullIndicator.classList.remove('ready');
            pullIndicator.style.opacity = '0';
            pullIndicator.style.transform = 'translateY(0)';
        }

        pullToRefreshState.dragging = false;
    });
}

// ============================================
// NATIVE TRANSITIONS
// ============================================

/**
 * Slide page transition (native-like)
 */
function slideTransition(fromElement, toElement, direction = 'left') {
    return new Promise((resolve) => {
        const duration = 300;

        toElement.classList.add('page-transition-enter');
        toElement.classList.add(direction === 'left' ? 'slide-left' : 'slide-right');

        fromElement.classList.add('page-transition-exit');
        fromElement.classList.add(direction === 'left' ? 'slide-left' : 'slide-right');

        setTimeout(() => {
            toElement.classList.remove('page-transition-enter', 'slide-left', 'slide-right');
            fromElement.classList.remove('page-transition-exit', 'slide-left', 'slide-right');
            resolve();
        }, duration);
    });
}

// ============================================
// SAFE AREA DETECTION
// ============================================

/**
 * Detect if device has safe areas (notch, home indicator)
 */
function detectSafeAreas() {
    const hasSafeAreas = {
        top: parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sat')) > 0,
        bottom: parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sab')) > 0
    };

    if (hasSafeAreas.top || hasSafeAreas.bottom) {
        document.body.classList.add('has-safe-areas');
        if (hasSafeAreas.top) document.body.classList.add('has-safe-area-top');
        if (hasSafeAreas.bottom) document.body.classList.add('has-safe-area-bottom');
    }

    return hasSafeAreas;
}

// ============================================
// APP INSTALL PROMPT
// ============================================

let deferredPrompt = null;

/**
 * Initialize app install prompt
 */
function initAppInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;

        // Show install banner
        showInstallBanner();
    });

    window.addEventListener('appinstalled', () => {
        console.log('ResIQ installed successfully');
        deferredPrompt = null;
        hideInstallBanner();
    });
}

function showInstallBanner() {
    const banner = document.getElementById('installBanner');
    if (banner) {
        banner.classList.remove('hidden');
        banner.classList.add('visible');
    }
}

function hideInstallBanner() {
    const banner = document.getElementById('installBanner');
    if (banner) {
        banner.classList.remove('visible');
        banner.classList.add('hidden');
    }
}

async function promptInstall() {
    if (!deferredPrompt) return false;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    console.log(`User ${outcome === 'accepted' ? 'accepted' : 'dismissed'} the install prompt`);

    deferredPrompt = null;
    hideInstallBanner();

    return outcome === 'accepted';
}

// ============================================
// KEYBOARD HANDLING
// ============================================

/**
 * Handle virtual keyboard appearance on mobile
 */
function handleVirtualKeyboard() {
    if ('visualViewport' in window) {
        window.visualViewport.addEventListener('resize', () => {
            const viewportHeight = window.visualViewport.height;
            const windowHeight = window.innerHeight;
            const keyboardHeight = windowHeight - viewportHeight;

            if (keyboardHeight > 100) {
                document.body.classList.add('keyboard-open');
                document.body.style.setProperty('--keyboard-height', `${keyboardHeight}px`);
            } else {
                document.body.classList.remove('keyboard-open');
                document.body.style.setProperty('--keyboard-height', '0px');
            }
        });
    }
}

// ============================================
// STATUS BAR
// ============================================

/**
 * Update status bar color based on theme
 */
function updateStatusBarColor(darkMode = false) {
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    const color = darkMode ? '#1e293b' : '#2563eb';

    if (metaThemeColor) {
        metaThemeColor.setAttribute('content', color);
    }

    // iOS status bar style
    const metaAppleStatusBar = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (metaAppleStatusBar) {
        metaAppleStatusBar.setAttribute('content', darkMode ? 'black-translucent' : 'black-translucent');
    }
}

// ============================================
// INITIALIZE
// ============================================

/**
 * Initialize all native app features
 */
function initNativeAppFeatures() {
    console.log('[Native App] Initializing native features...');

    // Enable haptic feedback
    enableHapticFeedback();

    // Detect safe areas
    detectSafeAreas();

    // Handle keyboard
    handleVirtualKeyboard();

    // Install prompt
    initAppInstallPrompt();

    // Prevent zoom on double tap (iOS)
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (e) => {
        const now = Date.now();
        if (now - lastTouchEnd <= 300) {
            e.preventDefault();
        }
        lastTouchEnd = now;
    }, { passive: false });

    // Prevent context menu on long press (optional)
    document.addEventListener('contextmenu', (e) => {
        if (window.matchMedia('(max-width: 768px)').matches) {
            // Allow context menu for text selection
            if (!window.getSelection().toString()) {
                e.preventDefault();
            }
        }
    });

    console.log('[Native App] Native features initialized');
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNativeAppFeatures);
} else {
    initNativeAppFeatures();
}

// Export functions for manual usage
window.nativeApp = {
    haptic,
    enablePullToRefresh,
    slideTransition,
    detectSafeAreas,
    promptInstall,
    updateStatusBarColor
};
