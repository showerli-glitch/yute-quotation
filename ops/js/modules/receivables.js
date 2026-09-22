// ══════════════════════════════════
// RECEIVABLE MODULE
// ══════════════════════════════════
function rvTab(el, tab) {
  document.querySelectorAll('.rv-tab').forEach(b => { b.classList.remove('btn-primary','active'); b.classList.add('btn-ghost'); });
  el.classList.remove('btn-ghost');
  el.classList.add('btn-primary','active');
  rvTab_current = tab;
  renderReceivable();
}

function receivableFilterDate(row) {
  if (row.collectDate || row.invoiceDate || row.retentionDue) return row.collectDate || row.invoiceDate || row.retentionDue;
  const isRetention = row.receivableType === 'retention' || /\u4fdd\u56fa|\u4fdd\u7559\u6b3e/.test(row.item || '');
  return isRetention ? (CASES.find(c => c.code === row.case)?.retentionDue || '') : '';
}

function refreshReceivableYearOptions() {
  const el = document.getElementById('rv-filter-year');
  if (!el) return;
  const selected = el.value;
  const currentYear = String(new Date().getFullYear());
  const years = new Set(['2025', currentYear]);
  RECEIVABLES.forEach(r => {
    const effectiveDate = receivableFilterDate(r);
    const match = String(effectiveDate).match(/^(\d{4})-/);
    if (match) years.add(match[1]);
  });
  el.innerHTML = '<option value="">全部年度</option>'
    + [...years].sort().map(year => `<option value="${year}">${year}年</option>`).join('');
  if ([...el.options].some(option => option.value === selected)) el.value = selected;
  else if ([...el.options].some(option => option.value === currentYear)) el.value = currentYear;
}

