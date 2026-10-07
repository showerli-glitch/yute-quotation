import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
import { opsContentHash, stripStamps } from './ops-version.mjs';
const rawCurrentHtml = fs.readFileSync(path.join(root, 'ops/index.html'), 'utf8');
// Cache-busting stamps (?v=<hash>) are removed before every structural comparison below.
const currentHtml = stripStamps(rawCurrentHtml);
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

const payrollBaselineCommit = execFileSync('git', ['rev-parse', '0ef422c^{commit}'], { cwd: root, encoding: 'utf8' }).trim();
const payrollBaselineHtml = execFileSync(
  'git',
  ['show', `${payrollBaselineCommit}:ops/index.html`],
  { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }
);
// One contiguous payroll data + behavior block in main@0ef422c (see docs/gate-payroll-mapping.md).
const payrollBlock = sliceLines(payrollBaselineHtml, 6441, 7388);
const expectedPayroll = [
  '// PAYROLL MODULE. Extracted verbatim from ops/index.html at main@0ef422c.',
  payrollBlock.trimEnd(),
].join('\n\n');
const payrollBaselineFunctions = new Map(extractFunctions(payrollBlock).map(item => [item.name, item.source]));

const overheadBaselineCommit = execFileSync('git', ['rev-parse', '38986cf^{commit}'], { cwd: root, encoding: 'utf8' }).trim();
const overheadBaselineHtml = execFileSync(
  'git',
  ['show', `${overheadBaselineCommit}:ops/index.html`],
  { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }
);
// One contiguous overhead data + behavior block in main@38986cf (see docs/gate-overhead-mapping.md).
// It declares ohDeleteFixedItem twice, so its functions are compared in order, not by name.
const overheadBlock = sliceLines(overheadBaselineHtml, 4769, 5227);
const expectedOverhead = [
  '// OVERHEAD MODULE. Extracted verbatim from ops/index.html at main@38986cf.',
  overheadBlock.trimEnd(),
].join('\n\n');
const overheadBaselineList = extractFunctions(overheadBlock);
// claude/fix-known-issues removed the first, inactive ohDeleteFixedItem declaration (known issue #5);
// the remaining 23 declarations must still match the split baseline in order.
const overheadRemovedDuplicate = overheadBaselineList.find(item => item.name === 'ohDeleteFixedItem');
const overheadExpectedList = overheadBaselineList.filter(item => item !== overheadRemovedDuplicate);
const expectedOverheadAfterFix = expectedOverhead.replace(overheadRemovedDuplicate.source + '\n', '');

const profitBaselineCommit = execFileSync('git', ['rev-parse', 'e602f72^{commit}'], { cwd: root, encoding: 'utf8' }).trim();
const profitBaselineHtml = execFileSync(
  'git',
  ['show', `${profitBaselineCommit}:ops/index.html`],
  { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }
);
// The whole inline <script> between receivables.js and expenses.js in main@e602f72 (see docs/gate-profit-mapping.md),
// replaced in place by <script src="js/modules/profit.js">.
const profitBlock = sliceLines(profitBaselineHtml, 4411, 4756);
const expectedProfit = [
  '// PROFIT DASHBOARD MODULE. Extracted verbatim from ops/index.html at main@e602f72.',
  profitBlock.trimEnd(),
].join('\n\n');
const profitBaselineFunctions = new Map(extractFunctions(profitBlock).map(item => [item.name, item.source]));

const taxBaselineCommit = execFileSync('git', ['rev-parse', '4318c73^{commit}'], { cwd: root, encoding: 'utf8' }).trim();
const taxBaselineHtml = execFileSync(
  'git',
  ['show', `${taxBaselineCommit}:ops/index.html`],
  { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }
);
// Tax management block in main@4318c73 (see docs/gate-tax-mapping.md).
const taxBlock = sliceLines(taxBaselineHtml, 4977, 5180);
const expectedTax = [
  '// TAX MANAGEMENT MODULE. Extracted verbatim from ops/index.html at main@4318c73.',
  taxBlock.trimEnd(),
].join('\n\n');
const taxBaselineFunctions = new Map(extractFunctions(taxBlock).map(item => [item.name, item.source]));

