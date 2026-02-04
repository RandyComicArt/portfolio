/* search.js — Live Update: Snaps carousel to front on every keystroke */
(function() {
  const debounce = (fn, wait = 50) => {
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

    if (!input) return;

    const tracks = Array.from(document.querySelectorAll('.carousel-track'));
    const snapshots = new Map();

    tracks.forEach(track => {
      const items = Array.from(track.children);
      items.forEach((el, i) => el.dataset.originalIndex = i);
      snapshots.set(track, items.slice());
    });

    const reset = () => {
      tracks.forEach(track => {
        Array.from(track.children).forEach(child => child.classList.remove('search-dim'));
        const original = snapshots.get(track);
        if (original) {
          const frag = document.createDocumentFragment();
          original.forEach(n => frag.appendChild(n));
          track.appendChild(frag);
        }

        window.dispatchEvent(new CustomEvent('carousel:reorder', {
          detail: { track: track, resetIndex: true }
        }));
      });
      if (stats) stats.textContent = '';
    };

    const performSearch = (q, { scroll = false } = {}) => {
      const query = normalize(q).trim();
      if (!query) { reset(); return; }
      const terms = query.split(/\s+/).filter(Boolean);

      let totalMatches = 0;

      tracks.forEach(track => {
        const items = Array.from(track.children);
        const matches = [];
        const nonMatches = [];

        items.forEach(item => {
          const title = item.getAttribute('alt') || '';
          const desc = item.getAttribute('data-desc') || '';
          const date = item.getAttribute('data-date') || '';
          const filename = (item.getAttribute('src') || '').split('/').pop() || '';
          const txt = normalize([title, desc, date, filename].join(' → '));

          const matched = terms.every(t => txt.includes(t));
          if (matched) {
            item.classList.remove('search-dim');
            matches.push(item);
          } else {
            item.classList.add('search-dim');
            nonMatches.push(item);
          }
        });

        totalMatches += matches.length;

        matches.sort((a,b) => (Number(a.dataset.originalIndex) - Number(b.dataset.originalIndex)));
        nonMatches.sort((a,b) => (Number(a.dataset.originalIndex) - Number(b.dataset.originalIndex)));

        const frag = document.createDocumentFragment();
        matches.forEach(m => frag.appendChild(m));
        nonMatches.forEach(n => frag.appendChild(n));
        track.appendChild(frag);

        // ALWAYS resetIndex: true so it snaps to front while typing
        window.dispatchEvent(new CustomEvent('carousel:reorder', {
          detail: {
            track: track,
            resetIndex: true
          }
        }));
      });

      if (stats) stats.textContent = totalMatches === 0 ? 'No results' : `${totalMatches} result${totalMatches !== 1 ? 's' : ''}`;

      // We keep the vertical scroll-into-view reserved for Enter/Search
      // so the page doesn't jump up and down while you are typing.
      if (scroll && totalMatches > 0) {
        setTimeout(() => {
          const firstTrackWithMatch = tracks.find(track =>
              Array.from(track.children).some(child => !child.classList.contains('search-dim'))
          );
          if (firstTrackWithMatch) {
            const wrapper = firstTrackWithMatch.closest('.carousel-wrapper') || firstTrackWithMatch;
            wrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
      }
    };

    // Triggered on every character change
    const debounced = debounce((e) => performSearch(e.target.value, { scroll: false }), 50);
    input.addEventListener('input', debounced);

    input.addEventListener('search', (e) => performSearch(e.target.value, { scroll: true }));

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        performSearch(input.value, { scroll: true });
        input.focus();
      }
      if (e.key === 'Escape') {
        input.value = '';
        reset();
        input.focus();
      }
    });
  });
})();