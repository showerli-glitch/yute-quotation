// Clients/vendors functional smoke test against a local HTTP server, with a mock
// Firebase/Google stub and ALL other external requests aborted (never touches production).
//
// Setup (outside the repo):  mkdir /tmp/ops-smoke && cd /tmp/ops-smoke && npm i playwright-core
// Run (branch):    PLAYWRIGHT_CORE=/tmp/ops-smoke/node_modules/playwright-core/index.mjs node scripts/smoke-clients-vendors.mjs branch "$PWD" 8701 /tmp/ops-smoke/branch.json
// Run (baseline):  git worktree add --detach /tmp/ops-base 514e655
//                  PLAYWRIGHT_CORE=... node scripts/smoke-clients-vendors.mjs baseline /tmp/ops-base 8702 /tmp/ops-smoke/baseline.json
// Uses the system Google Chrome at /Applications/Google Chrome.app.
// Set SKIP_POST_SPLIT=1 to skip scenarios D/E (vendor delete + sorted pickers) when running a pre-feature baseline.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_CORE || 'playwright-core');

const [label, rootDir, portArg, outJson] = process.argv.slice(2);
const PORT = Number(portArg);
const ORIGIN = `http://127.0.0.1:${PORT}`;
const APP_URL = `${ORIGIN}/ops/`;
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// ── Static server: serves the unmodified project files read-only ──
const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg', '.ico':'image/x-icon', '.svg':'image/svg+xml' };
const served = [];
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, ORIGIN).pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(rootDir, p);
  if (!file.startsWith(path.resolve(rootDir)) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    served.push({ path: p, status: 404 }); res.writeHead(404); res.end('not found'); return;
  }
  served.push({ path: p, status: 200 });
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));

// ── Mock "cloud" lives in Node memory, emulating RTDB null/empty pruning ──
let cloud = null;
const cloudWrites = [];
function rtdbPrune(v) {
  if (v === null || v === undefined) return undefined;
  if (Array.isArray(v)) {
    const out = v.map(rtdbPrune);
    return out.every(x => x === undefined) ? undefined : out.map(x => x === undefined ? null : x);
  }
  if (typeof v === 'object') {
    const out = {};
    for (const [k, c] of Object.entries(v)) { const pc = rtdbPrune(c); if (pc !== undefined) out[k] = pc; }
    return Object.keys(out).length ? out : undefined;
  }
  return v;
}

const MOCK_FIREBASE = `(() => {
  const listeners = [];
  const email = window.__MOCK_AUTH_EMAIL || null;
  let authUser = email ? { email, uid: 'mock-' + email, emailVerified: true } : null;
  const authObj = {
    get currentUser() { return authUser; },
    onAuthStateChanged(cb) { setTimeout(() => cb(authUser), 0); return () => {}; },
    async signInWithCredential() { return { user: authUser }; },
    async signOut() { authUser = null; },
  };
  const snap = v => ({ exists: () => v != null, val: () => v == null ? null : JSON.parse(JSON.stringify(v)) });
  const ref = p => ({
    async get() { return snap(await window.__mockRtdbGet(p)); },
    async set(v) {
      const stored = await window.__mockRtdbSet(p, JSON.parse(JSON.stringify(v)));
      listeners.filter(l => l.p === p).forEach(l => setTimeout(() => l.cb(snap(stored)), 0));
    },
    on(evt, cb) { listeners.push({ p, cb }); window.__mockRtdbGet(p).then(v => cb(snap(v))); return cb; },
    off() { for (let i = listeners.length - 1; i >= 0; i--) if (listeners[i].p === p) listeners.splice(i, 1); },
  });
  const app = { name: '[DEFAULT]' };
  const fb = {
    apps: [],
    initializeApp(cfg) { window.__mockFirebaseConfig = cfg; fb.apps.push(app); return app; },
    app() { return app; },
    database() { return { ref }; },
    auth: Object.assign(() => authObj, { GoogleAuthProvider: { credential: () => ({ mock: true }) } }),
  };
  window.firebase = fb;
  window.__MOCK_FIREBASE = true;
})();`;
const MOCK_GSI = `window.google = { accounts: { oauth2: { initTokenClient() { return { requestAccessToken() {} }; }, revoke() {} } } };`;

const blocked = [];
const mocked = [];
const results = [];
const consoleLog = [];
let currentScenario = '';

function check(name, pass, detail = '') {
  results.push({ scenario: currentScenario, name, pass: !!pass, detail: typeof detail === 'string' ? detail : JSON.stringify(detail) });
  console.log(`${pass ? 'PASS' : 'FAIL'} [${currentScenario}] ${name}${detail ? ' — ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''}`);
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true });

async function newContext(email) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-TW', timezoneId: 'Asia/Taipei', serviceWorkers: 'block' });
  await ctx.exposeFunction('__mockRtdbGet', p => (p === 'ops/yutesign/snapshot' ? cloud : null));
  await ctx.exposeFunction('__mockRtdbSet', (p, v) => {
    if (p !== 'ops/yutesign/snapshot') throw new Error('unexpected path ' + p);
    cloud = rtdbPrune(v);
    cloudWrites.push({ scenario: currentScenario, savedAt: cloud?.meta?.savedAt, savedBy: cloud?.meta?.savedBy, source: cloud?.meta?.source });
    return cloud;
  });
  await ctx.addInitScript(({ email }) => {
    window.__MOCK_AUTH_EMAIL = email;
    try {
      if (!localStorage.getItem('yutesign_ops_auth_session')) {
        localStorage.setItem('yutesign_ops_auth_session', JSON.stringify({ email, loginTime: Date.now() }));
      }
    } catch (e) {}
    window.__toasts = [];
    document.addEventListener('DOMContentLoaded', () => {
      const t = document.getElementById('toast');
      if (!t) return;
      new MutationObserver(() => { if (t.classList.contains('show')) window.__toasts.push(t.textContent); })
        .observe(t, { attributes: true, childList: true, characterData: true, subtree: true });
    });
  }, { email });
  await ctx.route('**/*', route => {
    const url = route.request().url();
    if (url.startsWith(ORIGIN + '/')) return route.continue();
    if (url.startsWith('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js')) { mocked.push(url); return route.fulfill({ status: 200, contentType: 'text/javascript', body: MOCK_FIREBASE }); }
    if (url.startsWith('https://www.gstatic.com/firebasejs/10.12.0/')) { mocked.push(url); return route.fulfill({ status: 200, contentType: 'text/javascript', body: '/* mocked */' }); }
    if (url.startsWith('https://accounts.google.com/gsi/client')) { mocked.push(url); return route.fulfill({ status: 200, contentType: 'text/javascript', body: MOCK_GSI }); }
    blocked.push(url);
    return route.abort('blockedbyclient');
  });
  return ctx;
}

