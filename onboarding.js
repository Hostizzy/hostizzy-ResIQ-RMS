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
        icon: 'assets/logo-384.png',
        title: 'Welcome to ResIQ',
        description: 'Your all-in-one property management system',
        content: `
            <div class="onboarding-welcome">
                <img src="assets/logo-384.png" alt="ResIQ Logo" class="onboarding-logo">
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

        // Launch the 3-question setup wizard for first-time owners so
        // they don't land on an empty dashboard.
        maybeStartSetupWizard();
    }, 300);
}

// ============================================
// SETUP WIZARD (first property + business basics)
// ============================================
// Shown once, immediately after the onboarding carousel, so a new
// operator gets from signup to their first reservation in under
// 2 minutes instead of hunting through Settings + Properties.

async function maybeStartSetupWizard() {
    // Skip if already run, or if the user already has properties
    // (returning user just clearing localStorage).
    if (localStorage.getItem('setup_wizard_completed') === 'true') return;

    try {
        if (typeof db !== 'undefined' && db.getProperties) {
            const existing = await db.getProperties();
            if (existing && existing.length > 0) {
                localStorage.setItem('setup_wizard_completed', 'true');
                return;
            }
        }
    } catch (_) { /* if scope not ready, fall through and show wizard */ }

    renderSetupWizard();
}

function renderSetupWizard() {
    const existingBusinessName = localStorage.getItem('businessName') || '';

    const overlay = document.createElement('div');
    overlay.id = 'setupWizardOverlay';
    overlay.style.cssText = `
        position: fixed; inset: 0; z-index: 10001;
        background: rgba(15, 23, 42, 0.55);
        display: flex; align-items: center; justify-content: center;
        padding: 20px; opacity: 0; transition: opacity 0.25s ease;
    `;
    overlay.innerHTML = `
        <div style="background: var(--surface, #fff); border-radius: 16px; max-width: 480px; width: 100%;
                    padding: 28px 24px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); position: relative;">
            <div style="font-size: 12px; color: var(--text-secondary, #64748b); font-weight: 600;
                        text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px;">
                <span id="wizStepLabel">Step 1 of 3</span>
            </div>
            <h2 id="wizTitle" style="margin: 0 0 6px 0; font-size: 22px; font-weight: 700; color: var(--text-primary, #0f172a);">
                What's your business called?
            </h2>
            <p id="wizSubtitle" style="margin: 0 0 20px 0; color: var(--text-secondary, #64748b); font-size: 14px;">
                This shows up on email confirmations and reports.
            </p>

            <div id="wizBody"></div>

            <div style="display: flex; gap: 10px; margin-top: 24px; justify-content: space-between; align-items: center;">
                <button id="wizSkip" style="background: none; border: none; color: var(--text-secondary, #64748b);
                                            font-size: 13px; cursor: pointer; padding: 6px 8px;">Skip for now</button>
                <div style="display: flex; gap: 8px;">
                    <button id="wizBack" style="display: none; padding: 10px 18px; border-radius: 8px;
                                                 border: 1px solid var(--border, #e2e8f0); background: transparent;
                                                 color: var(--text-primary, #0f172a); font-weight: 600; cursor: pointer;">Back</button>
                    <button id="wizNext" style="padding: 10px 20px; border-radius: 8px; border: none;
                                                 background: var(--primary, #0891b2); color: white;
                                                 font-weight: 600; cursor: pointer;">Next →</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => { overlay.style.opacity = '1'; });

    const wizardState = {
        step: 1,
        businessName: existingBusinessName,
        propertyName: '',
        defaultRate: '5000'
    };

    function renderStep() {
        const body = document.getElementById('wizBody');
        const stepLabel = document.getElementById('wizStepLabel');
        const title = document.getElementById('wizTitle');
        const subtitle = document.getElementById('wizSubtitle');
        const back = document.getElementById('wizBack');
        const next = document.getElementById('wizNext');

        stepLabel.textContent = `Step ${wizardState.step} of 3`;
        back.style.display = wizardState.step > 1 ? 'inline-block' : 'none';

        if (wizardState.step === 1) {
            title.textContent = "What's your business called?";
            subtitle.textContent = 'This shows up on email confirmations and reports.';
            body.innerHTML = `
                <input id="wizBusinessName" type="text" value="${escapeAttr(wizardState.businessName)}"
                       placeholder="e.g. Mountain Vista Villas"
                       style="width: 100%; padding: 12px 14px; font-size: 16px; border: 1px solid var(--border, #e2e8f0);
                              border-radius: 8px; background: var(--background, #f8fafc); color: var(--text-primary, #0f172a);"
                       autofocus />
            `;
            next.textContent = 'Next →';
            setTimeout(() => document.getElementById('wizBusinessName')?.focus(), 50);
        } else if (wizardState.step === 2) {
            title.textContent = 'Add your first property';
            subtitle.textContent = 'Just the name for now — you can add photos, iCal feeds, and details later.';
            body.innerHTML = `
                <input id="wizPropertyName" type="text" value="${escapeAttr(wizardState.propertyName)}"
                       placeholder="e.g. Riverside Cottage"
                       style="width: 100%; padding: 12px 14px; font-size: 16px; border: 1px solid var(--border, #e2e8f0);
                              border-radius: 8px; background: var(--background, #f8fafc); color: var(--text-primary, #0f172a);"
                       autofocus />
            `;
            next.textContent = 'Next →';
            setTimeout(() => document.getElementById('wizPropertyName')?.focus(), 50);
        } else {
            title.textContent = "What's a typical nightly rate?";
            subtitle.textContent = 'A starting point — you can override it on every booking.';
            body.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px;
                            border: 1px solid var(--border, #e2e8f0); border-radius: 8px;
                            background: var(--background, #f8fafc); padding: 0 14px;">
                    <span style="color: var(--text-secondary, #64748b); font-size: 16px;">₹</span>
                    <input id="wizDefaultRate" type="number" inputmode="numeric"
                           value="${escapeAttr(wizardState.defaultRate)}" min="0" step="100"
                           placeholder="5000"
                           style="flex: 1; padding: 12px 0; font-size: 16px; border: none; background: transparent;
                                  color: var(--text-primary, #0f172a); outline: none;" />
                    <span style="color: var(--text-secondary, #64748b); font-size: 13px;">per night</span>
                </div>
            `;
            next.textContent = 'Finish — Open Reservations';
            setTimeout(() => document.getElementById('wizDefaultRate')?.focus(), 50);
        }
    }

    function readCurrentStep() {
        if (wizardState.step === 1) {
            wizardState.businessName = (document.getElementById('wizBusinessName')?.value || '').trim();
        } else if (wizardState.step === 2) {
            wizardState.propertyName = (document.getElementById('wizPropertyName')?.value || '').trim();
        } else {
            wizardState.defaultRate = (document.getElementById('wizDefaultRate')?.value || '').trim();
        }
    }

    document.getElementById('wizBack').onclick = () => {
        readCurrentStep();
        wizardState.step--;
        renderStep();
    };

    document.getElementById('wizSkip').onclick = () => {
        localStorage.setItem('setup_wizard_completed', 'true');
        dismissWizard();
    };

    document.getElementById('wizNext').onclick = async () => {
        readCurrentStep();
        if (wizardState.step === 1) {
            if (!wizardState.businessName) {
                if (window.showToast) window.showToast('Add your business name to continue', 'warning');
                return;
            }
            wizardState.step = 2; renderStep();
        } else if (wizardState.step === 2) {
            if (!wizardState.propertyName) {
                if (window.showToast) window.showToast('Add a property name to continue', 'warning');
                return;
            }
            wizardState.step = 3; renderStep();
        } else {
            await finishWizard(wizardState);
        }
    };

    renderStep();

    function dismissWizard() {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 250);
    }
}

async function finishWizard(state) {
    const next = document.getElementById('wizNext');
    if (next) { next.disabled = true; next.textContent = 'Saving…'; }

    // 1. Persist business name (Supabase + localStorage)
    try {
        if (window.SettingsStore) {
            await SettingsStore.set('businessName', state.businessName);
        } else {
            localStorage.setItem('businessName', state.businessName);
        }
    } catch (e) {
        console.warn('[setup-wizard] Failed to persist business name:', e?.message);
    }

    // 2. Create first property (sensible defaults — owner can refine later)
    let propertyCreated = false;
    try {
        const ratePaise = window.Money ? Money.parseRupeesToPaise(state.defaultRate) : Math.round(parseFloat(state.defaultRate || 0) * 100);
        const rateRupees = ratePaise / 100;

        const property = {
            name: state.propertyName,
            location: 'Not specified',
            type: 'villa',
            capacity: 4,
            revenue_share_percent: 0,
            is_managed: false,
            default_rate: rateRupees
        };

        if (window.currentUser?.userType === 'owner') {
            property.owner_id = window.currentUser.id;
        }

        if (typeof supabase !== 'undefined') {
            const { error } = await supabase.from('properties').insert([property]);
            if (error) {
                // default_rate may not exist on every deployment — retry without
                // it so the wizard still creates the property.
                if (String(error.message || '').toLowerCase().includes('default_rate')) {
                    delete property.default_rate;
                    const retry = await supabase.from('properties').insert([property]);
                    if (!retry.error) propertyCreated = true;
                } else {
                    throw error;
                }
            } else {
                propertyCreated = true;
            }
            if (window.db && typeof db.refreshPropertyScope === 'function') {
                await db.refreshPropertyScope();
            }
        }
    } catch (e) {
        console.error('[setup-wizard] Failed to create property:', e?.message);
        if (window.showToast) window.showToast('Could not create property — you can add it from the Properties view.', 'warning');
    }

    localStorage.setItem('setup_wizard_completed', 'true');
    if (next) { next.disabled = false; }

    // 3. Dismiss + land on Reservations with a clear CTA
    const overlay = document.getElementById('setupWizardOverlay');
    if (overlay) {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 250);
    }

    if (propertyCreated && window.showToast) {
        window.showToast(`✅ ${state.propertyName} added. Add your first booking →`, 'success');
    }
    if (typeof window.showView === 'function') {
        window.showView('reservations');
        // Open the reservation modal so the operator's first action is creating a booking.
        if (typeof window.openReservationModal === 'function') {
            setTimeout(() => window.openReservationModal(), 600);
        }
    }
}

// Tiny HTML-attribute escape so wizard inputs can safely interpolate
// the user's previous values without breaking on quotes or angle brackets.
function escapeAttr(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
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
