import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // A handful of tests play out many full random games (evaluatorSanity, tierStrength,
    // chineseBezique's smoke test) and comfortably clear vitest's 5000ms default locally,
    // but not on slower CI hardware — this was previously papered over by always passing
    // `--testTimeout=60000` manually on every local run rather than fixed at the source, so
    // it went unnoticed until CI ran the bare `npm test` script and timed out for real.
    testTimeout: 60000,
  },
});
