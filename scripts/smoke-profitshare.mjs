// Profit share (分潤) smoke test, including settlement and undo. Mock cloud only; never touches production.
//
// Setup (outside the repo):  mkdir /tmp/ops-smoke && cd /tmp/ops-smoke && npm i playwright-core
// Run:  PLAYWRIGHT_CORE=/tmp/ops-smoke/node_modules/playwright-core/index.mjs \
//         node scripts/smoke-profitshare.mjs <label> <rootDir> <port> <out.json>
// Frozen clock (2026-10-06 14:00 Taipei). A fixture case and overhead month are added to the MOCK data
// so one settlement can be re-derived independently:
//   gross   = 500,000 − 200,000 − 30,000 − 525,000/1.05×0.05/2 = 257,500
//   overhead (2030-01 only) = 10,000 fixed + 5,000 variable = 15,000 (single case → 100% share)
//   caseNet = 257,500 − 15,000 − 525,000 × PS_TAX_RATE
//   per person net = caseNet × ratio (60/20/20); unpaid = net − salary − paid advances − post-close adjustment
// (salary/advance/adjustment inputs are read from the app; the core formula is re-derived here.)
import { createHarness } from './smoke-lib.mjs';

const [label, rootDir, portArg, outJson] = process.argv.slice(2);
const H = await createHarness({ label, rootDir, port: Number(portArg) });
const { check, newContext, openApp, waitReady, waitSynced, lastToast, clearToasts, visible, nav, counts } = H;
const NOW = new Date('2026-10-06T14:00:00+08:00');
const QA = 'YT-QA-2026-009';
const OHM = '2030-01';
const RATIOS = { shower: 0.6, peng: 0.2, lien: 0.2 };

// ═══════════ A: owner (shower) ═══════════
H.setScenario('A-manage(shower)');
let ctx = await newContext('shower.li@yutesign.com', { fixedTime: NOW });
let page = await openApp(ctx);
let confirmAnswer = true;
page.on('dialog', d => (d.type() === 'confirm' && !confirmAnswer ? d.dismiss() : d.accept()));
const before = await counts(page);
const missing = await page.evaluate(() => ['psParticipantList','psPersonName','psRatioLabel','psCaseSettlementCutoff','psIsProfitSettlementCase','psSettlementCutoffMonth','psAvailableOverheadMonths','psNormalizeOhRange','psSetTaxRate','psToggleCase','psSetOhRange','psRunSettlement','psUndoSettlement','psGetSplitRatio','psSetRatio','psOpenProfitParticipantModal','psSetProfitMode','psPersonPaidTotal','isProfitSharePayout','psProfitPayoutBelongsToCurrentBatch','psUnsettledProfitPayables','psPayrollBreakdown','psPayrollSum','psOutstandingPostCloseAdjustments','psComputeData','psTogglePayoutSettled','psToggleOhFuture','renderProfitShare'].filter(n => typeof window[n] !== 'function'));
const st0 = await page.evaluate(() => ({ rate: PS_TAX_RATE, settlements: PROFIT_SETTLEMENTS.length, three: PROFIT_SPLIT_RATIOS['三人'], names: PROFIT_SHARE_PERSON_NAMES, locked: PS_INITIAL_OVERHEAD_LOCKED_THROUGH, collapse: [psPayoutSettledCollapsed, psOhFutureCollapsed] }));
check('分潤函式與資料宣告可用', missing.length === 0 && st0.rate > 0 && st0.locked === '2025-09' && st0.names.shower === '李鎮宇', { missing, ...st0 });
await nav(page, 'profitshare');
check('分潤頁可進入並渲染', (await page.evaluate(() => currentPage)) === 'profitshare' && (await page.locator('#page-profitshare').innerText()).length > 50);

