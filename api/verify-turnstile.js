// Cloudflare Turnstile verification - Edge runtime
// Env: TURNSTILE_SECRET, VITE_TURNSTILE_SITE_KEY (optional)
export const config = { runtime: 'edge' }

export default async function handler(req) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders })
    }
    if (req.method === 'GET') {
      return new Response(JSON.stringify({ ok: true, info: 'POST a JSON body { token } to verify.' }), { status: 200, headers: { 'content-type': 'application/json', ...corsHeaders } })
    }
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'content-type': 'application/json', ...corsHeaders } })
    }
    let body = {}
    try { body = await req.json() } catch { body = {} }
    const token = body?.token || new URL(req.url).searchParams.get('token')
    const secret = process.env.TURNSTILE_SECRET
    const sitekey = process.env.VITE_TURNSTILE_SITE_KEY || process.env.TURNSTILE_SITE_KEY
    if (!secret) return new Response(JSON.stringify({ error: 'Missing TURNSTILE_SECRET' }), { status: 500, headers: { 'content-type': 'application/json', ...corsHeaders } })
    if (!token) return new Response(JSON.stringify({ error: 'Missing token' }), { status: 400, headers: { 'content-type': 'application/json', ...corsHeaders } })

    const form = new URLSearchParams()
    form.append('secret', secret)
    form.append('response', token)
    if (sitekey) form.append('sitekey', sitekey)
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim()
    if (ip) form.append('remoteip', ip)

    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    })
    let data
    try { data = await r.json() } catch (e) {
      const text = await r.text()
      return new Response(JSON.stringify({ error: 'invalid_turnstile_response', detail: text?.slice(0,200) }), { status: 502, headers: { 'content-type': 'application/json', ...corsHeaders } })
    }
    if (!data.success) {
      return new Response(JSON.stringify({ success: false, ...data, errorCodes: data['error-codes'] || [], debug: { ip, host: req.headers.get('host'), sitekeyPresent: Boolean(sitekey) } }), { status: 400, headers: { 'content-type': 'application/json', ...corsHeaders } })
    }
    return new Response(JSON.stringify({ success: true, ...data, debug: { ip, host: req.headers.get('host') } }), { status: 200, headers: { 'content-type': 'application/json', ...corsHeaders } })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'verify_failed', detail: String(e && e.stack || e && e.message || e) }), { status: 500, headers: { 'content-type': 'application/json', ...corsHeaders } })
  }
}