async function openApp(ctx) {
  const page = await ctx.newPage();
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) consoleLog.push({ scenario: currentScenario, type: m.type(), text: m.text() }); });
  page.on('pageerror', e => consoleLog.push({ scenario: currentScenario, type: 'pageerror', text: String(e?.stack || e) }));
  page.on('websocket', ws => blocked.push('websocket:' + ws.url()));
  await page.goto(APP_URL, { waitUntil: 'load' });
  await waitReady(page);
  return page;
}
async function waitReady(page) {
  await page.waitForFunction(() => typeof opsCloudReady !== 'undefined' && opsCloudReady === true && !document.body.classList.contains('auth-pending'), null, { timeout: 15000 });
  await page.waitForTimeout(700); // let renderAfterDataSettles timers (150/500ms) finish
}
async function waitSynced(page) {
  await page.waitForFunction(() => !opsCloudPendingSnapshot && !(typeof opsCloudSaveInFlight !== 'undefined' && opsCloudSaveInFlight), null, { timeout: 15000 });
}
const lastToast = page => page.evaluate(() => window.__toasts[window.__toasts.length - 1] || '');
const clearToasts = page => page.evaluate(() => { window.__toasts = []; });
const isOpen = (page, id) => page.evaluate(id => document.getElementById(id)?.classList.contains('open') || false, id);
const visible = (page, sel) => page.locator(sel).first().isVisible().catch(() => false);
async function nav(page, pageName) { await page.evaluate(p => navTo(p, document.getElementById('nav-' + p)), pageName); await page.waitForTimeout(150); }
const rowCount = (page, tbody) => page.evaluate(id => [...document.querySelectorAll(`#${id} tr`)].filter(tr => tr.querySelectorAll('td').length > 1).length, tbody);
const counts = page => page.evaluate(() => ({ CASES: CASES.length, PAYABLES: PAYABLES.length, RECEIVABLES: RECEIVABLES.length, EXPENSES: EXPENSES.length, CLIENTS: CLIENTS.length, VENDORS: VENDORS.length }));

// ═══════════ Scenario A: full manage (shower) ═══════════
currentScenario = 'A-manage(shower)';
let ctx = await newContext('shower.li@yutesign.com');
let page = await openApp(ctx);
check('雲端初始化（空雲端 → 建立快照）', cloud && cloud.meta?.source === 'ops-v2-cloud-sync' && cloud.meta?.companyId === 'yutesign', { source: cloud?.meta?.source, savedBy: cloud?.meta?.savedBy });
check('Firebase config 指向正式專案但由 mock 取代', await page.evaluate(() => window.__MOCK_FIREBASE === true && window.__mockFirebaseConfig?.projectId === 'yutesign-sync'));
const scriptsLoaded = await page.evaluate(() => ['submitNewClient','renderClients','viewClient','openClientModal','submitClient','vendorCreatedByCurrentUser','canEditVendor','vendorPrefixForTrade','vdSuggestCodeFromTrade','vdRefreshStatusForm','vdToggleStatusInForm','vdSetSort','renderVendors','viewVendor','openVendorModal','submitVendor','openPayreqForVendor','openReceivableForClient','payreqVendorPickerMouseDown'].filter(n => typeof window[n] !== 'function'));
check('16 個模組函式 + 3 個橋接/picker 函式皆為全域函式', scriptsLoaded.length === 0, scriptsLoaded.length ? 'missing: ' + scriptsLoaded.join(',') : '');
const before = await counts(page);

// ── Clients page ──
await nav(page, 'clients');
check('客戶頁可進入', await page.evaluate(() => currentPage === 'clients' && document.getElementById('page-clients').classList.contains('active')));
check('客戶列表筆數 = CLIENTS 筆數', (await rowCount(page, 'cl-tbody')) === before.CLIENTS, `${await rowCount(page, 'cl-tbody')} / ${before.CLIENTS}`);
check('「＋ 新增客戶」按鈕可見（manage）', await visible(page, '#btn-new-client'));
const stats = await page.locator('#cl-stats').innerText();
check('客戶統計卡顯示總數', stats.includes(String(before.CLIENTS)) && stats.includes('客戶總數'));

// search
const sample = await page.evaluate(() => { const c = CLIENTS.find(c => c.shortName && c.type) || CLIENTS[0]; return { code: c.code, shortName: c.shortName }; });
await page.fill('#cl-search', sample.shortName);
const expectedSearch = await page.evaluate(kw => CLIENTS.filter(c => `${c.code} ${c.shortName} ${c.fullName} ${c.contact}`.toLowerCase().includes(kw.toLowerCase())).length, sample.shortName);
check('客戶搜尋（名稱）', (await rowCount(page, 'cl-tbody')) === expectedSearch && expectedSearch >= 1, `${await rowCount(page, 'cl-tbody')} rows, expected ${expectedSearch}`);
await page.fill('#cl-search', sample.code.toLowerCase());
check('客戶搜尋（代碼小寫不分大小寫）', (await page.locator('#cl-tbody').innerText()).includes(sample.code));
await page.fill('#cl-search', 'ZZ-NO-SUCH-CLIENT');
check('客戶搜尋無結果顯示空狀態', (await page.locator('#cl-tbody').innerText()).includes('無符合條件的客戶'));
await page.fill('#cl-search', '');

// type filter
const typeOpts = await page.$$eval('#cl-filter-type option', os => os.map(o => o.value).filter(Boolean));
let typeOk = true; const typeDetail = [];
for (const t of typeOpts) {
  await page.selectOption('#cl-filter-type', t);
  const n = await rowCount(page, 'cl-tbody');
  const exp = await page.evaluate(t => CLIENTS.filter(c => c.type === t).length, t);
  const shown = exp === 0 ? (await page.locator('#cl-tbody').innerText()).includes('無符合條件的客戶') : n === exp;
  if (!shown) typeOk = false;
  typeDetail.push(`${t}:${exp === 0 ? 'empty' : n}/${exp}`);
}
await page.selectOption('#cl-filter-type', '');
check('客戶類型篩選（每個選項）', typeOk && typeOpts.length > 0, typeDetail.join(' '));
check('清除篩選後回到全部', (await rowCount(page, 'cl-tbody')) === before.CLIENTS);

// detail
await page.locator('#cl-tbody tr', { hasText: sample.code }).first().locator('td').first().click();
check('客戶詳情開啟', await isOpen(page, 'modal-client-detail'));
check('客戶詳情標題', (await page.locator('#cl-detail-title').innerText()).startsWith(sample.code));
check('客戶詳情「編輯」按鈕可見（manage）', await visible(page, '#cl-detail-edit-btn'));
await page.click('#cl-detail-edit-btn');
check('詳情→編輯 轉開編輯視窗且代碼唯讀', await isOpen(page, 'modal-client') && !(await isOpen(page, 'modal-client-detail')) && await page.locator('#cl-f-code').evaluate(e => e.readOnly));
await page.evaluate(() => closeModal('modal-client'));

// add client
await clearToasts(page);
await page.click('#btn-new-client');
check('新增客戶視窗開啟、標題、代碼可編輯', await isOpen(page, 'modal-client') && (await page.locator('#cl-modal-title').innerText()) === '新增客戶' && !(await page.locator('#cl-f-code').evaluate(e => e.readOnly)));
await page.fill('#cl-f-code', 'zqa1');
await page.click('#modal-client button.btn-primary');
check('新增客戶：缺簡稱被拒', (await lastToast(page)) === '代碼與客戶簡稱為必填' && await isOpen(page, 'modal-client'), await lastToast(page));
await page.fill('#cl-f-shortName', 'QA測試客戶');
await page.fill('#cl-f-fullName', 'QA測試股份有限公司');
await page.fill('#cl-f-taxId', '12345678');
const firstType = typeOpts[0] || '';
if (firstType) await page.selectOption('#cl-f-type', firstType);
await page.fill('#cl-f-contact', 'QA聯絡人');
await page.fill('#cl-f-phone', '02-0000-0000');
await page.click('#modal-client button.btn-primary');
const added = await page.evaluate(() => CLIENTS.find(c => c.code === 'ZQA1'));
check('新增客戶成功（代碼自動轉大寫）', !!added && added.shortName === 'QA測試客戶' && added.type === firstType && !(await isOpen(page, 'modal-client')), await lastToast(page));
check('新增客戶後列表出現', (await page.locator('#cl-tbody').innerText()).includes('ZQA1'));

