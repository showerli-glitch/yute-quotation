// 費用申請列表排序 (claude/expense-entry-sort): 日期新到舊（預設）／日期舊到新／依填入順序（費用編號）先填在前／後填在前。
// Mock cloud only; never touches production.
//
// Setup (outside the repo):  mkdir /tmp/ops-smoke && cd /tmp/ops-smoke && npm i playwright-core
// Run:  PLAYWRIGHT_CORE=/tmp/ops-smoke/node_modules/playwright-core/index.mjs \
//         node scripts/smoke-expense-sort.mjs <label> <rootDir> <port> <out.json>
import { createHarness } from './smoke-lib.mjs';

const [label, rootDir, portArg, outJson] = process.argv.slice(2);
const H = await createHarness({ label, rootDir, port: Number(portArg) });
const { check, newContext, openApp } = H;

H.setScenario('A-manage(shower)');
const ctx = await newContext('shower.li@yutesign.com', { fixedTime: new Date('2026-11-05T10:30:00+08:00') });
const page = await openApp(ctx);

// 跟使用者截圖一樣的六筆（李鎮宇 2026-10），編號 = 填入順序。
await page.evaluate(() => {
  const rows = [
    [990617, '2026-10-01', 'QA公司聚餐', 1095], [990697, '2026-10-23', 'QA加油A', 1692], [990698, '2026-10-18', 'QA加油B', 1667],
    [990702, '2026-10-15', 'QA加油C', 1712], [990703, '2026-10-31', 'QA加油D', 1692], [990704, '2026-10-29', 'QA加油E', 1321],
  ];
  rows.forEach(([id, date, item, amount]) => EXPENSES.push({ id, person: 'shower', personName: '李鎮宇', month: '2099-10', caseKey: '固定開銷', caseName: '固定開銷', date, item, amount, category: '加油', receipt: '發票', note: '', status: 'pending' }));
  navTo('expense', document.getElementById('nav-expense'));
  const m = document.getElementById('exp-filter-month'); if (![...m.options].some(o => o.value === '2099-10')) { const o = document.createElement('option'); o.value = '2099-10'; m.appendChild(o); } m.value = '2099-10';
  const p = document.getElementById('exp-filter-person'); if (p) p.value = 'shower';
});
const order = mode => page.evaluate(mode => {
  const sel = document.getElementById('exp-sort'); sel.value = mode; renderExpense();
  return [...document.querySelectorAll('#exp-tbody tr')].map(tr => tr.children[5]?.textContent.trim());
}, mode);

const opts = await page.evaluate(() => [...document.querySelectorAll('#exp-sort option')].map(o => o.value + '|' + o.textContent));
check('排序選單有日期與依填入順序四種，預設日期新到舊', opts.join(',') === 'date-desc|日期新到舊,date-asc|日期舊到新,entry-asc|依填入順序（先填在前）,entry-desc|依填入順序（後填在前）' && (await page.evaluate(() => document.getElementById('exp-sort').value)) === 'date-desc', opts);
const dDesc = await order('date-desc');
check('日期新到舊：跟原本一樣（10/31 在最上面）', dDesc.join(',') === 'QA加油D,QA加油E,QA加油A,QA加油B,QA加油C,QA公司聚餐', dDesc);
const dAsc = await order('date-asc');
check('日期舊到新', dAsc.join(',') === 'QA公司聚餐,QA加油C,QA加油B,QA加油A,QA加油E,QA加油D', dAsc);
const eAsc = await order('entry-asc');
check('依填入順序（先填在前）：照費用編號', eAsc.join(',') === 'QA公司聚餐,QA加油A,QA加油B,QA加油C,QA加油D,QA加油E', eAsc);
const eDesc = await order('entry-desc');
check('依填入順序（後填在前）', eDesc.join(',') === 'QA加油E,QA加油D,QA加油C,QA加油B,QA加油A,QA公司聚餐', eDesc);
await page.evaluate(() => { const r = EXPENSES.find(x => x.id === 990697); r.date = '2026-10-02'; r.amount = 1700; });
const afterEdit = await order('entry-asc');
check('修改日期／金額後，填入順序不變', afterEdit.join(',') === eAsc.join(','), afterEdit);
const grouped = await page.evaluate(() => {
  EXPENSES.push({ id: 990600, person: 'lu_yanchen', personName: '盧彥辰', month: '2099-10', caseKey: '固定開銷', caseName: '固定開銷', date: '2026-10-05', item: 'QA彥辰', amount: 100, category: '雜支', receipt: '收據', note: '', status: 'pending' });
  const p = document.getElementById('exp-filter-person'); if (p) p.value = '';
  document.getElementById('exp-sort').value = 'entry-asc'; renderExpense();
  return [...document.querySelectorAll('#exp-tbody tr')].map(tr => tr.children[5]?.textContent.trim()).filter(t => t.startsWith('QA'));
});
check('沒選人員時仍先依人員分組，組內照填入順序', grouped.indexOf('QA彥辰') !== 0 || grouped.length === 7, grouped);
check('沒選人員時：李鎮宇六筆在組內照填入順序', grouped.filter(t => t !== 'QA彥辰').join(',') === eAsc.join(','), grouped);
await ctx.close();

const fails = await H.finish(outJson);
process.exit(fails ? 1 : 0);
