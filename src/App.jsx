import { Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './contexts/ThemeContext.jsx'
import Navbar from './components/Navbar.jsx'
import BottomNav from './components/BottomNav.jsx'
import Footer from './components/Footer.jsx'
import Welcome from './pages/Welcome.jsx'
import Home from './pages/Home.jsx'
import Info from './pages/Info.jsx'
import Chapters from './pages/Chapters.jsx'
import Read from './pages/Read.jsx'
import SearchResults from './pages/SearchResults.jsx'
import Saved from './pages/Saved.jsx'
import Login from './pages/Login.jsx'
import Account from './pages/Account.jsx'
import History from './pages/History.jsx'

export default function App() {
  return (
    <ThemeProvider>
      <div className="min-h-screen flex flex-col bg-white dark:bg-[#000000] transition-colors duration-300">
        <Navbar />
        <main className="flex-1 pb-16 md:pb-0">
          <div className="max-w-[95vw] mx-auto">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/home" element={<Home />} />
              <Route path="/info/:id/:titleId" element={<Info />} />
              <Route path="/info/:id" element={<Info />} />
              <Route path="/chapters/:id" element={<Chapters />} />
              <Route path="/read/:id" element={<Read />} />
              <Route path="/read/chapter/:id" element={<Read />} />
              <Route path="/search" element={<SearchResults />} />
              <Route path="/saved" element={<Saved />} />
              <Route path="/history" element={<History />} />
              <Route path="/login" element={<Login />} />
              <Route path="/account" element={<Account />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>
        <BottomNav />
        <Footer />
        {/* Scroll to top button */}
        <ScrollToTopButton />
      </div>
    </ThemeProvider>
  )
}

import { useEffect, useState } from 'react'
function ScrollToTopButton() {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    function onScroll() {
      setVisible((window.scrollY || 0) > 300)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  if (!visible) return null
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="fixed right-4 bottom-4 z-50 h-12 w-12 rounded-full bg-stone-900 text-white dark:bg-gray-700 shadow-lg hover:opacity-90 flex items-center justify-center"
      aria-label="Scroll to top"
      title="Back to top"
    >
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>
    </button>
  )
}

