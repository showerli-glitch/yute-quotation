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

const inlineScripts = [...currentHtml.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
  .filter(match => !/\ssrc=/.test(match[0]));
for (const [index, match] of inlineScripts.entries()) {
  if (!match[1].trim()) continue;
  try { new vm.Script(match[1], { filename:`ops/index.html:inline-${index + 1}` }); }
  catch (error) { fail(`ops/index.html inline script 語法錯誤：${error.message}`); }
}

if (!process.exitCode) {
  console.log(`PASS: ${scripts.length} 個本機 script 語法正確；${compared} 個搬出函式與基準 tag 逐字一致。`);
}
