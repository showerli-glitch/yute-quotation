// PROFIT DASHBOARD MODULE. Extracted verbatim from ops/index.html at main@e602f72.

// ══════════════════════════════════
// HELPERS
// ══════════════════════════════════
function fmtNum(n) {
  return n.toLocaleString('zh-TW');
}

// ══════════════════════════════════
// PROFIT DASHBOARD
// ══════════════════════════════════
// ── 淨利潤儀表板篩選狀態 ──
let pfSelYears = new Set(); // 空 = 全部年份
let pfSelCases = new Set(); // 空 = 全部案件
let pfClosedCollapsed = localStorage.getItem('yutesign-ops-profit-closed-collapsed') !== '0';

function pfToggleClosedCases() {
  pfClosedCollapsed = !pfClosedCollapsed;
  localStorage.setItem('yutesign-ops-profit-closed-collapsed', pfClosedCollapsed ? '1' : '0');
  renderProfit();
}

function pfSelectDetailCase(code) {
  const sel = document.getElementById('pf-detail-case');
  if (sel) sel.value = code || '';
  renderProfit();
}

function buildPfYearPills() {
  const yearSet = new Set();
  RECEIVABLES.forEach(r => { if (r.collectDate) yearSet.add(r.collectDate.slice(0,4)); });
  PAYABLES.forEach(p => {
    const d = p.doneDate || p.transferDate || p.wantDate;
    if (d) yearSet.add(d.slice(0,4));
  });
  CASES.forEach(c => { const m = c.code?.match(/(\d{4})/); if (m) yearSet.add(m[1]); });
  const years = [...yearSet].sort();
  const container = document.getElementById('pf-year-pills');
  if (!container) return;
  const allActive = pfSelYears.size === 0;
  container.innerHTML =
    `<button class="btn btn-sm" onclick="pfToggleYear('all')"
      style="font-size:11px;padding:3px 10px;border-radius:20px;${allActive ? 'background:var(--accent);color:#fff;border-color:var(--accent)' : 'background:transparent;color:var(--text2);border:1px solid var(--border)'}">全部</button>` +
    years.map(y => {
      const active = pfSelYears.has(y);
      return `<button class="btn btn-sm" onclick="pfToggleYear('${y}')"
        style="font-size:11px;padding:3px 10px;border-radius:20px;${active ? 'background:var(--accent);color:#fff;border-color:var(--accent)' : 'background:transparent;color:var(--text2);border:1px solid var(--border)'}">${y}</button>`;
    }).join('');
}

function pfToggleYear(y) {
  if (y === 'all') { pfSelYears.clear(); }
  else {
    if (pfSelYears.has(y)) pfSelYears.delete(y);
    else pfSelYears.add(y);
    if (pfSelYears.size === 0) {} // keep as "all"
  }
  renderProfit();
}

function pfToggleCaseDropdown() {
  const dd = document.getElementById('pf-case-dropdown');
  if (!dd) return;
  const isOpen = dd.style.display !== 'none';
  if (!isOpen) {
    // Rebuild checkboxes
    const container = document.getElementById('pf-case-checkboxes');
    if (container) {
      const visibleCases = dashboardSortCasesLikeOverview(CASES.filter(c => userCanViewCaseFinancials(c.code, 'profit')));
      container.innerHTML = buildCaseCheckboxGroups(visibleCases, c => pfSelCases.size === 0 || pfSelCases.has(c.code), 'pfCaseCheckChange()');
      const allCb = document.getElementById('pf-case-all');
      if (allCb) allCb.checked = pfSelCases.size === 0;
    }
  }
  dd.style.display = isOpen ? 'none' : 'block';
}

function pfCaseAllToggle(cb) {
  const boxes = document.querySelectorAll('#pf-case-checkboxes input[type=checkbox]');
  boxes.forEach(b => b.checked = cb.checked);
  pfSelCases = new Set();
  updatePfCaseBtn();
  renderProfit();
}

