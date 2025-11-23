/**
 * E2E Tests for Authentication
 * Tests login, logout, and session management
 */

import { test, expect } from '@playwright/test'

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should show login screen on initial load', async ({ page }) => {
    // Check if login view is visible
    await expect(page.locator('#loginView')).toBeVisible()

    // Check for email and password fields
    await expect(page.locator('#loginEmail')).toBeVisible()
    await expect(page.locator('#loginPassword')).toBeVisible()

    // Check for login button
    await expect(page.locator('button:has-text("Login")')).toBeVisible()
  })

  test('should show error for invalid credentials', async ({ page }) => {
    // Fill in invalid credentials
    await page.fill('#loginEmail', 'invalid@example.com')
    await page.fill('#loginPassword', 'wrongpassword')

    // Click login button
    await page.click('button:has-text("Login")')

    // Wait for error toast
    await expect(page.locator('.toast')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('.toast')).toContainText('error', { timeout: 5000 })
  })

  test('should validate email format', async ({ page }) => {
    // Fill in invalid email
    await page.fill('#loginEmail', 'not-an-email')
    await page.fill('#loginPassword', 'password123')

    // Click login button
    await page.click('button:has-text("Login")')

    // Should show validation error or not proceed
    // This depends on your validation implementation
  })

  test('should require password', async ({ page }) => {
    // Fill in email only
    await page.fill('#loginEmail', 'test@example.com')

    // Click login button
    await page.click('button:has-text("Login")')

    // Should show validation error or not proceed
  })

  test.skip('should login with valid credentials and navigate to dashboard', async ({ page }) => {
    // Note: This test requires actual test credentials
    // Skip by default to avoid authentication issues

    const testEmail = process.env.TEST_EMAIL || 'test@hostizzy.com'
    const testPassword = process.env.TEST_PASSWORD || 'testpassword'

    // Fill in valid credentials
    await page.fill('#loginEmail', testEmail)
    await page.fill('#loginPassword', testPassword)

    // Click login button
    await page.click('button:has-text("Login")')

    // Wait for successful login
    await expect(page.locator('#loginView')).toBeHidden({ timeout: 10000 })

    // Should navigate to home or dashboard
    await expect(page.locator('#homeView, #dashboardView')).toBeVisible({ timeout: 10000 })

    // Check if user is logged in (sidebar should be visible)
    await expect(page.locator('.sidebar')).toBeVisible()
  })

  test.skip('should logout successfully', async ({ page }) => {
    // Note: This test requires being logged in first
    // Skip by default

    // Assume user is logged in
    // Click logout button (adjust selector as needed)
    await page.click('button:has-text("Logout")')

    // Wait for logout to complete
    await expect(page.locator('#loginView')).toBeVisible({ timeout: 10000 })

    // Sidebar should be hidden
    await expect(page.locator('.sidebar')).toBeHidden()
  })
})
