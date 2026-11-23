// Cloudflare Workers entry: /api/* goes to the backend, everything else is the
// built Studio from ./dist (with single-page-app fallback, see wrangler.jsonc).
import { proxyToBackend } from './proxy.js';

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api' || pathname.startsWith('/api/')) return proxyToBackend(request, env);
    return env.ASSETS.fetch(request);
  },
};
