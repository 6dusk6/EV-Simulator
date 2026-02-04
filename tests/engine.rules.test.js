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

  it('distinguishes S17 vs H17 based on hitSoft17', () => {
    const s17Tag = buildRuleTag({ ...DEFAULT_RULES, hitSoft17: false });
    const h17Tag = buildRuleTag({ ...DEFAULT_RULES, hitSoft17: true });

    expect(s17Tag).toContain('S17');
    expect(h17Tag).toContain('H17');
    expect(s17Tag).not.toEqual(h17Tag);
  });
});
