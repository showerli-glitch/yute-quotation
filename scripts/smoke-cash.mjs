// 資金試算 (cash position) smoke test. Mock cloud only; never touches production.
//
// Setup (outside the repo):  mkdir /tmp/ops-smoke && cd /tmp/ops-smoke && npm i playwright-core
// Run:  PLAYWRIGHT_CORE=/tmp/ops-smoke/node_modules/playwright-core/index.mjs \
//         node scripts/smoke-cash.mjs <label> <rootDir> <port> <out.json>
// Frozen clock (2026-10-13 14:00 Taipei). Fixture cases are added to the MOCK data only:
//   YT-QA-2026-040 contract 3,000,000, margin 30%, collected 1,500,000, paid cost 420,000
//     → est. cost 2,100,000, 20% complete, earned 600,000, overbilling 900,000 (the example given to the user)
//   YT-QA-2026-041 contract 1,000,000, margin 20%, collected 100,000, paid cost 500,000 → underbilled, overbilling 0
//   YT-QA-2026-042 contract 500,000, no margin → listed as missing
import { createHarness } from './smoke-lib.mjs';

const [label, rootDir, portArg, outJson] = process.argv.slice(2);
const H = await createHarness({ label, rootDir, port: Number(portArg) });
const { check, newContext, openApp, waitReady, waitSynced, lastToast, nav, visible, counts } = H;
const NOW = new Date('2026-10-13T14:00:00+08:00');
const A = 'YT-QA-2026-040', B = 'YT-QA-2026-041', C = 'YT-QA-2026-042';
const close = (a, b) => Math.abs(a - b) < 0.6;

H.setScenario('A-owner(shower)');
let ctx = await newContext('shower.li@yutesign.com', { fixedTime: NOW });
let page = await openApp(ctx);
let confirmAnswer = true;
page.on('dialog', d => (d.type() === 'confirm' && !confirmAnswer ? d.dismiss() : d.accept()));
const before = await counts(page);
const missing = await page.evaluate(() => ['cashCompute', 'cashRender', 'cashSaveSnapshot', 'cashLeaseRemaining', 'cashWipRows', 'cashCreateDefaults'].filter(n => typeof window[n] !== 'function'));
check('資金試算函式可用、選單對老闆顯示', missing.length === 0 && await visible(page, '#nav-cash'), { missing });

await page.evaluate(({ A, B, C }) => {
  const mk = (code, name, amount, extra = {}) => CASES.push({ code, name, client: '', status: '進行中', amount, person: '李鎮宇', profitSplit: '自訂', splitRatio: { shower: 0.6, peng: 0.2, lien: 0.2 }, ...extra });
  mk(A, 'QA資金甲', 3000000, { estMarginPct: 30 });
  mk(B, 'QA資金乙', 1000000, { estMarginPct: 20 });
  mk(C, 'QA資金丙', 500000);
  RECEIVABLES.push({ id: rvNextId++, case: A, caseName: 'QA資金甲', item: '訂金', collectAmt: 1500000, collectDate: '2026-10-01', invoiceAmt: 1500000, invoiceDate: '2026-12-20', status: 'collected' });
  RECEIVABLES.push({ id: rvNextId++, case: B, caseName: 'QA資金乙', item: '訂金', collectAmt: 100000, collectDate: '2026-10-02', status: 'collected' });
  PAYABLES.push({ id: pyNextId++, case: A, caseName: 'QA資金甲', vendor: 'QA廠商', summary: '材料', amount: 420000, status: 'paid', doneDate: '2026-10-03', paymentType: 'vendor' });
  PAYABLES.push({ id: pyNextId++, case: B, caseName: 'QA資金乙', vendor: 'QA廠商', summary: '材料', amount: 500000, status: 'paid', doneDate: '2026-10-03', paymentType: 'vendor' });
  saveData();
}, { A, B, C });
await nav(page, 'cash');
check('資金試算頁可進入，標題正確', (await page.evaluate(() => currentPage)) === 'cash' && (await page.locator('#topbar-title').innerText()) === '資金試算' && (await page.locator('#cash-container').innerText()).includes('建立預設項目'));

