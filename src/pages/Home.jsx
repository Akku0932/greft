import { useEffect, useState, useRef, useCallback } from 'react'
import { useTheme } from '../contexts/ThemeContext.jsx'
import { api, extractItems, getImage, pickImage, parseIdTitle, sanitizeTitleId } from '../lib/api.js'
import PopularSlider from '../components/PopularSlider.jsx'
import Section from '../components/Section.jsx'

export default function Home() {
  const { theme } = useTheme()
  const [popular, setPopular] = useState([])
  const [recentReads, setRecentReads] = useState([])
  const [latest, setLatest] = useState([])
  const [latestPage, setLatestPage] = useState(1)
  const [rec, setRec] = useState([])
  const [recShown, setRecShown] = useState(4)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [hotRange, setHotRange] = useState('weekly')
  const [hotItems, setHotItems] = useState([])
  const [hotLoading, setHotLoading] = useState(false)
  
  // Infinite scroll for latest updates
  const [latestShown, setLatestShown] = useState(12)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const observerRef = useRef()

  // Simple cache helpers
  const readCache = (key) => {
    try {
      const raw = localStorage.getItem(key)
      return JSON.parse(raw)
    } catch {
      return null
    }
  }
  const writeCache = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
  }

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        // 1) Hydrate from cache immediately for instant UI
        const cachedPopular = readCache('home-popular')
        const cachedLatest = readCache('home-latest')
        const cachedRec = readCache('home-rec')
        if (cachedPopular) setPopular(cachedPopular)
        if (cachedLatest) { setLatest(cachedLatest.items || cachedLatest); if ((cachedLatest.items || cachedLatest).length > 12) setHasMore(true) }
        if (cachedRec) setRec(cachedRec)

        // 2) Fetch fresh in background
        const [hot, last, recommended] = await Promise.all([
          api.hotUpdates().catch(() => ({ items: [] })),
          api.latestUpdates(1).catch(() => ({ items: [] })),
          api.recommendations().catch(() => ({ items: [] })),
        ])
        if (!mounted) return
        // Prepare a pool (up to 60) and preload info details for each
        const rawPopular = extractItems(hot)
        const pool = [...rawPopular].slice(0, 60)
        const withInfo = await Promise.all(pool.map(async (it) => {
          try {
            const parsed = parseIdTitle(it.seriesId || it.id || it.slug || it.urlId, it.title || it.slug)
            const info = await api.info(parsed.id, parsed.titleId)
            return { ...it, info }
          } catch {
            return it
          }
        }))
        setPopular(withInfo)
        writeCache('home-popular', withInfo)
        const latestItems = extractItems(last)
        setLatest(latestItems)
        writeCache('home-latest', latestItems)
        setHasMore(latestItems.length > 12)
        const recItems = extractItems(recommended)
        setRec(recItems)
        writeCache('home-rec', recItems)
      } catch (e) {
        if (mounted) setError(e)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  // Load Recent Reads from localStorage and enrich minimal info
  useEffect(() => {
    try {
      const raw = localStorage.getItem('recent-reads')
      const list = Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : []
      setRecentReads(list)
    } catch {
      setRecentReads([])
    }
  }, [])

  useEffect(() => {
    let mounted = true
    async function run() {
      setHotLoading(true)
      try {
        // hydrate from cache first
        const cached = readCache(`home-hot-${hotRange}`)
        if (cached) setHotItems(cached)
        const raw = await api.hotSeries(hotRange)
        const list = extractItems(raw)
        // Shuffle once per range change
        const shuffledOnce = list.slice(0).sort(() => Math.random() - 0.5)
        const enriched = await Promise.all(shuffledOnce.slice(0, 20).map(async (it) => {
          try {
            const parsed = parseIdTitle(it.seriesId || it.id || it.slug || it.urlId || it, it.title)
            const info = await api.info(parsed.id, parsed.titleId)
            return { ...it, info }
          } catch {
            return it
          }
        }))
        if (mounted) setHotItems(enriched)
        writeCache(`home-hot-${hotRange}`, enriched)
      } catch (_) {
        if (mounted) setHotItems([])
      } finally {
        if (mounted) setHotLoading(false)
      }
    }
    run()
    return () => { mounted = false }
  }, [hotRange])

  // Load more latest updates
  const loadMoreLatest = useCallback(async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const nextPage = latestPage + 1
      const res = await api.latestUpdates(nextPage)
      const nextItems = extractItems(res)
      if (nextItems.length === 0) {
        setHasMore(false)
      } else {
        setLatest(prev => {
          const merged = [...prev, ...nextItems]
          writeCache('home-latest', merged)
          return merged
        })
        setLatestPage(nextPage)
      }
    } catch (_) {
      setHasMore(false)
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, hasMore, latestPage])

  // Intersection observer for infinite scroll
  const lastElementRef = useCallback(node => {
    if (loadingMore) return
    if (observerRef.current) observerRef.current.disconnect()
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        loadMoreLatest()
      }
    })
    if (node) observerRef.current.observe(node)
  }, [loadingMore, hasMore, loadMoreLatest])

  return (
    <div>
      <PopularSlider items={popular} />
      <div className="max-w-none w-full mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-[1fr_520px] gap-10">
        <div>
          {!!recentReads.length && (
            <section className="mb-10">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-stone-900 dark:text-white">Recent Reads</h2>
                  <p className="text-sm text-stone-600 dark:text-gray-400 mt-1">Jump back into what you were reading</p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                {recentReads.map((it, i) => (
                  <RecentReadCard key={(it.seriesId || i) + 'recent'} item={it} index={i} />
                ))}
              </div>
            </section>
          )}
          <LatestUpdates 
            items={latest} 
            loading={loading} 
            error={error} 
            shown={latestShown}
            loadingMore={loadingMore}
            hasMore={hasMore}
            lastElementRef={lastElementRef}
          />
        </div>
        <aside className="pt-8 lg:pt-16 justify-self-end w-full">
          <div className="mb-8 rounded-xl border border-stone-200 dark:border-gray-700/60 bg-white/60 dark:bg-gray-900/60 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-stone-900 dark:text-white">Recent Popular</h3>
              <div className="inline-flex rounded-lg border border-stone-300 dark:border-gray-600 overflow-hidden text-sm">
                {['weekly','monthly','alltime'].map((r) => (
                  <button 
                    key={r} 
                    onClick={() => setHotRange(r)} 
                    className={`px-3 py-2 transition-colors duration-200 ${
                      hotRange===r 
                        ? 'bg-stone-900 dark:bg-gray-700 text-white' 
                        : 'bg-white dark:bg-gray-800 text-stone-700 dark:text-gray-300 hover:bg-stone-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    {r[0].toUpperCase()+r.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              {hotLoading ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="animate-pulse h-24 rounded-xl bg-stone-200 dark:bg-gray-800" />
              )) : hotItems.slice(0, 6).map((it, i) => (
                <RecItem key={(it.id || it.seriesId || i) + 'hot'} item={it.info ? { ...it, title: it.info?.title, img: it.info?.img, imgs: it.info?.imgs } : it} index={i} />
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-stone-200 dark:border-gray-700/60 bg-white/60 dark:bg-gray-900/60 p-6">
            <h3 className="text-xl font-bold text-stone-900 dark:text-white mb-4">Recommendations</h3>
            <div className="space-y-4">
              {loading ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="animate-pulse h-24 rounded-xl bg-stone-200 dark:bg-gray-800" />
              )) : rec.slice(0, recShown).map((item, idx) => (
                <RecItem key={(item.id || item.seriesId || item.slug || item.title) + idx} item={item} index={idx} />
              ))}
            </div>
            {!loading && recShown < rec.length && (
              <div className="mt-4">
                <button 
                  onClick={() => setRecShown((n)=>Math.min(n+4, rec.length))} 
                  className="w-full px-4 py-3 text-sm font-medium rounded-xl border border-stone-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-stone-700 dark:text-gray-300 hover:bg-stone-50 dark:hover:bg-gray-700 transition-colors duration-200"
                >
                  Load more recommendations
                </button>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}

function RecItem({ item, index }) {
  const cover = getImage(pickImage(item))
  const title = item.title || item.name || 'Untitled'
  const parsed = parseIdTitle(item.seriesId || item.id || item.slug || item.urlId, item.title || item.slug)
  const href = `/info/${encodeURIComponent(parsed.id)}/${encodeURIComponent(sanitizeTitleId(parsed.titleId || 'title'))}`
  const showBg = index < 3
  // gradient palette for hover title
  const grads = [
    'linear-gradient(90deg,#60a5fa,#a78bfa)',
    'linear-gradient(90deg,#34d399,#10b981)',
    'linear-gradient(90deg,#f59e0b,#ef4444)',
    'linear-gradient(90deg,#06b6d4,#3b82f6)'
  ]
  const grad = grads[index % grads.length]
  return (
    <a href={href} className="group relative block h-24 rounded-xl overflow-hidden bg-transparent transition-all duration-300">
      {showBg && (
        <div className="absolute inset-0">
          {cover && <img src={cover} alt="" className="w-full h-full object-cover filter grayscale group-hover:grayscale-0 transition duration-300 group-hover:-translate-x-1" />}
          <div className="absolute inset-0 bg-gradient-to-r from-white dark:from-gray-900 via-white/70 dark:via-gray-900/70 to-white/30 dark:to-gray-900/30" />
        </div>
      )}
      <div className="relative z-10 h-full flex items-center gap-3 px-3">
        {cover ? (
          <img src={cover} alt="" className="h-18 w-14 object-cover rounded-lg ring-1 ring-white/40 dark:ring-gray-600/40 shadow-sm transition-transform duration-300 group-hover:-translate-x-1" />
        ) : (
          <div className="h-18 w-14 bg-stone-200 dark:bg-gray-700 rounded-lg" />
        )}
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-stone-900 dark:text-white truncate transition-colors duration-200 group-hover:text-transparent" style={{ WebkitBackgroundClip: 'text', backgroundImage: grad }}>{title}</div>
          <div className="text-xs text-stone-500 dark:text-gray-400 mt-1">Chapters • Updated</div>
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

function LatestUpdates({ items = [], loading, error, shown, loadingMore, hasMore, lastElementRef }) {
  return (
    <section className="">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-stone-900 dark:text-white">Latest Updates</h2>
          <p className="text-sm text-stone-600 dark:text-gray-400 mt-1">Discover the newest chapters and releases</p>
        </div>
        {!loading && !error && items?.length > shown && (
          <div className="text-right">
            <div className="text-sm text-stone-500 dark:text-gray-400">Showing {shown} of {items.length}</div>
            <div className="w-24 h-1 bg-stone-200 dark:bg-gray-700 rounded-full mt-1">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full transition-all duration-300"
                style={{ width: `${(shown / items.length) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <div className="text-red-600 dark:text-red-400 font-medium">Error loading updates</div>
          <div className="text-red-500 dark:text-red-300 text-sm mt-1">{String(error)}</div>
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {loading && items.length === 0 ? Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="aspect-square bg-stone-200 dark:bg-gray-800" />
            <div className="h-3 bg-stone-200 dark:bg-gray-800 w-4/5 mt-2" />
          </div>
        )) : (items || []).map((it, i) => {
          const isLast = i === items.length - 1
          return (
            <div key={(it.id || it.seriesId || it.slug || it.title || i) + 'latest'} ref={isLast ? lastElementRef : null}>
              <LatestCard item={it} index={i} />
            </div>
          )
        })}
      </div>
      {loadingMore && (
        <div className="mt-8 flex justify-center">
          <div className="flex items-center gap-3 px-6 py-3 bg-stone-100 dark:bg-gray-800 rounded-full">
            <div className="w-5 h-5 border-2 border-stone-300 dark:border-gray-600 border-t-blue-500 rounded-full animate-spin"></div>
            <span className="text-sm text-stone-600 dark:text-gray-300 font-medium">Loading more updates...</span>
          </div>
        </div>
      )}
      {!hasMore && !loading && items.length > 0 && (
        <div className="mt-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-stone-100 dark:bg-gray-800 rounded-full text-stone-600 dark:text-gray-400 text-sm">
            <span>✨</span>
            <span>You've reached the end! No more updates to show.</span>
          </div>
        </div>
      )}
    </section>
  )
}

function LatestCard({ item, index }) {
  const cover = getImage(pickImage(item))
  const title = item.title || item.name || 'Untitled'
  const rawTag = item.tag || item.chapter || item.update || ''
  const tag = typeof rawTag === 'string' ? rawTag.replace(/episode/gi, 'Chapter') : rawTag
  const parsed = parseIdTitle(item.seriesId || item.id || item.slug || item.urlId, item.title || item.slug)
  const href = `/info/${encodeURIComponent(parsed.id)}/${encodeURIComponent(sanitizeTitleId(parsed.titleId || 'title'))}`
  const hoverGrads = [
    'linear-gradient(90deg,#60a5fa,#a78bfa)',
    'linear-gradient(90deg,#34d399,#10b981)',
    'linear-gradient(90deg,#f59e0b,#ef4444)',
    'linear-gradient(90deg,#06b6d4,#3b82f6)',
    'linear-gradient(90deg,#f472b6,#f59e0b)'
  ]
  const hoverGrad = hoverGrads[index % hoverGrads.length]
  
  function timeAgo(value) {
    if (!value) return null
    let ms
    if (typeof value === 'number') {
      ms = value < 1e12 ? value * 1000 : value
    } else {
      const t = Date.parse(value)
      if (Number.isNaN(t)) return null
      ms = t
    }
    const diff = Math.max(0, Date.now() - ms)
    const s = Math.floor(diff / 1000)
    const m = Math.floor(s / 60)
    const h = Math.floor(m / 60)
    const d = Math.floor(h / 24)
    if (d > 0) return `${d}d ago`
    if (h > 0) return `${h}h ago`
    if (m > 0) return `${m}m ago`
    return `${s}s ago`
  }
  
  const updatedStr = timeAgo(item.updatedAt || item.time || item.date || item.updated || item.lastUpdate)
  
  return (
    <a href={href} className="group block">
      <div className="relative">
        <div className="relative aspect-square overflow-hidden rounded-lg">
          {cover ? (
            <img src={cover} alt={title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:translate-y-[-6px]" />
          ) : (
            <div className="absolute inset-0 bg-stone-200 dark:bg-gray-800 rounded-lg" />
          )}
        </div>
        <div className="px-1.5 pt-2">
          <h3 className="text-sm font-semibold truncate text-stone-900 dark:text-white group-hover:text-transparent" style={{ WebkitBackgroundClip: 'text', backgroundImage: hoverGrad }}>
            {title}
          </h3>
          <div className="mt-1 flex items-center justify-between">
            {tag ? <span className="text-[10px] px-1.5 py-0.5 bg-stone-100 dark:bg-gray-800 text-stone-700 dark:text-gray-300 rounded">{tag}</span> : <span />}
            {updatedStr && <span className="text-[10px] text-stone-500 dark:text-gray-400">{updatedStr}</span>}
          </div>
        </div>
      </div>
    </a>
  )
}

function RecentReadCard({ item, index }) {
  const cover = item.cover || ''
  const title = item.title || 'Untitled'
  const href = item.lastChapterId
    ? `/read/${encodeURIComponent(item.lastChapterId)}?series=${encodeURIComponent(item.seriesId)}&title=${encodeURIComponent(sanitizeTitleId(item.titleId || 'title'))}`
    : `/info/${encodeURIComponent(item.seriesId)}/${encodeURIComponent(sanitizeTitleId(item.titleId || 'title'))}`
  const hoverGrads = [
    'linear-gradient(90deg,#60a5fa,#a78bfa)',
    'linear-gradient(90deg,#34d399,#10b981)',
    'linear-gradient(90deg,#f59e0b,#ef4444)',
    'linear-gradient(90deg,#06b6d4,#3b82f6)',
    'linear-gradient(90deg,#f472b6,#f59e0b)'
  ]
  const hoverGrad = hoverGrads[index % hoverGrads.length]
  return (
    <a href={href} className="group block">
      <div className="relative">
        <div className="relative aspect-square overflow-hidden rounded-lg">
          {cover ? (
            <img src={cover} alt={title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:translate-y-[-6px]" />
          ) : (
            <div className="absolute inset-0 bg-stone-200 dark:bg-gray-800 rounded-lg" />
          )}
        </div>
        <div className="px-1.5 pt-2">
          <h3 className="text-sm font-semibold truncate text-stone-900 dark:text-white group-hover:text-transparent" style={{ WebkitBackgroundClip: 'text', backgroundImage: hoverGrad }}>
            {title}
          </h3>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-[10px] px-1.5 py-0.5 bg-stone-100 dark:bg-gray-800 text-stone-700 dark:text-gray-300 rounded">Ch. {Math.max(1, (item.lastChapterIndex || 0) + 1)}</span>
          </div>
        </div>
      </div>
    </a>
  )
}

function SmallCard({ item }) {
  const cover = getImage(pickImage(item) || item?.info?.img)
  const title = item.title || item?.info?.title || 'Untitled'
  const parsed = parseIdTitle(item.seriesId || item.id || item.slug || item.urlId || item, title)
  const href = `/info/${encodeURIComponent(parsed.id)}/${encodeURIComponent(sanitizeTitleId(parsed.titleId || 'title'))}`
  return (
    <a href={href} className="group block">
      <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-stone-200">
        {cover && <img src={cover} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />}
      </div>
      <div className="mt-2 text-sm font-medium line-clamp-2 group-hover:text-brand-600">{title}</div>
    </a>
  )
}


