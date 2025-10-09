// Use Vercel edge function proxy in production to avoid mixed content
const EDGE_BASE = '/api/gf'
const PLAIN_BASE = '/api/gf'
const IS_BROWSER = typeof window !== 'undefined'
const IS_HTTPS = IS_BROWSER && window.location?.protocol === 'https:'
const HOST = IS_BROWSER ? (window.location?.host || '') : ''
const IS_LOCAL = /localhost|127\.0\.0\.1/i.test(HOST)
const BASE_URL = IS_HTTPS ? EDGE_BASE : PLAIN_BASE

// Simple in-memory cache for MP data
const mpCache = new Map()
const CACHE_TTL = 10 * 60 * 1000 // 10 minutes (longer cache for better performance)

function getCached(key) {
  const cached = mpCache.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data
  }
  mpCache.delete(key)
  return null
}

function setCached(key, data) {
  mpCache.set(key, { data, timestamp: Date.now() })
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(id)
  }
}

// Ultra-fast fetch with minimal timeouts and parallel retries for MP
async function fastFetch(url, options = {}, maxRetries = 1) {
  // Try multiple timeouts in parallel for fastest response
  const timeouts = [1500, 3000] // 1.5s, 3s
  const promises = timeouts.map(timeout => 
    fetchWithTimeout(url, options, timeout).catch(e => ({ error: e, timeout }))
  )
  
  try {
    const results = await Promise.allSettled(promises)
    for (const result of results) {
      if (result.status === 'fulfilled' && !result.value.error) {
        return result.value
      }
    }
    throw new Error('All fast attempts failed')
  } catch (e) {
    // Final fallback with longer timeout
    return fetchWithTimeout(url, options, 5000)
  }
}

function getBaseFor(source) {
  if (source === 'mp') return '/api/mp'
  return BASE_URL
}

function withSource(path, source) {
  // Always use query form for both MF and GF so our edge functions receive ?p=...
  const isMF = source === 'mf'
  return `?p=${encodeURIComponent(path)}`
}

