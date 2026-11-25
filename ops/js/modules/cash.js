// 資金試算（Cash position）。New module, not part of the verbatim split.
//
// 自有資金 = 可用的錢（銀行餘額＋已開發票未收＋預估未收）− 不是自己的錢（借款、租賃、應付、分潤、稅金、
// 進行中個案超前收款、其他預留）。估算一律偏保守：寧可算低，不能算高。
// 可動用金額 = 自有資金 − 安全水位（N 個月公司開銷＋老闆每月領款）。
// Data: CASH_ITEMS (帳戶／借款／租賃／預估未收／其他預留) and CASH_SNAPSHOTS (每期凍結的明細), plus
// CASH_SETTINGS. They join the snapshot and the cloud row merge by wrapping createDataSnapshot /
// applyDataSnapshot at load time (same pattern as invoicerequest.js), so data.js is unchanged.
// Only 李鎮宇 and 鄭詩褣 (shower, nc) can open the page; the data still lives in the shared snapshot.

let CASH_ITEMS = [];
let CASH_SNAPSHOTS = [];
let cashItemNextId = 1;
let cashSnapNextId = 1;
const CASH_DEFAULT_SETTINGS = { reserveMonths: 3, ownerMonthlyDraw: 200000 };
let CASH_SETTINGS = { ...CASH_DEFAULT_SETTINGS };
let cashEditingItemId = null;
// 「登錄本期金額」打了但還沒按「存成本期」的值（項目 id → 文字；date／note 是登錄日與備註）。
// 畫面重畫（按項目設定、新增項目、雲端同步）時用它把已打的數字放回去，存成本期後清空。
let cashDrafts = {};

function cashSetDraft(key, el) {
  cashDrafts[key] = el.value;
  if (el.dataset.saved !== undefined) el.style.borderColor = cashParse(el.value) === Number(el.dataset.saved) ? '' : 'var(--warning)';
}
let cashViewSnapshotId = null;
// 未結算個案的預估（財務填「還可收／還要付」；存成最終總收款／總成本，之後記收付款會自動遞減）。
let CASH_ESTIMATES = [];
let cashEstNextId = 1;
// 下方明細表看哪一種算法：safe＝保守（排除未結算個案），est＝含預估利潤。
let cashLineMode = 'safe';

(function cashHookSnapshot() {
  const originalCreate = window.createDataSnapshot;
  window.createDataSnapshot = function () {
    tagCompany(CASH_ITEMS);
    tagCompany(CASH_SNAPSHOTS);
    tagCompany(CASH_ESTIMATES);
    const snapshot = originalCreate.apply(this, arguments);
    snapshot.CASH_ITEMS = CASH_ITEMS;
    snapshot.CASH_SNAPSHOTS = CASH_SNAPSHOTS;
    snapshot.CASH_SETTINGS = CASH_SETTINGS;
    snapshot.cashItemNextId = cashItemNextId;
    snapshot.cashSnapNextId = cashSnapNextId;
    snapshot.CASH_ESTIMATES = CASH_ESTIMATES;
    snapshot.cashEstNextId = cashEstNextId;
    return snapshot;
  };
  const originalApply = window.applyDataSnapshot;
  window.applyDataSnapshot = function (d) {
    const result = originalApply.apply(this, arguments);
    if (d && typeof d === 'object') {
      CASH_ITEMS.length = 0;
      if (Array.isArray(d.CASH_ITEMS)) CASH_ITEMS.push(...d.CASH_ITEMS.filter(Boolean));
      CASH_SNAPSHOTS.length = 0;
      if (Array.isArray(d.CASH_SNAPSHOTS)) CASH_SNAPSHOTS.push(...d.CASH_SNAPSHOTS.filter(Boolean));
      CASH_SETTINGS = { ...CASH_DEFAULT_SETTINGS, ...(d.CASH_SETTINGS && typeof d.CASH_SETTINGS === 'object' ? d.CASH_SETTINGS : {}) };
      cashItemNextId = Math.max(Number(d.cashItemNextId) || 1, ...CASH_ITEMS.map(r => (Number(r.id) || 0) + 1), 1);
      cashSnapNextId = Math.max(Number(d.cashSnapNextId) || 1, ...CASH_SNAPSHOTS.map(r => (Number(r.id) || 0) + 1), 1);
      CASH_ESTIMATES.length = 0;
      if (Array.isArray(d.CASH_ESTIMATES)) CASH_ESTIMATES.push(...d.CASH_ESTIMATES.filter(Boolean));
      cashEstNextId = Math.max(Number(d.cashEstNextId) || 1, ...CASH_ESTIMATES.map(r => (Number(r.id) || 0) + 1), 1);
    }
    return result;
  };
  OPS_CLOUD_ROW_MERGE_CONFIGS.push({ collection: 'CASH_ITEMS', nextIdField: 'cashItemNextId', label: '資金試算項目', reassignIdOnNewCollision: true });
  OPS_CLOUD_ROW_MERGE_CONFIGS.push({ collection: 'CASH_SNAPSHOTS', nextIdField: 'cashSnapNextId', label: '資金試算期別', reassignIdOnNewCollision: true });
  OPS_CLOUD_ROW_MERGE_CONFIGS.push({ collection: 'CASH_ESTIMATES', nextIdField: 'cashEstNextId', label: '資金試算個案預估', reassignIdOnNewCollision: true });
})();

// ── 頁面接進既有的導覽（不改 index.html 的骨架函式） ──
(function cashHookShell() {
  const originalNavTo = window.navTo;
  window.navTo = function (page, el) {
    if (page !== 'cash') return originalNavTo.call(this, page, el);
    if (!cashCanAccess()) { showToast('您沒有此功能的權限', 'error'); return; }
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    (el || document.getElementById('nav-cash'))?.classList.add('active');
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-cash')?.classList.add('active');
    const main = document.querySelector('.main'); if (main) main.scrollTop = 0;
    document.getElementById('topbar-title').textContent = '資金試算';
    document.getElementById('topbar-sub').textContent = 'Cash Position';
    currentPage = 'cash';
    cashRender();
    closeMobileSidebar();
  };
  const originalRender = window.renderCurrentPage;
  window.renderCurrentPage = function () {
    originalRender.apply(this, arguments);
    if (currentPage === 'cash') cashRender();
  };
  const originalRole = window.applyRole;
  window.applyRole = function () {
    const result = originalRole.apply(this, arguments);
    const nav = document.getElementById('nav-cash');
    if (nav) nav.style.display = cashCanAccess() ? '' : 'none';
    return result;
  };
})();

// ── 成本控制表：老闆／財務多看到一欄「預估毛利」（資金試算填的預估；不改 renderProfit 本身） ──
(function cashHookCostControl() {
  if (typeof window.renderProfit !== 'function') return;
  const original = window.renderProfit;
  window.renderProfit = function () {
    const result = original.apply(this, arguments);
    try { cashDecorateCostControl(); } catch (err) { console.warn('cashDecorateCostControl', err); }
    return result;
  };
})();

function cashDecorateCostControl() {
  const tbody = document.getElementById('pf-case-tbody');
  const table = tbody?.closest('table');
  if (!table) return;
  table.querySelectorAll('.cash-est-col').forEach(el => el.remove());
  if (!cashCanAccess()) return;
  const headRow = table.querySelector('thead tr');
  if (headRow) headRow.insertAdjacentHTML('beforeend', '<th class="cash-est-col" style="padding:10px 10px;text-align:right;white-space:nowrap" title="資金試算填的預估：（已收＋還可收）−（已記成本＋還要付）− 稅務成本">預估毛利</th>');
  const open = new Set(cashOpenCases().map(c => c.code));
  tbody.querySelectorAll('tr').forEach(tr => {
    const m = (tr.getAttribute('onclick') || '').match(/pfSelectDetailCase\('([^']+)'\)/);
    if (!m) {
      const last = tr.lastElementChild;
      if (last && last.hasAttribute('colspan')) {
        last.dataset.cashColspan = last.dataset.cashColspan || last.getAttribute('colspan');
        last.setAttribute('colspan', String(Number(last.dataset.cashColspan) + 1));
      } else tr.insertAdjacentHTML('beforeend', '<td class="cash-est-col"></td>');
      return;
    }
    const c = CASES.find(x => x.code === m[1]);
    const e = c && open.has(c.code) ? cashCaseEstimate(c) : null;
    const cell = e
      ? `<span style="font-weight:700;color:${e.gross < 0 ? 'var(--error)' : 'var(--accent)'}" title="還可收 ${cashMoney(e.remainingRevenue)}、還要付 ${cashMoney(e.remainingCost)}（${cashEsc(e.row.date || '')}）">${e.gross < 0 ? '-' : ''}${cashMoney(Math.abs(e.gross))}</span>`
      : '<span style="color:var(--text3)">—</span>';
    tr.insertAdjacentHTML('beforeend', `<td class="cash-est-col" style="padding:10px 10px;text-align:right;font-family:'DM Mono',monospace;font-size:12px">${cell}</td>`);
  });
  const foot = document.getElementById('pf-case-tfoot')?.querySelector('tr');
  if (foot) foot.insertAdjacentHTML('beforeend', '<td class="cash-est-col"></td>');
}