// fixture: one completed case with known amounts, plus a known overhead month
await page.evaluate(({ QA, OHM }) => {
  CASES.push({ code: QA, name: 'QA分潤案', client: 'QA', clientName: 'QA客戶', status: '完工', amount: 1000000, collected: 0, person: '李鎮宇', pct: 0, profitSplit: '三人' });
  RECEIVABLES.push({ id: rvNextId++, case: QA, caseName: 'QA分潤案', buyer: 'QA客戶', item: 'QA尾款', receivableAmt: 525000, invoiceAmt: 525000, invoiceDate: '2026-10-01', invoiceNo: 'QA00000201', collectAmt: 500000, collectDate: '2026-10-01', status: 'collected' });
  PAYABLES.push({ id: pyNextId++, case: QA, caseName: 'QA分潤案', vendor: 'QA廠商', summary: 'QA工程', amount: 200000, wantDate: '2026-10-02', transferDate: '2026-10-02', doneDate: '2026-10-02', status: 'paid', person: '李鎮宇', invoice: '有', receipt: '有' });
  EXPENSES.push({ id: expNextId++, month: '2026-10', caseKey: QA, item: 'QA材料', category: '材料', amount: 30000, status: 'approved', person: 'shower' });
  ohInitMonth(OHM);
  const idx = OH_FIXED_CONFIG.findIndex(n => !['房租', '員工薪資', '水電'].includes(n));
  OVERHEAD[OHM].fixed[idx] = 10000;
  OVERHEAD[OHM].variable.push({ id: ohVarNextId++, name: 'QA雜支', amount: 5000, note: '' });
  saveData(); renderProfitShare();
}, { QA, OHM });
check('測試案件列入可結算個案', await page.evaluate(code => psIsProfitSettlementCase(CASES.find(c => c.code === code)) && psComputeData().unsettledCases.some(c => c.code === code), QA));

// profit mode / ratio
await page.evaluate(code => psSetProfitMode(code, '自訂'), QA);
await page.evaluate(code => psSetRatio(code, 'peng', '30'), QA);
const r1 = await page.evaluate(code => { const c = CASES.find(x => x.code === code); return { mode: c.profitSplit, ratio: c.splitRatio }; }, QA);
check('調整分潤比例：改為自訂、彭 30%', r1.mode === '自訂' && r1.ratio.peng === 0.3, r1);
await page.evaluate(code => psSetRatio(code, 'peng', '20'), QA);
const r2 = await page.evaluate(code => CASES.find(x => x.code === code).splitRatio, QA);
check('比例調回 60／20／20', JSON.stringify(r2) === JSON.stringify(RATIOS) || (r2.shower === 0.6 && r2.peng === 0.2 && r2.lien === 0.2), r2);

// tax rate round-trip
await page.evaluate(() => psSetTaxRate('5'));
const rate5 = await page.evaluate(() => PS_TAX_RATE);
await page.evaluate(r => psSetTaxRate(String(r * 100)), st0.rate);
check('稅率設定（5% 後還原）', Math.abs(rate5 - 0.05) < 1e-12 && Math.abs((await page.evaluate(() => PS_TAX_RATE)) - st0.rate) < 1e-12, { rate5 });

