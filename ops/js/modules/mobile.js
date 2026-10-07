// MOBILE SHELL (PWA phase 1). New code, not extracted from the baseline.
// Adds a phone-width bottom tab bar and three phone-only pages (今天, 財務, 我的) on top of the
// existing pages. It only reads data and calls existing functions; it never writes data.
// Loaded last, after profitshare.js.

const MOBILE_OWN_PAGES = ['mhome', 'mfinance', 'mme', 'mreview', 'mapply', 'minvoice', 'minbox', 'mprofitshare'];
const MOBILE_FINANCE_PAGES = ['payable', 'receivable', 'profit', 'profitshare', 'overhead', 'tax'];
const MOBILE_TAB_OF_PAGE = {
  mhome: 'today', mapply: 'today', attendance: 'today',
  dashboard: 'cases', clients: 'cases', vendors: 'cases',
  mfinance: 'finance', mprofitshare: 'finance', mreview: 'finance', minvoice: 'finance', payreq: 'finance', payable: 'finance', receivable: 'finance', expense: 'finance',
  profit: 'finance', profitshare: 'finance', overhead: 'finance', tax: 'finance',
  mme: 'me', minbox: 'me',
};

function mobileIsActive() {
  return window.matchMedia('(max-width: 1023px)').matches;
}

function mobileHasFinanceTab() {
  if (!currentUser) return false;
  return MOBILE_FINANCE_PAGES.some(canAccess) || canManage('payreq') || canManage('expense') || mobileCanReview();
}

function mobileTabOf(page) {
  return MOBILE_TAB_OF_PAGE[page] || 'me';
}

function mobileSyncSubnav(page) {
  const bar = document.getElementById('m-subnav');
  if (!bar) return;
  const on = ['dashboard', 'clients', 'vendors'].includes(page);
  bar.hidden = !on;
  ['dashboard', 'clients', 'vendors'].forEach(p => {
    const chip = document.getElementById('m-sub-' + p);
    if (!chip) return;
    chip.hidden = !canAccess(p);
    chip.classList.toggle('active', p === page);
  });
  const add = document.getElementById('m-sub-add');
  if (add) {
    const label = { dashboard: '＋ 新增案件', clients: '＋ 新增客戶', vendors: '＋ 新增廠商' }[page] || '';
    add.textContent = label;
    add.hidden = !on || !mobileCanAddFor(page);
  }
}

function mobileCanAddFor(page) {
  if (page === 'dashboard') return canCreateCase();
  if (page === 'clients') return canApplySelf('clients');
  if (page === 'vendors') return canApplySelf('vendors');
  return false;
}

function mobileSubnavAdd() {
  if (!mobileCanAddFor(currentPage)) { showToast('您沒有新增的權限', 'error'); return; }
  if (currentPage === 'dashboard') openNewCaseModal();
  else if (currentPage === 'clients') openClientModal();
  else if (currentPage === 'vendors') openVendorModal();
}

function mobileSyncChrome(page) {
  mobileSyncSubnav(page);
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
  const ir = irPendingCount();
  if (ir > 0) tasks.push({ urgent: true, pill: '待開立', pillCls: 'warn', src: '開發票', title: ir + ' 筆開票申請待處理', detail: '', page: 'receivable', invoice: true });
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
  mobileRenderShortcuts();
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
    card.addEventListener('click', () => (t.invoice ? mobileShowOwnPage('minvoice') : t.review && mobileReviewItems(t.review).length ? mobileOpenReview(t.review) : mobileOpen(t.page)));
    box.appendChild(card);
  });
}

function mobileRenderFinance() {
  const ivRow = document.getElementById('m-f-invoice');
  if (ivRow) {
    ivRow.hidden = !irCanIssue();
    const b = document.getElementById('m-f-invoice-badge');
    if (b) { b.hidden = irPendingCount() === 0; b.textContent = String(irPendingCount()); }
  }
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
  if (id === 'mprofitshare') mobileRenderProfitShare();
  else if (id === 'minbox') mobileRenderInbox();
  else if (id === 'minvoice') mobileRenderInvoiceQueue();
  else if (id === 'mapply') mobileRenderApply();
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
  if (kind !== 'record') {
    const links = receiptAttachmentEls(row);
    if (links.children.length) card.appendChild(links);
  }
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
  if (kind === 'invoice') return irCanApply();
  return kind === 'expense' ? canApplySelf('expense') : canApplySelf('payreq');
}

