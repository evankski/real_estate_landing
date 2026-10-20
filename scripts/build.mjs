import { cp, lstat, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listPublicFiles } from '../server/public-files.mjs';
import { generateCampaigns } from './generate-campaigns.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const destination = resolve(root, 'dist');
await generateCampaigns();
const files = await listPublicFiles(root);
try {
  if ((await lstat(destination)).isSymbolicLink()) throw new Error('dist must not be a symbolic link');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
for (const file of files) {
  const target = resolve(destination, file);
  await mkdir(dirname(target), { recursive: true });
  await cp(resolve(root, file), target, { dereference: false });
}
console.log(`Built ${files.length} public files in dist/.`);
