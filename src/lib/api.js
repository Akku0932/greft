// Use Vercel edge function proxy in production to avoid mixed content
const BASE_URL = typeof window !== 'undefined' && window.location?.protocol === 'https:'
  ? '/api/proxy-edge'
  : 'http://ger.visionhost.cloud:2056';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    ...options,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Request failed ${response.status}: ${text}`);
  }
  return response.json();
}

export const api = {
  hotUpdates: () => request('/hot-updates'),
  latestUpdates: (page) => page ? request(`/latest-updates?page=${encodeURIComponent(page)}`) : request('/latest-updates'),
  recommendations: () => request('/recommendations'),
  hotSeries: (range = 'weekly_views') => request(`/hot-series/${range}`),
  recentlyAdded: () => request('/recently-added'),
  random: () => request('/random'),
  search: async (q) => {
    const query = encodeURIComponent(q)
    const attempts = [
      `/search?q=${query}`,
      `/search/${query}`,
      `/search?query=${query}`,
      `/search?keyword=${query}`,
      `/search?q=${query}&limit=50`,
      `/search/${query}?limit=50`,
    ]
    const results = []
    for (const path of attempts) {
      try {
        const res = await request(path)
        results.push(res)
      } catch (_) { /* try next */ }
    }
    // Merge arrays/items into one unique list
    const all = results.flatMap(r => extractItems(r))
    const seen = new Set()
    const merged = []
    for (const it of all) {
      const key = it.seriesId || it.id || it._id || it.slug || it.title || it.name
      if (!key || seen.has(key)) continue
      seen.add(key)
      merged.push(it)
    }
    return { items: merged }
  },
  info: (id, titleId) => {
    const { id: baseId, titleId: safeTitle } = parseIdTitle(id, titleId)
    return request(`/info/${encodeURIComponent(baseId)}/${encodeURIComponent(safeTitle)}`)
  },
  chapters: (id) => request(`/chapters/${id}`),
  read: (id) => request(`/read/${id}`),
};

export function getImage(input) {
  const url = input || ''
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    if (typeof window !== 'undefined' && window.location?.protocol === 'https:' && url.startsWith('http://')) {
      // route insecure absolute images via proxy
      try {
        const u = new URL(url)
        return `/api/proxy${u.pathname}${u.search}`
      } catch {
        return url
      }
    }
    return url
  }
  if (url.startsWith('//')) return `https:${url}`
  if (url.startsWith('/')) return `${BASE_URL}${url}`
  return url
}

export function pickImage(obj = {}) {
  return (
    obj.thumbnail || obj.thumbnailUrl || obj.thumbnail_url ||
    obj.image || obj.imageUrl || obj.img || obj.cover || obj.coverUrl || ''
  )
}

export function sanitizeTitleId(value) {
  const v = String(value || 'x')
  return v.replace(/\/+title$/i, '').replace(/^\/+|\/+$/g, '') || 'x'
}

export function extractItems(payload) {
  if (!payload) return []
  if (Array.isArray(payload)) return payload
  if (payload.items && Array.isArray(payload.items)) return payload.items
  const arrayKey = Object.keys(payload).find(k => Array.isArray(payload[k]))
  return arrayKey ? payload[arrayKey] : []
}

export function parseIdTitle(idMaybeCombined, titleMaybe) {
  const raw = String(idMaybeCombined || '')
  if (raw.includes('/')) {
    const [idPart, titlePart] = raw.split('/')
    return { id: idPart, titleId: sanitizeTitleId(titlePart) }
  }
  return { id: raw, titleId: sanitizeTitleId(titleMaybe || '') }
}


