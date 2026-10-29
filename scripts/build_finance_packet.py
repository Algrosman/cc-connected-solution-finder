#!/usr/bin/env python3
"""
Build the Finance packet: a two-page executive summary followed by every Finance profile,
with a linked table of contents and PDF bookmarks.

Usage (after regenerating the brochures):
    python3 scripts/build_finance_packet.py <builder index.html> brochures

Writes brochures/1_Finance/00_Finance_Advisory_Offerings_Packet.pdf.
Needs: pip install pymupdf; Node.js with jspdf@2.5.1 and playwright (same as render_brochures.js).
"""
import datetime, json, os, re, subprocess, sys, tempfile
from pathlib import Path

import pymupdf

builder, root = sys.argv[1], Path(sys.argv[2])
here = Path(__file__).resolve().parent
items = [it for it in json.loads((root / "brochure-content.json").read_text(encoding="utf-8")) if it["area"].startswith("Finance")]
OUT = root / "1_Finance" / "00_Finance_Advisory_Offerings_Packet.pdf"

STAGE = {  # column text for the contents table
    "FIN-01": "Plan", "FIN-02": "Plan", "FIN-03": "Measure and Optimize", "FIN-04": "Measure",
    "FIN-05": "Manage", "FIN-06": "Transform", "FIN-07": "Premium International",
}
SUMMARY_PAGES = 2

pages, start = {}, SUMMARY_PAGES + 1
for it in items:
    n = pymupdf.open(root / it["file"]).page_count
    pages[it["id"]] = (start, n)
    start += n
total = start - 1


def desc(tagline):
    t = re.sub(r"^(A senior-led|An) advisory offering that ", "", tagline)
    t = t[0].upper() + t[1:]
    return ("Senior-led. " + t) if tagline.startswith("A senior-led") else t


name = {it["id"]: it["name"] for it in items}
spec = {
    "title": "Finance Advisory Offerings",
    "subtitle": "An executive summary of the Finance Advisory offerings, with a one-page profile of each.",
    "dateLine": "Prepared " + datetime.date.today().strftime("%B %-d, %Y"),
    "totalPages": total,
    "why": "Cleveland Clinic's Finance Advisory team helps hospitals, health systems, governments and investors "
           "make and manage major financial decisions across the life of an organization. The team is part of "
           "Cleveland Clinic, an operating health system with 23 hospitals, 300 outpatient locations and about "
           "83,000 caregivers, with locations in Northeast Ohio, Florida, Las Vegas, Toronto, London and Abu Dhabi "
           "(figures as of December 31, 2025). What clients get here that they would not get elsewhere:",
    "whyPoints": [
        "An operator's perspective: recommendations are grounded in how Cleveland Clinic itself plans, funds, "
        "staffs and reports on a large, multi-entity health system",
        "Experience entering new markets: Cleveland Clinic has grown from Northeast Ohio into Florida, Nevada, "
        "Canada, the United Kingdom and the United Arab Emirates, and brings that experience to growth, "
        "partnership and development decisions",
        "Work the client can keep running: models, frameworks and processes are built with the client's team, "
        "documented and handed over with training, so they can be maintained after the engagement",
    ],
    "lifecycleIntro": "The offerings are organized by the five stages of the Cleveland Clinic Healthcare Financial "
                      "Advisory Lifecycle, which follow the financial questions leaders ask as an organization plans, "
                      "grows and matures. Each profile names its stage.",
    "stages": [
        {"stage": "Plan", "question": "\"Can we do this?\"",
         "plain": "Deciding whether and how to invest in growth, new facilities or partnerships"},
        {"stage": "Measure", "question": "\"How are we performing?\"",
         "plain": "Understanding current financial performance and what drives it"},
        {"stage": "Optimize", "question": "\"How do we become best-in-class?\"",
         "plain": "Improving margin and productivity toward best-in-class results"},
        {"stage": "Manage", "question": "\"How do we improve planning and decision-making?\"",
         "plain": "Planning, budgeting and forecasting with confidence"},
        {"stage": "Transform", "question": "\"Do we have the right finance organization?\"",
         "plain": "Building a finance function that fits the enterprise it supports"},
    ],
    "premium": "senior-led engagements that draw on every stage for greenfield hospitals, multi-site networks, "
               "national programs and complex partnerships.",
    "offerings": [{"id": it["id"], "name": it["name"], "desc": desc(it["tagline"]), "stage": STAGE[it["id"]],
                   "page": pages[it["id"]][0]} for it in items],
    "how": [
        "Who delivers: every offering is delivered by Cleveland Clinic's Finance Advisory team, offered through "
        "Cleveland Clinic International & Emerging Markets, working alongside a named lead on the client's side",
        "Scope: most offerings are modular, so clients can start with one module and add others later; "
        "deliverables are confirmed at scoping",
        "Phases: each profile sets out the phases of the work; timing is agreed at scoping, around the client's "
        "decisions and data",
        "Team and time: each profile lists the client team needed and the assumptions the plan depends on; the "
        "Cleveland Clinic team and time commitments are confirmed at scoping",
    ],
    "terms": [
        ["Pro forma", "projected financial statements for a new facility, program or arrangement"],
        ["Driver-based model", "a model in which volumes, staffing and prices drive revenue and cost, so changing "
                               "one assumption updates the whole plan"],
        ["Operating model", "how the finance function is organized, governed and staffed"],
        ["Chart of accounts", "the list of account codes used to record and report financial results"],
    ],
}
assert "—" not in json.dumps(spec, ensure_ascii=False) and "–" not in json.dumps(spec, ensure_ascii=False)

with tempfile.TemporaryDirectory() as tmp:
    spec_path, summary = Path(tmp) / "spec.json", Path(tmp) / "summary.pdf"
    spec_path.write_text(json.dumps(spec), encoding="utf-8")
    res = json.loads(subprocess.run(["node", str(here / "finance_packet_summary.js"), builder, str(spec_path), str(summary)],
                                    check=True, capture_output=True, text=True).stdout)
    if os.environ.get("PACKET_DEBUG"):
        Path(os.environ["PACKET_DEBUG"]).write_bytes(summary.read_bytes())
    if res["overflow"] or res["pages"] != SUMMARY_PAGES:
        sys.exit(f"summary does not fit on {SUMMARY_PAGES} pages: {res['overflow']} pages={res['pages']}")

    packet = pymupdf.open(summary)
    for it in items:
        packet.insert_pdf(pymupdf.open(root / it["file"]))  # keeps each profile's own links
    for ln in res["links"]:
        target = pages[ln["id"]][0] - 1
        packet[ln["page"] - 1].insert_link({"kind": pymupdf.LINK_GOTO, "page": target,
                                            "from": pymupdf.Rect(ln["x0"], ln["y0"], ln["x1"], ln["y1"]),
                                            "to": pymupdf.Point(0, 0)})
    toc = [[1, "Executive summary", 1], [2, "What Cleveland Clinic brings", 1], [2, "The Finance Advisory Lifecycle", 1],
           [2, "Terms used in this packet", 1], [2, "Offerings in this packet", 2], [2, "How engagements work", 2]]
    toc += [[1, f"{it['name']}", pages[it["id"]][0]] for it in items]
    packet.set_toc(toc)
    packet.set_metadata({"title": "Cleveland Clinic Finance Advisory Offerings", "author": "Cleveland Clinic",
                         "subject": "Executive summary and Finance Advisory offering profiles"})
    packet.save(OUT, garbage=3, deflate=True)
print(f"wrote {OUT} ({total} pages, {len(res['links'])} links)")
