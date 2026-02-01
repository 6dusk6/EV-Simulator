import { buildRuleTag } from '../src/engine/rules.js';

export const listSplitRuleTags = () => {
  const decks = [1, 2, 6];
  const hitSoft17Values = [false, true];
  const doubleRules = ['any_two', '9_10', '9_11'];
  const doubleAfterSplitValues = [true, false];
  const peekValues = [true, false];
  const tags = [];

  for (const decksCount of decks) {
    for (const hitSoft17 of hitSoft17Values) {
      for (const doubleRule of doubleRules) {
        for (const doubleAfterSplit of doubleAfterSplitValues) {
          for (const peek of peekValues) {
            tags.push(
              buildRuleTag({
                decks: decksCount,
                hitSoft17,
                doubleRule,
                doubleAfterSplit,
                peek,
              }),
            );
          }
        }
      }
    }
  }

  return tags;
};
