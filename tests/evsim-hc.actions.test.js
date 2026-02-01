import { afterEach, describe, expect, it, vi } from 'vitest';
import '../assets/evsim-hc.js';

describe('evsim handcalc action selection', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('prefers surrender when it has the highest EV', () => {
    const hooks = globalThis.__evsimHcTestHooks;
    expect(hooks).toBeTruthy();

    const rules = hooks.normalizeRules({ surrender: 'late' });
    const candidates = hooks.getActionCandidates({
      rules,
      evHit: -0.7,
      evStand: -0.6,
      evDouble: -0.8,
      evSplit: undefined,
    });

    expect(candidates.some((candidate) => candidate.action === 'SURRENDER')).toBe(true);
    expect(hooks.pickBestAction(candidates)).toBe('SURRENDER');
  });
});
