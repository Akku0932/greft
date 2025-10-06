import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { useTheme } from '../contexts/ThemeContext.jsx'
import { api, extractItems, getImage, pickImage, parseIdTitle, sanitizeTitleId } from '../lib/api.js'

export default function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { theme, toggleTheme } = useTheme()
  const [term, setTerm] = useState('')
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const boxRef = useRef(null)
  const timerRef = useRef(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [showBar, setShowBar] = useState(true)
  const lastYRef = useRef(0)

  useEffect(() => {
    if (expanded) {
      document.body.classList.add('overflow-hidden')
    } else {
      document.body.classList.remove('overflow-hidden')
    }
    return () => document.body.classList.remove('overflow-hidden')
  }, [expanded])

  // Hide navbar on scroll down, show on scroll up
  useEffect(() => {
    const isRead = String(location.pathname || '').startsWith('/read')
    if (isRead) {
      setShowBar(false)
      return
    }
    function onScroll() {
      const y = window.scrollY || 0
      const goingUp = y < lastYRef.current
      const nearTop = y < 16
      setShowBar(goingUp || nearTop)
      lastYRef.current = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [location.pathname])

  function onSubmit(e) {
    e.preventDefault()
    const q = term.trim()
    if (q) navigate(`/search?q=${encodeURIComponent(q)}`)
  }

  useEffect(() => {
    if (!term.trim()) {
      setResults([])
      setOpen(false)
      setSearchLoading(false)
      return
    }
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      try {
        setSearchLoading(true)
        // cache-first
        const cacheKey = `search:${term.trim().toLowerCase()}`
        try {
          const cached = localStorage.getItem(cacheKey)
          if (cached) {
            const parsed = JSON.parse(cached)
            if (Array.isArray(parsed)) setResults(parsed)
          }
        } catch {}
        const data = await api.search(term.trim())
        const items = extractItems(data) || []
        setResults(items)
        try { localStorage.setItem(cacheKey, JSON.stringify(items)) } catch {}
        setOpen(true)
        setActiveIdx(-1)
      } catch {
        setResults([])
        setOpen(false)
      } finally { setSearchLoading(false) }
    }, 200)
    return () => clearTimeout(timerRef.current)
  }, [term])

  function gotoInfoFromItem(item) {
    const combined = item.seriesId || item.id || item._id || item.slug || item.urlId || ''
    const parsed = parseIdTitle(combined, item.title || item.name || item.slug)
    if (!parsed.id) return
    navigate(`/info/${encodeURIComponent(parsed.id)}/${encodeURIComponent(sanitizeTitleId(parsed.titleId || 'title'))}`)
    setOpen(false)
  }

  function onKeyDown(e) {
    if (!open || results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => (i + 1) % results.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => (i <= 0 ? results.length - 1 : i - 1))
    } else if (e.key === 'Enter') {
      if (activeIdx >= 0 && activeIdx < results.length) {
        e.preventDefault()
        gotoInfoFromItem(results[activeIdx])
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <>
    <header className={`sticky top-0 z-40 bg-white/80 dark:bg-black/70 backdrop-blur-xl border-b border-stone-200 dark:border-gray-800 transition-all duration-200 ${String(location.pathname || '').startsWith('/read') ? 'hidden' : (showBar ? 'translate-y-0' : '-translate-y-full')}`}>
      <div className="max-w-[120rem] mx-auto px-4 sm:px-6 py-3 sm:py-5 grid grid-cols-[auto_1fr_auto] items-center gap-4 sm:gap-8">
        {/* Left: Logo */}
        <div className="justify-self-start">
          <Link to="/home" className="flex items-center gap-3 font-semibold text-lg sm:text-xl tracking-tight text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-stone-400 dark:focus:ring-gray-600 rounded-md">
            <img src="/logo.png" alt="Greft" className="h-9 w-9 sm:h-12 sm:w-12 rounded" />
            <span className="hidden xs:inline">Greft</span>
          </Link>
        </div>

        {/* Center: Compact search (hidden on small; use icon on right) */}
        <div className="justify-self-center w-full hidden sm:flex items-center justify-center">
          <div className="relative w-[520px] max-w-full" ref={boxRef}>
            <form onSubmit={onSubmit} className="flex">
              <input
                value={term}
                readOnly
                onClick={()=>{ setExpanded(true); setOpen(false) }}
                placeholder="Search..."
                className="w-full rounded-md border border-stone-300 dark:border-gray-700 bg-transparent text-stone-900 dark:text-white placeholder-stone-500 dark:placeholder-gray-400 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-stone-400 dark:focus:ring-gray-600 cursor-text"
              />
            </form>
            {!expanded && (open || searchLoading) && (
              <div className="absolute left-0 right-0 mt-2 rounded-xl border border-stone-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-soft overflow-hidden max-h-[70vh] overflow-y-auto">
                {searchLoading && (
                  <div className="px-3 py-2 text-sm text-stone-500 dark:text-gray-400">Searching…</div>
                )}
                {results.map((item, idx) => {
                  const cover = getImage(pickImage(item))
                  const title = item.title || item.name || 'Untitled'
                  return (
                    <button
                      key={(item.id || item.seriesId || item.slug || title) + idx}
                      onMouseDown={(e)=>e.preventDefault()}
                      onClick={() => gotoInfoFromItem(item)}
                      className={`w-full text-left flex items-center gap-3 px-3 py-2 border-t border-stone-100 dark:border-gray-700 first:border-t-0 hover:bg-stone-50 dark:hover:bg-gray-700 ${idx===activeIdx ? 'bg-stone-50 dark:bg-gray-700' : ''}`}
                    >
                      {cover ? <img src={cover} alt="" className="h-9 w-7 object-cover rounded" /> : <div className="h-9 w-7 bg-stone-200 dark:bg-gray-600 rounded" />}
                      <span className="truncate text-sm text-stone-900 dark:text-white">{title}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Links + menu */}
        <div className="justify-self-end flex items-center gap-2 sm:gap-5 text-sm text-stone-700 dark:text-gray-300">
          <div className="hidden md:flex items-center gap-5">
            <Link to="/home#categories" className="hover:text-stone-900 dark:hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-stone-400 dark:focus:ring-gray-600 rounded-md px-1">Categories</Link>
            <Link to="/search" className="hover:text-stone-900 dark:hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-stone-400 dark:focus:ring-gray-600 rounded-md px-1">Search</Link>
            <Link to="/home#my-list" className="hover:text-stone-900 dark:hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-stone-400 dark:focus:ring-gray-600 rounded-md px-1">My List</Link>
          </div>
          
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="h-9 w-9 rounded-full bg-stone-900 dark:bg-gray-700 text-white dark:text-gray-200 flex items-center justify-center hover:bg-stone-800 dark:hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-stone-400 dark:focus:ring-gray-600"
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            aria-label="Toggle theme"
          >
            {theme === 'light' ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path d="M12 4.5a1 1 0 0 1 1 1V7a1 1 0 1 1-2 0V5.5a1 1 0 0 1 1-1zm0 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM4.5 12a1 1 0 0 1 1-1H7a1 1 0 1 1 0 2H5.5a1 1 0 0 1-1-1zm11 0a1 1 0 0 1 1-1H19a1 1 0 1 1 0 2h-2.5a1 1 0 0 1-1-1zM6.22 6.22a1 1 0 0 1 1.42 0L8.28 6.86a1 1 0 1 1-1.42 1.42L6.22 7.64a1 1 0 0 1 0-1.42zm9.5 9.5a1 1 0 0 1 1.42 0l.64.64a1 1 0 1 1-1.42 1.42l-.64-.64a1 1 0 0 1 0-1.42zM6.86 15.72a1 1 0 0 1 0 1.42l-.64.64a1 1 0 0 1-1.42-1.42l.64-.64a1 1 0 0 1 1.42 0zm9.5-9.5a1 1 0 0 1 0 1.42l-.64.64a1 1 0 1 1-1.42-1.42l.64-.64a1 1 0 0 1 1.42 0z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
              </svg>
            )}
          </button>
          
          {/* Mobile search trigger */}
          <button
            onClick={()=>{ setExpanded(true); setOpen(false) }}
            className="sm:hidden h-9 w-9 rounded-full bg-stone-900 dark:bg-gray-700 text-white dark:text-gray-200 flex items-center justify-center hover:bg-stone-800 dark:hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-stone-400 dark:focus:ring-gray-600"
            aria-label="Open search"
            title="Search"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M10 4a6 6 0 104.472 10.03l4.249 4.249a1 1 0 001.415-1.415l-4.249-4.249A6 6 0 0010 4zm-4 6a4 4 0 118 0 4 4 0 01-8 0z"/></svg>
          </button>

          <div className="relative">
            <button onClick={()=>setMenuOpen((v)=>!v)} className="h-9 w-9 rounded-full bg-stone-900 dark:bg-gray-700 text-white dark:text-gray-200 flex items-center justify-center hover:bg-stone-800 dark:hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-stone-400 dark:focus:ring-gray-600" aria-haspopup="menu" aria-expanded={menuOpen} aria-label="Open menu">≡</button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-lg border border-stone-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-soft overflow-hidden" role="menu">
                <Link to="/login" className="block px-4 py-2 hover:bg-stone-50 dark:hover:bg-gray-700 text-stone-900 dark:text-white" role="menuitem">Register / Login</Link>
                <button className="w-full text-left px-4 py-2 hover:bg-stone-50 dark:hover:bg-gray-700 text-stone-900 dark:text-white" role="menuitem">Language</button>
                <button className="w-full text-left px-4 py-2 hover:bg-stone-50 dark:hover:bg-gray-700 text-stone-900 dark:text-white" role="menuitem">Settings</button>
                <button className="w-full text-left px-4 py-2 hover:bg-stone-50 dark:hover:bg-gray-700 text-stone-900 dark:text-white" role="menuitem">FAQ</button>
              </div>
            )}
          </div>
        </div>
      </div>

     </header>

     {/* Expanded search overlay outside header to blur entire app */}
    {expanded && (
      <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-lg" onClick={()=>{setExpanded(false); setOpen(false); setResults([]); setTerm('')}}>
        <div className="max-w-3xl mx-auto mt-16 sm:mt-24 px-3 sm:px-4" onClick={(e)=>e.stopPropagation()}>
           <div className="rounded-xl border border-stone-300 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-soft">
             <input
               autoFocus
               value={term}
               onChange={(e)=>setTerm(e.target.value)}
               onKeyDown={(e)=>{onKeyDown(e); if(e.key==='Escape'){ setExpanded(false); setOpen(false); setResults([]); setTerm('') }}}
               placeholder="Search comics, authors, tags..."
              className="w-full px-4 sm:px-5 py-3 sm:py-4 rounded-t-xl focus:outline-none bg-transparent text-stone-900 dark:text-white placeholder-stone-500 dark:placeholder-gray-400"
             />
            <div className="max-h-[60vh] overflow-y-auto">
              {searchLoading && (
                <div className="px-5 py-4 text-stone-500 dark:text-gray-400 text-sm">Searching…</div>
              )}
              {!searchLoading && results.length === 0 && (
                <div className="px-4 sm:px-5 py-4 text-stone-500 dark:text-gray-400 text-sm">Start typing to search…</div>
              )}
               {results.map((item, idx) => {
                 const cover = getImage(pickImage(item))
                 const title = item.title || item.name || 'Untitled'
                 return (
                   <button
                     key={(item.id || item.seriesId || item.slug || title) + 'modal' + idx}
                     onMouseDown={(e)=>e.preventDefault()}
                     onClick={() => { gotoInfoFromItem(item); setExpanded(false); setResults([]) }}
                    className={`w-full text-left flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3 border-t border-stone-100 dark:border-gray-700 first:border-t-0 hover:bg-stone-50 dark:hover:bg-gray-700 ${idx===activeIdx ? 'bg-stone-50 dark:bg-gray-700' : ''}`}
                   >
                    {cover ? <img src={cover} alt="" className="h-12 w-9 object-cover rounded" /> : <div className="h-12 w-9 bg-stone-200 dark:bg-gray-600 rounded" />}
                     <span className="truncate text-stone-900 dark:text-white">{title}</span>
                   </button>
                 )
               })}
             </div>
           </div>
         </div>
       </div>
     )}
    </>
  )
}


