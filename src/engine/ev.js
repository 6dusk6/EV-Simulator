import { RANK_INDEX, ACE_INDEX, TEN_INDEX } from './constants.js';
import { createShoe, removeCard, totalCards, shoeKey } from './shoe.js';
import { dealerOutcomes } from './dealer.js';
import { handValue, isPair, isBlackjack } from './player.js';
import { DEFAULT_RULES, normalizeRules } from './rules.js';

const ACTION_ORDER = ['HIT', 'STAND', 'DOUBLE', 'SPLIT'];

function cloneHands(hands) {
  return hands.map((hand) => ({
    cards: hand.cards.slice(),
    bet: hand.bet,
    isSplitAces: hand.isSplitAces,
    isSplitHand: hand.isSplitHand,
    blackjackEligible: hand.blackjackEligible,
    done: hand.done,
    bust: hand.bust,
  }));
}

function handTotalSoft(cards) {
  let total = 0;
  let aces = 0;

  for (const r of cards) {
    if (r === ACE_INDEX) {
      aces += 1;
      total += 1;
    } else if (r === TEN_INDEX) {
      total += 10;
    } else {
      total += r + 1;
    }
  }

  let soft = false;
  if (aces > 0 && total + 10 <= 21) {
    total += 10;
    soft = true;
  }

  return { total, soft };
}

function handKey(hand) {
  const { total, soft } = handTotalSoft(hand.cards);
  const numCards = hand.cards.length;

  const pairRank =
    numCards === 2 && hand.cards[0] === hand.cards[1] ? hand.cards[0] : -1;

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
}

