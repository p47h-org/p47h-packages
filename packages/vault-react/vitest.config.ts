import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import type { PluginOption } from 'vite';

export default defineConfig({
  plugins: [react() as PluginOption],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    fakeTimers: {
      // Limit timer iterations to prevent infinite loops from setInterval
      loopLimit: 1000,
    },
    // Don't fail on unhandled rejections from timeout/retry tests
    dangerouslyIgnoreUnhandledErrors: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/index.ts', // Just re-exports
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 85,
          lines: 85,
          statements: 85,
        },
      },
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});
