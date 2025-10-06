export default function Footer() {
  return (
    <footer className="border-t border-stone-200 dark:border-gray-800 bg-white/60 dark:bg-gray-900/60">
      <div className="max-w-[95vw] mx-auto px-4 sm:px-6 py-10">
        <div className="flex flex-col items-center gap-6">
          <nav className="flex flex-wrap items-center justify-center gap-6 text-sm text-blue-600">
            <a href="#" className="hover:underline">FAQ</a>
            <a href="#" className="hover:underline">Status Page</a>
            <a href="#" className="hover:underline">Roadmap</a>
            <a href="#" className="hover:underline">Credits</a>
            <a href="#" className="hover:underline">About</a>
          </nav>
          <div className="flex items-center gap-6 text-stone-500 dark:text-gray-400">
            <a href="#" aria-label="Discord" className="hover:text-stone-700 dark:hover:text-gray-200">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.369A19.791 19.791 0 0016.558 3c-.2.356-.43.83-.589 1.2a18.27 18.27 0 00-7.938 0A9.027 9.027 0 007.442 3c-1.35.247-2.68.668-3.96 1.242C.833 7.068-.322 9.64.099 12.146c1.642 1.215 3.23 1.96 4.784 2.447.386-.53.73-1.095 1.028-1.69-.566-.214-1.108-.474-1.624-.776.136-.1.27-.203.4-.309 3.183 1.488 6.62 1.488 9.789 0 .132.106.267.21.404.31-.516.302-1.058.562-1.626.776.298.595.642 1.159 1.028 1.69 1.554-.487 3.142-1.232 4.784-2.447.6-3.576-.994-6.114-2.747-7.777zM9.35 12.348c-.823 0-1.49-.73-1.49-1.63 0-.9.667-1.631 1.49-1.631.83 0 1.5.736 1.49 1.631 0 .9-.66 1.63-1.49 1.63zm5.3 0c-.823 0-1.49-.73-1.49-1.63 0-.9.667-1.631 1.49-1.631.83 0 1.5.736 1.49 1.631 0 .9-.66 1.63-1.49 1.63z"/></svg>
            </a>
            <a href="#" aria-label="Reddit" className="hover:text-stone-700 dark:hover:text-gray-200">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12c0 5.523-4.925 10-11 10S0 17.523 0 12 4.925 2 11 2s11 4.477 11 10zM7.5 13.5a1.5 1.5 0 102.999.001A1.5 1.5 0 007.5 13.5zm6.5 1.5c-1.098 0-2.095.273-2.854.72.327.465 1.438 1.28 2.854 1.28 1.415 0 2.527-.815 2.854-1.28-.759-.447-1.756-.72-2.854-.72zM14 13.5a1.5 1.5 0 103 0 1.5 1.5 0 00-3 0z"/></svg>
            </a>
            <a href="#" aria-label="Facebook" className="hover:text-stone-700 dark:hover:text-gray-200">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12a10 10 0 10-11.5 9.95v-7.03H7.9V12h2.6V9.8c0-2.57 1.53-3.99 3.87-3.99 1.12 0 2.29.2 2.29.2v2.52h-1.29c-1.27 0-1.66.79-1.66 1.6V12h2.83l-.45 2.92h-2.38v7.03A10 10 0 0022 12z"/></svg>
            </a>
          </div>
          <div className="mt-2 text-xs text-stone-500 dark:text-gray-400">© {new Date().getFullYear()} Greft • Fan-made community site • Data via public API</div>
        </div>
      </div>
    </footer>
  )
}


