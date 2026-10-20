import { handleLead } from './lead-handler.mjs';
import { publicPathFromUrl } from './public-paths.mjs';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/leads') return handleLead(request, env);
    if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405 });
    const relativePath = publicPathFromUrl(url.pathname);
    if (!relativePath) return new Response('Not found', { status: 404 });
    url.pathname = `/${relativePath}`;
    return env.ASSETS.fetch(new Request(url, request));
  }
};
