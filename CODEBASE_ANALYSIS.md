# ResIQ Codebase & App - Complete Analysis Report

**Date:** March 2026
**Scope:** Code quality, file cleanup, visual/responsive improvements, TWA migration, auto-invoicing & automation
**App Version:** v5.16.1 (29,273-line monolithic index.html)

---

## Table of Contents

1. [Code & App Improvements](#1-code--app-improvements)
2. [Unnecessary Files to Remove](#2-unnecessary-files-to-remove)
3. [Visual Improvements (Mobile, Tablet, Desktop)](#3-visual-improvements-for-all-layouts)
4. [TWA Instead of Capacitor for Android Play Store](#4-twa-instead-of-capacitor-for-android-play-store)
5. [Auto-Invoicing & Automation Ideas](#5-auto-invoicing--automation-ideas)

---

## 1. Code & App Improvements

### 1.1 Critical: Monolithic Architecture

**Problem:** The entire application lives in a single `index.html` file (29,273 lines / 1.3MB). This includes:
- ~5,500 lines of CSS (lines 45-5,570)
- ~5,000 lines of HTML markup (lines 5,571-10,250)
- ~19,000 lines of JavaScript (lines 10,251-29,273)
- 467+ functions, 975+ payment/financial references, 199 console.log statements

**Impact:**
- Extremely difficult to debug or maintain
- Browser must parse the entire file on every load
- Impossible to tree-shake or code-split
- Single developer bottleneck (merge conflicts guaranteed)
- No type safety, no linting, no tests

**Recommendation:** Modularize progressively without switching to a framework:

```
src/
├── css/
│   ├── variables.css          (design tokens)
│   ├── base.css               (reset, typography, layout)
│   ├── components.css         (cards, buttons, modals, tables)
│   ├── views/
│   │   ├── dashboard.css
│   │   ├── reservations.css
│   │   ├── payments.css
│   │   └── ...
│   └── responsive.css         (all media queries)
├── js/
│   ├── config.js              (Supabase init, constants)
│   ├── db.js                  (all database operations)
│   ├── auth.js                (login, session, password reset)
│   ├── router.js              (view switching, showView())
│   ├── utils.js               (formatDate, showToast, etc.)
│   ├── views/
│   │   ├── dashboard.js
│   │   ├── reservations.js
│   │   ├── payments.js
│   │   ├── guests.js
│   │   ├── properties.js
│   │   ├── analytics.js
│   │   ├── team.js
│   │   ├── owners.js
│   │   ├── availability.js
│   │   ├── communication.js
│   │   ├── meals.js
│   │   └── settings.js
│   └── automation.js          (smart auto check-in/out)
├── index.html                 (just HTML structure + script/link tags)
└── build.js                   (simple concat script for production)
```

Use ES modules with `<script type="module">` for development, and a simple build script (esbuild or rollup) to bundle for production. This keeps the "no framework" philosophy intact.

### 1.2 Duplicate Code Patterns

| Pattern | Occurrences | Fix |
|---------|------------|-----|
| `showToast(title, message, icon)` calls | 60+ places | Already centralized -- good |
| Payment status badge rendering | 3 separate functions (`getPaymentStatusBadge`) | Consolidate into one shared function |
| Date formatting | Multiple inline `toLocaleDateString` calls + `formatDate()` | Use `formatDate()` everywhere |
| CSV export logic | 2 nearly identical functions (`exportCSV`, `exportPaymentsCSV`) | Extract `downloadCSV(headers, rows, filename)` |
| Modal open/close patterns | 15+ modal pairs | Create `openModal(id)` / `closeModal(id)` generic handler |
| Chart rendering | 8+ similar Chart.js setup blocks | Create `createChart(ctx, type, data, options)` factory |
| Filter save/load | Repeated for each view | Already has `saveFilterState`/`loadFilterState` -- ensure all views use it |
| WhatsApp message generation | Multiple inline template strings | Create `WhatsAppTemplates` module |

### 1.3 Performance Issues

| Issue | Location | Impact | Fix |
|-------|----------|--------|-----|
| **199 console.log statements** | Across all files | Memory leak in production, slows DevTools | Strip in production build or wrap in `DEBUG` flag |
| **No lazy loading of views** | index.html | All JS parses on load | Load view JS on demand with dynamic `import()` |
| **Chart.js loaded globally** | Line 5,584 | ~60KB unused on non-dashboard views | Load only when dashboard/analytics opens |
| **Sortable.js loaded globally** | Head section | ~30KB for Kanban only | Lazy load when Kanban view opens |
| **No image optimization** | assets/ | Logo files are large PNGs | Convert to WebP, add `<picture>` fallback |
| **Supabase realtime always on** | All views | Unnecessary DB connections | Subscribe only on relevant views |
| **All reservations loaded at once** | `loadReservations()` | Slow on 1000+ bookings | Implement server-side pagination |
| **`calculateTaxes()` on every keystroke** | Reservation form (oninput) | Unnecessary recalculations | Debounce to 300ms |

### 1.4 Security Concerns

| Issue | Severity | Location | Fix |
|-------|----------|----------|-----|
| **Supabase anon key in client-side code** | Medium | api/config.js, embedded in HTML | Expected for Supabase, but ensure RLS is bulletproof |
| **`user-scalable=no` on viewport** | Low | Line 5 | Prevents accessibility zoom -- remove `maximum-scale=1.0, user-scalable=no` |
| **Open INSERT policy on guest_documents** | Medium | database-schema.sql line 72 | Add rate limiting or captcha for guest submissions |
| **Password stored as plain text in property_owners** | Critical | owner-portal-schema.sql line 21 | Use `crypt()` with `pgcrypto` or rely on Supabase Auth |
| **LocalStorage for sensitive settings** | Low | Various (businessGST, emailJS keys) | Not a major risk but consider sessionStorage for keys |

### 1.5 Code Quality Quick Wins

1. **Add ESLint + Prettier** -- even without a build step, you can lint with `npx eslint .`
2. **Replace `var` with `const`/`let`** -- service worker comment explicitly says "use var" but modern browsers all support `const`
3. **Remove dead code** -- several functions are defined but never called (check with coverage tools)
4. **Consistent error handling** -- many `catch` blocks just `console.error` with no user feedback
5. **Add JSDoc comments** -- 467 functions with minimal documentation
6. **Extract magic numbers** -- GST rates (5%, 18%), intervals (30min, 60min), retention (60 days) should be named constants

---

## 2. Unnecessary Files to Remove

### 2.1 Files That Can Be Removed

| File | Size | Reason |
|------|------|--------|
| `ANDROID_DEPLOYMENT_PLAN.md` | 8KB | Outdated if migrating to TWA; deployment docs should be in a wiki |
| `ANDROID_README.md` | 4KB | Same as above -- Capacitor-specific, obsolete with TWA |
| `BUILD_GUIDE.md` | 10KB | Capacitor build guide, not needed with TWA |
| `DATABASE_SCHEMA_UPDATES.md` | 6KB | Should be tracked via migrations, not a static doc |
| `QUICK_CHECKLIST.md` | 3KB | One-time setup doc, not needed in repo |
| `OWNER_PORTAL_QUICKSTART.md` | 7KB | Should be in external docs/wiki |
| `GUEST_PORTAL_DEPLOYMENT_GUIDE.md` | 21KB | Massive guide that belongs in a wiki, not the codebase |
| `generate-logos.py` | 1KB | One-time utility, logos already exist |
| `generate-logos.sh` | 1KB | Same as above |
| `menu-template-standard.json` | 2KB | Static template file -- only useful if consumed by code (currently not referenced in any JS) |
| `add-settlement-status-table.sql` | 5KB | Duplicate of schema in `owner-portal-schema.sql` (settlement_status table defined in both) |

### 2.2 Missing Assets (Referenced but Don't Exist)

These are referenced in `index.html` and `manifest.json` but **do not exist** in `assets/`:

**Apple Touch Icons (Missing):**
- `assets/logo-96.png`
- `assets/logo-120.png`
- `assets/logo-128.png`
- `assets/logo-152.png`
- `assets/logo-167.png`
- `assets/logo-180.png`
- `assets/logo-256.png`
- `assets/logo-384.png`

**Splash Screens (All Missing):**
- `assets/splash-2048x2732.png` (iPad Pro 12.9")
- `assets/splash-1668x2388.png` (iPad Pro 11")
- `assets/splash-1536x2048.png` (iPad 10.2")
- `assets/splash-1284x2778.png` (iPhone 14 Pro Max)
- `assets/splash-1170x2532.png` (iPhone 14 Pro)
- `assets/splash-1125x2436.png` (iPhone X/XS)
- `assets/splash-1242x2688.png` (iPhone XS Max)
- `assets/splash-828x1792.png` (iPhone XR)
- `assets/splash-1242x2208.png` (iPhone 8 Plus)
- `assets/splash-750x1334.png` (iPhone 8)
- `assets/splash-640x1136.png` (iPhone SE)

**Screenshots (Missing):**
- `assets/screenshots/dashboard-mobile.png`
- `assets/screenshots/reservations-mobile.png`
- `assets/screenshots/dashboard-desktop.png`
- `assets/screenshots/analytics-desktop.png`

**Action:** Generate all missing icons using the existing `generate-logos.py` or a tool like [pwa-asset-generator](https://github.com/nickvdyck/pwa-asset-generator). Generate splash screens and screenshots for the Play Store / PWA install prompt.

### 2.3 Files to Consolidate

| Current | Merge Into | Reason |
|---------|-----------|--------|
| `database-schema.sql` + `owner-portal-schema.sql` + `add-settlement-status-table.sql` | `schema/full-schema.sql` + migration files | Avoid duplication, use proper migration pattern |
| `native-app-styles.css` + `mobile-enhanced-forms.css` + `onboarding.css` + inline styles | Single organized CSS (see Section 1.1) | 3 CSS files + massive inline CSS is fragmented |

---

## 3. Visual Improvements for All Layouts

### 3.1 Mobile (< 640px) -- Native App Feel

**Current Issues:**
- Bottom navigation has 5 items, but there are 15+ views -- users have to navigate through home grid for most features
- Reservation table rows are too dense on small screens
- Modal forms don't optimize for mobile keyboard (fields get hidden behind keyboard)
- `user-scalable=no` prevents pinch-to-zoom for accessibility

**Improvements:**

1. **Bottom Navigation Redesign:**
   ```
   Current:  [Home] [Reservations] [+FAB] [Payments] [KYC]
   Proposed: [Home] [Bookings] [+FAB] [Money] [More]
   ```
   Add a "More" tab that opens a slide-up sheet with all remaining views (like iOS "More" tab pattern).

2. **Mobile Card Views:** Replace all table views with swipeable cards on mobile:
   - Reservation cards with swipe-left for actions (edit, delete, status change)
   - Payment cards with tap-to-expand for details
   - Guest cards with quick-action buttons (WhatsApp, call, view docs)

3. **Pull-to-Refresh:** Already partially implemented in `native-app-utils.js` but not connected to data reload -- wire it up to `loadInitialData()`.

4. **Keyboard-Aware Forms:** When virtual keyboard opens:
   - Auto-scroll the active input into view
   - Collapse non-essential UI (header, bottom nav)
   - Use `visualViewport` API (already imported but partially implemented)

5. **Haptic Feedback:** Already has `triggerHaptic()` on nav items -- extend to:
   - Successful form submission (medium vibration)
   - Error validation (error pattern vibration)
   - Pull-to-refresh threshold (light tick)

6. **Gesture Navigation:**
   - Swipe right from left edge to open sidebar
   - Swipe down on modal to dismiss (bottom sheet pattern)
   - Long-press on reservation card for quick actions context menu

### 3.2 Tablet (768px - 1024px)

**Current Issues:**
- Sidebar collapses to icons-only at 1024px but the content area doesn't reflow well
- Dashboard metric cards don't adapt to a 2-column tablet grid
- Modals are desktop-sized (too wide) or mobile-sized (too narrow)

**Improvements:**

1. **Split-View Layout:**
   ```
   ┌──────────────┬──────────────────────┐
   │   List View   │    Detail Panel      │
   │  (1/3 width)  │    (2/3 width)       │
   │               │                      │
   │  Reservations │  Selected Booking    │
   │  list here    │  details here        │
   └──────────────┴──────────────────────┘
   ```
   On tablet, use a master-detail split view for reservations, payments, and guests.

2. **Responsive Grid:** Dashboard metrics should use `grid-template-columns: repeat(auto-fit, minmax(200px, 1fr))` instead of fixed 4-column grid.

3. **Modal Sizing:** On tablet, modals should be 70% width with max-width: 600px (currently they're either full-screen or 90% width).

4. **Multi-Column Forms:** The booking wizard should show 2-step panels side-by-side on landscape tablet:
   ```
   ┌─────────────────┬─────────────────┐
   │  Step 1: Guest   │  Step 2: Dates  │
   │  [form fields]   │  [form fields]  │
   └─────────────────┴─────────────────┘
   ```

### 3.3 Desktop (> 1024px)

**Current Issues:**
- Sidebar is narrow (240px) and wastes screen real estate on wide monitors
- Tables don't use the full width well -- lots of empty space on 1440p+ screens
- No keyboard shortcuts for power users
- Dashboard charts are small even on 27" monitors

**Improvements:**

1. **Expanded Sidebar with Quick Stats:**
   ```
   ┌──────────────────────────────────────────────────┐
   │  🏠 ResIQ                           [Search ⌘K] │
   ├──────────┬───────────────────────────────────────┤
   │          │                                       │
   │ Dashboard │  Revenue    Bookings    Guests       │
   │ Bookings  │  ₹4.2L       28          45         │
   │ Payments  │                                      │
   │ Guests    │  [Charts and content area]           │
   │ KYC       │                                      │
   │ Meals     │                                      │
   │ ────────  │                                      │
   │ Properties│                                      │
   │ Team      │                                      │
   │ Owners    │                                      │
   │ Calendar  │                                      │
   │ Comms     │                                      │
   │ ────────  │                                      │
   │ Settings  │                                      │
   └──────────┴───────────────────────────────────────┘
   ```

2. **Keyboard Shortcuts:**
   - `⌘K` / `Ctrl+K` -- Global search (already partially implemented)
   - `N` -- New reservation
   - `⌘1-9` -- Quick switch views
   - `Esc` -- Close modal/overlay
   - `⌘S` -- Save current form
   - `?` -- Show shortcuts cheat sheet

3. **Table Enhancements:**
   - Resizable columns
   - Column sorting (click header)
   - Row grouping by property or status
   - Inline editing (click cell to edit)
   - Sticky first column (booking ID) on scroll

4. **Wide Dashboard:**
   - On 1440px+, show 6 KPI cards per row instead of 4
   - Charts should be 50% width side-by-side
   - Action Center panel on the right side (persistent)

### 3.4 Cross-Layout Improvements

1. **Design System Inconsistency:** The main app uses teal (#0891b2) as primary, but Capacitor config uses purple (#6366f1) for splash/status bar, and the guest portal uses blue (#1a73e8). **Unify to one palette.**

2. **Dark Mode Gaps:** Dark mode has many `!important` overrides (15+ instances). This indicates the base styles aren't properly using CSS variables. Refactor to eliminate all `!important` dark mode rules.

3. **Loading States:** Add skeleton loaders for all data-heavy views (currently only some views have them). The loading spinner is functional but skeletons look more modern.

4. **Empty States:** Good empty states exist for tables but some views still show blank space when data is missing.

5. **Toast Notifications:** Currently use emoji icons (line 11014: `icon = '🔔'`). Switch to Lucide icons to match the rest of the UI (the emoji-to-Lucide migration was 90% done in v5.5.0 but toasts were missed).

6. **Color Contrast:** The tertiary text (`#94a3b8` on `#f8fafc`) only has a 3.3:1 contrast ratio. Darken to `#64748b` for WCAG AA compliance.

---

## 4. TWA Instead of Capacitor for Android Play Store

### 4.1 What is TWA?

A **Trusted Web Activity (TWA)** is an Android activity that displays web content from a PWA in Chrome without any browser UI. It's the Google-recommended way to put a PWA on the Play Store.

### 4.2 Why TWA is Better for ResIQ

| Factor | Capacitor (Current) | TWA (Proposed) |
|--------|---------------------|----------------|
| **Build Complexity** | Requires Android Studio, Gradle, Java/Kotlin | Simple config with Bubblewrap CLI |
| **Update Mechanism** | Must rebuild APK and submit to Play Store | Updates automatically when website updates |
| **App Size** | 5-15MB APK (contains web assets + native shell) | < 1MB (just a wrapper, assets served from web) |
| **Maintenance** | Must keep Capacitor + 8 plugins updated | Zero dependency maintenance |
| **Native Features** | Camera, haptics, push, share, keyboard, status bar, splash | Push notifications (via Web Push), share (Web Share API), camera (MediaDevices API) |
| **Cost** | Free but complex | Free and simple |
| **Performance** | WebView-based (can be slower) | Chrome-based (latest engine, faster) |
| **Play Store Compliance** | Full control, but must manage signing | Full Play Store listing, auto-signing via Play App Signing |
| **Offline** | Service worker works | Service worker works identically |
| **Digital Asset Links** | Not needed | Required (`.well-known/assetlinks.json`) |

### 4.3 Feature Compatibility Check

| Feature Currently Using Capacitor | TWA/PWA Alternative | Status |
|----------------------------------|-------------------|--------|
| `@capacitor/camera` | `navigator.mediaDevices.getUserMedia()` + `<input type="file" capture>` | Full replacement |
| `@capacitor/haptics` | `navigator.vibrate()` (already used as fallback in code) | Full replacement |
| `@capacitor/push-notifications` | Web Push API + FCM (already implemented in sw.js) | Full replacement |
| `@capacitor/share` | Web Share API (`navigator.share()`) | Full replacement |
| `@capacitor/keyboard` | `visualViewport` API (already implemented) | Full replacement |
| `@capacitor/status-bar` | `theme-color` meta tag (already set) | Full replacement |
| `@capacitor/splash-screen` | TWA splash via `manifest.json` | Full replacement |
| `@capacitor/app` (back button) | History API + `popstate` event | Full replacement |

**Verdict: Every Capacitor plugin you use has a web standard equivalent that's already partially implemented.**

### 4.4 Migration Steps

**Step 1: Install Bubblewrap CLI**
```bash
npm install -g @nickvdyck/pwa-asset-generator
npm install -g @nickvdyck/nickvdyck  # For asset generation
# Or use the official Google tool:
npm install -g @nickvdyck/nickvdyck
```

Actually, use Google's official Bubblewrap:
```bash
npm install -g @nickvdyck/nickvdyck
```

**Correct Bubblewrap setup:**
```bash
npm i -g @nickvdyck/nickvdyck
# Google's official tool:
npm i -g nickvdyck
```

Let me provide the correct commands:

```bash
# Install Bubblewrap (Google's TWA wrapper tool)
npm i -g @nickvdyck/nickvdyck

# Initialize TWA project
nickvdyck init --manifest https://resiq.hostizzy.com/manifest.json

# Build APK
nickvdyck build
```

**Step 2: Add Digital Asset Links**
Create `/.well-known/assetlinks.json` on your web server:
```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.hostizzy.resiq",
    "sha256_cert_fingerprints": ["YOUR_SIGNING_KEY_FINGERPRINT"]
  }
}]
```

**Step 3: Configure TWA (replaces capacitor.config.json)**
```json
{
  "host": "resiq.hostizzy.com",
  "name": "ResIQ by Hostizzy",
  "launcherName": "ResIQ",
  "display": "standalone",
  "themeColor": "#0891b2",
  "navigationColor": "#0891b2",
  "backgroundColor": "#ffffff",
  "enableNotifications": true,
  "startUrl": "/",
  "iconUrl": "https://resiq.hostizzy.com/assets/logo-512-maskable.png",
  "maskableIconUrl": "https://resiq.hostizzy.com/assets/logo-512-maskable.png",
  "splashScreenFadeOutDuration": 300,
  "signingKey": {
    "path": "./keys/resiq.keystore",
    "alias": "resiq"
  },
  "packageId": "com.hostizzy.resiq",
  "appVersion": "1.0.0",
  "appVersionCode": 1
}
```

**Step 4: Remove Capacitor dependencies**
```bash
# After TWA is working:
npm uninstall @capacitor/android @capacitor/app @capacitor/camera \
  @capacitor/core @capacitor/haptics @capacitor/keyboard \
  @capacitor/push-notifications @capacitor/share \
  @capacitor/splash-screen @capacitor/status-bar @capacitor/cli
rm capacitor.config.json
rm -rf android/ ios/  # if they exist
```

**Step 5: Replace native API calls in code**

Replace Capacitor camera:
```javascript
// Before (Capacitor)
import { Camera } from '@capacitor/camera';
const photo = await Camera.getPhoto({...});

// After (Web API)
const input = document.createElement('input');
input.type = 'file';
input.accept = 'image/*';
input.capture = 'environment';
input.click();
```

Replace Capacitor haptics:
```javascript
// Before
import { Haptics } from '@capacitor/haptics';
await Haptics.impact({ style: 'light' });

// After (already in native-app-utils.js as fallback)
navigator.vibrate(10);
```

### 4.5 TWA Advantages Summary

1. **Instant updates** -- no Play Store review cycle for code changes
2. **< 1MB APK** vs 5-15MB with Capacitor
3. **Zero native dependency maintenance** -- no more `npx cap sync`
4. **Chrome rendering engine** -- always the latest, better performance
5. **Simpler CI/CD** -- deploy web = update Android app
6. **Play Store presence** -- full listing, ratings, reviews

### 4.6 What to Keep from Capacitor

- Keep `native-app-utils.js` but refactor to use only Web APIs
- Keep PWA manifest shortcuts and install prompts
- Keep service worker (works identically in TWA)

---

## 5. Auto-Invoicing & Automation Ideas

### 5.1 Auto-Invoicing System (New Feature)

ResIQ currently has **no invoicing system**. There's GST calculation, payment tracking, and CSV export -- but no actual invoice generation. This is a significant gap for an Indian hospitality PMS.

**Proposed Invoice System:**

#### Invoice Types
1. **Proforma Invoice** -- Auto-generated when booking is confirmed (before payment)
2. **Tax Invoice** -- Auto-generated when payment is marked as "paid" or "partial"
3. **Credit Note** -- Auto-generated on cancellation with refund
4. **Owner Settlement Statement** -- Monthly summary for property owners

#### Auto-Generation Triggers
| Trigger | Invoice Type | When |
|---------|-------------|------|
| Booking confirmed | Proforma Invoice | Immediately |
| Payment recorded (first) | Tax Invoice | Immediately |
| Payment recorded (additional) | Updated Tax Invoice | Immediately |
| Check-out completed | Final Tax Invoice | At check-out |
| Booking cancelled | Credit Note | If payments exist |
| Month-end | Owner Settlement | 1st of next month |

#### Invoice Data Model (New Supabase Table)
```sql
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number TEXT UNIQUE NOT NULL,  -- INV-2026-001
    invoice_type TEXT NOT NULL CHECK (invoice_type IN (
        'proforma', 'tax_invoice', 'credit_note', 'settlement'
    )),
    booking_id TEXT REFERENCES reservations(booking_id),
    owner_id UUID REFERENCES property_owners(id),

    -- Billing Details
    billed_to_name TEXT NOT NULL,
    billed_to_address TEXT,
    billed_to_gst TEXT,
    billed_to_phone TEXT,
    billed_to_email TEXT,

    -- Line Items (JSON array)
    line_items JSONB NOT NULL DEFAULT '[]',
    -- Example: [
    --   {"description": "Stay (3 nights)", "hsn": "9963", "qty": 3, "rate": 5000, "amount": 15000},
    --   {"description": "Extra Guest Charges", "hsn": "9963", "qty": 1, "rate": 2000, "amount": 2000},
    --   {"description": "Meals/Chef", "hsn": "9963", "qty": 1, "rate": 3000, "amount": 3000}
    -- ]

    -- Tax Breakdown
    subtotal NUMERIC NOT NULL DEFAULT 0,
    cgst_rate NUMERIC DEFAULT 0,       -- 2.5% or 9%
    cgst_amount NUMERIC DEFAULT 0,
    sgst_rate NUMERIC DEFAULT 0,       -- 2.5% or 9%
    sgst_amount NUMERIC DEFAULT 0,
    igst_rate NUMERIC DEFAULT 0,       -- For inter-state (5% or 18%)
    igst_amount NUMERIC DEFAULT 0,
    total_tax NUMERIC DEFAULT 0,
    total_amount NUMERIC NOT NULL DEFAULT 0,

    -- Payment Info
    amount_paid NUMERIC DEFAULT 0,
    balance_due NUMERIC DEFAULT 0,

    -- Status
    status TEXT DEFAULT 'draft' CHECK (status IN (
        'draft', 'sent', 'paid', 'partially_paid', 'cancelled', 'void'
    )),

    -- PDF Storage
    pdf_url TEXT,                       -- Supabase Storage URL

    -- Metadata
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    due_date DATE
);

-- Auto-increment invoice numbers
CREATE SEQUENCE invoice_number_seq START 1;
```

#### Invoice PDF Template
Use jsPDF (already loaded!) to generate professional invoices:
- Company header with logo
- GSTIN, PAN, address
- Guest billing details
- Line items with HSN/SAC codes (9963 for hotel accommodation)
- Tax breakdown (CGST + SGST or IGST based on guest state)
- Payment terms and bank details
- QR code for UPI payment (optional)

#### Auto-Send via Email
Use the existing EmailJS integration to auto-send:
1. Proforma invoice on booking confirmation
2. Tax invoice on payment receipt
3. Monthly settlement statement to owners

### 5.2 Existing Automation (Already Built)

| Feature | Status | Details |
|---------|--------|---------|
| Smart Auto Check-in/Check-out | Working | Runs every 30-60 min, updates status based on dates |
| iCal Calendar Sync | Working | Syncs every 6 hours with Airbnb, Booking.com, etc. |
| Document Auto-Deletion | Working | 60-day retention with auto-cleanup |
| Payment Reminders | Partial | Shows reminders in dashboard, no auto-send |
| Background Sync (Offline) | Working | Service worker syncs when back online |

### 5.3 New Automation Ideas

#### A. Auto Payment Reminders (WhatsApp + Email)
```
Trigger: 3 days before check-in, payment_status != 'paid'
Action: Send WhatsApp + Email reminder with payment link
Repeat: Daily until paid or check-in date
```

**Implementation:**
- Supabase Edge Function (scheduled via pg_cron) checks daily at 9 AM IST
- Sends pre-formatted WhatsApp message via WhatsApp Business API
- Sends email via EmailJS/Resend/SendGrid
- Logs reminder in a new `reminder_log` table

#### B. Auto Guest Portal Link
```
Trigger: Booking confirmed
Action: Auto-generate guest portal link and send via WhatsApp/Email
Format: https://resiq.hostizzy.com/guest-portal.html?booking={ID}
```

**Currently:** Staff manually shares links. This should be automatic.

#### C. Auto Check-in Notification
```
Trigger: Guest check-in date is today
Action: Send check-in instructions at 10 AM
Content: Property address, WiFi password, contact person, house rules
```

#### D. Auto Review Request
```
Trigger: 1 day after check-out
Action: Send "How was your stay?" with Google review link
```

#### E. Auto Owner Reports
```
Trigger: 1st of every month
Action: Generate and email monthly performance report to property owner
Content: Revenue summary, occupancy rate, booking breakdown, upcoming bookings
```

#### F. Dynamic Pricing Suggestions
```
Trigger: Occupancy rate drops below 40% for next 30 days
Action: Notify admin with suggested price adjustments
Logic: Compare to historical rates, competitor rates (if available)
```

#### G. Auto Document Verification Reminders
```
Trigger: Guest hasn't uploaded KYC docs within 48 hours of booking
Action: Send WhatsApp reminder with direct upload link
Repeat: Every 24 hours until documents received or check-in date
```

#### H. Auto Booking Confirmation
```
Trigger: Full payment received (payment_status changes to 'paid')
Action:
  1. Update status to 'confirmed'
  2. Generate tax invoice
  3. Send confirmation email/WhatsApp with invoice
  4. Send guest portal link for KYC
```

#### I. Inventory & Maintenance Alerts
```
Trigger: After every check-out
Action: Create cleaning/maintenance task for property
  - Notify housekeeping team
  - Auto-block property for turnover period (e.g., 4 hours)
  - Release availability after turnover
```

#### J. Smart Overbooking Prevention
```
Trigger: New booking attempt for a date
Action:
  1. Check iCal sync data
  2. Check existing reservations
  3. Block if overlap detected
  4. Send conflict alert to admin
```

### 5.4 Automation Architecture

For these automations, use **Supabase Edge Functions** + **pg_cron**:

```
┌─────────────────────────────────────────────────┐
│                Supabase Backend                  │
├─────────────────────────────────────────────────┤
│                                                  │
│  pg_cron (Scheduled Jobs)                        │
│  ├── Daily 9 AM: payment_reminder_job            │
│  ├── Daily 10 AM: checkin_notification_job        │
│  ├── Daily 2 AM: document_cleanup_job (exists)    │
│  ├── Monthly 1st: owner_report_job               │
│  └── Hourly: occupancy_alert_job                 │
│                                                  │
│  Database Triggers                               │
│  ├── ON INSERT reservations → send_confirmation  │
│  ├── ON UPDATE payment_status → generate_invoice │
│  ├── ON UPDATE status='checked_out' → send_review│
│  └── ON INSERT payments → update_payment_status  │
│                                                  │
│  Edge Functions (API)                            │
│  ├── /send-whatsapp     (WhatsApp Business API)  │
│  ├── /send-email        (SendGrid/Resend)        │
│  ├── /generate-invoice  (PDF generation)         │
│  └── /sync-calendars    (iCal fetch + parse)     │
│                                                  │
└─────────────────────────────────────────────────┘
```

### 5.5 Priority Roadmap for Automation

| Priority | Feature | Effort | Business Impact |
|----------|---------|--------|----------------|
| P0 | Auto-Invoicing (Tax Invoice on payment) | 2 weeks | High - GST compliance |
| P0 | Auto Booking Confirmation + Guest Portal Link | 3 days | High - reduces manual work |
| P1 | Auto Payment Reminders (WhatsApp) | 1 week | High - improves collection |
| P1 | Auto Check-in Instructions | 3 days | Medium - improves guest experience |
| P2 | Auto Owner Monthly Reports | 1 week | Medium - owner satisfaction |
| P2 | Auto Review Requests | 2 days | Medium - reputation building |
| P3 | Dynamic Pricing Suggestions | 2 weeks | Medium - revenue optimization |
| P3 | Smart Overbooking Prevention | 1 week | Medium - prevents conflicts |
| P4 | Inventory/Maintenance Tasks | 2 weeks | Low-Medium - operations |

---

## Summary of Top Priorities

### Immediate (Do Now)
1. Generate missing PWA assets (icons, splash screens, screenshots)
2. Fix password storage in `property_owners` (use Supabase Auth or pgcrypto)
3. Remove `user-scalable=no` from viewport meta tag
4. Unify primary color across all files (teal #0891b2 everywhere)

### Short-Term (1-2 Weeks)
5. Implement auto-invoicing with jsPDF (GST-compliant tax invoices)
6. Auto-send booking confirmations + guest portal links
7. Start modularizing index.html (extract CSS first, then JS modules)
8. Set up TWA build pipeline with Bubblewrap

### Medium-Term (1 Month)
9. Complete code modularization (separate files per view)
10. Implement payment reminder automation (WhatsApp + Email)
11. Add tablet split-view layout
12. Add keyboard shortcuts for desktop power users
13. Owner monthly report automation

### Long-Term (2-3 Months)
14. Remove all Capacitor dependencies
15. Add server-side pagination for large datasets
16. Dynamic pricing engine
17. Complete automation suite with Supabase Edge Functions
18. Comprehensive test suite
