// PAY REQUEST MODULE. Extracted verbatim from ops/index.html at main@81b208c.

// ══════════════════════════════════
// SUBMIT
// ══════════════════════════════════
function openPayreqModal() {
  if (!canApplySelf('payreq')) { showToast('您沒有新增請款的權限', 'error'); return; }
  payreqSubmitting = false;
  payreqEditId = null;
  // 動態填充案件下拉
  const prCase = document.getElementById('pr-case');
  if (prCase) {
    prCase.innerHTML = buildCaseOptions('── 不指定個案（選填）──', false, false, '', c => userCanViewCaseFinancials(c.code, 'payreq'));
    prCase.value = '';
  }
  // 動態填充廠商 datalist
  const dl = document.getElementById('dl-vendors');
  if (dl) {
    dl.innerHTML = VENDORS.slice().sort((a,b) => String(a.code || '').localeCompare(String(b.code || ''), 'zh-TW', {numeric:true})).map(v => `<option value="${v.code} - ${v.name}">${v.trade}</option>`).join('');
  }
  ['pr-vendor','pr-amount','pr-summary','pr-date','payreq-note'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const applicantEl = document.getElementById('pr-applicant');
  if (applicantEl) {
    fillActiveUserNameSelect('pr-applicant', currentUser.name);
    applicantEl.value = canManage('payreq') ? applicantEl.value : currentUser.name;
    applicantEl.disabled = !canManage('payreq');
  }
  setPayreqRadio('rg-invoice', '有');
  setPayreqRadio('rg-receipt', '有');
  const titleEl = document.querySelector('#modal-payreq .modal-title');
  if (titleEl) titleEl.textContent = '廠商請款申請';
  const btn = document.getElementById('pr-submit-btn');
  if (btn) { btn.textContent = '送出申請'; btn.disabled = false; }
  openModal('modal-payreq');
}

function setPayreqRadio(groupId, value) {
  const group = document.getElementById(groupId);
  if (!group) return;
  group.querySelectorAll('.radio-opt').forEach(opt => {
    const active = opt.textContent.trim() === value;
    opt.classList.toggle('selected', active);
    opt.querySelector('.radio-dot')?.classList.toggle('filled', active);
  });
}

function openEditPayreqModal(id) {
  const p = PAYABLES.find(x => Number(x.id) === Number(id) && (x.status === 'pending' || x.status === 'rejected'));
  if (!p) { showToast('找不到這筆待審核或已退回的請款', 'error'); return; }
  if (!userCanViewCaseScopedRow(p.case, 'payreq', p.person)) { showToast('您沒有查看這個案的權限', 'error'); return; }
  if (p.status === 'pending' && !requireManage('payreq', '您沒有編輯請款申請的權限')) return;
  if (p.status === 'rejected' && !(canManage('payreq') || p.person === currentUser.id || p.person === currentUser.name)) { showToast('您沒有修改這筆請款的權限', 'error'); return; }
  payreqEditId = p.id;
  const prCase = document.getElementById('pr-case');
  if (prCase) {
    prCase.innerHTML = buildCaseOptions('── 不指定個案（選填）──', false, false, p.case || '', c => userCanViewCaseFinancials(c.code, 'payreq'));
    prCase.value = p.case || '';
  }
  const dl = document.getElementById('dl-vendors');
  if (dl) dl.innerHTML = VENDORS.slice().sort((a,b) => String(a.code || '').localeCompare(String(b.code || ''), 'zh-TW', {numeric:true})).map(v => `<option value="${v.code} - ${v.name}">${v.trade}</option>`).join('');
  const set = (id, value) => { const el = document.getElementById(id); if (el) el.value = value || ''; };
  set('pr-vendor', p.vendor);
  set('pr-amount', p.amount ? p.amount.toLocaleString('zh-TW') : '');
  set('pr-summary', p.summary);
  set('pr-date', p.wantDate);
  set('payreq-note', p.note);
  const applicantEl = document.getElementById('pr-applicant');
  if (applicantEl) {
    fillActiveUserNameSelect('pr-applicant', p.person || currentUser.name, { includeInactive:true });
    applicantEl.value = p.person || currentUser.name;
    applicantEl.disabled = !canManage('payreq');
  }
  setPayreqRadio('rg-invoice', p.invoice || '有');
  setPayreqRadio('rg-receipt', p.receipt || '有');
  const titleEl = document.querySelector('#modal-payreq .modal-title');
  if (titleEl) titleEl.textContent = '編輯廠商請款申請';
  const btn = document.getElementById('pr-submit-btn');
  // 剛送出一筆後按鈕會停在停用狀態；新增視窗會恢復，編輯視窗也要恢復，否則「儲存修改」按不下去。
  if (btn) { btn.textContent = '儲存修改'; btn.disabled = false; }
  openModal('modal-payreq');
}

function clonePayreq(id) {
  if (!canApplySelf('payreq')) { showToast('您沒有新增請款的權限', 'error'); return; }
  const p = PAYABLES.find(x => Number(x.id) === Number(id));
  if (!p || !userCanViewCaseScopedRow(p.case, 'payreq', p.person)) return;
  openPayreqModal();
  const caseEl = document.getElementById('pr-case'); if (caseEl) caseEl.value = p.case || '';
  document.getElementById('pr-vendor').value = p.vendor || '';
  document.getElementById('pr-amount').value = p.amount ? p.amount.toLocaleString('zh-TW') : '';
  document.getElementById('pr-summary').value = p.summary || '';
  document.getElementById('pr-date').value = p.wantDate || '';
  document.getElementById('payreq-note').value = p.note || '';
  setPayreqRadio('rg-invoice', p.invoice || '有');
  setPayreqRadio('rg-receipt', p.receipt || '有');
  document.querySelector('#modal-payreq .modal-title').textContent = '複製廠商請款申請';
  document.getElementById('pr-submit-btn').textContent = '建立新請款';
  payreqEditId = null;
}

function payreqDocumentAction(select, id) {
  const action = select?.value || '';
  if (select) select.value = '';
  const row = PAYABLES.find(p => Number(p.id) === Number(id));
  if (action === 'clone') clonePayreq(id);
  else if (action === 'edit') (row && ['pending','rejected'].includes(row.status) ? openEditPayreqModal(id) : openEditPayableModal(id));
  else if (action === 'delete') deletePayableConfirm(id);
}

function submitPayReq() {
  if (!canApplySelf('payreq')) { showToast('您沒有新增請款的權限', 'error'); return; }
  if (payreqSubmitting) { showToast('請款正在送出，請勿重複點選', 'warning'); return; }
  const caseVal     = document.getElementById('pr-case').value;
  const vendorRaw    = document.getElementById('pr-vendor').value.trim();
  // datalist 格式是 "CODE - 廠商名稱"，取後面的名稱；若直接打名字也直接用
  const vendor       = vendorRaw.includes(' - ') ? vendorRaw.split(' - ').slice(1).join(' - ') : vendorRaw;
  const amount      = document.getElementById('pr-amount').value.trim();
  const summary     = document.getElementById('pr-summary').value.trim();
  const payDate     = document.getElementById('pr-date').value;
  const applicant   = canManage('payreq') ? document.getElementById('pr-applicant').value : currentUser.name;
  const invoiceVal  = document.querySelector('#rg-invoice .radio-opt.selected')?.textContent.trim() || '—';
  const receiptVal  = document.querySelector('#rg-receipt .radio-opt.selected')?.textContent.trim() || '—';
  const note        = document.getElementById('payreq-note')?.value.trim() || '';

  // 案件為選填
  if (!vendor)   { showToast('請填寫受款廠商', 'error'); return; }
  if (!amount)   { showToast('請填寫付款金額', 'error'); return; }
  if (!summary)  { showToast('請填寫摘要', 'error'); return; }
  if (!payDate)  { showToast('請選擇希望付款日', 'error'); return; }
  if (caseVal && !userCanViewCaseFinancials(caseVal, 'payreq')) { showToast('您只能選擇自己有分潤的個案', 'error'); return; }

  // 日期限制暫時開放（匯入歷史資料用），需要時再開：
  // const today = new Date().toISOString().split('T')[0];
  // if (payDate <= today) { showToast('付款日不能是今日或過去日期', 'error'); return; }

  const caseCode = caseVal ? caseVal : '';
  const caseObj = caseCode ? CASES.find(c => c.code === caseCode) : null;
  const caseNameFull = caseObj ? caseObj.name : '';
  const wasEditing = !!payreqEditId;
  const data = {
    case: caseCode,
    caseName: caseNameFull,
    vendor, summary,
    amount: parseInt(amount.replace(/[^0-9\-]/g,'')) || 0,
    wantDate: payDate,
    bank: '', transferDate: '', doneDate: '',
    invoice: invoiceVal, receipt: receiptVal,
    invoiceLink: '', receiptLink: '',
    person: applicant,
    status: 'pending',
    note
  };
  if (!payreqEditId) {
    const exactDuplicate = PAYABLES.find(p =>
      p.status === 'pending' && p.case === data.case && p.vendor === data.vendor &&
      p.summary === data.summary && Number(p.amount) === Number(data.amount) &&
      p.wantDate === data.wantDate && p.person === data.person
    );
    if (exactDuplicate) {
      showToast('已有一筆完全相同的待審核請款，本次未重複新增', 'error');
      return;
    }
  }
  payreqSubmitting = true;
  const submitBtn = document.getElementById('pr-submit-btn');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = '送出中…'; }
  if (payreqEditId) {
    const row = PAYABLES.find(x => Number(x.id) === Number(payreqEditId) && (x.status === 'pending' || x.status === 'rejected'));
    if (!row) { payreqSubmitting = false; if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '儲存修改'; } showToast('找不到要更新的待審核或已退回請款', 'error'); return; }
    Object.assign(row, data, { id: row.id, status: 'pending' });
  } else {
    PAYABLES.push({ id: pyNextId++, ...data });
  }
  payreqEditId = null;

  renderPayable();
  renderCases();
  renderPayreq();
  renderDashboard();
  closeModal('modal-payreq');
  saveData();
  setTimeout(() => { payreqSubmitting = false; }, 1500);
  showToast(wasEditing ? '請款申請已更新 ✓' : '請款申請已送出，等待財務審核 ✓', 'success');
}

