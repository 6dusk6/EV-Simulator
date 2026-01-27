import { describe, expect, it } from 'vitest';
import { computeAllActionsEV } from '../src/engine/ev.js';
import fixtures from './fixtures/woo_reference.json' assert { type: 'json' };

describe('computeAllActionsEV', () => {
  it('matches Wizard of Odds reference EVs', () => {
    for (const fixture of fixtures) {
      const result = computeAllActionsEV({
        p1: fixture.p1,
        p2: fixture.p2,
        dealerUp: fixture.d,
      });

      for (const [action, expected] of Object.entries(fixture.ev)) {
        expect(result).toHaveProperty(action);
        expect(Math.abs(result[action] - expected)).toBeLessThanOrEqual(1e-6);
      }
    }
  });
});
