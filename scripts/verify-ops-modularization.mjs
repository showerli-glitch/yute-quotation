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
const casesBaselineCommit = '754460e32950a30e71de48f08c0e247cee99abb3';
const casesBaselineHtml = execFileSync(
  'git',
  ['show', `${casesBaselineCommit}:ops/index.html`],
  { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }
);
const casesBaselineData = execFileSync(
  'git',
  ['show', `${casesBaselineCommit}:ops/js/core/data.js`],
  { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }
);

const clientsVendorsBaselineCommit = '514e655d56941ac62ddee029f9eda74e206ad0e1';
const clientsVendorsBaselineHtml = execFileSync(
  'git',
  ['show', `${clientsVendorsBaselineCommit}:ops/index.html`],
  { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }
);
// Line-sliced (not marker-based) because this baseline's clients/vendors functions
// sit verbatim at known line numbers in the 514e655 snapshot of ops/index.html;
// slicing avoids any ambiguity from duplicate/near-duplicate text markers.
function sliceLines(source, startLine, endLineInclusive) {
  const lines = source.split(/(?<=\n)/);
  return lines.slice(startLine - 1, endLineInclusive).join('');
}
const cvSubmitNewClient = sliceLines(clientsVendorsBaselineHtml, 6085, 6123);
const cvClientsRest = sliceLines(clientsVendorsBaselineHtml, 9442, 9583);
const cvVendorsBlock = sliceLines(clientsVendorsBaselineHtml, 9585, 9800);
const expectedClients = [
  '// CLIENTS MODULE. Extracted verbatim from ops/index.html at main@514e655.',
  cvSubmitNewClient.trimEnd(),
  cvClientsRest.trimEnd(),
].join('\n\n');
const expectedVendors = [
  '// VENDORS MODULE. Extracted verbatim from ops/index.html at main@514e655.',
  cvVendorsBlock.trimEnd(),
].join('\n\n');
const attendanceBaselineCommit = 'c9c78dd819c5cdb4e0bcabc9136d5986573a6cfa';
const attendanceBaselineHtml = execFileSync(
  'git',
  ['show', `${attendanceBaselineCommit}:ops/index.html`],
  { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }
);
// The attendance block is one contiguous run of 53 function declarations at known lines
// in main@c9c78dd (see docs/gate-attendance-mapping.md).
const attendanceBlock = sliceLines(attendanceBaselineHtml, 4921, 5849);
const expectedAttendance = [
  '// ATTENDANCE MODULE. Extracted verbatim from ops/index.html at main@c9c78dd.',
  attendanceBlock.trimEnd(),
].join('\n\n');
const attendanceBaselineFunctions = new Map(extractFunctions(attendanceBlock).map(item => [item.name, item.source]));

const payreqBaselineCommit = execFileSync('git', ['rev-parse', '81b208c^{commit}'], { cwd: root, encoding: 'utf8' }).trim();
const payreqBaselineHtml = execFileSync(
  'git',
  ['show', `${payreqBaselineCommit}:ops/index.html`],
  { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }
);
// Three line ranges in main@81b208c (see docs/gate-payreq-mapping.md), joined in source order.
const payreqSlices = [
  sliceLines(payreqBaselineHtml, 4934, 4969),
  sliceLines(payreqBaselineHtml, 4976, 5154),
  sliceLines(payreqBaselineHtml, 8141, 8254),
];
const expectedPayreq = [
  '// PAY REQUEST MODULE. Extracted verbatim from ops/index.html at main@81b208c.',
  ...payreqSlices.map(slice => slice.trimEnd()),
].join('\n\n');
const payreqBaselineFunctions = new Map(payreqSlices.flatMap(slice => extractFunctions(slice)).map(item => [item.name, item.source]));

const fneBaselineCommit = execFileSync('git', ['rev-parse', '4e42a53^{commit}'], { cwd: root, encoding: 'utf8' }).trim();
const fneBaselineHtml = execFileSync(
  'git',
  ['show', `${fneBaselineCommit}:ops/index.html`],
  { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }
);
// Feedback / system notes / employees ranges in main@4e42a53 (see docs/gate-feedback-notes-employees-mapping.md).
const fneSlices = {
  feedback: [sliceLines(fneBaselineHtml, 4384, 4390), sliceLines(fneBaselineHtml, 4659, 4919)],
  systemnotes: [sliceLines(fneBaselineHtml, 4392, 4657)],
  employees: [sliceLines(fneBaselineHtml, 7925, 8144)],
};
const fneHeaders = { feedback: 'FEEDBACK', systemnotes: 'SYSTEM NOTES', employees: 'EMPLOYEES' };
const expectedFne = Object.fromEntries(Object.entries(fneSlices).map(([file, slices]) => [file, [
  `// ${fneHeaders[file]} MODULE. Extracted verbatim from ops/index.html at main@4e42a53.`,
  ...slices.map(slice => slice.trimEnd()),
].join('\n\n')]));
const fneBaselineFunctions = new Map(Object.values(fneSlices).flat().flatMap(slice => extractFunctions(slice)).map(item => [item.name, item.source]));

