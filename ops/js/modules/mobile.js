// MOBILE SHELL (PWA phase 1). New code, not extracted from the baseline.
// Adds a phone-width bottom tab bar and three phone-only pages (今天, 財務, 我的) on top of the
// existing pages. It only reads data and calls existing functions; it never writes data.
// Loaded last, after profitshare.js.

const MOBILE_OWN_PAGES = ['mhome', 'mfinance', 'mme', 'mreview', 'mapply'];
const MOBILE_FINANCE_PAGES = ['payable', 'receivable', 'profit', 'profitshare', 'overhead', 'tax'];
const MOBILE_TAB_OF_PAGE = {
  mhome: 'today', mapply: 'today', attendance: 'today',
  dashboard: 'cases', clients: 'cases', vendors: 'cases',
  mfinance: 'finance', mreview: 'finance', payreq: 'finance', payable: 'finance', receivable: 'finance', expense: 'finance',
  profit: 'finance', profitshare: 'finance', overhead: 'finance', tax: 'finance',
  mme: 'me',
};

function mobileIsActive() {
  return window.matchMedia('(max-width: 767px)').matches;
}

function mobileHasFinanceTab() {
  if (!currentUser) return false;
  return MOBILE_FINANCE_PAGES.some(canAccess) || canManage('payreq') || canManage('expense') || mobileCanReview();
}

function mobileTabOf(page) {
  return MOBILE_TAB_OF_PAGE[page] || 'me';
}

function mobileSyncChrome(page) {
  document.body.classList.toggle('m-own-header', MOBILE_OWN_PAGES.includes(page));
  const tab = mobileTabOf(page);
  document.querySelectorAll('.m-nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
    if (btn.dataset.tab === 'finance') btn.hidden = !mobileHasFinanceTab();
  });
}

function mobileShowOwnPage(id) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const pg = document.getElementById('page-' + id);
  if (pg) pg.classList.add('active');
  const main = document.querySelector('.main');
  if (main) main.scrollTop = 0;
  currentPage = id;
  closeMobileSidebar();
  mobileRenderOwnPage(id);
  mobileSyncChrome(id);
}

function mobileGo(tab) {
  if (tab === 'today') mobileShowOwnPage('mhome');
  else if (tab === 'finance') mobileShowOwnPage('mfinance');
  else if (tab === 'me') mobileShowOwnPage('mme');
  else if (tab === 'cases') {
    const target = ['dashboard', 'clients', 'vendors'].find(canAccess);
    if (target) navTo(target, navElForPage(target));
  }
}

function mobileOpen(page) {
  if (!canAccess(page)) { showToast('您沒有此功能的權限', 'error'); return; }
  navTo(page, navElForPage(page));
}

function mobileQuickNewCase() {
  if (!canCreateCase()) { showToast('您沒有新增個案的權限', 'error'); return; }
  mobileOpen('dashboard');
  openNewCaseModal();
}

function mobileTodayAttendance() {
  if (!currentUser?.id) return null;
  return ATTENDANCE_RECORDS.find(r => r.person === currentUser.id && r.date === attToday()) || null;
}

function mobileExpensePendingCount() {
  if (!canAccess('expense')) return 0;
  return EXPENSES.filter(r => r.status === 'pending' && (expCanManageAll() || r.person === currentUser.id)).length;
}

// Today's to-do list, derived only from existing data. `urgent` items count toward 「優先 N 件」.
function mobileBuildTasks() {
  const tasks = [];
  if (canAccess('attendance')) {
    const row = mobileTodayAttendance();
    const out = row ? (row.outTime || '') : '';
    if (!row || !row.inTime) {
      tasks.push({ urgent: true, pill: '今日', pillCls: 'warn', src: '出勤', title: '今日尚未打卡', detail: '', page: 'attendance' });
    } else if (!out) {
      tasks.push({ urgent: false, pill: '上班中', pillCls: 'ok', src: '出勤', title: '已上班打卡 ' + row.inTime, detail: '', page: 'attendance' });
    } else {
      tasks.push({ urgent: false, pill: '已完成', pillCls: 'ok', src: '出勤', title: row.inTime + ' – ' + out, detail: '', page: 'attendance' });
    }
  }
  if (canAccess('payreq')) {
    const n = payreqPendingCount();
    if (n > 0) tasks.push({ urgent: true, pill: '待審核', pillCls: 'warn', src: '廠商請款', title: n + ' 筆請款待處理', detail: '', page: 'payreq', review: 'payreq' });
  }
  const en = mobileExpensePendingCount();
  if (en > 0) tasks.push({ urgent: true, pill: '待審核', pillCls: 'warn', src: '費用申請', title: en + ' 筆費用待處理', detail: '', page: 'expense', review: 'expense' });
  return tasks;
}

