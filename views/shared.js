/**
 * ResIQ Shared Utilities
 * Common functions used across multiple views.
 * These are re-exported from the monolith globals for now,
 * and will be fully extracted in future iterations.
 *
 * Usage in view modules:
 *   import { formatCurrency, showToast, db } from '../views/shared.js';
 */

// ============================================
// Proxy to existing globals
// ============================================

/** Format currency in Indian notation (Cr, L) */
export function formatCurrency(amount, options = {}) {
    if (typeof window.formatCurrency === 'function') {
        return window.formatCurrency(amount, options);
    }
    const val = parseFloat(amount) || 0;
    return '₹' + Math.round(val).toLocaleString('en-IN');
}

/** Format date string to readable format */
export function formatDate(dateString) {
    if (typeof window.formatDate === 'function') {
        return window.formatDate(dateString);
    }
    if (!dateString) return 'N/A';
    const d = new Date(dateString);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Format percentage */
export function formatPercentage(value) {
    if (typeof window.formatPercentage === 'function') {
        return window.formatPercentage(value);
    }
    return `${(parseFloat(value) || 0).toFixed(1)}%`;
}

/** Show toast notification */
export function showToast(title, message, icon = '') {
    if (typeof window.showToast === 'function') {
        return window.showToast(title, message, icon);
    }
    console.log(`[Toast] ${title}: ${message}`);
}

/** Refresh Lucide icons */
export function refreshIcons() {
    if (typeof window.refreshIcons === 'function') {
        return window.refreshIcons();
    }
    if (window.lucide?.createIcons) {
        window.lucide.createIcons();
    }
}

/** Get the Supabase DB proxy */
export function getDB() {
    return window.db;
}

/** Navigate to a view */
export function navigateTo(viewName) {
    if (window.ResIQRouter) {
        window.ResIQRouter.navigate(viewName);
    } else if (typeof window.showView === 'function') {
        window.showView(viewName);
    }
}

/** Get booking source badge HTML */
export function getBookingSourceBadge(source) {
    if (typeof window.getBookingSourceBadge === 'function') {
        return window.getBookingSourceBadge(source);
    }
    return source || 'N/A';
}

// ============================================
// Pure utility functions (framework-free)
// ============================================

/** Debounce a function call */
export function debounce(fn, ms = 300) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    };
}

/** Throttle a function call */
export function throttle(fn, ms = 200) {
    let last = 0;
    return (...args) => {
        const now = Date.now();
        if (now - last >= ms) {
            last = now;
            fn(...args);
        }
    };
}

/** Format Indian number (Lakhs/Crores) */
export function formatIndianNumber(num) {
    const n = parseFloat(num) || 0;
    if (n >= 10000000) return `${(n / 10000000).toFixed(1)}Cr`;
    if (n >= 100000) return `${(n / 100000).toFixed(1)}L`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
}

/** Parse date string safely */
export function parseDate(str) {
    if (!str) return null;
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
}

/** Calculate nights between two dates */
export function calculateNights(checkIn, checkOut) {
    const a = new Date(checkIn);
    const b = new Date(checkOut);
    return Math.max(0, Math.round((b - a) / 86400000));
}

/** Deep clone an object */
export function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
}
