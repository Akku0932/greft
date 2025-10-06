export default async function handler(req, res) {
  const ORIGIN = 'http://ger.visionhost.cloud:2056'
  const { path = [] } = req.query
  const search = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''
  const targetUrl = ORIGIN + '/' + ([]).concat(path).join('/') + search
  try {
    const upstream = await fetch(targetUrl, { method: req.method, headers: { 'accept': 'application/json,image/*,*/*' } })
    const buf = Buffer.from(await upstream.arrayBuffer())
    // copy status and headers
    res.status(upstream.status)
    upstream.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'transfer-encoding') return
      res.setHeader(key, value)
    })
    // ensure CORS for safety
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Cache-Control', 'public, max-age=300')
    res.send(buf)
  } catch (e) {
    res.status(502).json({ error: 'Proxy fetch failed', detail: String(e) })
  }
}


