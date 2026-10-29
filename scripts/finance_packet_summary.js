// Draws the two-page executive summary at the front of the Finance packet, in the same style as
// the one-page profiles (website fonts and colors). Run by scripts/build_finance_packet.py, which supplies the spec and merges the PDFs.
// Usage: node scripts/finance_packet_summary.js <builder index.html> <spec.json> <out.pdf>
// Prints JSON describing the clickable areas, which the Python script turns into links.
const fs = require("fs");
const { chromium } = require("playwright");

const [builderHtml, specPath, outPdf] = process.argv.slice(2);
const src = fs.readFileSync(builderHtml, "utf8");
const logo = src.match(/<div class="topbar"><div class="in">\s*<img src="(data:image\/png;base64,[^"]+)"/)[1];
const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
const jspdf = fs.readFileSync(require.resolve("jspdf/dist/jspdf.umd.min.js"), "utf8");
const path = require("path");
const FONTS = {};
for (const f of ["Roboto-Regular.ttf", "Roboto-Medium.ttf", "SourceSerif4-SemiBold.ttf"]) FONTS[f] = fs.readFileSync(path.join(__dirname, "fonts", f)).toString("base64");

function draw(S, LOGO, FONTS) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  [["Roboto-Regular.ttf", "Roboto", "normal"], ["Roboto-Medium.ttf", "Roboto", "medium"],
   ["SourceSerif4-SemiBold.ttf", "SourceSerif", "semibold"]].forEach(([f, fam, st]) => { doc.addFileToVFS(f, FONTS[f]); doc.addFont(f, fam, st); });
  const SANS = st => doc.setFont("Roboto", st || "normal");
  const SERIF = () => doc.setFont("SourceSerif", "semibold");
  const W = 612, H = 792, M = 50, CW = W - 2 * M, BOTTOM = H - 56;
  // The website's palette, as on the one-page profiles
  const NAVY = [27, 71, 123], BLUE = [0, 123, 194], GREEN = [27, 118, 56], INK = [51, 51, 51],
    SLATE = [102, 102, 102], LINE = [224, 228, 232], SKY = [237, 246, 252];
  const setC = c => doc.setTextColor(c[0], c[1], c[2]);
  const fill = c => doc.setFillColor(c[0], c[1], c[2]);
  const stroke = c => doc.setDrawColor(c[0], c[1], c[2]);
  const SIZE = 10.2, LH = 13.6;
  const links = [], overflow = [];
  let y = 0, pageTop = 0;
  const page = () => doc.getCurrentPageInfo().pageNumber;
  const check = where => { if (y > BOTTOM) overflow.push(where + " (page " + page() + ", y=" + Math.round(y) + ")"); };
  function wrap(text, width, first, size, st) {
    SANS(st); doc.setFontSize(size);
    const lines = []; let cur = "";
    text.split(/\s+/).filter(Boolean).forEach(w => {
      const t = cur ? cur + " " + w : w;
      if (doc.getTextWidth(t) <= (lines.length ? width : width - first)) cur = t; else { lines.push(cur); cur = w; }
    });
    lines.push(cur); return lines;
  }
  function heading(title) {
    if (y > pageTop + 1) y += 10;
    SERIF(); doc.setFontSize(14); setC(NAVY); doc.text(title, M, y);
    y += 5.5; stroke(LINE); doc.setLineWidth(0.6); doc.line(M, y, M + CW, y);
    y += 13.5;
  }
  function para(text) {
    const lines = wrap(text, CW, 0, SIZE);
    lines.forEach((ln, i) => {
      SANS(); doc.setFontSize(SIZE); setC(INK);
      const words = ln.split(" ");
      if (i === lines.length - 1 || words.length < 2) doc.text(ln, M, y);
      else {
        const ww = words.reduce((t, w) => t + doc.getTextWidth(w), 0), gap = (CW - ww) / (words.length - 1);
        let cx = M; words.forEach(w => { doc.text(w, cx, y); cx += doc.getTextWidth(w) + gap; });
      }
      y += LH;
    });
  }
  // "Lead: rest" bullets with a medium-weight lead-in
  function leadBullets(items, color, x, width) {
    x = x || M; width = width || CW;
    const ind = SIZE * 1.3;
    items.forEach(t => {
      const m = t.match(/^([^:]{2,80}):\s+([\s\S]*)$/), head = m[1] + ":";
      SANS("medium"); doc.setFontSize(SIZE); const hw = doc.getTextWidth(head) + SIZE * 0.27;
      const lines = wrap(m[2], width - ind, hw, SIZE);
      fill(color); doc.rect(x + 0.6, y - SIZE * 0.6, SIZE * 0.38, SIZE * 0.38, "F");
      lines.forEach((ln, i) => {
        let cx = x + ind;
        if (i === 0) { SANS("medium"); setC(NAVY); doc.text(head, cx, y); cx += hw; }
        SANS(); setC(INK); if (ln) doc.text(ln, cx, y);
        y += LH;
      });
      y += SIZE * 0.3;
    });
  }
  function header(label) {
    doc.addImage(LOGO, "PNG", M, 28, 122, 122 * 120 / 720, "cclogo", "FAST");
    SANS("medium"); doc.setFontSize(9); setC(NAVY); doc.text("International & Emerging Markets", W - M, 36, { align: "right" });
    SANS(); setC(SLATE); doc.text(label, W - M, 47.5, { align: "right" });
    stroke(LINE); doc.setLineWidth(0.6); doc.line(M, 58, W - M, 58);
  }

  /* ---- Page 1 ---- */
  header("Executive summary");
  y = 82;
  SANS("medium"); doc.setFontSize(10.5); setC(BLUE); doc.text("Finance", M, y);
  y += 29; SERIF(); doc.setFontSize(26); setC(NAVY); doc.text(S.title, M, y);
  if (S.subtitle) { y += 21; SANS(); doc.setFontSize(12); setC(SLATE); doc.splitTextToSize(S.subtitle, CW).forEach((ln, i) => { if (i) y += 16; doc.text(ln, M, y); }); }
  y += 34; pageTop = y;

  heading("What Cleveland Clinic brings");
  para(S.why); y += 5;
  leadBullets(S.whyPoints, BLUE);
  check("why");

  heading("The Finance Advisory Lifecycle");
  para(S.lifecycleIntro); y += 6;
  {
    const n = S.stages.length, gap = 6, bw = (CW - gap * (n - 1)) / n, ip = 8, tw = bw - 2 * ip, fs = 8.8, fl = 11.2;
    const parts = S.stages.map(st => ({ q: wrap(st.question, tw, 0, fs), pl: wrap(st.plain, tw, 0, fs) }));
    const qh = Math.max(...parts.map(p => p.q.length)) * fl;
    const bh = 22 + 14 + qh + 5 + Math.max(...parts.map(p => p.pl.length)) * fl + 4;
    S.stages.forEach((st, i) => {
      const x = M + i * (bw + gap);
      fill(SKY); doc.rect(x, y, bw, bh, "F"); fill(NAVY); doc.rect(x, y, bw, 2, "F");
      SANS("medium"); doc.setFontSize(10.5); setC(BLUE); doc.text(String(i + 1), x + ip, y + 20);
      setC(NAVY); doc.text(st.stage, x + ip + 11, y + 20);
      let yy = y + 20 + 15;
      SANS(); doc.setFontSize(fs); setC(SLATE); parts[i].q.forEach(l => { doc.text(l, x + ip, yy); yy += fl; });
      yy = y + 20 + 15 + qh + 5;
      setC(INK); parts[i].pl.forEach(l => { doc.text(l, x + ip, yy); yy += fl; });
    });
    y += bh + 10;
    // Premium International panel
    const head = "Premium International:"; SANS("medium"); doc.setFontSize(SIZE); const hw = doc.getTextWidth(head) + SIZE * 0.27;
    const lines = wrap(S.premium, CW - 30, hw, SIZE), ph = 22 + (lines.length - 1) * LH;
    fill(SKY); doc.rect(M, y, CW, ph, "F"); fill(BLUE); doc.rect(M, y, 3, ph, "F");
    let yy = y + 15;
    lines.forEach((l, i) => { let cx = M + 16; if (i === 0) { SANS("medium"); setC(NAVY); doc.text(head, cx, yy); cx += hw; } SANS(); setC(INK); doc.text(l, cx, yy); yy += LH; });
    y += ph + 8;
  }
  check("lifecycle");

  heading("Terms used in this packet");
  leadBullets(S.terms.map(t => t[0] + ": " + t[1]), BLUE);
  check("terms");

  /* ---- Page 2 ---- */
  doc.addPage(); header(S.title + ": executive summary");
  y = 88; pageTop = y;
  heading("Offerings in this packet");
  SANS(); doc.setFontSize(9.4); setC(SLATE); doc.text("Select an offering to go to its profile.", M, y); y += 12;
  {
    const cols = [{ label: "Offering", w: 300 }, { label: "Stage", w: 86 }, { label: "Duration", w: 86 }, { label: "Page", w: CW - 472, right: true }];
    const pad = 7;
    fill(NAVY); doc.rect(M, y, CW, 2, "F");
    SANS(); doc.setFontSize(9); setC(SLATE);
    let cx = M; cols.forEach(c => { doc.text(c.label, c.right ? cx + c.w - pad : cx + (cx === M ? 0 : pad), y + 16, { align: c.right ? "right" : "left" }); cx += c.w; });
    y += 23; stroke(LINE); doc.setLineWidth(0.6); doc.line(M, y, M + CW, y);
    S.offerings.forEach(o => {
      const nm = wrap(o.name, cols[0].w - pad, 0, 9.8, "medium"), ds = wrap(o.desc, cols[0].w - pad, 0, 9.2);
      const h = pad + 4 + nm.length * 12.4 + 2 + ds.length * 11.6 + pad;
      const top = y; let yy = y + pad + 9;
      SANS("medium"); doc.setFontSize(9.8); setC(NAVY); nm.forEach(l => { doc.text(l, M, yy); yy += 12.4; });
      yy += 2; SANS(); doc.setFontSize(9.2); setC(SLATE); ds.forEach(l => { doc.text(l, M, yy); yy += 11.6; });
      SANS(); doc.setFontSize(9.4); setC(INK);
      let ty = y + pad + 9;
      wrap(o.stage, cols[1].w - 2 * pad, 0, 9.4).forEach((l, i) => { SANS(); doc.setFontSize(9.4); setC(INK); doc.text(l, M + cols[0].w + pad, ty + i * 12); });
      wrap(o.duration, cols[2].w - 2 * pad, 0, 9.4).forEach((l, i) => { SANS(); doc.setFontSize(9.4); setC(INK); doc.text(l, M + cols[0].w + cols[1].w + pad, ty + i * 12); });
      SANS("medium"); doc.setFontSize(9.8); setC(BLUE); doc.text(String(o.page), M + CW - pad, ty, { align: "right" });
      y += h; stroke(LINE); doc.setLineWidth(0.6); doc.line(M, y, M + CW, y);
      links.push({ page: page(), x0: M, y0: top, x1: M + CW, y1: y, id: o.id });
    });
    y += 14;
  }
  check("offerings");

  heading("How engagements work");
  leadBullets(S.how, GREEN);
  check("how");


  /* ---- Footer ---- */
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    stroke(LINE); doc.setLineWidth(0.6); doc.line(M, H - 38, W - M, H - 38);
    SANS(); doc.setFontSize(8.5); setC(SLATE);
    doc.text("Cleveland Clinic  |  International & Emerging Markets", M, H - 25);
    doc.text(S.dateLine + "  |  Page " + i + " of " + S.totalPages, W - M, H - 25, { align: "right" });
  }
  return { uri: doc.output("datauristring"), links, overflow, pages: n };
}

(async () => {
  const browser = await chromium.launch();
  const p = await browser.newPage();
  await p.setContent(`<!doctype html><html><body><script>${jspdf}</script></body></html>`, { waitUntil: "load" });
  const res = await p.evaluate(([fn, S, LOGO, F]) => (new Function("return " + fn)())(S, LOGO, F), [draw.toString(), spec, logo, FONTS]);
  await browser.close();
  fs.writeFileSync(outPdf, Buffer.from(res.uri.split(",")[1], "base64"));
  delete res.uri;
  process.stdout.write(JSON.stringify(res));
})();
