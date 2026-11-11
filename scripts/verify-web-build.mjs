import { readFile, stat, writeFile, mkdir } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
const catalog = JSON.parse(await readFile('data/web-catalog.json', 'utf8'));
async function sha(path) { const h = createHash('sha256'); for await (const chunk of createReadStream(path)) h.update(chunk); return h.digest('hex'); }
let checked = 0;
for (const i of catalog.insects) {
  const a = '.' + i.image, b = 'dist' + i.image;
  if ((await stat(a)).size !== (await stat(b)).size || await sha(a) !== await sha(b)) throw new Error(`Image mismatch: ${i.id}`);
  const original = await readFile(`data/insects/${i.id}.json`);
  const built = await readFile(`dist/data/insects/${i.id}.json`);
  if (!original.equals(built)) throw new Error(`Source mismatch: ${i.id}`);
  checked++;
}
const result = { checkedAt: new Date().toISOString(), illustrations: checked, sourceRecords: checked, sha256Matched: checked, titles: Object.keys(catalog.titleCounts).length, imageGeneration: JSON.parse(await readFile('data/illustration-run.json', 'utf8')).status, deploymentPerformedByThisCheck: false };
await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/build-verification.json', JSON.stringify(result, null, 2) + '\n');
console.log(result);
