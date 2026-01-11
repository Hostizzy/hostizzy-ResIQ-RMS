/**
 * Onboarding Flow Manager
 * First-time user experience
 * Version: 1.0.0
 */

// Onboarding state
const onboardingState = {
    currentSlide: 0,
    totalSlides: 0,
    hasSeenOnboarding: false
};

// Onboarding slides configuration
const onboardingSlides = [
    {
        id: 'welcome',
        type: 'welcome',
        icon: 'assets/logo-192.png',
        title: 'Welcome to ResIQ',
        description: 'Your all-in-one property management system',
        content: `
            <div class="onboarding-welcome">
                <img src="assets/logo-192.png" alt="ResIQ Logo" class="onboarding-logo">
                <h1 class="onboarding-welcome-title">Welcome to ResIQ</h1>
                <p class="onboarding-welcome-subtitle">Property Management Made Simple</p>
            </div>
        `
    },
    {
        id: 'reservations',
        type: 'feature',
        icon: '📅',
        title: 'Manage Reservations',
        description: 'Track bookings, check-ins, and guest information all in one place',
        features: [
            { icon: '✓', title: 'Real-time Booking', desc: 'Instant reservation updates' },
            { icon: '✓', title: 'Guest Management', desc: 'Complete guest profiles' },
            { icon: '✓', title: 'Calendar View', desc: 'Visual availability tracking' },
            { icon: '✓', title: 'Smart Notifications', desc: 'Never miss a check-in' }
        ]
    },
    {
        id: 'payments',
        type: 'feature',
        icon: '💳',
        title: 'Track Payments',
        description: 'Monitor payments, generate invoices, and manage transactions effortlessly',
        features: [
            { icon: '✓', title: 'Payment Tracking', desc: 'Track all transactions' },
            { icon: '✓', title: 'Invoice Generation', desc: 'Auto-generate receipts' },
            { icon: '✓', title: 'Financial Reports', desc: 'Detailed analytics' },
            { icon: '✓', title: 'Multi-currency', desc: 'Support for INR' }
        ]
    },
    {
        id: 'documents',
        type: 'feature',
        icon: '📄',
        title: 'Guest Documents',
        description: 'Secure KYC document collection and verification for compliance',
        features: [
            { icon: '✓', title: 'Digital KYC', desc: 'Paperless verification' },
            { icon: '✓', title: 'Secure Storage', desc: 'Encrypted documents' },
            { icon: '✓', title: 'Quick Review', desc: 'Instant verification' },
            { icon: '✓', title: 'Compliance', desc: 'Legal requirements met' }
        ]
    },
    {
        id: 'analytics',
        type: 'feature',
        icon: '📊',
        title: 'Business Analytics',
        description: 'Powerful insights to grow your property rental business',
        features: [
            { icon: '✓', title: 'Revenue Tracking', desc: 'Monitor earnings' },
            { icon: '✓', title: 'Occupancy Rates', desc: 'Track performance' },
            { icon: '✓', title: 'Guest Insights', desc: 'Understand your guests' },
            { icon: '✓', title: 'Trends Analysis', desc: 'Data-driven decisions' }
        ]
    },
    {
        id: 'mobile',
        type: 'feature',
        icon: '📱',
        title: 'Works Everywhere',
        description: 'Access your business from any device, anytime, anywhere',
        features: [
            { icon: '✓', title: 'Mobile App', desc: 'iOS & Android ready' },
            { icon: '✓', title: 'Offline Mode', desc: 'Works without internet' },
            { icon: '✓', title: 'Real-time Sync', desc: 'Always up-to-date' },
            { icon: '✓', title: 'Dark Mode', desc: 'Easy on the eyes' }
        ]
    },
    {
        id: 'notifications',
        type: 'permission',
        icon: '🔔',
        title: 'Stay Updated',
        description: 'Enable notifications to never miss important booking updates',
        benefits: [
            { icon: '📅', text: 'New booking alerts' },
            { icon: '💰', text: 'Payment confirmations' },
            { icon: '📄', text: 'Document upload reminders' },
            { icon: '⏰', text: 'Check-in/check-out notifications' }
        ]
    },
    {
        id: 'complete',
        type: 'complete',
        icon: '✓',
        title: 'You\'re All Set!',
        description: 'Start managing your properties like a pro'
    }
];

