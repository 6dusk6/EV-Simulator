import { BASE_COUNTS, COUNTS_PER_DECK, DEFAULT_DECKS, RANK_INDEX } from './constants.js';
import { normalizeRules } from './rules.js';

export function createShoe(rules) {
  if (!rules) {
    return BASE_COUNTS.slice();
  }
  const normalized = normalizeRules(rules);
  if (normalized.decks === DEFAULT_DECKS) {
    return BASE_COUNTS.slice();
  }
  return COUNTS_PER_DECK.map((count) => count * normalized.decks);
}

export function cloneShoe(shoe) {
  return shoe.slice();
}

export function removeCard(shoe, rank) {
  const index = RANK_INDEX[rank];
  if (index === undefined) {
    throw new Error(`Unknown rank: ${rank}`);
  }
  if (shoe[index] <= 0) {
    throw new Error(`No cards left for rank: ${rank}`);
  }
  shoe[index] -= 1;
}

export function totalCards(shoe) {
  return shoe.reduce((sum, count) => sum + count, 0);
}

export function shoeKey(shoe) {
  return shoe.join(',');
}
