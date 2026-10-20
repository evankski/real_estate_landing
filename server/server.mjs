import { createServer } from 'node:http';
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { handleLead } from './lead-handler.mjs';
import { resolvePublicFile } from './public-files.mjs';
import { publicPathFromUrl } from './public-paths.mjs';
export { publicPathFromUrl } from './public-paths.mjs';

export const SITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.vtt': 'text/vtt; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8'
};

function byteRange(value, size) {
  // A single byte range covers browser video seeking. Ignore unsupported units,
  // malformed ranges, and multipart requests rather than pretending to satisfy
  // them. BigInt prevents large numeric offsets from overflowing or rounding.
  const match = /^bytes=\s*(\d*)-(\d*)\s*$/i.exec(value || '');
  if (!match || (!match[1] && !match[2])) return null;
  const length = BigInt(size);
  if (!match[1]) {
    const suffix = BigInt(match[2]);
    if (!suffix || !length) return { unsatisfiable: true };
    return { start: Number(suffix >= length ? 0n : length - suffix), end: size - 1 };
  }
  const start = BigInt(match[1]);
  const end = match[2] ? BigInt(match[2]) : length - 1n;
  if (match[2] && end < start) return null;
  if (start >= length) return { unsatisfiable: true };
  return { start: Number(start), end: Number(end >= length ? length - 1n : end) };
}

export async function serveAsset(rawUrl, method = 'GET', root = SITE_ROOT, requestHeaders = {}) {
  if (!['GET', 'HEAD'].includes(method)) return new Response('Method not allowed', { status: 405 });
  const relativePath = publicPathFromUrl(rawUrl);
  if (!relativePath) return new Response('Not found', { status: 404 });
  let file;
  try {
    const filename = await resolvePublicFile(root, relativePath);
    if (!filename) return new Response('Not found', { status: 404 });
    file = await open(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
    const info = await file.stat();
    if (!info.isFile()) throw new Error('Not a regular public file');
    const extension = relativePath.slice(relativePath.lastIndexOf('.'));
    const headers = new Headers({
      'Content-Type': TYPES[extension] || 'application/octet-stream',
      'Content-Length': String(info.size),
      'Accept-Ranges': 'bytes',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-cache'
    });
    const requested = new Headers(requestHeaders);
    // HEAD ignores Range. No strong validator is issued by this development
    // server, so If-Range cannot match and gets the complete representation.
    const range = method === 'GET' && !requested.has('If-Range')
      ? byteRange(requested.get('Range'), info.size) : null;
    if (range?.unsatisfiable) {
      headers.set('Content-Range', `bytes */${info.size}`);
      headers.set('Content-Length', '0');
      return new Response(null, { status: 416, headers });
    }
    if (range) {
      headers.set('Content-Range', `bytes ${range.start}-${range.end}/${info.size}`);
      headers.set('Content-Length', String(range.end - range.start + 1));
    }
    if (method === 'HEAD' || info.size === 0) return new Response(null, { headers });
    const stream = file.createReadStream(range ? { start: range.start, end: range.end } : {});
    // The stream now owns the handle and closes it on completion or cancellation.
    file = null;
    return new Response(Readable.toWeb(stream), { status: range ? 206 : 200, headers });
  } catch {
    return new Response('Not found', { status: 404 });
  } finally {
    await file?.close();
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
        response = await serveAsset(rawUrl, incoming.method, SITE_ROOT, incoming.headers);
      }
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      if (response.body) await pipeline(Readable.fromWeb(response.body), outgoing);
      else outgoing.end();
    } catch {
      if (outgoing.headersSent) outgoing.destroy();
      else {
        outgoing.writeHead(500, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
        outgoing.end('Unable to complete request');
      }
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