// ============================================
// ONBOARDING INITIALIZATION
// ============================================

function initOnboarding() {
    // Check if user has already seen onboarding
    const hasCompleted = localStorage.getItem('onboarding_completed');

    if (hasCompleted === 'true') {
        onboardingState.hasSeenOnboarding = true;
        return false;
    }

    return true;
}

// ============================================
// ONBOARDING UI CREATION
// ============================================

function createOnboardingUI() {
    const overlay = document.createElement('div');
    overlay.className = 'onboarding-overlay';
    overlay.id = 'onboardingOverlay';

    // Create slides container
    const slidesContainer = document.createElement('div');
    slidesContainer.className = 'onboarding-slides';
    slidesContainer.id = 'onboardingSlides';

    // Create each slide
    onboardingSlides.forEach((slideData, index) => {
        const slide = createSlide(slideData, index);
        slidesContainer.appendChild(slide);
    });

    // Create dots indicator
    const dots = document.createElement('div');
    dots.className = 'onboarding-dots';
    dots.id = 'onboardingDots';

    onboardingSlides.forEach((_, index) => {
        const dot = document.createElement('div');
        dot.className = `onboarding-dot ${index === 0 ? 'active' : ''}`;
        dot.onclick = () => goToSlide(index);
        dots.appendChild(dot);
    });

    // Create footer with navigation
    const footer = document.createElement('div');
    footer.className = 'onboarding-footer';
    footer.innerHTML = `
        <div class="onboarding-buttons">
            <button class="onboarding-btn onboarding-btn-skip" id="onboardingSkip" onclick="skipOnboarding()">
                Skip
            </button>
            <button class="onboarding-btn onboarding-btn-primary" id="onboardingNext" onclick="nextSlide()">
                Next →
            </button>
        </div>
    `;

    overlay.appendChild(slidesContainer);
    overlay.appendChild(dots);
    overlay.appendChild(footer);

    document.body.appendChild(overlay);

    onboardingState.totalSlides = onboardingSlides.length;
    onboardingState.currentSlide = 0;

    // Trigger haptic if available
    if (window.nativeApp && window.nativeApp.haptic) {
        window.nativeApp.haptic('medium');
    }
}

// ============================================
// SLIDE CREATION
// ============================================

function createSlide(slideData, index) {
    const slide = document.createElement('div');
    slide.className = `onboarding-slide ${index === 0 ? 'active' : ''}`;
    slide.id = `slide-${slideData.id}`;

    if (slideData.type === 'welcome') {
        slide.innerHTML = slideData.content;
    } else if (slideData.type === 'feature') {
        slide.innerHTML = `
            <div class="onboarding-icon">${slideData.icon}</div>
            <h2 class="onboarding-title">${slideData.title}</h2>
            <p class="onboarding-description">${slideData.description}</p>
            <div class="onboarding-features">
                ${slideData.features.map((feature, i) => `
                    <div class="onboarding-feature" style="animation-delay: ${i * 0.1}s">
                        <div class="onboarding-feature-icon">${feature.icon}</div>
                        <div class="onboarding-feature-text">
                            <div class="onboarding-feature-title">${feature.title}</div>
                            <div class="onboarding-feature-desc">${feature.desc}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    } else if (slideData.type === 'permission') {
        slide.innerHTML = `
            <div class="onboarding-permission">
                <div class="onboarding-permission-icon">${slideData.icon}</div>
                <h2 class="onboarding-permission-title">${slideData.title}</h2>
                <p class="onboarding-permission-description">${slideData.description}</p>
                <div class="onboarding-permission-benefits">
                    ${slideData.benefits.map(benefit => `
                        <div class="onboarding-permission-benefit">
                            <span class="onboarding-permission-benefit-icon">${benefit.icon}</span>
                            <span>${benefit.text}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    } else if (slideData.type === 'complete') {
        slide.innerHTML = `
            <div class="onboarding-complete-icon">✓</div>
            <h2 class="onboarding-title">${slideData.title}</h2>
            <p class="onboarding-description">${slideData.description}</p>
        `;
    }

    return slide;
}

