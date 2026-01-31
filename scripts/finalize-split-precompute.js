/**
 * Finalize split EV precompute NDJSON into a single JSON object file.
 *
 * Usage:
 *   node scripts/finalize-split-precompute.js <RULETAG>
 *   node scripts/finalize-split-precompute.js --input=assets/precompute/split-ev.S17_6D.ndjson
 */
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';

const parseArgs = (argv) => {
  const result = {};
  for (const arg of argv) {
    if (!arg.startsWith('--')) {
      if (!result._) {
        result._ = arg;
      }
      continue;
    }
    const [key, value] = arg.replace(/^--/, '').split('=');
    if (key === 'input') {
      result.input = value;
    }
    if (key === 'tag') {
      result.tag = value;
    }
  }
  return result;
};

const getPaths = ({ tag, input }) => {
  const outputDir = path.resolve('assets', 'precompute');
  if (tag) {
    return {
      ndjsonPath: path.join(outputDir, `split-ev.${tag}.ndjson`),
      jsonPath: path.join(outputDir, `split-ev.${tag}.json`),
      ruleTag: tag,
      outputDir,
    };
  }

  if (!input) {
    throw new Error('Provide a RULETAG or --input=path to an NDJSON file.');
  }

  const resolvedInput = path.resolve(input);
  const match = path.basename(resolvedInput).match(/^split-ev\.(.+)\.ndjson$/);
  if (!match) {
    throw new Error(
      `Cannot infer RULETAG from input file: ${resolvedInput}. Use --tag=...`,
    );
  }

  const ruleTag = match[1];
  return {
    ndjsonPath: resolvedInput,
    jsonPath: path.join(path.dirname(resolvedInput), `split-ev.${ruleTag}.json`),
    ruleTag,
    outputDir: path.dirname(resolvedInput),
  };
};

const cli = parseArgs(process.argv.slice(2));
const positional = cli._;
const positionalIsPath = positional
  ? positional.includes(path.sep) || positional.endsWith('.ndjson')
  : false;
const { ndjsonPath, jsonPath, ruleTag, outputDir } = getPaths({
  tag: cli.tag ?? (!positionalIsPath ? positional : undefined),
  input: cli.input ?? (positionalIsPath ? positional : undefined),
});

await fsPromises.access(ndjsonPath);
await fsPromises.mkdir(outputDir, { recursive: true });

const data = {};
const stream = fs.createReadStream(ndjsonPath, { encoding: 'utf8' });
const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
const parseErrors = [];
let lineNumber = 0;

try {
  for await (const line of rl) {
    lineNumber += 1;
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    try {
      const entry = JSON.parse(trimmed);
      if (entry && typeof entry.k === 'string') {
        data[entry.k] = entry.v;
      }
    } catch (error) {
      parseErrors.push({ lineNumber, error });
    }
  }
} finally {
  rl.close();
  stream.destroy();
}

if (parseErrors.length > 0) {
  const lastError = parseErrors[parseErrors.length - 1];
  if (parseErrors.length === 1 && lastError.lineNumber === lineNumber) {
    console.warn(
      `Warning: ignoring incomplete trailing line ${lastError.lineNumber} in ${ndjsonPath}.`,
    );
  } else {
    throw new Error(
      `Failed to parse NDJSON ${ndjsonPath} (line ${lastError.lineNumber}).`,
    );
  }
}

const tmpPath = `${jsonPath}.tmp`;
await fsPromises.writeFile(tmpPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
await fsPromises.rename(tmpPath, jsonPath);

console.log(`Finalized ${Object.keys(data).length} entries for ${ruleTag}.`);
console.log(`Wrote ${jsonPath}`);
