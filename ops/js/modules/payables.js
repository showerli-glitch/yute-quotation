// ══════════════════════════════════
// PAYABLE MODULE
// ══════════════════════════════════
function pyTab(el, tab) {
  document.querySelectorAll('.py-tab').forEach(b => { b.classList.remove('btn-primary','active'); b.classList.add('btn-ghost'); });
  el.classList.remove('btn-ghost');
  el.classList.add('btn-primary','active');
  pyTab_current = tab;
  renderPayable();
}

function pyToggleCols(kind, btn) {
  const wrap = document.getElementById('py-table-wrap');
  const cls = kind === 'dates' ? 'hide-dates' : 'hide-bank';
  const collapsed = wrap.classList.toggle(cls);
  btn.textContent = (kind === 'dates' ? '收折日期欄' : '收折銀行/備註') + (collapsed ? ' ▸' : ' ▾');
}

function caseCodeBreak(code) {
  if (!code) return code;
  const parts = code.split('-');
  if (parts.length < 3) return code;
  const last2 = parts.slice(-2).join('-');
  const first = parts.slice(0, -2).join('-');
  return `${first}-<br>${last2}`;
}

function pyBankShort(bank) {
  if (!bank) return '<span style="color:var(--text3)">未填</span>';
  const parts = bank.split(' ').filter(Boolean);
  return parts.slice(0,2).join(' ');
}



function canViewPayableRow(p) {
  if (p.case) return userCanViewCaseFinancials(p.case, 'payable');
  const level = permissionLevel('payable');
  if (['manage','view_all'].includes(level)) return true;
  return (isProfitPaymentType(p.paymentType) && p.profitPerson === currentUser.id) ||
    (p.paymentType === 'shareholder_distribution' && profitOffsetPerson(p) === currentUser.id);
}