function mobileOpenApply(kind, options = {}) {
  if (!mobileApplyAllowed(kind)) { showToast(kind === 'expense' ? '您沒有新增費用的權限' : '您沒有新增請款的權限', 'error'); return; }
  mobileApplyTab = kind;
  mobileResetExpenseForm();
  mobileResetPayreqForm();
  if (options.keep) receiptPending[kind] = options.keep;
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
  const allowed = ['expense', 'payreq', 'invoice'].filter(mobileApplyAllowed);
  if (!allowed.includes(mobileApplyTab)) mobileApplyTab = allowed[0] || 'expense';
  ['expense', 'payreq', 'invoice'].forEach(kind => {
    const tab = document.getElementById('m-ap-tab-' + kind);
    if (tab) { tab.hidden = !allowed.includes(kind); tab.classList.toggle('active', kind === mobileApplyTab); }
    const form = document.getElementById('m-ap-' + kind);
    if (form) form.hidden = kind !== mobileApplyTab;
  });
  if (mobileApplyTab === 'expense') mobileRenderExpenseForm();
  else if (mobileApplyTab === 'invoice') mobileRenderInvoiceTab();
  else mobileRenderPayreqForm();
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
  mobileRenderAttachChips();
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
    mobileAddReceiptBits(card, 'EXPENSES', r);
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
  receiptPending.expense = [];
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
    const created = EXPENSES[EXPENSES.length - 1];
    if (receiptPending.expense.length) { receiptApplyTo(created, receiptPending.expense); saveData(); }
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
  document.getElementById('m-pr-newvendor').hidden = !canApplySelf('vendors');
  document.getElementById('m-pr-newcase').hidden = !canCreateCase();
  document.getElementById('m-pr-applicant-wrap').hidden = !manager;
  if (manager) {
    const sel = document.getElementById('m-pr-applicant');
    const prev = sel.value;
    mobileSetOptions(sel, activeSystemUsers().map(u => ({ value: u.name, label: u.name })), false);
    sel.value = prev && [...sel.options].some(o => o.value === prev) ? prev : currentUser.name;
  }
  mobileSeg('m-pr-invoice', ['有', '無', '待補'], mobilePrInvoice, v => { mobilePrInvoice = v; mobileRenderPayreqForm(); });
  mobileSeg('m-pr-receipt', ['有', '無', '待補'], mobilePrReceipt, v => { mobilePrReceipt = v; mobileRenderPayreqForm(); });
  mobileRenderAttachChips();
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
    mobileAddReceiptBits(card, 'PAYABLES', p);
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
  receiptPending.payreq = [];
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
  if (done) {
    const created = editId !== null ? PAYABLES.find(p => Number(p.id) === Number(editId)) : PAYABLES[PAYABLES.length - 1];
    if (created && receiptPending.payreq.length) { receiptApplyTo(created, receiptPending.payreq); saveData(); }
    mobileResetPayreqForm();
  } else payreqEditId = null;
  mobileRenderPayreqForm();
}

// ── quick-add from inside a form: open the existing modal, then come back with the new row selected ──
function mobileNewVendorFromForm() {
  if (!canApplySelf('vendors')) { showToast('您沒有新增廠商的權限', 'error'); return; }
  openVendorModal();
}

function mobileNewCaseFromForm() {
  if (!canCreateCase()) { showToast('您沒有新增個案的權限', 'error'); return; }
  openNewCaseModal();
}

(function mobileHookCreate() {
  const originalVendor = window.submitVendor;
  window.submitVendor = function () {
    const before = VENDORS.length;
    const wasEdit = !!vdEditCode;
    const result = originalVendor.apply(this, arguments);
    if (!wasEdit && VENDORS.length > before && currentPage === 'mapply') {
      const v = VENDORS[VENDORS.length - 1];
      mobileRenderPayreqForm();
      document.getElementById('m-pr-vendor').value = v.code + ' - ' + v.name;
    }
    return result;
  };
  const originalCase = window.submitNewCase;
  window.submitNewCase = function () {
    const before = CASES.length;
    const result = originalCase.apply(this, arguments);
    if (CASES.length > before && currentPage === 'mapply') {
      const c = CASES[CASES.length - 1];
      mobileRenderPayreqForm();
      const sel = document.getElementById('m-pr-case');
      if ([...sel.options].some(o => o.value === c.code)) sel.value = c.code;
    }
    return result;
  };
})();

