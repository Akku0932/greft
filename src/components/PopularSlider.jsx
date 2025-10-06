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
      // Shuffle a fresh 10 from the full pool
      const shuffled = items.slice(0).sort(() => Math.random() - 0.5).slice(0, 10)
      setList(shuffled)
      setActive(0)
    }
  }, [items])

  // Fetch missing info for visible list to ensure genres/description are available
  useEffect(() => {
    if (!list || list.length === 0) return
    let cancelled = false
    ;(async () => {
      const tasks = list.map(async (it) => {
        const combined = it.seriesId || it.id || it.slug || it.urlId
        const { id, titleId } = parseIdTitle(combined, it.titleId || it.slug)
        if (!id) return
        if (it.info || extra[id]) return
        try {
          const { api } = await import('../lib/api.js')
          const info = await api.info(id, titleId)
          if (!cancelled && info) {
            setExtra((m) => ({ ...m, [id]: info }))
          }
        } catch (_) {}
      })
      await Promise.allSettled(tasks)
    })()
    return () => { cancelled = true }
  }, [list])

  function shuffle(arr) { return arr.slice(0).sort(() => Math.random() - 0.5) }

  function nextSlide() {
    if (!list || list.length === 0) return
    if (active + 1 >= list.length) {
      // Reshuffle a new set of 10 from the full items pool
      const reshuffled = items && items.length ? items.slice(0).sort(() => Math.random() - 0.5).slice(0, 10) : shuffle(list)
      setList(reshuffled)
      setActive(0)
    } else {
      setActive((a) => a + 1)
    }
  }

  function prevSlide() {
    if (!list || list.length === 0) return
    setActive((a) => Math.max(0, a - 1))
  }

  // auto-advance to the right
  useEffect(() => {
    if (!list || list.length <= 1) return
    if (isHover) return
    timerRef.current && clearInterval(timerRef.current)
    timerRef.current = setInterval(() => { nextSlide() }, 5000)
    return () => timerRef.current && clearInterval(timerRef.current)
  }, [list, isHover, active])

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
      const res = await (await import('../lib/api.js')).api.chapters(id)
      const list = Array.isArray(res) ? res : (res.items || [])
      if (!list.length) return
      const latest = list[0] || list[list.length - 1]
      const chapterId = latest.id || latest.slug || latest.urlId
      if (chapterId) navigate(`/read/${encodeURIComponent(chapterId)}?series=${encodeURIComponent(id)}&title=${encodeURIComponent(titleId)}`)
    } catch (_) {
      // no-op; keep UX silent if missing data
    }
  }

  return (
    <section id="popular" className="relative bg-transparent">
      <div className="max-w-[95vw] mx-auto px-6 sm:px-8 py-10">
        <div className="relative overflow-hidden rounded-2xl ring-1 ring-white/10 dark:ring-gray-700/30 min-h-[560px]"
             onMouseEnter={() => setIsHover(true)} onMouseLeave={() => setIsHover(false)}>
          {bg && (
            <>
              <img src={bg} alt="bg" className="absolute inset-0 w-full h-full object-cover scale-105" />
              <div className="absolute inset-0 backdrop-blur-md" />
              {/* Vertical depth gradient - stronger bottom black blend */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/70 to-black/95" />
              {/* Side vignettes - stronger */}
              <div className="absolute inset-0 bg-gradient-to-r from-black/15 via-transparent to-black/15" />
              {/* Radial focus vignette - stronger */}
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0)_50%,rgba(0,0,0,0.5)_100%)]" />
            </>
          )}
          {activeItem && (
            <div className="relative z-10 p-6 md:p-10">
              <div className="flex items-start gap-6 md:gap-10">
                <div className="flex-1 min-w-0 max-w-none mt-36 md:mt-64">
                  <div className="text-3xl md:text-5xl font-extrabold leading-tight bg-clip-text text-transparent truncate"
                       style={{ backgroundImage: titleGradient }}>
                    {activeItem.title || info.title || 'Untitled'}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {(() => {
                      const tagsRaw = info?.otherInfo?.tags || info?.tags || activeItem?.tags || []
                      const tags = Array.isArray(tagsRaw) ? tagsRaw : []
                      const label = (v) => typeof v === 'string' ? v : (v?.name || v?.author || v?.tag || '')
                      const finalTags = tags.map(label).filter(Boolean)
                      return (finalTags.length ? finalTags : ['Unknown']).slice(0,5).map((t) => (
                        <span key={t} className="px-2 py-0.5 rounded-full text-xs bg-white/10 text-white">{t}</span>
                      ))
                    })()}
                  </div>
                   {(() => {
                     const desc = info?.description || info?.summary || activeItem?.description || activeItem?.summary || ''
                     return desc ? (
                       <p className="mt-3 md:mt-4 max-w-none text-white/85 line-clamp-2">{desc}</p>
                     ) : null
                   })()}
                  <div className="mt-6 flex justify-end gap-3">
                    <Link
                      to={`/info/${encodeURIComponent(parsed.id)}/${encodeURIComponent(sanitizeTitleId(parsed.titleId || 'title'))}`}
                      className="px-6 py-3 rounded-lg bg-white/10 dark:bg-gray-800/30 text-white hover:bg-white/20 dark:hover:bg-gray-700/40 backdrop-blur-sm border border-white/20 dark:border-gray-600/30 transition-all duration-200 font-medium"
                    >
                      Details
                    </Link>
                    <button
                      onClick={() => onReadNow(activeItem)}
                      className="px-6 py-3 rounded-lg text-white hover:opacity-90 font-medium shadow-lg hover:shadow-xl transition-all duration-200"
                      style={{ backgroundImage: titleGradient }}
                    >
                      Read Now
                    </button>
                  </div>
                </div>
                 <div className="hidden md:block w-[280px] shrink-0 mt-12 md:mt-20">
                   <div className="relative rounded-2xl overflow-hidden shadow-soft dark:shadow-soft-dark ring-1 ring-white/15 dark:ring-gray-600/30 bg-transparent">
                     <div className="absolute -inset-1 rounded-3xl bg-gradient-to-br from-white/10 dark:from-gray-700/20 to-transparent" />
                     <div className="relative p-2">
                     <div className="relative aspect-[3/4] w-full rounded-xl overflow-hidden bg-black/40 flex items-center justify-center">
                        <img src={getImage(pickImage(activeItem) || pickImage(info))} alt="thumb" className="w-full h-full object-cover" loading="eager" />
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute top-4 right-4 flex items-center gap-2 text-white/80">
                <button onClick={prevSlide} className="h-9 w-9 rounded-full bg-black/40 dark:bg-gray-800/60 hover:bg-black/60 dark:hover:bg-gray-700/80 backdrop-blur-sm border border-white/20 dark:border-gray-600/30 transition-all duration-200">‹</button>
                <div className="text-sm font-medium px-2 py-1 bg-black/40 dark:bg-gray-800/60 rounded-lg backdrop-blur-sm border border-white/20 dark:border-gray-600/30">{active + 1} / {list?.length || 0}</div>
                <button onClick={nextSlide} className="h-9 w-9 rounded-full bg-black/40 dark:bg-gray-800/60 hover:bg-black/60 dark:hover:bg-gray-700/80 backdrop-blur-sm border border-white/20 dark:border-gray-600/30 transition-all duration-200">›</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}


