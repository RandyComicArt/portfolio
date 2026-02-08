/* patched js/gallery.js
   - Reworked modal open/close to use .is-open + aria-hidden
   - Scoped keyboard handlers + focus trap
   - DocumentFragment for batch DOM appends
   - Preload neighboring images
   - Deterministic id fallback
   - Defensive checks + aria-selected init
*/

document.addEventListener('DOMContentLoaded', () => {
    const THUMBS_PER_PAGE = 24;

    // UI elements
    const grid = document.getElementById('gallery-grid');
    const loadMoreBtn = document.getElementById('load-more');
    const searchInput = document.getElementById('gallery-search');
    const filterButtons = Array.from(document.querySelectorAll('.gallery-filters button'));

    // Modal elements
    const modal = document.getElementById('image-modal');
    const modalImg = document.getElementById('modal-image');
    const modalTitle = document.getElementById('description-title');
    const modalText = document.getElementById('description-text');
    const modalMeta = document.getElementById('description-meta');
    const modalPrev = document.getElementById('modal-prev-btn');
    const modalNext = document.getElementById('modal-next-btn');
    const modalClose = document.getElementById('modal-close-btn');

    // App state
    let allItems = [];
    let filtered = [];
    let page = 0;
    let currentIndex = -1;
    let lastFocusedElement = null;

    // Modal helpers state
    let modalKeyHandler = null;
    let releaseFocusTrap = null;

    (async function init() {
        try {
            const resp = await fetch('gallery.json', { cache: 'no-store' });
            if (!resp.ok) throw new Error('No gallery.json (status ' + resp.status + ')');
            const data = await resp.json();
            allItems = normalizeData(data);
        } catch (err) {
            console.info('gallery.js: gallery.json not found — falling back to scanning DOM (if present).', err);
            const domItems = scanCarouselImages();
            allItems = normalizeData(domItems);
        }

        // ensure each item has a deterministic id (use title-derived or index)
        allItems = allItems.map((it, i) => {
            const base = it.id || slugify(it.title || `art-${i + 1}`);
            // deterministic fallback: art-001 style if empty
            const safe = base || `art-${String(i + 1).padStart(3, '0')}`;
            return { id: safe, ...it };
        });

        // start with everything visible
        filtered = allItems.slice();

        // initialize aria-selected on filter buttons to reflect .active
        filterButtons.forEach(b => b.setAttribute('aria-selected', b.classList.contains('active')));

        renderPage(true);
        bindControls();
        handleInitialHash();
    })();

    /* -------------------------
       Data helpers
       ------------------------- */
    function normalizeData(raw) {
        return (raw || []).map(r => {
            return {
                thumb: r.thumb || r.thumbUrl || r.thumbSrc || r.src || '',
                full: r.full || r.fullUrl || r.fullSrc || r.dataset?.full || r.src || '',
                title: String(r.title || r.name || r.alt || '').trim(),
                desc: r.desc || r.description || r.dataset?.desc || '',
                date: r.date || r.dataset?.date || '',
                collection: (r.collection || r.dataset?.collection || 'all').toString().toLowerCase(),
                id: r.id || r.slug || ''
            };
        });
    }

    function scanCarouselImages() {
        const imgs = Array.from(document.querySelectorAll('.carousel-track img'));
        return imgs.map(img => ({
            thumb: img.dataset.thumb || img.src || '',
            full: img.dataset.full || img.src || '',
            title: img.alt || img.getAttribute('title') || '',
            desc: img.dataset.desc || img.getAttribute('data-desc') || '',
            date: img.dataset.date || img.getAttribute('data-date') || '',
            collection: (img.closest('.carousel-wrapper')?.dataset?.section) || (img.dataset.collection) || 'all',
            id: img.dataset.id || img.id || ''
        }));
    }

    function slugify(text = '') {
        return text.toString().toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^\w\-]+/g, '')
            .replace(/\-\-+/g, '-')
            .replace(/^-+/, '')
            .replace(/-+$/, '');
    }

    /* -------------------------
       Rendering
       ------------------------- */
    function renderPage(reset = false) {
        if (!grid) return;
        if (reset) {
            grid.innerHTML = '';
            page = 0;
        }
        const start = page * THUMBS_PER_PAGE;
        const slice = filtered.slice(start, start + THUMBS_PER_PAGE);
        const frag = document.createDocumentFragment();
        slice.forEach(item => frag.appendChild(makeThumb(item)));
        grid.appendChild(frag);
        page++;

        if (loadMoreBtn) {
            if (page * THUMBS_PER_PAGE >= filtered.length) {
                loadMoreBtn.disabled = true;
                loadMoreBtn.textContent = 'No more items';
            } else {
                loadMoreBtn.disabled = false;
                loadMoreBtn.textContent = 'Load more';
            }
        }
    }

    function makeThumb(item) {
        const article = document.createElement('article');
        article.className = 'gallery-thumb';
        article.dataset.collection = item.collection || 'all';
        article.dataset.title = item.title || '';
        article.dataset.desc = item.desc || '';
        article.dataset.date = item.date || '';
        article.dataset.id = item.id || '';

        const btn = document.createElement('button');
        btn.className = 'thumb-btn';
        btn.type = 'button';
        btn.setAttribute('aria-label', item.title ? `Open ${item.title}` : 'Open artwork');

        const img = document.createElement('img');
        img.className = 'thumb-img';
        img.loading = 'lazy';
        img.alt = item.title || '';
        img.src = item.thumb || item.full || '';
        img.dataset.full = item.full || item.thumb || '';
        img.dataset.id = item.id || '';

        btn.appendChild(img);
        article.appendChild(btn);

        const meta = document.createElement('div');
        meta.className = 'thumb-meta';
        const h = document.createElement('h4'); h.textContent = item.title || '';
        const t = document.createElement('time'); t.textContent = item.date || '';
        if (item.date) t.setAttribute('datetime', item.date);
        meta.appendChild(h);
        meta.appendChild(t);
        article.appendChild(meta);

        btn.addEventListener('click', () => openModalForItem(item));

        return article;
    }

    /* -------------------------
       Controls
       ------------------------- */
    function bindControls() {
        // filters
        filterButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                filterButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                filterButtons.forEach(b => b.setAttribute('aria-selected', b.classList.contains('active')));
                applyFilters();
            });
        });

        // search (debounced)
        if (searchInput) {
            searchInput.addEventListener('input', debounce(() => applyFilters(), 170));
        }

        // load more
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => renderPage(false));
        }

        // modal controls
        if (modalClose) modalClose.addEventListener('click', closeModal);
        if (modalPrev) modalPrev.addEventListener('click', () => showRelative(-1));
        if (modalNext) modalNext.addEventListener('click', () => showRelative(1));

        // click outside to close (only when using class-based overlay)
        if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    }

    function applyFilters() {
        const query = (searchInput?.value || '').trim().toLowerCase();
        const activeBtn = filterButtons.find(b => b.classList.contains('active'));
        const activeFilter = activeBtn?.dataset?.filter || 'all';

        filtered = allItems.filter(it => {
            const matchesFilter = (activeFilter === 'all') || (String(it.collection || '').toLowerCase() === activeFilter);
            const title = (it.title || '').toLowerCase();
            const desc = (it.desc || '').toLowerCase();
            const matchesQuery = !query || title.includes(query) || desc.includes(query);
            return matchesFilter && matchesQuery;
        });

        renderPage(true);
        updateHashIfNotFound();
    }

    /* -------------------------
       Modal / Lightbox
       ------------------------- */
    function openModalForItem(item) {
        currentIndex = filtered.findIndex(it => (it.id || '') === (item.id || ''));
        if (currentIndex === -1) {
            currentIndex = filtered.findIndex(it => it.title === item.title);
        }
        if (currentIndex === -1) return;
        showCurrent();

        // deep-link (single write)
        if (filtered[currentIndex]?.id) {
            history.replaceState(null, '', `#${encodeURIComponent(filtered[currentIndex].id)}`);
        }

        openModalUI();
    }

    function showCurrent() {
        if (currentIndex < 0 || currentIndex >= filtered.length) return;
        const it = filtered[currentIndex];
        if (!it) return;

        lastFocusedElement = document.activeElement;

        // set metadata and image
        if (modal) {
            // clear then set to avoid flicker
            if (modalImg) modalImg.src = '';
            if (modalImg) modalImg.alt = it.title || '';
            if (modalImg) modalImg.src = it.full || it.thumb || '';
            if (modalTitle) modalTitle.textContent = it.title || '';
            if (modalText) modalText.textContent = it.desc || '';
            if (modalMeta) modalMeta.textContent = it.date ? `Date: ${it.date}` : '';
        }

        preloadNearby(currentIndex);
    }

    function openModalUI() {
        if (!modal) return;
        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');

        // focus management
        if (modalClose) modalClose.focus();

        // scoped keyboard handler
        modalKeyHandler = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                closeModal();
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                showRelative(1);
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                showRelative(-1);
            }
        };
        document.addEventListener('keydown', modalKeyHandler);

        // install focus trap
        releaseFocusTrap = trapFocus(modal);
    }

    function closeModal() {
        if (!modal) return;
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');

        if (modalImg) modalImg.src = '';

        // remove key handler
        if (modalKeyHandler) {
            document.removeEventListener('keydown', modalKeyHandler);
            modalKeyHandler = null;
        }

        // release focus trap
        if (typeof releaseFocusTrap === 'function') {
            releaseFocusTrap();
            releaseFocusTrap = null;
        }

        // restore focus
        if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
            lastFocusedElement.focus();
        }

        // remove hash silently
        history.replaceState(null, '', location.pathname + location.search);

        currentIndex = -1;
    }

    function showRelative(offset) {
        if (filtered.length === 0) return;
        if (currentIndex === -1) {
            currentIndex = 0;
        } else {
            currentIndex = (currentIndex + offset + filtered.length) % filtered.length;
        }
        showCurrent();
        // update hash for new current
        if (filtered[currentIndex]?.id) {
            history.replaceState(null, '', `#${encodeURIComponent(filtered[currentIndex].id)}`);
        }
    }

    /* -------------------------
       Deep-link handling on load
       ------------------------- */
    function handleInitialHash() {
        const hash = decodeURIComponent((location.hash || '').replace(/^#/, ''));
        if (!hash) return;

        const foundIndex = filtered.findIndex(it => it.id === hash);
        if (foundIndex !== -1) {
            currentIndex = foundIndex;
            const neededPage = Math.floor(foundIndex / THUMBS_PER_PAGE);
            if (neededPage > 0) {
                grid.innerHTML = '';
                page = 0;
                for (let i = 0; i <= neededPage; i++) {
                    renderPage(false);
                }
            }
            const thumbEl = grid.querySelector(`.gallery-thumb[data-id="${hash}"]`);
            if (thumbEl) thumbEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            showCurrent();
            openModalUI();
        } else {
            // If not found, clear search and filters and try again
            if (searchInput && searchInput.value) {
                searchInput.value = '';
                applyFilters();
            }
            const activeBtn = filterButtons.find(b => b.classList.contains('active'));
            if (activeBtn && activeBtn.dataset.filter !== 'all') {
                const allBtn = filterButtons.find(b => b.dataset.filter === 'all');
                if (allBtn) {
                    filterButtons.forEach(b => b.classList.remove('active'));
                    allBtn.classList.add('active');
                    filterButtons.forEach(b => b.setAttribute('aria-selected', b.classList.contains('active')));
                }
                applyFilters();
            }
            const foundIndex2 = filtered.findIndex(it => it.id === hash);
            if (foundIndex2 !== -1) {
                currentIndex = foundIndex2;
                renderPage(true);
                showCurrent();
                openModalUI();
            }
        }
    }

    function updateHashIfNotFound() {
        const hash = decodeURIComponent((location.hash || '').replace(/^#/, ''));
        if (!hash) return;
        const found = filtered.some(it => it.id === hash);
        if (!found) {
            history.replaceState(null, '', location.pathname + location.search);
        }
    }

    /* -------------------------
       Utilities
       ------------------------- */
    function debounce(fn, wait = 150) {
        let t;
        return function (...args) {
            clearTimeout(t);
            t = setTimeout(() => fn.apply(this, args), wait);
        };
    }

    function trapFocus(modalEl) {
        if (!modalEl) return () => {};
        const focusableSelector = 'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])';
        const nodes = Array.from(modalEl.querySelectorAll(focusableSelector)).filter(n => n.offsetParent !== null);
        if (!nodes.length) return () => {};
        const first = nodes[0];
        const last = nodes[nodes.length - 1];

        function onKey(e) {
            if (e.key !== 'Tab') return;
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }

    function preloadNearby(index) {
        [-1, 1].forEach(delta => {
            const i = index + delta;
            if (i >= 0 && i < filtered.length) {
                const url = filtered[i].full || filtered[i].thumb;
                if (url) {
                    const p = new Image();
                    p.src = url;
                }
            }
        });
    }
});
