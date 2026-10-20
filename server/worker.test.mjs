import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import worker from './worker.mjs';
import { PUBLIC_CAMPAIGN_FILES } from './public-paths.mjs';

const origin = 'https://www.evankrealestate.com';

test('worker rewrites campaign directory URLs to explicit asset indexes and preserves the request', async () => {
  const received = [];
  const env = { ASSETS: { fetch: async request => {
    received.push(request);
    return new Response('fixture', { headers: { 'Content-Type': 'text/html' } });
  } } };
  for (const filename of [...PUBLIC_CAMPAIGN_FILES, 'open-house/123-main-street/index.html']) {
    const route = `/${filename.replace(/\/index\.html$/, '')}`;
    for (const suffix of ['', '/', '/index.html']) {
      const response = await worker.fetch(new Request(`${origin}${route}${suffix}?utm_source=example`, {
        method: 'HEAD', headers: { 'Accept': 'text/html', 'Range': 'bytes=0-99' }
      }), env);
      assert.equal(response.status, 200, `${route}${suffix}`);
      const forwarded = received.at(-1);
      assert.equal(forwarded.url, `${origin}/${filename}?utm_source=example`);
      assert.equal(forwarded.method, 'HEAD');
      assert.equal(forwarded.headers.get('Accept'), 'text/html');
      assert.equal(forwarded.headers.get('Range'), 'bytes=0-99');
    }
  }
});

test('worker rejects unsupported routes and methods without accessing the assets binding', async () => {
  let calls = 0;
  const env = { ASSETS: { fetch: async () => { calls += 1; return new Response('private'); } } };
  for (const route of [
    '/.env', '/scripts/campaign-config.mjs', '/server/public-paths.mjs',
    '/compare/private.json', '/thanks/unknown', '/book/unknown',
    '/resources/private', '/open-house/[slug]', '/open-house/property/private.html',
    '/compare//', '/compare%00', '/media/campaigns/private/recording.mp4'
  ]) {
    assert.equal((await worker.fetch(new Request(`${origin}${route}`), env)).status, 404, route);
  }
  assert.equal((await worker.fetch(new Request(`${origin}/compare`, { method: 'POST', body: 'test' }), env)).status, 405);
  assert.equal(calls, 0);
});

test('worker leaves missing optional property pages as a real asset 404', async () => {
  const received = [];
  const env = { ASSETS: { fetch: async request => {
    received.push(new URL(request.url).pathname);
    return new Response('Not found', { status: 404 });
  } } };
  assert.equal((await worker.fetch(new Request(`${origin}/open-house/not-configured/`), env)).status, 404);
  assert.deepEqual(received, ['/open-house/not-configured/index.html']);
});

test('Cloudflare selective worker routes cover each generated page without changing existing HTML handling', async () => {
  const config = JSON.parse(await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
  assert.equal(config.assets.html_handling, 'none');
  assert.ok(config.assets.run_worker_first.includes('/'));
  assert.ok(config.assets.run_worker_first.includes('/api/leads'));
  const covered = path => config.assets.run_worker_first.some(pattern =>
    pattern.endsWith('*') ? path.startsWith(pattern.slice(0, -1)) : path === pattern
  );
  for (const filename of [...PUBLIC_CAMPAIGN_FILES, 'open-house/123-main-street/index.html']) {
    const route = `/${filename.replace(/\/index\.html$/, '')}`;
    assert.ok(covered(route), route);
    assert.ok(covered(`${route}/`), `${route}/`);
    assert.ok(covered(`/${filename}`), filename);
  }
  assert.equal(covered('/privacy.html'), false);
  assert.equal(covered('/headshot.jpg'), false);
  assert.equal(covered('/areas/brentwood-ca-real-estate.html'), false);
});
