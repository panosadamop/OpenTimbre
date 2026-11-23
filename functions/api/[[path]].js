// Cloudflare Pages Function: forwards every /api/* request to the FastAPI backend.
// Keeps the Studio and API on one origin so the HttpOnly session cookie and
// OAuth redirects work without CORS. Set BACKEND_URL in the Pages project
// settings, e.g. https://api.example.com (no trailing slash needed).
export async function onRequest({ request, env }) {
  if (!env.BACKEND_URL) {
    return Response.json(
      { error: { code: 'backend_not_configured', message: 'BACKEND_URL is not set for this Pages project.' } },
      { status: 502 },
    );
  }

  const incoming = new URL(request.url);
  const target = new URL(incoming.pathname + incoming.search, env.BACKEND_URL);

  const headers = new Headers(request.headers);
  headers.set('X-Forwarded-Host', incoming.host);
  headers.set('X-Forwarded-Proto', incoming.protocol.replace(':', ''));
  const clientIp = request.headers.get('CF-Connecting-IP');
  if (clientIp) headers.set('X-Forwarded-For', clientIp);

  // redirect: 'manual' passes backend redirects (e.g. GitHub OAuth) through to the browser.
  return fetch(new Request(target, { method: request.method, headers, body: request.body, redirect: 'manual' }));
}
