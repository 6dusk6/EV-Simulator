import { RANK_INDEX, ACE_INDEX } from './constants.js';
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

function stateKey(state) {
  const handsKey = state.hands
    .map((hand) => {
      const flags = [
        hand.bet,
        hand.isSplitAces ? 1 : 0,
        hand.isSplitHand ? 1 : 0,
        hand.blackjackEligible ? 1 : 0,
        hand.done ? 1 : 0,
        hand.bust ? 1 : 0,
      ].join('');
      return `${hand.cards.join('')}:${flags}`;
    })
    .join('|');
  return `${shoeKey(state.shoe)}|${state.index}|${handsKey}`;
}

function canDouble(hand) {
  if (hand.isSplitAces) {
    return false;
  }
  if (hand.cards.length !== 2) {
    return false;
  }
  const total = handValue(hand.cards);
  return total >= 9 && total <= 11;
}

function canSplit(hand, handsCount) {
  if (hand.cards.length !== 2) {
    return false;
  }
  if (!isPair(hand.cards)) {
    return false;
  }
  return handsCount < 4;
}

function availableActions(state) {
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
}

function settleHands(state) {
  const outcomes = dealerOutcomes(state.shoe, state.dealerUp);
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
}

function bestEV(state, memo) {
  if (state.index >= state.hands.length) {
    return settleHands(state);
  }

  const key = stateKey(state);
  if (memo.has(key)) {
    return memo.get(key);
  }

  const hand = state.hands[state.index];
  if (hand.done) {
    const nextState = {
      ...state,
      index: state.index + 1,
    };
    const result = bestEV(nextState, memo);
    memo.set(key, result);
    return result;
  }

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
    return result;
  }

  const actions = availableActions(state);
  let maxEV = -Infinity;
  for (const action of actions) {
    const value = evaluateAction(state, action, memo);
    if (value > maxEV) {
      maxEV = value;
    }
  }
  memo.set(key, maxEV);
  return maxEV;
}

function drawCardEV(state, handler, memo) {
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
        if (total > 21) {
          nextHand.bust = true;
        }
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

  const actions = availableActions(state);
  const memo = new Map();
  const results = {};
  for (const action of actions) {
    results[action] = evaluateAction(state, action, memo);
  }
  return results;
}

export function bestAction(evs) {
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
}
