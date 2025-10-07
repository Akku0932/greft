async function handler(req, res) {
  const url = new URL(req.url || '/', 'http://local')
  const p = url.searchParams.get('p') || ''
  const upstreamPath = String(p).replace(/^\/+/, '')
  const originBase = 'http://ger.visionhost.cloud:2056'
  const targetUrl = `${originBase}/${upstreamPath}`

  if (req.method === 'OPTIONS') {
    res.status(204)
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    return res.end()
  }

  try {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 15000)
    const upstream = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        accept: 'application/json, text/plain, */*',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        referer: originBase + '/',
        origin: originBase,
        'accept-language': 'en-US,en;q=0.9',
        pragma: 'no-cache',
        'cache-control': 'no-cache',
        'x-requested-with': 'XMLHttpRequest',
      },
      signal: controller.signal,
    })
    clearTimeout(t)
    const text = await upstream.text()
    res.status(upstream.status)
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json')
    return res.send(text)
  } catch (e) {
    res.status(502)
    res.setHeader('content-type', 'application/json')
    return res.send(JSON.stringify({ error: 'GF proxy failed', detail: String(e), targetUrl }))
  }
}

module.exports = handler
module.exports.config = { runtime: 'nodejs' }


