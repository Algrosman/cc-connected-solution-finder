# Cleveland Clinic Connected: public website

The public, external-facing Cleveland Clinic Connected advisory website. It explains the program at a high level: Cleveland Clinic's advisory expertise in four domains (Finance; Safety, Quality, and Patient Experience (SQPE); Digital Tools & Analytics; Education), programs for new hospitals (the All-in-One New Hospital Package) and for existing hospitals, highlights of work with member hospitals, membership, the member network, FAQs and contact.

The detailed catalog, product navigator, brochures and advisory service package request live in a separate, private site (the advisory solution builder). Its link is shared only with clients who have contacted the team; nothing on this site links to it.

It is plain HTML, CSS and JavaScript with no build step, so it runs on any static host (GitHub Pages, Vercel, Netlify, SharePoint or an internal web server).

## What's in the folder

| Path | What it is |
| --- | --- |
| `index.html` | The page, including all of its text |
| `assets/styles.css` | All styling (Cleveland Clinic colors and Roboto, with a consulting-style layout) |
| `assets/site.js` | Contact email and footer year, the section bands, the package roadmap animation, the priority wheel and the partner highlights carousel |
| `assets/config.js` | Settings: contact email and prototype banner |
| `assets/img/` | Hero, membership, member and partner highlight photos |

## Preview locally

```
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Updating content

All text is in `index.html`:

- **Advisory expertise:** one card per domain, each with "For new hospitals" and "For existing hospitals" points. Keep these at a high level; solution detail belongs in the private builder.
- **Programs:** the All-in-One New Hospital Package roadmap (three phases on one line ending on opening day; each item carries its domain tag) and, for existing hospitals, a priority wheel: four priorities, each with how we help and examples "from our work" that open the matching partner story. Keep the examples to what partners or Cleveland Clinic have announced publicly.
- **Partner highlights:** one story per member in a carousel that rotates every 9 seconds while on screen (it stops on hover, on keyboard focus, with the pause button and for visitors who prefer reduced motion). Each story is drawn from a public announcement and linked to it. Add only what has been announced publicly, and no individual people's names. Photos go in `assets/img/highlights/` (3:2, at least 1200 pixels wide) and should show people at the event or engagement, with Marketing's approval. The "Photo to come" notes show only while `showPrototypeNotice` is on.
- **Member network:** one entry per member hospital with a photo in `assets/img/members/` (640 by 425 pixels).

## Before going live

- Set `showPrototypeNotice` to `false` in `assets/config.js`.
- Remove `<meta name="robots" content="noindex, nofollow">` from `index.html`.
- Have Marketing and the member relationship leads confirm the partner highlights.