// select only the fixture case and the fixture overhead month
await page.evaluate(code => { const all = psComputeData().unsettledCases.map(c => c.code); all.filter(c => c !== code).forEach(c => psToggleCase(c, false)); psSetOhRange('start', '2030-01'); psSetOhRange('end', '2030-01'); }, QA);
const comp = await page.evaluate(() => { const r = psComputeData(); return { codes: r.caseRows.map(c => c.code), gross: r.caseRows[0]?.gross, ohMonths: r.ohMonths.map(m => [m.month, m.total]), overheadTotal: r.overheadTotal, grandNet: r.grandNet, grandTax: r.grandTax, rows: r.rows.map(x => ({ p: x.person, net: x.net, salary: x.salary, bonus: x.bonus, adjustment: x.adjustment, unpaid: x.unpaid })), claim: r.claimMonths }; });
const rate = st0.rate;
const exGross = 500000 - 200000 - 30000 - 525000 / 1.05 * 0.05 / 2;
const exNet = exGross - 15000 - 525000 * rate;
const close = (a, b) => Math.abs(a - b) < 0.01;
check('結算試算：只含測試案件與 2030-01 開銷', JSON.stringify(comp.codes) === JSON.stringify([QA]) && JSON.stringify(comp.ohMonths) === JSON.stringify([[OHM, 15000]]) && comp.claim === OHM, { codes: comp.codes, ohMonths: comp.ohMonths });
check('結算試算：毛利、案件淨利、預留稅與獨立公式一致', close(comp.gross, exGross) && close(comp.grandNet, exNet) && close(comp.grandTax, -525000 * rate), { gross: comp.gross, exGross, grandNet: comp.grandNet, exNet });
const exRows = Object.entries(RATIOS).map(([p, r]) => { const row = comp.rows.find(x => x.p === p); const net = exNet * r; const unpaidRaw = net - row.salary - row.bonus - row.adjustment; return { p, net, unpaid: Math.abs(unpaidRaw) < 0.5 ? 0 : unpaidRaw }; });
check('每人分潤＝案件淨利×比例；未領＝分潤−薪資−已領−抵扣', exRows.every(e => { const row = comp.rows.find(x => x.p === e.p); return close(row.net, e.net) && close(row.unpaid, e.unpaid); }), { rows: comp.rows, exRows });

// settle (cancel, then confirm)
const pyNext = await page.evaluate(() => pyNextId);
confirmAnswer = false;
await page.evaluate(() => psRunSettlement());
check('結算按取消：不建立結算', (await page.evaluate(() => PROFIT_SETTLEMENTS.length)) === st0.settlements);
confirmAnswer = true;
await page.evaluate(() => psRunSettlement());
const settled = await page.evaluate(({ QA, OHM }) => { const s = PROFIT_SETTLEMENTS[PROFIT_SETTLEMENTS.length - 1]; const gen = PAYABLES.filter(p => (s.generatedPayableIds || []).includes(p.id)); const c = CASES.find(x => x.code === QA); return { id: s.id, date: s.date, cases: s.cases.map(x => x.code), grandNet: s.grandNet, persons: s.persons.map(p => [p.person, p.unpaid]), gen: gen.map(p => ({ person: p.profitPerson, amount: p.amount, type: p.paymentType, status: p.status, locked: p.systemLocked })), caseState: { psSettled: c.psSettled, status: c.status, through: c.psSettledThrough }, ohSettled: !!OVERHEAD[OHM].settled, audit: AUDIT_LOGS[0]?.action + '/' + AUDIT_LOGS[0]?.targetType, toast: window.__toasts[window.__toasts.length - 1] }; }, { QA, OHM });
const exGen = exRows.filter(e => e.unpaid > 0.5).map(e => ({ person: e.p, amount: Math.round(e.unpaid) }));
check('結算：紀錄、案件與開銷月份鎖定、寫審計', settled.cases.join() === QA && close(settled.grandNet, exNet) && settled.date === '2026-10-06' && settled.caseState.psSettled && settled.caseState.status === '結案' && settled.caseState.through === '2026-10-06' && settled.ohSettled && settled.audit === 'settle/profitSettlement', settled);
check('結算：產生的分潤應付款金額＝獨立計算的未領金額', JSON.stringify(settled.gen.map(g => [g.person, g.amount]).sort()) === JSON.stringify(exGen.map(g => [g.person, g.amount]).sort()) && settled.gen.every(g => g.type === 'profit_settlement' && g.status === 'approved' && g.locked), { gen: settled.gen, exGen });
check('結算後測試案件不再列入可結算、2030-01 不再可選', await page.evaluate(({ QA, OHM }) => !psIsProfitSettlementCase(CASES.find(c => c.code === QA)) && !psAvailableOverheadMonths().includes(OHM), { QA, OHM }));

