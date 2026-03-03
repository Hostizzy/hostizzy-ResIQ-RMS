/**
 * ResIQ Bottom Sheet
 * iOS/Android-style bottom sheet for quick actions, details, and menus
 * - Drag to dismiss
 * - Multiple snap points (peek, half, full)
 * - Backdrop with blur
 * - Smooth spring animations
 */

const BOTTOM_SHEET_CSS = `
.resiq-sheet-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    -webkit-backdrop-filter: blur(4px);
    backdrop-filter: blur(4px);
    z-index: 10000;
    opacity: 0;
    transition: opacity 0.3s ease;
    pointer-events: none;
}

.resiq-sheet-backdrop.active {
    opacity: 1;
    pointer-events: auto;
}

.resiq-sheet {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 10001;
    background: var(--surface, #ffffff);
    border-radius: 16px 16px 0 0;
    box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.12);
    transform: translateY(100%);
    transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1);
    max-height: 92vh;
    display: flex;
    flex-direction: column;
    padding-bottom: env(safe-area-inset-bottom, 0px);
    will-change: transform;
}

[data-theme="dark"] .resiq-sheet {
    background: var(--surface, #1e293b);
    box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.4);
}

.resiq-sheet.active {
    transform: translateY(0);
}

.resiq-sheet.dragging {
    transition: none;
}

.resiq-sheet-handle {
    display: flex;
    justify-content: center;
    padding: 10px 0 6px;
    cursor: grab;
    flex-shrink: 0;
}

.resiq-sheet-handle::after {
    content: '';
    width: 36px;
    height: 4px;
    background: var(--border, #e2e8f0);
    border-radius: 2px;
}

[data-theme="dark"] .resiq-sheet-handle::after {
    background: rgba(255, 255, 255, 0.2);
}

.resiq-sheet-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 20px 12px;
    border-bottom: 1px solid var(--border, #e2e8f0);
    flex-shrink: 0;
}

.resiq-sheet-title {
    font-size: 17px;
    font-weight: 600;
    color: var(--text-primary, #0f172a);
}

.resiq-sheet-close {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: var(--background-alt, #f1f5f9);
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary, #475569);
    transition: background 0.2s ease;
}

.resiq-sheet-close:active {
    background: var(--border, #e2e8f0);
}

.resiq-sheet-close svg {
    width: 16px;
    height: 16px;
}

.resiq-sheet-body {
    flex: 1;
    overflow-y: auto;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
    padding: 16px 20px;
}

/* Quick Action Items */
.resiq-sheet-actions {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    padding: 8px 0;
}

.resiq-sheet-action {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 16px 8px;
    border-radius: var(--radius-md, 12px);
    background: var(--background-alt, #f1f5f9);
    border: none;
    cursor: pointer;
    transition: background 0.2s ease, transform 0.15s ease;
    -webkit-tap-highlight-color: transparent;
    color: var(--text-primary, #0f172a);
}

[data-theme="dark"] .resiq-sheet-action {
    background: rgba(255, 255, 255, 0.06);
}

.resiq-sheet-action:active {
    transform: scale(0.95);
    background: var(--border, #e2e8f0);
}

.resiq-sheet-action-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
}

.resiq-sheet-action-icon svg {
    width: 20px;
    height: 20px;
}

.resiq-sheet-action-label {
    font-size: 12px;
    font-weight: 500;
    text-align: center;
    line-height: 1.3;
    color: var(--text-secondary, #475569);
}

/* Menu list items */
.resiq-sheet-menu-item {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 4px;
    border-bottom: 1px solid var(--border-light, #f1f5f9);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.15s ease;
    border-radius: 8px;
}

.resiq-sheet-menu-item:last-child {
    border-bottom: none;
}

.resiq-sheet-menu-item:active {
    background: var(--background-alt, #f1f5f9);
}

.resiq-sheet-menu-icon {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.resiq-sheet-menu-icon svg {
    width: 18px;
    height: 18px;
}

.resiq-sheet-menu-text {
    flex: 1;
}

.resiq-sheet-menu-title {
    font-size: 15px;
    font-weight: 500;
    color: var(--text-primary, #0f172a);
}

.resiq-sheet-menu-desc {
    font-size: 12px;
    color: var(--text-secondary, #475569);
    margin-top: 2px;
}

.resiq-sheet-menu-arrow {
    color: var(--text-tertiary, #94a3b8);
}

.resiq-sheet-menu-arrow svg {
    width: 16px;
    height: 16px;
}

/* Tablet: limit width */
@media (min-width: 769px) {
    .resiq-sheet {
        max-width: 480px;
        left: 50%;
        transform: translateX(-50%) translateY(100%);
        border-radius: 16px 16px 0 0;
    }
    .resiq-sheet.active {
        transform: translateX(-50%) translateY(0);
    }
}
`;

