import { readFile, writeFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { createProfile, TITLES } from '../src/lib/profiles.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = JSON.parse(await readFile(resolve(root, 'data/insects.json'), 'utf8'));
const insects = [];
for (const record of source.insects) {
  if (!['generated', 'approved'].includes(record.illustration.status) || record.illustration.reference_review_status === 'blocked') continue;
  const path = record.illustration.image_path;
  if (path !== `assets/illustrations/${record.id}.png`) throw new Error(`Unexpected illustration path: ${record.id}`);
  const profile = createProfile(record);
  const webPath = `assets/web-illustrations/${record.id}.webp`;
  const webFile = await stat(resolve(root, webPath)).catch(() => null);
  if (webFile?.isFile()) profile.image = '/' + webPath;
  else {
    const file = await stat(resolve(root, path)).catch(() => null);
    if (!file?.isFile()) throw new Error(`Missing illustration: ${record.id}`);
  }
  insects.push(profile);
}
if (!insects.length) throw new Error('No saved illustrations found.');
const counts = Object.fromEntries(TITLES.map(t => [t.id, insects.filter(i => i.traits.some(it => it.id === t.id)).length]));
await writeFile(resolve(root, 'data/web-catalog.json'), JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), total: insects.length, titleCounts: counts, insects }));
console.log(`Web catalog: ${insects.length} real illustrations; ${TITLES.length} searchable titles.`);
