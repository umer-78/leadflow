/**
 * Builds the marketing site's live demo (docs/assets/demo.js + demo.css):
 * the real receptionist engine compiled to run in the browser.
 * `npm run build:site`, then commit docs/ (GitHub Pages serves it as is).
 */
import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: false,
  build: {
    outDir: 'docs/assets',
    emptyOutDir: false,
    target: 'es2020',
    cssCodeSplit: false,
    lib: {
      entry: 'client/demo/demo.ts',
      name: 'LeadFlowDemo',
      formats: ['iife'],
      fileName: () => 'demo.js',
    },
    rollupOptions: { output: { assetFileNames: 'demo[extname]' } },
  },
});
