import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'

const ThemeContext = createContext()

export function ThemeProvider({ children }) {
  const mediaRef = useRef(null)

  function applyTheme(next) {
    const isDark = next === 'dark'
    const root = document.documentElement
    if (isDark) root.classList.add('dark')
    else root.classList.remove('dark')
    try { localStorage.setItem('greft-theme', next) } catch {}
  }

  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('greft-theme')
      if (saved === 'dark' || saved === 'light') return saved
    } catch {}
    const prefersDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    return prefersDark ? 'dark' : 'light'
  })

  useEffect(() => { applyTheme(theme) }, [])
  useEffect(() => { applyTheme(theme) }, [theme])

  useEffect(() => {
    if (!window.matchMedia) return
    mediaRef.current = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e) => {
      try {
        const saved = localStorage.getItem('greft-theme')
        if (saved === 'dark' || saved === 'light') return
      } catch {}
      setTheme(e.matches ? 'dark' : 'light')
    }
    try { mediaRef.current.addEventListener('change', onChange) } catch { mediaRef.current.addListener(onChange) }
    return () => {
      try { mediaRef.current.removeEventListener('change', onChange) } catch { mediaRef.current.removeListener(onChange) }
    }
  }, [])

  const toggleTheme = () => { setTheme(prev => prev === 'light' ? 'dark' : 'light') }
  const value = useMemo(() => ({ theme, toggleTheme }), [theme])

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