function renderPayable() {
  const manage = canManage('payable');
  const showPaymentType = canViewPaymentType();
  const kpiRow = document.getElementById('py-kpi-row');
  if (kpiRow) kpiRow.style.display = canSeeFinancialTotals() ? '' : 'none';
  const filterCase = normalizeCaseFilterValue(document.getElementById('py-filter-case')?.value || '');
  const filterYear = document.getElementById('py-filter-year')?.value || '';
  const kw = (document.getElementById('py-search')?.value || '').toLowerCase();
  const fromDate = document.getElementById('py-date-from')?.value || '';
  const toDate = document.getElementById('py-date-to')?.value || '';
  const sortMode = document.getElementById('py-sort')?.value || 'date-desc';
  const payableDate = p => p.doneDate || p.transferDate || p.wantDate || p.ticket || (p.settlementId ? (PROFIT_SETTLEMENTS.find(s => s.id === p.settlementId)?.date || '') : '');
  const baseRows = PAYABLES.filter(p => {
    if (pyTab_current !== 'all' && p.status !== pyTab_current) return false;
    if (!canViewPayableRow(p)) return false;
    if (filterCase && p.case !== filterCase) return false;
    if (filterYear && !payableDate(p).startsWith(filterYear)) return false;
    if (!inDateRange(payableDate(p), fromDate, toDate)) return false;
    const searchable = [
      p.vendor, p.summary, p.caseName, p.case, p.person,
      p.wantDate, p.transferDate, p.doneDate, p.ticket, p.bank,
      searchAmountText(p.amount),
      showPaymentType ? paymentTypeLabel(p.paymentType) : '',
      isProfitPaymentType(p.paymentType) ? psPersonName(p.profitPerson) : '',
    ].filter(Boolean).join(' ').toLowerCase();
    if (!searchTextMatches(searchable, kw)) return false;
    return true;
  });
  const statsRows = PAYABLES.filter(p => {
    if (!canViewPayableRow(p)) return false;
    if (filterCase && p.case !== filterCase) return false;
    if (filterYear && !payableDate(p).startsWith(filterYear)) return false;
    if (!inDateRange(payableDate(p), fromDate, toDate)) return false;
    const searchable = [
      p.vendor, p.summary, p.caseName, p.case, p.person,
      p.wantDate, p.transferDate, p.doneDate, p.ticket, p.bank,
      searchAmountText(p.amount),
      showPaymentType ? paymentTypeLabel(p.paymentType) : '',
      isProfitPaymentType(p.paymentType) ? psPersonName(p.profitPerson) : '',
    ].filter(Boolean).join(' ').toLowerCase();
    if (!searchTextMatches(searchable, kw)) return false;
    return true;
  });
  // 「全年累計應付」要能超過目前瀏覽的日期區間（跟個案／年份／搜尋一起篩，但不受起訖日期限制）。
  const yearRows = PAYABLES.filter(p => {
    if (!canViewPayableRow(p)) return false;
    if (filterCase && p.case !== filterCase) return false;
    if (filterYear && !payableDate(p).startsWith(filterYear)) return false;
    const searchable = [
      p.vendor, p.summary, p.caseName, p.case, p.person,
      p.wantDate, p.transferDate, p.doneDate, p.ticket, p.bank,
      searchAmountText(p.amount),
      showPaymentType ? paymentTypeLabel(p.paymentType) : '',
      isProfitPaymentType(p.paymentType) ? psPersonName(p.profitPerson) : '',
    ].filter(Boolean).join(' ').toLowerCase();
    if (!searchTextMatches(searchable, kw)) return false;
    return true;
  });
  const rows = sortOpsRows(baseRows, sortMode, payableDate, p => p.vendor, p => p.amount);
  const statusLabel = {pending:'待審核', approved:'待付款', paid:'已付款'};
  const statusClass = {pending:'tag-pending', approved:'tag-active', paid:'tag-done'};
  const tbody = document.getElementById('py-tbody');
  if (!tbody) return;
  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="17" style="text-align:center;padding:32px;color:var(--text3)">無資料</td></tr>`;
  } else {
    tbody.innerHTML = rows.map((p,i) => `
      <tr style="border-bottom:1px solid var(--border)" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">
        <td style="padding:10px 14px;color:var(--text3);font-size:11px">${String(i+1).padStart(3,'0')}</td>
        <td style="padding:10px 6px 10px 14px;white-space:nowrap">
          <div style="font-size:12px;font-weight:500;white-space:normal">${isProfitPaymentType(p.paymentType) ? (p.profitCaseCodes||[]).map(code => CASES.find(c=>c.code===code)?.name || code).join('、') : (p.caseName||'')}</div>
          <div style="font-size:11px;font-family:'DM Mono',monospace;color:var(--accent)">${showPaymentType && isProfitPaymentType(p.paymentType) ? '分潤款' : caseCodeBreak(p.case||'—')}</div>
        </td>
        <td style="padding:10px 6px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:115px" title="${p.vendor}">${p.vendor}</td>
        <td style="padding:10px 14px;color:var(--text2);font-size:12px;white-space:normal;line-height:1.45;overflow-wrap:anywhere;min-width:170px;max-width:280px" title="${p.summary||''}">${p.summary||''}${showPaymentType && paymentTypeLabel(p.paymentType) ? `<div style="margin-top:3px;font-size:10px;color:var(--accent);line-height:1.4">${paymentTypeLabel(p.paymentType)}${isProfitPaymentType(p.paymentType) ? ' · ' + psPersonName(p.profitPerson) : ''}</div>` : ''}</td>
        <td style="padding:10px 14px;text-align:right;font-family:'DM Mono',monospace;font-weight:600">$${p.amount.toLocaleString('zh-TW')}</td>
        <td class="nowrap-col" style="padding:10px 14px;text-align:center;font-size:12px">${p.wantDate||'—'}</td>
        <td class="nowrap-col col-date" style="padding:10px 14px;text-align:center;font-size:12px">${p.transferDate||'—'}</td>
        <td class="nowrap-col col-date" style="padding:10px 14px;text-align:center;font-size:12px">${p.doneDate||'—'}</td>
        <td class="nowrap-col col-date" style="padding:10px 14px;text-align:center;font-size:12px">${p.ticket||'—'}</td>
        <td style="padding:10px 14px;text-align:center">
          <span class="tag ${p.invoice==='有'?'tag-done':p.invoice==='待補'?'tag-pending':'tag-inactive'}">${p.invoice}</span>
        </td>
        <td style="padding:10px 14px;text-align:center">
          <span class="tag ${p.receipt==='有'?'tag-done':p.receipt==='待補'?'tag-pending':'tag-inactive'}">${p.receipt}</span>
        </td>
        <td style="padding:10px 14px;text-align:center;white-space:nowrap">
          ${p.invoiceLink ? `<a href="${p.invoiceLink}" target="_blank" style="color:var(--accent);font-size:12px;text-decoration:none;margin-right:4px" title="開啟請款單">📄</a>` : '<span style="color:var(--text3);font-size:11px">無</span>'}
          ${p.receiptLink ? `<a href="${p.receiptLink}" target="_blank" style="color:var(--accent);font-size:12px;text-decoration:none" title="開啟發票">🧾</a>` : ''}
          ${manage ? `<button class="btn btn-ghost btn-sm" style="font-size:10px;padding:1px 5px;margin-left:4px" onclick="openLinks(${p.id})" title="設定附件連結">⋯</button>` : ''}
        </td>
        <td class="person-col" style="padding:10px 14px;text-align:center;font-size:12px">${p.person}</td>
        <td style="padding:10px 14px;text-align:center"><span class="tag ${statusClass[p.status]||'tag-pending'}">${statusLabel[p.status]||'未設定'}</span></td>
        <td class="col-bank" style="padding:10px 14px;text-align:center;font-size:12px">${pyBankShort(p.bank)}</td>
        <td class="col-bank" style="padding:6px 10px;max-width:100px">
          <input type="text" value="${p.note||''}" placeholder="${manage?'點此輸入備註…':''}" ${manage?'':'readonly'} title="${p.note||''}"
            style="background:transparent;border:none;outline:none;width:100%;font-size:12px;color:var(--text2);cursor:text;padding:4px 6px;border-radius:4px;text-overflow:ellipsis"
            onfocus="this.style.background='var(--surface2)';this.style.border='1px solid var(--border)'"
            onblur="this.style.background='transparent';this.style.border='none';pyUpdateNote(${p.id},this.value)"
            onkeydown="if(event.key==='Enter')this.blur()">
        </td>
        <td style="padding:10px 14px;text-align:center;white-space:nowrap">
          <div style="display:flex;align-items:center;justify-content:center;gap:4px;flex-wrap:wrap">
            ${manage && p.status==='pending'  ? `<button class="btn btn-sm" style="background:var(--success-bg);color:var(--success);border:1px solid rgba(110,184,148,0.3)" onclick="event.stopPropagation();openApprove(${p.id})">核准</button><button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();rejectPayable(${p.id})">退回</button>` : ''}
            ${manage && p.status==='approved' ? `<button class="btn btn-primary btn-sm" onclick="event.stopPropagation();markPaid(${p.id})">標記已付款</button>` : ''}
            ${manage ? (p.systemLocked ? `<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();openEditPayableModal(${p.id})">編輯付款資訊</button><span style="font-size:10px;color:var(--text3)">結算鎖定</span>` : `<select class="filter-select compact-action-select" aria-label="應付單操作" onchange="payableDocumentAction(this,${p.id})"><option value="">選項⋯</option><option value="clone">複製單據</option><option value="edit">編輯單據</option><option value="delete">刪除單據</option></select>`) : (p.status!=='paid' ? '<span style="font-size:11px;color:var(--text3)">唯讀</span>' : '')}
          </div>
        </td>
      </tr>`).join('');
  }
  updatePayableStats(statsRows, yearRows);
}

function updatePayableStats(scopeRows = null, yearScopeRows = null) {
  const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
  if (!canSeeFinancialTotals()) {
    set('py-stat-pending-count', '—');
    set('py-stat-pending-amt', '僅管理者');
    set('py-stat-approved-amt', '—');
    set('py-stat-approved-count', '僅管理者');
    set('py-stat-paid-amt', '—');
    set('py-stat-paid-count', '僅管理者');
    set('py-stat-total-amt', '—');
    set('py-stat-total-sub', '僅管理者');
    const badge = document.getElementById('py-badge-pending');
    if (badge) badge.style.display = 'none';
    return;
  }
  const visiblePayables = scopeRows || PAYABLES.filter(p => !p.case || userCanViewCaseFinancials(p.case, 'payable'));
  const pending  = visiblePayables.filter(p => p.status==='pending');
  const approved = visiblePayables.filter(p => p.status==='approved');
  const paid     = visiblePayables.filter(p => p.status==='paid');
  const sum = arr => arr.reduce((s,p)=>s+p.amount,0);
  set('py-stat-pending-count', pending.length + ' 筆');
  set('py-stat-pending-amt', '$' + sum(pending).toLocaleString('zh-TW'));
  set('py-stat-approved-amt', '$' + sum(approved).toLocaleString('zh-TW'));
  set('py-stat-approved-count', approved.length + ' 筆');

  const selYear = document.getElementById('py-filter-year')?.value || '';
  const paidDate = p => p.doneDate || p.transferDate || p.wantDate || '';
  // 已付款合計：跟「待審核」「待付款」一樣算目前篩選範圍內的，不要另外跟「今天的真實月份」交集——
  // 不然瀏覽別的月份時，明明畫面上一堆已付款，這裡卻顯示 $0，看起來像沒統計到。
  // 全年累計應付：故意不受起訖日期篩選影響（跟個案／年份／搜尋一起篩），不然篩了某個月份區間，
  // 這裡會跟「已付款合計」算出一樣的數字，看起來像沒有把全年度算進去。
  const yearBasePayables = yearScopeRows || visiblePayables;
  const yearPaid = yearScopeRows ? yearBasePayables.filter(p => p.status === 'paid') : paid;
  const paidScopedYear = selYear ? yearPaid.filter(p => paidDate(p).startsWith(selYear)) : yearPaid;

  set('py-stat-paid-amt', '$' + sum(paid).toLocaleString('zh-TW'));
  set('py-stat-paid-count', paid.length + ' 筆');
  set('py-stat-total-amt', '$' + sum(paidScopedYear).toLocaleString('zh-TW'));
  set('py-stat-total-sub', selYear ? selYear + ' 年度' : '全部年度');
  // 動態更新案件篩選下拉
  const caseFilter = document.getElementById('py-filter-case');
  if (caseFilter) {
    const curVal = caseFilter.value;
    caseFilter.innerHTML = buildCaseOptions('── 全部個案 ──', false, false, curVal, c => userCanViewCaseFinancials(c.code, 'payable'));
    caseFilter.value = curVal;
  }
  const badge = document.getElementById('py-badge-pending');
  if (badge) { badge.textContent = pending.length; badge.style.display = pending.length ? '' : 'none'; }
}

function openApprove(id) {
  if (!requireManage('payable', '您沒有核准應付帳款的權限')) return;
  pyApproveTarget = PAYABLES.find(p => p.id===id);
  if (!pyApproveTarget) return;
  const p = pyApproveTarget;
  document.getElementById('ap-vendor').value        = p.vendor;
  document.getElementById('ap-amount').value        = p.amount.toLocaleString('zh-TW');
  document.getElementById('ap-bank').value          = p.bank || '';
  document.getElementById('ap-transfer-date').value = p.transferDate || '';
  document.getElementById('ap-done-date').value     = p.doneDate || '';
  document.getElementById('ap-ticket').value        = p.ticket || '';
  document.getElementById('ap-note').value          = p.note || '';
  openModal('modal-approve-payable');
}

function confirmApprove() {
  if (!requireManage('payable', '您沒有核准應付帳款的權限')) return;
  if (!pyApproveTarget) return;
  const bank   = document.getElementById('ap-bank').value;
  const date   = document.getElementById('ap-transfer-date').value;
  const doneDate = document.getElementById('ap-done-date').value;
  const vendor = document.getElementById('ap-vendor').value.trim();
  const amtRaw = document.getElementById('ap-amount').value.replace(/[^0-9\-]/g,'');
  if (!vendor) { showToast('請填寫受款廠商', 'error'); return; }
  if (!bank)   { showToast('請選擇付款銀行', 'error'); return; }
  if (!date)   { showToast('請填寫預約匯款日', 'error'); return; }
  Object.assign(pyApproveTarget, {
    status: doneDate ? 'paid' : 'approved',
    vendor, amount: amtRaw ? parseInt(amtRaw) : pyApproveTarget.amount,
    bank, transferDate: date,
    doneDate,
    ticket:   document.getElementById('ap-ticket').value,
    note:     document.getElementById('ap-note').value
  });
  touchRowMeta(pyApproveTarget);
  syncTaxLiabilityForPayable(pyApproveTarget);
  pyRebuildRentOverhead();
  closeModal('modal-approve-payable');
  renderPayable();
  renderCases();
  renderDashboard();
  renderProfit();
  renderProfitShare();
  renderOverhead();
  saveData();
  showToast(doneDate ? '已核准並依完成匯款日標記為已付款 ✓' : '已核准，移至待付款 ✓', 'success');
}

function pyUpdateNote(id, val) {
  if (!canManage('payable')) return;
  const p = PAYABLES.find(x => x.id===id);
  if (p) { p.note = val; touchRowMeta(p); pyRebuildRentOverhead(); renderOverhead(); saveData(); }
}

let pyLinkTarget = null;
function openLinks(id) {
  if (!requireManage('payable')) return;
  pyLinkTarget = PAYABLES.find(p => p.id===id);
  if (!pyLinkTarget) return;
  document.getElementById('link-invoice').value = pyLinkTarget.invoiceLink || '';
  document.getElementById('link-receipt').value = pyLinkTarget.receiptLink || '';
  openModal('modal-links');
}
function saveLinks() {
  if (!requireManage('payable')) return;
  if (!pyLinkTarget) return;
  pyLinkTarget.invoiceLink = document.getElementById('link-invoice').value.trim();
  pyLinkTarget.receiptLink = document.getElementById('link-receipt').value.trim();
  touchRowMeta(pyLinkTarget);
  closeModal('modal-links');
  renderPayable();
  saveData();
  showToast('附件連結已儲存 ✓', 'success');
}

// 來源：行政院人事行政總處 115、116 年政府行政機關辦公日曆表。
// 週六、週日由程式判斷；此表收錄落在週一至週五的政府放假日與補假日。
const TW_GOV_WEEKDAY_HOLIDAYS = new Set([
  '2026-01-01','2026-02-16','2026-02-17','2026-02-18','2026-02-19','2026-02-20','2026-02-27',
  '2026-04-03','2026-04-06','2026-05-01','2026-06-19','2026-09-25','2026-09-28','2026-10-09',
  '2026-10-26','2026-12-25',
  '2027-01-01','2027-02-04','2027-02-05','2027-02-08','2027-02-09','2027-02-10','2027-03-01',
  '2027-04-05','2027-04-06','2027-04-30','2027-06-09','2027-09-15','2027-09-28','2027-10-11',
  '2027-10-25','2027-12-24','2027-12-31'
]);

function pyIsGovernmentWorkday(date) {
  const day = date.getDay();
  return day !== 0 && day !== 6 && !TW_GOV_WEEKDAY_HOLIDAYS.has(localDateKey(date));
}

function pyScheduledPaymentDate(reservationDate) {
  const parts = String(reservationDate || '').split('-').map(Number);
  if (parts.length !== 3 || parts.some(n => !Number.isFinite(n))) return reservationDate || '';
  let [year, month, day] = parts;
  let payDay = 10;
  if (day >= 9 && day <= 18) payDay = 20;
  else if (day >= 19 && day <= 28) payDay = 30;
  else if (day >= 29) {
    month += 1;
    if (month > 12) { month = 1; year += 1; }
  }
  const scheduled = new Date(year, month - 1, payDay, 12, 0, 0);
  while (!pyIsGovernmentWorkday(scheduled)) scheduled.setDate(scheduled.getDate() - 1);
  return localDateKey(scheduled);
}

function markPaid(id) {
  if (!requireManage('payable', '您沒有標記付款的權限')) return;
  const p = PAYABLES.find(x => x.id===id);
  if (!p) return;
  const before = auditClone(p);
  const today = localDateKey(new Date());
  let actualRentDate = '';
  if (pyIsCompanyRentPayable(p)) {
    actualRentDate = prompt('請確認公司房租實際完成付款日（歸屬月份以此日期為準）：', today);
    if (actualRentDate === null) return;
    const parsed = new Date(`${actualRentDate}T12:00:00`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(actualRentDate) || Number.isNaN(parsed.getTime()) || localDateKey(parsed) !== actualRentDate) {
      showToast('實際付款日格式不正確，請使用 YYYY-MM-DD', 'error');
      return;
    }
  }
  p.status = 'paid';
  p.transferDate = today;
  p.doneDate = actualRentDate || pyScheduledPaymentDate(today);
  touchRowMeta(p);
  syncTaxLiabilityForPayable(p);
  pyRebuildRentOverhead();
  normalizeProfitPayables();
  recordAuditLog('markPaid', 'payable', p.id, before, p, {
    riskLevel:'high',
    targetLabel:`${p.vendor || '受款人未填'}／${p.summary || '付款項目未填'}`,
    fields:['status','amount','vendor','summary','transferDate','doneDate','bank','paymentType','case','caseName']
  });
  renderPayable(); renderPayreq(); renderCases(); renderOverhead(); renderDashboard(); renderProfit();
  renderProfitShare();
  saveData();
  showToast(`已預約匯款：${p.transferDate}；預定完成：${p.doneDate} ✓`, 'success');
}

function pyIsCompanyRentPayable(p) {
  if (!p || p.paymentType !== 'overhead_link') return false;
  const text = `${p.vendor || ''} ${p.summary || ''} ${p.note || ''}`;
  return text.includes('房租') && !String(p.case || '').trim();
}

function pyRebuildRentOverhead() {
  const idx = OH_FIXED_CONFIG.indexOf('房租');
  if (idx < 0) return;
  const linkedByMonth = new Map();
  PAYABLES.filter(p => p.status === 'paid' && pyIsCompanyRentPayable(p)).forEach(p => {
    const date = p.doneDate || p.transferDate || p.wantDate || '';
    const month = date.slice(0,7);
    if (!prIsValidMonth(month)) return;
    if (!linkedByMonth.has(month)) linkedByMonth.set(month, []);
    linkedByMonth.get(month).push(p);
  });
  const months = new Set(linkedByMonth.keys());
  Object.entries(OVERHEAD || {}).forEach(([month, data]) => {
    if (data?.rentPayableManaged) months.add(month);
  });
  months.forEach(month => {
    if (!OVERHEAD[month]) ohInitMonth(month);
    const data = OVERHEAD[month];
    data.fixed = data.fixed || OH_FIXED_CONFIG.map(()=>0);
    data.fixedNotes = data.fixedNotes || OH_FIXED_CONFIG.map(()=>'');
    while (data.fixed.length < OH_FIXED_CONFIG.length) data.fixed.push(0);
    while (data.fixedNotes.length < OH_FIXED_CONFIG.length) data.fixedNotes.push('');
    if (!data.rentPayableManaged) {
      data.rentManualBackup = Number(data.fixed[idx]) || 0;
      data.rentManualNoteBackup = String(data.fixedNotes[idx] || '');
    }
    const rows = (linkedByMonth.get(month) || []).sort((a,b) => Number(a.id) - Number(b.id));
    data.rentPayableManaged = true;
    data.rentPayableLinks = rows.map(p => ({
      payableId:p.id,
      amount:Number(p.amount) || 0,
      paidDate:p.doneDate || p.transferDate || p.wantDate || '',
      vendor:p.vendor || '',
      summary:p.summary || ''
    }));
    data.fixed[idx] = data.rentPayableLinks.reduce((sum, row) => sum + row.amount, 0);
    data.fixedNotes[idx] = data.rentPayableLinks.map(row =>
      `AP#${row.payableId} 應付已付款連動：${row.vendor || '受款人未填'}／${row.summary || '房租'}／${row.amount.toLocaleString('zh-TW')}／${row.paidDate}`
    ).join('；');
  });
  pyRebuildAdditionalPayableOverhead();
}

