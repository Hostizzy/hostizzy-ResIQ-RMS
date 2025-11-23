/**
 * Authentication Module - Login, logout, session management
 */

import { db } from './database.js'
import { setCurrentUser } from './state.js'
import { showToast } from './ui.js'

// ============================================
// LOGIN
// ============================================

export async function login() {
    const email = document.getElementById('loginEmail').value.trim()
    const password = document.getElementById('loginPassword').value

    if (!email || !password) {
        showToast('Login Error', 'Please enter email and password', '❌')
        return
    }

    try {
        const users = await db.getTeamMembers()
        const user = users.find(u => u.email === email && u.password === password)

        if (user) {
            if (!user.is_active) {
                showToast('Account Inactive', 'Your account has been deactivated', '❌')
                return
            }

            // Set current user in state
            setCurrentUser(user)

            // Store in localStorage for persistence
            localStorage.setItem('currentUser', JSON.stringify(user))

            // Update UI
            document.getElementById('loginScreen').classList.add('hidden')
            document.getElementById('mainApp').classList.remove('hidden')

            // Update user email displays
            updateUserEmailDisplay(user.email)
            document.querySelector('.mobile-nav').classList.remove('hidden')
            document.getElementById('mobileHeader').classList.remove('hidden')
            document.getElementById('mobileUserEmail').textContent = user.email
            document.getElementById('sidebarUserEmail').textContent = user.email

            // Hide Performance view for staff
            if (user.role === 'staff') {
                hidePerformanceForStaff()
            }

            // Load initial data
            if (typeof window.loadDashboard === 'function') {
                await window.loadDashboard()
            }

            showToast('Welcome!', `Logged in as ${user.name}`, '👋')

            // Show appropriate view
            const lastView = localStorage.getItem('lastView') || 'home'
            if (typeof window.showView === 'function') {
                window.showView(lastView)
            }

            // Update home stats if needed
            if (lastView === 'home') {
                setTimeout(() => {
                    if (typeof window.updateHomeScreenStats === 'function') {
                        window.updateHomeScreenStats()
                    }
                }, 500)
            }
        } else {
            showToast('Login Failed', 'Invalid credentials', '❌')
        }
    } catch (error) {
        console.error('Login error:', error)
        showToast('Login Error', error.message, '❌')
    }
}

// ============================================
// LOGOUT
// ============================================

export function logout() {
    localStorage.removeItem('currentUser')
    setCurrentUser(null)

    document.getElementById('mainApp').classList.add('hidden')
    document.getElementById('loginScreen').classList.remove('hidden')

    showToast('Logged Out', 'See you soon!', '👋')
}

// ============================================
// SESSION MANAGEMENT
// ============================================

export function checkSession() {
    const userData = localStorage.getItem('currentUser')
    if (userData) {
        try {
            const user = JSON.parse(userData)
            setCurrentUser(user)
            return user
        } catch (error) {
            console.error('Session check error:', error)
            localStorage.removeItem('currentUser')
            return null
        }
    }
    return null
}

export function getCurrentUser() {
    const userData = localStorage.getItem('currentUser')
    if (userData) {
        try {
            return JSON.parse(userData)
        } catch (error) {
            return null
        }
    }
    return null
}

export function isLoggedIn() {
    return !!getCurrentUser()
}

export function hasRole(role) {
    const user = getCurrentUser()
    return user && user.role === role
}

export function hasAnyRole(roles) {
    const user = getCurrentUser()
    return user && roles.includes(user.role)
}

// ============================================
// UI HELPERS
// ============================================

export function hidePerformanceForStaff() {
    // Hide from desktop navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        if (link.textContent.includes('Performance') || link.onclick?.toString().includes('performance')) {
            link.style.display = 'none'
        }
    })

    // Hide from mobile navigation
    document.querySelectorAll('.mobile-nav-item').forEach(link => {
        if (link.textContent.includes('Performance') || link.onclick?.toString().includes('performance')) {
            link.style.display = 'none'
        }
    })

    // Hide from mobile sidebar
    document.querySelectorAll('.mobile-sidebar-link').forEach(link => {
        if (link.textContent.includes('Performance') || link.onclick?.toString().includes('performance')) {
            link.style.display = 'none'
        }
    })
}

export function updateUserEmailDisplay(email) {
    // Update user email in navbar
    const userEmailEl = document.getElementById('userEmail')
    if (userEmailEl) {
        userEmailEl.textContent = email
    }

    // Update in dropdown
    const dropdownEmailEl = document.querySelector('.user-dropdown .user-email')
    if (dropdownEmailEl) {
        dropdownEmailEl.textContent = email
    }
}

// Make available globally for legacy compatibility
if (typeof window !== 'undefined') {
    window.login = login
    window.logout = logout
    window.checkSession = checkSession
    window.getCurrentUser = getCurrentUser
    window.isLoggedIn = isLoggedIn
    window.hasRole = hasRole
    window.hasAnyRole = hasAnyRole
    window.hidePerformanceForStaff = hidePerformanceForStaff
    window.updateUserEmailDisplay = updateUserEmailDisplay
}