function approveReq(id) {
  if (!requireManage('payreq', '您沒有核准請款的權限')) return;
  const p = PAYABLES.find(x => x.id === id);
  if (!p) return;
  p.status = 'approved';
  renderPayreq();
  renderPayable();
  renderCases();
  renderDashboard();
  renderProfit();
  renderProfitShare();
  saveData();
  showToast('已核准，已轉入應付帳款 ✓', 'success');
}
function rejectPayreq(id) {
  if (!requireManage('payreq', '您沒有退回請款的權限')) return;
  const idx = PAYABLES.findIndex(x => x.id === id);
  if (idx === -1) return;
  const p = PAYABLES[idx];
  const amt = (p.amount || 0).toLocaleString('zh-TW');
  if (!confirm(`確定退回「${p.vendor || '未填廠商'}／${p.summary || '未填摘要'}」$${amt} 這筆請款申請？\n退回後會移到「已退回」分類，申請人可以修改後重新送出審核，不需要重新新增。`)) return;
  p.status = 'rejected';
  renderPayreq();
  renderPayable();
  renderCases();
  renderDashboard();
  renderProfit();
  renderProfitShare();
  saveData();
  showToast('已退回，申請人可修改後重新送出', 'warning');
}

// ══════════════════════════════════
// DASHBOARD RENDER
// ══════════════════════════════════
function payreqPendingCount() {
  return PAYABLES.filter(p => p.status === 'pending' && userCanViewCaseScopedRow(p.case, 'payreq', p.person)).length;
}