// duplicate
await clearToasts(page);
await page.click('#btn-new-client');
await page.fill('#cl-f-code', 'ZQA1');
await page.fill('#cl-f-shortName', '重複');
await page.click('#modal-client button.btn-primary');
check('重複客戶代碼被拒', (await lastToast(page)) === '代碼重複，請換一個' && await isOpen(page, 'modal-client') && (await page.evaluate(() => CLIENTS.filter(c => c.code === 'ZQA1').length)) === 1, await lastToast(page));
await page.fill('#cl-f-code', sample.code.toLowerCase());
await page.click('#modal-client button.btn-primary');
check('重複既有客戶代碼（小寫輸入）被拒', (await lastToast(page)) === '代碼重複，請換一個');
await page.evaluate(() => closeModal('modal-client'));

// edit
await page.locator('#cl-tbody tr', { hasText: 'ZQA1' }).locator('button', { hasText: '編輯' }).click();
check('編輯客戶視窗帶入資料', await isOpen(page, 'modal-client') && (await page.inputValue('#cl-f-shortName')) === 'QA測試客戶' && (await page.locator('#cl-modal-title').innerText()).includes('編輯客戶'));
await page.fill('#cl-f-contact', 'QA聯絡人-改');
await page.fill('#cl-f-note', 'smoke edit');
await page.click('#modal-client button.btn-primary');
const edited = await page.evaluate(() => CLIENTS.find(c => c.code === 'ZQA1'));
check('編輯客戶已儲存', edited?.contact === 'QA聯絡人-改' && edited?.note === 'smoke edit' && (await lastToast(page)) === '客戶資料已更新');
check('編輯不會新增重複筆', (await page.evaluate(() => CLIENTS.filter(c => c.code === 'ZQA1').length)) === 1);

// ── Vendors page ──
await nav(page, 'vendors');
const vcount = before.VENDORS;
check('廠商頁可進入且列表筆數正確', (await rowCount(page, 'vd-tbody')) === vcount, `${await rowCount(page, 'vd-tbody')} / ${vcount}`);
check('廠商統計列', (await page.locator('#vd-stats-line').innerText()).includes(`共 ${vcount} 家廠商`));
check('「＋ 新增廠商」按鈕可見（manage）', await visible(page, '#btn-new-vendor'));

// sort
const readOrder = () => page.evaluate(() => [...document.querySelectorAll('#vd-tbody tr')].map(tr => ({ code: tr.cells[0]?.innerText.trim(), name: tr.cells[1]?.innerText.trim(), status: tr.cells[10]?.innerText.trim() })));
const sortedOk = (rows, key, asc) => {
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1], b = rows[i];
    const sa = a.status === '有效' ? 0 : 1, sb = b.status === '有效' ? 0 : 1;
    if (sa !== sb) { if (sa > sb) return false; continue; }
    let cmp = key === 'code' ? a.code.localeCompare(b.code, 'zh-TW', { numeric: true }) : a.name.localeCompare(b.name, 'zh-TW', { sensitivity: 'base' });
    if (!asc) cmp = -cmp;
    if (cmp > 0) return false;
  }
  return true;
};
let rows = await readOrder();
check('廠商預設排序：有效在前、代碼遞增，箭頭↑', sortedOk(rows, 'code', true) && (await page.locator('#vd-sort-code').innerText()) === '↑');
await page.click('#vd-th-code');
rows = await readOrder();
check('點代碼欄 → 代碼遞減，箭頭↓', sortedOk(rows, 'code', false) && (await page.locator('#vd-sort-code').innerText()) === '↓');
await page.click('#vd-th-name');
rows = await readOrder();
check('點名稱欄 → 名稱遞增，箭頭移到名稱', sortedOk(rows, 'name', true) && (await page.locator('#vd-sort-name').innerText()) === '↑' && (await page.locator('#vd-sort-code').innerText()) === '');
await page.click('#vd-th-name');
check('再點名稱欄 → 名稱遞減', sortedOk(await readOrder(), 'name', false));
await page.click('#vd-th-code');
check('切回代碼欄 → 代碼遞增', sortedOk(await readOrder(), 'code', true));

// search / filters
const vs = await page.evaluate(() => { const v = VENDORS.find(v => v.status === '有效' && v.trade) || VENDORS[0]; return { code: v.code, name: v.name, trade: v.trade }; });
await page.fill('#vd-search', vs.name);
const vExp = await page.evaluate(kw => VENDORS.filter(v => `${v.code} ${v.name} ${v.owner} ${v.trade}`.toLowerCase().includes(kw.toLowerCase())).length, vs.name);
check('廠商搜尋', (await rowCount(page, 'vd-tbody')) === vExp && vExp >= 1, `${await rowCount(page, 'vd-tbody')}/${vExp}`);
await page.fill('#vd-search', '');
await page.selectOption('#vd-filter-trade', vs.trade);
check('廠商工種篩選', (await rowCount(page, 'vd-tbody')) === await page.evaluate(t => VENDORS.filter(v => v.trade === t).length, vs.trade));
await page.selectOption('#vd-filter-trade', '');
const statusOpts = await page.$$eval('#vd-filter-status option', os => os.map(o => o.value).filter(Boolean));
let stOk = true; const stDetail = [];
for (const s of statusOpts) {
  await page.selectOption('#vd-filter-status', s);
  const exp = await page.evaluate(s => VENDORS.filter(v => v.status === s).length, s);
  const n = exp ? await rowCount(page, 'vd-tbody') : 0;
  if (n !== exp) stOk = false;
  stDetail.push(`${s}:${n}/${exp}`);
}
await page.selectOption('#vd-filter-status', '');
check('廠商狀態篩選', stOk, stDetail.join(' '));

// detail
await page.locator('#vd-tbody tr', { hasText: vs.code }).first().locator('td').first().click();
check('廠商詳情開啟', await isOpen(page, 'modal-vendor-detail') && (await page.locator('#vd-detail-title').innerText()).startsWith(vs.code));
check('廠商詳情含匯款資訊區塊與編輯鈕', (await page.locator('#vd-detail-body').innerText()).includes('匯款資訊') && await visible(page, '#vd-detail-edit-btn'));
await page.evaluate(() => closeModal('modal-vendor-detail'));

