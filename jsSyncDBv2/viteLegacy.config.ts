import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/legacy.ts'),
      formats: ['iife'],
      name: 'JssDB',
      fileName: () => 'JssDB-2.0.js'
    },
    rollupOptions: {
      output: {
        entryFileNames: 'JssDB-2.0.js',
        inlineDynamicImports: true
      }
    },
    sourcemap: false
  }
});