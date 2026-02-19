# ResIQ Android App - Build & Deploy Guide

This guide will help you build and deploy ResIQ as an Android APK for Google Play Store.

## 📋 Prerequisites

### Required Software
1. **Node.js** (v18 or higher)
   ```bash
   node --version  # Should show v18.x or higher
   ```

2. **Android Studio** (Latest version)
   - Download from: https://developer.android.com/studio
   - Install Android SDK (API 34 - Android 14)
   - Install Android SDK Build Tools
   - Install Android Emulator (optional, for testing)

3. **Java Development Kit (JDK)** 17
   ```bash
   java -version  # Should show version 17
   ```

### Optional (for logo generation)
- **ImageMagick** OR **Python 3 with Pillow**

---

## 🚀 Step-by-Step Build Process

### Step 1: Generate Missing Logo Assets

You need logo assets in multiple sizes for the app.

**Option A: Using ImageMagick (Recommended)**
```bash
# Install ImageMagick
# Ubuntu/Debian: sudo apt-get install imagemagick
# macOS: brew install imagemagick

# Run the generation script
./generate-logos.sh
```

**Option B: Using Python**
```bash
# Install Pillow
pip3 install Pillow

# Run the Python script
python3 generate-logos.py
```

**Option C: Manual (Use online tools)**
- Visit https://www.iloveimg.com/resize-image
- Upload `assets/logo.png`
- Resize to: 96x96, 128x128, 256x256, 384x384
- Save as: logo-96.png, logo-128.png, logo-256.png, logo-384.png

### Step 2: Install Dependencies

```bash
# Install npm dependencies
npm install

# This will install Capacitor and required plugins
```

### Step 3: Initialize Capacitor Android Platform

```bash
# Add Android platform
npm run android:install

# This creates the 'android' directory with native Android project
```

### Step 4: Sync Web Code to Android

```bash
# Copy web files and sync plugins
npm run android:sync
```

### Step 5: Open in Android Studio

```bash
# Open the Android project in Android Studio
npm run android:open
```

This will launch Android Studio with your project.

### Step 6: Configure App Signing (For Release Build)

#### Generate Keystore
```bash
cd android/app

# Generate keystore (one-time setup)
keytool -genkey -v -keystore resiq-release-key.keystore \
  -alias resiq-key-alias \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000

# You'll be prompted for:
# - Keystore password (SAVE THIS!)
# - Key password (SAVE THIS!)
# - Your name
# - Organization
# - City
# - State
# - Country code
```

**⚠️ IMPORTANT:** Save your keystore file and passwords securely! You'll need them for all future updates.

#### Update Build Configuration

Edit `android/app/build.gradle`:

```gradle
android {
    ...
    signingConfigs {
        release {
            storeFile file('resiq-release-key.keystore')
            storePassword 'YOUR_KEYSTORE_PASSWORD'
            keyAlias 'resiq-key-alias'
            keyPassword 'YOUR_KEY_PASSWORD'
        }
    }
    
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

### Step 7: Build the APK/AAB

#### Option A: Build APK (For testing/direct distribution)
```bash
# In Android Studio:
# Build → Generate Signed Bundle/APK → APK
# OR from terminal:
cd android
./gradlew assembleRelease
# Output: android/app/build/outputs/apk/release/app-release.apk
```

#### Option B: Build AAB (For Play Store - Recommended)
```bash
# In Android Studio:
# Build → Generate Signed Bundle/APK → Android App Bundle
# OR from terminal:
cd android
./gradlew bundleRelease
# Output: android/app/build/outputs/bundle/release/app-release.aab
```

### Step 8: Test the App

#### Test on Emulator
```bash
# Start emulator from Android Studio or:
emulator -avd <your_emulator_name>

