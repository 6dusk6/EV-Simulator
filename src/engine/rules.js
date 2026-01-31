import { DEFAULT_DECKS } from './constants.js';

export const DEFAULT_RULES = Object.freeze({
  hitSoft17: false,
  doubleAfterSplit: true,
  resplitAces: true,
  decks: DEFAULT_DECKS,
});

export function normalizeRules(rules = {}) {
  return {
    hitSoft17: rules.hitSoft17 ?? DEFAULT_RULES.hitSoft17,
    doubleAfterSplit: rules.doubleAfterSplit ?? DEFAULT_RULES.doubleAfterSplit,
    resplitAces: rules.resplitAces ?? DEFAULT_RULES.resplitAces,
    decks: rules.decks ?? DEFAULT_RULES.decks,
  };
}

export function rulesKey(rules = {}) {
  const normalized = normalizeRules(rules);
  const softRule = normalized.hitSoft17 ? 'H17' : 'S17';
  const dasRule = normalized.doubleAfterSplit ? 'DAS' : 'NDAS';
  const rsaRule = normalized.resplitAces ? 'RSA' : 'NRSA';
  return `${softRule}_${dasRule}_${rsaRule}_${normalized.decks}D`;
}
