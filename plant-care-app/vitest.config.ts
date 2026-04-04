import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/*/src/**/*.test.ts', 'apps/web/**/*.test.ts'],
    alias: {
      '@plant-care/core': resolve(__dirname, 'packages/core/src/index.ts'),
    },
  },
})
