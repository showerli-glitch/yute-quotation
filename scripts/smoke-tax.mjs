// Tax management (稅務管理) smoke test. Mock cloud only; never touches production.
//
// Setup (outside the repo):  mkdir /tmp/ops-smoke && cd /tmp/ops-smoke && npm i playwright-core
// Run:  PLAYWRIGHT_CORE=/tmp/ops-smoke/node_modules/playwright-core/index.mjs \
//         node scripts/smoke-tax.mjs <label> <rootDir> <port> <out.json>
// Frozen clock (2026-10-06 14:00 Taipei). VAT reserve is re-derived independently as
// invoice / 1.05 × 0.05 × 0.5 and bimonthly periods as (odd month)~(odd month + 1).
import { createHarness } from './smoke-lib.mjs';

const [label, rootDir, portArg, outJson] = process.argv.slice(2);
const H = await createHarness({ label, rootDir, port: Number(portArg) });
const { check, newContext, openApp, waitReady, waitSynced, lastToast, clearToasts, visible, nav, counts } = H;
const NOW = new Date('2026-10-06T14:00:00+08:00');
const PERIOD = '2026-11~12';
const money = n => { const r = Math.round(Number(n) || 0); return `${r < 0 ? '-' : ''}$${Math.abs(r).toLocaleString('zh-TW')}`; };
const periodOf = d => { const m = /^(\d{4})-(\d{2})-/.exec(d || ''); if (!m) return ''; const mo = +m[2]; if (mo < 1 || mo > 12) return ''; const s = mo % 2 ? mo : mo - 1; return `${m[1]}-${String(s).padStart(2, '0')}~${String(s + 1).padStart(2, '0')}`; };
const periodRow = (page, p) => page.evaluate(p => { const tr = [...document.querySelectorAll('#tax-container tr')].find(t => t.cells[0]?.innerText.trim() === p && t.cells.length >= 7); return tr ? [...tr.cells].map(c => c.innerText.trim()) : null; }, p);

// ═══════════ A: tax manager (shower) ═══════════
H.setScenario('A-manage(shower)');
let ctx = await newContext('shower.li@yutesign.com', { fixedTime: NOW });
let page = await openApp(ctx);
let confirmAnswer = true;
page.on('dialog', d => (d.type() === 'confirm' && !confirmAnswer ? d.dismiss() : d.accept()));
const before = await counts(page);
const missing = await page.evaluate(() => ['taxEscape','taxMoney','taxVatReserve','taxVatPeriodKey','taxAvailableYears','taxSelectYear','taxStartEdit','taxCancelEdit','taxSaveLiability','taxDeleteLiability','taxOpenIncomeEstimate','renderTaxManagement'].filter(n => typeof window[n] !== 'function'));
const pure = await page.evaluate(() => ({ r: taxVatReserve(105000), p: [taxVatPeriodKey('2026-01-05'), taxVatPeriodKey('2026-02-28'), taxVatPeriodKey('2026-12-31'), taxVatPeriodKey('bad'), taxVatPeriodKey('2026-13-01')], m: [taxMoney(-1234.6), taxMoney('x')], e: taxEscape('<a&"\'>') }));
check('稅務函式可用；營業稅預留、期別、金額格式與獨立計算一致', missing.length === 0 && Math.abs(pure.r - 105000 / 1.05 * 0.05 * 0.5) < 1e-9 && JSON.stringify(pure.p) === JSON.stringify(['2026-01~02', '2026-01~02', '2026-11~12', '', '']) && JSON.stringify(pure.m) === JSON.stringify(['-$1,235', '$0']) && pure.e === '&lt;a&amp;&quot;&#39;&gt;', { missing, ...pure });
await nav(page, 'tax');
check('稅務頁可進入並渲染、預設今年', (await page.evaluate(() => currentPage)) === 'tax' && (await page.evaluate(() => TAX_SELECTED_YEAR)) === '2026' && !!(await periodRow(page, '2026-01~02')));

