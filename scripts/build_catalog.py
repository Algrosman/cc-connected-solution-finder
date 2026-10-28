#!/usr/bin/env python3
"""
Build data/products.js for the Cleveland Clinic Connected solution finder
from the IEM Advisory Product Profile PDFs.

Usage:
    python3 scripts/build_catalog.py <brochures_dir> <settings_json> <out_js>

<brochures_dir> must contain Offerings_Index.csv (Area, ID, Product, File, Notes)
and the PDFs it references. <settings_json> holds website-only fields that are not
in the brochures (hospital fit, domain mapping). Run it again whenever a brochure
is added or replaced.
"""
import csv, json, re, subprocess, sys
from pathlib import Path

import pdfplumber

SECTIONS = ["01 CLIENT NEED", "02 CLEVELAND CLINIC VALUE PROPOSITION", "03 KEY DELIVERABLES",
            "04 DELIVERY MODEL", "05 TYPICAL DURATION", "06 RESOURCE REQUIREMENTS",
            "07 EXPECTED OUTCOMES", "08 PRODUCT OWNER"]
KEYS = ["need", "value", "deliverables", "delivery", "duration", "resources", "outcomes", "owner"]
KV_LINE = re.compile(r"^(Format|Location|Offering type|Customizable|Add-on|Learn more[^:]*|Intended audience|Note|Prerequisites?):\s")


def norm(s):
    s = s.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
    return re.sub(r"\s+", "", s)


def pdftotext(pdf, mode):
    return subprocess.run(["pdftotext", mode, str(pdf), "-"], capture_output=True, text=True, check=True).stdout


def bullet_starts(pdf_path):
    """Full text (spaces removed) of every line that begins next to a bullet square.
    The brochures draw bullets as small filled squares, so a wrapped continuation line
    has no square beside it and is joined to the bullet above."""
    starts = set()
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            squares = [r for r in page.rects if r["width"] < 8 and r["height"] < 8]
            for sq in squares:
                cy = (sq["top"] + sq["bottom"]) / 2
                # in two-column lists, stop at the right-hand column's bullets
                limit = min([o["x0"] for o in squares if o["x0"] > page.width * 0.4
                             and o["x0"] > sq["x1"]] or [page.width])
                chars = [c for c in page.chars
                         if c["x0"] >= sq["x1"] and c["x1"] <= limit - 2
                         and c["top"] - 5 <= cy <= c["bottom"] + 5]
                if chars:
                    txt = "".join(c["text"] for c in sorted(chars, key=lambda c: c["x0"]))
                    starts.add(norm(txt))
    return starts


def strip_chrome(lines, title):
    out = []
    for ln in lines:
        s = ln.strip()
        if s.startswith("CLEVELAND CLINIC | INTERNATIONAL & EMERGING MARKETS"):
            continue
        if s == title:
            continue
        out.append(ln.rstrip())
    return out


def paragraphs(lines):
    paras, cur = [], []
    for ln in lines:
        s = ln.strip()
        if not s:
            continue
        if cur and KV_LINE.match(s):
            paras.append(" ".join(cur)); cur = []
        cur.append(s)
        if re.search(r'[.?!"\]]$', s):
            paras.append(" ".join(cur)); cur = []
    if cur:
        paras.append(" ".join(cur))
    return [re.sub(r"\s+", " ", p).strip() for p in paras]


def bullets(lines, starts):
    items = []
    for ln in lines:
        s = ln.strip()
        if not s:
            continue
        n = norm(s)
        if not items or n in starts or any(len(x) >= 6 and n.startswith(x) for x in starts):
            items.append(s)
        else:
            items[-1] += " " + s
    return [re.sub(r"\s+", " ", i).strip() for i in items]


def split_title(head, title):
    joined = " ".join(h.strip() for h in head if h.strip())
    target = title.replace(" ", "")
    if joined.replace(" ", "").startswith(target):
        n = i = 0
        while n < len(target) and i < len(joined):
            if joined[i] != " ":
                n += 1
            i += 1
        return joined[i:].strip()
    return joined


def resources(pdf, title, starts):
    lay = pdftotext(pdf, "-layout")
    if "06 RESOURCE REQUIREMENTS" not in lay:
        return [], []
    part = lay.split("06 RESOURCE REQUIREMENTS", 1)[1].split("07 EXPECTED OUTCOMES", 1)[0]
    rl = [l for l in part.split("\n") if l.strip() and "CLEVELAND CLINIC |" not in l and l.strip() != title]
    has_cc = any("CLEVELAND CLINIC TEAM" in l for l in rl)
    split_at = next((l.index("CLIENT TEAM") for l in rl if "CLIENT TEAM" in l), None)
    rl = [l for l in rl if "CLEVELAND CLINIC TEAM" not in l and "CLIENT TEAM AND INPUTS" not in l]
    if has_cc and split_at:
        left = [l[:split_at] for l in rl]
        right = [l[split_at:] for l in rl]
        return bullets(left, starts), bullets(right, starts)
    return [], bullets(rl, starts)


