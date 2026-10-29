import { escapeHtml } from './works.js';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function pad(n) {
  return String(n).padStart(2, '0');
}

export function mountExhibition(root, items, { lightbox, label = 'Artwork exhibition' } = {}) {
  if (!root) return { refresh() {}, setIndex() {} };

  root.innerHTML = `
    <div class="exhibit-viewport" tabindex="0" aria-roledescription="carousel" aria-label="${escapeHtml(label)}">
      <div class="exhibit-track"></div>
    </div>
    <div class="exhibit-controls">
      <button class="exhibit-arrow" type="button" data-dir="-1" aria-label="Previous artwork">&#10094;</button>
      <span class="exhibit-count" aria-live="polite"></span>
      <button class="exhibit-arrow" type="button" data-dir="1" aria-label="Next artwork">&#10095;</button>
    </div>
    <div class="exhibit-ticks" role="group" aria-label="Select artwork"></div>
  `;

  const viewport = root.querySelector('.exhibit-viewport');
  const track = root.querySelector('.exhibit-track');
  const ticks = root.querySelector('.exhibit-ticks');
  const countEl = root.querySelector('.exhibit-count');
  const prevBtn = root.querySelector('[data-dir="-1"]');
  const nextBtn = root.querySelector('[data-dir="1"]');

  items.forEach((item, i) => {
    const slide = document.createElement('article');
    slide.className = [
      'exhibit-slide',
      item.pixel ? 'is-pixel' : '',
      item.clear ? 'is-clear' : ''
    ].filter(Boolean).join(' ');
    slide.dataset.id = item.id;
    const title = escapeHtml(item.title || '');
    const project = item.project
      ? `<span class="exhibit-project">${escapeHtml(item.project)}</span>`
      : '';
    const date = item.date ? `<p>${escapeHtml(item.date)}</p>` : '';
    slide.innerHTML = `
      <button type="button" aria-label="Open ${title || 'artwork'}">
        <img src="${escapeHtml(item.thumb)}" alt="${title}" loading="${i < 3 ? 'eager' : 'lazy'}" decoding="async" />
        <div class="exhibit-meta">
          ${project}
          <h3>${title}</h3>
          ${date}
        </div>
      </button>
    `;
    slide.querySelector('button').addEventListener('click', () => {
      if (slide.classList.contains('search-dim') || suppressClick) return;
      const visible = visibleItems();
      const idx = visible.findIndex((it) => it.id === item.id);
      lightbox?.open(visible, Math.max(0, idx));
    });
    track.appendChild(slide);

    const tick = document.createElement('button');
    tick.type = 'button';
    tick.dataset.index = String(i);
    tick.setAttribute('aria-label', `Show ${item.title || `artwork ${i + 1}`}`);
    tick.addEventListener('click', () => {
      const vis = visibleSlides();
      const mapped = vis.findIndex((s) => s.dataset.id === item.id);
      if (mapped !== -1) setIndex(mapped);
    });
    ticks.appendChild(tick);
  });
  if (items.length > 10) ticks.hidden = true;

  let index = 0;
  let suppressClick = false;

  function slides() {
    return Array.from(track.querySelectorAll('.exhibit-slide'));
  }

  function visibleItems() {
    return slides()
      .filter((s) => !s.classList.contains('search-dim'))
      .map((s) => items.find((it) => it.id === s.dataset.id))
      .filter(Boolean);
  }

  function visibleSlides() {
    return slides().filter((s) => !s.classList.contains('search-dim'));
  }

  function setIndex(next) {
    const vis = visibleSlides();
    if (!vis.length) {
      prevBtn.disabled = true;
      nextBtn.disabled = true;
      countEl.textContent = '00 / 00';
      ticks.querySelectorAll('button').forEach((t) => {
        t.hidden = true;
        t.classList.remove('is-current');
      });
      return;
    }
    index = Math.max(0, Math.min(next, vis.length - 1));
    const all = slides();
    all.forEach((s) => s.classList.remove('is-active'));
    vis[index].classList.add('is-active');
    const active = vis[index];
    const edge = 28;
    let offset;
    if (vis.length === 1 || index === 0) {
      offset = edge;
    } else if (index === vis.length - 1) {
      offset = viewport.clientWidth - (active.offsetLeft + active.offsetWidth) - edge;
    } else {
      const center = active.offsetLeft + active.offsetWidth / 2;
      offset = viewport.clientWidth / 2 - center;
    }
    track.style.transition = reduceMotion ? 'none' : '';
    track.style.transform = `translateX(${offset}px)`;
    prevBtn.disabled = index === 0;
    nextBtn.disabled = index === vis.length - 1;
    countEl.textContent = `${pad(index + 1)} / ${pad(vis.length)}`;

    const visibleIds = new Set(vis.map((s) => s.dataset.id));
    ticks.querySelectorAll('button').forEach((t, i) => {
      const id = items[i]?.id;
      t.hidden = !visibleIds.has(id);
      t.classList.toggle('is-current', id === active.dataset.id);
    });
  }

  function move(dir) {
    setIndex(index + dir);
  }

  prevBtn.addEventListener('click', () => move(-1));
  nextBtn.addEventListener('click', () => move(1));

  viewport.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); move(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); move(1); }
  });

  let dragging = false;
  let startX = 0;
  let lastX = 0;

  viewport.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    dragging = true;
    suppressClick = false;
    startX = lastX = e.clientX;
  });
  viewport.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    lastX = e.clientX;
    if (Math.abs(lastX - startX) > 12) {
      if (viewport.setPointerCapture && !viewport.hasPointerCapture?.(e.pointerId)) {
        viewport.setPointerCapture(e.pointerId);
      }
      viewport.classList.add('is-dragging');
      suppressClick = true;
    }
  });
  const endDrag = (e) => {
    if (!dragging) return;
    dragging = false;
    viewport.classList.remove('is-dragging');
    if (e && viewport.hasPointerCapture?.(e.pointerId)) {
      viewport.releasePointerCapture(e.pointerId);
    }
    const dx = lastX - startX;
    if (Math.abs(dx) > 50) move(dx > 0 ? -1 : 1);
  };
  viewport.addEventListener('pointerup', endDrag);
  viewport.addEventListener('pointercancel', endDrag);

  window.addEventListener('resize', () => setIndex(index));

  const firstImgs = Array.from(track.querySelectorAll('img')).slice(0, 3);
  let pending = firstImgs.length;
  let didInit = false;
  const ready = () => {
    if (didInit) return;
    didInit = true;
    setIndex(0);
  };
  if (!pending) ready();
  firstImgs.forEach((img) => {
    if (img.complete) {
      pending -= 1;
      if (pending <= 0) ready();
    } else {
      img.addEventListener('load', () => {
        pending -= 1;
        if (pending <= 0) ready();
      }, { once: true });
      img.addEventListener('error', () => {
        pending -= 1;
        if (pending <= 0) ready();
      }, { once: true });
    }
  });
  setTimeout(ready, 800);

  return {
    refresh() {
      setIndex(0);
    },
    setIndex
  };
}

