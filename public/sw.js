const portTimeoutDuration = 5000;
let cancellable = false;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', event => {
  const url = event.request.url;
  const prefix = self.registration.scope + 'webtorrent/';
  if (!url.includes(prefix)) return;

  if (url.includes(prefix + 'keepalive/')) {
    event.respondWith(new Response());
    return;
  }

  if (url.includes(prefix + 'cancel/')) {
    event.respondWith(new Response(new ReadableStream({
      cancel() { cancellable = true; }
    })));
    return;
  }

  event.respondWith(serveTorrentRequest(event));
});

async function serveTorrentRequest(event) {
  const { url, method, headers, destination } = event.request;
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

  const [data, port] = await new Promise(resolve => {
    for (const windowClient of windows) {
      const channel = new MessageChannel();
      channel.port1.onmessage = ({ data }) => resolve([data, channel.port1]);
      windowClient.postMessage({
        url,
        method,
        headers: Object.fromEntries(headers.entries()),
        scope: self.registration.scope,
        destination,
        type: 'webtorrent'
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
    return new Response(data.body, data);
  }

  return new Response(new ReadableStream({
    pull(controller) {
      return new Promise(resolve => {
        port.onmessage = ({ data: chunk }) => {
          if (chunk) controller.enqueue(chunk);
          else {
            cleanup();
            controller.close();
          }
          resolve();
        };
        if (!cancellable && destination !== 'document') {
          clearTimeout(timeout);
          timeout = setTimeout(() => {
            cleanup();
            resolve();
          }, portTimeoutDuration);
        }
        port.postMessage(true);
      });
    },
    cancel() { cleanup(); }
  }), data);
}
