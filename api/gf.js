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
    const upstream = await fetch(targetUrl, {
      headers: {
        accept: 'application/json, text/plain, */*',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        referer: originBase + '/',
        origin: originBase,
        'accept-language': 'en-US,en;q=0.9',
        pragma: 'no-cache',
        'cache-control': 'no-cache',
      },
    })
    const body = await upstream.text()
    res.status(upstream.status)
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json')
    return res.send(body)
  } catch (e) {
    res.status(502)
    res.setHeader('content-type', 'application/json')
    return res.send(JSON.stringify({ error: 'GF proxy failed', detail: String(e) }))
  }
}

module.exports = handler
module.exports.config = { runtime: 'nodejs' }


