import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const indexPath = path.join(root, 'ops/index.html');

function fail(message) {
  throw new Error(message);
}

function removeExact(source, snippet, label) {
  const count = source.split(snippet).length - 1;
  if (count !== 1) fail(`${label} 預期出現 1 次，實際 ${count} 次`);
  return source.replace(snippet, '');
}

function range(source, startMarker, endMarker, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0 || end <= start) fail(`找不到範圍：${label}`);
  return source.slice(start, end);
}

function writeNew(relativePath, content) {
  const target = path.join(root, relativePath);
  if (fs.existsSync(target)) fail(`檔案已存在，拒絕覆寫：${relativePath}`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content.endsWith('\n') ? content : content + '\n');
}

function foundation() {
  let html = fs.readFileSync(indexPath, 'utf8');
  const dataScriptStart = '<script>\n// ══════════════════════════════════\n// DATA\n// ══════════════════════════════════\n// CLIENTS defined below in CLIENT DATA section\n\n';
  const configStart = '// 多公司預留欄位（現階段僅宇德，畫面不顯示切換器）';
  const dataEndMarker = "\ndocument.addEventListener('DOMContentLoaded', () => {";
  const originalDataScript = range(html, dataScriptStart, dataEndMarker, '共用資料層');
  const configBlock = range(originalDataScript, configStart, '\nfunction tagCompany(arr) {', '設定常數').trimEnd();
  let dataBlock = originalDataScript.slice(originalDataScript.indexOf('function tagCompany(arr) {'));

  const accountingRanges = [
    range(
      dataBlock,
      'function isFamilyPassThroughCaseRecord(c) {',
      '\nfunction removeReplacedPassThroughReceivableAggregates() {',
      '親友轉付計算'
    ).trimEnd(),
    range(
      dataBlock,
      'function receivableIsCollected(row) {',
      '\nconst SOURCE_OF_TRUTH_CASE_CODES',
      '應收認列計算'
    ).trimEnd(),
  ];
  for (const snippet of accountingRanges) dataBlock = removeExact(dataBlock, snippet, '共用會計計算');

  const paymentBlock = range(
    html,
    'const PROFIT_PAYMENT_TYPES = {',
    '\nfunction psParticipantList() {',
    '付款分類計算'
  ).trimEnd();
  html = removeExact(html, paymentBlock, '付款分類計算');

  const uiRanges = [
    range(html, 'function currentMonthKey() {', '\nfunction applyDefaultPeriodForPage(page) {', '日期工具').trimEnd(),
    range(html, 'function caseOptionLabel(c) {', '\nfunction openPayreqForVendor(vendorCode) {', '案件選單元件').trimEnd(),
    range(html, 'function openModal(id)', '\nfunction caseHasSiteLocation(c) {', '共用互動元件').trimEnd(),
    range(html, 'function rowAuditUser() {', '\nfunction canViewPayableRow(p) {', '列資料與搜尋工具').trimEnd(),
    range(html, 'function duplicateAmountWarning(', '\nfunction renderPayable() {', '重複提醒與排序工具').trimEnd(),
    range(html, "function showToast(msg, type='') {", '\n</script>', 'Toast 元件').trimEnd(),
  ];
  for (const snippet of uiRanges) html = removeExact(html, snippet, '共用 UI／工具');
  html = removeExact(html, 'let toastTimer;', 'toastTimer');

  const loader = [
    '<script src="js/core/types.js"></script>',
    '<script src="js/core/config.js"></script>',
    '<script src="js/core/data.js"></script>',
    '<script src="js/core/accounting.js"></script>',
    '<script src="js/core/ui.js"></script>',
    '<script>',
  ].join('\n');
  const currentDataScript = range(html, dataScriptStart, dataEndMarker, '更新後共用資料層');
  html = html.replace(currentDataScript, loader);

  writeNew('ops/js/core/config.js', [
    '// OPS runtime configuration and cloud state. Extracted verbatim from ops/index.html.',
    configBlock,
  ].join('\n\n'));
  writeNew('ops/js/core/data.js', [
    '// OPS shared state, persistence, migrations, authentication, and Firebase access.',
    '// Business-calculation helpers are loaded separately from accounting.js.',
    dataBlock.trim(),
  ].join('\n\n'));
  writeNew('ops/js/core/accounting.js', [
    '// Shared accounting predicates and calculations. Function bodies are moved verbatim.',
    ...accountingRanges,
    paymentBlock,
  ].join('\n\n'));
  writeNew('ops/js/core/ui.js', [
    '// Shared UI, filtering, row metadata, and rendering helpers. Moved verbatim.',
    'let toastTimer;',
    ...uiRanges,
  ].join('\n\n'));
  fs.writeFileSync(indexPath, html);
}

function extractSlice({ startMarker, endMarker, target, title }) {
  let html = fs.readFileSync(indexPath, 'utf8');
  const block = range(html, startMarker, endMarker, title);
  const replacement = `<script src="${target.replace(/^ops\//, '')}"></script>\n`;
  html = html.replace(block, replacement);
  writeNew(target, block.trim());
  fs.writeFileSync(indexPath, html);
}

function payables() {
  extractSlice({
    startMarker: '// ══════════════════════════════════\n// PAYABLE MODULE',
    endMarker: '// ══════════════════════════════════\n// RECEIVABLE MODULE',
    target: 'ops/js/modules/payables.js',
    title: '應付模組',
  });
}

function receivables() {
  extractSlice({
    startMarker: '// ══════════════════════════════════\n// RECEIVABLE MODULE',
    endMarker: '// ══════════════════════════════════\n// HELPERS',
    target: 'ops/js/modules/receivables.js',
    title: '應收模組',
  });
}

function expenses() {
  extractSlice({
    startMarker: '// ══════════════════════════════════\n// EXPENSE DATA',
    endMarker: '// ══════════════════════════════════\n// OVERHEAD DATA',
    target: 'ops/js/modules/expenses.js',
    title: '費用模組',
  });
}

const action = process.argv[2];
if (action === 'foundation') foundation();
else if (action === 'payables') payables();
else if (action === 'receivables') receivables();
else if (action === 'expenses') expenses();
else fail('用法：node scripts/refactor-ops-slices.mjs <foundation|payables|receivables|expenses>');
