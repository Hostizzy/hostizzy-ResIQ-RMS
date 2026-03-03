/**
 * ResIQ Status Badge Web Component
 * Consistent status badges across the app
 *
 * Usage:
 * <resiq-badge status="confirmed"></resiq-badge>
 * <resiq-badge status="Paid" type="payment"></resiq-badge>
 * <resiq-badge text="Custom" color="#3b82f6"></resiq-badge>
 */

const STATUS_COLORS = {
    // Reservation statuses
    confirmed: { bg: 'rgba(5, 150, 105, 0.1)', text: '#059669', label: 'Confirmed' },
    'checked-in': { bg: 'rgba(8, 145, 178, 0.1)', text: '#0891b2', label: 'Checked In' },
    'checked-out': { bg: 'rgba(71, 85, 105, 0.1)', text: '#475569', label: 'Checked Out' },
    pending: { bg: 'rgba(245, 158, 11, 0.1)', text: '#d97706', label: 'Pending' },
    cancelled: { bg: 'rgba(220, 38, 38, 0.1)', text: '#dc2626', label: 'Cancelled' },

    // Payment statuses
    paid: { bg: 'rgba(5, 150, 105, 0.1)', text: '#059669', label: 'Paid' },
    partial: { bg: 'rgba(245, 158, 11, 0.1)', text: '#d97706', label: 'Partial' },
    overdue: { bg: 'rgba(220, 38, 38, 0.1)', text: '#dc2626', label: 'Overdue' },
    unpaid: { bg: 'rgba(220, 38, 38, 0.08)', text: '#dc2626', label: 'Unpaid' },

    // Document statuses
    verified: { bg: 'rgba(5, 150, 105, 0.1)', text: '#059669', label: 'Verified' },
    rejected: { bg: 'rgba(220, 38, 38, 0.1)', text: '#dc2626', label: 'Rejected' },
    incomplete: { bg: 'rgba(245, 158, 11, 0.1)', text: '#d97706', label: 'Incomplete' },

    // Booking sources
    airbnb: { bg: 'rgba(255, 56, 92, 0.1)', text: '#FF385C', label: 'Airbnb' },
    'booking.com': { bg: 'rgba(0, 53, 128, 0.1)', text: '#003580', label: 'Booking.com' },
    agoda: { bg: 'rgba(107, 23, 141, 0.1)', text: '#6B178D', label: 'Agoda' },
    makemytrip: { bg: 'rgba(1, 55, 131, 0.1)', text: '#013783', label: 'MakeMyTrip' },
    manual: { bg: 'rgba(71, 85, 105, 0.1)', text: '#475569', label: 'Manual' },
};

class StatusBadge extends HTMLElement {
    static get observedAttributes() {
        return ['status', 'type', 'text', 'color', 'bg', 'size'];
    }

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        this.render();
    }

    attributeChangedCallback() {
        this.render();
    }

    render() {
        const status = (this.getAttribute('status') || '').toLowerCase();
        const customText = this.getAttribute('text');
        const customColor = this.getAttribute('color');
        const customBg = this.getAttribute('bg');
        const size = this.getAttribute('size') || 'sm';

        const config = STATUS_COLORS[status] || {
            bg: customBg || 'rgba(71, 85, 105, 0.1)',
            text: customColor || '#475569',
            label: customText || status || 'Unknown',
        };

        const label = customText || config.label;
        const padding = size === 'lg' ? '6px 14px' : size === 'md' ? '4px 10px' : '3px 8px';
        const fontSize = size === 'lg' ? '13px' : size === 'md' ? '12px' : '11px';

        this.shadowRoot.innerHTML = `
            <style>
                :host { display: inline-flex; }
                .badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    padding: ${padding};
                    border-radius: 20px;
                    font-size: ${fontSize};
                    font-weight: 600;
                    line-height: 1;
                    white-space: nowrap;
                    background: ${customBg || config.bg};
                    color: ${customColor || config.text};
                    letter-spacing: 0.2px;
                }
                .dot {
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    background: currentColor;
                }
            </style>
            <span class="badge">
                <span class="dot"></span>
                ${label}
            </span>
        `;
    }
}

customElements.define('resiq-badge', StatusBadge);
export default StatusBadge;
