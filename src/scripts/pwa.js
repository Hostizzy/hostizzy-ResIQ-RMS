/**
 * PWA Module
 * Handles Progressive Web App installation and service worker management
 */

import { showToast } from './ui.js'

// Global variable to store deferred prompt
let deferredPrompt = null

// ==========================================
// PWA INSTALLATION
// ==========================================

/**
 * Initialize PWA install prompt
 */
export function initializePWA() {
    // Listen for beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (e) => {
        console.log('💡 PWA install prompt ready')
        console.log('Event:', e)

        // Prevent the mini-infobar from appearing
        e.preventDefault()
        deferredPrompt = e

        // Show install bar if available
        const installBar = document.getElementById('installBar')
        if (installBar) {
            installBar.style.display = 'flex'
        }
    })

    // Log PWA installation criteria
    console.log('PWA Check:', {
        isHTTPS: window.location.protocol === 'https:' || window.location.hostname === 'localhost',
        hasServiceWorker: 'serviceWorker' in navigator,
        hasManifest: document.querySelector('link[rel="manifest"]') !== null
    })

    // Handle install button click
    const installBtn = document.getElementById('installBtn')
    if (installBtn) {
        installBtn.addEventListener('click', installPWA)
    }

    // Handle successful installation
    window.addEventListener('appinstalled', () => {
        console.log('🎉 PWA installed successfully')
        deferredPrompt = null

        // Hide install bar
        const installBar = document.getElementById('installBar')
        if (installBar) {
            installBar.style.display = 'none'
        }

        showToast('Success', 'ResIQ installed! Open from your home screen.', '🎉')
    })

    console.log('✅ PWA initialization complete')
}

/**
 * Install PWA
 */
export async function installPWA() {
    if (!deferredPrompt) {
        console.log('No deferred prompt available')
        showToast('Already Installed', 'App is already installed', 'ℹ️')
        return
    }

    // Show the install prompt
    deferredPrompt.prompt()

    // Wait for the user's response
    const { outcome } = await deferredPrompt.userChoice
    console.log(`PWA install: ${outcome}`)

    // Clear the deferred prompt
    deferredPrompt = null

    // Hide the install bar
    const installBar = document.getElementById('installBar')
    if (installBar) {
        installBar.style.display = 'none'
    }

    if (outcome === 'accepted') {
        showToast('Success', 'App installed successfully!', '🎉')
    }
}

/**
 * Check if app is installed
 */
export function isPWAInstalled() {
    // Check if running in standalone mode
    if (window.matchMedia('(display-mode: standalone)').matches) {
        return true
    }

    // Check for iOS standalone
    if (window.navigator.standalone === true) {
        return true
    }

    return false
}

/**
 * Hide install bar
 */
export function hideInstallBar() {
    const installBar = document.getElementById('installBar')
    if (installBar) {
        installBar.style.display = 'none'
    }
    deferredPrompt = null
}

// ==========================================
// SERVICE WORKER REGISTRATION
// ==========================================

/**
 * Register service worker
 */
export async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
        console.log('Service workers not supported')
        return false
    }

    try {
        const registration = await navigator.serviceWorker.register('/service-worker.js')
        console.log('✅ Service worker registered:', registration.scope)

        // Listen for updates
        registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing
            console.log('🔄 Service worker update found')

            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    console.log('✅ New service worker installed, refresh to update')
                    showToast('Update Available', 'Refresh to get the latest version', '🔄')
                }
            })
        })

        return registration
    } catch (error) {
        console.error('Service worker registration failed:', error)
        return false
    }
}

/**
 * Unregister service worker
 */
export async function unregisterServiceWorker() {
    if (!('serviceWorker' in navigator)) return

    try {
        const registration = await navigator.serviceWorker.getRegistration()
        if (registration) {
            await registration.unregister()
            console.log('✅ Service worker unregistered')
            showToast('Service Worker Removed', 'App will no longer work offline', 'ℹ️')
        }
    } catch (error) {
        console.error('Failed to unregister service worker:', error)
    }
}

/**
 * Check service worker status
 */
export async function getServiceWorkerStatus() {
    if (!('serviceWorker' in navigator)) {
        return { supported: false, registered: false }
    }

    try {
        const registration = await navigator.serviceWorker.getRegistration()
        return {
            supported: true,
            registered: !!registration,
            scope: registration?.scope,
            active: !!registration?.active
        }
    } catch (error) {
        return { supported: true, registered: false, error: error.message }
    }
}

// ==========================================
// BACKGROUND SYNC
// ==========================================

/**
 * Register background sync
 */
export async function registerBackgroundSync(tag = 'resiq-sync-all') {
    if (!('serviceWorker' in navigator) || !('SyncManager' in window)) {
        console.log('[Sync] Background sync not supported')
        return false
    }

    try {
        const registration = await navigator.serviceWorker.ready
        await registration.sync.register(tag)
        console.log('[Sync] Background sync registered:', tag)
        return true
    } catch (error) {
        console.error('[Sync] Background sync registration failed:', error)
        return false
    }
}

// ==========================================
// GLOBAL EXPORTS FOR LEGACY COMPATIBILITY
// ==========================================

if (typeof window !== 'undefined') {
    window.deferredPrompt = deferredPrompt
    window.initializePWA = initializePWA
    window.installPWA = installPWA
    window.isPWAInstalled = isPWAInstalled
    window.hideInstallBar = hideInstallBar
    window.registerServiceWorker = registerServiceWorker
    window.unregisterServiceWorker = unregisterServiceWorker
    window.getServiceWorkerStatus = getServiceWorkerStatus
    window.registerBackgroundSync = registerBackgroundSync
}

console.log('✅ PWA module loaded')
