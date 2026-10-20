import { lstat, readdir } from 'node:fs/promises';
import { join } from 'node:path';

export const PUBLIC_ROOT_FILES = Object.freeze([
  'index.html', 'privacy.html', 'terms.html', 'cookies.html',
  'accessibility.html', 'thanks.html', 'style.css', 'script.js',
  'favicon.svg', 'robots.txt', 'sitemap.xml',
  'headshot.jpg', 'headshot-480.jpg', 'headshot-960.jpg'
]);

export function isPublicPath(relativePath) {
  return PUBLIC_ROOT_FILES.includes(relativePath) || /^areas\/[a-z0-9-]+\.html$/.test(relativePath);
}

export async function listPublicFiles(root) {
  const files = [];
  for (const name of PUBLIC_ROOT_FILES) {
    const info = await lstat(join(root, name));
    if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Public asset must be a regular file: ${name}`);
    files.push(name);
  }
  const areaDirectory = await lstat(join(root, 'areas'));
  if (!areaDirectory.isDirectory() || areaDirectory.isSymbolicLink()) throw new Error('areas must be a regular directory');
  for (const entry of await readdir(join(root, 'areas'), { withFileTypes: true })) {
    const relativePath = `areas/${entry.name}`;
    if (entry.isFile() && !entry.isSymbolicLink() && isPublicPath(relativePath)) files.push(relativePath);
  }
  return files.sort();
}
