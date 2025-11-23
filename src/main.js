/**
 * ResIQ Main Entry Point
 * This file is the entry point for Vite build system
 */

// Import styles
import './styles/main.css'

// Import Supabase (will be bundled by Vite)
import { createClient } from '@supabase/supabase-js'

// Make Supabase available globally (for legacy code compatibility)
window.createClient = createClient

// Import modular scripts (Phase 2 - In Progress)
// Foundation modules
import './scripts/config.js'      // Supabase setup, constants
import './scripts/state.js'       // Global state management
import './scripts/utils.js'       // Formatters, validators, helpers
import './scripts/ui.js'          // UI utilities (toasts, loading, modals)

// Core modules
import './scripts/database.js'      // DB operations, IndexedDB
import './scripts/auth.js'          // Login, logout, session management
import './scripts/templates.js'     // WhatsApp message templates
import './scripts/whatsapp.js'      // WhatsApp integration
import './scripts/invoicing.js'     // GST Invoice generation, PDF export
import './scripts/communications.js' // Unified communications hub (WhatsApp, Email, SMS)

// Feature modules
import './scripts/reservations.js'  // Reservation CRUD, modals, filtering
import './scripts/payments.js'      // Payment CRUD, multi-entry, reminders
import './scripts/guests.js'        // Guest management, KYC documents
import './scripts/properties.js'    // Property management, iCal sync
import './scripts/home.js'          // Home screen stats, recent activity, greeting

// Auxiliary modules
import './scripts/navigation.js'      // View management, routing
import './scripts/notifications.js'   // Push notifications, browser notifications
import './scripts/pwa.js'             // PWA installation, service worker
import './scripts/sync.js'            // Online/offline sync
import './scripts/dashboard.js'       // Dashboard rendering, metrics, filters
import './scripts/analytics.js'       // Charts, reports, visualizations

// Premium Features - NEW!
import './scripts/command-palette.js'  // Command Palette (CMD+K)
import './scripts/quick-actions.js'    // Quick Actions menu + FAB
import './scripts/premium-features.js' // Theme Selector, Notifications, Calendar, Forecasting
import './scripts/premium-views.js'    // Kanban Board, Smart Search, Advanced Filters, Interactive Stats

// Import legacy JavaScript (remaining helper functions and utilities)
// REMOVED: All functionality has been successfully modularized
// import './scripts/legacy.js'

console.log('✅ ResIQ loaded successfully (100% modular version)')

// Initialize Premium Features
document.addEventListener('DOMContentLoaded', () => {
    // Initialize theme (dark/light mode)
    if (typeof window.initTheme === 'function') {
        window.initTheme()
    }

    // Initialize all premium features after a short delay
    setTimeout(() => {
        if (typeof window.initCommandPalette === 'function') {
            window.initCommandPalette()
        }
        if (typeof window.initQuickActions === 'function') {
            window.initQuickActions()
        }
        if (typeof window.initThemeSelector === 'function') {
            window.initThemeSelector()
        }
        if (typeof window.initNotificationCenter === 'function') {
            window.initNotificationCenter()
        }
        if (typeof window.initCalendarView === 'function') {
            window.initCalendarView()
        }
        if (typeof window.initRevenueForecasting === 'function') {
            window.initRevenueForecasting()
        }
        if (typeof window.initAdvancedFilters === 'function') {
            window.initAdvancedFilters()
        }
        if (typeof window.initSmartSearch === 'function') {
            window.initSmartSearch()
        }
    }, 500)

    console.log('✨ Premium features activated!')
    console.log('🎨 Color themes, 🔔 Notifications, 📅 Calendar, 📈 Forecasting ready!')
    console.log('🎯 Kanban Board, 🔍 Smart Search, ⚙️ Advanced Filters ready!')
})
