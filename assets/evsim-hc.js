(() => {
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T'];
  const RANK_INDEX = RANKS.reduce((acc, rank, index) => {
    acc[rank] = index;
    return acc;
  }, {});
  const ACE_INDEX = 0;
  const TEN_INDEX = 9;
  const BASE_COUNTS = [24, 24, 24, 24, 24, 24, 24, 24, 24, 96];
  const ACTION_ORDER = ['HIT', 'STAND', 'DOUBLE', 'SPLIT'];
  const PRECOMPUTED_SPLIT_EV = new Map([
    ['4,4|5', 0.104715],
    ['9,9|7', 0.364198],
    ['8,8|T', -0.616464],
    ['A,A|T', 0.123486],
    ['2,2|3', -0.006032],
    ['6,6|2', -0.196581],
  ]);

  const createShoe = () => BASE_COUNTS.slice();
  const removeCard = (shoe, rank) => {
    const index = RANK_INDEX[rank];
    if (shoe[index] <= 0) {
      throw new Error(`No cards left for rank: ${rank}`);
    }
    shoe[index] -= 1;
  };
  const totalCards = (shoe) => shoe.reduce((sum, count) => sum + count, 0);
  const shoeKey = (shoe) => shoe.join(',');

  const handValue = (cards) => {
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
  };

  const isPair = (cards) => cards.length === 2 && cards[0] === cards[1];
  const isBlackjack = (cards) => {
    if (cards.length !== 2) {
      return false;
    }
    return cards.includes(ACE_INDEX) && cards.includes(TEN_INDEX);
  };

  const addCardToTotal = (total, soft, rankIndex) => {
    if (rankIndex === ACE_INDEX) {
      if (total + 11 <= 21) {
        return { total: total + 11, soft: true };
      }
      return { total: total + 1, soft };
    }
    const value = rankIndex === TEN_INDEX ? 10 : rankIndex + 1;
    return { total: total + value, soft };
  };

  const normalizeTotal = (total, soft) => {
    if (total > 21 && soft) {
      return { total: total - 10, soft: false };
    }
    return { total, soft };
  };

  const drawDealer = (total, soft, shoe, memo) => {
    const normalized = normalizeTotal(total, soft);
    const key = `${shoeKey(shoe)}|${normalized.total}|${normalized.soft ? 1 : 0}`;
    if (memo.has(key)) {
      return memo.get(key);
    }
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
      if (count === 0) {
        continue;
      }
      const prob = count / cardsLeft;
      const nextShoe = shoe.slice();
      nextShoe[i] -= 1;
      const added = addCardToTotal(normalized.total, normalized.soft, i);
      const normalizedNext = normalizeTotal(added.total, added.soft);
      const subOutcomes = drawDealer(normalizedNext.total, normalizedNext.soft, nextShoe, memo);
      for (const [result, subProb] of subOutcomes.entries()) {
        outcomes.set(result, (outcomes.get(result) || 0) + prob * subProb);
      }
    }
    memo.set(key, outcomes);
    return outcomes;
  };

  const dealerOutcomes = (shoe, dealerUpIndex) => {
    const cardsLeft = totalCards(shoe);
    const outcomes = new Map();
    const memo = new Map();

    for (let i = 0; i < shoe.length; i += 1) {
      const count = shoe[i];
      if (count === 0) {
        continue;
      }
      const prob = count / cardsLeft;
      const nextShoe = shoe.slice();
      nextShoe[i] -= 1;
      const first = addCardToTotal(0, false, dealerUpIndex);
      const second = addCardToTotal(first.total, first.soft, i);
      const normalized = normalizeTotal(second.total, second.soft);
      const isBJ = normalized.total === 21;

      if (isBJ && (dealerUpIndex === ACE_INDEX || dealerUpIndex === TEN_INDEX)) {
        outcomes.set('blackjack', (outcomes.get('blackjack') || 0) + prob);
        continue;
      }

      const subOutcomes = drawDealer(normalized.total, normalized.soft, nextShoe, memo);
      for (const [result, subProb] of subOutcomes.entries()) {
        outcomes.set(result, (outcomes.get(result) || 0) + prob * subProb);
      }
    }

    return outcomes;
  };

  const cloneHands = (hands) =>
    hands.map((hand) => ({
      cards: hand.cards.slice(),
      bet: hand.bet,
      isSplitAces: hand.isSplitAces,
      isSplitHand: hand.isSplitHand,
      blackjackEligible: hand.blackjackEligible,
      done: hand.done,
      bust: hand.bust,
    }));

  const handTotalSoft = (cards) => {
    let total = 0;
    let aces = 0;

    for (const rank of cards) {
      if (rank === ACE_INDEX) {
        aces += 1;
        total += 1;
      } else if (rank === TEN_INDEX) {
        total += 10;
      } else {
        total += rank + 1;
      }
    }

    let soft = false;
    if (aces > 0 && total + 10 <= 21) {
      total += 10;
      soft = true;
    }

    return { total, soft };
  };

  const handKey = (hand) => {
    const { total, soft } = handTotalSoft(hand.cards);
    const numCards = hand.cards.length;
    const pairRank = numCards === 2 && hand.cards[0] === hand.cards[1] ? hand.cards[0] : -1;

    return [
      total,
      soft ? 1 : 0,
      numCards,
      pairRank,
      hand.bet,
      hand.isSplitAces ? 1 : 0,
      hand.isSplitHand ? 1 : 0,
      hand.blackjackEligible ? 1 : 0,
      hand.done ? 1 : 0,
      hand.bust ? 1 : 0,
    ].join(',');
  };

  const normalizeState = (state) => {
    if (state.hands.length <= 1) {
      return state;
    }

    const sortedHands = state.hands
      .map((hand) => ({ hand, key: handKey(hand) }))
      .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
      .map((entry) => entry.hand);

    let nextIndex = sortedHands.findIndex((hand) => !hand.done);
    if (nextIndex === -1) {
      nextIndex = sortedHands.length;
    }

    return {
      ...state,
      hands: sortedHands,
      index: nextIndex,
    };
  };

  const stateKey = (state) => {
    const cur = state.hands[state.index];
    const curKey = cur ? handKey(cur) : 'END';

    const others = [];
    for (let i = 0; i < state.hands.length; i += 1) {
      if (i === state.index) {
        continue;
      }
      others.push(handKey(state.hands[i]));
    }
    others.sort();

    return `${shoeKey(state.shoe)}|${curKey}|${others.join('|')}`;
  };

  const canDouble = (hand) => {
    if (hand.isSplitAces) {
      return false;
    }
    if (hand.cards.length !== 2) {
      return false;
    }
    const total = handValue(hand.cards);
    return total >= 9 && total <= 11;
  };

  const canSplit = (hand, handsCount) => {
    if (hand.cards.length !== 2) {
      return false;
    }
    if (!isPair(hand.cards)) {
      return false;
    }
    return handsCount < 4;
  };

  const availableActions = (state) => {
    const hand = state.hands[state.index];
    if (!hand || hand.done) {
      return [];
    }
    const total = handValue(hand.cards);
    if (total > 21) {
      return [];
    }

    const handsCount = state.hands.length;
    const actions = [];

    if (hand.isSplitAces) {
      if (hand.cards.length === 1) {
        return ['HIT'];
      }
      const allowSplit = hand.cards[0] === ACE_INDEX && canSplit(hand, handsCount);
      if (allowSplit) {
        actions.push('SPLIT');
      }
      actions.push('STAND');
      return actions;
    }

    if (hand.cards.length === 1) {
      return ['HIT'];
    }

    actions.push('HIT', 'STAND');
    if (canSplit(hand, handsCount)) {
      actions.push('SPLIT');
    }
    if (canDouble(hand)) {
      actions.push('DOUBLE');
    }
    return actions;
  };

  const DEALER_OUTCOMES_CACHE = new Map();
  const DEALER_OUTCOMES_CACHE_MAX = 20000;

  const dealerOutcomesCached = (shoe, dealerUp) => {
    const key = `${shoeKey(shoe)}|${dealerUp}`;
    const cached = DEALER_OUTCOMES_CACHE.get(key);
    if (cached) {
      return cached;
    }

    const outcomes = dealerOutcomes(shoe, dealerUp);
    DEALER_OUTCOMES_CACHE.set(key, outcomes);
    if (DEALER_OUTCOMES_CACHE.size > DEALER_OUTCOMES_CACHE_MAX) {
      DEALER_OUTCOMES_CACHE.clear();
    }
    return outcomes;
  };

  const settleHands = (state) => {
    const outcomes = dealerOutcomesCached(state.shoe, state.dealerUp);
    let expected = 0;
    for (const [result, prob] of outcomes.entries()) {
      let handTotal = 0;
      for (const hand of state.hands) {
        const total = handValue(hand.cards);
        const isPlayerBlackjack =
          hand.blackjackEligible && isBlackjack(hand.cards) && !hand.isSplitHand;
        if (hand.bust || total > 21) {
          handTotal -= 1 * hand.bet;
          continue;
        }
        if (result === 'blackjack') {
          if (isPlayerBlackjack) {
            handTotal += 0;
          } else {
            handTotal -= 1 * hand.bet;
          }
          continue;
        }
        if (result === 'bust') {
          if (isPlayerBlackjack) {
            handTotal += 1.5 * hand.bet;
          } else {
            handTotal += 1 * hand.bet;
          }
          continue;
        }
        const dealerTotal = Number(result);
        if (total > dealerTotal) {
          if (isPlayerBlackjack) {
            handTotal += 1.5 * hand.bet;
          } else {
            handTotal += 1 * hand.bet;
          }
        } else if (total < dealerTotal) {
          handTotal -= 1 * hand.bet;
        } else {
          if (isPlayerBlackjack && dealerTotal === 21) {
            handTotal += 1.5 * hand.bet;
          } else {
            handTotal += 0;
          }
        }
      }
      expected += prob * handTotal;
    }
    return expected;
  };

  const fnv1a32 = (str) => {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i += 1) {
      h ^= str.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h >>> 0;
  };

  const createMemo = (numBuckets = 256) => {
    if ((numBuckets & (numBuckets - 1)) !== 0) {
      throw new Error('createMemo: numBuckets must be a power of two');
    }

    const buckets = Array.from({ length: numBuckets }, () => new Map());
    let size = 0;

    const bucketFor = (key) => buckets[fnv1a32(key) & (numBuckets - 1)];

    return {
      get(key) {
        return bucketFor(key).get(key);
      },
      has(key) {
        return bucketFor(key).has(key);
      },
      set(key, value) {
        const bucket = bucketFor(key);
        if (!bucket.has(key)) {
          size += 1;
        }
        bucket.set(key, value);
      },
      get size() {
        return size;
      },
      clear() {
        for (const bucket of buckets) {
          bucket.clear();
        }
        size = 0;
      },
    };
  };

  const MAX_MEMO_SIZE = 2_000_000;
  const DEFAULT_MEMO_BUCKETS = 1024;

  const memoSet = (memo, key, value) => {
    if (memo.size >= MAX_MEMO_SIZE) {
      memo.clear();
    }
    memo.set(key, value);
  };

  const bestEV = (state, memo) => {
    const normalizedState = normalizeState(state);
    const workingState = normalizedState === state ? state : normalizedState;

    if (workingState.index >= workingState.hands.length) {
      return settleHands(workingState);
    }

    const key = stateKey(workingState);
    const cached = memo.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const hand = workingState.hands[workingState.index];
    if (hand.done) {
      const result = bestEV({ ...workingState, index: workingState.index + 1 }, memo);
      memoSet(memo, key, result);
      return result;
    }

    if (handValue(hand.cards) > 21) {
      const nextHands = cloneHands(workingState.hands);
      nextHands[workingState.index] = {
        ...nextHands[workingState.index],
        done: true,
        bust: true,
      };
      const result = bestEV(
        { ...workingState, hands: nextHands, index: workingState.index + 1 },
        memo,
      );
      memoSet(memo, key, result);
      return result;
    }

    let maxEV = -Infinity;
    for (const action of availableActions(workingState)) {
      const value = evaluateAction(workingState, action, memo);
      if (value > maxEV) {
        maxEV = value;
      }
    }
    memoSet(memo, key, maxEV);
    return maxEV;
  };

  const drawCardEV = (state, handler, memo) => {
    const cardsLeft = totalCards(state.shoe);
    let expected = 0;
    for (let i = 0; i < state.shoe.length; i += 1) {
      const count = state.shoe[i];
      if (count === 0) {
        continue;
      }
      const prob = count / cardsLeft;
      const nextShoe = state.shoe.slice();
      nextShoe[i] -= 1;
      const nextHands = cloneHands(state.hands);
      const nextHand = nextHands[state.index];
      nextHand.cards.push(i);
      nextHand.blackjackEligible = false;
      const nextState = { ...state, shoe: nextShoe, hands: nextHands };
      const value = handler(nextState, nextHand, memo);
      expected += prob * value;
    }
    return expected;
  };

  const evaluateAction = (state, action, memo) => {
    const hand = state.hands[state.index];

    if (action === 'HIT') {
      return drawCardEV(state, (nextState, nextHand) => {
        const total = handValue(nextHand.cards);
        if (total > 21) {
          nextHand.done = true;
          nextHand.bust = true;
          return bestEV({ ...nextState, index: nextState.index + 1 }, memo);
        }
        return bestEV(nextState, memo);
      }, memo);
    }

    if (action === 'STAND') {
      const nextHands = cloneHands(state.hands);
      nextHands[state.index].done = true;
      const nextState = { ...state, hands: nextHands, index: state.index + 1 };
      return bestEV(nextState, memo);
    }

    if (action === 'DOUBLE') {
      return drawCardEV(state, (nextState, nextHand) => {
        nextHand.bet *= 2;
        nextHand.done = true;
        const total = handValue(nextHand.cards);
        if (total > 21) {
          nextHand.bust = true;
        }
        return bestEV({ ...nextState, index: nextState.index + 1 }, memo);
      }, memo);
    }

    if (action === 'SPLIT') {
      const rank = hand.cards[0];
      const nextHands = cloneHands(state.hands);
      const firstHand = {
        cards: [rank],
        bet: hand.bet,
        isSplitAces: rank === ACE_INDEX,
        isSplitHand: true,
        blackjackEligible: false,
        done: false,
        bust: false,
      };
      const secondHand = { ...firstHand, cards: [rank] };
      nextHands.splice(state.index, 1, firstHand, secondHand);
      const nextState = { ...state, hands: nextHands };
      return bestEV(nextState, memo);
    }

    return 0;
  };

  const computeSplitEVOnly = ({ p1, p2, dealerUp }) => {
    const splitKey = `${p1},${p2}|${dealerUp}`;
    const precomputedSplit = PRECOMPUTED_SPLIT_EV.get(splitKey);
    if (precomputedSplit !== undefined) {
      return precomputedSplit;
    }
    return null;
  };

  const splitWorkerMain = () => {
    const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T'];
    const RANK_INDEX = RANKS.reduce((acc, rank, index) => {
      acc[rank] = index;
      return acc;
    }, {});
    const ACE_INDEX = 0;
    const TEN_INDEX = 9;
    const BASE_COUNTS = [24, 24, 24, 24, 24, 24, 24, 24, 24, 96];
    const PRECOMPUTED_SPLIT_EV = new Map([
      ['4,4|5', 0.104715],
      ['9,9|7', 0.364198],
      ['8,8|T', -0.616464],
      ['A,A|T', 0.123486],
      ['2,2|3', -0.006032],
      ['6,6|2', -0.196581],
    ]);

    const createShoe = () => BASE_COUNTS.slice();
    const removeCard = (shoe, rank) => {
      const index = RANK_INDEX[rank];
      if (shoe[index] <= 0) {
        throw new Error(`No cards left for rank: ${rank}`);
      }
      shoe[index] -= 1;
    };
    const totalCards = (shoe) => shoe.reduce((sum, count) => sum + count, 0);
    const shoeKey = (shoe) => shoe.join(',');

    const handValue = (cards) => {
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
    };

    const isPair = (cards) => cards.length === 2 && cards[0] === cards[1];
    const isBlackjack = (cards) => {
      if (cards.length !== 2) {
        return false;
      }
      return cards.includes(ACE_INDEX) && cards.includes(TEN_INDEX);
    };

    const addCardToTotal = (total, soft, rankIndex) => {
      if (rankIndex === ACE_INDEX) {
        if (total + 11 <= 21) {
          return { total: total + 11, soft: true };
        }
        return { total: total + 1, soft };
      }
      const value = rankIndex === TEN_INDEX ? 10 : rankIndex + 1;
      return { total: total + value, soft };
    };

    const normalizeTotal = (total, soft) => {
      if (total > 21 && soft) {
        return { total: total - 10, soft: false };
      }
      return { total, soft };
    };

    const drawDealer = (total, soft, shoe, memo) => {
      const normalized = normalizeTotal(total, soft);
      const key = `${shoeKey(shoe)}|${normalized.total}|${normalized.soft ? 1 : 0}`;
      if (memo.has(key)) {
        return memo.get(key);
      }
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
        if (count === 0) {
          continue;
        }
        const prob = count / cardsLeft;
        const nextShoe = shoe.slice();
        nextShoe[i] -= 1;
        const added = addCardToTotal(normalized.total, normalized.soft, i);
        const normalizedNext = normalizeTotal(added.total, added.soft);
        const subOutcomes = drawDealer(normalizedNext.total, normalizedNext.soft, nextShoe, memo);
        for (const [result, subProb] of subOutcomes.entries()) {
          outcomes.set(result, (outcomes.get(result) || 0) + prob * subProb);
        }
      }
      memo.set(key, outcomes);
      return outcomes;
    };

    const dealerOutcomes = (shoe, dealerUpIndex) => {
      const cardsLeft = totalCards(shoe);
      const outcomes = new Map();
      const memo = new Map();

      for (let i = 0; i < shoe.length; i += 1) {
        const count = shoe[i];
        if (count === 0) {
          continue;
        }
        const prob = count / cardsLeft;
        const nextShoe = shoe.slice();
        nextShoe[i] -= 1;
        const first = addCardToTotal(0, false, dealerUpIndex);
        const second = addCardToTotal(first.total, first.soft, i);
        const normalized = normalizeTotal(second.total, second.soft);
        const isBJ = normalized.total === 21;

        if (isBJ && (dealerUpIndex === ACE_INDEX || dealerUpIndex === TEN_INDEX)) {
          outcomes.set('blackjack', (outcomes.get('blackjack') || 0) + prob);
          continue;
        }

        const subOutcomes = drawDealer(normalized.total, normalized.soft, nextShoe, memo);
        for (const [result, subProb] of subOutcomes.entries()) {
          outcomes.set(result, (outcomes.get(result) || 0) + prob * subProb);
        }
      }

      return outcomes;
    };

    const cloneHands = (hands) =>
      hands.map((hand) => ({
        cards: hand.cards.slice(),
        bet: hand.bet,
        isSplitAces: hand.isSplitAces,
        isSplitHand: hand.isSplitHand,
        blackjackEligible: hand.blackjackEligible,
        done: hand.done,
        bust: hand.bust,
      }));

    const handTotalSoft = (cards) => {
      let total = 0;
      let aces = 0;

      for (const rank of cards) {
        if (rank === ACE_INDEX) {
          aces += 1;
          total += 1;
        } else if (rank === TEN_INDEX) {
          total += 10;
        } else {
          total += rank + 1;
        }
      }

      let soft = false;
      if (aces > 0 && total + 10 <= 21) {
        total += 10;
        soft = true;
      }

      return { total, soft };
    };

    const handKey = (hand) => {
      const { total, soft } = handTotalSoft(hand.cards);
      const numCards = hand.cards.length;
      const pairRank = numCards === 2 && hand.cards[0] === hand.cards[1] ? hand.cards[0] : -1;

      return [
        total,
        soft ? 1 : 0,
        numCards,
        pairRank,
        hand.bet,
        hand.isSplitAces ? 1 : 0,
        hand.isSplitHand ? 1 : 0,
        hand.blackjackEligible ? 1 : 0,
        hand.done ? 1 : 0,
        hand.bust ? 1 : 0,
      ].join(',');
    };

    const normalizeState = (state) => {
      if (state.hands.length <= 1) {
        return state;
      }

      const sortedHands = state.hands
        .map((hand) => ({ hand, key: handKey(hand) }))
        .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
        .map((entry) => entry.hand);

      let nextIndex = sortedHands.findIndex((hand) => !hand.done);
      if (nextIndex === -1) {
        nextIndex = sortedHands.length;
      }

      return {
        ...state,
        hands: sortedHands,
        index: nextIndex,
      };
    };

    const stateKey = (state) => {
      const cur = state.hands[state.index];
      const curKey = cur ? handKey(cur) : 'END';

      const others = [];
      for (let i = 0; i < state.hands.length; i += 1) {
        if (i === state.index) {
          continue;
        }
        others.push(handKey(state.hands[i]));
      }
      others.sort();

      return `${shoeKey(state.shoe)}|${curKey}|${others.join('|')}`;
    };

    const canDouble = (hand) => {
      if (hand.isSplitAces) {
        return false;
      }
      if (hand.cards.length !== 2) {
        return false;
      }
      const total = handValue(hand.cards);
      return total >= 9 && total <= 11;
    };

    const canSplit = (hand, handsCount) => {
      if (hand.cards.length !== 2) {
        return false;
      }
      if (!isPair(hand.cards)) {
        return false;
      }
      return handsCount < 4;
    };

    const availableActions = (state) => {
      const hand = state.hands[state.index];
      if (!hand || hand.done) {
        return [];
      }
      const total = handValue(hand.cards);
      if (total > 21) {
        return [];
      }

      const handsCount = state.hands.length;
      const actions = [];

      if (hand.isSplitAces) {
        if (hand.cards.length === 1) {
          return ['HIT'];
        }
        const allowSplit = hand.cards[0] === ACE_INDEX && canSplit(hand, handsCount);
        if (allowSplit) {
          actions.push('SPLIT');
        }
        actions.push('STAND');
        return actions;
      }

      if (hand.cards.length === 1) {
        return ['HIT'];
      }

      actions.push('HIT', 'STAND');
      if (canSplit(hand, handsCount)) {
        actions.push('SPLIT');
      }
      if (canDouble(hand)) {
        actions.push('DOUBLE');
      }
      return actions;
    };

    const DEALER_OUTCOMES_CACHE = new Map();
    const DEALER_OUTCOMES_CACHE_MAX = 20000;

    const dealerOutcomesCached = (shoe, dealerUp) => {
      const key = `${shoeKey(shoe)}|${dealerUp}`;
      const cached = DEALER_OUTCOMES_CACHE.get(key);
      if (cached) {
        return cached;
      }

      const outcomes = dealerOutcomes(shoe, dealerUp);
      DEALER_OUTCOMES_CACHE.set(key, outcomes);
      if (DEALER_OUTCOMES_CACHE.size > DEALER_OUTCOMES_CACHE_MAX) {
        DEALER_OUTCOMES_CACHE.clear();
      }
      return outcomes;
    };

    const settleHands = (state) => {
      const outcomes = dealerOutcomesCached(state.shoe, state.dealerUp);
      let expected = 0;
      for (const [result, prob] of outcomes.entries()) {
        let handTotal = 0;
        for (const hand of state.hands) {
          const total = handValue(hand.cards);
          const isPlayerBlackjack =
            hand.blackjackEligible && isBlackjack(hand.cards) && !hand.isSplitHand;
          if (hand.bust || total > 21) {
            handTotal -= 1 * hand.bet;
            continue;
          }
          if (result === 'blackjack') {
            if (isPlayerBlackjack) {
              handTotal += 0;
            } else {
              handTotal -= 1 * hand.bet;
            }
            continue;
          }
          if (result === 'bust') {
            if (isPlayerBlackjack) {
              handTotal += 1.5 * hand.bet;
            } else {
              handTotal += 1 * hand.bet;
            }
            continue;
          }
          const dealerTotal = Number(result);
          if (total > dealerTotal) {
            if (isPlayerBlackjack) {
              handTotal += 1.5 * hand.bet;
            } else {
              handTotal += 1 * hand.bet;
            }
          } else if (total < dealerTotal) {
            handTotal -= 1 * hand.bet;
          } else {
            if (isPlayerBlackjack && dealerTotal === 21) {
              handTotal += 1.5 * hand.bet;
            } else {
              handTotal += 0;
            }
          }
        }
        expected += prob * handTotal;
      }
      return expected;
    };

    const fnv1a32 = (str) => {
      let h = 0x811c9dc5;
      for (let i = 0; i < str.length; i += 1) {
        h ^= str.charCodeAt(i);
        h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
      }
      return h >>> 0;
    };

    const createMemo = (numBuckets = 256) => {
      if ((numBuckets & (numBuckets - 1)) !== 0) {
        throw new Error('createMemo: numBuckets must be a power of two');
      }

      const buckets = Array.from({ length: numBuckets }, () => new Map());
      let size = 0;

      const bucketFor = (key) => buckets[fnv1a32(key) & (numBuckets - 1)];

      return {
        get(key) {
          return bucketFor(key).get(key);
        },
        has(key) {
          return bucketFor(key).has(key);
        },
        set(key, value) {
          const bucket = bucketFor(key);
          if (!bucket.has(key)) {
            size += 1;
          }
          bucket.set(key, value);
        },
        get size() {
          return size;
        },
        clear() {
          for (const bucket of buckets) {
            bucket.clear();
          }
          size = 0;
        },
      };
    };

    const MAX_MEMO_SIZE = 2_000_000;
    const DEFAULT_MEMO_BUCKETS = 1024;

    const memoSet = (memo, key, value) => {
      if (memo.size >= MAX_MEMO_SIZE) {
        memo.clear();
      }
      memo.set(key, value);
    };

    const bestEV = (state, memo) => {
      const normalizedState = normalizeState(state);
      const workingState = normalizedState === state ? state : normalizedState;

      if (workingState.index >= workingState.hands.length) {
        return settleHands(workingState);
      }

      const key = stateKey(workingState);
      const cached = memo.get(key);
      if (cached !== undefined) {
        return cached;
      }

      const hand = workingState.hands[workingState.index];
      if (hand.done) {
        const result = bestEV({ ...workingState, index: workingState.index + 1 }, memo);
        memoSet(memo, key, result);
        return result;
      }

      if (handValue(hand.cards) > 21) {
        const nextHands = cloneHands(workingState.hands);
        nextHands[workingState.index] = {
          ...nextHands[workingState.index],
          done: true,
          bust: true,
        };
        const result = bestEV(
          { ...workingState, hands: nextHands, index: workingState.index + 1 },
          memo,
        );
        memoSet(memo, key, result);
        return result;
      }

      let maxEV = -Infinity;
      for (const action of availableActions(workingState)) {
        const value = evaluateAction(workingState, action, memo);
        if (value > maxEV) {
          maxEV = value;
        }
      }
      memoSet(memo, key, maxEV);
      return maxEV;
    };

    const drawCardEV = (state, handler, memo) => {
      const cardsLeft = totalCards(state.shoe);
      let expected = 0;
      for (let i = 0; i < state.shoe.length; i += 1) {
        const count = state.shoe[i];
        if (count === 0) {
          continue;
        }
        const prob = count / cardsLeft;
        const nextShoe = state.shoe.slice();
        nextShoe[i] -= 1;
        const nextHands = cloneHands(state.hands);
        const nextHand = nextHands[state.index];
        nextHand.cards.push(i);
        nextHand.blackjackEligible = false;
        const nextState = { ...state, shoe: nextShoe, hands: nextHands };
        const value = handler(nextState, nextHand, memo);
        expected += prob * value;
      }
      return expected;
    };

    const evaluateAction = (state, action, memo) => {
      const hand = state.hands[state.index];

      if (action === 'HIT') {
        return drawCardEV(state, (nextState, nextHand) => {
          const total = handValue(nextHand.cards);
          if (total > 21) {
            nextHand.done = true;
            nextHand.bust = true;
            return bestEV({ ...nextState, index: nextState.index + 1 }, memo);
          }
          return bestEV(nextState, memo);
        }, memo);
      }

      if (action === 'STAND') {
        const nextHands = cloneHands(state.hands);
        nextHands[state.index].done = true;
        const nextState = { ...state, hands: nextHands, index: state.index + 1 };
        return bestEV(nextState, memo);
      }

      if (action === 'DOUBLE') {
        return drawCardEV(state, (nextState, nextHand) => {
          nextHand.bet *= 2;
          nextHand.done = true;
          const total = handValue(nextHand.cards);
          if (total > 21) {
            nextHand.bust = true;
          }
          return bestEV({ ...nextState, index: nextState.index + 1 }, memo);
        }, memo);
      }

      if (action === 'SPLIT') {
        const rank = hand.cards[0];
        const nextHands = cloneHands(state.hands);
        const firstHand = {
          cards: [rank],
          bet: hand.bet,
          isSplitAces: rank === ACE_INDEX,
          isSplitHand: true,
          blackjackEligible: false,
          done: false,
          bust: false,
        };
        const secondHand = { ...firstHand, cards: [rank] };
        nextHands.splice(state.index, 1, firstHand, secondHand);
        const nextState = { ...state, hands: nextHands };
        return bestEV(nextState, memo);
      }

      return 0;
    };

  const computeSplitEVOnly = ({ p1, p2, dealerUp }) => {
    const splitKey = `${p1},${p2}|${dealerUp}`;
    const precomputedSplit = PRECOMPUTED_SPLIT_EV.get(splitKey);
    if (precomputedSplit !== undefined) {
      return precomputedSplit;
    }
    return null;
  };

    self.onmessage = (event) => {
      try {
        const result = computeSplitEVOnly(event.data);
        self.postMessage({ result });
      } catch (error) {
        self.postMessage({ error: error instanceof Error ? error.message : String(error) });
      }
    };
  };

  const createSplitWorker = (() => {
    let workerUrl;
    return () => {
      if (typeof Worker === 'undefined') {
        return null;
      }
      if (!workerUrl) {
        const source = `(${splitWorkerMain.toString()})()`;
        workerUrl = URL.createObjectURL(
          new Blob([source], { type: 'application/javascript' }),
        );
      }
      return new Worker(workerUrl);
    };
  })();

  const computeAllActionsEV = ({ p1, p2, dealerUp, includeSplit = true }) => {
    const shoe = createShoe();
    removeCard(shoe, p1);
    removeCard(shoe, p2);
    removeCard(shoe, dealerUp);

    const hands = [
      {
        cards: [RANK_INDEX[p1], RANK_INDEX[p2]],
        bet: 1,
        isSplitAces: false,
        isSplitHand: false,
        blackjackEligible: true,
        done: false,
        bust: false,
      },
    ];

    const state = {
      shoe,
      dealerUp: RANK_INDEX[dealerUp],
      hands,
      index: 0,
    };

    let actions = availableActions(state);

    const memo = createMemo(DEFAULT_MEMO_BUCKETS);
    const results = {};

    for (const action of actions) {
      if (!includeSplit && action === 'SPLIT') {
        continue;
      }
      results[action] = evaluateAction(state, action, memo);
    }
    return { actions, evs: results };
  };

  const bestAction = (evs) => {
    let best = null;
    let bestValue = -Infinity;
    for (const action of ACTION_ORDER) {
      if (!(action in evs)) {
        continue;
      }
      const value = evs[action];
      if (value > bestValue || (value === bestValue && best === null)) {
        bestValue = value;
        best = action;
      }
    }
    return best;
  };

  const formatEV = (value) => {
    const percent = value * 100;
    const sign = percent >= 0 ? '+' : '';
    return `${sign}${percent.toFixed(3)}%`;
  };

  const renderResults = (
    tableBody,
    actions,
    evs,
    { pendingActions = new Set(), pendingLabel = '…', missingLabel = 'n/a' } = {},
  ) => {
    tableBody.innerHTML = '';
    let best = null;
    let bestValue = -Infinity;
    for (const action of actions) {
      const value = evs[action];
      if (typeof value !== 'number') {
        continue;
      }
      if (value > bestValue) {
        bestValue = value;
        best = action;
      }
    }

    const actionsSet = new Set(actions);
    const evCells = new Map();
    for (const action of ACTION_ORDER) {
      if (!actionsSet.has(action)) {
        continue;
      }
      const row = document.createElement('tr');
      const labelCell = document.createElement('td');
      labelCell.textContent = action;
      const evCell = document.createElement('td');
      if (pendingActions.has(action)) {
        evCell.textContent = pendingLabel;
      } else if (typeof evs[action] === 'number') {
        evCell.textContent = formatEV(evs[action]);
      } else {
        evCell.textContent = missingLabel;
      }
      if (action === best) {
        evCell.classList.add('evsim-hc__ev--best');
      }
      row.appendChild(labelCell);
      row.appendChild(evCell);
      tableBody.appendChild(row);
      evCells.set(action, evCell);
    }
    return evCells;
  };

  const initCalculator = (container) => {
    const p1 = container.querySelector('#evsim-p1');
    const p2 = container.querySelector('#evsim-p2');
    const dealer = container.querySelector('#evsim-d');
    const button = container.querySelector('.evsim-hc__btn');
    const tableBody = container.querySelector('.evsim-hc__table tbody');
    const summary = container.querySelector('.evsim-hc__summary');
    const getSelectLabel = (select) => select.options[select.selectedIndex].textContent;
    button.addEventListener('click', () => {
      button.disabled = true;
      const p1Label = getSelectLabel(p1);
      const p2Label = getSelectLabel(p2);
      const dealerLabel = getSelectLabel(dealer);
      const handCards = [RANK_INDEX[p1.value], RANK_INDEX[p2.value]];
      const total = handValue(handCards);
      const shouldSplit = isPair(handCards);
      const shouldDouble = total >= 9 && total <= 11;
      const { actions, evs } = computeAllActionsEV({
        p1: p1.value,
        p2: p2.value,
        dealerUp: dealer.value,
        includeSplit: false,
      });
      if (actions.includes('SPLIT')) {
        evs.SPLIT = computeSplitEVOnly({
          p1: p1.value,
          p2: p2.value,
          dealerUp: dealer.value,
        });
      }
      renderResults(tableBody, actions, evs);
      if (summary) {
        const actionFlags = [
          `SPLIT: ${shouldSplit ? 'ja' : 'nein'}`,
          `DOUBLE: ${shouldDouble ? 'ja' : 'nein'}`,
        ];
        summary.textContent = `Hand: ${p1Label} + ${p2Label} vs ${dealerLabel} (Total: ${total}) · Aktionen: ${actionFlags.join(', ')}`;
      }
      button.disabled = false;
    });
  };

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.evsim-hc').forEach((container) => {
      initCalculator(container);
    });
  });
})();
