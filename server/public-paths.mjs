// Pure route definitions shared by the Node preview and Cloudflare Worker.
// Keep filesystem checks in public-files.mjs so the Worker has no Node imports.
export const PUBLIC_ROOT_FILES = Object.freeze([
  'index.html', 'privacy.html', 'terms.html', 'cookies.html',
  'accessibility.html', 'thanks.html', 'style.css', 'script.js',
  'campaigns.css', 'campaigns.js',
  'favicon.svg', 'robots.txt', 'sitemap.xml',
  'headshot.jpg', 'headshot-480.jpg', 'headshot-960.jpg'
]);

export const PUBLIC_CAMPAIGN_FILES = Object.freeze([
  'compare/index.html', 'buyer-plan/index.html', 'seller-plan/index.html',
  'open-house/index.html',
  'thanks/compare/index.html', 'thanks/buyer-plan/index.html',
  'thanks/seller-plan/index.html', 'thanks/open-house/index.html',
  'thanks/booking/index.html',
  'book/compare/index.html', 'book/buyer-plan/index.html', 'book/seller-plan/index.html',
  'preferences/index.html', 'resources/buyer-checklist/index.html'
]);

const PROPERTY_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CAMPAIGN_MEDIA = /^media\/campaigns\/[A-Za-z0-9][A-Za-z0-9._-]{0,119}\.(?:mp4|webm|vtt|jpg|png|webp)$/;

export function isPropertySlug(value) {
  return value.length <= 64 && PROPERTY_SLUG.test(value);
}

export function isPublicPath(relativePath) {
  if (PUBLIC_ROOT_FILES.includes(relativePath) || PUBLIC_CAMPAIGN_FILES.includes(relativePath)) return true;
  if (/^areas\/[a-z0-9-]+\.html$/.test(relativePath) || CAMPAIGN_MEDIA.test(relativePath)) return true;
  const property = /^open-house\/([^/]+)\/index\.html$/.exec(relativePath);
  return Boolean(property && isPropertySlug(property[1]));
}

export function publicPathFromUrl(rawUrl) {
  try {
    if (!rawUrl.startsWith('/') || rawUrl.startsWith('//')) return null;
    const path = decodeURIComponent(rawUrl.split('?')[0]);
    if (path.includes('\\') || path.includes('\0') || path.includes('//') || path.split('/').some(part => part === '..' || part === '.')) return null;
    const relativePath = path === '/' ? 'index.html' : path.slice(1);
    if (isPublicPath(relativePath)) return relativePath;
    const directoryIndex = `${relativePath.replace(/\/$/, '')}/index.html`;
    return isPublicPath(directoryIndex) ? directoryIndex : null;
  } catch {
    return null;
  }
}
