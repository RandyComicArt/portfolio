/* search.js — improved: bring matches to front and avoid auto-scroll while typing */
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

    if (!input) return;

    // Build an index for each carousel-track (we'll keep this lightweight — canonical source of truth is the DOM)
    const tracks = Array.from(document.querySelectorAll('.carousel-track'));

    // Helper: reset all dims and (optionally) restore original order if you keep a snapshot
    // We'll keep a snapshot of original ordering per track so we can preserve relative order among matches/non-matches.
    const snapshots = new Map();
    tracks.forEach(track => {
      const items = Array.from(track.children); // images
      // attach a stable original index on element
      items.forEach((el, i) => el.dataset.originalIndex = i);
      snapshots.set(track, items.slice()); // shallow copy snapshot of DOM nodes in original order
    });

    const reset = () => {
      tracks.forEach(track => {
        Array.from(track.children).forEach(child => child.classList.remove('search-dim'));
        // restore original order (uncomment if you want clearing the search to restore original order)
        const original = snapshots.get(track);
        if (original) {
          const frag = document.createDocumentFragment();
          original.forEach(n => frag.appendChild(n));
          track.appendChild(frag);
        }
      });
      if (stats) stats.textContent = '';
      // tell carousels to refresh after reset
      window.dispatchEvent(new CustomEvent('carousel:reorder', { detail: { reason: 'reset' } }));
    };

    /**
     * performSearch(q, { scroll = false })
     * - scroll: whether to scroll to front (explicit Enter / search event)
     */
    const performSearch = (q, { scroll = false } = {}) => {
      const query = normalize(q).trim();
      if (!query) { reset(); return; }
      const terms = query.split(/\s+/).filter(Boolean);

      let totalMatches = 0;

      tracks.forEach(track => {
        const items = Array.from(track.children); // current items (img elements)
        const matches = [];
        const nonMatches = [];

        items.forEach(item => {
          // build searchable text from attributes (same fields you're already using)
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

        // Reorder DOM: append matches first (preserve their original relative order), then nonMatches
        // Use originalIndex to preserve the original relative ordering inside each group
        matches.sort((a,b) => (Number(a.dataset.originalIndex) - Number(b.dataset.originalIndex)));
        nonMatches.sort((a,b) => (Number(a.dataset.originalIndex) - Number(b.dataset.originalIndex)));

        const frag = document.createDocumentFragment();
        matches.forEach(m => frag.appendChild(m));
        nonMatches.forEach(n => frag.appendChild(n));
        track.appendChild(frag);

        // After changing DOM order, notify carousel to recalc for this track
        window.dispatchEvent(new CustomEvent('carousel:reorder', { detail: { track } }));
      });

      if (stats) stats.textContent = totalMatches === 0 ? 'No results' : `${totalMatches} result${totalMatches !== 1 ? 's' : ''}`;

      // Only scroll to the start of the track when explicitly requested (Enter/search)
      if (scroll && totalMatches > 0) {
        // Option: scroll the first matching track into view. We'll scroll the nearest track containing a match.
        const firstTrackWithMatch = tracks.find(track => Array.from(track.children).some(child => !child.classList.contains('search-dim')));
        if (firstTrackWithMatch) {
          const wrapper = firstTrackWithMatch.closest('.carousel-wrapper');
          if (wrapper) wrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
          else firstTrackWithMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    };

    // Debounced input: do NOT scroll while typing
    const debounced = debounce((e) => performSearch(e.target.value, { scroll: false }), 180);
    input.addEventListener('input', debounced);

    // Browser "search" event: treat as explicit search (scroll allowed)
    input.addEventListener('search', (e) => performSearch(e.target.value, { scroll: true }));

    // Key handling:
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        performSearch(input.value, { scroll: true });
        input.focus();
      }
      if (e.key === 'Escape') {
        input.value = '';
        reset();
        input.focus();
        if (typeof input.select === 'function') input.select();
      }
    });

  });
})();
