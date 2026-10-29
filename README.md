# Cleveland Clinic Connected: advisory solution finder

A static web page for the Cleveland Clinic Connected advisory portfolio. Visitors answer a few questions (existing or new hospital, advisory area, then one to three questions about their needs), get one recommended solution with two alternatives, add solutions to a cart from the finder or from the full catalog, and send the cart as a proposal request.

It is plain HTML, CSS and JavaScript with no build step, so it runs on any static host (GitHub Pages, Vercel, Netlify, SharePoint or an internal web server).

## What's in the folder

| Path | What it is |
| --- | --- |
| `index.html` | The page |
| `assets/styles.css` | All styling (palette taken from the Cleveland Clinic logo and the product profile brochures) |
| `assets/app.js` | Finder flow, portfolio map, catalog, detail panel, cart and proposal request |
| `assets/engine.js` | Scoring logic for the finder (no page code, so it can be tested on its own) |
| `assets/config.js` | Settings: where proposal requests go, contact email, prototype banner |
| `data/products.js` | The 28 solutions, generated from the brochure source (do not edit by hand) |
| `data/catalog-settings.json` | Website-only fields per solution: which hospitals it is offered to (`new`, `existing` or both) |
| `data/finder.js` | The questions, options and scoring weights |
| `brochures/` | The offering profile PDFs, the Finance packet (`1_Finance/00_Finance_Advisory_Offerings_Packet.pdf`) and `Offerings_Index.csv` |
| `brochures/brochure-content.json` | Source text for every brochure (the builder's input fields, plus the optional fields below) |
| `scripts/render_onepagers.js` | Generates the one-page brochure PDFs from the brochure source: a single column at 10.4 pt in the website's fonts (Source Serif 4 and Roboto, in `scripts/fonts`) and colors, with the builder's logo |
| `scripts/render_brochures.js` | The earlier multi-page renderer, which runs the builder's own PDF code (kept for reference) |
| `data/packages.js` and `brochures/package-content.json` | The All-in-One New Hospital Package: the offerings it bundles (website) and its one-page profile (PDF) |
| `scripts/add_links.py` | Re-adds clickable links the builder cannot draw |
| `scripts/build_finance_packet.py` | Builds the Finance packet: a two-page executive summary (drawn by `scripts/finance_packet_summary.js` in the same style as the profiles) followed by the seven one-page Finance profiles, with a linked contents table and bookmarks |
| `scripts/build_catalog.py` | Rebuilds `data/products.js` from the brochure source (or a PDF when there is no source entry) |
| `tests/check_finder.js` | Walks every finder path and confirms every solution can be recommended |

## Preview locally

```
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Updating the brochures

The brochure text lives in `brochures/brochure-content.json`, one entry per solution with the same fields as the Advisory Product Builder form (name, tagline, category, need, value, deliverables, delivery modes and detail, duration and notes, resources, outcomes), plus `questions`: the three client questions the offering answers. The PDFs and the website are both generated from it, so they always say the same thing.

Each one-page profile reads straight down: the domain (Safety, Quality, and Patient Experience is spelled out as "Safety, Quality, and Patient Experience (SQPE)"), title and tagline; a band with the category, typical duration and delivery model; then Client need, Questions we help you answer, What you receive, How it works and Expected outcomes. The value statement, client team and assumptions appear on the website only. Text is never italic or all capitals, and each "What you receive" bullet should fit on one line.

To change a brochure:

1. Edit its entry in `brochures/brochure-content.json`. Paragraphs are separated by `\n`. The brochures do not show a product owner, and no individual people's names should appear anywhere in the text. Optional fields (used by the Finance profiles):
   - `stageNote`: plain-language anchor shown in brackets under the category in the blue band
   - `deliverablesIntro`: a paragraph above the deliverables saying what is core and what is modular
   - `leadBold`: `true` when each deliverable is written as "Name: what it is", so the name prints in bold
   - `phases`: `[{"name", "weeks", "detail"}]`, listed under Typical Duration; `durationNotes` then explains what moves an engagement within its range
   - `resNote`: what the Cleveland Clinic team percentages mean
   - `assumptions`: engagement assumptions, listed separately from the client team (the client panel is then labelled "Client team" rather than "Client team and inputs")
2. Regenerate the one-page PDFs (needs Node.js, `npm install jspdf@2.5.1 playwright`, and a copy of the builder repo):
   ```
   node scripts/render_onepagers.js ../iem-advisory-product-builder/index.html brochures/brochure-content.json brochures
   node scripts/render_onepagers.js ../iem-advisory-product-builder/index.html brochures/package-content.json brochures
   python3 scripts/add_links.py brochures
   ```
   Add solution IDs at the end of the first command to regenerate only those brochures. Every brochure must fit on one page at 10.4 pt; the script names any that do not (set `ONEPAGE_FORCE=1` to write them anyway for a look). When the full profile is too long for one page, or a deliverable runs past one line, add an `onePage` object to the entry with shorter versions of any fields (for example `need`, `deliverables` or `outcomes`): the PDF uses those, and the website keeps the full text. After changing a Finance profile, rebuild the packet:
   ```
   python3 scripts/build_finance_packet.py ../iem-advisory-product-builder/index.html brochures
   ```
3. Rebuild the website data:
   ```
   pip install pdfplumber
   python3 scripts/build_catalog.py brochures data/catalog-settings.json data/products.js
   ```
4. Run `node tests/check_finder.js` and confirm every solution is reachable and `fit violations: 0`.

To add a new solution, add its row to `brochures/Offerings_Index.csv`, its hospital fit to `data/catalog-settings.json`, and either an entry in `brochure-content.json` or just the builder's PDF (the catalog script reads the PDF when there is no entry). Then add its ID to the `scores` of the finder options in `data/finder.js` that should lead to it.

`render_brochures.js` patches the builder's PDF code at render time. It fixes two bugs (resource panels that did not fit at the bottom of a page were left out entirely, the cause of several empty "Resource Requirements" sections, and the "Resource Requirements" heading could be stranded at the bottom of a page), says "offering" rather than "product" in the header, removes the product owner (the band cell and section 08), and draws the optional fields above. The builder itself should get the same changes.

Bracketed placeholders still in a brochure, such as `[X]` or `[confirm scope]`, are highlighted in yellow on the website so reviewers can spot them.

## Proposal requests

By default, "Send request" opens the visitor's email app with the request filled in and addressed to `inquiryEmail` in `assets/config.js`, and offers a printable summary.

To receive requests directly instead, set `inquiryEndpoint` to a URL that accepts a JSON POST, for example a Power Automate flow with the "When an HTTP request is received" trigger that emails the team or posts to Teams. The payload looks like this:

```json
{
  "reference": "CCC-261028-7KQ2",
  "submittedAt": "2026-10-28T17:02:11.000Z",
  "contact": { "name": "", "title": "", "organization": "", "country": "", "email": "", "phone": "" },
  "hospitalStatus": "existing",
  "timing": "In 3 to 6 months",
  "notes": "",
  "solutions": [{ "id": "FIN-03", "title": "Financial Performance Improvement & Profitability", "area": "Finance" }],
  "finderAnswers": [{ "question": "Hospital", "answer": "Operating an existing hospital" }]
}
```

## Before going live

- Set `showPrototypeNotice` to `false` in `assets/config.js`.
- Remove `<meta name="robots" content="noindex, nofollow">` from `index.html`.
- Confirm the hospital fit for each solution in `data/catalog-settings.json` with the product owners.
- Remove internal notes from `brochures/Offerings_Index.csv` if the repository or site is public.
