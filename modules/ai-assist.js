/**
 * ResIQ Smart Suggestions / AI Assist
 * Context-aware suggestions engine that:
 * - Analyzes current view and data to suggest actions
 * - Provides pricing recommendations
 * - Suggests follow-ups for guests
 * - Highlights anomalies and opportunities
 * - Shows actionable insight cards
 * No external AI API needed - pure rule-based intelligence
 */

const AI_CSS = `
/* Smart Suggestions Banner */
.resiq-ai-banner {
    position: fixed;
    bottom: 72px;
    left: 50%;
    transform: translateX(-50%) translateY(120%);
    z-index: 9998;
    max-width: 400px;
    width: calc(100% - 32px);
    transition: transform 0.4s cubic-bezier(0.32, 0.72, 0, 1);
}

.resiq-ai-banner.visible {
    transform: translateX(-50%) translateY(0);
}

@media (min-width: 1025px) {
    .resiq-ai-banner {
        bottom: 24px;
        left: auto;
        right: 24px;
        transform: translateX(0) translateY(120%);
    }
    .resiq-ai-banner.visible {
        transform: translateX(0) translateY(0);
    }
}

.resiq-ai-card {
    background: var(--surface, #ffffff);
    border: 1px solid var(--border, #e2e8f0);
    border-radius: 16px;
    padding: 16px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    position: relative;
    overflow: hidden;
}

[data-theme="dark"] .resiq-ai-card {
    background: var(--surface, #1e293b);
    border-color: rgba(255, 255, 255, 0.08);
}

.resiq-ai-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: var(--gradient-primary, linear-gradient(135deg, #0891b2 0%, #06b6d4 100%));
}

.resiq-ai-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
}

.resiq-ai-icon {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    background: var(--gradient-primary, #0891b2);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    flex-shrink: 0;
}

.resiq-ai-icon svg {
    width: 16px;
    height: 16px;
}

.resiq-ai-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--primary, #0891b2);
}

.resiq-ai-dismiss {
    margin-left: auto;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--background-alt, #f1f5f9);
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-tertiary, #94a3b8);
}

.resiq-ai-dismiss svg {
    width: 14px;
    height: 14px;
}

.resiq-ai-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary, #0f172a);
    margin-bottom: 4px;
    line-height: 1.3;
}

.resiq-ai-body {
    font-size: 13px;
    color: var(--text-secondary, #475569);
    line-height: 1.5;
    margin-bottom: 12px;
}

.resiq-ai-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

.resiq-ai-action {
    padding: 7px 14px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid var(--border, #e2e8f0);
    background: var(--surface, #ffffff);
    color: var(--text-secondary, #475569);
    transition: all 0.15s ease;
    -webkit-tap-highlight-color: transparent;
}

.resiq-ai-action:active {
    transform: scale(0.95);
}

.resiq-ai-action.primary {
    background: var(--primary, #0891b2);
    color: white;
    border-color: var(--primary, #0891b2);
}

/* Suggestion chips in views */
.resiq-ai-chips {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding: 12px 0;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
}

.resiq-ai-chips::-webkit-scrollbar { display: none; }

.resiq-ai-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: 20px;
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
    cursor: pointer;
    border: 1px solid var(--border, #e2e8f0);
    background: var(--surface, #ffffff);
    color: var(--text-secondary, #475569);
    transition: all 0.2s ease;
    -webkit-tap-highlight-color: transparent;
}

[data-theme="dark"] .resiq-ai-chip {
    background: rgba(255, 255, 255, 0.04);
    border-color: rgba(255, 255, 255, 0.08);
}

.resiq-ai-chip:hover {
    border-color: var(--primary, #0891b2);
    color: var(--primary, #0891b2);
}

.resiq-ai-chip svg {
    width: 14px;
    height: 14px;
}

.resiq-ai-chip.highlight {
    background: rgba(8, 145, 178, 0.08);
    border-color: rgba(8, 145, 178, 0.3);
    color: var(--primary, #0891b2);
}

/* Dots indicator for multiple suggestions */
.resiq-ai-dots {
    display: flex;
    justify-content: center;
    gap: 4px;
    margin-top: 8px;
}

.resiq-ai-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--border, #e2e8f0);
    transition: background 0.2s;
}

.resiq-ai-dot.active {
    background: var(--primary, #0891b2);
    width: 16px;
    border-radius: 3px;
}
`;

class AIAssist {
    constructor() {
        this._injected = false;
        this._banner = null;
        this._suggestions = [];
        this._currentIndex = 0;
        this._dismissedIds = new Set();
        this._rotateInterval = null;

        // Load dismissed suggestions
        try {
            const dismissed = localStorage.getItem('resiq_ai_dismissed');
            if (dismissed) this._dismissedIds = new Set(JSON.parse(dismissed));
        } catch (e) { /* ignore */ }
    }

