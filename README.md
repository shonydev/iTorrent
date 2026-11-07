# iTorrent

PWA para agregar enlaces magnet y reproducir archivos de video mediante un servidor WebTorrent propio.

## Requisitos

- Node.js 20 o superior.
- Un servidor accesible por HTTPS para usar la PWA desde iPhone.

## Desarrollo y ejecución

```bash
npm install
npm run dev
```

En otra terminal, iniciá el backend con un token seguro:

```bash
TOKEN=una-clave-larga npm start
```

El servidor escucha en el puerto `3000` por defecto y guarda las descargas en `./downloads` (o en la ruta indicada por `DOWNLOADS`). Para acceder desde iPhone podés publicar el puerto mediante Tailscale Serve o Cloudflare Tunnel y abrir la URL HTTPS en Safari.

## GitHub Pages

**Aplicación publicada:** https://shonydev.github.io/iTorrent/

GitHub Pages puede alojar únicamente la interfaz estática que genera `npm run build`; no ejecuta `server.js`, Node.js ni WebTorrent. Por eso, el sitio publicado en Pages sirve para comprobar la PWA/interfaz, pero las funciones de agregar torrents, consultar progreso y hacer streaming requieren que el backend esté desplegado aparte y que la interfaz apunte a ese servidor.

El workflow de GitHub Actions publica `dist/` en Pages bajo `/iTorrent/`.

## Formatos

En iPhone Safari, priorizá MP4/M4V/MOV con códecs compatibles (H.264/HEVC + AAC). Otros contenedores pueden no reproducirse.

Usalo únicamente con contenido que tengas derecho a descargar.
