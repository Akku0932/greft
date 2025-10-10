import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api, getImage, parseIdTitle, sanitizeTitleId, pickImage } from '../lib/api.js'
import { upsertProgress } from '../lib/progressApi'
import { upsertRecentRead } from '../lib/recentReadsApi'

export default function Read() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const seriesParam = searchParams.get('series') || ''
  const titleParam = searchParams.get('title') || ''
  const srcParam = (searchParams.get('src') || '').toLowerCase()
  const [pages, setPages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [chapters, setChapters] = useState([])
  const [seriesInfo, setSeriesInfo] = useState(null)
  const [adultGate, setAdultGate] = useState(false)
  // Width control (convert zoom to widening the whole container)
  const widthLevels = ['max-w-3xl','max-w-[56rem]','max-w-4xl','max-w-5xl','max-w-6xl','max-w-7xl']
  const [widthLevel, setWidthLevel] = useState(1) // Default to custom medium width (56rem)
  
  // Get the current width class with explicit Tailwind classes
  const getWidthClass = () => {
    const baseClasses = "w-full md:w-auto mx-auto px-0 sm:px-4 py-6"
    switch(widthLevel) {
      case 0: return `${baseClasses} md:max-w-3xl`
      case 1: return `${baseClasses} md:max-w-[56rem]`
      case 2: return `${baseClasses} md:max-w-4xl`
      case 3: return `${baseClasses} md:max-w-5xl`
      case 4: return `${baseClasses} md:max-w-6xl`
      case 5: return `${baseClasses} md:max-w-7xl`
      default: return `${baseClasses} md:max-w-[56rem]`
    }
  }
  const [showBar, setShowBar] = useState(true)
  const [lastY, setLastY] = useState(0)
  const [buttonClicked, setButtonClicked] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(() => !!(document.fullscreenElement))
  const menuRef = useRef(null)
  const navLockRef = useRef(false)
  const [transitioning, setTransitioning] = useState(false)

  const seriesId = useMemo(() => {
    if (seriesParam) return seriesParam
    const raw = String(id || '')
    const cleaned = raw.replace(/^\/+/, '')
    // Handle MP style: /title/:series/:chapter
    if (cleaned.startsWith('title/')) {
      const parts = cleaned.split('/')
      return parts[1] || ''
    }
    // Handle seriesId/chapterId
    return cleaned.includes('/') ? cleaned.split('/')[0] : ''
  }, [id, seriesParam])

  const titleId = useMemo(() => sanitizeTitleId(titleParam || ''), [titleParam])

  // Determine source based on series ID format
  const isMF = !srcParam && seriesId && seriesId.includes('.') && !seriesId.includes('/')
  const source = srcParam === 'mp' ? 'mp' : (isMF ? 'mf' : 'gf')
  
  // For MF, the id is the chapter ID directly (e.g., "5284492")
  // For GF, the id might be a path or just the chapter ID

  useEffect(() => {
    let mounted = true
    async function run() {
      try {
        // For MF, the id is the chapter ID directly (e.g., "5284492")
        // For GF, it might be a path that needs processing
        let chapterId
        if (source === 'mf') {
          chapterId = id
        } else if (source === 'mp') {
          const rawId = String(id || '')
          const cleaned = rawId.replace(/^\/+/, '')
          if (cleaned.startsWith('title/')) {
            const parts = cleaned.split('/')
            chapterId = parts[2] || cleaned
          } else {
            chapterId = decodeURIComponent(cleaned.split('/').pop() || cleaned)
          }
        } else {
          chapterId = decodeURIComponent(id)
        }
        
        const ctx = source === 'mp' ? { seriesId } : undefined
        const res = await api.read(chapterId, source, ctx)
        if (!mounted) return
        const imgs = Array.isArray(res) ? res : (res.pages || res.images || res.items || res.data || [])
        setPages(imgs.map(img => {
          // Handle MF format: {img: "url"} or GF format: "url"
          const url = typeof img === 'string' ? img : (img?.img || img?.src || img)
          return getImage(url)
        }))
      } catch (e) {
        if (mounted) setError(e)
      } finally {
        if (mounted) { setLoading(false); setTransitioning(false) }
      }
    }
    run()
    return () => { mounted = false }
  }, [id, source])

  useEffect(() => {
    if (!seriesId) return
    let mounted = true
    ;(async () => {
      try {
      // hydrate from cache first
      try {
        const cached = localStorage.getItem(`chapters:${seriesId}`)
        const parsed = JSON.parse(cached)
        if (Array.isArray(parsed) && mounted) setChapters(parsed)
      } catch {}
      const res = await api.chapters(seriesId, source)
        if (!mounted) return
        const list = Array.isArray(res) ? res : (res.items || [])
      setChapters(list)
      try { localStorage.setItem(`chapters:${seriesId}`, JSON.stringify(list)) } catch {}
      } catch (_) {}
    })()
    return () => { mounted = false }
  }, [seriesId])

  // Load series info for header avatar/title
  useEffect(() => {
    if (!seriesId || !titleId) return
    let mounted = true
    ;(async () => {
      try {
      // hydrate from cache first
      try {
        const cached = localStorage.getItem(`series-info:${seriesId}:${titleId}`)
        const parsed = JSON.parse(cached)
        if (parsed && mounted) setSeriesInfo(parsed)
      } catch {}
      const info = await api.info(seriesId, titleId, source)
      if (mounted) {
        setSeriesInfo(info)
        try {
          const tags = (info?.genres || info?.otherInfo?.tags || info?.tags || []).map(String)
          const isAdult = tags.some(t => /adult|ecchi|mature|nsfw/i.test(t))
          const key = `adult-ok:${source}:${seriesId}`
          const ok = localStorage.getItem(key)
          if (isAdult && !ok) setAdultGate(true)
        } catch {}
        try { localStorage.setItem(`series-info:${seriesId}:${titleId}`, JSON.stringify(info)) } catch {}
      }
      } catch (_) {}
    })()
    return () => { mounted = false }
  }, [seriesId, titleId])

  // Normalize to oldest -> newest for intuitive navigation (Prev = older, Next = newer)
  const orderedChapterIds = useMemo(() => {
    if (source === 'mf') {
      // For MF, chapters have numeric IDs that should be used directly
      const ids = chapters.map((ch) => String(ch.id || ch.dataNumber || ch.chapterId)).filter(Boolean)
      // MF returns chapters in reverse order (latest first), so reverse for oldest->newest
      return ids.slice(0).reverse()
    } else {
      // For GF, use existing logic
      const ids = chapters.map((ch) => ch.id || ch.slug || ch.urlId || ch.href || ch.url || ch.cid || ch.chapterId).map((v) => String(v))
      return ids.slice(0).reverse()
    }
  }, [chapters, source])

  // Labels straight from API (no auto numbering)
  const chapterLabels = useMemo(() => {
    const pickLabel = (ch) => {
      const raw = ch?.chap ?? ch?.chapter ?? (ch?.chapVol && ch?.chapVol?.chap) ?? ch?.no ?? ch?.number ?? ch?.title ?? ch?.name
      if (raw == null) return null
      return String(raw).trim()
    }
    // Build id->label map using original API order
    const map = new Map()
    chapters.forEach((ch) => {
      const id = String(ch.id || ch.dataNumber || ch.chapterId || ch.slug || ch.urlId || ch.href || ch.url || ch.cid || '')
      if (!id) return
      const label = pickLabel(ch)
      if (!map.has(id)) map.set(id, label)
    })
    return orderedChapterIds.map((cid, idx) => map.get(String(cid)) || `Chapter ${idx + 1}`)
  }, [chapters, orderedChapterIds])

  const currentIndex = useMemo(() => {
    const raw = String(id || '')
    
    if (source === 'mf') {
      // For MF, the id is the chapter ID directly (e.g., "5284492")
      return orderedChapterIds.findIndex((x) => x === raw)
    } else {
      // For GF, use existing logic
      const decodedRaw = decodeURIComponent(raw)
      const byExact = orderedChapterIds.findIndex((x) => x === raw || x === decodedRaw)
      if (byExact !== -1) return byExact
      
      const seg = raw.split('/').pop()
      return orderedChapterIds.findIndex((x) => String(x).split('/').pop() === seg)
    }
  }, [id, orderedChapterIds, source])

  const prevId = currentIndex > 0 ? orderedChapterIds[currentIndex - 1] : null
  const nextId = currentIndex !== -1 && currentIndex + 1 < orderedChapterIds.length ? orderedChapterIds[currentIndex + 1] : null
  const isLast = !nextId

  const goPrev = useCallback(() => {
    if (!prevId) return
    setTransitioning(true)
    setLoading(true)
    setPages([])
    const extra = `${seriesId ? `?series=${encodeURIComponent(seriesId)}&title=${encodeURIComponent(titleId)}` : ''}${source==='mp' ? (seriesId ? `&src=mp` : `?src=mp`) : ''}`
    const url = source === 'mf' 
      ? `/read/chapter/${prevId}${extra}`
      : `/read/${encodeURIComponent(prevId)}${extra}`
    navigate(url)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [prevId, source, seriesId, titleId, navigate])
  const goNext = useCallback(() => {
    if (!nextId) return
    setTransitioning(true)
    setLoading(true)
    setPages([])
    const extra = `${seriesId ? `?series=${encodeURIComponent(seriesId)}&title=${encodeURIComponent(titleId)}` : ''}${source==='mp' ? (seriesId ? `&src=mp` : `?src=mp`) : ''}`
    const url = source === 'mf' 
      ? `/read/chapter/${nextId}${extra}`
      : `/read/${encodeURIComponent(nextId)}${extra}`
    navigate(url)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [nextId, source, seriesId, titleId, navigate])

  const infoHref = seriesId && titleId ? `/info/${encodeURIComponent(seriesId)}/${encodeURIComponent(titleId)}${source==='mp' ? '?src=mp' : ''}` : '/home'

  function widen() { 
    setButtonClicked(true)
    setWidthLevel((i) => Math.min(widthLevels.length - 1, i + 1))
    setTimeout(() => setButtonClicked(false), 100)
  }
  function narrow() { 
    setButtonClicked(true)
    setWidthLevel((i) => Math.max(0, i - 1))
    setTimeout(() => setButtonClicked(false), 100)
  }
  function widthReset() { 
    setButtonClicked(true)
    setWidthLevel(1) // Reset to our custom medium width
    setTimeout(() => setButtonClicked(false), 100)
  }

  useEffect(() => {
    function onKey(e) {
      if (e.ctrlKey || e.metaKey || buttonClicked) return
      if (e.key === '+') widen()
      if (e.key === '-') narrow()
      if (e.key.toLowerCase() === '0') widthReset()
      // Chapter navigation with arrow keys (ignore when typing in inputs/textareas)
      const active = document.activeElement
      const tag = active && active.tagName ? active.tagName.toLowerCase() : ''
      const isTyping = tag === 'input' || tag === 'textarea' || (active && active.isContentEditable)
      if (isTyping) return
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        if (e.repeat || navLockRef.current) return
        navLockRef.current = true
        goNext()
        setTimeout(() => { navLockRef.current = false }, 500)
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        if (e.repeat || navLockRef.current) return
        navLockRef.current = true
        goPrev()
        setTimeout(() => { navLockRef.current = false }, 500)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [buttonClicked, goNext, goPrev])

  // Show navbar on scroll up, hide on scroll down
  useEffect(() => {
    function onScroll() {
      const y = window.scrollY || 0
      const goingUp = y < lastY
      const nearTop = y < 16
      setShowBar(goingUp || nearTop)
      setLastY(y)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [lastY])

  // Fullscreen state sync
  useEffect(() => {
    function onFsChange() { setIsFullscreen(!!document.fullscreenElement) }
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  // Close three-dot menu when clicking outside
  useEffect(() => {
    function onDocClick(e) {
      if (!menuOpen) return
      const el = menuRef.current
      if (el && !el.contains(e.target)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('touchstart', onDocClick)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('touchstart', onDocClick)
    }
  }, [menuOpen])

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen()
      } else {
        await document.exitFullscreen()
      }
    } catch {}
  }
  function reloadPage() {
    window.location.reload()
  }

  // Persist recent read progress in localStorage and Supabase
  useEffect(() => {
    if (!seriesId || currentIndex < 0) return
    try {
      const key = 'recent-reads'
      const raw = localStorage.getItem(key)
      const list = Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : []
      const cover = getImage(pickImage(seriesInfo || {}) || seriesInfo?.img)
      const title = source === 'mf' ? (seriesInfo?.name || 'Series') : (seriesInfo?.title || 'Series')
      const entry = {
        seriesId,
        titleId,
        title,
        cover,
        lastChapterId: String(orderedChapterIds[currentIndex] || id || ''),
        lastChapterIndex: currentIndex,
        updatedAt: Date.now()
      }
      const without = list.filter((x) => x && x.seriesId !== seriesId)
      const next = [entry, ...without].slice(0, 24)
      localStorage.setItem(key, JSON.stringify(next))
    } catch (_) {}
    // Also upsert server-side progress when logged in
    ;(async () => {
      try {
        await upsertProgress({
          seriesId,
          source,
          lastChapterId: String(orderedChapterIds[currentIndex] || id || ''),
          lastChapterIndex: currentIndex
        })
        // Save recent read entry to Supabase for logged-in users
        const cover = getImage(pickImage(seriesInfo || {}) || seriesInfo?.img)
        const title = source === 'mf' ? (seriesInfo?.name || 'Series') : (seriesInfo?.title || 'Series')
        await upsertRecentRead({
          seriesId,
          source,
          title,
          titleId,
          cover,
          lastChapterId: String(orderedChapterIds[currentIndex] || id || ''),
          lastChapterIndex: currentIndex,
          updatedAt: Date.now()
        })
      } catch (_) {}
    })()
  }, [seriesId, titleId, seriesInfo, currentIndex, orderedChapterIds, id])

  return (
    <div className="min-h-screen">
      {adultGate && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70">
          <div className="w-[92vw] max-w-md rounded-2xl bg-white dark:bg-gray-900 p-5 border border-stone-200 dark:border-gray-700 shadow-xl">
            <div className="text-xl font-bold text-stone-900 dark:text-white">18+ content ahead</div>
            <p className="mt-2 text-sm text-stone-700 dark:text-gray-300">This chapter is from a series tagged adult/ecchi. Confirm you are 18+ to continue.</p>
            <div className="mt-4 flex gap-2 justify-end">
              <Link to={infoHref} className="px-4 py-2 rounded-lg border border-stone-300 dark:border-gray-700 text-stone-700 dark:text-gray-200">Go back</Link>
              <button onClick={() => { try { localStorage.setItem(`adult-ok:${source}:${seriesId}`, '1') } catch {}; setAdultGate(false) }} className="px-4 py-2 rounded-lg bg-stone-900 text-white dark:bg-gray-700">I am 18+, continue</button>
            </div>
          </div>
        </div>
      )}
      <div className={`sticky top-0 z-20 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-gray-900/60 bg-white/80 dark:bg-gray-900/80 transition-transform duration-200 ${showBar ? 'translate-y-0' : '-translate-y-full'}`}>
        <div className="max-w-[95vw] mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            <Link to="/home" className="flex items-center gap-2 group">
              <img src="/logo.png" alt="Greft" className="h-10 w-10 sm:h-12 sm:w-12 rounded" />
              <span className="hidden sm:inline text-stone-900 dark:text-white font-semibold group-hover:opacity-90">Greft</span>
            </Link>
            <div className="flex-1 flex items-center justify-center gap-4">
              <Link to={infoHref} className="flex items-center gap-3 group">
                <div className="h-12 w-12 md:h-14 md:w-14 rounded-full overflow-hidden ring-1 ring-stone-300 dark:ring-gray-700 bg-stone-100 dark:bg-gray-800">
                  {seriesInfo && (
                    <img src={getImage(pickImage(seriesInfo) || seriesInfo?.img)} alt="series" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="hidden sm:block text-base md:text-lg font-semibold text-stone-900 dark:text-white truncate max-w-[50vw] md:max-w-[56vw] group-hover:opacity-90">
                  {source === 'mf' ? (seriesInfo?.name || 'Series') : (seriesInfo?.title || 'Series')}
                </div>
              </Link>
              <div className="ml-2">
                <select
                  className="w-36 sm:w-40 md:w-48 rounded-lg border border-stone-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-stone-800 dark:text-gray-200 px-3 py-2"
                  value={currentIndex >= 0 ? String(currentIndex) : ''}
                  onChange={(e) => {
                    const idx = Number(e.target.value)
                    const targetId = orderedChapterIds[idx]
                    if (targetId) {
                      const extra = `${seriesId ? `?series=${encodeURIComponent(seriesId)}&title=${encodeURIComponent(titleId)}` : ''}${source==='mp' ? (seriesId ? `&src=mp` : `?src=mp`) : ''}`
                      const url = source === 'mf' 
                        ? `/read/chapter/${targetId}${extra}`
                        : `/read/${encodeURIComponent(targetId)}${extra}`
                      navigate(url)
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }
                  }}
                >
                  {orderedChapterIds.map((cid, idx) => (
                    <option key={cid} value={String(idx)}>
                      {chapterLabels[idx]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="opacity-0 select-none">spacer</div>
          </div>
        </div>
      </div>

      <section className="relative">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/30 via-black/70 to-black/95" />
        <div className={getWidthClass()}>
          {loading && <div className="text-stone-700 dark:text-gray-300">Loading…</div>}
          {error && <div className="text-red-600 dark:text-red-400">{String(error)}</div>}
          <div className="space-y-0">
            {pages?.map((src, i) => (
              <div key={i} className="w-full overflow-hidden rounded-none sm:rounded-lg bg-transparent sm:bg-stone-100 dark:sm:bg-gray-800">
                <img
                  src={getImage(src)}
                  alt={`page-${i + 1}`}
                  className="w-full block"
                  loading={i < 2 ? 'eager' : 'lazy'}
                  decoding="async"
                  referrerPolicy="no-referrer"
                />
              </div>
            ))}
          </div>
        </div>
        {/* Floating width toolbar (hidden on mobile) */}
        <div className="hidden sm:block fixed left-3 bottom-3 z-30">
          <div className="inline-flex items-center gap-2 rounded-xl border border-stone-300 dark:border-gray-700 bg-white/90 dark:bg-gray-900/90 backdrop-blur px-2 py-1.5 shadow-sm">
            <button onClick={narrow} className="px-2.5 py-1 rounded-md border border-stone-200 dark:border-gray-700 text-stone-700 dark:text-gray-300">- Width</button>
            <div className="px-1.5 text-xs text-stone-700 dark:text-gray-300 w-24 text-center">
              {widthLevels[widthLevel].replace('max-w-','').replace('[56rem]','med')}
            </div>
            <button onClick={widen} className="px-2.5 py-1 rounded-md border border-stone-200 dark:border-gray-700 text-stone-700 dark:text-gray-300">+ Width</button>
            <button onClick={widthReset} className="px-2.5 py-1 rounded-md border border-stone-200 dark:border-gray-700 text-stone-700 dark:text-gray-300">Reset</button>
          </div>
        </div>
      </section>

      {/* Chapter change overlay spinner */}
      {transitioning && (
        <div className="fixed inset-0 z-20 pointer-events-none flex items-center justify-center">
          <div className="w-10 h-10 border-2 border-stone-300 dark:border-gray-700 border-t-blue-500 rounded-full animate-spin" />
        </div>
      )}

      {/* Floating controls: three-dot menu at previous back-to-top position */}
      <div className="fixed right-4 bottom-16 z-30" ref={menuRef}>
        <div className="relative">
          {menuOpen && (
            <div className="absolute bottom-14 right-0 w-48 rounded-xl border border-stone-300 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg overflow-hidden">
              <button onClick={() => { setMenuOpen(false); toggleFullscreen() }} className="w-full text-left px-3 py-2 text-sm hover:bg-stone-100 dark:hover:bg-gray-800">{isFullscreen ? 'Exit fullscreen' : 'Read in fullscreen'}</button>
              <button onClick={() => { setMenuOpen(false); reloadPage() }} className="w-full text-left px-3 py-2 text-sm hover:bg-stone-100 dark:hover:bg-gray-800">Reload page</button>
            </div>
          )}
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="h-12 w-12 rounded-full bg-stone-900 dark:bg-gray-800 text-white flex items-center justify-center shadow-lg border border-stone-300/30 dark:border-gray-700/40"
            aria-label="Reader menu"
            title="Reader menu"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
          </button>
        </div>
      </div>

      <section className="pt-6">
        <div className="w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] mt-2 mb-6 grid grid-cols-12 divide-x divide-stone-200 dark:divide-gray-700 overflow-hidden bg-stone-100 dark:bg-gray-800">
          <button
            onClick={goPrev}
            disabled={!prevId}
            className={`col-span-5 relative py-14 sm:py-16 flex items-center justify-center transition-colors ${prevId ? 'hover:bg-stone-200 dark:hover:bg-gray-700' : 'opacity-50 cursor-not-allowed'}`}
          >
            <svg className="absolute left-4 sm:left-6 h-5 w-5 text-stone-500 dark:text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            <div className="text-center">
              <div className="text-base font-semibold text-stone-900 dark:text-white">Prev</div>
              <div className="text-xs text-stone-500 dark:text-gray-400 mt-1">{prevId ? `${chapterLabels[currentIndex-1]}` : ''}</div>
            </div>
          </button>
          {isLast ? (
            <Link
              to="/home"
              className="col-span-7 relative py-14 sm:py-16 flex items-center justify-center transition-colors hover:bg-stone-200 dark:hover:bg-gray-700"
            >
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 text-base font-semibold text-stone-900 dark:text-white">
                  <svg className="h-7 w-7 sm:h-8 sm:w-8 text-stone-600 dark:text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10.5l9-7 9 7"/><path d="M5 10v10a1 1 0 001 1h12a1 1 0 001-1V10"/></svg>
                  <span>Home</span>
                </div>
              </div>
              <svg className="absolute right-4 sm:right-6 h-5 w-5 text-stone-500 dark:text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
            </Link>
          ) : (
            <button
              onClick={goNext}
              disabled={!nextId}
              className={`col-span-7 relative py-14 sm:py-16 flex items-center justify-center transition-colors ${nextId ? 'hover:bg-stone-200 dark:hover:bg-gray-700' : 'opacity-50 cursor-not-allowed'}`}
            >
              <div className="text-center">
                <div className="text-base font-semibold text-stone-900 dark:text-white">Next</div>
                <div className="text-xs text-stone-500 dark:text-gray-400 mt-1">{nextId ? `${chapterLabels[currentIndex+1]}` : ''}</div>
              </div>
              <svg className="absolute right-4 sm:right-6 h-5 w-5 text-stone-500 dark:text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          )}
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-2 sm:px-4 pb-10">
        <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-3">Comments</h3>
        <div className="rounded-xl border border-stone-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-full bg-stone-200 dark:bg-gray-700" />
            <div className="flex-1">
              <textarea placeholder="Share your thoughts…" className="w-full rounded-lg border border-stone-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-stone-800 dark:text-gray-200 p-3 resize-y min-h-[90px]"></textarea>
              <div className="mt-2 flex justify-end">
                <button className="px-4 py-2 rounded-lg bg-stone-900 text-white dark:bg-gray-700 hover:bg-stone-800 dark:hover:bg-gray-600">Post</button>
              </div>
            </div>
          </div>
          <div className="mt-6 space-y-4">
            {/* Placeholder comments */}
            <div className="flex gap-3">
              <div className="h-9 w-9 rounded-full bg-stone-200 dark:bg-gray-700" />
              <div>
                <div className="text-sm font-medium text-stone-900 dark:text-white">Guest</div>
                <div className="text-sm text-stone-700 dark:text-gray-300">Amazing chapter! The pacing and art are on point.</div>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="h-9 w-9 rounded-full bg-stone-200 dark:bg-gray-700" />
              <div>
                <div className="text-sm font-medium text-stone-900 dark:text-white">Reader</div>
                <div className="text-sm text-stone-700 dark:text-gray-300">Can’t wait for the next one.</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}