    init() {
        if (this._injected) return;
        const style = document.createElement('style');
        style.id = 'resiq-ai-css';
        style.textContent = AI_CSS;
        document.head.appendChild(style);

        this._createBanner();
        this._injected = true;

        // Generate suggestions periodically
        this._startEngine();
    }

    _createBanner() {
        this._banner = document.createElement('div');
        this._banner.className = 'resiq-ai-banner';
        this._banner.id = 'resiqAIBanner';
        document.body.appendChild(this._banner);
    }

    _startEngine() {
        // Generate on view changes
        const checkInterval = setInterval(() => {
            if (typeof window.showView === 'function' && !window.showView._aiHooked) {
                const origShowView = window.showView;
                window.showView = async function(viewName) {
                    const result = await origShowView.call(this, viewName);
                    // Generate suggestions after view loads (debounced)
                    setTimeout(() => window.ResIQAI?._analyze(viewName), 1500);
                    return result;
                };
                window.showView._aiHooked = true;
                clearInterval(checkInterval);
            }
        }, 500);
        setTimeout(() => clearInterval(checkInterval), 15000);

        // Initial analysis
        setTimeout(() => this._analyze('home'), 5000);

        // Rotate suggestions every 15 seconds
        this._rotateInterval = setInterval(() => this._rotateSuggestion(), 15000);
    }

