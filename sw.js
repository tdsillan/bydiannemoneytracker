const CACHE_VERSION = "v12";
const ASSET_VERSION = "12";
const CACHE_NAME = `finance-tracker-${CACHE_VERSION}`;

const APP_SHELL = [
  "./",
  "./index.html",
  `./styles.css?v=${ASSET_VERSION}`,
  "./manifest.json",
  "./icon.svg",
  `./js/store.js?v=${ASSET_VERSION}`,
  `./js/utils.js?v=${ASSET_VERSION}`,
  `./js/icons.js?v=${ASSET_VERSION}`,
  `./js/pwa.js?v=${ASSET_VERSION}`,
  `./js/modal.js?v=${ASSET_VERSION}`,
  `./js/dashboard.js?v=${ASSET_VERSION}`,
  `./js/debts.js?v=${ASSET_VERSION}`,
  `./js/goals.js?v=${ASSET_VERSION}`,
  `./js/expenses.js?v=${ASSET_VERSION}`,
  `./js/remittances.js?v=${ASSET_VERSION}`,
  `./js/networth.js?v=${ASSET_VERSION}`,
  `./js/contributions.js?v=${ASSET_VERSION}`,
  `./js/settings.js?v=${ASSET_VERSION}`,
  `./js/planning.js?v=${ASSET_VERSION}`,
  `./js/app.js?v=${ASSET_VERSION}`,
];

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});
