import { defineConfig } from 'vite';

export default defineConfig({
  base: '/evenfield/',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 4096,
  },
});
