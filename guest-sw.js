// HOSTIZZY Guest Portal v2 SW
const CACHE_VERSION = 'hostizzy-guest-v2.0.0';
const CACHE_NAME = `${CACHE_VERSION}`;
const STATIC_ASSETS = [
  '/guest-portal.html',
  '/guest-manifest.json',
  '/menu-template-standard.json',
  '/assets/logo-192.png',
  '/assets/logo-192-maskable.png',
  '/assets/logo-512-maskable.png',
  '/assets/logo.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(STATIC_ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then(names=>Promise.all(names.filter(n=>n!==CACHE_NAME).map(n=>caches.delete(n)))) .then(()=>self.clients.claim()));
});
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.hostname.includes('supabase.co')) { return event.respondWith(fetch(request)); }
  if (url.protocol === 'chrome-extension:') return;
  event.respondWith(
    fetch(request).then(resp=>{
      if(resp.status===200){ const clone=resp.clone(); caches.open(CACHE_NAME).then(c=>c.put(request, clone)); }
      return resp;
    }).catch(()=>caches.match(request).then(cached=>cached || (request.destination==='document'?caches.match('/guest-portal-v2.html'):new Response('Offline',{status:503}))))
  );
});