function renderReceivable() {
  if (!canAccess('receivable')) return;
  refreshReceivableYearOptions();
  const manage = canManage('receivable');
  const kpiRow = document.getElementById('rv-kpi-row');
  if (kpiRow) kpiRow.style.display = canSeeFinancialTotals() ? '' : 'none';
  const filterCase = normalizeCaseFilterValue(document.getElementById('rv-filter-case')?.value || '');
  const filterYear = document.getElementById('rv-filter-year')?.value || '';
  const kw = (document.getElementById('rv-search')?.value || '').toLowerCase();
  const fromDate = document.getElementById('rv-date-from')?.value || '';
  const toDate = document.getElementById('rv-date-to')?.value || '';
  const sortMode = document.getElementById('rv-sort')?.value || 'date-desc';
  const receivableDate = receivableFilterDate;
  RECEIVABLES.forEach(normalizeReceivableStatus);
  const statsRows = RECEIVABLES.filter(r => {
    if (filterCase && r.case !== filterCase) return false;
    if (!userCanViewCaseFinancials(r.case, 'receivable')) return false;
    if (filterYear && !receivableDate(r).startsWith(filterYear)) return false;
    if (!inDateRange(receivableDate(r), fromDate, toDate)) return false;
    const searchable = [
      r.buyer, r.item, r.caseName, r.case, r.invoiceNo, r.progress, r.bank,
      r.collectDate, r.invoiceDate, r.retentionDue,
      searchAmountText(r.receivableAmt),
      searchAmountText(r.collectAmt),
      searchAmountText(r.invoiceAmt),
      searchAmountText(r.contractAmt),
    ].filter(Boolean).join(' ');
    if (!searchTextMatches(searchable, kw)) return false;
    return true;
  });
  // 「已入帳合計（年度）」要能超過目前瀏覽的日期區間（跟個案／年份／搜尋一起篩，但不受起訖日期限制）。
  const yearRows = RECEIVABLES.filter(r => {
    if (filterCase && r.case !== filterCase) return false;
    if (!userCanViewCaseFinancials(r.case, 'receivable')) return false;
    if (filterYear && !receivableDate(r).startsWith(filterYear)) return false;
    const searchable = [
      r.buyer, r.item, r.caseName, r.case, r.invoiceNo, r.progress, r.bank,
      r.collectDate, r.invoiceDate, r.retentionDue,
      searchAmountText(r.receivableAmt),
      searchAmountText(r.collectAmt),
      searchAmountText(r.invoiceAmt),
      searchAmountText(r.contractAmt),
    ].filter(Boolean).join(' ');
    if (!searchTextMatches(searchable, kw)) return false;
    return true;
  });
  const rows = sortOpsRows(statsRows.filter(r => {
    const collected = receivableIsCollected(r);
    if (rvTab_current === 'collected' && !collected) return false;
    if (rvTab_current === 'pending' && collected) return false;
    return true;
  }), sortMode, receivableDate, r => r.buyer, r => receivableExpectedAmount(r));
  const statusLabel = {pending:'待收款', collected:'已入帳'};
  const statusClass = {pending:'tag-pending', collected:'tag-done'};
  const bankShort = b => {
    if (!b) return '—';
    const s = b.split('｜')[0].trim();
    const parts = s.split(' ').filter(Boolean);
    return parts.length >= 2 ? parts.slice(0,2).join(' ') : s;
  };
  const tbody = document.getElementById('rv-tbody');
  if (!tbody) return;
  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;padding:32px;color:var(--text3)">無資料</td></tr>`;
  } else {
    tbody.innerHTML = rows.map((r,i) => `
      <tr style="border-bottom:1px solid var(--border)" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">
        <td class="rv-col-no" style="padding:10px 14px;color:var(--text3);font-size:11px">${String(i+1).padStart(3,'0')}</td>
        <td class="rv-col-case" style="padding:10px 14px;white-space:nowrap">
          <div style="font-size:12px;font-weight:500">${r.caseName}</div>
          <div style="font-size:10px;color:var(--accent);font-family:'DM Mono',monospace">${caseCodeBreak(r.case)}</div>
        </td>
        <td class="rv-col-buyer" style="padding:10px 14px;font-size:12px">${r.buyer||'—'}</td>
        <td class="rv-col-item" style="padding:10px 14px;font-size:12px;color:var(--text2)">${r.item||'—'}</td>
        <td class="rv-col-receivable-amount" style="padding:10px 14px;text-align:right;font-family:'DM Mono',monospace;font-weight:600">${receivableExpectedAmount(r) ? '$'+receivableExpectedAmount(r).toLocaleString('zh-TW') : '<span style="color:var(--text3)">—</span>'}</td>
        <td class="rv-col-collection" style="padding:8px 10px;font-size:12px">
          <div class="rv-cell-stack">
            <div class="rv-cell-main">${r.collectAmt ? '$'+r.collectAmt.toLocaleString('zh-TW') : '—'}</div>
            <div class="rv-cell-sub">${r.collectDate || (receivableFilterDate(r) ? '預計 '+receivableFilterDate(r) : '待入帳')}</div>
            <div class="rv-cell-sub" title="${r.bank||''}">${bankShort(r.bank)}</div>
          </div>
        </td>
        <td class="rv-col-invoice" style="padding:8px 10px;font-size:12px">
          <div class="rv-cell-stack">
            <div class="rv-cell-main">${r.invoiceAmt ? '$'+r.invoiceAmt.toLocaleString('zh-TW') : '—'}</div>
            <div class="rv-cell-sub">${r.invoiceDate || '—'}</div>
            <div class="rv-cell-sub">${rvInvoiceNoCell(r)}${r.invoiceLink ? `<a class="rv-invoice-link" href="${r.invoiceLink}" target="_blank" title="開啟電子發票">📄</a>` : ''}${manage ? `<button class="btn btn-ghost btn-sm" style="font-size:10px;padding:1px 5px;margin-left:4px" onclick="openRvLink(${r.id})" title="設定連結">⋯</button>` : ''}</div>
          </div>
        </td>
        <td class="rv-col-contract-progress" style="padding:8px 10px;font-size:12px" title="${r.progress||''}">
          <div class="rv-cell-stack">
            <div class="rv-cell-main">${r.contractAmt ? '$'+r.contractAmt.toLocaleString('zh-TW') : '—'}</div>
            <div class="rv-cell-sub">${r.progress||'—'}</div>
          </div>
        </td>
        <td class="rv-col-note" style="padding:6px 10px">
          <input type="text" value="${r.note||''}" placeholder="備註…"
            style="background:transparent;border:none;outline:none;width:100%;font-size:12px;color:var(--text2);padding:3px 2px;border-radius:4px;overflow:hidden;text-overflow:ellipsis"
            onfocus="this.style.background='var(--surface2)';this.style.border='1px solid var(--border)'"
            onblur="this.style.background='transparent';this.style.border='none';rvUpdateNote(${r.id},this.value)"
            onkeydown="if(event.key==='Enter')this.blur()">
        </td>
        <td class="rv-col-status" style="padding:10px 14px;text-align:center"><span class="tag ${receivableIsCollected(r)?'tag-done':'tag-pending'}">${receivableIsCollected(r)?'已入帳':'待入帳'}</span></td>
        <td class="rv-col-actions" style="padding:10px 14px;text-align:center;white-space:nowrap">
          <div style="display:flex;align-items:center;justify-content:center;gap:4px">
            ${manage ? `<button class="btn btn-ghost btn-sm" style="font-size:11px;padding:2px 7px" onclick="event.stopPropagation();openInvoice(${r.id})" title="開立發票／標記收款">📄</button>
            <select class="filter-select compact-action-select" aria-label="應收單操作" onchange="receivableDocumentAction(this,${r.id})"><option value="">選項⋯</option><option value="clone">複製單據</option><option value="edit">編輯單據</option><option value="delete">刪除單據</option></select>` : '<span style="font-size:11px;color:var(--text3)">唯讀</span>'}
          </div>
        </td>
      </tr>`).join('');
  }
  updateReceivableStats(statsRows, yearRows);
}

