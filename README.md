# Randy Mattoka Artist Portfolio

Digital illustrator and concept artist portfolio site built with vanilla HTML, CSS, and JavaScript.

## What This Project Includes

- A polished landing page with:
  - section-based artwork carousels (`Completed`, `Nightwatch`, `Process`)
  - live search that reorders and highlights matches
  - modal viewer with image descriptions, dates, keyboard navigation, and magnifier lens
- A dedicated `gallery.html` page with:
  - category filters
  - text search
  - lazy-loaded thumbnails
  - deep-link support via URL hash (example: `#zagreus`)

## Quick Start (Local)

This project is static, but `gallery.html` fetches `gallery.json`, so run it from a local server (not `file://`).

```bash
cd /Users/randym/Documents/GitHub/portfolio
python3 -m http.server 8080
```

Then open:

- `http://localhost:8080/index.html`
- `http://localhost:8080/gallery.html`

## Project Structure

```text
portfolio/
├── index.html
├── gallery.html
├── gallery.json
├── css/
│   ├── style.css
│   ├── gallery.css
│   ├── search.css
│   └── hover.css
├── js/
│   ├── script.js
│   ├── search.js
│   ├── gallery.js
│   └── hover.js
├── images/
└── socials/
```

## How To Add New Artwork

1. Add the image file to `images/`.
2. Update `gallery.json` with a new object:
   - `id` (unique slug)
   - `thumb` / `full`
   - `title`
   - `desc`
   - `date`
   - `collection` (`completed`, `nightwatch`, or `process`)
3. If you want it in homepage carousels, also add a matching `<img>` entry in `index.html` under the correct section.
4. Ensure `alt`, `data-desc`, and `data-date` are filled so search and modal info are meaningful.

## Update Checklist

- Confirm search works on both pages.
- Confirm modal next/prev and keyboard arrows still work.
- Confirm new items appear in the correct filter.
- Confirm lazy-loading still works in `gallery.html`.

## Contact

- Email: `randy.mattoka@gmail.com`
- Instagram: `https://www.instagram.com/randycomicart/`
- ArtStation: `https://www.artstation.com/randycomicart`
