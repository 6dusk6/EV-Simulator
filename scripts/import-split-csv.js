import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { RANKS } from '../src/engine/constants.js';

const parseCsvLine = (line) => {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ',') {
      fields.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  fields.push(current);
  return fields;
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

const parseEvValue = (raw) => {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('EV value is empty.');
  }

  let normalized = trimmed;
  if (!normalized.includes('.') && normalized.includes(',')) {
    normalized = normalized.replace(/,/g, '.');
  }

  const value = Number(normalized);
  if (!Number.isFinite(value)) {
    throw new Error(`EV value "${raw}" is not a finite number.`);
  }

  return Number(value.toFixed(6));
};

const validateData = (data, expected) => {
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
    throw new Error(`Validation failed:\n${errors.map((line) => `- ${line}`).join('\n')}`);
  }
};

const ruleTag = process.argv[2];
const csvPath = process.argv[3];

if (!ruleTag || !csvPath) {
  throw new Error('Usage: node scripts/import-split-csv.js <RULETAG> <CSV_PATH>');
}

const resolvedCsv = path.resolve(csvPath);
const raw = await fsPromises.readFile(resolvedCsv, 'utf8');
const content = raw.replace(/^\uFEFF/, '');
const lines = content.split(/\r?\n/);

const expected = expectedKeys();
const expectedSet = new Set(expected);
const values = new Map();
let sawHeader = false;
let lineNumber = 0;

for (const line of lines) {
  lineNumber += 1;
  if (!line.trim()) {
    continue;
  }
  const fields = parseCsvLine(line).map((value) => value.trim());
  if (!sawHeader) {
    if (fields.length !== 3) {
      throw new Error(
        `Invalid header on line ${lineNumber}: expected 3 columns.`,
      );
    }
    const [pairHeader, dealerHeader, evHeader] = fields;
    if (
      pairHeader !== 'pair' ||
      dealerHeader !== 'dealer' ||
      evHeader !== 'ev'
    ) {
      throw new Error(
        `Invalid header on line ${lineNumber}: expected "pair,dealer,ev".`,
      );
    }
    sawHeader = true;
    continue;
  }

  if (fields.length !== 3) {
    throw new Error(
      `Invalid CSV format on line ${lineNumber}: expected 3 columns.`,
    );
  }

  const [pairRaw, dealerRaw, evRaw] = fields;
  const dealer = dealerRaw.trim();
  if (!RANKS.includes(dealer)) {
    throw new Error(`Invalid dealer value "${dealer}" on line ${lineNumber}.`);
  }

  const pairParts = pairRaw.split(',').map((part) => part.trim());
  if (pairParts.length !== 2) {
    throw new Error(`Invalid pair "${pairRaw}" on line ${lineNumber}.`);
  }
  const [rank, secondRank] = pairParts;
  if (rank !== secondRank || !RANKS.includes(rank)) {
    throw new Error(`Invalid pair "${pairRaw}" on line ${lineNumber}.`);
  }

  const pair = `${rank},${rank}`;
  const key = `${pair}|${dealer}`;

  if (!expectedSet.has(key)) {
    throw new Error(`Unexpected key "${key}" on line ${lineNumber}.`);
  }
  if (values.has(key)) {
    throw new Error(`Duplicate key "${key}" on line ${lineNumber}.`);
  }

  const evValue = parseEvValue(evRaw);
  values.set(key, evValue);
}

if (!sawHeader) {
  throw new Error('CSV is missing header row.');
}

const missing = expected.filter((key) => !values.has(key));
if (missing.length > 0) {
  throw new Error(
    `Missing ${missing.length} keys, starting with: ${missing
      .slice(0, 20)
      .join(', ')}`,
  );
}

if (values.size !== expected.length) {
  throw new Error(
    `Expected ${expected.length} keys, found ${values.size} entries.`,
  );
}

const output = {};
for (const key of expected) {
  output[key] = values.get(key);
}

const outputPath = path.resolve(
  'assets',
  'precompute',
  `split-ev.${ruleTag}.json`,
);
await fsPromises.mkdir(path.dirname(outputPath), { recursive: true });
await fsPromises.writeFile(
  outputPath,
  `${JSON.stringify(output, null, 2)}\n`,
  'utf8',
);

validateData(output, expected);

console.log(`Imported ${values.size}/${expected.length} keys. Wrote ${outputPath}.`);