function mobileEl(tag, cls, text) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined) el.textContent = text;
  return el;
}

function mobileRenderHome() {
  const dateEl = document.getElementById('m-date');
  if (dateEl) dateEl.textContent = new Date().toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric', weekday: 'short' });
  const syncEl = document.getElementById('m-sync');
  if (syncEl) syncEl.textContent = opsCloudReady ? '● 已同步' : '● 本機模式';
  const tasks = mobileBuildTasks();
  const urgent = tasks.filter(t => t.urgent).length;
  const subEl = document.getElementById('m-sub');
  if (subEl) subEl.textContent = urgent ? '優先 ' + urgent + ' 件' : '目前沒有需要優先處理的事';
  const attBtn = document.getElementById('m-q-attendance');
  if (attBtn) attBtn.hidden = !canAccess('attendance');
  const expBtn = document.getElementById('m-q-expense');
  if (expBtn) expBtn.hidden = !canApplySelf('expense');
  const prBtn = document.getElementById('m-q-payreq');
  if (prBtn) prBtn.hidden = !canApplySelf('payreq');
  const caseBtn = document.getElementById('m-q-newcase');
  if (caseBtn) caseBtn.hidden = !canCreateCase();
  const box = document.getElementById('m-tasks');
  if (!box) return;
  box.textContent = '';
  if (!tasks.length) box.appendChild(mobileEl('div', 'm-empty', '沒有待處理事項'));
  tasks.forEach(t => {
    const card = mobileEl('button', 'm-card');
    card.type = 'button';
    const top = mobileEl('div', 'm-card-top');
    top.appendChild(mobileEl('span', 'm-pill ' + t.pillCls, t.pill));
    top.appendChild(mobileEl('span', 'm-card-src', t.src));
    card.appendChild(top);
    card.appendChild(mobileEl('div', 'm-card-title', t.title));
    if (t.detail) card.appendChild(mobileEl('div', 'm-card-detail', t.detail));
    card.addEventListener('click', () => (t.review && mobileReviewItems(t.review).length ? mobileOpenReview(t.review) : mobileOpen(t.page)));
    box.appendChild(card);
  });
}

function mobileRenderFinance() {
  const applyRow = document.getElementById('m-f-apply');
  if (applyRow) applyRow.hidden = !(canApplySelf('expense') || canApplySelf('payreq'));
  const rvRow = document.getElementById('m-f-review');
  if (rvRow) {
    const total = mobileReviewTotal();
    rvRow.hidden = !mobileCanReview();
    const b = document.getElementById('m-f-review-badge');
    if (b) { b.hidden = total === 0; b.textContent = String(total); }
  }
  const rows = {
    'm-f-payable': 'payable', 'm-f-receivable': 'receivable', 'm-f-payreq': 'payreq',
    'm-f-expense': 'expense', 'm-f-profit': 'profit', 'm-f-profitshare': 'profitshare',
  };
  Object.entries(rows).forEach(([id, page]) => {
    const el = document.getElementById(id);
    if (el) el.hidden = !canAccess(page);
  });
  const badge = document.getElementById('m-f-payreq-badge');
  if (badge) {
    const n = canAccess('payreq') ? payreqPendingCount() : 0;
    badge.hidden = n === 0;
    badge.textContent = String(n);
  }
  const eBadge = document.getElementById('m-f-expense-badge');
  if (eBadge) {
    const n = mobileExpensePendingCount();
    eBadge.hidden = n === 0;
    eBadge.textContent = String(n);
  }
}

