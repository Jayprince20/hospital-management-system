/**
 * Copies the WebAssembly decoders of the DICOM image loader (JPEG baseline/lossless, JPEG-LS,
 * JPEG 2000, HTJ2K, JPEG XL) to public/dicom-codecs so the browser loads them from our own origin
 * (the viewer sets wasmBasePath to /dicom-codecs). Runs after npm install and before builds.
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, 'public', 'dicom-codecs');
const codecs = [
  'codec-charls/dist/charlswasm_decode.wasm',
  'codec-libjxl/dist/jpegxlwasm_decode.wasm',
  'codec-libjpeg-turbo-8bit/dist/libjpegturbowasm_decode.wasm',
  'codec-openjpeg/dist/openjpegwasm_decode.wasm',
  'codec-openjph/dist/openjphjs.wasm',
];

mkdirSync(target, { recursive: true });
let copied = 0;
for (const rel of codecs) {
  const source = join(root, 'node_modules', '@cornerstonejs', rel);
  if (!existsSync(source)) {
    console.warn(`[dicom-codecs] missing ${rel} (is @cornerstonejs/dicom-image-loader installed?)`);
    continue;
  }
  copyFileSync(source, join(target, rel.split('/').pop()));
  copied += 1;
}
console.log(`[dicom-codecs] ${copied}/${codecs.length} decoders in public/dicom-codecs`);
