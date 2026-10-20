import { lstat, readdir, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { PUBLIC_ROOT_FILES, PUBLIC_CAMPAIGN_FILES, isPublicPath, isPropertySlug } from './public-paths.mjs';
export { PUBLIC_ROOT_FILES, PUBLIC_CAMPAIGN_FILES, isPublicPath } from './public-paths.mjs';

// Check every component, not only the leaf: an in-root symlink could otherwise
// make a permitted URL expose a private directory or file.
async function regularPath(root, relativePath, directory = false) {
  let filename = await realpath(root);
  const parts = relativePath.split('/');
  for (let index = 0; index < parts.length; index += 1) {
    filename = join(filename, parts[index]);
    let info;
    try {
      info = await lstat(filename);
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return null;
      throw error;
    }
    const needsDirectory = directory || index < parts.length - 1;
    if (info.isSymbolicLink() || (needsDirectory ? !info.isDirectory() : !info.isFile())) {
      throw new Error(`Public ${needsDirectory ? 'directory' : 'asset'} must be regular: ${relativePath}`);
    }
  }
  return filename;
}

export async function resolvePublicFile(root, relativePath) {
  if (!isPublicPath(relativePath)) return null;
  return regularPath(root, relativePath);
}

export async function listPublicFiles(root) {
  const files = [];
  for (const name of [...PUBLIC_ROOT_FILES, ...PUBLIC_CAMPAIGN_FILES]) {
    if (!await resolvePublicFile(root, name)) throw new Error(`Required public asset is missing: ${name}`);
    files.push(name);
  }
  const areaDirectory = await regularPath(root, 'areas', true);
  if (!areaDirectory) throw new Error('areas must be a regular directory');
  for (const entry of await readdir(areaDirectory, { withFileTypes: true })) {
    const relativePath = `areas/${entry.name}`;
    if (isPublicPath(relativePath) && await resolvePublicFile(root, relativePath)) files.push(relativePath);
  }
  const properties = await regularPath(root, 'open-house', true);
  for (const entry of await readdir(properties, { withFileTypes: true })) {
    if (!isPropertySlug(entry.name)) continue;
    if (entry.isSymbolicLink()) throw new Error(`Public directory must be regular: open-house/${entry.name}`);
    if (!entry.isDirectory()) continue;
    const relativePath = `open-house/${entry.name}/index.html`;
    if (await resolvePublicFile(root, relativePath)) files.push(relativePath);
  }
  const mediaDirectory = await regularPath(root, 'media/campaigns', true);
  if (mediaDirectory) {
    for (const entry of await readdir(mediaDirectory, { withFileTypes: true })) {
      const relativePath = `media/campaigns/${entry.name}`;
      if (isPublicPath(relativePath) && await resolvePublicFile(root, relativePath)) files.push(relativePath);
    }
  }
  return files.sort();
}
