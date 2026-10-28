"""Re-add the clickable link the EDU-01 brochure had (the builder draws plain text)."""
import sys, pymupdf
from pathlib import Path
LINKS = {"EDU-01": ("Consulting Services & Observation Programs",
                    "https://my.clevelandclinic.org/departments/nursing/grow-here/consulting-and-observation#nurse-scholars-tab")}
root = Path(sys.argv[1])
for pid, (text, url) in LINKS.items():
    f = next(root.glob(f"*/{pid}_*.pdf"))
    doc = pymupdf.open(f); n = 0
    for page in doc:
        for r in page.search_for(text):
            page.insert_link({"kind": pymupdf.LINK_URI, "from": r, "uri": url}); n += 1
    tmp = f.with_suffix(".tmp.pdf"); doc.save(tmp, garbage=3, deflate=True); doc.close(); tmp.replace(f)
    print(pid, "links added:", n)