// undo: refused while a generated payable is paid, then succeeds
if (settled.gen.length) {
  await page.evaluate(id => { const s = PROFIT_SETTLEMENTS.find(x => x.id === id); PAYABLES.find(p => p.id === s.generatedPayableIds[0]).status = 'paid'; }, settled.id);
  await clearToasts(page);
  await page.evaluate(id => psUndoSettlement(id), settled.id);
  check('已有分潤款付款時不能撤銷', (await lastToast(page)) === '本次結算已有分潤款付款，不能撤銷' && (await page.evaluate(id => PROFIT_SETTLEMENTS.some(s => s.id === id), settled.id)));
  await page.evaluate(id => { const s = PROFIT_SETTLEMENTS.find(x => x.id === id); PAYABLES.find(p => p.id === s.generatedPayableIds[0]).status = 'approved'; }, settled.id);
}
await page.evaluate(id => psUndoSettlement(id), settled.id);
const undone = await page.evaluate(({ id, QA, OHM, gen }) => { const c = CASES.find(x => x.code === QA); return { settlementGone: !PROFIT_SETTLEMENTS.some(s => s.id === id), genGone: !PAYABLES.some(p => gen.includes(p.id)), caseState: [c.psSettled, c.status], ohSettled: !!OVERHEAD[OHM].settled, count: PROFIT_SETTLEMENTS.length, audit: AUDIT_LOGS[0]?.action + '/' + AUDIT_LOGS[0]?.targetType, toast: window.__toasts[window.__toasts.length - 1] }; }, { id: settled.id, QA, OHM, gen: await page.evaluate(id => [], settled.id) });
const genIdsGone = await page.evaluate(ids => !PAYABLES.some(p => ids.includes(p.id) && p.paymentType === 'profit_settlement'), Array.from({ length: settled.gen.length }, (_, i) => pyNext + i));
check('撤銷結算：移除紀錄與待付分潤款、案件改回完工、開銷月份解鎖', undone.settlementGone && genIdsGone && undone.caseState[0] === false && undone.caseState[1] === '完工' && !undone.ohSettled && undone.count === st0.settlements && undone.audit === 'void/profitSettlement' && undone.toast === '已撤銷結算並還原資料', undone);
const recomp = await page.evaluate(() => { const r = psComputeData(); return { codes: r.caseRows.map(c => c.code), grandNet: r.grandNet }; });
check('撤銷後可重新結算、試算結果相同', recomp.codes.includes(QA) && (await page.evaluate(code => { const all = psComputeData().unsettledCases.map(c => c.code); all.filter(c => c !== code).forEach(c => psToggleCase(c, false)); psSetOhRange('start', '2030-01'); psSetOhRange('end', '2030-01'); return Math.abs(psComputeData().grandNet - (500000 - 200000 - 30000 - 12500 - 15000 - 525000 * PS_TAX_RATE)) < 0.01; }, QA)));
await page.evaluate(() => psRunSettlement());
const final = await page.evaluate(() => PROFIT_SETTLEMENTS[PROFIT_SETTLEMENTS.length - 1]);
check('重新結算成功（供重新載入驗證）', final.cases.some(c => c.code === QA) && (await lastToast(page)).startsWith('結算完成'));

// collapse preferences
const c0 = await page.evaluate(() => [psPayoutSettledCollapsed, psOhFutureCollapsed]);
await page.evaluate(() => { psTogglePayoutSettled(); psToggleOhFuture(); });
const c1 = await page.evaluate(() => ({ v: [psPayoutSettledCollapsed, psOhFutureCollapsed], ls: [localStorage.getItem('yutesign-ops-profitshare-payout-settled-collapsed'), localStorage.getItem('yutesign-ops-profitshare-oh-future-collapsed')] }));
check('收合偏好切換並寫入 localStorage', c1.v[0] === !c0[0] && c1.v[1] === !c0[1] && c1.ls.every(Boolean), c1);
await page.waitForTimeout(1200);
await waitSynced(page);
const snap = () => page.evaluate(code => JSON.stringify({ s: PROFIT_SETTLEMENTS.map(x => [x.id, x.date, x.grandNet, (x.cases || []).map(c => c.code), x.generatedPayableIds]), c: CASES.filter(x => x.code === code).map(x => [x.status, x.psSettled, x.psSettledThrough, x.profitSplit, x.splitRatio]), p: PAYABLES.filter(x => x.paymentType === 'profit_settlement' && (x.profitCaseCodes || []).includes(code)).map(x => [x.id, x.profitPerson, x.amount, x.status]), r: PS_TAX_RATE, pref: [psPayoutSettledCollapsed, psOhFutureCollapsed] }), QA);
const s1 = await snap();
await page.reload({ waitUntil: 'load' }); await waitReady(page);
check('重新載入後結算、案件、分潤應付款、稅率與偏好一樣', (await snap()) === s1);
await ctx.close();

