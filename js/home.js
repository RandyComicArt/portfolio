import './site.js';
import { loadWorks, searchBlob } from './works.js';
import { createLightbox } from './lightbox.js';
import { mountExhibition, mountProcessRail, mountOriginalSpread } from './carousel.js';

const lightbox = createLightbox();

function applyQuery(root, query) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  let matches = 0;
  let total = 0;
  root?.querySelectorAll('[data-id]').forEach((el) => {
    const blob = (el.dataset.search || el.textContent || '').toLowerCase();
    const ok = !terms.length || terms.every((t) => blob.includes(t));
    el.classList.toggle('search-dim', !ok);
    total += 1;
    if (ok) matches += 1;
  });
  return { matches, total, active: terms.length > 0 };
}

async function init() {
  let works = [];
  try {
    works = await loadWorks();
  } catch (err) {
    console.error(err);
    return;
  }

  const completed = works.filter((w) => w.collection === 'completed');
  const original = works.filter((w) => w.collection === 'original');
  const process = works.filter((w) => w.collection === 'process');

  const completedEx = mountExhibition(document.getElementById('exhibit-completed'), completed, { lightbox });
  mountOriginalSpread(document.getElementById('original-spread'), original, { lightbox });
  mountProcessRail(document.getElementById('process-rail'), process, { lightbox });

  document.querySelectorAll('[data-work]').forEach((el) => {
    el.addEventListener('click', () => {
      const id = el.dataset.work;
      const item = works.find((w) => w.id === id);
      if (!item) return;
      const pool = works.filter((w) => w.collection === item.collection);
      lightbox.open(pool, Math.max(0, pool.findIndex((w) => w.id === id)));
    });
  });

  document.querySelectorAll('#exhibit-completed [data-id], #original-spread [data-id], #process-rail [data-id]').forEach((el) => {
    const item = works.find((w) => w.id === el.dataset.id);
    if (item) el.dataset.search = searchBlob(item);
  });

  const input = document.getElementById('site-search');
  const stats = document.getElementById('search-stats');

  const runSearch = () => {
    const q = input?.value || '';
    const a = applyQuery(document.getElementById('exhibit-completed'), q);
    const b = applyQuery(document.getElementById('original-spread'), q);
    const c = applyQuery(document.getElementById('process-rail'), q);
    completedEx.refresh();
    const matches = a.matches + b.matches + c.matches;
    if (stats) {
      stats.textContent = q.trim()
        ? (matches ? `${matches} result${matches === 1 ? '' : 's'}` : 'No results')
        : '';
    }
  };

  input?.addEventListener('input', runSearch);
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      input.value = '';
      runSearch();
    }
  });

  const hash = decodeURIComponent((location.hash || '').replace(/^#/, ''));
  if (hash && hash !== 'exhibition' && hash !== 'original' && hash !== 'process' && hash !== 'software' && hash !== 'about') {
    const item = works.find((w) => w.id === hash);
    if (item) {
      const pool = works.filter((w) => w.collection === item.collection);
      lightbox.open(pool, Math.max(0, pool.findIndex((w) => w.id === item.id)));
    }
  }
}

init();
