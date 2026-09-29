import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: () => 'JssDB-2.0.module.js'
    },
    rollupOptions: {
      output: {
        entryFileNames: 'JssDB-2.0.module.js',
        inlineDynamicImports: true
      }
    },
    sourcemap: false
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'bundleCheck/**/*.test.ts'],
    passWithNoTests: true
  }
});
