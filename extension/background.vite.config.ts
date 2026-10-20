import { defineConfig } from 'vite'
export default defineConfig({
  build: { outDir: 'extension/build', emptyOutDir: false,
    lib: { entry: 'extension/background.ts', name: 'KrasnoparsBackground', formats: ['iife'], fileName: () => 'background.js' },
  },
})
