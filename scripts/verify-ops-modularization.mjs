import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const currentHtml = fs.readFileSync(path.join(root, 'ops/index.html'), 'utf8');
const baselineHtml = execFileSync(
  'git',
  ['show', 'pre-refactor-baseline-20260922:ops/index.html'],
  { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }
);

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}

function sourceRange(source, startMarker, endMarker, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0 || end <= start) {
    fail(`基準檔找不到區塊：${label}`);
    return '';
  }
  return source.slice(start, end);
}

function withoutExact(source, snippet, label) {
  const count = source.split(snippet).length - 1;
  if (count !== 1) {
    fail(`${label} 在基準區塊預期出現 1 次，實際 ${count} 次`);
    return source;
  }
  return source.replace(snippet, '');
}

function verifyExactFile(relativePath, expected, label) {
  const actual = fs.readFileSync(path.join(root, relativePath), 'utf8').trimEnd();
  if (actual !== expected.trimEnd()) fail(`${label} 不是由基準 tag 逐字搬移`);
}

function extractFunctions(source) {
  const lines = source.split(/(?<=\n)/);
  const declaration = /^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/;
  const topLevel = /^(?:(?:async\s+)?function\s+[A-Za-z_$]|(?:const|let|var)\s+[A-Za-z_$])/;
  const found = [];
  for (let start = 0; start < lines.length; start += 1) {
    const match = lines[start].match(declaration);
    if (!match) continue;
    let boundary = lines.length;
    for (let i = start + 1; i < lines.length; i += 1) {
      if (topLevel.test(lines[i])) { boundary = i; break; }
    }
    let end = boundary - 1;
    while (end > start && !/^}\s*$/.test(lines[end].replace(/\n$/, ''))) end -= 1;
    if (end === start && !/}\s*$/.test(lines[start].replace(/\n$/, ''))) {
      fail(`無法辨識函式結尾：${match[1]}`);
      continue;
    }
    found.push({ name:match[1], source:lines.slice(start, end + 1).join('').replace(/\n$/, '') });
    start = end;
  }
  return found;
}

const baselineFunctions = new Map(extractFunctions(baselineHtml).map(item => [item.name, item.source]));
const scripts = [...currentHtml.matchAll(/<script\s+src="([^"]+\.js)"[^>]*><\/script>/g)]
  .map(match => match[1])
  .filter(src => !/^https?:/.test(src));
if (!scripts.length) fail('ops/index.html 沒有本機 JavaScript 載入項目');

let compared = 0;
for (const src of scripts) {
  const filePath = path.join(root, 'ops', src);
  if (!fs.existsSync(filePath)) {
    fail(`入口引用的檔案不存在：ops/${src}`);
    continue;
  }
  const code = fs.readFileSync(filePath, 'utf8');
  try { new vm.Script(code, { filename:filePath }); }
  catch (error) { fail(`${src} 語法錯誤：${error.message}`); }
  for (const item of extractFunctions(code)) {
    const original = baselineFunctions.get(item.name);
    if (!original) continue;
    compared += 1;
    if (item.source !== original) fail(`${src} 的 ${item.name} 並非逐字搬移`);
  }
}

const accountingPath = path.join(root, 'ops/js/core/accounting.js');
if (fs.existsSync(accountingPath)) {
  const accounting = fs.readFileSync(accountingPath, 'utf8');
  const paymentStart = baselineHtml.indexOf('const PROFIT_PAYMENT_TYPES = {');
  const paymentEnd = baselineHtml.indexOf('\nfunction psParticipantList() {', paymentStart);
  const paymentBlock = baselineHtml.slice(paymentStart, paymentEnd).trimEnd();
  if (!accounting.includes(paymentBlock)) fail('accounting.js 的付款分類常數／函式不是逐字搬移');
}

