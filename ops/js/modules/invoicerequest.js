// INVOICE REQUEST (開票申請). New feature, not extracted from the baseline.
// People who are out of the office (the owner, 彭俞豪, 連星羽) request an invoice here instead of typing the
// details into the Line group; the person who issues it (財務) copies the fields into ezPay on a computer and then
// records the invoice number, which also writes the invoice fields of a RECEIVABLES row (new or existing).
// Storage: a new collection INVOICE_REQUESTS (+ irNextId) added to the snapshot and to the cloud row merge by
// wrapping createDataSnapshot / applyDataSnapshot at load time, so data.js itself is unchanged.

let INVOICE_REQUESTS = [];
let irNextId = 1;

(function irHookSnapshot() {
  const originalCreate = window.createDataSnapshot;
  window.createDataSnapshot = function () {
    tagCompany(INVOICE_REQUESTS);
    const snapshot = originalCreate.apply(this, arguments);
    snapshot.INVOICE_REQUESTS = INVOICE_REQUESTS;
    snapshot.irNextId = irNextId;
    return snapshot;
  };
  const originalApply = window.applyDataSnapshot;
  window.applyDataSnapshot = function (d) {
    const result = originalApply.apply(this, arguments);
    if (d && typeof d === 'object') {
      INVOICE_REQUESTS.length = 0;
      if (Array.isArray(d.INVOICE_REQUESTS)) INVOICE_REQUESTS.push(...d.INVOICE_REQUESTS);
      irNextId = Math.max(Number(d.irNextId) || 1, ...INVOICE_REQUESTS.map(r => Number(r.id) || 0).map(n => n + 1), 1);
    }
    return result;
  };
  OPS_CLOUD_ROW_MERGE_CONFIGS.push({ collection: 'INVOICE_REQUESTS', nextIdField: 'irNextId', label: '開票申請', reassignIdOnNewCollision: true });
})();

const IR_FIELDS = [
  ['caseName', '個案'], ['clientName', '客戶'], ['buyerName', '抬頭'], ['taxId', '統編'],
  ['itemText', '品項'], ['amountText', '含稅金額'], ['wantDate', '希望開立日'], ['email', 'Email'], ['note', '備註'],
];

function irCanApply() {
  return !!currentUser && (canCreateCase() || canApplySelf('payreq') || canManage('receivable'));
}

function irCanIssue() {
  return !!currentUser && canManage('receivable');
}

function irMoney(v) {
  return '$' + Math.round(Number(v) || 0).toLocaleString('zh-TW');
}

function irRows(status) {
  let rows = INVOICE_REQUESTS.filter(r => r.status === status);
  if (!irCanIssue()) rows = rows.filter(r => r.requestedBy === currentUser?.id);
  return rows.slice().sort((a, b) => String(b.requestedAt || '').localeCompare(String(a.requestedAt || '')));
}

function irPendingCount() {
  return irCanIssue() ? INVOICE_REQUESTS.filter(r => r.status === 'requested').length : 0;
}

function irFieldValue(r, key) {
  if (key === 'amountText') return irMoney(r.amount);
  return String(r[key] || '');
}

function irRequestText(r) {
  const lines = ['【開發票申請】'];
  IR_FIELDS.forEach(([key, label]) => { const v = irFieldValue(r, key); if (v) lines.push(label + '：' + v); });
  lines.push('申請人：' + (r.requestedByName || ''));
  return lines.join('\n');
}

function irCopy(text) {
  const done = () => showToast('已複製', 'success');
  const fallback = () => {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { showToast('無法複製，請手動選取', 'error'); }
    ta.remove();
  };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
  else fallback();
}

// ── request modal ──
let irClientReturn = false;

function irOpenRequestModal() {
  if (!irCanApply()) { showToast('您沒有申請開發票的權限', 'error'); return; }
  const caseSel = document.getElementById('ir-case');
  const tmp = document.createElement('select');
  tmp.innerHTML = buildCaseOptions('── 選擇個案 ──', false, false, '', c => userCanViewCaseFinancials(c.code, 'receivable'));
  caseSel.textContent = '';
  [...tmp.options].forEach(o => caseSel.appendChild(o.cloneNode(true)));
  caseSel.value = '';
  irFillClientOptions('');
  ['ir-buyer', 'ir-taxid', 'ir-item', 'ir-amount', 'ir-date', 'ir-email', 'ir-note'].forEach(id => { document.getElementById(id).value = ''; });
  openModal('modal-invoice-request');
}

