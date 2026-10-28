# Cleveland Clinic Connected: advisory solution finder

A static web page for the Cleveland Clinic Connected advisory portfolio. Visitors answer a few questions (existing or new hospital, advisory area, then two or three questions about their needs), get one recommended solution with two alternatives, add solutions to a cart from the finder or from the full catalog, and send the cart as a proposal request.

It is plain HTML, CSS and JavaScript with no build step, so it runs on any static host (GitHub Pages, Vercel, Netlify, SharePoint or an internal web server).

## What's in the folder

| Path | What it is |
| --- | --- |
| `index.html` | The page |
| `assets/styles.css` | All styling (palette taken from the Cleveland Clinic logo and the product profile brochures) |
| `assets/app.js` | Finder flow, portfolio map, catalog, detail panel, cart and proposal request |
| `assets/engine.js` | Scoring logic for the finder (no page code, so it can be tested on its own) |
| `assets/config.js` | Settings: where proposal requests go, contact email, prototype banner |
| `data/products.js` | The 28 solutions, generated from the brochure PDFs (do not edit by hand) |
| `data/catalog-settings.json` | Website-only fields per solution: which hospitals it is offered to (`new`, `existing` or both) |
| `data/finder.js` | The questions, options and scoring weights |
| `brochures/` | The product profile PDFs and `Offerings_Index.csv` |
| `scripts/build_catalog.py` | Rebuilds `data/products.js` from the PDFs |
| `tests/check_finder.js` | Walks every finder path and confirms every solution can be recommended |

## Preview locally

```
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Updating the brochures

1. Put the new or replaced PDF in the right `brochures/` subfolder and add or update its row in `brochures/Offerings_Index.csv` (Area, ID, Product, File, Notes).
2. For a new ID, add an entry to `data/catalog-settings.json` saying whether it is offered to new hospitals, existing hospitals or both.
3. Rebuild the catalog:
   ```
   pip install pdfplumber
   python3 scripts/build_catalog.py brochures data/catalog-settings.json data/products.js
   ```
   The script reads the brochure layout produced by the Advisory Product Builder (sections 01 to 08). It needs `pdftotext` from poppler-utils.
4. For a new solution, add its ID to the `scores` of the finder options that should lead to it in `data/finder.js`. It appears in the catalog either way.
5. Run `node tests/check_finder.js` and confirm the last lines show every solution as reachable and `fit violations: 0`.

Bracketed placeholders still in a brochure, such as `[X]` or `[confirm scope]`, are highlighted in yellow on the page so reviewers can spot them.

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
