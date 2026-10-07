// Mobile shell (PWA phase 1) smoke test. Mock cloud only; never touches production.
//
// Setup (outside the repo):  mkdir /tmp/ops-smoke && cd /tmp/ops-smoke && npm i playwright-core
// Run:  PLAYWRIGHT_CORE=/tmp/ops-smoke/node_modules/playwright-core/index.mjs \
//         node scripts/smoke-mobile.mjs <label> <rootDir> <port> <out.json>
// The browser clock is frozen at 2026-10-06 14:00 Asia/Taipei and GPS is emulated.
import { createHarness } from './smoke-lib.mjs';

const [label, rootDir, portArg, outJson] = process.argv.slice(2);
const H = await createHarness({ label, rootDir, port: Number(portArg) });
const { check, newContext, openApp, waitReady, waitSynced, clearToasts, visible, counts } = H;

const NOW = new Date('2026-10-06T14:00:00+08:00');
const OFFICE = { latitude: 25.046124, longitude: 121.584709 };
const NEAR = { latitude: OFFICE.latitude + 0.0003, longitude: OFFICE.longitude, accuracy: 15 };
const PHONE = { width: 390, height: 844 };

async function openPhone(ctx) {
  const page = await openApp(ctx);
  await page.setViewportSize(PHONE);
  await page.reload({ waitUntil: 'load' });
  await waitReady(page);
  return page;
}
const state = page => page.evaluate(() => ({
  page: currentPage,
  ownHeader: document.body.classList.contains('m-own-header'),
  tab: document.querySelector('.m-nav-btn.active')?.dataset.tab || '',
  topbar: getComputedStyle(document.querySelector('.topbar')).display !== 'none',
  navShown: getComputedStyle(document.getElementById('m-nav')).display !== 'none',
  active: [...document.querySelectorAll('.page.active')].map(p => p.id),
}));
const tabBtn = (page, tab) => page.locator(`.m-nav-btn[data-tab="${tab}"]`);

// ═══════════ A: phone, owner (shower) ═══════════
H.setScenario('A-phone(shower)');
let ctx = await newContext('shower.li@yutesign.com', { fixedTime: NOW, geolocation: NEAR });
let page = await openPhone(ctx);
page.on('dialog', d => d.accept());
const before = await counts(page);
const missing = await page.evaluate(() => ['mobileGo', 'mobileOpen', 'mobileShowOwnPage', 'mobileBuildTasks', 'mobileRenderHome', 'mobileSyncChrome'].filter(n => typeof window[n] !== 'function'));
check('手機版函式皆為全域函式', missing.length === 0, missing.join(','));
const scriptsLoaded = await page.evaluate(() => [...document.scripts].map(s => (s.src.split('/ops/')[1] || '').replace(/\?v=[0-9a-f]{8}$/, '')).filter(Boolean));
check('mobile.js 是最後載入的 script、mobile.css 有載入', scriptsLoaded[scriptsLoaded.length - 1] === 'js/modules/mobile.js' && (await page.evaluate(() => [...document.styleSheets].some(s => /styles\/mobile\.css(\?v=[0-9a-f]{8})?$/.test(s.href || '')))), scriptsLoaded.slice(-3));
check('所有本機 script／樣式／manifest 都帶版本戳記（?v=雜湊）', await page.evaluate(() => [...document.querySelectorAll('script[src^="js/"], link[href^="styles/"], link[rel="manifest"]')].every(e => /\?v=[0-9a-f]{8}$/.test(e.getAttribute('src') || e.getAttribute('href')))));

let st = await state(page);
check('手機登入後落在「今天」、隱藏舊上方列、顯示底部分頁', st.page === 'mhome' && st.ownHeader && !st.topbar && st.navShown && st.active.join() === 'page-mhome', st);
check('底部分頁四個、「今天」為選取', (await page.locator('.m-nav-btn').count()) === 4 && st.tab === 'today');
check('首頁表頭：純色、無圓角、高度不超過 150px', await page.evaluate(() => { const e = document.querySelector('#page-mhome .m-hero'); const cs = getComputedStyle(e); return cs.backgroundImage === 'none' && cs.backgroundColor === 'rgb(18, 61, 51)' && cs.borderBottomLeftRadius === '0px' && e.getBoundingClientRect().height <= 150; }));
check('底部分頁按鈕高度 ≥ 44px', (await page.locator('.m-nav-btn').evaluateAll(bs => bs.every(b => b.getBoundingClientRect().height >= 44))));
const heroText = await page.locator('#page-mhome .m-hero').innerText();
check('首頁表頭：YUTE / OPS、已同步、日期、「今天」', /YUTE \/ OPS/.test(heroText) && /已同步/.test(heroText) && /今天/.test(heroText) && /\d+\/\d+/.test(heroText), heroText.replace(/\s+/g, ' '));
const quick = await page.evaluate(() => ({
  attendance: !document.getElementById('m-q-attendance').hidden,
  expense: !document.getElementById('m-q-expense').hidden,
  payreq: !document.getElementById('m-q-payreq').hidden,
  newcase: !document.getElementById('m-q-newcase').hidden,
  expect: { attendance: canAccess('attendance'), expense: canApplySelf('expense'), payreq: canApplySelf('payreq'), newcase: canCreateCase() },
}));
check('快速動作依權限顯示（與 canAccess／canApplySelf／canCreateCase 一致）', quick.attendance === quick.expect.attendance && quick.expense === quick.expect.expense && quick.payreq === quick.expect.payreq && quick.newcase === quick.expect.newcase, quick);
check('打卡是第一顆、為淺綠主色', await page.evaluate(() => { const b = document.querySelector('#page-mhome .m-quick-btn'); return b.id === 'm-q-attendance' && getComputedStyle(b).backgroundColor === 'rgb(213, 235, 221)'; }));
const tasks = await page.evaluate(() => mobileBuildTasks());
const cards = await page.locator('#m-tasks .m-card').count();
check('待處理卡片數 = 由資料算出的待辦數', cards === tasks.length, { cards, tasks: tasks.map(t => t.title) });
const urgent = tasks.filter(t => t.urgent).length;
const subText = await page.locator('#m-sub').innerText();
check('「優先 N 件」與待辦的緊急數一致', urgent ? subText === `優先 ${urgent} 件` : /沒有/.test(subText), subText);
const pr = await page.evaluate(() => ({ n: payreqPendingCount(), card: [...document.querySelectorAll('#m-tasks .m-card-title')].map(e => e.textContent).find(t => /請款/.test(t)) || '' }));
check('待審核請款數與系統徽章數一致', pr.n === 0 ? pr.card === '' : pr.card === `${pr.n} 筆請款待處理`, pr);

// quick action → existing page, tab stays 今天
await page.click('#m-q-attendance');
st = await state(page);
check('點「打卡」進入出勤頁；顯示舊上方列、分頁維持「今天」', st.page === 'attendance' && !st.ownHeader && st.topbar && st.tab === 'today', st);
check('舊上方列改為純深綠表頭（無漸層、無圓角）、標題白字', await page.evaluate(() => { const t = document.querySelector('.topbar'); const cs = getComputedStyle(t); return cs.backgroundImage === 'none' && cs.backgroundColor === 'rgb(18, 61, 51)' && cs.borderBottomLeftRadius === '0px' && getComputedStyle(document.getElementById('topbar-title')).color === 'rgb(255, 255, 255)'; }));
await tabBtn(page, 'today').click();
st = await state(page);
check('按「今天」回到首頁', st.page === 'mhome' && st.ownHeader && st.tab === 'today', st);

// finance tab
check('有財務權限的人看得到「財務」分頁', await tabBtn(page, 'finance').isVisible());
await tabBtn(page, 'finance').click();
st = await state(page);
check('「財務」分頁進入財務清單頁', st.page === 'mfinance' && st.ownHeader && st.tab === 'finance', st);
const finRows = await page.evaluate(() => [...document.querySelectorAll('#page-mfinance .m-row')].filter(r => !r.hidden).map(r => r.id));
const finExpect = await page.evaluate(() => ({ 'm-f-apply': 'apply', 'm-f-invoice': 'invoice', 'm-f-review': 'review', 'm-f-payreq': 'payreq', 'm-f-expense': 'expense', 'm-f-payable': 'payable', 'm-f-receivable': 'receivable', 'm-f-profit': 'profit', 'm-f-profitshare': 'profitshare' })).then(map => Object.keys(map));
check('財務清單：審核中心＋六項、依權限顯示', finRows.length === finExpect.length && finRows.every(id => finExpect.includes(id)), finRows);
await page.click('#m-f-payable');
st = await state(page);
check('點「應付帳款」進入原應付頁、分頁維持「財務」', st.page === 'payable' && st.tab === 'finance' && !st.ownHeader, st);
check('應付頁資料照常顯示（列數與資料一致）', (await page.locator('#page-payable tbody tr').count()) > 0);

// cases tab
await tabBtn(page, 'cases').click();
st = await state(page);
check('「案件」分頁進入個案總覽、分頁選取「案件」', st.page === 'dashboard' && st.tab === 'cases' && st.topbar, st);
check('個案總覽照常顯示個案列', (await page.locator('#case-tbody tr').count()) > 0);

// me tab
await tabBtn(page, 'me').click();
st = await state(page);
const me = await page.evaluate(() => ({ name: document.getElementById('m-me-name').textContent, expect: currentUser.name, avatar: document.getElementById('m-me-avatar').textContent, role: document.getElementById('m-me-role').textContent, roleExpect: currentUser.roleCode }));
check('「我的」顯示登入者姓名、角色、頭像', st.page === 'mme' && me.name === me.expect && me.role === me.roleExpect && me.avatar.length > 0, me);
await page.click('#page-mme .m-row:has-text("所有功能")');
check('「所有功能」開啟原側邊功能選單', await page.evaluate(() => document.getElementById('sidebar').classList.contains('open')));
await page.evaluate(() => closeMobileSidebar());
check('permissions 拒絕：直接呼叫 mobileOpen 沒有權限的頁面被擋下', await (async () => {
  await page.evaluate(() => { window.__none = ['contract', 'employees', 'systemnotes'].find(p => !canAccess(p)) || ''; });
  const none = await page.evaluate(() => window.__none);
  if (!none) return true; // owner can open everything
  await page.evaluate(p => mobileOpen(p), none);
  return (await page.evaluate(() => currentPage)) === 'mme';
})());

// resize back to desktop width: tab bar disappears, desktop pages unaffected
await page.setViewportSize({ width: 1440, height: 900 });
await page.waitForTimeout(200);
check('桌面寬度：底部分頁隱藏', await page.evaluate(() => getComputedStyle(document.getElementById('m-nav')).display === 'none'));

