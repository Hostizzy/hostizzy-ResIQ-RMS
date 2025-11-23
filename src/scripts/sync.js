/**
 * Sync Module
 * Handles online/offline synchronization and network status management
 */

import { db } from './database.js'
import { showToast, updateSyncStatus } from './ui.js'

// ==========================================
// NETWORK STATUS
// ==========================================

let isOnline = navigator.onLine

/**
 * Initialize network listeners
 */
export function initializeNetworkListeners() {
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Set initial status
    updateSyncStatus(isOnline ? 'online' : 'offline')

    console.log('✅ Network listeners initialized')
}

/**
 * Handle online event
 */
async function handleOnline() {
    isOnline = true
    console.log('✅ Network connection restored')
    updateSyncStatus('online')
    showToast('Back Online', 'Syncing data...', '✅')

    // Sync pending data
    await syncAllPendingData()
}

/**
 * Handle offline event
 */
function handleOffline() {
    isOnline = false
    console.log('⚠️ Network connection lost')
    updateSyncStatus('offline')
    showToast('Offline Mode', 'Changes will sync when online', '⚠️')
}

/**
 * Check if online
 */
export function checkOnlineStatus() {
    return navigator.onLine
}

// ==========================================
// DATA SYNCHRONIZATION
// ==========================================

/**
 * Sync all pending data to server
 */
export async function syncAllPendingData() {
    if (!navigator.onLine) {
        console.log('[Sync] Offline - skipping sync')
        return
    }

    try {
        updateSyncStatus('syncing')
        console.log('[Sync] Starting sync...')

        // Sync pending reservations
        if (typeof db.syncPendingReservations === 'function') {
            await db.syncPendingReservations()
        }

        // Sync pending payments
        if (typeof db.syncPendingPayments === 'function') {
            await db.syncPendingPayments()
        }

        // Sync pending guest documents
        if (typeof db.syncPendingDocuments === 'function') {
            await db.syncPendingDocuments()
        }

        updateSyncStatus('online')
        console.log('[Sync] Sync completed')

    } catch (error) {
        console.error('[Sync] Sync failed:', error)
        updateSyncStatus('error')
        showToast('Sync Error', 'Failed to sync some data', '❌')
    }
}

/**
 * Force sync now
 */
export async function forceSyncNow() {
    showToast('Syncing', 'Synchronizing data...', '🔄')
    await syncAllPendingData()
    showToast('Sync Complete', 'All data synced successfully', '✅')
}

/**
 * Get pending sync count
 */
export async function getPendingSyncCount() {
    try {
        const pendingReservations = await db.getPendingReservations?.() || []
        const pendingPayments = await db.getPendingPayments?.() || []
        const pendingDocuments = await db.getPendingDocuments?.() || []

        return {
            reservations: pendingReservations.length,
            payments: pendingPayments.length,
            documents: pendingDocuments.length,
            total: pendingReservations.length + pendingPayments.length + pendingDocuments.length
        }
    } catch (error) {
        console.error('[Sync] Error getting pending count:', error)
        return { reservations: 0, payments: 0, documents: 0, total: 0 }
    }
}

/**
 * Auto-sync interval
 */
let syncInterval = null

/**
 * Start auto-sync
 */
export function startAutoSync(intervalMinutes = 5) {
    if (syncInterval) {
        stopAutoSync()
    }

    syncInterval = setInterval(() => {
        if (navigator.onLine) {
            console.log('[Sync] Auto-sync triggered')
            syncAllPendingData()
        }
    }, intervalMinutes * 60 * 1000)

    console.log(`✅ Auto-sync started (every ${intervalMinutes} minutes)`)
}

/**
 * Stop auto-sync
 */
export function stopAutoSync() {
    if (syncInterval) {
        clearInterval(syncInterval)
        syncInterval = null
        console.log('⏹️ Auto-sync stopped')
    }
}

// ==========================================
// GLOBAL EXPORTS FOR LEGACY COMPATIBILITY
// ==========================================

if (typeof window !== 'undefined') {
    window.initializeNetworkListeners = initializeNetworkListeners
    window.handleOnline = handleOnline
    window.handleOffline = handleOffline
    window.checkOnlineStatus = checkOnlineStatus
    window.syncAllPendingData = syncAllPendingData
    window.forceSyncNow = forceSyncNow
    window.getPendingSyncCount = getPendingSyncCount
    window.startAutoSync = startAutoSync
    window.stopAutoSync = stopAutoSync
}

console.log('✅ Sync module loaded')
