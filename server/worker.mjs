import { handleLead } from './lead-handler.mjs';
import { publicPathFromUrl } from './public-paths.mjs';
import { firstHomeRedirect, worksheetCampaigns } from './worksheet-campaigns.mjs';
export {C02AppointmentOutbox} from './c02-outbox.mjs';

const mirrorHost = 'evan-karwowski-real-estate.evan-karwowski.workers.dev';
const mainPages = ['index.html', 'privacy.html', 'terms.html', 'cookies.html', 'accessibility.html'];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/leads') return handleLead(request, env);
    if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405 });
    const redirect = firstHomeRedirect(url.href);
    if (redirect) return redirect;
    const relativePath = publicPathFromUrl(url.pathname);
    if (!relativePath) return new Response('Not found', { status: 404 });
    url.pathname = `/${relativePath}`;
    // Organic pages are published on GitHub Pages at Evan's custom domain.
    // Check the asset before redirecting so mistyped city URLs stay 404s.
    if (url.hostname === mirrorHost && (mainPages.includes(relativePath) || relativePath.startsWith('areas/') || relativePath.startsWith('guides/'))) {
      const asset = await env.ASSETS.fetch(new Request(url, { method: 'HEAD' }));
      if (!asset.ok) return asset;
      const destination = new URL(url.pathname.replace(/\/index\.html$/, '/') + url.search, 'https://evankrealestate.com');
      return Response.redirect(destination, 301);
    }
    const asset = await env.ASSETS.fetch(new Request(url, request));
    if (url.pathname !== worksheetCampaigns.C02.pdf || !asset.ok) return asset;
    const pdf = new Response(asset.body, asset);
    pdf.headers.set('Content-Disposition', `inline; filename="${worksheetCampaigns.C02.downloadName}"`);
    return pdf;
  }
};
