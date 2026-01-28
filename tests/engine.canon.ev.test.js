import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { computeAllActionsEV } from '../src/engine/ev.js';

const fixturesUrl = new URL('./fixtures/bj21_canon.json', import.meta.url);
const fixtures = JSON.parse(fs.readFileSync(fixturesUrl, 'utf8'));

// Debug toggles via ENV (no file edits needed)
const ONLY_CASE_INDEX =
  process.env.ONLY_CASE_INDEX !== undefined
    ? Number(process.env.ONLY_CASE_INDEX)
    : null;

const VERBOSE = process.env.VERBOSE_TESTS === '1';

describe('computeAllActionsEV (BJ21 Canon)', () => {
  it('matches canon EVs', () => {
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
      const result = computeAllActionsEV({ p1: f.p1, p2: f.p2, dealerUp: f.d });
      const ms = Date.now() - t0;

      if (VERBOSE) console.log(`CASE TIME  #${i}: ${ms}ms`);

      for (const [action, expected] of Object.entries(f.ev)) {
        expect(result).toHaveProperty(action);

        const got = result[action];
        const diff = Math.abs(got - expected);

        if (diff > 1e-6) {
          console.log('MISMATCH', {
            case: i,
            hand: `${f.p1},${f.p2} vs ${f.d}`,
            action,
            expected,
            got,
            diff,
          });
        }

        expect(diff).toBeLessThanOrEqual(1e-6);
      }

      if (VERBOSE) console.log(`CASE END   #${i}: ${f.p1},${f.p2} vs ${f.d}`);
    }
  });
});
