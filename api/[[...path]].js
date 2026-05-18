/**
 * Xsee API proxy — all routes under /api/xsee/*
 * Examples: /api/xsee/me  /api/xsee/streams/username/participants
 */

function getApiPath(req) {
  const q = req.query || {};

  const val = q.path ?? q['..path'];
  if (val !== undefined && val !== null) {
    return Array.isArray(val) ? val.join('/') : String(val);
  }

  for (const key of Object.keys(q)) {
    if (key.replace(/\./g, '') === 'path') {
      const v = q[key];
      const part = Array.isArray(v) ? v.join('/') : String(v || '');
      if (part) return part;
    }
  }

  const raw = req.url || '';
  try {
    const pathname = new URL(raw, 'https://stream-wheel.vercel.app').pathname;
    if (pathname.startsWith('/api/xsee/')) {
      const rest = pathname.slice('/api/xsee/'.length).replace(/^\/+/, '');
      if (rest) return decodeURIComponent(rest);
    }
  } catch (_) {
    const pathname = raw.split('?')[0];
    if (pathname.startsWith('/api/xsee/')) {
      const rest = pathname.slice('/api/xsee/'.length).replace(/^\/+/, '');
      if (rest) return decodeURIComponent(rest);
    }
  }

  return '';
}

export default async function handler(req, res) {
  const key = process.env.XSEE_API_KEY;
  if (!key) {
    return res.status(500).json({
      error: { code: 'misconfigured', message: 'XSEE_API_KEY is not set in Vercel.' },
    });
  }

  const pathPart = getApiPath(req);
  if (!pathPart) {
    return res.status(400).json({
      error: { code: 'bad_request', message: 'Use /api/xsee/me or /api/xsee/streams/{username}/participants' },
    });
  }

  const base = (process.env.XSEE_API_BASE || 'https://xsee.tv/api/v1').replace(/\/$/, '');
  const upstreamUrl = `${base}/${pathPart}`;

  const headers = {
    Authorization: `Bearer ${key}`,
    Accept: 'application/json',
  };

  let body;
  const method = req.method || 'GET';
  if (method !== 'GET' && method !== 'HEAD') {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(req.body ?? {});
  }

  try {
    const upstream = await fetch(upstreamUrl, { method, headers, body });
    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    return res.send(text);
  } catch (err) {
    return res.status(502).json({
      error: { code: 'proxy_error', message: err.message || 'Upstream request failed' },
    });
  }
}