// ── 開發票: phone pages (logic lives in invoicerequest.js) ──
function mobileRenderInvoiceTab() {
  const sub = document.getElementById('m-ap-invoice-sub');
  const mine = INVOICE_REQUESTS.filter(r => r.requestedBy === currentUser?.id);
  if (sub) sub.textContent = '待開立 ' + mine.filter(r => r.status === 'requested').length + '・已開立 ' + mine.filter(r => r.status === 'issued').length;
  const box = document.getElementById('m-ap-invoice-list');
  box.textContent = '';
  if (!mine.length) box.appendChild(mobileEl('div', 'm-empty', '還沒有開票申請'));
  mine.slice().sort((a, b) => String(b.requestedAt || '').localeCompare(String(a.requestedAt || ''))).slice(0, 10).forEach(r => box.appendChild(irRequestCard(r, false)));
}

function mobileRenderInvoiceQueue() {
  const sub = document.getElementById('m-iv-sub');
  if (sub) sub.textContent = irCanIssue() ? irPendingCount() + ' 筆待開立' : '您沒有登錄發票的權限';
  irRenderQueue(document.getElementById('m-iv-list'), { full: true });
}

// ── 單據 on the phone ──
function mobileAddReceiptBits(card, collection, row) {
  const links = receiptAttachmentEls(row);
  if (links.children.length) card.appendChild(links);
  if (receiptCanAttach(collection, row)) {
    const b = mobileEl('button', 'm-mini-btn', links.children.length ? '單據（' + links.children.length + '）' : '＋ 單據');
    b.type = 'button';
    b.addEventListener('click', () => receiptOpenAttachModal(collection, row.id));
    card.appendChild(b);
  }
}

function mobileAttachPick(form, mode) {
  if (mode === 'link') receiptAddLink({ kind: 'form', form });
  else if (mode === 'inbox') mobileOpenInbox(form);
  else receiptPick({ kind: 'form', form }, mode);
}

function mobileRenderAttachChips() {
  [['expense', 'm-ex-atts'], ['payreq', 'm-pr-atts']].forEach(([form, id]) => {
    const box = document.getElementById(id);
    if (!box) return;
    box.textContent = '';
    receiptPending[form].forEach((a, i) => {
      const row = mobileEl('div', 'm-att');
      const link = document.createElement('a');
      link.href = a.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = '📎 ' + (a.name || '單據');
      const rm = mobileEl('button', '', '✕');
      rm.type = 'button'; rm.setAttribute('aria-label', '移除單據');
      rm.addEventListener('click', () => { receiptPending[form].splice(i, 1); mobileRenderAttachChips(); });
      row.appendChild(link); row.appendChild(rm);
      box.appendChild(row);
    });
  });
}

// ── 單據匣: the files in the signed-in person's own Drive folder ──
let mobileInboxFor = '';
let mobileInboxItems = [];

function mobileOpenInbox(forForm) {
  mobileInboxFor = forForm || '';
  mobileShowOwnPage('minbox');
}

function mobileInboxAdd(mode) {
  receiptPick({ kind: 'inbox' }, mode);
}

