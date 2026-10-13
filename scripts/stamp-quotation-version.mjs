// Run after every change to index.html or quotation/ (the quotation verifier fails if the stamp is stale):
//   node scripts/stamp-quotation-version.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { quotationContentHash, stampQuotationHtml } from './quotation-version.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(root, 'index.html');
const hash = quotationContentHash(root);
fs.writeFileSync(file, stampQuotationHtml(fs.readFileSync(file, 'utf8'), hash));
console.log('index.html stamped ?v=' + hash);