await page.evaluate(() => cashCreateDefaults());
const items = await page.evaluate(() => CASH_ITEMS.map(i => [i.kind, i.name]));
check('建立預設項目：5 個公司帳戶、玉山借款、兩台車租金', items.length === 8 && items.filter(i => i[0] === 'account').length === 5 && items.some(i => i[1] === '玉山借款') && items.filter(i => i[0] === 'lease').length === 2, items);

// lease settings: M340i 63,760 on the 5th, last 2027-10
await page.evaluate(() => { const i = CASH_ITEMS.find(x => x.name === 'M340i 租金'); cashStartEditItem(i.id); });
await page.fill('#cash-item-monthly', '63,760');
await page.fill('#cash-item-payday', '5');
await page.fill('#cash-item-last', '2027-10');
await page.click('button[onclick="cashSaveItem()"]');
const lease = await page.evaluate(() => CASH_ITEMS.find(x => x.name === 'M340i 租金'));
check('租賃設定：每期金額、扣款日、最後一期', lease.monthlyPayment === 63760 && lease.payDay === 5 && lease.lastPayMonth === '2027-10', lease);
await page.evaluate(() => { const i = CASH_ITEMS.find(x => x.name === 'GOLF R 租金'); cashStartEditItem(i.id); });
await page.fill('#cash-item-monthly', '');
await page.click('button[onclick="cashSaveItem()"]');
check('租賃沒填每期金額 → 拒絕', (await lastToast(page)) === '租賃請填每期金額');
await page.evaluate(() => { cashEditingItemId = null; cashRender(); });

// add a private account excluded from the total, and a manual reserve
await page.evaluate(() => cashStartEditItem('new'));
await page.selectOption('#cash-item-kind', 'account');
await page.fill('#cash-item-name', '李瑞興（私人）');
await page.uncheck('#cash-item-include');
await page.click('button[onclick="cashSaveItem()"]');
await page.evaluate(() => cashStartEditItem('new'));
await page.selectOption('#cash-item-kind', 'reserve');
await page.fill('#cash-item-name', 'GLB');
await page.click('button[onclick="cashSaveItem()"]');
check('新增項目：私人帳戶（不計入）與其他預留', await page.evaluate(() => CASH_ITEMS.some(i => i.name === '李瑞興（私人）' && i.include === false) && CASH_ITEMS.some(i => i.name === 'GLB' && i.kind === 'reserve')));

