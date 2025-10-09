// Cloudflare Turnstile verification endpoint (Node runtime)
// Env: TURNSTILE_SECRET
const fetch = global.fetch || require('node-fetch')

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  try {
    let body = req.body
    if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = {} } }
    const token = body?.token || req.query?.token
    const secret = process.env.TURNSTILE_SECRET
    const sitekey = process.env.VITE_TURNSTILE_SITE_KEY || process.env.TURNSTILE_SITE_KEY
    if (!secret) return res.status(500).json({ error: 'Missing TURNSTILE_SECRET' })
    if (!token) return res.status(400).json({ error: 'Missing token' })

    const form = new URLSearchParams()
    form.append('secret', secret)
    form.append('response', token)
    if (sitekey) form.append('sitekey', sitekey)
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    if (ip) form.append('remoteip', ip)

    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    })
    let data
    try { data = await r.json() } catch (e) {
      const text = await r.text()
      return res.status(502).json({ error: 'invalid_turnstile_response', detail: text?.slice(0,200) })
    }
    if (!data.success) return res.status(400).json({ success: false, ...data, errorCodes: data['error-codes'] || [], debug: { ip, host: req.headers.host, sitekeyPresent: Boolean(sitekey) } })
    return res.status(200).json({ success: true, ...data, debug: { ip, host: req.headers.host } })
  } catch (e) {
    return res.status(500).json({ error: 'verify_failed', detail: String(e.message || e) })
  }
}

module.exports.config = { runtime: 'nodejs18.x' }


