import { ACE_INDEX, TEN_INDEX } from './constants.js';
import { totalCards, shoeKey } from './shoe.js';

function addCardToTotal(total, soft, rankIndex) {
  if (rankIndex === ACE_INDEX) {
    if (total + 11 <= 21) {
      return { total: total + 11, soft: true };
    }
    return { total: total + 1, soft };
  }
  const value = rankIndex === TEN_INDEX ? 10 : rankIndex + 1;
  return { total: total + value, soft };
}

function normalizeTotal(total, soft) {
  if (total > 21 && soft) {
    return { total: total - 10, soft: false };
  }
  return { total, soft };
}

function drawDealer(total, soft, shoe, memo) {
  const normalized = normalizeTotal(total, soft);
  const key = `${shoeKey(shoe)}|${normalized.total}|${normalized.soft ? 1 : 0}`;

  if (memo.has(key)) {
    return memo.get(key);
  }

  // Stand on all 17+ (S17)
  if (normalized.total >= 17) {
    const outcome = new Map();
    if (normalized.total > 21) {
      outcome.set('bust', 1);
    } else {
      outcome.set(String(normalized.total), 1);
    }
    memo.set(key, outcome);
    return outcome;
  }

  const outcomes = new Map();
  const cardsLeft = totalCards(shoe);

  for (let i = 0; i < shoe.length; i += 1) {
    const count = shoe[i];
    if (count === 0) continue;

    const prob = count / cardsLeft;

    const nextShoe = shoe.slice();
    nextShoe[i] -= 1;

    const added = addCardToTotal(normalized.total, normalized.soft, i);
    const normalizedNext = normalizeTotal(added.total, added.soft);

    const subOutcomes = drawDealer(
      normalizedNext.total,
      normalizedNext.soft,
      nextShoe,
      memo
    );

    for (const [result, subProb] of subOutcomes.entries()) {
      outcomes.set(result, (outcomes.get(result) || 0) + prob * subProb);
    }
  }

  memo.set(key, outcomes);
  return outcomes;
}

export function dealerOutcomes(shoe, dealerUpIndex) {
  const cardsLeft = totalCards(shoe);
  const outcomes = new Map();
  const memo = new Map();

  // upcard already known
  const first = addCardToTotal(0, false, dealerUpIndex);

  for (let i = 0; i < shoe.length; i += 1) {
    const count = shoe[i];
    if (count === 0) continue;

    const prob = count / cardsLeft;

    const nextShoe = shoe.slice();
    nextShoe[i] -= 1;

    const second = addCardToTotal(first.total, first.soft, i);
    const normalized = normalizeTotal(second.total, second.soft);

    const isBlackjack = normalized.total === 21;
    if (isBlackjack && (dealerUpIndex === ACE_INDEX || dealerUpIndex === TEN_INDEX)) {
      outcomes.set('blackjack', (outcomes.get('blackjack') || 0) + prob);
      continue;
    }

    const subOutcomes = drawDealer(normalized.total, normalized.soft, nextShoe, memo);
    for (const [result, subProb] of subOutcomes.entries()) {
      outcomes.set(result, (outcomes.get(result) || 0) + prob * subProb);
    }
  }

  return outcomes;
}
