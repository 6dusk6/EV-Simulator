(() => {
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T'];
  const RANK_INDEX = RANKS.reduce((acc, rank, index) => {
    acc[rank] = index;
    return acc;
  }, {});
  const ACE_INDEX = 0;
  const TEN_INDEX = 9;
  const COUNTS_PER_DECK = [4, 4, 4, 4, 4, 4, 4, 4, 4, 16];
  const DEFAULT_RULES = Object.freeze({
    hitSoft17: false,
    doubleAfterSplit: true,
    resplitAces: true,
    doubleRule: 'any_two',
    peek: false,
    surrender: 'none',
    decks: 6,
  });
  const DOUBLE_RULES = new Set(['any_two', '9_10', '9_11', '10_11', 'any', '9-11', '10-11']);
  const SURRENDER_RULES = new Set(['none', 'late']);
  const normalizeDoubleRule = (value) => {
    if (value === 'any') {
      return 'any_two';
    }
    if (value === '9-11') {
      return '9_11';
    }
    if (value === '10-11') {
      return '10_11';
    }
    return DOUBLE_RULES.has(value) ? value : DEFAULT_RULES.doubleRule;
  };
  const normalizeSurrender = (value) =>
    SURRENDER_RULES.has(value) ? value : DEFAULT_RULES.surrender;
  const normalizeRules = (rules = {}) => ({
    hitSoft17: rules.hitSoft17 ?? DEFAULT_RULES.hitSoft17,
    doubleAfterSplit: rules.doubleAfterSplit ?? DEFAULT_RULES.doubleAfterSplit,
    resplitAces: rules.resplitAces ?? DEFAULT_RULES.resplitAces,
    doubleRule: normalizeDoubleRule(rules.doubleRule ?? DEFAULT_RULES.doubleRule),
    peek: rules.peek ?? DEFAULT_RULES.peek,
    surrender: normalizeSurrender(rules.surrender ?? DEFAULT_RULES.surrender),
    decks: rules.decks ?? DEFAULT_RULES.decks,
  });
  const normalizeRank = (rank) => {
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
  const rulesKey = (rules = {}) => {
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
  };
  const getSplitRelevantRules = (rules = {}) => {
    const normalized = normalizeRules(rules);
    return {
      hitSoft17: normalized.hitSoft17,
      doubleAfterSplit: normalized.doubleAfterSplit,
      doubleRule: normalized.doubleRule,
      peek: normalized.peek,
      decks: normalized.decks,
    };
  };
  const buildSplitRuleTag = (rules = {}) => rulesKey(getSplitRelevantRules(rules));

  const createShoe = (rules = DEFAULT_RULES) => {
    const normalized = normalizeRules(rules);
    return COUNTS_PER_DECK.map((count) => count * normalized.decks);
  };
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

  const drawDealer = (total, soft, shoe, memo, rules) => {
    const normalized = normalizeTotal(total, soft);
    const key = `${shoeKey(shoe)}|${normalized.total}|${normalized.soft ? 1 : 0}`;
    if (memo.has(key)) {
      return memo.get(key);
    }
    const mustStand =
      normalized.total > 17 ||
      (normalized.total === 17 && (!normalized.soft || !rules.hitSoft17));
    if (mustStand) {
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
      const subOutcomes = drawDealer(
        normalizedNext.total,
        normalizedNext.soft,
        nextShoe,
        memo,
        rules,
      );
      for (const [result, subProb] of subOutcomes.entries()) {
        outcomes.set(result, (outcomes.get(result) || 0) + prob * subProb);
      }
    }
    memo.set(key, outcomes);
    return outcomes;
  };

  const dealerOutcomes = (shoe, dealerUpIndex, rules) => {
    const cardsLeft = totalCards(shoe);
    const outcomes = new Map();
    const memo = new Map();
    let blackjackProb = 0;

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
        if (rules.peek) {
          blackjackProb += prob;
          continue;
        }
        outcomes.set('blackjack', (outcomes.get('blackjack') || 0) + prob);
        continue;
      }

      const subOutcomes = drawDealer(normalized.total, normalized.soft, nextShoe, memo, rules);
      for (const [result, subProb] of subOutcomes.entries()) {
        outcomes.set(result, (outcomes.get(result) || 0) + prob * subProb);
      }
    }

    if (rules.peek && (dealerUpIndex === ACE_INDEX || dealerUpIndex === TEN_INDEX)) {
      const normalization = 1 - blackjackProb;
      if (normalization > 0) {
        for (const [result, prob] of outcomes.entries()) {
          outcomes.set(result, prob / normalization);
        }
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

  const canDouble = (hand, rules) => {
    if (hand.isSplitAces) {
      return false;
    }
    if (hand.cards.length !== 2) {
      return false;
    }
    if (hand.isSplitHand && !rules.doubleAfterSplit) {
      return false;
    }
    const total = handValue(hand.cards);
    if (rules.doubleRule === 'any_two') {
      return true;
    }
    if (rules.doubleRule === '9_10') {
      return total === 9 || total === 10;
    }
    if (rules.doubleRule === '10_11') {
      return total === 10 || total === 11;
    }
    if (rules.doubleRule === '9_11') {
      return total >= 9 && total <= 11;
    }
    return total >= 9 && total <= 11;
  };

  const canSplit = (hand, handsCount, rules) => {
    if (hand.cards.length !== 2) {
      return false;
    }
    if (!isPair(hand.cards)) {
      return false;
    }
    if (hand.isSplitAces && !rules.resplitAces) {
      return false;
    }
    return handsCount < 4;
  };

  const availableActions = (state) => {
    const rules = state.rules ?? DEFAULT_RULES;
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
      const allowSplit = hand.cards[0] === ACE_INDEX && canSplit(hand, handsCount, rules);
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
    if (canSplit(hand, handsCount, rules)) {
      actions.push('SPLIT');
    }
    if (canDouble(hand, rules)) {
      actions.push('DOUBLE');
    }
    return actions;
  };

  const DEALER_OUTCOMES_CACHE = new Map();
  const DEALER_OUTCOMES_CACHE_MAX = 20000;

  const dealerOutcomesCached = (shoe, dealerUp, rules) => {
    const key = `${shoeKey(shoe)}|${dealerUp}|${rules.hitSoft17 ? 1 : 0}|${
      rules.peek ? 1 : 0
    }`;
    const cached = DEALER_OUTCOMES_CACHE.get(key);
    if (cached) {
      return cached;
    }

    const outcomes = dealerOutcomes(shoe, dealerUp, rules);
    DEALER_OUTCOMES_CACHE.set(key, outcomes);
    if (DEALER_OUTCOMES_CACHE.size > DEALER_OUTCOMES_CACHE_MAX) {
      DEALER_OUTCOMES_CACHE.clear();
    }
    return outcomes;
  };

  const settleHands = (state) => {
    const outcomes = dealerOutcomesCached(state.shoe, state.dealerUp, state.rules ?? DEFAULT_RULES);
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

  const assetBaseUrl = (() => {
    if (typeof document === 'undefined') {
      return new URL('http://localhost/');
    }
    const scriptUrl = document.currentScript?.src;
    return new URL('.', scriptUrl || window.location.href);
  })();

  const splitPrecomputeCache = new Map();
  const splitPrecomputeLogged = new WeakSet();

  const loadSplitPrecompute = async (splitRuleTag) => {
    if (splitPrecomputeCache.has(splitRuleTag)) {
      return splitPrecomputeCache.get(splitRuleTag);
    }
    const fileUrl = new URL(`precompute/split-ev.${splitRuleTag}.json`, assetBaseUrl);
    try {
      const response = await fetch(fileUrl.toString(), { cache: 'force-cache' });
      if (!response.ok) {
        splitPrecomputeCache.set(splitRuleTag, null);
        return null;
      }
      const data = await response.json();
      splitPrecomputeCache.set(splitRuleTag, data);
      return data;
    } catch (error) {
      splitPrecomputeCache.set(splitRuleTag, null);
      return null;
    }
  };

  const getSplitKey = (p1, p2, dealerUp) =>
    `${normalizeRank(p1)},${normalizeRank(p2)}|${normalizeRank(dealerUp)}`;

  const logMissingSplitKey = (splitPrecompute, splitKey, splitRuleTag) => {
    console.debug(
      `[evsim] Split precompute missing for key ${splitKey} (ruleTag ${splitRuleTag})`,
    );
    if (splitPrecompute && !splitPrecomputeLogged.has(splitPrecompute)) {
      splitPrecomputeLogged.add(splitPrecompute);
      console.debug(
        '[evsim] Available split precompute keys:',
        Object.keys(splitPrecompute),
      );
    }
  };

  const computeAllActionsEV = ({
    p1,
    p2,
    dealerUp,
    includeSplit = true,
    rules = DEFAULT_RULES,
  }) => {
    const normalizedRules = normalizeRules(rules);
    const normalizedP1 = normalizeRank(p1);
    const normalizedP2 = normalizeRank(p2);
    const normalizedDealer = normalizeRank(dealerUp);
    const shoe = createShoe(normalizedRules);
    removeCard(shoe, normalizedP1);
    removeCard(shoe, normalizedP2);
    removeCard(shoe, normalizedDealer);

    const hands = [
      {
        cards: [RANK_INDEX[normalizedP1], RANK_INDEX[normalizedP2]],
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
      dealerUp: RANK_INDEX[normalizedDealer],
      hands,
      index: 0,
      rules: normalizedRules,
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

  const getActionCandidates = ({ rules, evHit, evStand, evDouble, evSplit }) => {
    const candidates = [];
    if (evHit !== undefined) {
      candidates.push({ action: 'HIT', ev: evHit });
    }
    if (evStand !== undefined) {
      candidates.push({ action: 'STAND', ev: evStand });
    }
    if (rules?.surrender === 'late') {
      candidates.push({ action: 'SURRENDER', ev: -0.5 });
    }
    if (evDouble !== undefined) {
      candidates.push({ action: 'DOUBLE', ev: evDouble });
    }
    if (evSplit !== undefined) {
      candidates.push({ action: 'SPLIT', ev: evSplit });
    }
    return candidates;
  };

  const pickBestAction = (candidates) => {
    let best = null;
    let bestValue = -Infinity;
    for (const candidate of candidates) {
      if (typeof candidate.ev !== 'number') {
        continue;
      }
      if (candidate.ev > bestValue || (candidate.ev === bestValue && best === null)) {
        bestValue = candidate.ev;
        best = candidate.action;
      }
    }
    return best;
  };

  const formatEV = (value) => {
    const percent = value * 100;
    const sign = percent >= 0 ? '+' : '';
    return `${sign}${percent.toFixed(3)}%`;
  };

  const formatActionLabel = (action) => {
    const labels = {
      HIT: 'Hit',
      STAND: 'Stand',
      DOUBLE: 'Double',
      SPLIT: 'Split',
      SURRENDER: 'Surrender',
    };
    return labels[action] ?? action;
  };

  const wait = (ms) => new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

  const waitForNextPaint = () =>
    new Promise((resolve) => {
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => resolve());
        return;
      }
      setTimeout(resolve, 0);
    });

  const renderResults = (
    tableBody,
    candidates,
    {
      pendingActions = new Set(),
      pendingLabel = '…',
      missingLabel = 'n/a',
      missingLabels = {},
    } = {},
  ) => {
    tableBody.innerHTML = '';
    const best = pickBestAction(candidates);
    const evCells = new Map();
    for (const { action, ev } of candidates) {
      const row = document.createElement('tr');
      const labelCell = document.createElement('td');
      labelCell.textContent = formatActionLabel(action);
      const evCell = document.createElement('td');
      if (pendingActions.has(action)) {
        evCell.textContent = pendingLabel;
      } else if (typeof ev === 'number') {
        evCell.textContent = formatEV(ev);
      } else {
        evCell.textContent = missingLabels[action] ?? missingLabel;
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

  const parseRuleBoolean = (value, fallback) => {
    if (value === undefined || value === null || value === '') {
      return fallback;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    const normalized = String(value).toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'n'].includes(normalized)) {
      return false;
    }
    return fallback;
  };

  const getSelectedRulesFromUI = (container) => {
    const rules = normalizeRules({
      hitSoft17: parseRuleBoolean(container.dataset.hitSoft17, DEFAULT_RULES.hitSoft17),
      doubleAfterSplit: parseRuleBoolean(
        container.dataset.doubleAfterSplit,
        DEFAULT_RULES.doubleAfterSplit,
      ),
      resplitAces: parseRuleBoolean(container.dataset.resplitAces, DEFAULT_RULES.resplitAces),
      doubleRule: container.dataset.doubleRule ?? DEFAULT_RULES.doubleRule,
      peek: parseRuleBoolean(container.dataset.peek, DEFAULT_RULES.peek),
      surrender: container.dataset.surrender ?? DEFAULT_RULES.surrender,
      decks: Number(container.dataset.decks) || DEFAULT_RULES.decks,
    });

    container.querySelectorAll('[data-evsim-rule]').forEach((el) => {
      const ruleName = el.dataset.evsimRule;
      if (!ruleName) {
        return;
      }
      if (ruleName === 'decks') {
        const value = Number(el.value);
        if (!Number.isNaN(value) && value > 0) {
          rules.decks = value;
        }
        return;
      }
      if (ruleName === 'hitSoft17') {
        const value = el.type === 'checkbox' ? el.checked : el.value;
        if (value === 'hit' || value === 'H17') {
          rules.hitSoft17 = true;
        } else if (value === 'stand' || value === 'S17') {
          rules.hitSoft17 = false;
        } else {
          rules.hitSoft17 = parseRuleBoolean(value, rules.hitSoft17);
        }
        return;
      }
      if (ruleName === 'doubleAfterSplit') {
        const value = el.type === 'checkbox' ? el.checked : el.value;
        rules.doubleAfterSplit = parseRuleBoolean(value, rules.doubleAfterSplit);
        return;
      }
      if (ruleName === 'resplitAces') {
        const value = el.type === 'checkbox' ? el.checked : el.value;
        rules.resplitAces = parseRuleBoolean(value, rules.resplitAces);
        return;
      }
      if (ruleName === 'doubleRule') {
        rules.doubleRule = normalizeDoubleRule(el.value ?? rules.doubleRule);
        return;
      }
      if (ruleName === 'peek') {
        const value = el.type === 'checkbox' ? el.checked : el.value;
        rules.peek = parseRuleBoolean(value, rules.peek);
        return;
      }
      if (ruleName === 'surrender') {
        rules.surrender = normalizeSurrender(el.value ?? rules.surrender);
      }
    });

    return rules;
  };

  const setCollapsedRulesWatermarkState = (container, rulesBlock) => {
    if (!container || !rulesBlock) {
      return;
    }

    container.classList.toggle('evsim-hc--rules-collapsed', !rulesBlock.open);
  };

  const createRulesBlock = (container) => {
    const rulesBlock = document.createElement('details');
    rulesBlock.className = 'evsim-hc__rules';
    rulesBlock.open = true;

    const summary = document.createElement('summary');
    summary.textContent = 'Tischregeln';
    rulesBlock.appendChild(summary);

    const body = document.createElement('div');
    body.className = 'evsim-hc__rules-body';

    const rows = [
      {
        label: 'Deckanzahl:',
        rule: 'decks',
        options: [
          { value: '6', label: '4+ Decks' },
          { value: '2', label: '2 Decks' },
          { value: '1', label: '1 Deck' },
        ],
        disabled: false,
      },
      {
        label: 'Soft 17:',
        rule: 'hitSoft17',
        options: [
          { value: 'stand', label: 'Stand' },
          { value: 'hit', label: 'Hit' },
        ],
        disabled: false,
      },
      {
        label: 'Double Down:',
        rule: 'doubleRule',
        options: [
          { value: '9-11', label: '9-11' },
          { value: '10-11', label: '10-11' },
          { value: 'any', label: 'Alle Hände' },
        ],
        disabled: false,
      },
      {
        label: 'DAS:',
        rule: 'doubleAfterSplit',
        options: [
          { value: 'true', label: 'ja' },
          { value: 'false', label: 'nein' },
        ],
        disabled: false,
      },
      {
        label: 'Surrender:',
        rule: 'surrender',
        options: [
          { value: 'none', label: 'nein' },
          { value: 'late', label: 'ja' },
        ],
        disabled: false,
      },
      {
        label: 'Holecard Peek:',
        rule: 'peek',
        options: [
          { value: 'false', label: 'nein' },
          { value: 'true', label: 'ja' },
        ],
        disabled: false,
      },
    ];

    rows.forEach((row) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'evsim-hc__row';
      const label = document.createElement('label');
      label.className = 'evsim-hc__label';
      label.textContent = row.label;
      const select = document.createElement('select');
      select.className = 'evsim-hc__select';
      select.dataset.evsimRule = row.rule;
      if (row.disabled) {
        select.disabled = true;
      }
      row.options.forEach((option, index) => {
        const item = document.createElement('option');
        item.value = option.value;
        item.textContent = option.label;
        if (index === 0) {
          item.selected = true;
        }
        select.appendChild(item);
      });
      wrapper.appendChild(label);
      wrapper.appendChild(select);
      body.appendChild(wrapper);
    });

    rulesBlock.appendChild(body);
    const firstRow = container.querySelector('.evsim-hc__row');
    if (firstRow) {
      container.insertBefore(rulesBlock, firstRow);
    } else {
      container.prepend(rulesBlock);
    }

    return rulesBlock;
  };

  const initCalculator = (container) => {
    const rulesBlock = createRulesBlock(container);
    setCollapsedRulesWatermarkState(container, rulesBlock);
    rulesBlock.addEventListener('toggle', () => {
      setCollapsedRulesWatermarkState(container, rulesBlock);
    });

    const p1 = container.querySelector('#evsim-p1');
    const p2 = container.querySelector('#evsim-p2');
    const dealer = container.querySelector('#evsim-d');
    const button = container.querySelector('.evsim-hc__btn');
    const resultsTable = container.querySelector('.evsim-hc__table');
    const tableBody = container.querySelector('.evsim-hc__table tbody');
    const summary = container.querySelector('.evsim-hc__summary');
    const defaultButtonLabel = button ? button.textContent : 'BERECHNEN';
    const loadingButtonLabel = 'Berechne...';
    const minimumLoadingStateMs = 180;

    button.addEventListener('click', async () => {
      button.disabled = true;
      button.textContent = loadingButtonLabel;
      try {
        const normalizedP1 = normalizeRank(p1.value);
        const normalizedP2 = normalizeRank(p2.value);
        const normalizedDealer = normalizeRank(dealer.value);
        const rules = getSelectedRulesFromUI(container);
        const splitRuleTag = buildSplitRuleTag(rules);

        const currentRows = tableBody.querySelectorAll('tr');
        currentRows.forEach((row) => {
          const valueCell = row.querySelector('td:last-child');
          if (!valueCell) {
            return;
          }
          valueCell.textContent = '';
          valueCell.classList.remove('evsim-hc__ev--best');
        });
        if (resultsTable) {
          resultsTable.classList.add('evsim-hc__table--visible');
        }

        await waitForNextPaint();
        await wait(minimumLoadingStateMs);

        const { actions, evs } = computeAllActionsEV({
          p1: normalizedP1,
          p2: normalizedP2,
          dealerUp: normalizedDealer,
          includeSplit: false,
          rules,
        });
        let splitCandidateValue = actions.includes('SPLIT') ? null : undefined;
        let splitPrecompute = null;
        let splitMissingLabel = null;
        if (actions.includes('SPLIT')) {
          splitPrecompute = await loadSplitPrecompute(splitRuleTag);
          const splitKey = getSplitKey(normalizedP1, normalizedP2, normalizedDealer);
          const splitValue = splitPrecompute ? splitPrecompute[splitKey] : null;
          if (typeof splitValue === 'number') {
            evs.SPLIT = splitValue;
            splitCandidateValue = splitValue;
          } else if (!splitPrecompute) {
            splitMissingLabel = `Split-Precompute Datei fehlt: split-ev.${splitRuleTag}.json (key ${splitKey})`;
          } else {
            logMissingSplitKey(splitPrecompute, splitKey, splitRuleTag);
            splitMissingLabel = `Split-Precompute hat keinen Wert für KEY ${splitKey} (ruleTag ${splitRuleTag})`;
          }
        }
        const candidates = getActionCandidates({
          rules,
          evHit: evs.HIT,
          evStand: evs.STAND,
          evDouble: actions.includes('DOUBLE') ? evs.DOUBLE : undefined,
          evSplit: splitCandidateValue,
        });
        renderResults(tableBody, candidates, {
          missingLabels: splitMissingLabel ? { SPLIT: splitMissingLabel } : {},
        });
        if (summary) {
          summary.textContent = '';
        }
      } finally {
        button.disabled = false;
        button.textContent = defaultButtonLabel;
      }
    });
  };

  if (typeof window === 'undefined' && typeof globalThis !== 'undefined') {
    globalThis.__evsimHcTestHooks = {
      getSelectedRulesFromUI,
      loadSplitPrecompute,
      getSplitRelevantRules,
      buildSplitRuleTag,
      normalizeRules,
      rulesKey,
      getActionCandidates,
      pickBestAction,
    };
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
      document.querySelectorAll('.evsim-hc').forEach((container) => {
        initCalculator(container);
      });
    });
  }
})();
