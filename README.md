# ResIQ - Property Management System

![ResIQ Banner](assets/logo-132.png)

> Property Management System for vacation rentals, farmhouses, homestays, and villas. Built for independent operators who need complete control over reservations, guests, payments, and team operations.

[![License](https://img.shields.io/badge/License-Proprietary-red.svg)](LICENSE)
[![Version](https://img.shields.io/badge/Version-4.0-blue.svg)](https://github.com/hostizzy/resiq)
[![PWA](https://img.shields.io/badge/PWA-Ready-green.svg)](https://web.dev/progressive-web-apps/)
[![Status](https://img.shields.io/badge/Status-Production-success.svg)](https://resiq.hostizzy.com)

> **PROPRIETARY SOFTWARE**
> This software is owned by Hostizzy (Hostsphere India Private Limited).
> Viewing the source code does NOT grant rights to use, copy, modify, or redistribute.
> Commercial usage requires a licensing agreement with Hostizzy.

---

## What is ResIQ?

**ResIQ** is a mobile-first property management system built as a Progressive Web App (PWA). Designed for hospitality businesses managing vacation rentals, homestays, farmhouses, and boutique accommodations.

### Three Portals, One System

| Portal | Audience | Purpose |
|--------|----------|---------|
| **Main RMS** | Admin & Staff | Manage reservations, payments, guests, properties, and analytics |
| **Owner Portal** | Property Owners | Track earnings, bookings, settlements, and availability |
| **Guest Portal** | Guests | Complete KYC verification and select meals |

**Built by**: Ethan, Founder of Hostizzy
**Technology**: Vanilla JavaScript + Supabase + Firebase Auth + PWA

---

## Features

### Main RMS Portal (Admin/Staff)

- **Dashboard** — Today's overview with key metrics, quick actions, and real-time KPIs
- **Reservations** — Dual view (table + kanban), advanced filters, booking lifecycle management, auto status updates
- **Payments** — Complete payment tracking with method, recipient, and reference tracking
- **Guest Management** — Guest directory, KYC document review, bulk approve/reject
- **Guest Documents (KYC)** — Aadhar, Passport, DL, Voter ID upload with admin review workflow
- **Meal Planning** — Meal types, dietary preferences, approval workflow, kitchen reports
- **Properties** — Multi-property support with commission rates and owner association
- **Analytics** — Revenue trends, booking patterns, property performance, exportable reports
- **Team Management** — Staff directory with role-based access (Admin, Manager, Staff)
- **Owner Management** — Owner profiles, commission tracking, payout management
- **Availability** — Calendar view with iCal sync (Airbnb, Booking.com), date blocking
- **Communication** — Template messaging, SMS/email notifications, automated alerts
- **Smart Automation** — Auto check-in/check-out based on dates (configurable intervals)
- **Settings** — Theme toggle (light/dark), automation config, notification preferences

### Owner Portal (Property Owners)

- **Dashboard** — Revenue stats, commission rates, quick navigation
- **Analytics** — Monthly revenue trends, revenue split charts, property performance comparison
- **Bookings** — Complete booking list with search, filters, and revenue details
- **Payments** — Payment tracking by month and property with summary cards
- **Availability Calendar** — Monthly view with visual booking states
- **Settlements** — Monthly settlement tracking with net payout calculation and action buttons
- **Bank Details** — Secure account info management (account, IFSC, UPI)
- **Properties** — Owner's linked properties with performance metrics

### Guest Portal (Guest-Facing)

- **Booking Verification** — Code + phone number access with secure token sessions
- **Guest Names** — Dynamic form for all adult guests
- **Dashboard** — Reservation summary, payment breakdown, KYC progress
- **KYC Form** — Personal info, ID document upload, selfie capture, minor auto-verification
- **Meal Selection** — Meal types, dietary preferences, special requests
- **Real-time Updates** — 5-second polling for KYC approval status

---

## Architecture

```
┌─────────────────────────────────────────────┐
│         PRESENTATION LAYER (PWA)            │
├──────────┬──────────┬──────────┤
│   Main   │  Owner   │  Guest   │
│   RMS    │  Portal  │  Portal  │
├──────────┴──────────┴──────────┤
│         SERVICE LAYER (JavaScript)          │
│  Auth · Reservations · Payments · KYC       │
│  Analytics · Settlements · Automation       │
├─────────────────────────────────────────────┤
│         DATA LAYER                          │
│  Supabase (PostgreSQL) + Firebase Auth      │
├─────────────────────────────────────────────┤
│         OFFLINE LAYER (Service Worker)      │
│  Cache Strategy · Background Sync           │
└─────────────────────────────────────────────┘
```

### Database Tables

`reservations` · `payments` · `properties` · `property_owners` · `guest_documents` · `guest_meal_preferences` · `synced_availability` · `payout_requests` · `team_members`

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | Vanilla JavaScript (ES6+), HTML5, CSS3 |
| Backend | Supabase (PostgreSQL, Real-time), Firebase Authentication |
| Charts | Chart.js |
| PWA | Service Worker API, Web App Manifest |
| Deployment | Vercel |

### Why Vanilla JavaScript?

- **Performance** — 95+ Lighthouse score, instant load times
- **Zero Framework Dependencies** — No React/Vue/Angular overhead
- **Small Bundle** — ~1.1MB total vs 5MB+ for framework-based apps
- **Simple Deployment** — Static files, no build step required for dev

---

## PWA Capabilities

- Installable on mobile and desktop
- Offline mode with service worker caching
- App-like experience (no browser chrome)
- Background sync when connection restored
- Dark mode support
- Responsive across phones, tablets, and desktops

---

## Security

- Firebase email/password authentication
- Secure token-based sessions (24-hour expiry for guests)
- Role-based access control (Admin, Owner, Guest)
- Input validation and sanitization
- Guest data auto-deleted 60 days after checkout

---

## Project Structure

```
├── index.html              Landing page
├── app.html                Main RMS Portal
├── owner-portal.html       Owner Portal
├── guest-portal.html       Guest Portal
├── js/                     Application modules
├── modules/                UI components and utilities
├── views/                  Router and shared views
├── api/                    API proxy endpoints
├── css/                    Stylesheets
├── assets/                 Logos and screenshots
├── scripts/                Build scripts
├── sql/                    Database schemas and migrations
├── sw.js                   Service worker (main)
├── guest-sw.js             Service worker (guest portal)
├── about.html              About page
├── privacy.html            Privacy policy
├── terms.html              Terms of service
└── vercel.json             Deployment configuration
```

---

## License

**Proprietary Software**

© 2026 Hostizzy (Hostsphere India Private Limited). All rights reserved.

Unauthorized copying, modification, distribution, or use is strictly prohibited without explicit written permission from Hostizzy.

**For licensing inquiries**: partnerships@hostizzy.com

---

## About Hostizzy

Hostizzy empowers independent hosts and property managers across India to deliver exceptional hospitality experiences. We combine technology, local expertise, and customer service to help you maximize your property's potential.

- Website: [hostizzy.com](https://hostizzy.com)
- LinkedIn: [linkedin.com/company/hostizzy](https://linkedin.com/company/hostizzy)
- Instagram: [@hostizzy](https://instagram.com/hostizzy)

---

<div align="center">

**ResIQ v4.0** | Built with care for hospitality professionals in India

</div>
