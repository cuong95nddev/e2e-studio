import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist/webview',
    emptyOutDir: false,
    rollupOptions: {
      input: { sidebar: 'src/webview/sidebar/main.tsx' },
      output: {
        entryFileNames: '[name].js',
        assetFileNames: 'index.[ext]',
        format: 'iife',
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/webview'),
    },
  },
});
