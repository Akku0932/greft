export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  const url = new URL(req.url);
  const targetPath = url.pathname.replace(/^\/api\/proxy-edge\/?/, '');
  const imageUrl = url.searchParams.get('url');
  const src = url.searchParams.get('src'); // e.g., 'mf'
  const p = url.searchParams.get('p');     // e.g., '/most-viewed'

  // CORS preflight support
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  // Image proxy: /api/proxy-edge?url=http://...
  if (imageUrl) {
    try {
      const response = await fetch(imageUrl);
      const headers = new Headers(response.headers);
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (error) {
      return new Response(`Image proxy error: ${error.message}`, { status: 500 });
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
        // Forward safe headers only
        'accept': 'application/json, text/plain, */*',
        'user-agent': 'greft-proxy/1.0',
      },
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : req.body,
    });

    const headers = new Headers(response.headers);
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    // Normalize missing content-type for JSON endpoints
    if (!headers.has('content-type')) {
      headers.set('content-type', 'application/json');
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch (error) {
    return new Response(`Proxy error: ${error.message}`, { status: 500 });
  }
}


