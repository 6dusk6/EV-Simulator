/**
 * Generate split EV precompute data incrementally (NDJSON).
 *
 * Usage:
 *   node scripts/generate-split-precompute.js --decks=6 --hitSoft17 --doubleAfterSplit --resplitAces
 *
 * Resume:
 *   Re-running the script will skip keys already present in the NDJSON file.
 *
 * Finalize:
 *   node scripts/finalize-split-precompute.js <RULETAG>
 */
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';
import { once } from 'node:events';
import { RANKS } from '../src/engine/constants.js';
import { buildRuleTag, normalizeRules } from '../src/engine/rules.js';

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

const formatDuration = (seconds) => {
  if (!Number.isFinite(seconds)) {
    return 'n/a';
  }
  const clamped = Math.max(0, Math.round(seconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
};

const loadDoneKeys = async (filePath) => {
  const doneKeys = new Set();
  try {
    await fsPromises.access(filePath);
  } catch {
    return doneKeys;
  }

  const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
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
          doneKeys.add(entry.k);
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
        `Warning: ignoring incomplete trailing line ${lastError.lineNumber} in ${filePath}.`,
      );
    } else {
      throw new Error(
        `Failed to parse NDJSON ${filePath} (line ${lastError.lineNumber}).`,
      );
    }
  }

  return doneKeys;
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
  doubleRule: cliRules.doubleRule,
  peek: cliRules.peek,
  surrender: cliRules.surrender,
  decks: cliRules.decks,
});

const ruleTag = buildRuleTag(rules);
const outputDir = path.resolve('assets', 'precompute');
const outputFile = path.join(outputDir, `split-ev.${ruleTag}.ndjson`);

await fsPromises.mkdir(outputDir, { recursive: true });

const doneKeys = await loadDoneKeys(outputFile);
const totalKeys = RANKS.length * RANKS.length;

console.log(`RULETAG: ${ruleTag}`);
console.log(
  `Flags: hitSoft17=${rules.hitSoft17} doubleAfterSplit=${rules.doubleAfterSplit} resplitAces=${rules.resplitAces} doubleRule=${rules.doubleRule} peek=${rules.peek} surrender=${rules.surrender} decks=${rules.decks}`,
);
console.log(`Total keys: ${totalKeys}`);
console.log(`Already done: ${doneKeys.size}`);
console.log(`Output NDJSON: ${outputFile}`);

const writeStream = fs.createWriteStream(outputFile, { flags: 'a' });
await once(writeStream, 'open');

const logEvery = Number(process.env.PRECOMPUTE_LOG_EVERY ?? '5');
const flushEvery = Number(process.env.PRECOMPUTE_FLUSH_EVERY ?? '1');
const heartbeatEveryMs = Number(process.env.PRECOMPUTE_HEARTBEAT_MS ?? '30000');
const startTime = Date.now();

let computed = 0;
let skipped = 0;
let processed = doneKeys.size;

const writeLine = async (line) => {
  if (!writeStream.write(line)) {
    await once(writeStream, 'drain');
  }
};

for (const rank of RANKS) {
  const memo = createEvMemo();
  for (const dealerUp of RANKS) {
    const splitKey = `${rank},${rank}|${dealerUp}`;
    if (doneKeys.has(splitKey)) {
      skipped += 1;
      processed += 1;
    } else {
      const keyIndex = processed + 1;
      console.log(`Computing split key ${splitKey} (${keyIndex}/${totalKeys})`);
      const keyStart = Date.now();
      const heartbeat = setInterval(() => {
        const elapsed = (Date.now() - keyStart) / 1000;
        console.log(
          `Heartbeat: still computing ${splitKey} (${formatDuration(elapsed)} elapsed)`,
        );
      }, heartbeatEveryMs);
      const ev = computeSplitEV({
        p1: rank,
        p2: rank,
        dealerUp,
        rules,
        memo,
      });
      clearInterval(heartbeat);
      const payload = {
        k: splitKey,
        v: Number(ev.toFixed(6)),
      };
      await writeLine(`${JSON.stringify(payload)}\n`);
      computed += 1;
      processed += 1;

      if (writeStream.fd && computed % flushEvery === 0) {
        await fsPromises.fsync(writeStream.fd);
      }
      const keyElapsed = (Date.now() - keyStart) / 1000;
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = processed / Math.max(elapsed, 1e-6);
      const remaining = totalKeys - processed;
      const eta = rate > 0 ? remaining / rate : NaN;
      const percent = ((processed / totalKeys) * 100).toFixed(1);
      console.log(
        `Finished ${splitKey} in ${formatDuration(
          keyElapsed,
        )}. Progress: computed=${computed} skipped=${skipped} total=${processed}/${totalKeys} (${percent}%) ETA=${formatDuration(
          eta,
        )}`,
      );
    }

    if (processed % logEvery === 0 || processed === totalKeys) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = processed / Math.max(elapsed, 1e-6);
      const remaining = totalKeys - processed;
      const eta = rate > 0 ? remaining / rate : NaN;
      const percent = ((processed / totalKeys) * 100).toFixed(1);
      console.log(
        `Progress: computed=${computed} skipped=${skipped} total=${processed}/${totalKeys} (${percent}%) ETA=${formatDuration(eta)}`,
      );
    }
  }

  if (global.gc) {
    global.gc();
  }
}

await new Promise((resolve, reject) => {
  writeStream.end((err) => {
    if (err) {
      reject(err);
      return;
    }
    resolve();
  });
});

console.log(`Done. Computed ${computed}, skipped ${skipped}, total ${processed}.`);
