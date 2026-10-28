import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { AMBIENT, build, bundle } from "../build.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const VENDOR = join(ROOT, "vendor", "ascii-sharks");

// sha256 of stackedlol/ascii-sharks src/*.ts at a0074c1
const UPSTREAM = {
  "math.ts": "dfdff9da48780738d58530f04b06a2d9e483f9808eea846d66eff80766cbfb1d",
  "species.ts": "58a6fcb267fe8a64cf448ed9b0106b7d11be4c0f38f1b242c7ffe1a9d1d01a3e",
  "world.ts": "101cb2ef8e78ead1deeafaf0b9a0d754acf13b558bd344d380b671496ca0c14e",
  "renderer.ts": "75e08e62d958e6d8bd79f35bc14ebdc48f06d671f910335d470bbbfa6d9b979b",
  "engine.ts": "cc35da684910538e1e50080529f1ed0d6d6dba15bc18641a68dc698b8d1f14ff",
};

test("the ocean code is ascii-sharks, byte for byte", () => {
  for (const [file, sha] of Object.entries(UPSTREAM))
    assert.equal(createHash("sha256").update(readFileSync(join(VENDOR, file))).digest("hex"), sha, file);
});

// A canvas that records every glyph and cell the renderer draws.
function fakeDom(log) {
  const ctx = new Proxy({ fillStyle: "", font: "" }, {
    get: (t, k) => k in t ? t[k] : k === "fillText" ? (g, x, y) => log.push(`T${g}|${x.toFixed(2)}|${y.toFixed(2)}|${t.fillStyle}`)
      : k === "fillRect" ? (x, y, w, h) => log.push(`R${x.toFixed(2)}|${y.toFixed(2)}|${w}|${h}|${t.fillStyle}`) : () => {},
    set: (t, k, v) => ((t[k] = v), true),
  });
  const canvas = () => ({ width: 0, height: 0, getContext: () => ctx });
  return { canvas: canvas(), document: { createElement: canvas } };
}
const seeded = (s) => () => ((s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x6d2b79f5) >>> 0) / 4294967296);

function simulate(World, AsciiRenderer, canvas, frames = 60) {
  const world = new World([{ kind: "hammerhead", size: 1 }, { kind: "tiger", size: 0.8 }]);
  const r = new AsciiRenderer(canvas);
  r.resize(1280, 800, 1);
  world.resize(1280, 800, r.cellWidth, r.cellHeight);
  for (let i = 0; i < frames; i++) { world.step(1 / 60); world.step(1 / 60); r.render(world, 1 / 30); }
}

async function viaEsm(log) {
  // second path: each vendored module as its own ES module, imports resolved through data: URLs
  const urls = {};
  for (const name of ["math", "species", "world", "renderer"]) {
    const js = stripTypeScriptTypes(readFileSync(join(VENDOR, `${name}.ts`), "utf8"), { mode: "transform" })
      .replace(/from "\.\/(\w+)"/g, (_, m) => `from "${urls[m]}"`);
    urls[name] = "data:text/javascript;base64," + Buffer.from(js).toString("base64");
  }
  const { World } = await import(urls.world);
  const { AsciiRenderer } = await import(urls.renderer);
  const dom = fakeDom(log);
  const saved = [Math.random, globalThis.document];
  Math.random = seeded(7); globalThis.document = dom.document;
  try { simulate(World, AsciiRenderer, dom.canvas); } finally { [Math.random, globalThis.document] = saved; }
}

test("the bundled page draws exactly what ascii-sharks' own modules draw", async () => {
  const a = [], b = [];
  const dom = fakeDom(a);
  const ctx = vm.createContext({ document: dom.document });
  vm.runInContext(`${bundle()}\nMath.random = (${seeded.toString()})(7); this.__m = __m;`, ctx);
  simulate(ctx.__m.world.World, ctx.__m.renderer.AsciiRenderer, dom.canvas);
  await viaEsm(b);
  assert.ok(a.filter((op) => op.startsWith("T")).length > 1000, "sharks and fish were drawn");
  assert.equal(a.length, b.length);
  assert.equal(createHash("sha1").update(a.join("\n")).digest("hex"), createHash("sha1").update(b.join("\n")).digest("hex"));
});

test("clock, date, night window and burn-in shift behave like the photo-frame dashboard", () => {
  const ctx = vm.createContext({});
  vm.runInContext(AMBIENT, ctx);
  const at = (h, m) => new Date(2026, 9, 26, h, m);
  assert.equal(ctx.fmtTime(at(13, 5)), "1:05");
  assert.equal(ctx.fmtTime(at(0, 30)), "12:30");
  assert.equal(ctx.fmtTime(at(13, 5), true), "13:05");
  assert.equal(ctx.fmtDate(at(9, 0)), "Monday, October 26");
  assert.deepEqual([21, 22, 3, 5, 6].map((h) => ctx.isNight(at(h, 0), 22, 6)), [false, true, true, true, false]);
  assert.deepEqual([12, 13, 15].map((h) => ctx.isNight(at(h, 0), 13, 15)), [false, true, false]);
  for (const r of [0, 0.5, 0.999]) for (const v of ctx.shift(() => r)) assert.ok(v >= -4 && v <= 4);
});

test("build writes one self-contained page", () => {
  const html = build();
  assert.ok(!/<script[^>]+src=|<link[^>]+href=|https?:\/\//.test(html), "no external resources");
  assert.ok(html.includes("new __m.engine.OceanEngine"));
  const out = join(mkdtempSync(join(tmpdir(), "frame-reef-")), "reef.html");
  const log = execFileSync(process.execPath, [join(ROOT, "build.mjs"), "-o", out], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  assert.match(log, /one file, works offline/);
  assert.equal(readFileSync(out, "utf8"), html);
});
