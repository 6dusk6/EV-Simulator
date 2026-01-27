export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T'];
export const RANK_INDEX = RANKS.reduce((acc, rank, index) => {
  acc[rank] = index;
  return acc;
}, {});

export const ACE_INDEX = 0;
export const TEN_INDEX = 9;

export const BASE_COUNTS = [24, 24, 24, 24, 24, 24, 24, 24, 24, 96];
