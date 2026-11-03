// Shared identities for the November worksheet funnels. Padded IDs are
// intentional: C01/C02 are not the older C1/C2 offers.
export const worksheetCampaigns = Object.freeze({
  C01: { id: 'C01', title: 'Home Shortlist Review', resourceType: 'Shortlist sheet', version: '2026-11-02',
    route: '/compare-homes/', watch: '/compare-homes/watch/', book: '/book/home-shortlist/', thanks: '/thanks/home-shortlist/',
    pdf: '/resources/3-home-shortlist-sheet.pdf', preview: '/media/campaigns/shortlist-sheet-preview.webp', videoKey: 'home-shortlist' },
  C02: { id: 'C02', title: 'First Home Game Plan', resourceType: 'First Home Next Steps Sheet', version: 'outlook-request-v3',
    manualType: 'First Home Game Plan time request', phoneBookingVersion: 'phone-call-v4', sheetThanks: '/first-purchase/sheet-request/',
    downloadName: 'First Home Next Steps Sheet.pdf',
    route: '/first-purchase/', watch: '/first-purchase/watch/', book: '/book/first-home-plan/', thanks: '/thanks/first-home-plan/',
    pdf: '/resources/first-home-next-steps-sheet.pdf', preview: '/media/campaigns/first-home-sheet-preview.webp', videoKey: 'first-home-plan' }
});

export function firstHomeAlias(pathname) {
  const path = pathname.replace(/\/index\.html$/, '/').replace(/\/?$/, '/');
  const c = worksheetCampaigns.C02;
  if (path === c.watch) return c.route;
  if (path === c.book || path === c.thanks) return c.route + '#booking';
  return null;
}

export function firstHomeRedirect(rawUrl) {
  const url = new URL(rawUrl, 'https://www.evankrealestate.com');
  const target = firstHomeAlias(url.pathname);
  if (!target) return null;
  const [path, anchor] = target.split('#');
  return new Response(null, {status: 302, headers: {Location: path + url.search + (anchor ? '#' + anchor : ''), 'Cache-Control': 'no-store'}});
}
