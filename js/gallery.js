/* js/gallery.js
   - Loads gallery data from gallery.json (recommended) or falls back to scanning
     .carousel-track img elements on the current page.
   - Renders a responsive grid, filters, search, "load more", and an accessible modal.
   - Expects the following DOM IDs/classes (matching gallery.html):
     #gallery-grid, #load-more, #gallery-search, .gallery-filters button,
     #image-modal, #modal-image, #description-title, #description-text, #description-meta,
     #modal-prev-btn, #modal-next-btn, #modal-close-btn
*/

document.addEventListener('DOMContentLoaded', () => {
    const THUMBS_PER_PAGE = 24;

    // UI elements
    const grid = document.getElementById('gallery-grid');
    const loadMoreBtn = document.getElementById('load-more');
    const searchInput = document.getElementById('gallery-search');
    const filterButtons = Array.from(document.querySelectorAll('.gallery-filters button'));

    // Modal elements (IDs must match markup)
    const modal = document.getElementById('image-modal');
    const modalImg = document.getElementById('modal-image');
    const modalTitle = document.getElementById('description-title');
    const modalText = document.getElementById('description-text');
    const modalMeta = document.getElementById('description-meta');
    const modalPrev = document.getElementById('modal-prev-btn');
    const modalNext = document.getElementById('modal-next-btn');
    const modalClose = document.getElementById('modal-close-btn');

    // App state
    let allItems = [];      // full dataset
    let filtered = [];      // current filtered set
    let page = 0;           // pagination page (0-based)
    let currentIndex = -1;  // index in filtered for modal
    let lastFocusedElement = null;

    // Lazy-loading observer (load each thumb once)
    let lazyObserver = null;

    function initLazyObserver() {
        if (!('IntersectionObserver' in window)) return;
        // small helper observer that loads the image once when it becomes near viewport
        lazyObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                const img = entry.target;
                // If no data-src (already loaded or not using lazy), stop observing
                if (!img.dataset || !img.dataset.src) {
                    observer.unobserve(img);
                    return;
                }

                // Set the real src only once
                img.src = img.dataset.src;

                // When loaded, add class and remove dataset marker
                img.addEventListener('load', () => {
                    img.classList.add('loaded');
                    // remove dataset.src to mark "already loaded once"
                    try { delete img.dataset.src; } catch (e) { /* ignore */ }
                }, { once: true });

                // stop observing this element
                observer.unobserve(img);
            });
        }, {
            rootMargin: '300px 0px', // preload a bit before it enters view
            threshold: 0.01
        });
    }

    // Entry: try to load gallery.json, otherwise scan DOM
    (async function init() {
        // Try to fetch gallery.json. If response is not OK or fetch fails, fall back to scanning DOM.
        try {
            const resp = await fetch('gallery.json', { cache: 'no-store' });
            if (resp && resp.ok) {
                const data = await resp.json();
                allItems = normalizeData(data);
            } else {
                // Not OK (404, 500, etc.) — fallback to scanning DOM
                console.info('gallery.js: gallery.json not found or not OK — falling back to scanning DOM.', resp && resp.status);
                const domItems = scanCarouselImages();
                allItems = normalizeData(domItems);
            }
        } catch (err) {
            // Network error or other unexpected fetch failure — fallback to scanning DOM
            console.info('gallery.js: error fetching gallery.json — falling back to scanning DOM.', err);
            const domItems = scanCarouselImages();
            allItems = normalizeData(domItems);
        }

        // ensure each item has an id (for deep linking)
        allItems = allItems.map((it, i) => ({ id: it.id || slugify(it.title || `art-${i+1}`), ...it }));

        // Initialize lazy observer before rendering thumbs so images get observed as we create them
        initLazyObserver();

        // initial filter & render
        filtered = allItems.slice();
        renderPage(true);

        // wire UI events
        bindControls();
        handleInitialHash();
    })();

    /* -------------------------
       Data helpers
       ------------------------- */
    function normalizeData(raw) {
        // raw may be array of objects with keys: thumb, full, title, desc, date, collection, id
        // or DOM-like objects from scanCarouselImages()
        return (raw || []).map(r => {
            return {
                thumb: r.thumb || r.thumbUrl || r.thumbSrc || r.src || '',
                full: r.full || r.fullUrl || r.fullSrc || r.dataset?.full || r.src || '',
                title: r.title?.trim() || r.name || r.alt || '',
                desc: r.desc || r.description || r.dataset?.desc || '',
                date: r.date || r.dataset?.date || '',
                collection: (r.collection || r.dataset?.collection || 'all').toString(),
                id: r.id || r.slug || ''
            };
        });
    }

    function scanCarouselImages() {
        const imgs = Array.from(document.querySelectorAll('.carousel-track img'));
        return imgs.map(img => {
            // Prefer dataset.full for full-size url, fallback to src
            return {
                thumb: img.dataset.thumb || img.src,
                full: img.dataset.full || img.src,
                title: img.alt || img.getAttribute('title') || '',
                desc: img.dataset.desc || img.getAttribute('data-desc') || '',
                date: img.dataset.date || img.getAttribute('data-date') || '',
                collection: (img.closest('.carousel-wrapper')?.dataset?.section) || (img.dataset.collection) || 'all',
                id: img.dataset.id || img.id || ''
            };
        });
    }

    function slugify(text = '') {
        // Simplified regexes to avoid redundant escapes and make lint happy
        return text.toString().toLowerCase()
            .replace(/\s+/g, '-')        // spaces -> dash
            .replace(/[^\w-]+/g, '')     // remove non-word except dash
            .replace(/-{2,}/g, '-')      // compress multiple dashes to one
            .replace(/^-+/, '')          // trim starting dashes
            .replace(/-+$/, '') || `id-${Math.random().toString(36).slice(2,8)}`;
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
        slice.forEach(item => grid.appendChild(makeThumb(item)));
        page++;

        // update load more button
        if (page * THUMBS_PER_PAGE >= filtered.length) {
            if (loadMoreBtn) {
                loadMoreBtn.disabled = true;
                loadMoreBtn.textContent = 'No more items';
            }
        } else {
            if (loadMoreBtn) {
                loadMoreBtn.disabled = false;
                loadMoreBtn.textContent = 'Load more';
            }
        }
    }

    // Updated makeThumb: uses data-src and lazyObserver so thumbs load once
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
        img.className = 'thumb-img lazy';
        img.loading = 'lazy';
        img.decoding = 'async';
        img.alt = item.title || '';

        // Minimal placeholder (transparent svg) to reserve space and avoid initial network request.
        img.src = 'data:image/svg+xml;charset=utf-8,%3Csvg xmlns%3D%22http%3A//www.w3.org/2000/svg%22 width%3D%223%22 height%3D%222%22%3E%3C/svg%3E';
        img.dataset.src = item.thumb || item.full || '';

        // store full url on dataset for modal
        img.dataset.full = item.full || item.thumb || '';
        // keep id on the element to support deep linking restore focus
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

        // click opens modal
        btn.addEventListener('click', () => openModalForItem(item));

        // observe image for lazy loading (if observer ready)
        if (lazyObserver) {
            lazyObserver.observe(img);
        } else {
            // fallback: load immediately
            if (img.dataset && img.dataset.src) {
                img.src = img.dataset.src;
                img.addEventListener('load', () => img.classList.add('loaded'), { once: true });
                try { delete img.dataset.src; } catch (e) { /* ignore */ }
            }
        }

        return article;
    }

    /* -------------------------
       Controls: filtering, search, load more
       ------------------------- */
    function bindControls() {
        // filters
        filterButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                filterButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                // update aria-selected
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
        // click outside to close
        if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

        // keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (modal && modal.style.display && modal.style.display !== 'none') {
                if (e.key === 'Escape') closeModal();
                if (e.key === 'ArrowRight') showRelative(1);
                if (e.key === 'ArrowLeft') showRelative(-1);
            }
        });
    }

    function applyFilters() {
        const query = (searchInput?.value || '').trim().toLowerCase();
        const activeBtn = filterButtons.find(b => b.classList.contains('active'));
        const activeFilter = activeBtn?.dataset?.filter || 'all';

        filtered = allItems.filter(it => {
            const matchesFilter = (activeFilter === 'all') || (it.collection === activeFilter);
            const title = (it.title || '').toLowerCase();
            const desc = (it.desc || '').toLowerCase();
            const matchesQuery = !query || title.includes(query) || desc.includes(query);
            return matchesFilter && matchesQuery;
        });

        // reset grid and render first page
        renderPage(true);
        // clear possible hash if the filtered set no longer contains the opened id
        updateHashIfNotFound();
    }

    /* -------------------------
       Modal / Lightbox
       ------------------------- */
    function openModalForItem(item) {
        // find index of item in filtered
        currentIndex = filtered.findIndex(it => (it.id || '') === (item.id || ''));
        if (currentIndex === -1) {
            // fallback: try to find by title
            currentIndex = filtered.findIndex(it => it.title === item.title);
        }
        showCurrent();
        // deep-link: update hash
        if (item.id) {
            history.replaceState(null, '', `#${encodeURIComponent(item.id)}`);
        }
    }

    function showCurrent() {
        if (currentIndex < 0 || currentIndex >= filtered.length) return;
        const it = filtered[currentIndex];
        if (!it) return;
        lastFocusedElement = document.activeElement;
        // open modal
        if (modal) {
            modal.style.display = 'flex';
            modal.setAttribute('aria-hidden', 'false');
            // set image
            modalImg.src = ''; // clear first to avoid flash of previous large image
            modalImg.alt = it.title || '';

            // set large image only when opening (avoid double downloads for grid thumbs)
            modalImg.src = it.full || it.thumb || '';

            // set metadata
            modalTitle.textContent = it.title || '';
            modalText.textContent = it.desc || '';
            modalMeta.textContent = it.date ? `Date: ${it.date}` : '';
            // focus on close button for keyboard users
            if (modalClose) modalClose.focus();
            // update hash
            if (it.id) {
                history.replaceState(null, '', `#${encodeURIComponent(it.id)}`);
            }
        }
    }

    function closeModal() {
        if (!modal) return;
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
        modalImg.src = '';
        // restore focus
        if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
            lastFocusedElement.focus();
        }
        // remove hash without adding a new history entry
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
    }

    /* -------------------------
       Deep-link handling on load
       ------------------------- */
    function handleInitialHash() {
        const hash = decodeURIComponent((location.hash || '').replace(/^#/, ''));
        if (!hash) return;
        // try to open the item with that id after data is ready (items already loaded here)
        const foundIndex = filtered.findIndex(it => it.id === hash);
        if (foundIndex !== -1) {
            currentIndex = foundIndex;
            // If item isn't yet rendered in the first page, render pages until it appears.
            const neededPage = Math.floor(foundIndex / THUMBS_PER_PAGE);
            if (neededPage > 0) {
                // render required pages
                grid.innerHTML = '';
                page = 0;
                for (let i = 0; i <= neededPage; i++) {
                    renderPage(false);
                }
            }
            // scroll to the thumb element to improve context
            const thumbEl = grid.querySelector(`[data-id="${hash}"], [data-id='${hash}']`) || grid.querySelector(`[data-id="${hash}"]`);
            if (thumbEl) thumbEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            showCurrent();
        } else {
            // If not found in filtered (maybe filters active), reset filters and search then try
            if (searchInput && searchInput.value) {
                searchInput.value = '';
                applyFilters();
            }
            const activeBtn = filterButtons.find(b => b.classList.contains('active'));
            if (activeBtn && activeBtn.dataset.filter !== 'all') {
                // set to "all"
                const allBtn = filterButtons.find(b => b.dataset.filter === 'all');
                if (allBtn) {
                    filterButtons.forEach(b => b.classList.remove('active'));
                    allBtn.classList.add('active');
                }
                applyFilters();
            }
            // Try again once
            const foundIndex2 = filtered.findIndex(it => it.id === hash);
            if (foundIndex2 !== -1) {
                currentIndex = foundIndex2;
                renderPage(true);
                showCurrent();
            }
        }
    }

    function updateHashIfNotFound() {
        const hash = decodeURIComponent((location.hash || '').replace(/^#/, ''));
        if (!hash) return;
        const found = filtered.some(it => it.id === hash);
        if (!found) {
            // remove the hash silently
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
});
