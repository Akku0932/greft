import { useEffect, useRef, useState } from 'react'
import { useTheme } from '../contexts/ThemeContext.jsx'
import { getImage, pickImage, sanitizeTitleId, parseIdTitle } from '../lib/api.js'
import { Link, useNavigate } from 'react-router-dom'

export default function PopularSlider({ items }) {
  const { theme } = useTheme()
  const containerRef = useRef(null)
  const timerRef = useRef(null)
  const [active, setActive] = useState(0)
  const [isHover, setIsHover] = useState(false)
  const [extra, setExtra] = useState({}) // cache info by base id
  const [chaptersCache, setChaptersCache] = useState({}) // cache chapters by id
  const [list, setList] = useState(items || [])
  const [titleGradient, setTitleGradient] = useState('linear-gradient(to right, rgba(255,123,23,0.9), #ffffff)')
  const gradientPalette = [
    ['#FF7B17', '#FFD1A6'],
    ['#22D3EE', '#A7F3D0'],
    ['#A78BFA', '#FBCFE8'],
    ['#34D399', '#FDE68A'],
    ['#F59E0B', '#FECACA'],
    ['#EF4444', '#FDE68A'],
    ['#06B6D4', '#93C5FD'],
    ['#10B981', '#FBCFE8'],
  ]
  const navigate = useNavigate()
  const shownIdsRef = useRef(new Set())
  const infoInflightRef = useRef({})
  const chaptersInflightRef = useRef({})

  // Lightweight TTL cache helpers (localStorage)
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
  const TTL_INFO = 20 * 60 * 1000
  const TTL_CH = 20 * 60 * 1000

  function getItemId(it) {
    return String(it?.seriesId || it?.id || it?.slug || it?.urlId || '')
  }

  function cryptoShuffle(array) {
    const a = array.slice(0)
    for (let i = a.length - 1; i > 0; i--) {
      const randArray = new Uint32Array(1)
      window.crypto && window.crypto.getRandomValues ? window.crypto.getRandomValues(randArray) : (randArray[0] = Math.floor(Math.random() * 0xffffffff))
      const j = randArray[0] % (i + 1)
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }

  function sampleUnique(itemsArr, count) {
    const all = Array.isArray(itemsArr) ? itemsArr.slice(0) : []
    // Prefer items not shown recently
    const unseen = all.filter((it) => !shownIdsRef.current.has(getItemId(it)))
    const pool = (unseen.length >= count ? unseen : all)
    const shuffled = cryptoShuffle(pool)
    const pick = shuffled.filter((it, idx, arr) => arr.findIndex((x) => getItemId(x) === getItemId(it)) === idx).slice(0, count)
    // Track as shown
    pick.forEach((it) => {
      const id = getItemId(it)
      if (id) shownIdsRef.current.add(id)
    })
    // If we've shown most of the catalog, reset the memory to allow fresh cycles
    if (shownIdsRef.current.size > Math.max(10, Math.floor((all.length || 0) * 0.8))) {
      shownIdsRef.current = new Set(pick.map(getItemId))
    }
    return pick
  }

  // preload: accept pre-attached info from Home; fallback to existing extra
  useEffect(() => {
    if (!items) return
    const seed = {}
    items.forEach((it) => {
      const combined = it.seriesId || it.id || it.slug || it.urlId
      const parsed = parseIdTitle(combined, it.titleId || it.slug)
      if (it.info) seed[parsed.id] = it.info
    })
    if (Object.keys(seed).length) setExtra((m) => ({ ...seed, ...m }))
  }, [items])

  // initialize local list and reset active when items change
  useEffect(() => {
    if (Array.isArray(items) && items.length) {
      const sample = sampleUnique(items, 10)
      setList(sample)
      setActive(0)
      
      // Preload chapters for first item only (reduce network burst)
      setTimeout(async () => {
        const first = sample[0]
        if (!first) return
        const combined = first.seriesId || first.id || first.slug || first.urlId
        const { id } = parseIdTitle(combined, first.titleId || first.slug)
        if (!id || chaptersCache[id]) return
        const cacheKey = `mp:chapters:${id}`
        const cached = readTTL(cacheKey, TTL_CH)
        if (cached) { setChaptersCache(prev => ({ ...prev, [id]: cached })); return }
        if (chaptersInflightRef.current[id]) return
        chaptersInflightRef.current[id] = true
        try {
          const { api } = await import('../lib/api.js')
          const res = await api.chapters(id, 'mp')
          const list = Array.isArray(res) ? res : (res.items || [])
          writeTTL(cacheKey, list)
          setChaptersCache(prev => ({ ...prev, [id]: list }))
        } catch {} finally { delete chaptersInflightRef.current[id] }
      }, 100)
    }
  }, [items])

  // Fetch missing info for visible list to ensure genres/description are available (with TTL + dedupe)
  useEffect(() => {
    if (!list || list.length === 0) return
    let cancelled = false
    ;(async () => {
      // Only fetch info for current and next 2 slides for faster loading
      const visibleIndices = [active, (active + 1) % list.length, (active + 2) % list.length]
      const tasks = visibleIndices.map(async (index) => {
        const it = list[index]
        if (!it) return
        const combined = it.seriesId || it.id || it.slug || it.urlId
        const { id, titleId } = parseIdTitle(combined, it.titleId || it.slug)
        if (!id) return
        if (it.info || extra[id]) return
        const cacheKey = `mp:info:${id}`
        const cached = readTTL(cacheKey, TTL_INFO)
        if (cached && !cancelled) { setExtra((m) => ({ ...m, [id]: cached })); return }
        if (infoInflightRef.current[id]) return
        infoInflightRef.current[id] = true
        try {
          const { api } = await import('../lib/api.js')
          const info = await api.info(id, titleId, 'mp')
          if (!cancelled && info) {
            writeTTL(cacheKey, info)
            setExtra((m) => ({ ...m, [id]: info }))
          }
        } catch (_) {} finally { delete infoInflightRef.current[id] }
      })
      await Promise.allSettled(tasks)
    })()
    return () => { cancelled = true }
  }, [list, active])

  function shuffle(arr) { return cryptoShuffle(arr) }

  function nextSlide() {
    if (!list || list.length === 0) return
    if (active + 1 >= list.length) {
      // Get a fresh unique sample of 10 from the full items pool
      const reshuffled = items && items.length ? sampleUnique(items, 10) : shuffle(list)
      setList(reshuffled)
      setActive(0)
      
      // Preload chapters for new first 3 items
      setTimeout(() => {
        reshuffled.slice(0, 3).forEach(async (item) => {
          const combined = item.seriesId || item.id || item.slug || item.urlId
          const { id } = parseIdTitle(combined, item.titleId || item.slug)
          if (!id || chaptersCache[id]) return
          
          try {
          const { api } = await import('../lib/api.js')
          const res = await api.chapters(id, 'mp')
            const list = Array.isArray(res) ? res : (res.items || [])
            setChaptersCache(prev => ({ ...prev, [id]: list }))
          } catch {}
        })
      }, 100)
    } else {
      setActive((a) => a + 1)
      
      // Preload chapters for next item when advancing
      const nextIndex = (active + 1) % list.length
      const nextItem = list[nextIndex]
      if (nextItem) {
        const combined = nextItem.seriesId || nextItem.id || nextItem.slug || nextItem.urlId
        const { id } = parseIdTitle(combined, nextItem.titleId || nextItem.slug)
        if (id && !chaptersCache[id]) {
          setTimeout(async () => {
            try {
              const { api } = await import('../lib/api.js')
              const res = await api.chapters(id)
              const list = Array.isArray(res) ? res : (res.items || [])
              setChaptersCache(prev => ({ ...prev, [id]: list }))
            } catch {}
          }, 100)
        }
      }
    }
  }

  function prevSlide() {
    if (!list || list.length === 0) return
    setActive((a) => Math.max(0, a - 1))
  }

  // auto-advance to the right (pause when tab hidden or hover or reduced-motion)
  useEffect(() => {
    if (!list || list.length <= 1) return
    if (isHover) return
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    timerRef.current && clearInterval(timerRef.current)
    timerRef.current = setInterval(() => { nextSlide() }, 5000)
    return () => timerRef.current && clearInterval(timerRef.current)
  }, [list, isHover, active])

  // Pause autoplay when tab is hidden
  useEffect(() => {
    function onVisibility() {
      if (document.hidden && timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      } else if (!document.hidden && !timerRef.current && list && list.length > 1 && !isHover) {
        timerRef.current = setInterval(() => { nextSlide() }, 5000)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [list, isHover])

  // keyboard navigation
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'ArrowRight') nextSlide()
      if (e.key === 'ArrowLeft') prevSlide()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [list, active])

  const activeItem = list?.[active]
  const combined = activeItem ? (activeItem.seriesId || activeItem.id || activeItem.slug || activeItem.urlId) : ''
  const parsed = activeItem ? parseIdTitle(combined, activeItem?.titleId || activeItem?.slug) : { id: '', titleId: '' }
  const info = activeItem ? (activeItem.info || extra[parsed.id] || {}) : {}
  const bg = getImage(pickImage(info) || pickImage(activeItem || {}))
  function isAdult(infoOrItem) {
    let tags = infoOrItem?.otherInfo?.tags || infoOrItem?.tags
    if (!Array.isArray(tags)) {
      try {
        const combined = activeItem ? (activeItem.seriesId || activeItem.id || activeItem.slug || activeItem.urlId) : ''
        const { id } = activeItem ? parseIdTitle(combined, activeItem.titleId || activeItem.slug) : { id: '' }
        const key = id ? `mp:info:${id}` : ''
        if (key) {
          const cached = localStorage.getItem(key)
          const inf = cached ? JSON.parse(cached) : null
          tags = inf?.otherInfo?.tags || inf?.tags || inf?.genres
        }
      } catch {}
    }
    const arr = Array.isArray(tags) ? tags : []
    return arr.some(t => /adult|ecchi/i.test(String(t)))
  }
  function adultAllowed() {
    try { const obj = JSON.parse(localStorage.getItem('site:settings')||'{}'); return !!obj.adultAllowed } catch { return false }
  }

  // random gradient per slide (deterministic by index)
  useEffect(() => {
    if (!list || list.length === 0) return
    const [c1, c2] = gradientPalette[active % gradientPalette.length]
    setTitleGradient(`linear-gradient(to right, ${c1}, ${c2})`)
  }, [active, list])

  async function onReadNow(item) {
    try {
      const combined = item.seriesId || item.id || item.slug || item.urlId
      const { id, titleId } = parseIdTitle(combined, item.titleId || item.slug)
      
      // Check cache first
      let list = chaptersCache[id]
      if (!list) {
        const res = await (await import('../lib/api.js')).api.chapters(id)
        list = Array.isArray(res) ? res : (res.items || [])
        // Cache the chapters
        setChaptersCache(prev => ({ ...prev, [id]: list }))
      }
      
      if (!list.length) return
      const latest = list[0] || list[list.length - 1]
      const chapterId = latest.id || latest.slug || latest.urlId
      if (chapterId) {
        // Determine source based on series ID format
        const isMF = id && id.includes('.') && !id.includes('/')
        const url = isMF 
          ? `/read/chapter/${chapterId}?series=${encodeURIComponent(id)}&title=${encodeURIComponent(titleId)}`
          : `/read/${encodeURIComponent(chapterId)}?series=${encodeURIComponent(id)}&title=${encodeURIComponent(titleId)}&src=mp`
        navigate(url)
      }
    } catch (_) {
      // no-op; keep UX silent if missing data
    }
  }

  return (
    <section id="popular" className="relative bg-transparent">
      <div className="max-w-[95vw] mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-10">
        <div className="relative overflow-hidden rounded-2xl ring-1 ring-white/10 dark:ring-gray-700/30 min-h-[440px] md:min-h-[560px]"
             onMouseEnter={() => setIsHover(true)} onMouseLeave={() => setIsHover(false)}>
          {bg && (
          <>
              <img src={bg} alt="bg" className="absolute inset-0 w-full h-full object-cover md:scale-105" loading={active===0?"eager":"lazy"} decoding="async" style={{ filter: (!adultAllowed() && isAdult(info)) ? 'blur(18px)' : 'none' }} />
              <div className="absolute inset-0 backdrop-blur-none md:backdrop-blur-md" />
              {/* Mobile lighter, desktop stronger gradients */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/40 to-black/80 md:from-black/30 md:via-black/60 md:to-black/95" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/5 via-transparent to-black/5 md:from-black/15 md:via-transparent md:to-black/15" />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0)_60%,rgba(0,0,0,0.35)_100%)] md:bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0)_50%,rgba(0,0,0,0.5)_100%)]" />
            </>
          )}
          {activeItem && (
            <div className="relative z-10 p-4 sm:p-6 md:p-10">
      <div className="flex flex-col md:flex-row items-center md:items-start gap-4 sm:gap-6 md:gap-10">
                <div className="flex-1 min-w-0 max-w-none mt-[75%] sm:mt-56 md:mt-64">
                  {/* Mobile: allow up to 2 lines; Desktop: single-line ellipsis */}
                  <div className="text-2xl sm:text-3xl md:text-5xl font-extrabold leading-tight bg-clip-text text-transparent line-clamp-2 md:line-clamp-none md:truncate md:whitespace-nowrap text-center md:text-left"
                       style={{ backgroundImage: titleGradient }}>
                    {activeItem.title || info.title || 'Untitled'}
                  </div>
                  <div className="mt-3 md:mt-4 flex flex-wrap gap-2 justify-center md:justify-start">
                    {(() => {
                      const tagsRaw = info?.otherInfo?.tags || info?.tags || activeItem?.tags || []
                      const tags = Array.isArray(tagsRaw) ? tagsRaw : []
                      const label = (v) => typeof v === 'string' ? v : (v?.name || v?.author || v?.tag || '')
                      const finalTags = tags.map(label).filter(Boolean)
                      return (finalTags.length ? finalTags : ['Unknown']).slice(0,5).map((t) => (
                        <span key={t} className="px-2 py-0.5 rounded-full text-[10px] sm:text-xs bg-white/10 text-white">{t}</span>
                      ))
                    })()}
                  </div>
                  {/* Hide description on mobile per request */}
                   <div className="hidden md:block">
                    {(() => {
                      const desc = info?.description || info?.summary || activeItem?.description || activeItem?.summary || ''
                      return desc ? (
                        <p className="mt-2 md:mt-4 max-w-2xl md:max-w-none text-white/85 line-clamp-2 md:line-clamp-2 text-sm md:text-base">{desc}</p>
                      ) : null
                    })()}
                  </div>
                   <div className="mt-4 md:mt-6 flex flex-wrap justify-center md:justify-start gap-2 md:gap-3">
                    <Link
                      to={`/info/${encodeURIComponent(parsed.id)}?src=mp`}
                       className="px-5 sm:px-6 py-2.5 sm:py-3 rounded-full bg-white/10 dark:bg-gray-800/30 text-white hover:bg-white/20 dark:hover:bg-gray-700/40 backdrop-blur-sm border border-white/20 dark:border-gray-600/30 transition-all duration-200 font-medium"
                    >
                      Details
                    </Link>
                    <button
                      onClick={() => onReadNow(activeItem)}
                       className="px-5 sm:px-6 py-2.5 sm:py-3 rounded-full text-white hover:opacity-90 font-medium shadow-lg hover:shadow-xl transition-all duration-200"
                      style={{ backgroundImage: titleGradient }}
                    >
                      Read Now
                    </button>
                  </div>
                </div>
                <div className="hidden md:block w-[240px] lg:w-[280px] shrink-0 mt-8 md:mt-20">
                   <div className="relative rounded-2xl overflow-hidden shadow-soft dark:shadow-soft-dark ring-1 ring-white/15 dark:ring-gray-600/30 bg-transparent">
                     <div className="absolute -inset-1 rounded-3xl bg-gradient-to-br from-white/10 dark:from-gray-700/20 to-transparent" />
                     <div className="relative p-2">
                    <div className="relative aspect-[3/4] w-full rounded-xl overflow-hidden bg-black/40 flex items-center justify-center">
                        <img src={getImage(pickImage(activeItem) || pickImage(info))} alt="thumb" className="w-full h-full object-cover" loading="eager" decoding="async" style={{ filter: (!adultAllowed() && isAdult(info)) ? 'blur(24px)' : 'none' }} />
                        {(!adultAllowed() && isAdult(info)) && <div className="absolute inset-0 flex items-center justify-center"><span className="px-2 py-1 rounded bg-black/70 text-white text-xs">18+ hidden</span></div>}
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute top-3 right-3 sm:top-4 sm:right-4 flex items-center gap-2 text-white/80">
                <button onClick={prevSlide} className="h-10 w-10 sm:h-9 sm:w-9 rounded-full bg-black/40 dark:bg-gray-800/60 hover:bg-black/60 dark:hover:bg-gray-700/80 backdrop-blur-sm border border-white/20 dark:border-gray-600/30 transition-all duration-200">‹</button>
                <div className="text-xs sm:text-sm font-medium px-2 py-1 bg-black/40 dark:bg-gray-800/60 rounded-lg backdrop-blur-sm border border-white/20 dark:border-gray-600/30">{active + 1} / {list?.length || 0}</div>
                <button onClick={nextSlide} className="h-10 w-10 sm:h-9 sm:w-9 rounded-full bg-black/40 dark:bg-gray-800/60 hover:bg-black/60 dark:hover:bg-gray-700/80 backdrop-blur-sm border border-white/20 dark:border-gray-600/30 transition-all duration-200">›</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}


