// Forwards /api/* requests to the FastAPI backend at env.BACKEND_URL.
// Shared by the Workers entry (worker/index.js) and the Pages Function
// (functions/api/[[path]].js). Keeping Studio and API on one origin lets the
// HttpOnly session cookie and GitHub OAuth redirects work without CORS.
export async function proxyToBackend(request, env) {
  if (!env.BACKEND_URL) {
    return Response.json(
      { detail: 'BACKEND_URL is not configured for this Cloudflare project.', code: 'backend_not_configured' },
      { status: 502 },
    );
  }

  const incoming = new URL(request.url);
  const target = new URL(incoming.pathname + incoming.search, env.BACKEND_URL);

  const headers = new Headers(request.headers);
  // Drop Cloudflare/forwarding headers from the client; set our own below.
  for (const name of [...headers.keys()]) {
    if (name.startsWith('cf-') || name.startsWith('x-forwarded-') || name === 'host') headers.delete(name);
  }
  headers.set('X-Forwarded-Host', incoming.host);
  headers.set('X-Forwarded-Proto', incoming.protocol.replace(':', ''));
  const clientIp = request.headers.get('CF-Connecting-IP');
  if (clientIp) headers.set('X-Forwarded-For', clientIp);

  try {
    // redirect: 'manual' passes backend redirects (e.g. GitHub OAuth) to the browser.
    return await fetch(target, {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
      redirect: 'manual',
    });
  } catch (error) {
    return Response.json({ detail: `Backend unreachable: ${error}`, code: 'backend_unreachable' }, { status: 502 });
  }
}
