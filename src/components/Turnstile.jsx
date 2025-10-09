import { useEffect, useRef } from 'react'

// Cloudflare Turnstile widget loader
export default function Turnstile({ onChange, className }) {
  const ref = useRef(null)
  const siteKey = import.meta?.env?.VITE_TURNSTILE_SITE_KEY || ''

  useEffect(() => {
    if (!siteKey) return
    let disposed = false

    const render = () => {
      if (disposed || !ref.current || !window.turnstile) return
      try {
        window.turnstile.render(ref.current, {
          sitekey: siteKey,
          callback: (token) => onChange && onChange(token),
          'error-callback': () => onChange && onChange(''),
          'expired-callback': () => onChange && onChange(''),
          theme: 'auto',
        })
      } catch (_) {}
    }

    const ensure = () => new Promise((resolve) => {
      if (window.turnstile?.render) return resolve()
      const existing = document.querySelector('script[src^="https://challenges.cloudflare.com/turnstile/v0/api.js"]')
      if (existing) { existing.addEventListener('load', () => resolve()); return }
      const s = document.createElement('script')
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
      s.async = true
      s.defer = true
      s.onload = () => resolve()
      document.head.appendChild(s)
    })

    ensure().then(() => { if (!disposed) render() })
    return () => { disposed = true }
  }, [siteKey])

  if (!siteKey) return <div className={className}><div className="text-xs text-red-600">Missing VITE_TURNSTILE_SITE_KEY</div></div>
  return <div className={className}><div ref={ref} /></div>
}