function pyMonthOffset(month, offset) {
  const match = String(month || '').match(/^(\d{4})-(\d{2})$/);
  if (!match) return '';
  const date = new Date(Number(match[1]), Number(match[2]) - 1 + Number(offset || 0), 1, 12, 0, 0);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function pyRebuildAdditionalPayableOverhead() {
  const managedVariableTypes = new Set(['payable_overhead_link', 'prepaid_amortization']);
  Object.values(OVERHEAD || {}).forEach(data => {
    if (!data || typeof data !== 'object') return;
    if (!Array.isArray(data.variable)) data.variable = [];
    data.variable = data.variable.filter(row => !managedVariableTypes.has(row.sourceType));
  });

  const fixedGroups = new Map();
  PAYABLES.filter(p => p.status === 'paid' && p.paymentType === 'overhead_link' && p.overheadTreatment === 'fixed' && p.overheadItem).forEach(p => {
    const month = String(p.doneDate || p.transferDate || p.wantDate || '').slice(0, 7);
    if (!prIsValidMonth(month)) return;
    const key = `${month}|${p.overheadItem}`;
    if (!fixedGroups.has(key)) fixedGroups.set(key, { month, item:p.overheadItem, rows:[] });
    fixedGroups.get(key).rows.push(p);
  });
  const fixedKeys = new Set(fixedGroups.keys());
  Object.entries(OVERHEAD || {}).forEach(([month, data]) => {
    Object.entries(data?.fixedPayableManagedItems || {}).forEach(([item, meta]) => {
      const key = `${month}|${item}`;
      if (fixedKeys.has(key)) return;
      const idx = OH_FIXED_CONFIG.indexOf(item);
      if (idx >= 0) {
        data.fixed[idx] = Number(meta.manualBackup) || 0;
        data.fixedNotes[idx] = String(meta.manualNoteBackup || '');
      }
      delete data.fixedPayableManagedItems[item];
    });
  });
  fixedGroups.forEach(({month, item, rows}) => {
    if (!OH_FIXED_CONFIG.includes(item)) {
      OH_FIXED_CONFIG.push(item);
      Object.values(OVERHEAD).forEach(monthData => {
        if (Array.isArray(monthData.fixed)) monthData.fixed.push(0);
        if (Array.isArray(monthData.fixedNotes)) monthData.fixedNotes.push('');
      });
    }
    if (!OVERHEAD[month]) ohInitMonth(month);
    const data = OVERHEAD[month];
    const idx = OH_FIXED_CONFIG.indexOf(item);
    data.fixedPayableManagedItems = data.fixedPayableManagedItems || {};
    const existing = data.fixedPayableManagedItems[item];
    const meta = existing || {
      manualBackup:Number(data.fixed[idx]) || 0,
      manualNoteBackup:String(data.fixedNotes[idx] || '')
    };
    meta.links = rows.map(p => ({ sourceKey:p.sourceKey || '', payableId:p.id, amount:Number(p.amount) || 0, paidDate:p.doneDate || p.transferDate || p.wantDate || '' }));
    data.fixedPayableManagedItems[item] = meta;
    data.fixed[idx] = (Number(meta.manualBackup) || 0) + meta.links.reduce((sum, row) => sum + row.amount, 0);
    const linkedNotes = rows.map(p => `AP#${p.id} ${p.vendor || '受款人未填'}／${p.summary || item}／${(Number(p.amount)||0).toLocaleString('zh-TW')}`).join('；');
    data.fixedNotes[idx] = [meta.manualNoteBackup, linkedNotes].filter(Boolean).join('；');
  });

  PAYABLES.filter(p => p.status === 'paid' && p.paymentType === 'overhead_link' && p.overheadTreatment === 'variable').forEach(p => {
    const month = String(p.doneDate || p.transferDate || p.wantDate || '').slice(0, 7);
    if (!prIsValidMonth(month)) return;
    if (!OVERHEAD[month]) ohInitMonth(month);
    OVERHEAD[month].variable.push({
      id:ohVarNextId++, sourceKey:`overhead-payable:${p.sourceKey || p.id}`, sourcePayableId:p.id,
      sourceType:'payable_overhead_link', name:p.overheadItem || p.summary || '公司不固定開銷',
      amount:Number(p.amount) || 0, note:`應付已付款連動：${p.vendor || '受款人未填'}／${p.summary || ''}`
    });
  });

  PAYABLES.filter(p => p.status === 'paid' && p.paymentType === 'prepaid_expense' && p.amortizationStartMonth && Number(p.amortizationMonths) > 0).forEach(p => {
    const months = Math.max(1, Math.trunc(Number(p.amortizationMonths)));
    const total = Math.round(Number(p.amount) || 0);
    const monthly = Math.round(total / months);
    let allocated = 0;
    for (let i = 0; i < months; i += 1) {
      const month = pyMonthOffset(p.amortizationStartMonth, i);
      if (!month) continue;
      if (!OVERHEAD[month]) ohInitMonth(month);
      const amount = i === months - 1 ? total - allocated : monthly;
      allocated += amount;
      OVERHEAD[month].variable.push({
        id:ohVarNextId++, sourceKey:`amortization:${p.sourceKey || p.id}:${month}`, sourcePayableId:p.id,
        sourceType:'prepaid_amortization', name:p.overheadItem || p.summary || '預付費用攤提', amount,
        note:`${p.vendor || '受款人未填'}／${p.summary || ''}；第 ${i + 1}/${months} 期攤提`
      });
    }
  });
}

function rejectPayable(id) {
  if (!requireManage('payable', '您沒有退回應付帳款的權限')) return;
  const p = PAYABLES.find(row => row.id === id);
  if (!p) return;
  if (!confirm(`確定退回並移除這筆應付帳款？\n${p.vendor || '受款人未填'}／${p.summary || '項目未填'}\n$${(p.amount || 0).toLocaleString('zh-TW')}`)) return;
  const before = auditClone(p);
  PAYABLES = PAYABLES.filter(p => p.id!==id);
  TAX_LIABILITIES = TAX_LIABILITIES.filter(r => String(r.sourcePayableId) !== String(id));
  pyRebuildRentOverhead();
  recordAuditLog('reject', 'payable', id, before, null, {
    riskLevel:'high',
    targetLabel:`${before.vendor || '受款人未填'}／${before.summary || '項目未填'}`
  });
  renderPayable();
  renderCases();
  renderDashboard();
  renderProfit();
  renderProfitShare();
  renderOverhead();
  saveData();
  showToast('已退回並移除', 'warning');
}


function openAddPayableModal() {
  if (!requireManage('payable', '您沒有新增應付帳款的權限')) return;
  const caseEl = document.getElementById('ap-add-case'); if (caseEl) caseEl.value = '';
  refreshAllCaseDropdowns();
  // 填充廠商 datalist
  const dl = document.getElementById('dl-ap-vendors');
  if (dl) dl.innerHTML = VENDORS.map(v => `<option value="${v.code} - ${v.name}">`).join('');
  // 重設為新增模式
  document.getElementById('ap-edit-id').value = '';
  document.getElementById('ap-modal-title').textContent = '手動新增應付帳款';
  document.getElementById('ap-submit-btn').textContent  = '新增';
  const lockedHint = document.getElementById('ap-locked-payment-hint');
  if (lockedHint) lockedHint.style.display = 'none';
  ['ap-add-vendor','ap-add-amount','ap-add-summary','ap-add-payment-type','ap-add-profit-person','ap-add-person'].forEach(fieldId => {
    const el = document.getElementById(fieldId); if (el) el.disabled = false;
  });
  const amountEl = document.getElementById('ap-add-amount');
  if (amountEl) amountEl.placeholder = '例：420,000';
  // 清空欄位
  ['ap-add-vendor','ap-add-amount','ap-add-summary','ap-add-note','ap-add-date','ap-add-transfer-date','ap-add-done-date','ap-add-ticket','ap-add-overhead-item','ap-add-amortization-start','ap-add-amortization-months'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const bankEl = document.getElementById('ap-add-bank'); if (bankEl) bankEl.value = '';
  const typeEl = document.getElementById('ap-add-payment-type'); if (typeEl) typeEl.value = 'vendor';
  const profitPersonEl = document.getElementById('ap-add-profit-person'); if (profitPersonEl) profitPersonEl.value = 'peng';
  fillActiveUserNameSelect('ap-add-person', currentUser.name);
  apTogglePaymentType([]);
  // 重設 radio
  ['rg-ap-inv','rg-ap-rec'].forEach(gid => {
    const g = document.getElementById(gid); if (!g) return;
    g.querySelectorAll('.radio-opt').forEach((o,i) => {
      const active = i === 0;
      o.classList.toggle('selected', active);
      o.querySelector('.radio-dot').classList.toggle('filled', active);
    });
  });
  openModal('modal-add-payable');
}

function openEditPayableModal(id) {
  if (!requireManage('payable', '您沒有編輯應付帳款的權限')) return;
  const p = PAYABLES.find(x => x.id === id);
  if (!p) return;
  const caseEl = document.getElementById('ap-add-case');
  if (caseEl) caseEl.innerHTML = buildCaseOptions('── 選擇個案名稱 ──', false, true, p.case || '');
  const dl = document.getElementById('dl-ap-vendors');
  if (dl) dl.innerHTML = VENDORS.map(v => `<option value="${v.code} - ${v.name}">`).join('');
  // 設定編輯模式
  document.getElementById('ap-edit-id').value = id;
  document.getElementById('ap-modal-title').textContent = '編輯應付帳款';
  document.getElementById('ap-submit-btn').textContent  = '儲存修改';
  // 填入資料
  if (caseEl) caseEl.value = p.case || '';
  document.getElementById('ap-add-vendor').value  = p.vendor  || '';
  document.getElementById('ap-add-amount').value  = p.amount  ? p.amount.toLocaleString('zh-TW') : '';
  document.getElementById('ap-add-summary').value = p.summary || '';
  document.getElementById('ap-add-note').value    = p.note || '';
  document.getElementById('ap-add-date').value    = p.wantDate || '';
  document.getElementById('ap-add-transfer-date').value = p.transferDate || '';
  document.getElementById('ap-add-done-date').value     = p.doneDate || '';
  document.getElementById('ap-add-ticket').value        = p.ticket || '';
  document.getElementById('ap-add-overhead-item').value = p.overheadItem || '';
  document.getElementById('ap-add-amortization-start').value = p.amortizationStartMonth || '';
  document.getElementById('ap-add-amortization-months').value = p.amortizationMonths || '';
  const bankEl = document.getElementById('ap-add-bank'); if (bankEl) bankEl.value = p.bank || '';
  const statusEl = document.getElementById('ap-add-status'); if (statusEl) statusEl.value = p.status || 'approved';
  const typeEl = document.getElementById('ap-add-payment-type'); if (typeEl) typeEl.value = p.paymentType || 'vendor';
  const profitPersonEl = document.getElementById('ap-add-profit-person'); if (profitPersonEl) profitPersonEl.value = p.profitPerson || 'peng';
  apTogglePaymentType(p.profitCaseCodes || (p.case ? [p.case] : []));
  // 設定 radio
  const setRadio = (gid, val) => {
    const g = document.getElementById(gid); if (!g) return;
    g.querySelectorAll('.radio-opt').forEach(o => {
      const match = o.textContent.trim() === val;
      o.classList.toggle('selected', match);
      o.querySelector('.radio-dot').classList.toggle('filled', match);
    });
  };
  setRadio('rg-ap-inv', p.invoice || '有');
  setRadio('rg-ap-rec', p.receipt || '有');
  fillActiveUserNameSelect('ap-add-person', p.person || currentUser.name, { includeInactive:true });
  const personEl = document.getElementById('ap-add-person'); if (personEl) personEl.value = p.person || '';
  const lockedIds = ['ap-add-vendor','ap-add-payment-type','ap-add-profit-person','ap-add-person'];
  lockedIds.forEach(fieldId => {
    const el = document.getElementById(fieldId);
    if (el) el.disabled = !!p.systemLocked;
  });
  const amountEl = document.getElementById('ap-add-amount');
  if (amountEl) {
    amountEl.disabled = false;
    amountEl.placeholder = p.systemLocked ? '本次付款金額；少於待付款會保留餘額' : '例：420,000';
  }
  const lockedHint = document.getElementById('ap-locked-payment-hint');
  if (lockedHint) lockedHint.style.display = p.systemLocked ? '' : 'none';
  document.querySelectorAll('#ap-profit-case-list input').forEach(el => { el.disabled = !!p.systemLocked; });
  if (p.systemLocked) document.getElementById('ap-modal-title').textContent = '編輯結算款付款資訊';
  apUpdateAmortizationPreview();
  openModal('modal-add-payable');
}

function clonePayable(id) {
  if (!requireManage('payable', '您沒有新增應付帳款的權限')) return;
  const p = PAYABLES.find(x => Number(x.id) === Number(id));
  if (!p || p.systemLocked) { showToast('系統結算款不可複製', 'error'); return; }
  openEditPayableModal(id);
  document.getElementById('ap-edit-id').value = '';
  document.getElementById('ap-modal-title').textContent = '複製應付帳款';
  document.getElementById('ap-submit-btn').textContent = '建立新應付';
  document.getElementById('ap-add-transfer-date').value = '';
  document.getElementById('ap-add-done-date').value = '';
  document.getElementById('ap-add-ticket').value = '';
  document.getElementById('ap-add-bank').value = '';
  document.getElementById('ap-add-status').value = 'pending';
}

function payableDocumentAction(select, id) {
  const action = select?.value || '';
  if (select) select.value = '';
  if (action === 'clone') clonePayable(id);
  else if (action === 'edit') openEditPayableModal(id);
  else if (action === 'delete') deletePayableConfirm(id);
}

function apTogglePaymentType(selectedCodes = null) {
  const type = document.getElementById('ap-add-payment-type')?.value || 'vendor';
  const isProfit = isProfitPaymentType(type);
  const requiresVendorCase = type === 'vendor' || type === 'family_pass_through' || type === 'private_loan';
  const personField = document.getElementById('ap-profit-person-field');
  if (personField) personField.style.display = isProfit ? '' : 'none';
  const profitPersonEl = document.getElementById('ap-add-profit-person');
  if (profitPersonEl && isProfit) {
    const currentPerson = profitPersonEl.value;
    profitPersonEl.innerHTML = psParticipantList().map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    if ([...profitPersonEl.options].some(o => o.value === currentPerson)) profitPersonEl.value = currentPerson;
  }
  const profitCasesField = document.getElementById('ap-profit-cases-field');
  if (profitCasesField) profitCasesField.style.display = isProfit ? '' : 'none';
  const vendorCaseField = document.getElementById('ap-vendor-case-field');
  if (vendorCaseField) vendorCaseField.style.display = requiresVendorCase ? '' : 'none';
  const caseEl = document.getElementById('ap-add-case');
  if (caseEl) caseEl.required = requiresVendorCase;
  const amortizationFields = document.getElementById('ap-amortization-fields');
  if (amortizationFields) amortizationFields.style.display = type === 'prepaid_expense' ? '' : 'none';
  apUpdateAmortizationPreview();
  if (isProfit) {
    const list = document.getElementById('ap-profit-case-list');
    if (list) {
      const current = Array.isArray(selectedCodes)
        ? selectedCodes
        : [...list.querySelectorAll('input:checked')].map(x => x.value);
      const canUseForProfitAdvance = c => c.status !== '結案' && psIsProfitSettlementCase(c)
        && userCanViewCaseFinancials(c.code, 'profit');
      const profitCases = CASES.filter(c => canUseForProfitAdvance(c) || current.includes(c.code));
      list.innerHTML = buildCaseCheckboxGroups(profitCases, c => current.includes(c.code), '', { flexItem:true });
      if (!profitCases.length) list.innerHTML = '<span style="padding:6px;color:var(--text3);font-size:12px">目前沒有可關聯的未結案分潤個案</span>';
    }
  }
}

function apUpdateAmortizationPreview() {
  const preview = document.getElementById('ap-amortization-preview');
  if (!preview) return;
  const fmt = n => '$' + Math.round(n).toLocaleString('zh-TW');
  const amount = parseInt((document.getElementById('ap-add-amount')?.value || '').replace(/[^0-9\-]/g,''));
  const start = document.getElementById('ap-add-amortization-start')?.value || '';
  const months = parseInt(document.getElementById('ap-add-amortization-months')?.value || '');
  if (!Number.isFinite(amount) || amount <= 0 || !/^\d{4}-\d{2}$/.test(start) || !Number.isInteger(months) || months < 1) {
    preview.textContent = '填入金額、開始月份與期數後顯示攤提預覽。';
    return;
  }
  const [year, month] = start.split('-').map(Number);
  const endDate = new Date(year, month - 1 + months - 1, 1);
  const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2,'0')}`;
  const regular = Math.round(amount / months);
  const last = amount - regular * (months - 1);
  preview.textContent = `攤提期間 ${start}～${end}，共 ${months} 期；每月 ${fmt(regular)}，最後一期 ${fmt(last)}，合計 ${fmt(amount)}。`;
}

function apSyncStatusFromDoneDate() {
  const doneDateEl = document.getElementById('ap-add-done-date');
  const statusEl = document.getElementById('ap-add-status');
  if (doneDateEl?.value && statusEl) statusEl.value = 'paid';
}

function syncDerivedReceivableForPayable(payable) {
  if (!payable) return;
  const sourceKey = `payable:${payable.id}`;
  const existingIdx = RECEIVABLES.findIndex(r => r.sourcePayableId === payable.id || r.sourceKey === sourceKey);
  if (existingIdx >= 0) RECEIVABLES.splice(existingIdx, 1);
}

function taxPeriodFromPayable(payable, taxType) {
  const text = `${payable?.summary || ''} ${payable?.note || ''}`;
  if (taxType === '營所稅') {
    const roc = text.match(/(?:民國)?(\d{3})\s*年?\s*(?:營所稅|營利事業所得稅)/);
    if (roc) return String(Number(roc[1]) + 1911);
    return String(payable?.doneDate || payable?.transferDate || payable?.wantDate || '').slice(0,4);
  }
  const months = text.match(/(?:^|\D)(1[0-2]|0?[1-9])\s*[.、~～至\/-]\s*(1[0-2]|0?[1-9])\s*月?/);
  const year = String(payable?.doneDate || payable?.transferDate || payable?.wantDate || '').slice(0,4);
  if (months && /^\d{4}$/.test(year)) {
    const a = Number(months[1]);
    const b = Number(months[2]);
    return `${year}-${String(a).padStart(2,'0')}~${String(b).padStart(2,'0')}`;
  }
  return year;
}

function syncTaxLiabilityForPayable(payable) {
  if (!payable) return;
  const inferredType = /營所稅|營利事業所得稅/.test(`${payable.summary || ''} ${payable.note || ''}`) ? '營所稅' : '營業稅';
  const payableDate = payable.doneDate || payable.transferDate || '';
  let existingIdx = TAX_LIABILITIES.findIndex(r => String(r.sourcePayableId) === String(payable.id));
  if (existingIdx < 0) existingIdx = TAX_LIABILITIES.findIndex(r =>
    r.sourcePayableId == null && r.taxType === inferredType && Number(r.amount) === Number(payable.amount) && String(r.payDate || '') === String(payableDate)
  );
  if (payable.paymentType !== 'tax_liability') {
    if (existingIdx >= 0) TAX_LIABILITIES.splice(existingIdx, 1);
    return;
  }
  const existing = existingIdx >= 0 ? TAX_LIABILITIES[existingIdx] : null;
  const row = existing || { id:TAX_LIABILITIES.reduce((m,r) => Math.max(m, Number(r.id)||0), 0) + 1, sourceKey:`payable-tax-${payable.id}`, sourcePayableId:payable.id };
  Object.assign(row, {
    taxType:row.payableTaxFieldsAdjusted ? row.taxType : inferredType,
    period:row.payableTaxFieldsAdjusted ? row.period : taxPeriodFromPayable(payable, inferredType),
    amount:Number(payable.amount) || 0,
    payDate:payable.doneDate || payable.transferDate || '',
    status:payable.status === 'paid' ? 'paid' : 'pending',
    note:`應付 AP#${payable.id} 連動：${payable.vendor || '受款人未填'}／${payable.summary || '繳稅'}`,
    source:'payable_tax_link', sourcePayableId:payable.id,
    sourceKey:existing?.sourceKey || `payable-tax-${payable.id}`
  });
  tagCompany([row]);
  touchRowMeta(row, !existing);
  if (!existing) TAX_LIABILITIES.push(row);
}

