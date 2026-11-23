import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // Ensures relative paths for GitHub Pages compatibility
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false
  },
  server: {
    port: 3000,
    open: false
  }
});
