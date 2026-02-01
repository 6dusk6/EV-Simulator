import { listSplitRuleTags } from './split-rulesets.js';

const tags = listSplitRuleTags();

console.log(`Count: ${tags.length}`);
console.log(JSON.stringify(tags, null, 2));
