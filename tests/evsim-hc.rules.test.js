import { afterEach, describe, expect, it, vi } from 'vitest';
import '../assets/evsim-hc.js';

describe('evsim handcalc rule tags', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('updates split ruleTag for doubleRule changes and requests the correct split filename', async () => {
    const hooks = globalThis.__evsimHcTestHooks;
    expect(hooks).toBeTruthy();

    const baseRules = hooks.normalizeRules({ doubleRule: '9-11' });
    const nextRules = hooks.normalizeRules({ doubleRule: '10-11' });
    const baseTag = hooks.buildSplitRuleTag(baseRules);
    const nextTag = hooks.buildSplitRuleTag(nextRules);

    expect(baseTag).not.toEqual(nextTag);

    const fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await hooks.loadSplitPrecompute(baseTag);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain(`split-ev.${baseTag}.json`);
  });

  it('updates split ruleTag when peek toggles', () => {
    const hooks = globalThis.__evsimHcTestHooks;
    expect(hooks).toBeTruthy();

    const baseRules = hooks.normalizeRules({ peek: false });
    const nextRules = hooks.normalizeRules({ peek: true });
    const baseTag = hooks.buildSplitRuleTag(baseRules);
    const nextTag = hooks.buildSplitRuleTag(nextRules);

    expect(baseTag).not.toEqual(nextTag);
    expect(baseTag).toContain('NOPEEK');
    expect(nextTag).toContain('PEEK');
  });

  it('updates split ruleTag and filename when decks change', async () => {
    const hooks = globalThis.__evsimHcTestHooks;
    expect(hooks).toBeTruthy();

    const baseRules = hooks.normalizeRules({ decks: 6 });
    const nextRules = hooks.normalizeRules({ decks: 1 });
    const baseTag = hooks.buildSplitRuleTag(baseRules);
    const nextTag = hooks.buildSplitRuleTag(nextRules);

    expect(baseTag).not.toEqual(nextTag);
    expect(baseTag).toContain('6D');
    expect(nextTag).toContain('1D');

    const fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await hooks.loadSplitPrecompute(nextTag);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain(`split-ev.${nextTag}.json`);
  });
});
