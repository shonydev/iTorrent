const CACHE_NAME = 'itorrent-shell-v1';
const torrentPrefix = self.registration.scope + 'webtorrent/';

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll([self.registration.scope, self.registration.scope + 'manifest.webmanifest']);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('itorrent-shell-') && name !== CACHE_NAME).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = request.url;
  if (url.startsWith(torrentPrefix)) {
    if (url.includes(torrentPrefix + 'keepalive/')) {
      event.respondWith(new Response());
      return;
    }
    if (url.includes(torrentPrefix + 'cancel/')) {
      event.respondWith(new Response(new ReadableStream({ cancel() {} })));
      return;
    }
    event.respondWith(serveTorrentRequest(event));
    return;
  }

  if (request.method !== 'GET' || new URL(url).origin !== self.location.origin || !url.startsWith(self.registration.scope)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    } catch {
      const cached = await cache.match(request);
      if (cached) return cached;
      if (request.mode === 'navigate') return (await cache.match(self.registration.scope)) || Response.error();
      return Response.error();
    }
  })());
});

async function serveTorrentRequest(event) {
  const { url, method, headers, destination } = event.request;
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const [data, port] = await new Promise(resolve => {
    for (const windowClient of windows) {
      const channel = new MessageChannel();
      channel.port1.onmessage = ({ data }) => resolve([data, channel.port1]);
      windowClient.postMessage({
        url, method, headers: Object.fromEntries(headers.entries()),
        scope: self.registration.scope, destination, type: 'webtorrent'
      }, [channel.port2]);
    }
  });

  let timeout;
  const cleanup = () => {
    port.postMessage(false);
    clearTimeout(timeout);
    port.onmessage = null;
  };
  if (data.body !== 'STREAM') {
    cleanup();
    return new Response(data.body || null, data);
  }
  return new Response(new ReadableStream({
    pull(controller) {
      return new Promise(resolve => {
        port.onmessage = ({ data: chunk }) => {
          if (chunk) controller.enqueue(chunk);
          else { cleanup(); controller.close(); }
          resolve();
        };
        if (destination !== 'document') {
          clearTimeout(timeout);
          timeout = setTimeout(() => { cleanup(); resolve(); }, 5000);
        }
        port.postMessage(true);
      });
    },
    cancel() { cleanup(); }
  }), data);
}
