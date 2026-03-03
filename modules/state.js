/**
 * ResIQ Centralized State Management
 * Reactive store with pub/sub pattern for cross-module communication
 */

class Store {
    constructor(initialState = {}) {
        this._state = new Proxy(initialState, {
            set: (target, property, value) => {
                const oldValue = target[property];
                target[property] = value;
                if (oldValue !== value) {
                    this._notify(property, value, oldValue);
                }
                return true;
            }
        });
        this._listeners = new Map();
        this._middlewares = [];
    }

    get state() {
        return this._state;
    }

    /** Subscribe to a specific state key or '*' for all changes */
    subscribe(key, callback) {
        if (!this._listeners.has(key)) {
            this._listeners.set(key, new Set());
        }
        this._listeners.get(key).add(callback);
        return () => this._listeners.get(key)?.delete(callback);
    }

    /** Add middleware that runs before state changes */
    use(middleware) {
        this._middlewares.push(middleware);
    }

    /** Batch multiple state updates (single notification) */
    batch(updates) {
        const changes = {};
        for (const [key, value] of Object.entries(updates)) {
            const oldValue = this._state[key];
            if (oldValue !== value) {
                changes[key] = { oldValue, newValue: value };
            }
        }

        // Apply all changes
        Object.assign(this._state, updates);

        // Notify once per key
        for (const [key, { newValue, oldValue }] of Object.entries(changes)) {
            this._notify(key, newValue, oldValue);
        }
    }

    /** Get a computed/derived value */
    select(selectorFn) {
        return selectorFn(this._state);
    }

    _notify(property, value, oldValue) {
        // Run middlewares
        for (const mw of this._middlewares) {
            mw({ property, value, oldValue, state: this._state });
        }

        // Notify specific listeners
        const listeners = this._listeners.get(property);
        if (listeners) {
            for (const cb of listeners) {
                try { cb(value, oldValue, property); } catch (e) { console.error('Store listener error:', e); }
            }
        }

        // Notify wildcard listeners
        const wildcardListeners = this._listeners.get('*');
        if (wildcardListeners) {
            for (const cb of wildcardListeners) {
                try { cb(value, oldValue, property); } catch (e) { console.error('Store wildcard listener error:', e); }
            }
        }
    }
}

// Create singleton store with initial state
const store = new Store({
    // App state
    currentView: 'home',
    previousView: null,
    isOnline: navigator.onLine,
    isMobile: window.innerWidth <= 768,
    isTablet: window.innerWidth > 768 && window.innerWidth <= 1024,

    // Data
    reservations: [],
    properties: [],
    payments: [],
    guests: [],
    teamMembers: [],
    owners: [],
    documents: [],

    // UI state
    sidebarOpen: false,
    bottomSheetOpen: false,
    notificationCenterOpen: false,
    activeModal: null,

    // Notifications
    notifications: [],
    unreadCount: 0,

    // Filters
    activeFilters: {},

    // Loading states
    loading: {},
});

// Middleware: Sync with existing global state
store.use(({ property, value }) => {
    if (property === 'reservations' && window.allReservations !== undefined) {
        window.allReservations = value;
    }
    if (property === 'payments' && window.allPayments !== undefined) {
        window.allPayments = value;
    }
    if (property === 'currentView') {
        try { localStorage.setItem('lastView', value); } catch (e) { /* ignore */ }
    }
});

// Listen to window resize for responsive state
let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        store.batch({
            isMobile: window.innerWidth <= 768,
            isTablet: window.innerWidth > 768 && window.innerWidth <= 1024,
        });
    }, 150);
});

// Listen to online/offline
window.addEventListener('online', () => { store.state.isOnline = true; });
window.addEventListener('offline', () => { store.state.isOnline = false; });

// Export
window.ResIQStore = store;
export default store;