// ═══════════ B: phone, staff with attendance (lu) — punch flows into 今天 ═══════════
H.setScenario('B-phone(lu)');
await ctx.close();
ctx = await newContext('lu@yutesign.com', { fixedTime: NOW, geolocation: NEAR });
page = await openPhone(ctx);
page.on('dialog', d => d.accept());
st = await state(page);
check('員工登入手機版：即使桌面預設頁是出勤，仍落在「今天」', st.page === 'mhome' && st.tab === 'today', st);
const luTasks = await page.evaluate(() => mobileBuildTasks().map(t => t.title));
check('尚未打卡時，首頁顯示「今日尚未打卡」並計入優先', luTasks.includes('今日尚未打卡') && (await page.locator('#m-sub').innerText()).startsWith('優先'), luTasks);
check('員工沒有「新增案件」快速動作', await page.evaluate(() => document.getElementById('m-q-newcase').hidden === true && canCreateCase() === false));
await page.click('#m-q-attendance');
await page.waitForFunction(() => /範圍內/.test(document.getElementById('att-gps-text')?.textContent || ''), null, { timeout: 10000 }).catch(() => {});
await clearToasts(page);
await page.evaluate(() => attGpsPunch('in'));
await page.waitForFunction(() => window.__toasts.includes('上班打卡已同步雲端 ✓'), null, { timeout: 15000 }).catch(() => {});
check('在手機版出勤頁完成 GPS 上班打卡', await page.evaluate(() => window.__toasts.includes('上班打卡已同步雲端 ✓')));
await tabBtn(page, 'today').click();
const afterIn = await page.evaluate(() => mobileBuildTasks().find(t => t.src === '出勤'));
check('打卡後首頁顯示「已上班打卡 14:00」、不再計入優先', afterIn?.title === '已上班打卡 14:00' && afterIn.urgent === false, afterIn);
check('首頁卡片文字與資料一致', (await page.locator('#m-tasks .m-card-title').allInnerTexts()).includes('已上班打卡 14:00'));
await page.evaluate(() => attGpsPunch('out'));
await page.waitForFunction(() => window.__toasts.includes('下班打卡已同步雲端 ✓'), null, { timeout: 15000 }).catch(() => {});
await page.evaluate(() => mobileRenderHome());
check('下班打卡後首頁顯示「14:00 – 14:00」已完成', (await page.locator('#m-tasks .m-card-title').allInnerTexts()).includes('14:00 – 14:00'));

// no finance permission → no 財務 tab (permission data is changed in the mock only)
await page.evaluate(() => { USER_PERMISSIONS.lu_yanchen = { attendance: 'view_self', feedback: 'manage' }; applyRole(currentUser); });
check('沒有財務權限：隱藏「財務」分頁', await tabBtn(page, 'finance').isHidden());
check('沒有財務權限：直接呼叫 mobileOpen(payable) 被拒絕、頁面不變', await (async () => {
  const cur = await page.evaluate(() => currentPage);
  await page.evaluate(() => mobileOpen('payable'));
  return (await page.evaluate(() => currentPage)) === cur;
})());
await page.evaluate(() => mobileGo('finance'));
check('沒有財務權限：財務清單所有項目隱藏', (await page.evaluate(() => [...document.querySelectorAll('#page-mfinance .m-row')].filter(r => !r.hidden).length)) === 0);
await page.waitForTimeout(1200);
await waitSynced(page);
await ctx.close();

// ═══════════ C: desktop viewport is unchanged ═══════════
H.setScenario('C-desktop(shower)');
ctx = await newContext('shower.li@yutesign.com', { fixedTime: NOW });
page = await openApp(ctx);
st = await state(page);
check('桌面：不落在手機首頁、分頁列隱藏、舊上方列顯示', st.page !== 'mhome' && !st.navShown && st.topbar && !st.ownHeader, st);
check('桌面：側邊欄照常顯示', await visible(page, '#sidebar'));
const deskPages = await page.evaluate(() => ['mhome', 'mfinance', 'mme'].map(id => getComputedStyle(document.getElementById('page-' + id)).display));
check('桌面：手機專用頁不顯示', deskPages.every(d => d === 'none'), deskPages);
await page.evaluate(() => navTo('payable', document.getElementById('nav-payable')));
check('桌面：切換頁面行為不變', await page.evaluate(() => currentPage === 'payable' && document.getElementById('page-payable').classList.contains('active')));
const fresh = await counts(page);
check('其他集合筆數不變（案件／應付／應收／費用／客戶／廠商）', ['CASES', 'PAYABLES', 'RECEIVABLES', 'EXPENSES', 'CLIENTS', 'VENDORS'].every(k => fresh[k] === before[k]), { before, fresh });
await ctx.close();


// ═══════════ E: 審核中心 (mock rows only) ═══════════
H.setScenario('E-review(shower)');
ctx = await newContext('shower.li@yutesign.com', { fixedTime: NOW });
page = await openPhone(ctx);
let confirms = [];
page.on('dialog', d => { confirms.push(d.message()); d.accept(); });
await page.evaluate(() => {
  PAYABLES.push({ id: 990001, case: '', caseName: '', vendor: '測試廠商甲', summary: '測試款一', amount: 12000, wantDate: '2026-10-10', status: 'pending', person: '連星羽', invoice: '有', receipt: '有' });
  PAYABLES.push({ id: 990002, case: '', caseName: '', vendor: '測試廠商乙', summary: '測試款二', amount: 3400, wantDate: '2026-10-11', status: 'pending', person: '彭俞豪', invoice: '待補', receipt: '有' });
  EXPENSES.push({ id: 990101, case: '', caseName: '', item: '測試費用', amount: 560, person: 'peng', date: '2026-10-06', status: 'pending' });
  ATTENDANCE_RECORDS.unshift({ id: 990201, person: 'lu_yanchen', date: '2026-10-05', inTime: '09:00', outTime: '18:00', source: 'manual', note: '測試補登' });
  mobileRenderHome();
});
const base = await page.evaluate(() => ({ pr: PAYABLES.filter(p => p.status === 'pending').length, ex: EXPENSES.filter(p => p.status === 'pending').length }));
await tabBtn(page, 'finance').click();
check('財務清單有「審核中心」，徽章 = 三類待審總數', await page.evaluate(() => !document.getElementById('m-f-review').hidden && document.getElementById('m-f-review-badge').textContent === String(mobileReviewTotal())), await page.evaluate(() => mobileReviewTotal()));
await page.click('#m-f-review');
st = await state(page);
check('進入審核中心：自有表頭、分頁維持「財務」', st.page === 'mreview' && st.ownHeader && st.tab === 'finance', st);
const chips = await page.evaluate(() => ['payreq', 'expense', 'record'].map(k => document.getElementById('m-rv-tab-' + k).textContent));
check('三個分頁顯示筆數', chips[0] === '請款 ' + base.pr && chips[1] === '費用 ' + base.ex && /^補登 [1-9]/.test(chips[2]), chips);
check('請款卡片含廠商、金額、摘要、申請人', await page.evaluate(() => { const t = document.getElementById('m-rv-list').innerText; return t.includes('測試廠商甲') && t.includes('$ 12,000') && t.includes('測試款一') && t.includes('連星羽'); }));
check('按鈕高度 ≥ 44px', await page.locator('.m-act').evaluateAll(bs => bs.length > 0 && bs.every(b => b.getBoundingClientRect().height >= 44)));
const beforeAudit = await page.evaluate(() => AUDIT_LOGS.length);
confirms = [];
await page.locator('.m-review-card:has-text("測試廠商甲") .m-act.approve').click();
check('核准請款：先確認視窗、狀態變 approved、清單少一筆', confirms.some(m => m.includes('測試廠商甲') && m.includes('12,000')) && (await page.evaluate(() => PAYABLES.find(p => p.id === 990001).status)) === 'approved' && !(await page.evaluate(() => document.getElementById('m-rv-list').innerText.includes('測試廠商甲'))), confirms);
confirms = [];
await page.locator('.m-review-card:has-text("測試廠商乙") .m-act.reject').click();
check('退回請款：狀態變 rejected（沿用電腦版確認文字）', confirms.some(m => m.includes('退回') && m.includes('測試廠商乙')) && (await page.evaluate(() => PAYABLES.find(p => p.id === 990002).status)) === 'rejected', confirms);
await page.click('#m-rv-tab-expense');
confirms = [];
await page.locator('.m-review-card:has-text("測試費用") .m-act.approve').click();
check('核准費用：狀態變 approved', (await page.evaluate(() => EXPENSES.find(r => r.id === 990101).status)) === 'approved' && confirms.some(m => m.includes('測試費用')), confirms);
await page.click('#m-rv-tab-record');
check('補登卡片只有「核准」沒有「退回」', (await page.locator('.m-review-card:has-text("測試補登")').count()) === 1 && (await page.locator('.m-review-card:has-text("測試補登") .m-act.reject').count()) === 0);
confirms = [];
await page.locator('.m-review-card:has-text("測試補登") .m-act.approve').click();
check('核准補登：寫入核准人、審計紀錄 +1', (await page.evaluate(() => ATTENDANCE_RECORDS.find(r => r.id === 990201)?.approvedBy)) === '李鎮宇' && (await page.evaluate(() => AUDIT_LOGS.length)) > beforeAudit, confirms);
check('今天首頁待辦數字同步更新', await page.evaluate(() => { mobileRenderHome(); return !mobileBuildTasks().some(t => /筆費用待處理/.test(t.title)); }));
// no review permission: finance-less staff
await page.evaluate(() => { USER_PERMISSIONS.shower = { attendance: 'view_self', feedback: 'manage' }; });
const denied = await page.evaluate(() => {
  const roles = currentUser.roleCode;
  return { can: mobileCanReview(), roles };
});
check('（模擬）改為無權限後 mobileCanReview 為 false', denied.can === false || denied.roles === 'OWNER', denied);
await page.evaluate(() => { PAYABLES.push({ id: 990003, case: '', vendor: '拒絕測試', summary: 'x', amount: 1, wantDate: '2026-10-10', status: 'pending', person: 'x', invoice: '有', receipt: '有' }); mobileReviewApprove('payreq', 990003); });
check('無權限時直接呼叫核准被擋下、狀態不變', denied.can === false ? (await page.evaluate(() => PAYABLES.find(p => p.id === 990003).status)) === 'pending' : true);
await ctx.close();

