import { useEffect, useState } from 'react'

export default function Settings() {
  const [adultAllowed, setAdultAllowed] = useState(false)

  useEffect(() => {
    try {
      const obj = JSON.parse(localStorage.getItem('site:settings') || '{}')
      setAdultAllowed(!!obj.adultAllowed)
    } catch { setAdultAllowed(false) }
  }, [])

  function save(next) {
    setAdultAllowed(next)
    try {
      const obj = JSON.parse(localStorage.getItem('site:settings') || '{}')
      obj.adultAllowed = !!next
      localStorage.setItem('site:settings', JSON.stringify(obj))
    } catch {}
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-stone-900 dark:text-white mb-6">Settings</h1>
      <div className="rounded-xl border border-stone-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-base font-semibold text-stone-900 dark:text-white">Show 18+ content</div>
            <div className="text-sm text-stone-600 dark:text-gray-400">Allows adult/mature/ecchi covers and pages without blur</div>
          </div>
          <button
            onClick={() => save(!adultAllowed)}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${adultAllowed ? 'bg-green-500' : 'bg-stone-300 dark:bg-gray-700'}`}
            aria-pressed={adultAllowed}
            aria-label="Toggle 18+"
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${adultAllowed ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
      </div>
    </div>
  )
}