function mobileRenderMe() {
  const nameEl = document.getElementById('m-me-name');
  if (nameEl) nameEl.textContent = currentUser?.name || '';
  const roleEl = document.getElementById('m-me-role');
  if (roleEl) roleEl.textContent = currentUser?.roleCode || '';
  const avatar = document.getElementById('m-me-avatar');
  if (avatar) avatar.textContent = currentUser?.initial || '';
  const att = document.getElementById('m-me-attendance');
  if (att) att.hidden = !canAccess('attendance');
  const logout = document.getElementById('ops-logout-btn');
  const mLogout = document.getElementById('m-me-logout');
  if (mLogout) mLogout.hidden = !logout || logout.style.display === 'none';
}

function mobileRenderOwnPage(id) {
  if (id === 'mapply') mobileRenderApply();
  else if (id === 'mreview') mobileRenderReview();
  else if (id === 'mhome') mobileRenderHome();
  else if (id === 'mfinance') mobileRenderFinance();
  else if (id === 'mme') mobileRenderMe();
}

// ── integration with the existing shell, without editing its functions ──
(function mobileHook() {
  const originalNavTo = window.navTo;
  window.navTo = function (page, el) {
    const result = originalNavTo.call(this, page, el);
    mobileSyncChrome(page);
    return result;
  };
  const originalRender = window.renderCurrentPage;
  window.renderCurrentPage = function () {
    originalRender.apply(this, arguments);
    if (MOBILE_OWN_PAGES.includes(currentPage)) mobileRenderOwnPage(currentPage);
  };
  let landed = false;
  const originalDefault = window.activateDefaultPageForUser;
  window.activateDefaultPageForUser = function () {
    const moved = originalDefault.apply(this, arguments);
    if (landed || !currentUser?.id) return moved;
    landed = true;
    // On a phone the landing page is always 今天 (打卡 is its first quick action), even for people
    // whose desktop default page is something else; an explicit ?p=／#page link still wins.
    if (mobileIsActive() && !requestedPageFromUrl()) {
      mobileShowOwnPage('mhome');
      return true;
    }
    return moved;
  };
  const originalRole = window.applyRole;
  window.applyRole = function () {
    const result = originalRole.apply(this, arguments);
    mobileSyncChrome(currentPage);
    return result;
  };
})();

// ── PWA: register the service worker on phones/tablets and in the installed app only ──
// (desktop browsers keep the plain website behavior). Relative URL: the scope is whatever folder serves this page.
function mobileRegisterServiceWorker() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  if (!window.matchMedia('(max-width: 1279px), (display-mode: standalone)').matches) return;
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
window.addEventListener('load', mobileRegisterServiceWorker);

// ── 審核中心: approve / reject on the phone through the existing functions (same permissions, same side effects) ──
let mobileReviewTab = 'payreq';
const MOBILE_REVIEW_KINDS = ['payreq', 'expense', 'record'];

function mobileReviewAllowed(kind) {
  if (!currentUser) return false;
  if (kind === 'payreq') return canManage('payreq');
  if (kind === 'expense') return canAccess('expense') && expCanManageAll();
  if (kind === 'record') return canAccess('attendance') && attCanManage();
  return false;
}

function mobileCanReview() {
  return MOBILE_REVIEW_KINDS.some(mobileReviewAllowed);
}

function mobileReviewItems(kind) {
  if (!mobileReviewAllowed(kind)) return [];
  if (kind === 'payreq') return PAYABLES.filter(p => p.status === 'pending' && userCanViewCaseScopedRow(p.case, 'payreq', p.person));
  if (kind === 'expense') return EXPENSES.filter(r => r.status === 'pending');
  return ATTENDANCE_RECORDS.filter(r => r.source === 'manual' && !r.approvedBy);
}

function mobileReviewTotal() {
  return MOBILE_REVIEW_KINDS.reduce((n, k) => n + mobileReviewItems(k).length, 0);
}

function mobileMoney(v) {
  return '$ ' + Math.round(Number(v) || 0).toLocaleString('zh-TW');
}

function mobileOpenReview(kind) {
  if (!mobileCanReview()) { showToast('您沒有審核的權限', 'error'); return; }
  if (MOBILE_REVIEW_KINDS.includes(kind) && mobileReviewAllowed(kind)) mobileReviewTab = kind;
  mobileShowOwnPage('mreview');
}

