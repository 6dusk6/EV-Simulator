import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { RANKS } from '../src/engine/constants.js';
import { buildRuleTag, normalizeRules } from '../src/engine/rules.js';
import { listSplitRuleTags } from './split-rulesets.js';

const parseArgs = (argv) => {
  const result = { all: false };
  for (const arg of argv) {
    if (arg === '--all') {
      result.all = true;
      continue;
    }
    if (arg.startsWith('--rules=')) {
      result.rules = arg.replace('--rules=', '');
      continue;
    }
    if (arg.startsWith('--tag=')) {
      result.tag = arg.replace('--tag=', '');
      continue;
    }
    if (!arg.startsWith('--') && !result.input) {
      result.input = arg;
    }
  }
  return result;
};

const resolveRuleTag = (input) => {
  if (!input) return null;
  const trimmed = input.trim();
  if (trimmed.startsWith('{')) {
    const rules = JSON.parse(trimmed);
    return buildRuleTag(normalizeRules(rules));
  }
  return trimmed;
};

const expectedKeys = () => {
  const keys = [];
  for (const rank of RANKS) {
    for (const dealerUp of RANKS) {
      keys.push(`${rank},${rank}|${dealerUp}`);
    }
  }
  return keys;
};

const validateTag = async (tag) => {
  const filePath = path.resolve('assets', 'precompute', `split-ev.${tag}.json`);
  const raw = await fsPromises.readFile(filePath, 'utf8');
  const data = JSON.parse(raw);
  const expected = expectedKeys();
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
      `Validation failed for ${tag}:\n${errors.map((line) => `- ${line}`).join('\n')}`,
    );
  }
};

const cli = parseArgs(process.argv.slice(2));
let ruleTags = [];

if (cli.all) {
  ruleTags = listSplitRuleTags();
} else {
  const ruleTag =
    resolveRuleTag(cli.rules) ??
    resolveRuleTag(cli.tag) ??
    resolveRuleTag(cli.input);
  if (!ruleTag) {
    throw new Error('Provide a ruleTag, --rules JSON, or --all.');
  }
  ruleTags = [ruleTag];
}

let failed = false;

for (const tag of ruleTags) {
  try {
    await validateTag(tag);
    console.log(`Validated ${tag}`);
  } catch (error) {
    failed = true;
    console.error(error.message);
  }
}

if (failed) {
  process.exit(1);
}
