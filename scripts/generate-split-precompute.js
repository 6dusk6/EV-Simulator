import fs from 'node:fs/promises';
import path from 'node:path';
import { RANKS } from '../src/engine/constants.js';
import { normalizeRules, rulesKey } from '../src/engine/rules.js';

const parseArgs = (argv) => {
  const rules = {};
  for (const arg of argv) {
    if (!arg.startsWith('--')) {
      continue;
    }
    const normalized = arg.replace(/^--/, '');
    if (normalized.startsWith('no-')) {
      const key = normalized.slice(3);
      rules[key] = false;
      continue;
    }
    const [key, value] = normalized.split('=');
    if (value === undefined) {
      rules[key] = true;
      continue;
    }
    if (key === 'decks') {
      rules.decks = Number(value);
      continue;
    }
    if (value === 'true' || value === 'false') {
      rules[key] = value === 'true';
      continue;
    }
    rules[key] = value;
  }
  return rules;
};

const cliRules = parseArgs(process.argv.slice(2));
process.env.EV_MEMO_MAX = process.env.EV_MEMO_MAX ?? '8000000';
process.env.EV_MEMO_BUCKETS = process.env.EV_MEMO_BUCKETS ?? '4096';
process.env.DEALER_CACHE_MAX = process.env.DEALER_CACHE_MAX ?? '50000';

const { computeSplitEV, createEvMemo } = await import('../src/engine/ev.js');
const rules = normalizeRules({
  hitSoft17: cliRules.hitSoft17,
  doubleAfterSplit: cliRules.doubleAfterSplit,
  resplitAces: cliRules.resplitAces,
  decks: cliRules.decks,
});

const key = rulesKey(rules);
const outputDir = path.resolve('assets', 'precompute');
const outputFile = path.join(outputDir, `split-ev.${key}.json`);

const data = {};
for (const rank of RANKS) {
  for (const dealerUp of RANKS) {
    const splitKey = `${rank},${rank}|${dealerUp}`;
    const memo = createEvMemo();
    const ev = computeSplitEV({
      p1: rank,
      p2: rank,
      dealerUp,
      rules,
      memo,
    });
    data[splitKey] = Number(ev.toFixed(6));
  }
}

await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(outputFile, `${JSON.stringify(data, null, 2)}\n`, 'utf8');

console.log(`Wrote ${Object.keys(data).length} entries to ${outputFile}`);
