import './site.js';
import { loadWorks, searchBlob, escapeHtml } from './works.js?v=grid-stable';
import { createLightbox } from './lightbox.js';

const PAGE = 24;
const lightbox = createLightbox();

function debounce(fn, wait = 120) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

document.addEventListener('DOMContentLoaded', async () => {
  const grid = document.getElementById('gallery-grid');
  const loadMoreBtn = document.getElementById('load-more');
  const searchInput = document.getElementById('site-search');
  const searchStats = document.getElementById('search-stats');
  const filterButtons = Array.from(document.querySelectorAll('.gallery-filters button'));

  let allItems = [];
  let filtered = [];
  let page = 0;
  let observer = null;
  const EAGER = 8;

  try {
    allItems = await loadWorks();
  } catch (err) {
    console.error(err);
    grid.innerHTML = '<p class="no-results">Could not load gallery.json. Serve the site over HTTP.</p>';
    return;
  }

  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const img = entry.target;
        if (img.dataset.src) {
          img.src = img.dataset.src;
          img.addEventListener('load', () => img.classList.add('loaded'), { once: true });
        }
        observer.unobserve(img);
      });
    }, { rootMargin: '700px 0px' });
  }

  const params = new URLSearchParams(window.location.search);
  const preset = params.get('filter');
  if (preset && filterButtons.some((b) => b.dataset.filter === preset)) {
    filterButtons.forEach((b) => {
      const on = b.dataset.filter === preset;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function packMasonry() {
    const thumbs = Array.from(grid.querySelectorAll('.gallery-thumb'));
    if (!thumbs.length) {
      grid.classList.remove('is-packed');
      grid.style.height = '';
      return;
    }
    const styles = getComputedStyle(grid);
    const cols = Math.max(1, Number.parseInt(styles.getPropertyValue('--cols'), 10) || 1);
    const gap = Number.parseFloat(styles.getPropertyValue('--gap')) || 16;
    const colW = (grid.clientWidth - gap * (cols - 1)) / cols;
    const heights = Array.from({ length: cols }, () => 0);
    grid.classList.add('is-packed');
    thumbs.forEach((el) => {
      el.style.width = `${colW}px`;
    });
    thumbs.forEach((el) => {
      const col = heights.indexOf(Math.min(...heights));
      el.style.left = `${col * (colW + gap)}px`;
      el.style.top = `${heights[col]}px`;
      heights[col] += el.offsetHeight + gap;
    });
    grid.style.height = `${Math.max(0, ...heights) - gap}px`;
  }

  function makeThumb(item, eager = false) {
    const btn = document.createElement('button');
    btn.className = [
      'gallery-thumb',
      eager ? 'is-eager' : '',
      item.pixel ? 'is-pixel' : '',
      item.clear ? 'is-clear' : ''
    ].filter(Boolean).join(' ');
    btn.type = 'button';
    btn.dataset.id = item.id;
    btn.setAttribute('aria-label', `Open ${item.title || 'artwork'}`);
    const title = escapeHtml(item.title || '');
    const project = item.project ? `<span class="thumb-project">${escapeHtml(item.project)}</span>` : '';
    const date = item.date ? `<time>${escapeHtml(item.date)}</time>` : '';
    const w = item.width || 3;
    const h = item.height || 4;
    btn.style.setProperty('--thumb-ratio', `${w} / ${h}`);
    btn.innerHTML = `
      <img class="lazy" alt="${title}" width="${w}" height="${h}" decoding="async" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" data-src="${escapeHtml(item.thumb)}" />
      <div>
        ${project}
        <h3>${title}</h3>
        ${date}
      </div>
    `;
    const img = btn.querySelector('img');
    btn.addEventListener('click', () => {
      const idx = filtered.findIndex((it) => it.id === item.id);
      lightbox.open(filtered, Math.max(0, idx));
    });
    if (eager || !observer) {
      img.src = item.thumb;
      img.removeAttribute('data-src');
      if (img.complete) img.classList.add('loaded');
      else img.addEventListener('load', () => img.classList.add('loaded'), { once: true });
    } else {
      observer.observe(img);
    }
    return btn;
  }

  function render(reset) {
    if (reset) {
      grid.innerHTML = '';
      grid.classList.add('gallery-grid');
      grid.classList.remove('is-packed');
      grid.style.height = '';
      page = 0;
    }
    if (!filtered.length) {
      grid.classList.remove('gallery-grid', 'is-packed');
      grid.style.height = '';
      grid.innerHTML = '<p class="no-results">No artworks found.</p>';
      if (loadMoreBtn) {
        loadMoreBtn.disabled = true;
        loadMoreBtn.textContent = 'No more items';
      }
      return;
    }
    const start = page * PAGE;
    const slice = filtered.slice(start, start + PAGE);
    slice.forEach((item, i) => grid.appendChild(makeThumb(item, start + i < EAGER)));
    page += 1;
    const hasMore = page * PAGE < filtered.length;
    if (loadMoreBtn) {
      loadMoreBtn.disabled = !hasMore;
      loadMoreBtn.textContent = hasMore ? 'Load more' : 'No more items';
    }
    packMasonry();
  }

  function applyFilters() {
    const query = (searchInput?.value || '').trim().toLowerCase();
    const active = filterButtons.find((b) => b.classList.contains('active'))?.dataset.filter || 'all';
    const terms = query.split(/\s+/).filter(Boolean);
    filtered = allItems.filter((it) => {
      const okFilter = active === 'all' || it.collection === active;
      const blob = searchBlob(it);
      const okQuery = !terms.length || terms.every((t) => blob.includes(t));
      return okFilter && okQuery;
    });
    if (searchStats) {
      searchStats.textContent = query
        ? (filtered.length ? `${filtered.length} result${filtered.length === 1 ? '' : 's'}` : 'No results')
        : '';
    }
    render(true);
  }

  filterButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterButtons.forEach((b) => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      const url = new URL(window.location.href);
      if (btn.dataset.filter === 'all') url.searchParams.delete('filter');
      else url.searchParams.set('filter', btn.dataset.filter);
      history.replaceState(null, '', url);
      applyFilters();
    });
  });

  searchInput?.addEventListener('input', debounce(applyFilters, 80));
  searchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      searchInput.value = '';
      applyFilters();
    }
  });
  loadMoreBtn?.addEventListener('click', () => render(false));
  window.addEventListener('resize', debounce(packMasonry, 100));
  document.fonts?.ready?.then(() => packMasonry());

  applyFilters();

  const hash = decodeURIComponent((location.hash || '').replace(/^#/, ''));
  if (hash) {
    const found = filtered.findIndex((it) => it.id === hash);
    if (found !== -1) {
      const needed = Math.floor(found / PAGE);
      for (let i = 0; i < needed; i += 1) render(false);
      setTimeout(() => {
        document.querySelector(`[data-id="${CSS.escape(hash)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        lightbox.open(filtered, found);
      }, 120);
    }
  }
});
