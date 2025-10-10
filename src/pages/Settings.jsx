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
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-stone-900 dark:text-white mb-6">Settings</h1>
      <div className="rounded-2xl border border-stone-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="font-semibold text-stone-900 dark:text-white">Show 18+ content</div>
            <div className="text-sm text-stone-600 dark:text-gray-400">When off, covers are blurred and adult/ecchi content is gated</div>
          </div>
          <label className="inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" checked={adultAllowed} onChange={(e)=>save(e.target.checked)} />
            <div className="w-12 h-7 bg-stone-300 dark:bg-gray-700 rounded-full peer peer-checked:bg-green-500 relative transition-colors">
              <div className={`absolute top-0.5 left-0.5 h-6 w-6 bg-white dark:bg-gray-900 rounded-full transition-transform ${adultAllowed ? 'translate-x-5' : ''}`} />
            </div>
          </label>
        </div>
      </div>
    </div>
  )
}


