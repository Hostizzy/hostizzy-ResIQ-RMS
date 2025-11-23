/**
 * E2E Tests for Navigation
 * Tests view switching and routing
 */

import { test, expect } from '@playwright/test'

test.describe('Navigation', () => {
  test.skip('should navigate between views', async ({ page }) => {
    // Note: Requires login first
    await page.goto('/')

    // Assuming user is logged in, check navigation
    await page.click('a[href="#home"]')
    await expect(page.locator('#homeView')).toBeVisible()

    await page.click('a[href="#dashboard"]')
    await expect(page.locator('#dashboardView')).toBeVisible()

    await page.click('a[href="#reservations"]')
    await expect(page.locator('#reservationsView')).toBeVisible()

    await page.click('a[href="#payments"]')
    await expect(page.locator('#paymentsView')).toBeVisible()
  })

  test.skip('should support keyboard shortcuts', async ({ page }) => {
    // Note: Requires login first
    await page.goto('/')

    // Alt + 1 for Home
    await page.keyboard.press('Alt+1')
    await expect(page.locator('#homeView')).toBeVisible()

    // Alt + 2 for Dashboard
    await page.keyboard.press('Alt+2')
    await expect(page.locator('#dashboardView')).toBeVisible()

    // Alt + 3 for Reservations
    await page.keyboard.press('Alt+3')
    await expect(page.locator('#reservationsView')).toBeVisible()
  })

  test.skip('should toggle sidebar on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')

    // Click hamburger menu
    await page.click('.menu-toggle')

    // Sidebar should be visible
    await expect(page.locator('.sidebar')).toBeVisible()

    // Click again to close
    await page.click('.menu-toggle')

    // Sidebar should be hidden
    await expect(page.locator('.sidebar')).toBeHidden()
  })
})