// add vendor: required / trade code suggestion
await clearToasts(page);
await page.click('#btn-new-vendor');
const vdDefaults = { open: await isOpen(page, 'modal-vendor'), status: await page.inputValue('#vd-f-status'), payMethod: await page.inputValue('#vd-f-payMethod'), dateShown: await visible(page, '#vd-disabled-date-wrap'), btn: await page.locator('#vd-toggle-status-btn').innerText() };
check('新增廠商視窗：開啟、付款預設匯款、停用日期隱藏、按鈕為停用廠商', vdDefaults.open && vdDefaults.payMethod === '匯款' && !vdDefaults.dateShown && vdDefaults.btn === '停用廠商', vdDefaults);
check('新增廠商視窗：隱藏狀態欄預設為「有效」', vdDefaults.status === '有效', vdDefaults);
await page.click('#modal-vendor button.btn-primary');
check('新增廠商：必填缺漏被拒', (await lastToast(page)) === '代碼、廠商名稱、工種為必填' && await isOpen(page, 'modal-vendor'), await lastToast(page));
// independent expectation for code suggestion
const tradeOpts = await page.$$eval('#vd-f-trade option', os => os.map(o => o.value).filter(Boolean));
const expectSuggest = await page.evaluate(trades => {
  const fallback = { '假設及拆運':'DM','土木工程':'TW','水電／照明':'EL','防水':'WP','輕隔間及輕鋼架天花板':'LG','泥作及貼磚':'TL','木作及系統櫃':'WD','門扇':'DR','鋁窗':'AL','鐵件及金屬':'MT','油漆':'PT','地坪':'FL','玻璃及貼膜':'GL','廣告及招牌':'AD','窗簾':'CR','空調':'AC','石材／人造石':'ST','衛浴設備':'BA','廚具設備':'KT','燈具／設備及其他':'EQ','完工清潔':'CL','設計製圖':'DS','專業顧問服務':'PS','建材供應':'SP','傢俱設備':'FN','其他':'OT' };
  const out = {};
  for (const t of trades) {
    const cnt = {};
    VENDORS.filter(v => v.trade === t).forEach(v => { const m = /^([A-Z]+)-\d+$/.exec(String(v.code || '')); if (m) cnt[m[1]] = (cnt[m[1]] || 0) + 1; });
    const best = Object.entries(cnt).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
    const prefix = best || fallback[t] || 'VD';
    let max = 0;
    VENDORS.forEach(v => { const m = new RegExp('^' + prefix + '-(\\d+)$').exec(String(v.code || '')); if (m) max = Math.max(max, +m[1]); });
    out[t] = { code: `${prefix}-${String(max + 1).padStart(3, '0')}`, inferred: !!best };
  }
  return out;
}, tradeOpts);
let sugOk = true; const sugBad = [];
for (const t of tradeOpts) {
  await page.selectOption('#vd-f-trade', t);
  const got = await page.inputValue('#vd-f-code');
  if (got !== expectSuggest[t].code) { sugOk = false; sugBad.push(`${t}:${got}≠${expectSuggest[t].code}`); }
}
const nInferred = Object.values(expectSuggest).filter(x => x.inferred).length;
check(`工種建議代碼（${tradeOpts.length} 個工種，${nInferred} 個由既有代碼推論、${tradeOpts.length - nInferred} 個走預設前綴）`, sugOk && tradeOpts.length > 0, sugBad.join(' '));
const useTrade = vs.trade;
await page.selectOption('#vd-f-trade', useTrade);
const suggested = await page.inputValue('#vd-f-code');
await page.fill('#vd-f-name', 'QA測試廠商');
await page.fill('#vd-f-owner', 'QA負責人');
await page.fill('#vd-f-bank', 'QA銀行');
await page.fill('#vd-f-account', '000-000');
// duplicate code
await page.fill('#vd-f-code', vs.code.toLowerCase());
await page.click('#modal-vendor button.btn-primary');
check('重複廠商代碼被拒（小寫輸入）', (await lastToast(page)) === '代碼重複，請換一個' && await isOpen(page, 'modal-vendor'), await lastToast(page));
await page.fill('#vd-f-code', suggested);
// disable without date
await page.click('#vd-toggle-status-btn');
check('停用切換：狀態→停用、日期預設今天、按鈕→取消停用', (await page.inputValue('#vd-f-status')) === '停用' && (await page.inputValue('#vd-f-disabledDate')) === await page.evaluate(() => localDateKey()) && (await page.locator('#vd-toggle-status-btn').innerText()) === '取消停用' && await visible(page, '#vd-disabled-date-wrap'));
await page.fill('#vd-f-disabledDate', '');
await page.click('#modal-vendor button.btn-primary');
check('停用但無停用日期被拒', (await lastToast(page)) === '請選擇停用日期' && await isOpen(page, 'modal-vendor'), await lastToast(page));
await page.click('#vd-toggle-status-btn');
check('取消停用切換：狀態→有效、日期清空、日期欄隱藏', (await page.inputValue('#vd-f-status')) === '有效' && (await page.inputValue('#vd-f-disabledDate')) === '' && !(await visible(page, '#vd-disabled-date-wrap')));
await page.click('#modal-vendor button.btn-primary');
const newVendor = await page.evaluate(code => VENDORS.find(v => v.code === code), suggested);
check('新增廠商成功（使用建議代碼）', !!newVendor && newVendor.name === 'QA測試廠商' && newVendor.status === '有效' && newVendor.trade === useTrade && !(await isOpen(page, 'modal-vendor')), `${suggested} ${await lastToast(page)}`);
check('新增廠商帶建立/更新稽核欄位', !!newVendor?.createdAt && !!newVendor?.createdBy && !!newVendor?.updatedAt, { createdBy: newVendor?.createdBy });

// disable existing via edit, sort-to-bottom, then re-enable
await page.locator('#vd-tbody tr', { hasText: suggested }).locator('button', { hasText: '編輯' }).click();
check('編輯廠商：代碼唯讀、資料帶入', await isOpen(page, 'modal-vendor') && await page.locator('#vd-f-code').evaluate(e => e.readOnly) && (await page.inputValue('#vd-f-name')) === 'QA測試廠商');
await page.click('#vd-toggle-status-btn');
await page.fill('#vd-f-disabledDate', '2026-10-01');
await page.click('#modal-vendor button.btn-primary');
let vrow = await page.evaluate(code => VENDORS.find(v => v.code === code), suggested);
rows = await readOrder();
check('停用廠商已儲存、停用日期保留', vrow.status === '停用' && vrow.disabledDate === '2026-10-01' && (await lastToast(page)) === '廠商資料已更新');
check('停用廠商排在有效廠商之後', rows.findIndex(r => r.code === suggested) > rows.map(r => r.status).lastIndexOf('有效'));
check('停用廠商保留 createdBy，更新 updatedAt', vrow.createdBy === newVendor.createdBy && vrow.updatedAt >= newVendor.updatedAt);
await page.locator('#vd-tbody tr', { hasText: suggested }).locator('td').first().click();
check('停用廠商詳情顯示停用日期', (await page.locator('#vd-detail-body').innerText()).includes('停用 · 2026-10-01'));
await page.click('#vd-detail-edit-btn');
check('停用廠商編輯視窗：按鈕為取消停用、日期欄顯示', (await page.locator('#vd-toggle-status-btn').innerText()) === '取消停用' && await visible(page, '#vd-disabled-date-wrap'));
await page.click('#vd-toggle-status-btn');
await page.click('#modal-vendor button.btn-primary');
vrow = await page.evaluate(code => VENDORS.find(v => v.code === code), suggested);
check('取消停用已儲存（狀態有效、停用日期清空）', vrow.status === '有效' && vrow.disabledDate === '');

