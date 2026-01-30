import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { computeAllActionsEV } from "../src/engine/ev.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const wooUrl = new URL("./fixtures/woo_reference.json", import.meta.url);
const woo = JSON.parse(fs.readFileSync(wooUrl, "utf8"));

// Canon basiert auf gleichen Cases, aber EVs werden aus DEINER Engine geschrieben
const canon = woo.map((f) => {
  const evs = computeAllActionsEV({ p1: f.p1, p2: f.p2, dealerUp: f.d });
  return { p1: f.p1, p2: f.p2, d: f.d, ev: evs };
});

const outPath = path.join(__dirname, "fixtures", "bj21_canon.json");
fs.writeFileSync(outPath, JSON.stringify(canon, null, 2) + "\n", "utf8");

console.log("Wrote", outPath, "cases:", canon.length);