function irFillClientOptions(selected) {
  const sel = document.getElementById('ir-client');
  sel.textContent = '';
  const blank = document.createElement('option'); blank.value = ''; blank.textContent = '── 選擇客戶 ──'; sel.appendChild(blank);
  CLIENTS.slice().sort((a, b) => String(a.code || '').localeCompare(String(b.code || ''))).forEach(c => {
    const o = document.createElement('option'); o.value = c.code; o.textContent = c.code + ' ｜ ' + (c.shortName || ''); sel.appendChild(o);
  });
  sel.value = selected || '';
}

function irCaseChanged() {
  const code = document.getElementById('ir-case').value;
  const c = CASES.find(x => x.code === code);
  if (c && c.client) { irFillClientOptions(c.client); irClientChanged(); }
}

function irClientChanged() {
  const client = CLIENTS.find(c => c.code === document.getElementById('ir-client').value);
  if (!client) return;
  document.getElementById('ir-buyer').value = client.fullName || client.shortName || '';
  document.getElementById('ir-taxid').value = client.taxId || '';
  document.getElementById('ir-email').value = client.email || '';
}

function irNewClientFromForm() {
  if (!canApplySelf('clients')) { showToast('您沒有新增客戶的權限', 'error'); return; }
  irClientReturn = true;
  openClientModal();
}

function irReadForm() {
  const caseCode = document.getElementById('ir-case').value;
  const c = CASES.find(x => x.code === caseCode);
  const clientCode = document.getElementById('ir-client').value;
  const client = CLIENTS.find(x => x.code === clientCode);
  return {
    case: caseCode, caseName: c ? c.name : '',
    client: clientCode, clientName: client ? (client.shortName || '') : '',
    buyerName: document.getElementById('ir-buyer').value.trim(),
    taxId: document.getElementById('ir-taxid').value.trim(),
    itemText: document.getElementById('ir-item').value.trim(),
    amount: parseInt(String(document.getElementById('ir-amount').value).replace(/[^0-9]/g, ''), 10) || 0,
    wantDate: document.getElementById('ir-date').value,
    email: document.getElementById('ir-email').value.trim(),
    note: document.getElementById('ir-note').value.trim(),
  };
}

function irCopyForm() {
  const f = irReadForm();
  irCopy(irRequestText({ ...f, requestedByName: currentUser?.name || '' }));
}

function irSubmitRequest() {
  if (!irCanApply()) { showToast('您沒有申請開發票的權限', 'error'); return; }
  const f = irReadForm();
  if (!f.case) { showToast('請選擇個案', 'error'); return; }
  if (!f.buyerName) { showToast('請填寫發票抬頭', 'error'); return; }
  if (f.taxId && !/^\d{8}$/.test(f.taxId)) { showToast('統一編號必須是 8 碼數字（個人免開統編請留空）', 'error'); return; }
  if (!f.itemText) { showToast('請填寫品項名稱', 'error'); return; }
  if (!(f.amount > 0)) { showToast('請填寫開立金額（含稅）', 'error'); return; }
  const dup = INVOICE_REQUESTS.find(r => r.status === 'requested' && r.case === f.case && r.buyerName === f.buyerName && r.itemText === f.itemText && Number(r.amount) === f.amount);
  if (dup) { showToast('已有一筆完全相同的待開立申請，本次未重複送出', 'error'); return; }
  const row = {
    id: irNextId++,
    ...f,
    status: 'requested',
    requestedBy: currentUser.id, requestedByName: currentUser.name, requestedAt: new Date().toISOString(),
  };
  touchRowMeta(row, true);
  INVOICE_REQUESTS.push(row);
  recordAuditLog('create', 'invoiceRequest', row.id, null, auditClone(row), { riskLevel: 'medium', targetLabel: `${row.buyerName}／${row.itemText}／${irMoney(row.amount)}` });
  closeModal('modal-invoice-request');
  saveData();
  irRenderAll();
  showToast('開票申請已送出 ✓', 'success');
}

function irCancelRequest(id) {
  const r = INVOICE_REQUESTS.find(x => x.id === id);
  if (!r || r.status !== 'requested') return;
  if (!(irCanIssue() || r.requestedBy === currentUser?.id)) { showToast('您沒有取消這筆申請的權限', 'error'); return; }
  if (!confirm(`確定取消「${r.buyerName}／${r.itemText}」${irMoney(r.amount)} 的開票申請？`)) return;
  const before = auditClone(r);
  r.status = 'cancelled';
  r.cancelledBy = currentUser.name;
  r.cancelledAt = new Date().toISOString();
  touchRowMeta(r);
  recordAuditLog('update', 'invoiceRequest', r.id, before, auditClone(r), { riskLevel: 'medium', targetLabel: `${r.buyerName}／${r.itemText}`, reason: '取消開票申請' });
  saveData();
  irRenderAll();
  showToast('已取消申請', 'warning');
}

// ── issue modal (財務 records the invoice number) ──
let irIssueId = null;