// probe: create a vendor without touching the status toggle, record the saved status
await page.click('#btn-new-vendor');
await page.selectOption('#vd-f-trade', useTrade);
const probeCode = await page.inputValue('#vd-f-code');
await page.fill('#vd-f-name', 'QA未切換狀態廠商');
await page.click('#modal-vendor button.btn-primary');
const probe = await page.evaluate(code => { const v = VENDORS.find(v => v.code === code); return { status: v?.status, tag: [...document.querySelectorAll('#vd-tbody tr')].find(tr => tr.cells[0]?.innerText.trim() === code)?.cells[10]?.innerText.trim() }; }, probeCode);
check('未切換狀態直接新增的廠商狀態為「有效」', probe.status === '有效', { code: probeCode, ...probe });
await page.evaluate(code => { VENDORS.splice(VENDORS.findIndex(v => v.code === code), 1); saveData(); renderVendors(); }, probeCode); // remove probe row from the mock dataset

// ── Case quick-add client ──
await nav(page, 'dashboard');
await page.click('#btn-new-case');
check('新增個案視窗開啟', await isOpen(page, 'modal-new-case'));
await page.locator('#modal-new-case button', { hasText: '＋ 新增客戶' }).click();
check('案件內「＋ 新增客戶」開啟快捷視窗', await isOpen(page, 'modal-new-client'));
await clearToasts(page);
await page.fill('#nc-code', 'q');
await page.fill('#nc-name-zh', '快捷客戶');
await page.click('#modal-new-client button.btn-primary');
check('快捷新增：代碼少於2碼被拒', (await lastToast(page)) === '請輸入至少2碼的客戶代碼');
await page.fill('#nc-code', 'zqa1');
await page.click('#modal-new-client button.btn-primary');
check('快捷新增：重複代碼（查 CLIENTS 主檔）被拒', (await lastToast(page)) === '代碼 ZQA1 已存在，請換一個' && await isOpen(page, 'modal-new-client'));
await page.fill('#nc-code', 'zqa2');
await page.fill('#nc-name-zh', '');
await page.click('#modal-new-client button.btn-primary');
check('快捷新增：缺名稱被拒', (await lastToast(page)) === '請輸入客戶名稱');
await page.fill('#nc-name-zh', '快捷客戶');
await page.fill('#nc-name-en', 'Quick Client');
await page.click('#modal-new-client button.btn-primary');
const quick = await page.evaluate(() => CLIENTS.find(c => c.code === 'ZQA2'));
const qState = await page.evaluate(() => ({ sel: document.getElementById('new-client-code').value, optText: document.getElementById('new-client-code').selectedOptions[0]?.textContent, caseCode: document.getElementById('new-case-code').value, ncCode: document.getElementById('nc-code').value }));
check('快捷新增：寫入 CLIENTS 主檔（非僅下拉）', !!quick && quick.shortName === '快捷客戶' && quick.fullName === 'Quick Client', await lastToast(page));
check('快捷新增：回填案件客戶下拉並自動選取', qState.sel === 'ZQA2' && qState.optText === 'ZQA2 ｜ 快捷客戶（Quick Client）', qState);
check('快捷新增：自動產生個案編號', !!qState.caseCode, qState.caseCode);
check('快捷新增：快捷視窗關閉、新增個案視窗保留、欄位清空', !(await isOpen(page, 'modal-new-client')) && await isOpen(page, 'modal-new-case') && qState.ncCode === '');
await page.evaluate(() => closeModal('modal-new-case'));
await nav(page, 'clients');
check('快捷新增客戶出現在客戶主檔列表', (await page.locator('#cl-tbody').innerText()).includes('ZQA2'));

// ── Bridge: client → receivable ──
const bridgeClient = await page.evaluate(() => {
  const one = CLIENTS.find(c => CASES.filter(ca => ca.client === c.code).length === 1);
  const c = one || CLIENTS[0];
  const cs = CASES.filter(ca => ca.client === c.code);
  return { code: c.code, fullName: c.fullName, cases: cs.map(x => x.code) };
});
await page.locator('#cl-tbody tr', { hasText: bridgeClient.code }).first().locator('button', { hasText: '新增收款' }).click();
await page.waitForTimeout(400);
const rvState = await page.evaluate(() => ({ page: currentPage, open: document.getElementById('modal-add-receivable').classList.contains('open'), client: document.getElementById('rv-add-client').value, caseVal: document.getElementById('rv-add-case').value, buyer: document.getElementById('rv-add-buyer').value }));
check('客戶→應收：切到應收頁並開啟新增收款視窗', rvState.page === 'receivable' && rvState.open, rvState);
check('客戶→應收：帶入客戶代碼', rvState.client === bridgeClient.code, rvState);
check('客戶→應收：唯一案件自動帶入', bridgeClient.cases.length !== 1 || rvState.caseVal === bridgeClient.cases[0], { cases: bridgeClient.cases, got: rvState.caseVal });
check('客戶→應收：買受人由客戶主檔帶入', rvState.buyer === (bridgeClient.fullName || rvState.buyer), { expected: bridgeClient.fullName, got: rvState.buyer });
await page.evaluate(() => closeModal('modal-add-receivable'));

// ── Bridge: vendor → payreq ──
await nav(page, 'vendors');
await page.locator('#vd-tbody tr', { hasText: vs.code }).first().locator('button', { hasText: '發起請款' }).click();
await page.waitForTimeout(400);
const prState = await page.evaluate(() => ({ page: currentPage, open: document.getElementById('modal-payreq').classList.contains('open'), vendor: document.getElementById('pr-vendor').value }));
check('廠商→請款：切到廠商請款頁並開啟申請視窗', prState.page === 'payreq' && prState.open, prState);
check('廠商→請款：帶入「代碼 - 名稱」', prState.vendor === `${vs.code} - ${vs.name}`, prState);

// ── Picker click-to-clear ──
await page.locator('#pr-vendor').click();
check('請款 picker（pr-vendor）：有值時點擊清除', (await page.inputValue('#pr-vendor')) === '');
await page.locator('#pr-vendor').click();
check('請款 picker（pr-vendor）：空值時點擊不出錯', (await page.inputValue('#pr-vendor')) === '');
await page.fill('#pr-vendor', 'QA手動輸入');
await page.locator('#pr-vendor').click();
check('請款 picker（pr-vendor）：手動輸入後再點擊清除', (await page.inputValue('#pr-vendor')) === '');
await page.evaluate(() => closeModal('modal-payreq'));
await nav(page, 'payable');
await page.evaluate(() => openAddPayableModal());
check('新增應付視窗開啟', await isOpen(page, 'modal-add-payable'));
await page.fill('#ap-add-vendor', `${vs.code} - ${vs.name}`);
await page.locator('#ap-add-vendor').click();
check('應付 picker（ap-add-vendor）：有值時點擊清除', (await page.inputValue('#ap-add-vendor')) === '');
await page.locator('#ap-add-vendor').click();
check('應付 picker（ap-add-vendor）：空值時點擊不出錯', (await page.inputValue('#ap-add-vendor')) === '');
await page.evaluate(() => closeModal('modal-add-payable'));

