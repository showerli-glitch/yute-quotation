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

const fails = await H.finish(outJson, { observations: obs, observationsHash: hash(JSON.stringify(obs)) });
console.log('observations hash', hash(JSON.stringify(obs)));
process.exit(fails ? 1 : 0);
