import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { RANKS } from '../src/engine/constants.js';

const resolveTemplateInfo = async (input) => {
  const resolvedInput = path.resolve(input);
  const isPath = input.endsWith('.json') || input.includes(path.sep);

  if (isPath) {
    await fsPromises.access(resolvedInput);
    const basename = path.basename(resolvedInput);
    const match = basename.match(/^split-ev\.(.+)\.template\.json$/);
    if (!match) {
      throw new Error(
        'Template filename must match split-ev.<TAG>.template.json to derive ruleTag.',
      );
    }
    return { templatePath: resolvedInput, ruleTag: match[1] };
  }

  const ruleTag = input.trim();
  const templatePath = path.resolve(
    'assets',
    'precompute',
    'templates',
    `split-ev.${ruleTag}.template.json`,
  );
  return { templatePath, ruleTag };
};

const buildExpectedKeys = () => {
  const keys = [];
  for (const rank of RANKS) {
    for (const dealerUp of RANKS) {
      keys.push(`${rank},${rank}|${dealerUp}`);
    }
  }
  return keys;
};

const input = process.argv[2];

if (!input) {
  throw new Error(
    'Usage: node scripts/template-to-split-csv.js <RULETAG|TEMPLATE_PATH>',
  );
}

const { templatePath, ruleTag } = await resolveTemplateInfo(input);
const templateRaw = await fsPromises.readFile(templatePath, 'utf8');
const template = JSON.parse(templateRaw);
const expectedKeys = buildExpectedKeys();

for (const key of expectedKeys) {
  if (!(key in template)) {
    throw new Error(`Template is missing key: ${key}`);
  }
}

const outputDir = path.resolve('assets', 'precompute', 'csv');
await fsPromises.mkdir(outputDir, { recursive: true });
const outputPath = path.join(outputDir, `split-ev.${ruleTag}.csv`);

const rows = ['pair,dealer,ev'];
for (const key of expectedKeys) {
  const [pair, dealer] = key.split('|');
  rows.push(`"${pair}",${dealer},`);
}

await fsPromises.writeFile(outputPath, `${rows.join('\n')}\n`, 'utf8');
console.log(`Wrote ${outputPath}`);