function updateReceivableStats(scopeRows = null, yearScopeRows = null) {
  const set = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
  if (!canSeeFinancialTotals()) {
    set('rv-stat-month-amt', '—');
    set('rv-stat-month-count', '僅管理者');
    set('rv-stat-year-amt', '—');
    set('rv-stat-year-count', '僅管理者');
    set('rv-stat-pending-amt', '—');
    set('rv-stat-pending-count', '僅管理者');
    set('rv-stat-noinv-count', '—');
    return;
  }
  const selYearRv = document.getElementById('rv-filter-year')?.value || '';
  const visibleRows = scopeRows || RECEIVABLES.filter(r => userCanViewCaseFinancials(r.case, 'receivable'));
  // 已入帳合計：跟「待收款」一樣算目前篩選範圍內的，不要另外跟「今天的真實月份」交集——
  // 不然瀏覽別的月份時，明明畫面上一堆已入帳，這裡卻顯示 $0，看起來像沒統計到。
  const monthRows = visibleRows.filter(r => receivableIsCollected(r));
  // 年度累計入帳：故意不受起訖日期篩選影響，不然篩了某個月份區間，這裡會跟「已入帳合計」算出一樣的數字。
  const yearBaseRows = yearScopeRows || visibleRows;
  const yearRows  = selYearRv
    ? yearBaseRows.filter(r => r.collectDate?.startsWith(selYearRv) && receivableIsCollected(r))
    : yearBaseRows.filter(r => receivableIsCollected(r));
  const pending   = visibleRows.filter(r => r.status==='pending');
  const noInv     = visibleRows.filter(r => rvNeedsInvoice(r) && !r.invoiceNo);
  const sum = (arr, field) => arr.reduce((s,r) => s+(r[field]||0), 0);
  const rvYearLabel = document.getElementById('rv-stat-year-label');
  if (rvYearLabel) rvYearLabel.textContent = selYearRv ? selYearRv+'年累計入帳' : '全部累計入帳';
  set('rv-stat-month-amt',    '$'+sum(monthRows,'collectAmt').toLocaleString('zh-TW'));
  set('rv-stat-month-count',  monthRows.length+' 筆');
  set('rv-stat-year-amt',     '$'+sum(yearRows,'collectAmt').toLocaleString('zh-TW'));
  set('rv-stat-year-count',   yearRows.length+' 筆');
  set('rv-stat-pending-amt',  pending.length ? '$'+pending.reduce((s,r) => s + receivableExpectedAmount(r), 0).toLocaleString('zh-TW') : '—');
  set('rv-stat-pending-count', pending.length+' 筆');
  set('rv-stat-noinv-count',  noInv.length+' 筆');
}