function deletePayableConfirm(id) {
  if (!requireManage('payable', '您沒有刪除應付帳款的權限')) return;
  const p = PAYABLES.find(x => x.id === id);
  if (!p) return;
  if (p.systemLocked) { showToast('系統結算款不可單獨刪除，請由分潤關係表撤銷結算','error'); return; }
  if (!confirm(`確定刪除「${p.vendor}」$${p.amount.toLocaleString('zh-TW')} 這筆應付帳款？`)) return;
  const affectedCase = p.case;
  rememberDeletedSourceKey(p.sourceKey);
  PAYABLES = PAYABLES.filter(x => x.id !== id);
  RECEIVABLES = RECEIVABLES.filter(r => r.sourcePayableId !== id && r.sourceKey !== `payable:${id}`);
  TAX_LIABILITIES = TAX_LIABILITIES.filter(r => String(r.sourcePayableId) !== String(id));
  pyRebuildRentOverhead();
  refreshAccountingLinkedViews(affectedCase);
  saveData();
  showToast('已刪除 ✓', 'warning');
}

function buildProfitSettlementPayable(settlement, personRow) {
  const amount = Math.round(Number(personRow?.unpaid) || 0);
  if (!settlement || !personRow || amount <= 0) return null;
  const caseCodes = (settlement.cases || []).map(c => c.code).filter(Boolean);
  return {
    id: pyNextId++,
    sourceKey: `profit-settlement-${settlement.id}-${personRow.person}`,
    settlementId: settlement.id,
    systemLocked: true,
    psSettled: true,
    case:'', caseName:'',
    vendor:personRow.name,
    summary:`分潤結算（單號 ${settlement.id}）未領款`,
    amount,
    wantDate:settlement.date || '', transferDate:'', doneDate:'', ticket:'', bank:'',
    invoice:'無', receipt:'無', person:currentUser.name,
    profitPerson:personRow.person, paymentType:'profit_settlement',
    profitCaseCodes:caseCodes, status:'approved',
    note:`${settlement.date || ''} 系統依分潤結算自動建立`
  };
}

