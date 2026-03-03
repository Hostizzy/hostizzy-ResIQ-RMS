/**
 * ResIQ Smooth Page Transitions
 * CSS-powered view transitions with direction awareness
 * Uses View Transitions API where supported, with CSS fallback
 */

const TRANSITION_CSS = `
/* View transition animations */
@keyframes viewSlideInRight {
    from { opacity: 0; transform: translateX(30px); }
    to { opacity: 1; transform: translateX(0); }
}

@keyframes viewSlideOutLeft {
    from { opacity: 1; transform: translateX(0); }
    to { opacity: 0; transform: translateX(-30px); }
}

@keyframes viewSlideInLeft {
    from { opacity: 0; transform: translateX(-30px); }
    to { opacity: 1; transform: translateX(0); }
}

@keyframes viewSlideOutRight {
    from { opacity: 1; transform: translateX(0); }
    to { opacity: 0; transform: translateX(30px); }
}

@keyframes viewFadeIn {
    from { opacity: 0; transform: scale(0.98); }
    to { opacity: 1; transform: scale(1); }
}

@keyframes viewFadeOut {
    from { opacity: 1; transform: scale(1); }
    to { opacity: 0; transform: scale(0.98); }
}

@keyframes viewSlideUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
}

@keyframes viewSlideDown {
    from { opacity: 1; transform: translateY(0); }
    to { opacity: 0; transform: translateY(20px); }
}

/* Apply transitions to view containers */
.container.view-enter {
    animation: viewFadeIn 0.25s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

.container.view-exit {
    animation: viewFadeOut 0.15s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

.container.view-enter-right {
    animation: viewSlideInRight 0.28s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

.container.view-exit-left {
    animation: viewSlideOutLeft 0.15s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

.container.view-enter-left {
    animation: viewSlideInLeft 0.28s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

.container.view-exit-right {
    animation: viewSlideOutRight 0.15s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

.container.view-enter-up {
    animation: viewSlideUp 0.28s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

/* Stagger animation for child elements */
.container.view-enter .skel-card,
.container.view-enter .stat-card,
.container.view-enter .metric-card,
.container.view-enter .reservation-card,
.container.view-enter .payment-card,
.container.view-enter .property-card,
.container.view-enter .guest-card {
    opacity: 0;
    animation: viewSlideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

.container.view-enter .skel-card:nth-child(1),
.container.view-enter .stat-card:nth-child(1),
.container.view-enter .metric-card:nth-child(1),
.container.view-enter .reservation-card:nth-child(1),
.container.view-enter .payment-card:nth-child(1),
.container.view-enter .property-card:nth-child(1),
.container.view-enter .guest-card:nth-child(1) { animation-delay: 0.05s; }

.container.view-enter .skel-card:nth-child(2),
.container.view-enter .stat-card:nth-child(2),
.container.view-enter .metric-card:nth-child(2),
.container.view-enter .reservation-card:nth-child(2),
.container.view-enter .payment-card:nth-child(2),
.container.view-enter .property-card:nth-child(2),
.container.view-enter .guest-card:nth-child(2) { animation-delay: 0.08s; }

.container.view-enter .skel-card:nth-child(3),
.container.view-enter .stat-card:nth-child(3),
.container.view-enter .metric-card:nth-child(3),
.container.view-enter .reservation-card:nth-child(3),
.container.view-enter .payment-card:nth-child(3),
.container.view-enter .property-card:nth-child(3),
.container.view-enter .guest-card:nth-child(3) { animation-delay: 0.11s; }

.container.view-enter .skel-card:nth-child(4),
.container.view-enter .stat-card:nth-child(4),
.container.view-enter .metric-card:nth-child(4),
.container.view-enter .reservation-card:nth-child(4),
.container.view-enter .payment-card:nth-child(4),
.container.view-enter .property-card:nth-child(4),
.container.view-enter .guest-card:nth-child(4) { animation-delay: 0.14s; }

.container.view-enter .skel-card:nth-child(n+5),
.container.view-enter .stat-card:nth-child(n+5),
.container.view-enter .metric-card:nth-child(n+5),
.container.view-enter .reservation-card:nth-child(n+5),
.container.view-enter .payment-card:nth-child(n+5),
.container.view-enter .property-card:nth-child(n+5),
.container.view-enter .guest-card:nth-child(n+5) { animation-delay: 0.17s; }

/* Reduce motion for accessibility */
@media (prefers-reduced-motion: reduce) {
    .container.view-enter,
    .container.view-exit,
    .container.view-enter-right,
    .container.view-exit-left,
    .container.view-enter-left,
    .container.view-exit-right,
    .container.view-enter-up {
        animation-duration: 0.01s;
    }
}
`;

