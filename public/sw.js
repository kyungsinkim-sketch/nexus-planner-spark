/**
 * Re-Be.io Service Worker
 * Provides offline support and caching for PWA functionality
 */

const CACHE_NAME = 're-be-v16';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/loading-star.png',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing Service Worker...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Caching static assets');
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating Service Worker...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => {
                        console.log('[SW] Deleting old cache:', name);
                        return caches.delete(name);
                    })
            );
        })
    );
    self.clients.claim();
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    // Skip API calls, external requests, and development resources
    const url = new URL(event.request.url);
    if (
        url.pathname.startsWith('/api') ||
        !url.origin.includes(self.location.origin) ||
        url.pathname.startsWith('/src/') ||
        url.pathname.startsWith('/node_modules/') ||
        url.pathname.startsWith('/@')
    ) {
        return;
    }

    // Hashed assets (/assets/*) are immutable per build — use network-only
    // to avoid serving stale chunks after redeployment
    if (url.pathname.startsWith('/assets/')) {
        return; // let browser handle normally (no cache interception)
    }

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Only cache navigation and static files, not hashed chunks
                if (event.request.mode === 'navigate' || STATIC_ASSETS.includes(url.pathname)) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => {
                // Fallback to cache if network fails
                return caches.match(event.request).then((cachedResponse) => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    // Return offline page for navigation requests
                    if (event.request.mode === 'navigate') {
                        return caches.match('/');
                    }
                    return new Response('Offline', { status: 503 });
                });
            })
    );
});

// Push notification event (for future use)
self.addEventListener('push', (event) => {
    const data = event.data?.json() ?? {};
    const title = data.title || 'Re-Be.io';
    const options = {
        body: data.body || '새로운 알림이 있습니다.',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        vibrate: [100, 50, 100],
        data: {
            url: data.url || '/',
        },
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window' }).then((clientList) => {
            // Focus existing window if available
            for (const client of clientList) {
                if (client.url === url && 'focus' in client) {
                    return client.focus();
                }
            }
            // Open new window
            if (clients.openWindow) {
                return clients.openWindow(url);
            }
        })
    );
});

console.log('[SW] Service Worker loaded');