    /** Analyze data and generate context-aware suggestions */
    _analyze(currentView) {
        const reservations = window.allReservations || window.state?.reservations || [];
        const payments = window.allPayments || window.state?.payments || [];
        const properties = window.state?.properties || [];

        this._suggestions = [];
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const tomorrowStr = new Date(today.getTime() + 86400000).toISOString().split('T')[0];

        // 1. Overdue payments
        const overdueReservations = reservations.filter(r =>
            (r.payment_status === 'Overdue' || r.payment_status === 'Pending') &&
            r.status !== 'cancelled' &&
            (r.total_amount || 0) > (r.paid_amount || 0)
        );
        if (overdueReservations.length > 0) {
            const totalDue = overdueReservations.reduce((s, r) =>
                s + ((r.total_amount || 0) - (r.paid_amount || 0)), 0
            );
            this._suggestions.push({
                id: 'overdue-payments',
                priority: 1,
                title: `₹${totalDue.toLocaleString('en-IN')} in pending payments`,
                body: `${overdueReservations.length} reservation${overdueReservations.length > 1 ? 's' : ''} with outstanding balance. Send reminders to collect faster.`,
                actions: [
                    {
                        label: 'Send Reminders',
                        primary: true,
                        callback: () => {
                            if (window.ResIQWhatsApp) {
                                window.ResIQWhatsApp.openBulkComposer(overdueReservations.slice(0, 10), 'payment_reminder');
                            }
                        }
                    },
                    {
                        label: 'View Payments',
                        callback: () => {
                            if (typeof window.showView === 'function') window.showView('payments');
                        }
                    }
                ]
            });
        }

        // 2. Today's check-ins without documents
        const todayCheckins = reservations.filter(r =>
            r.check_in === todayStr && (r.status === 'confirmed' || r.status === 'pending')
        );
        if (todayCheckins.length > 0) {
            this._suggestions.push({
                id: `checkins-today-${todayStr}`,
                priority: 2,
                title: `${todayCheckins.length} guest${todayCheckins.length > 1 ? 's' : ''} checking in today`,
                body: `${todayCheckins.map(r => r.guest_name).slice(0, 3).join(', ')}${todayCheckins.length > 3 ? ` +${todayCheckins.length - 3} more` : ''}. Send check-in instructions?`,
                actions: [
                    {
                        label: 'Send Instructions',
                        primary: true,
                        callback: () => {
                            if (todayCheckins.length === 1 && window.ResIQWhatsApp) {
                                window.ResIQWhatsApp.openComposer(todayCheckins[0], 'checkin_instructions');
                            } else if (window.ResIQWhatsApp) {
                                window.ResIQWhatsApp.openBulkComposer(todayCheckins, 'checkin_instructions');
                            }
                        }
                    },
                    {
                        label: 'View Bookings',
                        callback: () => {
                            if (typeof window.showView === 'function') window.showView('reservations');
                        }
                    }
                ]
            });
        }

        // 3. Checkouts tomorrow
        const tomorrowCheckouts = reservations.filter(r =>
            r.check_out === tomorrowStr && r.status === 'checked-in'
        );
        if (tomorrowCheckouts.length > 0) {
            this._suggestions.push({
                id: `checkouts-tomorrow-${tomorrowStr}`,
                priority: 3,
                title: `${tomorrowCheckouts.length} check-out${tomorrowCheckouts.length > 1 ? 's' : ''} tomorrow`,
                body: `Remind guests about check-out time and process.`,
                actions: [
                    {
                        label: 'Send Reminders',
                        primary: true,
                        callback: () => {
                            if (window.ResIQWhatsApp) {
                                window.ResIQWhatsApp.openBulkComposer(tomorrowCheckouts, 'checkout_reminder');
                            }
                        }
                    }
                ]
            });
        }

        // 4. Revenue insights
        if (currentView === 'dashboard' || currentView === 'home' || currentView === 'business') {
            const thisMonth = reservations.filter(r => {
                const cin = r.check_in;
                return cin && cin.startsWith(todayStr.substring(0, 7));
            });
            const lastMonth = reservations.filter(r => {
                const lastM = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                const prefix = `${lastM.getFullYear()}-${String(lastM.getMonth() + 1).padStart(2, '0')}`;
                return r.check_in?.startsWith(prefix);
            });

            if (thisMonth.length > 0 && lastMonth.length > 0) {
                const thisRevenue = thisMonth.reduce((s, r) => s + (r.total_amount || 0), 0);
                const lastRevenue = lastMonth.reduce((s, r) => s + (r.total_amount || 0), 0);
                const change = lastRevenue > 0 ? ((thisRevenue - lastRevenue) / lastRevenue * 100).toFixed(0) : 0;

                if (Math.abs(change) > 10) {
                    this._suggestions.push({
                        id: `revenue-trend-${todayStr.substring(0, 7)}`,
                        priority: 5,
                        title: `Revenue ${change > 0 ? 'up' : 'down'} ${Math.abs(change)}% this month`,
                        body: `₹${thisRevenue.toLocaleString('en-IN')} this month vs ₹${lastRevenue.toLocaleString('en-IN')} last month.${change < 0 ? ' Consider running promotions.' : ' Great performance!'}`,
                        actions: [
                            {
                                label: 'View Analytics',
                                primary: true,
                                callback: () => {
                                    if (typeof window.showView === 'function') window.showView('business');
                                }
                            }
                        ]
                    });
                }
            }
        }

        // 5. Occupancy gap detection
        if (currentView === 'availability' || currentView === 'home' || currentView === 'properties') {
            const next7Days = [];
            for (let i = 1; i <= 7; i++) {
                const d = new Date(today.getTime() + i * 86400000);
                next7Days.push(d.toISOString().split('T')[0]);
            }

            const bookedDates = new Set();
            reservations.forEach(r => {
                if (r.status === 'cancelled') return;
                const cin = new Date(r.check_in);
                const cout = new Date(r.check_out);
                for (let d = cin; d < cout; d.setDate(d.getDate() + 1)) {
                    bookedDates.add(d.toISOString().split('T')[0]);
                }
            });

            const gapDays = next7Days.filter(d => !bookedDates.has(d));
            if (gapDays.length >= 3 && properties.length > 0) {
                this._suggestions.push({
                    id: `occupancy-gap-${todayStr}`,
                    priority: 4,
                    title: `${gapDays.length} open day${gapDays.length > 1 ? 's' : ''} in the next week`,
                    body: `You have availability gaps. Consider adjusting pricing or running last-minute deals.`,
                    actions: [
                        {
                            label: 'View Calendar',
                            primary: true,
                            callback: () => {
                                if (typeof window.showView === 'function') window.showView('availability');
                            }
                        }
                    ]
                });
            }
        }

        // 6. Uncollected thank-you messages
        const recentCheckouts = reservations.filter(r => {
            if (r.status !== 'checked-out') return false;
            const cout = new Date(r.check_out);
            const daysSince = (today - cout) / 86400000;
            return daysSince >= 0 && daysSince <= 3;
        });
        if (recentCheckouts.length > 0) {
            this._suggestions.push({
                id: `thank-you-${todayStr}`,
                priority: 6,
                title: `Send thank-you to ${recentCheckouts.length} recent guest${recentCheckouts.length > 1 ? 's' : ''}`,
                body: `${recentCheckouts.map(r => r.guest_name).slice(0, 3).join(', ')}. A follow-up improves reviews and repeat bookings.`,
                actions: [
                    {
                        label: 'Send Thank You',
                        primary: true,
                        callback: () => {
                            if (window.ResIQWhatsApp) {
                                window.ResIQWhatsApp.openBulkComposer(recentCheckouts, 'thank_you');
                            }
                        }
                    }
                ]
            });
        }

        // Filter dismissed and sort by priority
        this._suggestions = this._suggestions
            .filter(s => !this._dismissedIds.has(s.id))
            .sort((a, b) => a.priority - b.priority);

        // Show first suggestion
        this._currentIndex = 0;
        this._showCurrentSuggestion();
    }