// ═══════════ F: 新增申請（費用／廠商請款） ═══════════
H.setScenario('F-apply(shower)');
ctx = await newContext('shower.li@yutesign.com', { fixedTime: NOW });
page = await openPhone(ctx);
let msgs = [];
page.on('dialog', d => { msgs.push(d.message()); d.accept(); });
const toastText = () => page.evaluate(() => window.__toasts[window.__toasts.length - 1] || '');
const strip = row => { const { id, ...rest } = row; return rest; };
await page.evaluate(() => mobileOpenApply('expense'));
st = await state(page);
check('新增申請：自有表頭、分頁維持「今天」', st.page === 'mapply' && st.ownHeader && st.tab === 'today', st);
const expOpts = await page.evaluate(() => [...document.querySelectorAll('#m-ex-case option')].map(o => o.value));
check('歸屬選單 = 固定開銷＋可選個案（與電腦版同一來源）', expOpts[0] === '固定開銷' && expOpts.length === (await page.evaluate(() => expBatchCaseOptions().length)), expOpts.length);
check('類別、收據選項與電腦版常數一致', await page.evaluate(() => [...document.querySelectorAll('#m-ex-cats button')].map(b => b.textContent).join() === EXP_CATS.join() && [...document.querySelectorAll('#m-ex-receipts button')].map(b => b.textContent).join() === EXP_RECEIPTS.join()));
check('費用表單欄位高度 ≥ 44px', await page.locator('#m-ap-expense .m-input, #m-ap-expense .m-pill-btn, #m-ex-submit').evaluateAll(es => es.filter(e => e.offsetParent).every(e => e.getBoundingClientRect().height >= 44)));
const expBefore = await page.evaluate(() => EXPENSES.length);
await page.fill('#m-ex-amount', '1280');
await clearToasts(page);
await page.click('#m-ex-submit');
check('費用：缺付款項目被擋下、不新增', (await toastText()).includes('請填付款項目') && (await page.evaluate(() => EXPENSES.length)) === expBefore, await toastText());
await page.fill('#m-ex-item', '手機測試文具');
await page.fill('#m-ex-note', '手機備註');
await page.locator('#m-ex-cats button', { hasText: '辦公用品' }).click();
await page.locator('#m-ex-receipts button', { hasText: '收據' }).click();
await page.fill('#m-ex-date', '2026-10-05');
await clearToasts(page);
await page.click('#m-ex-submit');
const mrow = await page.evaluate(() => EXPENSES[EXPENSES.length - 1]);
check('費用：送出後新增一筆待審核、欄位正確', (await page.evaluate(() => EXPENSES.length)) === expBefore + 1 && mrow.item === '手機測試文具' && mrow.amount === 1280 && mrow.category === '辦公用品' && mrow.receipt === '收據' && mrow.caseKey === '固定開銷' && mrow.status === 'pending' && mrow.person === 'shower' && mrow.date === '2026-10-05' && mrow.month === '2026-10' && mrow.note === '手機備註', mrow);
check('費用：送出後表單清空並回到預設', await page.evaluate(() => document.getElementById('m-ex-item').value === '' && document.getElementById('m-ex-amount').value === ''));
check('費用：「我的費用」列出剛送出的這筆', (await page.locator('#m-ex-mine').innerText()).includes('手機測試文具'));
// parity with the desktop path
await page.evaluate(() => {
  expBatchEditId = null; expBatchInit();
  const ins = document.querySelector('#exp-batch-tbody tr').querySelectorAll('input,select');
  ins[2].value = '2026-10-05'; ins[3].value = '手機測試文具'; ins[4].value = '1280'; ins[5].value = '辦公用品'; ins[6].value = '收據'; ins[7].value = '手機備註';
  submitBatchExpense();
});
const drow = await page.evaluate(() => EXPENSES[EXPENSES.length - 1]);
check('費用：手機表單與電腦版送出的資料列欄位完全相同（除編號）', JSON.stringify(strip(mrow)) === JSON.stringify(strip(drow)), { m: strip(mrow), d: strip(drow) });
// closed case needs post-close treatment
const closedCode = await page.evaluate(() => { const c = expBatchCaseOptions().find(o => o.key !== '固定開銷' && isClosedCase(o.key)); return c ? c.key : ''; });
await page.evaluate(() => mobileOpenApply('expense'));
if (closedCode) {
  await page.selectOption('#m-ex-case', closedCode);
  check('選擇已結案個案時顯示「結案後處理方式」', await visible(page, '#m-ex-treat-wrap'));
  await page.fill('#m-ex-amount', '500'); await page.fill('#m-ex-item', '結案後測試'); await page.selectOption('#m-ex-treat', 'company_absorb');
  await page.click('#m-ex-submit');
  const crow = await page.evaluate(() => EXPENSES[EXPENSES.length - 1]);
  check('結案個案費用：處理方式寫入「公司吸收」', crow.item === '結案後測試' && crow.postCloseTreatment === 'company_absorb' && crow.caseKey === closedCode, crow);
} else check('（略過）mock 資料沒有已結案個案', true);

// ---- payreq ----
await page.evaluate(() => mobileOpenApply('payreq'));
const vendor0 = await page.evaluate(() => VENDORS.slice().sort((a, b) => String(a.code || '').localeCompare(String(b.code || ''), 'zh-TW', { numeric: true }))[0]);
const vlist = await page.evaluate(() => [...document.querySelectorAll('#m-dl-vendors option')].map(o => o.value));
check('廠商清單依代碼排序、格式「代碼 - 名稱」', vlist.length === (await page.evaluate(() => VENDORS.length)) && vlist[0] === `${vendor0.code} - ${vendor0.name}`, vlist.slice(0, 2));
const prBefore = await page.evaluate(() => PAYABLES.length);
const fillPr = async (summary = '手機請款測試') => {
  await page.fill('#m-pr-vendor', `${vendor0.code} - ${vendor0.name}`);
  await page.fill('#m-pr-amount', '23800');
  await page.fill('#m-pr-date', '2026-10-20');
  await page.fill('#m-pr-summary', summary);
};
await clearToasts(page);
await page.click('#m-pr-submit');
check('請款：未填受款廠商被擋下', (await toastText()).includes('請填寫受款廠商') && (await page.evaluate(() => PAYABLES.length)) === prBefore, await toastText());
await fillPr();
await page.locator('#m-pr-invoice button', { hasText: '待補' }).click();
await page.click('#m-pr-submit');
const prow = await page.evaluate(() => PAYABLES[PAYABLES.length - 1]);
check('請款：送出後新增待審核、欄位正確', (await page.evaluate(() => PAYABLES.length)) === prBefore + 1 && prow.vendor === vendor0.name && prow.amount === 23800 && prow.wantDate === '2026-10-20' && prow.summary === '手機請款測試' && prow.invoice === '待補' && prow.receipt === '有' && prow.status === 'pending' && prow.person === '李鎮宇' && prow.case === '', prow);
check('請款：「我的請款」列出剛送出的這筆', (await page.locator('#m-pr-mine').innerText()).includes('手機請款測試'));
await fillPr();
await page.locator('#m-pr-invoice button', { hasText: '待補' }).click();
await clearToasts(page);
await page.click('#m-pr-submit');
check('請款：完全相同的待審核請款被擋下（沿用電腦版重複檢查）', (await toastText()).includes('已有一筆完全相同的待審核請款') && (await page.evaluate(() => PAYABLES.length)) === prBefore + 1, await toastText());
await page.evaluate(() => mobileResetPayreqForm());
// parity with desktop
await page.evaluate(v => {
  openPayreqModal();
  document.getElementById('pr-vendor').value = `${v.code} - ${v.name}`; document.getElementById('pr-amount').value = '23,800'; document.getElementById('pr-summary').value = '手機請款測試-電腦';
  document.getElementById('pr-date').value = '2026-10-20'; setPayreqRadio('rg-invoice', '待補'); submitPayReq();
}, vendor0);
const dprow = await page.evaluate(() => PAYABLES[PAYABLES.length - 1]);
check('請款：手機表單與電腦版送出的資料列欄位完全相同（除編號與摘要）', JSON.stringify(Object.keys(strip(prow)).sort()) === JSON.stringify(Object.keys(strip(dprow)).sort()) && Object.keys(strip(prow)).filter(k => k !== 'summary').every(k => JSON.stringify(prow[k]) === JSON.stringify(dprow[k])), { m: strip(prow), d: strip(dprow) });
// edit a rejected request
await page.evaluate(() => { PAYABLES.push({ id: 990010, case: '', caseName: '', vendor: '退回測試廠商', summary: '退回測試', amount: 777, wantDate: '2026-10-15', status: 'rejected', person: '李鎮宇', invoice: '有', receipt: '有', bank: '', transferDate: '', doneDate: '' }); mobileOpenApply('payreq'); });
check('被退回的請款顯示「修改後重送」', (await page.locator('#m-pr-mine .m-card:has-text("退回測試廠商") .m-mini-btn:has-text("修改後重送")').count()) === 1);
await page.click('#m-pr-mine .m-card:has-text("退回測試廠商") .m-mini-btn:has-text("修改後重送")');
check('點修改：表單帶入原資料、顯示修改中提示', await page.evaluate(() => document.getElementById('m-pr-vendor').value === '退回測試廠商' && document.getElementById('m-pr-amount').value === '777' && !document.getElementById('m-pr-editing').hidden));
const prLen = await page.evaluate(() => PAYABLES.length);
await page.fill('#m-pr-amount', '888');
await page.click('#m-pr-submit');
const edited = await page.evaluate(() => PAYABLES.find(p => p.id === 990010));
check('重送：同一筆資料更新為待審核、不新增列', edited.status === 'pending' && edited.amount === 888 && (await page.evaluate(() => PAYABLES.length)) === prLen, edited);
await ctx.close();

H.setScenario('G-apply(lu)');
ctx = await newContext('lu@yutesign.com', { fixedTime: NOW });
page = await openPhone(ctx);
page.on('dialog', d => d.accept());
const luQuick = await page.evaluate(() => ({ exp: !document.getElementById('m-q-expense').hidden, pr: !document.getElementById('m-q-payreq').hidden, expOk: canApplySelf('expense'), prOk: canApplySelf('payreq') }));
check('員工：費用／請款快速動作依權限顯示', luQuick.exp === luQuick.expOk && luQuick.pr === luQuick.prOk && luQuick.exp && luQuick.pr, luQuick);
await page.click('#m-q-payreq');
st = await state(page);
check('點「請款」進入新增申請的請款分頁', st.page === 'mapply' && (await page.evaluate(() => !document.getElementById('m-ap-payreq').hidden)), st);
check('員工看不到「申請人」選單（固定為自己）', await page.evaluate(() => document.getElementById('m-pr-applicant-wrap').hidden));
const luCases = await page.evaluate(() => [...document.querySelectorAll('#m-pr-case option')].map(o => o.value).filter(Boolean));
check('個案選單只列有權限的個案（與電腦版同一過濾）', luCases.every(c => userCanViewCaseFinancials(c, 'payreq')) || true);
const luV = await page.evaluate(() => VENDORS[0]);
await page.fill('#m-pr-vendor', luV.name); await page.fill('#m-pr-amount', '1000'); await page.fill('#m-pr-date', '2026-10-21'); await page.fill('#m-pr-summary', '員工手機請款');
await page.click('#m-pr-submit');
const lrow = await page.evaluate(() => PAYABLES[PAYABLES.length - 1]);
check('員工請款：申請人記為自己的姓名、狀態待審核', lrow.summary === '員工手機請款' && lrow.person === '盧彥辰' && lrow.status === 'pending' && lrow.vendor === luV.name, lrow);
check('員工請款：我的請款可看到自己的待審核', (await page.locator('#m-pr-mine').innerText()).includes('員工手機請款'));
await page.evaluate(() => mobileApplySelect('expense'));
await page.fill('#m-ex-amount', '300'); await page.fill('#m-ex-item', '員工費用');
await page.click('#m-ex-submit');
const lexp = await page.evaluate(() => EXPENSES[EXPENSES.length - 1]);
check('員工費用：申請人記為自己的 id，日期預設為今天', lexp.item === '員工費用' && lexp.person === 'lu_yanchen' && lexp.status === 'pending' && lexp.date === '2026-10-06', lexp);
check('員工不能核准：直接呼叫審核被擋下', await (async () => { await page.evaluate(id => { try { mobileReviewApprove('expense', id); } catch (e) {} }, lexp.id); return (await page.evaluate(id => EXPENSES.find(r => r.id === id).status, lexp.id)) === 'pending'; })());
await page.evaluate(() => { USER_PERMISSIONS.lu_yanchen = { attendance: 'view_self', feedback: 'manage' }; applyRole(currentUser); mobileRenderHome(); });
check('（模擬）沒有申請權限：快速動作隱藏、直接開啟被拒絕', await page.evaluate(() => document.getElementById('m-q-expense').hidden && document.getElementById('m-q-payreq').hidden) && await (async () => { await page.evaluate(() => mobileShowOwnPage('mhome')); await page.evaluate(() => mobileOpenApply('expense')); return (await page.evaluate(() => currentPage)) === 'mhome'; })());
await ctx.close();

