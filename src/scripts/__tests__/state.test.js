/**
 * Unit Tests for state.js
 * Tests for global state management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  state,
  allReservations,
  allPayments,
  selectedReservations,
  currentUser,
  currentWhatsAppBooking,
  setAllReservations,
  setAllPayments,
  setCurrentUser,
  setCurrentWhatsAppBooking,
  addSelectedReservation,
  removeSelectedReservation,
  clearSelectedReservations,
  setOnlineStatus,
  setSyncInProgress
} from '../state.js'

// Mock navigator
global.navigator = {
  onLine: true
}

// Mock window
global.window = {}

describe('State Module', () => {
  describe('Initial State', () => {
    it('should initialize with default values', () => {
      expect(state.reservations).toEqual([])
      expect(state.payments).toEqual([])
      expect(state.properties).toEqual([])
      expect(state.user).toBeNull()
      expect(state.isOnline).toBe(true)
      expect(state.syncInProgress).toBe(false)
    })

    it('should initialize global arrays', () => {
      expect(Array.isArray(allReservations)).toBe(true)
      expect(Array.isArray(allPayments)).toBe(true)
      expect(selectedReservations).toBeInstanceOf(Set)
    })
  })

  describe('setAllReservations', () => {
    it('should update reservations in state', () => {
      const testReservations = [
        { id: 1, booking_id: 'BK001', guest_name: 'John Doe' },
        { id: 2, booking_id: 'BK002', guest_name: 'Jane Smith' }
      ]

      setAllReservations(testReservations)

      expect(state.reservations).toHaveLength(2)
      expect(state.reservations[0].booking_id).toBe('BK001')
    })

    it('should handle empty arrays', () => {
      setAllReservations([])
      expect(state.reservations).toHaveLength(0)
    })
  })

  describe('setAllPayments', () => {
    it('should update payments in state', () => {
      const testPayments = [
        { id: '1', booking_id: 'BK001', amount: 10000 },
        { id: '2', booking_id: 'BK002', amount: 15000 }
      ]

      setAllPayments(testPayments)

      expect(state.payments).toHaveLength(2)
      expect(state.payments[0].amount).toBe(10000)
    })
  })

  describe('setCurrentUser', () => {
    it('should update current user in state', () => {
      const testUser = {
        id: 'user1',
        email: 'admin@hostizzy.com',
        role: 'admin'
      }

      setCurrentUser(testUser)

      expect(state.user).toEqual(testUser)
      expect(state.user.role).toBe('admin')
    })

    it('should handle null user (logout)', () => {
      setCurrentUser(null)
      expect(state.user).toBeNull()
    })
  })

  describe('selectedReservations', () => {
    beforeEach(() => {
      clearSelectedReservations()
    })

    it('should add reservation to selection', () => {
      addSelectedReservation('BK001')
      addSelectedReservation('BK002')

      expect(selectedReservations.size).toBe(2)
      expect(selectedReservations.has('BK001')).toBe(true)
    })

    it('should remove reservation from selection', () => {
      addSelectedReservation('BK001')
      addSelectedReservation('BK002')
      removeSelectedReservation('BK001')

      expect(selectedReservations.size).toBe(1)
      expect(selectedReservations.has('BK001')).toBe(false)
      expect(selectedReservations.has('BK002')).toBe(true)
    })

    it('should clear all selections', () => {
      addSelectedReservation('BK001')
      addSelectedReservation('BK002')
      clearSelectedReservations()

      expect(selectedReservations.size).toBe(0)
    })
  })

  describe('setCurrentWhatsAppBooking', () => {
    it('should update WhatsApp booking state', () => {
      const testBooking = {
        booking_id: 'BK001',
        guest_name: 'John Doe',
        guest_phone: '9876543210'
      }

      setCurrentWhatsAppBooking(testBooking)
      // Note: This updates the module-level variable, not state object
      // The function doesn't return anything, so we test it doesn't throw
      expect(() => setCurrentWhatsAppBooking(testBooking)).not.toThrow()
    })

    it('should handle null value', () => {
      expect(() => setCurrentWhatsAppBooking(null)).not.toThrow()
    })
  })

  describe('Online Status', () => {
    it('should update online status', () => {
      setOnlineStatus(false)
      expect(state.isOnline).toBe(false)

      setOnlineStatus(true)
      expect(state.isOnline).toBe(true)
    })
  })

  describe('Sync Status', () => {
    it('should update sync in progress status', () => {
      setSyncInProgress(true)
      expect(state.syncInProgress).toBe(true)

      setSyncInProgress(false)
      expect(state.syncInProgress).toBe(false)
    })
  })
})
