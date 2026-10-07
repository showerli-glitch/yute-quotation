// Run after every change under ops/ (the verifier fails if the stamp is stale):  node scripts/stamp-ops-version.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { opsContentHash, stampHtml } from './ops-version.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(root, 'ops/index.html');
const hash = opsContentHash(root);
const next = stampHtml(fs.readFileSync(file, 'utf8'), hash);
fs.writeFileSync(file, next);
console.log('ops/index.html stamped ?v=' + hash);