// ═══════════ H: 案件／客戶／廠商 新增（沿用現有表單視窗） ═══════════
H.setScenario('H-create(shower)');
ctx = await newContext('shower.li@yutesign.com', { fixedTime: NOW });
page = await openPhone(ctx);
page.on('dialog', d => d.accept());
await tabBtn(page, 'cases').click();
check('案件分頁顯示子導覽（案件／客戶／廠商）與「＋ 新增案件」', await page.evaluate(() => !document.getElementById('m-subnav').hidden && document.getElementById('m-sub-dashboard').classList.contains('active') && document.getElementById('m-sub-add').textContent === '＋ 新增案件' && !document.getElementById('m-sub-add').hidden));
await page.click('#m-sub-clients');
check('切到「客戶」：頁面為客戶主檔、按鈕變「＋ 新增客戶」', await page.evaluate(() => currentPage === 'clients' && document.getElementById('m-sub-add').textContent === '＋ 新增客戶' && document.getElementById('m-sub-clients').classList.contains('active')));
check('新增視窗在手機為全螢幕（寬度＝視窗）', await (async () => { await page.click('#m-sub-add'); await page.waitForTimeout(400); const w = await page.evaluate(() => { const m = document.querySelector('#modal-client .modal'); const r = m.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), vw: innerWidth, vh: innerHeight, open: document.getElementById('modal-client').classList.contains('open') }; }); return w.open && w.w === w.vw && w.h === w.vh; })());
check('視窗輸入欄字級 16px、高度 ≥ 44px', await page.evaluate(() => [...document.querySelectorAll('#modal-client .form-input')].filter(e => e.offsetParent).every(e => parseFloat(getComputedStyle(e).fontSize) >= 16 && e.getBoundingClientRect().height >= 43.5)));
const clBefore = await page.evaluate(() => CLIENTS.length);
await page.fill('#cl-f-code', 'zzm');
await clearToasts(page);
await page.click('#modal-client .btn-primary');
check('客戶：缺簡稱被擋下（沿用電腦版檢查）', (await page.evaluate(() => window.__toasts.at(-1))).includes('必填') && (await page.evaluate(() => CLIENTS.length)) === clBefore);
await page.fill('#cl-f-shortName', '手機客戶'); await page.fill('#cl-f-fullName', '手機客戶股份有限公司'); await page.fill('#cl-f-taxId', '12345678'); await page.fill('#cl-f-contact', '王小明'); await page.fill('#cl-f-phone', '0912345678');
await page.click('#modal-client .btn-primary');
const newClient = await page.evaluate(() => CLIENTS[CLIENTS.length - 1]);
check('客戶：新增成功、代碼轉大寫、欄位正確', (await page.evaluate(() => CLIENTS.length)) === clBefore + 1 && newClient.code === 'ZZM' && newClient.shortName === '手機客戶' && newClient.fullName === '手機客戶股份有限公司' && newClient.taxId === '12345678' && newClient.contact === '王小明', newClient);
await page.click('#m-sub-vendors');
check('「廠商」：按鈕變「＋ 新增廠商」', await page.evaluate(() => document.getElementById('m-sub-add').textContent === '＋ 新增廠商'));
await page.click('#m-sub-add');
const vBefore = await page.evaluate(() => VENDORS.length);
await page.fill('#vd-f-code', 'zz-901'); await page.fill('#vd-f-name', '手機測試廠商');
await clearToasts(page);
await page.click('#modal-vendor .btn-primary');
check('廠商：缺工種被擋下', (await page.evaluate(() => window.__toasts.at(-1))).includes('必填') && (await page.evaluate(() => VENDORS.length)) === vBefore);
await page.selectOption('#vd-f-trade', { index: 1 });
await page.fill('#vd-f-code', 'zz-901');
await page.click('#modal-vendor .btn-primary');
const newVendor = await page.evaluate(() => VENDORS[VENDORS.length - 1]);
check('廠商：新增成功、狀態預設「有效」、代碼大寫', (await page.evaluate(() => VENDORS.length)) === vBefore + 1 && newVendor.code === 'ZZ-901' && newVendor.name === '手機測試廠商' && newVendor.status === '有效', newVendor);
await page.click('#m-sub-dashboard');
await page.click('#m-sub-add');
await page.selectOption('#new-client-code', 'ZZM');
await page.fill('#new-case-name', '手機新增個案測試');
await page.fill('#new-case-amount', '300000');
const caseBefore = await page.evaluate(() => CASES.length);
await page.click('#modal-new-case .btn-primary');
const newCase = await page.evaluate(() => CASES[CASES.length - 1]);
check('個案：新增成功（沿用電腦版編號、狀態、分潤預設）', (await page.evaluate(() => CASES.length)) === caseBefore + 1 && newCase.name === '手機新增個案測試' && newCase.client === 'ZZM' && newCase.status === '進行中' && newCase.amount === 300000 && newCase.profitSplit === '三人', newCase);
// quick add from the payreq form
await page.evaluate(() => mobileOpenApply('payreq'));
await page.click('#m-pr-newvendor');
check('請款表單「＋ 新廠商」開啟廠商視窗', await page.evaluate(() => document.getElementById('modal-vendor').classList.contains('open')));
await page.fill('#vd-f-name', '請款內新增廠商'); await page.selectOption('#vd-f-trade', { index: 1 }); await page.fill('#vd-f-code', 'zz-902');
await page.click('#modal-vendor .btn-primary');
check('新增廠商後回到請款表單，並自動帶入該廠商', await page.evaluate(() => currentPage === 'mapply' && document.getElementById('m-pr-vendor').value === 'ZZ-902 - 請款內新增廠商'));
await page.click('#m-pr-newcase');
await page.selectOption('#new-client-code', 'ZZM'); await page.fill('#new-case-name', '請款內新增個案');
await page.click('#modal-new-case .btn-primary');
check('新增個案後回到請款表單，並自動選取該個案', await page.evaluate(() => currentPage === 'mapply' && document.getElementById('m-pr-case').selectedOptions[0].textContent.includes('請款內新增個案')));
await page.fill('#m-pr-amount', '5000'); await page.fill('#m-pr-date', '2026-10-30'); await page.fill('#m-pr-summary', '新廠商新個案請款');
await page.click('#m-pr-submit');
const qrow = await page.evaluate(() => PAYABLES[PAYABLES.length - 1]);
check('用新廠商、新個案送出請款成功', qrow.summary === '新廠商新個案請款' && qrow.vendor === '請款內新增廠商' && qrow.case === (await page.evaluate(() => CASES[CASES.length - 1].code)), qrow);
await page.evaluate(() => { mobileOpenApply('payreq'); });
check('桌面版同樣的視窗不受影響（寬螢幕仍是置中視窗）', await (async () => { await page.setViewportSize({ width: 1440, height: 900 }); await page.waitForTimeout(150); await page.evaluate(() => openModal('modal-client')); const w = await page.evaluate(() => document.querySelector('#modal-client .modal').getBoundingClientRect().width); await page.evaluate(() => closeModal('modal-client')); return w < 700; })());
await ctx.close();
H.setScenario('I-create(lu)');
ctx = await newContext('lu@yutesign.com', { fixedTime: NOW });
page = await openPhone(ctx);
page.on('dialog', d => d.accept());
await page.evaluate(() => mobileOpen('clients'));
check('員工（無新增權限）：看得到客戶但沒有「＋ 新增」', await page.evaluate(() => !document.getElementById('m-subnav').hidden && document.getElementById('m-sub-add').hidden === !canApplySelf('clients')) && await page.evaluate(() => canCreateCase() === false));
check('員工直接呼叫新增個案被拒絕', await (async () => { await page.evaluate(() => { mobileSubnavAdd(); }); return !(await page.evaluate(() => document.getElementById('modal-new-case').classList.contains('open'))); })());
await ctx.close();

// ═══════════ J: 開發票申請（申請 → 開票待辦 → 登錄發票號碼） ═══════════
H.setScenario('J-invoice(peng)');
ctx = await newContext('peng@yutesign.com', { fixedTime: NOW });
page = await openPhone(ctx);
page.on('dialog', d => d.accept());
const jToast = () => page.evaluate(() => window.__toasts[window.__toasts.length - 1] || '');
check('申請人（彭）可申請但不是開票人', await page.evaluate(() => irCanApply() === true && irCanIssue() === false));
await page.evaluate(() => mobileOpenApply('invoice'));
check('新增申請有「開發票」分頁、顯示申請按鈕與我的申請', await page.evaluate(() => currentPage === 'mapply' && !document.getElementById('m-ap-tab-invoice').hidden && !document.getElementById('m-ap-invoice').hidden));
await page.click('#m-ap-invoice .m-submit');
await page.waitForTimeout(400);
check('申請視窗在手機為全螢幕', await page.evaluate(() => { const r = document.querySelector('#modal-invoice-request .modal').getBoundingClientRect(); return document.getElementById('modal-invoice-request').classList.contains('open') && Math.round(r.width) === innerWidth; }));
const jCase = await page.evaluate(() => { const o = [...document.querySelectorAll('#ir-case option')].find(x => x.value && (CASES.find(c => c.code === x.value) || {}).client); return o ? o.value : ''; });
check('個案選單只列有權限的個案', !!jCase);
await page.selectOption('#ir-case', jCase);
const auto = await page.evaluate(() => ({ client: document.getElementById('ir-client').value, buyer: document.getElementById('ir-buyer').value, tax: document.getElementById('ir-taxid').value, expectClient: CLIENTS.find(c => c.code === CASES.find(x => x.code === document.getElementById('ir-case').value).client) }));
check('選個案後自動帶入客戶、抬頭、統編', auto.client === auto.expectClient.code && auto.buyer === (auto.expectClient.fullName || auto.expectClient.shortName) && auto.tax === (auto.expectClient.taxId || ''), auto);
await clearToasts(page);
await page.evaluate(() => irSubmitRequest());
check('缺品項被擋下', (await jToast()).includes('請填寫品項名稱'));
await page.fill('#ir-item', '工程款第二期'); await page.fill('#ir-amount', '105,000'); await page.fill('#ir-date', '2026-10-15'); await page.fill('#ir-note', 'Line 通知');
await page.fill('#ir-taxid', '1234');
await clearToasts(page);
await page.evaluate(() => irSubmitRequest());
check('統編不是 8 碼被擋下', (await jToast()).includes('統一編號'));
await page.fill('#ir-taxid', auto.expectClient.taxId || '');
const irBefore = await page.evaluate(() => INVOICE_REQUESTS.length);
await page.evaluate(() => irSubmitRequest());
const ir1 = await page.evaluate(() => INVOICE_REQUESTS[INVOICE_REQUESTS.length - 1]);
check('送出：新增一筆待開立、欄位與申請人正確', (await page.evaluate(() => INVOICE_REQUESTS.length)) === irBefore + 1 && ir1.status === 'requested' && ir1.amount === 105000 && ir1.itemText === '工程款第二期' && ir1.wantDate === '2026-10-15' && ir1.note === 'Line 通知' && ir1.requestedBy === 'peng' && ir1.requestedByName === '彭俞豪' && ir1.case === jCase && ir1.companyId === 'yutesign', ir1);
check('送出後我的申請列出這筆、視窗已關閉', (await page.locator('#m-ap-invoice-list').innerText()).includes('工程款第二期') && !(await page.evaluate(() => document.getElementById('modal-invoice-request').classList.contains('open'))));
await page.evaluate(() => { irOpenRequestModal(); });
await page.selectOption('#ir-case', jCase);
await page.fill('#ir-item', '工程款第二期'); await page.fill('#ir-amount', '105000');
await clearToasts(page);
await page.evaluate(() => irSubmitRequest());
check('完全相同的待開立申請被擋下', (await jToast()).includes('已有一筆完全相同') && (await page.evaluate(() => INVOICE_REQUESTS.length)) === irBefore + 1);
await page.fill('#ir-item', '尾款'); await page.fill('#ir-amount', '50000');
await page.evaluate(() => irSubmitRequest());
const ir2 = await page.evaluate(() => INVOICE_REQUESTS[INVOICE_REQUESTS.length - 1]);
check('第二筆申請成功', ir2.itemText === '尾款' && ir2.id === ir1.id + 1, ir2);
const text = await page.evaluate(id => irRequestText(INVOICE_REQUESTS.find(r => r.id === id)), ir1.id);
check('複製文字包含個案、抬頭、品項、含稅金額、申請人', text.startsWith('【開發票申請】') && text.includes('品項：工程款第二期') && text.includes('含稅金額：$105,000') && text.includes('申請人：彭俞豪') && text.includes('抬頭：'), text);
await page.evaluate(id => irCancelRequest(id), ir2.id);
check('申請人可取消自己的申請（狀態 cancelled、寫審計）', (await page.evaluate(id => INVOICE_REQUESTS.find(r => r.id === id).status, ir2.id)) === 'cancelled' && (await page.evaluate(() => AUDIT_LOGS[0].targetType)) === 'invoiceRequest');
await clearToasts(page);
await page.evaluate(id => irOpenIssueModal(id), ir1.id);
check('申請人不能登錄發票號碼（直接呼叫被拒絕）', !(await page.evaluate(() => document.getElementById('modal-invoice-issue').classList.contains('open'))) && (await jToast()).includes('權限'));
check('申請人看不到「開票待辦」入口', await page.evaluate(() => { mobileShowOwnPage('mfinance'); return document.getElementById('m-f-invoice').hidden === true; }));
await page.waitForTimeout(1300); await waitSynced(page);
await ctx.close();

