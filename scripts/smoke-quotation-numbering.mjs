// Quotation row numbers (claude/quotation-section-numbering): the on-screen quote table numbers items from 1 in every
// section, exactly like the PDF 報價明細表. Mock Google/Firebase only; never touches production or the real Drive.
//
// Setup (outside the repo):  mkdir /tmp/ops-smoke && cd /tmp/ops-smoke && npm i playwright-core
// Run:  PLAYWRIGHT_CORE=/tmp/ops-smoke/node_modules/playwright-core/index.mjs \
//         node scripts/smoke-quotation-numbering.mjs <label> <rootDir> <port> <out.json> [screenshot.png]
import { createHarness } from './smoke-lib.mjs';

const [label, rootDir, portArg, outJson, shot] = process.argv.slice(2);
const H = await createHarness({ label, rootDir, port: Number(portArg) });
const { check, newContext } = H;
const ORIGIN = `http://127.0.0.1:${portArg}`;

H.setScenario('Q-numbering');
const ctx = await newContext('shower.li@yutesign.com', { fixedTime: new Date('2026-10-25T15:40:00+08:00') });
await ctx.addInitScript(() => {
  try { if (!localStorage.getItem('yutesign_session')) localStorage.setItem('yutesign_session', JSON.stringify({ email: 'shower.li@yutesign.com', loginTime: Date.now() })); } catch (e) {}
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('dialog', d => d.accept());
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(`${ORIGIN}/`, { waitUntil: 'load' });
await page.waitForFunction(() => typeof renderQuote === 'function' && document.getElementById('mainApp')?.style.display !== 'none', null, { timeout: 15000 });
await page.waitForTimeout(400);

// 兩個大項各挑幾個工項，刻意交錯加入，確認畫面依大項分組後各自從 1 開始。
await page.evaluate(() => {
  quoteItems.length = 0;
  const byCat = cat => dbItems.filter(d => (d['類別'] || d.cat || '') === cat);
  const cats = [...new Set(dbItems.map(d => d['類別'] || d.cat || ''))].filter(Boolean);
  const a = byCat(cats[0]).slice(0, 4), b = byCat(cats[1]).slice(0, 3);
  [a[0], b[0], a[1], b[1], a[2], b[2], a[3]].filter(Boolean).forEach(it => addItem(it));
  renderQuote();
});
const read = () => page.evaluate(() => {
  const screen = [];
  let cat = '';
  document.querySelectorAll('#rightContent .section-header, #rightContent .quote-row').forEach(el => {
    if (el.classList.contains('section-header')) { cat = el.querySelector('.section-title').firstChild.textContent.trim(); return; }
    screen.push([cat, el.querySelector('.row-input.row-name').value, el.querySelector('.row-num').textContent.replace(/[⠿✓]/g, '').trim()]);
  });
  const doc = new DOMParser().parseFromString(buildPrintDoc(), 'text/html');
  const pdf = [];
  let pcat = '';
  doc.querySelectorAll('tr').forEach(tr => {
    const tds = tr.querySelectorAll('td');
    if (tds.length === 1 && /^.+、/.test(tds[0].textContent.trim()) && tr.textContent.includes('、')) { pcat = tds[0].textContent.trim().replace(/^[^、]+、/, ''); return; }
    if (tds.length === 7 && /^\d+$/.test(tds[0].textContent.trim()) && pcat) pdf.push([pcat, tds[1].textContent.trim(), tds[0].textContent.trim()]);
  });
  return { screen, pdf };
});
const r = await read();
const firstOfSection = r.screen.filter((row, i) => i === 0 || r.screen[i - 1][0] !== row[0]).map(row => row[2]);
check('畫面上每個大項的第一個工項都是 1', firstOfSection.length >= 2 && firstOfSection.every(n => n === '1'), { firstOfSection, screen: r.screen });
check('畫面項次與 PDF 報價明細表逐列相同（大項、工項名稱、項次）', JSON.stringify(r.screen) === JSON.stringify(r.pdf), r);

// 搜尋只剩部分工項時，仍顯示該工項在大項裡原本的項次（和 PDF 一樣）。
const target = r.screen.find((row, i) => i > 0 && row[2] !== '1');
await page.evaluate(name => { document.getElementById('quoteSearch').value = name; renderQuote(); }, target[1]);
const filtered = (await read()).screen;
check('搜尋時項次維持原本的數字（不重新從 1 數）', filtered.length >= 1 && filtered.some(row => row[1] === target[1] && row[2] === target[2]), { target, filtered });
await page.evaluate(() => { document.getElementById('quoteSearch').value = ''; renderQuote(); });

// 標記已審閱（✓）的工項，項次不變。
await page.evaluate(() => { const id = quoteItems[1].id; reviewedIds.add(id); renderQuote(); });
check('已審閱（✓）的工項項次不變', JSON.stringify((await read()).screen) === JSON.stringify(r.screen));
if (shot) await page.screenshot({ path: shot });
check('沒有頁面錯誤', errors.length === 0, errors);
await ctx.close();

const fails = await H.finish(outJson);
process.exit(fails ? 1 : 0);
