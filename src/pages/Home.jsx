import { useEffect, useState, useRef, useCallback } from 'react'
import { useTheme } from '../contexts/ThemeContext.jsx'
import { supabase } from '../lib/supabaseClient'
import { api, extractItems, getImage, pickImage, parseIdTitle, sanitizeTitleId } from '../lib/api.js'
import PopularSlider from '../components/PopularSlider.jsx'
import Section from '../components/Section.jsx'
import { useLibrary } from '../hooks/useLibrary.js'
import { fetchProgress } from '../lib/progressApi.js'
import { fetchRecentReads, deleteRecentRead } from '../lib/recentReadsApi.js'

export default function Home() {
  const { theme } = useTheme()
  const { user, items: savedItems } = useLibrary()
  const [popular, setPopular] = useState([])
  const [recentReads, setRecentReads] = useState([])
  const [followedNew, setFollowedNew] = useState([])
  const [latest, setLatest] = useState([])
  const [latestPage, setLatestPage] = useState(1)
  const [rec, setRec] = useState([])
  const [recShown, setRecShown] = useState(4)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [hotRange, setHotRange] = useState('weekly')
  const [hotItems, setHotItems] = useState([])
  const [hotLoading, setHotLoading] = useState(false)
  // Removed MF sections: Most Viewed and New Release
  const [showLeftArrow, setShowLeftArrow] = useState(false)
  const [showRightArrow, setShowRightArrow] = useState(true)
  const recentContainerRef = useRef(null)
  const [followedTick, setFollowedTick] = useState(0)
  const [savedLocal, setSavedLocal] = useState([])
  const [preferences, setPreferences] = useState({ commentsEnabled: true, historyEnabled: true })
  
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
          api.combined.hotUpdates().catch(() => ({ items: [] })),
          api.combined.latestUpdates(1).catch(() => ({ items: [] })),
          api.recommendations(undefined, 'gf').catch(() => ({ items: [] })),
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

  // Load user preferences from Supabase metadata (fallback to local)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await supabase.auth.getUser()
        const meta = data?.user?.user_metadata || {}
        const prefs = meta.preferences || {}
        const localPrefs = (() => { try { return JSON.parse(localStorage.getItem('site:settings')||'{}') } catch { return {} } })()
        const merged = {
          commentsEnabled: typeof prefs.commentsEnabled === 'boolean' ? prefs.commentsEnabled : (typeof localPrefs.commentsEnabled === 'boolean' ? localPrefs.commentsEnabled : true),
          historyEnabled: typeof prefs.historyEnabled === 'boolean' ? prefs.historyEnabled : (typeof localPrefs.historyEnabled === 'boolean' ? localPrefs.historyEnabled : true)
        }
        if (!cancelled) setPreferences(merged)
      } catch {}
    })()
    return () => { cancelled = true }
  }, [])

  // Load Recent Reads from localStorage and enrich minimal info
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const cloud = await fetchRecentReads()
        if (mounted && cloud.length) { setRecentReads(cloud); return }
      } catch {}
      try {
        const raw = localStorage.getItem('recent-reads')
        const list = Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : []
        if (mounted) setRecentReads(list)
      } catch { if (mounted) setRecentReads([]) }
    })()
    return () => { mounted = false }
  }, [])

  // Hydrate saved list quickly from cache for instant Followed section, then sync from hook
  useEffect(() => {
    try {
      const raw = localStorage.getItem('saved-cache')
      const list = Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : []
      if (list.length) setSavedLocal(list)
    } catch {}
  }, [])
  useEffect(() => {
    if (Array.isArray(savedItems)) {
      setSavedLocal(savedItems)
      try { localStorage.setItem('saved-cache', JSON.stringify(savedItems)) } catch {}
    }
  }, [savedItems])

  // Compute New Chapters from Followed Comics (based on Saved + Progress)
  // Fast local hydration using cached chapters and recent-reads, then confirm via API
  useEffect(() => {
    if (!user || !Array.isArray(savedLocal) || savedLocal.length === 0) {
      setFollowedNew([])
      return
    }
    try {
      const quick = []
      for (const it of savedLocal) {
        const rr = (recentReads || []).find(r => r.seriesId === it.series_id)
        const cached = localStorage.getItem(`chapters:${it.series_id}`)
        const arr = (() => { try { return JSON.parse(cached) } catch { return [] } })()
        const total = Array.isArray(arr) ? arr.length : 0
        const baselineKey = `followed-count:${it.series_id}`
        let baseline = -1
        try { const v = localStorage.getItem(baselineKey); baseline = v == null ? -1 : Number(v) } catch {}
        if (!rr) {
          // If no reading progress yet, compare total with baseline count
          if (baseline >= 0 && total > baseline) {
            const href = (it.source === 'mf'
              ? `/info/${encodeURIComponent(it.series_id)}`
              : `/info/${encodeURIComponent(it.series_id)}/${encodeURIComponent(sanitizeTitleId(it.title || 'title'))}`)
            quick.push({ ...it, _total: total, _idx: -1, _hasNew: true, _next: 0, _continue: href, _updated: undefined })
          } else if (baseline === -1) {
            // Initialize baseline on first sight
            try { localStorage.setItem(baselineKey, String(total)) } catch {}
          }
          continue
        }
        const idx = typeof rr.lastChapterIndex === 'number' ? rr.lastChapterIndex : -1
        const hasNew = total > (idx + 1)
        if (!hasNew) continue
        const continueHref = rr.lastChapterId
          ? (it.source === 'mf'
              ? `/read/chapter/${rr.lastChapterId}?series=${encodeURIComponent(it.series_id)}&title=${encodeURIComponent(sanitizeTitleId(it.title || 'title'))}`
              : `/read/${encodeURIComponent(rr.lastChapterId)}?series=${encodeURIComponent(it.series_id)}&title=${encodeURIComponent(sanitizeTitleId(it.title || 'title'))}`)
          : (it.source === 'mf'
              ? `/info/${encodeURIComponent(it.series_id)}`
              : `/info/${encodeURIComponent(it.series_id)}/${encodeURIComponent(sanitizeTitleId(it.title || 'title'))}`)
        quick.push({ ...it, _total: total, _idx: idx, _hasNew: true, _next: idx + 1, _continue: continueHref, _updated: rr.updatedAt })
      }
      // sort by biggest delta first based on cached total
      quick.sort((a,b) => (b._total - (b._idx+1)) - (a._total - (a._idx+1)))
      if (quick.length) setFollowedNew(quick)
    } catch {}
  }, [user, savedLocal, recentReads])

  useEffect(() => {
    let mounted = true
    async function run() {
      try {
        if (!user || !Array.isArray(savedLocal) || savedLocal.length === 0) {
          if (mounted) setFollowedNew([])
          return
        }
        const progressRows = await fetchProgress().catch(() => [])
        const decorated = await Promise.all(savedLocal.map(async (it) => {
          const key = `${it.source}:${it.series_id}`
          try {
            const res = await api.chapters(it.series_id, it.source)
            const arr = Array.isArray(res) ? res : (res.items || [])
            const total = arr.length || 0
            const p = progressRows.find(x => x.source === it.source && x.series_id === it.series_id)
            const idx = typeof p?.last_chapter_index === 'number' ? Math.max(0, Number(p.last_chapter_index)) : -1
            const hasNew = (p && total > (idx + 1))
            const nextChapterNumber = idx + 1
            const continueHref = p?.last_chapter_id
              ? (it.source === 'mf' 
                  ? `/read/chapter/${p.last_chapter_id}?series=${encodeURIComponent(it.series_id)}&title=${encodeURIComponent(sanitizeTitleId(it.title || 'title'))}`
                  : `/read/${encodeURIComponent(p.last_chapter_id)}?series=${encodeURIComponent(it.series_id)}&title=${encodeURIComponent(sanitizeTitleId(it.title || 'title'))}`)
              : (it.source === 'mf' 
                  ? `/info/${encodeURIComponent(it.series_id)}`
                  : `/info/${encodeURIComponent(it.series_id)}/${encodeURIComponent(sanitizeTitleId(it.title || 'title'))}`)
            // derive latest chapter timing from API payload when available
            const latestCh = Array.isArray(arr) && arr.length ? (arr[0] || arr[arr.length - 1]) : null
            const chTime = latestCh && (latestCh.updatedAt || latestCh.time || latestCh.date || latestCh.updated || latestCh.lastUpdate)
            return { ...it, _total: total, _idx: idx, _hasNew: hasNew, _next: nextChapterNumber, _continue: continueHref, _updated: chTime }
          } catch {
            return { ...it, _total: 0, _idx: 0, _hasNew: false, _next: 0, _continue: (it.source === 'mf' ? `/info/${encodeURIComponent(it.series_id)}` : `/info/${encodeURIComponent(it.series_id)}/${encodeURIComponent(sanitizeTitleId(it.title || 'title'))}`), _updated: undefined }
          }
        }))
        const onlyNew = decorated.filter(x => x._hasNew)
        // Sort by biggest delta (most new chapters)
        onlyNew.sort((a,b) => (b._total - (b._idx+1)) - (a._total - (a._idx+1)))
        if (mounted) setFollowedNew(onlyNew)
      } catch {
        if (mounted) setFollowedNew([])
      }
    }
    run()
    return () => { mounted = false }
  }, [user, savedLocal, followedTick])

  // Auto-refresh Followed section every 3 minutes and on tab focus
  useEffect(() => {
    if (!user || !Array.isArray(savedItems) || savedItems.length === 0) return
    const id = setInterval(() => setFollowedTick((t) => t + 1), 180000)
    const onVisible = () => { if (document.visibilityState === 'visible') setFollowedTick((t) => t + 1) }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [user, savedLocal])

  // Remove item from recent reads with confirmation
  const removeRecentRead = async (seriesId, title) => {
    const confirmed = window.confirm(`Remove "${title}" from recent reads?`)
    if (confirmed) {
      try {
        const raw = localStorage.getItem('recent-reads')
        const list = Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : []
        const filtered = list.filter(item => item.seriesId !== seriesId)
        localStorage.setItem('recent-reads', JSON.stringify(filtered))
        setRecentReads(filtered)
      } catch {
        setRecentReads([])
      }
      try { await deleteRecentRead(seriesId) } catch {}
    }
  }

  // Sliding state helpers
  const needsSliding = recentReads.length > 5
  useEffect(() => {
    const el = recentContainerRef.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth - 4
    setShowLeftArrow(false)
    setShowRightArrow(needsSliding && el.scrollLeft < max)
  }, [recentReads, needsSliding])

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

  // Removed MF data loaders

  // Load more latest updates
  const loadMoreLatest = useCallback(async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const nextPage = latestPage + 1
      const res = await api.combined.latestUpdates(nextPage)
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
      <div className="max-w-none w-full mx-auto grid grid-cols-1 lg:grid-cols-[1fr_520px] gap-10">
        <div>
          {/* Move sections above Latest Updates on mobile: Recent Reads first, then Popular and Recommendations */}
          <div className="lg:hidden space-y-8 pt-6">
            {!!followedNew.length && (
              <section className="mb-2">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-stone-900 dark:text-white">New Chapters from Followed Comics</h2>
                    <p className="text-sm text-stone-600 dark:text-gray-400 mt-1">Fresh chapters in your saved list</p>
                  </div>
                  <a href="/saved" className="text-sm text-stone-700 dark:text-gray-300 hover:underline">View all</a>
                </div>
                <div className="overflow-x-auto no-scrollbar -mx-4 px-4">
                  <div className="flex gap-3 snap-x snap-mandatory touch-pan-x pb-2">
                    {followedNew.slice(0, 15).map((it, i) => (
                      <div key={`${it.source}:${it.series_id}`} className="snap-start flex-shrink-0 w-40 sm:w-48">
                        <FollowedNewCard item={it} />
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}
            {!!recentReads.length && preferences.historyEnabled && (
              <section className="mb-2">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-stone-900 dark:text-white">Reading History</h2>
                    <p className="text-sm text-stone-600 dark:text-gray-400 mt-1">Jump back into what you were reading</p>
                  </div>
                  <a href="/history" className="text-sm text-stone-700 dark:text-gray-300 hover:underline">View all</a>
                </div>
                <div className="overflow-x-auto no-scrollbar -mx-4 px-4">
                  <div className="flex gap-4 snap-x snap-mandatory touch-pan-x pb-2">
                    {recentReads.map((it, i) => (
                      <div key={(it.seriesId || i) + 'recent-m'} className="snap-start flex-shrink-0">
                        <RecentReadCard item={it} index={i} onRemove={removeRecentRead} />
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}
            {/* Removed New Release and Most Viewed sections */}
            <div className="rounded-xl border border-stone-200 dark:border-gray-700/60 bg-white/60 dark:bg-gray-900/60 p-6">
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
                  <RecItem key={(it.id || it.seriesId || i) + 'hotm'} item={it.info ? { ...it, title: it.info?.title, img: it.info?.img, imgs: it.info?.imgs } : it} index={i} />
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-stone-200 dark:border-gray-700/60 bg-white/60 dark:bg-gray-900/60 p-6">
              <h3 className="text-xl font-bold text-stone-900 dark:text-white mb-4">Recommendations</h3>
              <div className="space-y-4">
                {loading ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="animate-pulse h-24 rounded-xl bg-stone-200 dark:bg-gray-800" />
                )) : rec.slice(0, recShown).map((item, idx) => (
                  <RecItem key={(item.id || item.seriesId || item.slug || item.title) + 'm' + idx} item={item} index={idx} />
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
          </div>
      {!!followedNew.length && (
        <section className="mb-10 hidden lg:block">
              <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-stone-900 dark:text-white">New Chapters from Followed Comics</h2>
              <p className="text-sm text-stone-600 dark:text-gray-400 mt-1">Fresh chapters in your saved list</p>
            </div>
                <a href="/saved" className="text-sm text-stone-700 dark:text-gray-300 hover:underline">View all</a>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-5">
            {followedNew.slice(0, 15).map((it) => (
              <FollowedNewCard key={`${it.source}:${it.series_id}`} item={it} />
            ))}
          </div>
        </section>
      )}
      {!!recentReads.length && preferences.historyEnabled && (
        <section className="mb-10 hidden lg:block">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-stone-900 dark:text-white">Reading History</h2>
                  <p className="text-sm text-stone-600 dark:text-gray-400 mt-1">Jump back into what you were reading</p>
                </div>
                <a href="/history" className="text-sm text-stone-700 dark:text-gray-300 hover:underline">View all</a>
              </div>
              <div className="relative">
                {/* Navigation arrows - only show when more than 8 cards */}
                {needsSliding && showLeftArrow && (
                  <button
                    onClick={() => {
                      const el = recentContainerRef.current
                      if (el) el.scrollBy({ left: -el.clientWidth, behavior: 'smooth' })
                    }}
                    className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 w-10 h-10 rounded-full bg-white dark:bg-gray-800 shadow-lg border border-stone-200 dark:border-gray-700 flex items-center justify-center text-stone-600 dark:text-gray-300 hover:bg-stone-50 dark:hover:bg-gray-700 transition-all duration-200"
                    title="Previous"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                )}
                
                {needsSliding && showRightArrow && (
                  <button
                    onClick={() => {
                      const el = recentContainerRef.current
                      if (el) el.scrollBy({ left: el.clientWidth, behavior: 'smooth' })
                    }}
                    className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 w-10 h-10 rounded-full bg-white dark:bg-gray-800 shadow-lg border border-stone-200 dark:border-gray-700 flex items-center justify-center text-stone-600 dark:text-gray-300 hover:bg-stone-50 dark:hover:bg-gray-700 transition-all duration-200"
                    title="Next"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                )}

                {/* Scrollable snap container */}
                <div 
                  ref={recentContainerRef}
                  className={`overflow-x-auto no-scrollbar ${needsSliding ? '' : ''}`}
                  onScroll={() => {
                    const el = recentContainerRef.current
                    if (!el) return
                    const max = el.scrollWidth - el.clientWidth - 4
                    setShowLeftArrow(el.scrollLeft > 4)
                    setShowRightArrow(el.scrollLeft < max)
                  }}
                >
                  <div className="flex gap-1.5 snap-x snap-mandatory pb-2">
                    {recentReads.map((it, i) => (
                      <div key={(it.seriesId || i) + 'recent-d'} className="snap-start flex-shrink-0" style={{ width: 'calc(20% - 6px)' }}>
                        <RecentReadCard item={it} index={i} onRemove={removeRecentRead} />
                      </div>
                    ))}
                  </div>
                </div>
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
        <aside className="pt-8 lg:pt-16 justify-self-end w-full hidden lg:block">
          {/* Removed New Release and Most Viewed sections */}
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
  // For MF items, only use ID; for GF items, use ID/title format
  const href = item._source === 'mf'
    ? `/info/${encodeURIComponent(parsed.id)}`
    : item._source === 'mp'
      ? `/info/${encodeURIComponent(parsed.id)}/${encodeURIComponent(sanitizeTitleId(parsed.titleId || 'title'))}?src=mp`
      : `/info/${encodeURIComponent(parsed.id)}/${encodeURIComponent(sanitizeTitleId(parsed.titleId || 'title'))}`
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
  // For MF items, only use ID; for GF items, use ID/title format
  const href = item._source === 'mf' 
    ? `/info/${encodeURIComponent(parsed.id)}`
    : `/info/${encodeURIComponent(parsed.id)}/${encodeURIComponent(sanitizeTitleId(parsed.titleId || 'title'))}`
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
    
    // Handle MF time strings directly
    if (typeof value === 'string') {
      const timeStr = value.toLowerCase()
      if (timeStr.includes('minute')) {
        const mins = parseInt(timeStr.match(/(\d+)/)?.[1] || '0')
        return mins === 1 ? '1 min ago' : `${mins} mins ago`
      } else if (timeStr.includes('hour')) {
        const hours = parseInt(timeStr.match(/(\d+)/)?.[1] || '0')
        return hours === 1 ? '1 hour ago' : `${hours} hours ago`
      } else if (timeStr.includes('day')) {
        const days = parseInt(timeStr.match(/(\d+)/)?.[1] || '0')
        return days === 1 ? '1 day ago' : `${days} days ago`
      } else if (timeStr === 'trending') {
        return 'Trending'
      } else {
        // Try to parse date strings like "Oct 05, 2025"
        const parsed = new Date(value).getTime()
        if (!isNaN(parsed)) {
          const diff = Math.max(0, Date.now() - parsed)
          const s = Math.floor(diff / 1000)
          const m = Math.floor(s / 60)
          const h = Math.floor(m / 60)
          const d = Math.floor(h / 24)
          if (d > 0) return `${d}d ago`
          if (h > 0) return `${h}h ago`
          if (m > 0) return `${m}m ago`
          return `${s}s ago`
        }
      }
    }
    
    // Handle numeric timestamps
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
          {item._source && (
            <div className="absolute top-1 left-1 px-2 py-0.5 rounded-full text-[10px] font-medium backdrop-blur-sm border border-white/20"
                 style={{ background: item._source === 'mf' ? 'linear-gradient(90deg,#06b6d4,#3b82f6)' : item._source === 'mp' ? 'linear-gradient(90deg,#10b981,#34d399)' : 'linear-gradient(90deg,#f59e0b,#ef4444)', color: 'white' }}>
              {item._source === 'mf' ? 'MF' : item._source === 'mp' ? 'MP' : 'GF'}
            </div>
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

function RecentReadCard({ item, index, onRemove }) {
  const cover = item.cover || ''
  const title = item.title || 'Untitled'
  // Determine source based on series ID format
  const isMF = item.seriesId && item.seriesId.includes('.') && !item.seriesId.includes('/')
  const href = item.lastChapterId
    ? (isMF 
        ? `/read/chapter/${item.lastChapterId}?series=${encodeURIComponent(item.seriesId)}&title=${encodeURIComponent(sanitizeTitleId(item.titleId || 'title'))}`
        : `/read/${encodeURIComponent(item.lastChapterId)}?series=${encodeURIComponent(item.seriesId)}&title=${encodeURIComponent(sanitizeTitleId(item.titleId || 'title'))}`)
    : (isMF 
        ? `/info/${encodeURIComponent(item.seriesId)}`
        : `/info/${encodeURIComponent(item.seriesId)}/${encodeURIComponent(sanitizeTitleId(item.titleId || 'title'))}`)
  
  const handleRemove = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (onRemove && item.seriesId) {
      onRemove(item.seriesId, title)
    }
  }

  return (
    <div className="group relative w-40 sm:w-44 lg:w-full flex-shrink-0">
      <a href={href} className="block">
        <div className="relative">
          {/* Anime-style card with aspect ratio 3:4 */}
          <div className="relative aspect-square overflow-hidden rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 group-hover:scale-[1.02]">
            {cover ? (
              <img 
                src={cover} 
                alt={title} 
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-stone-200 to-stone-300 dark:from-gray-700 dark:to-gray-800 rounded-xl" />
            )}
            
            {/* Gradient overlay for better text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            
            {/* Chapter badge */}
            <div className="absolute top-2 left-2">
              <span className="px-2 py-1 bg-white/90 dark:bg-gray-900/90 text-black dark:text-white text-xs font-bold rounded-full shadow-md">
                Ch. {Math.max(1, (item.lastChapterIndex || 0) + 1)}
              </span>
            </div>
            
            {/* Source badge */}
            <div className="absolute top-2 right-2">
              <span className={`px-2 py-1 text-xs font-bold rounded-full shadow-md ${
                isMF 
                  ? 'bg-blue-500/90 text-white' 
                  : 'bg-green-500/90 text-white'
              }`}>
                {isMF ? 'MF' : 'GF'}
              </span>
            </div>
            
            {/* Remove button */}
            <button
              onClick={handleRemove}
              className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-500/90 hover:bg-red-600 text-white flex items-center justify-center text-xs font-bold opacity-0 group-hover:opacity-100 transition-all duration-200 z-10 shadow-lg"
              title="Remove from recent reads"
            >
              ×
            </button>
          </div>
          
          {/* Title with anime-style typography */}
          <div className="mt-2 px-0">
            <h3 className="text-sm font-semibold text-stone-900 dark:text-white line-clamp-2 leading-snug group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-blue-500 group-hover:to-purple-600 transition-all duration-300">
              {title}
            </h3>
          </div>
        </div>
      </a>
    </div>
  )
}

function FollowedNewCard({ item }) {
  const cover = item.cover || ''
  const title = item.title || 'Untitled'
  const subtitle = `${Math.max(1, (item._idx || 0) + 1)} / ${item._total}`
  const href = item._continue || '#'
  const updatedStr = (() => {
    const value = item._updated
    if (!value) return null
    const t = typeof value === 'number' ? (value < 1e12 ? value * 1000 : value) : Date.parse(value)
    if (Number.isNaN(t)) return null
    const diff = Math.max(0, Date.now() - t)
    const m = Math.floor(diff / 60000)
    if (m < 60) return m <= 1 ? '1m ago' : `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    const d = Math.floor(h / 24)
    if (d < 30) return `${d}d ago`
    const mo = Math.floor(d / 30)
    if (mo < 12) return `${mo}mo ago`
    const y = Math.floor(mo / 12)
    return `${y}y ago`
  })()
  return (
    <a href={href} className="group block">
      <div className="relative aspect-square overflow-hidden rounded-lg ring-1 ring-stone-200 dark:ring-gray-800 bg-stone-200">
        {cover ? (
          <img src={cover} alt={title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-stone-200 to-stone-300 dark:from-gray-700 dark:to-gray-800" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <div className="absolute bottom-2 left-2 right-2">
          <div className="text-white font-semibold line-clamp-2 text-sm">{title}</div>
          <div className="mt-1 flex items-center justify-between text-[10px] text-white/80">
            <span>Updated {updatedStr || '—'}</span>
            <span>{subtitle}</span>
          </div>
          <div className="mt-1 h-1.5 bg-white/30 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-500 to-purple-600" style={{ width: `${item._total ? Math.min(100, Math.round(((item._idx + 1) / item._total) * 100)) : 0}%` }} />
          </div>
        </div>
      </div>
      <div className="mt-2 w-full">
        <a href={href} className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-stone-900 text-white dark:bg-gray-700 text-sm">
          <span>Continue</span>
          <span className="px-1 py-0.5 rounded bg-white/20">{Math.max(1, (item._idx || 0) + 1)}</span>
        </a>
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