function mobileReviewSelect(kind) {
  mobileReviewTab = kind;
  mobileRenderReview();
}

function mobileReviewApprove(kind, id) {
  if (!mobileReviewAllowed(kind)) { showToast('您沒有核准的權限', 'error'); return; }
  if (kind === 'payreq') {
    const p = PAYABLES.find(x => x.id === id);
    if (!p || !confirm(`確定核准「${p.vendor || '未填廠商'}／${p.summary || '未填摘要'}」${mobileMoney(p.amount)}？`)) return;
    approveReq(id);
  } else if (kind === 'expense') {
    const r = EXPENSES.find(x => x.id === id);
    if (!r || !confirm(`確定核准「${r.item || '未填項目'}」${mobileMoney(r.amount)}？`)) return;
    approveExpense(id);
  } else if (kind === 'record') {
    attApproveRecord(id); // has its own confirm
  }
  mobileRenderReview();
}

function mobileReviewReject(kind, id) {
  if (!mobileReviewAllowed(kind)) { showToast('您沒有退回的權限', 'error'); return; }
  if (kind === 'payreq') rejectPayreq(id); // has its own confirm
  else if (kind === 'expense') {
    const r = EXPENSES.find(x => x.id === id);
    if (!r || !confirm(`確定退回「${r.item || '未填項目'}」${mobileMoney(r.amount)}？`)) return;
    rejectExpense(id);
  }
  mobileRenderReview();
}

function mobileReviewCard(kind, row) {
  const card = mobileEl('div', 'm-card m-review-card');
  const top = mobileEl('div', 'm-card-top');
  const pill = kind === 'payreq' ? '廠商請款' : kind === 'expense' ? '費用申請' : '補登打卡';
  top.appendChild(mobileEl('span', 'm-pill warn', pill));
  let title = '', amount = null, meta = [];
  if (kind === 'payreq') {
    title = row.vendor || '未填廠商';
    amount = row.amount;
    meta = [row.summary || '未填摘要', row.caseName || '不指定個案', '申請人 ' + (row.person || '—'), row.wantDate ? '付款日 ' + row.wantDate : ''];
    if (row.invoice && row.invoice !== '有') meta.push('發票' + row.invoice);
    top.appendChild(mobileEl('span', 'm-card-src', row.code || ''));
  } else if (kind === 'expense') {
    title = row.item || '未填項目';
    amount = row.amount;
    meta = [row.caseName || '不指定個案', '申請人 ' + (employeeById(row.person)?.name || row.person || '—'), row.date || ''];
  } else {
    title = (employeeById(row.person)?.name || row.person || '—') + '　' + (row.date || '');
    meta = [(row.inTime || '--:--') + ' – ' + (row.outTime || '--:--'), row.note || ''];
  }
  card.appendChild(top);
  card.appendChild(mobileEl('div', 'm-card-title', title));
  if (amount !== null) card.appendChild(mobileEl('div', 'm-card-amount', mobileMoney(amount)));
  const metaEl = mobileEl('div', 'm-card-detail', meta.filter(Boolean).join('・'));
  card.appendChild(metaEl);
  const actions = mobileEl('div', 'm-actions');
  if (kind !== 'record') {
    const rej = mobileEl('button', 'm-act reject', '退回');
    rej.type = 'button';
    rej.addEventListener('click', () => mobileReviewReject(kind, row.id));
    actions.appendChild(rej);
  }
  const ok = mobileEl('button', 'm-act approve', '核准');
  ok.type = 'button';
  ok.addEventListener('click', () => mobileReviewApprove(kind, row.id));
  actions.appendChild(ok);
  card.appendChild(actions);
  return card;
}

