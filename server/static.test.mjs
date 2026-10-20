import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { publicPathFromUrl, serveAsset, SITE_ROOT } from './server.mjs';
import { listPublicFiles, PUBLIC_ROOT_FILES, PUBLIC_CAMPAIGN_FILES } from './public-files.mjs';

async function publicFixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'evan-public-fixture-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const filename of [...PUBLIC_ROOT_FILES, ...PUBLIC_CAMPAIGN_FILES]) {
    await mkdir(dirname(join(root, filename)), { recursive: true });
    await writeFile(join(root, filename), filename);
  }
  await mkdir(join(root, 'areas'));
  return root;
}

test('only published assets can be requested; private and traversal paths fail closed', async () => {
  assert.equal(publicPathFromUrl('/'), 'index.html');
  assert.equal(publicPathFromUrl('/style.css?v=1'), 'style.css');
  assert.equal(publicPathFromUrl('/areas/brentwood-ca-real-estate.html'), 'areas/brentwood-ca-real-estate.html');
  for (const path of [
    '/.env', '/.env.example', '/.git/config', '/server/lead-handler.mjs',
    '/package.json', '/README-FIRST.md', '/old/index.html', '/wrangler.jsonc',
    '/areas/../../.env', '/areas/%2e%2e/index.html', '/%252e%252e/.env',
    '/areas\\..\\index.html', '//index.html', '/index.html%00', '/%zz',
    '/compare//', '/compare/../index.html', '/compare/.env', '/compare/source.mjs',
    '/thanks/unknown', '/book/unknown', '/resources/private', '/preferences/.env',
    '/open-house/[slug]', '/open-house/-invalid', '/open-house/invalid-',
    '/open-house/Uppercase', `/open-house/${'a'.repeat(65)}`,
    '/open-house/property/private.html', '/open-house/property/source.json',
    '/media/campaigns/.secret.mp4', '/media/campaigns/../../.env',
    '/media/campaigns/script.js', '/media/campaigns/icon.svg',
    '/media/campaigns/private/movie.mp4', '/media/campaigns/notes.txt'
  ]) {
    assert.equal(publicPathFromUrl(path), null, path);
    assert.equal((await serveAsset(path)).status, 404, path);
  }
});

test('campaign routes resolve with or without trailing slashes and retain real directory indexes', () => {
  for (const filename of [...PUBLIC_CAMPAIGN_FILES, 'open-house/123-main-street/index.html']) {
    const route = `/${filename.replace(/\/index\.html$/, '')}`;
    assert.equal(publicPathFromUrl(route), filename, route);
    assert.equal(publicPathFromUrl(`${route}/`), filename, `${route}/`);
    assert.equal(publicPathFromUrl(`${route}?utm_source=example`), filename, route);
    assert.equal(publicPathFromUrl(`/${filename}`), filename, filename);
  }
  assert.equal(publicPathFromUrl('/campaigns.css'), 'campaigns.css');
  assert.equal(publicPathFromUrl('/campaigns.js'), 'campaigns.js');
});