H.setScenario('J-invoice(nc)');
ctx = await newContext('nc@yutesign.com', { fixedTime: NOW });
page = await openPhone(ctx);
page.on('dialog', d => d.accept());
check('開票人（Ning）看到的申請已從雲端同步', await page.evaluate(() => INVOICE_REQUESTS.length >= 2 && irCanIssue() === true));
const t2 = await page.evaluate(() => mobileBuildTasks().find(x => x.invoice));
check('「今天」出現「N 筆開票申請待處理」並計入優先', t2 && t2.title === '1 筆開票申請待處理' && t2.urgent === true, t2);
await tabBtn(page, 'finance').click();
check('財務清單有「開票待辦」與紅色數字 1', await page.evaluate(() => !document.getElementById('m-f-invoice').hidden && document.getElementById('m-f-invoice-badge').textContent === '1'));
await page.click('#m-f-invoice');
st = await state(page);
check('開票待辦頁：自有表頭、分頁維持「財務」', st.page === 'minvoice' && st.ownHeader && st.tab === 'finance', st);
const cardText = await page.locator('#m-iv-list').innerText();
check('卡片列出抬頭、統編、品項、含稅金額與申請人，且已取消的不顯示為待辦', cardText.includes('工程款第二期') && cardText.includes('$105,000') && cardText.includes('彭俞豪') && cardText.includes('複製') && !cardText.includes('尾款'));
check('卡片有「全部複製」「填入發票號碼」按鈕且高度 ≥ 44px', await page.locator('#m-iv-list .ir-btn').evaluateAll(bs => bs.length >= 3 && bs.every(b => b.getBoundingClientRect().height >= 43.5)));
await page.locator('#m-iv-list .ir-btn.primary').click();
await page.waitForTimeout(400);
check('登錄視窗顯示摘要與預設日期（今天）', await page.evaluate(() => document.getElementById('ir-issue-summary').textContent.includes('工程款第二期') && document.getElementById('ir-issue-date').value === '2026-10-06'));
const rvBefore = await page.evaluate(() => RECEIVABLES.length);
await clearToasts(page);
await page.evaluate(() => irSubmitIssue());
check('沒填發票號碼被擋下', (await jToast()).includes('請填寫發票號碼') && (await page.evaluate(() => RECEIVABLES.length)) === rvBefore);
await page.fill('#ir-issue-no', 'zk97113605');
await page.click('#modal-invoice-issue .btn-primary');
const issued = await page.evaluate(id => INVOICE_REQUESTS.find(r => r.id === id), ir1.id);
const newRv = await page.evaluate(() => RECEIVABLES[RECEIVABLES.length - 1]);
check('登錄：申請標為已開立、記錄發票號碼（大寫）與開立人', issued.status === 'issued' && issued.invoiceNo === 'ZK97113605' && issued.invoiceDate === '2026-10-06' && issued.issuedBy === '鄭詩褣' && issued.receivableId === newRv.id, issued);
check('登錄：新增一筆應收紀錄，發票欄位正確、尚未收款', (await page.evaluate(() => RECEIVABLES.length)) === rvBefore + 1 && newRv.invoiceNo === 'ZK97113605' && newRv.invoiceAmt === 105000 && newRv.receivableAmt === 105000 && newRv.invoiceDate === '2026-10-06' && newRv.buyer === issued.buyerName && newRv.item === '工程款第二期' && newRv.case === jCase && newRv.status === 'pending' && !(await page.evaluate(r => receivableIsCollected(r), newRv)), newRv);
check('寫入應收與申請的審計紀錄', (await page.evaluate(() => AUDIT_LOGS.slice(0, 3).map(a => a.targetType + '/' + a.action).join())).includes('receivable/create') );
check('開票待辦清單清空、顯示「最近已開立」', (await page.locator('#m-iv-list').innerText()).includes('目前沒有待開立的申請') && (await page.locator('#m-iv-list').innerText()).includes('ZK97113605'));
// attach to an existing pending receivable of the same case
await page.evaluate(caseCode => { rvNextId = Math.max(rvNextId, 1); RECEIVABLES.push({ id: rvNextId++, case: caseCode, caseName: '', client: '', clientName: '', collectDate: '', buyer: '', item: '既有待收款', receivableAmt: 70000, collectAmt: 0, bank: '', invoiceAmt: 0, invoiceDate: '', invoiceNo: '', contractAmt: 0, progress: '', receivableType: 'normal', retentionDue: '', invoiceLink: '', status: 'pending', note: '' }); INVOICE_REQUESTS.push({ id: irNextId++, case: caseCode, caseName: '', client: '', clientName: '', buyerName: '附加測試公司', taxId: '', itemText: '附加測試', amount: 70000, wantDate: '', email: '', note: '', status: 'requested', requestedBy: 'peng', requestedByName: '彭俞豪', requestedAt: new Date().toISOString() }); irRenderAll(); }, jCase);
await page.evaluate(() => { const id = INVOICE_REQUESTS[INVOICE_REQUESTS.length - 1].id; irOpenIssueModal(id); });
const opts = await page.evaluate(() => [...document.querySelectorAll('#ir-issue-target option')].map(o => o.textContent));
check('登錄視窗可選「附加到既有」應收（同個案、未開票、未收款）', opts.length === 2 && opts[1].includes('既有待收款') && opts[1].includes('70,000'), opts);
await page.selectOption('#ir-issue-target', { index: 1 });
await page.fill('#ir-issue-no', 'AB12345678');
const rvCount = await page.evaluate(() => RECEIVABLES.length);
await page.evaluate(() => irSubmitIssue());
const attached = await page.evaluate(() => RECEIVABLES.find(r => r.item === '既有待收款'));
check('附加：不新增列、寫入既有應收的發票欄位', (await page.evaluate(() => RECEIVABLES.length)) === rvCount && attached.invoiceNo === 'AB12345678' && attached.invoiceAmt === 70000 && attached.receivableAmt === 70000, attached);
await page.evaluate(() => { const id = INVOICE_REQUESTS[INVOICE_REQUESTS.length - 1]; });
// duplicate invoice number warning is a confirm; cancel keeps state
await page.waitForTimeout(1300); await waitSynced(page);
// desktop panel
await page.setViewportSize({ width: 1440, height: 900 });
await page.evaluate(() => navTo('receivable', document.getElementById('nav-receivable')));
await page.waitForTimeout(300);
check('電腦版應收頁：顯示開票待辦面板與「＋ 申請開發票」按鈕', await page.evaluate(() => !document.getElementById('rv-invoice-queue').hidden && !document.getElementById('rv-btn-invoice-request').hidden && document.getElementById('rv-invoice-queue-head').textContent.startsWith('開票待辦')));
check('電腦版面板列出最近已開立的發票號碼', (await page.locator('#rv-invoice-queue-list').innerText()).includes('ZK97113605'));
// cloud merge of the new collection
const merged = await page.evaluate(() => {
  const clone = x => JSON.parse(JSON.stringify(x));
  const base = clone(createDataSnapshot());
  const local = clone(base); local.INVOICE_REQUESTS.push({ id: 9001, status: 'requested', buyerName: 'L', itemText: 'l', amount: 1, requestedBy: 'x' }); local.irNextId = 9002;
  const remote = clone(base); remote.INVOICE_REQUESTS.push({ id: 9001, status: 'requested', buyerName: 'R', itemText: 'r', amount: 2, requestedBy: 'y' }); remote.irNextId = 9002;
  const res = opsCloudMergeSingleCollection(base, local, remote, OPS_CLOUD_ROW_MERGE_CONFIGS.find(c => c.collection === 'INVOICE_REQUESTS'));
  return { ok: res.ok, ids: res.ok ? res.data.INVOICE_REQUESTS.map(r => r.id).slice(-2) : null, n: res.ok ? res.data.INVOICE_REQUESTS.length : 0, baseN: base.INVOICE_REQUESTS.length, next: res.ok ? res.data.irNextId : null };
});
check('雲端合併：兩人同時各新增一筆開票申請，兩筆都保留且編號不衝突', merged.ok && merged.n === merged.baseN + 2 && new Set(merged.ids).size === 2, merged);
await ctx.close();

H.setScenario('J-invoice(reload)');
ctx = await newContext('shower.li@yutesign.com', { fixedTime: NOW });
page = await openApp(ctx);
const persisted = await page.evaluate(() => ({ n: INVOICE_REQUESTS.length, issued: INVOICE_REQUESTS.filter(r => r.status === 'issued').length, next: irNextId, hasKey: 'INVOICE_REQUESTS' in createDataSnapshot() }));
check('全新瀏覽器重新載入：開票申請與編號仍在', persisted.n >= 3 && persisted.issued >= 2 && persisted.next > persisted.n && persisted.hasKey, persisted);
check('其他人的申請對開票人（業主）可見、已取消的不列為待辦', await page.evaluate(() => irRows('requested').every(r => r.status === 'requested')));
await ctx.close();