function mobileRenderReview() {
  const allowed = MOBILE_REVIEW_KINDS.filter(mobileReviewAllowed);
  if (!allowed.includes(mobileReviewTab)) mobileReviewTab = allowed[0] || 'payreq';
  MOBILE_REVIEW_KINDS.forEach(kind => {
    const btn = document.getElementById('m-rv-tab-' + kind);
    if (!btn) return;
    btn.hidden = !allowed.includes(kind);
    btn.classList.toggle('active', kind === mobileReviewTab);
    const n = mobileReviewItems(kind).length;
    btn.textContent = ({ payreq: '請款', expense: '費用', record: '補登' })[kind] + ' ' + n;
  });
  const sub = document.getElementById('m-rv-sub');
  if (sub) sub.textContent = allowed.length ? '共 ' + mobileReviewTotal() + ' 筆待處理' : '您沒有審核的權限';
  const box = document.getElementById('m-rv-list');
  if (!box) return;
  box.textContent = '';
  const rows = mobileReviewItems(mobileReviewTab);
  if (!rows.length) box.appendChild(mobileEl('div', 'm-empty', allowed.length ? '目前沒有待審核項目' : ''));
  rows.forEach(row => box.appendChild(mobileReviewCard(mobileReviewTab, row)));
}

// ── 新增申請: 費用／廠商請款 ──
// The phone forms fill the same fields the desktop forms read and then call the existing submit functions
// (submitBatchExpense, submitPayReq), so validation, duplicate checks, post-close handling, permissions and
// saving are exactly the desktop ones. Nothing here writes data by itself.
let mobileApplyTab = 'expense';
let mobileExpCat = '';
let mobileExpReceipt = '發票';
let mobilePrInvoice = '有';
let mobilePrReceipt = '有';
let mobilePrEditId = null;

function mobileApplyAllowed(kind) {
  if (!currentUser) return false;
  return kind === 'expense' ? canApplySelf('expense') : canApplySelf('payreq');
}

function mobileOpenApply(kind) {
  if (!mobileApplyAllowed(kind)) { showToast(kind === 'expense' ? '您沒有新增費用的權限' : '您沒有新增請款的權限', 'error'); return; }
  mobileApplyTab = kind;
  mobileResetExpenseForm();
  mobileResetPayreqForm();
  mobileShowOwnPage('mapply');
}

function mobileApplySelect(kind) {
  if (!mobileApplyAllowed(kind)) return;
  mobileApplyTab = kind;
  mobileRenderApply();
}

function mobilePills(containerId, values, current, onPick) {
  const box = document.getElementById(containerId);
  if (!box) return;
  box.textContent = '';
  values.forEach(v => {
    const b = mobileEl('button', 'm-pill-btn' + (v === current ? ' active' : ''), v);
    b.type = 'button';
    b.addEventListener('click', () => onPick(v));
    box.appendChild(b);
  });
}

function mobileSeg(containerId, values, current, onPick) {
  const box = document.getElementById(containerId);
  if (!box) return;
  box.textContent = '';
  values.forEach(v => {
    const b = mobileEl('button', v === current ? 'active' : '', v);
    b.type = 'button';
    b.addEventListener('click', () => onPick(v));
    box.appendChild(b);
  });
}

function mobileSetOptions(selectEl, options, keep) {
  const prev = keep ? selectEl.value : '';
  selectEl.textContent = '';
  options.forEach(o => { const op = document.createElement('option'); op.value = o.value; op.textContent = o.label; selectEl.appendChild(op); });
  if (keep && options.some(o => o.value === prev)) selectEl.value = prev;
}

function mobileRenderApply() {
  const allowed = ['expense', 'payreq'].filter(mobileApplyAllowed);
  if (!allowed.includes(mobileApplyTab)) mobileApplyTab = allowed[0] || 'expense';
  ['expense', 'payreq'].forEach(kind => {
    const tab = document.getElementById('m-ap-tab-' + kind);
    if (tab) { tab.hidden = !allowed.includes(kind); tab.classList.toggle('active', kind === mobileApplyTab); }
    const form = document.getElementById('m-ap-' + kind);
    if (form) form.hidden = kind !== mobileApplyTab;
  });
  if (mobileApplyTab === 'expense') mobileRenderExpenseForm(); else mobileRenderPayreqForm();
}

