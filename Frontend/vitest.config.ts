import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: [],
    include: ['lib/copilot/__tests__/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'json-summary'],
      include: ['lib/copilot/**/*.ts'],
      exclude: ['lib/copilot/__tests__/**'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
