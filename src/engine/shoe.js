import { BASE_COUNTS, RANK_INDEX } from './constants.js';

export function createShoe() {
  return BASE_COUNTS.slice();
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
