# Cleveland Clinic Connected: public website

The public, external-facing Cleveland Clinic Connected advisory website. It explains the program at a high level: Cleveland Clinic's advisory expertise in four domains (Finance; Safety, Quality, and Patient Experience (SQPE); Digital Tools & Analytics; Education), programs for new hospitals (the All-in-One New Hospital Package) and for existing hospitals, highlights of work with member hospitals, membership, the member network, FAQs and contact.

The detailed catalog, product navigator, brochures and advisory service package request live in a separate, private site (the advisory solution builder). Its link is shared only with clients who have contacted the team; nothing on this site links to it.

It is plain HTML, CSS and JavaScript with no build step, so it runs on any static host (GitHub Pages, Vercel, Netlify, SharePoint or an internal web server).

## What's in the folder

| Path | What it is |
| --- | --- |
| `index.html` | The page, including all of its text |
| `assets/styles.css` | All styling (palette taken from the Cleveland Clinic logo) |
| `assets/site.js` | Applies the contact email from `assets/config.js` and the footer year |
| `assets/config.js` | Settings: contact email and prototype banner |
| `assets/img/` | Hero, membership and member photos |

## Preview locally

```
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Updating content

All text is in `index.html`:

- **Advisory expertise:** one card per domain, each with "For new hospitals" and "For existing hospitals" points. Keep these at a high level; solution detail belongs in the private builder.
- **Programs:** the All-in-One New Hospital Package (three phases, each listing the domain and a short description) and the program for existing hospitals.
- **Partner highlights:** one card per member, each drawn from a public announcement and linked to it. Add only what has been announced publicly, and no individual people's names.
- **Member network:** one entry per member hospital with a photo in `assets/img/members/` (640 by 425 pixels).

## Before going live

- Set `showPrototypeNotice` to `false` in `assets/config.js`.
- Remove `<meta name="robots" content="noindex, nofollow">` from `index.html`.
- Have Marketing and the member relationship leads confirm the partner highlights.