function psEnsureSettlementPayables(id) {
  if (!requireManage('profitshare')) return;
  const settlement = PROFIT_SETTLEMENTS.find(s => s.id === id);
  if (!settlement) return;
  const generatedIds = new Set(settlement.generatedPayableIds || []);
  const existingGenerated = PAYABLES
    .filter(p => (generatedIds.has(p.id) || (p.settlementId === settlement.id && p.paymentType === 'profit_settlement')) && p.status !== 'rejected');
  existingGenerated.forEach(p => generatedIds.add(p.id));
  const existingPeople = new Set(existingGenerated.map(p => p.profitPerson || p.vendor));
  const rows = (settlement.persons || [])
    .filter(p => (Number(p.unpaid) || 0) > 0.5)
    .filter(p => !existingPeople.has(p.person) && !existingPeople.has(p.name));
  if (!rows.length) { showToast('這次結算沒有缺漏的待付分潤款', 'warning'); return; }
  const beforeSummary = auditSummary();
  const created = rows.map(row => buildProfitSettlementPayable(settlement, row)).filter(Boolean);
  created.forEach(row => touchRowMeta(row, true));
  PAYABLES.push(...created);
  settlement.generatedPayableIds = [...generatedIds, ...created.map(row => row.id)];
  recordAuditLog('create', 'profitSettlementPayables', id, beforeSummary, auditSummary(), {
    riskLevel:'high',
    targetLabel:`補產生分潤結算 #${id} 應付`,
    diff:[{ field:'generatedPayables', beforeValue:generatedIds.size, afterValue:settlement.generatedPayableIds.length }]
  });
  renderProfitShare(); renderPayable(); renderDashboard();
  saveData();
  showToast(`已補產生 ${created.length} 筆待付分潤款 ✓`, 'success');
}

