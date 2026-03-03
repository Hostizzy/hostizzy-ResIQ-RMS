/**
 * ResIQ Swipe Gestures
 * Swipe-to-action on reservation and payment cards
 * - Swipe left: Delete / Cancel
 * - Swipe right: Quick action (WhatsApp, Payment, Check-in)
 */

const SWIPE_CSS = `
.swipeable-card {
    position: relative;
    overflow: hidden;
    touch-action: pan-y;
}

.swipeable-card-content {
    position: relative;
    z-index: 2;
    background: var(--surface, #ffffff);
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    will-change: transform;
}

.swipeable-card-content.swiping {
    transition: none;
}

.swipe-action-left,
.swipe-action-right {
    position: absolute;
    top: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    z-index: 1;
    padding: 0 20px;
}

.swipe-action-right {
    left: 0;
    background: var(--success, #059669);
    color: white;
    border-radius: var(--radius-md, 12px) 0 0 var(--radius-md, 12px);
}

.swipe-action-left {
    right: 0;
    background: var(--danger, #dc2626);
    color: white;
    border-radius: 0 var(--radius-md, 12px) var(--radius-md, 12px) 0;
}

.swipe-action-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    opacity: 0;
    transform: scale(0.8);
    transition: opacity 0.2s ease, transform 0.2s ease;
}

.swipe-action-inner.visible {
    opacity: 1;
    transform: scale(1);
}

.swipe-action-icon {
    width: 24px;
    height: 24px;
}

.swipe-action-label {
    font-size: 11px;
    font-weight: 600;
    white-space: nowrap;
}

/* Swipe indicator hint animation */
@keyframes swipeHint {
    0% { transform: translateX(0); }
    30% { transform: translateX(-20px); }
    60% { transform: translateX(10px); }
    100% { transform: translateX(0); }
}

.swipe-hint {
    animation: swipeHint 1.5s ease-in-out;
}

/* Snap back animation */
.swipe-snap-back {
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
}

/* Action triggered flash */
@keyframes actionFlash {
    0% { opacity: 1; }
    50% { opacity: 0.6; }
    100% { opacity: 1; }
}

.swipe-action-triggered {
    animation: actionFlash 0.3s ease;
}
`;

const SWIPE_ICONS = {
    whatsapp: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>',
    payment: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>',
    checkin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" x2="3" y1="12" y2="12"/></svg>',
    cancel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" x2="9" y1="9" y2="15"/><line x1="9" x2="15" y1="9" y2="15"/></svg>',
    delete: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    call: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
};

class SwipeGestures {
    constructor() {
        this._observers = new Map();
        this._injected = false;
        this.threshold = 80; // px to trigger action
        this.maxSwipe = 120; // max swipe distance
    }

    init() {
        if (this._injected) return;
        const style = document.createElement('style');
        style.id = 'resiq-swipe-css';
        style.textContent = SWIPE_CSS;
        document.head.appendChild(style);
        this._injected = true;

        // Observe DOM changes to attach swipe to new cards
        this._observeDOM();
    }

