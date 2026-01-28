/* Search feature for artwork (dimming non-matches) */
(function() {
  const debounce = (fn, wait = 180) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  };

  const normalize = (s) => (s || '').toString().toLowerCase();

  document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('site-search');
    const stats = document.getElementById('search-stats');
    const allImgs = Array.from(document.querySelectorAll('.carousel-track img'));

    if (!input) return;

    const index = allImgs.map(img => {
      const title = img.getAttribute('alt') || '';
      const desc = img.getAttribute('data-desc') || '';
      const date = img.getAttribute('data-date') || '';
      const filename = (img.getAttribute('src') || '').split('/').pop() || '';
      return { img, text: normalize([title, desc, date, filename].join(' → ')) };
    });

    const reset = () => {
      allImgs.forEach(i => i.classList.remove('search-dim'));
      if (stats) stats.textContent = '';
    };

    /**
     * performSearch(q, {scroll = false})
     * - scroll: whether to automatically scroll the first match into view.
     *
     * We'll avoid scrolling while the user types (scroll=false).
     * We'll only scroll when Enter is pressed or when the input dispatches a 'search' event.
     */
    const performSearch = (q, { scroll = false } = {}) => {
      const query = normalize(q).trim();
      if (!query) { reset(); return; }
      const terms = query.split(/\s+/).filter(Boolean);
      let matches = 0;
      index.forEach(entry => {
        const matched = terms.every(t => entry.text.includes(t));
        if (matched) { entry.img.classList.remove('search-dim'); matches++; }
        else { entry.img.classList.add('search-dim'); }
      });
      if (stats) stats.textContent = matches === 0 ? 'No results' : `${matches} result${matches !== 1 ? 's' : ''}`;

      // Only scroll into view if explicitly requested (Enter/search)
      if (scroll && matches > 0) {
        const first = index.find(e => !e.img.classList.contains('search-dim'));
        if (first && first.img) {
          const parentGlass = first.img.closest('.glass');
          if (parentGlass) parentGlass.scrollIntoView({ behavior: 'smooth', block: 'center' });
          else first.img.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    };

    // Debounced input: do NOT scroll while typing
    const debounced = debounce((e) => performSearch(e.target.value, { scroll: false }), 180);
    input.addEventListener('input', debounced);

    // Browser "search" event (e.g. clear button in some UIs) - treat as explicit search and allow scroll
    input.addEventListener('search', (e) => performSearch(e.target.value, { scroll: true }));

    // Key handling:
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        // Trigger search and scroll to first match
        performSearch(input.value, { scroll: true });

        // Keep focus on the input so user can continue typing if they want
        input.focus();
      }
      if (e.key === 'Escape') {
        input.value = '';
        reset();

        // Keep focus and select the input text (good UX)
        input.focus();
        if (typeof input.select === 'function') input.select();
      }
    });

    // Optional: clicking a result still works as before
    // document.querySelectorAll('.carousel-track img').forEach(img => {
    //   img.addEventListener('click', () => { /* your existing click behaviour */ });
    // });
  });
})();
