import { Link, useLocation } from 'react-router-dom'

export default function BottomNav() {
  const { pathname } = useLocation()
  const isActive = (p) => pathname === p
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-gray-900/95 border-t border-stone-200 dark:border-gray-800 shadow-sm md:hidden">
      <div className="max-w-[95vw] mx-auto px-4">
        <div className="grid grid-cols-5 py-2">
          <NavItem to="/home" label="Home" active={isActive('/home') || isActive('/')} icon={(cls)=> (
            <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10.5l9-7 9 7"/><path d="M5 10v10a1 1 0 001 1h12a1 1 0 001-1V10"/></svg>
          )} />
          <NavItem to="/search" label="Search" active={isActive('/search')} icon={(cls)=> (
            <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg>
          )} />
          <NavItem to="/saved" label="My List" active={isActive('/saved')} icon={(cls)=> (
            <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>
          )} />
          <NavItem to="/history" label="History" active={isActive('/history')} icon={(cls)=> (
            <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v5h5"/><path d="M3.05 13a9 9 0 108.95-8"/><path d="M12 7v5l3 3"/></svg>
          )} />
          <NavItem to="/account" label="Account" active={isActive('/account')} icon={(cls)=> (
            <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          )} />
        </div>
      </div>
    </nav>
  )
}

function NavItem({ to, label, icon, active }) {
  const cls = `h-6 w-6 ${active ? 'text-blue-600 dark:text-blue-400' : 'text-stone-600 dark:text-gray-300'}`
  const txt = `mt-0.5 text-[10px] ${active ? 'text-blue-600 dark:text-blue-400' : 'text-stone-600 dark:text-gray-300'}`
  return (
    <Link to={to} className="flex flex-col items-center justify-center">
      {icon(cls)}
      <span className={txt}>{label}</span>
    </Link>
  )
}


