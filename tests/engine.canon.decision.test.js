import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { computeAllActionsEV, bestAction } from '../src/engine/ev.js';

const fixturesUrl = new URL('./fixtures/bj21_canon.json', import.meta.url);
const fixtures = JSON.parse(fs.readFileSync(fixturesUrl, 'utf8'));

const ONLY_CASE_INDEX =
  process.env.ONLY_CASE_INDEX !== undefined
    ? Number(process.env.ONLY_CASE_INDEX)
    : null;

const VERBOSE = process.env.VERBOSE_TESTS === '1';

const ACTION_ORDER = ['HIT', 'STAND', 'DOUBLE', 'SPLIT'];

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
    if (VERBOSE) console.log('DEBUG: fixtures count =', fixtures.length);

    for (let i = 0; i < fixtures.length; i++) {
      if (ONLY_CASE_INDEX !== null && i !== ONLY_CASE_INDEX) continue;

      const f = fixtures[i];

      if (VERBOSE) {
        console.log(
          `CASE START #${i}: ${f.p1},${f.p2} vs ${f.d} actions=${Object.keys(f.ev).join(',')}`
        );
      }

      const t0 = Date.now();
      const evs = computeAllActionsEV({ p1: f.p1, p2: f.p2, dealerUp: f.d });
      const ms = Date.now() - t0;

      const got = bestAction(evs);
      const expected = expectedBestFromFixture(f.ev);

      if (VERBOSE) {
        console.log(`CASE TIME  #${i}: ${ms}ms`);
      }

      if (got !== expected) {
        console.log('DECISION MISMATCH', {
          case: i,
          hand: `${f.p1},${f.p2} vs ${f.d}`,
          expected,
          got,
          evs,
          canonEV: f.ev,
        });
      }

      expect(got).toBe(expected);

      if (VERBOSE) console.log(`CASE END   #${i}: ${f.p1},${f.p2} vs ${f.d}`);
    }
  });
});
