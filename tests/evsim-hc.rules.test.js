import { afterEach, describe, expect, it, vi } from 'vitest';
import '../assets/evsim-hc.js';

describe('evsim handcalc rule tags', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('updates ruleTag for doubleRule changes and requests the correct split filename', async () => {
    const hooks = globalThis.__evsimHcTestHooks;
    expect(hooks).toBeTruthy();

    const baseRules = hooks.normalizeRules({ doubleRule: '9-11' });
    const nextRules = hooks.normalizeRules({ doubleRule: '10-11' });
    const baseTag = hooks.rulesKey(baseRules);
    const nextTag = hooks.rulesKey(nextRules);

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
});
