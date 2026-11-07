import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/iTorrent/',
  root: 'web',
  build: { outDir: '../dist', emptyOutDir: true },
  server: { proxy: { '/api': 'http://localhost:3000', '/stream': 'http://localhost:3000' } },
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: { navigateFallbackDenylist: [/^\/api\//, /^\/stream\//] },
      manifest: {
        name: 'Torrent Stream',
        short_name: 'Stream',
        display: 'standalone',
        background_color: '#0f172a',
        theme_color: '#0f172a',
      }
    })
  ]
});
