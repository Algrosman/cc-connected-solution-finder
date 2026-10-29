// Regenerate the brochure PDFs from brochures/brochure-content.json using the Advisory Product
// Builder's own PDF code, so the design matches the builder exactly.
// Usage: node scripts/render_brochures.js <builder index.html> brochures/brochure-content.json brochures [IDs...]
// Needs: npm install jspdf@2.5.1 playwright
//
// The builder code is patched at render time (each patch checks that its target still exists):
//  - bug fixes: resource panels that did not fit at the bottom of a page were left out, and the
//    "06 Resource Requirements" heading could be stranded at the bottom of a page
//  - "offering" instead of "product" in the header, and no product owner (band cell or section 08)
//  - optional fields used by the Finance profiles: stageNote, deliverablesIntro, leadBold,
//    phases, resNote and assumptions (see README)
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
let code = src.slice(start, end);

function patch(find, replace, why) {
  if (!code.includes(find)) throw new Error("builder code changed, review the patch: " + why);
  code = code.replace(find, replace);
}

// Bold lead-in bullets ("Name: details") and an assumptions panel.
const HELPERS = `
    function leadBullets(items, x, width, size, lh, color){
      doc.setFontSize(size);
      items.forEach(it=>{
        const t = clean(it); const m = t.match(/^([^:]{2,80}):\\s+([\\s\\S]*)$/);
        const head = m ? m[1]+':' : ''; const rest = m ? m[2] : t;
        const avail = width-18;
        doc.setFont('helvetica','bold'); const hw = head ? doc.getTextWidth(head)*1.015 + size*0.32 : 0; // viewers draw bold slightly wider than jsPDF measures
        doc.setFont('helvetica','normal');
        const lines = []; let cur = '';
        rest.split(/\\s+/).forEach(w=>{
          const s = cur ? cur+' '+w : w;
          if(doc.getTextWidth(s) <= (lines.length ? avail : avail-hw)) cur = s;
          else { lines.push(cur); cur = w; }
        });
        lines.push(cur);
        ensure(lh*Math.min(lines.length,2));
        fill(color||BLUE); doc.rect(x+1, y-6.2, 4.6, 4.6, 'F');
        lines.forEach((ln,i)=>{
          ensure(lh);
          let cx = x+18;
          if(i===0 && head){ doc.setFont('helvetica','bold'); setC(NAVY); doc.text(head, cx, y); cx += hw; }
          doc.setFont('helvetica','normal'); setC(INK);
          if(ln) doc.text(ln, cx, y);
          y+=lh;
        });
        y+=4;
      });
    }
    function noteList(label, items, color){
      ensure(16 + 2*15.2);
      doc.setFont('helvetica','bold'); doc.setFontSize(7.8); setC(color);
      doc.text(label, M, y, {charSpace:1}); y += 18;
      bullets(items, M, CW, 10.5, 15.2, color);
      y += 4;
    }
`;
patch("    function heading(num, title){", HELPERS + "    function heading(num, title){", "helpers");

// "Offering", not "product".
patch("ADVISORY PRODUCT PROFILE';", "'+(d.headerLabel||'ADVISORY OFFERING PROFILE');", "cover header");

// Blue band: no product owner; category carries a plain-language stage anchor.
patch("['CATEGORY', d.category],", "['CATEGORY', d.category + (d.stageNote ? '\\n(' + d.stageNote + ')' : '')],", "band category");
patch("['PRODUCT OWNER', d.owner.name + (d.owner.title ? '\\n'+d.owner.title : '')]", "", "band owner");
patch("const cellW = CW/4,", "const cellW = CW/glance.length,", "band width");

// 03: optional intro paragraph and bold lead-ins.
patch("heading('03','Key Deliverables'); bullets(d.deliverables, M, CW, BODY, LH, BLUE);",
  "if(d.deliverablesIntro) ensure(150); heading('03','Key Deliverables');" +
  " if(d.deliverablesIntro){ justified(d.deliverablesIntro, M, CW, BODY, LH); y+=8; }" +
  " (d.leadBold ? leadBullets : bullets)(d.deliverables, M, CW, BODY, LH, BLUE);", "deliverables");

