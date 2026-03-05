import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Test environment for DOM/React testing
    environment: 'jsdom',

    // Enable global test utilities (describe, it, expect, etc.)
    globals: true,

    // Setup file for global test configuration
    setupFiles: ['./test/setup.ts'],

    // Test file patterns
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['node_modules', '.next', 'dist', 'build'],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        '.next/',
        'dist/',
        'build/',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/__tests__/**',
        'test/setup.ts',
      ],
    },

    // Timeout for tests (default 5000ms)
    testTimeout: 10000,

    // Show verbose output
    reporters: ['default'],
  },

  // Path aliases to match tsconfig.json
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})
