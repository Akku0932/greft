import { useEffect, useState, useCallback } from 'react'
import { extractItems, getImage, pickImage, parseIdTitle } from '../lib/api.js'

export default function NewlyAdded() {
  const [items, setItems] = useState([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const TTL = 15 * 60 * 1000

  function readTTL(key, ttlMs) {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return null
      const { t, v } = JSON.parse(raw)
      if (!t || (Date.now() - t) > ttlMs) { localStorage.removeItem(key); return null }
      return v
    } catch { return null }
  }
  function writeTTL(key, value) {
    try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), v: value })) } catch {}
  }

  const load = useCallback(async (p = 1) => {
    setLoading(true)
    setError(null)
    try {
      const cacheKey = `na:page:${p}`
      const cached = readTTL(cacheKey, TTL)
      if (cached) {
        setItems(cached.items || [])
        setTotalPages(cached.totalPages || 1)
        setPage(cached.page || p)
        setLoading(false)
        // still refresh in background
      }
      // Prefer mp.newlyAdded if exposed; fallback to proxy path
      const controller = new AbortController()
      const t = setTimeout(() => controller.abort(), 5000)
      const res = await fetch(`/api/mp?p=newly-added${p>1?`?page=${p}`:''}`, { signal: controller.signal })
      const json = await res.json()
      const list = extractItems(json)
      // Flatten into comics: each item is an mplist; use its comicNodes
      const comics = list.flatMap((row) => {
        const d = row?.data || row
        const avatar = d?.userNode?.data?.avatarUrl || d?.userNode?.avatarUrl || d?.avatarUrl
        const nodes = Array.isArray(d?.comicNodes) ? d.comicNodes : []
        return nodes.map((n) => ({ ...(n?.data || n || {}), _fallbackAvatar: avatar }))
      })
      setItems(comics)
      const pages = json?.paging?.pages || 1
      const current = json?.paging?.page || p
      setTotalPages(Math.max(1, Number(pages)))
      setPage(Math.max(1, Number(current)))
      writeTTL(cacheKey, { items: comics, totalPages: Math.max(1, Number(pages)), page: Math.max(1, Number(current)) })
      clearTimeout(t)
    } catch (e) {
      setError(e)
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(1) }, [load])

  return (
    <div className="max-w-none w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-white">Newly Added Greft</h1>
          <p className="text-sm text-stone-600 dark:text-gray-400 mt-1">Freshly added series</p>
        </div>
        <div className="text-sm text-stone-600 dark:text-gray-400">Page {page} of {totalPages}</div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <div className="text-red-600 dark:text-red-400 font-medium">Error loading Newly Added</div>
          <div className="text-red-500 dark:text-red-300 text-sm mt-1">{String(error)}</div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading ? Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="animate-pulse h-24 rounded-xl bg-stone-200 dark:bg-gray-800" />
        )) : items.map((row, idx) => {
          const it = row?.data || row
          return <RecRow key={(it.id || idx) + ':na'} item={it} index={idx} />
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          <button
            onClick={() => load(Math.max(1, page - 1))}
            disabled={page <= 1 || loading}
            className="px-4 py-2 rounded-lg border border-stone-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <button
            onClick={() => load(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages || loading}
            className="px-4 py-2 rounded-lg border border-stone-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}

function RecRow({ item, index }) {
  const primary = item.urlCover600 || item.urlCoverOri || item.img || item.cover
  const fallback = item._fallbackAvatar
  const cover = getImage(pickImage({ ...item, img: primary || fallback }))
  const title = item.name || item.title || 'Untitled'
  const parsed = parseIdTitle(item.id || item.seriesId || item.slug || item.urlId, title)
  const href = `/info/${encodeURIComponent(parsed.id)}?src=mp`
  function adultAllowed() { try { const obj = JSON.parse(localStorage.getItem('site:settings')||'{}'); return !!obj.adultAllowed } catch { return false } }
  function isAdult(it) {
    const tags = it?.genres || it?.tags || []
    const arr = Array.isArray(tags) ? tags : []
    return arr.some(t => /adult|mature|ecchi|nsfw|sm_bdsm/i.test(String(t)))
  }
  const grads = [
    'linear-gradient(90deg,#60a5fa,#a78bfa)',
    'linear-gradient(90deg,#34d399,#10b981)',
    'linear-gradient(90deg,#f59e0b,#ef4444)',
    'linear-gradient(90deg,#06b6d4,#3b82f6)'
  ]
  const grad = grads[index % grads.length]
  return (
    <a href={href} className="group relative block h-24 rounded-xl overflow-hidden bg-transparent transition-all duration-300">
      <div className="absolute inset-0">
        {cover && <img src={cover} alt="" className="w-full h-full object-cover filter grayscale group-hover:grayscale-0 transition duration-300 group-hover:-translate-x-1" style={{ filter: (!adultAllowed() && isAdult(item)) ? 'blur(16px) grayscale(100%)' : 'grayscale(100%)' }} />}
        <div className="absolute inset-0 bg-gradient-to-r from-white dark:from-gray-900 via-white/70 dark:via-gray-900/70 to-white/30 dark:to-gray-900/30" />
      </div>
      <div className="relative z-10 h-full flex items-center gap-3 px-3">
        {cover ? (
          <img src={cover} alt="" className="h-18 w-14 object-cover rounded-lg ring-1 ring-white/40 dark:ring-gray-600/40 shadow-sm transition-transform duration-300 group-hover:-translate-x-1" style={{ filter: (!adultAllowed() && isAdult(item)) ? 'blur(16px)' : 'none' }} />
        ) : (
          <div className="h-18 w-14 bg-stone-200 dark:bg-gray-700 rounded-lg" />
        )}
        {(!adultAllowed() && isAdult(item)) && <span className="absolute left-2 top-2 px-2 py-0.5 rounded bg-black/70 text-white text-[10px]">18+ hidden</span>}
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-stone-900 dark:text-white truncate transition-colors duration-200 group-hover:text-transparent" style={{ WebkitBackgroundClip: 'text', backgroundImage: grad }}>{title}</div>
          <div className="text-xs text-stone-500 dark:text-gray-400 mt-1">Newly added • Greft</div>
        </div>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <svg className="w-4 h-4 text-stone-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </a>
  )
}


