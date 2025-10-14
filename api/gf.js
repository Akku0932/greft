export const config = { runtime: 'edge' }

export default async function handler(req) {
  const url = new URL(req.url)
  const p = url.searchParams.get('p') || ''
  const upstreamPath = String(p).replace(/^\/+/, '')
  if (!upstreamPath) {
    return new Response(JSON.stringify({ error: 'Missing required query param p' }), { status: 400, headers: { 'content-type': 'application/json' } })
  }
  const ORIGINS = [
    'http://ger.visionhost.cloud:2056',
    'https://ger.visionhost.cloud:2056',
  ]

  try {
    let lastError = null
    for (const base of ORIGINS) {
      const originBase = base
      const targetUrl = `${originBase}/${upstreamPath}`
      try {
        const controller = new AbortController()
        const t = setTimeout(() => controller.abort(), 3000)
        const upstream = await fetch(targetUrl, {
          headers: {
            accept: 'application/json, text/plain, */*',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
            referer: originBase + '/',
            origin: originBase,
            'accept-language': 'en-US,en;q=0.9',
            pragma: 'no-cache',
            'cache-control': 'no-cache',
            'x-requested-with': 'XMLHttpRequest',
            'connection': 'keep-alive',
            'keep-alive': 'timeout=5, max=1000',
          },
          signal: controller.signal,
        })
        clearTimeout(t)
        if (!upstream.ok) {
          lastError = `Upstream ${upstream.status}`
          continue
        }
        const body = await upstream.arrayBuffer()
        const headers = new Headers(upstream.headers)
        headers.set('Access-Control-Allow-Origin', '*')
        headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS')
        if (!headers.has('content-type')) headers.set('content-type', 'application/json')
        return new Response(body, { status: upstream.status, headers })
      } catch (err) {
        lastError = String(err)
        continue
      }
    }
    throw new Error(lastError || 'GF upstream failed')
  } catch (e) {
    return new Response(JSON.stringify({ error: 'GF edge proxy failed', detail: String(e), path: upstreamPath }), { status: 502, headers: { 'content-type': 'application/json' } })
  }
}


