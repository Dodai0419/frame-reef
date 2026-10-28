#!/usr/bin/env node
// frame-reef: build one offline HTML page that turns an Android photo frame into an ASCII shark aquarium with a clock.
//
//   node build.mjs                      # writes frame-reef.html
//   node build.mjs -o reef.html
//
// The ocean is stackedlol/ascii-sharks (vendor/ascii-sharks/*.ts, unchanged). Node's built-in TypeScript
// stripping turns it into one classic <script>, so there is no npm install, no vite and no tsc.
// Page options go in the URL: ?sharks=hammerhead,tiger  ?night=22-6  ?h24=1  ?clock=0  ?t=23:40 (fixed time).
import { readFileSync, writeFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const MODULES = ["math", "species", "world", "renderer", "engine"]; // dependency order

/** Turn the ES modules into one classic script: each module becomes an object in __m. */
export function bundle(dir = join(HERE, "vendor", "ascii-sharks")) {
  const parts = MODULES.map((name) => {
    const names = [];
    let js = stripTypeScriptTypes(readFileSync(join(dir, `${name}.ts`), "utf8"), { mode: "transform" });
    js = js.replace(/^import \{([^}]*)\} from "\.\/(\w+)";$/gm, (_, list, from) =>
      `const {${list.replace(/\b(\w+) as (\w+)\b/g, "$1: $2")}} = __m.${from};`);
    js = js.replace(/^export (const|let|function|class) (\w+)/gm, (_, kind, id) => (names.push(id), `${kind} ${id}`));
    if (/^\s*(import|export)\b/m.test(js)) throw new Error(`${name}.ts: an import/export form the bundler does not handle`);
    return `__m.${name} = (() => {\n${js}\nreturn { ${names.join(", ")} };\n})();`;
  });
  return `const __m = {};\n${parts.join("\n")}`;
}

// Clock, date, night window and burn-in shift from wesbos/photo-frame-dashboard (dashboard/js/app.js,
// dashboard/js/views/ambient.js), MIT. Plain functions so the tests can run them.
export const AMBIENT = String.raw`
var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function fmtTime(d, h24) {
  var h = d.getHours(), m = d.getMinutes();
  return (h24 ? h : (h % 12 || 12)) + ':' + (m < 10 ? '0' : '') + m;
}
function fmtDate(d) { return DAYS[d.getDay()] + ', ' + MONTHS[d.getMonth()] + ' ' + d.getDate(); }
function isNight(d, from, to) { var h = d.getHours(); return from > to ? (h >= from || h < to) : (h >= from && h < to); }
function shift(rand) { return [Math.round(rand() * 8 - 4), Math.round(rand() * 8 - 4)]; }
`;

const PAGE = (script) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>frame-reef</title>
<style>
html,body{margin:0;height:100%;background:#000;overflow:hidden;cursor:none}
canvas{position:fixed;inset:0;width:100vw;height:100vh;display:block;font-family:ui-monospace,Menlo,Consolas,monospace}
#info{position:fixed;left:5vw;bottom:6vh;color:#e9eef7;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;transition:transform 1s,color 2s;text-shadow:0 0 24px #000,0 0 6px #000;pointer-events:none}
#time{font-size:min(28.75vw,46vh);line-height:.78;letter-spacing:-.04em;font-weight:600;font-variant-numeric:tabular-nums}
#date{font-size:min(3.4vw,5.4vh);margin-top:2vh;opacity:.85;letter-spacing:.01em}
body.night canvas{opacity:.22}
body.night #time{color:#C22C1C;font-size:min(32.5vw,52vh)}
body.night #date{color:#7a2a20}
body.noclock #info{display:none}
</style>
</head>
<body>
<canvas aria-hidden="true"></canvas>
<div id="info" role="timer" aria-live="off"><div id="time"></div><div id="date"></div></div>
<script>
${script}
${AMBIENT}
(function () {
  var q = new URLSearchParams(location.search);
  var kinds = (q.get('sharks') || '').split(',').filter(Boolean);
  var sharks = kinds.length ? kinds.map(function (kind, i) { return { kind: kind, size: 1 - i * 0.1 }; }) : undefined;
  var win = (q.get('night') || '22-6').split('-').map(Number), fixed = q.get('t');
  var h24 = q.get('h24') === '1';
  if (q.get('clock') === '0') document.body.classList.add('noclock');
  new __m.engine.OceanEngine(document.querySelector('canvas'), sharks);
  function now() {
    var d = new Date();
    if (fixed) { var p = fixed.split(':'); d.setHours(+p[0], +p[1] || 0, 0, 0); }
    return d;
  }
  function tick() {
    var d = now();
    document.getElementById('time').textContent = fmtTime(d, h24);
    document.getElementById('date').textContent = fmtDate(d);
    document.body.classList.toggle('night', isNight(d, win[0], win[1]));
  }
  // nudge the clock a few px every minute so nothing sits still for hours (image retention)
  function nudge() { var s = shift(Math.random); document.getElementById('info').style.transform = 'translate(' + s[0] + 'px,' + s[1] + 'px)'; }
  tick(); setInterval(tick, 1000); setInterval(nudge, 60000);
  document.documentElement.dataset.ready = '1';
})();
</script>
</body>
</html>
`;

export function build() {
  return PAGE(bundle());
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const a = process.argv.slice(2);
  const out = a[0] === "-o" || a[0] === "--out" ? a[1] : "frame-reef.html";
  if (a.length && !["-o", "--out"].includes(a[0])) {
    console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(1, 8).join("\n").replace(/^\/\/ ?/gm, ""));
    process.exit(a[0] === "-h" || a[0] === "--help" ? 0 : 2);
  }
  const html = build();
  writeFileSync(out, html, "utf8");
  console.log(`wrote ${out} (${(Buffer.byteLength(html) / 1024).toFixed(1)} KB, one file, works offline)`);
}
