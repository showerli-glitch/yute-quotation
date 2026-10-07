// Verifies the quotation-system split: putting every moved file back in place of its tag must give exactly
// the pre-split index.html (main@655fd20), byte for byte; every script must parse; stamps must be current.
// Intentional changes made after the split are listed in POST_SPLIT_CHANGES and applied to the baseline first.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { quotationContentHash, stripQuotationStamps } from './quotation-version.mjs';

const root = process.cwd();
const BASELINE = '655fd20';
let failed = false;
const fail = msg => { console.error('FAIL: ' + msg); failed = true; };

// [file, the <script>/<link> tag in index.html, opening, closing]
const PARTS = [
  ['quotation/styles/quotation.css', '<link rel="stylesheet" href="quotation/styles/quotation.css">', '<style>', '</style>'],
  ['quotation/js/boot.js', '<script src="quotation/js/boot.js"></script>', '<script>', '</script>'],
  ['quotation/js/shell.js', '<script src="quotation/js/shell.js"></script>', '<script>', '</script>'],
];
const MAIN = ['quotation/js/defaultitems.js', 'quotation/js/items.js', 'quotation/js/quote.js', 'quotation/js/output.js', 'quotation/js/app.js'];
// Later intentional edits: { file: [[from, to], ...] } applied to the moved body before comparing.
const POST_SPLIT_CHANGES = {};

const body = file => {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  const cut = text.indexOf('\n\n');
  let b = text.slice(cut + 2).replace(/\n$/, '');
  for (const [from, to] of (POST_SPLIT_CHANGES[file] || [])) {
    if (!b.includes(to)) fail(`${file} 缺少記錄的拆檔後修改：${to.slice(0, 60)}`);
    b = b.replace(to, from);
  }
  return b;
};

const rawHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
let html = stripQuotationStamps(rawHtml);
for (const [file, tag, open, close] of PARTS) {
  if (html.split(tag).length !== 2) fail(`index.html 應恰好有一個 ${tag}`);
  html = html.replace(tag, () => `${open}\n${body(file)}\n${close}`);
}
const mainTags = MAIN.map(f => `<script src="${f}"></script>`).join('\n');
if (html.split(mainTags).length !== 2) fail('index.html 的主程式 script 標籤不完整或順序不對');
html = html.replace(mainTags, () => `<script>\n${MAIN.map(body).join('\n')}\n</script>`);

const baseline = execFileSync('git', ['show', `${BASELINE}:index.html`], { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
if (html !== baseline) {
  const a = html.split('\n'), b = baseline.split('\n');
  const i = a.findIndex((line, k) => line !== b[k]);
  fail(`組回去的 index.html 與 ${BASELINE} 不同（第 ${i + 1} 行）：\n  現在：${(a[i] || '').slice(0, 120)}\n  基準：${(b[i] || '').slice(0, 120)}`);
}

for (const file of [...MAIN, 'quotation/js/boot.js', 'quotation/js/shell.js']) {
  try { new vm.Script(fs.readFileSync(path.join(root, file), 'utf8'), { filename: file }); }
  catch (e) { fail(`${file} 語法錯誤：${e.message}`); }
}
const extra = fs.readdirSync(path.join(root, 'quotation/js')).filter(f => !MAIN.includes('quotation/js/' + f) && !['boot.js', 'shell.js'].includes(f));
for (const f of extra) {
  try { new vm.Script(fs.readFileSync(path.join(root, 'quotation/js', f), 'utf8'), { filename: f }); }
  catch (e) { fail(`quotation/js/${f} 語法錯誤：${e.message}`); }
}

const expected = quotationContentHash(root);
const refs = [...rawHtml.matchAll(/(?:src|href)="quotation[^"]*"/g)].map(m => m[0]);
if (!refs.length || refs.some(r => !r.includes('?v=' + expected))) fail(`index.html 的報價系統版本戳記不是最新（應為 ?v=${expected}）：請執行 node scripts/stamp-quotation-version.mjs`);

if (failed) process.exit(1);
console.log(`PASS: 報價系統 ${MAIN.length + 3} 個檔案組回去與 ${BASELINE} 的 index.html 逐字相同；${MAIN.length + 2 + extra.length} 個 script 語法正確；版本戳記 ?v=${expected}。` + (Object.keys(POST_SPLIT_CHANGES).length ? ` 拆檔後的刻意修改：${Object.keys(POST_SPLIT_CHANGES).join('、')}` : ''));
