import './site.js';
import { loadWorks, searchBlob, escapeHtml } from './works.js';
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

  function makeThumb(item) {
    const btn = document.createElement('button');
    btn.className = 'gallery-thumb';
    btn.type = 'button';
    btn.dataset.id = item.id;
    btn.setAttribute('aria-label', `Open ${item.title || 'artwork'}`);
    const title = escapeHtml(item.title || '');
    const project = item.project ? `<span class="thumb-project">${escapeHtml(item.project)}</span>` : '';
    const date = item.date ? `<time>${escapeHtml(item.date)}</time>` : '';
    btn.innerHTML = `
      <img class="lazy" alt="${title}" decoding="async" src="data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='3' height='4'%3E%3C/svg%3E" data-src="${escapeHtml(item.thumb)}" />
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
    if (observer) observer.observe(img);
    else {
      img.src = item.thumb;
      img.classList.add('loaded');
    }
    return btn;
  }

  function render(reset) {
    if (reset) {
      grid.innerHTML = '';
      grid.classList.add('gallery-masonry');
      page = 0;
    }
    if (!filtered.length) {
      grid.classList.remove('gallery-masonry');
      grid.innerHTML = '<p class="no-results">No artworks found.</p>';
      if (loadMoreBtn) {
        loadMoreBtn.disabled = true;
        loadMoreBtn.textContent = 'No more items';
      }
      return;
    }
    const slice = filtered.slice(page * PAGE, page * PAGE + PAGE);
    slice.forEach((item) => grid.appendChild(makeThumb(item)));
    page += 1;
    const hasMore = page * PAGE < filtered.length;
    if (loadMoreBtn) {
      loadMoreBtn.disabled = !hasMore;
      loadMoreBtn.textContent = hasMore ? 'Load more' : 'No more items';
    }
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
