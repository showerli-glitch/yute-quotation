// Quotation system smoke test. Mock Google/Firebase only; never touches production or the real Drive.
//
// Setup (outside the repo):  mkdir /tmp/ops-smoke && cd /tmp/ops-smoke && npm i playwright-core
// Run:  PLAYWRIGHT_CORE=/tmp/ops-smoke/node_modules/playwright-core/index.mjs \
//         node scripts/smoke-quotation.mjs <label> <rootDir> <port> <out.json>
// Run it on two trees (for example main@655fd20 in a worktree and the split branch) and compare the
// `observations` objects: the split must not change any of them.
import { createHarness } from './smoke-lib.mjs';
import crypto from 'node:crypto';

const [label, rootDir, portArg, outJson] = process.argv.slice(2);
const H = await createHarness({ label, rootDir, port: Number(portArg) });
const { check, newContext } = H;
const ORIGIN = `http://127.0.0.1:${portArg}`;
const NOW = new Date('2026-10-06T14:00:00+08:00');
const hash = s => crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 16);
const obs = {};

async function openQuote(ctx) {
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('dialog', d => d.accept());
  await page.goto(`${ORIGIN}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof renderQuote === 'function' && document.getElementById('mainApp')?.style.display !== 'none', null, { timeout: 15000 });
  await page.waitForTimeout(500);
  return { page, errors };
}

H.setScenario('Q-quotation');
const ctx = await newContext('shower.li@yutesign.com', { fixedTime: NOW });
await ctx.addInitScript(() => {
  try { if (!localStorage.getItem('yutesign_session')) localStorage.setItem('yutesign_session', JSON.stringify({ email: 'shower.li@yutesign.com', loginTime: Date.now() })); } catch (e) {}
});
let { page, errors } = await openQuote(ctx);

obs.loaded = await page.evaluate(() => ({
  main: document.getElementById('mainApp').style.display, login: document.getElementById('loginScreen').style.display,
  db: dbItems.length, cats: getCats().length, tabs: document.querySelectorAll('#catTabs *').length, list: document.querySelectorAll('#itemList > *').length,
  mode, sections: SECTION_ORDER.length, version: DB_VERSION,
}));
check('登入狀態下直接顯示主畫面、工項資料庫載入', obs.loaded.main === '' && obs.loaded.login === 'none' && obs.loaded.db > 100, obs.loaded);

await page.fill('#searchInput', '油漆'); await page.evaluate(() => onSearch());
obs.search = await page.evaluate(() => ({ n: getFilteredItems().length, shown: document.querySelectorAll('#itemList > *').length }));
check('搜尋工項', obs.search.n > 0, obs.search);
await page.fill('#searchInput', ''); await page.evaluate(() => onSearch());

obs.quote = await page.evaluate(() => {
  const picks = [0, 7, 30, 61, 95, 140].map(i => dbItems[i]).filter(Boolean);
  picks.forEach(it => addItem(it));
  const ids = quoteItems.map(q => q.id);
  updateField(ids[0], 'qty', 12); updateField(ids[1], 'price', 3456); updateField(ids[2], 'qty', 2.5);
  document.getElementById('mgmtFee').value = '8'; renderQuote();
  addMiscItem(); renderMiscItems();
  const calc = getCalc();
  return { n: quoteItems.length, names: quoteItems.map(q => q['工項名稱'] || q.name || ''), calc, sections: Object.keys(getSections()), grand: document.body.innerText.match(/\$?[\d,]{4,}/g)?.slice(0, 6) };
});
check('加入工項、改數量與單價、管理費：計算結果', obs.quote.n === 6 && obs.quote.calc.total > 0, obs.quote.calc);

obs.undo = await page.evaluate(() => { const before = quoteItems.length; removeItem(quoteItems[0].id); const after = quoteItems.length; undo(); const undone = quoteItems.length; redo(); const redone = quoteItems.length; undo(); return [before, after, undone, redone, quoteItems.length]; });
check('刪除後復原／重做', JSON.stringify(obs.undo) === '[6,5,6,5,6]', obs.undo);

obs.modes = await page.evaluate(() => { toggleCleanMode(); const c = getCalc().total; toggleCleanMode(); toggleDesignMode(); const d = getCalc().total; toggleDesignMode(); return { clean: c, design: d, back: getCalc().total }; });
check('清潔費／設計費模式切換後總計可重算、切回後與原本相同', obs.modes.back === obs.quote.calc.total, obs.modes);

obs.remarks = await page.evaluate(() => { const n = remarksItems.length; addRemark(); return [n, remarksItems.length]; });

obs.edit = await page.evaluate(() => { setMode('edit'); updateDbItem(3, '參考單價', 999); saveDb(); const saved = JSON.parse(localStorage.getItem('yutesign_db'))[3]; setMode('quote'); return { price: saved['參考單價'], mode }; });
check('編輯模式改單價並存到本機', String(obs.edit.price) === '999', obs.edit);

obs.print = await page.evaluate(() => { const html = buildPrintDoc(); return { len: html.length }; });
obs.printHash = hash((await page.evaluate(() => buildPrintDoc())).replace(/\d{13}\.\d+/g, 'ID'));
check('列印版型產生內容', obs.print.len > 1000, obs.print);

obs.json = hash(await page.evaluate(() => { const d = JSON.parse(buildQuoteJson()); const strip = v => Array.isArray(v) ? v.map(strip) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).filter(([k]) => k !== 'id').map(([k, x]) => [k, strip(x)])) : v; return JSON.stringify(strip(d)); }));
obs.state = hash(await page.evaluate(() => (localStorage.getItem('yutesign_quote') || '').replace(/\d{13}\.\d+/g, 'ID')));

await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => typeof renderQuote === 'function', null, { timeout: 15000 });
await page.waitForTimeout(400);
obs.reload = await page.evaluate(() => ({ n: quoteItems.length, total: getCalc().total, db3: dbItems[3]['參考單價'] }));
check('重新整理後報價單與修改過的單價都還在', obs.reload.n === 6 && String(obs.reload.db3) === '999', obs.reload);
check('沒有頁面錯誤', errors.length === 0, errors);
obs.errors = errors.length;
await ctx.close();


// ═══════════ PWA (only on the PWA branch; not part of the split comparison) ═══════════
const hasPwa = await (async () => { try { return (await fetch(`${ORIGIN}/quotation-sw.js`)).ok; } catch (e) { return false; } })();
if (hasPwa) {
  H.setScenario('Q-pwa');
  const pctx = await newContext('shower.li@yutesign.com', { fixedTime: NOW, serviceWorkers: 'allow' });
  await pctx.addInitScript(() => { try { if (!localStorage.getItem('yutesign_session')) localStorage.setItem('yutesign_session', JSON.stringify({ email: 'shower.li@yutesign.com', loginTime: Date.now() })); } catch (e) {} });
  const p2 = await pctx.newPage();
  await p2.setViewportSize({ width: 390, height: 844 });
  await p2.goto(`${ORIGIN}/`, { waitUntil: 'load' });
  await p2.waitForFunction(() => typeof renderQuote === 'function', null, { timeout: 15000 });
  const head = await p2.evaluate(async () => ({ manifest: document.querySelector('link[rel=manifest]')?.getAttribute('href'), apple: document.querySelector('link[rel=apple-touch-icon]')?.getAttribute('href'), title: document.querySelector('meta[name=apple-mobile-web-app-title]')?.content, m: await (await fetch('quotation.webmanifest')).json() }));
  check('報價系統 manifest：獨立名稱「宇德報價」、相對路徑、與 OPS 不同的 id', /^quotation\.webmanifest\?v=[0-9a-f]{8}$/.test(head.manifest) && head.m.short_name === '宇德報價' && head.m.start_url === './' && head.m.display === 'standalone' && /apple-touch-icon\.png\?v=/.test(head.apple) && head.title === '宇德報價', head);
  const icons = await p2.evaluate(async icons => Promise.all(icons.map(i => new Promise(res => { const im = new Image(); im.onload = () => res(i.src + ':' + im.naturalWidth); im.onerror = () => res(i.src + ':error'); im.src = i.src; }))), head.m.icons);
  check('圖示存在且尺寸正確', JSON.stringify(icons) === JSON.stringify(['quotation/icons/icon-192.png:192', 'quotation/icons/icon-512.png:512', 'quotation/icons/icon-maskable-512.png:512']), icons);
  const reg = await p2.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); if (!r) return null; const sw = r.active || r.waiting || r.installing; if (sw && sw.state !== 'activated') await new Promise(res => sw.addEventListener('statechange', () => sw.state === 'activated' && res())); return { scope: new URL(r.scope).pathname }; });
  check('手機寬度：註冊報價系統的 service worker', reg && reg.scope === '/', reg);
  await p2.reload({ waitUntil: 'load' }); await p2.waitForTimeout(800);
  const opsUntouched = await p2.evaluate(async () => { await fetch('ops/index.html'); await fetch('ops/sw.js'); await new Promise(r => setTimeout(r, 300)); const keys = await caches.keys(); const urls = []; for (const k of keys) { const c = await caches.open(k); (await c.keys()).forEach(r => urls.push(new URL(r.url).pathname)); } return { keys, opsCached: urls.filter(u => u.startsWith('/ops/')), shell: urls.filter(u => u.startsWith('/quotation/')).length }; });
  check('service worker 不碰 OPS（ops/ 底下的請求不進快取）、只快取報價系統檔案', opsUntouched.keys.every(k => k.startsWith('quotation-shell-')) && opsUntouched.opsCached.length === 0 && opsUntouched.shell >= 8, opsUntouched);
  const sess = await p2.evaluate(() => SESSION_HOURS);
  check('報價系統登入時間 8 小時', sess === 8, sess);
  const navs = [];
  p2.on('request', r => { if (r.url().startsWith('https://accounts.google.com/o/oauth2/v2/auth')) navs.push(r.url()); });
  await p2.evaluate(() => { window.__forceStandalone = true; startLogin(); });
  await p2.waitForTimeout(800);
  const u = navs[0] ? new URL(navs[0]) : null;
  check('已安裝 app：登入改整頁前往 Google（同一個用戶端、回到網站根目錄、含雲端硬碟範圍）', !!u && u.searchParams.get('client_id').startsWith('239869421522-') && new URL(u.searchParams.get('redirect_uri')).pathname === '/' && u.searchParams.get('response_type') === 'token' && /drive\.file/.test(u.searchParams.get('scope')) && /^login\./.test(u.searchParams.get('state')), navs[0] || 'none');
  await pctx.close();
  const c3 = await newContext('shower.li@yutesign.com', { fixedTime: NOW });
  await c3.addInitScript(() => { try { if (!localStorage.getItem('yutesign_session')) localStorage.setItem('yutesign_session', JSON.stringify({ email: 'shower.li@yutesign.com', loginTime: Date.now() })); } catch (e) {} });
  const p3 = await c3.newPage();
  await p3.goto(`${ORIGIN}/`, { waitUntil: 'load' });
  await p3.waitForFunction(() => typeof renderQuote === 'function', null, { timeout: 15000 });
  const ret = await p3.evaluate(async () => {
    localStorage.setItem('yutesign_quote_oauth_pending', JSON.stringify({ state: 'drive.ok', purpose: 'drive', at: Date.now() }));
    history.replaceState(null, '', location.pathname + '#access_token=tok-ok&state=drive.ok');
    driveAccessToken = null; qpwaHandleReturn();
    const ok = { token: driveAccessToken, hash: location.hash };
    localStorage.setItem('yutesign_quote_oauth_pending', JSON.stringify({ state: 'drive.real', purpose: 'drive', at: Date.now() }));
    history.replaceState(null, '', location.pathname + '#access_token=tok-bad&state=drive.forged');
    driveAccessToken = null; qpwaHandleReturn();
    return { ok, forged: driveAccessToken, hash2: location.hash };
  });
  check('從 Google 回來：state 相符才採用 token，網址的 token 立刻清掉', ret.ok.token === 'tok-ok' && ret.ok.hash === '' && ret.forged === null && ret.hash2 === '', ret);
  const login = await p3.evaluate(async () => { document.getElementById('mainApp').style.display = 'none'; document.getElementById('loginScreen').style.display = ''; await qpwaCompleteLogin('mock-access-token'); return { main: document.getElementById('mainApp').style.display, login: document.getElementById('loginScreen').style.display, token: driveAccessToken, session: JSON.parse(localStorage.getItem('yutesign_session')).email }; });
  check('整頁轉址登入的後續步驟完成（進入主畫面、記住 8 小時登入）', login.main === '' && login.login === 'none' && login.token === 'mock-access-token' && login.session === 'shower.li@yutesign.com', login);
  const ver = await p3.evaluate(async () => { const cur = qpwaCurrentStamp(); const real = window.fetch; const html = await (await real(location.pathname, { cache: 'no-store' })).text(); window.fetch = async () => new Response(html); const same = await qpwaCheckNewVersion(); window.fetch = async () => new Response(html.replaceAll('?v=' + cur, '?v=deadbeef')); const diff = await qpwaCheckNewVersion(); window.fetch = real; return { cur, same, diff, banner: document.getElementById('qpwa-new-version')?.textContent || '' }; });
  check('新版提示：版本相同不提示、不同時顯示「立即重新整理」', /^[0-9a-f]{8}$/.test(ver.cur) && ver.same === false && ver.diff === true && ver.banner.includes('立即重新整理'), ver);
  await c3.close();
}

const fails = await H.finish(outJson, { observations: obs, observationsHash: hash(JSON.stringify(obs)) });
console.log('observations hash', hash(JSON.stringify(obs)));
process.exit(fails ? 1 : 0);
