// gallery.js
document.addEventListener('DOMContentLoaded', () => {
    const THUMBS_PER_PAGE = 24;

    // UI elements
    const grid = document.getElementById('gallery-grid');
    const loadMoreBtn = document.getElementById('load-more');
    const searchInput = document.getElementById('site-search');
    const searchStats = document.getElementById('search-stats');
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
                img.src = img.dataset.src;
                img.addEventListener('load', () => {
                    img.classList.add('loaded');
                    img.removeAttribute('loading');
                }, { once: true });
                observer.unobserve(img);
            });
        }, { rootMargin: '800px 0px', threshold: 0.01 });
    }

    (async function init() {
        try {
            const resp = await fetch('gallery.json', { cache: 'no-store' });
            if (resp && resp.ok) {
                const data = await resp.json();
                allItems = normalizeData(data);
            } else {
                allItems = normalizeData(scanCarouselImages());
            }
        } catch (err) {
            allItems = normalizeData(scanCarouselImages());
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

        if (lazyObserver) lazyObserver.observe(img);
        else img.src = img.dataset.src;

        return article;
    }

    function bindControls() {
        filterButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                filterButtons.forEach(b => {
                    b.classList.remove('active');
                    b.setAttribute('aria-selected', 'false');
                });
                btn.classList.add('active');
                btn.setAttribute('aria-selected', 'true');
                applyFilters();
            });
        });

        if (searchInput) {
            searchInput.addEventListener('input', debounce(() => applyFilters(), 100));
        }

        if (loadMoreBtn) loadMoreBtn.addEventListener('click', () => renderPage(false));
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
            const matchesQuery = !query ||
                it.title.toLowerCase().includes(query) ||
                it.desc.toLowerCase().includes(query) ||
                it.date.toLowerCase().includes(query);
            return matchesFilter && matchesQuery;
        });

        if (searchStats) {
            searchStats.textContent = query === '' ? '' :
                (filtered.length === 0 ? 'No results' : `${filtered.length} result${filtered.length !== 1 ? 's' : ''}`);
        }
        renderPage(true);
    }

    // --- MODAL LOGIC WITH TRANSITIONS ---

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
        document.body.style.overflow = "hidden";

        // Initial setup without slide for the first click
        modalImg.style.transition = 'none';
        modalImg.style.left = '0';
        modalImg.style.opacity = 1;

        modalImg.src = it.full || it.thumb;
        modalImg.alt = it.title;
        modalTitle.textContent = it.title;
        modalText.textContent = it.desc;
        modalMeta.textContent = it.date ? `Date: ${it.date}` : '';

        const magLens = document.getElementById('magnifier-lens');
        if (magLens) magLens.style.backgroundImage = `url('${modalImg.src}')`;

        if (typeof window.updateMagnifierSize === 'function') {
            modalImg.onload = () => window.updateMagnifierSize();
        }

        updateNavButtons();
        history.replaceState(null, '', `#${encodeURIComponent(it.id)}`);
    }

    function showRelative(offset) {
        if (currentIndex === -1) return;
        const direction = offset > 0 ? 'next' : 'prev';
        currentIndex = (currentIndex + offset + filtered.length) % filtered.length;

        const it = filtered[currentIndex];
        performGalleryTransition(it, direction);
    }

    function performGalleryTransition(item, direction) {
        let slideDistance, resetDistance;
        if (direction === 'next') {
            slideDistance = '-100%'; resetDistance = '100%';
        } else {
            slideDistance = '100%'; resetDistance = '-100%';
        }

        // Slide out
        modalImg.style.left = slideDistance;
        modalImg.style.opacity = 0;

        setTimeout(() => {
            modalImg.style.transition = 'none';
            modalImg.style.left = resetDistance;

            // Swap Content
            modalImg.src = item.full || item.thumb;
            modalImg.alt = item.title;
            modalTitle.textContent = item.title;
            modalText.textContent = item.desc;
            modalMeta.textContent = item.date ? `Date: ${item.date}` : '';

            const magLens = document.getElementById('magnifier-lens');
            if (magLens) magLens.style.backgroundImage = `url('${modalImg.src}')`;

            // Slide In
            requestAnimationFrame(() => {
                modalImg.style.transition = 'left 300ms ease-out, opacity 100ms';
                modalImg.style.left = '0';
                modalImg.style.opacity = 1;

                if (typeof window.updateMagnifierSize === 'function') {
                    window.updateMagnifierSize();
                }
            });
        }, 300);

        updateNavButtons();
        history.replaceState(null, '', `#${encodeURIComponent(item.id)}`);
    }

    function updateNavButtons() {
        if (modalPrev) modalPrev.disabled = (currentIndex === 0);
        if (modalNext) modalNext.disabled = (currentIndex === filtered.length - 1);
    }

    function closeModal() {
        if (!modal) return;
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = "auto";
        modalImg.src = '';
        if (lastFocusedElement) lastFocusedElement.focus({ preventScroll: true });
        history.replaceState(null, '', window.location.pathname + window.location.search);
        currentIndex = -1;
    }

    function debounce(fn, wait) {
        let t;
        return (...args) => {
            clearTimeout(t);
            t = setTimeout(() => fn.apply(this, args), wait);
        };
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
});