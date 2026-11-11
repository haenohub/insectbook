import { defineConfig } from 'vite';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  publicDir: 'public',
  server: { host: '0.0.0.0', port: 5173, allowedHosts: true },
  plugins: [{
    name: 'saved-insect-illustrations',
    async closeBundle() {
      const catalog = JSON.parse(await readFile('data/web-catalog.json', 'utf8'));
      await mkdir('dist/assets/illustrations', { recursive: true });
      await mkdir('dist/data/insects', { recursive: true });
      if (process.env.VITE_BASE_PATH && catalog.insects.some(i => !i.image.startsWith('/assets/web-illustrations/'))) throw new Error('Pages requires a WebP copy for every illustration. Run npm run prepare:images first.');
      // Copy the selected web assets verbatim; full-resolution PNGs remain in the cloud archive.
      for (const insect of catalog.insects) {
        await mkdir(dirname(resolve('dist' + insect.image)), { recursive: true });
        await copyFile(resolve('.' + insect.image), resolve('dist' + insect.image));
        await copyFile(`data/insects/${insect.id}.json`, `dist/data/insects/${insect.id}.json`);
      }
      await writeFile('dist/.nojekyll', '');
    },
  }],
});
