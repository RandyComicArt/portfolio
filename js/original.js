import './site.js';
import { loadWorks, groupByProject, escapeHtml } from './works.js';
import { createLightbox } from './lightbox.js';
import { mountExhibition } from './carousel.js';

const lightbox = createLightbox();

const PROJECT_COPY = {
  Nightwatch: 'Covers, conversations, weapons, and action studies from Nightwatch — the first original project living in this room.'
};

async function init() {
  const host = document.getElementById('original-projects');
  if (!host) return;

  let works = [];
  try {
    works = await loadWorks();
  } catch (err) {
    console.error(err);
    host.innerHTML = '<p class="empty-chapter">Could not load gallery.json. Serve the site over HTTP.</p>';
    return;
  }

  const original = works.filter((w) => w.collection === 'original');
  const groups = groupByProject(original);

  if (!groups.length) {
    host.innerHTML = '<p class="empty-chapter">Original works will appear here as projects are added to gallery.json.</p>';
    return;
  }

  groups.forEach(([name, items], i) => {
    const section = document.createElement('section');
    section.className = 'project-chapter band-flush';
    section.id = name.toLowerCase().replace(/\s+/g, '-');
    const copy = PROJECT_COPY[name] || '';
    section.innerHTML = `
      <div class="page">
        <p class="kicker">Project ${String(i + 1).padStart(2, '0')}</p>
        <h2>${escapeHtml(name)}</h2>
        ${copy ? `<p class="chapter-copy">${escapeHtml(copy)}</p>` : ''}
      </div>
      <div class="exhibit" data-project="${escapeHtml(name)}"></div>
    `;
    host.appendChild(section);
    mountExhibition(section.querySelector('.exhibit'), items, { lightbox });
  });

  const hash = decodeURIComponent((location.hash || '').replace(/^#/, ''));
  if (hash) {
    const item = original.find((w) => w.id === hash);
    if (item) {
      const pool = original.filter((w) => (w.project || 'Original') === (item.project || 'Original'));
      lightbox.open(pool, Math.max(0, pool.findIndex((w) => w.id === item.id)));
    }
  }
}

init();
