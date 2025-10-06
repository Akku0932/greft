import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api, getImage, parseIdTitle, sanitizeTitleId, pickImage } from '../lib/api.js'

export default function Read() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const seriesParam = searchParams.get('series') || ''
  const titleParam = searchParams.get('title') || ''
  const [pages, setPages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [chapters, setChapters] = useState([])
  const [seriesInfo, setSeriesInfo] = useState(null)
  // Width control (convert zoom to widening the whole container)
  const widthLevels = ['max-w-3xl','max-w-4xl','max-w-5xl','max-w-6xl','max-w-7xl']
  const [widthLevel, setWidthLevel] = useState(3)
  const [showBar, setShowBar] = useState(true)
  const [lastY, setLastY] = useState(0)

  const seriesId = useMemo(() => {
    if (seriesParam) return seriesParam
    // try to derive from id if in the form series/xxx
    const raw = String(id || '')
    const maybe = raw.includes('/') ? raw.split('/')[0] : ''
    return maybe
  }, [id, seriesParam])

  const titleId = useMemo(() => sanitizeTitleId(titleParam || ''), [titleParam])

  useEffect(() => {
    let mounted = true
    async function run() {
      try {
        const res = await api.read(id)
        if (!mounted) return
        const imgs = Array.isArray(res) ? res : (res.pages || res.images || res.items || [])
        setPages(imgs.map(getImage))
      } catch (e) {
        if (mounted) setError(e)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    run()
    return () => { mounted = false }
  }, [id])

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
      const res = await api.chapters(seriesId)
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
      const info = await api.info(seriesId, titleId)
      if (mounted) {
        setSeriesInfo(info)
        try { localStorage.setItem(`series-info:${seriesId}:${titleId}`, JSON.stringify(info)) } catch {}
      }
      } catch (_) {}
    })()
    return () => { mounted = false }
  }, [seriesId, titleId])

  // Normalize to oldest -> newest for intuitive navigation (Prev = older, Next = newer)
  const orderedChapterIds = useMemo(() => {
    const ids = chapters.map((ch) => ch.id || ch.slug || ch.urlId || ch.href || ch.url || ch.cid || ch.chapterId).map((v) => String(v))
    // Most APIs return latest first; we show oldest->newest for correct next/prev semantics
    return ids.slice(0).reverse()
  }, [chapters])

  const currentIndex = useMemo(() => {
    const raw = String(id || '')
    const byExact = orderedChapterIds.findIndex((x) => x === raw)
    if (byExact !== -1) return byExact
    // try last segment match
    const seg = raw.split('/').pop()
    return orderedChapterIds.findIndex((x) => String(x).split('/').pop() === seg)
  }, [id, orderedChapterIds])

  const prevId = currentIndex > 0 ? orderedChapterIds[currentIndex - 1] : null
  const nextId = currentIndex !== -1 && currentIndex + 1 < orderedChapterIds.length ? orderedChapterIds[currentIndex + 1] : null
  const isLast = !nextId

  function goPrev() {
    if (prevId) {
      navigate(`/read/${encodeURIComponent(prevId)}${seriesId ? `?series=${encodeURIComponent(seriesId)}&title=${encodeURIComponent(titleId)}` : ''}`)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }
  function goNext() {
    if (nextId) {
      navigate(`/read/${encodeURIComponent(nextId)}${seriesId ? `?series=${encodeURIComponent(seriesId)}&title=${encodeURIComponent(titleId)}` : ''}`)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const infoHref = seriesId && titleId ? `/info/${encodeURIComponent(seriesId)}/${encodeURIComponent(titleId)}` : '/home'

  function widen() { setWidthLevel((i) => Math.min(widthLevels.length - 1, i + 1)) }
  function narrow() { setWidthLevel((i) => Math.max(0, i - 1)) }
  function widthReset() { setWidthLevel(0) }

  useEffect(() => {
    function onKey(e) {
      if (e.ctrlKey || e.metaKey) return
      if (e.key === '+') widen()
      if (e.key === '-') narrow()
      if (e.key.toLowerCase() === '0') widthReset()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

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

  // Persist recent read progress in localStorage
  useEffect(() => {
    if (!seriesId || currentIndex < 0) return
    try {
      const key = 'recent-reads'
      const raw = localStorage.getItem(key)
      const list = Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : []
      const cover = getImage(pickImage(seriesInfo || {}) || seriesInfo?.img)
      const title = seriesInfo?.title || titleId || 'Series'
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
  }, [seriesId, titleId, seriesInfo, currentIndex, orderedChapterIds, id])

  return (
    <div className="min-h-screen">
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
                  {seriesInfo?.title || titleId || 'Series'}
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
                      navigate(`/read/${encodeURIComponent(targetId)}${seriesId ? `?series=${encodeURIComponent(seriesId)}&title=${encodeURIComponent(titleId)}` : ''}`)
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }
                  }}
                >
                  {orderedChapterIds.map((cid, idx) => (
                    <option key={cid} value={String(idx)}>
                      {`Chapter ${idx + 1}`}
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
        <div className={`${widthLevels[widthLevel]} mx-auto w-full px-0 sm:px-4 py-6 max-w-none`}>
          {loading && <div className="text-stone-700 dark:text-gray-300">Loading…</div>}
          {error && <div className="text-red-600 dark:text-red-400">{String(error)}</div>}
          <div className="space-y-0">
            {pages?.map((src, i) => (
              <div key={i} className="w-full overflow-hidden rounded-none sm:rounded-lg bg-transparent sm:bg-stone-100 dark:sm:bg-gray-800">
                <img src={getImage(src)} alt={`page-${i + 1}`} className="w-full block" />
              </div>
            ))}
          </div>
        </div>
        {/* Floating width toolbar (hidden on mobile) */}
        <div className="hidden sm:block fixed left-3 bottom-3 z-30">
          <div className="inline-flex items-center gap-2 rounded-xl border border-stone-300 dark:border-gray-700 bg-white/90 dark:bg-gray-900/90 backdrop-blur px-2 py-1.5 shadow-sm">
            <button onClick={narrow} className="px-2.5 py-1 rounded-md border border-stone-200 dark:border-gray-700 text-stone-700 dark:text-gray-300">- Width</button>
            <div className="px-1.5 text-xs text-stone-700 dark:text-gray-300 w-24 text-center">{widthLevels[widthLevel].replace('max-w-','')}</div>
            <button onClick={widen} className="px-2.5 py-1 rounded-md border border-stone-200 dark:border-gray-700 text-stone-700 dark:text-gray-300">+ Width</button>
            <button onClick={widthReset} className="px-2.5 py-1 rounded-md border border-stone-200 dark:border-gray-700 text-stone-700 dark:text-gray-300">Reset</button>
          </div>
        </div>
      </section>

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
              <div className="text-xs text-stone-500 dark:text-gray-400 mt-1">{prevId ? `Ch. ${Math.max(1, (currentIndex) )}` : ''}</div>
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
                <div className="text-xs text-stone-500 dark:text-gray-400 mt-1">{nextId ? `Ch. ${currentIndex + 2}` : ''}</div>
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


