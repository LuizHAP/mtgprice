import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Test environment for backend testing (node for API/scraping tests)
    environment: 'node',

    // Setup file for global test configuration
    setupFiles: ['./test/setup.ts'],

    // Test file patterns - focus on __tests__ directories
    include: ['src/**/__tests__/**/*.test.ts'],
    exclude: ['node_modules', '.next', 'dist', 'build'],

    // Coverage configuration with 80% thresholds
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
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

    // Timeout for tests - 10 seconds for API/scraping tests
    testTimeout: 10000,

    // Show verbose output for better debugging
    reporters: ['verbose'],

    // Enable global test utilities
    globals: true,
  },

  // Path aliases to match tsconfig.json
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})
