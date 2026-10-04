const CACHE_NAME = 'dnd-inventar-v1';
const APP_SHELL = new URL('./', self.registration.scope).href;
const CDN_SCRIPTS = [
    'https://cdn.tailwindcss.com/',
    'https://unpkg.com/vue@3/dist/vue.global.prod.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);
        await cache.addAll([
            APP_SHELL,
            new URL('./manifest.webmanifest', self.registration.scope).href,
            new URL('./icon.svg', self.registration.scope).href,
            new URL('./icon-192.png', self.registration.scope).href,
            new URL('./icon-512.png', self.registration.scope).href
        ]);

        await Promise.all(CDN_SCRIPTS.map(async (url) => {
            try {
                const response = await fetch(new Request(url, { mode: 'no-cors' }));
                if (response.ok || response.type === 'opaque') {
                    await cache.put(url, response);
                } else {
                    console.warn('Knihovnu pro offline použití se nepodařilo uložit:', url);
                }
            } catch (error) {
                console.warn('Knihovnu pro offline použití se nepodařilo stáhnout:', url, error);
            }
        }));

        await self.skipWaiting();
    })());
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames
            .filter((name) => name.startsWith('dnd-inventar-') && name !== CACHE_NAME)
            .map((name) => caches.delete(name)));
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET') return;

    const requestUrl = new URL(request.url);
    const isCdnScript = CDN_SCRIPTS.includes(requestUrl.href);

    if (isCdnScript) {
        event.respondWith((async () => {
            const cache = await caches.open(CACHE_NAME);
            try {
                const response = await fetch(request);
                if (response.ok || response.type === 'opaque') {
                    await cache.put(request, response.clone());
                }
                return response;
            } catch (error) {
                const cachedResponse = await cache.match(request);
                if (cachedResponse) return cachedResponse;
                throw error;
            }
        })());
        return;
    }

    if (request.mode === 'navigate') {
        event.respondWith((async () => {
            try {
                const response = await fetch(request);
                if (response.ok) {
                    const cache = await caches.open(CACHE_NAME);
                    await cache.put(APP_SHELL, response.clone());
                }
                return response;
            } catch (error) {
                const cachedPage = await caches.match(APP_SHELL);
                if (cachedPage) return cachedPage;
                throw error;
            }
        })());
        return;
    }

    if (requestUrl.origin === self.location.origin) {
        event.respondWith((async () => {
            const cachedResponse = await caches.match(request);
            if (cachedResponse) return cachedResponse;

            const response = await fetch(request);
            if (response.ok) {
                const cache = await caches.open(CACHE_NAME);
                await cache.put(request, response.clone());
            }
            return response;
        })());
    }
});