test('nested campaign pages and optional media are served with the expected content types', async (t) => {
  const root = await publicFixture(t);
  const expectedTypes = {
    'comparison.mp4': 'video/mp4',
    'comparison.v1.mp4': 'video/mp4',
    'comparison.webm': 'video/webm',
    'comparison-en.vtt': 'text/vtt; charset=utf-8',
    'comparison-poster.jpg': 'image/jpeg',
    'sample.png': 'image/png',
    'sample.webp': 'image/webp'
  };
  await mkdir(join(root, 'media/campaigns'), { recursive: true });
  for (const [filename, type] of Object.entries(expectedTypes)) {
    await writeFile(join(root, 'media/campaigns', filename), 'fixture');
    const response = await serveAsset(`/media/campaigns/${filename}`, 'HEAD', root);
    assert.equal(response.status, 200, filename);
    assert.equal(response.headers.get('Content-Type'), type, filename);
    assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff', filename);
    assert.equal(await response.text(), '', filename);
  }
  for (const route of ['/compare', '/compare/', '/thanks/booking/', '/resources/buyer-checklist']) {
    const response = await serveAsset(route, 'GET', root);
    assert.equal(response.status, 200, route);
    assert.match(response.headers.get('Content-Type'), /text\/html/, route);
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

test('nested public paths reject symlink ancestors even when the target remains inside the site root', async (t) => {
  const root = await publicFixture(t);
  await mkdir(join(root, 'private'));
  await writeFile(join(root, 'private/index.html'), 'private source');
  await rm(join(root, 'thanks/compare'), { recursive: true });
  await symlink(join(root, 'private'), join(root, 'thanks/compare'));
  assert.equal((await serveAsset('/thanks/compare', 'GET', root)).status, 404);
  await assert.rejects(listPublicFiles(root), /must be regular: thanks\/compare\/index\.html/);
});

test('optional campaign media cannot be published through a symlink directory', async (t) => {
  const root = await publicFixture(t);
  await mkdir(join(root, 'private'));
  await writeFile(join(root, 'private/sample.mp4'), 'private media');
  await mkdir(join(root, 'media'));
  await symlink(join(root, 'private'), join(root, 'media/campaigns'));
  assert.equal((await serveAsset('/media/campaigns/sample.mp4', 'GET', root)).status, 404);
  await assert.rejects(listPublicFiles(root), /must be regular: media\/campaigns/);
});

test('build manifest includes only allowed campaign pages and media, and requires all core pages', async (t) => {
  const root = await publicFixture(t);
  for (const filename of [
    'open-house/123-main-street/index.html', 'open-house/123-main-street/private.json',
    'open-house/123-main-street/source.mjs', 'media/campaigns/comparison.mp4',
    'media/campaigns/comparison-en.vtt', 'media/campaigns/comparison-poster.webp',
    'media/campaigns/.secret.mp4', 'media/campaigns/notes.txt',
    'media/campaigns/private/unlisted.mp4', 'areas/brentwood.html',
    'scripts/campaign-config.mjs', '.env'
  ]) {
    await mkdir(dirname(join(root, filename)), { recursive: true });
    await writeFile(join(root, filename), filename);
  }
  const files = await listPublicFiles(root);
  for (const filename of PUBLIC_CAMPAIGN_FILES) assert.ok(files.includes(filename), filename);
  assert.ok(files.includes('open-house/123-main-street/index.html'));
  assert.ok(files.includes('media/campaigns/comparison.mp4'));
  assert.ok(files.includes('media/campaigns/comparison-en.vtt'));
  assert.ok(files.includes('media/campaigns/comparison-poster.webp'));
  assert.ok(files.includes('areas/brentwood.html'));
  assert.ok(!files.some(file => /(?:^|\/)(?:private|\.secret|notes|source|campaign-config|\.env)(?:[/.]|$)/.test(file)));
  await rm(join(root, 'thanks/booking/index.html'));
  await assert.rejects(listPublicFiles(root), /Required public asset is missing: thanks\/booking\/index\.html/);
});

test('build manifest rejects a symlink property index rather than copying its target', async (t) => {
  const root = await publicFixture(t);
  await mkdir(join(root, 'open-house/123-main-street'));
  await writeFile(join(root, 'private.html'), 'private source');
  await symlink(join(root, 'private.html'), join(root, 'open-house/123-main-street/index.html'));
  assert.equal((await serveAsset('/open-house/123-main-street/', 'GET', root)).status, 404);
  await assert.rejects(listPublicFiles(root), /must be regular: open-house\/123-main-street\/index\.html/);
});

test('build manifest excludes source, credentials, documentation, and old pages', async () => {
  const files = await listPublicFiles(SITE_ROOT);
  assert.ok(files.includes('index.html'));
  assert.ok(files.includes('areas/brentwood-ca-real-estate.html'));
  assert.ok(files.includes('headshot.jpg'));
  assert.ok(files.includes('compare/index.html'));
  assert.ok(files.includes('resources/buyer-checklist/index.html'));
  assert.ok(files.every(file => !/^(old|server|scripts|dist|\.)\//.test(file)));
  assert.ok(files.every(file => !/\.(?:md|json|jsonc|mjs)$/.test(file)));
});