// ── Persistence ──
await waitSynced(page);
const after = await counts(page);
check('其他集團筆數未被客戶/廠商操作改動', after.CASES === before.CASES && after.PAYABLES === before.PAYABLES && after.RECEIVABLES === before.RECEIVABLES && after.EXPENSES === before.EXPENSES, { before, after });
check('CLIENTS +2、VENDORS +1', after.CLIENTS === before.CLIENTS + 2 && after.VENDORS === before.VENDORS + 1, { before: [before.CLIENTS, before.VENDORS], after: [after.CLIENTS, after.VENDORS] });
const cloudHas = () => ({ clients: (cloud?.data?.CLIENTS || []).filter(c => ['ZQA1', 'ZQA2'].includes(c.code)).map(c => c.code + ':' + (c.contact || '')), vendor: (cloud?.data?.VENDORS || []).find(v => v.code === suggested) });
let ch = cloudHas();
check('mock 雲端快照已收到客戶/廠商變更', ch.clients.length === 2 && ch.vendor?.status === '有效' && cloud.meta.savedBy === 'shower.li@yutesign.com', { clients: ch.clients, vendorStatus: ch.vendor?.status });
await page.reload({ waitUntil: 'load' });
await waitReady(page);
const reloaded = await page.evaluate(code => ({ c1: CLIENTS.find(c => c.code === 'ZQA1')?.contact, c2: !!CLIENTS.find(c => c.code === 'ZQA2'), v: VENDORS.find(v => v.code === code)?.status }), suggested);
check('重新載入後客戶/廠商資料仍在', reloaded.c1 === 'QA聯絡人-改' && reloaded.c2 && reloaded.v === '有效', reloaded);
await nav(page, 'clients');
check('重新載入後客戶列表顯示新客戶', (await page.locator('#cl-tbody').innerText()).includes('ZQA2'));
await ctx.close();

// fresh context: no local cache at all, data must come from the (mock) cloud snapshot
ctx = await newContext('shower.li@yutesign.com');
page = await openApp(ctx);
const fresh = await page.evaluate(code => ({ c1: !!CLIENTS.find(c => c.code === 'ZQA1'), c2: !!CLIENTS.find(c => c.code === 'ZQA2'), v: !!VENDORS.find(v => v.code === code) }), suggested);
check('全新瀏覽器（無本機快取）從雲端快照讀回新資料', fresh.c1 && fresh.c2 && fresh.v, fresh);
await ctx.close();

// ═══════════ Scenario B: read-only (lu_yanchen: clients view_all, vendors view_all) ═══════════
currentScenario = 'B-readonly(lu_yanchen)';
ctx = await newContext('lu@yutesign.com');
page = await openApp(ctx);
const permB = await page.evaluate(() => ({ id: currentUser.id, clients: permissionLevel('clients'), vendors: permissionLevel('vendors'), receivable: permissionLevel('receivable'), payreq: permissionLevel('payreq') }));
check('權限：clients/vendors 為 view_all（唯讀）', permB.clients === 'view_all' && permB.vendors === 'view_all', permB);
await nav(page, 'clients');
check('唯讀：客戶頁可瀏覽', (await rowCount(page, 'cl-tbody')) > 0);
check('唯讀：隱藏「＋ 新增客戶」', !(await visible(page, '#btn-new-client')));
const clTxt = await page.locator('#cl-tbody').innerText();
check('唯讀：客戶列無「編輯」、顯示「唯讀」', !clTxt.includes('編輯') && clTxt.includes('唯讀'));
check('唯讀：客戶列無「新增收款」（receivable 非 manage）', !clTxt.includes('新增收款'));
await page.locator('#cl-tbody tr').first().locator('td').first().click();
check('唯讀：客戶詳情可開、編輯鈕隱藏', await isOpen(page, 'modal-client-detail') && !(await visible(page, '#cl-detail-edit-btn')));
await page.evaluate(() => closeModal('modal-client-detail'));
await clearToasts(page);
await page.evaluate(() => openClientModal());
check('唯讀：直接呼叫新增客戶被拒', !(await isOpen(page, 'modal-client')) && (await lastToast(page)) === '您沒有新增客戶的權限');
await page.evaluate(() => openClientModal('ZQA1'));
check('唯讀：直接呼叫編輯客戶被拒', !(await isOpen(page, 'modal-client')) && (await lastToast(page)) === '您沒有編輯客戶的權限');
const nB = await page.evaluate(() => CLIENTS.length);
await page.evaluate(() => { document.getElementById('cl-f-code').value = 'ZRO1'; document.getElementById('cl-f-shortName').value = 'x'; clEditCode = null; submitClient(); });
check('唯讀：直接呼叫 submitClient 被拒且未寫入', (await page.evaluate(() => CLIENTS.length)) === nB && (await lastToast(page)) === '您沒有新增客戶的權限');
await page.evaluate(() => { document.getElementById('nc-code').value = 'ZRO2'; document.getElementById('nc-name-zh').value = 'x'; submitNewClient(); });
check('唯讀：直接呼叫 submitNewClient 被拒且未寫入', (await page.evaluate(() => CLIENTS.length)) === nB && (await lastToast(page)) === '您沒有新增客戶的權限');
await page.evaluate(() => openReceivableForClient(CLIENTS[0].code));
await page.waitForTimeout(200);
check('唯讀：直接呼叫客戶→應收橋接被拒', !(await isOpen(page, 'modal-add-receivable')) && (await lastToast(page)) === '您沒有修改此資料的權限');
await nav(page, 'vendors');
check('唯讀：隱藏「＋ 新增廠商」', !(await visible(page, '#btn-new-vendor')));
const vdTxt = await page.locator('#vd-tbody').innerText();
check('唯讀：廠商列無「編輯」、顯示「唯讀」', !vdTxt.includes('編輯') && vdTxt.includes('唯讀'));
check('唯讀：廠商列仍有「發起請款」（payreq 可申請自己）', vdTxt.includes('發起請款') === (permB.payreq.endsWith('apply_self') || permB.payreq === 'manage'), permB.payreq);
await page.locator('#vd-tbody tr').first().locator('td').first().click();
check('唯讀：廠商詳情可開、編輯鈕隱藏', await isOpen(page, 'modal-vendor-detail') && !(await visible(page, '#vd-detail-edit-btn')));
await page.evaluate(() => closeModal('modal-vendor-detail'));
await clearToasts(page);
await page.evaluate(() => openVendorModal());
check('唯讀：直接呼叫新增廠商被拒', !(await isOpen(page, 'modal-vendor')) && (await lastToast(page)) === '您沒有此廠商的編輯權限');
const nVB = await page.evaluate(() => VENDORS.length);
await page.evaluate(() => { vdEditCode = null; document.getElementById('vd-f-code').value = 'ZRO-001'; document.getElementById('vd-f-name').value = 'x'; submitVendor(); });
check('唯讀：直接呼叫 submitVendor 被拒且未寫入', (await page.evaluate(() => VENDORS.length)) === nVB);
await ctx.close();