// ---- expense ----
function mobileRenderExpenseForm() {
  if (!mobileApplyAllowed('expense')) return;
  const caseSel = document.getElementById('m-ex-case');
  mobileSetOptions(caseSel, expBatchCaseOptions().map(c => ({ value: c.key, label: expBatchCaseLabel(c) })), true);
  const personWrap = document.getElementById('m-ex-person-wrap');
  const personSel = document.getElementById('m-ex-person');
  const manager = expCanManageAll();
  personWrap.hidden = !manager;
  if (manager) {
    mobileSetOptions(personSel, activeSystemUsers().map(u => ({ value: u.id, label: u.name })), true);
    if (!personSel.value) personSel.value = currentUser.id;
  }
  if (!mobileExpCat) mobileExpCat = EXP_CATS[0];
  mobilePills('m-ex-cats', EXP_CATS, mobileExpCat, v => { mobileExpCat = v; mobileRenderExpenseForm(); });
  mobilePills('m-ex-receipts', EXP_RECEIPTS, mobileExpReceipt, v => { mobileExpReceipt = v; mobileRenderExpenseForm(); });
  mobileExpenseCaseChanged();
  const mine = EXPENSES.filter(r => r.person === currentUser.id && ['pending', 'rejected'].includes(r.status))
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).slice(0, 8);
  const box = document.getElementById('m-ex-mine');
  box.textContent = '';
  const sub = document.getElementById('m-ex-mine-sub');
  if (sub) sub.textContent = '待審核 ' + EXPENSES.filter(r => r.person === currentUser.id && r.status === 'pending').length + '・已退回 ' + EXPENSES.filter(r => r.person === currentUser.id && r.status === 'rejected').length;
  if (!mine.length) box.appendChild(mobileEl('div', 'm-empty', '沒有待審核或已退回的費用'));
  mine.forEach(r => {
    const card = mobileEl('div', 'm-card');
    const top = mobileEl('div', 'm-card-top');
    top.appendChild(mobileEl('span', 'm-pill ' + (r.status === 'rejected' ? 'bad' : 'warn'), r.status === 'rejected' ? '已退回' : '待審核'));
    top.appendChild(mobileEl('span', 'm-card-src', r.date || ''));
    card.appendChild(top);
    card.appendChild(mobileEl('div', 'm-card-title', r.item || '未填項目'));
    card.appendChild(mobileEl('div', 'm-card-detail', (r.caseName || '固定開銷') + '・' + mobileMoney(r.amount)));
    box.appendChild(card);
  });
}

function mobileExpenseCaseChanged() {
  const key = document.getElementById('m-ex-case')?.value || '固定開銷';
  const wrap = document.getElementById('m-ex-treat-wrap');
  if (wrap) wrap.hidden = !(key !== '固定開銷' && isClosedCase(key));
}

