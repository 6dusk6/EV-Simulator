import { describe, expect, it } from 'vitest';
import { computeAllActionsEV } from '../src/engine/ev.js';

const baseRules = {
  hitSoft17: false,
  doubleAfterSplit: true,
  resplitAces: true,
  doubleRule: 'any_two',
  surrender: 'late',
  decks: 6,
};

describe('peek rule impacts EVs', () => {
  it('raises stand EV when dealer shows a ten with peek enabled', () => {
    const noPeek = computeAllActionsEV({
      p1: '9',
      p2: '7',
      dealerUp: 'T',
      rules: { ...baseRules, peek: false },
    });
    const peek = computeAllActionsEV({
      p1: '9',
      p2: '7',
      dealerUp: 'T',
      rules: { ...baseRules, peek: true },
    });

    expect(noPeek).toHaveProperty('STAND');
    expect(peek).toHaveProperty('STAND');
    expect(peek.STAND).toBeGreaterThan(noPeek.STAND);
  });
});