async function mobileLoadInbox() {
  if (!receiptTokenValid() || !receiptFolderId()) { mobileInboxItems = []; mobileRenderInbox(true); return; }
  try {
    const q = encodeURIComponent(`'${receiptFolderId()}' in parents and trashed = false`);
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=createdTime%20desc&pageSize=30&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name,mimeType,createdTime,webViewLink)`, { headers: { Authorization: 'Bearer ' + receiptToken } });
    if (res.status === 401) { receiptToken = ''; mobileInboxItems = []; mobileRenderInbox(true); return; }
    if (!res.ok) throw new Error('讀取單據匣失敗（' + res.status + '）');
    mobileInboxItems = (await res.json()).files || [];
  } catch (e) {
    showToast(String(e && e.message || e), 'error');
    mobileInboxItems = [];
  }
  mobileRenderInbox(true);
}

function mobileInboxUsed(id) {
  return [...EXPENSES, ...PAYABLES].some(r => Array.isArray(r.attachments) && r.attachments.some(a => a.id === id));
}

function mobileRenderInbox(loaded) {
  const connected = receiptTokenValid();
  const note = document.getElementById('m-ib-connect');
  if (note) note.hidden = connected;
  const sub = document.getElementById('m-ib-sub');
  if (sub) sub.textContent = mobileInboxFor ? '選一張單據帶進' + (mobileInboxFor === 'expense' ? '費用申請' : '廠商請款') : (connected ? '最近 ' + mobileInboxItems.length + ' 個檔案' : '尚未連線雲端硬碟');
  if (connected && !loaded) { mobileLoadInbox(); }
  const box = document.getElementById('m-ib-list');
  if (!box) return;
  box.textContent = '';
  if (connected && loaded && !mobileInboxItems.length) box.appendChild(mobileEl('div', 'm-empty', '單據匣是空的'));
  mobileInboxItems.forEach(f => {
    const card = mobileEl('div', 'm-card');
    const top = mobileEl('div', 'm-card-top');
    top.appendChild(mobileEl('span', 'm-pill ' + (mobileInboxUsed(f.id) ? 'ok' : 'warn'), mobileInboxUsed(f.id) ? '已使用' : '未使用'));
    top.appendChild(mobileEl('span', 'm-card-src', f.createdTime ? new Date(f.createdTime).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : ''));
    card.appendChild(top);
    const link = document.createElement('a');
    link.className = 'm-card-title'; link.href = f.webViewLink || '#'; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = f.name;
    link.style.color = 'inherit';
    card.appendChild(link);
    const att = { id: f.id, name: f.name, url: f.webViewLink, at: new Date().toISOString(), by: currentUser?.name || '' };
    const actions = mobileEl('div', 'm-actions');
    if (!mobileInboxFor || mobileInboxFor === 'expense') if (mobileApplyAllowed('expense')) {
      const b = mobileEl('button', 'm-act approve', '用於費用'); b.type = 'button';
      b.addEventListener('click', () => mobileOpenApply('expense', { keep: [...receiptPending.expense, att] }));
      actions.appendChild(b);
    }
    if (!mobileInboxFor || mobileInboxFor === 'payreq') if (mobileApplyAllowed('payreq')) {
      const b = mobileEl('button', 'm-act approve', '用於請款'); b.type = 'button';
      b.addEventListener('click', () => mobileOpenApply('payreq', { keep: [...receiptPending.payreq, att] }));
      actions.appendChild(b);
    }
    if (actions.children.length) card.appendChild(actions);
    box.appendChild(card);
  });
}

// ── 今天 → 快速動作 (editable, kept on this phone only; no cloud data involved) ──
const MOBILE_SHORTCUT_MAX = 8;
const MOBILE_SHORTCUT_DEFAULT = ['attendance', 'expense', 'payreq', 'newcase'];
const MOBILE_SHORTCUTS = [
  { id: 'attendance', label: '打卡', icon: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', allowed: () => canAccess('attendance'), run: () => mobileOpen('attendance') },
  { id: 'expense', label: '費用', icon: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>', allowed: () => canApplySelf('expense'), run: () => mobileOpenApply('expense') },
  { id: 'payreq', label: '請款', icon: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>', allowed: () => canApplySelf('payreq'), run: () => mobileOpenApply('payreq') },
  { id: 'invoice', label: '開發票', icon: '<path d="M7 3h10v18l-2.5-1.5L12 21l-2.5-1.5L7 21z"/><path d="M10 8h4M10 12h4"/>', allowed: () => irCanApply(), run: () => mobileOpenApply('invoice') },
  { id: 'newcase', label: '新增案件', icon: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M12 9v6M9 12h6"/>', allowed: () => canCreateCase(), run: () => mobileQuickNewCase() },
  { id: 'review', label: '審核', icon: '<path d="M9 12l2 2 4-4"/><rect x="4" y="4" width="16" height="16" rx="2"/>', allowed: () => mobileCanReview(), run: () => mobileOpenReview('payreq') },
  { id: 'invoicequeue', label: '開票待辦', icon: '<path d="M7 3h10v18l-2.5-1.5L12 21l-2.5-1.5L7 21z"/><path d="M9 11l2 2 3-3"/>', allowed: () => irCanIssue(), run: () => mobileShowOwnPage('minvoice') },
  { id: 'inbox', label: '單據匣', icon: '<path d="M4 13l2-8h12l2 8v6H4z"/><path d="M4 13h5l1 2h4l1-2h5"/>', allowed: () => !!receiptFolderId(), run: () => mobileOpenInbox() },
  { id: 'receivable', label: '應收', icon: '<path d="M12 3v14M7 12l5 5 5-5"/><path d="M5 21h14"/>', allowed: () => canAccess('receivable'), run: () => mobileOpen('receivable') },
  { id: 'payable', label: '應付', icon: '<path d="M12 21V7M7 12l5-5 5 5"/><path d="M5 3h14"/>', allowed: () => canAccess('payable'), run: () => mobileOpen('payable') },
  { id: 'profit', label: '成本控制', icon: '<path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/>', allowed: () => canAccess('profit'), run: () => mobileOpen('profit') },
  { id: 'profitshare', label: '淨利潤', icon: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5h4a1.5 1.5 0 010 3h-3a1.5 1.5 0 000 3H15"/>', allowed: () => canAccess('profitshare'), run: () => mobileOpenProfitShare() },
  { id: 'cases', label: '案件', icon: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h5"/>', allowed: () => ['dashboard', 'clients', 'vendors'].some(canAccess), run: () => mobileGo('cases') },
  { id: 'clients', label: '客戶', icon: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-5 15-5 16 0"/>', allowed: () => canAccess('clients'), run: () => mobileOpen('clients') },
  { id: 'vendors', label: '廠商', icon: '<path d="M3 21V9l9-5 9 5v12"/><path d="M9 21v-6h6v6"/>', allowed: () => canAccess('vendors'), run: () => mobileOpen('vendors') },
];

function mobileShortcutDef(id) {
  return MOBILE_SHORTCUTS.find(s => s.id === id);
}

function mobileShortcutKey() {
  return 'yutesign_ops_m_shortcuts_' + (currentUser?.id || '');
}

function mobileShortcutIds() {
  try {
    const raw = JSON.parse(localStorage.getItem(mobileShortcutKey()) || 'null');
    if (Array.isArray(raw)) {
      const ids = raw.filter((id, i) => mobileShortcutDef(id) && raw.indexOf(id) === i).slice(0, MOBILE_SHORTCUT_MAX);
      return ids;
    }
  } catch (e) { /* storage unavailable or corrupt: use the default */ }
  return MOBILE_SHORTCUT_DEFAULT.slice();
}

function mobileSaveShortcutIds(ids) {
  try { localStorage.setItem(mobileShortcutKey(), JSON.stringify(ids)); } catch (e) { showToast('這支手機無法儲存設定', 'warning'); }
}

function mobileRenderShortcuts() {
  const box = document.getElementById('m-quick');
  if (!box || !currentUser) return;
  box.textContent = '';
  mobileShortcutIds().forEach(id => {
    const def = mobileShortcutDef(id);
    const b = document.createElement('button');
    b.type = 'button';
    b.id = 'm-q-' + id;
    b.className = 'm-quick-btn' + (id === 'attendance' ? ' primary' : '');
    b.hidden = !def.allowed();
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.innerHTML = def.icon;
    b.appendChild(svg);
    b.appendChild(document.createTextNode(def.label));
    b.addEventListener('click', def.run);
    box.appendChild(b);
  });
  if (!box.children.length) box.appendChild(mobileEl('div', 'm-empty', '尚未選擇快速動作，按「編輯」新增'));
}

function mobileShortcutsEdit() {
  openModal('modal-shortcuts');
  mobileRenderShortcutEditor();
}

function mobileRenderShortcutEditor() {
  const list = document.getElementById('m-sc-list');
  if (!list) return;
  list.textContent = '';
  const selected = mobileShortcutIds().filter(id => mobileShortcutDef(id).allowed());
  const others = MOBILE_SHORTCUTS.filter(s => s.allowed() && !selected.includes(s.id)).map(s => s.id);
  [...selected, ...others].forEach(id => {
    const def = mobileShortcutDef(id);
    const on = selected.includes(id);
    const row = mobileEl('div', 'm-sc-row' + (on ? ' on' : ''));
    const label = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.checked = on; cb.setAttribute('data-sc', id);
    cb.addEventListener('change', () => mobileShortcutToggle(id, cb.checked));
    label.appendChild(cb);
    label.appendChild(document.createTextNode(' ' + def.label));
    row.appendChild(label);
    if (on) {
      const idx = selected.indexOf(id);
      const up = mobileEl('button', 'm-sc-move', '▲'); up.type = 'button'; up.setAttribute('aria-label', '上移'); up.disabled = idx === 0;
      up.addEventListener('click', () => mobileShortcutMove(id, -1));
      const down = mobileEl('button', 'm-sc-move', '▼'); down.type = 'button'; down.setAttribute('aria-label', '下移'); down.disabled = idx === selected.length - 1;
      down.addEventListener('click', () => mobileShortcutMove(id, 1));
      row.appendChild(up); row.appendChild(down);
    }
    list.appendChild(row);
  });
}

function mobileShortcutToggle(id, on) {
  const ids = mobileShortcutIds().filter(x => mobileShortcutDef(x).allowed());
  if (on) {
    if (ids.length >= MOBILE_SHORTCUT_MAX) { showToast('最多 ' + MOBILE_SHORTCUT_MAX + ' 個快速動作', 'warning'); mobileRenderShortcutEditor(); return; }
    if (!ids.includes(id)) ids.push(id);
  } else {
    const i = ids.indexOf(id);
    if (i >= 0) ids.splice(i, 1);
  }
  mobileSaveShortcutIds(ids);
  mobileRenderShortcutEditor();
  mobileRenderShortcuts();
}

function mobileShortcutMove(id, delta) {
  const ids = mobileShortcutIds().filter(x => mobileShortcutDef(x).allowed());
  const i = ids.indexOf(id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  mobileSaveShortcutIds(ids);
  mobileRenderShortcutEditor();
  mobileRenderShortcuts();
}

function mobileShortcutsReset() {
  try { localStorage.removeItem(mobileShortcutKey()); } catch (e) { /* ignore */ }
  mobileRenderShortcutEditor();
  mobileRenderShortcuts();
}

// ── 畫面資訊: numbers to send when the installed app looks wrong on a phone ──
function mobileScreenInfo() {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;top:0;left:0;width:1px;visibility:hidden;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);height:100lvh;';
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const lvh = probe.getBoundingClientRect().height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  probe.style.height = '100dvh';
  const dvh = probe.getBoundingClientRect().height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  const top = parseFloat(cs.paddingTop), bottom = parseFloat(cs.paddingBottom);
  probe.remove();
  const at = (x, y) => { const el = document.elementFromPoint(x, y); return el ? (el.id ? '#' + el.id : el.tagName.toLowerCase() + '.' + String(el.className || '').split(' ')[0]) : '—'; };
  const lines = [
    '版本 ' + ((document.querySelector('script[src*="mobile.js"]')?.getAttribute('src') || '').split('?v=')[1] || '?'),
    'standalone ' + window.matchMedia('(display-mode: standalone)').matches + (navigator.standalone ? '（iOS）' : ''),
    'safe 上 ' + top + ' 下 ' + bottom,
    'innerH ' + innerHeight + ' screenH ' + screen.height + ' lvh ' + Math.round(lvh) + ' dvh ' + Math.round(dvh),
    'nav 底 ' + Math.round(document.getElementById('m-nav')?.getBoundingClientRect().bottom || 0) + ' 狀態列條 ' + Math.round(document.querySelector('.m-statusbar')?.getBoundingClientRect().height || 0),
    '上緣元素 ' + at(5, 2) + ' / ' + at(innerWidth / 2, 2),
    '下緣元素 ' + at(innerWidth / 2, innerHeight - 2),
    navigator.userAgent.replace(/^.*?\(/, '(').slice(0, 80),
  ];
  window.alert(lines.join('\n'));
}

// ── 淨利潤: read-only phone summary from psComputeData() (same visibility rule as renderProfitShare) ──
function mobileOpenProfitShare() {
  if (!canAccess('profitshare')) { showToast('您沒有此功能的權限', 'error'); return; }
  mobileShowOwnPage('mprofitshare');
}

function mobileRenderProfitShare() {
  if (!canAccess('profitshare')) return;
  const data = psComputeData();
  const canSeeAll = ['OWNER', 'FINANCE'].includes(currentUser.roleCode);
  const money = v => (v < 0 ? '-$ ' : '$ ') + Math.abs(Math.round(Number(v) || 0)).toLocaleString('zh-TW');
  const sub = document.getElementById('m-ps-sub');
  if (sub) sub.textContent = '未結算 ' + (data.caseRows || []).length + ' 個案・' + (data.ohMonths || []).length + ' 個月公司開銷';
  const total = document.getElementById('m-ps-total');
  total.textContent = '';
  total.hidden = !canSeeAll;
  if (canSeeAll) {
    [['合計淨利', data.grandNet], ['已分配', data.allocatedProfit], ['公司保留', data.companyRetained], ['公司開銷', data.overheadTotal]].forEach(([label, v]) => {
      const row = mobileEl('div', 'm-row');
      row.appendChild(mobileEl('span', '', label));
      row.appendChild(mobileEl('span', 'm-ps-amt', money(v)));
      total.appendChild(row);
    });
  }
  const rows = canSeeAll ? data.rows : data.rows.filter(r => r.person === currentUser.id);
  document.getElementById('m-ps-people-title').textContent = canSeeAll ? '每人應得（淨額／未付）' : '我的分潤';
  const box = document.getElementById('m-ps-people');
  box.textContent = '';
  if (!rows.length) box.appendChild(mobileEl('div', 'm-empty', '目前沒有未結算的分潤'));
  rows.forEach(r => {
    const card = mobileEl('div', 'm-card');
    const top = mobileEl('div', 'm-card-top');
    top.appendChild(mobileEl('span', 'm-card-title', r.name || r.person));
    top.appendChild(mobileEl('span', 'm-card-amount', money(r.net)));
    card.appendChild(top);
    card.appendChild(mobileEl('div', 'm-card-detail', '已付分潤 ' + money(r.bonus) + '・薪資扣抵 ' + money(r.salary) + (r.adjustment ? '・結案後抵扣 ' + money(r.adjustment) : '')));
    card.appendChild(mobileEl('div', 'm-card-detail', '尚未支付 ' + money(r.unpaid)));
    box.appendChild(card);
  });
}

// ── Google sign-in inside the installed app ──
// The Google popup (Identity Services token client) cannot report back to an installed iOS web app: Google
// shows "400 malformed request" after sign-in. In the installed app OPS uses the same OAuth client with a
// full-page redirect instead and finishes the normal login steps when Google sends the person back.
// Needs the OPS page URL listed under "Authorized redirect URIs" of the OAuth client in Google Cloud.
const MOBILE_OAUTH_KEY = 'yutesign_ops_oauth_pending';

function mobileIsStandalone() {
  return !!(window.__forceStandalone || window.matchMedia('(display-mode: standalone)').matches || navigator.standalone);
}

function mobileOAuthRedirectUri() {
  return location.origin + location.pathname;
}

function mobileOAuthRedirect(purpose, scope) {
  const state = purpose + '.' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  try { localStorage.setItem(MOBILE_OAUTH_KEY, JSON.stringify({ state, purpose, at: Date.now() })); } catch (e) { showToast('這支手機無法暫存登入狀態，請改用 Safari 開啟', 'error'); return; }
  const params = new URLSearchParams({
    client_id: OPS_GOOGLE_CLIENT_ID,
    redirect_uri: mobileOAuthRedirectUri(),
    response_type: 'token',
    scope,
    include_granted_scopes: 'true',
    prompt: 'select_account',
    state,
  });
  location.assign('https://accounts.google.com/o/oauth2/v2/auth?' + params.toString());
}

async function mobileCompleteLogin(accessToken) {
  opsAuthSetLoading(true);
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: 'Bearer ' + accessToken } });
    const profile = await res.json();
    const email = String(profile.email || '').toLowerCase();
    const user = opsAuthUserByEmail(email);
    if (!user) {
      opsAuthSetLoading(false);
      opsAuthSetError(`此帳號尚未開通 OPS：${email || '未知帳號'}`);
      if (window.google?.accounts?.oauth2?.revoke) google.accounts.oauth2.revoke(accessToken);
      return;
    }
    await opsFirebaseSignIn(accessToken, email);
    localStorage.setItem(OPS_AUTH_SESSION_KEY, JSON.stringify({ email, loginTime: Date.now() }));
    opsAuthSetLoading(false);
    opsAuthSetError('');
    opsUnlockForUser(user, email, { render: false });
    await opsCloudStart();
    renderAfterDataSettles('login-cloud-ready');
    showToast(`已登入：${user.name}`, 'success');
  } catch (e) {
    console.warn('OPS redirect login failed:', e);
    opsAuthSetLoading(false);
    opsAuthSetError('登入驗證失敗，請確認網路與 Google 帳號狀態。');
  }
}

function mobileHandleOAuthReturn() {
  const hash = String(location.hash || '');
  if (!/[#&](access_token|error)=/.test(hash)) return;
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  let pending = null;
  try { pending = JSON.parse(localStorage.getItem(MOBILE_OAUTH_KEY) || 'null'); localStorage.removeItem(MOBILE_OAUTH_KEY); } catch (e) { pending = null; }
  history.replaceState(null, '', location.pathname + location.search);
  if (!pending || pending.state !== params.get('state') || Date.now() - pending.at > 10 * 60 * 1000) {
    if (typeof opsAuthSetError === 'function') opsAuthSetError('登入逾時或狀態不符，請再按一次登入。');
    return;
  }
  if (params.get('error') || !params.get('access_token')) {
    if (pending.purpose === 'login') opsAuthSetError('Google 授權失敗，請再試一次。');
    else setTimeout(() => showToast('雲端硬碟授權失敗或已取消', 'error'), 1500);
    return;
  }
  const token = params.get('access_token');
  if (pending.purpose === 'login') {
    mobileCompleteLogin(token);
  } else if (pending.purpose === 'drive') {
    receiptToken = token;
    receiptTokenAt = Date.now();
    setTimeout(() => showToast('雲端硬碟已連線，請再按一次拍照或選檔案', 'success'), 1500);
  }
}

(function mobileHookLogin() {
  const originalStart = window.opsStartGoogleLogin;
  window.opsStartGoogleLogin = function () {
    if (OPS_AUTH_ENFORCED && mobileIsStandalone()) {
      opsAuthSetError('');
      opsAuthSetLoading(true);
      mobileOAuthRedirect('login', 'https://www.googleapis.com/auth/userinfo.email');
      return;
    }
    return originalStart.apply(this, arguments);
  };
  const originalConnect = window.receiptConnect;
  window.receiptConnect = function () {
    if (mobileIsStandalone()) {
      showToast('即將前往 Google 授權雲端硬碟，完成後會回到 OPS');
      setTimeout(() => mobileOAuthRedirect('drive', RECEIPT_DRIVE_SCOPE), 600);
      return;
    }
    return originalConnect.apply(this, arguments);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(mobileHandleOAuthReturn, 0));
  else setTimeout(mobileHandleOAuthReturn, 0);
})();

// ── New version notice: compares the cache-busting stamp of this page with the one on the server ──
// (the existing check only compares the "Codex v1.3.37" label, which these deployments do not change).
// Runs 15 s after load, every 5 minutes, and whenever the app comes back to the foreground.
let mobileVersionNoticeShown = false;

function mobileCurrentStamp() {
  const src = document.querySelector('script[src*="js/modules/mobile.js"]')?.getAttribute('src') || '';
  return (src.match(/\?v=([0-9a-f]{8})/) || [])[1] || '';
}

async function mobileCheckNewVersion() {
  if (mobileVersionNoticeShown || !OPS_AUTH_ENFORCED) return false;
  const current = mobileCurrentStamp();
  if (!current) return false;
  try {
    const res = await fetch(location.pathname, { cache: 'no-store' });
    if (!res.ok) return false;
    const remote = ((await res.text()).match(/js\/modules\/mobile\.js\?v=([0-9a-f]{8})/) || [])[1] || '';
    if (remote && remote !== current) {
      mobileVersionNoticeShown = true;
      opsShowNewVersionBanner(remote);
      return true;
    }
  } catch (e) { /* offline: try again later */ }
  return false;
}

(function mobileVersionWatch() {
  setTimeout(mobileCheckNewVersion, 15000);
  setInterval(mobileCheckNewVersion, 5 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') mobileCheckNewVersion(); });
})();

// ── Rotating a tablet (or resizing a window) across 1023px: phone-only pages do not exist in the desktop
// layout, so leave them for the person's normal desktop page. ──
(function mobileWatchLayout() {
  const mq = window.matchMedia('(max-width: 1023px)');
  const onChange = () => {
    if (!currentUser?.id) return;
    if (!mq.matches && MOBILE_OWN_PAGES.includes(currentPage)) {
      const target = (typeof USER_DEFAULT_PAGE !== 'undefined' && USER_DEFAULT_PAGE[currentUser.id] && canAccess(USER_DEFAULT_PAGE[currentUser.id])) ? USER_DEFAULT_PAGE[currentUser.id] : firstAccessiblePage();
      document.body.classList.remove('m-own-header');
      navTo(target, navElForPage(target));
    } else {
      mobileSyncChrome(currentPage);
    }
  };
  if (mq.addEventListener) mq.addEventListener('change', onChange); else if (mq.addListener) mq.addListener(onChange);
})();