const SHEET_ICONS = {
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>',
    chevronRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>',
    creditCard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    fileText: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/></svg>',
    building: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>',
    qrCode: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/></svg>',
    whatsapp: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>',
};

class BottomSheet {
    constructor() {
        this._injected = false;
        this._sheets = [];
        this._backdrop = null;
    }

    init() {
        if (this._injected) return;
        const style = document.createElement('style');
        style.id = 'resiq-bottom-sheet-css';
        style.textContent = BOTTOM_SHEET_CSS;
        document.head.appendChild(style);

        // Create shared backdrop
        this._backdrop = document.createElement('div');
        this._backdrop.className = 'resiq-sheet-backdrop';
        this._backdrop.addEventListener('click', () => this.closeAll());
        document.body.appendChild(this._backdrop);

        this._injected = true;
    }

    /**
     * Open a bottom sheet
     * @param {Object} options
     * @param {string} options.title - Sheet title
     * @param {string} options.content - HTML content
     * @param {Array} options.actions - Quick action grid items
     * @param {Array} options.menuItems - Menu list items
     * @param {Function} options.onClose - Close callback
     * @returns {HTMLElement} The sheet element
     */
    open(options = {}) {
        const sheet = document.createElement('div');
        sheet.className = 'resiq-sheet';

        let bodyHTML = '';

        if (options.actions) {
            bodyHTML += '<div class="resiq-sheet-actions">';
            options.actions.forEach(action => {
                bodyHTML += `
                    <button class="resiq-sheet-action" data-action="${action.id || ''}">
                        <div class="resiq-sheet-action-icon" style="background: ${action.color || 'var(--primary)'}">
                            ${SHEET_ICONS[action.icon] || ''}
                        </div>
                        <div class="resiq-sheet-action-label">${action.label}</div>
                    </button>
                `;
            });
            bodyHTML += '</div>';
        }

        if (options.menuItems) {
            options.menuItems.forEach(item => {
                bodyHTML += `
                    <div class="resiq-sheet-menu-item" data-action="${item.id || ''}">
                        <div class="resiq-sheet-menu-icon" style="background: ${item.color || 'var(--background-alt, #f1f5f9)'}; color: ${item.iconColor || 'var(--text-secondary)'}">
                            ${SHEET_ICONS[item.icon] || ''}
                        </div>
                        <div class="resiq-sheet-menu-text">
                            <div class="resiq-sheet-menu-title">${item.label}</div>
                            ${item.description ? `<div class="resiq-sheet-menu-desc">${item.description}</div>` : ''}
                        </div>
                        <div class="resiq-sheet-menu-arrow">${SHEET_ICONS.chevronRight}</div>
                    </div>
                `;
            });
        }

        if (options.content) {
            bodyHTML += options.content;
        }

        sheet.innerHTML = `
            <div class="resiq-sheet-handle"></div>
            ${options.title ? `
                <div class="resiq-sheet-header">
                    <div class="resiq-sheet-title">${options.title}</div>
                    <button class="resiq-sheet-close">${SHEET_ICONS.close}</button>
                </div>
            ` : ''}
            <div class="resiq-sheet-body">${bodyHTML}</div>
        `;

        document.body.appendChild(sheet);
        this._sheets.push({ sheet, options });

        // Bind events
        const closeBtn = sheet.querySelector('.resiq-sheet-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close(sheet));
        }

        // Action clicks
        sheet.querySelectorAll('[data-action]').forEach(el => {
            el.addEventListener('click', () => {
                const actionId = el.dataset.action;
                const allActions = [...(options.actions || []), ...(options.menuItems || [])];
                const action = allActions.find(a => a.id === actionId);
                if (action?.callback) {
                    action.callback();
                    if (action.closeOnClick !== false) {
                        this.close(sheet);
                    }
                }
            });
        });

        // Drag to dismiss
        this._enableDrag(sheet);

        // Show with animation
        requestAnimationFrame(() => {
            this._backdrop.classList.add('active');
            requestAnimationFrame(() => sheet.classList.add('active'));
        });

        // Haptic
        if (window.nativeApp?.haptic) window.nativeApp.haptic('light');

        return sheet;
    }