async function request(path, options = {}, source) {
  const base = getBaseFor(source)
  const suffix = withSource(path, source)
  const url = suffix.startsWith('?') ? `${base}${suffix}` : `${base}${suffix}`;
  
  // Use ultra-fast fetch for MP requests
  const fetchFn = source === 'mp' ? fastFetch : fetchWithTimeout
  const defaultTimeout = source === 'mp' ? 1500 : 12000
  
  let response
  try {
    response = await fetchFn(url, {
      headers: { 'Accept': 'application/json' },
      ...options,
    }, options.timeoutMs || defaultTimeout)
  } catch (_) {
    // One retry with shorter timeout
    response = await fetchFn(url, {
      headers: { 'Accept': 'application/json' },
      ...options,
    }, Math.min(8000, (options.timeoutMs ? Math.max(2000, Math.floor(options.timeoutMs / 2)) : 8000)))
  }
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Request failed ${response.status}: ${text}`);
  }
  const ct = response.headers.get('content-type') || ''
  if (!ct.includes('application/json')) {
    const text = await response.text()
    try { return JSON.parse(text) } catch {
      throw new Error(`Invalid JSON from ${url}: ${text.slice(0, 200)}`)
    }
  }
  return response.json();
}

function mapPathForSource(path, source) { return path }

async function requestMapped(path, options = {}, source) {
  const mapped = mapPathForSource(path, source)
  return request(mapped, options, source)
}

export const api = {
  hotUpdates: (source) => requestMapped('/hot-updates', {}, 'gf'),
  latestUpdates: (page, source) => page ? requestMapped(`/latest-updates?page=${encodeURIComponent(page)}`, {}, 'gf') : requestMapped('/latest-updates', {}, 'gf'),
  recommendations: (id, source) => {
    const path = id ? `/recommendations/${encodeURIComponent(id)}` : '/recommendations'
    return requestMapped(path, {}, 'gf')
  },
  hotSeries: (range = 'weekly_views', source) => request(`/hot-series/${range}`, {}, 'gf'),
  recentlyAdded: (source) => request('/recently-added', {}, source),
  random: (source) => request('/random', {}, source),
  // Removed MF-only endpoints: mostViewed and newRelease
  search: async (q, source) => {
    const query = encodeURIComponent(q)
    const gfPaths = [
      `/search?q=${query}`,
      `/search/${query}`,
      `/search?query=${query}`,
      `/search?keyword=${query}`,
    ]
    // Run GF and MF searches in parallel to cut latency
    // Run with aggressive timeouts to keep UX snappy
    const settled = await Promise.allSettled([
      ...gfPaths.map(p => requestMapped(p, { timeoutMs: 7000 }, 'gf')),
      // MP search
      requestMapped(`/search?keyword=${query}`, { timeoutMs: 7000 }, 'mp')
        .then(v => ({ _mp: true, v }))
    ])
    const results = []
    for (const s of settled) {
      if (s.status !== 'fulfilled' || !s.value) continue
      if (s.value && s.value._mp) {
        const payload = s.value.v
        if (Array.isArray(payload)) {
          results.push(payload.map(it => normalizeMpListItem(it)))
        } else if (payload && Array.isArray(payload.items)) {
          results.push(payload.items.map(it => normalizeMpListItem(it)))
        } else {
          results.push(payload)
        }
      } else {
        results.push(s.value)
      }
    }
    // Merge arrays/items into one unique list
    const all = results.flatMap(r => extractItems(r))
    const seen = new Set()
    const merged = []
    for (const it of all) {
      const normTitle = String((it.title || it.name || '')).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
      const key = it.seriesId || it.id || it._id || it.slug || normTitle
      if (!key || seen.has(key)) continue
      seen.add(key)
      merged.push({ ...it, _normTitle: normTitle })
    }
    // Deduplicate by normalized title
    const byTitle = new Map()
    for (const it of merged) {
      const t = it._normTitle
      if (!t) continue
      if (!byTitle.has(t)) byTitle.set(t, it)
    }
    const deduped = Array.from(byTitle.values())
    // Position/quality scoring - put strongest matches first
    const qNorm = String(q || '').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
    const qTokens = qNorm.split(' ').filter(Boolean)
    const startsWith = (title, tokens) => title.startsWith(tokens.join(' '))
    const containsInOrder = (title, tokens) => {
      let idx = 0
      for (const t of tokens) {
        const found = title.indexOf(t, idx)
        if (found === -1) return false
        idx = found + t.length
      }
      return true
    }
    const scoreItem = (it) => {
      const title = it._normTitle || ''
      if (!qNorm) return 0
      if (title === qNorm) return 1000
      let s = 0
      if (startsWith(title, qTokens)) s += 800
      if (containsInOrder(title, qTokens)) s += 300
      // token coverage
      for (const t of qTokens) if (title.includes(t)) s += 50
      // shorter titles that start with query get a small boost
      if (startsWith(title, qTokens)) s += Math.max(0, 100 - title.length)
      return s
    }
    deduped.sort((a, b) => {
      const sa = scoreItem(a)
      const sb = scoreItem(b)
      if (sb !== sa) return sb - sa
      // fallback: keep existing order
      return 0
    })
    return { items: deduped.map(({ _normTitle, ...rest }) => rest) }
  },
  info: async (id, titleId, source) => {
    const { id: baseId, titleId: safeTitle } = parseIdTitle(id, titleId)
    if (source === 'mp') {
      const cacheKey = `mp-info-${baseId}`
      const cached = getCached(cacheKey)
      if (cached) return cached
      
      // Use ultra-fast timeout for first load
      const result = await requestMapped(`/info/${encodeURIComponent(baseId)}`, { timeoutMs: 1500 }, 'mp')
      setCached(cacheKey, result)
      return result
    }
    // For GF: support both /info/:id and /info/:id/:title
    if (safeTitle) {
      return requestMapped(`/info/${encodeURIComponent(baseId)}/${encodeURIComponent(safeTitle)}`, {}, 'gf')
    }
    return requestMapped(`/info/${encodeURIComponent(baseId)}`, {}, 'gf')
  },
  chapters: async (id, source) => {
    if (source === 'mp') {
      const cacheKey = `mp-chapters-${id}`
      const cached = getCached(cacheKey)
      if (cached) return cached
      
      // Use ultra-fast timeout for first load
      const result = await requestMapped(`/chapters/${id}`, { timeoutMs: 1500 }, 'mp')
      setCached(cacheKey, result)
      return result
    }
    return requestMapped(`/chapters/${id}`, {}, source)
  },
  // For MP, ctx should include { seriesId }
  read: (id, source, ctx = {}) => {
    if (source === 'mp') {
      const seriesId = ctx.seriesId || ''
      return requestMapped(`/images/${encodeURIComponent(seriesId)}/${encodeURIComponent(id)}`, {}, 'mp')
    }
    return requestMapped(`/read/${id}`, {}, source)
  },

  // Combined helpers
  combined: {
    async mergeUniqueByKey(promises, keyPickers = []) {
      const results = await Promise.allSettled(promises)
      const arrays = results.flatMap(r => r.status === 'fulfilled' ? extractItems(r.value) : [])
      const seen = new Set()
      const pickKey = (it) => {
        for (const fn of keyPickers) { try { const k = fn(it); if (k) return k } catch {} }
        return it.seriesId || it.id || it.slug || it.urlId || it.title || it.name
      }
      const merged = []
      for (const it of arrays) {
        const k = pickKey(it)
        if (!k || seen.has(k)) continue
        seen.add(k)
        merged.push(it)
      }
      return merged
    },
    latestUpdates: async (page = 1) => {
      const normalizeTitleKey = (s) => String((s || '').toLowerCase())
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\b(the|a|an)\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

      const toTimestamp = (value) => {
        if (!value) return 0
        if (typeof value === 'number') return value < 1e12 ? value * 1000 : value
        const str = String(value).toLowerCase()
        const now = Date.now()
        const num = parseInt(str.match(/(\d+)/)?.[1] || '0')
        if (str.includes('minute')) return now - num * 60 * 1000
        if (str.includes('hour')) return now - num * 60 * 60 * 1000
        if (str.includes('day')) return now - num * 24 * 60 * 60 * 1000
        const parsed = Date.parse(value)
        return Number.isNaN(parsed) ? 0 : parsed
      }

      // Fetch GF latest through our proxy
      let gfRes
      try {
        const raw = await api.latestUpdates(page)
        gfRes = { status: 'fulfilled', value: raw }
      } catch (e) {
        gfRes = { status: 'rejected', reason: e }
      }

      const gfItems = gfRes && gfRes.status === 'fulfilled' ? extractItems(gfRes.value).map(it => ({
        ...it,
        _source: 'greft',
        uploadTime: toTimestamp(it.updatedAt || it.time || it.date || it.updated || it.lastUpdate)
      })) : []

      // Fetch MP latest-releases with pagination
      let mpItems = []
      try {
        const mpRaw = await requestMapped(`/latest-releases?page=${encodeURIComponent(page)}`, {}, 'mp')
        const mpArr = extractItems(mpRaw)
        mpItems = (mpArr || []).map(row => {
          const d = row?.data || {}
          const last = Array.isArray(d.last_chapterNodes) && d.last_chapterNodes.length ? d.last_chapterNodes[0]?.data : null
          const updatedAt = last?.dateCreate || null
          const rawImg = d.urlCover600 || d.urlCoverOri || d.urlCover || ''
          const img = rawImg ? `/api/mp?p=${encodeURIComponent((rawImg.startsWith('/') ? rawImg.slice(1) : rawImg))}` : ''
          return {
            id: String(d.id || row.id || ''),
            seriesId: String(d.id || row.id || ''),
            title: d.name || row.name,
            img,
            tag: last?.dname || '',
            updatedAt,
            uploadTime: typeof updatedAt === 'number' ? updatedAt : toTimestamp(updatedAt),
            _source: 'mp',
          }
        })
      } catch {}

      // Merge and de-duplicate by ID first, then by normalized title
      const byId = new Map()
      const byTitle = new Map()
      
      const consider = (arr) => {
        for (const it of arr) {
          const id = it.id || it.seriesId
          const titleKey = normalizeTitleKey(it.title || it.name)
          
          // Prefer by ID first (exact match)
          if (id && byId.has(id)) {
            const current = byId.get(id)
            const curTime = current.uploadTime || 0
            const newTime = it.uploadTime || 0
            if (newTime > curTime) {
              byId.set(id, it)
            }
            continue
          }
          
          if (id) {
            byId.set(id, it)
            continue
          }
          
          // Fallback to title-based deduplication
          if (!titleKey) continue
          const current = byTitle.get(titleKey)
          if (!current) {
            byTitle.set(titleKey, it)
            continue
          }
          const curTime = current.uploadTime || 0
          const newTime = it.uploadTime || 0
          if (newTime > curTime) {
            byTitle.set(titleKey, it)
          }
        }
      }
      
      consider(gfItems)
      consider(mpItems)

      // Combine results, preferring ID-based matches
      const combined = [...byId.values(), ...byTitle.values()]
      return combined.sort((a, b) => (b.uploadTime || 0) - (a.uploadTime || 0))
    },
    hotUpdates: async () => {
      // Use top-trending for MF hot updates
      const results = await Promise.allSettled([
        api.hotUpdates().catch(() => ({ items: [] })),
        requestMapped('/top-trending', {}, 'mf')
          .then(res => Array.isArray(res) ? res : (Array.isArray(res.items) ? res.items : []))
          .catch(() => [])
      ])
      
      // Transform MF trending data to match expected format
      const transformMFTrendingData = (mfData) => {
        if (!Array.isArray(mfData)) return []
        return mfData.map(item => {
          // Extract chapter number from chapVol string like "Chap 383 - Vol 37"
          const chapMatch = item.chapVol?.match(/Chap (\d+)/)
          const chapterNumber = chapMatch ? parseInt(chapMatch[1]) : 0
          
          return {
            id: item.id,
            seriesId: item.id,
            title: item.name,
            img: item.img,
            tag: item.chapVol || '',
            updatedAt: 'Trending',
            _source: 'mf',
            chapterNumber: chapterNumber,
            description: item.description,
            status: item.status,
            genres: item.genres || []
          }
        })
      }

      const withSource = (arr, source) => (arr || []).map(it => ({ ...it, _source: source }))
      const left = results[0].status === 'fulfilled' ? withSource(extractItems(results[0].value), 'greft') : []
      const right = results[1].status === 'fulfilled' ? transformMFTrendingData(results[1].value) : []

      const normalizeTitleKey = (s) => String((s || '').toLowerCase())
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\b(the|a|an)\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

      const parseChapterNumber = (it) => {
        return it.chapterNumber || 0
      }

      const byTitle = new Map()
      const consider = (arr) => {
        for (const it of arr) {
          const title = it.title || it.name || (it.info && (it.info.title || it.info.name)) || ''
          const key = normalizeTitleKey(title)
          if (!key) continue
          const score = parseChapterNumber(it)
          const current = byTitle.get(key)
          if (!current) {
            byTitle.set(key, { item: it, score })
            continue
          }
          // Prefer GF when duplicates exist
          if ((current.item._source === 'greft') && (it._source !== 'greft')) continue
          if ((it._source === 'greft') && (current.item._source !== 'greft')) {
            byTitle.set(key, { item: it, score })
            continue
          }
          if (score > current.score) byTitle.set(key, { item: it, score })
        }
      }
      // Consider MF first, then GF to allow GF overrides
      consider(right)
      consider(left)

      return Array.from(byTitle.values()).map(v => v.item)
    },
  }
};

// Dedicated MP endpoints, mirroring server routes
export const mp = {
  base: (path) => requestMapped(path, {}, 'mp'),
  popularUpdates: () => requestMapped('/popular-updates', {}, 'mp'),
  memberUploads: () => requestMapped('/member-uploads', {}, 'mp'),
  latestReleases: () => requestMapped('/latest-releases', {}, 'mp'),
  randomMangas: () => requestMapped('/random', {}, 'mp'),
  yWeekList: () => requestMapped('/yweek-list', {}, 'mp'),
  mplistsWeekly: (yweek) => requestMapped(`/mplists-weekly/${encodeURIComponent(yweek)}`, {}, 'mp'),
  newlyAdded: () => requestMapped('/newly-added', {}, 'mp'),
  mostLikes: () => requestMapped('/most-likes', {}, 'mp'),
  search: (q) => requestMapped(`/search?keyword=${encodeURIComponent(q)}`, {}, 'mp'),
  info: (id) => requestMapped(`/info/${encodeURIComponent(id)}`, {}, 'mp'),
  chapters: (id) => requestMapped(`/chapters/${encodeURIComponent(id)}`, {}, 'mp'),
  images: (infoId, id) => requestMapped(`/images/${encodeURIComponent(infoId)}/${encodeURIComponent(id)}`, {}, 'mp'),
}

export function getImage(input) {
  const url = String(input || '')
  if (!url || url === 'undefined' || url === 'null') return ''
  
  // Don't process already-proxied URLs
  if (url.startsWith('/api/mp?p=') || url.startsWith('/api/gf?p=') || url.startsWith('/api/proxy-edge?url=')) {
    return url
  }
  
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    if (typeof window !== 'undefined' && window.location?.protocol === 'https:' && url.startsWith('http://')) {
      // route insecure absolute images via proxy
      return `/api/proxy-edge?url=${encodeURIComponent(url)}`
    }
    // Allow direct mangapark.com thumbnails
    if (/^https?:\/\/mangapark\.com\/thumb\//i.test(url)) return url
    return url
  }
  if (url.startsWith('//')) return `https:${url}`
  if (url.startsWith('/')) {
    // Route MP asset paths via MP proxy; others via GF base
    const lower = url.toLowerCase()
    const isMpAsset = /\/(mpim|mpav|ampi|amim)\//.test(lower) || lower.startsWith('/thumb/') || lower.startsWith('/media/')
    if (isMpAsset) {
      const path = url.replace(/^\/+/, '')
      return `/api/mp?p=${encodeURIComponent(path)}`
    }
    // Only use BASE_URL for non-MP assets
    return `${BASE_URL}${url}`
  }
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

// Helpers for MP normalization
function toMpAbsolute(raw) {
  const s = String(raw || '')
  if (!s) return ''
  if (s.startsWith('http://') || s.startsWith('https://')) return s
  // Prefer proxy for reliability and CORS
  return `/api/mp?p=${encodeURIComponent((s.startsWith('/') ? s.slice(1) : s))}`
}

function normalizeMpListItem(it) {
  // Support both flat and { id, data } shapes
  const data = it?.data || it
  const id = String(data?.id || it?.id || '')
  const title = data?.name || it?.name || it?.title || ''
  const rawImg = data?.urlCover600 || data?.urlCoverOri || data?.urlCover || it?.img || ''
  const img = rawImg ? toMpAbsolute(rawImg) : ''
  return { ...it, id, seriesId: id, title, img, _source: 'mp' }
}


