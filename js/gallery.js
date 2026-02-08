/* js/gallery.js */

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

    // Lazy-loading observer
    let lazyObserver = null;

    function initLazyObserver() {
        if (!('IntersectionObserver' in window)) return;

        lazyObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;

                const img = entry.target;
                if (!img.dataset || !img.dataset.src) {
                    observer.unobserve(img);
                    return;
                }

                // Swap placeholder for real image
                img.src = img.dataset.src;

                img.addEventListener('load', () => {
                    img.classList.add('loaded');
                    img.removeAttribute('loading'); // Stop browser-level lazy-loading once fetched
                    try { delete img.dataset.src; } catch (e) { }
                }, { once: true });

                observer.unobserve(img);
            });
        }, {
            rootMargin: '800px 0px', // Larger buffer to prevent "pop-in" while scrolling
            threshold: 0.01
        });
    }

    (async function init() {
        try {
            const resp = await fetch('gallery.json', { cache: 'no-store' });
            if (resp && resp.ok) {
                const data = await resp.json();
                allItems = normalizeData(data);
            } else {
                console.info('Falling back to DOM scan.');
                const domItems = scanCarouselImages();
                allItems = normalizeData(domItems);
            }
        } catch (err) {
            console.info('Error loading JSON, falling back to DOM scan.', err);
            const domItems = scanCarouselImages();
            allItems = normalizeData(domItems);
        }

        allItems = allItems.map((it, i) => ({
            id: it.id || slugify(it.title || `art-${i+1}`),
            ...it
        }));

        initLazyObserver();
        filtered = allItems.slice();
        renderPage(true);
        bindControls();
        handleInitialHash();
    })();

    function normalizeData(raw) {
        return (raw || []).map(r => ({
            thumb: r.thumb || r.thumbUrl || r.thumbSrc || r.src || '',
            full: r.full || r.fullUrl || r.fullSrc || r.dataset?.full || r.src || '',
            title: r.title?.trim() || r.name || r.alt || '',
            desc: r.desc || r.description || r.dataset?.desc || '',
            date: r.date || r.dataset?.date || '',
            collection: (r.collection || r.dataset?.collection || 'all').toString(),
            id: r.id || r.slug || ''
        }));
    }

    function scanCarouselImages() {
        const imgs = Array.from(document.querySelectorAll('.carousel-track img'));
        return imgs.map(img => ({
            thumb: img.dataset.thumb || img.src,
            full: img.dataset.full || img.src,
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
            .replace(/[^\w-]+/g, '')
            .replace(/-{2,}/g, '-')
            .replace(/^-+/, '')
            .replace(/-+$/, '') || `id-${Math.random().toString(36).slice(2,8)}`;
    }

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

        if (loadMoreBtn) {
            const hasMore = page * THUMBS_PER_PAGE < filtered.length;
            loadMoreBtn.disabled = !hasMore;
            loadMoreBtn.textContent = hasMore ? 'Load more' : 'No more items';
        }
    }

    function makeThumb(item) {
        const article = document.createElement('article');
        article.className = 'gallery-thumb';
        article.dataset.id = item.id;

        const btn = document.createElement('button');
        btn.className = 'thumb-btn';
        btn.type = 'button';
        btn.setAttribute('aria-label', `Open ${item.title}`);

        const img = document.createElement('img');
        img.className = 'thumb-img lazy';
        img.decoding = 'async';
        img.alt = item.title || '';

        // Transparent placeholder
        img.src = 'data:image/svg+xml;charset=utf-8,%3Csvg xmlns%3D%22http%3A//www.w3.org/2000/svg%22 width%3D%223%22 height%3D%222%22%3E%3C/svg%3E';
        img.dataset.src = item.thumb || item.full || '';
        img.dataset.full = item.full || '';

        btn.appendChild(img);
        article.appendChild(btn);

        const meta = document.createElement('div');
        meta.className = 'thumb-meta';
        const h = document.createElement('h4'); h.textContent = item.title;
        const t = document.createElement('time'); t.textContent = item.date;
        meta.appendChild(h);
        meta.appendChild(t);
        article.appendChild(meta);

        btn.addEventListener('click', () => openModalForItem(item));

        if (lazyObserver) {
            lazyObserver.observe(img);
        } else {
            img.src = img.dataset.src;
        }

        return article;
    }

    function bindControls() {
        filterButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                filterButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                applyFilters();
            });
        });

        if (searchInput) {
            searchInput.addEventListener('input', debounce(() => applyFilters(), 170));
        }

        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => renderPage(false));
        }

        if (modalClose) modalClose.addEventListener('click', closeModal);
        if (modalPrev) modalPrev.addEventListener('click', () => showRelative(-1));
        if (modalNext) modalNext.addEventListener('click', () => showRelative(1));

        if (modal) {
            modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
        }

        document.addEventListener('keydown', (e) => {
            if (modal?.style.display === 'flex') {
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
            const matchesQuery = !query || it.title.toLowerCase().includes(query) || it.desc.toLowerCase().includes(query);
            return matchesFilter && matchesQuery;
        });

        renderPage(true);
    }

    function openModalForItem(item) {
        currentIndex = filtered.findIndex(it => it.id === item.id);
        showCurrent();
    }

    function showCurrent() {
        if (currentIndex < 0 || currentIndex >= filtered.length) return;
        const it = filtered[currentIndex];
        lastFocusedElement = document.activeElement;

        modal.style.display = 'flex';
        modal.setAttribute('aria-hidden', 'false');
        modalImg.src = it.full || it.thumb;
        modalImg.alt = it.title;
        modalTitle.textContent = it.title;
        modalText.textContent = it.desc;
        modalMeta.textContent = it.date ? `Date: ${it.date}` : '';

        // Magnifier Integration
        if (typeof updateMagnifierSize === 'function') {
            const magLens = document.getElementById('magnifier-lens');
            const magContainer = document.getElementById('magnifier-container');
            if (magLens) magLens.style.backgroundImage = `url('${modalImg.src}')`;

            modalImg.onload = () => updateMagnifierSize();

            if (magContainer) {
                magContainer.addEventListener('mouseenter', window.showLens);
                magContainer.addEventListener('mouseleave', window.hideLens);
                magContainer.addEventListener('mousemove', window.handleMagnify);
            }
        }

        history.replaceState(null, '', `#${encodeURIComponent(it.id)}`);
    }

    function closeModal() {
        if (!modal) return;
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
        modalImg.src = '';

        const magContainer = document.getElementById('magnifier-container');
        if (magContainer) {
            magContainer.removeEventListener('mouseenter', window.showLens);
            magContainer.removeEventListener('mouseleave', window.hideLens);
            magContainer.removeEventListener('mousemove', window.handleMagnify);
        }

        if (lastFocusedElement) lastFocusedElement.focus({ preventScroll: true });
        history.replaceState(null, '', window.location.pathname + window.location.search);
        currentIndex = -1;
    }

    function showRelative(offset) {
        currentIndex = (currentIndex + offset + filtered.length) % filtered.length;
        showCurrent();
    }

    function handleInitialHash() {
        const hash = decodeURIComponent((location.hash || '').replace(/^#/, ''));
        if (!hash) return;
        const foundIndex = filtered.findIndex(it => it.id === hash);
        if (foundIndex !== -1) {
            currentIndex = foundIndex;
            const neededPage = Math.floor(foundIndex / THUMBS_PER_PAGE);
            for (let i = 0; i < neededPage; i++) renderPage(false);

            setTimeout(() => {
                const thumbEl = document.querySelector(`[data-id="${hash}"]`);
                if (thumbEl) thumbEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
            showCurrent();
        }
    }

    function debounce(fn, wait) {
        let t;
        return (...args) => {
            clearTimeout(t);
            t = setTimeout(() => fn.apply(this, args), wait);
        };
    }
});