function openInvoice(id) {
  if (!requireManage('receivable')) return;
  rvInvoiceTarget = RECEIVABLES.find(r => r.id===id);
  if (!rvInvoiceTarget) return;
  const r = rvInvoiceTarget;
  document.getElementById('rv-invoice-summary').innerHTML =
    `<b>${r.caseName}</b> — ${r.item||''}<br>入帳金額：<b>$${(r.collectAmt||0).toLocaleString('zh-TW')}</b>`;
  document.getElementById('rv-inv-number').value   = r.invoiceNo || '';
  document.getElementById('rv-inv-date').value     = r.invoiceDate || '';
  document.getElementById('rv-receivable-amount').value = receivableExpectedAmount(r) ? receivableExpectedAmount(r).toLocaleString('zh-TW') : '';
  document.getElementById('rv-inv-amount').value = r.invoiceAmt ? r.invoiceAmt.toLocaleString('zh-TW') : '';
  document.getElementById('rv-collect-date').value = r.collectDate || '';
  const defaultCollectAmt = r.collectAmt || receivableExpectedAmount(r) || 0;
  document.getElementById('rv-collect-amount').value = defaultCollectAmt ? defaultCollectAmt.toLocaleString('zh-TW') : '';
  document.getElementById('rv-collect-bank').value = r.bank || '';
  document.getElementById('rv-inv-note').value     = r.note || '';
  openModal('modal-invoice');
}

function confirmInvoiceOnly() {
  if (!requireManage('receivable')) return;
  if (!rvInvoiceTarget) return;
  const parseAmt = id => parseInt((document.getElementById(id).value || '').replace(/[^0-9]/g,'')) || 0;
  const hadCollection = receivableIsCollected(rvInvoiceTarget);
  if (hadCollection && !confirm('這會清除目前的入帳日期、入帳金額與收款帳戶，並改回「待入帳」。確定繼續？')) return;
  Object.assign(rvInvoiceTarget, {
    receivableAmt: parseAmt('rv-receivable-amount'),
    invoiceAmt:  parseAmt('rv-inv-amount'),
    invoiceNo:   document.getElementById('rv-inv-number').value.trim(),
    invoiceDate: document.getElementById('rv-inv-date').value,
    collectDate: '',
    collectAmt:  0,
    bank:        '',
    status:      'pending',
    note:        document.getElementById('rv-inv-note').value
  });
  normalizeReceivableStatus(rvInvoiceTarget);
  touchRowMeta(rvInvoiceTarget);
  closeModal('modal-invoice');
  refreshAccountingLinkedViews(rvInvoiceTarget.case);
  saveData();
  showToast('已儲存發票資訊並改為待入帳 ✓', 'success');
}

function confirmCollected() {
  if (!requireManage('receivable')) return;
  if (!rvInvoiceTarget) return;
  const collectDate = document.getElementById('rv-collect-date').value;
  const collectAmt  = parseInt((document.getElementById('rv-collect-amount').value || '').replace(/[^0-9]/g,'')) || 0;
  const bank        = document.getElementById('rv-collect-bank').value;
  const parseOptionalAmt = id => parseInt((document.getElementById(id).value || '').replace(/[^0-9]/g,'')) || 0;
  if (!collectDate) { showToast('請填寫入帳日期', 'error'); return; }
  if (!collectAmt)  { showToast('請填寫實際入帳金額', 'error'); return; }
  if (!bank)        { showToast('請選擇入帳帳戶', 'error'); return; }
  Object.assign(rvInvoiceTarget, {
    status: 'collected', collectDate, collectAmt, bank,
    receivableAmt: parseOptionalAmt('rv-receivable-amount') || rvInvoiceTarget.receivableAmt || collectAmt,
    invoiceAmt:  parseOptionalAmt('rv-inv-amount'),
    invoiceNo:   document.getElementById('rv-inv-number').value.trim() || rvInvoiceTarget.invoiceNo,
    invoiceDate: document.getElementById('rv-inv-date').value || rvInvoiceTarget.invoiceDate,
    note:        document.getElementById('rv-inv-note').value
  });
  touchRowMeta(rvInvoiceTarget);
  closeModal('modal-invoice');
  refreshAccountingLinkedViews(rvInvoiceTarget.case);
  saveData();
  showToast('已標記入帳完成 ✓', 'success');
}