    /** Open quick actions sheet */
    openQuickActions() {
        return this.open({
            title: 'Quick Actions',
            actions: [
                {
                    id: 'new-booking',
                    icon: 'calendar',
                    label: 'New Booking',
                    color: 'var(--gradient-primary, #0891b2)',
                    callback: () => {
                        if (typeof window.openReservationModal === 'function') window.openReservationModal();
                    }
                },
                {
                    id: 'add-payment',
                    icon: 'creditCard',
                    label: 'Add Payment',
                    color: 'var(--gradient-success, #059669)',
                    callback: () => {
                        if (typeof window.openPaymentModal === 'function') window.openPaymentModal();
                    }
                },
                {
                    id: 'add-guest',
                    icon: 'user',
                    label: 'Add Guest',
                    color: 'var(--gradient-purple, #a855f7)',
                    callback: () => {
                        if (typeof window.showView === 'function') window.showView('guests');
                    }
                },
                {
                    id: 'scan-qr',
                    icon: 'qrCode',
                    label: 'Scan QR',
                    color: 'var(--gradient-ocean, #3b82f6)',
                    callback: () => {
                        if (window.ResIQQRCheckin) window.ResIQQRCheckin.openScanner();
                    }
                },
                {
                    id: 'documents',
                    icon: 'fileText',
                    label: 'Documents',
                    color: 'var(--gradient-warning, #d97706)',
                    callback: () => {
                        if (typeof window.showView === 'function') window.showView('guestDocuments');
                    }
                },
                {
                    id: 'whatsapp',
                    icon: 'whatsapp',
                    label: 'WhatsApp',
                    color: '#25D366',
                    callback: () => {
                        if (typeof window.showView === 'function') window.showView('communication');
                    }
                },
            ]
        });
    }

