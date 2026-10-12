# Randy Mattoka — Studio Portfolio

Digital illustrator and Computer Science student. Static site for [randycomicart.com](https://randycomicart.com), hosted on GitHub Pages.

Vanilla HTML, CSS, and JavaScript. No build step.

## Pages

- `index.html` — hero, completed-art exhibition, original works, process, about
- `gallery.html` — searchable masonry archive with filters
- `original.html` — original projects grouped by series (Nightwatch, then future worlds)
- `software.html` — software portfolio (ready for project writeups)

## Local preview

`gallery.json` is fetched over HTTP, so open the site from a local server:

```bash
python3 -m http.server 8080
```

- http://localhost:8080/
- http://localhost:8080/gallery.html
- http://localhost:8080/original.html
- http://localhost:8080/software.html

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
"project": "Nightwatch"
```

New original series only need a new `project` value. `original.html` groups them automatically.

The homepage carousels, original works page, and gallery all read `gallery.json`. You do not need to duplicate `<img>` tags in HTML.

## Adding a software project

Duplicate the commented `<article class="project">` block in `software.html`. Fill name, description, stack, status, screenshot, GitHub, and demo links. Do not invent projects.

## Structure

```text
portfolio/
├── index.html
├── gallery.html
├── original.html
├── software.html
├── gallery.json
├── CNAME
├── css/style.css
├── css/gallery.css
├── js/site.js
├── js/works.js
├── js/lightbox.js
├── js/carousel.js
├── js/home.js
├── js/gallery.js
├── js/original.js
├── images/
└── socials/
```
