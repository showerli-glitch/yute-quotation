// Cache-busting stamp for ops/index.html. GitHub Pages serves files with a ~10 minute browser cache, so a new
// index.html could be paired with old scripts (seen on 2026-10-07: login stuck on 「載入中...」). Every local
// script, the mobile stylesheet and the manifest are referenced as `file?v=<hash>`; the hash covers all of ops/
// (index.html with the stamps removed, js, styles, manifest, sw.js), so any change gives every file a new URL.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const STAMP = /\?v=[0-9a-f]{8}/g;
const REF = /(src="js\/[^"?]+\.js|href="styles\/[^"?]+\.css|href="manifest\.webmanifest)(\?v=[0-9a-f]{8})?"/g;

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir).sort()) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) { if (name !== 'icons') walk(p, out); }
    else if (/\.(js|css|webmanifest)$/.test(name)) out.push(p);
  }
  return out;
}

export function opsContentHash(root) {
  const opsDir = path.join(root, 'ops');
  const h = crypto.createHash('sha256');
  h.update(fs.readFileSync(path.join(opsDir, 'index.html'), 'utf8').replace(STAMP, ''));
  for (const f of walk(opsDir)) h.update(path.relative(opsDir, f) + '\n').update(fs.readFileSync(f));
  return h.digest('hex').slice(0, 8);
}

export function stampHtml(html, hash) {
  return html.replace(REF, `$1?v=${hash}"`);
}

export function stripStamps(html) {
  return html.replace(STAMP, '');
}