// ============================================
// NAVIGATION
// ============================================

function nextSlide() {
    const currentSlideData = onboardingSlides[onboardingState.currentSlide];

    // Handle notification permission request
    if (currentSlideData.id === 'notifications') {
        requestNotificationPermission();
    }

    // Check if last slide
    if (onboardingState.currentSlide === onboardingState.totalSlides - 1) {
        completeOnboarding();
        return;
    }

    // Move to next slide
    goToSlide(onboardingState.currentSlide + 1);

    // Haptic feedback
    if (window.nativeApp && window.nativeApp.haptic) {
        window.nativeApp.haptic('light');
    }
}

function previousSlide() {
    if (onboardingState.currentSlide > 0) {
        goToSlide(onboardingState.currentSlide - 1);

        if (window.nativeApp && window.nativeApp.haptic) {
            window.nativeApp.haptic('light');
        }
    }
}

function goToSlide(index) {
    if (index < 0 || index >= onboardingState.totalSlides) return;

    // Update slides
    const slides = document.querySelectorAll('.onboarding-slide');
    slides.forEach((slide, i) => {
        slide.classList.remove('active', 'prev');
        if (i === index) {
            slide.classList.add('active');
        } else if (i < index) {
            slide.classList.add('prev');
        }
    });

    // Update dots
    const dots = document.querySelectorAll('.onboarding-dot');
    dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === index);
    });

    // Update button text
    const nextBtn = document.getElementById('onboardingNext');
    if (index === onboardingState.totalSlides - 1) {
        nextBtn.textContent = 'Get Started →';
    } else {
        nextBtn.textContent = 'Next →';
    }

    // Show/hide skip button
    const skipBtn = document.getElementById('onboardingSkip');
    if (index === onboardingState.totalSlides - 1) {
        skipBtn.style.display = 'none';
    } else {
        skipBtn.style.display = 'block';
    }

    onboardingState.currentSlide = index;
}

function skipOnboarding() {
    if (confirm('Are you sure you want to skip the tour? You can always access help from Settings.')) {
        completeOnboarding();
    }
}

function completeOnboarding() {
    // Mark as completed
    localStorage.setItem('onboarding_completed', 'true');
    onboardingState.hasSeenOnboarding = true;

    // Animate out
    const overlay = document.getElementById('onboardingOverlay');
    overlay.style.opacity = '0';
    overlay.style.transform = 'scale(0.95)';
    overlay.style.transition = 'all 0.3s ease';

    setTimeout(() => {
        overlay.remove();

        // Show welcome toast
        if (window.showToast) {
            window.showToast('Welcome to ResIQ! 🎉', 'success');
        }

        // Trigger success haptic
        if (window.nativeApp && window.nativeApp.haptic) {
            window.nativeApp.haptic('success');
        }
    }, 300);
}

// ============================================
// PERMISSIONS
// ============================================

async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        console.log('This browser does not support notifications');
        return;
    }

    if (Notification.permission === 'granted') {
        return;
    }

    if (Notification.permission !== 'denied') {
        try {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                console.log('Notification permission granted');

                // Show a test notification
                new Notification('ResIQ Notifications Enabled', {
                    body: 'You\'ll receive updates about bookings and payments',
                    icon: '/assets/logo-192.png',
                    badge: '/assets/logo-96.png'
                });
            }
        } catch (error) {
            console.error('Error requesting notification permission:', error);
        }
    }
}

// ============================================
// RESET (FOR TESTING)
// ============================================

function resetOnboarding() {
    localStorage.removeItem('onboarding_completed');
    location.reload();
}

// Make reset available globally (for testing)
window.resetOnboarding = resetOnboarding;

// ============================================
// AUTO-START
// ============================================

// Start onboarding when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const shouldShowOnboarding = initOnboarding();

    if (shouldShowOnboarding) {
        // Small delay for smooth appearance
        setTimeout(() => {
            createOnboardingUI();
        }, 500);
    }
});

// Export functions for manual control
window.onboarding = {
    start: () => {
        createOnboardingUI();
    },
    reset: resetOnboarding,
    skip: skipOnboarding
};