function mobileResetExpenseForm() {
  ['m-ex-amount', 'm-ex-item', 'm-ex-note'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const date = document.getElementById('m-ex-date');
  if (date) date.value = localDateKey();
  const caseSel = document.getElementById('m-ex-case');
  if (caseSel) { caseSel.textContent = ''; }
  const personSel = document.getElementById('m-ex-person');
  if (personSel) personSel.textContent = '';
  mobileExpCat = EXP_CATS[0];
  mobileExpReceipt = EXP_RECEIPTS[0];
  const treat = document.getElementById('m-ex-treat');
  if (treat) treat.value = 'post_close_cost';
}

function mobileSubmitExpense() {
  if (!mobileApplyAllowed('expense')) { showToast('您沒有新增費用的權限', 'error'); return; }
  const key = document.getElementById('m-ex-case').value || '固定開銷';
  const opt = expBatchCaseOptions().find(c => c.key === key);
  const date = document.getElementById('m-ex-date').value;
  const amount = document.getElementById('m-ex-amount').value.trim();
  const item = document.getElementById('m-ex-item').value.trim();
  const note = document.getElementById('m-ex-note').value.trim();
  const treatment = document.getElementById('m-ex-treat-wrap').hidden ? '' : document.getElementById('m-ex-treat').value;
  expBatchEditId = null;
  expBatchInit();
  if (expCanManageAll()) document.getElementById('exp-batch-person').value = document.getElementById('m-ex-person').value || currentUser.id;
  if (date) document.getElementById('exp-batch-month').value = date.slice(0, 7);
  const tr = document.querySelector('#exp-batch-tbody tr');
  const ins = tr.querySelectorAll('input,select');
  ins[0].value = key === '固定開銷' || !opt ? '' : expBatchCaseLabel(opt);
  expBatchCaseChanged(ins[0]);
  if (treatment && !ins[1].disabled) ins[1].value = treatment;
  ins[2].value = date;
  ins[3].value = item;
  ins[4].value = amount.replace(/[^0-9.]/g, '');
  ins[5].value = mobileExpCat;
  ins[6].value = mobileExpReceipt;
  ins[7].value = note;
  const before = EXPENSES.length;
  submitBatchExpense();
  closeModal('modal-add-expense');
  if (EXPENSES.length > before) {
    mobileResetExpenseForm();
  }
  mobileRenderExpenseForm();
}

// ---- vendor payment request ----
function mobileRenderPayreqForm() {
  if (!mobileApplyAllowed('payreq')) return;
  const dl = document.getElementById('m-dl-vendors');
  dl.textContent = '';
  VENDORS.slice().sort((a, b) => String(a.code || '').localeCompare(String(b.code || ''), 'zh-TW', { numeric: true }))
    .forEach(v => { const o = document.createElement('option'); o.value = v.code + ' - ' + v.name; o.label = v.trade || ''; dl.appendChild(o); });
  const caseSel = document.getElementById('m-pr-case');
  const prevCase = caseSel.value;
  const tmp = document.createElement('select');
  tmp.innerHTML = buildCaseOptions('── 不指定個案（選填）──', false, false, prevCase || '', c => userCanViewCaseFinancials(c.code, 'payreq'));
  mobileSetOptions(caseSel, [...tmp.options].map(o => ({ value: o.value, label: o.textContent })), false);
  caseSel.value = [...caseSel.options].some(o => o.value === prevCase) ? prevCase : '';
  const manager = canManage('payreq');
  document.getElementById('m-pr-applicant-wrap').hidden = !manager;
  if (manager) {
    const sel = document.getElementById('m-pr-applicant');
    const prev = sel.value;
    mobileSetOptions(sel, activeSystemUsers().map(u => ({ value: u.name, label: u.name })), false);
    sel.value = prev && [...sel.options].some(o => o.value === prev) ? prev : currentUser.name;
  }
  mobileSeg('m-pr-invoice', ['有', '無', '待補'], mobilePrInvoice, v => { mobilePrInvoice = v; mobileRenderPayreqForm(); });
  mobileSeg('m-pr-receipt', ['有', '無', '待補'], mobilePrReceipt, v => { mobilePrReceipt = v; mobileRenderPayreqForm(); });
  const editing = mobilePrEditId !== null;
  document.getElementById('m-pr-editing').hidden = !editing;
  document.getElementById('m-pr-submit').textContent = editing ? '儲存修改，重新送出審核' : '送出請款，等待財務審核';
  const mine = PAYABLES.filter(p => ['pending', 'rejected'].includes(p.status) && (p.person === currentUser.name || p.person === currentUser.id));
  const box = document.getElementById('m-pr-mine');
  box.textContent = '';
  document.getElementById('m-pr-mine-sub').textContent = '待審核 ' + mine.filter(p => p.status === 'pending').length + '・已退回 ' + mine.filter(p => p.status === 'rejected').length;
  if (!mine.length) box.appendChild(mobileEl('div', 'm-empty', '沒有待審核或已退回的請款'));
  mine.forEach(p => {
    const card = mobileEl('div', 'm-card');
    const top = mobileEl('div', 'm-card-top');
    top.appendChild(mobileEl('span', 'm-pill ' + (p.status === 'rejected' ? 'bad' : 'warn'), p.status === 'rejected' ? '已退回' : '待審核'));
    top.appendChild(mobileEl('span', 'm-card-src', p.wantDate || ''));
    card.appendChild(top);
    card.appendChild(mobileEl('div', 'm-card-title', (p.vendor || '未填廠商') + '・' + (p.summary || '')));
    card.appendChild(mobileEl('div', 'm-card-detail', mobileMoney(p.amount)));
    if (p.status === 'rejected') {
      const b = mobileEl('button', 'm-mini-btn', '修改後重送');
      b.type = 'button';
      b.addEventListener('click', () => mobilePayreqEdit(p.id));
      card.appendChild(b);
    }
    box.appendChild(card);
  });
}

function mobileResetPayreqForm() {
  ['m-pr-vendor', 'm-pr-amount', 'm-pr-date', 'm-pr-summary', 'm-pr-note'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const caseSel = document.getElementById('m-pr-case');
  if (caseSel) caseSel.textContent = '';
  const sel = document.getElementById('m-pr-applicant');
  if (sel) sel.textContent = '';
  mobilePrInvoice = '有';
  mobilePrReceipt = '有';
  mobilePrEditId = null;
}

function mobilePayreqEdit(id) {
  const p = PAYABLES.find(x => Number(x.id) === Number(id) && (x.status === 'pending' || x.status === 'rejected'));
  if (!p) { showToast('找不到這筆待審核或已退回的請款', 'error'); return; }
  if (!userCanViewCaseScopedRow(p.case, 'payreq', p.person)) { showToast('您沒有查看這個案的權限', 'error'); return; }
  if (p.status === 'pending' && !requireManage('payreq', '您沒有編輯請款申請的權限')) return;
  if (p.status === 'rejected' && !(canManage('payreq') || p.person === currentUser.id || p.person === currentUser.name)) { showToast('您沒有修改這筆請款的權限', 'error'); return; }
  mobileApplyTab = 'payreq';
  mobilePrEditId = p.id;
  mobileRenderPayreqForm();
  document.getElementById('m-pr-case').value = p.case || '';
  document.getElementById('m-pr-vendor').value = p.vendor || '';
  document.getElementById('m-pr-amount').value = p.amount ? String(p.amount) : '';
  document.getElementById('m-pr-summary').value = p.summary || '';
  document.getElementById('m-pr-date').value = p.wantDate || '';
  document.getElementById('m-pr-note').value = p.note || '';
  if (canManage('payreq')) document.getElementById('m-pr-applicant').value = p.person || currentUser.name;
  mobilePrInvoice = p.invoice || '有';
  mobilePrReceipt = p.receipt || '有';
  document.getElementById('m-pr-editing-text').textContent = '修改中：' + (p.vendor || '') + '・' + (p.summary || '');
  mobileRenderApply();
  window.scrollTo(0, 0);
  const main = document.querySelector('.main');
  if (main) main.scrollTop = 0;
}

function mobilePayreqCancelEdit() {
  mobileResetPayreqForm();
  mobileRenderPayreqForm();
}

function mobileSubmitPayreq() {
  if (!mobileApplyAllowed('payreq')) { showToast('您沒有新增請款的權限', 'error'); return; }
  const editId = mobilePrEditId;
  payreqSubmitting = false;
  payreqEditId = editId;
  const caseVal = document.getElementById('m-pr-case').value;
  const prCase = document.getElementById('pr-case');
  prCase.innerHTML = buildCaseOptions('── 不指定個案（選填）──', false, false, caseVal, c => userCanViewCaseFinancials(c.code, 'payreq'));
  prCase.value = caseVal;
  const set = (id, value) => { const el = document.getElementById(id); if (el) el.value = value; };
  set('pr-vendor', document.getElementById('m-pr-vendor').value);
  set('pr-amount', document.getElementById('m-pr-amount').value);
  set('pr-summary', document.getElementById('m-pr-summary').value);
  set('pr-date', document.getElementById('m-pr-date').value);
  set('payreq-note', document.getElementById('m-pr-note').value);
  if (canManage('payreq')) {
    fillActiveUserNameSelect('pr-applicant', document.getElementById('m-pr-applicant').value, { includeInactive: true });
    set('pr-applicant', document.getElementById('m-pr-applicant').value);
  }
  setPayreqRadio('rg-invoice', mobilePrInvoice);
  setPayreqRadio('rg-receipt', mobilePrReceipt);
  const before = PAYABLES.length;
  submitPayReq();
  const done = editId !== null ? payreqEditId === null && PAYABLES.some(p => Number(p.id) === Number(editId) && p.status === 'pending') : PAYABLES.length > before;
  closeModal('modal-payreq');
  if (done) mobileResetPayreqForm();
  else payreqEditId = null;
  mobileRenderPayreqForm();
}
