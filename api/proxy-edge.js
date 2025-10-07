export const config = {
  runtime: 'nodejs',
};

export default async function handler(req, res) {
  const url = new URL(req.url || '/', 'http://local');
  const targetPath = url.pathname.replace(/^\/api\/proxy-edge\/?/, '');
  const imageUrl = url.searchParams.get('url');
  const src = url.searchParams.get('src'); // e.g., 'mf'
  const p = url.searchParams.get('p');     // e.g., '/most-viewed'

  // CORS preflight support
  if (req.method === 'OPTIONS') {
    res.status(204)
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    return res.end()
  }

  // Image proxy: /api/proxy-edge?url=http://...
  if (imageUrl) {
    try {
      const response = await fetch(imageUrl)
      const arrayBuffer = await response.arrayBuffer()
      res.status(response.status)
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
      const ct = response.headers.get('content-type') || 'application/octet-stream'
      res.setHeader('Content-Type', ct)
      return res.send(Buffer.from(arrayBuffer))
    } catch (error) {
      res.status(500)
      return res.send(`Image proxy error: ${error.message}`)
    }
  }

  // Multi-upstream selection via path prefix or query params
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

  // Build passthrough query string excluding control params
  const passthrough = new URLSearchParams(url.searchParams)
  passthrough.delete('src')
  passthrough.delete('p')
  passthrough.delete('url')
  const qs = passthrough.toString()

  const targetUrl = upstreamPath
    ? `${originBase}/${upstreamPath}${qs ? `?${qs}` : ''}`
    : originBase + (qs ? `?${qs}` : '');

  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        accept: 'application/json, text/plain, */*',
        'user-agent': 'greft-proxy/1.0',
      },
      // Node API routes expose body via req; we won't forward bodies for GET/HEAD
    })

    const textBody = await response.text()
    res.status(response.status)
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    const ct = response.headers.get('content-type') || 'application/json'
    res.setHeader('Content-Type', ct)
    return res.send(textBody)
  } catch (error) {
    res.status(500)
    return res.send(`Proxy error: ${error.message}`)
  }
}


