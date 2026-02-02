import { describe, expect, it } from 'vitest';
import { buildRuleTag, DEFAULT_RULES } from '../src/engine/rules.js';

describe('engine rule tags', () => {
  it('uses DAS vs NDAS based on doubleAfterSplit', () => {
    const dasTag = buildRuleTag(DEFAULT_RULES);
    const ndasTag = buildRuleTag({ ...DEFAULT_RULES, doubleAfterSplit: false });

    expect(dasTag).toBe('S17_DAS_DR-any_NOPEEK_6D');
    expect(ndasTag).toBe('S17_NDAS_DR-any_NOPEEK_6D');
    expect(dasTag).not.toEqual(ndasTag);
  });
});
