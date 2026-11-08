# iTorrent

PWA de torrents que corre directamente en el navegador, sin backend propio. El cliente usa WebTorrent y WebRTC para conectarse con otros peers compatibles.

## Requisitos

- Node.js 20 o superior.
- Un navegador moderno con WebRTC y Service Workers.
- HTTPS en producción (GitHub Pages ya lo ofrece).

## Desarrollo

```bash
npm install
npm run dev
```

Para generar y previsualizar la versión de producción:

```bash
npm run build
npm run preview
```

## Arquitectura client-only

- **WebTorrent en el navegador:** descubrimiento y transferencia P2P mediante WebRTC.
- **Service Worker:** expone el stream local del torrent al reproductor HTML5 y soporta solicitudes por rangos.
- **localStorage:** recuerda los enlaces magnet para intentar restaurarlos cuando volvés a abrir la PWA.
- **GitHub Pages:** aloja únicamente archivos estáticos; no se necesita un proceso Node.js ni un servidor de torrents.

Los datos descargados no se garantizan como persistentes entre sesiones: el navegador puede liberar almacenamiento y el motor puede volver a descargar piezas al restaurar un magnet. La descarga tampoco continúa de forma fiable cuando Safari/iOS suspende la PWA en segundo plano.

## Limitaciones de la red

WebTorrent en navegador usa WebRTC: no se conecta directamente a peers BitTorrent convencionales por TCP/UDP. El torrent necesita peers o seeders compatibles con WebTorrent/WebRTC y trackers WebSocket cuando corresponda. Si un magnet solo tiene peers tradicionales, puede quedarse sin conexiones.

## Publicación

La aplicación se publica en GitHub Pages:

https://shonydev.github.io/iTorrent/

El workflow de GitHub Actions genera `dist/` y publica el sitio bajo `/iTorrent/`.

## Uso responsable

Usalo únicamente con contenido que tengas derecho a descargar.