function rvUpdateNote(id, val) {
  if (!canManage('receivable')) return;
  const r = RECEIVABLES.find(x => x.id===id);
  if (r) { r.note = val; touchRowMeta(r); saveData(); }
}

function rvNeedsInvoice(row) {
  return Number(row?.invoiceAmt || 0) > 0 || !!row?.invoiceDate || !!row?.invoiceNo;
}

function rvInvoiceNoCell(row) {
  if (row?.invoiceNo) return row.invoiceNo;
  if (rvNeedsInvoice(row)) return '<span style="color:var(--warning);font-family:inherit">待開立</span>';
  return '<span style="color:var(--text3);font-family:inherit">不開立／合併</span>';
}

function rvFillClientOptions(selectedCode = '') {
  const el = document.getElementById('rv-add-client');
  if (!el) return;
  el.innerHTML = '<option value="">── 選擇客戶 ──</option>' +
    CLIENTS.map(c => `<option value="${c.code}" ${c.code===selectedCode?'selected':''}>${c.code} ｜ ${c.shortName}</option>`).join('');
}

function rvInvoiceBuyerFromClient(c) {
  if (!c) return '';
  const tax = String(c.taxId || '').trim();
  if (!tax || /個人|自然人/.test(tax)) return '';
  return c.fullName || c.shortName || '';
}

function rvIsInvoiceProxyCase(caze) {
  return caze?.code === 'YT-INV-2026-001' || caze?.invoiceMode === '代開發票' || caze?.caseType === '代開發票';
}

function rvSyncBuyerFromClient(force = false) {
  const clientCode = document.getElementById('rv-add-client')?.value || '';
  const buyerInput = document.getElementById('rv-add-buyer');
  if (!buyerInput) return;
  const c = CLIENTS.find(x => x.code === clientCode);
  const buyer = rvInvoiceBuyerFromClient(c);
  if (force || !buyerInput.value.trim()) buyerInput.value = buyer;
}

function rvSyncClientFromCase() {
  const caseCode = document.getElementById('rv-add-case')?.value || '';
  const caze = CASES.find(c => c.code === caseCode);
  const clientEl = document.getElementById('rv-add-client');
  const isInvoiceProxy = rvIsInvoiceProxyCase(caze);
  if (clientEl) {
    if (isInvoiceProxy) clientEl.value = '';
    else if (caze?.client) clientEl.value = caze.client;
  }
  if (isInvoiceProxy) {
    const buyerInput = document.getElementById('rv-add-buyer');
    if (buyerInput) buyerInput.value = '';
  } else {
    rvSyncBuyerFromClient(false);
  }
  const contractInput = document.getElementById('rv-add-contract-amt');
  if (contractInput && isInvoiceProxy) contractInput.value = '';
  else if (contractInput && caze?.amount && !contractInput.value.trim()) contractInput.value = Number(caze.amount).toLocaleString('zh-TW');
}

function rvToggleReceivableType() {
  const isRetention = document.getElementById('rv-add-type')?.value === 'retention';
  const dueField = document.getElementById('rv-retention-due-field');
  if (dueField) dueField.style.display = isRetention ? '' : 'none';
  const help = document.getElementById('rv-retention-help');
  if (help) help.style.display = isRetention ? '' : 'none';
  if (isRetention) {
    const item = document.getElementById('rv-add-item');
    if (item && !item.value.trim()) item.value = '保固保留款';
    const status = document.getElementById('rv-add-status');
    if (status) status.value = 'pending';
  }
}

