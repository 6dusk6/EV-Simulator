import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { computeAllActionsEV } from '../src/engine/ev.js';

const fixturesUrl = new URL('./fixtures/bj21_canon.json', import.meta.url);
const fixtures = JSON.parse(fs.readFileSync(fixturesUrl, 'utf8'));
const splitPrecomputeUrl = new URL(
  '../assets/precompute/split-ev.S17_DAS_RSA_6D.json',
  import.meta.url
);
const splitPrecompute = JSON.parse(fs.readFileSync(splitPrecomputeUrl, 'utf8'));

const ONLY_CASE_INDEX =
  process.env.ONLY_CASE_INDEX !== undefined
    ? Number(process.env.ONLY_CASE_INDEX)
    : null;

const VERBOSE = process.env.VERBOSE_TESTS === '1';

const IS_CI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
const RUN_SLOW = process.env.RUN_SLOW_TESTS === '1';
const SKIP_SLOW = IS_CI && !RUN_SLOW;

function isSlowFixture(f) {
  // alles was SPLIT erwartet, ist in deiner Engine aktuell “slow”
  return Object.prototype.hasOwnProperty.call(f.ev, 'SPLIT');
}

describe('computeAllActionsEV (BJ21 Canon)', () => {
  it('matches canon EVs', () => {
    if (VERBOSE) {
      console.log('DEBUG: fixtures count =', fixtures.length, 'SKIP_SLOW =', SKIP_SLOW);
    }

    for (let i = 0; i < fixtures.length; i++) {
      if (ONLY_CASE_INDEX !== null && i !== ONLY_CASE_INDEX) continue;

      const f = fixtures[i];

      if (SKIP_SLOW && isSlowFixture(f)) {
        if (VERBOSE) {
          console.log(`SKIP SLOW CASE #${i}: ${f.p1},${f.p2} vs ${f.d}`);
        }
        continue;
      }

      if (VERBOSE) {
        console.log(
          `CASE START #${i}: ${f.p1},${f.p2} vs ${f.d} actions=${Object.keys(f.ev).join(',')}`
        );
      }

      const t0 = Date.now();
      const result = computeAllActionsEV({
        p1: f.p1,
        p2: f.p2,
        dealerUp: f.d,
        splitEVs: splitPrecompute,
      });
      const ms = Date.now() - t0;

      if (VERBOSE) console.log(`CASE TIME  #${i}: ${ms}ms`);

      for (const [action, expected] of Object.entries(f.ev)) {
        expect(result).toHaveProperty(action);
        expect(Math.abs(result[action] - expected)).toBeLessThanOrEqual(1e-6);
      }

      if (VERBOSE) console.log(`CASE END   #${i}: ${f.p1},${f.p2} vs ${f.d}`);
    }
  });
});
