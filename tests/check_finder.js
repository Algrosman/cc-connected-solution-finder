// Check every solution finder path: run "node tests/check_finder.js" from the repo root after editing data/finder.js or data/catalog-settings.json.
const fs = require("fs");
const vm = require("vm");
const site = process.argv[2] || require("path").join(__dirname, "..");
const ctx = { window: {} };
ctx.globalThis = ctx.window;
vm.createContext(ctx);
for (const f of ["data/products.js", "data/finder.js", "assets/engine.js"]) {
  vm.runInContext(fs.readFileSync(site + "/" + f, "utf8"), ctx);
}
const { CC_CATALOG: catalog, CC_FINDER: finder, CCEngine: E } = ctx.window;

const results = [];
function walk(status, domain, answers, trail) {
  const q = E.nextQuestion(finder, status, domain, answers);
  if (!q) {
    const rec = E.recommend(catalog, finder, status, domain, answers);
    results.push({ status, domain, trail: trail.join(" > "), top: rec.top.id, score: rec.score,
      alts: rec.alternatives.map(p => p.id).join(","), depth: trail.length,
      runnerUp: rec.ranked[1] ? rec.ranked[1].score : 0 });
    return;
  }
  const opts = E.optionsFor(q, status);
  if (opts.length < 2 || opts.length > 4) console.log("OPTION COUNT", status, q.id, opts.length);
  for (const o of opts) walk(status, domain, { ...answers, [q.id]: o.id }, trail.concat(q.id + "=" + o.id));
}
for (const s of ["existing", "new"]) for (const d of finder.domains.map(d => d.id)) walk(s, d, {}, []);

const reached = {};
for (const r of results) {
  (reached[r.top] = reached[r.top] || new Set()).add(r.status);
  const flag = r.score === r.runnerUp ? "  TIE" : "";
  console.log(`${r.status.padEnd(8)} ${r.domain.padEnd(9)} ${r.top.padEnd(7)} (${r.score}/${r.runnerUp}) alts:${r.alts.padEnd(15)} ${r.trail}${flag}`);
}
console.log("\npaths:", results.length, " max domain questions:", Math.max(...results.map(r => r.depth)));
for (const p of catalog) {
  const st = reached[p.id] ? [...reached[p.id]].join("+") : "NOT REACHED";
  const fit = p.fit.join("+");
  console.log(p.id.padEnd(8), "fit:", fit.padEnd(13), "recommended for:", st);
}
// sanity: never recommend a product to a hospital type it isn't offered to
const bad = results.filter(r => !catalog.find(p => p.id === r.top).fit.includes(r.status));
console.log("fit violations:", bad.length);
