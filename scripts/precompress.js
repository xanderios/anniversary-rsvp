// After the build: write .br and .gz copies of the 3D models so the server can send them compressed.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'assets');
for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.glb'))) {
  const buf = fs.readFileSync(path.join(dir, f));
  const br = zlib.brotliCompressSync(buf, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: buf.length } });
  const gz = zlib.gzipSync(buf, { level: 9 });
  fs.writeFileSync(path.join(dir, f + '.br'), br);
  fs.writeFileSync(path.join(dir, f + '.gz'), gz);
  console.log(`${f}: ${(buf.length / 1e6).toFixed(2)} MB -> br ${(br.length / 1e6).toFixed(2)} MB, gz ${(gz.length / 1e6).toFixed(2)} MB`);
}
