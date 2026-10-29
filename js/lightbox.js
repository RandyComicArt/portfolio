const ZOOM = 2.5;
const LENS_R = 90;
const LENS_D = LENS_R * 2;
const EDGE_BUFFER = 72;
const EDGE_MIN = 0.18;
const FADE_MS = 220;
const BOUNCE_MS = 280;
const FOCUSABLE = 'button:not([disabled]), [href], input, textarea, select, [tabindex]:not([tabindex="-1"])';

const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createLightbox() {
  const modal = document.getElementById('image-modal');
  const modalImg = document.getElementById('modal-image');
  const titleEl = document.getElementById('description-title');
  const textEl = document.getElementById('description-text');
  const metaEl = document.getElementById('description-meta');
  const projectEl = document.getElementById('description-project');
  const closeBtn = document.getElementById('modal-close-btn');
  const prevBtn = document.getElementById('modal-prev-btn');
  const nextBtn = document.getElementById('modal-next-btn');
  const magContainer = document.getElementById('magnifier-container');
  const magLens = document.getElementById('magnifier-lens');

  if (!modal || !modalImg) {
    return { open() {}, close() {} };
  }

  let items = [];
  let index = 0;
  let lastFocus = null;
  let lensCanvas = null;
  let lensCtx = null;
  let fadeTimer = null;

  function bounce(btn) {
    if (!btn || reduceMotion) return;
    btn.classList.add('animated');
    setTimeout(() => btn.classList.remove('animated'), BOUNCE_MS);
  }

  function ensureCanvas() {
    if (!magLens || lensCanvas) return;
    lensCanvas = document.createElement('canvas');
    lensCanvas.className = 'mag-lens-canvas';
    lensCanvas.width = LENS_D;
    lensCanvas.height = LENS_D;
    lensCtx = lensCanvas.getContext('2d', { alpha: true });
    magLens.appendChild(lensCanvas);
  }

  function showLens() {
    if (!canHover || reduceMotion) return;
    ensureCanvas();
    if (fadeTimer) {
      clearTimeout(fadeTimer);
      fadeTimer = null;
    }
    magLens.classList.add('active');
    magContainer.classList.add('lens-active');
    magLens.style.opacity = '1';
  }

  function hideLens() {
    if (!magLens) return;
    magLens.style.opacity = '0';
    magLens.classList.remove('active');
    if (fadeTimer) clearTimeout(fadeTimer);
    fadeTimer = setTimeout(() => {
      magContainer?.classList.remove('lens-active');
      fadeTimer = null;
    }, FADE_MS);
  }

  function handleMagnify(e) {
    if (!canHover || reduceMotion || !lensCtx || !modalImg.naturalWidth) return;
    const rect = magContainer.getBoundingClientRect();
    const imageRect = modalImg.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const imageX = e.clientX - imageRect.left;
    const imageY = e.clientY - imageRect.top;
    const outside = Math.max(
      Math.max(0, -imageX),
      Math.max(0, imageX - imageRect.width),
      Math.max(0, -imageY),
      Math.max(0, imageY - imageRect.height)
    );
    if (outside >= EDGE_BUFFER) {
      magLens.style.opacity = '0';
      return;
    }
    magLens.style.opacity = outside > 0
      ? (1 - ((1 - EDGE_MIN) * (outside / EDGE_BUFFER))).toFixed(3)
      : '1';
    magLens.style.left = `${x}px`;
    magLens.style.top = `${y}px`;
    magLens.style.transform = `translate(-${LENS_R}px, -${LENS_R}px)`;

    const drawW = imageRect.width * ZOOM;
    const drawH = imageRect.height * ZOOM;
    lensCtx.clearRect(0, 0, LENS_D, LENS_D);
    lensCtx.imageSmoothingEnabled = !items[index]?.pixel;
    lensCtx.fillStyle = '#111114';
    lensCtx.fillRect(0, 0, LENS_D, LENS_D);
    lensCtx.drawImage(
      modalImg,
      LENS_R - imageX * ZOOM,
      LENS_R - imageY * ZOOM,
      drawW,
      drawH
    );
  }

  function fill(item, direction) {
    const apply = () => {
      modalImg.src = item.full || item.thumb;
      modalImg.alt = item.title || '';
      modalImg.classList.toggle('is-pixel', Boolean(item.pixel));
      modalImg.classList.toggle('is-clear', Boolean(item.clear));
      magContainer?.classList.toggle('is-clear', Boolean(item.clear));
      titleEl.textContent = item.title || '';
      textEl.textContent = item.desc || '';
      metaEl.textContent = item.date ? item.date : '';
      if (projectEl) projectEl.textContent = item.project || '';
      prevBtn.disabled = index <= 0;
      nextBtn.disabled = index >= items.length - 1;
    };

    if (!direction || reduceMotion) {
      modalImg.style.transition = 'none';
      modalImg.style.transform = 'none';
      modalImg.style.opacity = '1';
      apply();
      return;
    }

    const out = direction === 'next' ? '-48px' : '48px';
    const inn = direction === 'next' ? '48px' : '-48px';
    modalImg.style.transition = 'transform 200ms ease, opacity 200ms ease';
    modalImg.style.transform = `translateX(${out})`;
    modalImg.style.opacity = '0';
    setTimeout(() => {
      modalImg.style.transition = 'none';
      modalImg.style.transform = `translateX(${inn})`;
      apply();
      requestAnimationFrame(() => {
        modalImg.style.transition = 'transform 240ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms ease';
        modalImg.style.transform = 'translateX(0)';
        modalImg.style.opacity = '1';
      });
    }, 180);
  }

  function trapFocus(e) {
    if (e.key !== 'Tab' || !modal.classList.contains('is-open')) return;
    const nodes = Array.from(modal.querySelectorAll(FOCUSABLE)).filter((el) => !el.hidden);
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function onKey(e) {
    if (!modal.classList.contains('is-open')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') prev();
    if (e.key === 'ArrowRight') next();
    trapFocus(e);
  }

  function bindMagnifier(on) {
    if (!magContainer) return;
    const fn = on ? 'addEventListener' : 'removeEventListener';
    magContainer[fn]('mouseenter', showLens);
    magContainer[fn]('mouseleave', hideLens);
    magContainer[fn]('mousemove', handleMagnify);
  }

  function open(list, startIndex = 0) {
    items = list || [];
    if (!items.length) return;
    index = Math.max(0, Math.min(startIndex, items.length - 1));
    lastFocus = document.activeElement;
    modal.hidden = false;
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    fill(items[index], null);
    bindMagnifier(true);
    document.addEventListener('keydown', onKey);
    closeBtn?.focus({ preventScroll: true });
    if (items[index].id) {
      history.replaceState(null, '', `#${encodeURIComponent(items[index].id)}`);
    }
  }

  function close() {
    hideLens();
    modal.classList.remove('is-open');
    modal.hidden = true;
    document.body.style.overflow = '';
    bindMagnifier(false);
    document.removeEventListener('keydown', onKey);
    modalImg.src = '';
    if (lastFocus && typeof lastFocus.focus === 'function') {
      lastFocus.focus({ preventScroll: true });
    }
    const path = window.location.pathname + window.location.search;
    history.replaceState(null, '', path);
  }

  function prev() {
    if (index <= 0) return;
    bounce(prevBtn);
    index -= 1;
    fill(items[index], 'prev');
    if (items[index].id) history.replaceState(null, '', `#${encodeURIComponent(items[index].id)}`);
  }

  function next() {
    if (index >= items.length - 1) return;
    bounce(nextBtn);
    index += 1;
    fill(items[index], 'next');
    if (items[index].id) history.replaceState(null, '', `#${encodeURIComponent(items[index].id)}`);
  }

  closeBtn?.addEventListener('click', close);
  prevBtn?.addEventListener('click', prev);
  nextBtn?.addEventListener('click', next);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });

  return { open, close };
}
