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
const FONTS = {};
for (const f of ["Roboto-Regular.ttf", "Roboto-Medium.ttf", "Roboto-Bold.ttf", "SourceSerif4-SemiBold.ttf", "SourceSerif4-Italic.ttf"]) {
  FONTS[f] = fs.readFileSync(path.join(FONT_DIR, f)).toString("base64");
}

function render(d, LOGO, size, dateStr, FONTS) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  [["Roboto-Regular.ttf", "Roboto", "normal"], ["Roboto-Medium.ttf", "Roboto", "medium"], ["Roboto-Bold.ttf", "Roboto", "bold"],
   ["SourceSerif4-SemiBold.ttf", "SourceSerif", "semibold"], ["SourceSerif4-Italic.ttf", "SourceSerif", "italic"]].forEach(([f, fam, st]) => {
    doc.addFileToVFS(f, FONTS[f]); doc.addFont(f, fam, st);
  });
  const SANS = st => doc.setFont("Roboto", st || "normal");
  const SERIF = st => doc.setFont("SourceSerif", st || "semibold");
  const W = 612, H = 792, M = 46, CW = W - 2 * M, COLW = CW, BOTTOM = H - 50;
  const NAVY = [15, 37, 68], BLUE = [55, 97, 173], GREEN = [70, 125, 60], INK = [29, 36, 48], MUTED = [95, 107, 122], LINE = [222, 227, 234];
  const setC = c => doc.setTextColor(c[0], c[1], c[2]);
  const fill = c => doc.setFillColor(c[0], c[1], c[2]);
  const stroke = c => doc.setDrawColor(c[0], c[1], c[2]);
  const clean = s => String(s || "").replace(/[—–]/g, "-").replace(/[‘’ʼ]/g, "'").replace(/[“”]/g, '"')
    .replace(/…/g, "...").replace(/ /g, " ").replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "");
  const LH = size * 1.33;
  let y = 0, col = 0, bodyTop = 0, overflow = false, excess = 0;
  const x0 = () => M;
  function ensure(h) {
    if (y + h <= BOTTOM) return;
    overflow = true;
  }
  // Bold lead-ins. mode "kv": only labels such as "Format:"; "colon": any "Label:"; "auto": labels or a
  // short "Program name." at the start of a bullet.
  const KV = /^(Format|Location|Offering type|Customizable|Add-on|Intended audience|Note|Prerequisites?|Learn more[^:]*)$/;
  function lead(t, mode) {
    let m = t.match(/^([^:]{2,80}):\s+([\s\S]*)$/);
    if (m && (mode === "colon" || KV.test(m[1]))) return [m[1] + ":", m[2]];
    if (mode === "auto") { m = t.match(/^([A-Z][^.]{2,58})\.\s+([\s\S]*)$/); if (m) return [m[1] + ".", m[2]]; }
    return ["", t];
  }
  // Wrap text whose first line starts after a bold lead of width hw.
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
  function para(text) {
    clean(text).split(/\r?\n/).map(s => s.trim()).filter(Boolean).forEach((p, i) => {
      if (i) y += size * 0.45;
      paraBlock(p);
    });
  }
  function paraBlock(p) {
    const [head, rest] = lead(p, "kv");
    SANS("medium"); doc.setFontSize(size);
    const hw = head ? doc.getTextWidth(head) * 1.015 + size * 0.32 : 0;
    const lines = wrap(rest, COLW, hw);
    lines.forEach((ln, i) => {
      ensure(LH);
      let cx = x0();
      if (i === 0 && head) { SANS("medium"); setC(NAVY); doc.text(head, cx, y); cx += hw; }
      SANS(); setC(INK);
      const avail = COLW - (i === 0 ? hw : 0);
      const words = ln.split(" ");
      const ww = words.reduce((s, w) => s + doc.getTextWidth(w), 0);
      const gap = words.length > 1 ? (avail - ww) / (words.length - 1) : 0;
      // Justify, except where it would open up wide gaps in the narrow column.
      if (i < lines.length - 1 && words.length > 1 && gap <= size * 0.75) {
        words.forEach(w => { doc.text(w, cx, y); cx += doc.getTextWidth(w) + gap; });
      } else if (ln) doc.text(ln, cx, y);
      y += LH;
    });
  }
  function bullets(items, color, colon) {
    items.forEach(it => {
      const t = clean(it);
      const [head, rest] = lead(t, colon ? "colon" : "auto");
      SANS("medium"); doc.setFontSize(size);
      const ind = size * 1.15;
      const hw = head ? doc.getTextWidth(head) * 1.015 + size * 0.32 : 0;
      const lines = wrap(rest, COLW - ind, hw);
      ensure(LH * Math.min(lines.length, 2));
      fill(color); doc.rect(x0() + 0.5, y - size * 0.62, size * 0.42, size * 0.42, "F");
      lines.forEach((ln, i) => {
        ensure(LH);
        let cx = x0() + ind;
        if (i === 0 && head) { SANS("medium"); setC(NAVY); doc.text(head, cx, y); cx += hw; }
        SANS(); setC(INK);
        if (ln) doc.text(ln, cx, y);
        y += LH;
      });
      y += size * 0.28;
    });
  }
  function heading(title) {
    ensure(size * 2.6 + LH * 4); // keep the heading with the first lines that follow it
    if (y > bodyTop + 1) y += size * 0.55;
    SERIF("semibold"); doc.setFontSize(size + 3.6); setC(NAVY);
    doc.text(clean(title), x0(), y);
    y += size * 0.55; stroke(LINE); doc.setLineWidth(0.6); doc.line(x0(), y, x0() + COLW, y);
    y += size * 1.25;
  }
  function leadLine(t) {
    ensure(LH * 2);
    SANS("medium"); doc.setFontSize(size + 0.4); setC(NAVY);
    doc.splitTextToSize(clean(t), COLW).forEach(ln => { ensure(LH); doc.text(ln, x0(), y); y += LH * 1.05; });
    y += size * 0.15;
  }

  /* ---- Header ---- */
  fill(NAVY); doc.rect(0, 0, W, 5, "F");
  doc.addImage(LOGO, "PNG", M, 20, 124, 124 * 120 / 720, "cclogo", "FAST");
  SANS("medium"); doc.setFontSize(9); setC(GREEN);
  doc.text("International & Emerging Markets  |  " + (d.headerLabel || "Advisory offering profile"), W - M, 34, { align: "right" });
  y = 70;
  SERIF("semibold"); doc.setFontSize(22); setC(NAVY);
  doc.splitTextToSize(clean(d.name), CW).forEach(ln => { doc.text(ln, M, y); y += 25; });
  if (d.tagline) {
    y -= 6; SERIF("italic"); doc.setFontSize(11.5); setC(MUTED);
    doc.splitTextToSize(clean(d.tagline), CW).forEach(ln => { y += 14.5; doc.text(ln, M, y); });
  }
  y += 14;
  /* ---- At-a-glance ribbon ---- */
  const glance = [["Category", d.category + (d.stageNote ? "\n(" + d.stageNote + ")" : "")], ["Typical duration", d.duration], ["Delivery model", d.deliveryModes.join(", ")]];
  const cellW = CW / 3, pad = 12, VL = 13;
  SANS(); doc.setFontSize(10.6);
  const cells = glance.map(g => [].concat(...clean(g[1]).split("\n").map(p => doc.splitTextToSize(p, cellW - 2 * pad))));
  const bandH = 34 + Math.max(...cells.map(c => c.length)) * VL;
  fill(NAVY); doc.rect(0, y, W, bandH, "F");
  fill(BLUE); doc.rect(0, y + bandH, W / 2, 2.5, "F"); fill(GREEN); doc.rect(W / 2, y + bandH, W / 2, 2.5, "F");
  glance.forEach((g, i) => {
    const cx = M + i * cellW + (i ? pad : 0);
    if (i) { doc.setDrawColor(60, 85, 120); doc.setLineWidth(0.5); doc.line(M + i * cellW, y + 12, M + i * cellW, y + bandH - 12); }
    SANS("medium"); doc.setFontSize(9); doc.setTextColor(150, 185, 228); doc.text(g[0], cx, y + 18);
    SANS(); doc.setFontSize(10.6); doc.setTextColor(255, 255, 255);
    cells[i].forEach((ln, j) => doc.text(ln, cx, y + 32 + j * VL));
  });
  y += bandH + 2.5 + 20;
  bodyTop = y;

  /* ---- Body, flowing down the left column and then the right ---- */
  heading("Client need"); para(d.need);
  heading("Why Cleveland Clinic"); para(d.value);
  heading("What you receive");
  if (d.deliverablesIntro) { para(d.deliverablesIntro); y += size * 0.3; }
  bullets(d.deliverables, BLUE, d.leadBold);
  heading("How it works");
  leadLine(d.deliveryModes.join("  /  ") + "   |   " + d.duration);
  if (d.phases && d.phases.length) bullets(d.phases.map(p => p.name + " (" + p.weeks + "): " + p.detail), BLUE, true);
  else if (d.deliveryDetail) para(d.deliveryDetail);
  if (d.durationNotes) para(d.durationNotes);
  const needs = d.resClient.concat(d.assumptions || []);
  if (needs.length) { heading("What we need from you"); bullets(needs, GREEN, false); }
  heading("Expected outcomes"); bullets(d.outcomes, GREEN, false);
  if (overflow) excess = y - BOTTOM + (col === 1 ? 0 : 0);

  /* ---- Footer ---- */
  fill(BLUE); doc.rect(M, H - 36, CW / 2, 1, "F"); fill(GREEN); doc.rect(M + CW / 2, H - 36, CW / 2, 1, "F");
  SANS(); doc.setFontSize(8.5); setC(MUTED);
  doc.text("Cleveland Clinic  |  International & Emerging Markets", M, H - 23);
  doc.text("Prepared " + dateStr, W - M, H - 23, { align: "right" });
  return { overflow, excess: Math.round(excess), uri: overflow ? null : doc.output("datauristring"), endY: y, col };
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
      need: src.need, value: src.value, deliverablesIntro: src.deliverablesIntro, leadBold: !!src.leadBold,
      deliverables: src.deliverables, deliveryModes: src.deliveryModes, deliveryDetail: src.deliveryDetail,
      duration: src.duration, phases: src.phases || [], durationNotes: src.durationNotes,
      resCC: src.resCC, resClient: src.resClient, resNote: src.resNote, assumptions: src.assumptions || [],
      outcomes: src.outcomes,
    };
    let res = null, used = null;
    const BODY_PT = Number(process.env.ONEPAGE_SIZE || 10.4);
    for (let size = BODY_PT; size >= BODY_PT - 0.01; size = Math.round((size - 0.2) * 100) / 100) {
      res = await p.evaluate(([fn, d, logo, size, dateStr, fonts]) => (new Function("return " + fn)())(d, logo, size, dateStr, fonts),
        [render.toString(), d, logo, size, dateStr, FONTS]);
      if (!res.overflow) { used = size; break; }
    }
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
