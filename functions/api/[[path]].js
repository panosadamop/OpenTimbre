// Cloudflare Pages Function: forwards every /api/* request to the FastAPI backend.
// Set BACKEND_URL in the Pages project settings, e.g. https://api.example.com
import { proxyToBackend } from '../../worker/proxy.js';

export const onRequest = ({ request, env }) => proxyToBackend(request, env);