// enter this period dated 2026-10-01
const values = { '玉山銀行 活存': 500000, '瑞興銀行 活存': 3000000, '瑞興銀行 支存': 0, '國泰世華 活存': 2000000, '國泰世華 支存': 100000, '玉山借款': 3500000, 'M340i 租金': 765120, 'GOLF R 租金': 0, '李瑞興（私人）': 999999, 'GLB': 150000 };
await page.evaluate(v => { CASH_ITEMS.forEach(i => { const el = document.getElementById(`cash-val-${i.id}`); if (el && v[i.name] !== undefined) el.value = String(v[i.name]); }); }, values);
await page.fill('#cash-snap-date', '2026-10-01');
await page.fill('#cash-snap-note', 'QA第一期');
await page.click('button[onclick="cashSaveSnapshot()"]');
const r1 = await page.evaluate(() => {
  const r = cashCompute();
  const line = l => r.lines.find(x => x.label === l || x.label.startsWith(l));
  return { r: { assets: r.assets, liabilities: r.liabilities, own: r.own, safety: r.safety, available: r.available, months: r.months, ownerDraw: r.ownerDraw, overheadMonths: r.overhead.months, overheadAverage: r.overhead.average },
    m340: line('M340i 租金')?.amount, bank: r.lines.filter(l => l.group === '銀行帳戶').reduce((s, l) => s + l.amount, 0), privateShown: r.lines.some(l => l.label === '李瑞興（私人）'),
    sumAssets: r.lines.filter(l => l.side === 'asset').reduce((s, l) => s + l.amount, 0), sumLiab: r.lines.filter(l => l.side === 'liability').reduce((s, l) => s + l.amount, 0),
    approved: line('已核准未付')?.amount, pending: line('待審核請款')?.amount, billed: line('已開發票未收款')?.amount, over: line('超前收款')?.amount, glb: line('GLB')?.amount, loan: line('玉山借款')?.amount,
    expApproved: PAYABLES.filter(p => p.status === 'approved').reduce((s, p) => s + (Number(p.amount) || 0), 0),
    expPending: PAYABLES.filter(p => p.status === 'pending').reduce((s, p) => s + (Number(p.amount) || 0), 0),
    expBilled: RECEIVABLES.filter(x => !(x.collectAmt > 0 || x.collectDate) && Number(x.invoiceAmt || 0) > 0).reduce((s, x) => s + receivableExpectedAmount(x), 0),
    snaps: CASH_SNAPSHOTS.length, toast: window.__toasts[window.__toasts.length - 1] };
});
check('存成本期：建立一期並提示', r1.snaps === 1 && r1.toast === '已存成 2026-10-01 這一期 ✓', r1);
check('租賃自動扣期：10/1 登錄 765,120，過了 10/5 扣款日 → 701,360', r1.m340 === 765120 - 63760, { m340: r1.m340 });
check('銀行帳戶合計不含「不計入」的私人帳戶', r1.bank === 5600000 && !r1.privateShown, { bank: r1.bank });
check('自動項目＝獨立加總（已核准、待審核、已開票未收）；手動項目照登錄', r1.approved === r1.expApproved && r1.pending === r1.expPending && r1.billed === r1.expBilled && r1.glb === 150000 && r1.loan === 3500000, r1);
check('自有資金＝可用的錢−不是自己的錢；可動用＝自有資金−安全水位', r1.r.assets === r1.sumAssets && r1.r.liabilities === r1.sumLiab && r1.r.own === r1.sumAssets - r1.sumLiab && r1.r.available === r1.r.own - r1.r.safety, r1.r);
const safetyExp = await page.evaluate(() => {
  const months = Object.keys(OVERHEAD).filter(m => prIsValidMonth(m) && m < '2026-10').sort().slice(-3);
  const salaryIdx = OH_FIXED_CONFIG.indexOf('員工薪資');
  const avg = months.reduce((s, m) => s + (OVERHEAD[m].fixed || []).reduce((x, v, i) => x + (i === salaryIdx ? 0 : (parseInt(v) || 0)), 0) + (OVERHEAD[m].variable || []).reduce((x, v) => x + (Number(v.amount) || 0), 0) + psPayrollSum(m), 0) / months.length;
  return { months, value: Math.round(3 * (avg + 200000)) };
});
check('安全水位＝3 個月×（最近 3 個完整月份公司開銷月均＋老闆每月 20 萬）', r1.r.months === 3 && r1.r.ownerDraw === 200000 && JSON.stringify(r1.r.overheadMonths) === JSON.stringify(safetyExp.months) && r1.r.safety === safetyExp.value, { r: r1.r, safetyExp });

const vat = await page.evaluate(() => {
  const before = cashVatRows().map(r => r.period);
  RECEIVABLES.push({ id: rvNextId++, case: '', caseName: 'QA稅', item: 'QA發票', invoiceAmt: 105000, invoiceDate: '2026-09-10', receivableAmt: 105000, status: 'pending' });
  const pending = cashVatRows().find(r => r.period === '2026-09~10');
  TAX_LIABILITIES.push({ id: 'QA-VAT-910', taxType: '營業稅', period: '2026-09~10', amount: 1, status: 'paid', payDate: '2026-10-12', source: 'manual_tax_management' });
  const filed = cashVatRows().find(r => r.period === '2026-09~10');
  RECEIVABLES.pop(); TAX_LIABILITIES.pop();
  return { before, pendingOwed: pending && pending.owed, pendingReserve: pending && pending.reserve, filed: filed || null };
});
check('營業稅：沒有繳納紀錄的期別扣整期預留；登錄繳納後該期不再扣差額', vat.pendingOwed > 0 && Math.abs(vat.pendingOwed - vat.pendingReserve) < 0.01 && vat.filed === null, vat);

// WIP
const wip = await page.evaluate(({ A, B, C }) => { const w = cashWipRows(); const g = c => w.find(x => x.code === c); return { a: g(A), b: g(B), c: g(C), missing: cashCompute().missingMargin.map(x => x.code) }; }, { A, B, C });
check('超前收款：甲案 合約300萬、毛利30%、已收150萬、已付42萬 → 完工20%、已賺60萬、超前90萬', close(wip.a.estCost, 2100000) && close(wip.a.pct, 0.2) && close(wip.a.earned, 600000) && close(wip.a.overbilling, 900000), wip.a);
check('落後請款（乙案成本已超過已收）不加回，超前收款為 0', wip.b.overbilling === 0 && wip.b.pct > 0.6, wip.b);
check('沒填毛利率的個案（丙）不估算，列在提醒裡', wip.c.hasMargin === false && wip.missing.includes(C) && (await page.locator('#cash-container').innerText()).includes('QA資金丙'), { c: wip.c, missing: wip.missing });

