/**
 * ResIQ Empty State Web Component
 * Consistent empty states with illustration, title, description, and CTA
 *
 * Usage:
 * <resiq-empty
 *   icon="calendar"
 *   title="No Reservations"
 *   description="Create your first booking to get started"
 *   action="New Booking"
 *   action-view="reservations"
 * ></resiq-empty>
 */

const EMPTY_ICONS = {
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>',
    creditCard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    building: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>',
    fileText: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/></svg>',
};

class EmptyState extends HTMLElement {
    static get observedAttributes() {
        return ['icon', 'title', 'description', 'action', 'action-view'];
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
        const icon = this.getAttribute('icon') || 'search';
        const title = this.getAttribute('title') || 'Nothing here yet';
        const description = this.getAttribute('description') || '';
        const action = this.getAttribute('action');
        const actionView = this.getAttribute('action-view');

        this.shadowRoot.innerHTML = `
            <style>
                :host { display: block; }
                .empty {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 48px 24px;
                    text-align: center;
                }
                .icon-wrap {
                    width: 72px;
                    height: 72px;
                    border-radius: 50%;
                    background: var(--background-alt, #f1f5f9);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-bottom: 16px;
                    color: var(--text-tertiary, #94a3b8);
                }
                .icon-wrap svg {
                    width: 32px;
                    height: 32px;
                }
                .title {
                    font-size: 17px;
                    font-weight: 600;
                    color: var(--text-primary, #0f172a);
                    margin-bottom: 6px;
                }
                .desc {
                    font-size: 14px;
                    color: var(--text-secondary, #475569);
                    max-width: 300px;
                    line-height: 1.5;
                    margin-bottom: ${action ? '20px' : '0'};
                }
                .action-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 10px 20px;
                    border-radius: 10px;
                    background: var(--primary, #0891b2);
                    color: white;
                    font-size: 14px;
                    font-weight: 600;
                    border: none;
                    cursor: pointer;
                    transition: transform 0.15s ease;
                    -webkit-tap-highlight-color: transparent;
                }
                .action-btn:active {
                    transform: scale(0.95);
                }
            </style>
            <div class="empty">
                <div class="icon-wrap">${EMPTY_ICONS[icon] || EMPTY_ICONS.search}</div>
                <div class="title">${title}</div>
                ${description ? `<div class="desc">${description}</div>` : ''}
                ${action ? `<button class="action-btn">${action}</button>` : ''}
            </div>
        `;

        if (action && actionView) {
            const btn = this.shadowRoot.querySelector('.action-btn');
            btn?.addEventListener('click', () => {
                if (typeof window.showView === 'function') window.showView(actionView);
            });
        }
    }
}

customElements.define('resiq-empty', EmptyState);
export default EmptyState;
