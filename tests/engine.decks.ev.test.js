import { afterEach, describe, expect, it } from 'vitest';
import { computeAllActionsEV } from '../src/engine/ev.js';

describe('engine deck count impact', () => {
  const originalOnlyAction = process.env.ONLY_ACTION;

  afterEach(() => {
    if (originalOnlyAction === undefined) {
      delete process.env.ONLY_ACTION;
    } else {
      process.env.ONLY_ACTION = originalOnlyAction;
    }
  });

  it('changes stand EV when deck count changes', () => {
    process.env.ONLY_ACTION = 'STAND';
    const baseEVs = computeAllActionsEV({
      p1: 'T',
      p2: '6',
      dealerUp: 'T',
      rules: { decks: 1 },
    });
    const nextEVs = computeAllActionsEV({
      p1: 'T',
      p2: '6',
      dealerUp: 'T',
      rules: { decks: 6 },
    });

    const diff = Math.abs(baseEVs.STAND - nextEVs.STAND);
    expect(diff).toBeGreaterThan(1e-6);
  });
});
