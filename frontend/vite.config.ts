/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    // Process co-located component CSS imports instead of mocking them, so
    // jsdom rendering of token-driven components stays faithful.
    css: true,
    setupFiles: ['./vitest.setup.ts'],
    // `e2e/*.spec.ts` are Playwright specs (own runner) — keep them out of the
    // Vitest run, which otherwise collects them via the default `*.spec.ts` glob.
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
  },
});
