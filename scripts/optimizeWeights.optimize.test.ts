import { describe, expect, it } from 'vitest';
import { runOptimization } from './optimizeWeights.js';

// Not a correctness test — a long-running dev tool invoked via `npm run optimize:expert`.
// Vitest is reused purely as the only zero-new-dependency TS execution harness available
// in this repo (there's no tsx/ts-node). Deliberately outside test/**, so plain `npm test`
// / `npx vitest run` never picks this up — see vitest.optimize.config.ts.
describe('Expert weight optimizer (manual dev tool, not CI)', () => {
  it('runs the genetic search and reports a best-found candidate', async () => {
    const { validation } = await runOptimization();
    expect(validation.winRate).toBeGreaterThanOrEqual(0); // sanity only — never auto-gates
  }, 900_000); // 15 min ceiling; typical default run is ~5-6 min, QUICK mode ~1 min
});