function updatePayreqNavBadge(count = payreqPendingCount()) {
  const navBadge = document.getElementById('badge-payreq');
  if (!navBadge) return;
  if (count > 0 && canAccess('payreq')) {
    navBadge.style.display = '';
    navBadge.textContent = count;
  } else {
    navBadge.style.display = 'none';
    navBadge.textContent = '';
  }
}


// ══════════════════════════════════
// PAY REQUEST PAGE RENDER
// ══════════════════════════════════
function renderPayreq() {
  const manage = canManage('payreq');
  const invTag  = v => v==='有'?'tag-done':v==='待補'?'tag-draft':'tag-inactive';
  const stTag   = {pending:'tag-pending', approved:'tag-active', paid:'tag-done'};
  const stLabel = {pending:'待審核', approved:'已核准', paid:'已付款'};
  const kw = (document.getElementById('payreq-search')?.value || '').toLowerCase();
  const sortMode = document.getElementById('payreq-sort')?.value || 'date-desc';
  const match = p => searchTextMatches(`${p.vendor} ${p.summary} ${p.caseName} ${p.case} ${searchAmountText(p.amount)} ${p.wantDate || ''}`, kw);
  const payreqDate = p => p.wantDate || p.doneDate || p.transferDate || String(p.createdAt || '').slice(0,10);
  const sorted = rows => sortOpsRows(rows, sortMode, payreqDate, p => p.vendor, p => p.amount);

  const canSeeRow = p => userCanViewCaseScopedRow(p.case, 'payreq', p.person);
  const pending  = sorted(PAYABLES.filter(p => p.status === 'pending' && canSeeRow(p) && match(p)));
  const rejected = sorted(PAYABLES.filter(p => p.status === 'rejected' && canSeeRow(p) && match(p)));
  const approved = sorted(PAYABLES.filter(p => (p.status === 'approved' || p.status === 'paid') && canSeeRow(p) && match(p)));

  const pb = document.getElementById('payreq-pending-badge');
  if (pb) pb.textContent = `${pending.length} 筆`;
  updatePayreqNavBadge();
  const rb = document.getElementById('payreq-rejected-badge');
  if (rb) rb.textContent = `${rejected.length} 筆`;
  const ab = document.getElementById('payreq-approved-badge');
  if (ab) ab.textContent = `${approved.length} 筆`;

  const pt = document.getElementById('payreq-pending-tbody');
  if (pt) {
    pt.innerHTML = pending.length === 0
      ? `<tr><td colspan="11" style="padding:20px;text-align:center;color:var(--text3)">目前無待審核請款</td></tr>`
      : pending.map((p, i) => `<tr>
          <td><span class="case-code">${String(i+1).padStart(3,'0')}</span></td>
          <td>${p.caseName ? `<div style="font-size:12px;font-weight:500">${p.caseName}</div>` : ''}<div class="case-code" style="font-size:11px">${p.case?caseCodeBreak(p.case):'<span style="color:var(--text3)">無個案</span>'}</div></td>
          <td style="font-size:13px;font-weight:500">${p.vendor}</td>
          <td style="font-size:12px;color:var(--text2)">${p.summary}</td>
          <td><div class="amount">${p.amount>=0?'':'-'}$${Math.abs(p.amount).toLocaleString('zh-TW')}</div></td>
          <td class="nowrap-col"><span style="font-family:'DM Mono',monospace;font-size:12px">${p.wantDate||'—'}</span></td>
          <td><span class="tag ${invTag(p.invoice)}">${p.invoice||'—'}</span></td>
          <td><span class="tag ${invTag(p.receipt)}">${p.receipt||'—'}</span></td>
          <td class="person-col" style="font-size:12px">${p.person||'—'}</td>
          <td><span class="tag tag-pending">待審核</span></td>
          <td style="white-space:nowrap">
            <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap">
              ${manage ? `<button class="btn btn-sm" style="background:var(--success-bg);color:var(--success);border:1px solid rgba(110,184,148,0.3)" onclick="approveReq(${p.id})">核准</button>
              <button class="btn btn-ghost btn-sm" onclick="rejectPayreq(${p.id})">退回</button>
              <select class="filter-select compact-action-select" aria-label="請款單操作" onchange="payreqDocumentAction(this,${p.id})"><option value="">選項⋯</option><option value="clone">複製單據</option><option value="edit">編輯單據</option><option value="delete">刪除單據</option></select>` : (canApplySelf('payreq') ? `<button class="btn btn-ghost btn-sm" onclick="clonePayreq(${p.id})">複製</button>` : '<span style="font-size:11px;color:var(--text3)">唯讀</span>')}
            </div>
          </td>
        </tr>`).join('');
  }

  const rt = document.getElementById('payreq-rejected-tbody');
  if (rt) {
    rt.innerHTML = rejected.length === 0
      ? `<tr><td colspan="9" style="padding:20px;text-align:center;color:var(--text3)">沒有被退回的請款</td></tr>`
      : rejected.map((p, i) => `<tr>
          <td><span class="case-code">${String(i+1).padStart(3,'0')}</span></td>
          <td>${p.caseName ? `<div style="font-size:12px;font-weight:500">${p.caseName}</div>` : ''}<div class="case-code" style="font-size:11px">${p.case?caseCodeBreak(p.case):'—'}</div></td>
          <td style="font-size:13px;font-weight:500">${p.vendor}</td>
          <td style="font-size:12px;color:var(--text2)">${p.summary}</td>
          <td><div class="amount">${p.amount>=0?'':'-'}$${Math.abs(p.amount).toLocaleString('zh-TW')}</div></td>
          <td class="nowrap-col" style="font-size:12px;font-family:'DM Mono',monospace">${p.wantDate||'—'}</td>
          <td class="person-col" style="font-size:12px">${p.person||'—'}</td>
          <td><span class="tag tag-inactive">已退回</span></td>
          <td style="white-space:nowrap">
            <div style="display:flex;align-items:center;gap:4px">
              ${(manage || p.person === currentUser.id || p.person === currentUser.name) ? `<select class="filter-select compact-action-select" aria-label="請款單操作" onchange="payreqDocumentAction(this,${p.id})"><option value="">選項⋯</option><option value="clone">複製單據</option><option value="edit">修改並重送</option>${manage?'<option value="delete">刪除單據</option>':''}</select>` : ''}
            </div>
          </td>
        </tr>`).join('');
  }

  const at = document.getElementById('payreq-approved-tbody');
  if (at) {
    at.innerHTML = approved.length === 0
      ? `<tr><td colspan="8" style="padding:20px;text-align:center;color:var(--text3)">尚無已核准記錄</td></tr>`
      : approved.map((p, i) => `<tr>
          <td><span class="case-code">${String(i+1).padStart(3,'0')}</span></td>
          <td>${p.caseName ? `<div style="font-size:12px;font-weight:500">${p.caseName}</div>` : ''}<div class="case-code" style="font-size:11px">${p.case?caseCodeBreak(p.case):'—'}</div></td>
          <td style="font-size:13px;font-weight:500">${p.vendor}</td>
          <td style="font-size:12px;color:var(--text2)">${p.summary}</td>
          <td><div class="amount">${p.amount>=0?'':'-'}$${Math.abs(p.amount).toLocaleString('zh-TW')}</div></td>
          <td class="nowrap-col" style="font-size:12px;font-family:'DM Mono',monospace">${p.wantDate||p.doneDate||'—'}</td>
          <td class="person-col" style="font-size:12px">${p.person||'—'}</td>
          <td><span class="tag ${stTag[p.status]||'tag-active'}">${stLabel[p.status]||p.status}</span></td>
          <td style="white-space:nowrap">
            <div style="display:flex;align-items:center;gap:4px">
              ${manage ? `<select class="filter-select compact-action-select" aria-label="請款單操作" onchange="payreqDocumentAction(this,${p.id})"><option value="">選項⋯</option><option value="clone">複製單據</option><option value="edit">編輯單據</option><option value="delete">刪除單據</option></select>` : (canApplySelf('payreq') ? `<button class="btn btn-ghost btn-sm" onclick="clonePayreq(${p.id})">複製</button>` : '<span style="font-size:11px;color:var(--text3)">唯讀</span>')}
            </div>
          </td>
        </tr>`).join('');
  }
}