// View ordering for direction detection
const VIEW_ORDER = [
    'home', 'dashboard',
    'property', 'business', 'financials',
    'reservations', 'payments', 'guests', 'guestDocuments', 'meals',
    'properties', 'team', 'owners', 'availability', 'communication',
    'settings'
];

class PageTransitions {
    constructor() {
        this._injected = false;
        this._currentView = null;
        this._transitioning = false;
    }

    init() {
        if (this._injected) return;
        const style = document.createElement('style');
        style.id = 'resiq-transitions-css';
        style.textContent = TRANSITION_CSS;
        document.head.appendChild(style);
        this._injected = true;

        this._hookShowView();
    }

    /** Determine direction based on view order */
    _getDirection(fromView, toView) {
        const fromIdx = VIEW_ORDER.indexOf(fromView);
        const toIdx = VIEW_ORDER.indexOf(toView);

        if (fromIdx === -1 || toIdx === -1) return 'fade';
        if (toIdx > fromIdx) return 'forward';
        if (toIdx < fromIdx) return 'back';
        return 'fade';
    }

    /** Perform the transition */
    async transition(fromViewName, toViewName) {
        if (this._transitioning) return;
        this._transitioning = true;

        const fromEl = fromViewName ? document.getElementById(`${fromViewName}View`) : null;
        const toEl = document.getElementById(`${toViewName}View`);

        if (!toEl) {
            this._transitioning = false;
            return;
        }

        const direction = this._getDirection(fromViewName, toViewName);

        // Use View Transitions API if available
        if (document.startViewTransition && !this._prefersReducedMotion()) {
            try {
                const transition = document.startViewTransition(() => {
                    if (fromEl) fromEl.classList.add('hidden');
                    toEl.classList.remove('hidden');
                });
                await transition.finished;
            } catch {
                // Fallback if View Transitions API fails
                if (fromEl) fromEl.classList.add('hidden');
                toEl.classList.remove('hidden');
            }
        } else {
            // CSS animation fallback
            const exitClass = direction === 'forward' ? 'view-exit-left'
                : direction === 'back' ? 'view-exit-right'
                : 'view-exit';
            const enterClass = direction === 'forward' ? 'view-enter-right'
                : direction === 'back' ? 'view-enter-left'
                : 'view-enter';

            // Animate out
            if (fromEl && fromViewName !== toViewName) {
                fromEl.classList.add(exitClass);
                await this._waitForAnimation(fromEl, 150);
                fromEl.classList.add('hidden');
                fromEl.classList.remove(exitClass);
            }

            // Show and animate in
            toEl.classList.remove('hidden');
            toEl.classList.add(enterClass);

            await this._waitForAnimation(toEl, 280);
            toEl.classList.remove(enterClass);
        }

        this._currentView = toViewName;
        this._transitioning = false;
    }

    _waitForAnimation(el, fallbackMs) {
        return new Promise(resolve => {
            const handler = () => {
                el.removeEventListener('animationend', handler);
                resolve();
            };
            el.addEventListener('animationend', handler);
            // Fallback timeout
            setTimeout(resolve, fallbackMs + 50);
        });
    }

    _prefersReducedMotion() {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    /** Hook into showView to add transitions */
    _hookShowView() {
        const self = this;
        const checkInterval = setInterval(() => {
            if (typeof window.showView === 'function' && !window.showView._transitionHooked) {
                const originalShowView = window.showView;

                window.showView = async function(viewName) {
                    const previousView = self._currentView;

                    // Let the original function handle data loading and logic
                    // But we override the hide/show behavior
                    if (previousView && previousView !== viewName) {
                        // Hide all containers first (original behavior)
                        document.querySelectorAll('.container').forEach(el => el.classList.add('hidden'));

                        // Show target container with transition
                        const targetEl = document.getElementById(`${viewName}View`);
                        if (targetEl) {
                            targetEl.classList.remove('hidden');

                            const direction = self._getDirection(previousView, viewName);
                            const enterClass = direction === 'forward' ? 'view-enter-right'
                                : direction === 'back' ? 'view-enter-left'
                                : 'view-enter';

                            targetEl.classList.add(enterClass);
                            setTimeout(() => targetEl.classList.remove(enterClass), 300);
                        }

                        self._currentView = viewName;
                    }

                    // Call original for all the data-loading logic
                    return originalShowView.call(this, viewName);
                };

                window.showView._transitionHooked = true;
                clearInterval(checkInterval);
            }
        }, 300);

        setTimeout(() => clearInterval(checkInterval), 15000);
    }

    destroy() {
        document.getElementById('resiq-transitions-css')?.remove();
        this._injected = false;
    }
}

const pageTransitions = new PageTransitions();
window.ResIQTransitions = pageTransitions;
export default pageTransitions;
