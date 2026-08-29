import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * End-to-end console tests (bmad-qa-generate-e2e-tests, 2026-08-29).
 *
 * Closes the integration gap flagged in the Epic 2/3/4 retrospectives: the
 * frontend unit tests stub `fetch` and the backend tests use FastAPI
 * `TestClient`, so real `client.ts` -> real HTTP -> real FastAPI -> real
 * orchestrator is never exercised together in one process. These tests boot
 * BOTH the real backend and the real Vite build and drive them through a
 * browser.
 *
 * Single source of truth for ports lives here (overridable via env). The
 * backend URL is exported to `E2E_API_BASE_URL` so `e2e/fixtures.ts` and the
 * Vite process both read the same value — no port literal in any spec or
 * `.env` file.
 *
 * Hermetic: `reuseExistingServer: false`, and the backend seeds its in-memory
 * demo incidents fresh on every run.
 */

const FRONTEND_DIR = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = path.resolve(FRONTEND_DIR, '../backend');

const BACKEND_PORT = Number(process.env.E2E_BACKEND_PORT ?? 8123);
const FRONTEND_PORT = Number(process.env.E2E_FRONTEND_PORT ?? 5199);
const API_BASE_URL = `http://127.0.0.1:${BACKEND_PORT}`;
const APP_BASE_URL = `http://127.0.0.1:${FRONTEND_PORT}`;

// Propagate to the test workers (fixtures.ts) and to the Vite process below.
process.env.E2E_API_BASE_URL = API_BASE_URL;

// The committed backend virtualenv (see backend/.venv). Windows layout first,
// POSIX layout as the fallback so this also runs in CI on Linux.
const VENV_PY =
  process.platform === 'win32'
    ? '.venv\\Scripts\\python.exe'
    : '.venv/bin/python';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: APP_BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: [
    {
      command: `${VENV_PY} -m uvicorn api.app:app --host 127.0.0.1 --port ${BACKEND_PORT}`,
      cwd: BACKEND_DIR,
      url: `${API_BASE_URL}/healthz`,
      reuseExistingServer: false,
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: 60_000,
      // Deterministic + fast: force the offline demo seed and the offline
      // query template (no bounded Anthropic call) regardless of the dev shell.
      env: { PORTWATCH_SEED: '1', ANTHROPIC_API_KEY: '' },
    },
    {
      // `--host 127.0.0.1` so Vite binds the interface Playwright polls (Vite's
      // default `localhost` can resolve to IPv6 `::1` on Windows). The API base
      // is injected here as the one authoritative value — no `.env.e2e` file.
      command: `npm run dev -- --host 127.0.0.1 --port ${FRONTEND_PORT} --strictPort`,
      cwd: FRONTEND_DIR,
      url: APP_BASE_URL,
      reuseExistingServer: false,
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: 60_000,
      env: { VITE_API_BASE_URL: API_BASE_URL },
    },
  ],
});
