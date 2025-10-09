import { useEffect, useRef } from 'react'

// Lightweight Google reCAPTCHA v2 checkbox integration without extra deps
// Expects VITE_RECAPTCHA_SITE_KEY to be set
export default function Recaptcha({ onChange, onExpired, className }) {
  const containerRef = useRef(null)
  const widgetIdRef = useRef(null)
  const siteKey = import.meta?.env?.VITE_RECAPTCHA_SITE_KEY || ''

  useEffect(() => {
    if (!siteKey) return

    let disposed = false
    const renderWidget = () => {
      if (disposed) return
      if (!containerRef.current) return
      if (!window.grecaptcha || !window.grecaptcha.render) return
      try {
        if (widgetIdRef.current == null) {
          widgetIdRef.current = window.grecaptcha.render(containerRef.current, {
            sitekey: siteKey,
            callback: (token) => { if (onChange) onChange(token) },
            'expired-callback': () => { if (onExpired) onExpired() },
          })
        }
      } catch (_) {}
    }

    const ensureScript = () => new Promise((resolve) => {
      if (window.grecaptcha && window.grecaptcha.render) return resolve()
      const existing = document.querySelector('script[src^="https://www.google.com/recaptcha/api.js"]')
      const onloadName = '__recaptchaOnLoad'
      window[onloadName] = () => resolve()
      if (existing) {
        existing.addEventListener('load', () => resolve())
      } else {
        const s = document.createElement('script')
        s.src = `https://www.google.com/recaptcha/api.js?onload=${onloadName}&render=explicit`
        s.async = true
        s.defer = true
        s.onload = () => resolve()
        document.head.appendChild(s)
      }
    })

    const start = async () => {
      await ensureScript()
      if (disposed) return
      if (window.grecaptcha?.ready) {
        window.grecaptcha.ready(() => renderWidget())
      } else {
        renderWidget()
      }
      // Small retry loop in case render is called too early by some extensions
      let attempts = 0
      const id = setInterval(() => {
        if (widgetIdRef.current != null || disposed) { clearInterval(id); return }
        attempts += 1
        renderWidget()
        if (attempts > 10) clearInterval(id)
      }, 300)
    }

    start()

    return () => {
      disposed = true
      try {
        if (widgetIdRef.current != null && window.grecaptcha?.reset) {
          window.grecaptcha.reset(widgetIdRef.current)
        }
      } catch (_) {}
    }
  }, [siteKey])

  if (!siteKey) {
    return (
      <div className={className}>
        <div className="text-xs text-red-600">Missing VITE_RECAPTCHA_SITE_KEY</div>
      </div>
    )
  }

  return (
    <div className={className}>
      <div ref={containerRef} />
    </div>
  )
}


