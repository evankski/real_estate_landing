import { handleLead } from './lead-handler.mjs';
import { publicPathFromUrl } from './public-paths.mjs';
import { firstHomeRedirect, worksheetCampaigns } from './worksheet-campaigns.mjs';
export {C02AppointmentOutbox} from './c02-outbox.mjs';

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
    const asset = await env.ASSETS.fetch(new Request(url, request));
    if (url.pathname !== worksheetCampaigns.C02.pdf || !asset.ok) return asset;
    const pdf = new Response(asset.body, asset);
    pdf.headers.set('Content-Disposition', `inline; filename="${worksheetCampaigns.C02.downloadName}"`);
    return pdf;
  }
};
