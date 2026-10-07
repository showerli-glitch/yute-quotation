// MOBILE SHELL (PWA phase 1). New code, not extracted from the baseline.
// Adds a phone-width bottom tab bar and three phone-only pages (今天, 財務, 我的) on top of the
// existing pages. It only reads data and calls existing functions; it never writes data.
// Loaded last, after profitshare.js.

const MOBILE_OWN_PAGES = ['mhome', 'mfinance', 'mme'];
const MOBILE_FINANCE_PAGES = ['payable', 'receivable', 'profit', 'profitshare', 'overhead', 'tax'];
const MOBILE_TAB_OF_PAGE = {
  mhome: 'today', attendance: 'today',
  dashboard: 'cases', clients: 'cases', vendors: 'cases',
  mfinance: 'finance', payreq: 'finance', payable: 'finance', receivable: 'finance', expense: 'finance',
  profit: 'finance', profitshare: 'finance', overhead: 'finance', tax: 'finance',
  mme: 'me',
};

function mobileIsActive() {
  return window.matchMedia('(max-width: 767px)').matches;
}

function mobileHasFinanceTab() {
  if (!currentUser) return false;
  return MOBILE_FINANCE_PAGES.some(canAccess) || canManage('payreq') || canManage('expense');
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

function mobileQuickPayreq() {
  mobileOpen('payreq');
  if (canApplySelf('payreq') && typeof openPayreqModal === 'function') openPayreqModal();
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
    if (n > 0) tasks.push({ urgent: true, pill: '待審核', pillCls: 'warn', src: '廠商請款', title: n + ' 筆請款待處理', detail: '', page: 'payreq' });
  }
  const en = mobileExpensePendingCount();
  if (en > 0) tasks.push({ urgent: true, pill: '待審核', pillCls: 'warn', src: '費用申請', title: en + ' 筆費用待處理', detail: '', page: 'expense' });
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
  if (expBtn) expBtn.hidden = !canAccess('expense');
  const prBtn = document.getElementById('m-q-payreq');
  if (prBtn) prBtn.hidden = !canAccess('payreq');
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
    card.addEventListener('click', () => mobileOpen(t.page));
    box.appendChild(card);
  });
}

function mobileRenderFinance() {
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
  if (id === 'mhome') mobileRenderHome();
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