let rvLinkTarget = null;
function openRvLink(id) {
  if (!requireManage('receivable')) return;
  rvLinkTarget = RECEIVABLES.find(r => r.id===id);
  if (!rvLinkTarget) return;
  document.getElementById('rv-link-input').value = rvLinkTarget.invoiceLink || '';
  openModal('modal-rv-link');
}
function saveRvLink() {
  if (!requireManage('receivable')) return;
  if (!rvLinkTarget) return;
  rvLinkTarget.invoiceLink = document.getElementById('rv-link-input').value.trim();
  closeModal('modal-rv-link');
  renderReceivable();
  saveData();
  showToast('電子發票連結已儲存 ✓', 'success');
}


function openAddReceivableModal() {
  if (!requireManage('receivable')) return;
  refreshAllCaseDropdowns();
  rvFillClientOptions();
  // 設為新增模式
  document.getElementById('rv-edit-id').value = '';
  document.getElementById('rv-modal-title').textContent = '新增收款紀錄';
  document.getElementById('rv-submit-btn').textContent  = '新增';
  // 清空欄位
  ['rv-add-buyer','rv-add-item','rv-add-receivable-amt','rv-add-collect-amt','rv-add-collect-date',
   'rv-add-invoice-amt','rv-add-invoice-date','rv-add-invoice-no',
   'rv-add-contract-amt','rv-add-progress','rv-add-note'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const caseEl = document.getElementById('rv-add-case'); if (caseEl) caseEl.value = '';
  const clientEl = document.getElementById('rv-add-client'); if (clientEl) clientEl.value = '';
  const bankEl = document.getElementById('rv-add-bank'); if (bankEl) bankEl.value = '';
  const stEl   = document.getElementById('rv-add-status'); if (stEl) stEl.value = 'pending';
  const typeEl = document.getElementById('rv-add-type'); if (typeEl) typeEl.value = 'normal';
  const dueEl = document.getElementById('rv-add-retention-due'); if (dueEl) dueEl.value = '';
  rvToggleReceivableType();
  openModal('modal-add-receivable');
}

function openEditReceivableModal(id) {
  if (!requireManage('receivable')) return;
  const r = RECEIVABLES.find(x => x.id === id);
  if (!r) return;
  refreshAllCaseDropdowns();
  const caseClient = CASES.find(c => c.code === r.case)?.client || '';
  rvFillClientOptions(r.client || caseClient);
  // 設為編輯模式
  document.getElementById('rv-edit-id').value = id;
  document.getElementById('rv-modal-title').textContent = '編輯收款紀錄';
  document.getElementById('rv-submit-btn').textContent  = '儲存修改';
  // 填入資料
  const caseEl = document.getElementById('rv-add-case'); if (caseEl) caseEl.value = r.case || '';
  const clientEl = document.getElementById('rv-add-client'); if (clientEl) clientEl.value = r.client || caseClient || '';
  document.getElementById('rv-add-buyer').value        = r.buyer       || '';
  document.getElementById('rv-add-item').value         = r.item        || '';
  document.getElementById('rv-add-receivable-amt').value = r.receivableAmt ? r.receivableAmt.toLocaleString('zh-TW') : (receivableExpectedAmount(r) ? receivableExpectedAmount(r).toLocaleString('zh-TW') : '');
  document.getElementById('rv-add-collect-amt').value  = r.collectAmt  ? r.collectAmt.toLocaleString('zh-TW') : '';
  document.getElementById('rv-add-collect-date').value = r.collectDate || '';
  const bankEl = document.getElementById('rv-add-bank'); if (bankEl) bankEl.value = r.bank || '';
  document.getElementById('rv-add-invoice-amt').value  = r.invoiceAmt  ? r.invoiceAmt.toLocaleString('zh-TW') : '';
  document.getElementById('rv-add-invoice-date').value = r.invoiceDate || '';
  document.getElementById('rv-add-invoice-no').value   = r.invoiceNo   || '';
  document.getElementById('rv-add-contract-amt').value = r.contractAmt ? r.contractAmt.toLocaleString('zh-TW') : '';
  document.getElementById('rv-add-progress').value     = r.progress    || '';
  const typeEl = document.getElementById('rv-add-type'); if (typeEl) typeEl.value = r.receivableType === 'retention' || (`${r.item||''} ${r.progress||''}`).includes('保固') ? 'retention' : 'normal';
  const dueEl = document.getElementById('rv-add-retention-due'); if (dueEl) dueEl.value = r.retentionDue || CASES.find(c=>c.code===r.case)?.retentionDue || '';
  const stEl = document.getElementById('rv-add-status'); if (stEl) stEl.value = r.status || 'pending';
  document.getElementById('rv-add-note').value         = r.note        || '';
  rvToggleReceivableType();
  openModal('modal-add-receivable');
}

function cloneReceivable(id) {
  if (!requireManage('receivable')) return;
  const r = RECEIVABLES.find(x => Number(x.id) === Number(id));
  if (!r) return;
  openEditReceivableModal(id);
  document.getElementById('rv-edit-id').value = '';
  document.getElementById('rv-modal-title').textContent = '複製應收帳款';
  document.getElementById('rv-submit-btn').textContent = '建立新應收';
  document.getElementById('rv-add-collect-amt').value = '';
  document.getElementById('rv-add-receivable-amt').value = '';
  document.getElementById('rv-add-collect-date').value = '';
  document.getElementById('rv-add-bank').value = '';
  document.getElementById('rv-add-invoice-date').value = '';
  document.getElementById('rv-add-invoice-no').value = '';
  document.getElementById('rv-add-status').value = 'pending';
}

function receivableDocumentAction(select, id) {
  const action = select?.value || '';
  if (select) select.value = '';
  if (action === 'clone') cloneReceivable(id);
  else if (action === 'edit') openEditReceivableModal(id);
  else if (action === 'delete') deleteReceivableConfirm(id);
}

function deleteReceivableConfirm(id) {
  if (!requireManage('receivable')) return;
  const r = RECEIVABLES.find(x => x.id === id);
  if (!r) return;
  const amt = r.collectAmt ? '$' + r.collectAmt.toLocaleString('zh-TW') : '（無金額）';
  if (!confirm(`確定刪除「${r.caseName} — ${r.item||''}」${amt} 這筆收款紀錄？`)) return;
  const affectedCase = r.case;
  rememberDeletedSourceKey(r.sourceKey);
  RECEIVABLES = RECEIVABLES.filter(x => x.id !== id);
  refreshAccountingLinkedViews(affectedCase);
  saveData();
  showToast('已刪除 ✓', 'warning');
}

function submitAddReceivable() {
  if (!requireManage('receivable')) return;
  const editId  = document.getElementById('rv-edit-id').value;
  const caseEl  = document.getElementById('rv-add-case');
  const caseVal = caseEl.value;
  const item    = document.getElementById('rv-add-item').value.trim();
  const parseAmt = s => parseInt((s||'').replace(/[^0-9]/g,'')) || 0;
  const receivableAmt = parseAmt(document.getElementById('rv-add-receivable-amt').value);
  const collectAmt  = parseAmt(document.getElementById('rv-add-collect-amt').value);
  const collectDate = document.getElementById('rv-add-collect-date').value;
  const iAmtRaw     = document.getElementById('rv-add-invoice-amt').value.trim();
  const invoiceAmt  = iAmtRaw ? parseAmt(iAmtRaw) : 0;
  const contractAmt = parseAmt(document.getElementById('rv-add-contract-amt').value);
  const receivableType = document.getElementById('rv-add-type')?.value || 'normal';
  const selectedCase = CASES.find(c => c.code === caseVal);
  const clientCode = document.getElementById('rv-add-client')?.value || selectedCase?.client || '';
  const client = CLIENTS.find(c => c.code === clientCode);
  const retentionDue = receivableType === 'retention' ? (document.getElementById('rv-add-retention-due')?.value || '') : '';
  let affectedCase = caseVal;
  if (receivableType === 'retention' && !receivableAmt) { showToast('請填寫保固保留款的本次應收金額','error'); return; }
  if (receivableType === 'retention' && !retentionDue) { showToast('請選擇保固款到期日','error'); return; }

  if (editId) {
    // 編輯模式
    const r = RECEIVABLES.find(x => x.id === parseInt(editId));
    if (r) {
      const before = auditClone(r);
      affectedCase = caseVal || r.case || '';
      const caseName = caseVal ? (caseEl.selectedOptions[0].text.split(' ').slice(1).join(' ')) : r.caseName;
      const duplicateAmt = receivableAmt || collectAmt || invoiceAmt || contractAmt;
      if (!confirmDuplicateReceivable({ caseCode:(caseVal || r.case), amount:duplicateAmt, excludeId:r.id })) return;
      Object.assign(r, {
        case:        caseVal || r.case,
        caseName,
        client:      clientCode || r.client || '',
        clientName:  client?.shortName || r.clientName || '',
        collectDate,
        buyer:       document.getElementById('rv-add-buyer').value.trim(),
        item:        item || r.item,
        receivableAmt,
        collectAmt,
        bank:        document.getElementById('rv-add-bank').value,
        invoiceAmt,
        invoiceDate: document.getElementById('rv-add-invoice-date').value,
        invoiceNo:   document.getElementById('rv-add-invoice-no').value.trim(),
        contractAmt,
        progress:    document.getElementById('rv-add-progress').value.trim(),
        receivableType, retentionDue,
        status:      (collectAmt > 0 || collectDate) ? 'collected' : 'pending',
        note:        document.getElementById('rv-add-note').value.trim(),
      });
      normalizeReceivableStatus(r);
      touchRowMeta(r);
      if (receivableType === 'retention') {
        const c = CASES.find(x => x.code === (caseVal || r.case));
        if (c) { c.retentionAmt = receivableAmt; c.retentionDue = retentionDue; }
      }
      recordAuditLog('update', 'receivable', r.id, before, r, {
        riskLevel:['collected','pending'].includes(r.status) ? 'high' : 'medium',
        targetLabel:`${r.buyer || '付款方未填'}／${r.item || '收款項目未填'}`,
        fields:['status','receivableAmt','collectAmt','collectDate','buyer','item','invoiceAmt','invoiceDate','invoiceNo','case','caseName','client','clientName','receivableType','retentionDue']
      });
    }
    closeModal('modal-add-receivable');
    refreshAccountingLinkedViews(affectedCase);
    saveData();
    showToast('收款紀錄已更新 ✓', 'success');
  } else {
    // 新增模式
    if (!caseVal) { showToast('請選擇個案名稱', 'error'); return; }
    if (!item)    { showToast('請填寫項目', 'error'); return; }
    if (!confirmDuplicateReceivable({ caseCode:caseVal, amount:(receivableAmt || collectAmt || invoiceAmt || contractAmt) })) return;
    const caseName = caseEl.selectedOptions[0].text.split(' ').slice(1).join(' ');
    const row = {
      id: rvNextId++, case: caseVal, caseName,
      client: clientCode,
      clientName: client?.shortName || '',
      collectDate,
      buyer:       document.getElementById('rv-add-buyer').value.trim(),
      item, receivableAmt, collectAmt,
      bank:        document.getElementById('rv-add-bank').value,
      invoiceAmt, invoiceDate: document.getElementById('rv-add-invoice-date').value,
      invoiceNo:   document.getElementById('rv-add-invoice-no').value.trim(),
      contractAmt, progress: document.getElementById('rv-add-progress').value.trim(),
      receivableType, retentionDue,
      invoiceLink: '',
      status:      (collectAmt > 0 || collectDate) ? 'collected' : 'pending',
      note:        document.getElementById('rv-add-note').value.trim(),
    };
    normalizeReceivableStatus(row);
    touchRowMeta(row, true);
    RECEIVABLES.push(row);
    if (receivableType === 'retention') {
      const c = CASES.find(x => x.code === caseVal);
      if (c) { c.retentionAmt = receivableAmt; c.retentionDue = retentionDue; }
    }
    recordAuditLog('create', 'receivable', row.id, null, row, {
      riskLevel:'high',
      targetLabel:`${row.buyer || '付款方未填'}／${row.item || '收款項目未填'}`
    });
    closeModal('modal-add-receivable');
    refreshAccountingLinkedViews(caseVal);
    saveData();
    showToast('收款紀錄已新增 ✓', 'success');
  }
}