// fixture invoices (MOCK data only) → period row re-derived independently
const p0 = await periodRow(page, PERIOD);
await page.evaluate(() => {
  RECEIVABLES.push({ id: rvNextId++, case: '', caseName: 'QA稅務', buyer: 'QA買受人', item: 'QA發票1', invoiceAmt: 105000, invoiceDate: '2026-11-15', invoiceNo: 'QA00000101', receivableAmt: 105000, status: 'pending' });
  RECEIVABLES.push({ id: rvNextId++, case: '', caseName: 'QA稅務', buyer: 'QA買受人', item: 'QA發票2', invoiceAmt: 42000, invoiceDate: '2026-12-20', invoiceNo: 'QA00000102', receivableAmt: 42000, status: 'pending' });
  RECEIVABLES.push({ id: rvNextId++, case: '', caseName: 'QA稅務', buyer: 'QA買受人', item: 'QA無日期發票', invoiceAmt: 21000, invoiceDate: '', receivableAmt: 21000, status: 'pending' });
  saveData(); renderTaxManagement();
});
const exp = await page.evaluate(({ src, P }) => { const periodOf = eval(src); const inv = RECEIVABLES.filter(r => Number(r.invoiceAmt || 0) !== 0 && periodOf(r.invoiceDate) === P); return { count: inv.length, total: inv.reduce((s, r) => s + Number(r.invoiceAmt), 0), reserve: inv.reduce((s, r) => s + Number(r.invoiceAmt) / 1.05 * 0.05 * 0.5, 0) }; }, { src: periodOf.toString(), P: PERIOD });
let row = await periodRow(page, PERIOD);
check('期別列：發票張數、金額、預留稅額（獨立重算）', row && row[1] === String(exp.count) && row[2] === money(exp.total) && row[3] === money(exp.reserve) && row[6] === '尚未登錄繳納', { row, exp, before: p0 });
check('沒有發票日期的發票列入「未歸期別」', (await page.locator('#tax-container').innerText()).includes('QA無日期發票'));

// liabilities
await page.evaluate(() => taxStartEdit());
check('新增繳稅紀錄：表單出現', await page.evaluate(() => !!document.getElementById('tax-entry-card') && TAX_EDIT_ID === 'new'));
await clearToasts(page);
await page.fill('#tax-entry-period', '');
await page.fill('#tax-entry-amount', '');
await page.click('button[onclick="taxSaveLiability()"]');
const t1 = await lastToast(page);
await page.selectOption('#tax-entry-type', '營業稅');
await page.fill('#tax-entry-period', PERIOD);
await page.fill('#tax-entry-amount', '2,000');
await page.selectOption('#tax-entry-status', 'paid');
await page.fill('#tax-entry-date', '');
await page.click('button[onclick="taxSaveLiability()"]');
const t2 = await lastToast(page);
check('必填：稅別／期別／金額、已繳納需繳納日', t1 === '請填寫稅別、歸屬期與金額' && t2 === '已繳納紀錄請填寫繳納日', [t1, t2]);
await page.fill('#tax-entry-date', '2026-12-15');
await page.fill('#tax-entry-note', 'QA繳稅');
const nextId = await page.evaluate(() => TAX_LIABILITIES.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0) + 1);
await page.click('button[onclick="taxSaveLiability()"]');
const saved = await page.evaluate(id => { const r = TAX_LIABILITIES.find(x => x.id === id); return r && { type: r.taxType, period: r.period, amount: r.amount, status: r.status, payDate: r.payDate, source: r.source, company: r.companyId, editId: TAX_EDIT_ID }; }, nextId);
check('儲存繳稅紀錄：寫入負債、標記手動來源', saved && saved.type === '營業稅' && saved.period === PERIOD && saved.amount === 2000 && saved.status === 'paid' && saved.source === 'manual_tax_management' && saved.company === 'yutesign' && saved.editId === null && (await lastToast(page)) === '稅務負債／繳稅紀錄已儲存 ✓', saved);
row = await periodRow(page, PERIOD);
check('期別列：已繳 2,000、差額 = 預留 − 已繳、狀態判斷', row[4] === money(2000) && row[5] === money(exp.reserve - 2000) && row[6] === (exp.reserve - 2000 >= -0.5 ? '足夠／尚有餘額' : '不足'), row);
await page.evaluate(id => taxStartEdit(String(id)), nextId);
check('編輯：帶入原資料', (await page.inputValue('#tax-entry-amount')).replace(/[^0-9]/g, '') === '2000' && (await page.inputValue('#tax-entry-period')) === PERIOD);
await page.fill('#tax-entry-amount', '9,999');
await page.click('button[onclick="taxSaveLiability()"]');
row = await periodRow(page, PERIOD);
check('編輯後金額更新、差額轉為不足', (await page.evaluate(id => TAX_LIABILITIES.find(x => x.id === id).amount, nextId)) === 9999 && row[5] === money(exp.reserve - 9999) && row[6] === '不足', row);
await page.evaluate(() => taxStartEdit());
await page.click('button[onclick="taxCancelEdit()"]');
check('取消編輯：表單關閉', await page.evaluate(() => TAX_EDIT_ID === null && !document.getElementById('tax-entry-card')));
confirmAnswer = false;
await page.evaluate(id => taxDeleteLiability(String(id)), nextId);
check('刪除按取消：保留', await page.evaluate(id => TAX_LIABILITIES.some(x => x.id === id), nextId));
confirmAnswer = true;
await page.evaluate(id => taxDeleteLiability(String(id)), nextId);
check('刪除繳稅紀錄', !(await page.evaluate(id => TAX_LIABILITIES.some(x => x.id === id), nextId)) && (await lastToast(page)) === '繳稅紀錄已刪除');
// keep one record for persistence
await page.evaluate(() => taxStartEdit());
await page.selectOption('#tax-entry-type', '營所稅');
await page.fill('#tax-entry-period', '2026');
await page.fill('#tax-entry-amount', '15000');
await page.selectOption('#tax-entry-status', 'pending');
await page.click('button[onclick="taxSaveLiability()"]');
check('待繳紀錄可不填繳納日', (await page.evaluate(() => TAX_LIABILITIES.some(r => r.taxType === '營所稅' && r.period === '2026' && r.amount === 15000 && r.status === 'pending'))));
// year switch + income estimate
const years = await page.evaluate(() => taxAvailableYears());
await page.evaluate(() => taxSelectYear('2025'));
check('切換年度 2025', (await page.evaluate(() => TAX_SELECTED_YEAR)) === '2025' && !!(await periodRow(page, '2025-01~02')) && !(await periodRow(page, PERIOD)), years);
const est = await page.evaluate(() => taxOpenIncomeEstimate());
check('所得稅預估為數值', Number.isFinite(est) && est >= 0, est);
await page.waitForTimeout(1200);
await waitSynced(page);
await ctx.close();

