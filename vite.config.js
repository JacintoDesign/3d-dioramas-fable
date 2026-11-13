import { defineConfig } from 'vite';

export default defineConfig({
  build: { chunkSizeWarningLimit: 900 }, // three.js is the bulk of the bundle
});