function irOpenIssueModal(id) {
  if (!requireManage('receivable', '您沒有登錄發票號碼的權限')) return;
  const r = INVOICE_REQUESTS.find(x => x.id === id && x.status === 'requested');
  if (!r) { showToast('找不到這筆待開立的申請', 'error'); return; }
  irIssueId = id;
  document.getElementById('ir-issue-summary').textContent = `${r.buyerName}｜${r.itemText}｜${irMoney(r.amount)}`;
  document.getElementById('ir-issue-no').value = '';
  document.getElementById('ir-issue-date').value = localDateKey();
  const sel = document.getElementById('ir-issue-target');
  sel.textContent = '';
  const fresh = document.createElement('option'); fresh.value = ''; fresh.textContent = `新增一筆應收紀錄（${irMoney(r.amount)}）`; sel.appendChild(fresh);
  RECEIVABLES.filter(x => x.case === r.case && !x.invoiceNo && !receivableIsCollected(x)).forEach(x => {
    const o = document.createElement('option'); o.value = String(x.id); o.textContent = `附加到既有：${x.item || '未填項目'}（${irMoney(x.receivableAmt || x.invoiceAmt || x.contractAmt)}）`; sel.appendChild(o);
  });
  sel.value = '';
  openModal('modal-invoice-issue');
}

function irSubmitIssue() {
  if (!requireManage('receivable', '您沒有登錄發票號碼的權限')) return;
  const r = INVOICE_REQUESTS.find(x => x.id === irIssueId && x.status === 'requested');
  if (!r) { showToast('找不到這筆待開立的申請', 'error'); return; }
  const no = document.getElementById('ir-issue-no').value.trim().toUpperCase();
  const date = document.getElementById('ir-issue-date').value;
  if (!no) { showToast('請填寫發票號碼', 'error'); return; }
  if (!date) { showToast('請選擇開立日期', 'error'); return; }
  if (RECEIVABLES.some(x => String(x.invoiceNo || '').toUpperCase() === no) && !confirm(`發票號碼 ${no} 已經登錄過，確定要再登錄一次嗎？`)) return;
  const targetId = document.getElementById('ir-issue-target').value;
  const beforeReq = auditClone(r);
  let recvRow;
  if (targetId) {
    recvRow = RECEIVABLES.find(x => String(x.id) === targetId);
    if (!recvRow) { showToast('找不到要附加的應收紀錄', 'error'); return; }
    const before = auditClone(recvRow);
    recvRow.invoiceNo = no; recvRow.invoiceDate = date; recvRow.invoiceAmt = r.amount;
    if (!recvRow.buyer) recvRow.buyer = r.buyerName;
    normalizeReceivableStatus(recvRow);
    touchRowMeta(recvRow);
    recordAuditLog('update', 'receivable', recvRow.id, before, auditClone(recvRow), { riskLevel: 'medium', targetLabel: `${recvRow.buyer || ''}／${recvRow.item || ''}`, fields: ['invoiceNo', 'invoiceDate', 'invoiceAmt', 'buyer'], reason: '開票申請登錄發票號碼' });
  } else {
    recvRow = {
      id: rvNextId++, case: r.case, caseName: r.caseName,
      client: r.client, clientName: r.clientName,
      collectDate: '', buyer: r.buyerName, item: r.itemText,
      receivableAmt: r.amount, collectAmt: 0, bank: '',
      invoiceAmt: r.amount, invoiceDate: date, invoiceNo: no,
      contractAmt: 0, progress: '', receivableType: 'normal', retentionDue: '',
      invoiceLink: '', status: 'pending', note: r.note || '',
    };
    normalizeReceivableStatus(recvRow);
    touchRowMeta(recvRow, true);
    RECEIVABLES.push(recvRow);
    recordAuditLog('create', 'receivable', recvRow.id, null, auditClone(recvRow), { riskLevel: 'medium', targetLabel: `${recvRow.buyer || ''}／${recvRow.item || ''}`, reason: '開票申請登錄發票號碼' });
  }
  r.status = 'issued';
  r.invoiceNo = no; r.invoiceDate = date; r.receivableId = recvRow.id;
  r.issuedBy = currentUser.name; r.issuedAt = new Date().toISOString();
  touchRowMeta(r);
  recordAuditLog('update', 'invoiceRequest', r.id, beforeReq, auditClone(r), { riskLevel: 'medium', targetLabel: `${r.buyerName}／${r.itemText}`, reason: '登錄發票號碼 ' + no });
  closeModal('modal-invoice-issue');
  irIssueId = null;
  refreshAccountingLinkedViews(r.case);
  saveData();
  irRenderAll();
  showToast('發票號碼已登錄 ✓', 'success');
}

// ── rendering (shared by the desktop 應收 panel and the phone pages) ──
function irEl(tag, cls, text) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined) el.textContent = text;
  return el;
}