// profit share overlap (no double deduction)
const ps = await page.evaluate(A => {
  const wipRows = cashWipRows();
  const rows = cashProfitShareRows(wipRows);
  const d = psComputeData();
  const c = d.caseRows.find(x => x.code === A);
  const factor = c && c.gross > 0 ? Math.min(1, Math.max(0, c.caseNet / c.gross)) : 0;
  const lien = rows.find(r => r.person === 'lien');
  const preview = d.rows.find(r => r.person === 'lien')?.unpaid || 0;
  return { inPreview: !!c, factor, lien, expOverlapFromA: 900000 * 0.2 * factor, preview, lines: cashCompute().lines.filter(l => l.group === '未領分潤').map(l => [l.label, l.amount]) };
}, A);
check('彭、連未領分潤：扣回已算進超前收款的部分（依比例×淨利比例），不重複扣、不低於 0', ps.inPreview && ps.factor > 0 && ps.lien && ps.lien.overlap >= ps.expOverlapFromA - 0.6 && ps.lien.owed === Math.max(0, ps.preview - ps.lien.overlap) && ps.lines.every(l => l[1] >= 0), ps);

// case margin editing
await page.evaluate(C => openEditCase(C), C);
await page.fill('#edit-case-est-margin', '120');
const nameBefore = await page.evaluate(C => CASES.find(c => c.code === C).name, C);
await page.fill('#edit-case-name', 'QA資金丙改名');
await page.click('#modal-edit-case button[onclick="submitEditCase()"]');
const bad = await page.evaluate(C => ({ toast: window.__toasts[window.__toasts.length - 1], c: CASES.find(c => c.code === C) }), C);
check('個案預估毛利率填 120 → 拒絕，個案其他欄位也不被改', bad.toast === '預估毛利率請填 0～99' && bad.c.name === nameBefore && bad.c.estMarginPct === undefined, bad);
await page.fill('#edit-case-est-margin', '25');
await page.click('#modal-edit-case button[onclick="submitEditCase()"]');
const good = await page.evaluate(C => ({ c: CASES.find(c => c.code === C), missing: cashCompute().missingMargin.map(x => x.code) }), C);
check('個案預估毛利率存成 25，資金試算不再列為未填', good.c.estMarginPct === 25 && !good.missing.includes(C), { m: good.c.estMarginPct, missing: good.missing });
await page.evaluate(C => openEditCase(C), C);
check('再次開啟個案編輯，毛利率帶出 25', (await page.inputValue('#edit-case-est-margin')) === '25');
await page.evaluate(() => closeModal('modal-edit-case'));

// settings and second snapshot (difference from the previous one)
await nav(page, 'cash');
await page.fill('#cash-set-months', '2');
await page.fill('#cash-set-draw', '150,000');
await page.click('button[onclick="cashSaveSettings()"]');
const set = await page.evaluate(() => ({ s: { ...CASH_SETTINGS }, r: cashCompute() }));
check('安全水位設定：2 個月、每月 15 萬，立即生效', set.s.reserveMonths === 2 && set.s.ownerMonthlyDraw === 150000 && set.r.safety === Math.round(2 * (set.r.overhead.average + 150000)), set.s);
await page.evaluate(() => { const i = CASH_ITEMS.find(x => x.name === '玉山銀行 活存'); document.getElementById(`cash-val-${i.id}`).value = '600,000'; });
await page.fill('#cash-snap-date', '2026-10-13');
await page.click('button[onclick="cashSaveSnapshot()"]');
const hist = await page.evaluate(() => { const s = cashSortedSnapshots(); return { n: s.length, d: s[0].own - s[1].own, latest: s[0].date, text: document.getElementById('cash-container').innerText }; });
check('第二期：歷史列兩期，「與上期差額」＝兩期自有資金相減', hist.n === 2 && hist.latest === '2026-10-13' && hist.text.includes('與上期差額'), { n: hist.n, d: hist.d });
await page.fill('#cash-snap-date', '2026-12-31');
await page.click('button[onclick="cashSaveSnapshot()"]');
check('登錄日不能是未來日期', (await lastToast(page)) === '登錄日不能是未來日期' && (await page.evaluate(() => CASH_SNAPSHOTS.length)) === 2);

