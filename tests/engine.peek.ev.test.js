import { describe, expect, it } from 'vitest';
import { computeAllActionsEV } from '../src/engine/ev.js';

describe('computeAllActionsEV (peek conditioning)', () => {
  it('changes EVs versus dealer T when peek is enabled', () => {
    const noPeek = computeAllActionsEV({
      p1: 'T',
      p2: '6',
      dealerUp: 'T',
      rules: { peek: false },
    });
    const peek = computeAllActionsEV({
      p1: 'T',
      p2: '6',
      dealerUp: 'T',
      rules: { peek: true },
    });

    expect(peek.STAND).not.toBeCloseTo(noPeek.STAND, 6);
    expect(peek.STAND).toBeGreaterThan(noPeek.STAND);
  });

  it('changes EVs versus dealer A when peek is enabled', () => {
    const noPeek = computeAllActionsEV({
      p1: '5',
      p2: '6',
      dealerUp: 'A',
      rules: { peek: false },
    });
    const peek = computeAllActionsEV({
      p1: '5',
      p2: '6',
      dealerUp: 'A',
      rules: { peek: true },
    });

    expect(peek.HIT).not.toBeCloseTo(noPeek.HIT, 6);
    expect(peek.HIT).toBeGreaterThan(noPeek.HIT);
  });
});
