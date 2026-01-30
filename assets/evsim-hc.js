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

  const stateKey = (state) => {
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

  const settleHands = (state) => {
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
  };

  const bestEV = (state, memo) => {
    if (state.index >= state.hands.length) {
      return settleHands(state);
    }
    const key = stateKey(state);
    if (memo.has(key)) {
      return memo.get(key);
    }
    const hand = state.hands[state.index];
    if (hand.done) {
      const nextState = { ...state, index: state.index + 1 };
      const result = bestEV(nextState, memo);
      memo.set(key, result);
      return result;
    }
    const total = handValue(hand.cards);
    if (total > 21) {
      const nextHands = cloneHands(state.hands);
      nextHands[state.index].done = true;
      nextHands[state.index].bust = true;
      const nextState = { ...state, hands: nextHands, index: state.index + 1 };
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

  const computeAllActionsEV = ({ p1, p2, dealerUp }) => {
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

  const renderResults = (tableBody, evs) => {
    tableBody.innerHTML = '';
    let best = null;
    let bestValue = -Infinity;
    for (const action of ACTION_ORDER) {
      if (!(action in evs)) {
        continue;
      }
      const value = evs[action];
      if (value > bestValue) {
        bestValue = value;
        best = action;
      }
    }

    for (const action of ACTION_ORDER) {
      if (!(action in evs)) {
        continue;
      }
      const row = document.createElement('tr');
      const labelCell = document.createElement('td');
      labelCell.textContent = action;
      const evCell = document.createElement('td');
      evCell.textContent = formatEV(evs[action]);
      if (action === best) {
        evCell.classList.add('evsim-hc__ev--best');
      }
      row.appendChild(labelCell);
      row.appendChild(evCell);
      tableBody.appendChild(row);
    }
  };

  const initCalculator = (container) => {
    const p1 = container.querySelector('#evsim-p1');
    const p2 = container.querySelector('#evsim-p2');
    const dealer = container.querySelector('#evsim-d');
    const button = container.querySelector('.evsim-hc__btn');
    const tableBody = container.querySelector('.evsim-hc__table tbody');

    button.addEventListener('click', () => {
      button.disabled = true;
      const evs = computeAllActionsEV({
        p1: p1.value,
        p2: p2.value,
        dealerUp: dealer.value,
      });
      renderResults(tableBody, evs);
      button.disabled = false;
    });
  };

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.evsim-hc').forEach((container) => {
      initCalculator(container);
    });
  });
})();
