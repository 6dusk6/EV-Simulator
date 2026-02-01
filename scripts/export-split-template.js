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

const buildTemplate = () => {
  const template = {};
  for (const rank of RANKS) {
    for (const dealerUp of RANKS) {
      template[`${rank},${rank}|${dealerUp}`] = null;
    }
  }
  return template;
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

const outputDir = path.resolve('assets', 'precompute', 'templates');
await fsPromises.mkdir(outputDir, { recursive: true });

const template = buildTemplate();

for (const tag of ruleTags) {
  const outputPath = path.join(outputDir, `split-ev.${tag}.template.json`);
  await fsPromises.writeFile(
    outputPath,
    `${JSON.stringify(template, null, 2)}\n`,
    'utf8',
  );
  console.log(`Wrote ${outputPath}`);
}
