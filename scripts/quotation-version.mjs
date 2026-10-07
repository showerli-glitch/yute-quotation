// Cache-busting stamp for the quotation system (root index.html + quotation/). Same idea as ops-version.mjs:
// every local script and stylesheet is referenced as `file?v=<hash>`, the hash covering index.html (stamps
// removed) and everything under quotation/, so a deploy never pairs a new page with cached old files.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const STAMP = /\?v=[0-9a-f]{8}/g;
const REF = /((?:src|href)="quotation\/[^"?]+\.(?:js|css|webmanifest|png)|href="quotation\.webmanifest)(\?v=[0-9a-f]{8})?"/g;

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir).sort()) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (/\.(js|css|webmanifest)$/.test(name)) out.push(p);
  }
  return out;
}

export function quotationContentHash(root) {
  const h = crypto.createHash('sha256');
  h.update(fs.readFileSync(path.join(root, 'index.html'), 'utf8').replace(STAMP, ''));
  for (const f of walk(path.join(root, 'quotation'))) h.update(path.relative(root, f) + '\n').update(fs.readFileSync(f));
  for (const f of ['quotation-sw.js', 'quotation.webmanifest']) if (fs.existsSync(path.join(root, f))) h.update(f + '\n').update(fs.readFileSync(path.join(root, f)));
  return h.digest('hex').slice(0, 8);
}

export function stampQuotationHtml(html, hash) {
  return html.replace(REF, `$1?v=${hash}"`);
}

export function stripQuotationStamps(html) {
  return html.replace(/((?:src|href)="quotation[^"?]*)\?v=[0-9a-f]{8}"/g, '$1"');
}
