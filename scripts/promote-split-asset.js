import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { RANKS } from '../src/engine/constants.js';

const expectedKeys = () => {
  const keys = [];
  for (const rank of RANKS) {
    for (const dealerUp of RANKS) {
      keys.push(`${rank},${rank}|${dealerUp}`);
    }
  }
  return keys;
};

const validateTemplate = (data, expected) => {
  const expectedSet = new Set(expected);
  const actualKeys = Object.keys(data);
  const missing = expected.filter((key) => !(key in data));
  const extra = actualKeys.filter((key) => !expectedSet.has(key));
  const invalidValues = [];

  for (const key of expected) {
    const value = data[key];
    if (!Number.isFinite(value)) {
      invalidValues.push(key);
    }
  }

  const errors = [];
  if (actualKeys.length !== expected.length) {
    errors.push(
      `Expected ${expected.length} keys, found ${actualKeys.length} keys.`,
    );
  }
  if (missing.length > 0) {
    errors.push(
      `Missing keys (${missing.length}): ${missing.slice(0, 20).join(', ')}`,
    );
  }
  if (extra.length > 0) {
    errors.push(`Extra keys (${extra.length}): ${extra.slice(0, 20).join(', ')}`);
  }
  if (invalidValues.length > 0) {
    errors.push(
      `Non-finite values (${invalidValues.length}): ${invalidValues
        .slice(0, 20)
        .join(', ')}`,
    );
  }

  if (errors.length > 0) {
    throw new Error(
      `Template validation failed:\n${errors.map((line) => `- ${line}`).join('\n')}`,
    );
  }
};

const ruleTag = process.argv[2];
if (!ruleTag) {
  throw new Error('Usage: node scripts/promote-split-asset.js <RULETAG>');
}

const templatePath = path.resolve(
  'assets',
  'precompute',
  'templates',
  `split-ev.${ruleTag}.template.json`,
);
const outputPath = path.resolve('assets', 'precompute', `split-ev.${ruleTag}.json`);

const raw = await fsPromises.readFile(templatePath, 'utf8');
const data = JSON.parse(raw);
const expected = expectedKeys();

validateTemplate(data, expected);

await fsPromises.mkdir(path.dirname(outputPath), { recursive: true });
await fsPromises.writeFile(
  outputPath,
  `${JSON.stringify(data, null, 2)}\n`,
  'utf8',
);

console.log(`Promoted ${ruleTag} template to ${outputPath}.`);