    /**
     * Make a card swipeable
     * @param {HTMLElement} card - The card element
     * @param {Object} options
     * @param {Object} options.leftAction - {icon, label, color, callback}
     * @param {Object} options.rightAction - {icon, label, color, callback}
     * @param {Object} options.data - Data associated with this card
     */
    attach(card, options = {}) {
        if (card.dataset.swipeable === 'true') return;
        card.dataset.swipeable = 'true';

        const content = card.querySelector('.swipeable-card-content') || card;
        let startX = 0, startY = 0, currentX = 0, isDragging = false, isHorizontal = null;

        // Create action backgrounds
        if (options.rightAction) {
            const rightBg = document.createElement('div');
            rightBg.className = 'swipe-action-right';
            if (options.rightAction.color) rightBg.style.background = options.rightAction.color;
            rightBg.innerHTML = `
                <div class="swipe-action-inner" data-side="right">
                    <div class="swipe-action-icon">${SWIPE_ICONS[options.rightAction.icon] || ''}</div>
                    <div class="swipe-action-label">${options.rightAction.label || ''}</div>
                </div>
            `;
            card.insertBefore(rightBg, card.firstChild);
        }

        if (options.leftAction) {
            const leftBg = document.createElement('div');
            leftBg.className = 'swipe-action-left';
            if (options.leftAction.color) leftBg.style.background = options.leftAction.color;
            leftBg.innerHTML = `
                <div class="swipe-action-inner" data-side="left">
                    <div class="swipe-action-icon">${SWIPE_ICONS[options.leftAction.icon] || ''}</div>
                    <div class="swipe-action-label">${options.leftAction.label || ''}</div>
                </div>
            `;
            card.insertBefore(leftBg, card.firstChild);
        }

        const onStart = (e) => {
            const touch = e.touches[0];
            startX = touch.clientX;
            startY = touch.clientY;
            currentX = 0;
            isDragging = true;
            isHorizontal = null;
            content.classList.add('swiping');
        };

        const onMove = (e) => {
            if (!isDragging) return;
            const touch = e.touches[0];
            const deltaX = touch.clientX - startX;
            const deltaY = touch.clientY - startY;

            // Determine scroll direction on first significant move
            if (isHorizontal === null && (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5)) {
                isHorizontal = Math.abs(deltaX) > Math.abs(deltaY);
                if (!isHorizontal) {
                    isDragging = false;
                    content.classList.remove('swiping');
                    return;
                }
            }

            if (!isHorizontal) return;
            e.preventDefault();

            // Clamp swipe distance
            currentX = Math.max(-this.maxSwipe, Math.min(this.maxSwipe, deltaX));

            // Apply resistance at edges
            const resistance = Math.abs(currentX) > this.threshold ? 0.4 : 1;
            const translateX = currentX > 0
                ? Math.min(currentX, this.threshold + (currentX - this.threshold) * resistance)
                : Math.max(currentX, -(this.threshold + (Math.abs(currentX) - this.threshold) * resistance));

            content.style.transform = `translateX(${translateX}px)`;

            // Show/hide action indicators
            const rightInner = card.querySelector('.swipe-action-inner[data-side="right"]');
            const leftInner = card.querySelector('.swipe-action-inner[data-side="left"]');

            if (rightInner) {
                rightInner.classList.toggle('visible', currentX > this.threshold * 0.5);
            }
            if (leftInner) {
                leftInner.classList.toggle('visible', currentX < -this.threshold * 0.5);
            }
        };

        const onEnd = () => {
            if (!isDragging) return;
            isDragging = false;
            content.classList.remove('swiping');

            if (currentX > this.threshold && options.rightAction?.callback) {
                // Trigger right action
                content.classList.add('swipe-action-triggered');
                card.querySelector('.swipe-action-inner[data-side="right"]')?.classList.add('visible');

                if (window.nativeApp?.haptic) window.nativeApp.haptic('success');

                setTimeout(() => {
                    options.rightAction.callback(options.data, card);
                    this._snapBack(content);
                }, 200);
            } else if (currentX < -this.threshold && options.leftAction?.callback) {
                // Trigger left action
                content.classList.add('swipe-action-triggered');
                card.querySelector('.swipe-action-inner[data-side="left"]')?.classList.add('visible');

                if (window.nativeApp?.haptic) window.nativeApp.haptic('warning');

                setTimeout(() => {
                    options.leftAction.callback(options.data, card);
                    this._snapBack(content);
                }, 200);
            } else {
                this._snapBack(content);
            }
        };

        content.addEventListener('touchstart', onStart, { passive: true });
        content.addEventListener('touchmove', onMove, { passive: false });
        content.addEventListener('touchend', onEnd, { passive: true });
        content.addEventListener('touchcancel', onEnd, { passive: true });
    }

