import { RANK_INDEX, ACE_INDEX, TEN_INDEX } from './constants.js';
import { createShoe, removeCard, totalCards, shoeKey } from './shoe.js';
import { dealerOutcomes } from './dealer.js';
import { handValue, isPair, isBlackjack } from './player.js';

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

/**
 * State key for memoization:
 * Keep the current hand ordered (decision-specific),
 * and all other hands as an orderless multiset.
 */
function stateKey(state) {
  const handKey = (hand) => {
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
  };

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


function canDouble(hand) {
  if (hand.isSplitAces) return false;
  if (hand.cards.length !== 2) return false;
  const total = handValue(hand.cards);
  return total >= 9 && total <= 11;
}

function canSplit(hand, handsCount) {
  if (hand.cards.length !== 2) return false;
  if (!isPair(hand.cards)) return false;
  return handsCount < 4;
}

function availableActions(state) {
  const hand = state.hands[state.index];
  if (!hand || hand.done) return [];

  const total = handValue(hand.cards);
  if (total > 21) return [];

  const handsCount = state.hands.length;
  const actions = [];

  // Split Aces: one-card only (but allow resplit Aces up to 4 hands)
  if (hand.isSplitAces) {
    if (hand.cards.length === 1) return ['HIT'];

    const allowSplit = hand.cards[0] === ACE_INDEX && canSplit(hand, handsCount);
    if (allowSplit) actions.push('SPLIT');

    actions.push('STAND');
    return actions;
  }

  // any one-card hand must HIT to get to playable state
  if (hand.cards.length === 1) return ['HIT'];

  actions.push('HIT', 'STAND');

  if (canSplit(hand, handsCount)) actions.push('SPLIT');
  if (canDouble(hand)) actions.push('DOUBLE');

  return actions;
}

function settleHands(state) {
  const outcomes = dealerOutcomes(state.shoe, state.dealerUp);
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

function bestEV(state, memo) {
  // Progress / Health logging (optional)
  globalThis.__evProg ??= {
    sets: 0,
    t0: Date.now(),
    lastLog: Date.now(),
    lastSets: 0,
  };
  const prog = globalThis.__evProg;

  const PROG_EVERY = Number(process.env.EV_PROG_EVERY ?? 1000);          // count-based
  const PROG_TIME_EVERY = Number(process.env.EV_PROG_TIME_EVERY ?? 2000); // ms-based

  function maybeLogProgress() {
    if (process.env.EV_PROGRESS !== '1') return;

    prog.sets++;

    const now = Date.now();
    const elapsedMs = now - prog.t0;

    const hitCount = (prog.sets % PROG_EVERY) === 0;
    const hitTime = (now - prog.lastLog) >= PROG_TIME_EVERY;

    if (!hitCount && !hitTime) return;

    const heapMB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

    const avgRatePerSec =
      elapsedMs > 0 ? (prog.sets / elapsedMs) * 1000 : 0;

    const instElapsedMs = now - prog.lastLog;
    const instRatePerSec =
      instElapsedMs > 0 ? ((prog.sets - prog.lastSets) / instElapsedMs) * 1000 : avgRatePerSec;

    prog.lastLog = now;
    prog.lastSets = prog.sets;

    console.log('EV progress', {
      memoSize: memo.size,
      memoSets: prog.sets,
      avgRatePerSec: Math.round(avgRatePerSec),
      instRatePerSec: Math.round(instRatePerSec),
      index: state.index,
      hands: state.hands.length,
      cardsLeft: totalCards(state.shoe),
      heapMB,
      elapsedMs,
    });
  }

  if (state.index >= state.hands.length) {
    return settleHands(state);
  }

  const key = stateKey(state);
  if (memo.has(key)) {
    return memo.get(key);
  }

  const hand = state.hands[state.index];

  // If current hand is already done, move to next
  if (hand.done) {
    const nextState = { ...state, index: state.index + 1 };
    const result = bestEV(nextState, memo);
    memo.set(key, result);
    maybeLogProgress();
    return result;
  }

  // Bust -> mark and move on
  const total = handValue(hand.cards);
  if (total > 21) {
    const nextHands = cloneHands(state.hands);
    nextHands[state.index].done = true;
    nextHands[state.index].bust = true;

    const nextState = {
      ...state,
      hands: nextHands,
      index: state.index + 1,
    };

    const result = bestEV(nextState, memo);
    memo.set(key, result);
    maybeLogProgress();
    return result;
  }

  // Choose best action EV
  const actions = availableActions(state);
  let maxEV = -Infinity;

  for (const action of actions) {
    const value = evaluateAction(state, action, memo);
    if (value > maxEV) maxEV = value;
  }

  memo.set(key, maxEV);
  maybeLogProgress();
  return maxEV;
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

export function computeAllActionsEV({ p1, p2, dealerUp }) {
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

  // Optional: only compute one action (e.g. ONLY_ACTION=SPLIT)
  if (process.env.ONLY_ACTION) {
    actions = actions.filter((a) => a === process.env.ONLY_ACTION);
  }

  const memo = new Map();
  const results = {};

  for (const action of actions) {
    if (process.env.EV_ACTION_TIMING === '1') {
      console.log(`ACTION ${action} START`);
      console.time(`ACTION ${action}`);
    }

    results[action] = evaluateAction(state, action, memo);

    if (process.env.EV_ACTION_TIMING === '1') {
      console.timeEnd(`ACTION ${action}`);
    }
  }

  return results;
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
