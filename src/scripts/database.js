/**
 * Database Module - Supabase and IndexedDB operations
 */

import { supabase } from './config.js'
import { DB_NAME, DB_VERSION } from './config.js'

// IndexedDB instance
let offlineDB = null

// ============================================
// INDEXEDDB OPERATIONS (Offline Support)
// ============================================

export async function initOfflineDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION)

        request.onerror = () => reject(request.error)

        request.onsuccess = () => {
            offlineDB = request.result
            console.log('IndexedDB initialized')
            resolve(offlineDB)
        }

        request.onupgradeneeded = (event) => {
            const db = event.target.result

            if (!db.objectStoreNames.contains('pendingReservations')) {
                const reservationStore = db.createObjectStore('pendingReservations', { keyPath: 'tempId' })
                reservationStore.createIndex('timestamp', 'timestamp', { unique: false })
                reservationStore.createIndex('syncStatus', 'syncStatus', { unique: false })
            }

            if (!db.objectStoreNames.contains('pendingPayments')) {
                const paymentStore = db.createObjectStore('pendingPayments', { keyPath: 'tempId' })
                paymentStore.createIndex('timestamp', 'timestamp', { unique: false })
                paymentStore.createIndex('syncStatus', 'syncStatus', { unique: false })
            }

            if (!db.objectStoreNames.contains('pendingEdits')) {
                const editStore = db.createObjectStore('pendingEdits', { keyPath: 'tempId' })
                editStore.createIndex('timestamp', 'timestamp', { unique: false })
                editStore.createIndex('syncStatus', 'syncStatus', { unique: false })
            }
        }
    })
}

export async function saveToOfflineDB(storeName, data) {
    if (!offlineDB) await initOfflineDB()

    return new Promise((resolve, reject) => {
        const transaction = offlineDB.transaction([storeName], 'readwrite')
        const store = transaction.objectStore(storeName)

        const item = {
            ...data,
            tempId: 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            timestamp: Date.now(),
            syncStatus: 'pending'
        }

        const request = store.add(item)
        request.onsuccess = () => resolve(item)
        request.onerror = () => reject(request.error)
    })
}

export async function getAllFromOfflineDB(storeName, status = null) {
    if (!offlineDB) await initOfflineDB()

    return new Promise((resolve, reject) => {
        const transaction = offlineDB.transaction([storeName], 'readonly')
        const store = transaction.objectStore(storeName)
        const request = store.getAll()

        request.onsuccess = () => {
            const allItems = request.result
            if (status) {
                resolve(allItems.filter(item => item.syncStatus === status))
            } else {
                resolve(allItems)
            }
        }
        request.onerror = () => reject(request.error)
    })
}

export async function deleteFromOfflineDB(storeName, tempId) {
    if (!offlineDB) await initOfflineDB()

    return new Promise((resolve, reject) => {
        const transaction = offlineDB.transaction([storeName], 'readwrite')
        const store = transaction.objectStore(storeName)
        const request = store.delete(tempId)

        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
    })
}

// ============================================
// SUPABASE DATABASE OPERATIONS
// ============================================

export const db = {
    // Team Members
    async getTeamMembers() {
        const { data, error } = await supabase.from('team_members').select('*')
        if (error) throw error
        return data || []
    },

    async saveTeamMember(member) {
        if (member.id) {
            const { data, error } = await supabase.from('team_members').update(member).eq('id', member.id).select()
            if (error) throw error
            return data?.[0]
        } else {
            const { data, error } = await supabase.from('team_members').insert([member]).select()
            if (error) throw error
            return data?.[0]
        }
    },

    async deleteTeamMember(id) {
        const { error } = await supabase.from('team_members').delete().eq('id', id)
        if (error) throw error
    },

    // Properties
    async getProperties() {
        const { data, error } = await supabase.from('properties').select('*').order('name')
        if (error) throw error
        return data || []
    },

    async saveProperty(property) {
        if (property.id) {
            const { data, error } = await supabase.from('properties').update(property).eq('id', property.id).select()
            if (error) throw error
            return data?.[0]
        } else {
            const { data, error } = await supabase.from('properties').insert([property]).select()
            if (error) throw error
            return data?.[0]
        }
    },

    async deleteProperty(id) {
        const { error } = await supabase.from('properties').delete().eq('id', id)
        if (error) throw error
    },

    async getRevenueSharePercent(propertyId) {
        const { data, error } = await supabase
            .from('properties')
            .select('revenue_share_percent')
            .eq('id', propertyId)
            .single()
        return data?.revenue_share_percent || 20 // Default 20% if not set
    },

    // Reservations
    async getReservations() {
        const { data, error } = await supabase.from('reservations').select('*').order('check_in', { ascending: false })
        if (error) throw error
        return data || []
    },

    async getReservation(bookingId) {
        const { data, error } = await supabase.from('reservations').select('*').eq('booking_id', bookingId).single()
        if (error) throw error
        return data
    },

    async saveReservation(reservation) {
        if (reservation.id) {
            const { data, error } = await supabase
                .from('reservations')
                .update(reservation)
                .eq('id', reservation.id)
                .select()
            if (error) {
                console.error('Update error:', error)
                throw error
            }
            return data?.[0]
        } else {
            const { id, ...cleanReservation } = reservation
            const { data, error } = await supabase
                .from('reservations')
                .insert([cleanReservation])
                .select()
            if (error) {
                console.error('Insert error:', error)
                throw error
            }
            return data?.[0]
        }
    },

    async deleteReservation(bookingId) {
        const { error } = await supabase.from('reservations').delete().eq('booking_id', bookingId)
        if (error) throw error
    },

    async bulkUpdateReservations(bookingIds, updates) {
        const { error } = await supabase
            .from('reservations')
            .update(updates)
            .in('booking_id', bookingIds)
        if (error) throw error
    },

    // Payments
    async getPayments(bookingId) {
        const { data, error } = await supabase
            .from('payments')
            .select('*')
            .eq('booking_id', bookingId)
            .order('payment_date', { ascending: false })
        if (error) throw error
        return data || []
    },

    async getAllPayments() {
        const { data, error } = await supabase
            .from('payments')
            .select('*')
            .order('payment_date', { ascending: false })
        if (error) throw error
        return data || []
    },

    async savePayment(payment) {
        const { data, error } = await supabase
            .from('payments')
            .insert([payment])
            .select()
        if (error) throw error
        return data?.[0]
    },

    async updatePayment(id, payment) {
        const { data, error} = await supabase
            .from('payments')
            .update(payment)
            .eq('id', id)
            .select()
        if (error) throw error
        return data?.[0]
    },

    async deletePayment(id) {
        const { error } = await supabase.from('payments').delete().eq('id', id)
        if (error) throw error
    }
}

// Make available globally for legacy compatibility
if (typeof window !== 'undefined') {
    window.db = db
    window.initOfflineDB = initOfflineDB
    window.saveToOfflineDB = saveToOfflineDB
    window.getAllFromOfflineDB = getAllFromOfflineDB
    window.deleteFromOfflineDB = deleteFromOfflineDB
}
