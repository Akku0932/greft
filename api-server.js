const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// MP API proxy
app.get('/api/mp', async (req, res) => {
  try {
    const p = req.query.p;
    if (!p) {
      return res.status(400).json({ error: 'Missing required query param p' });
    }

    // Normalize upstream target
    let upstreamPath = String(p).trim();
    if (/^https?:\/\//i.test(upstreamPath)) {
      const parsed = new URL(upstreamPath);
      upstreamPath = parsed.pathname.replace(/^\/+/, '') + (parsed.search || '');
    } else {
      upstreamPath = upstreamPath.replace(/^\/+/, '');
    }

    // Choose origin based on whether this is an image asset or API path
    const isAsset = /^(thumb|media|mpim|amim|ampi|mpav)\//i.test(upstreamPath);
    const originBase = isAsset ? 'https://mangapark.com' : 'https://mangapark-sigma.vercel.app';
    const targetUrl = `${originBase}/${upstreamPath}`;

    const response = await fetch(targetUrl, {
      headers: {
        'accept': '*/*',
        'accept-language': 'en-US,en;q=0.9',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'referer': originBase + '/',
        'origin': originBase,
        'pragma': 'no-cache',
        'cache-control': 'no-cache',
        'connection': 'keep-alive',
        'keep-alive': 'timeout=5, max=1000',
      },
      timeout: 10000,
    });

    if (!response.ok) {
      throw new Error(`Upstream error: ${response.status}`);
    }

    const body = await response.buffer();
    const contentType = response.headers.get('content-type') || 'application/json';
    
    res.set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, *',
      'Content-Type': contentType,
    });

    res.send(body);
  } catch (error) {
    console.error('MP proxy error:', error);
    res.status(502).json({ 
      error: 'MP proxy failed', 
      detail: error.message 
    });
  }
});

// GF API proxy
app.get('/api/gf', async (req, res) => {
  try {
    const p = req.query.p;
    const upstreamPath = String(p).replace(/^\/+/, '');
    if (!upstreamPath) {
      return res.status(400).json({ error: 'Missing required query param p' });
    }

    const ORIGINS = [
      'http://ger.visionhost.cloud:2056',
      'https://ger.visionhost.cloud:2056',
    ];

    let lastError = null;
    for (const base of ORIGINS) {
      try {
        const targetUrl = `${base}/${upstreamPath}`;
        const response = await fetch(targetUrl, {
          headers: {
            'accept': 'application/json, text/plain, */*',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
            'referer': base + '/',
            'origin': base,
            'accept-language': 'en-US,en;q=0.9',
            'pragma': 'no-cache',
            'cache-control': 'no-cache',
            'x-requested-with': 'XMLHttpRequest',
            'connection': 'keep-alive',
            'keep-alive': 'timeout=5, max=1000',
          },
          timeout: 5000,
        });

        if (!response.ok) {
          lastError = `Upstream ${response.status}`;
          continue;
        }

        const body = await response.buffer();
        const contentType = response.headers.get('content-type') || 'application/json';
        
        res.set({
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Content-Type': contentType,
        });

        return res.send(body);
      } catch (err) {
        lastError = String(err);
        continue;
      }
    }
    throw new Error(lastError || 'GF upstream failed');
  } catch (error) {
    console.error('GF proxy error:', error);
    res.status(502).json({ 
      error: 'GF proxy failed', 
      detail: error.message 
    });
  }
});

// Image proxy
app.get('/api/proxy-edge', async (req, res) => {
  try {
    const imageUrl = req.query.url;
    if (!imageUrl) {
      return res.status(400).json({ error: 'Missing image URL' });
    }

    const response = await fetch(imageUrl, { timeout: 10000 });
    if (!response.ok) {
      throw new Error(`Image fetch failed: ${response.status}`);
    }

    const buffer = await response.buffer();
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    
    res.set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Content-Type': contentType,
    });

    res.send(buffer);
  } catch (error) {
    console.error('Image proxy error:', error);
    res.status(500).json({ 
      error: 'Image proxy failed', 
      detail: error.message 
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