// ═══════════ Scenario C: apply-self (peng: vendors view_all_apply_self; clients overridden to view_all_apply_self in MOCK cloud only) ═══════════
currentScenario = 'C-applyself(peng)';
cloud.data.USER_PERMISSIONS.peng.clients = 'view_all_apply_self'; // mock-only test permission
ctx = await newContext('peng@yutesign.com');
page = await openApp(ctx);
const firstLoadBtn = await page.evaluate(() => getComputedStyle(document.getElementById('btn-new-client')).display !== 'none');
await page.reload({ waitUntil: 'load' }); await waitReady(page);
const permC = await page.evaluate(() => ({ id: currentUser.id, clients: permissionLevel('clients'), vendors: permissionLevel('vendors'), payreq: permissionLevel('payreq') }));
check('權限：clients/vendors 為 view_all_apply_self', permC.clients === 'view_all_apply_self' && permC.vendors === 'view_all_apply_self', { ...permC, newClientBtnOnFirstLoad: firstLoadBtn });
await nav(page, 'clients');
check('申請自己：顯示「＋ 新增客戶」', await visible(page, '#btn-new-client'));
const clTxtC = await page.locator('#cl-tbody').innerText();
check('申請自己：既有客戶仍無「編輯」（編輯需 manage）', !clTxtC.includes('編輯') && clTxtC.includes('唯讀'));
await clearToasts(page);
await page.click('#btn-new-client');
await page.fill('#cl-f-code', 'ZQA3');
await page.fill('#cl-f-shortName', '申請自己客戶');
await page.click('#modal-client button.btn-primary');
check('申請自己：可新增客戶', await page.evaluate(() => !!CLIENTS.find(c => c.code === 'ZQA3')) && (await lastToast(page)) === '新客戶已新增');
await page.evaluate(() => openClientModal('ZQA3'));
check('申請自己：不可編輯客戶（含自己新增的）', !(await isOpen(page, 'modal-client')) && (await lastToast(page)) === '您沒有編輯客戶的權限');
await nav(page, 'vendors');
check('申請自己：顯示「＋ 新增廠商」', await visible(page, '#btn-new-vendor'));
await page.click('#btn-new-vendor');
await page.selectOption('#vd-f-trade', vs.trade);
const pengCode = await page.inputValue('#vd-f-code');
await page.fill('#vd-f-name', '申請自己廠商');
await page.click('#modal-vendor button.btn-primary');
const pengV = await page.evaluate(code => VENDORS.find(v => v.code === code), pengCode);
check('申請自己：可新增廠商，createdBy 為本人', !!pengV && ['彭俞豪', 'peng@yutesign.com'].includes(pengV.createdBy), { code: pengCode, createdBy: pengV?.createdBy });
const ownRow = await page.locator('#vd-tbody tr', { hasText: pengCode }).innerText();
const otherRow = await page.locator('#vd-tbody tr', { hasText: vs.code }).first().innerText();
check('申請自己：自己建立的廠商顯示「編輯」', ownRow.includes('編輯'));
check('申請自己：他人建立的廠商顯示「唯讀」', otherRow.includes('唯讀') && !otherRow.includes('編輯'));
await page.locator('#vd-tbody tr', { hasText: pengCode }).locator('button', { hasText: '編輯' }).click();
await page.fill('#vd-f-note', 'peng edit');
await page.click('#modal-vendor button.btn-primary');
check('申請自己：可編輯自己建立的廠商', (await page.evaluate(code => VENDORS.find(v => v.code === code)?.note, pengCode)) === 'peng edit');
await clearToasts(page);
await page.evaluate(code => openVendorModal(code), vs.code);
check('申請自己：直接呼叫編輯他人廠商被拒', !(await isOpen(page, 'modal-vendor')) && (await lastToast(page)) === '您沒有此廠商的編輯權限');
await page.locator('#vd-tbody tr', { hasText: vs.code }).first().locator('td').first().click();
check('申請自己：他人廠商詳情編輯鈕隱藏', !(await visible(page, '#vd-detail-edit-btn')));
await page.evaluate(() => closeModal('modal-vendor-detail'));
await page.locator('#vd-tbody tr', { hasText: pengCode }).locator('td').first().click();
check('申請自己：自己廠商詳情編輯鈕顯示', await visible(page, '#vd-detail-edit-btn'));
await page.evaluate(() => closeModal('modal-vendor-detail'));
await waitSynced(page);
await page.reload({ waitUntil: 'load' }); await waitReady(page);
check('申請自己：重新載入後新增資料仍在', await page.evaluate(code => !!CLIENTS.find(c => c.code === 'ZQA3') && VENDORS.find(v => v.code === code)?.note === 'peng edit', pengCode));
await ctx.close();

