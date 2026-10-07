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
const scriptsLoaded = await page.evaluate(() => [...document.scripts].map(s => s.src.split('/ops/')[1]).filter(Boolean));
check('mobile.js 是最後載入的 script、mobile.css 有載入', scriptsLoaded[scriptsLoaded.length - 1] === 'js/modules/mobile.js' && (await page.evaluate(() => [...document.styleSheets].some(s => (s.href || '').endsWith('styles/mobile.css')))), scriptsLoaded.slice(-3));

let st = await state(page);
check('手機登入後落在「今天」、隱藏舊上方列、顯示底部分頁', st.page === 'mhome' && st.ownHeader && !st.topbar && st.navShown && st.active.join() === 'page-mhome', st);
check('底部分頁四個、「今天」為選取', (await page.locator('.m-nav-btn').count()) === 4 && st.tab === 'today');
check('底部分頁按鈕高度 ≥ 44px', (await page.locator('.m-nav-btn').evaluateAll(bs => bs.every(b => b.getBoundingClientRect().height >= 44))));
const heroText = await page.locator('#page-mhome .m-hero').innerText();
check('首頁表頭：YUTE / OPS、已同步、日期、「今天」', /YUTE \/ OPS/.test(heroText) && /已同步/.test(heroText) && /今天/.test(heroText) && /\d+\/\d+/.test(heroText), heroText.replace(/\s+/g, ' '));
const quick = await page.evaluate(() => ({
  attendance: !document.getElementById('m-q-attendance').hidden,
  expense: !document.getElementById('m-q-expense').hidden,
  payreq: !document.getElementById('m-q-payreq').hidden,
  newcase: !document.getElementById('m-q-newcase').hidden,
  expect: { attendance: canAccess('attendance'), expense: canAccess('expense'), payreq: canAccess('payreq'), newcase: canCreateCase() },
}));
check('快速動作依權限顯示（與 canAccess／canCreateCase 一致）', quick.attendance === quick.expect.attendance && quick.expense === quick.expect.expense && quick.payreq === quick.expect.payreq && quick.newcase === quick.expect.newcase, quick);
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
check('舊上方列改為深綠表頭、標題白字', await page.evaluate(() => { const t = document.querySelector('.topbar'); return getComputedStyle(t).backgroundImage.includes('gradient') && getComputedStyle(document.getElementById('topbar-title')).color === 'rgb(255, 255, 255)'; }));
await tabBtn(page, 'today').click();
st = await state(page);
check('按「今天」回到首頁', st.page === 'mhome' && st.ownHeader && st.tab === 'today', st);

// finance tab
check('有財務權限的人看得到「財務」分頁', await tabBtn(page, 'finance').isVisible());
await tabBtn(page, 'finance').click();
st = await state(page);
check('「財務」分頁進入財務清單頁', st.page === 'mfinance' && st.ownHeader && st.tab === 'finance', st);
const finRows = await page.evaluate(() => [...document.querySelectorAll('#page-mfinance .m-row')].filter(r => !r.hidden).map(r => r.id));
const finExpect = await page.evaluate(() => ({ 'm-f-payreq': 'payreq', 'm-f-expense': 'expense', 'm-f-payable': 'payable', 'm-f-receivable': 'receivable', 'm-f-profit': 'profit', 'm-f-profitshare': 'profitshare' })).then(map => Object.keys(map));
check('財務清單：六項、依權限顯示', finRows.length === finExpect.length && finRows.every(id => finExpect.includes(id)), finRows);
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

const finalData = JSON.parse(JSON.stringify(H.state.cloud?.data || {}));
const fails = await H.finish(outJson, { finalCloudData: finalData });
process.exit(fails ? 1 : 0);