const CASH_KINDS = {
  account: { label: '銀行帳戶', side: 'asset' },
  asset:   { label: '預估未收', side: 'asset' },
  loan:    { label: '借款', side: 'liability' },
  lease:   { label: '租賃', side: 'liability' },
  reserve: { label: '其他預留', side: 'liability' },
};

const CASH_DEFAULT_ITEMS = [
  { kind: 'account', name: '玉山銀行 活存' },
  { kind: 'account', name: '瑞興銀行 活存' },
  { kind: 'account', name: '瑞興銀行 支存' },
  { kind: 'account', name: '國泰世華 活存' },
  { kind: 'account', name: '國泰世華 支存' },
  { kind: 'loan',    name: '玉山借款' },
  // M340i／GOLF R 租金已改用應付「期票分期」記每張支票，資金試算從應付帶入「已開支票未兌現」，不再預設租賃項目以免重複扣。
];

function cashCanAccess() {
  return !!currentUser && ['shower', 'nc'].includes(currentUser.id);
}

function cashEsc(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function cashMoney(value) {
  const n = Math.round(Number(value) || 0);
  return `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('zh-TW')}`;
}

function cashParse(value) {
  const n = Number(String(value ?? '').replace(/,/g, '').replace(/[^\d.\-]/g, ''));
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function cashToday() {
  return localDateKey();
}

// 租賃：從登錄日之後，每過一個扣款日就少一期，最多扣到最後一期。
function cashLeaseRemaining(item, today = cashToday()) {
  const base = Number(item.amount) || 0;
  const monthly = Number(item.monthlyPayment) || 0;
  const day = Math.min(Math.max(Number(item.payDay) || 1, 1), 28);
  if (!monthly || !item.asOfDate) return Math.max(0, base);
  let paid = 0;
  const start = new Date(item.asOfDate + 'T00:00:00');
  const end = new Date(today + 'T00:00:00');
  const cursor = new Date(start.getFullYear(), start.getMonth(), day);
  if (cursor <= start) cursor.setMonth(cursor.getMonth() + 1);
  while (cursor <= end) {
    const ym = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    if (item.lastPayMonth && ym > item.lastPayMonth) break;
    paid += monthly;
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return Math.max(0, base - paid);
}

function cashItemValue(item) {
  return item.kind === 'lease' ? cashLeaseRemaining(item) : (Number(item.amount) || 0);
}

// ── 進行中個案：依預估毛利率算超前收款（已收 − 已賺營收），只扣不加 ──
// ── 未結算個案：已收、已記成本都從系統即時抓（跟淨利潤儀表同一套條件），預估由財務填 ──
// 名單＝淨利潤儀表還沒結算的個案（psIsProfitSettlementCase）；結算過又有保固款等增量的，只算結算基準日之後。
function cashOpenCases() {
  return CASES.filter(c => c && psIsProfitSettlementCase(c));
}

function cashCaseActuals(c) {
  const cutoff = c.psSettled ? psCaseSettlementCutoff(c) : '';
  const after = d => !cutoff || String(d || '') > cutoff;
  const sum = (rows, f) => rows.reduce((s, r) => s + (Number(f(r)) || 0), 0);
  const rv = RECEIVABLES.filter(r => r && r.case === c.code);
  const rvIn = rv.filter(r => receivableIsCollected(r) && after(r.collectDate));
  const collected = sum(rvIn, r => r.collectAmt);
  const billedOpen = sum(rv.filter(r => !receivableIsCollected(r) && Number(r.invoiceAmt || 0) > 0), r => receivableExpectedAmount(r));
  const py = PAYABLES.filter(p => p && p.case === c.code && isProjectCostPayment(p));
  const paidCost = sum(py.filter(p => p.status === 'paid' && after(p.doneDate)), p => p.amount);
  const unpaidCost = sum(py.filter(p => ['approved', 'pending'].includes(p.status)), p => p.amount);
  const expCost = sum(EXPENSES.filter(e => e && e.caseKey === c.code && e.status === 'approved' && e.postCloseTreatment !== 'company_absorb' && after(e.date || (e.month ? e.month + '-01' : ''))), e => e.amount);
  const taxCost = sum(rvIn, r => (Number(r.invoiceAmt) || 0) / 1.05 * 0.05 / 2);
  const recordedCost = paidCost + unpaidCost + expCost;
  // held：這個案子現在算在公司身上的錢（已收＋已開票未收 − 已記成本），保守法整筆排除。
  return { collected, billedOpen, paidCost, unpaidCost, expCost, recordedCost, taxCost, held: collected + billedOpen - recordedCost };
}

function cashEstimateRow(code) {
  return CASH_ESTIMATES.find(e => e && e.caseCode === code) || null;
}

function cashCaseEstimate(c, a = cashCaseActuals(c)) {
  const row = cashEstimateRow(c.code);
  if (!row) return null;
  const finalRevenue = Number(row.finalRevenue) || 0;
  const finalCost = Number(row.finalCost) || 0;
  const remainingRevenue = Math.max(0, finalRevenue - a.collected);
  const remainingCost = Math.max(0, finalCost - a.recordedCost);
  const revenue = a.collected + remainingRevenue;
  const cost = a.recordedCost + remainingCost;
  const tax = a.taxCost + remainingRevenue / 1.05 * 0.05 / 2;
  const staleDate = localDateKey(new Date(Date.now() - 30 * 86400000));
  return {
    row, remainingRevenue, remainingCost, revenue, cost, tax, gross: revenue - cost - tax,
    futureUninvoiced: Math.max(0, remainingRevenue - a.billedOpen),
    overCost: a.recordedCost > finalCost + 0.5, stale: !row.date || row.date < staleDate,
  };
}

// 用淨利潤儀表的同一套規則（公司開銷分攤、預留營所稅、扣已付薪資與分潤款）算「預估最終」的分潤：
// 全部未結算個案一起算（公司開銷照毛利比例分攤，跟實際結算一樣）；有預估的個案暫時把「還可收」當成已收、
// 「還要付＋已記未付」當成已付放進去，沒預估的照目前已發生的數字。算完立刻拿掉，不存、不顯示。
function cashEstimateRun(items) {
  if (!items.some(x => x.e)) return null;
  const saved = { sel: PS_SELECTED_CASES, start: PS_OH_START, end: PS_OH_END };
  const today = cashToday();
  const fakeRv = items.filter(x => x.e && x.e.remainingRevenue > 0).map(x => ({ id: `cash-est-r-${x.c.code}`, case: x.c.code, item: '資金試算預估', collectAmt: x.e.remainingRevenue, invoiceAmt: x.e.remainingRevenue, receivableAmt: x.e.remainingRevenue, collectDate: today, status: 'collected' }));
  const fakePy = items.filter(x => x.e && x.e.remainingCost + x.a.unpaidCost > 0).map(x => ({ id: `cash-est-p-${x.c.code}`, case: x.c.code, vendor: '資金試算預估', amount: x.e.remainingCost + x.a.unpaidCost, status: 'paid', doneDate: today }));
  RECEIVABLES.push(...fakeRv);
  PAYABLES.push(...fakePy);
  PS_SELECTED_CASES = items.map(x => x.c.code);
  // 公司開銷只算到這個月（淨利潤儀表預設會含之後才攤提的月份）。
  const pastMonths = psAvailableOverheadMonths().filter(m => m <= today.slice(0, 7));
  PS_OH_START = null;
  PS_OH_END = pastMonths.length ? pastMonths[pastMonths.length - 1] : null;
  try {
    return psComputeData();
  } finally {
    fakeRv.forEach(r => { const i = RECEIVABLES.indexOf(r); if (i >= 0) RECEIVABLES.splice(i, 1); });
    fakePy.forEach(p => { const i = PAYABLES.indexOf(p); if (i >= 0) PAYABLES.splice(i, 1); });
    PS_SELECTED_CASES = saved.sel; PS_OH_START = saved.start; PS_OH_END = saved.end;
  }
}

// ── 稅金：營業稅以今年各期「預留 − 已繳」為正的部分；營所稅用稅務管理的預估與已鎖定未繳 ──
function cashVatRows(today = cashToday()) {
  const year = today.slice(0, 4);
  const paidRows = TAX_LIABILITIES.filter(r => r.taxType === '營業稅' && r.status === 'paid');
  return [1, 3, 5, 7, 9, 11].map(m => {
    const period = `${year}-${String(m).padStart(2, '0')}~${String(m + 1).padStart(2, '0')}`;
    const invoices = RECEIVABLES.filter(r => Number(r.invoiceAmt || 0) !== 0 && taxVatPeriodKey(r.invoiceDate) === period);
    const reserve = invoices.reduce((s, r) => s + taxVatReserve(r.invoiceAmt), 0);
    const paid = paidRows.filter(r => String(r.period || '') === period).reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const due = `${m === 11 ? Number(year) + 1 : year}-${String(m === 11 ? 1 : m + 2).padStart(2, '0')}-15`;
    return { period, reserve, paid, owed: Math.max(0, reserve - paid), overdueUnrecorded: !paid && reserve > 0 && due < today };
  }).filter(r => r.owed > 0.5);
}

function cashIncomeTax(today = cashToday()) {
  const year = today.slice(0, 4);
  const years = Number(today.slice(5, 7)) <= 5 ? [String(Number(year) - 1), year] : [year];
  const formal = years.reduce((sum, y) => {
    const reserve = PROFIT_SETTLEMENTS.filter(s => String(s.taxYear || s.date || '').startsWith(y))
      .reduce((s2, s) => s2 + Math.abs(Number(s.grandTax) || (s.cases || []).reduce((x, c) => x + (Number(c.taxReserve) || 0), 0)), 0);
    const paid = TAX_LIABILITIES.filter(r => r.taxType === '營所稅' && r.status === 'paid' && String(r.period || '').startsWith(y))
      .reduce((s2, r) => s2 + (Number(r.amount) || 0), 0);
    return sum + Math.max(0, reserve - paid);
  }, 0);
  return { open: taxOpenIncomeEstimate(), formal };
}

// ── 安全水位：最近 3 個完整月份的公司開銷平均（含員工薪資）＋老闆每月領款 ──
function cashMonthlyOverhead(today = cashToday()) {
  const current = today.slice(0, 7);
  const salaryIdx = OH_FIXED_CONFIG.indexOf('員工薪資');
  const months = Object.keys(OVERHEAD || {}).filter(m => prIsValidMonth(m) && m < current).sort().slice(-3);
  if (!months.length) return { months, average: 0 };
  const total = months.reduce((s, m) => {
    const d = OVERHEAD[m] || {};
    const fixed = (d.fixed || []).reduce((x, v, i) => x + (i === salaryIdx ? 0 : (parseInt(v) || 0)), 0);
    const variable = (d.variable || []).reduce((x, v) => x + (Number(v.amount) || 0), 0);
    return s + fixed + variable + psPayrollSum(m);
  }, 0);
  return { months, average: total / months.length };
}

function cashCompute() {
  const today = cashToday();
  const items = CASH_ITEMS.filter(Boolean);
  const base = [];
  const mk = (side, group, label, amount, detail = '', source = 'manual') => ({ side, group, label, amount: Math.round(Number(amount) || 0), detail, source });
  const add = (...args) => base.push(mk(...args));

  items.filter(i => i.kind === 'account').forEach(i => {
    if (i.include === false) return;
    add('asset', '銀行帳戶', i.name, cashItemValue(i), i.asOfDate ? `登錄日 ${i.asOfDate}` : '尚未登錄');
  });
  const billed = RECEIVABLES.filter(r => !receivableIsCollected(r) && Number(r.invoiceAmt || 0) > 0);
  add('asset', '已開發票未收', `已開發票未收款（${billed.length} 筆）`, billed.reduce((s, r) => s + receivableExpectedAmount(r), 0),
    billed.map(r => `${r.caseName || r.case || ''} ${r.item || ''} ${cashMoney(receivableExpectedAmount(r))}`).join('；'), 'auto');
  items.filter(i => i.kind === 'asset' && i.include !== false).forEach(i => add('asset', '預估未收', i.name, cashItemValue(i), i.note || ''));

  items.filter(i => i.kind === 'loan' && i.include !== false).forEach(i => add('liability', '借款', i.name, cashItemValue(i), i.asOfDate ? `登錄日 ${i.asOfDate}` : '尚未登錄'));
  items.filter(i => i.kind === 'lease' && i.include !== false).forEach(i => add('liability', '租賃', i.name, cashItemValue(i),
    `${i.monthlyPayment ? `每月 ${i.payDay || '-'} 號 ${cashMoney(i.monthlyPayment)}` : '未填每期金額'}${i.lastPayMonth ? `，最後一期 ${i.lastPayMonth}` : ''}`, i.monthlyPayment ? 'auto' : 'manual'));
  // 已開出、還沒兌現的支票（應付有票期、待付款）另列一行，依票期列出接下來的到期日；其他已核准未付照舊。
  const checks = PAYABLES.filter(p => p.status === 'approved' && p.ticket).sort((a, b) => String(a.ticket).localeCompare(String(b.ticket)) || (a.id - b.id));
  const approved = PAYABLES.filter(p => p.status === 'approved' && !p.ticket);
  const pending = PAYABLES.filter(p => p.status === 'pending');
  if (checks.length) {
    const shown = checks.slice(0, 6).map(p => `${p.ticket} ${p.vendor || ''} ${cashMoney(p.amount)}`);
    add('liability', '應付', `已開支票未兌現（${checks.length} 張）`, checks.reduce((s, p) => s + (Number(p.amount) || 0), 0),
      shown.join('；') + (checks.length > 6 ? `；…最後一張 ${checks[checks.length - 1].ticket}` : ''), 'auto');
  }
  add('liability', '應付', `已核准未付（${approved.length} 筆）`, approved.reduce((s, p) => s + (Number(p.amount) || 0), 0), '含已結算未付的分潤結清款', 'auto');
  add('liability', '應付', `待審核請款（${pending.length} 筆）`, pending.reduce((s, p) => s + (Number(p.amount) || 0), 0), '保守起見一併扣除', 'auto');
  const vat = cashVatRows(today);
  add('liability', '稅金', '預留營業稅', vat.reduce((s, r) => s + r.owed, 0),
    vat.map(r => `${r.period} ${cashMoney(r.owed)}${r.overdueUnrecorded ? '（已過申報期、未登錄繳納）' : ''}`).join('；') || '今年各期都已繳足', 'auto');
  items.filter(i => i.kind === 'reserve' && i.include !== false).forEach(i => add('liability', '其他預留', i.name, cashItemValue(i), i.note || ''));

  // 未結算個案
  const open = cashOpenCases().map(c => { const a = cashCaseActuals(c); return { c, a, e: cashCaseEstimate(c, a) }; });
  const withEst = open.filter(x => x.e);
  const noEst = open.filter(x => !x.e);
  const run = cashEstimateRun(open);
  const income = cashIncomeTax(today);
  const holdLine = (list, label) => {
    const pos = list.filter(x => x.a.held > 0.5);
    const neg = list.filter(x => x.a.held < -0.5);
    const detail = [pos.map(x => `${x.c.name} ${cashMoney(x.a.held)}`).join('；'),
      neg.length ? `公司先墊（未加回）：${neg.map(x => `${x.c.name} ${cashMoney(-x.a.held)}`).join('；')}` : ''].filter(Boolean).join('。');
    return mk('liability', '未結算個案', `${label}（${pos.length} 案）`, pos.reduce((s, x) => s + x.a.held, 0), detail || '沒有', 'auto');
  };

  const safeLines = [...base,
    holdLine(open, '未結算個案淨收款'),
    mk('liability', '稅金', '預留營所稅', income.formal, `已結算未繳 ${cashMoney(income.formal)}；未結算個案已整案排除`, 'auto')];

  const estLines = [...base];
  const futureIn = withEst.filter(x => x.e.futureUninvoiced > 0.5);
  if (withEst.length) estLines.splice(estLines.filter(l => l.side === 'asset').length, 0, mk('asset', '個案預估', `預估還可收（未開票，${futureIn.length} 案）`,
    futureIn.reduce((s, x) => s + x.e.futureUninvoiced, 0), futureIn.map(x => `${x.c.name} ${cashMoney(x.e.futureUninvoiced)}`).join('；') || '沒有', 'auto'));
  if (noEst.length) estLines.push(holdLine(noEst, '未填預估個案淨收款'));
  const futureOut = withEst.filter(x => x.e.remainingCost > 0.5);
  if (withEst.length) estLines.push(mk('liability', '個案預估', `預估還要付（${futureOut.length} 案）`, futureOut.reduce((s, x) => s + x.e.remainingCost, 0),
    futureOut.map(x => `${x.c.name} ${cashMoney(x.e.remainingCost)}`).join('；') || '沒有', 'auto'));
  // 全部個案都有預估：照結算規則（扣已付薪資、已付分潤款）。只有部分有預估：只算有預估個案的分潤，
  // 薪資和已付分潤款先不扣（扣了會少算要付的錢），全部填完後才精準。
  const estCodes = new Set(withEst.map(x => x.c.code));
  const estCaseRows = run ? run.caseRows.filter(x => estCodes.has(x.code)) : [];
  const complete = !!run && !noEst.length;
  const people = !run ? [] : run.rows.filter(r => r.person !== 'shower').map(r => {
    const fromEst = estCaseRows.reduce((t, x) => t + x.caseNet * (Number(x.ratios?.[r.person]) || 0), 0);
    return complete
      ? { person: r.person, name: r.name, owed: Math.max(0, r.unpaid), net: r.net, detail: `預估分到 ${cashMoney(r.net)}，扣已付薪資 ${cashMoney(r.salary)}、已付分潤款 ${cashMoney(r.bonus)}${r.adjustment ? `、結案後抵扣 ${cashMoney(r.adjustment)}` : ''}` }
      : { person: r.person, name: r.name, owed: Math.max(0, fromEst), net: fromEst, detail: `有預估的 ${withEst.length} 案分到 ${cashMoney(fromEst)}；薪資、已付分潤款等全部個案填完預估後才扣` };
  }).filter(r => Math.abs(r.net) > 0.5 || r.owed > 0.5);
  people.forEach(r => estLines.push(mk('liability', '未領分潤', `${r.name} 預估分潤`, r.owed, r.detail, 'auto')));
  const estTax = Math.abs(estCaseRows.reduce((t, x) => t + (Number(x.taxReserve) || 0), 0));
  estLines.push(mk('liability', '稅金', '預留營所稅', income.formal + estTax, `已結算未繳 ${cashMoney(income.formal)}；有預估的個案 ${cashMoney(estTax)}`, 'auto'));

  const months = Math.max(0, Number(CASH_SETTINGS.reserveMonths) || 0);
  const ownerDraw = Math.max(0, Number(CASH_SETTINGS.ownerMonthlyDraw) || 0);
  const overhead = cashMonthlyOverhead(today);
  const safety = Math.round(months * (overhead.average + ownerDraw));
  const totals = lines => {
    const assets = lines.filter(l => l.side === 'asset').reduce((s, l) => s + l.amount, 0);
    const liabilities = lines.filter(l => l.side === 'liability').reduce((s, l) => s + l.amount, 0);
    return { lines, assets, liabilities, own: assets - liabilities, safety, available: assets - liabilities - safety };
  };
  const shower = run ? run.rows.find(r => r.person === 'shower') : null;
  const caseNet = Object.fromEntries(estCaseRows.map(x => [x.code, x]));
  const myShare = complete ? shower.net + (Number(run.companyRetained) || 0)
    : estCaseRows.reduce((t, x) => t + x.caseNet * (Number(x.ratios?.shower) || 0), 0);
  return { today, ...totals(safeLines), estimate: totals(estLines), months, ownerDraw, overhead,
    open: open.map(x => ({ ...x, mine: caseNet[x.c.code] ? caseNet[x.c.code].caseNet * (Number(caseNet[x.c.code].ratios?.shower) || 0) : null })),
    run, people, complete, myShare, noEstimate: noEst.map(x => x.c), staleEstimates: withEst.filter(x => x.e.stale).map(x => x.c), overEstimates: withEst.filter(x => x.e.overCost).map(x => x.c),
    vatOverdue: vat.filter(r => r.overdueUnrecorded) };
}

// ── 寫入：項目、登錄本期、設定（只有 shower／nc） ──
function cashRequire() {
  if (cashCanAccess()) return true;
  showToast('您沒有此功能的權限', 'error');
  return false;
}

function cashCreateDefaults() {
  if (!cashRequire() || CASH_ITEMS.length) return;
  CASH_DEFAULT_ITEMS.forEach(d => {
    const row = { id: cashItemNextId++, amount: 0, asOfDate: '', include: true, monthlyPayment: 0, note: '', ...d };
    touchRowMeta(row, true);
    CASH_ITEMS.push(row);
  });
  recordAuditLog('create', 'cashItem', 'defaults', null, auditClone(CASH_ITEMS), { targetLabel: '資金試算預設項目', riskLevel: 'medium' });
  saveData();
  cashRender();
  showToast('已建立預設項目，請填入金額', 'success');
}

function cashStartEditItem(id) {
  if (!cashRequire()) return;
  cashEditingItemId = id;
  cashRender();
}

function cashSaveItem() {
  if (!cashRequire()) return;
  const v = id => document.getElementById(id)?.value ?? '';
  const kind = v('cash-item-kind');
  const name = v('cash-item-name').trim();
  if (!CASH_KINDS[kind]) { showToast('請選擇項目類型', 'error'); return; }
  if (!name) { showToast('請填寫項目名稱', 'error'); return; }
  const fields = {
    kind, name, note: v('cash-item-note').trim(),
    include: document.getElementById('cash-item-include')?.checked !== false,
    monthlyPayment: kind === 'lease' ? cashParse(v('cash-item-monthly')) : 0,
    payDay: kind === 'lease' ? Math.min(Math.max(parseInt(v('cash-item-payday')) || 1, 1), 28) : undefined,
    lastPayMonth: kind === 'lease' ? v('cash-item-last') : undefined,
  };
  if (kind === 'lease' && !fields.monthlyPayment) { showToast('租賃請填每期金額', 'error'); return; }
  const existing = cashEditingItemId !== 'new' ? CASH_ITEMS.find(i => String(i.id) === String(cashEditingItemId)) : null;
  if (existing) {
    const before = auditClone(existing);
    Object.assign(existing, fields);
    touchRowMeta(existing);
    recordAuditLog('update', 'cashItem', existing.id, before, auditClone(existing), { targetLabel: existing.name, riskLevel: 'medium' });
  } else {
    const row = { id: cashItemNextId++, amount: 0, asOfDate: '', ...fields };
    touchRowMeta(row, true);
    CASH_ITEMS.push(row);
    recordAuditLog('create', 'cashItem', row.id, null, auditClone(row), { targetLabel: row.name, riskLevel: 'medium' });
  }
  cashEditingItemId = null;
  saveData();
  cashRender();
  showToast('項目已儲存 ✓', 'success');
}

function cashDeleteItem(id) {
  if (!cashRequire()) return;
  const row = CASH_ITEMS.find(i => String(i.id) === String(id));
  if (!row || !confirm(`確定刪除「${row.name}」？已存的各期紀錄不受影響。`)) return;
  CASH_ITEMS.splice(CASH_ITEMS.indexOf(row), 1);
  auditDeletedRow('cashItem', row, row.name);
  cashEditingItemId = null;
  saveData();
  cashRender();
}

function cashSaveSettings() {
  if (!cashRequire()) return;
  const before = { ...CASH_SETTINGS };
  CASH_SETTINGS = {
    ...CASH_SETTINGS,
    reserveMonths: Math.min(Math.max(parseInt(document.getElementById('cash-set-months')?.value) || 0, 0), 24),
    ownerMonthlyDraw: Math.max(0, cashParse(document.getElementById('cash-set-draw')?.value)),
  };
  recordAuditLog('update', 'cashSettings', 'settings', before, { ...CASH_SETTINGS }, { targetLabel: '資金試算安全水位', riskLevel: 'medium' });
  saveData();
  cashRender();
  showToast('安全水位設定已儲存 ✓', 'success');
}

// 儲存銀行餘額：只更新手動項目的金額與餘額日期，不存成一期。
function cashSaveBalances() {
  if (!cashRequire()) return;
  const date = document.getElementById('cash-snap-date')?.value || cashToday();
  if (date > cashToday()) { showToast('餘額日期不能是未來日期', 'error'); return; }
  const before = auditClone(CASH_ITEMS);
  const savedAt = new Date().toISOString();
  CASH_ITEMS.forEach(i => {
    const el = document.getElementById(`cash-val-${i.id}`);
    if (!el) return;
    const value = cashParse(el.value);
    if (i.kind === 'lease') {
      if (value !== cashLeaseRemaining(i)) { i.amount = value; i.asOfDate = date; }
    } else {
      i.amount = value;
      i.asOfDate = date;
    }
    i.balanceSavedAt = savedAt;
    touchRowMeta(i);
  });
  Object.keys(cashDrafts).forEach(k => { if (k !== 'note') delete cashDrafts[k]; });
  recordAuditLog('update', 'cashItem', 'balances', before, auditClone(CASH_ITEMS), { targetLabel: `資金試算 銀行餘額 ${date}`, riskLevel: 'medium' });
  saveData();
  cashRender();
  showToast(`銀行餘額已儲存（${date}）✓`, 'success');
}

// 最近一次儲存銀行餘額的時間（舊資料沒有 balanceSavedAt 就用項目的更新時間）。
function cashBalanceSavedAt() {
  return CASH_ITEMS.filter(i => ['account', 'loan'].includes(i.kind) && i.include !== false)
    .map(i => i.balanceSavedAt || i.updatedAt || i.createdAt || '').filter(Boolean).sort().pop() || '';
}

// 儲存銀行餘額之後才記的收款／付款（可能還沒反映在銀行餘額裡）。
function cashMovesSince(since = cashBalanceSavedAt()) {
  if (!since) return [];
  const caseName = code => (typeof CASES !== 'undefined' ? CASES.find(c => c.code === code)?.name : '') || code || '';
  const moves = [];
  (typeof RECEIVABLES !== 'undefined' ? RECEIVABLES : []).forEach(x => {
    const amount = Math.round(Number(x.collectAmt) || 0);
    if (!(amount > 0) || String(x.updatedAt || x.createdAt || '') <= since) return;
    moves.push({ kind: 'in', id: x.id, date: x.collectDate || '', amount, label: [x.caseName || caseName(x.case), x.item].filter(Boolean).join(' '), at: x.updatedAt || x.createdAt });
  });
  (typeof PAYABLES !== 'undefined' ? PAYABLES : []).forEach(x => {
    if (x.status !== 'paid' || x.transferToLoanCase || String(x.updatedAt || x.createdAt || '') <= since) return;
    moves.push({ kind: 'out', id: x.id, date: x.doneDate || x.transferDate || '', amount: Math.round(Number(x.amount) || 0), label: [x.vendor, x.summary].filter(Boolean).join(' '), at: x.updatedAt || x.createdAt });
  });
  return moves.sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

function cashPendingDrafts() {
  return CASH_ITEMS.filter(i => Object.prototype.hasOwnProperty.call(cashDrafts, i.id) && cashParse(cashDrafts[i.id]) !== Math.round(cashItemValue(i))).length;
}

function cashFmtTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : `${localDateKey(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// 本期結算：全部帳確認過後，把當下整份試算凍結成一期。
function cashOpenSettle() {
  if (!cashRequire()) return;
  if (!CASH_ITEMS.length) { showToast('還沒有資金項目', 'error'); return; }
  const pending = cashPendingDrafts();
  if (pending) { showToast(`有 ${pending} 項金額還沒儲存，請先按「儲存銀行餘額」`, 'error'); return; }
  const pendingEst = cashPendingEstDrafts();
  if (pendingEst) { showToast(`有 ${pendingEst} 個個案預估還沒存，請先按該列的「存」`, 'error'); return; }
  const r = cashCompute();
  const savedAt = cashBalanceSavedAt();
  const moves = cashMovesSince(savedAt);
  const asOf = CASH_ITEMS.filter(i => ['account', 'loan'].includes(i.kind) && i.include !== false).map(i => i.asOfDate || '').filter(Boolean).sort();
  const inSum = moves.filter(m => m.kind === 'in').reduce((t, m) => t + m.amount, 0);
  const outSum = moves.filter(m => m.kind === 'out').reduce((t, m) => t + m.amount, 0);
  const row = (label, value, color = 'var(--text)') => `<div style="display:flex;justify-content:space-between;gap:12px;padding:3px 0"><span>${label}</span><b style="font-family:'DM Mono',monospace;color:${color}">${value}</b></div>`;
  const checks = [];
  checks.push(`銀行餘額：${asOf.length ? (asOf[0] === asOf[asOf.length - 1] ? `餘額日期 ${cashEsc(asOf[0])}` : `餘額日期 ${cashEsc(asOf[0])}～${cashEsc(asOf[asOf.length - 1])}`) : '還沒登錄'}，${savedAt ? `${cashEsc(cashFmtTime(savedAt))} 儲存` : '還沒儲存'}`);
  if (r.noEstimate.length) checks.push(`${r.noEstimate.length} 個未結算個案沒填預估，「含預估利潤」對這些個案照保守排除`);
  if (r.overEstimates.length) checks.push(`${r.overEstimates.map(c => cashEsc(c.name)).join('、')} 已記成本超過預估`);
  if (r.staleEstimates.length) checks.push(`${r.staleEstimates.map(c => cashEsc(c.name)).join('、')} 的預估超過 30 天沒更新`);
  if (r.vatOverdue.length) checks.push(`營業稅 ${r.vatOverdue.map(v => cashEsc(v.period)).join('、')} 已過申報期但沒登錄繳納，先當作未繳`);
  const moveList = moves.length ? `<div style="margin-top:10px;border:1px solid var(--warning);border-radius:8px;padding:10px 12px;background:var(--warning-bg,rgba(200,150,0,.08))">
      <div style="font-weight:600;margin-bottom:6px">⚠ 儲存銀行餘額之後又記了 ${moves.length} 筆收付款（收 ${cashMoney(inSum)}／付 ${cashMoney(outSum)}）</div>
      <div style="max-height:160px;overflow:auto;font-size:11px;line-height:1.7">${moves.map(m => `<div style="display:flex;justify-content:space-between;gap:10px"><span>${m.kind === 'in' ? '收款' : '付款'} #${cashEsc(m.id)} ${cashEsc(m.date)} ${cashEsc(m.label)}</span><span style="font-family:'DM Mono',monospace;color:${m.kind === 'in' ? 'var(--success)' : 'var(--error)'}">${m.kind === 'in' ? '+' : '−'}${cashMoney(m.amount)}</span></div>`).join('')}</div>
      <div style="font-size:11px;color:var(--text2);margin-top:6px">如果這些錢還沒算進銀行餘額，請先取消，更新銀行餘額後按「儲存銀行餘額」。</div>
      <label style="display:flex;gap:6px;align-items:center;margin-top:8px;font-size:12px"><input type="checkbox" id="cash-settle-moves-ok">這些收付款都已經反映在銀行餘額裡</label>
    </div>` : '<div style="margin-top:10px;font-size:11px;color:var(--text3)">儲存銀行餘額之後沒有新的收付款。</div>';
  document.getElementById('cash-settle-body').innerHTML = `
    <div style="font-size:12px;line-height:1.7;margin-bottom:10px">${checks.map(c => '・' + c).join('<br>')}</div>
    <div style="border:1px solid var(--border);border-radius:8px;padding:8px 12px;background:var(--surface2);font-size:12px">
      ${row('可用的錢', cashMoney(r.assets), 'var(--success)')}${row('不是自己的錢', cashMoney(r.liabilities), 'var(--error)')}
      ${row('自有資金（保守）', cashMoney(r.own), r.own < 0 ? 'var(--error)' : 'var(--success)')}${row('可動用金額（保守）', cashMoney(r.available), r.available < 0 ? 'var(--error)' : 'var(--accent)')}
      ${row('自有資金（含預估利潤）', cashMoney(r.estimate.own), r.estimate.own < 0 ? 'var(--error)' : 'var(--success)')}${row('可動用金額（含預估利潤）', cashMoney(r.estimate.available), r.estimate.available < 0 ? 'var(--error)' : 'var(--accent)')}
    </div>
    ${moveList}
    <div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap">
      <label style="font-size:11px;color:var(--text3)">結算日<br><input class="form-input" id="cash-settle-date" type="date" value="${r.today}" max="${r.today}"></label>
      <label style="font-size:11px;color:var(--text3);flex:1;min-width:200px">備註<br><input class="form-input" id="cash-settle-note" placeholder="例：11 月底結算，帳已核對"></label>
    </div>`;
  document.getElementById('cash-settle-body').dataset.moves = String(moves.length);
  openModal('modal-cash-settle');
}

function cashConfirmSettle() {
  if (!cashRequire()) return;
  const pending = cashPendingDrafts() + cashPendingEstDrafts();
  if (pending) { showToast(`有 ${pending} 項金額還沒儲存，請先儲存`, 'error'); return; }
  const date = document.getElementById('cash-settle-date')?.value || cashToday();
  if (date > cashToday()) { showToast('結算日不能是未來日期', 'error'); return; }
  const savedAt = cashBalanceSavedAt();
  const moves = cashMovesSince(savedAt);
  if (moves.length && !document.getElementById('cash-settle-moves-ok')?.checked) { showToast('請確認餘額儲存後的收付款都已反映在銀行餘額，或先更新銀行餘額', 'error'); return; }
  const result = cashCompute();
  const snap = {
    id: cashSnapNextId++, date, note: (document.getElementById('cash-settle-note')?.value || '').trim(),
    lines: result.lines, assets: result.assets, liabilities: result.liabilities, own: result.own,
    safety: result.safety, available: result.available, reserveMonths: result.months, ownerMonthlyDraw: result.ownerDraw,
    overheadAverage: Math.round(result.overhead.average), balanceSavedAt: savedAt, movesAfterBalance: moves.length,
    estimate: { lines: result.estimate.lines, assets: result.estimate.assets, liabilities: result.estimate.liabilities, own: result.estimate.own, available: result.estimate.available, myShare: Math.round(result.myShare), cases: result.open.filter(x => x.e).length },
  };
  touchRowMeta(snap, true);
  CASH_SNAPSHOTS.push(snap);
  recordAuditLog('create', 'cashSnapshot', snap.id, null, auditClone(snap), { targetLabel: `資金試算結算 ${date}`, riskLevel: 'high' });
  closeModal('modal-cash-settle');
  saveData();
  cashRender();
  showToast(`已完成 ${date} 結算 ✓`, 'success');
}

// ── 個案預估：輸入「還可收／還要付」，存成最終總收款／總成本，之後記收付款會自動遞減 ──
function cashPendingEstDrafts() {
  return Object.keys(cashDrafts).filter(k => /^est[RC]:/.test(k)).map(k => k.slice(5)).filter((v, i, a) => a.indexOf(v) === i).filter(code => {
    const c = CASES.find(x => x.code === code);
    if (!c) return false;
    const e = cashCaseEstimate(c);
    const cur = { R: e ? Math.round(e.remainingRevenue) : null, C: e ? Math.round(e.remainingCost) : null };
    return ['R', 'C'].some(k => {
      const key = `est${k}:${code}`;
      if (!Object.prototype.hasOwnProperty.call(cashDrafts, key)) return false;
      const raw = String(cashDrafts[key]).trim();
      return cur[k] == null ? raw !== '' : (raw === '' || cashParse(raw) !== cur[k]);
    });
  }).length;
}

function cashSaveEstimate(code) {
  if (!cashRequire()) return;
  const c = CASES.find(x => x.code === code);
  if (!c || !cashOpenCases().includes(c)) { showToast('這個個案已經結算，不需要預估', 'error'); return; }
  const rEl = document.getElementById(`cash-est-r-${code}`);
  const cEl = document.getElementById(`cash-est-c-${code}`);
  const rRaw = String(rEl?.value ?? '').trim();
  const cRaw = String(cEl?.value ?? '').trim();
  if (rRaw === '' || cRaw === '') { showToast('請填「預估還可收」和「預估還要付」（沒有就填 0）', 'error'); return; }
  const remR = cashParse(rRaw);
  const remC = cashParse(cRaw);
  if (remR < 0 || remC < 0) { showToast('預估金額不能是負數', 'error'); return; }
  const a = cashCaseActuals(c);
  const existing = cashEstimateRow(code);
  const before = existing ? auditClone(existing) : null;
  const fields = { caseCode: code, caseName: c.name, finalRevenue: Math.round(a.collected + remR), finalCost: Math.round(a.recordedCost + remC),
    baseCollected: Math.round(a.collected), baseCost: Math.round(a.recordedCost), date: cashToday() };
  if (existing) {
    Object.assign(existing, fields);
    touchRowMeta(existing);
    recordAuditLog('update', 'cashEstimate', existing.id, before, auditClone(existing), { targetLabel: `${c.name} 預估：還可收 ${cashMoney(remR)}、還要付 ${cashMoney(remC)}`, riskLevel: 'medium' });
  } else {
    const row = { id: cashEstNextId++, ...fields };
    touchRowMeta(row, true);
    CASH_ESTIMATES.push(row);
    recordAuditLog('create', 'cashEstimate', row.id, null, auditClone(row), { targetLabel: `${c.name} 預估：還可收 ${cashMoney(remR)}、還要付 ${cashMoney(remC)}`, riskLevel: 'medium' });
  }
  delete cashDrafts[`estR:${code}`];
  delete cashDrafts[`estC:${code}`];
  saveData();
  cashRender();
  showToast(`${c.name} 預估已儲存 ✓`, 'success');
}

function cashClearEstimate(code) {
  if (!cashRequire()) return;
  const row = cashEstimateRow(code);
  if (!row || !confirm(`清除「${row.caseName || code}」的預估？清除後「含預估利潤」對這個案照保守排除。`)) return;
  CASH_ESTIMATES.splice(CASH_ESTIMATES.indexOf(row), 1);
  auditDeletedRow('cashEstimate', row, `${row.caseName || code} 預估`);
  delete cashDrafts[`estR:${code}`];
  delete cashDrafts[`estC:${code}`];
  saveData();
  cashRender();
  showToast('已清除預估', 'success');
}

function cashSetLineMode(mode) {
  cashLineMode = mode === 'est' ? 'est' : 'safe';
  cashRender();
}

function cashDeleteSnapshot(id) {
  if (!cashRequire()) return;
  const row = CASH_SNAPSHOTS.find(s => String(s.id) === String(id));
  if (!row || !confirm(`確定刪除 ${row.date} 這次結算的紀錄？`)) return;
  CASH_SNAPSHOTS.splice(CASH_SNAPSHOTS.indexOf(row), 1);
  auditDeletedRow('cashSnapshot', row, `資金試算 ${row.date}`);
  if (String(cashViewSnapshotId) === String(id)) cashViewSnapshotId = null;
  saveData();
  cashRender();
}

function cashViewSnapshot(id) {
  cashViewSnapshotId = String(cashViewSnapshotId) === String(id) ? null : id;
  cashRender();
}

function cashSortedSnapshots() {
  return CASH_SNAPSHOTS.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)) || (Number(b.id) - Number(a.id)));
}

// ── 畫面 ──
function cashLinesTable(lines, title, total, color) {
  const rows = lines.map(l => `<tr style="border-bottom:1px solid var(--border)">
      <td style="padding:7px 12px;font-size:12px">${cashEsc(l.label)}${l.source === 'auto' ? ' <span style="font-size:10px;color:var(--accent)">自動</span>' : ''}
        ${l.detail ? `<div style="font-size:10px;color:var(--text3);margin-top:2px;line-height:1.5">${cashEsc(l.detail)}</div>` : ''}</td>
      <td style="padding:7px 12px;text-align:right;font-family:'DM Mono',monospace;font-size:12px;white-space:nowrap">${cashMoney(l.amount)}</td>
    </tr>`).join('') || '<tr><td colspan="2" style="padding:12px;color:var(--text3);font-size:12px;text-align:center">沒有項目</td></tr>';
  return `<div style="flex:1;min-width:300px;border:1px solid var(--border);border-radius:8px;overflow:hidden">
    <div style="padding:10px 12px;background:var(--surface2);font-size:13px;font-weight:600">${title}</div>
    <table style="width:100%;border-collapse:collapse"><tbody>${rows}</tbody>
      <tfoot><tr style="border-top:2px solid var(--border2);font-weight:700"><td style="padding:8px 12px">小計</td>
      <td style="padding:8px 12px;text-align:right;font-family:'DM Mono',monospace;color:${color}">${cashMoney(total)}</td></tr></tfoot></table>
  </div>`;
}

function cashRender() {
  const container = document.getElementById('cash-container');
  if (!container) return;
  if (!cashCanAccess()) { container.innerHTML = ''; return; }
  const r = cashCompute();
  const snaps = cashSortedSnapshots();
  const last = snaps[0];
  const diff = last ? r.own - (Number(last.own) || 0) : null;
  const kpi = (label, value, sub, color = 'var(--text)') => `<div class="kpi-card"><div class="kpi-label">${label}</div><div class="kpi-val" style="font-size:20px;color:${color}">${value}</div><div class="kpi-sub">${sub}</div></div>`;
  const warnings = [];
  if (!CASH_ITEMS.length) warnings.push(`還沒有資金項目。<button class="btn btn-primary btn-sm" onclick="cashCreateDefaults()">建立預設項目</button>（5 個公司帳戶、玉山借款；車租期票由應付帳款「期票分期」自動帶入）`);
  if (r.overEstimates.length) warnings.push(`${r.overEstimates.map(c => cashEsc(c.name)).join('、')} 已記的成本超過預估，「還要付」先算 0，請更新預估。`);
  if (r.staleEstimates.length) warnings.push(`${r.staleEstimates.map(c => cashEsc(c.name)).join('、')} 的預估超過 30 天沒更新。`);
  if (r.vatOverdue.length) warnings.push(`營業稅 ${r.vatOverdue.map(v => v.period).join('、')} 已過申報期但沒有登錄繳納，先當作未繳扣除；如果已經繳了，請到稅務管理登錄。`);
  const stale = CASH_ITEMS.filter(i => ['account', 'loan'].includes(i.kind) && i.include !== false && (!i.asOfDate || i.asOfDate < localDateKey(new Date(Date.now() - 35 * 86400000))));
  const movesAfter = CASH_ITEMS.length ? cashMovesSince() : [];
  if (movesAfter.length) warnings.push(`銀行餘額 ${cashEsc(cashFmtTime(cashBalanceSavedAt()))} 儲存後，又記了 ${movesAfter.length} 筆收付款（收 ${cashMoney(movesAfter.filter(m => m.kind === 'in').reduce((t, m) => t + m.amount, 0))}／付 ${cashMoney(movesAfter.filter(m => m.kind === 'out').reduce((t, m) => t + m.amount, 0))}），銀行餘額可能要重新登錄。`);
  if (CASH_ITEMS.length && stale.length) warnings.push(`${stale.map(i => cashEsc(i.name)).join('、')} 超過 35 天沒有登錄，數字可能已經不準。`);

  const kindOrder = Object.keys(CASH_KINDS);
  const draftOf = i => {
    const saved = Math.round(cashItemValue(i));
    const has = Object.prototype.hasOwnProperty.call(cashDrafts, i.id);
    return { saved, text: has ? cashDrafts[i.id] : saved.toLocaleString('zh-TW'), changed: has && cashParse(cashDrafts[i.id]) !== saved };
  };
  const pending = CASH_ITEMS.filter(i => draftOf(i).changed).length;
  const entryRows = CASH_ITEMS.slice().sort((a, b) => kindOrder.indexOf(a.kind) - kindOrder.indexOf(b.kind)).map(i => { const d = draftOf(i); return `<tr style="border-bottom:1px solid var(--border)">
      <td style="padding:6px 10px;font-size:12px">${cashEsc(i.name)}<div style="font-size:10px;color:var(--text3)">${CASH_KINDS[i.kind]?.label || ''}${i.include === false ? '・不計入' : ''}${i.asOfDate ? `・上次 ${i.asOfDate}` : ''}</div></td>
      <td style="padding:6px 10px;width:170px"><input class="form-input" id="cash-val-${i.id}" type="text" inputmode="numeric" value="${cashEsc(d.text)}" data-saved="${d.saved}" oninput="cashSetDraft(${i.id},this)" style="text-align:right${d.changed ? ';border-color:var(--warning)' : ''}"></td>
      <td style="padding:6px 10px;white-space:nowrap"><button class="btn btn-ghost btn-sm" onclick="cashStartEditItem(${i.id})" title="改名稱、類型、是否計入；不會儲存金額">項目設定</button></td>
    </tr>`; }).join('');
  const editing = cashEditingItemId === 'new' ? {} : (cashEditingItemId != null ? CASH_ITEMS.find(i => String(i.id) === String(cashEditingItemId)) : null);
  const itemForm = editing ? `<div style="border:1px solid var(--accent);border-radius:8px;padding:12px;margin-top:10px;background:var(--surface2)">
      <div style="font-weight:600;font-size:13px;margin-bottom:8px">${cashEditingItemId === 'new' ? '新增項目' : '項目設定：' + cashEsc(editing.name)}</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
        <label style="font-size:11px;color:var(--text3)">類型<br><select class="form-select" id="cash-item-kind" onchange="this.closest('div').querySelectorAll('.cash-lease-only').forEach(e=>e.style.display=this.value==='lease'?'':'none')">${Object.entries(CASH_KINDS).map(([k, v]) => `<option value="${k}" ${editing.kind === k ? 'selected' : ''}>${v.label}（${v.side === 'asset' ? '＋' : '－'}）</option>`).join('')}</select></label>
        <label style="font-size:11px;color:var(--text3)">名稱<br><input class="form-input" id="cash-item-name" value="${cashEsc(editing.name || '')}" style="width:180px"></label>
        <label class="cash-lease-only" style="font-size:11px;color:var(--text3);${editing.kind === 'lease' ? '' : 'display:none'}">每期金額<br><input class="form-input" id="cash-item-monthly" value="${editing.monthlyPayment ? Number(editing.monthlyPayment).toLocaleString('zh-TW') : ''}" style="width:110px"></label>
        <label class="cash-lease-only" style="font-size:11px;color:var(--text3);${editing.kind === 'lease' ? '' : 'display:none'}">每月扣款日<br><input class="form-input" id="cash-item-payday" type="number" min="1" max="28" value="${editing.payDay || ''}" style="width:70px"></label>
        <label class="cash-lease-only" style="font-size:11px;color:var(--text3);${editing.kind === 'lease' ? '' : 'display:none'}">最後一期<br><input class="form-input" id="cash-item-last" type="month" value="${cashEsc(editing.lastPayMonth || '')}"></label>
        <label style="font-size:11px;color:var(--text3)">備註<br><input class="form-input" id="cash-item-note" value="${cashEsc(editing.note || '')}" style="width:180px"></label>
        <label style="font-size:12px;display:flex;align-items:center;gap:4px"><input type="checkbox" id="cash-item-include" ${editing.include === false ? '' : 'checked'}>計入試算</label>
        <button class="btn btn-primary btn-sm" onclick="cashSaveItem()">儲存</button>
        <button class="btn btn-ghost btn-sm" onclick="cashEditingItemId=null;cashRender()">取消</button>
        ${cashEditingItemId !== 'new' ? `<button class="btn btn-ghost btn-sm" style="color:var(--error)" onclick="cashDeleteItem(${editing.id})">刪除項目</button>` : ''}
      </div>
      <div style="font-size:11px;color:var(--text3);margin-top:6px">租賃：在左邊登錄目前剩餘金額，之後每過一個扣款日自動少一期，扣到最後一期為止。私人帳戶可以加成「銀行帳戶」並取消「計入試算」。</div>
    </div>` : '';

  const estInput = (kind, code, value, hint = '') => {
    const key = `est${kind}:${code}`;
    const has = Object.prototype.hasOwnProperty.call(cashDrafts, key);
    const text = has ? cashDrafts[key] : (value == null ? '' : Math.round(value).toLocaleString('zh-TW'));
    const changed = has && (value == null ? String(cashDrafts[key]).trim() !== '' : cashParse(cashDrafts[key]) !== Math.round(value));
    return `<input class="form-input" id="cash-est-${kind === 'R' ? 'r' : 'c'}-${cashEsc(code)}" type="text" inputmode="numeric" placeholder="${hint ? cashEsc(hint) : '未填'}" title="${hint ? cashEsc('未填；' + hint + '（合約總額−已收，只是參考）') : ''}" value="${cashEsc(text)}" oninput="cashSetDraft('${key}',this)" style="width:110px;text-align:right;padding:4px 8px;height:auto${changed ? ';border-color:var(--warning)' : ''}">`;
  };
  const num = v => `<td style="padding:6px 10px;text-align:right;font-family:'DM Mono',monospace;font-size:12px">${v}</td>`;
  const wipRows = r.open.map(x => {
    const { c, a, e } = x;
    const flag = e ? [e.overCost ? '<span style="color:var(--error)">成本已超過預估</span>' : '', e.stale ? '<span style="color:var(--warning)">超過 30 天</span>' : ''].filter(Boolean).join('<br>') : '';
    return `<tr style="border-bottom:1px solid var(--border)">
      <td style="padding:6px 10px;font-size:12px">${cashEsc(c.name)}<div style="font-size:10px;color:var(--text3);font-family:'DM Mono',monospace">${cashEsc(c.code)}</div></td>
      ${num(cashMoney(a.collected))}
      ${num(cashMoney(a.recordedCost))}
      <td style="padding:6px 10px;text-align:right">${estInput('R', c.code, e ? e.remainingRevenue : null, !e && typeof caseContractTotal === 'function' && caseContractTotal(c) > 0 ? `參考 ${Math.max(0, Math.round(caseContractTotal(c) - a.collected)).toLocaleString('zh-TW')}` : '')}</td>
      <td style="padding:6px 10px;text-align:right">${estInput('C', c.code, e ? e.remainingCost : null)}</td>
      <td style="padding:6px 10px;text-align:right;font-family:'DM Mono',monospace;font-size:12px;font-weight:700;color:${!e ? 'var(--text3)' : e.gross < 0 ? 'var(--error)' : 'var(--success)'}">${e ? cashMoney(e.gross) : '—'}</td>
      ${num(x.mine == null ? '—' : cashMoney(x.mine))}
      <td style="padding:6px 10px;font-size:11px;color:var(--text3);white-space:nowrap">${e ? cashEsc(e.row.date || '') : ''}${flag ? '<br>' + flag : ''}</td>
      <td style="padding:6px 10px;white-space:nowrap"><button class="btn btn-primary btn-sm" onclick="cashSaveEstimate('${cashEsc(c.code)}')">存</button>${e ? `<button class="btn btn-ghost btn-sm" onclick="cashClearEstimate('${cashEsc(c.code)}')">清除</button>` : ''}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="9" style="padding:12px;text-align:center;color:var(--text3);font-size:12px">沒有未結算個案</td></tr>';
  const estSummary = r.run
    ? `有預估的 ${r.open.filter(x => x.e).length} 案：預估毛利 ${cashMoney(r.open.filter(x => x.e).reduce((t, x) => t + x.e.gross, 0))}；${r.people.map(p => `${cashEsc(p.name)} 還要分 ${cashMoney(p.owed)}`).join('、') || '沒有其他人要分'}；<b>李鎮宇${r.complete ? '（含公司保留）' : ''}預估可分 ${cashMoney(r.myShare)}</b>。`
      + `未結算的公司開銷 ${cashMoney(r.run.overheadTotal)}（${cashEsc(r.run.claimMonths)}）照毛利比例分攤到全部未結算個案（只算到這個月，之後的攤提不算）。`
      + (r.complete ? '已扣彭、連已領薪資和已付分潤款。' : `還有 ${r.noEstimate.length} 案沒填預估：這些個案在「含預估利潤」裡照保守排除，分潤先不扣已領薪資和已付分潤款，全部填完後才精準。`)
    : '還沒有填任何預估。填了「還可收」「還要付」的個案，會照淨利潤儀表的規則（公司開銷分攤、預留營所稅、扣已付薪資和分潤款）算出每個人預估可分多少。';

  const viewing = cashViewSnapshotId != null ? CASH_SNAPSHOTS.find(s => String(s.id) === String(cashViewSnapshotId)) : null;
  const historyRows = snaps.map((s, idx) => {
    const prev = snaps[idx + 1];
    const d = prev ? (Number(s.own) || 0) - (Number(prev.own) || 0) : null;
    return `<tr style="border-bottom:1px solid var(--border)">
      <td style="padding:6px 10px;font-size:12px;font-family:'DM Mono',monospace">${cashEsc(s.date)}</td>
      <td style="padding:6px 10px;text-align:right;font-family:'DM Mono',monospace;font-size:12px">${cashMoney(s.assets)}</td>
      <td style="padding:6px 10px;text-align:right;font-family:'DM Mono',monospace;font-size:12px">${cashMoney(s.liabilities)}</td>
      <td style="padding:6px 10px;text-align:right;font-family:'DM Mono',monospace;font-size:12px;font-weight:700">${cashMoney(s.own)}</td>
      <td style="padding:6px 10px;text-align:right;font-family:'DM Mono',monospace;font-size:12px;color:${d == null ? 'var(--text3)' : d < 0 ? 'var(--error)' : 'var(--success)'}">${d == null ? '—' : cashMoney(d)}</td>
      <td style="padding:6px 10px;text-align:right;font-family:'DM Mono',monospace;font-size:12px;color:${s.available < 0 ? 'var(--error)' : 'var(--text)'}">${cashMoney(s.available)}</td>
      <td style="padding:6px 10px;text-align:right;font-family:'DM Mono',monospace;font-size:12px;color:var(--text2)">${s.estimate ? cashMoney(s.estimate.own) : '—'}</td>
      <td style="padding:6px 10px;font-size:11px;color:var(--text3)">${cashEsc(s.createdBy || '')}${s.note ? '・' + cashEsc(s.note) : ''}</td>
      <td style="padding:6px 10px;white-space:nowrap"><button class="btn btn-ghost btn-sm" onclick="cashViewSnapshot(${s.id})">${String(cashViewSnapshotId) === String(s.id) ? '收合' : '明細'}</button><button class="btn btn-ghost btn-sm" style="color:var(--error)" onclick="cashDeleteSnapshot(${s.id})">刪除</button></td>
    </tr>${viewing && String(viewing.id) === String(s.id) ? `<tr><td colspan="9" style="padding:10px;background:var(--surface2)"><div style="display:flex;gap:12px;flex-wrap:wrap">
      ${cashLinesTable((s.lines || []).filter(l => l.side === 'asset'), `${cashEsc(s.date)} 可用的錢`, s.assets, 'var(--success)')}
      ${cashLinesTable((s.lines || []).filter(l => l.side === 'liability'), `${cashEsc(s.date)} 不是自己的錢`, s.liabilities, 'var(--error)')}</div></td></tr>` : ''}`;
  }).join('') || '<tr><td colspan="9" style="padding:12px;text-align:center;color:var(--text3);font-size:12px">還沒有結算過</td></tr>';

  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px">
      <div><div style="font-size:16px;font-weight:800">資金試算</div><div style="font-size:12px;color:var(--text3);margin-top:4px">估算一律偏保守（寧可算低）。下面數字即時計算：銀行餘額用最近儲存的，自動項目即時取自應收、應付、淨利潤儀表與稅務管理；只顯示，不回寫任何帳務資料。帳都確認過後按「本期結算」存成一期。</div></div>
      <div><button class="btn btn-primary btn-sm" onclick="cashOpenSettle()" ${CASH_ITEMS.length ? '' : 'disabled'}>本期結算</button></div>
    </div>
    ${warnings.length ? `<div style="border:1px solid var(--warning);background:var(--warning-bg,rgba(200,150,0,.08));border-radius:8px;padding:10px 12px;margin-bottom:12px;font-size:12px;line-height:1.7">${warnings.map(w => '⚠ ' + w).join('<br>')}</div>` : ''}
    <div class="profit-kpi-grid" style="margin-bottom:14px">
      ${kpi('自有資金（保守）', cashMoney(r.own), `排除未結算個案；含預估利潤 <b>${cashMoney(r.estimate.own)}</b>`, r.own < 0 ? 'var(--error)' : 'var(--success)')}
      ${kpi('安全水位', cashMoney(r.safety), `${r.months} 個月 ×（公司開銷月均 ${cashMoney(r.overhead.average)} ＋ 老闆每月 ${cashMoney(r.ownerDraw)}）`)}
      ${kpi('可動用金額（保守）', cashMoney(r.available), `${r.available < 0 ? '低於安全水位，先不要動用' : '自有資金扣掉安全水位後'}；含預估利潤 <b>${cashMoney(r.estimate.available)}</b>`, r.available < 0 ? 'var(--error)' : 'var(--accent)')}
      ${kpi('與上次結算差額', diff == null ? '—' : cashMoney(diff), last ? `保守；上次結算 ${cashEsc(last.date)} 自有資金 ${cashMoney(last.own)}` : '結算過一次後才有比較', diff == null ? 'var(--text3)' : diff < 0 ? 'var(--error)' : 'var(--success)')}
    </div>
    <div style="display:flex;gap:6px;align-items:center;margin-bottom:8px;font-size:12px">
      <span style="color:var(--text3)">明細：</span>
      <button class="btn btn-sm ${cashLineMode === 'safe' ? 'btn-primary' : 'btn-ghost'}" id="cash-mode-safe" onclick="cashSetLineMode('safe')">保守（排除未結算個案）</button>
      <button class="btn btn-sm ${cashLineMode === 'est' ? 'btn-primary' : 'btn-ghost'}" id="cash-mode-est" onclick="cashSetLineMode('est')">含預估利潤</button>
    </div>
    <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start;margin-bottom:16px">
      ${(() => { const v = cashLineMode === 'est' ? r.estimate : r; return cashLinesTable(v.lines.filter(l => l.side === 'asset'), '可用的錢（＋）', v.assets, 'var(--success)') + cashLinesTable(v.lines.filter(l => l.side === 'liability'), '不是自己的錢（－）', v.liabilities, 'var(--error)'); })()}
    </div>
    <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start;margin-bottom:16px">
      <div style="flex:1;min-width:340px;border:1px solid var(--border);border-radius:8px;overflow:hidden">
        <div style="padding:10px 12px;background:var(--surface2);font-size:13px;font-weight:600;display:flex;justify-content:space-between;align-items:center;gap:8px">
          <span>登錄銀行餘額</span><button class="btn btn-ghost btn-sm" onclick="cashStartEditItem('new')">＋ 新增項目</button></div>
        <table style="width:100%;border-collapse:collapse"><tbody>${entryRows || '<tr><td style="padding:12px;color:var(--text3);font-size:12px">沒有項目</td></tr>'}</tbody></table>
        <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;padding:10px 12px;border-top:1px solid var(--border)">
          <label style="font-size:11px;color:var(--text3)">餘額日期<br><input class="form-input" id="cash-snap-date" type="date" value="${cashEsc(cashDrafts.date || r.today)}" max="${r.today}" oninput="cashSetDraft('date',this)"></label>
          <div style="flex:1;font-size:11px;color:var(--text3);padding-bottom:6px">${cashBalanceSavedAt() ? `上次儲存 ${cashEsc(cashFmtTime(cashBalanceSavedAt()))}` : ''}</div>
          <button class="btn btn-primary btn-sm" onclick="cashSaveBalances()" ${CASH_ITEMS.length ? '' : 'disabled'}>儲存銀行餘額</button>
        </div>
        <div id="cash-draft-hint" style="padding:0 12px 8px;font-size:11px;color:${pending ? 'var(--warning)' : 'var(--text3)'}">${pending ? `有 ${pending} 項金額還沒存（黃框），` : ''}金額填完按「儲存銀行餘額」才會儲存，不會存成一期；帳都確認過後再按上方「本期結算」。「項目設定」只改名稱、類型和是否計入，不會存金額。</div>
        <div style="padding:0 12px 10px">${itemForm}</div>
      </div>
      <div style="width:300px;border:1px solid var(--border);border-radius:8px;overflow:hidden">
        <div style="padding:10px 12px;background:var(--surface2);font-size:13px;font-weight:600">安全水位設定</div>
        <div style="padding:10px 12px;display:flex;flex-direction:column;gap:8px;font-size:12px">
          <label>保留幾個月<br><input class="form-input" id="cash-set-months" type="number" min="0" max="24" value="${r.months}"></label>
          <label>老闆每月領款<br><input class="form-input" id="cash-set-draw" value="${r.ownerDraw.toLocaleString('zh-TW')}"></label>
          <div style="font-size:11px;color:var(--text3)">公司開銷月均取 ${r.overhead.months.join('、') || '（沒有資料）'}，含員工薪資。</div>
          <button class="btn btn-ghost btn-sm" onclick="cashSaveSettings()">儲存設定</button>
        </div>
      </div>
    </div>
    <div style="border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-bottom:16px">
      <div style="padding:10px 12px;background:var(--surface2);font-size:13px;font-weight:600">未結算個案預估（財務填「還可收」「還要付」；已收、已記成本從應收、應付、費用即時抓）</div>
      <div style="padding:8px 12px;font-size:12px;line-height:1.7;border-bottom:1px solid var(--border)" id="cash-est-summary">${estSummary}</div>
      <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">
        <thead><tr style="border-bottom:1px solid var(--border2)">${['個案', '已收', '已記成本', '預估還可收', '預估還要付', '預估毛利', '李鎮宇可分', '預估日', ''].map((h, i) => `<th style="padding:6px 10px;font-size:11px;color:var(--text3);text-align:${i && i < 7 ? 'right' : 'left'}">${h}</th>`).join('')}</tr></thead>
        <tbody>${wipRows}</tbody></table></div>
      <div style="padding:8px 12px;font-size:11px;color:var(--text3);line-height:1.6">還可收＝追加減後、扣掉已收，還能收多少（含已開票未收、尾款、保固款）；還要付＝還沒進系統的廠商成本和當案費用。存的是最終總收款／總成本，之後每記一筆收款或付款，「還可收」「還要付」會自動減少。已記成本含已付、已核准、待審核的工程款和已核准費用。預估毛利已扣稅務成本（跟成本控制表同算法）。</div>
    </div>
    <div style="border:1px solid var(--border);border-radius:8px;overflow:hidden">
      <div style="padding:10px 12px;background:var(--surface2);font-size:13px;font-weight:600">歷史結算</div>
      <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">
        <thead><tr style="border-bottom:1px solid var(--border2)">${['結算日', '可用的錢', '不是自己的錢', '自有資金', '與上次差額', '可動用金額', '含預估自有資金', '結算人', ''].map((h, i) => `<th style="padding:6px 10px;font-size:11px;color:var(--text3);text-align:${i && i < 7 ? 'right' : 'left'}">${h}</th>`).join('')}</tr></thead>
        <tbody>${historyRows}</tbody></table></div>
    </div>`;
}
