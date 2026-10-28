// Regenerate the brochure PDFs from brochures/brochure-content.json using the Advisory Product
// Builder's own PDF code, so the design matches the builder exactly.
// Usage: node scripts/render_brochures.js <builder index.html> brochures/brochure-content.json brochures [IDs...]
// Needs: npm install jspdf@2.5.1 playwright
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const [builderHtml, contentJson, outDir, ...only] = process.argv.slice(2);
const src = fs.readFileSync(builderHtml, "utf8");

const logo = src.match(/<div class="topbar"><div class="in">\s*<img src="(data:image\/png;base64,[^"]+)"/)[1];
const start = src.indexOf("  const clean = s =>");
const endMarker = "    return doc;\n  }";
const end = src.indexOf(endMarker, start) + endMarker.length;
if (start < 0 || end < endMarker.length) throw new Error("buildPDF not found in builder");
// Builder fix: the resource panels were skipped (not moved to the next page) when they did
// not fit at the bottom of a page, and an empty resource section produced an invalid layout.
const RES_BUG = "if(y + panelH <= BOTTOM || panelH > BOTTOM-TOP){";
if (!src.includes(RES_BUG)) throw new Error("builder resource-panel code changed; review the patch");
// Keep the "06 Resource Requirements" heading on the same page as its panels.
const RES_HEAD = "heading('06','Resource Requirements');";
if (!src.includes(RES_HEAD)) throw new Error("builder resource heading changed; review the patch");
const KEEP_TOGETHER = "{ const _c=[d.resCC,d.resClient].filter(c=>c.length); const _w=_c.length===2?(CW-16)/2:CW;" +
  " doc.setFont('helvetica','normal'); doc.setFontSize(BODY);" +
  " const _h=Math.max(0,..._c.map(c=>40+c.reduce((s,it)=>s+doc.splitTextToSize(clean(it),_w-2*14-18).length*LH+4,0)));" +
  " if(_h && _h<=BOTTOM-TOP && y+42+_h>BOTTOM){ doc.addPage(); y=TOP; } }\n    ";
const builderCode = src.slice(start, end).replace(RES_BUG, "if(cols.length){").replace(RES_HEAD, KEEP_TOGETHER + RES_HEAD);

const jspdf = fs.readFileSync(require.resolve("jspdf/dist/jspdf.umd.min.js"), "utf8");
const page = `<!doctype html><html><head><meta charset="utf-8"></head><body>
<script>${jspdf}</script>
<script>
const LOGO = ${JSON.stringify(logo)};
const LOGO_RATIO = 120/720;
${builderCode}
window.makePDF = d => buildPDF(d).output('datauristring');
</script></body></html>`;

(async () => {
  const items = JSON.parse(fs.readFileSync(contentJson, "utf8"));
  const browser = await chromium.launch();
  const p = await browser.newPage();
  const errors = [];
  p.on("pageerror", e => errors.push(e.message));
  await p.setContent(page, { waitUntil: "load" });
  fs.mkdirSync(outDir, { recursive: true });
  for (const it of items) {
    if (only.length && !only.includes(it.id)) continue;
    const d = {
      name: it.name, tagline: it.tagline, category: it.category,
      need: it.need, value: it.value, deliverables: it.deliverables,
      deliveryModes: it.deliveryModes, deliveryDetail: it.deliveryDetail,
      duration: it.duration, durationNotes: it.durationNotes,
      resCC: it.resCC, resClient: it.resClient, outcomes: it.outcomes,
      owner: it.owner,
    };
    const uri = await p.evaluate(d => window.makePDF(d), d);
    const buf = Buffer.from(uri.split(",")[1], "base64");
    const file = path.join(outDir, it.file);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, buf);
    console.log("wrote", it.file, buf.length, "bytes");
  }
  if (errors.length) console.log("errors:", errors);
  await browser.close();
})();
