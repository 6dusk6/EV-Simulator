export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T'];
export const RANK_INDEX = RANKS.reduce((acc, rank, index) => {
  acc[rank] = index;
  return acc;
}, {});

export const ACE_INDEX = 0;
export const TEN_INDEX = 9;

export const COUNTS_PER_DECK = [4, 4, 4, 4, 4, 4, 4, 4, 4, 16];
export const DEFAULT_DECKS = 6;
export const BASE_COUNTS = COUNTS_PER_DECK.map((count) => count * DEFAULT_DECKS);

export const normalizeRank = (rank) => {
  if (rank === undefined || rank === null) {
    return '';
  }
  const normalized = String(rank).trim().toUpperCase();
  if (normalized === '10') return 'T';
  if (normalized === 'T') return 'T';
  if (normalized === 'A') return 'A';
  if (/^[2-9]$/.test(normalized)) return normalized;
  return normalized;
};
