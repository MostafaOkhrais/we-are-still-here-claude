// Tells Bing, Yandex and other IndexNow search engines that the pages changed (Bing's index also feeds several AI assistants).
// Run it AFTER a deployment:  npm run seo:ping
// It sends the URLs of public/sitemap.xml and the key file published at https://wearestillhere.uk/<key>.txt.

import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const HOST = 'wearestillhere.uk';
const keyFile = readdirSync(resolve(root, 'public')).find((f) => /^[a-f0-9]{32}\.txt$/.test(f));
if (!keyFile) throw new Error('No IndexNow key file (32 hex characters + .txt) in public/');
const key = keyFile.replace('.txt', '');
const urls = [...readFileSync(resolve(root, 'public', 'sitemap.xml'), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key, keyLocation: 'https://' + HOST + '/' + keyFile, urlList: urls }),
});
console.log('IndexNow:', res.status, res.statusText, '(' + urls.length + ' URLs; 200 or 202 means accepted)');
