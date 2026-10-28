// Build time and page size.
//   node bench/bench.mjs [runs]
import { performance } from "node:perf_hooks";
import { build } from "../build.mjs";

const runs = Number(process.argv[2] || 20);
const t = [];
let html = "";
for (let i = 0; i < runs; i++) { const s = performance.now(); html = build(); t.push(performance.now() - s); }
t.sort((a, b) => a - b);
console.log(`build: median ${t[runs >> 1].toFixed(1)} ms (min ${t[0].toFixed(1)}) over ${runs} runs, page ${(Buffer.byteLength(html) / 1024).toFixed(1)} KB`);
