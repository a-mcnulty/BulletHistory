import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import { resolve } from 'path';
import manifest from './src/manifest.json';

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@shared': resolve(__dirname, 'src/shared'),
      '@panel': resolve(__dirname, 'src/panel'),
      '@background': resolve(__dirname, 'src/background'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        panel: resolve(__dirname, 'src/panel/index.html'),
      },
    },
    outDir: 'dist',
    sourcemap: process.env.NODE_ENV === 'development',
  },
});