function irButton(label, cls, onClick) {
  const b = irEl('button', cls, label);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

function irRequestCard(r, full) {
  const card = irEl('div', 'ir-card');
  const top = irEl('div', 'ir-top');
  const label = { requested: '待開立', issued: '已開立', cancelled: '已取消' }[r.status] || r.status;
  top.appendChild(irEl('span', 'ir-pill ' + r.status, label));
  const when = r.requestedAt ? new Date(r.requestedAt).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '';
  top.appendChild(irEl('span', 'ir-meta', (r.requestedByName || '') + '・' + when));
  card.appendChild(top);
  if (full && r.status === 'requested' && irCanIssue()) {
    IR_FIELDS.forEach(([key, labelText]) => {
      const v = irFieldValue(r, key);
      if (!v) return;
      const row = irEl('div', 'ir-row');
      row.appendChild(irEl('span', 'ir-label', labelText));
      row.appendChild(irEl('span', 'ir-value', v));
      row.appendChild(irButton('複製', 'ir-copy', () => irCopy(key === 'amountText' ? String(Math.round(r.amount)) : v)));
      card.appendChild(row);
    });
  } else {
    card.appendChild(irEl('div', 'ir-title', (r.buyerName || '') + '・' + (r.itemText || '')));
    card.appendChild(irEl('div', 'ir-amount', irMoney(r.amount)));
    if (r.status === 'issued') card.appendChild(irEl('div', 'ir-meta', '發票 ' + (r.invoiceNo || '') + (r.invoiceDate ? '・' + r.invoiceDate : '')));
  }
  const actions = irEl('div', 'ir-actions');
  if (r.status === 'requested') {
    if (full && irCanIssue()) actions.appendChild(irButton('全部複製', 'ir-btn', () => irCopy(irRequestText(r))));
    if (full && irCanIssue()) actions.appendChild(irButton('填入發票號碼', 'ir-btn primary', () => irOpenIssueModal(r.id)));
    if (irCanIssue() || r.requestedBy === currentUser?.id) actions.appendChild(irButton('取消申請', 'ir-btn', () => irCancelRequest(r.id)));
  }
  if (actions.children.length) card.appendChild(actions);
  return card;
}

function irRenderQueue(container, options = {}) {
  if (!container) return;
  container.textContent = '';
  const pending = irRows('requested');
  const issued = irRows('issued').slice(0, options.issuedLimit ?? 5);
  if (!pending.length && !options.showEmpty) { /* nothing */ }
  if (!pending.length) container.appendChild(irEl('div', 'ir-empty', irCanIssue() ? '目前沒有待開立的申請' : '您沒有待開立的申請'));
  pending.forEach(r => container.appendChild(irRequestCard(r, options.full !== false)));
  if (issued.length) {
    container.appendChild(irEl('div', 'ir-sub', '最近已開立'));
    issued.forEach(r => container.appendChild(irRequestCard(r, false)));
  }
}

function irRenderDesktopPanel() {
  const panel = document.getElementById('rv-invoice-queue');
  if (!panel) return;
  const show = irCanApply() || irCanIssue();
  panel.hidden = !show;
  const applyBtn = document.getElementById('rv-btn-invoice-request');
  if (applyBtn) applyBtn.hidden = !irCanApply();
  if (!show) return;
  const head = document.getElementById('rv-invoice-queue-head');
  if (head) head.textContent = irCanIssue() ? `開票待辦（${irPendingCount()}）` : `我的開票申請（${irRows('requested').length}）`;
  const hasAny = irRows('requested').length || irRows('issued').length;
  document.getElementById('rv-invoice-queue-body').hidden = !hasAny;
  irRenderQueue(document.getElementById('rv-invoice-queue-list'));
}

function irRenderAll() {
  irRenderDesktopPanel();
  if (typeof mobileRenderOwnPage === 'function' && typeof MOBILE_OWN_PAGES !== 'undefined' && MOBILE_OWN_PAGES.includes(currentPage)) mobileRenderOwnPage(currentPage);
}

(function irHookViews() {
  const originalRenderReceivable = window.renderReceivable;
  window.renderReceivable = function () {
    const result = originalRenderReceivable.apply(this, arguments);
    irRenderDesktopPanel();
    return result;
  };
  const originalSubmitClient = window.submitClient;
  window.submitClient = function () {
    const before = CLIENTS.length;
    const wasEdit = !!clEditCode;
    const result = originalSubmitClient.apply(this, arguments);
    if (!wasEdit && CLIENTS.length > before && irClientReturn) {
      irClientReturn = false;
      const c = CLIENTS[CLIENTS.length - 1];
      irFillClientOptions(c.code);
      irClientChanged();
    }
    return result;
  };
})();
