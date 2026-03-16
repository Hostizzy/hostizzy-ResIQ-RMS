/**
 * ResIQ Lightweight View Router
 * - Clean URL routing: /app/dashboard, /app/reservations, etc.
 * - History API integration for browser back/forward
 * - Lazy-load view modules on demand
 * - Route guards and middleware
 * - Smooth transitions via page-transitions module
 */

const VIEW_CONFIG = {
    home:          { title: 'Home',          icon: 'home',           loader: null },
    dashboard:     { title: 'Dashboard',     icon: 'bar-chart-3',    loader: null },
    reservations:  { title: 'Reservations',  icon: 'calendar',       loader: null },
    payments:      { title: 'Payments',      icon: 'credit-card',    loader: null },
    guests:        { title: 'Guests',        icon: 'users',          loader: null },
    properties:    { title: 'Properties',    icon: 'building',       loader: null },
    propertyView:  { title: 'Property',      icon: 'building-2',     loader: null },
    business:      { title: 'Business',      icon: 'briefcase',      loader: null },
    calendar:      { title: 'Calendar',      icon: 'calendar-days',  loader: null },
    enquiries:     { title: 'Enquiries',      icon: 'user-plus',       loader: null },
    communication: { title: 'Communication', icon: 'message-square', loader: null },
    team:          { title: 'Team',          icon: 'users-2',        loader: null },
    owners:        { title: 'Owners',        icon: 'user-check',     loader: null },
    meals:         { title: 'Meals',         icon: 'utensils',       loader: null },
    guestDocuments:{ title: 'Documents',     icon: 'file-text',      loader: null },
    settings:      { title: 'Settings',      icon: 'settings',       loader: null },
    intelligence:  { title: 'Intelligence',  icon: 'brain',          loader: null },
};

/** Extract view name from pathname like /app/dashboard → dashboard */
function getViewFromPath() {
    const path = window.location.pathname;
    // Match /app/viewName or /app
    const match = path.match(/^\/app(?:\/([^/]+))?$/);
    if (match && match[1]) {
        return match[1];
    }
    return null;
}

class ResIQRouter {
    constructor() {
        this._currentView = null;
        this._previousView = null;
        this._guards = [];
        this._middleware = [];
        this._onNavigate = [];
        this._initialized = false;
    }

    init() {
        if (this._initialized) return;

        // Listen for browser back/forward
        window.addEventListener('popstate', (e) => {
            if (e.state?.view) {
                this._navigateInternal(e.state.view, false);
            }
        });

        // Capture initial view from: URL path > URL hash (legacy) > localStorage
        const pathView = getViewFromPath();
        const hashView = window.location.hash.replace('#', '');
        const savedView = localStorage.getItem('lastView');
        const initialView = (pathView && VIEW_CONFIG[pathView]) ? pathView
            : (hashView && VIEW_CONFIG[hashView]) ? hashView
            : (savedView || 'home');

        // Set initial state with clean URL
        window.history.replaceState({ view: initialView }, '', `/app/${initialView}`);
        this._currentView = initialView;

        this._initialized = true;
    }

    /**
     * Navigate to a view
     * @param {string} viewName - The view to navigate to
     * @param {object} options - Navigation options
     */
    async navigate(viewName, options = {}) {
        if (!VIEW_CONFIG[viewName] && viewName !== 'home') {
            console.warn(`[Router] Unknown view: ${viewName}`);
            return;
        }

        // Run guards
        for (const guard of this._guards) {
            const allowed = await guard(viewName, this._currentView);
            if (!allowed) return;
        }

        // Push to browser history with clean URL
        if (options.replace) {
            window.history.replaceState({ view: viewName }, '', `/app/${viewName}`);
        } else {
            window.history.pushState({ view: viewName }, '', `/app/${viewName}`);
        }

        await this._navigateInternal(viewName, true);
    }

    async _navigateInternal(viewName, isUserAction) {
        const from = this._currentView;
        this._previousView = from;
        this._currentView = viewName;

        // Run middleware
        for (const mw of this._middleware) {
            await mw(viewName, from);
        }

        // Lazy load if the view has a loader
        const config = VIEW_CONFIG[viewName];
        if (config?.loader && !config._loaded) {
            try {
                await config.loader();
                config._loaded = true;
            } catch (err) {
                console.error(`[Router] Failed to lazy-load view: ${viewName}`, err);
            }
        }

        // Delegate to existing showView for actual DOM manipulation
        if (typeof window._originalShowView === 'function') {
            await window._originalShowView(viewName);
        } else if (typeof window.showView === 'function') {
            await window.showView(viewName);
        }

        // Update document title
        const title = config?.title || viewName;
        document.title = `${title} - ResIQ`;

        // Save last view
        localStorage.setItem('lastView', viewName);

        // Notify listeners
        this._onNavigate.forEach(fn => fn(viewName, from));
    }

    /** Get current view */
    get current() {
        return this._currentView;
    }

    /** Get previous view */
    get previous() {
        return this._previousView;
    }

    /** Add a navigation guard (return false to prevent navigation) */
    addGuard(fn) {
        this._guards.push(fn);
    }

    /** Add middleware (runs on every navigation) */
    use(fn) {
        this._middleware.push(fn);
    }

    /** Listen for navigation events */
    onNavigate(fn) {
        this._onNavigate.push(fn);
    }

    /** Go back */
    back() {
        window.history.back();
    }

    /** Register a lazy-load function for a view */
    registerLoader(viewName, loaderFn) {
        if (VIEW_CONFIG[viewName]) {
            VIEW_CONFIG[viewName].loader = loaderFn;
        }
    }

    /** Get all registered views */
    get views() {
        return { ...VIEW_CONFIG };
    }
}

const router = new ResIQRouter();
window.ResIQRouter = router;
export default router;
