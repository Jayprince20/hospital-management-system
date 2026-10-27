// Generates the PWA icons from public/icons/*.svg (run: node scripts/generate-icons.mjs)
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
const jobs = [
  ['icon.svg', 'icon-192.png', 192],
  ['icon.svg', 'icon-512.png', 512],
  ['icon-maskable.svg', 'icon-maskable-512.png', 512],
];
for (const [src, out, size] of jobs) {
  await sharp(path.join(dir, src)).resize(size, size).png().toFile(path.join(dir, out));
  console.log('wrote', out);
}
