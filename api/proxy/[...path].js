module.exports = async (req, res) => {
  const ORIGIN = 'http://ger.visionhost.cloud:2056'
  const segments = Array.isArray(req.query.path) ? req.query.path : []
  const search = req.url && req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''
  const targetUrl = ORIGIN + '/' + segments.join('/') + search
  try {
    const upstream = await fetch(targetUrl, { method: req.method, headers: { 'accept': 'application/json,image/*,*/*' } })
    const arrayBuf = await upstream.arrayBuffer()
    const buf = Buffer.from(arrayBuf)
    res.status(upstream.status)
    upstream.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'transfer-encoding') return
      res.setHeader(key, value)
    })
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Cache-Control', 'public, max-age=300')
    res.send(buf)
  } catch (e) {
    res.status(502).json({ error: 'Proxy fetch failed', detail: String(e) })
  }
}