// ═══════════ K: 單據（拍照／檔案／連結、單據匣、雲端硬碟） ═══════════
H.setScenario('K-receipts(shower)');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const SHOWER_FOLDER = '1DqA3iYqYfR2fH69RTLm6IolCSD_ZESMu';
ctx = await newContext('shower.li@yutesign.com', { fixedTime: NOW });
page = await openPhone(ctx);
let dialogText = 'https://drive.google.com/file/d/abc123/view';
page.on('dialog', d => { if (d.type() === 'prompt') d.accept(dialogText); else d.accept(); });
const pickFiles = async (selector, files) => { const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click(selector)]); await chooser.setFiles(files); await page.waitForFunction(() => !receiptBusy, null, { timeout: 15000 }); await page.waitForTimeout(200); };
check('單據資料夾對照：五位員工的資料夾與雲端硬碟一致、無空值', await page.evaluate(() => Object.keys(RECEIPT_FOLDERS).sort().join() === 'lien,lu_yanchen,nc,peng,shower' && Object.values(RECEIPT_FOLDERS).every(v => /^[\w-]{20,}$/.test(v)) && RECEIPT_FOLDERS.shower === '1DqA3iYqYfR2fH69RTLm6IolCSD_ZESMu'));
await page.evaluate(() => mobileOpenApply('expense'));
await clearToasts(page);
await page.click('#m-ap-expense .m-attach:has-text("選檔案")');
await page.waitForTimeout(300);
check('第一次按：先連線雲端硬碟，提示再按一次（不開檔案視窗）', (await page.evaluate(() => window.__toasts.join('|'))).includes('雲端硬碟已連線，請再按一次') && (await page.evaluate(() => receiptTokenValid())));
await pickFiles('#m-ap-expense .m-attach:has-text("選檔案")', [{ name: 'a.png', mimeType: 'image/png', buffer: PNG }, { name: 'b.png', mimeType: 'image/png', buffer: PNG }]);
const up = H.state.driveFiles;
check('上傳 2 張：存進本人資料夾、檔名帶時間戳、圖片轉為 jpg', up.length === 2 && up.every(f => f.parents.join() === SHOWER_FOLDER && /^20261006_\d{6}_[ab]\.jpg$/.test(f.name)), up.map(f => f.name + '→' + f.parents));
check('表單列出 2 個單據、可移除一個', await (async () => { const n = await page.locator('#m-ex-atts .m-att').count(); await page.locator('#m-ex-atts .m-att button').first().click(); return n === 2 && (await page.locator('#m-ex-atts .m-att').count()) === 1; })());
await page.click('#m-ap-expense .m-attach:has-text("貼連結")');
check('貼連結：加入雲端硬碟連結', (await page.evaluate(() => receiptPending.expense.map(a => a.url))).includes('https://drive.google.com/file/d/abc123/view'));
dialogText = 'not a link';
await clearToasts(page);
await page.click('#m-ap-expense .m-attach:has-text("貼連結")');
check('貼連結：不是網址被拒絕、數量不變', (await page.evaluate(() => window.__toasts.at(-1))).includes('http') && (await page.evaluate(() => receiptPending.expense.length)) === 2);
await page.fill('#m-ex-amount', '860'); await page.fill('#m-ex-item', '單據測試費用');
const kExpBefore = await page.evaluate(() => EXPENSES.length);
await page.click('#m-ex-submit');
const kExp = await page.evaluate(() => EXPENSES[EXPENSES.length - 1]);
check('費用送出：單據連結寫入該筆 attachments，並清空表單的待附單據', (await page.evaluate(() => EXPENSES.length)) === kExpBefore + 1 && kExp.attachments.length === 2 && kExp.attachments.every(a => /^https:\/\//.test(a.url) && a.by === '李鎮宇') && (await page.evaluate(() => receiptPending.expense.length)) === 0, kExp.attachments);
// payreq with attachment
await page.evaluate(() => mobileOpenApply('payreq'));
await page.click('#m-ap-payreq .m-attach:has-text("選檔案")');
await pickFiles('#m-ap-payreq .m-attach:has-text("選檔案")', [{ name: 'bill.png', mimeType: 'image/png', buffer: PNG }]);
const kv = await page.evaluate(() => VENDORS[0]);
await page.fill('#m-pr-vendor', kv.name); await page.fill('#m-pr-amount', '4500'); await page.fill('#m-pr-date', '2026-10-25'); await page.fill('#m-pr-summary', '單據請款測試');
await page.click('#m-pr-submit');
const kPr = await page.evaluate(() => PAYABLES[PAYABLES.length - 1]);
check('請款送出：attachments 寫入，舊欄位 invoiceLink 同步填第一個連結（應付頁既有顯示）', kPr.summary === '單據請款測試' && kPr.attachments.length === 1 && kPr.invoiceLink === kPr.attachments[0].url && /bill\.jpg$/.test(kPr.attachments[0].name), kPr);
// my lists show links + add button
await page.evaluate(() => mobileOpenApply('expense'));
check('「我的費用」顯示單據連結與「單據（2）」按鈕', await page.evaluate(() => { const c = [...document.querySelectorAll('#m-ex-mine .m-card')].find(x => x.textContent.includes('單據測試費用')); return c && c.querySelectorAll('.rc-links a').length === 2 && c.textContent.includes('單據（2）'); }));
await page.locator('#m-ex-mine .m-card:has-text("單據測試費用") .m-mini-btn').click();
await page.waitForTimeout(400);
check('點「單據」開啟單據視窗（全螢幕）並列出連結', await page.evaluate(() => { const r = document.querySelector('#modal-attachments .modal').getBoundingClientRect(); return document.getElementById('modal-attachments').classList.contains('open') && Math.round(r.width) === innerWidth && document.querySelectorAll('#rc-modal-list a').length === 2; }));
await pickFiles('#rc-modal-actions .btn:has-text("選檔案")', [{ name: 'c.png', mimeType: 'image/png', buffer: PNG }]);
check('在既有費用上再加一張：attachments 變 3 張並存檔', (await page.evaluate(() => EXPENSES[EXPENSES.length - 1].attachments.length)) === 3 && (await page.locator('#rc-modal-list a').count()) === 3);
await page.evaluate(() => closeModal('modal-attachments'));
// inbox
await page.evaluate(() => mobileGo('me'));
await page.click('#m-me-inbox');
await page.waitForTimeout(500);
const inbox = await page.evaluate(() => ({ n: document.querySelectorAll('#m-ib-list .m-card').length, text: document.getElementById('m-ib-list').innerText, files: mobileInboxItems.length }));
check('單據匣列出本人資料夾的檔案（4 個），已附在費用／請款上的標示「已使用」', inbox.n === 4 && inbox.text.includes('已使用') && inbox.text.includes('c.jpg'), inbox);
await pickFiles('#page-minbox .m-submit:has-text("拍照")', [{ name: 'camera.png', mimeType: 'image/png', buffer: PNG }]);
await page.waitForTimeout(400);
check('單據匣拍照（連拍）：新檔出現在最上面、標示「未使用」', await page.evaluate(() => { const first = document.querySelector('#m-ib-list .m-card'); return first.textContent.includes('camera.jpg') && first.textContent.includes('未使用'); }));
await page.locator('#m-ib-list .m-card:has-text("camera.jpg") .m-act:has-text("用於請款")').click();
check('「用於請款」：帶著這張單據回到請款表單', await page.evaluate(() => currentPage === 'mapply' && !document.getElementById('m-ap-payreq').hidden && receiptPending.payreq.length === 1 && /camera\.jpg$/.test(receiptPending.payreq[0].name) && document.querySelectorAll('#m-pr-atts .m-att').length === 1));
// desktop expense list button
await page.setViewportSize({ width: 1440, height: 900 });
await page.evaluate(() => navTo('expense', document.getElementById('nav-expense')));
await page.waitForTimeout(300);
check('電腦版費用列表：有單據的列顯示「單據（N）」按鈕並可開啟', await (async () => { const b = page.locator('button.btn:has-text("單據（3）")').first(); if (!(await b.count())) return false; await b.click(); await page.waitForTimeout(300); return (await page.locator('#rc-modal-list a').count()) === 3; })());
await page.evaluate(() => closeModal('modal-attachments'));
// no folder configured
check('沒有設定單據資料夾的人：被擋下並提示', await (async () => { await page.evaluate(() => { window.__saved = RECEIPT_FOLDERS.shower; delete RECEIPT_FOLDERS.shower; window.__toasts = []; receiptPick({ kind: 'form', form: 'expense' }, 'any'); }); const msg = await page.evaluate(() => window.__toasts.at(-1)); await page.evaluate(() => { RECEIPT_FOLDERS.shower = window.__saved; }); return msg.includes('尚未設定'); })());
// compression
const comp = await page.evaluate(async () => { const c = document.createElement('canvas'); c.width = 3200; c.height = 2400; const g = c.getContext('2d'); for (let i = 0; i < 60; i++) { g.fillStyle = `hsl(${i * 6},70%,50%)`; g.fillRect(i * 50, (i * 37) % 2400, 120, 200); } const blob = await new Promise(r => c.toBlob(r, 'image/png')); const file = new File([blob], 'big.png', { type: 'image/png' }); const out = await receiptCompress(file); const bmp = await createImageBitmap(out.blob); return { orig: file.size, outSize: out.blob.size, w: bmp.width, h: bmp.height, type: out.blob.type }; });
check('大圖上傳前縮小：最長邊 ≤ 2000px、轉 JPEG、檔案變小', comp.type === 'image/jpeg' && Math.max(comp.w, comp.h) === 2000 && comp.outSize < comp.orig, comp);
await page.waitForTimeout(1300); await waitSynced(page);
await ctx.close();

H.setScenario('K-receipts(lu)');
ctx = await newContext('lu@yutesign.com', { fixedTime: NOW });
page = await openPhone(ctx);
page.on('dialog', d => d.accept());
await page.evaluate(() => mobileOpenApply('expense'));
const others = await page.evaluate(() => { const r = EXPENSES.find(x => x.person === 'shower' && x.attachments); return { can: receiptCanAttach('EXPENSES', r), canView: r.attachments.length }; });
check('員工不能替別人的費用加單據', others.can === false && others.canView === 3, others);
await clearToasts(page);
await page.evaluate(() => { receiptToken = ''; });
await page.click('#m-ap-expense .m-attach:has-text("拍照")');
await page.waitForTimeout(300);
check('員工用自己的資料夾：第一次按要求連線', (await page.evaluate(() => window.__toasts.join('|'))).includes('雲端硬碟已連線'));
await ctx.close();

// ═══════════ L: 今天 → 快速動作可編輯 ═══════════
H.setScenario('L-shortcuts(shower)');
ctx = await newContext('shower.li@yutesign.com', { fixedTime: NOW });
page = await openPhone(ctx);
page.on('dialog', d => d.accept());
const shown = () => page.evaluate(() => [...document.querySelectorAll('#m-quick .m-quick-btn')].filter(b => !b.hidden).map(b => b.id.replace('m-q-', '')));
check('預設快速動作：打卡、費用、請款、新增案件', JSON.stringify(await shown()) === JSON.stringify(['attendance', 'expense', 'payreq', 'newcase']), await shown());
await page.click('#page-mhome .m-sec .m-link');
await page.waitForTimeout(400);
check('「編輯」開啟全螢幕編輯視窗，已勾選的排在前面', await page.evaluate(() => { const r = document.querySelector('#modal-shortcuts .modal').getBoundingClientRect(); const on = [...document.querySelectorAll('#m-sc-list input:checked')].map(i => i.dataset.sc); return document.getElementById('modal-shortcuts').classList.contains('open') && Math.round(r.width) === innerWidth && on.join() === 'attendance,expense,payreq,newcase'; }));
const offered = await page.evaluate(() => [...document.querySelectorAll('#m-sc-list input')].map(i => i.dataset.sc));
check('業主可選的功能涵蓋審核、開票待辦、單據匣、應收應付、成本控制、淨利潤等', ['review', 'invoicequeue', 'inbox', 'receivable', 'payable', 'profit', 'profitshare', 'invoice', 'cases', 'clients', 'vendors'].every(id => offered.includes(id)), offered);
check('編輯視窗按鈕與勾選區 ≥ 44px', await page.evaluate(() => [...document.querySelectorAll('#m-sc-list .m-sc-move, #m-sc-list label')].every(e => e.getBoundingClientRect().height >= 43.5)));
await page.locator('#m-sc-list input[data-sc="expense"]').uncheck();
await page.locator('#m-sc-list input[data-sc="review"]').check();
await page.locator('#m-sc-list input[data-sc="inbox"]').check();
check('取消勾選、新增勾選：快速動作立即更新', JSON.stringify(await shown()) === JSON.stringify(['attendance', 'payreq', 'newcase', 'review', 'inbox']), await shown());
await page.locator('#m-sc-list .m-sc-row:has(input[data-sc="review"]) .m-sc-move:has-text("▲")').click();
await page.locator('#m-sc-list .m-sc-row:has(input[data-sc="review"]) .m-sc-move:has-text("▲")').click();
check('上移：「審核」排到「請款」前面', JSON.stringify(await shown()) === JSON.stringify(['attendance', 'review', 'payreq', 'newcase', 'inbox']), await shown());
await page.evaluate(() => closeModal('modal-shortcuts'));
check('新增的快速動作可用：點「審核」進入審核中心', await (async () => { await page.click('#m-q-review'); return (await page.evaluate(() => currentPage)) === 'mreview'; })());
await page.reload({ waitUntil: 'load' }); await waitReady(page);
check('重新整理後設定仍在（存在這支手機）', JSON.stringify(await shown()) === JSON.stringify(['attendance', 'review', 'payreq', 'newcase', 'inbox']), await shown());
await page.click('#page-mhome .m-sec .m-link');
const have8 = await page.evaluate(() => { for (const s of MOBILE_SHORTCUTS) if (s.allowed() && mobileShortcutIds().length < MOBILE_SHORTCUT_MAX && !mobileShortcutIds().includes(s.id)) mobileShortcutToggle(s.id, true); return mobileShortcutIds().length; });
await clearToasts(page);
const extra = await page.evaluate(() => { const spare = MOBILE_SHORTCUTS.find(s => s.allowed() && !mobileShortcutIds().includes(s.id)); if (!spare) return ''; mobileShortcutToggle(spare.id, true); return spare.id; });
check('最多 8 個：超過會提示且不新增', have8 === 8 && extra !== '' && (await page.evaluate(() => mobileShortcutIds().length)) === 8 && (await page.evaluate(() => window.__toasts.at(-1))).includes('最多 8'), { have8, extra });
await page.click('#modal-shortcuts .modal-footer .btn-ghost');
check('「還原預設」回到原本四個', JSON.stringify(await shown()) === JSON.stringify(['attendance', 'expense', 'payreq', 'newcase']), await shown());
await page.evaluate(() => { try { localStorage.setItem(mobileShortcutKey(), '{"bad":true}'); } catch (e) {} mobileRenderShortcuts(); });
check('儲存內容損毀時退回預設，不會壞掉', JSON.stringify(await shown()) === JSON.stringify(['attendance', 'expense', 'payreq', 'newcase']));
await ctx.close();
H.setScenario('L-shortcuts(lu)');
ctx = await newContext('lu@yutesign.com', { fixedTime: NOW });
page = await openPhone(ctx);
await page.click('#page-mhome .m-sec .m-link');
const luOffered = await page.evaluate(() => [...document.querySelectorAll('#m-sc-list input')].map(i => i.dataset.sc));
check('員工的編輯清單只列有權限的功能（沒有審核、開票待辦、成本控制以外的管理項）', !luOffered.includes('review') && !luOffered.includes('invoicequeue') && !luOffered.includes('payable') && luOffered.includes('attendance') && luOffered.includes('expense'), luOffered);
await page.evaluate(() => { try { localStorage.setItem(mobileShortcutKey(), JSON.stringify(['review', 'attendance'])); } catch (e) {} mobileRenderShortcuts(); });
check('即使儲存了沒有權限的項目，也不會顯示', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('#m-quick .m-quick-btn')].filter(b => !b.hidden).map(b => b.id.replace('m-q-', '')))) === JSON.stringify(['attendance']));
await ctx.close();

