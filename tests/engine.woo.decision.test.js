import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { computeAllActionsEV, bestAction } from '../src/engine/ev.js';
import { buildRuleTag, DEFAULT_RULES } from '../src/engine/rules.js';

const fixturesUrl = new URL('./fixtures/woo_reference.json', import.meta.url);
const woo = JSON.parse(fs.readFileSync(fixturesUrl, 'utf8'));
const splitRuleTag = buildRuleTag(DEFAULT_RULES);
const splitPrecomputeUrl = new URL(
  `../assets/precompute/split-ev.${splitRuleTag}.json`,
  import.meta.url,
);
const splitPrecompute = JSON.parse(fs.readFileSync(splitPrecomputeUrl, 'utf8'));

// Smoke-Auswahl: bewusst klein halten.
// Du kannst die Liste später erweitern, sobald die Engine stabil & schnell ist.
const SMOKE_INDICES = [0, 1, 7, 11, 12];

const VERBOSE = process.env.VERBOSE_TESTS === '1';

describe('bestAction (WoO Smoke)', () => {
  it('matches WoO best action for selected fixtures', () => {
    for (const idx of SMOKE_INDICES) {
      const f = woo[idx];
      if (!f) throw new Error(`Smoke index ${idx} out of range`);

      const expected = bestAction(f.ev); // best action laut WoO-EVs
      const evs = computeAllActionsEV({
        p1: f.p1,
        p2: f.p2,
        dealerUp: f.d,
        splitEVs: splitPrecompute,
      });
      const actual = bestAction(evs);

      if (VERBOSE) {
        console.log(
          `SMOKE #${idx}: ${f.p1},${f.p2} vs ${f.d} expected=${expected} actual=${actual}`
        );
      }

      expect(actual).toBe(expected);
    }
  });
});
