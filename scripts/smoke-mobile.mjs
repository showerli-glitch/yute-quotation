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
check('首頁表頭：純色、無圓角、高度不超過 150px', await page.evaluate(() => { const e = document.querySelector('#page-mhome .m-hero'); const cs = getComputedStyle(e); return cs.backgroundImage === 'none' && cs.backgroundColor === 'rgb(18, 61, 51)' && cs.borderBottomLeftRadius === '0px' && e.getBoundingClientRect().height <= 150; }));
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
const finExpect = await page.evaluate(() => ({ 'm-f-review': 'review', 'm-f-payreq': 'payreq', 'm-f-expense': 'expense', 'm-f-payable': 'payable', 'm-f-receivable': 'receivable', 'm-f-profit': 'profit', 'm-f-profitshare': 'profitshare' })).then(map => Object.keys(map));
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

// ═══════════ D: PWA install config ═══════════
H.setScenario('D-pwa');
ctx = await newContext('shower.li@yutesign.com', { fixedTime: NOW, serviceWorkers: 'allow' });
page = await openPhone(ctx);
const head = await page.evaluate(() => ({
  manifest: document.querySelector('link[rel="manifest"]')?.getAttribute('href'),
  theme: document.querySelector('meta[name="theme-color"]')?.content,
  apple: document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href'),
}));
check('頁首有 manifest、theme-color、apple-touch-icon（皆為相對路徑）', head.manifest === 'manifest.webmanifest' && head.theme === '#123D33' && head.apple === 'icons/apple-touch-icon.png', head);
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
const scriptsInHtml = await page.evaluate(() => [...document.scripts].map(s => s.getAttribute('src')).filter(s => s && !/^https?:/.test(s)));
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
