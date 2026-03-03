/**
 * ResIQ Skeleton Loading
 * Shimmer skeleton screens for every view while data loads
 * Automatically detects view transitions and shows appropriate skeletons
 */

const SKELETON_CSS = `
/* Base skeleton shimmer */
.skel {
    background: var(--background-alt, #f1f5f9);
    border-radius: 6px;
    position: relative;
    overflow: hidden;
}

.skel::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
        90deg,
        transparent 0%,
        rgba(255, 255, 255, 0.4) 50%,
        transparent 100%
    );
    animation: skelShimmer 1.5s infinite;
    transform: translateX(-100%);
}

[data-theme="dark"] .skel {
    background: rgba(255, 255, 255, 0.06);
}

[data-theme="dark"] .skel::after {
    background: linear-gradient(
        90deg,
        transparent 0%,
        rgba(255, 255, 255, 0.08) 50%,
        transparent 100%
    );
}

@keyframes skelShimmer {
    100% { transform: translateX(100%); }
}

/* Skeleton container */
.skel-container {
    padding: 16px;
    animation: skelFadeIn 0.3s ease;
}

@keyframes skelFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

/* Specific skeleton shapes */
.skel-text { height: 14px; margin-bottom: 8px; }
.skel-text-sm { height: 12px; margin-bottom: 6px; }
.skel-text-lg { height: 18px; margin-bottom: 10px; }
.skel-heading { height: 24px; width: 60%; margin-bottom: 16px; }
.skel-subheading { height: 16px; width: 40%; margin-bottom: 12px; }

.skel-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    flex-shrink: 0;
}

.skel-badge {
    width: 60px;
    height: 24px;
    border-radius: 12px;
}

.skel-button {
    width: 100px;
    height: 36px;
    border-radius: 8px;
}

/* Card skeleton */
.skel-card {
    background: var(--surface, #fff);
    border: 1px solid var(--border, #e2e8f0);
    border-radius: var(--radius-md, 12px);
    padding: 16px;
    margin-bottom: 12px;
}

[data-theme="dark"] .skel-card {
    background: rgba(255, 255, 255, 0.03);
    border-color: rgba(255, 255, 255, 0.06);
}

/* Stat card skeleton */
.skel-stat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 12px;
    margin-bottom: 20px;
}

.skel-stat-card {
    padding: 16px;
    border-radius: var(--radius-md, 12px);
    background: var(--surface, #fff);
    border: 1px solid var(--border, #e2e8f0);
}

[data-theme="dark"] .skel-stat-card {
    background: rgba(255, 255, 255, 0.03);
    border-color: rgba(255, 255, 255, 0.06);
}

/* Table skeleton */
.skel-table {
    width: 100%;
    border-collapse: collapse;
}

.skel-table-row {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    gap: 16px;
    border-bottom: 1px solid var(--border-light, #f1f5f9);
}

/* Chart skeleton */
.skel-chart {
    height: 200px;
    border-radius: var(--radius-md, 12px);
    margin-bottom: 16px;
}

/* Row flex helper */
.skel-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
}

.skel-col {
    flex: 1;
}

/* Fade out when content loads */
.skel-container.fade-out {
    opacity: 0;
    transition: opacity 0.2s ease;
    pointer-events: none;
}
`;

