# ResIQ - Complete Property Management System

![ResIQ Banner](assets/logo-132.png)

> Enterprise-grade Property Management System for vacation rentals, farmhouses, homestays, and villas. Built for independent operators who need complete control over reservations, guests, payments, and team operations.

[![License](https://img.shields.io/badge/License-Proprietary-red.svg)](LICENSE)
[![Version](https://img.shields.io/badge/Version-3.1-blue.svg)](https://github.com/hostizzy/resiq)
[![PWA](https://img.shields.io/badge/PWA-Ready-green.svg)](https://web.dev/progressive-web-apps/)
[![Status](https://img.shields.io/badge/Status-Production-success.svg)](https://resiq.hostizzy.com)

> **⚠️ PROPRIETARY SOFTWARE**
> This software is owned by Hostizzy (Hostsphere India Private Limited).
> Viewing the source code does NOT grant rights to use, copy, modify, or redistribute.
> Commercial usage requires a licensing agreement with Hostizzy.

---

## 🎯 What is ResIQ?

**ResIQ** is a comprehensive, mobile-first property management system built as a Progressive Web App (PWA). It's designed specifically for hospitality businesses in India managing vacation rentals, homestays, farmhouses, and boutique accommodations.

### **Three Portals, One System:**

1. **📊 Main RMS Portal** - For admin & staff to manage everything
2. **👑 Owner Portal** - For property owners to track earnings & bookings
3. **👤 Guest Portal** - For guests to complete KYC & select meals

**Built by**: Ethan, Founder of Hostizzy
**Technology**: Vanilla JavaScript + Supabase + PWA
**Status**: Production-ready, actively maintained

---

## ✨ Complete Feature List

### 📊 **MAIN RMS PORTAL** (Admin/Staff)

#### **1. Home Dashboard**
- 🎯 Today's overview with key metrics (revenue, check-ins, pending documents)
- 📋 Quick action cards (Review KYC Documents, View Today's Check-ins)
- 🧭 Category navigation (Analytics, Properties, Guests, Operations, Management)
- 📈 Real-time statistics and KPIs
- ⚡ Smart automation status display

#### **2. Reservation Management**
- 📅 **Dual View Modes**: Table view & Kanban board
- 🔍 **Advanced Filtering**: Property, status, payment status, date ranges
- 🔄 **Booking Lifecycle**: Pending → Confirmed → Checked-in → Completed → Cancelled
- 💰 **Payment Integration**: Track payment status with each reservation
- 👥 **Guest Details**: Names, phone, adults, children, special requests
- 💵 **Revenue Breakdown**: Stay amount, meals, extras, total, commission
- 📱 **Mobile Responsive**: Card view for mobile, table for desktop
- 🔔 **Auto Status Updates**: Automatic check-in/check-out based on dates (every hour)
- 📤 **Export**: Download reservations as Excel/CSV

#### **3. Payment Collections & Tracking**
- 💳 **Payment History**: Complete payment tracking by month and property
- 🏦 **Payment Methods**: Cash, Card, UPI, Bank Transfer, Online
- 👤 **Recipient Tracking**: Payments to Owner vs. Payments to Hostizzy
- 📊 **Payment Status**: Pending, Partial, Paid
- 🔢 **Reference Numbers**: Track transaction IDs
- 💼 **Payout Filters**: Eligible, Already Paid Out
- 📈 **Summary Cards**: Total, To Owner, To Hostizzy breakdowns
- 📆 **Month Filters**: Filter by payment month

#### **4. Guest Management**
- 👥 **Guest Directory**: Complete guest list with contact information
- 🆔 **KYC Document Review**: Review ID proofs, selfies, verification status
- ✅ **Bulk Actions**: Approve/reject multiple KYC documents at once
- 📝 **Admin Notes**: Add internal notes to guest profiles
- ❌ **Rejection Reasons**: Document why KYC was rejected
- 🔄 **Real-time Sync**: Updates sync with guest portal instantly
- 🔍 **Search**: Find guests by name, phone, booking ID

#### **5. Guest Document Management (KYC)**
- 📄 **Document Types**: Aadhar, Passport, Driver's License, Voter ID
- 📸 **Document Upload**: Front, back, and selfie photos
- 🎯 **Status Tracking**: Incomplete, Pending Review, Verified, Rejected
- 👨‍💼 **Review Workflow**: Admin approval interface with image preview
- 💬 **Admin Notes**: Internal comments and rejection reasons
- 🔔 **Notifications**: Alert admins when new docs submitted
- 📊 **Progress Tracking**: See KYC completion percentage per booking

#### **6. Meal Planning & Management**
- 🍽️ **Meal Types**: Breakfast, Lunch, Dinner, Barbeque
- 🥗 **Dietary Preferences**: Vegetarian, Non-veg, Jain, Vegan, Gluten-free
- 🌶️ **Special Requests**: Spicy, No spice, Extra oil, custom requests
- ✅ **Approval Workflow**: Review and approve meal selections
- 📅 **Date-wise Tracking**: See meals per day per guest
- 🔄 **Guest Portal Integration**: Guests select meals, admins approve
- 📊 **Kitchen Reports**: Export meal lists for kitchen staff

#### **7. Property Management**
- 🏠 **Multi-Property Support**: Manage unlimited properties
- 📝 **Property Details**: Name, location, type, capacity, amenities
- 💰 **Commission Rates**: Set revenue share percentage per property
- 👥 **Owner Association**: Link properties to owners
- 📊 **Performance Metrics**: Track occupancy, revenue per property
- 🔄 **Property Status**: Active/inactive property management

#### **8. Business Intelligence & Analytics**
- 📊 **Date Range Filters**: Analyze data by custom date ranges
- 💹 **Revenue Analytics**: Total revenue, owner share, commission breakdown
- 📈 **Booking Trends**: Track booking patterns over time
- 👥 **Guest Demographics**: Analyze guest sources and behavior
- 💳 **Payment Patterns**: Payment method analysis
- 📥 **Export Reports**: Download data as Excel/CSV
- 🎯 **Custom Reports**: Build reports based on filters

#### **9. Financial & Performance Analytics**
- 💰 **Revenue Dashboard**: Monthly, quarterly, annual revenue views
- 📊 **Multi-Property Comparison**: Compare properties side-by-side
- 📈 **Trend Analysis**: Identify seasonal patterns
- 🎯 **Occupancy Rates**: Track property utilization
- 💵 **Average Booking Value**: Revenue per booking analysis
- 📉 **Performance Metrics**: KPIs and growth indicators

#### **10. Team Management**
- 👥 **Staff Directory**: Manage team members
- 🔐 **Role-Based Access**: Admin, Manager, Staff roles
- ✅ **Permissions**: Granular access control
- 📊 **Activity Tracking**: Monitor team member actions
- 🏢 **Property Assignment**: Assign staff to specific properties

#### **11. Owner Management**
- 👑 **Owner Profiles**: Complete owner information
- 🏠 **Property Links**: Associate properties with owners
- 💰 **Commission Tracking**: Track Hostizzy commission per owner
- 💳 **Bank Details**: Store bank account information
- 📊 **Payout Management**: Manage owner payouts

#### **12. Availability Management**
- 📅 **Calendar View**: Visual availability tracking
- 🚫 **Block Dates**: Manually block dates
- 🔄 **iCal Sync**: Sync with Airbnb, Booking.com (auto-sync every 6 hours)
- 🎨 **Visual States**: Available, Booked, Blocked color coding
- 📊 **Occupancy View**: See monthly occupancy at a glance

#### **13. Communication System**
- 📧 **Template Messaging**: Pre-built message templates
- 📱 **SMS/Email**: Send notifications to guests
- 💬 **Guest Communication**: Track all guest conversations
- 📢 **Bulk Messaging**: Send messages to multiple guests
- 🔔 **Automated Alerts**: Check-in reminders, payment confirmations

#### **14. Settings & Configuration**
- 👤 **User Profile**: Manage admin account
- 🎨 **Theme Toggle**: Light mode / Dark mode
- 🤖 **Smart Automation**: Enable/disable auto check-in/check-out
- ⏰ **Automation Interval**: Configure automation frequency (15, 30, 60 min)
- 🔔 **Notifications**: Configure notification preferences
- ⚙️ **App Preferences**: Customize app behavior

#### **15. Smart Automation Engine**
- ⏰ **Auto Check-in/Check-out**: Automatic status updates based on dates
- 🔄 **Runs Every 30 Minutes**: Configurable interval (desktop)
- 🔄 **Runs Every 60 Minutes**: Battery-optimized for mobile
- 🎯 **Status Automation**: Confirmed → Checked-in → Checked-out → Completed
- 📅 **Date-based**: Triggers based on check-in/check-out dates
- 🔕 **Can be Disabled**: Toggle on/off in settings

---

### 👑 **OWNER PORTAL** (Property Owners)

#### **1. Home Dashboard**
- 💰 **Quick Stats**: Total revenue, total guests, Hostizzy commission, net earnings, pending payout
- 📊 **Revenue Percentage**: Average commission rate display
- 🎯 **Navigation Cards**: Quick access to Analytics, Bookings, Payments, Calendar, Payouts
- 📈 **Recent Activity**: Last 10 bookings overview

#### **2. Analytics Dashboard**
- 📈 **Monthly Revenue Trend** (Line Chart)
  - Total Revenue trend line
  - Your Earnings trend line
  - All months displayed (not just last 6)
  - Interactive hover tooltips

- 🥧 **Revenue Split** (Pie Chart)
  - Your Earnings vs. Hostizzy Commission
  - Percentage breakdown
  - Amount in rupees

- 📊 **Property Performance** (Dual-Axis Bar Chart)
  - Total Revenue per property (left axis)
  - Total Nights per property (right axis)
  - All months aggregated

- 📅 **Month-by-Month Breakdown**
  - Stay Revenue + Meal Revenue breakdown
  - Total Revenue
  - Hostizzy Commission
  - Your Earnings
  - Booking count per month
  - Filter by: Last 6 months, Last 12 months, All time, or specific month

#### **3. Bookings View**
- 📋 **Complete Booking List**: All bookings for owner's properties
- 🔍 **Search**: By booking ID, guest name, guest phone
- 🎛️ **Filters**: Property, booking status, payment status
- 📊 **Summary Cards**: Completed, Confirmed, Checked-in, Pending counts
- 💰 **Revenue Details**: Stay amount, meals, extras, total, commission, earnings
- 📅 **Date Display**: Check-in, check-out, nights
- 👥 **Guest Info**: Name, phone, adults, children
- 📱 **Mobile Optimized**: Card layout on mobile, table on desktop

#### **4. Payment Collections**
- 💳 **Payment Tracking**: All payments for owner's properties
- 📆 **Month Filter**: Filter by payment month
- 🏠 **Property Filter**: Filter by specific property
- 📊 **Summary Cards**: Total payments, Payments to Owner, Payments to Hostizzy
- 💵 **Payment Details**: Amount, method, recipient, reference number, date
- 🔍 **Payment History**: Complete payment audit trail

#### **5. Availability Calendar**
- 📅 **Monthly Calendar**: Visual booking calendar
- ◀️▶️ **Month Navigation**: Browse past and future months
- 🏠 **Property Selection**: Filter by specific property
- 🎨 **Visual States**:
  - 🟢 Available (green)
  - 🔵 Booked (blue) - shows guest name
  - 🔴 Blocked (red)
- 👆 **Click for Details**: Tap any booked day to see booking info
- 📊 **Booking Details**: Guest name, dates, amount, payment status

#### **6. Settlement Tracking (Payouts & Settlements)**
- 📊 **Monthly Settlements** (Since November 2024)
  - 💳 Total Commission from bookings
  - 🏢 Hostizzy Payment (received by Hostizzy)
  - 💰 Owner Payment (received by Owner)
  - 📈 **Net Settlement**: Hostizzy Payment - Total Commission
  - ✅ **Status Display**:
    - Positive: "Payout Pending: ₹X" (Hostizzy owes Owner)
    - Negative: "Payment Pending: ₹X" (Owner owes Hostizzy)
    - Zero: "Settled: No payment due"
  - 🔘 **Action Buttons**: Mark Payout Received / Mark Payment Done
  - 🎯 **Current Month Highlighted**: Purple gradient background

- 📝 **Payout Request History**
  - Request date, amount, method (Bank Transfer/UPI)
  - Status: Pending, Approved, Processing, Completed, Rejected
  - Processed date, transaction ID
  - Admin notes and owner notes

- **Settlement Calculation Logic**:
  - Based on reservation check-in month (NOT payment date)
  - Commission fixed per booking (from `hostizzy_revenue`)
  - Example: Oct payment for Nov booking → counts in Nov settlement
  - Simple formula: Net = Hostizzy Payment - Total Commission

#### **7. Bank Details Management**
- 🏦 **Account Information**:
  - Account holder name
  - Bank account number
  - IFSC code
  - Bank name
  - Branch details
  - UPI ID (optional)
- ✅ **Validation**: Ensures required fields filled
- 💾 **Secure Storage**: Bank details stored securely

#### **8. Properties View**
- 🏠 **Owner's Properties**: List of all linked properties
- 📍 **Property Details**: Name, location, type, capacity
- 💰 **Commission Rate**: Hostizzy commission percentage per property
- 📊 **Performance**: Revenue and occupancy metrics

---

### 👤 **GUEST PORTAL** (Guest-Facing)

#### **1. Booking Verification**
- 🔑 **Access Control**: Booking code + phone number verification
- 🎯 **Session Creation**: Secure token-based sessions
- ❌ **Error Handling**: Clear messages for invalid bookings
- 🔒 **Security**: Token expires after 24 hours

#### **2. Guest Names Entry**
- 👤 **Primary Guest**: Auto-filled from booking
- 👥 **Additional Guests**: Dynamic form based on adult count
- ✅ **Validation**: Ensure all names entered before proceeding
- 💾 **Auto-save**: Names saved as entered

#### **3. Guest Dashboard**
- 📋 **Reservation Summary**:
  - Check-in and check-out dates
  - Number of nights
  - Guest count (adults + children)
  - Property name

- 💰 **Payment Breakdown**:
  - Stay amount
  - Meals/Chef charges
  - Bonfire/Other extras
  - Extra guest charges
  - Total amount
  - Amount paid vs. pending
  - Payment status badge (Fully Paid, Partial, Pending)

- 🆔 **KYC Progress Tracking**:
  - Status per guest (Incomplete, Pending Review, Verified, Rejected)
  - Visual progress indicators
  - Click to complete KYC for each guest

- 🍽️ **Meal Selection Card** (unlocked after all guests verified)
  - Shows when meal selection is available
  - Click to open meal selection interface

#### **4. Guest KYC Form**
- 📝 **Personal Information**:
  - Full name (pre-filled from guest names)
  - Age (with minor/adult validation)
  - Email address
  - Phone number

- 🆔 **ID Document Upload**:
  - ID type selection (Aadhar, Passport, Driver's License, Voter ID)
  - ID number input
  - Front photo upload
  - Back photo upload
  - File size optimization (auto-compress large images)

- 📸 **Selfie Upload** (Primary guest only):
  - Live camera capture
  - Environment/user camera selection
  - Preview before submit

- 🧒 **Minor Handling**:
  - Minors (age < 18) auto-verified
  - No document upload required for minors
  - Automatic status: "Verified (Minor)"

- ✅ **Submission**:
  - Real-time validation
  - Upload progress indicator
  - Success/error messages

#### **5. Meal Selection Interface**
- 📅 **Date Range Display**: Show reservation dates and guest count

- 🍽️ **Meal Type Selection**:
  - ☀️ Breakfast
  - 🌞 Lunch
  - 🌙 Dinner
  - 🔥 Barbeque
  - Checkbox selection with quantity limits

- 🥗 **Dietary Preferences**:
  - Vegetarian
  - Non-Vegetarian
  - Jain
  - Vegan
  - Gluten-Free
  - Multiple selections allowed

- 🌶️ **Special Requests**:
  - Spicy
  - No Spice
  - Less Oil
  - Extra Oil
  - No Onion/Garlic
  - Custom text input for other requests

- 💾 **Save & Edit**: Meal selections saved, can edit until approved

#### **6. Real-time Status Updates**
- 🔔 **KYC Approval Notifications**: Instant status updates when admin approves
- 🔄 **Polling Mechanism**: Checks for updates every 5 seconds
- ✅ **Approval Badges**: Visual confirmation of verified status
- 📊 **Progress Display**: See which guests are pending verification

---

## 🏗️ System Architecture

### **Three-Tier Architecture**

```
┌─────────────────────────────────────────────┐
│         PRESENTATION LAYER (PWA)            │
├─────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │   Main   │  │  Owner   │  │  Guest   │ │
│  │   RMS    │  │  Portal  │  │  Portal  │ │
│  └──────────┘  └──────────┘  └──────────┘ │
├─────────────────────────────────────────────┤
│         SERVICE LAYER (JavaScript)          │
├─────────────────────────────────────────────┤
│  • Authentication    • Reservations         │
│  • Payments          • Settlements          │
│  • Guest KYC         • Analytics            │
├─────────────────────────────────────────────┤
│         DATA LAYER (Supabase)               │
├─────────────────────────────────────────────┤
│  PostgreSQL Database + Real-time + Auth     │
├─────────────────────────────────────────────┤
│         OFFLINE LAYER (Service Worker)      │
├─────────────────────────────────────────────┤
│  • Cache Strategy    • Background Sync      │
│  • Offline Fallback  • Push Notifications   │
└─────────────────────────────────────────────┘
```

### **Database Tables**

- **reservations** - Booking information, dates, amounts
- **payments** - Payment tracking, methods, recipients
- **properties** - Property details, commission rates
- **property_owners** - Owner profiles, bank details
- **guest_documents** - KYC documents, verification status
- **guest_meal_preferences** - Meal selections, dietary preferences
- **synced_availability** - External calendar sync (iCal)
- **payout_requests** - Owner payout requests and history
- **team_members** - Staff accounts and permissions

---

## 🚀 Tech Stack

| Component | Technology |
|-----------|-----------|
| **Frontend** | Vanilla JavaScript (ES6+), HTML5, CSS3 |
| **Backend** | Supabase (PostgreSQL, Authentication, Real-time) |
| **Charts** | Chart.js 3.x |
| **Storage** | LocalStorage (sessions), Service Worker Cache |
| **PWA** | Service Worker API, Web App Manifest |
| **Mobile Optimization** | CSS Media Queries, Mobile-first design |
| **Timezone** | IST (Indian Standard Time) with custom utilities |

### **Why Vanilla JavaScript?**
- ⚡ **Performance**: 95+ Lighthouse score, instant load times
- 📦 **Zero Dependencies**: No npm packages, no build process
- 🎯 **Smaller Bundle**: 1.1MB total (vs. 5MB+ for React apps)
- 🔒 **Security**: Complete control over code execution
- 🚀 **Deployment**: Drop files on any server, no build step

---

## 📱 Progressive Web App Features

- **✅ Installable**: Add to home screen on mobile/desktop
- **🔌 Offline Mode**: Works without internet connection
- **🔔 Push Notifications**: Real-time alerts
- **📲 App-like Experience**: No browser chrome, native feel
- **🔄 Background Sync**: Sync data when connection restored
- **⚡ Fast Loading**: Service worker caching for instant loads
- **📱 Responsive**: Perfect on phones, tablets, desktops
- **🌙 Dark Mode**: Automatic theme switching

---

## 📊 Performance Metrics

- **⚡ Load Time**: < 2 seconds on 4G
- **📱 Mobile Optimized**: Loads only last 60 days on mobile
- **🔄 Offline Mode**: Works for 7 days without sync
- **👥 Concurrent Users**: Tested with 100+ simultaneous users
- **💾 Cache Strategy**: 85% cache hit rate
- **🎨 Lighthouse Score**: 95+ Performance, 100 PWA

---

## 🎨 User Experience

### **Main RMS Portal**
- Dark/Light mode toggle
- Mobile-first responsive design
- Kanban board for visual reservation management
- Advanced filters with saved preferences
- Export to Excel functionality
- Real-time data updates

### **Owner Portal**
- Beautiful analytics charts
- Month-by-month revenue breakdown
- Settlement tracking with clear status
- Mobile-optimized card layouts
- IST timezone for accurate dates

### **Guest Portal**
- Simple 3-step workflow: Verify → KYC → Meals
- Mobile-optimized for phone cameras
- Real-time status updates
- Clear progress indicators
- Easy document uploads

---

## 🔐 Security Features

- ✅ **Authentication**: Supabase email/password authentication
- ✅ **Session Management**: Secure token-based sessions
- ✅ **Role-Based Access**: Admin, Owner, Guest permissions
- ✅ **Input Validation**: All inputs sanitized and validated
- ✅ **Audit Logging**: Track all user actions
- ✅ **Data Encryption**: Sensitive data encrypted at rest

---

## 📈 Business Intelligence

### **Analytics Capabilities**
- Revenue trends over time
- Property performance comparison
- Guest booking patterns
- Payment collection analysis
- Occupancy rates
- Commission tracking
- Settlement forecasting

### **Reports Available**
- Monthly revenue reports
- Owner payout summaries
- Guest KYC compliance
- Payment collection status
- Booking source analysis
- Property utilization rates

---

## 🔄 Real-time Features

- **Live Updates**: Guest KYC status, booking changes
- **Polling System**: 5-second checks for updates (guest portal)
- **Auto Status Updates**: Automatic check-in/check-out (every hour)
- **Settlement Tracking**: Real-time payment and payout tracking
- **Smart Automation**: Runs every 30 min (desktop) / 60 min (mobile)

---

## 📝 Changelog

### **v3.1.0** (Current - December 2024)
- ✅ Simplified settlement calculation (booking-based commission)
- ✅ IST timezone utilities to prevent date shifting
- ✅ Mobile performance optimizations (60-day data loading on mobile)
- ✅ Smart automation mobile optimization (60-min interval)
- ✅ Owner Portal analytics enhancements (all months, dual-axis charts)
- ✅ Settlement tracking from November 2024 onwards
- ✅ Payment recipient tracking (Owner vs. Hostizzy)
- ✅ Fixed settlement date calculation (based on reservation month, not payment date)

### **v3.0.0**
- ✅ Guest Portal integration with KYC workflow
- ✅ Owner Portal with analytics dashboard
- ✅ Meal management system
- ✅ Smart Automation Engine
- ✅ Mobile responsiveness improvements

### **v2.0.0**
- ✅ Multi-property support
- ✅ Payment tracking with commission splits
- ✅ Revenue analytics with charts
- ✅ Offline mode support
- ✅ PWA implementation

### **v1.0.0**
- ✅ Basic reservation management
- ✅ Guest KYC workflow
- ✅ iCal sync with OTAs
- ✅ Payment tracking

---

## 🤝 Support & Resources

**Documentation:**
- [Guest Portal Deployment Guide](GUEST_PORTAL_DEPLOYMENT_GUIDE.md)
- [Owner Portal Quickstart](OWNER_PORTAL_QUICKSTART.md)
- [PWA Audit & Improvements](PWA_AUDIT_AND_IMPROVEMENTS.md)
- [Revenue Share Population Guide](REVENUE_SHARE_POPULATION_GUIDE.md)

**External Resources:**
- [Supabase Documentation](https://supabase.com/docs)
- [PWA Guide](https://web.dev/progressive-web-apps/)
- [Chart.js Documentation](https://www.chartjs.org/docs/)

---

## 📄 License

**Proprietary Software**

© 2025 Hostizzy (Hostsphere India Private Limited). All rights reserved.

This software is proprietary and confidential. Unauthorized copying, modification, distribution, or use is strictly prohibited without explicit written permission from Hostizzy.

**Built by Ethan, Founder of Hostizzy**

**For licensing inquiries**: partnerships@hostizzy.com

---

## 🌟 About Hostizzy

Hostizzy empowers independent hosts and property managers across India to deliver exceptional hospitality experiences. We combine technology, local expertise, and customer service to help you maximize your property's potential.

### **Our Mission**
To democratize hospitality technology and make professional property management accessible to everyone.

### **Our Vision**
A world where every property owner can compete with large hotel chains through smart technology and data-driven insights.

---

## 🔗 Connect

- 🌐 **Website**: [hostizzy.com](https://hostizzy.com)
- 💼 **LinkedIn**: [linkedin.com/company/hostizzy](https://linkedin.com/company/hostizzy)
- 📸 **Instagram**: [@hostizzy](https://instagram.com/hostizzy)

---

<div align="center">

### Built with ❤️ for hospitality professionals in India

**ResIQ v3.1** | Last Updated: December 2024

</div>
