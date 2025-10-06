export const config = { runtime: 'edge' }

export default async function handler(req) {
  const url = new URL(req.url)
  const segments = url.pathname.split('/').slice(3) // /api/proxy-edge/<...>
  const search = url.search || ''
  const target = `http://ger.visionhost.cloud:2056/${segments.join('/')}${search}`
  try {
    const upstream = await fetch(target, { headers: { 'accept': 'application/json,image/*,*/*' } })
    const body = await upstream.arrayBuffer()
    const headers = new Headers(upstream.headers)
    headers.set('Access-Control-Allow-Origin', '*')
    headers.set('Cache-Control', 'public, max-age=300')
    return new Response(body, { status: upstream.status, headers })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Edge proxy failed', detail: String(e) }), { status: 502, headers: { 'content-type': 'application/json' } })
  }
}


