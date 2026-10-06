// TAX MANAGEMENT MODULE. Extracted verbatim from ops/index.html at main@4318c73.

// ══════════════════════════════════
// TAX MANAGEMENT — read-only reconciliation; never posts to profit/overhead/cost
// ══════════════════════════════════
let TAX_SELECTED_YEAR = '';
let TAX_EDIT_ID = null;

function taxEscape(value) {
  return String(value || '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}

function taxMoney(value) {
  const n = Math.round(Number(value) || 0);
  return `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('zh-TW')}`;
}

function taxVatReserve(invoiceAmount) {
  return (Number(invoiceAmount) || 0) / 1.05 * 0.05 * 0.5;
}

function taxVatPeriodKey(invoiceDate) {
  const match = String(invoiceDate || '').match(/^(\d{4})-(\d{2})-/);
  if (!match) return '';
  const month = Number(match[2]);
  if (month < 1 || month > 12) return '';
  const start = month % 2 ? month : month - 1;
  return `${match[1]}-${String(start).padStart(2,'0')}~${String(start + 1).padStart(2,'0')}`;
}

function taxAvailableYears() {
  const years = new Set([currentYearKey()]);
  RECEIVABLES.forEach(r => {
    const year = String(r.invoiceDate || '').match(/^(\d{4})-/)?.[1];
    if (year) years.add(year);
  });
  TAX_LIABILITIES.forEach(r => {
    const year = String(r.period || r.payDate || '').match(/^(\d{4})/)?.[1];
    if (year) years.add(year);
  });
  PROFIT_SETTLEMENTS.forEach(s => {
    const year = String(s.taxYear || s.date || '').match(/^(\d{4})/)?.[1];
    if (year) years.add(year);
  });
  return [...years].sort((a,b) => b.localeCompare(a));
}

function taxSelectYear(value) {
  TAX_SELECTED_YEAR = String(value || currentYearKey());
  renderTaxManagement();
}

function taxStartEdit(id = 'new') {
  if (!requireManage('tax')) return;
  TAX_EDIT_ID = id;
  renderTaxManagement();
  requestAnimationFrame(() => document.getElementById('tax-entry-card')?.scrollIntoView({behavior:'smooth', block:'center'}));
}

function taxCancelEdit() {
  TAX_EDIT_ID = null;
  renderTaxManagement();
}

function taxSaveLiability() {
  if (!requireManage('tax')) return;
  const taxType = document.getElementById('tax-entry-type')?.value || '';
  const period = document.getElementById('tax-entry-period')?.value.trim() || '';
  const amount = Number(String(document.getElementById('tax-entry-amount')?.value || '').replace(/[^0-9.-]/g,'')) || 0;
  const payDate = document.getElementById('tax-entry-date')?.value || '';
  const status = document.getElementById('tax-entry-status')?.value || 'paid';
  const note = document.getElementById('tax-entry-note')?.value.trim() || '';
  if (!taxType || !period || !amount) { showToast('請填寫稅別、歸屬期與金額', 'error'); return; }
  if (status === 'paid' && !payDate) { showToast('已繳納紀錄請填寫繳納日', 'error'); return; }
  let row = TAX_EDIT_ID === 'new' || TAX_EDIT_ID == null ? null : TAX_LIABILITIES.find(r => String(r.id) === String(TAX_EDIT_ID));
  if (!row) {
    const nextId = TAX_LIABILITIES.reduce((m,r) => Math.max(m, Number(r.id)||0), 0) + 1;
    row = { id:nextId, sourceKey:`tax-manual-${Date.now()}` };
    TAX_LIABILITIES.push(row);
  }
  Object.assign(row, { taxType, period, amount, payDate, status, note, source:'manual_tax_management' });
  if (row.sourcePayableId != null) {
    row.payableTaxFieldsAdjusted = true;
    row.source = 'payable_tax_link';
  }
  tagCompany([row]);
  touchRowMeta(row);
  TAX_EDIT_ID = null;
  saveData();
  renderTaxManagement();
  showToast('稅務負債／繳稅紀錄已儲存 ✓', 'success');
}

function taxDeleteLiability(id) {
  if (!requireManage('tax')) return;
  const row = TAX_LIABILITIES.find(r => String(r.id) === String(id));
  if (!row || !confirm(`確定刪除「${row.taxType} ${row.period} ${taxMoney(row.amount)}」？`)) return;
  TAX_LIABILITIES.splice(TAX_LIABILITIES.indexOf(row), 1);
  TAX_EDIT_ID = null;
  saveData();
  renderTaxManagement();
  showToast('繳稅紀錄已刪除', 'success');
}

function taxOpenIncomeEstimate() {
  const cases = CASES.filter(psIsProfitSettlementCase);
  return cases.reduce((sum, c) => {
    // 已結算過、這次是增量結算（保固款等結案後才進帳的款項）的個案，只算結算基準日之後新增的
    // 發票金額；taxReserveOverride 是第一次結算用的歷史對帳數字，增量這輪不適用。
    const cutoff = c.psSettled ? psCaseSettlementCutoff(c) : '';
    if (!cutoff && Number.isFinite(c.taxReserveOverride)) return sum + Math.abs(Number(c.taxReserveOverride));
    const invoiceTotal = RECEIVABLES
      .filter(r => r.case === c.code && receivableIsCollected(r) && (!cutoff || String(r.collectDate||'') > cutoff))
      .reduce((s,r) => s + (Number(r.invoiceAmt) || 0), 0);
    return sum + invoiceTotal * PS_TAX_RATE;
  }, 0);
}

function renderTaxManagement() {
  const container = document.getElementById('tax-container');
  if (!container || !canAccess('tax')) return;
  const years = taxAvailableYears();
  if (!TAX_SELECTED_YEAR || !years.includes(TAX_SELECTED_YEAR)) TAX_SELECTED_YEAR = years.includes(currentYearKey()) ? currentYearKey() : years[0];
  const year = TAX_SELECTED_YEAR;
  const periods = [1,3,5,7,9,11].map(m => `${year}-${String(m).padStart(2,'0')}~${String(m+1).padStart(2,'0')}`);
  const invoiceRows = RECEIVABLES.filter(r => Number(r.invoiceAmt || 0) !== 0);
  const vatRows = invoiceRows.filter(r => String(r.invoiceDate || '').startsWith(`${year}-`));
  const unassigned = invoiceRows.filter(r => !taxVatPeriodKey(r.invoiceDate));
  const vatPaidRows = TAX_LIABILITIES.filter(r => r.taxType === '營業稅' && r.status === 'paid');
  const periodRows = periods.map(period => {
    const invoices = vatRows.filter(r => taxVatPeriodKey(r.invoiceDate) === period);
    const invoiceTotal = invoices.reduce((s,r) => s + (Number(r.invoiceAmt)||0), 0);
    const reserve = invoices.reduce((s,r) => s + taxVatReserve(r.invoiceAmt), 0);
    const paid = vatPaidRows.filter(r => String(r.period || '') === period).reduce((s,r) => s + (Number(r.amount)||0), 0);
    const difference = reserve - paid;
    return { period, invoices, invoiceTotal, reserve, paid, difference };
  });
  const vatReserveTotal = periodRows.reduce((s,r) => s + r.reserve, 0);
  const vatPaidTotal = periodRows.reduce((s,r) => s + r.paid, 0);
  const formalIncomeReserve = PROFIT_SETTLEMENTS
    .filter(s => String(s.taxYear || s.date || '').startsWith(year))
    .reduce((sum,s) => sum + Math.abs(Number(s.grandTax) || (s.cases || []).reduce((x,c) => x + (Number(c.taxReserve)||0), 0)), 0);
  const incomePaid = TAX_LIABILITIES
    .filter(r => r.taxType === '營所稅' && r.status === 'paid' && String(r.period || '').startsWith(year))
    .reduce((s,r) => s + (Number(r.amount)||0), 0);
  const openEstimate = taxOpenIncomeEstimate();
  const editRow = TAX_EDIT_ID === 'new' || TAX_EDIT_ID == null ? null : TAX_LIABILITIES.find(r => String(r.id) === String(TAX_EDIT_ID));
  const taxRecords = TAX_LIABILITIES.filter(r => String(r.period || r.payDate || '').startsWith(year)).slice().sort((a,b) => String(b.payDate||'').localeCompare(String(a.payDate||'')));
  const taxRecordRows = taxRecords.map(r => `<tr>
    <td>${taxEscape(r.taxType)}</td><td style="font-family:'DM Mono',monospace">${taxEscape(r.period)}</td>
    <td style="text-align:right;font-family:'DM Mono',monospace">${taxMoney(r.amount)}</td><td>${r.payDate || '—'}</td>
    <td>${r.status === 'paid' ? '<span class="status status-paid">已繳納</span>' : '<span class="status status-pending">待繳納</span>'}</td>
    <td style="font-size:11px;color:var(--text3)">${taxEscape(r.note || '')}</td>
    <td style="white-space:nowrap"><button class="btn btn-ghost btn-sm" onclick="taxStartEdit('${r.id}')">編輯</button><button class="btn btn-ghost btn-sm" style="color:var(--error)" onclick="taxDeleteLiability('${r.id}')">刪除</button></td>
  </tr>`).join('');
  const statusBadge = diff => diff >= -0.5
    ? '<span class="status status-paid">足夠／尚有餘額</span>'
    : '<span class="status status-pending">不足</span>';
  const vatTable = periodRows.map(r => `<tr>
    <td style="font-family:'DM Mono',monospace">${r.period}</td>
    <td style="text-align:right">${r.invoices.length}</td>
    <td style="text-align:right;font-family:'DM Mono',monospace">${taxMoney(r.invoiceTotal)}</td>
    <td style="text-align:right;font-family:'DM Mono',monospace;font-weight:700">${taxMoney(r.reserve)}</td>
    <td style="text-align:right;font-family:'DM Mono',monospace">${taxMoney(r.paid)}</td>
    <td style="text-align:right;font-family:'DM Mono',monospace;color:${r.difference < 0 ? 'var(--error)' : 'var(--success)'}">${taxMoney(r.difference)}</td>
    <td>${r.paid ? statusBadge(r.difference) : '<span style="color:var(--text3);font-size:11px">尚未登錄繳納</span>'}</td>
  </tr>`).join('');
  const unassignedRows = unassigned.map(r => `<tr><td>${r.caseName || r.case || '—'}</td><td>${r.buyer || '—'}</td><td>${r.item || '—'}</td><td style="text-align:right;font-family:'DM Mono',monospace">${taxMoney(r.invoiceAmt)}</td><td>${r.invoiceNo || '—'}</td></tr>`).join('');
  container.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;flex-wrap:wrap">
      <div><div style="font-size:16px;font-weight:800">稅務預留與實際繳納核對</div><div style="font-size:12px;color:var(--text3);margin-top:4px">唯讀彙整，不寫入淨利潤、公司開銷或個案成本。</div></div>
      <label style="font-size:12px;color:var(--text2)">年度　<select class="filter-select" onchange="taxSelectYear(this.value)">${years.map(y=>`<option value="${y}" ${y===year?'selected':''}>${y}年</option>`).join('')}</select></label>
    </div>
    <div class="profit-kpi-grid" style="margin-bottom:16px">
      <div class="kpi-card"><div class="kpi-label">營業稅預留</div><div class="kpi-val" style="font-size:18px">${taxMoney(vatReserveTotal)}</div><div class="kpi-sub">依發票日歸雙月期</div></div>
      <div class="kpi-card"><div class="kpi-label">營業稅實繳</div><div class="kpi-val" style="font-size:18px">${taxMoney(vatPaidTotal)}</div><div class="kpi-sub">來自稅務負債紀錄</div></div>
      <div class="kpi-card"><div class="kpi-label">營業稅差異</div><div class="kpi-val" style="font-size:18px;color:${vatReserveTotal-vatPaidTotal < 0 ? 'var(--error)' : 'var(--success)'}">${taxMoney(vatReserveTotal-vatPaidTotal)}</div><div class="kpi-sub">預留－實繳</div></div>
      <div class="kpi-card"><div class="kpi-label">待歸期發票</div><div class="kpi-val" style="font-size:18px;color:${unassigned.length?'var(--warning)':'var(--success)'}">${unassigned.length} 筆</div><div class="kpi-sub">有發票金額但缺發票日</div></div>
    </div>
    <div class="card" style="padding:0;overflow:hidden;margin-bottom:16px"><div style="padding:12px 16px;background:var(--surface2);font-weight:700;font-size:13px">營業稅（每兩個月）</div><div style="overflow:auto"><table class="data-table" style="min-width:820px"><thead><tr><th>申報期</th><th style="text-align:right">發票筆數</th><th style="text-align:right">含稅發票額</th><th style="text-align:right">預留稅額</th><th style="text-align:right">實際繳納</th><th style="text-align:right">差異</th><th>核對</th></tr></thead><tbody>${vatTable}</tbody><tfoot><tr><td>${year} 年度合計</td><td style="text-align:right">${periodRows.reduce((s,r)=>s+r.invoices.length,0)}</td><td style="text-align:right;font-family:'DM Mono',monospace">${taxMoney(periodRows.reduce((s,r)=>s+r.invoiceTotal,0))}</td><td style="text-align:right;font-family:'DM Mono',monospace">${taxMoney(vatReserveTotal)}</td><td style="text-align:right;font-family:'DM Mono',monospace">${taxMoney(vatPaidTotal)}</td><td style="text-align:right;font-family:'DM Mono',monospace;color:${vatReserveTotal-vatPaidTotal < 0 ? 'var(--error)' : 'var(--success)'}">${taxMoney(vatReserveTotal-vatPaidTotal)}</td><td>${statusBadge(vatReserveTotal-vatPaidTotal)}</td></tr></tfoot></table></div></div>
    <div class="card" style="padding:16px;margin-bottom:16px">
      <div style="font-weight:700;font-size:13px;margin-bottom:12px">營所稅</div>
      <div class="profit-kpi-grid">
        <div class="kpi-card"><div class="kpi-label">${year} 正式預留</div><div class="kpi-val" style="font-size:18px">${taxMoney(formalIncomeReserve)}</div><div class="kpi-sub">僅已鎖定分潤結算</div></div>
        <div class="kpi-card"><div class="kpi-label">${year} 實際繳納</div><div class="kpi-val" style="font-size:18px">${taxMoney(incomePaid)}</div><div class="kpi-sub">依稅務負債年度</div></div>
        <div class="kpi-card"><div class="kpi-label">正式差異</div><div class="kpi-val" style="font-size:18px;color:${formalIncomeReserve-incomePaid < 0 ? 'var(--error)' : 'var(--success)'}">${taxMoney(formalIncomeReserve-incomePaid)}</div><div class="kpi-sub">正式預留－實繳</div></div>
        <div class="kpi-card"><div class="kpi-label">未結算個案預估</div><div class="kpi-val" style="font-size:18px;color:var(--warning)">${taxMoney(openEstimate)}</div><div class="kpi-sub">全部未鎖定個案，不算正式預留</div></div>
      </div>
      <div style="font-size:11px;color:var(--text3);line-height:1.7;margin-top:10px">未結算預估不歸入已選年度的正式差異，也不會寫回分潤表；待分潤結算鎖定後才轉為正式預留。</div>
    </div>
    <div class="card" style="padding:0;overflow:hidden;margin-bottom:16px">
      <div style="padding:12px 16px;background:var(--surface2);font-weight:700;font-size:13px;display:flex;justify-content:space-between;align-items:center"><span>稅務負債／繳稅紀錄</span><button class="btn btn-primary btn-sm" onclick="taxStartEdit()">＋ 新增紀錄</button></div>
      ${(TAX_EDIT_ID !== null) ? `<div id="tax-entry-card" style="padding:14px 16px;border-bottom:1px solid var(--border);display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px">
        <div class="form-field"><label class="form-label">稅別 *</label><select class="form-select" id="tax-entry-type"><option value="營業稅" ${editRow?.taxType==='營業稅'?'selected':''}>營業稅</option><option value="營所稅" ${editRow?.taxType==='營所稅'?'selected':''}>營所稅</option></select></div>
        <div class="form-field"><label class="form-label">歸屬期 *</label><input class="form-input" id="tax-entry-period" value="${taxEscape(editRow?.period || year)}" placeholder="例：2026-03~04 或 2025"></div>
        <div class="form-field"><label class="form-label">金額 *</label><input class="form-input" id="tax-entry-amount" inputmode="numeric" value="${editRow?.amount || ''}"></div>
        <div class="form-field"><label class="form-label">繳納日</label><input class="form-input" type="date" id="tax-entry-date" value="${editRow?.payDate || ''}"></div>
        <div class="form-field"><label class="form-label">狀態</label><select class="form-select" id="tax-entry-status"><option value="paid" ${editRow?.status!=='pending'?'selected':''}>已繳納</option><option value="pending" ${editRow?.status==='pending'?'selected':''}>待繳納</option></select></div>
        <div class="form-field"><label class="form-label">備註</label><input class="form-input" id="tax-entry-note" value="${taxEscape(editRow?.note || '')}"></div>
        <div style="grid-column:1/-1;display:flex;gap:8px"><button class="btn btn-primary btn-sm" onclick="taxSaveLiability()">儲存</button><button class="btn btn-ghost btn-sm" onclick="taxCancelEdit()">取消</button></div>
      </div>` : ''}
      <div style="overflow:auto"><table class="data-table" style="min-width:850px"><thead><tr><th>稅別</th><th>歸屬期</th><th style="text-align:right">金額</th><th>繳納日</th><th>狀態</th><th>備註</th><th>操作</th></tr></thead><tbody>${taxRecordRows || '<tr><td colspan="7" style="padding:20px;text-align:center;color:var(--text3)">本年度尚無繳稅紀錄</td></tr>'}</tbody></table></div>
    </div>
    ${unassigned.length ? `<div class="card" style="padding:0;overflow:hidden"><div style="padding:12px 16px;background:var(--surface2);font-weight:700;font-size:13px;color:var(--warning)">待補發票日，暫不納入任何申報期</div><div style="overflow:auto"><table class="data-table" style="min-width:700px"><thead><tr><th>個案</th><th>買受人</th><th>項目</th><th style="text-align:right">發票金額</th><th>發票號碼</th></tr></thead><tbody>${unassignedRows}</tbody></table></div></div>` : ''}
  `;
}
