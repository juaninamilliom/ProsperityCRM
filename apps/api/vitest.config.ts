import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // The rate limiter reads this once, at config module scope. Setting it
    // here rather than mutating process.env inside a test keeps it
    // deterministic: vitest shares one process across files, so a per-test
    // mutation races with another file's environment restore.
    env: { TRUSTED_PROXY_HOPS: '1' },
  },
});
