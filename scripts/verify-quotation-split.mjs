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
const POST_SPLIT_CHANGES = {
  'quotation/js/app.js': [['const SESSION_HOURS = 4;', 'const SESSION_HOURS = 8;']],
  'quotation/js/boot.js': [['if(Date.now()-d.loginTime>4*3600*1000)return;', 'if(Date.now()-d.loginTime>8*3600*1000)return;']],
};
// Intentional edits to the page itself (PWA tags, the new pwa.js), undone before comparing: [original, now].
const HTML_CHANGES = [
  ['<link rel="apple-touch-icon" href="https://showerli-glitch.github.io/yute-quotation/favicon.png?v=202606222000">',
   '<link rel="manifest" href="quotation.webmanifest">\n<meta name="theme-color" content="#123D33">\n<meta name="mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-title" content="宇德報價">\n<meta name="apple-mobile-web-app-status-bar-style" content="default">\n<link rel="apple-touch-icon" href="quotation/icons/apple-touch-icon.png">'],
  ['<script src="quotation/js/app.js"></script>\n', '<script src="quotation/js/app.js"></script>\n<script src="quotation/js/pwa.js"></script>\n<script src="quotation/js/mobile.js"></script>\n'],
  ['<link rel="stylesheet" href="quotation/styles/quotation.css">\n', '<link rel="stylesheet" href="quotation/styles/quotation.css">\n<link rel="stylesheet" href="quotation/styles/mobile.css">\n'],
];

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
let html = stripQuotationStamps(rawHtml).replace(/href="quotation\.webmanifest\?v=[0-9a-f]{8}"/, 'href="quotation.webmanifest"');
for (const [from, to] of HTML_CHANGES) {
  if (html.split(to).length !== 2) fail(`index.html 缺少記錄的修改：${to.slice(0, 70)}`);
  html = html.replace(to, () => from);
}
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
for (const f of ['quotation-sw.js']) if (fs.existsSync(path.join(root, f))) { try { new vm.Script(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f }); } catch (e) { fail(`${f} 語法錯誤：${e.message}`); } }
for (const f of extra) {
  try { new vm.Script(fs.readFileSync(path.join(root, 'quotation/js', f), 'utf8'), { filename: f }); }
  catch (e) { fail(`quotation/js/${f} 語法錯誤：${e.message}`); }
}

const expected = quotationContentHash(root);
const refs = [...rawHtml.matchAll(/(?:src|href)="quotation[^"]*"/g)].map(m => m[0]);
if (!refs.length || refs.some(r => !r.includes('?v=' + expected))) fail(`index.html 的報價系統版本戳記不是最新（應為 ?v=${expected}）：請執行 node scripts/stamp-quotation-version.mjs`);

if (failed) process.exit(1);
console.log(`PASS: 報價系統 ${MAIN.length + 3} 個檔案組回去與 ${BASELINE} 的 index.html 逐字相同；${MAIN.length + 2 + extra.length} 個 script 語法正確；版本戳記 ?v=${expected}。` + (Object.keys(POST_SPLIT_CHANGES).length ? ` 拆檔後的刻意修改：${Object.keys(POST_SPLIT_CHANGES).join('、')}、index.html（${HTML_CHANGES.length} 處）` : ''));
