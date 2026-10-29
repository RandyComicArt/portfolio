export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function loadWorks() {
  const res = await fetch('gallery.json', { cache: 'no-store' });
  if (!res.ok) throw new Error(`Could not load gallery.json (${res.status})`);
  const data = await res.json();
  return (data || []).map((item, i) => ({
    id: item.id || `work-${i}`,
    thumb: item.thumb || item.full || '',
    full: item.full || item.thumb || '',
    title: (item.title || '').trim(),
    desc: (item.desc || '').trim(),
    date: (item.date || '').trim(),
    collection: item.collection || 'completed',
    project: (item.project || '').trim(),
    pixel: Boolean(item.pixel),
    clear: Boolean(item.pixel || item.transparent)
  }));
}

export function searchBlob(item) {
  return [item.title, item.desc, item.date, item.project, item.collection, item.id]
    .join(' ')
    .toLowerCase();
}

export function groupByProject(items) {
  const map = new Map();
  items.forEach((item) => {
    const key = item.project || 'Original';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  });
  return Array.from(map.entries());
}