// ═══════════ Scenario D: vendor delete + code-sorted vendor pickers (post-split feature) ═══════════
if (process.env.SKIP_POST_SPLIT !== '1') {
  currentScenario = 'D-delete+sort(shower)';
  ctx = await newContext('shower.li@yutesign.com');
  page = await openApp(ctx);
  const dialogs = [];
  let confirmAnswer = true;
  page.on('dialog', async d => { dialogs.push({ type: d.type(), message: d.message() }); if (d.type() === 'confirm' && !confirmAnswer) await d.dismiss(); else await d.accept(); });
  const sortedByCode = codes => codes.every((c, i) => i === 0 || codes[i - 1].localeCompare(c, 'zh-TW', { numeric: true }) <= 0);
  const dlCodes = id => page.$$eval(`#${id} option`, os => os.map(o => o.value.split(' - ')[0]));

  // pickers sorted by vendor code
  await nav(page, 'payable');
  await page.evaluate(() => openAddPayableModal());
  let apCodes = await dlCodes('dl-ap-vendors');
  const vendorTotal = await page.evaluate(() => VENDORS.length);
  check('新增應付：受款廠商選單依廠商代碼排序', apCodes.length === vendorTotal && sortedByCode(apCodes), { count: apCodes.length, first: apCodes.slice(0, 3), last: apCodes.slice(-3) });
  await page.evaluate(() => closeModal('modal-add-payable'));
  const editId = await page.evaluate(() => PAYABLES.find(p => p.status === 'paid')?.id);
  await page.evaluate(id => openEditPayableModal(id), editId);
  apCodes = await dlCodes('dl-ap-vendors');
  check('編輯應付：受款廠商選單依廠商代碼排序', apCodes.length === vendorTotal && sortedByCode(apCodes), { id: editId, count: apCodes.length });
  await page.evaluate(() => closeModal('modal-add-payable'));
  await page.evaluate(() => openPayreqModal());
  const prCodes = await dlCodes('dl-vendors');
  check('廠商請款：廠商選單依廠商代碼排序（原本已排序）', sortedByCode(prCodes) && prCodes.length === vendorTotal);
  await page.evaluate(() => closeModal('modal-payreq'));

  // a new vendor appears in its code position, not at the bottom
  await nav(page, 'vendors');
  await page.click('#btn-new-vendor');
  check('新增模式不顯示「刪除廠商」', !(await visible(page, '#vd-delete-btn')));
  await page.selectOption('#vd-f-trade', '假設及拆運');
  const delCode = await page.inputValue('#vd-f-code');
  await page.fill('#vd-f-name', 'QA待刪除廠商');
  await page.click('#modal-vendor button.btn-primary');
  await page.evaluate(() => openAddPayableModal());
  apCodes = await dlCodes('dl-ap-vendors');
  const pos = apCodes.indexOf(delCode);
  check('新建廠商在受款廠商選單中依代碼排在同前綴位置（不在最後）', pos >= 0 && pos < apCodes.length - 1 && sortedByCode(apCodes), { code: delCode, pos, of: apCodes.length });
  await page.evaluate(() => closeModal('modal-add-payable'));
  await nav(page, 'vendors');

  // referenced vendor cannot be deleted
  const refVendor = await page.evaluate(() => { const v = VENDORS.find(v => !VENDOR_AUTO_RESTORED_CODES.includes(v.code) && !VENDOR_AUTO_RESTORED_NAMES.includes(v.name) && vendorPayableReferences(v).length > 0); return v && { code: v.code, name: v.name, refs: vendorPayableReferences(v).length }; });
  await page.locator('#vd-tbody tr', { hasText: refVendor.code }).first().locator('button', { hasText: '編輯' }).click();
  check('編輯既有廠商顯示「刪除廠商」（manage）', await visible(page, '#vd-delete-btn'));
  dialogs.length = 0;
  await page.click('#vd-delete-btn');
  const refStill = await page.evaluate(code => !!VENDORS.find(v => v.code === code), refVendor.code);
  check('有應付／請款紀錄的廠商不能刪除', refStill && dialogs[0]?.type === 'alert' && dialogs[0].message.includes(`已有 ${refVendor.refs} 筆應付／請款紀錄使用`), { vendor: refVendor, dialog: dialogs[0]?.message?.split('\n')[0] });
  await page.evaluate(() => closeModal('modal-vendor'));

  // auto-restored vendor cannot be deleted
  const autoCode = await page.evaluate(() => VENDORS.find(v => VENDOR_AUTO_RESTORED_CODES.includes(v.code) || VENDOR_AUTO_RESTORED_NAMES.includes(v.name))?.code);
  dialogs.length = 0;
  await page.evaluate(code => deleteVendor(code), autoCode);
  check('系統會自動補回的內建廠商不能刪除', await page.evaluate(code => !!VENDORS.find(v => v.code === code), autoCode) && dialogs[0]?.message.includes('系統內建廠商'), { code: autoCode });

  // cancel then confirm delete
  await page.locator('#vd-tbody tr', { hasText: delCode }).locator('button', { hasText: '編輯' }).click();
  dialogs.length = 0; confirmAnswer = false;
  await page.click('#vd-delete-btn');
  check('刪除確認按取消：廠商保留', dialogs[0]?.type === 'confirm' && await page.evaluate(code => !!VENDORS.find(v => v.code === code), delCode) && await isOpen(page, 'modal-vendor'));
  confirmAnswer = true; dialogs.length = 0;
  const auditBefore = await page.evaluate(() => AUDIT_LOGS.length);
  await page.click('#vd-delete-btn');
  const afterDel = await page.evaluate(code => ({ exists: !!VENDORS.find(v => v.code === code), audit: AUDIT_LOGS[0], auditLen: AUDIT_LOGS.length, edit: vdEditCode }), delCode);
  check('刪除確認：廠商移除、視窗關閉、列表不再出現', !afterDel.exists && !(await isOpen(page, 'modal-vendor')) && !(await page.locator('#vd-tbody').innerText()).includes(delCode) && (await lastToast(page)) === '已刪除廠商「QA待刪除廠商」');
  check('刪除寫入審計紀錄（含刪除前完整資料）', afterDel.auditLen === auditBefore + 1 && afterDel.audit.action === 'delete' && afterDel.audit.targetType === 'vendor' && afterDel.audit.targetId === delCode && afterDel.audit.before?.name === 'QA待刪除廠商' && afterDel.audit.riskLevel === 'high', { action: afterDel.audit.action, targetId: afterDel.audit.targetId, actor: afterDel.audit.actorEmail });
  check('刪除後 vdEditCode 清空', afterDel.edit === null);
  const countsAfterDel = await counts(page);
  await waitSynced(page);
  check('mock 雲端快照已移除該廠商、保留審計', !(cloud.data.VENDORS || []).some(v => v.code === delCode) && (cloud.data.AUDIT_LOGS || []).some(a => a.action === 'delete' && a.targetId === delCode));
  await page.reload({ waitUntil: 'load' }); await waitReady(page);
  check('重新載入後被刪廠商不會回來', !(await page.evaluate(code => !!VENDORS.find(v => v.code === code), delCode)));
  await ctx.close();
  ctx = await newContext('shower.li@yutesign.com');
  page = await openApp(ctx);
  const freshD = await page.evaluate(code => !!VENDORS.find(v => v.code === code), delCode);
  const countsFresh = await counts(page);
  check('全新瀏覽器（只讀雲端）被刪廠商也不會回來', !freshD && countsFresh.VENDORS === countsAfterDel.VENDORS, { vendors: countsFresh.VENDORS });
  check('刪除廠商不影響案件／應付／應收／費用筆數', ['CASES', 'PAYABLES', 'RECEIVABLES', 'EXPENSES'].every(k => countsFresh[k] === countsAfterDel[k]));
  await ctx.close();

  // apply-self: can delete own vendor only; read-only: cannot delete
  currentScenario = 'E-delete-permissions';
  ctx = await newContext('peng@yutesign.com');
  page = await openApp(ctx);
  page.on('dialog', d => d.accept());
  await nav(page, 'vendors');
  await page.click('#btn-new-vendor');
  await page.selectOption('#vd-f-trade', '假設及拆運');
  const pengDel = await page.inputValue('#vd-f-code');
  await page.fill('#vd-f-name', 'QA申請自己待刪');
  await page.click('#modal-vendor button.btn-primary');
  await clearToasts(page);
  const otherCode = await page.evaluate(() => VENDORS.find(v => !v.createdBy && vendorPayableReferences(v).length === 0 && !VENDOR_AUTO_RESTORED_CODES.includes(v.code) && !VENDOR_AUTO_RESTORED_NAMES.includes(v.name))?.code);
  await page.evaluate(code => deleteVendor(code), otherCode);
  check('申請自己：不能刪除他人建立的廠商', await page.evaluate(code => !!VENDORS.find(v => v.code === code), otherCode) && (await lastToast(page)) === '您沒有刪除此廠商的權限', { code: otherCode });
  await page.locator('#vd-tbody tr', { hasText: pengDel }).locator('button', { hasText: '編輯' }).click();
  check('申請自己：自己建立的廠商顯示「刪除廠商」', await visible(page, '#vd-delete-btn'));
  await page.click('#vd-delete-btn');
  check('申請自己：可刪除自己建立且未使用的廠商', !(await page.evaluate(code => !!VENDORS.find(v => v.code === code), pengDel)));
  await waitSynced(page);
  await ctx.close();
  ctx = await newContext('lu@yutesign.com');
  page = await openApp(ctx);
  await clearToasts(page);
  await page.evaluate(code => deleteVendor(code), otherCode);
  check('唯讀：直接呼叫 deleteVendor 被拒', await page.evaluate(code => !!VENDORS.find(v => v.code === code), otherCode) && (await lastToast(page)) === '您沒有刪除此廠商的權限');
  await ctx.close();
}

await browser.close();
server.close();

const out = {
  label, rootDir, results, consoleLog,
  blockedExternal: blocked, mockedExternal: [...new Set(mocked)],
  served: [...new Set(served.map(s => `${s.status} ${s.path}`))],
  cloudWrites: cloudWrites.length,
  cloudWriteSources: [...new Set(cloudWrites.map(w => w.source))],
};
fs.writeFileSync(outJson, JSON.stringify(out, null, 2));
const fails = results.filter(r => !r.pass).length;
console.log(`\n${label}: ${results.length - fails}/${results.length} passed; app console errors/warnings/pageerrors (excluding harness-blocked resources): ${consoleLog.filter(c => !c.text.includes('ERR_BLOCKED_BY_CLIENT')).length}; blocked external: ${blocked.length}`);
process.exit(fails ? 1 : 0);
