// Quotation item database merge (claude/quotation-item-db-merge): new built-in items (quotation/js/addeditems.js) reach
// every browser without discarding the prices people edited in 編輯工項, and an item a user deleted is not re-added.
// Mock Google/Firebase only; never touches production or the real Drive.
//
// Setup (outside the repo):  mkdir /tmp/ops-smoke && cd /tmp/ops-smoke && npm i playwright-core
// Run:  PLAYWRIGHT_CORE=/tmp/ops-smoke/node_modules/playwright-core/index.mjs \
//         node scripts/smoke-quotation-item-db.mjs <label> <rootDir> <port> <out.json>
import { createHarness } from './smoke-lib.mjs';

const [label, rootDir, portArg, outJson] = process.argv.slice(2);
const H = await createHarness({ label, rootDir, port: Number(portArg) });
const { check, newContext } = H;
const ORIGIN = `http://127.0.0.1:${portArg}`;

async function open(ctx) {
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('dialog', d => d.accept());
  await page.goto(`${ORIGIN}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof renderQuote === 'function' && document.getElementById('mainApp')?.style.display !== 'none', null, { timeout: 15000 });
  await page.waitForTimeout(300);
  return { page, errors };
}
const session = () => { try { localStorage.setItem('yutesign_session', JSON.stringify({ email: 'shower.li@yutesign.com', loginTime: Date.now() })); } catch (e) {} };

// ── 1. 全新的瀏覽器：拿到內建清單加新增工項 ──
H.setScenario('Q-db-fresh');
let ctx = await newContext('shower.li@yutesign.com', { fixedTime: new Date('2026-10-26T17:00:00+08:00') });
await ctx.addInitScript(session);
let { page, errors } = await open(ctx);
const fresh = await page.evaluate(() => ({ db: dbItems.length, defaults: DEFAULT_ITEMS.length, added: ADDED_ITEMS.length, hasShoe: dbItems.some(i => i['工項名稱'] === 'Panasonic旋轉鞋架五金（含安裝）'), cat: dbItems.find(i => i['工項名稱'] === '玄關展示櫃（深22cm）')?.['類別'] }));
check('全新瀏覽器：資料庫＝內建清單＋新增工項，新工項的類別已轉成報價大項', fresh.added > 0 && fresh.db === fresh.defaults && fresh.hasShoe && fresh.cat === '木作及系統櫃工程', fresh);
check('沒有頁面錯誤（全新）', errors.length === 0, errors);
await ctx.close();

// ── 2. 舊電腦：存著舊版資料庫（舊版本號、改過單價、自訂工項） ──
H.setScenario('Q-db-existing');
ctx = await newContext('shower.li@yutesign.com', { fixedTime: new Date('2026-10-26T17:00:00+08:00') });
await ctx.addInitScript(session);
await ctx.addInitScript(() => {
  if (sessionStorage.getItem('qa-seeded')) return;
  sessionStorage.setItem('qa-seeded', '1');
  // 模擬上線前的瀏覽器：舊版本號、只有舊的內建工項、第 4 筆改過單價、多一筆自己加的工項。
  window.__seedOld = true;
});
({ page, errors } = await open(ctx));
const seeded = await page.evaluate(() => {
  const added = new Set(ADDED_ITEMS.map(i => i['工項名稱']));
  const old = DEFAULT_ITEMS.filter(i => !added.has(i['工項名稱'])).map(i => ({ ...i, 類別: mapCat(i['類別']) }));
  old[3] = { ...old[3], 參考單價: 12345 };
  old.push({ 類別: '木作及系統櫃工程', 工項名稱: 'QA 自己加的工項', 單位: '式', 參考單價: 777, 最低單價: 777, 最高單價: 777 });
  localStorage.setItem('yutesign_db', JSON.stringify(old));
  localStorage.setItem('yutesign_db_ver', '2026050505');
  localStorage.removeItem('yutesign_db_seen');
  return { oldCount: old.length, edited: old[3]['工項名稱'] };
});
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => typeof renderQuote === 'function', null, { timeout: 15000 });
await page.waitForTimeout(300);
const merged = await page.evaluate(({ edited }) => ({ db: dbItems.length, added: ADDED_ITEMS.length, editedPrice: dbItems.find(i => i['工項名稱'] === edited)?.['參考單價'], custom: dbItems.some(i => i['工項名稱'] === 'QA 自己加的工項'), hasShoe: dbItems.some(i => i['工項名稱'] === 'Panasonic旋轉鞋架五金（含安裝）'), ver: localStorage.getItem('yutesign_db_ver') }), seeded);
check('舊電腦：改過的單價保留（12,345）', merged.editedPrice === 12345, merged);
check('舊電腦：自己加的工項保留', merged.custom, merged);
check('舊電腦：補上全部新增工項，總數＝舊資料＋新增', merged.hasShoe && merged.db === seeded.oldCount + merged.added, { merged, seeded });

// ── 3. 自己刪掉新增工項後重新整理：不會被補回 ──
await page.evaluate(() => { dbItems = dbItems.filter(i => i['工項名稱'] !== 'Panasonic旋轉鞋架五金（含安裝）'); saveDb(); });
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => typeof renderQuote === 'function', null, { timeout: 15000 });
await page.waitForTimeout(300);
const afterDelete = await page.evaluate(() => ({ hasShoe: dbItems.some(i => i['工項名稱'] === 'Panasonic旋轉鞋架五金（含安裝）'), editedKept: dbItems.some(i => i['參考單價'] === 12345) }));
check('自己刪掉的工項，重新整理後不會被補回；改過的單價仍在', !afterDelete.hasShoe && afterDelete.editedKept, afterDelete);

// ── 4. 搜尋找得到新工項，可直接加入報價單 ──
const found = await page.evaluate(() => { document.getElementById('searchInput').value = '展示櫃'; onSearch(); const list = getFilteredItems().map(i => i['工項名稱']); const it = dbItems.find(i => i['工項名稱'] === '玄關展示櫃（深22cm）'); quoteItems.length = 0; addItem(it); return { list, added: quoteItems[0] && { name: quoteItems[0].name, price: quoteItems[0].price, cat: quoteItems[0].cat } }; });
check('搜尋「展示櫃」找得到新工項，加入報價單時單價、大項正確', found.list.includes('玄關展示櫃（深22cm）') && found.added?.price === 5000 && found.added?.cat === '木作及系統櫃工程', found);
check('沒有頁面錯誤（舊電腦）', errors.length === 0, errors);
await ctx.close();

const fails = await H.finish(outJson);
process.exit(fails ? 1 : 0);