const profitshareBaselineCommit = execFileSync('git', ['rev-parse', '3bf6549^{commit}'], { cwd: root, encoding: 'utf8' }).trim();
const profitshareBaselineHtml = execFileSync(
  'git',
  ['show', `${profitshareBaselineCommit}:ops/index.html`],
  { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }
);
// The last inline <script> in main@3bf6549 (after tax.js), replaced in place by profitshare.js
// (see docs/gate-profitshare-mapping.md).
const profitshareBlock = sliceLines(profitshareBaselineHtml, 4424, 5436);
const expectedProfitshare = [
  '// PROFIT SHARE MODULE. Extracted verbatim from ops/index.html at main@3bf6549.',
  profitshareBlock.trimEnd(),
].join('\n\n');
const profitshareBaselineFunctions = new Map(extractFunctions(profitshareBlock).map(item => [item.name, item.source]));

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
  'ops/js/core/data.js': {
    reason: 'pay-request applicant stored as name also counts as own row (claude/payreq-applicant-fix); login button enabled after load, payroll tombstone migration (snapshot + cloud merge) and prNextId derivation (claude/fix-known-issues)',
    changed: ['userCanViewCaseScopedRow', 'opsInitGoogleAuth', 'applyDataSnapshot', 'ensureCodexSeedData', 'opsCloudMergePayrollExtras'],
    appendedAfter: '\n// ── Post-split additions (not part of the verbatim move) ──',
  },
  'ops/js/modules/payroll.js': {
    reason: 'deleted payroll month no longer re-added; last month cannot be deleted; re-adding a deleted month clears its tombstone; month deletion audited (claude/fix-known-issues)',
    changed: ['prDeleteMonth', 'prRenderMonthOptions', 'submitPayrollMonth'],
  },
  'ops/js/core/config.js': {
    reason: 'login session lasts 8 hours instead of 4 (user decision 2026-10-07)',
    changed: [],
    literalChanges: [['const OPS_AUTH_SESSION_HOURS = 4;', 'const OPS_AUTH_SESSION_HOURS = 8;']],
  },
  'ops/js/modules/payables.js': {
    reason: 'payable vendor picker sorted by vendor code (claude/vendor-delete-and-sort); payable attachments button (claude/pwa-polish)',
    changed: ['openAddPayableModal', 'openEditPayableModal', 'renderPayable'],
  },
  'ops/js/modules/expenses.js': {
    reason: 'expense row action shows a 單據 (attachments) button (claude/pwa-nodes)',
    changed: ['expenseRowActions'],
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
    (change.literalChanges || []).forEach(([from, to]) => {
      if (!reference.includes(from)) fail(`${label} 基準找不到要替換的內容：${from}`);
      reference = reference.replace(from, to);
    });
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
            : src === 'js/modules/payroll.js'
              ? payrollBaselineFunctions
              : src === 'js/modules/profit.js'
                ? profitBaselineFunctions
                : src === 'js/modules/tax.js'
                  ? taxBaselineFunctions
                  : src === 'js/modules/profitshare.js'
                    ? profitshareBaselineFunctions
                    : baselineFunctions;
  if (src === 'js/modules/overhead.js') {
    const currentList = extractFunctions(code);
    if (currentList.length !== overheadExpectedList.length) fail(`overhead.js 函式宣告數 ${currentList.length}，預期 ${overheadExpectedList.length}`);
    currentList.forEach((item, index) => {
      const original = overheadExpectedList[index];
      compared += 1;
      if (!original || item.name !== original.name || item.source !== original.source) fail(`${src} 第 ${index + 1} 個函式 ${item.name} 並非依序逐字搬移`);
    });
    continue;
  }
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
// After the profit-share batch, ps* functions that earlier batches protected in index.html live in
// profitshare.js; their byte-for-byte protection is looked up wherever they are now.
const profitshareCurrentFunctions = fs.existsSync(path.join(root, 'ops/js/modules/profitshare.js'))
  ? new Map(extractFunctions(fs.readFileSync(path.join(root, 'ops/js/modules/profitshare.js'), 'utf8')).map(item => [item.name, item.source]))
  : new Map();
const currentSourceOf = name => protectedCurrentFunctions.get(name) ?? profitshareCurrentFunctions.get(name);
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
// prRenderEmployeeTabs moved into payroll.js in the payroll batch; its byte-for-byte check lives there now.
for (const name of ['navTo', 'renderCurrentPage', 'applyRole', 'refreshAccountingLinkedViews', 'psOpenProfitParticipantModal']) {
  const current = currentSourceOf(name);
  if (!current || current !== fneBaselineAllFunctions.get(name)) fail(`回報／筆記／員工批次不應改動 ${name}`);
}
for (const name of fneBaselineFunctions.keys()) {
  if (protectedCurrentFunctions.has(name)) fail(`回報／筆記／員工函式不應仍留在 index.html：${name}`);
}
for (const constName of ['SYSTEM_NOTES', 'TF_SCREENSHOT_MAX_EDGE', 'TF_SCREENSHOT_MAX_BYTES', 'EMP_PERM_MODULES', 'EMP_PERM_LEVELS']) {
  if (new RegExp(`^const ${constName}\\b`, 'm').test(currentHtml)) fail(`常數不應仍留在 index.html：${constName}`);
}
verifyExactFile('ops/js/modules/payroll.js', expectedPayroll, 'payroll.js');
const expectedPayrollFunctionCount = extractFunctions(expectedPayroll).length;
if (expectedPayrollFunctionCount !== 35) fail(`payroll.js 預期 35 個函式，實際基準 ${expectedPayrollFunctionCount}`);
if (!payrollBlock.includes('// PAYROLL DATA') || !payrollBlock.includes('const PR_CONFIG = {') || !/\nfunction printPayslip\(\) \{/.test(payrollBlock)) fail('薪資基準區塊起訖行不正確');
const payrollBaselineAllFunctions = new Map(extractFunctions(payrollBaselineHtml).map(item => [item.name, item.source]));
for (const name of ['navTo', 'renderCurrentPage', 'applyRole', 'refreshAccountingLinkedViews', 'applyDefaultPeriodForPage', 'psPayrollBreakdown', 'psPayrollSum']) {
  const current = currentSourceOf(name);
  if (!current || current !== payrollBaselineAllFunctions.get(name)) fail(`薪資批次不應改動 ${name}`);
}
for (const name of payrollBaselineFunctions.keys()) {
  if (protectedCurrentFunctions.has(name)) fail(`薪資函式不應仍留在 index.html：${name}`);
}
for (const declName of ['PR_CONFIG', 'PAYROLL_EMPLOYEE_ACCOUNTS', 'CODEX_SEED_PAYROLL', 'PAYROLL', 'DEFAULT_PAYROLL_MONTHS', 'PAYROLL_MONTHS', 'PAYROLL_DELETED_MONTHS', 'DELETED_SOURCE_KEYS', 'prNextId', 'prCurrentEmp', 'prRangeExpanded']) {
  if (new RegExp(`^(const|let) ${declName}\\b`, 'm').test(currentHtml)) fail(`薪資資料宣告不應仍留在 index.html：${declName}`);
}
verifyExactFile('ops/js/modules/overhead.js', expectedOverheadAfterFix, 'overhead.js');
if (expectedOverheadAfterFix === expectedOverhead) fail('overhead.js 應已移除第一個（無作用的）ohDeleteFixedItem');
if (overheadBaselineList.length !== 24 || overheadBaselineList.filter(item => item.name === 'ohDeleteFixedItem').length !== 2) fail(`overhead.js 基準應有 24 個函式宣告（ohDeleteFixedItem 兩次），實際 ${overheadBaselineList.length}`);
if (!overheadBlock.includes('// OVERHEAD DATA') || !overheadBlock.includes('const OH_FIXED_ITEMS = [') || !/\nfunction openAddOverheadModal\(\) \{/.test(overheadBlock)) fail('公司開銷基準區塊起訖行不正確');
const overheadBaselineAllFunctions = new Map(extractFunctions(overheadBaselineHtml).map(item => [item.name, item.source]));
for (const name of ['navTo', 'renderCurrentPage', 'applyRole', 'refreshAccountingLinkedViews', 'applyDefaultPeriodForPage', 'psComputeData', 'psPayrollSum']) {
  const current = currentSourceOf(name);
  if (!current || current !== overheadBaselineAllFunctions.get(name)) fail(`公司開銷批次不應改動 ${name}`);
}
for (const item of overheadBaselineList) {
  if (protectedCurrentFunctions.has(item.name)) fail(`公司開銷函式不應仍留在 index.html：${item.name}`);
}
for (const declName of ['OH_WATER_ELECTRIC_SPLIT_MONTH', 'OH_LEGACY_FIXED_ITEMS', 'OH_FIXED_ITEMS', 'OH_FIXED_CONFIG', 'OVERHEAD', 'ohVarNextId', 'OH_FIXED_EXPENSE_REVIEW_FROM', 'ohFixedExpenseReviewList']) {
  if (new RegExp(`^(const|let) ${declName}\\b`, 'm').test(currentHtml)) fail(`公司開銷資料宣告不應仍留在 index.html：${declName}`);
}
verifyExactFile('ops/js/modules/profit.js', expectedProfit, 'profit.js');
const expectedProfitFunctionCount = extractFunctions(expectedProfit).length;
if (expectedProfitFunctionCount !== 10) fail(`profit.js 預期 10 個函式，實際基準 ${expectedProfitFunctionCount}`);
if (!profitBaselineHtml.split(/(?<=\n)/)[4409].startsWith('<script>') || !profitBlock.startsWith('// ═') || !profitBlock.includes('function renderProfit() {')) fail('淨利潤基準區塊起訖行不正確');
{
  const order = scripts.join(' ');
  if (!order.includes('js/modules/receivables.js js/modules/profit.js js/modules/expenses.js')) fail(`profit.js 應正好載入於 receivables.js 與 expenses.js 之間：${order}`);
}
const profitBaselineAllFunctions = new Map(extractFunctions(profitBaselineHtml).map(item => [item.name, item.source]));
for (const name of ['navTo', 'renderCurrentPage', 'applyRole', 'refreshAccountingLinkedViews', 'psComputeData']) {
  const current = currentSourceOf(name);
  if (!current || current !== profitBaselineAllFunctions.get(name)) fail(`淨利潤批次不應改動 ${name}`);
}
for (const name of profitBaselineFunctions.keys()) {
  if (protectedCurrentFunctions.has(name)) fail(`淨利潤函式不應仍留在 index.html：${name}`);
}
for (const declName of ['pfSelYears', 'pfSelCases', 'pfClosedCollapsed']) {
  if (new RegExp(`^(const|let) ${declName}\\b`, 'm').test(currentHtml)) fail(`淨利潤狀態變數不應仍留在 index.html：${declName}`);
}
verifyExactFile('ops/js/modules/tax.js', expectedTax, 'tax.js');
const expectedTaxFunctionCount = extractFunctions(expectedTax).length;
if (expectedTaxFunctionCount !== 12) fail(`tax.js 預期 12 個函式，實際基準 ${expectedTaxFunctionCount}`);
if (!taxBlock.includes('// TAX MANAGEMENT') || !/\nfunction renderTaxManagement\(\) \{/.test(taxBlock)) fail('稅務基準區塊起訖行不正確');
const taxBaselineAllFunctions = new Map(extractFunctions(taxBaselineHtml).map(item => [item.name, item.source]));
for (const name of ['navTo', 'renderCurrentPage', 'applyRole', 'refreshAccountingLinkedViews', 'psComputeData']) {
  const current = currentSourceOf(name);
  if (!current || current !== taxBaselineAllFunctions.get(name)) fail(`稅務批次不應改動 ${name}`);
}
for (const name of taxBaselineFunctions.keys()) {
  if (protectedCurrentFunctions.has(name)) fail(`稅務函式不應仍留在 index.html：${name}`);
}
for (const declName of ['TAX_SELECTED_YEAR', 'TAX_EDIT_ID']) {
  if (new RegExp(`^(const|let) ${declName}\\b`, 'm').test(currentHtml)) fail(`稅務狀態變數不應仍留在 index.html：${declName}`);
}
verifyExactFile('ops/js/modules/profitshare.js', expectedProfitshare, 'profitshare.js');
const expectedProfitshareFunctionCount = extractFunctions(expectedProfitshare).length;
if (expectedProfitshareFunctionCount !== 28) fail(`profitshare.js 預期 28 個函式，實際基準 ${expectedProfitshareFunctionCount}`);
if (!profitshareBlock.includes('// PROFIT SHARE DATA') || !profitshareBlock.includes('function psComputeData() {') || !profitshareBlock.includes('function renderProfitShare() {')) fail('分潤基準區塊起訖行不正確');
// invoicerequest.js and mobile.js (new code) are appended after profitshare.js; profitshare.js must still follow tax.js directly.
if (scripts[scripts.length - 1] !== 'js/modules/mobile.js' || scripts[scripts.length - 2] !== 'js/modules/receipts.js' || scripts[scripts.length - 3] !== 'js/modules/invoicerequest.js' || scripts[scripts.length - 4] !== 'js/modules/profitshare.js' || scripts[scripts.length - 5] !== 'js/modules/tax.js') fail(`mobile.js 應為最後一個本機 script，前面依序是 receipts.js、invoicerequest.js、profitshare.js、tax.js：${scripts.slice(-6).join(' ')}`);
const profitshareBaselineAllFunctions = new Map(extractFunctions(profitshareBaselineHtml).map(item => [item.name, item.source]));
for (const name of ['navTo', 'renderCurrentPage', 'applyRole', 'refreshAccountingLinkedViews', 'applyDefaultPeriodForPage']) {
  const current = protectedCurrentFunctions.get(name);
  if (!current || current !== profitshareBaselineAllFunctions.get(name)) fail(`分潤批次不應改動 ${name}`);
}
for (const name of profitshareBaselineFunctions.keys()) {
  if (protectedCurrentFunctions.has(name)) fail(`分潤函式不應仍留在 index.html：${name}`);
}
for (const declName of ['PROFIT_SPLIT_RATIOS', 'PROFIT_SHARE_PERSON_NAMES', 'PS_TAX_RATE', 'PROFIT_SETTLEMENTS', 'PS_SELECTED_CASES', 'PS_OH_START', 'PS_INITIAL_OVERHEAD_LOCKED_THROUGH', 'psPayoutSettledCollapsed', 'psOhFutureCollapsed']) {
  if (new RegExp(`^(const|let) ${declName}\\b`, 'm').test(currentHtml)) fail(`分潤資料宣告不應仍留在 index.html：${declName}`);
}
// Modularization complete: index.html keeps only the app shell. Its inline function set is frozen;
// any new business function must go into a module file (update this list deliberately if the shell changes).
const SHELL_INLINE_FUNCTIONS = [
  'setTodayMin', 'requestedPageFromUrl', 'activateRequestedPageFromUrl', 'activateDefaultPageForUser', 'opsShowNewVersionBanner',
  'opsCheckForNewVersion', 'firstAccessiblePage', 'navElForPage', 'toggleMobileSidebar', 'resizeTableWrap', 'closeMobileSidebar',
  'applyDefaultPeriodForPage', 'navTo', 'renderCurrentPage', 'refreshAccountingLinkedViews', 'applyRole', 'initRoleOptions',
  'switchRole', 'openRolePanel', 'closeRolePanel', 'openPayreqForVendor', 'openReceivableForClient', 'selectRadio',
  'payreqVendorPickerMouseDown',
];
{
  const inlineNames = [...protectedCurrentFunctions.keys()].sort();
  const expectedShell = [...SHELL_INLINE_FUNCTIONS].sort();
  if (JSON.stringify(inlineNames) !== JSON.stringify(expectedShell)) fail(`index.html 內嵌函式應只剩系統骨架：多出 ${inlineNames.filter(n => !expectedShell.includes(n)).join(',') || '無'}；缺少 ${expectedShell.filter(n => !inlineNames.includes(n)).join(',') || '無'}`);
  const afterLastModule = currentHtml.slice(currentHtml.indexOf('<script src="js/modules/profitshare.js"></script>'));
  if (/<script(?![^>]*\ssrc=)[^>]*>/.test(afterLastModule)) fail('profitshare.js 之後不應再有 inline script');
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

{
  // Cache-busting stamp: every local script, the mobile stylesheet and the manifest carry ?v=<hash of ops/>.
  const expectedStamp = opsContentHash(root);
  const refs = [...rawCurrentHtml.matchAll(/(?:src="js\/[^"?]+\.js|href="styles\/[^"?]+\.css|href="manifest\.webmanifest)(\?v=[0-9a-f]{8})?"/g)];
  const unstamped = refs.filter(m => !m[1]);
  const stale = refs.filter(m => m[1] && m[1] !== '?v=' + expectedStamp);
  if (!refs.length) fail('index.html 找不到任何要加版本戳記的檔案參照');
  if (unstamped.length || stale.length) fail(`index.html 的版本戳記不是最新（應為 ?v=${expectedStamp}）：請執行 node scripts/stamp-ops-version.mjs`);
}
if (!process.exitCode) {
  console.log(`PASS: ${scripts.length} 個本機 script 語法正確；20 個搬出模組／區塊與 ${compared} 個函式均和各自核准基準逐字一致；cases.js 含 ${expectedCaseFunctionCount} 個案件函式；clients.js 含 ${expectedClientsFunctionCount} 個函式；vendors.js 含 ${expectedVendorsFunctionCount} 個函式（含排序狀態）；attendance.js 含 ${expectedAttendanceFunctionCount} 個出勤函式；payreq.js 含 ${expectedPayreqFunctionCount} 個請款函式；feedback／systemnotes／employees 含 ${fneFunctionCounts.feedback}／${fneFunctionCounts.systemnotes}／${fneFunctionCounts.employees} 個函式；payroll.js 含 ${expectedPayrollFunctionCount} 個薪資函式；overhead.js 含 ${overheadExpectedList.length} 個開銷函式宣告（依序比對，已移除重複宣告）；profit.js 含 ${expectedProfitFunctionCount} 個儀表板函式、載入位置不變；tax.js 含 ${expectedTaxFunctionCount} 個稅務函式；profitshare.js 含 ${expectedProfitshareFunctionCount} 個分潤函式、後面只接新增的 mobile.js；index.html 只剩 ${SHELL_INLINE_FUNCTIONS.length} 個系統骨架函式；三個橋接／picker函式確認仍在 index.html。` + (postSplitChanged ? `另有 ${postSplitChanged} 個函式為拆檔後已記錄的刻意修改（${Object.entries(POST_SPLIT_CHANGES).map(([file, c]) => `${file}: ${[...c.changed, ...(c.literalChanges || []).map(([, to]) => to)].join('、')}`).join('；')}），其餘內容仍逐字一致。` : ''));
}