    _showCurrentSuggestion() {
        if (!this._banner || this._suggestions.length === 0) {
            this._banner?.classList.remove('visible');
            return;
        }

        const suggestion = this._suggestions[this._currentIndex % this._suggestions.length];
        if (!suggestion) return;

        const dotsHTML = this._suggestions.length > 1 ? `
            <div class="resiq-ai-dots">
                ${this._suggestions.map((_, i) => `
                    <div class="resiq-ai-dot ${i === this._currentIndex % this._suggestions.length ? 'active' : ''}"></div>
                `).join('')}
            </div>
        ` : '';

        this._banner.innerHTML = `
            <div class="resiq-ai-card">
                <div class="resiq-ai-header">
                    <div class="resiq-ai-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a4.5 4.5 0 0 0-4.5 4.5c0 3 4.5 7.5 4.5 7.5s4.5-4.5 4.5-7.5A4.5 4.5 0 0 0 12 2z"/><circle cx="12" cy="6.5" r="1.5"/><path d="M5 20h14"/><path d="M8 20l1-4h6l1 4"/></svg>
                    </div>
                    <div class="resiq-ai-label">Smart Suggestion</div>
                    <button class="resiq-ai-dismiss" title="Dismiss">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
                    </button>
                </div>
                <div class="resiq-ai-title">${suggestion.title}</div>
                <div class="resiq-ai-body">${suggestion.body}</div>
                <div class="resiq-ai-actions">
                    ${(suggestion.actions || []).map(a => `
                        <button class="resiq-ai-action ${a.primary ? 'primary' : ''}" data-action-id="${a.label}">${a.label}</button>
                    `).join('')}
                </div>
                ${dotsHTML}
            </div>
        `;

        // Bind dismiss
        this._banner.querySelector('.resiq-ai-dismiss').addEventListener('click', () => {
            this._dismiss(suggestion.id);
        });

        // Bind actions
        this._banner.querySelectorAll('.resiq-ai-action').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = suggestion.actions?.find(a => a.label === btn.dataset.actionId);
                if (action?.callback) action.callback();
                this._banner.classList.remove('visible');
            });
        });

        this._banner.classList.add('visible');
    }

    _rotateSuggestion() {
        if (this._suggestions.length <= 1) return;
        this._currentIndex = (this._currentIndex + 1) % this._suggestions.length;
        this._showCurrentSuggestion();
    }

    _dismiss(id) {
        this._dismissedIds.add(id);
        try {
            localStorage.setItem('resiq_ai_dismissed', JSON.stringify([...this._dismissedIds]));
        } catch (e) { /* ignore */ }

        this._suggestions = this._suggestions.filter(s => s.id !== id);
        if (this._suggestions.length === 0) {
            this._banner?.classList.remove('visible');
        } else {
            this._currentIndex = this._currentIndex % this._suggestions.length;
            this._showCurrentSuggestion();
        }
    }

    /** Get suggestion chips for a view */
    getChipsHTML(viewName) {
        const chips = [];

        if (viewName === 'reservations') {
            chips.push({ label: 'Pending Payments', icon: '⚠️', filter: 'payment_status=Pending' });
            chips.push({ label: "Today's Check-ins", icon: '📅', filter: 'checkin_today' });
            chips.push({ label: 'Overdue', icon: '🔴', filter: 'payment_status=Overdue' });
        }
        if (viewName === 'payments') {
            chips.push({ label: 'Uncollected', icon: '💰', filter: 'status=Pending' });
            chips.push({ label: 'This Month', icon: '📊', filter: 'month_current' });
        }

        return chips.map(c => `
            <button class="resiq-ai-chip" data-filter="${c.filter || ''}">
                ${c.icon || ''} ${c.label}
            </button>
        `).join('');
    }

    /** Force re-analyze */
    refresh() {
        const lastView = localStorage.getItem('lastView') || 'home';
        this._analyze(lastView);
    }

    destroy() {
        this._banner?.remove();
        clearInterval(this._rotateInterval);
        document.getElementById('resiq-ai-css')?.remove();
        this._injected = false;
    }
}

const aiAssist = new AIAssist();
window.ResIQAI = aiAssist;
export default aiAssist;