// 05: phases with timing, then what drives the range.
patch("if(d.durationNotes) justified(d.durationNotes, M, CW, BODY, LH);",
  "if(d.phases && d.phases.length){ leadBullets(d.phases.map(p=>p.name+' ('+p.weeks+'): '+p.detail), M, CW, BODY, LH, BLUE); y+=6; }" +
  " if(d.durationNotes) justified(d.durationNotes, M, CW, BODY, LH);", "phases");

// 06: bug fixes, client team separate from assumptions, note on what the percentages mean.
patch("if(y + panelH <= BOTTOM || panelH > BOTTOM-TOP){", "if(cols.length){", "resource panels skipped");
patch("heading('06','Resource Requirements');",
  "{ const _c=[d.resCC,d.resClient].filter(c=>c.length); const _w=_c.length===2?(CW-16)/2:CW;" +
  " doc.setFont('helvetica','normal'); doc.setFontSize(BODY);" +
  " const _h=Math.max(0,..._c.map(c=>40+c.reduce((s,it)=>s+doc.splitTextToSize(clean(it),_w-2*14-18).length*LH+4,0)));" +
  " if(_h && _h<=BOTTOM-TOP && y+42+_h>BOTTOM){ doc.addPage(); y=TOP; } }\n    " +
  "heading('06','Resource Requirements');", "keep heading with panels");
patch("['CLIENT TEAM AND INPUTS', d.resClient, GREEN]",
  "[(d.assumptions && d.assumptions.length ? 'CLIENT TEAM' : 'CLIENT TEAM AND INPUTS'), d.resClient, GREEN]", "client label");
patch("heading('07','Expected Outcomes');",
  "if(d.resNote){ doc.setFont('helvetica','italic'); doc.setFontSize(9); setC(MUTED);" +
  " const _n=doc.splitTextToSize(clean(d.resNote), CW); ensure(_n.length*12); _n.forEach(l=>{ doc.text(l, M, y-4); y+=12; }); y+=10; }\n    " +
  "if(d.assumptions && d.assumptions.length) noteList('ENGAGEMENT ASSUMPTIONS', d.assumptions, NAVY);\n    " +
  "heading('07','Expected Outcomes');", "assumptions");

// 08: no product owner section.
const ownerStart = code.indexOf("    /* Owner card */");
const ownerEnd = code.indexOf("    y += cardH;\n", ownerStart);
if (ownerStart < 0 || ownerEnd < 0) throw new Error("builder code changed, review the patch: owner card");
code = code.slice(0, ownerStart) + code.slice(ownerEnd + "    y += cardH;\n".length);
if (/owner/i.test(code.replace(/\/\*[^]*?\*\//g, ""))) throw new Error("owner still referenced in PDF code");

const jspdf = fs.readFileSync(require.resolve("jspdf/dist/jspdf.umd.min.js"), "utf8");
const page = `<!doctype html><html><head><meta charset="utf-8"></head><body>
<script>${jspdf}</script>
<script>
const LOGO = ${JSON.stringify(logo)};
const LOGO_RATIO = 120/720;
${code}
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
      name: it.name, tagline: it.tagline, category: it.category, stageNote: it.stageNote, headerLabel: it.headerLabel,
      need: it.need, value: it.value, deliverablesIntro: it.deliverablesIntro, leadBold: !!it.leadBold,
      deliverables: it.deliverables, deliveryModes: it.deliveryModes, deliveryDetail: it.deliveryDetail,
      duration: it.duration, phases: it.phases || [], durationNotes: it.durationNotes,
      resCC: it.resCC, resClient: it.resClient, resNote: it.resNote, assumptions: it.assumptions || [],
      outcomes: it.outcomes,
    };
    const uri = await p.evaluate(d => window.makePDF(d), d);
    const buf = Buffer.from(uri.split(",")[1], "base64");
    const file = path.join(outDir, it.file);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, buf);
    console.log("wrote", it.file, buf.length, "bytes");
  }
  if (errors.length) { console.log("errors:", errors); process.exitCode = 1; }
  await browser.close();
})();