// ═══════════ B: view_self (peng) ═══════════
H.setScenario('B-view_self(peng)');
ctx = await newContext('peng@yutesign.com', { fixedTime: NOW });
page = await openApp(ctx);
page.on('dialog', d => d.accept());
await nav(page, 'profitshare');
check('只看自己：權限 view_self、分潤頁可看', (await page.evaluate(() => permissionLevel('profitshare'))) === 'view_self' && (await page.evaluate(() => currentPage)) === 'profitshare');
const nS = await page.evaluate(() => PROFIT_SETTLEMENTS.length);
const ts = [];
for (const code of ['psRunSettlement()', `psUndoSettlement(PROFIT_SETTLEMENTS[PROFIT_SETTLEMENTS.length - 1].id)`, `psSetRatio('${QA}', 'peng', '90')`, `psSetProfitMode('${QA}', '三人')`, `psSetTaxRate('9')`, `psToggleCase('${QA}', false)`, `psSetOhRange('start', '2030-01')`]) { await page.evaluate(c => { window.__toasts = []; eval(c); }, code); ts.push(await lastToast(page)); }
check('只看自己：結算／撤銷／比例／模式／稅率／選案／期間都被拒、資料不變', ts.every(t => t === '您沒有修改此資料的權限') && (await page.evaluate(() => PROFIT_SETTLEMENTS.length)) === nS && (await page.evaluate(code => CASES.find(c => c.code === code).splitRatio.peng, QA)) === 0.2, ts);
await ctx.close();

// ═══════════ C: no access (lu_yanchen) ═══════════
H.setScenario('C-none(lu)');
ctx = await newContext('lu@yutesign.com', { fixedTime: NOW });
page = await openApp(ctx);
await clearToasts(page);
await page.evaluate(() => navTo('profitshare'));
check('無權限：分潤頁被拒、側欄隱藏', (await page.evaluate(() => permissionLevel('profitshare'))) === 'none' && (await lastToast(page)) === '您沒有此功能的權限' && !(await visible(page, '#nav-profitshare')));
await ctx.close();

// ═══════════ D: fresh browser ═══════════
H.setScenario('D-fresh(shower)');
ctx = await newContext('shower.li@yutesign.com', { fixedTime: NOW });
page = await openApp(ctx);
const fresh = await page.evaluate(code => ({ settled: PROFIT_SETTLEMENTS.some(s => (s.cases || []).some(c => c.code === code)), caseStatus: CASES.find(c => c.code === code)?.status }), QA);
check('全新瀏覽器（只讀雲端）看得到結算與結案狀態', fresh.settled && fresh.caseStatus === '結案', fresh);
const after = await counts(page);
check('集合變化只有測試資料與結算款', after.CASES === before.CASES + 1 && after.RECEIVABLES === before.RECEIVABLES + 1 && after.EXPENSES === before.EXPENSES + 1 && after.PAYABLES === before.PAYABLES + 1 + exGen.length && ['CLIENTS', 'VENDORS', 'PAYROLL'].every(k => after[k] === before[k]), { before, after, generated: exGen.length });
await ctx.close();

const fails = await H.finish(outJson, { finalCloudData: JSON.parse(JSON.stringify(H.state.cloud?.data || {})) });
process.exit(fails ? 1 : 0);