def parse(pdf, title):
    starts = bullet_starts(pdf)
    raw = pdftotext(pdf, "-raw")
    head = raw.split("CATEGORY", 1)[0].split("\n")[1:]
    subtitle = split_title(head, title)
    hdr = raw.split("CATEGORY", 1)[1].split("01 CLIENT NEED", 1)[0]

    def cell(a, b):
        part = hdr.split(a, 1)[1] if a else hdr
        part = part.split(b, 1)[0] if b else part
        return " ".join(x.strip() for x in part.split("\n") if x.strip())

    body = "01 CLIENT NEED\n" + "\n".join(strip_chrome(raw.split("01 CLIENT NEED", 1)[1].replace("\f", "\n").split("\n"), title))
    secs = {}
    for i, h in enumerate(SECTIONS):
        if h not in body:
            secs[KEYS[i]] = []
            continue
        part = body.split(h, 1)[1]
        for h2 in SECTIONS[i + 1:]:
            if h2 in part:
                part = part.split(h2, 1)[0]
                break
        secs[KEYS[i]] = [l for l in part.split("\n") if l.strip()]

    res_cc, res_client = resources(pdf, title, starts)
    deliv = secs["delivery"]
    dur = secs["duration"]
    return {
        "subtitle": subtitle,
        "category": cell(None, "TYPICAL DURATION"),
        "durationShort": cell("TYPICAL DURATION", "DELIVERY MODEL"),
        "deliveryShort": cell("DELIVERY MODEL", "PRODUCT OWNER"),
        "need": paragraphs(secs["need"]),
        "value": paragraphs(secs["value"]),
        "deliverables": bullets(secs["deliverables"], starts),
        "deliveryModel": deliv[0].strip() if deliv else "",
        "deliveryDetail": paragraphs(deliv[1:]),
        "duration": dur[0].strip() if dur else "",
        "durationDetail": [" ".join(paragraphs(dur[1:]))] if dur[1:] else [],
        "resourcesCC": res_cc,
        "resourcesClient": res_client,
        "outcomes": bullets(secs["outcomes"], starts),
        "owner": [l.strip() for l in secs["owner"]],
    }


ORG_WORDS = re.compile(r"Clinic|Center|Institute|Team|Digital|Education|Markets|Services|Advisory|Connected|"
                       r"Abu Dhabi|Leadership|Learning|Security|Architecture|Informatics|Experience|Task Force|Finance")


def delivered_by(owner_lines):
    """Public-facing 'Delivered by' lines: keep teams and departments, drop individual
    names, job titles and the generic 'program hosts' line."""
    keep = []
    for ln in owner_lines:
        if ln.lower() == "cleveland clinic program hosts":
            continue
        if re.match(r"^(Senior |Executive |Associate )?(Vice President|Director|Manager|Lead)\b", ln):
            continue
        if not ORG_WORDS.search(ln) and re.match(r"^[A-Z][a-z]+( [A-Z][a-z.]+){1,2}(,.*)?$", ln):
            continue
        keep.append(ln)
    return keep


def main():
    root, settings_path, out = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
    settings = json.loads(settings_path.read_text(encoding="utf-8"))
    rows = list(csv.DictReader(open(root / "Offerings_Index.csv", encoding="utf-8-sig")))
    catalog, missing = [], []
    for row in rows:
        pid = row["ID"].strip()
        conf = settings["products"].get(pid)
        if conf is None:
            missing.append(pid)
            conf = {"fit": ["new", "existing"]}
        domain = conf.get("domain") or settings["areaToDomain"].get(row["Area"].strip(), "other")
        item = {"id": pid, "domain": domain, "title": row["Product"].strip(), "fit": conf["fit"],
                "pdf": "brochures/" + row["File"].strip()}
        item.update(parse(root / row["File"].strip(), row["Product"].strip()))
        item["deliveredBy"] = delivered_by(item["owner"]) or item["owner"][-1:]
        catalog.append(item)
    js = ("/* Generated by scripts/build_catalog.py from the IEM Advisory Product Profile PDFs.\n"
          "   Edit the brochures or data/catalog-settings.json and re-run the script rather than editing by hand. */\n"
          "window.CC_CATALOG = " + json.dumps(catalog, indent=1, ensure_ascii=False) + ";\n")
    out.write_text(js, encoding="utf-8")
    print(f"{len(catalog)} products written to {out}")
    if missing:
        print("No settings entry (defaulted to fit new+existing):", ", ".join(missing))


if __name__ == "__main__":
    main()
