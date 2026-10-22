// 應收帳款「開票待辦」desktop panel (claude/invoice-request-compact): a one-line bar that collapses when nothing is
// pending, expands when requests wait, remembers the user's choice and re-expands when a new request arrives.
// Mock cloud only; never touches production.
//
// Setup (outside the repo):  mkdir /tmp/ops-smoke && cd /tmp/ops-smoke && npm i playwright-core
// Run:  PLAYWRIGHT_CORE=/tmp/ops-smoke/node_modules/playwright-core/index.mjs \
//         node scripts/smoke-invoice-panel.mjs <label> <rootDir> <port> <out.json>
import { createHarness } from './smoke-lib.mjs';

const [label, rootDir, portArg, outJson] = process.argv.slice(2);
const H = await createHarness({ label, rootDir, port: Number(portArg) });
const { check, newContext, openApp } = H;

H.setScenario('A-manage(shower)');
const ctx = await newContext('shower.li@yutesign.com', { fixedTime: new Date('2026-10-22T11:20:00+08:00') });
const page = await openApp(ctx);
await page.setViewportSize({ width: 1440, height: 760 });
const issued = (id, no) => ({ id, status: 'issued', buyerName: '凱銳北區汽車股份有限公司', itemText: '電控馬達更換', amount: 3675, invoiceNo: no, invoiceDate: '2026-10-22', requestedBy: 'shower', requestedByName: '李鎮宇', requestedAt: `2026-10-2${id % 10}T01:00:00Z` });
const pending = id => ({ id, status: 'requested', caseName: 'QA 個案', clientName: 'QA', buyerName: 'QA 公司', itemText: `QA 第 ${id} 期`, amount: 1000 * id, requestedBy: 'peng', requestedByName: '彭俞豪', requestedAt: `2026-10-22T0${id % 10}:00:00Z` });
const state = () => page.evaluate(() => {
  const panel = document.getElementById('rv-invoice-queue'); const body = document.getElementById('rv-invoice-queue-body');
  return { shown: !panel.hidden, head: document.getElementById('rv-invoice-queue-head').textContent, summary: document.getElementById('rv-invoice-queue-summary').textContent, toggle: document.getElementById('rv-invoice-queue-toggle').textContent, toggleHidden: document.getElementById('rv-invoice-queue-toggle').hidden, expanded: !body.hidden, height: Math.round(panel.getBoundingClientRect().height), lines: document.querySelectorAll('#rv-invoice-queue-list .ir-line').length, cards: document.querySelectorAll('#rv-invoice-queue-list .ir-card').length };
});
const set = rows => page.evaluate(rows => { INVOICE_REQUESTS.length = 0; rows.forEach(r => INVOICE_REQUESTS.push(r)); navTo('receivable', document.getElementById('nav-receivable')); renderReceivable(); }, rows);

await page.evaluate(() => { try { localStorage.removeItem('yutesign_ops_ir_panel'); } catch (e) {} });
await set([]);
const s0 = await state();
check('完全沒有申請：只剩一行標題，沒有展開鈕', s0.shown && !s0.expanded && s0.toggleHidden && s0.height <= 60, s0);

await set([issued(1, 'FT29045608'), issued(2, 'FT29045590'), issued(3, 'FT29045591'), issued(4, 'FT29045592')]);
const s1 = await state();
check('沒有待開立：預設收成一行，摘要顯示最近已開立的發票號碼', s1.head.startsWith('開票待辦（0）') && !s1.expanded && s1.summary.includes('目前沒有待開立') && s1.summary.includes('FT29045592') && s1.toggle.startsWith('展開') && s1.height <= 60, s1);
await page.click('#rv-invoice-queue-toggle');
const s2 = await state();
check('按「展開」：最近已開立一筆一行，最多 3 筆', s2.expanded && s2.lines === 3 && s2.cards === 0 && s2.toggle.startsWith('收合') && s2.summary === '', s2);
await page.evaluate(() => renderReceivable());
check('重新繪製後仍維持展開（記住使用者的選擇）', (await state()).expanded);
await page.click('#rv-invoice-queue-toggle');
check('再按「收合」：回到一行', !(await state()).expanded);

await set([issued(1, 'FT29045608'), pending(5)]);
const s3 = await state();
check('有新的待開立申請：自動展開，待開立用卡片顯示', s3.head.startsWith('開票待辦（1）') && s3.expanded && s3.cards === 1 && s3.lines === 1, s3);
await page.click('#rv-invoice-queue-toggle');
const s4 = await state();
check('有待開立時也可以收合：摘要列出待開立的買受人與金額', !s4.expanded && s4.summary.startsWith('1 筆待開立') && s4.summary.includes('QA 公司') && s4.summary.includes('$5,000'), s4);
await page.evaluate(() => renderReceivable());
check('同樣筆數下重新繪製：維持收合', !(await state()).expanded);
await set([issued(1, 'FT29045608'), pending(5), pending(6)]);
const s5 = await state();
check('又多一筆待開立：自動展開，兩張卡片並排', s5.expanded && s5.cards === 2 && await page.evaluate(() => { const c = [...document.querySelectorAll('#rv-invoice-queue-list .ir-card')].map(x => x.getBoundingClientRect()); return Math.abs(c[0].top - c[1].top) < 2; }), s5);
const tall = await page.evaluate(() => Math.round(document.getElementById('rv-invoice-queue').getBoundingClientRect().height));
check('展開時面板高度有上限（不會把應收表格擠出畫面）', tall <= Math.min(760 * 0.4, 420) + 90, { tall });
await ctx.close();

const fails = await H.finish(outJson);
process.exit(fails ? 1 : 0);
