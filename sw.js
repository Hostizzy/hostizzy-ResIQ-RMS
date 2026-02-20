/**
 * ResIQ Service Worker
 * Version: 5.14.0
 * Features: Caching, Push Notifications, Background Sync, Offline Support
 *
 * IMPORTANT FOR DEVELOPERS:
 * =======================
 * 1. ALWAYS bump CACHE_VERSION when modifying HTML/JS files
 * 2. Set FORCE_UPDATE = true for critical bug fixes
 * 3. Test with both cache enabled AND disabled before deploying
 * 4. Use 'var' (not const) for global variables in inline <script> tags
 *
 * Update Log:
 * - v5.14.0: Dashboard filter fully working + period button pills + accurate MoM trends
 * - v5.13.0: Dashboard Redesign - consolidated 18 metrics to 8 Core KPIs, simplified filters, improved Action Center
 * - v5.12.0: Dashboard Activity Widgets - real-time check-ins, check-outs, arrivals, pending payments with guest lists
 * - v5.11.0: Business View Hostizzy Income + Property View % fix - added revenue breakdown KPIs, fixed MoM calculations
 * - v5.10.0: Kanban Board drag & drop fully functional - uses Sortable.js, Lucide icons, syncs with database
 * - v5.9.0: Complete revamp of Payments & Reservations views - filter persistence, inline status change, modern badges
 * - v5.8.0: Phase 4 multi-step booking wizard - 4-step form (Guest → Booking → Pricing → Review)
 * - v5.7.0: Phase 5 empty states - improved table empty messages with inline SVG icons, metric card CSS
 * - v5.6.0: Phase 3 view redesigns - improved page headers for all views, professional filter bars, clean CTAs
 * - v5.5.0: Phase 1 icon overhaul - Lucide icons replace all ~200 emojis, utility classes, empty states, skeletons
 * - v5.4.0: Guesty-inspired UI overhaul + EmailJS email sending + settings cleanup + comm view
 * - v5.3.0: Complete global color replacement - all hardcoded purple eliminated, full teal theme
 * - v5.2.0: Professional color scheme (teal) + Gmail global settings + property auto-detection
 * - v5.1.0: Design system tokens applied across all CSS + Gmail auto-scan + better email parsing
 * - v5.0.0: Horizontal row property cards + full design system CSS tokens
 * - v4.4.0: Fixed iCal proxy (now uses /api/ical-proxy), property card layout fixes
 * - v4.3.0: Added onboarding flow and mobile enhancements
 * - v4.2.1: Added prevention strategies and force update mechanism
 * - v4.2.0: Fixed owner-portal caching issue
 */

