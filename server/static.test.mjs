import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { publicPathFromUrl, serveAsset, SITE_ROOT } from './server.mjs';
import { listPublicFiles } from './public-files.mjs';

test('only published assets can be requested; private and traversal paths fail closed', async () => {
  assert.equal(publicPathFromUrl('/'), 'index.html');
  assert.equal(publicPathFromUrl('/style.css?v=1'), 'style.css');
  assert.equal(publicPathFromUrl('/areas/brentwood-ca-real-estate.html'), 'areas/brentwood-ca-real-estate.html');
  for (const path of [
    '/.env', '/.env.example', '/.git/config', '/server/lead-handler.mjs',
    '/package.json', '/README-FIRST.md', '/old/index.html', '/wrangler.jsonc',
    '/areas/../../.env', '/areas/%2e%2e/index.html', '/%252e%252e/.env',
    '/areas\\..\\index.html', '//index.html', '/index.html%00', '/%zz'
  ]) {
    assert.equal(publicPathFromUrl(path), null, path);
    assert.equal((await serveAsset(path)).status, 404, path);
  }
});

test('public pages have appropriate media types and HEAD does not return body', async () => {
  const page = await serveAsset('/');
  assert.equal(page.status, 200);
  assert.match(page.headers.get('Content-Type'), /text\/html/);
  assert.match(await page.text(), /<!doctype html>/i);
  const image = await serveAsset('/headshot-480.jpg', 'HEAD');
  assert.equal(image.status, 200);
  assert.equal(image.headers.get('Content-Type'), 'image/jpeg');
  assert.equal(await image.text(), '');
  assert.equal((await serveAsset('/', 'POST')).status, 405);
});

test('static serving rejects symlinks, including an areas directory link', async (t) => {
  const temporary = await mkdtemp(join(tmpdir(), 'evan-static-test-'));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const root = join(temporary, 'public');
  await mkdir(root);
  await writeFile(join(temporary, 'private.html'), 'private');
  await symlink(join(temporary, 'private.html'), join(root, 'index.html'));
  assert.equal((await serveAsset('/', 'GET', root)).status, 404);
  await mkdir(join(temporary, 'outside'));
  await writeFile(join(temporary, 'outside', 'brentwood.html'), 'private');
  await symlink(join(temporary, 'outside'), join(root, 'areas'));
  assert.equal((await serveAsset('/areas/brentwood.html', 'GET', root)).status, 404);
});

test('build manifest excludes source, credentials, documentation, and old pages', async () => {
  const files = await listPublicFiles(SITE_ROOT);
  assert.ok(files.includes('index.html'));
  assert.ok(files.includes('areas/brentwood-ca-real-estate.html'));
  assert.ok(files.includes('headshot.jpg'));
  assert.ok(files.every(file => !/^(old|server|scripts|dist|\.)\//.test(file)));
  assert.ok(files.every(file => !/\.(?:md|json|jsonc|mjs)$/.test(file)));
});
