import { ACE_INDEX, TEN_INDEX } from './constants.js';

export function handValue(cards) {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    if (card === ACE_INDEX) {
      aces += 1;
      total += 11;
    } else if (card === TEN_INDEX) {
      total += 10;
    } else {
      total += card + 1;
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return total;
}

export function isPair(cards) {
  return cards.length === 2 && cards[0] === cards[1];
}

export function isBlackjack(cards) {
  if (cards.length !== 2) {
    return false;
  }
  const hasAce = cards.includes(ACE_INDEX);
  const hasTen = cards.includes(TEN_INDEX);
  return hasAce && hasTen;
}
