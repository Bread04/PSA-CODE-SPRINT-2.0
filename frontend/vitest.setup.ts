/// <reference types="vite/client" />

import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Registers `@testing-library/jest-dom` DOM matchers (`toHaveClass`,
// `toHaveAttribute`, `toBeInTheDocument`, …) on Vitest's `expect`.
// (`toBeInstanceOf` is core Vitest, not jest-dom.)
// Foundational for the Epic 2 component test suites (2.2–2.9).
import '@testing-library/jest-dom/vitest';

// Unmount React trees between tests even if `globals` / auto-cleanup is off.
afterEach(() => {
  cleanup();
});
