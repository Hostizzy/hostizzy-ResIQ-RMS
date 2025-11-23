/**
 * UI Utilities - Toasts, Loading, Modals
 */

// Toast Notifications
export function showToast(title, message = '', icon = '✅') {
    const toastEl = document.getElementById('toast')
    const toastTitle = document.getElementById('toastTitle')
    const toastMessage = document.getElementById('toastMessage')

    if (!toastEl) return

    toastTitle.textContent = `${icon} ${title}`
    toastMessage.textContent = message

    toastEl.classList.add('show')

    setTimeout(() => {
        toastEl.classList.remove('show')
    }, 3000)
}

// Loading Overlay
export function showLoading(message = 'Loading...') {
    const loadingOverlay = document.getElementById('loadingOverlay')
    const loadingMessage = document.getElementById('loadingMessage')

    if (!loadingOverlay) return

    if (loadingMessage) {
        loadingMessage.textContent = message
    }

    loadingOverlay.style.display = 'flex'
}

export function hideLoading() {
    const loadingOverlay = document.getElementById('loadingOverlay')
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none'
    }
}

// Sync Status Management
export function updateSyncStatus(status, message = '') {
    const badge = document.getElementById('syncStatusBadge')
    const text = document.getElementById('syncStatusText')

    if (!badge || !text) return

    badge.className = 'sync-badge'

    if (status === 'synced') {
        badge.classList.add('synced')
        text.textContent = 'All changes saved'
    } else if (status === 'syncing') {
        badge.classList.add('syncing')
        text.textContent = 'Syncing...'
    } else if (status === 'offline') {
        badge.classList.add('offline')
        text.textContent = 'Offline mode'
    } else if (status === 'pending') {
        badge.classList.add('pending')
        text.textContent = message || 'Pending changes'
    }
}

// Show/Hide Elements
export function showElement(elementId) {
    const el = document.getElementById(elementId)
    if (el) el.style.display = 'block'
}

export function hideElement(elementId) {
    const el = document.getElementById(elementId)
    if (el) el.style.display = 'none'
}

export function toggleElement(elementId) {
    const el = document.getElementById(elementId)
    if (el) {
        el.style.display = el.style.display === 'none' ? 'block' : 'none'
    }
}

// Confirm Dialog
export function confirmAction(message) {
    return confirm(message)
}

// Scroll to Top
export function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' })
}

// Disable/Enable Button
export function disableButton(buttonId) {
    const btn = document.getElementById(buttonId)
    if (btn) {
        btn.disabled = true
        btn.style.opacity = '0.5'
        btn.style.cursor = 'not-allowed'
    }
}

export function enableButton(buttonId) {
    const btn = document.getElementById(buttonId)
    if (btn) {
        btn.disabled = false
        btn.style.opacity = '1'
        btn.style.cursor = 'pointer'
    }
}

// Update Element Text
export function updateText(elementId, text) {
    const el = document.getElementById(elementId)
    if (el) el.textContent = text
}

// Update Element HTML
export function updateHTML(elementId, html) {
    const el = document.getElementById(elementId)
    if (el) el.innerHTML = html
}

// Add Class
export function addClass(elementId, className) {
    const el = document.getElementById(elementId)
    if (el) el.classList.add(className)
}

// Remove Class
export function removeClass(elementId, className) {
    const el = document.getElementById(elementId)
    if (el) el.classList.remove(className)
}

// Toggle Class
export function toggleClass(elementId, className) {
    const el = document.getElementById(elementId)
    if (el) el.classList.toggle(className)
}

// Focus Element
export function focusElement(elementId) {
    const el = document.getElementById(elementId)
    if (el) {
        el.focus()
        if (el.select) el.select()
    }
}

// Clear Input
export function clearInput(inputId) {
    const input = document.getElementById(inputId)
    if (input) input.value = ''
}

// Set Input Value
export function setInputValue(inputId, value) {
    const input = document.getElementById(inputId)
    if (input) input.value = value
}

// Get Input Value
export function getInputValue(inputId) {
    const input = document.getElementById(inputId)
    return input ? input.value : ''
}

// Make UI utilities available globally
if (typeof window !== 'undefined') {
    window.showToast = showToast
    window.showLoading = showLoading
    window.hideLoading = hideLoading
    window.updateSyncStatus = updateSyncStatus
    window.showElement = showElement
    window.hideElement = hideElement
    window.toggleElement = toggleElement
    window.confirmAction = confirmAction
    window.scrollToTop = scrollToTop
    window.disableButton = disableButton
    window.enableButton = enableButton
    window.updateText = updateText
    window.updateHTML = updateHTML
}
