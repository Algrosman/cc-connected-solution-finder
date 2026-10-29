// Draws the two-page executive summary at the front of the Finance packet, in the same style as
// the brochures. Run by scripts/build_finance_packet.py, which supplies the spec and merges the PDFs.
// Usage: node scripts/finance_packet_summary.js <builder index.html> <spec.json> <out.pdf>
// Prints JSON describing the clickable areas, which the Python script turns into links.
const fs = require("fs");
const { chromium } = require("playwright");

const [builderHtml, specPath, outPdf] = process.argv.slice(2);
const src = fs.readFileSync(builderHtml, "utf8");
const logo = src.match(/<div class="topbar"><div class="in">\s*<img src="(data:image\/png;base64,[^"]+)"/)[1];
const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
const jspdf = fs.readFileSync(require.resolve("jspdf/dist/jspdf.umd.min.js"), "utf8");

function draw(S, LOGO) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = 612, H = 792, M = 60, CW = W - 2 * M, TOP = 92, BOTTOM = H - 70;
  const NAVY = [15, 37, 68], BLUE = [55, 97, 173], GREEN = [70, 125, 60], INK = [29, 36, 48],
    MUTED = [95, 107, 122], SOFT = [246, 248, 251], LINE = [222, 227, 234];
  const setC = c => doc.setTextColor(c[0], c[1], c[2]);
  const fill = c => doc.setFillColor(c[0], c[1], c[2]);
  const stroke = c => doc.setDrawColor(c[0], c[1], c[2]);
  const links = [];
  const overflow = [];
  let y = 0;
  const page = () => doc.getCurrentPageInfo().pageNumber;
  const check = where => { if (y > BOTTOM) overflow.push(where + " (page " + page() + ", y=" + Math.round(y) + ")"); };

  function heading(num, title) {
    y += 10;
    doc.setFont("times", "bold"); doc.setFontSize(22); setC(GREEN); doc.text(num, M, y);
    doc.setFont("helvetica", "bold"); doc.setFontSize(11.5); setC(NAVY);
    doc.text(title.toUpperCase(), M + 36, y - 1, { charSpace: 1 });
    y += 8; stroke(LINE); doc.setLineWidth(0.7); doc.line(M, y, M + CW, y);
    y += 17;
  }
  function para(text, size, lh) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(size); setC(INK);
    const lines = doc.splitTextToSize(text, CW);
    lines.forEach((ln, i) => {
      const words = ln.trim().split(/\s+/);
      if (i === lines.length - 1 || words.length < 2) doc.text(ln.trim(), M, y);
      else {
        const ww = words.reduce((s, w) => s + doc.getTextWidth(w), 0);
        const gap = (CW - ww) / (words.length - 1); let cx = M;
        words.forEach(w => { doc.text(w, cx, y); cx += doc.getTextWidth(w) + gap; });
      }
      y += lh;
    });
  }
  // "Lead: rest" bullets with a bold lead-in.
  function leadBullets(items, size, lh, color) {
    items.forEach(t => {
      const m = t.match(/^([^:]{2,80}):\s+([\s\S]*)$/);
      const head = m[1] + ":"; const rest = m[2]; const avail = CW - 18;
      doc.setFontSize(size); doc.setFont("helvetica", "bold"); const hw = doc.getTextWidth(head) * 1.015 + size * 0.32;
      doc.setFont("helvetica", "normal");
      const lines = []; let cur = "";
      rest.split(/\s+/).forEach(w => {
        const s = cur ? cur + " " + w : w;
        if (doc.getTextWidth(s) <= (lines.length ? avail : avail - hw)) cur = s; else { lines.push(cur); cur = w; }
      });
      lines.push(cur);
      fill(color); doc.rect(M + 1, y - 6, 4.4, 4.4, "F");
      lines.forEach((ln, i) => {
        let cx = M + 18;
        if (i === 0) { doc.setFont("helvetica", "bold"); setC(NAVY); doc.text(head, cx, y); cx += hw; }
        doc.setFont("helvetica", "normal"); setC(INK); if (ln) doc.text(ln, cx, y);
        y += lh;
      });
      y += 3;
    });
  }
  // Table with wrapped cells. cols: [{label, w, key, bold, color}]. Returns the row boxes.
  function table(cols, rows, size, lh, opts) {
    opts = opts || {};
    const pad = opts.pad || 7;
    doc.setFont("helvetica", "bold"); doc.setFontSize(7.2);
    fill(NAVY); doc.rect(M, y, CW, 20, "F");
    doc.setTextColor(255, 255, 255);
    let cx = M;
    cols.forEach(c => { doc.text(c.label.toUpperCase(), cx + pad + (c.right ? c.w - 2 * pad : 0), y + 13, { charSpace: 0.8, align: c.right ? "right" : "left" }); cx += c.w; });
    y += 20;
    const boxes = [];
    rows.forEach((r, ri) => {
      const cells = cols.map(c => {
        const parts = [].concat(r[c.key] || []);
        return parts.map((p, pi) => {
          const bold = typeof c.bold === "function" ? c.bold(pi) : c.bold;
          doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(c.size || size);
          return { lines: doc.splitTextToSize(p, c.w - 2 * pad), bold, color: typeof c.color === "function" ? c.color(pi) : c.color, size: c.size || size };
        });
      });
      const h = Math.max(...cells.map(cs => cs.reduce((s, p) => s + p.lines.length * lh + 2, 0))) + 2 * pad;
      if (r._shade || ri % 2 === 1) { fill(r._shade ? [238, 243, 250] : SOFT); doc.rect(M, y, CW, h, "F"); }
      let cx = M;
      const rowTop = y;
      cells.forEach((cs, ci) => {
        let cy = y + pad + 8;
        cs.forEach((p, pi) => {
          doc.setFont("helvetica", p.bold ? "bold" : "normal"); doc.setFontSize(p.size); setC(p.color || INK);
          const top = cy - 8;
          p.lines.forEach(ln => {
            doc.text(ln, cx + pad + (cols[ci].right ? cols[ci].w - 2 * pad : 0), cy, { align: cols[ci].right ? "right" : "left" });
            cy += lh;
          });
          if (cols[ci].onPart) cols[ci].onPart(r, pi, { x0: cx + pad - 2, y0: top - 1, x1: cx + cols[ci].w - pad + 2, y1: cy - lh + 4 });
          cy += 2;
        });
        cx += cols[ci].w;
      });
      y += h;
      stroke(LINE); doc.setLineWidth(0.6); doc.line(M, y, M + CW, y);
      boxes.push({ row: r, y0: rowTop, y1: y });
    });
    return boxes;
  }

  /* ---- Page 1 ---- */
  fill(NAVY); doc.rect(0, 0, W, 6, "F");
  const lw = 150; doc.addImage(LOGO, "PNG", (W - lw) / 2, 28, lw, lw * 120 / 720, "cclogo", "FAST");
  y = 28 + lw * 120 / 720 + 14;
  fill(BLUE); doc.rect(W / 2 - 40, y, 40, 2, "F"); fill(GREEN); doc.rect(W / 2, y, 40, 2, "F");
  y += 20;
  doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); setC(GREEN);
  { const t = "INTERNATIONAL & EMERGING MARKETS   |   EXECUTIVE SUMMARY"; const tw = doc.getTextWidth(t) + 1.2 * (t.length - 1); doc.text(t, (W - tw) / 2, y, { charSpace: 1.2 }); }
  y += 27;
  doc.setFont("times", "bold"); doc.setFontSize(28); setC(NAVY); doc.text(S.title, W / 2, y, { align: "center" });
  y += 22;
  if (S.subtitle) {
    doc.setFont("times", "italic"); doc.setFontSize(13); setC(MUTED);
    doc.splitTextToSize(S.subtitle, CW - 60).forEach(ln => { doc.text(ln, W / 2, y, { align: "center" }); y += 17; });
  }
  y += 4;

  heading("01", "Why Cleveland Clinic");
  para(S.why, 10, 14.4); y += 6;
  leadBullets(S.whyPoints, 9.8, 14, BLUE);
  check("01");

  heading("02", "The Finance Advisory Lifecycle");
  para(S.lifecycleIntro, 10, 14.4); y += 8;
  {
    const n = S.stages.length, gap = 6, bw = (CW - gap * (n - 1)) / n, ip = 7, tw = bw - 2 * ip;
    const parts = S.stages.map(st => {
      doc.setFont("helvetica", "italic"); doc.setFontSize(8.4); const q = doc.splitTextToSize(st.question, tw);
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.4); const pl = doc.splitTextToSize(st.plain, tw);
      return { q, pl };
    });
    const bh = 12 + 16 + Math.max(...parts.map(p => p.q.length)) * 10.4 + 6 + Math.max(...parts.map(p => p.pl.length)) * 10.4 + 6;
    const qh = Math.max(...parts.map(p => p.q.length)) * 10.4;
    S.stages.forEach((st, i) => {
      const x = M + i * (bw + gap);
      fill(SOFT); stroke(LINE); doc.setLineWidth(0.7); doc.rect(x, y, bw, bh, "FD");
      fill(i % 2 ? GREEN : BLUE); doc.rect(x, y, bw, 3, "F");
      doc.setFont("times", "bold"); doc.setFontSize(12); setC(i % 2 ? GREEN : BLUE); doc.text(String(i + 1), x + ip, y + 20);
      doc.setFont("helvetica", "bold"); doc.setFontSize(10); setC(NAVY); doc.text(st.stage, x + ip + 12, y + 20);
      let yy = y + 20 + 15;
      doc.setFont("helvetica", "italic"); doc.setFontSize(8.4); setC(MUTED);
      parts[i].q.forEach(l => { doc.text(l, x + ip, yy); yy += 10.4; });
      yy = y + 20 + 15 + qh + 6;
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.4); setC(INK);
      parts[i].pl.forEach(l => { doc.text(l, x + ip, yy); yy += 10.4; });
    });
    y += bh + 10;
    // Premium International band
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    const head = "Premium International:"; doc.setFont("helvetica", "bold"); const hw = doc.getTextWidth(head) * 1.015 + 9 * 0.32;
    doc.setFont("helvetica", "normal");
    const lines = []; let cur = ""; const avail = CW - 2 * 12;
    S.premium.split(/\s+/).forEach(w => { const t = cur ? cur + " " + w : w; if (doc.getTextWidth(t) <= (lines.length ? avail : avail - hw)) cur = t; else { lines.push(cur); cur = w; } });
    lines.push(cur);
    const ph = 14 + lines.length * 12;
    fill([238, 243, 250]); doc.rect(M, y, CW, ph, "F"); fill(NAVY); doc.rect(M, y, 3, ph, "F");
    let yy = y + 15;
    lines.forEach((l, i) => { let cx = M + 12; if (i === 0) { doc.setFont("helvetica", "bold"); setC(NAVY); doc.text(head, cx, yy); cx += hw; } doc.setFont("helvetica", "normal"); setC(INK); doc.text(l, cx, yy); yy += 12; });
    y += ph + 6;
  }
  check("02");

  heading("03", "Terms Used in This Packet");
  {
    const colW = (CW - 24) / 2; const startY = y; let col = 0; let yy = [y, y];
    S.terms.forEach((t, i) => {
      col = i < Math.ceil(S.terms.length / 2) ? 0 : 1;
      const x = M + col * (colW + 24);
      doc.setFontSize(8.8); doc.setFont("helvetica", "bold");
      const head = t[0] + ":"; const hw = doc.getTextWidth(head) * 1.015 + 8.8 * 0.32;
      doc.setFont("helvetica", "normal");
      const lines = []; let cur = "";
      t[1].split(/\s+/).forEach(w => { const s = cur ? cur + " " + w : w; if (doc.getTextWidth(s) <= (lines.length ? colW : colW - hw)) cur = s; else { lines.push(cur); cur = w; } });
      lines.push(cur);
      lines.forEach((ln, li) => {
        let cx = x;
        if (li === 0) { doc.setFont("helvetica", "bold"); setC(NAVY); doc.text(head, cx, yy[col]); cx += hw; }
        doc.setFont("helvetica", "normal"); setC(INK); doc.text(ln, cx, yy[col]); yy[col] += 12;
      });
      yy[col] += 4;
    });
    y = Math.max(...yy);
  }
  check("03 terms");

  /* ---- Page 2 ---- */
  doc.addPage(); y = TOP;
  heading("04", "Offerings in This Packet");
  doc.setFont("helvetica", "italic"); doc.setFontSize(9); setC(MUTED);
  doc.text("Select an offering to go to its profile.", M, y - 4); y += 6;
  const boxes = table([
    { label: "Offering", w: 290, key: "nameDesc", bold: pi => pi === 0, color: pi => (pi === 0 ? NAVY : MUTED) },
    { label: "Stage", w: 86, key: "stage" },
    { label: "Duration", w: 76, key: "duration" },
    { label: "Page", w: CW - 452, key: "page", right: true, bold: true, color: BLUE },
  ], S.offerings.map(o => ({ ...o, nameDesc: [o.name, o.desc], page: String(o.page) })), 8.8, 11, { pad: 6 });
  boxes.forEach(b => links.push({ page: page(), x0: M, y0: b.y0, x1: M + CW, y1: b.y1, id: b.row.id }));
  check("04");

  y += 6;
  heading("05", "How Engagements Work");
  leadBullets(S.how, 9.6, 13.4, GREEN);
  check("05");


  /* ---- Running header and footer ---- */
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    if (i > 1) {
      fill(NAVY); doc.rect(0, 0, W, 6, "F");
      doc.addImage(LOGO, "PNG", M, 30, 110, 110 * 120 / 720, "cclogo", "FAST");
      doc.setFont("helvetica", "normal"); doc.setFontSize(8); setC(MUTED);
      doc.text(S.title + ": Executive Summary", W - M, 44, { align: "right" });
      stroke(LINE); doc.setLineWidth(0.7); doc.line(M, 60, W - M, 60);
    }
    fill(BLUE); doc.rect(M, H - 48, CW / 2, 1.2, "F"); fill(GREEN); doc.rect(M + CW / 2, H - 48, CW / 2, 1.2, "F");
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.8); setC(MUTED);
    doc.text("CLEVELAND CLINIC  |  INTERNATIONAL & EMERGING MARKETS", M, H - 32, { charSpace: 0.6 });
    doc.text(S.dateLine + "   |   Page " + i + " of " + S.totalPages, W - M, H - 32, { align: "right" });
  }
  return { uri: doc.output("datauristring"), links, overflow, pages: n };
}

(async () => {
  const browser = await chromium.launch();
  const p = await browser.newPage();
  await p.setContent(`<!doctype html><html><body><script>${jspdf}</script></body></html>`, { waitUntil: "load" });
  const res = await p.evaluate(([fn, S, LOGO]) => (new Function("return " + fn)())(S, LOGO), [draw.toString(), spec, logo]);
  await browser.close();
  fs.writeFileSync(outPdf, Buffer.from(res.uri.split(",")[1], "base64"));
  delete res.uri;
  process.stdout.write(JSON.stringify(res));
})();