function payPartialSystemLockedPayable(p, amtNum, info) {
  const currentAmount = Math.round(Number(p.amount) || 0);
  const payAmount = Math.round(Number(amtNum) || 0);
  if (payAmount <= 0) { showToast('請填寫本次付款金額', 'error'); return { ok:false }; }
  if (payAmount > currentAmount) { showToast('本次付款金額不可大於待付款餘額', 'error'); return { ok:false }; }
  const payDate = info.doneDate || info.transferDate || info.date || new Date().toISOString().slice(0,10);
  // 這筆結算款可能分好幾次付／折抵；使用者填的摘要與備註只用來標記「這一段」的說明，
  // 不覆蓋剩餘未領款母單原本的摘要與備註（母單之後可能還要再拆、再標另一段的說明）。
  const appliedSummary = info.summary !== undefined && info.summary !== '' ? info.summary : p.summary;
  const appliedNote = info.note !== undefined ? info.note : p.note;
  if (payAmount < currentAmount) {
    const paidRow = {
      ...p,
      id: pyNextId++,
      sourceKey: `${p.sourceKey || `profit-settlement-${p.settlementId || 'manual'}-${p.profitPerson || p.vendor}`}-pay-${Date.now()}`,
      parentPayableId: p.id,
      amount: payAmount,
      summary: appliedSummary,
      wantDate: info.date || p.wantDate || '',
      bank: info.bank,
      transferDate: info.transferDate || payDate,
      doneDate: payDate,
      ticket: info.ticket,
      status:'paid',
      psSettled:true,
      note: `${appliedNote || ''}${appliedNote ? '；' : ''}分段付款 ${payDate} ${payAmount.toLocaleString('zh-TW')}`
    };
    touchRowMeta(paidRow, true);
    PAYABLES.push(paidRow);
    p.amount = currentAmount - payAmount;
    p.wantDate = info.date || p.wantDate || '';
    p.bank = info.bank;
    p.transferDate = '';
    p.doneDate = '';
    p.ticket = '';
    p.status = 'approved';
    p.psSettled = true;
    const settlement = PROFIT_SETTLEMENTS.find(s => s.id === p.settlementId);
    if (settlement) {
      settlement.generatedPayableIds = settlement.generatedPayableIds || [];
      if (!settlement.generatedPayableIds.includes(paidRow.id)) settlement.generatedPayableIds.push(paidRow.id);
    }
    return { ok:true, partial:true, remaining:p.amount };
  }
  Object.assign(p, {
    amount: currentAmount,
    summary: appliedSummary,
    note: appliedNote,
    wantDate: info.date || p.wantDate || '',
    bank: info.bank,
    status:'paid',
    transferDate: info.transferDate || payDate,
    doneDate: payDate,
    ticket: info.ticket,
    psSettled:true
  });
  return { ok:true, partial:false, remaining:0 };
}

