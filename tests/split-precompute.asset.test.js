import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { RANKS } from '../src/engine/constants.js';
import { buildRuleTag, DEFAULT_RULES } from '../src/engine/rules.js';

describe('split precompute assets', () => {
  it('has 100 finite split EV entries for default ruleset', () => {
    const ruleTag = buildRuleTag(DEFAULT_RULES);
    const splitPrecomputeUrl = new URL(
      `../assets/precompute/split-ev.${ruleTag}.json`,
      import.meta.url,
    );
    const splitPrecompute = JSON.parse(fs.readFileSync(splitPrecomputeUrl, 'utf8'));
    const expectedKeys = [];
    for (const rank of RANKS) {
      for (const dealerUp of RANKS) {
        expectedKeys.push(`${rank},${rank}|${dealerUp}`);
      }
    }

    expect(Object.keys(splitPrecompute).length).toBe(expectedKeys.length);

    for (const key of expectedKeys) {
      expect(splitPrecompute).toHaveProperty(key);
      expect(Number.isFinite(splitPrecompute[key])).toBe(true);
    }
  });
});
