// Use Vercel edge function proxy in production to avoid mixed content
const EDGE_BASE = '/api/gf'
const PLAIN_BASE = '/api/gf'
const IS_BROWSER = typeof window !== 'undefined'
const IS_HTTPS = IS_BROWSER && window.location?.protocol === 'https:'
const HOST = IS_BROWSER ? (window.location?.host || '') : ''
const IS_LOCAL = /localhost|127\.0\.0\.1/i.test(HOST)
const BASE_URL = IS_HTTPS ? EDGE_BASE : PLAIN_BASE

async function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(id)
  }
}

function getBaseFor(source) {
  if (source === 'mf') {
    // Always use dedicated MF edge function in all environments
    return '/api/mf'
  }
  return BASE_URL
}

function withSource(path, source) {
  if (!source) return path
  // Prefix only when using the edge proxy base
  const base = getBaseFor(source)
  if (source === 'mf') {
    // Dedicated edge function expects ?p=encodedPath
    return `?p=${encodeURIComponent(path)}`
  }
  return `?p=${encodeURIComponent(path)}`
}

async function request(path, options = {}, source) {
  const base = getBaseFor(source)
  const suffix = withSource(path, source)
  const url = suffix.startsWith('?') ? `${base}${suffix}` : `${base}${suffix}`;
  let response
  try {
    response = await fetchWithTimeout(url, {
      headers: { 'Accept': 'application/json' },
      ...options,
    }, 12000)
  } catch (_) {
    // One retry with shorter timeout
    response = await fetchWithTimeout(url, {
      headers: { 'Accept': 'application/json' },
      ...options,
    }, 8000)
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

function mapPathForSource(path, source) {
  if (!source || source !== 'mf') return path
  // Map generic endpoints to Mangafire-compatible endpoints
  if (path.startsWith('/hot-updates')) {
    const [base, qs] = path.split('?')
    return '/top-trending' + (qs ? `?${qs}` : '')
  }
  if (path.startsWith('/latest-updates')) {
    // Mangafire uses /recently-updated/:type; default to updated-manga
    const [base, qs] = path.split('?')
    return '/recently-updated/updated-manga' + (qs ? `?${qs}` : '')
  }
  if (path.startsWith('/recommendations')) {
    // Map recommendations to you-may-also-like for MF
    const [, , id] = path.split('/')
    return id ? `/you-may-also-like/${encodeURIComponent(id)}` : '/top-trending'
  }
  if (path.startsWith('/most-viewed')) {
    // Map most-viewed to MF most-viewed endpoint which returns { day, week, month }
    const [base, qs] = path.split('?')
    return '/most-viewed' + (qs ? `?${qs}` : '')
  }
  if (path.startsWith('/chapters/')) {
    // Fallback: language-scoped chapters: /chap-vol/:id/chapter/en
    const id = path.replace('/chapters/', '')
    return `/chap-vol/${encodeURIComponent(id)}/chapter/en`
  }
  if (path.startsWith('/read/chapter/')) {
    // For MF read endpoint: /read/chapter/:id
    return path
  }
  if (path.startsWith('/read/')) {
    // Fallback generic reader: /read/:type/:id with type=chapter
    const id = path.replace('/read/', '')
    return `/read/chapter/${encodeURIComponent(id)}`
  }
  if (path.startsWith('/info/')) {
    const [, , sid, title] = path.split('/')
    return `/info/${encodeURIComponent(sid || '')}`
  }
  return path
}

async function requestMapped(path, options = {}, source) {
  const mapped = mapPathForSource(path, source)
  return request(mapped, options, source)
}

export const api = {
  hotUpdates: (source) => requestMapped('/hot-updates', {}, source),
  latestUpdates: (page, source) => page ? requestMapped(`/latest-updates?page=${encodeURIComponent(page)}`, {}, source) : requestMapped('/latest-updates', {}, source),
  recommendations: (id, source) => {
    const path = id ? `/recommendations/${encodeURIComponent(id)}` : '/recommendations'
    return requestMapped(path, {}, source)
  },
  hotSeries: (range = 'weekly_views', source) => request(`/hot-series/${range}`, {}, source),
  mostViewed: (source) => requestMapped('/most-viewed', {}, source),
  recentlyAdded: (source) => request('/recently-added', {}, source),
  random: (source) => request('/random', {}, source),
  // Unified "new release" that hides the MF source detail from UI
  // Calls MF new-release endpoint directly
  newRelease: () => requestMapped('/new-release', {}, 'mf'),
  search: async (q, source) => {
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
    // Primary (GF) attempts
    for (const path of attempts) {
      try {
        const res = await requestMapped(path, {}, source)
        results.push(res)
      } catch (_) { /* try next */ }
    }
    // MF search (unlabeled, merged in)
    try {
      const mf = await requestMapped(`/category/filter?keyword=${query}`, {}, 'mf')
      if (mf && (Array.isArray(mf.data) || Array.isArray(mf.items))) {
        const arr = Array.isArray(mf.data) ? mf.data : mf.items
        const mapped = arr.map(item => ({
          id: item.id,
          seriesId: item.id,
          title: item.name,
          name: item.name,
          img: item.img,
          _source: 'mf'
        }))
        results.push(mapped)
      }
    } catch (_) {}
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
    // Deduplicate by normalized title, prefer MF entries if duplicates exist
    const byTitle = new Map()
    for (const it of merged) {
      const t = it._normTitle
      if (!t) continue
      const cur = byTitle.get(t)
      if (!cur) byTitle.set(t, it)
      else {
        const pick = (it._source === 'mf') ? it : (cur._source === 'mf' ? cur : it)
        byTitle.set(t, pick)
      }
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
  info: (id, titleId, source) => {
    const { id: baseId, titleId: safeTitle } = parseIdTitle(id, titleId)
    return requestMapped(`/info/${encodeURIComponent(baseId)}/${encodeURIComponent(safeTitle)}`, {}, source)
  },
  chapters: (id, source) => {
    if (source === 'mf') {
      // For MF, use /read-chap-vol/:id/:type/:language endpoint
      return requestMapped(`/read-chap-vol/${id}/chapter/en`, {}, source)
    }
    return requestMapped(`/chapters/${id}`, {}, source)
  },
  read: (id, source) => {
    if (source === 'mf') {
      // For MF, the id should be the numeric chapter ID directly
      // e.g., "5284528" -> "/read/chapter/5284528"
      return requestMapped(`/read/chapter/${id}`, {}, source)
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

      // Fetch MF types SEQUENTIALLY to avoid upstream rate limits/timeouts
      const mfTypes = ['updated-manhwa', 'updated-manga', 'updated-manhua']
      const mfResults = []
      for (const type of mfTypes) {
        try {
          const r = await requestMapped(`/recently-updated/${type}?page=${encodeURIComponent(page)}`, {}, 'mf')
          const arr = Array.isArray(r) ? r : (Array.isArray(r.items) ? r.items : [])
          mfResults.push({ status: 'fulfilled', value: arr })
        } catch (_) {
          mfResults.push({ status: 'rejected', reason: 'mf fetch failed' })
        }
      }

      // Fetch GF latest through our proxy as well (already handled by requestMapped base)
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

      // Combine all MF results
      const allMFItems = []
      for (const mfRes of mfResults) {
        if (mfRes.status === 'fulfilled' && Array.isArray(mfRes.value)) {
          const mfItems = mfRes.value.map(item => {
            const latestChapter = item.chapVol?.chap?.[0]
            const chapterNumber = latestChapter ? parseFloat(String(latestChapter.chap).replace(/[^0-9.]/g, '')) || 0 : 0
            return {
              id: item.id,
              seriesId: item.id,
              title: item.name,
              img: item.img,
              tag: latestChapter?.chap || '',
              updatedAt: latestChapter?.uploaded || '',
              uploadTime: toTimestamp(latestChapter?.uploaded || ''),
              _source: 'mf',
              chapterNumber,
            }
          })
          allMFItems.push(...mfItems)
        }
      }

      // Merge and de-duplicate by normalized title, prefer GF when duplicates exist; otherwise pick newer uploadTime
      const byTitle = new Map()
      const consider = (arr) => {
        for (const it of arr) {
          const key = normalizeTitleKey(it.title || it.name)
          if (!key) continue
          const current = byTitle.get(key)
          if (!current) {
            byTitle.set(key, it)
            continue
          }
          // Prefer GF if either is GF
          if ((current._source === 'greft') && (it._source !== 'greft')) {
            // keep GF
            continue
          }
          if ((it._source === 'greft') && (current._source !== 'greft')) {
            byTitle.set(key, it)
            continue
          }
          // Otherwise prefer newer uploadTime, then higher chapterNumber
          const curTime = current.uploadTime || 0
          const newTime = it.uploadTime || 0
          if (newTime > curTime) {
            byTitle.set(key, it)
            continue
          }
          const curChap = current.chapterNumber || 0
          const newChap = it.chapterNumber || 0
          if (newChap > curChap) byTitle.set(key, it)
        }
      }
      // Consider MF then GF so that GF can override where present
      consider(allMFItems)
      consider(gfItems)

      return Array.from(byTitle.values()).sort((a, b) => (b.uploadTime || 0) - (a.uploadTime || 0))
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

export function getImage(input) {
  const url = String(input || '')
  if (!url || url === 'undefined' || url === 'null') return ''
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    if (typeof window !== 'undefined' && window.location?.protocol === 'https:' && url.startsWith('http://')) {
      // route insecure absolute images via proxy
      return `/api/proxy-edge?url=${encodeURIComponent(url)}`
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


