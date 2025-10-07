async function handler(req, res) {
  const url = new URL(req.url || '/', 'http://local');
  const targetPath = url.pathname.replace(/^\/api\/proxy-edge\/?/, '');
  const imageUrl = url.searchParams.get('url');
  const src = url.searchParams.get('src');
  const p = url.searchParams.get('p');

  if (req.method === 'OPTIONS') {
    res.status(204)
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    return res.end()
  }

  if (imageUrl) {
    try {
      const response = await fetch(imageUrl)
      const buf = Buffer.from(await response.arrayBuffer())
      res.status(response.status)
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
      res.setHeader('Content-Type', response.headers.get('content-type') || 'application/octet-stream')
      return res.send(buf)
    } catch (error) {
      res.status(500)
      return res.send(`Image proxy error: ${error.message}`)
    }
  }

  const ORIGINS = {
    default: 'http://ger.visionhost.cloud:2056',
    mf: 'https://mangafire-xi.vercel.app',
  };

  let originBase = ORIGINS.default;
  let upstreamPath = targetPath;
  if (p && src) {
    originBase = ORIGINS[src] || ORIGINS.default;
    upstreamPath = String(p).replace(/^\//, '');
  } else if (upstreamPath.startsWith('mf/')) {
    originBase = ORIGINS.mf;
    upstreamPath = upstreamPath.replace(/^mf\//, '');
  }

  const passthrough = new URLSearchParams(url.searchParams)
  passthrough.delete('src')
  passthrough.delete('p')
  passthrough.delete('url')
  const qs = passthrough.toString()

  const targetUrl = upstreamPath
    ? `${originBase}/${upstreamPath}${qs ? `?${qs}` : ''}`
    : originBase + (qs ? `?${qs}` : '')

  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        accept: 'application/json, text/plain, */*',
        'user-agent': 'greft-proxy/1.0',
      },
    })
    const textBody = await response.text()
    res.status(response.status)
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json')
    return res.send(textBody)
  } catch (error) {
    res.status(500)
    return res.send(`Proxy error: ${error.message}`)
  }
}

module.exports = handler
module.exports.config = { runtime: 'nodejs' }

