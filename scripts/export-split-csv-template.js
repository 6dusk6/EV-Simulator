import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { RANKS } from '../src/engine/constants.js';

const ruleTag = process.argv[2];

if (!ruleTag) {
  throw new Error('Provide a RULETAG.');
}

const outputDir = path.resolve('assets', 'precompute', 'templates');
await fsPromises.mkdir(outputDir, { recursive: true });

const outputPath = path.join(outputDir, `split-ev.${ruleTag}.csv`);
const rows = ['pair,dealer,ev'];
let count = 0;

for (const rank of RANKS) {
  for (const dealerUp of RANKS) {
    const pair = `${rank},${rank}`;
    rows.push(`"${pair}",${dealerUp},`);
    count += 1;
  }
}

await fsPromises.writeFile(outputPath, `${rows.join('\n')}\n`, 'utf8');
console.log(`Wrote ${outputPath}`);
console.log(`Rows: ${count}`);