function submitAddPayable() {
  if (!requireManage('payable', '您沒有修改應付帳款的權限')) return;
  const editId  = document.getElementById('ap-edit-id').value;
  const caseEl  = document.getElementById('ap-add-case');
  const caseVal = caseEl.value;
  const vendorRaw = document.getElementById('ap-add-vendor').value.trim();
  // datalist 格式是 "CODE - 廠商名稱"，取後面的名稱；若直接打名字也直接用
  const vendor  = vendorRaw.includes(' - ') ? vendorRaw.split(' - ').slice(1).join(' - ') : vendorRaw;
  const amount  = document.getElementById('ap-add-amount').value.trim();
  const summary = document.getElementById('ap-add-summary').value.trim();
  const note    = document.getElementById('ap-add-note').value.trim();
  const date    = document.getElementById('ap-add-date').value;
  const transferDate = document.getElementById('ap-add-transfer-date').value;
  const doneDate     = document.getElementById('ap-add-done-date').value;
  const ticket       = document.getElementById('ap-add-ticket').value;
  const bank    = document.getElementById('ap-add-bank').value;
  const selectedStatus = document.getElementById('ap-add-status').value;
  // 「完成匯款日」代表付款已完成；即使使用者忘記切換狀態，也不得留下日期與狀態矛盾。
  const status  = doneDate ? 'paid' : selectedStatus;
  const paymentType = document.getElementById('ap-add-payment-type')?.value || 'vendor';
  const overheadItem = paymentType === 'prepaid_expense' ? (document.getElementById('ap-add-overhead-item')?.value || '').trim() : '';
  const amortizationStartMonth = paymentType === 'prepaid_expense' ? (document.getElementById('ap-add-amortization-start')?.value || '') : '';
  const amortizationMonths = paymentType === 'prepaid_expense' ? parseInt(document.getElementById('ap-add-amortization-months')?.value || '') : 0;
  const isProfitType = isProfitPaymentType(paymentType);
  const payableCaseTypes = ['vendor','family_pass_through','private_loan'];
  const shouldKeepCase = payableCaseTypes.includes(paymentType);
  const profitPerson = isProfitType ? (document.getElementById('ap-add-profit-person')?.value || '') : '';
  const profitCaseCodes = isProfitType ? [...document.querySelectorAll('#ap-profit-case-list input:checked')].map(x => x.value) : [];
  const invoice = document.querySelector('#rg-ap-inv .radio-opt.selected')?.textContent.trim() || '有';
  const receipt = document.querySelector('#rg-ap-rec .radio-opt.selected')?.textContent.trim() || '有';
  const person  = document.getElementById('ap-add-person').value;
  if (!vendor)  { showToast('請填寫受款廠商', 'error'); return; }
  if (!amount)  { showToast('請填寫金額', 'error'); return; }
  if (!summary) { showToast('請填寫摘要', 'error'); return; }
  if (!status)  { showToast('請選擇狀態', 'error'); return; }
  if (paymentType === 'prepaid_expense' && !overheadItem) { showToast('請填寫攤提項目名稱', 'error'); return; }
  if (paymentType === 'prepaid_expense' && !/^\d{4}-\d{2}$/.test(amortizationStartMonth)) { showToast('請選擇攤提開始月份', 'error'); return; }
  if (paymentType === 'prepaid_expense' && (!Number.isInteger(amortizationMonths) || amortizationMonths < 1 || amortizationMonths > 120)) { showToast('攤提期數請填 1～120 個月', 'error'); return; }
  const editPayable = editId ? PAYABLES.find(x => x.id === parseInt(editId)) : null;
  if (paymentType === 'overhead_link' && !`${vendor} ${summary}`.includes('房租') && !editPayable?.overheadItem) {
    showToast('「固定開銷付款連結」目前僅限公司房租，摘要請明確填寫房租', 'error'); return;
  }
  if (paymentType === 'overhead_link' && status === 'paid' && !doneDate) {
    showToast('公司房租已付款時必須填寫實際完成付款日，公司開銷月份以此日期為準', 'error'); return;
  }
  const amtNum   = parseInt(amount.replace(/[^0-9\-]/g,''));
  const caseName = caseVal ? (caseEl.selectedOptions[0].text.split(' ').slice(1).join(' ')) : '';
  let affectedCase = shouldKeepCase ? caseVal : '';

  if (editId) {
    // 編輯模式：更新現有記錄
    const p = PAYABLES.find(x => x.id === parseInt(editId));
    if (p) {
      affectedCase = shouldKeepCase ? caseVal : p.case || '';
      if (p.systemLocked) {
        if (isNaN(amtNum)) { showToast('金額格式不正確', 'error'); return; }
        let payResult = { ok:true };
        if (status === 'paid') {
          payResult = payPartialSystemLockedPayable(p, amtNum, { date, transferDate, doneDate, ticket, bank, summary, note });
          if (!payResult.ok) return;
        } else {
          Object.assign(p, { wantDate:date, bank, status, transferDate, doneDate, ticket, psSettled:true, summary, note });
          p.doneDate = '';
        }
        touchRowMeta(p);
        closeModal('modal-add-payable');
        refreshAccountingLinkedViews(affectedCase);
        saveData();
        showToast(payResult.partial ? `已記錄分段付款，待付餘額 $${Math.round(payResult.remaining).toLocaleString('zh-TW')}` : '已更新結算款付款資訊 ✓', 'success');
        return;
      } else {
        if (shouldKeepCase && caseVal && !isNaN(amtNum) && !confirmDuplicatePayable({ caseCode:caseVal, amount:amtNum, excludeId:p.id })) return;
        Object.assign(p, { case:shouldKeepCase?caseVal:'', caseName:shouldKeepCase?caseName:'', vendor, summary, note, paymentType, profitPerson, profitCaseCodes,
          overheadItem, amortizationStartMonth, amortizationMonths,
          amount:isNaN(amtNum)?p.amount:amtNum, wantDate:date, bank, transferDate, doneDate, ticket,
          invoice, receipt, person, status });
        syncDerivedReceivableForPayable(p);
        syncTaxLiabilityForPayable(p);
      }
      touchRowMeta(p);
      pyRebuildRentOverhead();
    }
    closeModal('modal-add-payable');
    refreshAccountingLinkedViews(affectedCase);
    saveData();
    showToast('已更新應付帳款 ✓', 'success');
  } else {
    // 新增模式
    if (paymentType === 'vendor' && !caseVal) { showToast('一般廠商款請選擇個案名稱', 'error'); return; }
    if (paymentType === 'family_pass_through' && !caseVal) { showToast('親友成本轉付請選擇親友個案', 'error'); return; }
    if (paymentType === 'private_loan' && !caseVal) { showToast('私人借支請選擇「私人借支」個案', 'error'); return; }
    if (paymentType === 'vendor' && isClosedCase(caseVal)) { showToast('已結案個案不可新增應付帳款', 'error'); return; }
    if (shouldKeepCase && caseVal && !isNaN(amtNum) && !confirmDuplicatePayable({ caseCode:caseVal, amount:amtNum })) return;
    const row = { id:pyNextId++, case:shouldKeepCase?caseVal:'', caseName:shouldKeepCase?caseName:'', vendor, summary,
      amount:isNaN(amtNum)?0:amtNum, wantDate:date, bank,
      transferDate:transferDate || (status==='paid'?date:''), doneDate:doneDate || (status==='paid'?date:''), ticket, invoice, receipt, person,
      paymentType, profitPerson, profitCaseCodes, overheadItem, amortizationStartMonth, amortizationMonths, status, note };
    touchRowMeta(row, true);
    PAYABLES.push(row);
    syncDerivedReceivableForPayable(row);
    syncTaxLiabilityForPayable(row);
    pyRebuildRentOverhead();
    closeModal('modal-add-payable');
    refreshAccountingLinkedViews(shouldKeepCase ? caseVal : '');
    saveData();
    showToast('已新增應付帳款 ✓', 'success');
  }
}