    _snapBack(content) {
        content.classList.add('swipe-snap-back');
        content.style.transform = 'translateX(0)';
        setTimeout(() => {
            content.classList.remove('swipe-snap-back', 'swipe-action-triggered');
        }, 300);
    }

    /**
     * Auto-attach swipe gestures to reservation and payment cards in the DOM
     */
    attachToReservationCards() {
        const cards = document.querySelectorAll('.reservation-card:not([data-swipeable])');
        cards.forEach(card => {
            const bookingId = card.dataset.bookingId;
            const status = card.dataset.status;

            let rightAction = {
                icon: 'whatsapp',
                label: 'WhatsApp',
                color: '#25D366',
                callback: (data) => {
                    if (typeof window.openWhatsAppDirect === 'function') {
                        window.openWhatsAppDirect(data?.bookingId);
                    } else if (typeof window.sendWhatsAppReminder === 'function') {
                        window.sendWhatsAppReminder(data?.bookingId);
                    }
                }
            };

            if (status === 'confirmed') {
                rightAction = {
                    icon: 'checkin',
                    label: 'Check In',
                    color: 'var(--success, #059669)',
                    callback: (data) => {
                        if (typeof window.updateReservationStatus === 'function') {
                            window.updateReservationStatus(data?.bookingId, 'checked-in');
                        }
                    }
                };
            }

            this.attach(card, {
                data: { bookingId, status },
                rightAction,
                leftAction: {
                    icon: 'cancel',
                    label: 'Cancel',
                    callback: (data, cardEl) => {
                        if (confirm(`Cancel reservation ${data?.bookingId}?`)) {
                            if (typeof window.updateReservationStatus === 'function') {
                                window.updateReservationStatus(data?.bookingId, 'cancelled');
                            }
                        }
                    }
                }
            });
        });
    }

    attachToPaymentCards() {
        const cards = document.querySelectorAll('.payment-card:not([data-swipeable])');
        cards.forEach(card => {
            const paymentId = card.dataset.paymentId;
            const bookingId = card.dataset.bookingId;

            this.attach(card, {
                data: { paymentId, bookingId },
                rightAction: {
                    icon: 'whatsapp',
                    label: 'Remind',
                    color: '#25D366',
                    callback: (data) => {
                        if (typeof window.sendWhatsAppReminder === 'function') {
                            window.sendWhatsAppReminder(data?.bookingId);
                        }
                    }
                },
                leftAction: {
                    icon: 'delete',
                    label: 'Delete',
                    callback: (data) => {
                        if (confirm('Delete this payment record?')) {
                            if (typeof window.db?.deletePayment === 'function') {
                                window.db.deletePayment(data?.paymentId);
                            }
                        }
                    }
                }
            });
        });
    }

    /** Observe DOM for dynamically rendered cards */
    _observeDOM() {
        const observer = new MutationObserver((mutations) => {
            let hasNewCards = false;
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === 1) {
                        if (node.classList?.contains('reservation-card') ||
                            node.classList?.contains('payment-card') ||
                            node.querySelector?.('.reservation-card, .payment-card')) {
                            hasNewCards = true;
                            break;
                        }
                    }
                }
                if (hasNewCards) break;
            }
            if (hasNewCards) {
                requestAnimationFrame(() => {
                    this.attachToReservationCards();
                    this.attachToPaymentCards();
                });
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    /** Show hint animation on first card */
    showHint() {
        const firstCard = document.querySelector('[data-swipeable="true"] .swipeable-card-content');
        if (firstCard) {
            firstCard.classList.add('swipe-hint');
            setTimeout(() => firstCard.classList.remove('swipe-hint'), 1500);
        }
    }

    destroy() {
        document.getElementById('resiq-swipe-css')?.remove();
        document.querySelectorAll('[data-swipeable]').forEach(el => {
            el.removeAttribute('data-swipeable');
        });
        this._injected = false;
    }
}

const swipeGestures = new SwipeGestures();
window.ResIQSwipeGestures = swipeGestures;
export default swipeGestures;
