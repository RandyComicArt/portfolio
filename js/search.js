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

    const performSearch = (q) => {
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
      if (matches > 0) {
        const first = index.find(e => !e.img.classList.contains('search-dim'));
        if (first && first.img) {
          const parentGlass = first.img.closest('.glass');
          if (parentGlass) parentGlass.scrollIntoView({ behavior: 'smooth', block: 'center' });
          else first.img.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    };

    const debounced = debounce((e) => performSearch(e.target.value), 180);
    input.addEventListener('input', debounced);
    input.addEventListener('search', (e) => performSearch(e.target.value));

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const first = Array.from(document.querySelectorAll('.carousel-track img')).find(img => !img.classList.contains('search-dim'));
        if (first) first.click();
      }
      if (e.key === 'Escape') {
        input.value = '';
        reset();
      }
    });
  });
})();