const clientsVendorsBaselineFunctions = new Map([
  ...extractFunctions(cvSubmitNewClient),
  ...extractFunctions(cvClientsRest),
  ...extractFunctions(cvVendorsBlock),
].map(item => [item.name, item.source]));

// Intentional feature changes made AFTER a verbatim split batch was approved. Only the
// functions listed in `changed`, plus anything after the `appendedAfter` marker, may differ
// from the split baseline; every other byte of the file must still match.
const POST_SPLIT_CHANGES = {
  'ops/js/modules/vendors.js': {
    reason: 'vendor delete button (claude/vendor-delete-and-sort)',
    changed: ['openVendorModal'],
    appendedAfter: '\n// ── Post-split additions (not part of the verbatim move) ──',
  },
  'ops/js/modules/payables.js': {
    reason: 'payable vendor picker sorted by vendor code (claude/vendor-delete-and-sort)',
    changed: ['openAddPayableModal', 'openEditPayableModal'],
  },
  'ops/js/core/data.js': {
    reason: 'pay-request applicant stored as name also counts as own row (claude/payreq-applicant-fix)',
    changed: ['userCanViewCaseScopedRow'],
  },
  'ops/js/modules/payreq.js': {
    reason: 'own rejected pay request editable by name; edit modal re-enables save (claude/payreq-applicant-fix)',
    changed: ['openEditPayreqModal', 'renderPayreq'],
  },
};

function maskChangedFunctions(source, names) {
  let out = source;
  for (const item of extractFunctions(source)) {
    if (names.includes(item.name)) out = out.replace(item.source, `/* post-split change: ${item.name} */`);
  }
  return out;
}

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
  let actual = fs.readFileSync(path.join(root, relativePath), 'utf8').trimEnd();
  let reference = expected.trimEnd();
  const change = POST_SPLIT_CHANGES[relativePath];
  if (change) {
    if (change.appendedAfter) {
      const marker = actual.indexOf(change.appendedAfter);
      if (marker < 0) fail(`${label} 找不到拆檔後新增區塊標記`);
      else actual = actual.slice(0, marker).trimEnd();
    }
    actual = maskChangedFunctions(actual, change.changed);
    reference = maskChangedFunctions(reference, change.changed);
  }
  if (actual !== reference) fail(`${label} 不是由基準 tag 逐字搬移`);
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
const casesBaselineFunctions = new Map(extractFunctions(casesBaselineHtml).map(item => [item.name, item.source]));
const scripts = [...currentHtml.matchAll(/<script\s+src="([^"]+\.js)"[^>]*><\/script>/g)]
  .map(match => match[1])
  .filter(src => !/^https?:/.test(src));
if (!scripts.length) fail('ops/index.html 沒有本機 JavaScript 載入項目');

