import { DEFAULT_DECKS } from './constants.js';

export const DEFAULT_RULES = Object.freeze({
  hitSoft17: false,
  doubleAfterSplit: true,
  resplitAces: true,
  doubleRule: 'any_two',
  peek: false,
  surrender: 'none',
  decks: DEFAULT_DECKS,
});

const DOUBLE_RULES = new Set(['any_two', '9_10', '9_11', '10_11', 'any', '9-11', '10-11']);
const SURRENDER_RULES = new Set(['none', 'late']);

const normalizeDoubleRule = (rule) => {
  if (rule === 'any') {
    return 'any_two';
  }
  if (rule === '9-11') {
    return '9_11';
  }
  if (rule === '10-11') {
    return '10_11';
  }
  return DOUBLE_RULES.has(rule) ? rule : DEFAULT_RULES.doubleRule;
};

const normalizeSurrender = (rule) =>
  SURRENDER_RULES.has(rule) ? rule : DEFAULT_RULES.surrender;

export function normalizeRules(rules = {}) {
  return {
    hitSoft17: rules.hitSoft17 ?? DEFAULT_RULES.hitSoft17,
    doubleAfterSplit: rules.doubleAfterSplit ?? DEFAULT_RULES.doubleAfterSplit,
    resplitAces: rules.resplitAces ?? DEFAULT_RULES.resplitAces,
    doubleRule: normalizeDoubleRule(rules.doubleRule ?? DEFAULT_RULES.doubleRule),
    peek: rules.peek ?? DEFAULT_RULES.peek,
    surrender: normalizeSurrender(rules.surrender ?? DEFAULT_RULES.surrender),
    decks: rules.decks ?? DEFAULT_RULES.decks,
  };
}

export function buildRuleTag(rules = {}) {
  const normalized = normalizeRules(rules);
  const softRule = normalized.hitSoft17 ? 'H17' : 'S17';
  const dasRule = normalized.doubleAfterSplit ? 'DAS' : 'NDAS';
  const doubleRule = (() => {
    switch (normalized.doubleRule) {
      case '9_10':
        return 'DR-9-10';
      case '9_11':
        return 'DR-9-11';
      case '10_11':
        return 'DR-10-11';
      default:
        return 'DR-any';
    }
  })();
  const peekRule = normalized.peek ? 'PEEK' : 'NOPEEK';
  return `${softRule}_${dasRule}_${doubleRule}_${peekRule}_${normalized.decks}D`;
}

export function rulesKey(rules = {}) {
  return buildRuleTag(rules);
}
