export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  const url = new URL(req.url);
  const targetPath = url.pathname.replace(/^\/api\/proxy-edge\/?/, '');
  const imageUrl = url.searchParams.get('url');

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

  const originBase = 'http://ger.visionhost.cloud:2056';
  const targetUrl = targetPath
    ? `${originBase}/${targetPath}${url.search ? url.search : ''}`
    : originBase + (url.search || '');

  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        // Forward safe headers only
        'accept': 'application/json, text/plain, */*',
      },
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : req.body,
    });

    const headers = new Headers(response.headers);
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch (error) {
    return new Response(`Proxy error: ${error.message}`, { status: 500 });
  }
}


