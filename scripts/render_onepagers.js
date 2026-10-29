// One-page offering profiles. Same content, colors, fonts and logo as the Advisory Product Builder's
// brochures, in a single column that reads straight down, sized to fit one Letter page. The largest type size that
// fits is used (10.8 pt, or down to 10 pt if needed); anything that still does not fit is reported, not cut silently.
// Usage: node scripts/render_onepagers.js <builder index.html> <content.json> <out dir> [IDs...]
// Needs: npm install jspdf@2.5.1 playwright
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const [builderHtml, contentJson, outDir, ...only] = process.argv.slice(2);
const src = fs.readFileSync(builderHtml, "utf8");
const logo = src.match(/<div class="topbar"><div class="in">\s*<img src="(data:image\/png;base64,[^"]+)"/)[1];
const jspdf = fs.readFileSync(require.resolve("jspdf/dist/jspdf.umd.min.js"), "utf8");

function render(d, LOGO, size, dateStr) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "letter" });
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
    doc.setFont("helvetica", "normal"); doc.setFontSize(size);
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
    doc.setFont("helvetica", "bold"); doc.setFontSize(size);
    const hw = head ? doc.getTextWidth(head) * 1.015 + size * 0.32 : 0;
    const lines = wrap(rest, COLW, hw);
    lines.forEach((ln, i) => {
      ensure(LH);
      let cx = x0();
      if (i === 0 && head) { doc.setFont("helvetica", "bold"); setC(NAVY); doc.text(head, cx, y); cx += hw; }
      doc.setFont("helvetica", "normal"); setC(INK);
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
      doc.setFont("helvetica", "bold"); doc.setFontSize(size);
      const ind = size * 1.15;
      const hw = head ? doc.getTextWidth(head) * 1.015 + size * 0.32 : 0;
      const lines = wrap(rest, COLW - ind, hw);
      ensure(LH * Math.min(lines.length, 2));
      fill(color); doc.rect(x0() + 0.5, y - size * 0.62, size * 0.42, size * 0.42, "F");
      lines.forEach((ln, i) => {
        ensure(LH);
        let cx = x0() + ind;
        if (i === 0 && head) { doc.setFont("helvetica", "bold"); setC(NAVY); doc.text(head, cx, y); cx += hw; }
        doc.setFont("helvetica", "normal"); setC(INK);
        if (ln) doc.text(ln, cx, y);
        y += LH;
      });
      y += size * 0.28;
    });
  }
  function heading(num, title) {
    ensure(size * 2.4 + LH * 4); // keep the heading with the first lines that follow it
    if (y > bodyTop + 1) y += size * 0.5;
    doc.setFont("times", "bold"); doc.setFontSize(size + 4); setC(GREEN);
    doc.text(num, x0(), y + 1);
    doc.setFont("helvetica", "bold"); doc.setFontSize(size - 0.4); setC(NAVY);
    doc.text(clean(title).toUpperCase(), x0() + size * 2.1, y, { charSpace: 0.7 });
    y += size * 0.5; stroke(LINE); doc.setLineWidth(0.6); doc.line(x0(), y, x0() + COLW, y);
    y += size * 1.3;
  }
  function label(t, color) {
    ensure(LH * 2);
    doc.setFont("helvetica", "bold"); doc.setFontSize(size - 1.3); setC(color);
    doc.text(t, x0(), y, { charSpace: 0.6 });
    y += LH * 0.95;
  }
  function leadLine(t) {
    ensure(LH * 2);
    doc.setFont("times", "bold"); doc.setFontSize(size + 1.4); setC(NAVY);
    doc.splitTextToSize(clean(t), COLW).forEach(ln => { ensure(LH); doc.text(ln, x0(), y); y += LH * 1.08; });
    y += size * 0.15;
  }

  /* ---- Header ---- */
  fill(NAVY); doc.rect(0, 0, W, 5, "F");
  doc.addImage(LOGO, "PNG", M, 20, 118, 118 * 120 / 720, "cclogo", "FAST");
  doc.setFont("helvetica", "bold"); doc.setFontSize(6.6); setC(GREEN);
  { const t = "INTERNATIONAL & EMERGING MARKETS  |  " + (d.headerLabel || "ADVISORY OFFERING PROFILE");
    const tw = doc.getTextWidth(t) + 0.8 * (t.length - 1); doc.text(t, W - M - tw, 33, { charSpace: 0.8 }); }
  y = 66;
  doc.setFont("times", "bold"); doc.setFontSize(20); setC(NAVY);
  doc.splitTextToSize(clean(d.name), CW).forEach(ln => { doc.text(ln, M, y); y += 22; });
  if (d.tagline) {
    y -= 4; doc.setFont("times", "italic"); doc.setFontSize(10.2); setC(MUTED);
    doc.splitTextToSize(clean(d.tagline), CW).forEach(ln => { y += 12.6; doc.text(ln, M, y); });
  }
  y += 12;
  /* ---- At-a-glance band ---- */
  const glance = [["CATEGORY", d.category + (d.stageNote ? "\n(" + d.stageNote + ")" : "")], ["TYPICAL DURATION", d.duration], ["DELIVERY MODEL", d.deliveryModes.join(", ")]];
  const cellW = CW / 3, pad = 10;
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.2);
  const cells = glance.map(g => [].concat(...clean(g[1]).split("\n").map(p => doc.splitTextToSize(p, cellW - 2 * pad))));
  const bandH = 30 + Math.max(...cells.map(c => c.length)) * 10.2;
  fill(NAVY); doc.rect(0, y, W, bandH, "F");
  fill(BLUE); doc.rect(0, y + bandH, W / 2, 2.2, "F"); fill(GREEN); doc.rect(W / 2, y + bandH, W / 2, 2.2, "F");
  glance.forEach((g, i) => {
    const cx = M + i * cellW + (i ? pad : 0);
    if (i) { doc.setDrawColor(60, 85, 120); doc.setLineWidth(0.5); doc.line(M + i * cellW, y + 11, M + i * cellW, y + bandH - 11); }
    doc.setFont("helvetica", "bold"); doc.setFontSize(6.4); doc.setTextColor(150, 185, 228); doc.text(g[0], cx, y + 16, { charSpace: 0.8 });
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.2); doc.setTextColor(255, 255, 255);
    cells[i].forEach((ln, j) => doc.text(ln, cx, y + 28 + j * 10.2));
  });
  y += bandH + 2.2 + 18;
  bodyTop = y;

  /* ---- Body, flowing down the left column and then the right ---- */
  heading("01", "Client Need"); para(d.need);
  heading("02", "Why Cleveland Clinic"); para(d.value);
  heading("03", "What You Receive");
  if (d.deliverablesIntro) { para(d.deliverablesIntro); y += size * 0.3; }
  bullets(d.deliverables, BLUE, d.leadBold);
  heading("04", "How It Works");
  leadLine(d.deliveryModes.join("  /  ") + "   |   " + d.duration);
  if (d.phases && d.phases.length) bullets(d.phases.map(p => p.name + " (" + p.weeks + "): " + p.detail), BLUE, true);
  else if (d.deliveryDetail) para(d.deliveryDetail);
  if (d.durationNotes) para(d.durationNotes);
  const needs = d.resClient.concat(d.assumptions || []);
  if (needs.length) { heading("05", "What We Need From You"); bullets(needs, GREEN, false); }
  heading(needs.length ? "06" : "05", "Expected Outcomes"); bullets(d.outcomes, GREEN, false);
  if (overflow) excess = y - BOTTOM + (col === 1 ? 0 : 0);

  /* ---- Footer ---- */
  fill(BLUE); doc.rect(M, H - 36, CW / 2, 1, "F"); fill(GREEN); doc.rect(M + CW / 2, H - 36, CW / 2, 1, "F");
  doc.setFont("helvetica", "normal"); doc.setFontSize(6.8); setC(MUTED);
  doc.text("CLEVELAND CLINIC  |  INTERNATIONAL & EMERGING MARKETS", M, H - 24, { charSpace: 0.5 });
  doc.text("Prepared " + dateStr, W - M, H - 24, { align: "right" });
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
    for (let size = 10.4; size >= 10.39; size = Math.round((size - 0.2) * 100) / 100) {
      res = await p.evaluate(([fn, d, logo, size, dateStr]) => (new Function("return " + fn)())(d, logo, size, dateStr),
        [render.toString(), d, logo, size, dateStr]);
      if (!res.overflow) { used = size; break; }
    }
    if (!used) { report.push(`${it.id}: over by about ${res.excess} pt of column (${Math.round(res.excess / (10.4 * 1.33))} lines) at 10.4 pt`); continue; }
    const file = path.join(outDir, it.file);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.from(res.uri.split(",")[1], "base64"));
    report.push(`${it.id}: ${used} pt`);
  }
  console.log(report.join("\n"));
  if (errors.length) { console.log("errors:", errors); process.exitCode = 1; }
  await browser.close();
})();
