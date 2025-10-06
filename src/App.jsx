import { Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './contexts/ThemeContext.jsx'
import Navbar from './components/Navbar.jsx'
import Footer from './components/Footer.jsx'
import Welcome from './pages/Welcome.jsx'
import Home from './pages/Home.jsx'
import Info from './pages/Info.jsx'
import Chapters from './pages/Chapters.jsx'
import Read from './pages/Read.jsx'
import SearchResults from './pages/SearchResults.jsx'

export default function App() {
  return (
    <ThemeProvider>
      <div className="min-h-screen flex flex-col bg-white dark:bg-[#000000] transition-colors duration-300">
        <Navbar />
        <main className="flex-1">
          <div className="max-w-[95vw] mx-auto">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/home" element={<Home />} />
              <Route path="/info/:id/:titleId" element={<Info />} />
              <Route path="/chapters/:id" element={<Chapters />} />
              <Route path="/read/:id" element={<Read />} />
              <Route path="/search" element={<SearchResults />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>
        <Footer />
      </div>
    </ThemeProvider>
  )
}