# Install and run
npm run android:run
```

#### Test on Real Device
```bash
# Enable USB Debugging on your Android phone
# Connect via USB
# Run:
adb devices  # Should show your device
npm run android:run
```

#### Manual Installation
```bash
# Install APK on connected device
adb install android/app/build/outputs/apk/release/app-release.apk
```

---

## 📱 Google Play Store Submission

### 1. Create Play Console Account
- Go to: https://play.google.com/console
- Pay $25 one-time registration fee
- Complete account setup

### 2. Create New App Listing

1. **App Details**
   - App name: ResIQ by Hostizzy
   - Default language: English
   - App type: App
   - Free/Paid: Free

2. **Store Listing**
   - Short description (80 chars):
     ```
     Property Management System for vacation rentals. Manage bookings, guests & payments.
     ```
   
   - Full description (4000 chars):
     ```
     ResIQ is a comprehensive Property Management System designed for vacation rental owners and hotel operators.

     KEY FEATURES:
     • Reservation Management - Track all bookings in one place
     • Guest Database - Store guest information and history
     • Payment Tracking - Monitor payments and outstanding balances
     • KYC Document Management - Secure document storage
     • Analytics Dashboard - Insights into revenue and occupancy
     • Property Portfolio - Manage multiple properties
     • Dark Mode - Easy on the eyes
     • Offline Mode - Works without internet
     • Owner Portal - Separate view for property owners

     PERFECT FOR:
     - Vacation rental owners
     - Small hotels and hostels
     - Property managers
     - Airbnb hosts
     - Boutique accommodations

     SIMPLE & POWERFUL:
     ResIQ combines powerful features with an intuitive interface. No complex setup required - start managing your properties in minutes.

     SECURE & PRIVATE:
     Your data is encrypted and secure. We follow industry best practices for data protection.

     Support: support@hostizzy.com
     ```

3. **App Icon**
   - Upload: `assets/logo-512.png` (512x512)

4. **Feature Graphic**
   - Size: 1024x500px
   - Create using Canva/Figma
   - Include app name and tagline

5. **Screenshots**
   Required:
   - Phone: Minimum 2, maximum 8 (16:9 or 9:16 ratio)
   - 7-inch Tablet: Optional
   - 10-inch Tablet: Optional

   Take screenshots of:
   - Login screen
   - Dashboard
   - Reservations list
   - Add booking screen
   - Analytics view
   - Guest documents
   - Owner portal

6. **Categorization**
   - App category: Business
   - Tags: hotel, property management, vacation rental, booking

7. **Contact Details**
   - Email: support@hostizzy.com
   - Website: (your website)
   - Phone: (optional)

8. **Privacy Policy**
   - Upload your privacy.html to a public URL
   - Link: https://yoursite.com/privacy.html

### 3. Content Rating

Complete the questionnaire:
- Select "Utility, Productivity, Communication or Other"
- Answer questions honestly
- Typical rating: Everyone

### 4. App Content

- Privacy Policy: Link to privacy.html
- Ads: No (assuming no ads)
- Target audience: All ages
- News app: No

### 5. Store Settings

- App availability: Available
- Countries: Select target countries
- Pricing: Free

### 6. Upload Release

1. **Production Track**
   - Upload AAB file
   - Release name: "Initial Release - v1.0.0"
   - Release notes:
     ```
     Initial release of ResIQ Property Management System
     
     Features:
     • Reservation management
     • Guest database
     • Payment tracking
     • KYC document storage
     • Analytics dashboard
     • Owner portal
     • Offline mode
     • Dark mode
     ```

2. **Review & Publish**
   - Review all information
   - Submit for review
   - Wait 2-7 days for approval

---

## 🔄 Updating the App

When you make changes:

```bash
# 1. Update version in capacitor.config.json
# 2. Sync changes
npm run android:sync

# 3. Build new release
cd android
./gradlew bundleRelease

# 4. Upload to Play Console (Production track)
# 5. Submit for review
```

**Version Code Rules:**
- Increment version code for each release
- Example: 1.0.0 (code 1), 1.0.1 (code 2), 1.1.0 (code 3)

---

## 🐛 Troubleshooting

### Build Errors

**"SDK location not found"**
```bash
# Create local.properties in android/ directory
echo "sdk.dir=/path/to/Android/Sdk" > android/local.properties
# Replace /path/to/Android/Sdk with your SDK path
```

**"Gradle build failed"**
```bash
# Clean and rebuild
cd android
./gradlew clean
./gradlew build
```

### App Crashes on Startup

1. Check logs:
   ```bash
   adb logcat | grep -i resiq
   ```

2. Common fixes:
   - Clear app data
   - Uninstall and reinstall
   - Check manifest permissions

### Icons Not Showing

```bash
# Regenerate icons
cd android/app/src/main/res
# Replace icon files in mipmap folders
```

---

## 📞 Support

If you encounter issues:

1. Check Android Studio logs
2. Run: `adb logcat`
3. Contact: support@hostizzy.com
4. File issues: GitHub repository

---

## ✅ Pre-Release Checklist

Before submitting to Play Store:

- [ ] All logos generated (96, 128, 192, 256, 384, 512)
- [ ] App tested on multiple devices/screen sizes
- [ ] App tested on different Android versions (10, 11, 12, 13, 14)
- [ ] Offline mode works
- [ ] Push notifications configured
- [ ] Privacy policy accessible
- [ ] Terms of service accessible
- [ ] App signed with release keystore
- [ ] Version code incremented
- [ ] Screenshots prepared
- [ ] Feature graphic created
- [ ] Store listing written
- [ ] Content rating completed
- [ ] No placeholder functions (all features work or hidden)
- [ ] No exposed API keys or secrets
- [ ] App size < 100MB

---

## 🎉 Success!

Once approved, your app will be live on Google Play Store!

Share link: `https://play.google.com/store/apps/details?id=com.hostizzy.resiq`

---

## 📚 Additional Resources

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Android Developer Guide](https://developer.android.com)
- [Play Console Help](https://support.google.com/googleplay/android-developer)
- [App Signing Best Practices](https://developer.android.com/studio/publish/app-signing)

