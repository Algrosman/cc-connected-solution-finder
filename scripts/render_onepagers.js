// One-page offering profiles: a single column that reads straight down, on one Letter page, using the
// website's fonts (Source Serif 4 for titles and headings, Roboto for everything else; TrueType copies in
// scripts/fonts) and the builder's logo and colors. Body text is 10.4 pt; profiles that do not fit are reported.
// Usage: node scripts/render_onepagers.js <builder index.html> <content.json> <out dir> [IDs...]
// Needs: npm install jspdf@2.5.1 playwright
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const [builderHtml, contentJson, outDir, ...only] = process.argv.slice(2);
const src = fs.readFileSync(builderHtml, "utf8");
const logo = src.match(/<div class="topbar"><div class="in">\s*<img src="(data:image\/png;base64,[^"]+)"/)[1];
const jspdf = fs.readFileSync(require.resolve("jspdf/dist/jspdf.umd.min.js"), "utf8");
const FONT_DIR = path.join(__dirname, "fonts");
// The domain line above each title, as the website names the domains. SQPE is spelled out at first mention.
const DOMAIN_LABEL = { FIN: "Finance", SQPE: "Safety, Quality, and Patient Experience (SQPE)", IT: "Digital Tools & Analytics",
  EDU: "Education", PKG: "Advisory package across all four domains" };
const FONTS = {};
for (const f of ["Roboto-Regular.ttf", "Roboto-Medium.ttf", "Roboto-Bold.ttf", "SourceSerif4-SemiBold.ttf"]) {
  FONTS[f] = fs.readFileSync(path.join(FONT_DIR, f)).toString("base64");
}