const CACHE_VERSION = 'v5.14.0';
const CACHE_NAME = `resiq-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline.html';

// Set to true for critical updates that require clearing all caches
const FORCE_UPDATE = false;

// Files to cache for offline support
const STATIC_CACHE = [
  '/',
  '/index.html',
  '/owner-portal.html',
  '/guest-portal.html',
  '/privacy.html',
  '/terms.html',
  '/about.html',
  '/offline.html',
  '/manifest.json',
  '/native-app-utils.js',
  '/native-app-styles.css',
  '/mobile-enhanced-forms.css',
  '/onboarding.js',
  '/onboarding.css',
  '/owner-portal-functions.js',
  '/assets/logo.png',
  '/assets/logo-132.png',
  '/assets/logo-192.png',
  '/assets/logo-192-maskable.png',
  '/assets/logo-512-maskable.png'
];

// API endpoints to cache with network-first strategy
const API_CACHE_NAME = `resiq-api-${CACHE_VERSION}`;

// Cache duration for HTML files (5 minutes) to prevent serving stale code
const HTML_CACHE_MAX_AGE = 5 * 60 * 1000; // 5 minutes in milliseconds

// ============================================
// INSTALL EVENT - Cache static assets
// ============================================
self.addEventListener('install', (event) => {
  console.log(`[SW] Installing service worker ${CACHE_VERSION}...`);

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching app shell and static assets');
        return cache.addAll(STATIC_CACHE);
      })
      .then(() => {
        console.log(`[SW] ${CACHE_VERSION} installed, skipping waiting...`);
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Cache failed:', error);
      })
  );
});

// ============================================
// ACTIVATE EVENT - Clean old caches
// ============================================
self.addEventListener('activate', (event) => {
  console.log(`[SW] Activating service worker ${CACHE_VERSION}...`);

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        // If FORCE_UPDATE is true, delete ALL caches
        if (FORCE_UPDATE) {
          console.warn('[SW] FORCE_UPDATE enabled - clearing ALL caches');
          return Promise.all(
            cacheNames.map((name) => {
              console.log('[SW] Force deleting cache:', name);
              return caches.delete(name);
            })
          );
        }

        // Otherwise, only delete old ResIQ caches
        return Promise.all(
          cacheNames
            .filter((name) => name.startsWith('resiq-') && name !== CACHE_NAME && name !== API_CACHE_NAME)
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log(`[SW] ${CACHE_VERSION} activated, claiming clients...`);
        return self.clients.claim();
      })
      .then(() => {
        // Notify all clients that service worker has updated
        return self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({
              type: 'SW_UPDATED',
              version: CACHE_VERSION,
              forceUpdate: FORCE_UPDATE
            });
          });
        });
      })
  );
});

// ============================================
// FETCH EVENT - Network-first with cache fallback
// ============================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip Supabase API calls - handle separately
  if (url.hostname.includes('supabase.co')) {
    return;
  }

  // Skip all external/cross-origin requests (CORS proxies, APIs, CDNs)
  // These must go directly to the network - service worker caching breaks them
  if (url.origin !== self.location.origin) {
    return;
  }

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Handle navigation requests (HTML pages)
  // IMPORTANT: Always fetch fresh HTML to avoid serving stale/broken JavaScript
  // This prevents issues like duplicate variable declarations and missing functions
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request, { cache: 'no-store', redirect: 'follow' })
        .then((response) => {
          // Only cache clean, non-redirected HTML responses for offline use
          if (response && response.status === 200 && !response.redirected) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              // Cache the actual request URL, not just index.html
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Offline fallback: serve cached version of the requested page
          return caches.match(request)
            .then((cachedResponse) => {
              if (cachedResponse) return cachedResponse;
              // If no cached version, try index.html, then offline page
              return caches.match('/index.html')
                .then((indexResponse) => {
                  if (indexResponse) return indexResponse;
                  return caches.match(OFFLINE_URL);
                });
            });
        })
    );
    return;
  }

  // Handle static assets - Cache first, network fallback
  if (request.destination === 'image' ||
      request.destination === 'style' ||
      request.destination === 'script' ||
      request.destination === 'font') {
    event.respondWith(
      caches.match(request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            // Return cache, but also update in background
            fetch(request).then((networkResponse) => {
              if (networkResponse.status === 200) {
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(request, networkResponse);
                });
              }
            }).catch(() => {});
            return cachedResponse;
          }

          // Not in cache, fetch from network
          return fetch(request)
            .then((response) => {
              if (response.status === 200) {
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(request, responseClone);
                });
              }
              return response;
            });
        })
    );
    return;
  }

  // Default: Network first with cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(request);
      })
  );
});

// ============================================
// PUSH NOTIFICATIONS
// ============================================
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');

  let notificationData = {
    title: 'ResIQ Notification',
    body: 'You have a new update',
    icon: '/assets/logo-192.png',
    badge: '/assets/logo-96.png',
    tag: 'resiq-notification',
    requireInteraction: false,
    data: {
      url: '/'
    }
  };

  // Parse push data if available
  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = {
        ...notificationData,
        ...data,
        icon: data.icon || notificationData.icon,
        badge: data.badge || notificationData.badge
      };
    } catch (e) {
      // If not JSON, use text as body
      notificationData.body = event.data.text();
    }
  }

  const options = {
    body: notificationData.body,
    icon: notificationData.icon,
    badge: notificationData.badge,
    tag: notificationData.tag,
    requireInteraction: notificationData.requireInteraction,
    vibrate: [100, 50, 100],
    data: notificationData.data,
    actions: notificationData.actions || [
      {
        action: 'open',
        title: 'Open App'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(notificationData.title, options)
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);

  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  // Get the URL to open
  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if app is already open
        for (const client of clientList) {
          if (client.url.includes(self.registration.scope) && 'focus' in client) {
            client.postMessage({
              type: 'NOTIFICATION_CLICK',
              url: urlToOpen,
              data: event.notification.data
            });
            return client.focus();
          }
        }
        // App not open, open new window
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed');
});

// ============================================
// BACKGROUND SYNC
// ============================================
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);

  if (event.tag === 'resiq-sync-reservations') {
    event.waitUntil(syncReservations());
  } else if (event.tag === 'resiq-sync-payments') {
    event.waitUntil(syncPayments());
  } else if (event.tag === 'resiq-sync-all') {
    event.waitUntil(syncAllData());
  }
});

// Sync reservations from IndexedDB
async function syncReservations() {
  console.log('[SW] Syncing pending reservations...');

  try {
    // Notify the main thread to handle sync
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_RESERVATIONS'
      });
    });
    return true;
  } catch (error) {
    console.error('[SW] Reservation sync failed:', error);
    throw error;
  }
}

// Sync payments from IndexedDB
async function syncPayments() {
  console.log('[SW] Syncing pending payments...');

  try {
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_PAYMENTS'
      });
    });
    return true;
  } catch (error) {
    console.error('[SW] Payment sync failed:', error);
    throw error;
  }
}

// Sync all pending data
async function syncAllData() {
  console.log('[SW] Syncing all pending data...');

  try {
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_ALL'
      });
    });
    return true;
  } catch (error) {
    console.error('[SW] Full sync failed:', error);
    throw error;
  }
}

// ============================================
// PERIODIC BACKGROUND SYNC (if supported)
// ============================================
self.addEventListener('periodicsync', (event) => {
  console.log('[SW] Periodic sync triggered:', event.tag);

  if (event.tag === 'resiq-periodic-sync') {
    event.waitUntil(syncAllData());
  }
});

// ============================================
// MESSAGE HANDLER - Communication with main thread
// ============================================
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.addAll(event.data.urls);
      })
    );
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.delete(CACHE_NAME).then(() => {
        console.log('[SW] Cache cleared');
      })
    );
  }

  // Handle push subscription status request
  if (event.data && event.data.type === 'GET_PUSH_STATUS') {
    self.registration.pushManager.getSubscription()
      .then((subscription) => {
        event.source.postMessage({
          type: 'PUSH_STATUS',
          subscribed: !!subscription
        });
      });
  }
});

// ============================================
// ERROR HANDLING
// ============================================
self.addEventListener('error', (event) => {
  console.error('[SW] Error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('[SW] Unhandled rejection:', event.reason);
});

console.log(`[SW] Service Worker loaded - ${CACHE_VERSION}`);