// delete with audit
await page.evaluate(() => { const s = cashSortedSnapshots()[1]; cashDeleteSnapshot(s.id); const i = CASH_ITEMS.find(x => x.name === 'GLB'); cashDeleteItem(i.id); });
const del = await page.evaluate(() => ({ snaps: CASH_SNAPSHOTS.length, glb: CASH_ITEMS.some(i => i.name === 'GLB'), audits: AUDIT_LOGS.filter(a => a.action === 'delete' && ['cashSnapshot', 'cashItem'].includes(a.targetType)).map(a => a.targetType) }));
check('刪除一期與一個項目都寫審計紀錄', del.snaps === 1 && !del.glb && del.audits.includes('cashSnapshot') && del.audits.includes('cashItem'), del);

// Optional screenshot for review: CASH_SCREENSHOT=/path/to/file.png
if (process.env.CASH_SCREENSHOT) {
  await page.setViewportSize({ width: 1440, height: 2600 });
  await page.evaluate(() => { cashViewSnapshotId = cashSortedSnapshots()[0]?.id ?? null; cashRender(); });
  await page.locator('#cash-container').screenshot({ path: process.env.CASH_SCREENSHOT });
  await page.evaluate(() => { cashViewSnapshotId = null; cashRender(); });
}
await waitSynced(page);
const keep = () => page.evaluate(() => JSON.stringify({ i: CASH_ITEMS.map(x => [x.id, x.kind, x.name, x.amount, x.asOfDate, x.include, x.monthlyPayment || 0]), s: CASH_SNAPSHOTS.map(x => [x.id, x.date, x.own, x.lines.length]), set: CASH_SETTINGS }));
const k1 = await keep();
await page.reload({ waitUntil: 'load' }); await waitReady(page);
check('重新載入後項目、期別、設定都在', (await keep()) === k1, k1.slice(0, 200));
await ctx.close();

H.setScenario('B-finance(nc)');
ctx = await newContext('nc@yutesign.com', { fixedTime: NOW });
page = await openApp(ctx);
await nav(page, 'cash');
check('甯甯（財務）在全新瀏覽器可看到同一份資料', (await page.evaluate(() => currentPage)) === 'cash' && (await page.evaluate(() => CASH_SNAPSHOTS.length)) === 1 && await visible(page, '#nav-cash'));
await ctx.close();

H.setScenario('C-pm(peng)');
ctx = await newContext('peng@yutesign.com', { fixedTime: NOW });
page = await openApp(ctx);
const pengNav = await visible(page, '#nav-cash');
await page.evaluate(() => { window.__toasts = []; navTo('cash'); });
const pengToast = await lastToast(page);
const pengToasts = [];
for (const fn of ['cashCreateDefaults', 'cashSaveSnapshot', 'cashSaveSettings']) { await page.evaluate(fn => { window.__toasts = []; window[fn](); }, fn); pengToasts.push(await lastToast(page)); }
const pengWrites = await page.evaluate(t => ({ toasts: t, snaps: CASH_SNAPSHOTS.length, html: document.getElementById('cash-container').innerHTML }), pengToasts);
check('其他人（彭俞豪）看不到選單、進不去、所有寫入都被拒', !pengNav && pengToast === '您沒有此功能的權限' && pengWrites.toasts.length === 3 && pengWrites.toasts.every(t => t === '您沒有此功能的權限') && pengWrites.snaps === 1 && pengWrites.html === '', { pengNav, pengToast, pengWrites: { ...pengWrites, html: pengWrites.html.length } });
const after = await counts(page);
check('其他集合只多了測試個案與測試收付款', after.CASES === before.CASES + 3 && after.RECEIVABLES === before.RECEIVABLES + 2 && after.PAYABLES === before.PAYABLES + 2 && after.EXPENSES === before.EXPENSES && after.VENDORS === before.VENDORS && after.PAYROLL === before.PAYROLL, { before, after });
await ctx.close();

const fails = await H.finish(outJson, { finalCloudData: JSON.parse(JSON.stringify(H.state.cloud?.data || {})) });
process.exit(fails ? 1 : 0);
