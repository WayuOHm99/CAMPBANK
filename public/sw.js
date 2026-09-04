self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// Network requests remain network-only. EQCAMP V1 never caches or queues Score writes.
