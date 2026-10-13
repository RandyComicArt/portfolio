# Randy Mattoka — Studio Portfolio

Digital illustrator and Computer Science student. Static site for [randycomicart.com](https://randycomicart.com), hosted on GitHub Pages.

Vanilla HTML, CSS, and JavaScript. No build step.

## Pages

- `index.html` — hero, completed-art exhibition, original works, process, about
- `gallery.html` — searchable masonry archive with filters
- `original.html` — original projects grouped by series (Nightwatch, then future worlds)
- `software.html` — software showcase (Featured, then Interactive Graphics experiments)
- `software/<slug>/` — one self-contained page per software demo, runnable in the browser

## Local preview

`gallery.json` is fetched over HTTP, so open the site from a local server:

```bash
python3 -m http.server 8080
```

- http://localhost:8080/
- http://localhost:8080/gallery.html
- http://localhost:8080/original.html
- http://localhost:8080/software.html
- http://localhost:8080/software/petal-burst/ (and `cube-dance`, `surfaces-of-revolution`, `dino-walk`)

## Adding artwork

1. Put the image in `images/` (do not replace existing files unless you mean to).
2. Add an object to `gallery.json`:

```json
{
  "id": "unique-slug",
  "thumb": "images/your-file.png",
  "full": "images/your-file.png",
  "title": "Title",
  "desc": "Optional description. Leave empty if none.",
  "date": "Month Day, Year",
  "collection": "completed"
}
```

`collection` must be one of:

- `completed` — finished / fan art (homepage exhibition)
- `original` — original worlds, games, characters
- `process` — sketches and studies

For original work that belongs to a named project, add:

```json
{
  "project": "Nightwatch"
}
```

New original series only need a new `project` value. `original.html` groups them automatically.

The homepage carousels, original works page, and gallery all read `gallery.json`. You do not need to duplicate `<img>` tags in HTML.

## Adding a software project

Software lives in `software/<kebab-case-slug>/`, with an `index.html` so the URL is `/software/<slug>/`.

1. **Demo page.** Copy an existing demo folder (for example `software/cube-dance/`) as a starting point. It uses the shared header, `css/software.css`, and `js/demo.js` (fullscreen and touch support). Keep paths relative: `../lib/` for the shared WebGL helpers, `../../css/`, `../../js/`.
2. **Card on the Software page.** Duplicate an `<article class="experiment">` in `software.html`, or use the commented template for the Featured collection above it. Fill in the title, description, stack, status, and links. Do not invent features; describe what the code does.
3. **Preview images.** Add `images/software/<slug>-1.png` (and an optional `-2`).
4. **Larger projects** (applications, systems work) do not need to be WebGL demos. Give them their own `software/<slug>/` page, or link out to a repository, and list them in the Featured collection.

## Local-only files

`.classroom-archive/` is gitignored. It holds the original coursework folders (assignment PDFs, submission zips, class sample programs) and the console-check harness used while building the demos. It is not published and is safe to delete.

## Structure

```text
portfolio/
├── index.html
├── gallery.html
├── original.html
├── software.html
├── software/
│   ├── lib/                      # shared WebGL helper libraries
│   ├── petal-burst/
│   ├── cube-dance/
│   ├── surfaces-of-revolution/
│   └── dino-walk/
├── gallery.json
├── CNAME
├── css/style.css
├── css/gallery.css
├── css/software.css
├── js/site.js
├── js/works.js
├── js/lightbox.js
├── js/carousel.js
├── js/demo.js
├── js/home.js
├── js/gallery.js
├── js/original.js
├── images/
└── socials/
```
