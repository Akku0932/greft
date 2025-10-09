export const config = { runtime: 'edge' }

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, *',
  }
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() })
  }

  try {
    const url = new URL(req.url)
    const p = url.searchParams.get('p') || ''
    if (!p) {
      return new Response(JSON.stringify({ error: 'Missing required query param p' }), {
        status: 400,
        headers: { 'content-type': 'application/json', ...corsHeaders() },
      })
    }

    // Normalize upstream target
    let upstreamPath = String(p).trim()
    // Allow absolute mp asset URLs too
    if (/^https?:\/\//i.test(upstreamPath)) {
      // Convert absolute to path for consistency with edge fetch
      const parsed = new URL(upstreamPath)
      upstreamPath = parsed.pathname.replace(/^\/+/, '') + (parsed.search || '')
    } else {
      upstreamPath = upstreamPath.replace(/^\/+/, '')
    }
    // Choose origin based on whether this is an image asset or API path
    const isAsset = /^(thumb|media|mpim|amim|ampi|mpav)\//i.test(upstreamPath)
    const originBase = isAsset ? 'https://mangapark.com' : 'https://mangapark-sigma.vercel.app'
    const targetUrl = `${originBase}/${upstreamPath}`

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 1000)
    const upstream = await fetch(targetUrl, {
      headers: {
        accept: '*/*',
        'accept-language': 'en-US,en;q=0.9',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        referer: originBase + '/',
        origin: originBase,
        pragma: 'no-cache',
        'cache-control': 'no-cache',
        'connection': 'keep-alive',
        'keep-alive': 'timeout=5, max=1000',
      },
      signal: controller.signal,
    })
    clearTimeout(timeout)

    const body = await upstream.arrayBuffer()
    const headers = new Headers(upstream.headers)
    // Default content type if missing
    if (!headers.get('content-type')) headers.set('content-type', 'application/json')
    // CORS
    const ch = corsHeaders()
    for (const k of Object.keys(ch)) headers.set(k, ch[k])

    return new Response(body, { status: upstream.status, headers })
  } catch (e) {
    const msg = typeof e?.message === 'string' ? e.message : String(e)
    return new Response(JSON.stringify({ error: 'MP edge proxy failed', detail: msg }), {
      status: 502,
      headers: { 'content-type': 'application/json', ...corsHeaders() },
    })
  }
}