    /** Open reservation detail sheet */
    openReservationDetail(reservation) {
        const statusColors = {
            confirmed: 'var(--success)',
            'checked-in': 'var(--primary)',
            'checked-out': 'var(--text-secondary)',
            pending: 'var(--warning)',
            cancelled: 'var(--danger)',
        };

        return this.open({
            title: `Booking ${reservation.booking_id || ''}`,
            content: `
                <div style="padding: 8px 0;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
                        <span style="display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; background: ${statusColors[reservation.status] || 'var(--text-secondary)'}20; color: ${statusColors[reservation.status] || 'var(--text-secondary)'};">
                            ${(reservation.status || 'unknown').toUpperCase()}
                        </span>
                        <span style="font-size: 13px; color: var(--text-secondary);">${reservation.property_name || ''}</span>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div>
                            <div style="font-size: 11px; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.5px;">Guest</div>
                            <div style="font-size: 15px; font-weight: 500; margin-top: 2px;">${reservation.guest_name || 'N/A'}</div>
                        </div>
                        <div>
                            <div style="font-size: 11px; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.5px;">Phone</div>
                            <div style="font-size: 15px; font-weight: 500; margin-top: 2px;">${reservation.phone || 'N/A'}</div>
                        </div>
                        <div>
                            <div style="font-size: 11px; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.5px;">Check-in</div>
                            <div style="font-size: 15px; font-weight: 500; margin-top: 2px;">${reservation.check_in || 'N/A'}</div>
                        </div>
                        <div>
                            <div style="font-size: 11px; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.5px;">Check-out</div>
                            <div style="font-size: 15px; font-weight: 500; margin-top: 2px;">${reservation.check_out || 'N/A'}</div>
                        </div>
                        <div>
                            <div style="font-size: 11px; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.5px;">Total</div>
                            <div style="font-size: 15px; font-weight: 600; margin-top: 2px; color: var(--success);">₹${(reservation.total_amount || 0).toLocaleString('en-IN')}</div>
                        </div>
                        <div>
                            <div style="font-size: 11px; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.5px;">Paid</div>
                            <div style="font-size: 15px; font-weight: 500; margin-top: 2px;">₹${(reservation.paid_amount || 0).toLocaleString('en-IN')}</div>
                        </div>
                    </div>
                </div>
            `,
            menuItems: [
                {
                    id: 'edit',
                    icon: 'calendar',
                    label: 'Edit Reservation',
                    description: 'Modify booking details',
                    color: 'rgba(8, 145, 178, 0.1)',
                    iconColor: 'var(--primary)',
                    callback: () => {
                        if (typeof window.openReservationModal === 'function') {
                            window.openReservationModal(reservation.booking_id);
                        }
                    }
                },
                {
                    id: 'payment',
                    icon: 'creditCard',
                    label: 'Record Payment',
                    description: 'Add a payment for this booking',
                    color: 'rgba(5, 150, 105, 0.1)',
                    iconColor: 'var(--success)',
                    callback: () => {
                        if (typeof window.openPaymentModal === 'function') {
                            window.openPaymentModal(reservation.booking_id);
                        }
                    }
                },
                {
                    id: 'whatsapp',
                    icon: 'whatsapp',
                    label: 'WhatsApp Guest',
                    description: 'Send message via WhatsApp',
                    color: 'rgba(37, 211, 102, 0.1)',
                    iconColor: '#25D366',
                    callback: () => {
                        if (typeof window.openWhatsAppDirect === 'function') {
                            window.openWhatsAppDirect(reservation.booking_id);
                        }
                    }
                },
                {
                    id: 'qr',
                    icon: 'qrCode',
                    label: 'Generate QR Code',
                    description: 'QR code for guest check-in',
                    color: 'rgba(59, 130, 246, 0.1)',
                    iconColor: '#3b82f6',
                    callback: () => {
                        if (window.ResIQQRCheckin) {
                            window.ResIQQRCheckin.generateQR(reservation);
                        }
                    }
                },
            ]
        });
    }

    _enableDrag(sheet) {
        const handle = sheet.querySelector('.resiq-sheet-handle');
        if (!handle) return;

        let startY = 0, currentY = 0, isDragging = false;

        const onStart = (e) => {
            startY = e.touches[0].clientY;
            currentY = 0;
            isDragging = true;
            sheet.classList.add('dragging');
        };

        const onMove = (e) => {
            if (!isDragging) return;
            currentY = e.touches[0].clientY - startY;
            if (currentY < 0) currentY = 0; // Don't allow upward drag
            sheet.style.transform = window.innerWidth > 768
                ? `translateX(-50%) translateY(${currentY}px)`
                : `translateY(${currentY}px)`;
        };

        const onEnd = () => {
            if (!isDragging) return;
            isDragging = false;
            sheet.classList.remove('dragging');

            if (currentY > 100) {
                this.close(sheet);
            } else {
                sheet.style.transform = '';
            }
        };

        handle.addEventListener('touchstart', onStart, { passive: true });
        handle.addEventListener('touchmove', onMove, { passive: true });
        handle.addEventListener('touchend', onEnd, { passive: true });
    }

    close(sheet) {
        if (!sheet) return;
        sheet.classList.remove('active');
        sheet.style.transform = '';

        const idx = this._sheets.findIndex(s => s.sheet === sheet);
        if (idx >= 0) {
            const { options } = this._sheets[idx];
            this._sheets.splice(idx, 1);
            if (options?.onClose) options.onClose();
        }

        if (this._sheets.length === 0) {
            this._backdrop?.classList.remove('active');
        }

        setTimeout(() => sheet.remove(), 350);
    }

    closeAll() {
        [...this._sheets].forEach(({ sheet }) => this.close(sheet));
    }

    destroy() {
        this.closeAll();
        this._backdrop?.remove();
        document.getElementById('resiq-bottom-sheet-css')?.remove();
        this._injected = false;
    }
}

const bottomSheet = new BottomSheet();
window.ResIQBottomSheet = bottomSheet;
export default bottomSheet;
