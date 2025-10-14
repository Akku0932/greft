import { Link } from 'react-router-dom'

export default function HeroWelcome() {
  return (
    <section className="relative overflow-hidden min-h-screen">
      {/* Background layers with refined visual depth */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-stone-50 via-white to-stone-100 dark:from-black dark:via-[#0a0a0a] dark:to-black" />
        <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_10%_10%,rgba(59,130,246,0.12)_0%,rgba(0,0,0,0)_70%),radial-gradient(45%_45%_at_90%_20%,rgba(147,51,234,0.12)_0%,rgba(0,0,0,0)_70%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0)_55%,rgba(0,0,0,0.35)_100%)]" />
        {/* Full-bleed pink/purple glow covering the whole screen */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -bottom-1/4 -right-1/4 h-[120vh] w-[120vw] rounded-full blur-[120px] opacity-60" style={{ background: 'radial-gradient(closest-side, rgba(236,72,153,0.35), rgba(236,72,153,0.15), transparent 70%)' }} />
          <div className="absolute -top-1/3 -left-1/4 h-[90vh] w-[90vw] rounded-full blur-[120px] opacity-40" style={{ background: 'radial-gradient(closest-side, rgba(99,102,241,0.25), transparent 70%)' }} />
        </div>
      </div>

      <div className="relative max-w-[95vw] mx-auto px-4 sm:px-6 py-16 lg:py-24 grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-12 items-center">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-stone-300/70 dark:border-gray-700/70 bg-white/70 dark:bg-gray-900/60 backdrop-blur text-xs text-stone-700 dark:text-gray-300">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-gradient-to-r from-blue-500 to-purple-600" />
            New: Lightning‑fast reader with chapter resume
          </div>
          <h1 className="mt-5 text-5xl sm:text-6xl font-extrabold tracking-tight leading-[1.05] text-stone-900 dark:text-white">
            Read smarter with
            <span className="ml-3 bg-clip-text text-transparent bg-gradient-to-r from-blue-500 via-fuchsia-500 to-purple-600">GREFT</span>
          </h1>
          <p className="mt-6 text-lg text-stone-700 dark:text-gray-300 max-w-2xl">
            A refined, high‑contrast experience for manga & manhwa. Snappy navigation, elegant UI, and thoughtful details everywhere.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link to="/home" className="px-6 py-3 rounded-xl bg-stone-900 text-white dark:bg-gray-800 hover:bg-stone-800 dark:hover:bg-gray-700 transition-colors shadow-soft">
              Start reading
            </Link>
            <a href="#popular" className="px-6 py-3 rounded-xl border border-stone-300 dark:border-gray-700 bg-white/80 dark:bg-gray-900/60 text-stone-800 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-800 transition-colors">
              Explore popular
            </a>
            <span className="text-sm text-stone-500 dark:text-gray-400">No signup required</span>
          </div>

          {/* Stats row like screenshot */}
          <div className="mt-12">
            <h2 className="text-center sm:text-left text-2xl font-semibold text-stone-900 dark:text-white">This Week, We Have</h2>
            <div className="mt-6 grid grid-cols-3 gap-4 rounded-2xl border border-stone-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/60 backdrop-blur p-4">
              <div className="text-center">
                <div className="text-4xl font-bold text-stone-900 dark:text-white">908</div>
                <div className="text-sm text-stone-600 dark:text-gray-400 mt-1">New comics</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-stone-900 dark:text-white">13,175</div>
                <div className="text-sm text-stone-600 dark:text-gray-400 mt-1">New chapters</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-stone-900 dark:text-white">39,342</div>
                <div className="text-sm text-stone-600 dark:text-gray-400 mt-1">New users</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: app logo instead of grid mock */}
        <div className="relative flex items-center justify-center">
          <div className="relative h-[360px] sm:h-[420px] w-full max-w-md">
            <div className="absolute inset-0 rounded-3xl overflow-hidden ring-1 ring-white/15 dark:ring-gray-700/40 bg-white/70 dark:bg-gray-900/70 backdrop-blur">
              <img src="/logo.png" alt="Greft logo" className="absolute inset-0 m-auto w-56 h-56 sm:w-72 sm:h-72 object-contain drop-shadow-2xl animate-[float_6s_ease-in-out_infinite]" />
            </div>
            <div className="absolute -inset-x-10 -bottom-10 h-24 bg-gradient-to-r from-blue-500/20 via-fuchsia-500/20 to-purple-500/20 blur-3xl" />
          </div>
        </div>
      </div>

      {/* Info sections like screenshot */}
      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-16">
        <h2 className="text-3xl sm:text-4xl font-bold text-center text-stone-900 dark:text-white">What is Greft?</h2>
        <p className="mt-6 text-center text-stone-700 dark:text-gray-300 leading-relaxed">
          Greft is a modern online manga & manhwa reading experience designed to bring fans closer to their favorite stories in a
          smarter and more personal way. Enjoy a clean, fast interface with progress tracking, powerful discovery, and distraction‑free reading.
        </p>

        <h2 className="mt-20 text-3xl sm:text-4xl font-bold text-center text-stone-900 dark:text-white">Why Choose Greft?</h2>
        <p className="mt-6 text-center text-stone-700 dark:text-gray-300 leading-relaxed">
          Take full control of your reading with advanced filters, personalized shelves, and smooth performance. Save what you love,
          explore hidden gems, and stay updated with the latest chapters — all with an elegant UI that gets out of your way.
        </p>
      </div>

      {/* Dark feature section */}
      <div className="relative bg-[#111827] dark:bg-[#0b0b0b] text-white">
        <div className="max-w-[95vw] mx-auto px-4 sm:px-6 py-16">
          <h2 className="text-4xl sm:text-5xl font-extrabold text-center">The Smarter Way to Read Manga Online</h2>
          <p className="mt-4 text-center text-gray-300 max-w-3xl mx-auto">
            Fast, clean, and complete reading — no clutter, just your favorite manga, your way.
          </p>

          <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left: feature bullets */}
            <div className="space-y-6">
              <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-6">
                <div className="text-lg font-semibold">Save the Stories You Love</div>
                <div className="mt-2 text-sm text-gray-300">
                  Bookmark your favorite series and pick up exactly where you left off — anywhere.
                </div>
              </div>
              <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-6">
                <div className="text-lg font-semibold">Discover More with Smart Filters</div>
                <div className="mt-2 text-sm text-gray-300">
                  Find exactly what you’re in the mood for using intuitive tags, genres, and search.
                </div>
              </div>
              <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-6">
                <div className="text-lg font-semibold">Pinpoint Exactly What You Want</div>
                <div className="mt-2 text-sm text-gray-300">
                  Jump straight into what you’re looking for — zero friction, zero confusion.
                </div>
              </div>
              <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-6">
                <div className="text-lg font-semibold">And That’s Just the Beginning…</div>
                <div className="mt-2 text-sm text-gray-300">
                  Browse trending picks, resume from history, or read like a pro with the Advanced Reader view.
                </div>
              </div>
            </div>

            {/* Right: mock filter panel */}
            <div className="rounded-3xl bg-white/5 ring-1 ring-white/10 p-6">
              <div className="text-xl font-semibold mb-4">Filter or mark genres</div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="col-span-1 space-y-3">
                  {['Romance','Comedy','Drama','Slice of Life','Oneshot','Fantasy','School Life','Action'].map((g)=> (
                    <div key={g} className="flex items-center gap-3">
                      <span className="inline-block h-3 w-3 rounded border border-white/30" />
                      <span className="text-gray-200">{g}</span>
                    </div>
                  ))}
                </div>
                <div className="col-span-1 space-y-3">
                  {Array.from({length:8}).map((_,i)=> (
                    <div key={i} className="h-2 rounded bg-white/10">
                      <div className="h-2 rounded bg-gradient-to-r from-blue-500 to-purple-600" style={{ width: `${30 + i*7}%` }} />
                    </div>
                  ))}
                </div>
                <div className="col-span-1 space-y-3">
                  {Array.from({length:8}).map((_,i)=> (
                    <div key={i} className="h-8 rounded-lg bg-white/10 flex items-center justify-between px-2">
                      <span className="text-gray-300 text-xs">Highlight</span>
                      <span className="h-3 w-3 rounded-full" style={{ background: ['#ef4444','#22c55e','#3b82f6','#f59e0b','#a855f7','#06b6d4','#eab308','#10b981'][i%8] }} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}