// Skeleton templates for each view
const SKELETONS = {
    home: () => `
        <div class="skel-container" data-skeleton="home">
            <div class="skel-card" style="padding: 24px; margin-bottom: 20px;">
                <div class="skel skel-text-lg" style="width: 40%;"></div>
                <div class="skel skel-heading" style="width: 55%;"></div>
                <div class="skel skel-text" style="width: 35%;"></div>
            </div>
            <div class="skel skel-subheading"></div>
            <div class="skel-stat-grid">
                ${Array(4).fill('<div class="skel-stat-card"><div class="skel skel-text-sm" style="width: 60%;"></div><div class="skel skel-heading" style="width: 40%; margin-top: 8px;"></div><div class="skel skel-text-sm" style="width: 80%;"></div></div>').join('')}
            </div>
            <div class="skel skel-subheading" style="margin-top: 20px;"></div>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;">
                ${Array(8).fill('<div class="skel" style="height: 80px; border-radius: 12px;"></div>').join('')}
            </div>
        </div>
    `,

    dashboard: () => `
        <div class="skel-container" data-skeleton="dashboard">
            <div class="skel-row" style="justify-content: space-between; margin-bottom: 20px;">
                <div class="skel skel-heading" style="margin: 0;"></div>
                <div class="skel skel-button"></div>
            </div>
            <div class="skel-stat-grid" style="grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));">
                ${Array(5).fill('<div class="skel-stat-card"><div class="skel skel-text-sm" style="width: 60%;"></div><div class="skel skel-heading" style="width: 50%; margin-top: 8px;"></div><div class="skel skel-text-sm" style="width: 70%;"></div></div>').join('')}
            </div>
            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 16px; margin-top: 20px;">
                <div class="skel skel-chart" style="height: 250px;"></div>
                <div class="skel skel-chart" style="height: 250px;"></div>
            </div>
        </div>
    `,

    reservations: () => `
        <div class="skel-container" data-skeleton="reservations">
            <div class="skel-row" style="justify-content: space-between; margin-bottom: 16px;">
                <div class="skel skel-heading" style="margin: 0;"></div>
                <div class="skel-row" style="gap: 8px; margin: 0;">
                    <div class="skel skel-button" style="width: 120px;"></div>
                    <div class="skel skel-button"></div>
                </div>
            </div>
            <div class="skel-row" style="gap: 8px; margin-bottom: 16px;">
                <div class="skel" style="flex: 1; height: 40px; border-radius: 8px;"></div>
                ${Array(3).fill('<div class="skel skel-badge" style="width: 80px; height: 32px;"></div>').join('')}
            </div>
            ${Array(6).fill(`
                <div class="skel-card">
                    <div class="skel-row">
                        <div class="skel skel-avatar"></div>
                        <div class="skel-col">
                            <div class="skel skel-text" style="width: 70%;"></div>
                            <div class="skel skel-text-sm" style="width: 50%;"></div>
                        </div>
                        <div class="skel skel-badge"></div>
                        <div class="skel skel-text" style="width: 80px;"></div>
                    </div>
                </div>
            `).join('')}
        </div>
    `,

    payments: () => `
        <div class="skel-container" data-skeleton="payments">
            <div class="skel-row" style="justify-content: space-between; margin-bottom: 16px;">
                <div class="skel skel-heading" style="margin: 0;"></div>
                <div class="skel skel-button"></div>
            </div>
            <div class="skel-stat-grid" style="grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); margin-bottom: 20px;">
                ${Array(4).fill('<div class="skel-stat-card"><div class="skel skel-text-sm" style="width: 50%;"></div><div class="skel skel-heading" style="width: 60%; margin-top: 8px;"></div></div>').join('')}
            </div>
            ${Array(5).fill(`
                <div class="skel-card">
                    <div class="skel-row">
                        <div class="skel-col">
                            <div class="skel skel-text" style="width: 60%;"></div>
                            <div class="skel skel-text-sm" style="width: 40%;"></div>
                        </div>
                        <div class="skel skel-text-lg" style="width: 80px;"></div>
                        <div class="skel skel-badge"></div>
                    </div>
                </div>
            `).join('')}
        </div>
    `,

    guests: () => `
        <div class="skel-container" data-skeleton="guests">
            <div class="skel-row" style="justify-content: space-between; margin-bottom: 16px;">
                <div class="skel skel-heading" style="margin: 0;"></div>
                <div class="skel-row" style="gap: 8px; margin: 0;">
                    <div class="skel" style="width: 200px; height: 36px; border-radius: 8px;"></div>
                </div>
            </div>
            ${Array(6).fill(`
                <div class="skel-card">
                    <div class="skel-row">
                        <div class="skel skel-avatar"></div>
                        <div class="skel-col">
                            <div class="skel skel-text" style="width: 50%;"></div>
                            <div class="skel skel-text-sm" style="width: 70%;"></div>
                        </div>
                        <div class="skel skel-text-sm" style="width: 60px;"></div>
                    </div>
                </div>
            `).join('')}
        </div>
    `,

    properties: () => `
        <div class="skel-container" data-skeleton="properties">
            <div class="skel-row" style="justify-content: space-between; margin-bottom: 16px;">
                <div class="skel skel-heading" style="margin: 0;"></div>
                <div class="skel skel-button"></div>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px;">
                ${Array(4).fill(`
                    <div class="skel-card">
                        <div class="skel" style="height: 120px; border-radius: 8px; margin-bottom: 12px;"></div>
                        <div class="skel skel-text-lg" style="width: 60%;"></div>
                        <div class="skel skel-text" style="width: 80%;"></div>
                        <div class="skel-row" style="margin-top: 12px;">
                            <div class="skel skel-badge"></div>
                            <div class="skel skel-text" style="width: 60px;"></div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `,

    business: () => `
        <div class="skel-container" data-skeleton="business">
            <div class="skel skel-heading"></div>
            <div class="skel-stat-grid" style="grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));">
                ${Array(6).fill('<div class="skel-stat-card"><div class="skel skel-text-sm" style="width: 50%;"></div><div class="skel skel-heading" style="width: 60%; margin-top: 8px;"></div></div>').join('')}
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 20px;">
                <div class="skel skel-chart" style="height: 300px;"></div>
                <div class="skel skel-chart" style="height: 300px;"></div>
            </div>
        </div>
    `,

    // Generic fallback for other views
    generic: () => `
        <div class="skel-container" data-skeleton="generic">
            <div class="skel skel-heading"></div>
            <div class="skel-stat-grid">
                ${Array(3).fill('<div class="skel-stat-card"><div class="skel skel-text-sm" style="width: 50%;"></div><div class="skel skel-heading" style="width: 60%; margin-top: 8px;"></div></div>').join('')}
            </div>
            ${Array(4).fill(`
                <div class="skel-card">
                    <div class="skel-row">
                        <div class="skel skel-avatar"></div>
                        <div class="skel-col">
                            <div class="skel skel-text" style="width: 60%;"></div>
                            <div class="skel skel-text-sm" style="width: 40%;"></div>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `,
};

class SkeletonLoader {
    constructor() {
        this._injected = false;
        this._active = new Map(); // viewName -> skeleton element
    }

    init() {
        if (this._injected) return;
        const style = document.createElement('style');
        style.id = 'resiq-skeleton-css';
        style.textContent = SKELETON_CSS;
        document.head.appendChild(style);
        this._injected = true;

        // Hook into showView to show skeletons
        this._hookShowView();
    }

    /** Show skeleton for a specific view */
    show(viewName) {
        // Don't show if already active
        if (this._active.has(viewName)) return;

        const viewEl = document.getElementById(`${viewName}View`);
        if (!viewEl) return;

        const template = SKELETONS[viewName] || SKELETONS.generic;
        const wrapper = document.createElement('div');
        wrapper.innerHTML = template();
        const skeleton = wrapper.firstElementChild;
        skeleton.dataset.skeleton = viewName;

        // Insert skeleton at the top of the view
        viewEl.insertBefore(skeleton, viewEl.firstChild);
        this._active.set(viewName, skeleton);
    }

    /** Hide skeleton for a specific view with fade-out */
    hide(viewName) {
        const skeleton = this._active.get(viewName);
        if (!skeleton) return;

        skeleton.classList.add('fade-out');
        setTimeout(() => {
            skeleton.remove();
            this._active.delete(viewName);
        }, 200);
    }

    /** Hook into the existing showView function */
    _hookShowView() {
        const self = this;
        const checkInterval = setInterval(() => {
            if (typeof window.showView === 'function' && !window.showView._skeletonHooked) {
                const originalShowView = window.showView;
                window.showView = async function(viewName) {
                    // Show skeleton before view loads
                    self.show(viewName);

                    try {
                        const result = await originalShowView.call(this, viewName);

                        // Hide skeleton after data loads
                        // Use a small delay to ensure DOM has updated
                        requestAnimationFrame(() => {
                            setTimeout(() => self.hide(viewName), 100);
                        });

                        return result;
                    } catch (error) {
                        self.hide(viewName);
                        throw error;
                    }
                };
                window.showView._skeletonHooked = true;
                clearInterval(checkInterval);
            }
        }, 300);

        setTimeout(() => clearInterval(checkInterval), 15000);
    }

    /** Manually insert skeleton into any container */
    insertInto(container, type = 'generic') {
        const template = SKELETONS[type] || SKELETONS.generic;
        const wrapper = document.createElement('div');
        wrapper.innerHTML = template();
        const skeleton = wrapper.firstElementChild;
        container.appendChild(skeleton);
        return skeleton;
    }

    /** Remove skeleton from container */
    removeFrom(container) {
        const skeletons = container.querySelectorAll('.skel-container');
        skeletons.forEach(s => {
            s.classList.add('fade-out');
            setTimeout(() => s.remove(), 200);
        });
    }

    destroy() {
        this._active.forEach((el) => el.remove());
        this._active.clear();
        document.getElementById('resiq-skeleton-css')?.remove();
        this._injected = false;
    }
}

const skeletonLoader = new SkeletonLoader();
window.ResIQSkeleton = skeletonLoader;
export default skeletonLoader;
