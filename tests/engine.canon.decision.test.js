import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { computeAllActionsEV, bestAction } from '../src/engine/ev.js';

const fixturesUrl = new URL('./fixtures/bj21_canon.json', import.meta.url);
const fixtures = JSON.parse(fs.readFileSync(fixturesUrl, 'utf8'));
const splitPrecomputeUrl = new URL(
  '../assets/precompute/split-ev.S17_DAS_RSA_6D.json',
  import.meta.url
);
const splitPrecompute = JSON.parse(fs.readFileSync(splitPrecomputeUrl, 'utf8'));

const ACTION_ORDER = ['HIT', 'STAND', 'DOUBLE', 'SPLIT'];

const IS_CI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
const RUN_SLOW = process.env.RUN_SLOW_TESTS === '1';
const SKIP_SLOW = IS_CI && !RUN_SLOW;

function isSlowFixture(f) {
  return Object.prototype.hasOwnProperty.call(f.ev, 'SPLIT');
}

function expectedBestFromFixture(evObj) {
  let best = null;
  let bestValue = -Infinity;
  for (const a of ACTION_ORDER) {
    if (!(a in evObj)) continue;
    const v = evObj[a];
    if (v > bestValue) {
      bestValue = v;
      best = a;
    }
  }
  return best;
}

describe('bestAction (BJ21 Canon)', () => {
  it('returns the best action for each canon fixture', () => {
    for (let i = 0; i < fixtures.length; i++) {
      const f = fixtures[i];

      if (SKIP_SLOW && isSlowFixture(f)) continue;

      const evs = computeAllActionsEV({
        p1: f.p1,
        p2: f.p2,
        dealerUp: f.d,
        splitEVs: splitPrecompute,
      });
      const got = bestAction(evs);
      const expected = expectedBestFromFixture(f.ev);
      expect(got).toBe(expected);
    }
  });
});