function render(d, LOGO, size, dateStr, FONTS, LOOK) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  [["Roboto-Regular.ttf", "Roboto", "normal"], ["Roboto-Medium.ttf", "Roboto", "medium"], ["Roboto-Bold.ttf", "Roboto", "bold"],
   ["SourceSerif4-SemiBold.ttf", "SourceSerif", "semibold"]].forEach(([f, fam, st]) => {
    doc.addFileToVFS(f, FONTS[f]); doc.addFont(f, fam, st);
  });
  const SANS = st => doc.setFont("Roboto", st || "normal");
  const SERIF = () => doc.setFont("SourceSerif", "semibold");
  const W = 612, H = 792, M = 50, CW = W - 2 * M, COLW = CW, BOTTOM = H - 50;
  // The website's palette (assets/styles.css)
  const NAVY = [27, 71, 123], BLUE = [0, 123, 194], BRIGHT = [31, 155, 224], GREEN = [27, 118, 56], INK = [51, 51, 51],
    SLATE = [102, 102, 102], LINE = [224, 228, 232], SKY = [237, 246, 252], ON_NAVY = [205, 219, 235], ON_NAVY_BLUE = [159, 210, 242];
  const setC = c => doc.setTextColor(c[0], c[1], c[2]);
  const fill = c => doc.setFillColor(c[0], c[1], c[2]);
  const stroke = c => doc.setDrawColor(c[0], c[1], c[2]);
  const clean = s => String(s || "").replace(/[—–]/g, "-").replace(/[‘’ʼ]/g, "'").replace(/[“”]/g, '"')
    .replace(/…/g, "...").replace(/ /g, " ").replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "");
  const LH = size * 1.33, IND = size * 1.3;
  let y = 0, bodyTop = 0, overflow = false, excess = 0;
  function ensure(h) { if (y + h > BOTTOM) overflow = true; }
  // Bold lead-ins. mode "kv": only labels such as "Format:"; "colon": any "Label:"; "auto": labels or a
  // short "Program name." at the start of a bullet.
  const KV = /^(Format|Location|Offering type|Customizable|Add-on|Intended audience|Note|Prerequisites?|Learn more[^:]*)$/;
  function lead(t, mode) {
    let m = t.match(/^([^:]{2,80}):\s+([\s\S]*)$/);
    if (m && (mode === "colon" || KV.test(m[1]))) return [m[1] + ":", m[2]];
    if (mode === "auto") { m = t.match(/^([A-Z][^.]{2,58})\.\s+([\s\S]*)$/); if (m) return [m[1] + ".", m[2]]; }
    return ["", t];
  }
  function wrap(rest, width, hw) {
    SANS(); doc.setFontSize(size);
    const lines = []; let cur = "";
    rest.split(/\s+/).filter(Boolean).forEach(w => {
      const s = cur ? cur + " " + w : w;
      if (doc.getTextWidth(s) <= (lines.length ? width : width - hw)) cur = s; else { lines.push(cur); cur = w; }
    });
    lines.push(cur);
    return lines;
  }
  function headW(head) { SANS("medium"); doc.setFontSize(size); return head ? doc.getTextWidth(head) + size * 0.27 : 0; }
  function textLines(lines, x, width, head, hw, justify) {
    lines.forEach((ln, i) => {
      ensure(LH);
      let cx = x;
      if (i === 0 && head) { SANS("medium"); setC(NAVY); doc.text(head, cx, y); cx += hw; }
      SANS(); setC(INK);
      const avail = width - (i === 0 ? hw : 0), words = ln.split(" ");
      const ww = words.reduce((s, w) => s + doc.getTextWidth(w), 0);
      const gap = words.length > 1 ? (avail - ww) / (words.length - 1) : 0;
      if (justify && i < lines.length - 1 && words.length > 1 && gap <= size * 0.75) {
        words.forEach(w => { doc.text(w, cx, y); cx += doc.getTextWidth(w) + gap; });
      } else if (ln) doc.text(ln, cx, y);
      y += LH;
    });
  }
  function para(text) {
    clean(text).split(/\r?\n/).map(s => s.trim()).filter(Boolean).forEach((p, i) => {
      if (i) y += size * 0.45;
      const [head, rest] = lead(p, "kv"), hw = headW(head);
      textLines(wrap(rest, COLW, hw), M, COLW, head, hw, true);
    });
  }
  // Markers: "square" (deliverables, questions), "check" (outcomes), "number" (phases)
  function marker(kind, x, i, color) {
    if (kind === "square") { fill(color); doc.rect(x + 0.6, y - size * 0.6, size * 0.38, size * 0.38, "F"); }
    else if (kind === "check") {
      stroke(color); doc.setLineWidth(1.3); doc.setLineCap("round"); doc.setLineJoin("round");
      doc.lines([[size * 0.22, size * 0.24], [size * 0.4, -size * 0.52]], x + 0.4, y - size * 0.34, [1, 1], "S", false);
      doc.setLineCap("butt"); doc.setLineJoin("miter");
    } else {
      const r = size * 0.5; fill(color); doc.circle(x + r, y - size * 0.34, r, "F");
      SANS("bold"); doc.setFontSize(size * 0.72); doc.setTextColor(255, 255, 255);
      doc.text(String(i + 1), x + r, y - size * 0.34 + size * 0.25, { align: "center" }); doc.setFontSize(size);
    }
  }
  function list(items, kind, color, colon, x, width, ind) {
    x = x === undefined ? M : x; width = width === undefined ? COLW : width; ind = ind === undefined ? (kind === "number" ? size * 1.65 : IND) : ind;
    items.forEach((it, i) => {
      const [head, rest] = lead(clean(it), colon ? "colon" : "auto"), hw = headW(head);
      const lines = wrap(rest, width - ind, hw);
      ensure(LH * Math.min(lines.length, 2));
      marker(kind, x, i, color);
      textLines(lines, x + ind, width - ind, head, hw, false);
      y += size * 0.3;
    });
  }
  function measure(items, width, colon) {
    return items.reduce((h, it) => { const [head, rest] = lead(clean(it), colon ? "colon" : "auto"); return h + wrap(rest, width, headW(head)).length * LH + size * 0.3; }, 0);
  }
  function heading(title) {
    ensure(size * 2.6 + LH * 3);
    if (y > bodyTop + 1) y += size * 0.62;
    SERIF(); doc.setFontSize(size + 3.4); setC(NAVY);
    doc.text(clean(title), M, y);
    y += size * 0.52; stroke(LINE); doc.setLineWidth(0.6); doc.line(M, y, M + COLW, y);
    y += size * 1.25;
  }
  // A tinted panel for the client's questions
  function callout(title, items) {
    const X = M + 18, Wd = CW - 18 - 14;
    if (y > bodyTop + 1) y += size * 0.62;
    const T = y - size * 1.05;
    const hb = T + 12 + (size + 2.4) * 0.72, b1 = hb + size * 1.6;
    const bottom = b1 + measure(items, Wd - IND, false) - size * 0.3 - LH + size * 0.28 + 11;
    ensure(bottom - y);
    fill(SKY); doc.rect(M, T, CW, bottom - T, "F"); fill(BLUE); doc.rect(M, T, 3, bottom - T, "F");
    SERIF(); doc.setFontSize(size + 2.4); setC(NAVY); doc.text(clean(title), X, hb);
    y = b1;
    list(items, "square", BLUE, false, X, Wd);
    y = bottom + size * 1.3;
  }

  /* ---- Header ---- */
  const LOGO_W = 122, LOGO_H = LOGO_W * 120 / 720;
  let titleC = NAVY, tagC = SLATE, eyeC = BLUE;
  if (LOOK === "navy") {
    doc.addImage(LOGO, "PNG", M, 24, LOGO_W, LOGO_H, "cclogo", "FAST");
    SANS(); doc.setFontSize(9); setC(SLATE);
    doc.text("International & Emerging Markets  |  " + (d.headerLabel || "Advisory offering profile"), W - M, 37, { align: "right" });
    titleC = [255, 255, 255]; tagC = ON_NAVY; eyeC = ON_NAVY_BLUE;
  } else {
    doc.addImage(LOGO, "PNG", M, 28, LOGO_W, LOGO_H, "cclogo", "FAST");
    SANS("medium"); doc.setFontSize(9); setC(NAVY); doc.text("International & Emerging Markets", W - M, 36, { align: "right" });
    SANS(); setC(SLATE); doc.text(d.headerLabel || "Advisory offering profile", W - M, 47.5, { align: "right" });
    stroke(LINE); doc.setLineWidth(0.6); doc.line(M, 58, W - M, 58);
  }
  // Measure the title block so the navy version can draw its band first
  SERIF(); doc.setFontSize(24);
  const tLines = doc.splitTextToSize(clean(d.name), CW);
  SANS(); doc.setFontSize(12);
  const gLines = d.tagline ? doc.splitTextToSize(clean(d.tagline), CW) : [];
  const top = LOOK === "navy" ? 58 : 58;
  const eyeY = top + (LOOK === "navy" ? 28 : 24), t1 = eyeY + 27, g1 = t1 + (tLines.length - 1) * 27 + 20;
  const blockEnd = g1 + (gLines.length - 1) * 16;
  if (LOOK === "navy") {
    fill(NAVY); doc.rect(0, top, W, blockEnd + 19 - top, "F");
    fill(BRIGHT); doc.rect(0, blockEnd + 19, W, 3, "F");
  }
  SANS("medium"); doc.setFontSize(10.5); setC(eyeC); doc.text(clean(d.domainLabel), M, eyeY);
  SERIF(); doc.setFontSize(24); setC(titleC); tLines.forEach((ln, i) => doc.text(ln, M, t1 + i * 28));
  SANS(); doc.setFontSize(12); setC(tagC); gLines.forEach((ln, i) => doc.text(ln, M, g1 + i * 16));
  y = LOOK === "navy" ? blockEnd + 22 : blockEnd + 16;

  /* ---- At-a-glance facts ---- */
  const glance = [["Category", d.category + (d.stageNote ? " (" + d.stageNote + ")" : "")], ["Typical duration", d.duration], ["Delivery model", d.deliveryModes.join(", ")]];
  const pad = 14, VL = 14;
  SANS("medium"); doc.setFontSize(10.8);
  // Column widths that keep the strip as short as possible (each column at least 24% of the width)
  let best = null;
  for (let a = 24; a <= 52; a += 2) for (let b = 24; b <= 52; b += 2) {
    const c = 100 - a - b; if (c < 24) continue;
    const ws = [a, b, c].map(f => f / 100 * CW);
    const cl = glance.map((g, i) => doc.splitTextToSize(clean(g[1]), ws[i] - 2 * pad));
    const score = Math.max(...cl.map(x => x.length)) * 1000 + cl.reduce((t, x) => t + x.length, 0) * 50 + Math.abs(a - 40) + Math.abs(b - 30);
    if (!best || score < best.score) best = { score, ws, cl };
  }
  const widths = best.ws, cells = best.cl;
  const stripH = 20 + 12 + (Math.max(...cells.map(c => c.length)) - 1) * VL + 13;
  const sy = y;
  if (LOOK === "navy") { stroke(LINE); doc.setLineWidth(0.6); doc.line(0, sy + stripH, W, sy + stripH); }
  else { fill(SKY); doc.rect(M, sy, CW, stripH, "F"); fill(NAVY); doc.rect(M, sy, CW, 2, "F"); }
  let cx0 = M;
  glance.forEach((g, i) => {
    if (i) { stroke(LOOK === "navy" ? LINE : [200, 214, 228]); doc.setLineWidth(0.6); doc.line(cx0, sy + 12, cx0, sy + stripH - 10); }
    const tx = cx0 + (i || LOOK !== "navy" ? pad : 0);
    SANS(); doc.setFontSize(9); setC(SLATE); doc.text(g[0], tx, sy + 20);
    SANS("medium"); doc.setFontSize(10.8); setC(LOOK === "navy" ? INK : NAVY);
    cells[i].forEach((ln, j) => doc.text(ln, tx, sy + 34 + j * VL));
    cx0 += widths[i];
  });
  y = sy + stripH + 25;
  bodyTop = y;

  /* ---- Body ---- */
  heading("Client need"); para(d.need);
  if (d.questions && d.questions.length) callout("Questions we help you answer", d.questions);
  heading("What you receive");
  if (d.deliverablesIntro) { para(d.deliverablesIntro); y += size * 0.3; }
  list(d.deliverables, "square", BLUE, d.leadBold);
  heading("How it works");
  if (d.phases && d.phases.length) { list(d.phases.map(p => p.name + " (" + p.weeks + "): " + p.detail), "number", BLUE, true); y += size * 0.15; }
  const notes = [d.phases && d.phases.length ? "" : d.deliveryDetail, d.durationNotes].filter(Boolean);
  if (notes.length) para(notes.join("\n"));
  heading("Expected outcomes"); list(d.outcomes, "check", GREEN, false);
  if (overflow) excess = y - BOTTOM;

  /* ---- Footer ---- */
  stroke(LINE); doc.setLineWidth(0.6); doc.line(M, H - 38, W - M, H - 38);
  SANS(); doc.setFontSize(8.5); setC(SLATE);
  doc.text("Cleveland Clinic  |  International & Emerging Markets", M, H - 25);
  doc.text("Prepared " + dateStr, W - M, H - 25, { align: "right" });
  return { overflow, excess: Math.round(excess), uri: doc.output("datauristring"), endY: y };
}

