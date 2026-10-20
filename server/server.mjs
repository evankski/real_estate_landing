import { createServer } from 'node:http';
import { readFile, lstat, realpath } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { handleLead } from './lead-handler.mjs';
import { isPublicPath } from './public-files.mjs';

export const SITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8'
};

export function publicPathFromUrl(rawUrl) {
  try {
    if (!rawUrl.startsWith('/') || rawUrl.startsWith('//')) return null;
    const path = decodeURIComponent(rawUrl.split('?')[0]);
    if (path.includes('\\') || path.includes('\0') || path.split('/').some(part => part === '..' || part === '.')) return null;
    const relativePath = path === '/' ? 'index.html' : path.slice(1);
    return isPublicPath(relativePath) ? relativePath : null;
  } catch {
    return null;
  }
}

export async function serveAsset(rawUrl, method = 'GET', root = SITE_ROOT) {
  if (!['GET', 'HEAD'].includes(method)) return new Response('Method not allowed', { status: 405 });
  const relativePath = publicPathFromUrl(rawUrl);
  if (!relativePath) return new Response('Not found', { status: 404 });
  try {
    const rootPath = await realpath(root);
    const filename = resolve(rootPath, relativePath);
    const resolvedFilename = await realpath(filename);
    const info = await lstat(filename);
    if (!info.isFile() || info.isSymbolicLink() || !resolvedFilename.startsWith(rootPath + sep)) {
      return new Response('Not found', { status: 404 });
    }
    if (relativePath.startsWith('areas/') && (await lstat(resolve(rootPath, 'areas'))).isSymbolicLink()) {
      return new Response('Not found', { status: 404 });
    }
    const extension = relativePath.slice(relativePath.lastIndexOf('.'));
    return new Response(method === 'HEAD' ? null : await readFile(filename), {
      headers: {
        'Content-Type': TYPES[extension] || 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-cache'
      }
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}

export function createSiteServer(env = process.env) {
  return createServer(async (incoming, outgoing) => {
    try {
      const rawUrl = incoming.url || '/';
      let response;
      if (rawUrl.split('?')[0] === '/api/leads') {
        const url = new URL(rawUrl, `http://${incoming.headers.host || '127.0.0.1'}`);
        const init = { method: incoming.method, headers: incoming.headers };
        if (!['GET', 'HEAD'].includes(incoming.method)) {
          init.body = Readable.toWeb(incoming);
          init.duplex = 'half';
        }
        response = await handleLead(new Request(url, init), env);
      } else {
        response = await serveAsset(rawUrl, incoming.method);
      }
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch {
      if (!outgoing.headersSent) outgoing.writeHead(500, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
      outgoing.end('Unable to complete request');
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (typeof process.loadEnvFile === 'function') {
    try {
      process.loadEnvFile(resolve(SITE_ROOT, '.env'));
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Could not load .env. Check its format.');
        process.exit(1);
      }
    }
  }
  const port = Number(process.env.PORT || 4173);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error('PORT must be a number between 1 and 65535.');
    process.exit(1);
  }
  createSiteServer().listen(port, '127.0.0.1', () => {
    console.log(`Website ready at http://127.0.0.1:${port}`);
  });
}