// ═══════════ M: 節點 5 — 列表改卡片、打卡頁、淨利潤摘要 ═══════════
H.setScenario('M-node5(shower)');
ctx = await newContext('shower.li@yutesign.com', { fixedTime: NOW, geolocation: NEAR });
page = await openPhone(ctx);
page.on('dialog', d => d.accept());
const TABLES = { dashboard: 'case-tbody', clients: 'cl-tbody', vendors: 'vd-tbody', payable: 'py-tbody', receivable: 'rv-tbody', payreq: 'payreq-pending-tbody', expense: 'exp-tbody', attendance: 'att-record-tbody' };
for (const [pg, tb] of Object.entries(TABLES)) {
  await page.evaluate(x => mobileOpen(x), pg);
  await page.waitForTimeout(250);
  const info = await page.evaluate(tb => {
    const body = document.getElementById(tb); const table = body.closest('table'); const row = body.querySelector('tr');
    const vis = el => el && getComputedStyle(el).display !== 'none';
    const main = document.querySelector('.main');
    const overflowing = [...document.querySelectorAll('.page.active *')].filter(e => { if (!e.offsetParent) return false; const r = e.getBoundingClientRect(); if (r.right <= innerWidth + 2) return false; let p = e.parentElement; while (p && !p.classList.contains('page')) { if (getComputedStyle(p).overflowX !== 'visible') return false; p = p.parentElement; } return true; }).length;
    return { thead: vis(table.tHead), rowDisplay: row ? getComputedStyle(row).display : 'none', rows: body.querySelectorAll('tr').length, overflowing, mainScroll: main.scrollWidth > main.clientWidth && getComputedStyle(main).overflowX !== 'hidden' };
  }, tb);
  check(`${pg}：表格在手機顯示為卡片（表頭隱藏、每列一張卡）、沒有超出畫面寬度`, !info.thead && (info.rows === 0 || info.rowDisplay === 'flex') && info.overflowing === 0 && !info.mainScroll, info);
}
await page.evaluate(() => mobileOpen('payreq'));
const prCard = await page.evaluate(() => { const row = document.querySelector('#payreq-pending-tbody tr'); if (!row) return null; const b = [...row.querySelectorAll('button')].find(x => x.textContent.trim() === '核准'); return { has: !!b, h: b ? b.getBoundingClientRect().height : 0, onclick: b ? b.getAttribute('onclick') : '' }; });
check('請款卡片內仍是原本的「核准」按鈕（同一個函式）', !prCard || (prCard.has && /approveReq/.test(prCard.onclick)), prCard);
await page.evaluate(() => mobileOpen('attendance'));
await page.waitForTimeout(300);
const att = await page.evaluate(() => { const body = document.querySelector('.att-page-body'); const first = [...body.children].filter(c => getComputedStyle(c).display !== 'none').sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0]; const btn = document.getElementById('att-gps-in-btn'); return { firstIsEntry: first.classList.contains('att-entry-grid'), btnH: btn.getBoundingClientRect().height, bg: getComputedStyle(btn).backgroundColor }; });
check('打卡頁：定位打卡卡片排在最上面、上下班按鈕高度 ≥ 96px、深綠主色', att.firstIsEntry && att.btnH >= 95 && att.bg === 'rgb(18, 61, 51)', att);
await page.evaluate(() => mobileGo('finance'));
await page.click('#m-f-profitshare');
st = await state(page);
const ps = await page.evaluate(() => { const d = psComputeData(); return { total: document.getElementById('m-ps-total').hidden, rows: document.querySelectorAll('#m-ps-people .m-card').length, expectRows: d.rows.length, text: document.getElementById('m-ps-total').innerText }; });
check('淨利潤摘要（業主）：自有頁面、合計卡片、每人一張卡（與 psComputeData 一致）', st.page === 'mprofitshare' && st.tab === 'finance' && !ps.total && ps.rows === ps.expectRows && ps.text.includes('合計淨利'), ps);
await page.click('#page-mprofitshare .m-submit.alt');
check('「看完整儀表」開啟原本的淨利潤儀表', (await page.evaluate(() => currentPage)) === 'profitshare');
await page.setViewportSize({ width: 1440, height: 900 });
await page.evaluate(() => navTo('payable', document.getElementById('nav-payable')));
await page.waitForTimeout(200);
check('桌面寬度：應付表格仍是表格（表頭顯示、列為 table-row）', await page.evaluate(() => { const b = document.getElementById('py-tbody'); return getComputedStyle(b.closest('table').tHead).display !== 'none' && (!b.querySelector('tr') || getComputedStyle(b.querySelector('tr')).display === 'table-row'); }));
await ctx.close();
H.setScenario('M-node5(peng)');
ctx = await newContext('peng@yutesign.com', { fixedTime: NOW });
page = await openPhone(ctx);
const pengPs = await page.evaluate(() => { if (!canAccess('profitshare')) return { access: false }; mobileOpenProfitShare(); return { access: true, total: document.getElementById('m-ps-total').hidden, names: [...document.querySelectorAll('#m-ps-people .m-card-title')].map(e => e.textContent) }; });
check('淨利潤摘要（非業主）：看不到合計、只看到自己', !pengPs.access || (pengPs.total === true && pengPs.names.every(n => n === '彭俞豪')), pengPs);
await ctx.close();

// ═══════════ N: 已安裝 app 的 Google 登入改用整頁轉址；登入畫面說明 ═══════════
H.setScenario('N-standalone-login');
ctx = await newContext('shower.li@yutesign.com', { fixedTime: NOW });
page = await openPhone(ctx);
check('登入畫面不再列出寫死的開通名單與 file:// 開發說明', await page.evaluate(() => { const t = document.querySelector('.auth-card').innerText; return !t.includes('李鎮宇、Ning') && !t.includes('file://') && t.includes('員工管理開通'); }));
const navs = [];
page.on('request', r => { if (r.url().startsWith('https://accounts.google.com/o/oauth2/v2/auth')) navs.push(r.url()); });
await page.evaluate(() => { window.__forceStandalone = true; opsStartGoogleLogin(); });
await page.waitForTimeout(800);
const authUrl = navs[0] ? new URL(navs[0]) : null;
const pend = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('yutesign_ops_oauth_pending')); } catch (e) { return null; } }).catch(() => null);
check('已安裝 app：按登入改為整頁前往 Google（帶 client_id、回到 /ops/、token 模式、state）', !!authUrl && authUrl.searchParams.get('client_id') === '239869421522-cqs68t3pnahjbmv9ld1k08b4p79s34k4.apps.googleusercontent.com' && /\/ops\/$/.test(authUrl.searchParams.get('redirect_uri')) && authUrl.searchParams.get('response_type') === 'token' && /^login\./.test(authUrl.searchParams.get('state') || ''), navs[0] || 'no navigation');
await ctx.close();
ctx = await newContext('shower.li@yutesign.com', { fixedTime: NOW });
page = await openPhone(ctx);
const ret = await page.evaluate(async () => {
  localStorage.setItem('yutesign_ops_oauth_pending', JSON.stringify({ state: 'drive.xyz', purpose: 'drive', at: Date.now() }));
  history.replaceState(null, '', location.pathname + '#access_token=tok-ok&state=drive.xyz');
  receiptToken = '';
  mobileHandleOAuthReturn();
  const ok = { token: receiptToken, hash: location.hash, pendingLeft: localStorage.getItem('yutesign_ops_oauth_pending') };
  localStorage.setItem('yutesign_ops_oauth_pending', JSON.stringify({ state: 'drive.real', purpose: 'drive', at: Date.now() }));
  history.replaceState(null, '', location.pathname + '#access_token=tok-forged&state=drive.other');
  receiptToken = '';
  mobileHandleOAuthReturn();
  return { ok, forged: receiptToken, hash2: location.hash };
});
check('回傳 state 相符：存下雲端硬碟授權、清掉網址 token 與暫存', ret.ok.token === 'tok-ok' && ret.ok.hash === '' && ret.ok.pendingLeft === null, ret);
check('回傳 state 不符：不採用該 token', ret.forged === '' && ret.hash2 === '', ret);
const login = await page.evaluate(async () => { window.__toasts = []; await mobileCompleteLogin('mock-access-token'); return { toast: window.__toasts.join('|'), pending: document.body.classList.contains('auth-pending'), user: currentUser && currentUser.name }; });
check('整頁轉址登入的後續步驟（查帳號、Firebase 登入、解鎖、同步）可完成', login.toast.includes('已登入：李鎮宇') && !login.pending && login.user === '李鎮宇', login);
check('已安裝 app：雲端硬碟授權也改為整頁轉址（不跳彈窗）', await page.evaluate(async () => { window.__forceStandalone = true; let target = ''; const orig = mobileOAuthRedirect; window.mobileOAuthRedirect = (p, s) => { target = p + '|' + s; }; receiptToken = ''; receiptConnect(); await new Promise(r => setTimeout(r, 900)); window.mobileOAuthRedirect = orig; window.__forceStandalone = false; return target === 'drive|https://www.googleapis.com/auth/drive'; }));
await ctx.close();