export function mountProcessRail(root, items, { lightbox } = {}) {
  if (!root) return;
  root.innerHTML = '';
  items.forEach((item) => {
    const btn = document.createElement('button');
    btn.className = 'process-item';
    btn.type = 'button';
    btn.dataset.id = item.id;
    const title = escapeHtml(item.title || '');
    btn.innerHTML = `
      <img src="${escapeHtml(item.thumb)}" alt="${title}" loading="lazy" decoding="async" />
      <span>${title}</span>
    `;
    btn.addEventListener('click', () => {
      if (btn.classList.contains('search-dim')) return;
      const visible = items.filter((it) => {
        const el = root.querySelector(`[data-id="${CSS.escape(it.id)}"]`);
        return el && !el.classList.contains('search-dim');
      });
      const idx = visible.findIndex((it) => it.id === item.id);
      lightbox?.open(visible, Math.max(0, idx));
    });
    root.appendChild(btn);
  });
}

export function mountOriginalSpread(root, items, { lightbox } = {}) {
  if (!root) return;
  root.innerHTML = '';
  if (!items.length) {
    root.innerHTML = '<p class="empty-chapter">Original works will appear here.</p>';
    return;
  }

  const [lead, ...rest] = items;
  const leadBtn = document.createElement('button');
  leadBtn.className = 'spread-lead';
  leadBtn.type = 'button';
  leadBtn.dataset.id = lead.id;
  leadBtn.setAttribute('aria-label', `Open ${lead.title || 'artwork'}`);
  leadBtn.innerHTML = `
    <img src="${escapeHtml(lead.thumb)}" alt="${escapeHtml(lead.title || '')}" />
    ${lead.title ? `<span class="spread-cap">${escapeHtml(lead.title)}</span>` : ''}
  `;
  leadBtn.addEventListener('click', () => {
    lightbox?.open(items, 0);
  });
  root.appendChild(leadBtn);

  const grid = document.createElement('div');
  grid.className = 'spread-grid';
  rest.forEach((item, i) => {
    const btn = document.createElement('button');
    btn.className = 'spread-tile';
    btn.type = 'button';
    btn.dataset.id = item.id;
    btn.setAttribute('aria-label', `Open ${item.title || 'artwork'}`);
    btn.innerHTML = `
      <img src="${escapeHtml(item.thumb)}" alt="${escapeHtml(item.title || '')}" decoding="async" />
      ${item.title ? `<span class="spread-cap">${escapeHtml(item.title)}</span>` : ''}
    `;
    btn.addEventListener('click', () => lightbox?.open(items, i + 1));
    grid.appendChild(btn);
  });
  root.appendChild(grid);
}