// ═══════════ B: read-only (lu_yanchen with tax 'view_all' in the MOCK cloud only) ═══════════
H.setScenario('B-readonly(lu,mock view_all)');
H.state.cloud.data.USER_PERMISSIONS.lu_yanchen.tax = 'view_all';
ctx = await newContext('lu@yutesign.com', { fixedTime: NOW });
page = await openApp(ctx);
page.on('dialog', d => d.accept());
await page.reload({ waitUntil: 'load' }); await waitReady(page);
await nav(page, 'tax');
check('唯讀：稅務頁可看', (await page.evaluate(() => currentPage)) === 'tax' && !!(await periodRow(page, PERIOD)));
const n0 = await page.evaluate(() => TAX_LIABILITIES.length);
const ts = [];
for (const code of ['taxStartEdit()', 'taxSaveLiability()', `taxDeleteLiability(String(TAX_LIABILITIES[0].id))`]) { await page.evaluate(c => { window.__toasts = []; eval(c); }, code); ts.push(await lastToast(page)); }
check('唯讀：新增／儲存／刪除都被拒且未寫入', ts.every(t => t === '您沒有修改此資料的權限') && (await page.evaluate(() => TAX_LIABILITIES.length)) === n0, ts);
await ctx.close();
delete H.state.cloud.data.USER_PERMISSIONS.lu_yanchen.tax;

// ═══════════ C: no access (peng) ═══════════
H.setScenario('C-none(peng)');
ctx = await newContext('peng@yutesign.com', { fixedTime: NOW });
page = await openApp(ctx);
await clearToasts(page);
await page.evaluate(() => navTo('tax'));
const cNone = await page.evaluate(() => { const html0 = document.getElementById('tax-container').innerHTML; renderTaxManagement(); return { level: permissionLevel('tax'), unchanged: document.getElementById('tax-container').innerHTML === html0 }; });
check('無權限：稅務頁被拒、渲染直接略過、側欄隱藏', cNone.level === 'none' && (await lastToast(page)) === '您沒有此功能的權限' && cNone.unchanged && !(await visible(page, '#nav-tax')), cNone);
await ctx.close();

// ═══════════ D: persistence ═══════════
H.setScenario('D-persistence(shower)');
ctx = await newContext('shower.li@yutesign.com', { fixedTime: NOW });
page = await openApp(ctx);
const snap = () => page.evaluate(() => JSON.stringify(TAX_LIABILITIES.filter(r => r.source === 'manual_tax_management').map(r => [r.id, r.taxType, r.period, r.amount, r.status, r.payDate || ''])));
const s1 = await snap();
await page.reload({ waitUntil: 'load' }); await waitReady(page);
check('重新載入後繳稅紀錄一樣', (await snap()) === s1 && JSON.parse(s1).some(r => r[1] === '營所稅'), s1);
await nav(page, 'tax');
row = await periodRow(page, PERIOD);
check('重新載入後期別列一致（預留稅額、無已繳）', row && row[3] === money(exp.reserve) && row[4] === money(0), row);
const after = await counts(page);
check('其他集合不變；應收 +3（測試發票）', ['CASES', 'PAYABLES', 'EXPENSES', 'CLIENTS', 'VENDORS', 'PAYROLL'].every(k => after[k] === before[k]) && after.RECEIVABLES === before.RECEIVABLES + 3, { before, after });
await ctx.close();

const fails = await H.finish(outJson, { finalCloudData: JSON.parse(JSON.stringify(H.state.cloud?.data || {})) });
process.exit(fails ? 1 : 0);
