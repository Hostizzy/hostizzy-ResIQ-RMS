/**
 * Unit Tests for utils.js
 * Tests for utility functions and formatters
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  formatCurrency,
  formatDate,
  formatDateShort,
  calculateNights,
  generateBookingId,
  isValidEmail,
  isValidPhone,
  debounce,
  exportToCSV
} from '../utils.js'

// Mock window and DOM APIs
global.window = {
  document: {
    createElement: vi.fn(() => ({
      click: vi.fn(),
      style: {}
    })),
    body: {
      appendChild: vi.fn(),
      removeChild: vi.fn()
    }
  },
  URL: {
    createObjectURL: vi.fn(() => 'blob:mock-url')
  }
}

describe('Utils Module', () => {
  describe('formatCurrency', () => {
    it('should format amounts in compact mode by default', () => {
      expect(formatCurrency(1000)).toBe('₹1.0K')
      expect(formatCurrency(10000)).toBe('₹10.0K')
      expect(formatCurrency(100000)).toBe('₹1.0L')
      expect(formatCurrency(10000000)).toBe('₹1.0Cr')
    })

    it('should format amounts in full mode when compact is false', () => {
      expect(formatCurrency(1000, {compact: false})).toBe('₹1,000')
      expect(formatCurrency(10000, {compact: false})).toBe('₹10,000')
      expect(formatCurrency(100000, {compact: false})).toBe('₹1,00,000')
    })

    it('should handle decimal amounts', () => {
      expect(formatCurrency(1234.56)).toBe('₹1.2K')
      expect(formatCurrency(99999.99)).toBe('₹100.0K')
    })

    it('should handle zero and small amounts', () => {
      expect(formatCurrency(0)).toBe('₹0')
      expect(formatCurrency(500)).toBe('₹500')
      expect(formatCurrency(999)).toBe('₹999')
    })

    it('should handle negative amounts', () => {
      expect(formatCurrency(-1000)).toBe('₹-1.0K')
      expect(formatCurrency(-100000, {compact: false})).toBe('₹-1,00,000')
    })
  })

  describe('calculateNights', () => {
    it('should calculate nights between two dates', () => {
      expect(calculateNights('2025-01-01', '2025-01-02')).toBe(1)
      expect(calculateNights('2025-01-01', '2025-01-05')).toBe(4)
      expect(calculateNights('2025-01-01', '2025-01-01')).toBe(0)
    })

    it('should handle different date ranges', () => {
      expect(calculateNights('2025-01-01', '2025-01-31')).toBe(30)
      expect(calculateNights('2025-01-15', '2025-02-15')).toBe(31)
    })
  })

  describe('formatDate', () => {
    it('should format date strings', () => {
      const result = formatDate('2025-01-15')
      expect(result).toBeTruthy()
      expect(typeof result).toBe('string')
    })

    it('should handle different date formats', () => {
      expect(formatDate('2025-01-01')).toBeTruthy()
      expect(formatDate('2025-12-31')).toBeTruthy()
    })
  })

  describe('formatDateShort', () => {
    it('should format date in short format', () => {
      const result = formatDateShort('2025-01-15')
      expect(result).toBeTruthy()
      expect(typeof result).toBe('string')
      // Short format should be shorter than full format
      expect(result.length).toBeLessThan(formatDate('2025-01-15').length)
    })
  })

  describe('generateBookingId', () => {
    it('should generate unique booking IDs', () => {
      const id1 = generateBookingId()
      const id2 = generateBookingId()

      expect(id1).toBeTruthy()
      expect(id2).toBeTruthy()
      expect(id1).not.toBe(id2)
    })

    it('should generate IDs with correct format', () => {
      const id = generateBookingId()

      // Should start with HST and year
      expect(id).toMatch(/^HST\d{2}/)
      expect(id.length).toBeGreaterThan(8)
    })

    it('should generate multiple unique IDs', () => {
      const ids = new Set()
      for (let i = 0; i < 10; i++) {
        ids.add(generateBookingId())
      }
      // All IDs should be unique
      expect(ids.size).toBe(10)
    })
  })

  describe('isValidEmail', () => {
    it('should validate correct email addresses', () => {
      expect(isValidEmail('test@example.com')).toBe(true)
      expect(isValidEmail('user.name@company.co.in')).toBe(true)
      expect(isValidEmail('admin+tag@hostizzy.com')).toBe(true)
      expect(isValidEmail('john.doe@example.org')).toBe(true)
    })

    it('should reject invalid email addresses', () => {
      expect(isValidEmail('invalid')).toBe(false)
      expect(isValidEmail('test@')).toBe(false)
      expect(isValidEmail('@example.com')).toBe(false)
      expect(isValidEmail('test @example.com')).toBe(false)
      expect(isValidEmail('')).toBe(false)
      expect(isValidEmail('test')).toBe(false)
    })
  })

  describe('isValidPhone', () => {
    it('should validate 10-digit Indian phone numbers', () => {
      expect(isValidPhone('9876543210')).toBe(true)
      expect(isValidPhone('8765432109')).toBe(true)
      expect(isValidPhone('7654321098')).toBe(true)
      expect(isValidPhone('6543210987')).toBe(true)
    })

    it('should validate phone numbers with non-digit characters', () => {
      expect(isValidPhone('98765-43210')).toBe(true)
      expect(isValidPhone('98765 43210')).toBe(true)
      expect(isValidPhone('(987) 654-3210')).toBe(true)
    })

    it('should reject invalid phone numbers', () => {
      expect(isValidPhone('123')).toBe(false)
      expect(isValidPhone('abcdefghij')).toBe(false)
      expect(isValidPhone('')).toBe(false)
      expect(isValidPhone('12345')).toBe(false)
      expect(isValidPhone('5876543210')).toBe(false) // Starts with 5 (invalid)
      expect(isValidPhone('+919876543210')).toBe(false) // 11 digits after removing non-digits
    })
  })

  describe('debounce', () => {
    it('should debounce function calls', async () => {
      let callCount = 0
      const fn = () => callCount++
      const debouncedFn = debounce(fn, 100)

      // Call multiple times rapidly
      debouncedFn()
      debouncedFn()
      debouncedFn()

      // Should not have called yet
      expect(callCount).toBe(0)

      // Wait for debounce delay
      await new Promise(resolve => setTimeout(resolve, 150))

      // Should have called only once
      expect(callCount).toBe(1)
    })

    it('should reset timer on subsequent calls', async () => {
      let callCount = 0
      const fn = () => callCount++
      const debouncedFn = debounce(fn, 100)

      debouncedFn()

      // Call again after 50ms (before first would fire)
      await new Promise(resolve => setTimeout(resolve, 50))
      debouncedFn()

      // Wait another 60ms (total 110ms from second call)
      await new Promise(resolve => setTimeout(resolve, 60))

      // Should have called only once (timer was reset)
      expect(callCount).toBe(0)

      // Wait for the full delay from the last call
      await new Promise(resolve => setTimeout(resolve, 50))
      expect(callCount).toBe(1)
    })
  })

  describe('exportToCSV', () => {
    it('should not throw when exporting data', () => {
      const data = [
        { name: 'John', age: 30, city: 'Mumbai' },
        { name: 'Jane', age: 25, city: 'Delhi' }
      ]

      const headers = ['name', 'age', 'city']
      const filename = 'test.csv'

      // Should not throw
      expect(() => exportToCSV(data, headers, filename)).not.toThrow()
    })

    it('should handle empty data', () => {
      expect(() => exportToCSV([], [], 'empty.csv')).not.toThrow()
    })
  })
})
