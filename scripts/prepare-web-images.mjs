import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { readFile, writeFile, stat, mkdir } from 'node:fs/promises';
const records = JSON.parse(await readFile('data/insects.json', 'utf8')).insects.filter(r => ['generated', 'approved'].includes(r.illustration.status) && r.illustration.reference_review_status !== 'blocked');
const outputDir = 'assets/web-illustrations';
await mkdir(outputDir, { recursive: true });
let previous = {};
try { previous = Object.fromEntries(JSON.parse(await readFile(`${outputDir}/manifest.json`, 'utf8')).images.map(i => [i.id, i])); } catch {}
const images = new Array(records.length);
let cursor = 0, completed = 0;
const hash = raw => createHash('sha256').update(raw).digest('hex');
async function worker() {
  while (cursor < records.length) {
    const index = cursor++, r = records[index];
    const sourcePath = r.illustration.image_path, webPath = `${outputDir}/${r.id}.webp`;
    const raw = await readFile(sourcePath), sourceSha = hash(raw);
    let cached = previous[r.id];
    try { if (!cached || cached.sourceSha256 !== sourceSha || hash(await readFile(webPath)) !== cached.webSha256) cached = null; } catch { cached = null; }
    if (cached) images[index] = cached;
    else {
      const info = await sharp(raw).resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true }).webp({ quality: 90, effort: 6, smartSubsample: true }).toFile(webPath);
      images[index] = { id: r.id, sourcePath, sourceSha256: sourceSha, sourceBytes: raw.length, webPath, webSha256: hash(await readFile(webPath)), webBytes: info.size, width: info.width, height: info.height };
    }
    completed++;
    if (completed % 50 === 0 || completed === records.length) console.log(`Prepared ${completed}/${records.length} web images`);
  }
}
await Promise.all(Array.from({ length: 4 }, worker));
const result = { version: 1, transform: { format: 'webp', quality: 90, maxDimension: 1280, crop: false }, total: images.length, sourceBytes: images.reduce((n, i) => n + i.sourceBytes, 0), webBytes: images.reduce((n, i) => n + i.webBytes, 0), images };
await writeFile(`${outputDir}/manifest.json`, JSON.stringify(result, null, 2) + '\n');
console.log({ total: result.total, originalMiB: Math.round(result.sourceBytes / 1048576), webMiB: Math.round(result.webBytes / 1048576), reduction: Math.round((1 - result.webBytes / result.sourceBytes) * 100) + '%' });
