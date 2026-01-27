import { describe, expect, it } from 'vitest';
import { bestAction, computeAllActionsEV } from '../src/engine/ev.js';
import fixtures from './fixtures/woo_reference.json' assert { type: 'json' };

const ACTION_ORDER = ['HIT', 'STAND', 'DOUBLE', 'SPLIT'];

function expectedBestAction(evMap) {
  let best = null;
  let bestValue = -Infinity;
  for (const action of ACTION_ORDER) {
    if (!(action in evMap)) {
      continue;
    }
    const value = evMap[action];
    if (value > bestValue || (value === bestValue && best === null)) {
      bestValue = value;
      best = action;
    }
  }
  return best;
}

describe('bestAction', () => {
  it('returns the best action for each fixture', () => {
    for (const fixture of fixtures) {
      const evs = computeAllActionsEV({
        p1: fixture.p1,
        p2: fixture.p2,
        dealerUp: fixture.d,
      });
      const expected = expectedBestAction(fixture.ev);
      expect(bestAction(evs)).toBe(expected);
    }
  });
});