function pfCaseCheckChange() {
  const boxes = [...document.querySelectorAll('#pf-case-checkboxes input[type=checkbox]')];
  const checked = boxes.filter(b => b.checked).map(b => b.value);
  const visibleCount = CASES.filter(c => userCanViewCaseFinancials(c.code, 'profit')).length;
  pfSelCases = checked.length === visibleCount ? new Set() : new Set(checked);
  const allCb = document.getElementById('pf-case-all');
  if (allCb) allCb.checked = pfSelCases.size === 0;
  updatePfCaseBtn();
  renderProfit();
}

function updatePfCaseBtn() {
  const btn = document.getElementById('pf-case-filter-btn');
  if (!btn) return;
  btn.textContent = pfSelCases.size === 0 ? '全部個案 ▾' : `已選 ${pfSelCases.size} 筆個案 ▾`;
}

// 點外面關掉 case dropdown
document.addEventListener('click', e => {
  const wrap = document.getElementById('pf-case-wrap');
  if (wrap && !wrap.contains(e.target)) {
    const dd = document.getElementById('pf-case-dropdown');
    if (dd) dd.style.display = 'none';
  }
});

function renderProfit() {
  buildPfYearPills();
  const $ = n => '$' + Math.abs(n).toLocaleString('zh-TW');
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  const esc = text => String(text || '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const money = n => '$' + Math.round(Number(n) || 0).toLocaleString('zh-TW');
  const detailDate = r => r.collectDate || r.doneDate || r.transferDate || r.wantDate || r.date || r.month || r.invoiceDate || '';

  // 年份篩選器：空 = 全部
  const yearOk = d => pfSelYears.size === 0 || pfSelYears.has((d || '').slice(0,4));
  const caseYearFallback = c => String(c?.code || '').match(/20\d{2}/)?.[0] || String(c?.startDate || c?.closedDate || '').slice(0,4);
  const familyDetailYearOk = (row, c) => yearOk(row.collectDate || row.invoiceDate || row.doneDate || row.wantDate || caseYearFallback(c));
  // 案件篩選器：空 = 全部
  const caseOk = code => (pfSelCases.size === 0 || pfSelCases.has(code)) && userCanViewCaseFinancials(code, 'profit');

  // ── 1. 應付廠商：已付款，依年份篩選 ──
  const pyPaid = PAYABLES.filter(p => p.status === 'paid' && isCostControlPayment(p) &&
    yearOk(p.doneDate || p.transferDate || p.wantDate));

  // ── 2. 費用申請：已核准，非固定開銷，依年份篩選 ──
  const expApproved = EXPENSES.filter(e => e.status === 'approved' && yearOk(e.month) && e.caseKey !== '固定開銷' && e.postCloseTreatment !== 'company_absorb');

  // ── 3. 每個案件毛利計算（依案件篩選） ──
  const caseRows = dashboardSortCasesLikeOverview(CASES.filter(c => c.accountingTreatment !== 'receivable_from_related_party' && caseOk(c.code))).map(c => {
    const isFamilyPassThroughCase = isFamilyPassThroughCaseRecord(c);
    const casePaidReceivables = caseReceivableRows(c.code, { dateOk: d => yearOk(d) }).filter(receivableIsCollected);
    const casePaidPayables = casePayableRows(c.code, { dateOk: d => yearOk(d), costControlOnly: true }).filter(p => p.status === 'paid');
    const recordedRevenue = casePaidReceivables.reduce((s, r) => s + (r.collectAmt || 0), 0);
    const recordedCost = casePaidPayables.reduce((s, p) => s + (p.amount || 0), 0);
    const useOverride = shouldUseCaseFinancialOverride(c);
    const revenue  = useOverride && Number.isFinite(c.revenueOverride) ? c.revenueOverride : recordedRevenue;
    const cost     = useOverride && Number.isFinite(c.vendorCostOverride) ? c.vendorCostOverride : recordedCost;
    const caseExpenses = expApproved.filter(e => e.caseKey === c.code);
    const expCost  = caseExpenses.filter(e => e.category !== '公司分攤').reduce((s, e) => s + (e.amount || 0), 0);
    const calculatedTaxCost = casePaidReceivables.reduce((s, r) => s + ((r.invoiceAmt || 0) / 1.05 * 0.05 / 2), 0);
    const taxCost  = Number.isFinite(c.taxCostOverride) ? c.taxCostOverride : (isFamilyPassThroughCase ? 0 : calculatedTaxCost);
    const calculatedGross = revenue - cost - expCost - taxCost;
    const gross    = useOverride && Number.isFinite(c.grossOverride) ? c.grossOverride : calculatedGross;
    const contract = c.amount || 0;
    const collected= recordedRevenue;
    return { ...c, revenue, cost, expCost, taxCost, recordedRevenue, recordedCost, calculatedTaxCost, calculatedGross, gross, contract, collected };
  }).filter(c => c.contract > 0 || c.revenue > 0 || c.cost > 0);

  const detailSelect = document.getElementById('pf-detail-case');
  if (detailSelect) {
    const current = detailSelect.value;
    detailSelect.innerHTML = buildGroupedCaseOptionsFromRows(caseRows);
    if (caseRows.some(c => c.code === current)) detailSelect.value = current;
    else if (caseRows[0]) detailSelect.value = caseRows[0].code;
  }

  // ── 4b. 未指定案件的付款（沒有對應 CASES 的付款，不能漏算） ──
  const validCaseCodes = new Set(CASES.map(c => c.code));
  const uncatPay  = ['manage','view_all'].includes(permissionLevel('profit'))
    ? pyPaid.filter(p => !p.case || !validCaseCodes.has(p.case))
    : [];
  const uncatCost = uncatPay.reduce((s, p) => s + (p.amount || 0), 0);

  // ── 5. 彙整（含未指定案件的成本） ──
  const totalRevenue  = caseRows.reduce((s, c) => s + c.revenue, 0);
  const totalCost     = caseRows.reduce((s, c) => s + c.cost, 0) + uncatCost;
  const totalExpCost  = caseRows.reduce((s, c) => s + c.expCost, 0);
  const totalTaxCost  = caseRows.reduce((s, c) => s + c.taxCost, 0);
  const totalGross    = caseRows.reduce((s, c) => s + c.gross, 0) - uncatCost;

  // ── KPI ──
  if (canSeeFinancialTotals()) {
    set('pf-kpi-revenue',  $(totalRevenue));
    set('pf-kpi-payable',  $(totalCost));
    set('pf-kpi-expense',  $(totalExpCost));
    set('pf-kpi-gross',    (totalGross >= 0 ? '$' : '-$') + Math.abs(Math.round(totalGross)).toLocaleString('zh-TW'));
  } else {
    set('pf-kpi-revenue',  '—');
    set('pf-kpi-payable',  '—');
    set('pf-kpi-expense',  '—');
    set('pf-kpi-gross',    '—');
  }

  // ── 成本控制表 ──
  const tbody = document.getElementById('pf-case-tbody');
  const tfoot = document.getElementById('pf-case-tfoot');
  if (tbody) {
    const stCls  = { '進行中': 'tag-active', '已完工': 'tag-done', '結案': 'tag-inactive' };
    const renderCaseRow = c => {
      const marginPct  = c.contract > 0 ? ((c.gross / c.contract) * 100).toFixed(1) : '—';
      const collectPct = c.contract > 0 ? ((c.collected / c.contract) * 100).toFixed(1) : '—';
      const grossColor = c.gross >= 0 ? 'var(--accent)' : 'var(--error)';
      const barW = c.contract > 0 ? Math.min(100, Math.max(0, (c.collected / c.contract) * 100)) : 0;
      return `<tr style="border-bottom:1px solid var(--border);cursor:pointer" onclick="pfSelectDetailCase('${c.code}')" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">
        <td style="padding:10px 14px;white-space:nowrap">
          <div style="font-size:12px;font-weight:500">${c.name}</div>
          <div style="font-size:10px;color:var(--accent);font-family:'DM Mono',monospace">${c.code}</div>
          <div style="margin-top:4px;height:3px;background:var(--surface3);border-radius:2px;width:120px">
            <div style="height:3px;border-radius:2px;background:var(--accent);width:${barW}%"></div>
          </div>
        </td>
        <td style="padding:10px 10px;text-align:right;font-family:'DM Mono',monospace;font-size:12px;color:var(--text2)">${c.contract ? '$'+c.contract.toLocaleString('zh-TW') : '—'}</td>
        <td style="padding:10px 10px;text-align:right;font-family:'DM Mono',monospace;font-size:12px;color:var(--success)">$${c.revenue.toLocaleString('zh-TW')}</td>
        <td style="padding:10px 10px;text-align:right;font-family:'DM Mono',monospace;font-size:12px;color:var(--error)">$${c.cost.toLocaleString('zh-TW')}</td>
        <td style="padding:10px 10px;text-align:right;font-family:'DM Mono',monospace;font-size:12px;color:var(--error)">$${c.expCost.toLocaleString('zh-TW')}</td>
        <td style="padding:10px 10px;text-align:right;font-family:'DM Mono',monospace;font-size:12px;color:var(--error)">$${Math.round(c.taxCost).toLocaleString('zh-TW')}</td>
        <td style="padding:10px 10px;text-align:right;font-family:'DM Mono',monospace;font-size:12px;font-weight:700;color:${grossColor}">${c.gross >= 0 ? '$' : '-$'}${Math.abs(Math.round(c.gross)).toLocaleString('zh-TW')}</td>
        <td style="padding:10px 10px;text-align:center">
          <span style="font-size:12px;font-weight:600;color:${c.gross >= 0 ? 'var(--success)' : 'var(--error)'}">${marginPct !== '—' ? marginPct + '%' : '—'}</span>
        </td>
        <td style="padding:10px 10px;text-align:center;font-size:12px;color:var(--text2)">${collectPct !== '—' ? collectPct + '%' : '—'}</td>
        <td style="padding:10px 10px;text-align:center"><span class="tag ${stCls[c.status] || 'tag-active'}">${c.status || '進行中'}</span></td>
      </tr>`;
    };
    const caseKw = (document.getElementById('pf-case-search')?.value || '').toLowerCase();
    const searchedRows = caseRows.filter(c => searchTextMatches([c.code, c.name, c.clientName].filter(Boolean).join(' '), caseKw));
    const openRows = searchedRows.filter(c => c.status !== '結案');
    const closedRows = searchedRows.filter(c => c.status === '結案');
    const closedSection = closedRows.length ? `
      <tr><td colspan="10" style="padding:5px 14px;border-top:2px solid var(--border2);background:var(--surface2);font-size:11px;color:var(--text3)">
        <div style="display:flex;align-items:center;gap:8px"><span>已結案個案（${closedRows.length}）</span><button type="button" class="btn btn-ghost btn-sm" onclick="pfToggleClosedCases()" style="font-size:10px;padding:2px 8px">${pfClosedCollapsed ? '展開 ▾' : '收折 ▴'}</button></div>
      </td></tr>${pfClosedCollapsed ? '' : closedRows.map(renderCaseRow).join('')}` : '';
    tbody.innerHTML = openRows.map(renderCaseRow).join('') + closedSection +
    // 未指定案件的付款（有就顯示）
    (uncatCost > 0 ? `<tr style="border-bottom:1px solid var(--border);opacity:.75" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">
      <td style="padding:10px 14px;white-space:nowrap">
        <div style="font-size:12px;font-weight:500;color:var(--text3)">未指定個案</div>
        <div style="font-size:10px;color:var(--text3);font-family:'DM Mono',monospace">${uncatPay.length} 筆付款</div>
      </td>
      <td style="padding:10px 10px;text-align:right;color:var(--text3)">—</td>
      <td style="padding:10px 10px;text-align:right;font-family:'DM Mono',monospace;font-size:12px;color:var(--text3)">$0</td>
      <td style="padding:10px 10px;text-align:right;font-family:'DM Mono',monospace;font-size:12px;color:var(--error)">$${uncatCost.toLocaleString('zh-TW')}</td>
      <td style="padding:10px 10px;text-align:right;color:var(--text3)">—</td>
      <td style="padding:10px 10px;text-align:right;color:var(--text3)">—</td>
      <td style="padding:10px 10px;text-align:right;font-family:'DM Mono',monospace;font-size:12px;font-weight:700;color:var(--error)">-$${uncatCost.toLocaleString('zh-TW')}</td>
      <td colspan="3" style="padding:10px 10px;text-align:center;font-size:11px;color:var(--text3)">—</td>
    </tr>` : '');

    if (tfoot) {
      const totalMargin = totalRevenue > 0 ? ((totalGross / totalRevenue) * 100).toFixed(1) : '—';
      tfoot.innerHTML = `<tr style="background:var(--surface2);border-top:2px solid var(--border2);font-weight:700">
        <td style="padding:10px 14px;font-size:12px">合計</td>
        <td style="padding:10px 10px;text-align:right;font-family:'DM Mono',monospace;font-size:12px">—</td>
        <td style="padding:10px 10px;text-align:right;font-family:'DM Mono',monospace;font-size:12px;color:var(--success)">$${totalRevenue.toLocaleString('zh-TW')}</td>
        <td style="padding:10px 10px;text-align:right;font-family:'DM Mono',monospace;font-size:12px;color:var(--error)">$${totalCost.toLocaleString('zh-TW')}</td>
        <td style="padding:10px 10px;text-align:right;font-family:'DM Mono',monospace;font-size:12px;color:var(--error)">$${totalExpCost.toLocaleString('zh-TW')}</td>
        <td style="padding:10px 10px;text-align:right;font-family:'DM Mono',monospace;font-size:12px;color:var(--error)">$${Math.round(totalTaxCost).toLocaleString('zh-TW')}</td>
        <td style="padding:10px 10px;text-align:right;font-family:'DM Mono',monospace;font-size:13px;color:var(--accent)">$${Math.round(totalGross).toLocaleString('zh-TW')}</td>
        <td style="padding:10px 10px;text-align:center;font-size:12px;color:var(--accent)">${totalMargin !== '—' ? totalMargin + '%' : '—'}</td>
        <td colspan="2"></td>
      </tr>`;
    }
  }

  const detailPanel = document.getElementById('pf-detail-panel');
  if (detailPanel) {
    const detailCode = detailSelect?.value || caseRows[0]?.code || '';
    const detailCase = caseRows.find(c => c.code === detailCode);
    if (!detailCase) {
      detailPanel.innerHTML = '<div style="padding:18px;border:1px solid var(--border);border-radius:8px;color:var(--text3);font-size:12px;text-align:center">目前沒有可顯示的成本明細</div>';
      return;
    }
    const revenueRowsRaw = RECEIVABLES
      .filter(r => r.case === detailCase.code && yearOk(r.collectDate || r.invoiceDate))
      .sort((a,b) => detailDate(a).localeCompare(detailDate(b)));
    const revenueRows = revenueRowsRaw;
    const payableRows = PAYABLES
      .filter(p => p.case === detailCase.code && isCostControlPayment(p) && yearOk(p.doneDate || p.transferDate || p.wantDate))
      .sort((a,b) => detailDate(a).localeCompare(detailDate(b)));
    const costRows = payableRows;
    const expenseRows = EXPENSES
      .filter(e => e.caseKey === detailCase.code && e.status === 'approved' && e.caseKey !== '固定開銷' && e.postCloseTreatment !== 'company_absorb' && yearOk(e.month || e.date))
      .sort((a,b) => detailDate(a).localeCompare(detailDate(b)));
    const sum = (rows, getter) => rows.reduce((s,row) => s + (Number(getter(row)) || 0), 0);
    const revenueActual = sum(revenueRows, r => r.collectAmt);
    const receivableTotal = sum(revenueRows, r => receivableExpectedAmount(r));
    const invoiceTotal = sum(revenueRows.filter(r => r.invoiceDate || r.invoiceNo), r => r.invoiceAmt);
    const payableTotal = sum(costRows.filter(p => p.status === 'paid'), p => p.amount);
    const expenseTotal = sum(expenseRows, e => e.amount);
    const detailGross = detailCase.gross;
    const renderTable = (title, columns, rows, rowHtml, emptyText, totalText) => `
      <div style="border:1px solid var(--border);border-radius:8px;overflow:hidden;background:var(--surface)">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;padding:9px 12px;background:var(--surface2);border-bottom:1px solid var(--border)">
          <div style="font-size:13px;font-weight:700">${title}</div>
          <div style="font-size:12px;font-family:'DM Mono',monospace;font-weight:700;color:var(--accent)">${totalText || ''}</div>
        </div>
        <div style="overflow:auto">
          <table style="width:100%;min-width:760px;border-collapse:collapse;table-layout:fixed">
            <thead><tr style="border-bottom:1px solid var(--border2);color:var(--text3);font-size:11px">
              ${columns.map(c => `<th style="padding:7px 10px;text-align:${c.align||'left'};width:${c.width||'auto'}">${c.label}</th>`).join('')}
            </tr></thead>
            <tbody>${rows.length ? rows.map(rowHtml).join('') : `<tr><td colspan="${columns.length}" style="padding:18px;text-align:center;color:var(--text3);font-size:12px">${emptyText}</td></tr>`}</tbody>
          </table>
        </div>
      </div>`;
    const revenueTable = renderTable(
      '應收／入帳明細',
      [{label:'入帳日',width:'92px'},{label:'買受人'},{label:'項目'},{label:'入帳金額',align:'right',width:'110px'},{label:'發票金額',align:'right',width:'110px'},{label:'發票日',width:'92px'},{label:'發票號碼',width:'120px'}],
      revenueRows,
      r => `<tr style="border-bottom:1px solid var(--border)"><td style="padding:7px 10px;font-size:12px">${r.collectDate||'待入帳'}</td><td style="padding:7px 10px;font-size:12px">${esc(r.buyer||'')}</td><td style="padding:7px 10px;font-size:12px">${esc(r.item||'')}</td><td style="padding:7px 10px;text-align:right;font-family:'DM Mono',monospace">${money(r.collectAmt)}</td><td style="padding:7px 10px;text-align:right;font-family:'DM Mono',monospace">${money(r.invoiceAmt)}</td><td style="padding:7px 10px;font-size:12px">${r.invoiceDate||'—'}</td><td style="padding:7px 10px;font-family:'DM Mono',monospace;font-size:12px">${esc(r.invoiceNo||'—')}</td></tr>`,
      '尚無應收明細',
      `已入帳 ${money(revenueActual)}／應收 ${money(receivableTotal)}／發票 ${money(invoiceTotal)}`
    );
    const payableTable = renderTable(
      '廠商成本明細',
      [{label:'付款日',width:'92px'},{label:'受款廠商'},{label:'摘要'},{label:'金額',align:'right',width:'110px'},{label:'狀態',width:'78px'},{label:'申請人',width:'90px'},{label:'備註'}],
      costRows,
      p => `<tr style="border-bottom:1px solid var(--border)"><td style="padding:7px 10px;font-size:12px">${p.doneDate||p.transferDate||p.wantDate||'—'}</td><td style="padding:7px 10px;font-size:12px">${esc(p.vendor||'')}</td><td style="padding:7px 10px;font-size:12px">${esc(p.summary||'')}</td><td style="padding:7px 10px;text-align:right;font-family:'DM Mono',monospace;color:var(--error)">${money(p.amount)}</td><td style="padding:7px 10px;font-size:12px">${p.status==='paid'?'已付款':p.status==='approved'?'待付款':'待審核'}</td><td style="padding:7px 10px;font-size:12px">${esc(p.person||'')}</td><td style="padding:7px 10px;font-size:11px;color:var(--text3);white-space:normal">${esc(p.note||'')}</td></tr>`,
      '尚無廠商成本明細',
      `已付 ${money(payableTotal)}`
    );
    const expenseTable = renderTable(
      '當案費用明細',
      [{label:'月份',width:'86px'},{label:'人員',width:'90px'},{label:'類別',width:'100px'},{label:'項目'},{label:'金額',align:'right',width:'110px'},{label:'收據',width:'70px'},{label:'備註'}],
      expenseRows,
      e => `<tr style="border-bottom:1px solid var(--border)"><td style="padding:7px 10px;font-size:12px">${e.month||'—'}</td><td style="padding:7px 10px;font-size:12px">${esc(e.personName||e.person||'')}</td><td style="padding:7px 10px;font-size:12px">${esc(e.category||'')}</td><td style="padding:7px 10px;font-size:12px">${esc(e.item||'')}</td><td style="padding:7px 10px;text-align:right;font-family:'DM Mono',monospace;color:var(--error)">${money(e.amount)}</td><td style="padding:7px 10px;font-size:12px">${esc(e.receipt||'')}</td><td style="padding:7px 10px;font-size:11px;color:var(--text3);white-space:normal">${esc(e.note||'')}</td></tr>`,
      '尚無當案費用明細',
      `費用 ${money(expenseTotal)}`
    );
    detailPanel.innerHTML = `
      <div style="border:1px solid var(--border);border-radius:10px;padding:14px;background:var(--surface);margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;gap:14px;align-items:flex-start;flex-wrap:wrap">
          <div>
            <div style="font-size:15px;font-weight:800">${esc(detailCase.name)}</div>
            <div style="font-size:11px;color:var(--accent);font-family:'DM Mono',monospace;margin-top:2px">${detailCase.code}</div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(5,minmax(110px,1fr));gap:8px;flex:1;min-width:560px">
            <div class="kpi-card" style="padding:10px 12px"><div class="kpi-label">合約金額</div><div style="font-weight:800">${money(detailCase.contract)}</div></div>
            <div class="kpi-card" style="padding:10px 12px"><div class="kpi-label">已收／收入</div><div style="font-weight:800;color:var(--success)">${money(detailCase.revenue)}</div></div>
            <div class="kpi-card" style="padding:10px 12px"><div class="kpi-label">廠商成本</div><div style="font-weight:800;color:var(--error)">${money(detailCase.cost)}</div></div>
            <div class="kpi-card" style="padding:10px 12px"><div class="kpi-label">當案費用</div><div style="font-weight:800;color:var(--error)">${money(detailCase.expCost)}</div></div>
            <div class="kpi-card" style="padding:10px 12px"><div class="kpi-label">毛利</div><div style="font-weight:800;color:${detailGross>=0?'var(--accent)':'var(--error)'}">${detailGross>=0?'':'-'}${money(Math.abs(detailGross))}</div></div>
          </div>
        </div>
        ${detailCase.reconciliationNote ? `<div style="margin-top:10px;font-size:11px;color:var(--text3);line-height:1.6">${esc(detailCase.reconciliationNote)}</div>` : ''}
      </div>
      <div style="display:grid;grid-template-columns:1fr;gap:12px">${revenueTable}${payableTable}${expenseTable}</div>`;
  }

}