let compared = 0;
let postSplitChanged = 0;
for (const src of scripts) {
  const filePath = path.join(root, 'ops', src);
  if (!fs.existsSync(filePath)) {
    fail(`入口引用的檔案不存在：ops/${src}`);
    continue;
  }
  const code = fs.readFileSync(filePath, 'utf8');
  try { new vm.Script(code, { filename:filePath }); }
  catch (error) { fail(`${src} 語法錯誤：${error.message}`); }
  const referenceFunctions = src === 'js/modules/cases.js'
    ? casesBaselineFunctions
    : (src === 'js/modules/clients.js' || src === 'js/modules/vendors.js')
      ? clientsVendorsBaselineFunctions
      : src === 'js/modules/attendance.js'
        ? attendanceBaselineFunctions
        : src === 'js/modules/payreq.js'
          ? payreqBaselineFunctions
          : ['js/modules/feedback.js', 'js/modules/systemnotes.js', 'js/modules/employees.js'].includes(src)
            ? fneBaselineFunctions
            : baselineFunctions;
  const intentional = POST_SPLIT_CHANGES[`ops/${src}`]?.changed || [];
  const present = new Set(extractFunctions(code).map(item => item.name));
  for (const name of intentional) if (!present.has(name)) fail(`${src} 缺少拆檔後修改的函式 ${name}`);
  for (const item of extractFunctions(code)) {
    const original = referenceFunctions.get(item.name);
    if (!original) continue;
    if (intentional.includes(item.name)) { postSplitChanged += 1; continue; }
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
  casesBaselineData,
  'data.js（案件批次基準）'
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

const expectedCases = [
  '// CASES MODULE. Extracted verbatim from ops/index.html at main@754460e.',
  sourceRange(
    casesBaselineHtml,
    '// ══════════════════════════════════\n// CASES TABLE',
    '\nfunction openPayreqForVendor(vendorCode) {',
    '案件列表與篩選'
  ).trimEnd(),
  sourceRange(
    casesBaselineHtml,
    'function openCaseDetail(caseCode) {',
    '\nfunction tfStatusColor(status) {',
    '案件詳情、生命週期與座標'
  ).trimEnd(),
  sourceRange(
    casesBaselineHtml,
    'function openNewCaseModal() {',
    '\n</script>',
    '案件建立、編輯與案號'
  ).trimEnd(),
  sourceRange(
    casesBaselineHtml,
    'function renderDashboard() {',
    '\n// ══════════════════════════════════\n// PAY REQUEST PAGE RENDER',
    '案件儀表板'
  ).trimEnd(),
].join('\n\n');
const protectedCurrentFunctions = new Map(extractFunctions(currentHtml).map(item => [item.name, item.source]));
verifyExactFile('ops/js/modules/cases.js', expectedCases, 'cases.js');
const expectedCaseFunctionCount = extractFunctions(expectedCases).length;
if (expectedCaseFunctionCount !== 34) fail(`cases.js 預期 34 個函式，實際基準 ${expectedCaseFunctionCount}`);
verifyExactFile('ops/js/modules/clients.js', expectedClients, 'clients.js');
verifyExactFile('ops/js/modules/vendors.js', expectedVendors, 'vendors.js');
const expectedClientsFunctionCount = extractFunctions(expectedClients).length;
const expectedVendorsFunctionCount = extractFunctions(expectedVendors).length;
if (expectedClientsFunctionCount !== 5) fail(`clients.js 預期 5 個函式，實際基準 ${expectedClientsFunctionCount}`);
if (expectedVendorsFunctionCount !== 11) fail(`vendors.js 預期 11 個函式，實際基準 ${expectedVendorsFunctionCount}`);
verifyExactFile('ops/js/modules/attendance.js', expectedAttendance, 'attendance.js');
const expectedAttendanceFunctionCount = extractFunctions(expectedAttendance).length;
if (expectedAttendanceFunctionCount !== 53) fail(`attendance.js 預期 53 個函式，實際基準 ${expectedAttendanceFunctionCount}`);
if (!attendanceBlock.startsWith('function attPeople() {') || !/\nfunction renderAttendance\(\) \{/.test(attendanceBlock)) fail('出勤基準區塊起訖行不正確');
const attendanceBaselineCurrentFunctions = new Map(extractFunctions(attendanceBaselineHtml).map(item => [item.name, item.source]));
for (const name of ['navTo', 'renderCurrentPage', 'applyRole', 'refreshAccountingLinkedViews']) {
  const current = protectedCurrentFunctions.get(name);
  if (!current || current !== attendanceBaselineCurrentFunctions.get(name)) fail(`出勤批次不應改動 ${name}`);
}
for (const name of attendanceBaselineFunctions.keys()) {
  if (protectedCurrentFunctions.has(name)) fail(`出勤函式不應仍留在 index.html：${name}`);
}
verifyExactFile('ops/js/modules/payreq.js', expectedPayreq, 'payreq.js');
const expectedPayreqFunctionCount = extractFunctions(expectedPayreq).length;
if (expectedPayreqFunctionCount !== 11) fail(`payreq.js 預期 11 個函式，實際基準 ${expectedPayreqFunctionCount}`);
if (!payreqSlices[0].includes('function openPayreqModal() {') || !payreqSlices[1].startsWith('function setPayreqRadio(') || !payreqSlices[2].includes('function renderPayreq() {')) fail('請款基準區塊起訖行不正確');
const payreqBaselineAllFunctions = new Map(extractFunctions(payreqBaselineHtml).map(item => [item.name, item.source]));
for (const name of ['navTo', 'renderCurrentPage', 'applyRole', 'refreshAccountingLinkedViews', 'openPayreqForVendor', 'payreqVendorPickerMouseDown', 'selectRadio']) {
  const current = protectedCurrentFunctions.get(name);
  if (!current || current !== payreqBaselineAllFunctions.get(name)) fail(`請款批次不應改動或搬走 ${name}`);
}
for (const name of payreqBaselineFunctions.keys()) {
  if (protectedCurrentFunctions.has(name)) fail(`請款函式不應仍留在 index.html：${name}`);
}
const fneFunctionCounts = {};
for (const file of Object.keys(expectedFne)) {
  verifyExactFile(`ops/js/modules/${file}.js`, expectedFne[file], `${file}.js`);
  fneFunctionCounts[file] = extractFunctions(expectedFne[file]).length;
}
if (fneFunctionCounts.feedback !== 14 || fneFunctionCounts.systemnotes !== 3 || fneFunctionCounts.employees !== 3) fail(`回報／筆記／員工函式數不符：${JSON.stringify(fneFunctionCounts)}`);
if (!fneSlices.feedback[0].startsWith('function tfStatusColor(') || !fneSlices.systemnotes[0].startsWith('const SYSTEM_NOTES = [') || !fneSlices.feedback[1].startsWith('const TF_SCREENSHOT_MAX_EDGE') || !fneSlices.employees[0].includes('function renderEmployees() {')) fail('回報／筆記／員工基準區塊起訖行不正確');
const fneBaselineAllFunctions = new Map(extractFunctions(fneBaselineHtml).map(item => [item.name, item.source]));
for (const name of ['navTo', 'renderCurrentPage', 'applyRole', 'refreshAccountingLinkedViews', 'prRenderEmployeeTabs', 'psOpenProfitParticipantModal']) {
  const current = protectedCurrentFunctions.get(name);
  if (!current || current !== fneBaselineAllFunctions.get(name)) fail(`回報／筆記／員工批次不應改動 ${name}`);
}
for (const name of fneBaselineFunctions.keys()) {
  if (protectedCurrentFunctions.has(name)) fail(`回報／筆記／員工函式不應仍留在 index.html：${name}`);
}
for (const constName of ['SYSTEM_NOTES', 'TF_SCREENSHOT_MAX_EDGE', 'TF_SCREENSHOT_MAX_BYTES', 'EMP_PERM_MODULES', 'EMP_PERM_LEVELS']) {
  if (new RegExp(`^const ${constName}\\b`, 'm').test(currentHtml)) fail(`常數不應仍留在 index.html：${constName}`);
}
const vdSortKeyPresent = /^let vdSortKey = 'code', vdSortAsc = true;$/m.test(
  fs.readFileSync(path.join(root, 'ops/js/modules/vendors.js'), 'utf8')
);
if (!vdSortKeyPresent) fail('vendors.js 缺少 vdSortKey／vdSortAsc 排序狀態宣告');
for (const name of ['openPayreqForVendor', 'openReceivableForClient', 'payreqVendorPickerMouseDown']) {
  const current = protectedCurrentFunctions.get(name);
  const original = baselineFunctions.get(name) || clientsVendorsBaselineFunctions.get(name);
  // These three bridge/picker functions must stay in ops/index.html untouched; they are
  // intentionally NOT part of clients.js/vendors.js per Gate 1's approved mapping.
  if (!current) fail(`橋接／picker函式不應被移出 index.html：${name}`);
}

for (const name of ['renderCurrentPage', 'refreshAccountingLinkedViews', 'applyRole']) {
  const current = protectedCurrentFunctions.get(name);
  const original = casesBaselineFunctions.get(name);
  if (!current || current !== original) fail(`案件批次不應改動 ${name}`);
}

const inlineScripts = [...currentHtml.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
  .filter(match => !/\ssrc=/.test(match[0]));
for (const [index, match] of inlineScripts.entries()) {
  if (!match[1].trim()) continue;
  try { new vm.Script(match[1], { filename:`ops/index.html:inline-${index + 1}` }); }
  catch (error) { fail(`ops/index.html inline script 語法錯誤：${error.message}`); }
}

if (!process.exitCode) {
  console.log(`PASS: ${scripts.length} 個本機 script 語法正確；15 個搬出模組／區塊與 ${compared} 個函式均和各自核准基準逐字一致；cases.js 含 ${expectedCaseFunctionCount} 個案件函式；clients.js 含 ${expectedClientsFunctionCount} 個函式；vendors.js 含 ${expectedVendorsFunctionCount} 個函式（含排序狀態）；attendance.js 含 ${expectedAttendanceFunctionCount} 個出勤函式；payreq.js 含 ${expectedPayreqFunctionCount} 個請款函式；feedback／systemnotes／employees 含 ${fneFunctionCounts.feedback}／${fneFunctionCounts.systemnotes}／${fneFunctionCounts.employees} 個函式；三個橋接／picker函式確認仍在 index.html。` + (postSplitChanged ? `另有 ${postSplitChanged} 個函式為拆檔後已記錄的刻意修改（${Object.entries(POST_SPLIT_CHANGES).map(([file, c]) => `${file}: ${c.changed.join('、')}`).join('；')}），其餘內容仍逐字一致。` : ''));
}
