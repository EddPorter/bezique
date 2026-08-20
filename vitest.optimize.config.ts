import { defineConfig } from 'vitest/config';

// Isolated from vitest.config.ts's `test/**/*.test.ts` include on purpose — the weight
// optimizer (scripts/optimizeWeights.ts) is a multi-minute dev tool, not a correctness
// test, and must never run as part of plain `npm test` / `npx vitest run`. Invoked via
// `npm run optimize:expert` instead.
export default defineConfig({
  test: {
    include: ['scripts/**/*.optimize.test.ts'],
    testTimeout: 900_000,
    hookTimeout: 60_000,
  },
});
