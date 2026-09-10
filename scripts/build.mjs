import { cp, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const dist = new URL('../dist/', import.meta.url);
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(new URL('../index.html', import.meta.url), new URL('../dist/index.html', import.meta.url));
await cp(new URL('../src', import.meta.url), new URL('../dist/src', import.meta.url), { recursive: true });
if (existsSync(new URL('../public', import.meta.url))) {
  await cp(new URL('../public', import.meta.url), dist, { recursive: true });
}
console.log('Built static site into dist/');