(async () => {
  const items = JSON.parse(fs.readFileSync(contentJson, "utf8"));
  const browser = await chromium.launch();
  const p = await browser.newPage();
  const errors = [];
  p.on("pageerror", e => errors.push(e.message));
  await p.setContent(`<!doctype html><html><body><script>${jspdf}</script></body></html>`, { waitUntil: "load" });
  fs.mkdirSync(outDir, { recursive: true });
  const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const report = [];
  for (const it of items) {
    if (only.length && !only.includes(it.id)) continue;
    const src = Object.assign({}, it, it.onePage || {});
    const d = {
      name: src.name, tagline: src.tagline, category: src.category, stageNote: src.stageNote, headerLabel: src.headerLabel,
      need: src.need, value: src.value, questions: src.questions || [], deliverablesIntro: src.deliverablesIntro, leadBold: !!src.leadBold,
      deliverables: src.deliverables, deliveryModes: src.deliveryModes, deliveryDetail: src.deliveryDetail,
      duration: src.duration, phases: src.phases || [], durationNotes: src.durationNotes,
      resCC: src.resCC, resClient: src.resClient, resNote: src.resNote, assumptions: src.assumptions || [],
      outcomes: src.outcomes, domainLabel: DOMAIN_LABEL[it.id.split("-")[0]] || "",
    };
    let res = null, used = null;
    const BODY_PT = Number(process.env.ONEPAGE_SIZE || 10.4);
    const LOOK = process.env.ONEPAGE_LOOK || "light";
    for (let size = BODY_PT; size >= BODY_PT - 0.01; size = Math.round((size - 0.2) * 100) / 100) {
      res = await p.evaluate(([fn, d, logo, size, dateStr, fonts, look]) => (new Function("return " + fn)())(d, logo, size, dateStr, fonts, look),
        [render.toString(), d, logo, size, dateStr, FONTS, LOOK]);
      if (!res.overflow) { used = size; break; }
    }
    if (!used && process.env.ONEPAGE_FORCE) { const f = path.join(outDir, it.file); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, Buffer.from(res.uri.split(",")[1], "base64")); }
    if (!used) { report.push(`${it.id}: over by about ${res.excess} pt of column (${Math.round(res.excess / (BODY_PT * 1.33))} lines) at ${BODY_PT} pt`); continue; }
    const file = path.join(outDir, it.file);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.from(res.uri.split(",")[1], "base64"));
    report.push(`${it.id}: ${used} pt`);
  }
  console.log(report.join("\n"));
  if (errors.length) { console.log("errors:", errors); process.exitCode = 1; }
  await browser.close();
})();