function normalizeState(state) {
  if (state.hands.length <= 1) {
    return state;
  }

  const sortedHands = state.hands
    .map((hand) => ({ hand, key: handKey(hand) }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map((entry) => entry.hand);

  let nextIndex = sortedHands.findIndex((hand) => !hand.done);
  if (nextIndex === -1) nextIndex = sortedHands.length;

  return {
    ...state,
    hands: sortedHands,
    index: nextIndex,
  };
}

/**
 * State key for memoization:
 * Normalize hands to avoid order permutations.
 */
function stateKey(state) {
  const cur = state.hands[state.index];
  const curKey = cur ? handKey(cur) : 'END';

  const others = [];
  for (let i = 0; i < state.hands.length; i++) {
    if (i === state.index) continue;
    others.push(handKey(state.hands[i]));
  }
  others.sort();

  return `${shoeKey(state.shoe)}|${curKey}|${others.join('|')}`;
}


function canDouble(hand, rules) {
  if (hand.isSplitAces) return false;
  if (hand.cards.length !== 2) return false;
  if (hand.isSplitHand && !rules.doubleAfterSplit) return false;
  const total = handValue(hand.cards);
  if (rules.doubleRule === 'any_two') return true;
  if (rules.doubleRule === '9_10') return total === 9 || total === 10;
  return total >= 9 && total <= 11;
}

function canSplit(hand, handsCount, rules) {
  if (hand.cards.length !== 2) return false;
  if (!isPair(hand.cards)) return false;
  if (hand.isSplitAces && !rules.resplitAces) return false;
  return handsCount < 4;
}

function availableActions(state) {
  const rules = state.rules ?? DEFAULT_RULES;
  const hand = state.hands[state.index];
  if (!hand || hand.done) return [];

  const total = handValue(hand.cards);
  if (total > 21) return [];

  const handsCount = state.hands.length;
  const actions = [];

  // Split Aces: one-card only (but allow resplit Aces up to 4 hands)
  if (hand.isSplitAces) {
    if (hand.cards.length === 1) return ['HIT'];

    const allowSplit = hand.cards[0] === ACE_INDEX && canSplit(hand, handsCount, rules);
    if (allowSplit) actions.push('SPLIT');

    actions.push('STAND');
    return actions;
  }

  // any one-card hand must HIT to get to playable state
  if (hand.cards.length === 1) return ['HIT'];

  actions.push('HIT', 'STAND');

  if (canSplit(hand, handsCount, rules)) actions.push('SPLIT');
  if (canDouble(hand, rules)) actions.push('DOUBLE');

  return actions;
}

// Dealer outcomes cache (huge speedup in deep trees like SPLIT)
const DEALER_OUTCOMES_CACHE = new Map();
const DEALER_OUTCOMES_CACHE_MAX = Number(process.env.DEALER_CACHE_MAX ?? 20000);

function dealerOutcomesCached(shoe, dealerUp, rules) {
  const key = `${shoeKey(shoe)}|${dealerUp}|${rules.hitSoft17 ? 1 : 0}`;
  const cached = DEALER_OUTCOMES_CACHE.get(key);
  if (cached) return cached;

  const outcomes = dealerOutcomes(shoe, dealerUp, rules);
  DEALER_OUTCOMES_CACHE.set(key, outcomes);

  // simple safety valve to avoid unbounded growth
  if (DEALER_OUTCOMES_CACHE.size > DEALER_OUTCOMES_CACHE_MAX) {
    DEALER_OUTCOMES_CACHE.clear();
  }

  return outcomes;
}

function settleHands(state) {
  const rules = state.rules ?? DEFAULT_RULES;
  const outcomes = dealerOutcomesCached(state.shoe, state.dealerUp, rules);
  let expected = 0;

  for (const [result, prob] of outcomes.entries()) {
    let handTotal = 0;

    for (const hand of state.hands) {
      const total = handValue(hand.cards);

      // Blackjack pays 3:2 only if eligible and not from split
      const isPlayerBlackjack =
        hand.blackjackEligible && isBlackjack(hand.cards) && !hand.isSplitHand;

      if (hand.bust || total > 21) {
        handTotal -= 1 * hand.bet;
        continue;
      }

      if (result === 'blackjack') {
        // No OBO: player loses all bets unless player blackjack (push)
        if (isPlayerBlackjack) handTotal += 0;
        else handTotal -= 1 * hand.bet;
        continue;
      }

      if (result === 'bust') {
        if (isPlayerBlackjack) handTotal += 1.5 * hand.bet;
        else handTotal += 1 * hand.bet;
        continue;
      }

      const dealerTotal = Number(result);

      if (total > dealerTotal) {
        if (isPlayerBlackjack) handTotal += 1.5 * hand.bet;
        else handTotal += 1 * hand.bet;
      } else if (total < dealerTotal) {
        handTotal -= 1 * hand.bet;
      } else {
        // push unless player blackjack vs dealer 21 (3+ card 21) -> still paid as blackjack per your rule
        if (isPlayerBlackjack && dealerTotal === 21) handTotal += 1.5 * hand.bet;
        else handTotal += 0;
      }
    }

    expected += prob * handTotal;
  }

  return expected;
}

// --- Memo: sharded Map to avoid V8 "Map maximum size exceeded" (≈ 8.3M entries per Map) ---
function fnv1a32(str) {
  let h = 0x811c9dc5; // FNV offset
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    // h *= 16777619 (FNV prime) as 32-bit
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

function createMemo(numBuckets = 256) {
  if ((numBuckets & (numBuckets - 1)) !== 0) {
    throw new Error('createMemo: numBuckets must be a power of two');
  }

  const buckets = Array.from({ length: numBuckets }, () => new Map());
  let size = 0;

  function bucketFor(key) {
    const h = fnv1a32(key);
    return buckets[h & (numBuckets - 1)];
  }

  return {
    get(key) {
      return bucketFor(key).get(key);
    },
    has(key) {
      return bucketFor(key).has(key);
    },
    set(key, value) {
      const b = bucketFor(key);
      if (!b.has(key)) size += 1;
      b.set(key, value);
    },
    get size() {
      return size;
    },
    clear() {
      for (const b of buckets) b.clear();
      size = 0;
    },
  };
}

export function createEvMemo(numBuckets = DEFAULT_MEMO_BUCKETS) {
  return createMemo(numBuckets);
}

const MAX_MEMO_SIZE = Number(process.env.EV_MEMO_MAX ?? 2_000_000); // sicher unter V8-Grenze
const DEFAULT_MEMO_BUCKETS = Number(process.env.EV_MEMO_BUCKETS ?? 1024);

function bestEV(state, memo) {
  const normalizedState = normalizeState(state);
  const workingState = normalizedState === state ? state : normalizedState;
  // TERMINAL
  if (workingState.index >= workingState.hands.length) {
    return settleHands(workingState);
  }

  const key = stateKey(workingState);
  const cached = memo.get(key);
  if (cached !== undefined) {
    return cached;
  }

  const hand = workingState.hands[workingState.index];

  // DONE → nächste Hand
  if (hand.done) {
    const result = bestEV(
      { ...workingState, index: workingState.index + 1 },
      memo
    );
    memoSet(memo, key, result);
    return result;
  }

  // BUST → markieren & weiter
  if (handValue(hand.cards) > 21) {
    const nextHands = cloneHands(workingState.hands);
    nextHands[workingState.index] = {
      ...nextHands[workingState.index],
      done: true,
      bust: true,
    };

    const result = bestEV(
      { ...workingState, hands: nextHands, index: workingState.index + 1 },
      memo
    );
    memoSet(memo, key, result);
    return result;
  }

  // AKTIONEN
  let maxEV = -Infinity;
  for (const action of availableActions(workingState)) {
    const ev = evaluateAction(workingState, action, memo);
    if (ev > maxEV) maxEV = ev;
  }

  memoSet(memo, key, maxEV);
  return maxEV;
}

// ---- kontrolliertes Memo-Set ----
function memoSet(memo, key, value) {
  if (memo.size >= MAX_MEMO_SIZE) {
    // simples Eviction: alles leeren
    memo.clear();
  }
  memo.set(key, value);
}

function drawCardEV(state, handler, memo) {
  const cardsLeft = totalCards(state.shoe);
  let expected = 0;

  for (let i = 0; i < state.shoe.length; i += 1) {
    const count = state.shoe[i];
    if (count === 0) continue;

    const prob = count / cardsLeft;

    const nextShoe = state.shoe.slice();
    nextShoe[i] -= 1;

    const nextHands = cloneHands(state.hands);
    const nextHand = nextHands[state.index];

    nextHand.cards.push(i);
    nextHand.blackjackEligible = false;

    const nextState = {
      ...state,
      shoe: nextShoe,
      hands: nextHands,
    };

    const value = handler(nextState, nextHand, memo);
    expected += prob * value;
  }

  return expected;
}

function evaluateAction(state, action, memo) {
  const hand = state.hands[state.index];

  if (action === 'HIT') {
    return drawCardEV(
      state,
      (nextState, nextHand) => {
        const total = handValue(nextHand.cards);
        if (total > 21) {
          nextHand.done = true;
          nextHand.bust = true;
          return bestEV({ ...nextState, index: nextState.index + 1 }, memo);
        }
        return bestEV(nextState, memo);
      },
      memo,
    );
  }

  if (action === 'STAND') {
    const nextHands = cloneHands(state.hands);
    nextHands[state.index].done = true;

    const nextState = {
      ...state,
      hands: nextHands,
      index: state.index + 1,
    };

    return bestEV(nextState, memo);
  }

  if (action === 'DOUBLE') {
    return drawCardEV(
      state,
      (nextState, nextHand) => {
        nextHand.bet *= 2;
        nextHand.done = true;

        const total = handValue(nextHand.cards);
        if (total > 21) nextHand.bust = true;

        return bestEV({ ...nextState, index: nextState.index + 1 }, memo);
      },
      memo,
    );
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

    const secondHand = {
      ...firstHand,
      cards: [rank],
    };

    nextHands.splice(state.index, 1, firstHand, secondHand);

    const nextState = {
      ...state,
      hands: nextHands,
    };

    return bestEV(nextState, memo);
  }

  return 0;
}

export function computeAllActionsEV({ p1, p2, dealerUp, rules, splitEVs }) {
  const normalizedRules = normalizeRules(rules);
  const shoe = createShoe(normalizedRules);
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
    rules: normalizedRules,
  };

  let actions = availableActions(state);

  // Optional: only compute one action (e.g. ONLY_ACTION=SPLIT)
  if (process.env.ONLY_ACTION) {
    actions = actions.filter((a) => a === process.env.ONLY_ACTION);
  }

  const memo = createMemo(DEFAULT_MEMO_BUCKETS);
  const results = {};
  for (const action of actions) {
    if (process.env.EV_ACTION_TIMING === '1') {
      console.log(`ACTION ${action} START`);
      console.time(`ACTION ${action}`);
    }

    if (action === 'SPLIT' && splitEVs) {
      const splitKey = `${p1},${p2}|${dealerUp}`;
      const precomputedSplit =
        splitEVs instanceof Map ? splitEVs.get(splitKey) : splitEVs[splitKey];
      if (precomputedSplit !== undefined) {
        results[action] = precomputedSplit;
        continue;
      }
    }

    results[action] = evaluateAction(state, action, memo);

    if (process.env.EV_ACTION_TIMING === '1') {
      console.timeEnd(`ACTION ${action}`);
    }
  }

  return results;
}

export function computeSplitEV({ p1, p2, dealerUp, rules, memo }) {
  const normalizedRules = normalizeRules(rules);
  const shoe = createShoe(normalizedRules);
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
    rules: normalizedRules,
  };

  const workingMemo = memo ?? createMemo(DEFAULT_MEMO_BUCKETS);
  return evaluateAction(state, 'SPLIT', workingMemo);
}

export function bestAction(evs) {
  let best = null;
  let bestValue = -Infinity;

  for (const action of ACTION_ORDER) {
    if (!(action in evs)) continue;
    const value = evs[action];
    if (value > bestValue || (value === bestValue && best === null)) {
      bestValue = value;
      best = action;
    }
  }

  return best;
}
