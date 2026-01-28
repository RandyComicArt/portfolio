
/* Search feature for artwork */
(function() {
  const debounce = (fn, wait = 200) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  };

  function normalize(text) {
    return (text || '').toString().toLowerCase();
  }

  document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('site-search');
    const stats = document.getElementById('search-stats');

    // Collect all images from carousel tracks
    const allImgs = Array.from(document.querySelectorAll('.carousel-track img'));
    if (!input || allImgs.length === 0) {
      if (stats) stats.textContent = '';
      return;
    }

    // Build a searchable index
    const index = allImgs.map(img => {
      const title = img.getAttribute('alt') || '';
      const desc = img.getAttribute('data-desc') || '';
      const date = img.getAttribute('data-date') || '';
      const filename = (img.getAttribute('src') || '').split('/').pop() || '';
      const text = [title, desc, date, filename].join(' \u2192 ');
      return {
        img,
        textNorm: normalize(text)
      };
    });

    function performSearch(q) {
      const query = normalize(q).trim();
      if (!query) {
        // reset: show all images
        allImgs.forEach(i => i.classList.remove('search-hidden', 'search-dim'));
        if (stats) stats.textContent = '';
        return;
      }

      // split into terms (AND logic)
      const terms = query.split(/\s+/).filter(Boolean);

      let matches = 0;
      index.forEach(entry => {
        const matched = terms.every(term => entry.textNorm.indexOf(term) !== -1);
        if (matched) {
          entry.img.classList.remove('search-hidden');
          entry.img.classList.remove('search-dim');
          matches++;
        } else {
          entry.img.classList.add('search-dim');
        }
      });

      // Update stats
      if (stats) {
        stats.textContent = matches === 0 ? 'No results' : `${matches} result${matches !== 1 ? 's' : ''}`;
      }

      // If there are matches, scroll first into view and focus it
      if (matches > 0) {
        const first = index.find(e => !e.img.classList.contains('search-hidden'));
        if (first && first.img) {
          const parentGlass = first.img.closest('.glass');
          if (parentGlass) {
            // briefly add a ':focus' like effect
            parentGlass.scrollIntoView({ behavior: 'smooth', block: 'center' });
          } else {
            first.img.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      }
    }

    const debounced = debounce((e) => performSearch(e.target.value), 180);

    input.addEventListener('input', debounced);
    input.addEventListener('search', (e) => performSearch(e.target.value));

    // Allow Enter to focus first result in active carousel
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const first = Array.from(document.querySelectorAll('.carousel-track img')).find(img => !img.classList.contains('search-hidden'));
        if (first) {
          first.click();
        }
      }
      if (e.key === 'Escape') {
        input.value = '';
        performSearch('');
      }
    });

  });
})();