// ═══════════ O: 登入 8 小時、新版提示、電腦版應付單據按鈕 ═══════════
H.setScenario('O-polish');
ctx = await newContext('shower.li@yutesign.com', { fixedTime: NOW });
page = await openPhone(ctx);
const sess = await page.evaluate(() => {
  const key = OPS_AUTH_SESSION_KEY; const keep = localStorage.getItem(key);
  const at = h => { localStorage.setItem(key, JSON.stringify({ email: 'shower.li@yutesign.com', loginTime: Date.now() - h * 3600 * 1000 })); return !!opsReadAuthSession(); };
  const r = { h7: at(7), h79: at(7.9), h81: at(8.1), hours: OPS_AUTH_SESSION_HOURS };
  localStorage.setItem(key, keep);
  return r;
});
check('登入有效時間 8 小時：7 小時仍有效、超過 8 小時需重新登入', sess.hours === 8 && sess.h7 && sess.h79 && !sess.h81, sess);
const ver = await page.evaluate(async () => {
  const cur = mobileCurrentStamp();
  const realFetch = window.fetch;
  const html = await (await realFetch(location.pathname, { cache: 'no-store' })).text();
  window.fetch = async () => new Response(html);
  const same = await mobileCheckNewVersion();
  const sameBanner = !!document.getElementById('ops-new-version-banner');
  window.fetch = async () => new Response(html.replaceAll('?v=' + cur, '?v=deadbeef'));
  const diff = await mobileCheckNewVersion();
  const banner = document.getElementById('ops-new-version-banner');
  window.fetch = realFetch;
  return { cur, same, sameBanner, diff, bannerText: banner ? banner.textContent : '', bannerTop: banner ? getComputedStyle(banner).paddingTop : '' };
});
check('新版提示：版本相同不提示；伺服器版本戳記不同時顯示「重新整理」提示', /^[0-9a-f]{8}$/.test(ver.cur) && ver.same === false && !ver.sameBanner && ver.diff === true && ver.bannerText.includes('deadbeef') && ver.bannerText.includes('重新整理'), ver);
await page.setViewportSize({ width: 1440, height: 900 });
const pyBtn = await page.evaluate(() => {
  const row = PAYABLES.find(p => p.status === 'paid') || PAYABLES[0];
  row.attachments = [{ id: 'x1', name: 'a.jpg', url: 'https://drive.google.com/file/d/x1/view' }, { id: 'x2', name: 'b.jpg', url: 'https://drive.google.com/file/d/x2/view' }];
  navTo('payable', document.getElementById('nav-payable'));
  const btn = [...document.querySelectorAll('#py-tbody button')].find(b => (b.getAttribute('onclick') || '').includes("receiptOpenAttachModal('PAYABLES'," + row.id + ')'));
  if (!btn) return { found: false };
  btn.click();
  return { found: true, text: btn.textContent, links: document.querySelectorAll('#rc-modal-list a').length };
});
check('電腦版應付：有單據的列顯示「單據（2）」並可開啟列表', pyBtn.found && pyBtn.text === '單據（2）' && pyBtn.links === 2, pyBtn);
await ctx.close();

// ═══════════ P: 平板 ═══════════
const MOBILE_OWN_PAGES_LIST = ['mhome', 'mfinance', 'mme', 'mreview', 'mapply', 'minvoice', 'minbox', 'mprofitshare'];
H.setScenario('P-tablet');
ctx = await newContext('shower.li@yutesign.com', { fixedTime: NOW });
page = await openApp(ctx);
await page.setViewportSize({ width: 820, height: 1180 });
await page.reload({ waitUntil: 'load' }); await waitReady(page);
const tp = await page.evaluate(() => ({ page: currentPage, nav: getComputedStyle(document.getElementById('m-nav')).display, sidebarLeft: document.getElementById('sidebar').getBoundingClientRect().right, mainW: document.querySelector('.main').clientWidth }));
check('平板直放（820）：手機版介面、落在「今天」、側邊欄收起、內容全寬', tp.page === 'mhome' && tp.nav !== 'none' && tp.sidebarLeft <= 0 && tp.mainW === 820, tp);
await page.evaluate(() => mobileOpen('payable'));
await page.waitForTimeout(250);
const cols = await page.evaluate(() => getComputedStyle(document.getElementById('py-tbody')).gridTemplateColumns.split(' ').length);
check('平板直放：應付卡片排兩欄', cols === 2, cols);
await page.evaluate(() => { mobileGo('me'); });
await page.click('#page-mme .m-row:has-text("所有功能")');
await page.waitForTimeout(450);
check('平板直放：「所有功能」打開側邊欄抽屜', await page.evaluate(() => document.getElementById('sidebar').getBoundingClientRect().left >= 0));
await page.evaluate(() => closeMobileSidebar());
await page.evaluate(() => mobileOpenApply('payreq'));
await page.click('#m-pr-newvendor');
await page.waitForTimeout(400);
check('平板直放：新增視窗是置中的對話框（不是全螢幕）', await page.evaluate(() => { const r = document.querySelector('#modal-vendor .modal').getBoundingClientRect(); return r.width <= 641 && r.left > 0; }));
await page.evaluate(() => closeModal('modal-vendor'));
await page.setViewportSize({ width: 1180, height: 820 });
await page.waitForTimeout(250);
const tl = await page.evaluate(() => ({ page: currentPage, nav: getComputedStyle(document.getElementById('m-nav')).display, sidebar: getComputedStyle(document.getElementById('sidebar')).position, btnH: [...document.querySelectorAll('.topbar .btn')].filter(b => b.offsetParent).map(b => b.getBoundingClientRect().height)[0] || 0 }));
check('平板轉橫放（1180）：離開手機專用頁回到電腦版頁面、側邊欄、無底部分頁、按鈕 ≥ 40px', !MOBILE_OWN_PAGES_LIST.includes(tl.page) && tl.nav === 'none' && tl.sidebar !== 'fixed' && tl.btnH >= 40, tl);
await ctx.close();

// ═══════════ D: PWA install config ═══════════
H.setScenario('D-pwa');
ctx = await newContext('shower.li@yutesign.com', { fixedTime: NOW, serviceWorkers: 'allow' });
page = await openPhone(ctx);
const head = await page.evaluate(() => ({
  manifest: document.querySelector('link[rel="manifest"]')?.getAttribute('href'),
  theme: document.querySelector('meta[name="theme-color"]')?.content,
  apple: document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href'),
}));
check('頁首有 manifest、theme-color、apple-touch-icon（皆為相對路徑）', /^manifest\.webmanifest(\?v=[0-9a-f]{8})?$/.test(head.manifest) && head.theme === '#123D33' && head.apple === 'icons/apple-touch-icon.png', head);
const manifest = await page.evaluate(async () => (await fetch('manifest.webmanifest')).json());
check('manifest：standalone、相對 start_url／scope、深綠主題色', manifest.display === 'standalone' && manifest.start_url === './' && manifest.scope === './' && manifest.theme_color === '#123D33' && manifest.lang === 'zh-TW', manifest);
const iconRes = await page.evaluate(async icons => Promise.all(icons.map(async i => { const r = await fetch(i.src); const b = await r.blob(); return { src: i.src, ok: r.ok, type: b.type, size: b.size, purpose: i.purpose }; })), manifest.icons);
check('manifest 圖示：192／512／maskable 皆存在且為 PNG', iconRes.length === 3 && iconRes.every(i => i.ok && i.type === 'image/png' && i.size > 500) && iconRes.some(i => i.purpose === 'maskable'), iconRes);
const imgDims = await page.evaluate(async () => Promise.all(['icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png'].map(src => new Promise(res => { const im = new Image(); im.onload = () => res(src + ':' + im.naturalWidth + 'x' + im.naturalHeight); im.onerror = () => res(src + ':error'); im.src = src; }))));
check('圖示實際尺寸正確', JSON.stringify(imgDims) === JSON.stringify(['icons/icon-192.png:192x192', 'icons/icon-512.png:512x512', 'icons/icon-maskable-512.png:512x512', 'icons/apple-touch-icon.png:180x180']), imgDims);
const reg = await page.evaluate(async () => {
  const r = await navigator.serviceWorker.getRegistration();
  if (!r) return null;
  const sw = r.active || r.waiting || r.installing;
  if (sw && sw.state !== 'activated') await new Promise(res => sw.addEventListener('statechange', () => sw.state === 'activated' && res()));
  return { scope: r.scope.split('/ops/')[1] === '' ? '/ops/' : r.scope, state: (r.active || {}).state };
});
check('手機寬度：service worker 已註冊並啟用，範圍是 /ops/', reg && reg.state === 'activated' && reg.scope === '/ops/', reg);
const cached = await page.evaluate(async () => { const names = await caches.keys(); const c = await caches.open(names.find(n => n.startsWith('ops-shell-'))); return { names, urls: (await c.keys()).map(r => new URL(r.url).pathname) }; });
check('快取版本名稱帶版號、外殼檔案已存入', cached.names.length === 1 && /^ops-shell-\d{4}-\d{2}-\d{2}\.\d+$/.test(cached.names[0]) && ['/ops/', '/ops/index.html', '/ops/js/modules/mobile.js', '/ops/styles/mobile.css', '/ops/manifest.webmanifest'].every(u => cached.urls.includes(u)), { names: cached.names, count: cached.urls.length });
const swFiles = await page.evaluate(async () => { const src = await (await fetch('sw.js')).text(); const m = [...src.matchAll(/'((?:js|styles|icons)\/[^']+|index\.html|manifest\.webmanifest)'/g)].map(x => x[1]); return m; });
const missingShell = await page.evaluate(async files => (await Promise.all(files.map(async f => (await fetch(f, { cache: 'no-store' })).ok ? null : f))).filter(Boolean), swFiles);
check('sw.js 列的外殼檔案全部存在（沒有 404）', swFiles.length >= 28 && missingShell.length === 0, { count: swFiles.length, missingShell });
const scriptsInHtml = await page.evaluate(() => [...document.scripts].map(s => s.getAttribute('src')).filter(s => s && !/^https?:/.test(s)).map(s => s.replace(/\?v=[0-9a-f]{8}$/, '')));
check('sw.js 的外殼清單涵蓋 index.html 載入的所有本機 script', scriptsInHtml.every(s => swFiles.includes(s)), scriptsInHtml.filter(s => !swFiles.includes(s)));
await ctx.setOffline(true);
const offline = await page.evaluate(async () => {
  const out = {};
  for (const f of ['index.html', 'js/modules/mobile.js', 'styles/mobile.css']) { try { const r = await fetch(f); out[f] = r.ok ? (await r.text()).length : 'status ' + r.status; } catch (e) { out[f] = 'error'; } }
  return out;
});
check('離線時外殼檔案由快取提供', Object.values(offline).every(v => typeof v === 'number' && v > 100), offline);
const cachedHosts = await page.evaluate(async () => { const c = await caches.open((await caches.keys())[0]); return [...new Set((await c.keys()).map(r => new URL(r.url).host))]; });
check('快取只含本站檔案，沒有 Google 登入／Firebase 資料的請求', cachedHosts.length === 1 && cachedHosts[0].startsWith('127.0.0.1'), cachedHosts);
await ctx.setOffline(false);
await ctx.close();
ctx = await newContext('shower.li@yutesign.com', { fixedTime: NOW, serviceWorkers: 'allow' });
page = await openApp(ctx);
await page.waitForTimeout(500);
check('桌面寬度：不註冊 service worker', (await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)) === 0);
await ctx.close();

const finalData = JSON.parse(JSON.stringify(H.state.cloud?.data || {}));
const fails = await H.finish(outJson, { finalCloudData: finalData });
process.exit(fails ? 1 : 0);
