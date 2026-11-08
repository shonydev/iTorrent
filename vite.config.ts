import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  base: '/iTorrent/',
  root: 'web',
  publicDir: '../public',
  build: { outDir: '../dist', emptyOutDir: true },
  plugins: [
    svelte(),
    nodePolyfills({
      globals: { Buffer: true, global: true, process: true },
      protocolImports: true,
    }),
  ],
});
