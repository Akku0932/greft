// Vercel serverless function (Node runtime) to verify reCAPTCHA v2 tokens
// Expects env: RECAPTCHA_SECRET
const fetch = global.fetch || require('node-fetch')

module.exports = async (req, res) => {
  // Basic CORS for all responses
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  try {
    let body = req.body
    if (typeof body === 'string') {
      try { body = JSON.parse(body) } catch (_) { body = {} }
    }
    // Also allow token via query as a fallback/debug path
    const { token: tokenBody } = body || {}
    const token = tokenBody || req.query?.token
    const secret = process.env.RECAPTCHA_SECRET
    if (!secret) return res.status(500).json({ error: 'Missing server secret' })
    if (!token) return res.status(400).json({ error: 'Missing token' })

    const params = new URLSearchParams()
    params.append('secret', secret)
    params.append('response', token)

    const r = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })
    let data
    try { data = await r.json() } catch (e) {
      const text = await r.text()
      return res.status(502).json({ error: 'invalid_google_response', detail: text?.slice(0,200) })
    }
    if (!data.success) {
      return res.status(400).json({ success: false, errorCodes: data['error-codes'] || [] })
    }
    return res.status(200).json({ success: true, score: data.score, action: data.action })
  } catch (e) {
    return res.status(500).json({ error: 'verify_failed', detail: String(e.message || e) })
  }
}

module.exports.config = { runtime: 'nodejs18.x' }


