/**
 * ResIQ Stat Card Web Component
 * Reusable metric/stat card with:
 * - Animated counter
 * - Trend indicator
 * - Icon and color support
 * - Click to navigate
 * - Skeleton state
 *
 * Usage:
 * <resiq-stat-card
 *   label="Total Revenue"
 *   value="125000"
 *   prefix="₹"
 *   trend="+12.5"
 *   icon="trending-up"
 *   color="var(--success)"
 *   href="business"
 * ></resiq-stat-card>
 */

class StatCard extends HTMLElement {
    static get observedAttributes() {
        return ['label', 'value', 'prefix', 'suffix', 'trend', 'icon', 'color', 'href', 'loading'];
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
        const label = this.getAttribute('label') || '';
        const value = this.getAttribute('value') || '0';
        const prefix = this.getAttribute('prefix') || '';
        const suffix = this.getAttribute('suffix') || '';
        const trend = this.getAttribute('trend') || '';
        const color = this.getAttribute('color') || 'var(--primary, #0891b2)';
        const href = this.getAttribute('href') || '';
        const loading = this.hasAttribute('loading');

        const trendNum = parseFloat(trend);
        const isPositive = trendNum > 0;
        const trendColor = isPositive ? 'var(--success, #059669)' : 'var(--danger, #dc2626)';
        const trendArrow = isPositive ? '↑' : '↓';

        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    cursor: ${href ? 'pointer' : 'default'};
                }
                .card {
                    background: var(--surface, #ffffff);
                    border: 1px solid var(--border, #e2e8f0);
                    border-radius: var(--radius-md, 12px);
                    padding: 16px;
                    transition: transform 0.2s ease, box-shadow 0.2s ease;
                    position: relative;
                    overflow: hidden;
                }
                :host(:hover) .card {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
                }
                :host(:active) .card {
                    transform: scale(0.98);
                }
                .card::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 3px;
                    background: ${color};
                }
                .label {
                    font-size: 12px;
                    font-weight: 500;
                    color: var(--text-secondary, #475569);
                    text-transform: uppercase;
                    letter-spacing: 0.3px;
                    margin-bottom: 8px;
                }
                .value {
                    font-size: 24px;
                    font-weight: 700;
                    color: var(--text-primary, #0f172a);
                    line-height: 1.2;
                    margin-bottom: 6px;
                }
                .prefix, .suffix {
                    font-size: 16px;
                    font-weight: 500;
                    opacity: 0.7;
                }
                .trend {
                    display: inline-flex;
                    align-items: center;
                    gap: 2px;
                    font-size: 12px;
                    font-weight: 600;
                    padding: 2px 6px;
                    border-radius: 4px;
                    background: ${trend ? (isPositive ? 'rgba(5, 150, 105, 0.1)' : 'rgba(220, 38, 38, 0.1)') : 'transparent'};
                    color: ${trend ? trendColor : 'transparent'};
                }
                /* Skeleton */
                .skeleton .label,
                .skeleton .value,
                .skeleton .trend {
                    background: var(--background-alt, #f1f5f9);
                    color: transparent;
                    border-radius: 4px;
                    position: relative;
                    overflow: hidden;
                }
                .skeleton .label { width: 60%; height: 14px; }
                .skeleton .value { width: 50%; height: 28px; }
                .skeleton .trend { width: 40px; height: 18px; }
                .skeleton .label::after,
                .skeleton .value::after,
                .skeleton .trend::after {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
                    animation: shimmer 1.5s infinite;
                    transform: translateX(-100%);
                }
                @keyframes shimmer {
                    100% { transform: translateX(100%); }
                }
                @media (prefers-color-scheme: dark) {
                    .card { background: rgba(255,255,255,0.03); border-color: rgba(255,255,255,0.06); }
                    .skeleton .label, .skeleton .value, .skeleton .trend {
                        background: rgba(255,255,255,0.06);
                    }
                }
            </style>
            <div class="card ${loading ? 'skeleton' : ''}">
                <div class="label">${label}</div>
                <div class="value">
                    ${prefix ? `<span class="prefix">${prefix}</span>` : ''}
                    ${loading ? '---' : this._formatNumber(value)}
                    ${suffix ? `<span class="suffix">${suffix}</span>` : ''}
                </div>
                ${trend ? `<div class="trend">${trendArrow} ${Math.abs(trendNum)}%</div>` : '<div class="trend" style="visibility:hidden">-</div>'}
            </div>
        `;

        if (href) {
            this.onclick = () => {
                if (typeof window.showView === 'function') window.showView(href);
            };
        }
    }

    _formatNumber(val) {
        const num = parseFloat(val);
        if (isNaN(num)) return val;
        if (num >= 10000000) return (num / 10000000).toFixed(1) + 'Cr';
        if (num >= 100000) return (num / 100000).toFixed(1) + 'L';
        if (num >= 1000) return num.toLocaleString('en-IN');
        return num.toString();
    }
}

customElements.define('resiq-stat-card', StatCard);
export default StatCard;
