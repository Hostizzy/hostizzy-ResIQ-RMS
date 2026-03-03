# Plan: Replace Logo & Update Branding to "ResIQ - Hospitality OS"

## Pre-requisite
The user must provide the new logo as a high-resolution PNG file (ideally 512x512 or larger). The screenshot shared shows the design but we need the actual asset file to generate all required sizes.

---

## Step 1: Generate All Required Logo Sizes

From the new logo source file, generate these PNGs using a script (ImageMagick/sharp):

| File | Size | Notes |
|------|------|-------|
| `assets/logo.png` | 512x512 | Main logo (replace existing) |
| `assets/logo-132.png` | 132x132 | Navbar logo (replace existing) |
| `assets/logo-192.png` | 192x192 | PWA icon (replace existing) |
| `assets/logo-192-maskable.png` | 192x192 | Maskable PWA icon (replace existing) |
| `assets/logo-512-maskable.png` | 512x512 | Maskable PWA icon (replace existing) |
| `assets/logo-96.png` | 96x96 | **NEW** - currently missing, referenced in manifest |
| `assets/logo-120.png` | 120x120 | **NEW** - currently missing, referenced in index.html |
| `assets/logo-128.png` | 128x128 | **NEW** - currently missing, referenced in manifest |
| `assets/logo-152.png` | 152x152 | **NEW** - currently missing, referenced in index.html |
| `assets/logo-167.png` | 167x167 | **NEW** - currently missing, referenced in index.html |
| `assets/logo-180.png` | 180x180 | **NEW** - currently missing, referenced in index.html |
| `assets/logo-256.png` | 256x256 | **NEW** - currently missing, referenced in manifest |
| `assets/logo-384.png` | 384x384 | **NEW** - currently missing, referenced in manifest |

For maskable icons: add padding (safe zone) around the logo so it renders correctly when cropped to circles/rounded squares by the OS.

---

## Step 2: Update Branding Text — "by Hostizzy" → "Hospitality OS"

### index.html
- **Line 37**: `<title>ResIQ by Hostizzy - Reservation Management System</title>` → `<title>ResIQ - Hospitality OS</title>`
- **Line 106**: Splash screen `<p>by Hostizzy</p>` → `<p>Hospitality OS</p>`
- **Line 419**: Login screen `<p>Property Management System</p>` → `<p>Hospitality OS</p>`
- **Line 520**: Footer `ResIQ by Hostizzy • Version 1.0.0` → `ResIQ - Hospitality OS • Version 1.0.0`

### about.html
- **Line 13**: `<title>About & Help - ResIQ by Hostizzy</title>` → `<title>About & Help - ResIQ - Hospitality OS</title>`
- **Line 325**: `<p class="app-tagline">by Hostizzy</p>` → `<p class="app-tagline">Hospitality OS</p>`

### owner-portal.html
- **Line 9**: `<title>Owner Portal - ResIQ by Hostizzy</title>` → `<title>Owner Portal - ResIQ - Hospitality OS</title>`
- **Line 1354**: Footer text update

### privacy.html
- **Line 17**: Title tag update
- **Line 198**: Body text update

### terms.html
- **Line 13**: Title tag update
- **Line 332**: Body text update

### guest-portal.html
- **Line 7**: Meta description update
- **Line 8**: `<title>Hostizzy Guest Portal v2</title>` → `<title>ResIQ Guest Portal</title>`
- **Line 565**: `<h1>🏠 Hostizzy Guest Portal</h1>` → `<h1>🏠 ResIQ Guest Portal</h1>`

### manifest.json
- **Line 2**: `"name": "ResIQ by Hostizzy"` → `"name": "ResIQ - Hospitality OS"`
- **Line 4**: Update description

### twa-manifest.json
- **Line 4**: `"name": "ResIQ by Hostizzy"` → `"name": "ResIQ - Hospitality OS"`

### guest-manifest.json
- **Line 2**: `"name": "Hostizzy Guest Portal v2"` → `"name": "ResIQ Guest Portal"`
- **Line 4**: Update description

### .github/workflows/build-android.yml
- **Line 186**: Update release text

### WhatsApp templates (index.html)
- **Line 6039**: Booking confirmation header update
- **Line ~23788**: WhatsApp message text update

---

## Step 3: Update Alt Text for Logo Images

All `alt="ResIQ Logo"` references are fine (name "ResIQ" stays the same). No changes needed here.

---

## Step 4: Update Service Worker Cache Version

### sw.js
- Bump the cache version string so existing users get the new logo assets on next visit

### guest-sw.js
- Bump the cache version string

---

## Step 5: Verify & Test

- Confirm all 13 logo sizes exist in `assets/`
- Confirm splash screen shows new logo + "Hospitality OS"
- Confirm login screen shows new logo + "Hospitality OS"
- Confirm navbar shows new logo
- Confirm mobile header shows new logo
- Confirm PWA install prompt uses new icon
- Confirm guest portal shows updated branding
- Confirm about page shows new logo + tagline
- Confirm CSV exports / WhatsApp messages use updated branding

---

## Files Modified (Total: ~15 files)

| File | Changes |
|------|---------|
| `assets/logo*.png` (13 files) | Replace with new logo at all sizes |
| `index.html` | Branding text (4 places) + alt text stays |
| `about.html` | Title + tagline |
| `owner-portal.html` | Title + footer |
| `guest-portal.html` | Title + header + meta |
| `privacy.html` | Title + body text |
| `terms.html` | Title + body text |
| `offline.html` | No text changes (logo auto-updates via file replacement) |
| `manifest.json` | App name + description |
| `guest-manifest.json` | App name + description |
| `twa-manifest.json` | App name |
| `sw.js` | Cache version bump |
| `guest-sw.js` | Cache version bump |
| `onboarding.js` | Alt text (stays same) |
| `.github/workflows/build-android.yml` | Release text |
