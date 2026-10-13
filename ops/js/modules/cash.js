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
let cashViewSnapshotId = null;

(function cashHookSnapshot() {
  const originalCreate = window.createDataSnapshot;
  window.createDataSnapshot = function () {
    tagCompany(CASH_ITEMS);
    tagCompany(CASH_SNAPSHOTS);
    const snapshot = originalCreate.apply(this, arguments);
    snapshot.CASH_ITEMS = CASH_ITEMS;
    snapshot.CASH_SNAPSHOTS = CASH_SNAPSHOTS;
    snapshot.CASH_SETTINGS = CASH_SETTINGS;
    snapshot.cashItemNextId = cashItemNextId;
    snapshot.cashSnapNextId = cashSnapNextId;
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
    }
    return result;
  };
  OPS_CLOUD_ROW_MERGE_CONFIGS.push({ collection: 'CASH_ITEMS', nextIdField: 'cashItemNextId', label: '資金試算項目', reassignIdOnNewCollision: true });
  OPS_CLOUD_ROW_MERGE_CONFIGS.push({ collection: 'CASH_SNAPSHOTS', nextIdField: 'cashSnapNextId', label: '資金試算期別', reassignIdOnNewCollision: true });
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
  { kind: 'lease',   name: 'M340i 租金', payDay: 5, lastPayMonth: '2027-10' },
  { kind: 'lease',   name: 'GOLF R 租金', payDay: 25, lastPayMonth: '2027-09' },
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
function cashCaseCostIncurred(code) {
  const payables = PAYABLES.filter(p => p.case === code && ['paid', 'approved', 'pending'].includes(p.status) && isProjectCostPayment(p))
    .reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const expenses = EXPENSES.filter(e => e.caseKey === code && e.status === 'approved' && e.postCloseTreatment !== 'company_absorb')
    .reduce((s, e) => s + (Number(e.amount) || 0), 0);
  return payables + expenses;
}

function cashWipRows() {
  const open = CASES.filter(c => c && c.status !== '結案' && !c.psSettled && (Number(c.amount) || 0) > 0);
  return open.map(c => {
    const contract = Number(c.amount) || 0;
    const collected = caseCollectedAmount(c.code);
    const hasMargin = c.estMarginPct !== undefined && c.estMarginPct !== null && c.estMarginPct !== '' && Number.isFinite(Number(c.estMarginPct));
    const needsMargin = !c.excludeFromProfitReports;
    if (!hasMargin) return { code: c.code, name: c.name, contract, collected, hasMargin: false, needsMargin, overbilling: 0 };
    const margin = Math.min(Math.max(Number(c.estMarginPct), 0), 99) / 100;
    const estCost = contract * (1 - margin);
    const cost = cashCaseCostIncurred(c.code);
    const pct = estCost > 0 ? Math.min(1, cost / estCost) : 1;
    const earned = contract * pct;
    return { code: c.code, name: c.name, contract, collected, hasMargin: true, needsMargin, margin, estCost, cost, pct, earned, overbilling: Math.max(0, collected - earned) };
  });
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

// ── 彭、連未領分潤：已結算未付的在應付裡；這裡是淨利潤儀表的未結算預估，扣回已計入超前收款的部分 ──
function cashProfitShareRows(wipRows) {
  const data = psComputeData();
  const over = Object.fromEntries(wipRows.filter(w => w.overbilling > 0).map(w => [w.code, w.overbilling]));
  return data.rows.filter(r => r.person !== 'shower').map(r => {
    const overlap = data.caseRows.reduce((s, c) => {
      if (!over[c.code] || !(c.gross > 0)) return s;
      const netFactor = Math.min(1, Math.max(0, c.caseNet / c.gross));
      return s + over[c.code] * (c.ratios?.[r.person] || 0) * netFactor;
    }, 0);
    const preview = Number(r.unpaid) || 0;
    return { person: r.person, name: r.name || psPersonName(r.person), preview, overlap, owed: Math.max(0, preview - overlap) };
  }).filter(r => r.preview > 0.5 || r.owed > 0.5);
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
  const lines = [];
  const add = (side, group, label, amount, detail = '', source = 'manual') => lines.push({ side, group, label, amount: Math.round(Number(amount) || 0), detail, source });

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
  const approved = PAYABLES.filter(p => p.status === 'approved');
  const pending = PAYABLES.filter(p => p.status === 'pending');
  add('liability', '應付', `已核准未付（${approved.length} 筆）`, approved.reduce((s, p) => s + (Number(p.amount) || 0), 0), '含已結算未付的分潤結清款', 'auto');
  add('liability', '應付', `待審核請款（${pending.length} 筆）`, pending.reduce((s, p) => s + (Number(p.amount) || 0), 0), '保守起見一併扣除', 'auto');
  const wip = cashWipRows();
  cashProfitShareRows(wip).forEach(r => add('liability', '未領分潤', `${r.name} 未結算預估分潤`, r.owed,
    `淨利潤儀表預估 ${cashMoney(r.preview)}${r.overlap > 0.5 ? `，扣回已計入超前收款的部分 ${cashMoney(r.overlap)}` : ''}`, 'auto'));
  const vat = cashVatRows(today);
  add('liability', '稅金', '預留營業稅', vat.reduce((s, r) => s + r.owed, 0),
    vat.map(r => `${r.period} ${cashMoney(r.owed)}${r.overdueUnrecorded ? '（已過申報期、未登錄繳納）' : ''}`).join('；') || '今年各期都已繳足', 'auto');
  const income = cashIncomeTax(today);
  add('liability', '稅金', '預留營所稅', income.open + income.formal, `未結算個案預估 ${cashMoney(income.open)}；已結算未繳 ${cashMoney(income.formal)}`, 'auto');
  const over = wip.filter(w => w.overbilling > 0.5);
  add('liability', '進行中個案', `超前收款（${over.length} 案）`, over.reduce((s, w) => s + w.overbilling, 0),
    over.map(w => `${w.name} ${cashMoney(w.overbilling)}`).join('；'), 'auto');
  items.filter(i => i.kind === 'reserve' && i.include !== false).forEach(i => add('liability', '其他預留', i.name, cashItemValue(i), i.note || ''));

  const assets = lines.filter(l => l.side === 'asset').reduce((s, l) => s + l.amount, 0);
  const liabilities = lines.filter(l => l.side === 'liability').reduce((s, l) => s + l.amount, 0);
  const own = assets - liabilities;
  const months = Math.max(0, Number(CASH_SETTINGS.reserveMonths) || 0);
  const ownerDraw = Math.max(0, Number(CASH_SETTINGS.ownerMonthlyDraw) || 0);
  const overhead = cashMonthlyOverhead(today);
  const safety = Math.round(months * (overhead.average + ownerDraw));
  return { today, lines, assets, liabilities, own, safety, available: own - safety, months, ownerDraw, overhead, wip,
    missingMargin: wip.filter(w => !w.hasMargin && w.needsMargin), vatOverdue: vat.filter(r => r.overdueUnrecorded) };
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

// 登錄本期：更新手動項目的金額與登錄日，並把當下整份試算凍結成一期。
function cashSaveSnapshot() {
  if (!cashRequire()) return;
  const date = document.getElementById('cash-snap-date')?.value || cashToday();
  if (date > cashToday()) { showToast('登錄日不能是未來日期', 'error'); return; }
  const before = auditClone(CASH_ITEMS);
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
    touchRowMeta(i);
  });
  const result = cashCompute();
  const snap = {
    id: cashSnapNextId++, date, note: (document.getElementById('cash-snap-note')?.value || '').trim(),
    lines: result.lines, assets: result.assets, liabilities: result.liabilities, own: result.own,
    safety: result.safety, available: result.available, reserveMonths: result.months, ownerMonthlyDraw: result.ownerDraw,
    overheadAverage: Math.round(result.overhead.average),
  };
  touchRowMeta(snap, true);
  CASH_SNAPSHOTS.push(snap);
  recordAuditLog('create', 'cashSnapshot', snap.id, before, auditClone(snap), { targetLabel: `資金試算 ${date}`, riskLevel: 'high' });
  saveData();
  cashRender();
  showToast(`已存成 ${date} 這一期 ✓`, 'success');
}

function cashDeleteSnapshot(id) {
  if (!cashRequire()) return;
  const row = CASH_SNAPSHOTS.find(s => String(s.id) === String(id));
  if (!row || !confirm(`確定刪除 ${row.date} 這一期的紀錄？`)) return;
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
  if (!CASH_ITEMS.length) warnings.push(`還沒有資金項目。<button class="btn btn-primary btn-sm" onclick="cashCreateDefaults()">建立預設項目</button>（5 個公司帳戶、玉山借款、M340i、GOLF R 租金）`);
  if (r.missingMargin.length) warnings.push(`${r.missingMargin.length} 個進行中個案還沒填預估毛利率，超前收款沒有算進去：${r.missingMargin.map(w => `<a href="#" onclick="openEditCase('${cashEsc(w.code)}');return false">${cashEsc(w.name)}</a>`).join('、')}`);
  if (r.vatOverdue.length) warnings.push(`營業稅 ${r.vatOverdue.map(v => v.period).join('、')} 已過申報期但沒有登錄繳納，先當作未繳扣除；如果已經繳了，請到稅務管理登錄。`);
  const stale = CASH_ITEMS.filter(i => ['account', 'loan'].includes(i.kind) && i.include !== false && (!i.asOfDate || i.asOfDate < localDateKey(new Date(Date.now() - 35 * 86400000))));
  if (CASH_ITEMS.length && stale.length) warnings.push(`${stale.map(i => cashEsc(i.name)).join('、')} 超過 35 天沒有登錄，數字可能已經不準。`);

  const kindOrder = Object.keys(CASH_KINDS);
  const entryRows = CASH_ITEMS.slice().sort((a, b) => kindOrder.indexOf(a.kind) - kindOrder.indexOf(b.kind)).map(i => `<tr style="border-bottom:1px solid var(--border)">
      <td style="padding:6px 10px;font-size:12px">${cashEsc(i.name)}<div style="font-size:10px;color:var(--text3)">${CASH_KINDS[i.kind]?.label || ''}${i.include === false ? '・不計入' : ''}${i.asOfDate ? `・上次 ${i.asOfDate}` : ''}</div></td>
      <td style="padding:6px 10px;width:170px"><input class="form-input" id="cash-val-${i.id}" type="text" inputmode="numeric" value="${Math.round(cashItemValue(i)).toLocaleString('zh-TW')}" style="text-align:right"></td>
      <td style="padding:6px 10px;white-space:nowrap"><button class="btn btn-ghost btn-sm" onclick="cashStartEditItem(${i.id})">設定</button></td>
    </tr>`).join('');
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

  const wipRows = r.wip.filter(w => w.hasMargin || w.needsMargin).map(w => `<tr style="border-bottom:1px solid var(--border)">
      <td style="padding:6px 10px;font-size:12px">${cashEsc(w.name)}</td>
      <td style="padding:6px 10px;text-align:right;font-family:'DM Mono',monospace;font-size:12px">${cashMoney(w.contract)}</td>
      <td style="padding:6px 10px;text-align:right;font-size:12px">${w.hasMargin ? (w.margin * 100).toFixed(1) + '%' : `<a href="#" onclick="openEditCase('${cashEsc(w.code)}');return false" style="color:${w.needsMargin ? 'var(--error)' : 'var(--text3)'}">${w.needsMargin ? '未填' : '—'}</a>`}</td>
      <td style="padding:6px 10px;text-align:right;font-family:'DM Mono',monospace;font-size:12px">${w.hasMargin ? cashMoney(w.estCost) : '—'}</td>
      <td style="padding:6px 10px;text-align:right;font-family:'DM Mono',monospace;font-size:12px">${w.hasMargin ? cashMoney(w.cost) : '—'}</td>
      <td style="padding:6px 10px;text-align:right;font-size:12px">${w.hasMargin ? Math.round(w.pct * 100) + '%' : '—'}</td>
      <td style="padding:6px 10px;text-align:right;font-family:'DM Mono',monospace;font-size:12px">${w.hasMargin ? cashMoney(w.earned) : '—'}</td>
      <td style="padding:6px 10px;text-align:right;font-family:'DM Mono',monospace;font-size:12px">${cashMoney(w.collected)}</td>
      <td style="padding:6px 10px;text-align:right;font-family:'DM Mono',monospace;font-size:12px;font-weight:700;color:${w.overbilling > 0 ? 'var(--error)' : 'var(--text3)'}">${w.hasMargin ? cashMoney(w.overbilling) : '—'}</td>
    </tr>`).join('') || '<tr><td colspan="9" style="padding:12px;text-align:center;color:var(--text3);font-size:12px">沒有進行中個案</td></tr>';

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
      <td style="padding:6px 10px;font-size:11px;color:var(--text3)">${cashEsc(s.createdBy || '')}${s.note ? '・' + cashEsc(s.note) : ''}</td>
      <td style="padding:6px 10px;white-space:nowrap"><button class="btn btn-ghost btn-sm" onclick="cashViewSnapshot(${s.id})">${String(cashViewSnapshotId) === String(s.id) ? '收合' : '明細'}</button><button class="btn btn-ghost btn-sm" style="color:var(--error)" onclick="cashDeleteSnapshot(${s.id})">刪除</button></td>
    </tr>${viewing && String(viewing.id) === String(s.id) ? `<tr><td colspan="8" style="padding:10px;background:var(--surface2)"><div style="display:flex;gap:12px;flex-wrap:wrap">
      ${cashLinesTable((s.lines || []).filter(l => l.side === 'asset'), `${cashEsc(s.date)} 可用的錢`, s.assets, 'var(--success)')}
      ${cashLinesTable((s.lines || []).filter(l => l.side === 'liability'), `${cashEsc(s.date)} 不是自己的錢`, s.liabilities, 'var(--error)')}</div></td></tr>` : ''}`;
  }).join('') || '<tr><td colspan="8" style="padding:12px;text-align:center;color:var(--text3);font-size:12px">還沒有存過任何一期</td></tr>';

  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px">
      <div><div style="font-size:16px;font-weight:800">資金試算</div><div style="font-size:12px;color:var(--text3);margin-top:4px">估算一律偏保守（寧可算低）。自動項目即時取自應收、應付、淨利潤儀表與稅務管理；只顯示，不回寫任何帳務資料。</div></div>
    </div>
    ${warnings.length ? `<div style="border:1px solid var(--warning);background:var(--warning-bg,rgba(200,150,0,.08));border-radius:8px;padding:10px 12px;margin-bottom:12px;font-size:12px;line-height:1.7">${warnings.map(w => '⚠ ' + w).join('<br>')}</div>` : ''}
    <div class="profit-kpi-grid" style="margin-bottom:14px">
      ${kpi('自有資金', cashMoney(r.own), `可用 ${cashMoney(r.assets)} − 不是自己的 ${cashMoney(r.liabilities)}`, r.own < 0 ? 'var(--error)' : 'var(--success)')}
      ${kpi('安全水位', cashMoney(r.safety), `${r.months} 個月 ×（公司開銷月均 ${cashMoney(r.overhead.average)} ＋ 老闆每月 ${cashMoney(r.ownerDraw)}）`)}
      ${kpi('可動用金額', cashMoney(r.available), r.available < 0 ? '低於安全水位，先不要動用' : '自有資金扣掉安全水位後', r.available < 0 ? 'var(--error)' : 'var(--accent)')}
      ${kpi('與上期差額', diff == null ? '—' : cashMoney(diff), last ? `上期 ${cashEsc(last.date)} 自有資金 ${cashMoney(last.own)}` : '存過一期後才有比較', diff == null ? 'var(--text3)' : diff < 0 ? 'var(--error)' : 'var(--success)')}
    </div>
    <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start;margin-bottom:16px">
      ${cashLinesTable(r.lines.filter(l => l.side === 'asset'), '可用的錢（＋）', r.assets, 'var(--success)')}
      ${cashLinesTable(r.lines.filter(l => l.side === 'liability'), '不是自己的錢（－）', r.liabilities, 'var(--error)')}
    </div>
    <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start;margin-bottom:16px">
      <div style="flex:1;min-width:340px;border:1px solid var(--border);border-radius:8px;overflow:hidden">
        <div style="padding:10px 12px;background:var(--surface2);font-size:13px;font-weight:600;display:flex;justify-content:space-between;align-items:center;gap:8px">
          <span>登錄本期金額</span><button class="btn btn-ghost btn-sm" onclick="cashStartEditItem('new')">＋ 新增項目</button></div>
        <table style="width:100%;border-collapse:collapse"><tbody>${entryRows || '<tr><td style="padding:12px;color:var(--text3);font-size:12px">沒有項目</td></tr>'}</tbody></table>
        <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;padding:10px 12px;border-top:1px solid var(--border)">
          <label style="font-size:11px;color:var(--text3)">登錄日<br><input class="form-input" id="cash-snap-date" type="date" value="${r.today}" max="${r.today}"></label>
          <label style="font-size:11px;color:var(--text3);flex:1">備註<br><input class="form-input" id="cash-snap-note" placeholder="例：月初對帳"></label>
          <button class="btn btn-primary btn-sm" onclick="cashSaveSnapshot()" ${CASH_ITEMS.length ? '' : 'disabled'}>存成本期</button>
        </div>
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
      <div style="padding:10px 12px;background:var(--surface2);font-size:13px;font-weight:600">進行中個案超前收款（預估總成本＝合約×(1−預估毛利率)；完工比例＝已發生成本÷預估總成本；超前收款＝已收−已賺營收，只扣不加）</div>
      <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">
        <thead><tr style="border-bottom:1px solid var(--border2)">${['個案', '合約', '預估毛利率', '預估總成本', '已發生成本', '完工比例', '已賺營收', '已收', '超前收款'].map((h, i) => `<th style="padding:6px 10px;font-size:11px;color:var(--text3);text-align:${i ? 'right' : 'left'}">${h}</th>`).join('')}</tr></thead>
        <tbody>${wipRows}</tbody></table></div>
    </div>
    <div style="border:1px solid var(--border);border-radius:8px;overflow:hidden">
      <div style="padding:10px 12px;background:var(--surface2);font-size:13px;font-weight:600">歷史期別</div>
      <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">
        <thead><tr style="border-bottom:1px solid var(--border2)">${['登錄日', '可用的錢', '不是自己的錢', '自有資金', '與上期差額', '可動用金額', '登錄人', ''].map((h, i) => `<th style="padding:6px 10px;font-size:11px;color:var(--text3);text-align:${i && i < 6 ? 'right' : 'left'}">${h}</th>`).join('')}</tr></thead>
        <tbody>${historyRows}</tbody></table></div>
    </div>`;
}
