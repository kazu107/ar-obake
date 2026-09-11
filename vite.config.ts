import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: ['safari15', 'ios15'],
    cssTarget: 'safari15',
    chunkSizeWarningLimit: 2200,
    rollupOptions: { input: { main: 'index.html', lab: 'lab.html', ar: 'ar.html' } },
  },
});