const dataScriptStart = '<script>\n// ══════════════════════════════════\n// DATA\n// ══════════════════════════════════\n// CLIENTS defined below in CLIENT DATA section\n\n';
const dataEndMarker = "\ndocument.addEventListener('DOMContentLoaded', () => {";
const originalDataScript = sourceRange(baselineHtml, dataScriptStart, dataEndMarker, '共用資料層');
const configStart = '// 多公司預留欄位（現階段僅宇德，畫面不顯示切換器）';
const configBlock = sourceRange(originalDataScript, configStart, '\nfunction tagCompany(arr) {', '設定常數').trimEnd();
let expectedDataBlock = originalDataScript.slice(originalDataScript.indexOf('function tagCompany(arr) {'));
const accountingRanges = [
  sourceRange(
    expectedDataBlock,
    'function isFamilyPassThroughCaseRecord(c) {',
    '\nfunction removeReplacedPassThroughReceivableAggregates() {',
    '親友轉付計算'
  ).trimEnd(),
  sourceRange(
    expectedDataBlock,
    'function receivableIsCollected(row) {',
    '\nconst SOURCE_OF_TRUTH_CASE_CODES',
    '應收認列計算'
  ).trimEnd(),
];
for (const snippet of accountingRanges) {
  expectedDataBlock = withoutExact(expectedDataBlock, snippet, '共用會計計算');
}
const paymentStart = baselineHtml.indexOf('const PROFIT_PAYMENT_TYPES = {');
const paymentEnd = baselineHtml.indexOf('\nfunction psParticipantList() {', paymentStart);
const paymentBlock = baselineHtml.slice(paymentStart, paymentEnd).trimEnd();
const uiRanges = [
  sourceRange(baselineHtml, 'function currentMonthKey() {', '\nfunction applyDefaultPeriodForPage(page) {', '日期工具').trimEnd(),
  sourceRange(baselineHtml, 'function caseOptionLabel(c) {', '\nfunction openPayreqForVendor(vendorCode) {', '案件選單元件').trimEnd(),
  sourceRange(baselineHtml, 'function openModal(id)', '\nfunction caseHasSiteLocation(c) {', '共用互動元件').trimEnd(),
  sourceRange(baselineHtml, 'function rowAuditUser() {', '\nfunction canViewPayableRow(p) {', '列資料與搜尋工具').trimEnd(),
  sourceRange(baselineHtml, 'function duplicateAmountWarning(', '\nfunction renderPayable() {', '重複提醒與排序工具').trimEnd(),
  sourceRange(baselineHtml, "function showToast(msg, type='') {", '\n</script>', 'Toast 元件').trimEnd(),
];

verifyExactFile(
  'ops/js/core/config.js',
  ['// OPS runtime configuration and cloud state. Extracted verbatim from ops/index.html.', configBlock].join('\n\n'),
  'config.js'
);
verifyExactFile(
  'ops/js/core/data.js',
  [
    '// OPS shared state, persistence, migrations, authentication, and Firebase access.',
    '// Business-calculation helpers are loaded separately from accounting.js.',
    expectedDataBlock.trim(),
  ].join('\n\n'),
  'data.js'
);
verifyExactFile(
  'ops/js/core/accounting.js',
  ['// Shared accounting predicates and calculations. Function bodies are moved verbatim.', ...accountingRanges, paymentBlock].join('\n\n'),
  'accounting.js'
);
verifyExactFile(
  'ops/js/core/ui.js',
  ['// Shared UI, filtering, row metadata, and rendering helpers. Moved verbatim.', 'let toastTimer;', ...uiRanges].join('\n\n'),
  'ui.js'
);
let expectedPayables = sourceRange(
  baselineHtml,
  '// ══════════════════════════════════\n// PAYABLE MODULE',
  '// ══════════════════════════════════\n// RECEIVABLE MODULE',
  '應付模組'
);
for (const sharedSnippet of [paymentBlock, ...uiRanges]) {
  if (expectedPayables.includes(sharedSnippet)) expectedPayables = expectedPayables.replace(sharedSnippet, '');
}
verifyExactFile('ops/js/modules/payables.js', expectedPayables.trim(), 'payables.js');
verifyExactFile(
  'ops/js/modules/receivables.js',
  sourceRange(
    baselineHtml,
    '// ══════════════════════════════════\n// RECEIVABLE MODULE',
    '// ══════════════════════════════════\n// HELPERS',
    '應收模組'
  ).trim(),
  'receivables.js'
);
verifyExactFile(
  'ops/js/modules/expenses.js',
  sourceRange(
    baselineHtml,
    '// ══════════════════════════════════\n// EXPENSE DATA',
    '// ══════════════════════════════════\n// OVERHEAD DATA',
    '費用模組'
  ).trim(),
  'expenses.js'
);

const inlineScripts = [...currentHtml.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
  .filter(match => !/\ssrc=/.test(match[0]));
for (const [index, match] of inlineScripts.entries()) {
  if (!match[1].trim()) continue;
  try { new vm.Script(match[1], { filename:`ops/index.html:inline-${index + 1}` }); }
  catch (error) { fail(`ops/index.html inline script 語法錯誤：${error.message}`); }
}

if (!process.exitCode) {
  console.log(`PASS: ${scripts.length} 個本機 script 語法正確；7 個搬出區塊與 ${compared} 個函式均和基準 tag 逐字一致。`);
}
