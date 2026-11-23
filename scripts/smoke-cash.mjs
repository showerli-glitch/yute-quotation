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
const missing = await page.evaluate(() => ['cashCompute', 'cashRender', 'cashSaveBalances', 'cashOpenSettle', 'cashConfirmSettle', 'cashLeaseRemaining', 'cashCaseActuals', 'cashEstimateRun', 'cashSaveEstimate', 'cashCreateDefaults'].filter(n => typeof window[n] !== 'function'));
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
check('建立預設項目：5 個公司帳戶、玉山借款（兩台車租金改由應付期票帶入，不再預設）', items.length === 6 && items.filter(i => i[0] === 'account').length === 5 && items.some(i => i[1] === '玉山借款') && !items.some(i => i[0] === 'lease'), items);

// lease settings (added by hand): M340i 63,760 on the 5th, last 2027-10
await page.evaluate(() => cashStartEditItem('new'));
await page.selectOption('#cash-item-kind', 'lease');
await page.fill('#cash-item-name', 'M340i 租金');
await page.fill('#cash-item-monthly', '63,760');
await page.fill('#cash-item-payday', '5');
await page.fill('#cash-item-last', '2027-10');
await page.click('button[onclick="cashSaveItem()"]');
const lease = await page.evaluate(() => CASH_ITEMS.find(x => x.name === 'M340i 租金'));
check('租賃設定：每期金額、扣款日、最後一期', lease.monthlyPayment === 63760 && lease.payDay === 5 && lease.lastPayMonth === '2027-10', lease);
await page.evaluate(() => cashStartEditItem('new'));
await page.selectOption('#cash-item-kind', 'lease');
await page.fill('#cash-item-name', 'GOLF R 租金');
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

// typed amounts survive a re-render (user report 2026-11-20: typed 瑞興 支存 1,396,582, pressed 設定, the number was gone)
const zhiId = await page.evaluate(() => CASH_ITEMS.find(i => i.name === '瑞興銀行 支存').id);
await page.fill(`#cash-val-${zhiId}`, '1396582');
await page.fill('#cash-snap-date', '2026-09-30');
await page.click(`button[onclick="cashStartEditItem(${zhiId})"]`);
const kept = await page.evaluate(id => { const el = document.getElementById(`cash-val-${id}`); return { v: el.value, border: el.style.borderColor, note: document.getElementById('cash-snap-date').value, form: !!document.getElementById('cash-item-name'), btn: document.querySelector(`button[onclick="cashStartEditItem(${id})"]`).textContent, hint: document.getElementById('cash-draft-hint').innerText, saved: CASH_ITEMS.find(i => i.id === id).amount }; }, zhiId);
check('按「項目設定」後已打的金額和餘額日期還在、黃框提示還沒存、金額沒有被存', kept.v === '1396582' && kept.note === '2026-09-30' && kept.form && kept.btn === '項目設定' && kept.border.includes('warning') && kept.hint.startsWith('有 1 項金額還沒存') && kept.saved === 0, kept);
await page.evaluate(() => { cashEditingItemId = null; renderCurrentPage(); });
check('雲端同步重畫後仍保留', (await page.evaluate(id => document.getElementById(`cash-val-${id}`).value, zhiId)) === '1396582');

// enter this period dated 2026-10-01
const values = { '玉山銀行 活存': 500000, '瑞興銀行 活存': 3000000, '瑞興銀行 支存': 0, '國泰世華 活存': 2000000, '國泰世華 支存': 100000, '玉山借款': 3500000, 'M340i 租金': 765120, 'GOLF R 租金': 0, '李瑞興（私人）': 999999, 'GLB': 150000 };
await page.evaluate(v => { CASH_ITEMS.forEach(i => { const el = document.getElementById(`cash-val-${i.id}`); if (el && v[i.name] !== undefined) el.value = String(v[i.name]); }); }, values);
await page.fill('#cash-snap-date', '2026-10-01');
await page.click('button[onclick="cashSaveBalances()"]');
const bal = await page.evaluate(() => ({ snaps: CASH_SNAPSHOTS.length, toast: window.__toasts[window.__toasts.length - 1], zhi: CASH_ITEMS.find(i => i.name === '瑞興銀行 支存'), btn: [...document.querySelectorAll('#cash-container button')].map(b => b.textContent) }));
check('儲存銀行餘額：只存金額和餘額日期，不會存成一期', bal.snaps === 0 && bal.toast === '銀行餘額已儲存（2026-10-01）✓' && bal.zhi.amount === 0 && bal.zhi.asOfDate === '2026-10-01' && !!bal.zhi.balanceSavedAt && bal.btn.includes('儲存銀行餘額') && bal.btn.includes('本期結算') && !bal.btn.includes('存成本期'), bal);
await page.evaluate(() => { const i = CASH_ITEMS.find(x => x.name === 'GLB'); const el = document.getElementById(`cash-val-${i.id}`); el.value = '1'; el.dispatchEvent(new Event('input')); cashOpenSettle(); });
check('有金額還沒儲存時不能結算', (await lastToast(page)) === '有 1 項金額還沒儲存，請先按「儲存銀行餘額」' && !(await page.evaluate(() => document.getElementById('modal-cash-settle').classList.contains('open'))));
await page.evaluate(() => { const i = CASH_ITEMS.find(x => x.name === 'GLB'); const el = document.getElementById(`cash-val-${i.id}`); el.value = '150,000'; el.dispatchEvent(new Event('input')); });
await page.click('button[onclick="cashOpenSettle()"]');
const settleUi = await page.evaluate(() => ({ open: document.getElementById('modal-cash-settle').classList.contains('open'), text: document.getElementById('cash-settle-body').innerText, moves: !!document.getElementById('cash-settle-moves-ok') }));
check('本期結算視窗：列出餘額日期、四個數字，沒有新的收付款', settleUi.open && settleUi.text.includes('餘額日期 2026-10-01') && settleUi.text.includes('自有資金') && settleUi.text.includes('可動用金額') && settleUi.text.includes('沒有新的收付款') && !settleUi.moves, settleUi);
await page.fill('#cash-settle-date', '2026-10-01');
await page.fill('#cash-settle-note', 'QA第一期');
await page.click('#cash-settle-submit');
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
check('確認結算：建立一期並提示', r1.snaps === 1 && r1.toast === '已完成 2026-10-01 結算 ✓', r1);
check('儲存銀行餘額後沒有未存金額，提示不再顯示還沒存', await page.evaluate(() => cashPendingDrafts() === 0 && !document.getElementById('cash-draft-hint').innerText.includes('還沒存') && !document.querySelector('[id^="cash-val-"]').style.borderColor));
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

// 未結算個案：保守法整案排除（已收＋已開票未收−已記成本），公司先墊的不加回
const safe = await page.evaluate(({ A, B, C }) => {
  const r = cashCompute();
  const line = r.lines.find(l => l.label.startsWith('未結算個案淨收款'));
  const open = cashOpenCases().map(c => [c.code, cashCaseActuals(c).held]);
  return { a: cashCaseActuals(CASES.find(c => c.code === A)), b: cashCaseActuals(CASES.find(c => c.code === B)), line, exp: Math.round(open.filter(x => x[1] > 0.5).reduce((t, x) => t + x[1], 0)), codes: open.map(x => x[0]),
    noOld: !r.lines.some(l => /超前收款|未結算預估分潤/.test(l.label)), tax: r.lines.find(l => l.label === '預留營所稅') };
}, { A, B, C });
check('保守：甲案已收 150 萬、已付 42 萬 → 排除 108 萬；乙案公司先墊 40 萬只提醒不加回', safe.a.collected === 1500000 && safe.a.recordedCost === 420000 && safe.a.held === 1080000 && safe.b.held === -400000 && safe.line.amount === safe.exp && safe.line.detail.includes('QA資金甲 $1,080,000') && safe.line.detail.includes('公司先墊（未加回）') && safe.line.detail.includes('QA資金乙 $400,000') && [A, B, C].every(c => safe.codes.includes(c)), safe);
check('保守：不再有超前收款、未結算預估分潤；營所稅只留已結算未繳', safe.noOld && safe.tax.detail.includes('未結算個案已整案排除'), safe.tax);

// 預估：財務填「還可收／還要付」
await page.fill(`#cash-est-r-${A}`, '1,500,000');
await page.fill(`#cash-est-c-${A}`, '1680000');
await page.click(`button[onclick="cashSaveEstimate('${A}')"]`);
const est1 = await page.evaluate(A => { const c = CASES.find(x => x.code === A); const e = cashCaseEstimate(c); return { row: { ...e.row }, remR: e.remainingRevenue, remC: e.remainingCost, gross: e.gross, toast: window.__toasts[window.__toasts.length - 1], inR: document.getElementById(`cash-est-r-${A}`).value, inC: document.getElementById(`cash-est-c-${A}`).value, audit: AUDIT_LOGS[0] }; }, A);
check('甲案存預估：最終總收款 300 萬、總成本 210 萬，畫面顯示還可收 150 萬、還要付 168 萬', est1.row.finalRevenue === 3000000 && est1.row.finalCost === 2100000 && est1.row.date === '2026-10-13' && est1.inR === '1,500,000' && est1.inC === '1,680,000' && est1.toast === 'QA資金甲 預估已儲存 ✓' && est1.audit.targetType === 'cashEstimate', est1);
check('預估毛利＝300 萬−210 萬−稅務成本（300 萬÷1.05×5%÷2）', close(est1.gross, 3000000 - 2100000 - 3000000 / 1.05 * 0.05 / 2), est1.gross);
const added = await page.evaluate(A => {
  const p = { id: pyNextId++, case: A, caseName: 'QA資金甲', vendor: 'QA廠商', summary: '工程款', amount: 200000, status: 'paid', doneDate: '2026-10-10', paymentType: 'vendor' };
  const r = { id: rvNextId++, case: A, caseName: 'QA資金甲', item: '二期', collectAmt: 300000, collectDate: '2026-10-11', invoiceAmt: 300000, status: 'collected' };
  PAYABLES.push(p); RECEIVABLES.push(r);
  const e = cashCaseEstimate(CASES.find(x => x.code === A));
  return { p: p.id, r: r.id, remR: e.remainingRevenue, remC: e.remainingCost, gross: e.gross };
}, A);
check('之後記一筆付款 20 萬、收款 30 萬：還要付自動變 148 萬、還可收變 120 萬，預估毛利不變', added.remR === 1200000 && added.remC === 1480000 && close(added.gross, est1.gross), added);
const run = await page.evaluate(A => {
  const c = CASES.find(x => x.code === A); const a = cashCaseActuals(c); const e = cashCaseEstimate(c, a);
  const nR = RECEIVABLES.length, nP = PAYABLES.length;
  const d = cashEstimateRun([{ c, a, e }]);
  const row = d.caseRows.find(x => x.code === A);
  const r = cashCompute();
  const full = r.run.caseRows.find(x => x.code === A);
  const mine = r.open.find(x => x.c.code === A).mine;
  return { gross: row.gross, eGross: e.gross, fullNet: full.caseNet, allCases: r.run.caseRows.length === cashOpenCases().length, mine, sel: PS_SELECTED_CASES, complete: r.complete,
    same: RECEIVABLES.length === nR && PAYABLES.length === nP && !RECEIVABLES.some(x => String(x.id).startsWith('cash-est')) && !PAYABLES.some(x => String(x.id).startsWith('cash-est')),
    lines: r.estimate.lines.filter(l => l.group === '未領分潤').map(l => [l.label, l.amount]), myShare: r.myShare,
    out: r.estimate.lines.find(l => l.label.startsWith('預估還要付')), fin: r.estimate.lines.find(l => l.label.startsWith('預估還可收')), noEst: r.estimate.lines.find(l => l.label.startsWith('未填預估個案淨收款')),
    tax: r.estimate.lines.find(l => l.label === '預留營所稅'), estTax: Math.abs(full.taxReserve), summary: document.getElementById('cash-est-summary')?.innerText || '' };
}, A);
check('分潤用淨利潤儀表同一套算法：甲案毛利跟預估一致，算完把暫時的收付款拿掉、選取還原', close(run.gross, run.eGross) && run.same && run.sel === null, run);
check('公司開銷照毛利比例分攤到全部未結算個案；只有部分有預估時，李鎮宇可分＝有預估個案淨利×比例', run.allCases && !run.complete && close(run.mine, run.fullNet * 0.6) && close(run.myShare, run.mine), { mine: run.mine, fullNet: run.fullNet, myShare: run.myShare });
check('部分有預估：彭、連只算有預估個案的分潤（先不扣薪資），還要付 148 萬、未開票還可收 120 萬，沒填預估的照保守排除', JSON.stringify(run.lines) === JSON.stringify([['彭俞豪 預估分潤', Math.round(Math.max(0, run.fullNet * 0.2))], ['連星羽 預估分潤', Math.round(Math.max(0, run.fullNet * 0.2))]]) && run.out.detail.includes('QA資金甲 $1,480,000') && run.fin.detail.includes('QA資金甲 $1,200,000') && !!run.noEst && !run.noEst.detail.includes('QA資金甲') && close(run.tax.amount - Number(run.tax.detail.match(/已結算未繳 \$([\d,]+)/)[1].replace(/,/g, '')), Math.round(run.estTax)), run);
const full = await page.evaluate(A => {
  const added = cashOpenCases().filter(c => !cashEstimateRow(c.code)).map(c => { const a = cashCaseActuals(c); const row = { id: cashEstNextId++, caseCode: c.code, finalRevenue: a.collected + a.billedOpen, finalCost: a.recordedCost, date: cashToday() }; CASH_ESTIMATES.push(row); return row; });
  const r = cashCompute();
  const res = { complete: r.complete, lines: r.estimate.lines.filter(l => l.group === '未領分潤').map(l => [l.label, l.amount]), exp: r.run.rows.filter(p => p.person !== 'shower' && (Math.abs(p.net) > 0.5 || p.unpaid > 0.5)).map(p => [`${p.name} 預估分潤`, Math.round(Math.max(0, p.unpaid))]), myShare: r.myShare, expMy: r.run.rows.find(p => p.person === 'shower').net + r.run.companyRetained, noEst: r.estimate.lines.some(l => l.label.startsWith('未填預估')) };
  added.forEach(row => CASH_ESTIMATES.splice(CASH_ESTIMATES.indexOf(row), 1));
  return res;
}, A);
check('全部個案都有預估：照結算規則扣已領薪資和已付分潤款，李鎮宇含公司保留', full.complete && JSON.stringify(full.lines) === JSON.stringify(full.exp) && close(full.myShare, full.expMy) && !full.noEst, full);
const over = await page.evaluate(A => {
  const p = { id: pyNextId++, case: A, caseName: 'QA資金甲', vendor: 'QA廠商', summary: '追加', amount: 1600000, status: 'paid', doneDate: '2026-10-12', paymentType: 'vendor' };
  PAYABLES.push(p); cashRender();
  const e = cashCaseEstimate(CASES.find(x => x.code === A));
  const r = { remC: e.remainingCost, over: e.overCost, text: document.getElementById('cash-container').innerText };
  PAYABLES.splice(PAYABLES.indexOf(p), 1); cashRender();
  return r;
}, A);
check('已記成本超過預估：還要付停在 0，上方提醒更新預估', over.remC === 0 && over.over && over.text.includes('已記的成本超過預估') && over.text.includes('成本已超過預估'), { remC: over.remC, over: over.over });
await page.fill(`#cash-est-r-${C}`, '50000');
await page.click(`button[onclick="cashSaveEstimate('${C}')"]`);
check('還要付沒填不能存', (await lastToast(page)) === '請填「預估還可收」和「預估還要付」（沒有就填 0）' && !(await page.evaluate(C => !!cashEstimateRow(C), C)));
await page.evaluate(() => cashOpenSettle());
check('有個案預估打了沒存時不能結算', (await lastToast(page)) === '有 1 個個案預估還沒存，請先按該列的「存」');
await page.evaluate(C => { delete cashDrafts[`estR:${C}`]; cashRender(); }, C);
await page.click('#cash-mode-est');
const modeText = await page.evaluate(() => ({ t: document.getElementById('cash-container').innerText, mode: cashLineMode }));
check('明細切到「含預估利潤」：看得到預估還要付、預估分潤；KPI 兩種數字都有', modeText.mode === 'est' && modeText.t.includes('預估還要付') && modeText.t.includes('預估分潤') && modeText.t.includes('自有資金（保守）') && modeText.t.includes('含預估利潤') && modeText.t.includes('預估可分') && modeText.t.includes('照毛利比例分攤到全部未結算個案'), modeText.t.slice(0, 400));
await page.click('#cash-mode-safe');
// 成本控制表多一欄預估毛利（只有老闆／財務）
await nav(page, 'profit');
const cc = await page.evaluate(A => { const th = [...document.querySelectorAll('#pf-case-tbody')].length ? document.getElementById('pf-case-tbody').closest('table').querySelector('thead tr').lastElementChild.textContent : ''; const tr = [...document.querySelectorAll('#pf-case-tbody tr')].find(x => (x.getAttribute('onclick') || '').includes(A)); const head = document.getElementById('pf-case-tbody').closest('table').querySelectorAll('thead th').length; const cells = tr ? tr.children.length : 0; return { th, cell: tr ? tr.lastElementChild.textContent : '', head, cells }; }, A);
const ccExp = await page.evaluate(A => { const e = cashCaseEstimate(CASES.find(x => x.code === A)); return cashMoney(Math.abs(e.gross)); }, A);
check('成本控制表最後一欄「預估毛利」，甲案顯示預估、欄數對齊', cc.th === '預估毛利' && cc.cell === ccExp && cc.head === cc.cells, { cc, ccExp });
await nav(page, 'cash');
await page.evaluate(({ A, ids }) => { [ids.p].forEach(id => { const i = PAYABLES.findIndex(x => x.id === id); if (i >= 0) PAYABLES.splice(i, 1); }); [ids.r].forEach(id => { const i = RECEIVABLES.findIndex(x => x.id === id); if (i >= 0) RECEIVABLES.splice(i, 1); }); cashRender(); }, { A, ids: { p: added.p, r: added.r } });

// settings and second snapshot (difference from the previous one)
await nav(page, 'cash');
await page.fill('#cash-set-months', '2');
await page.fill('#cash-set-draw', '150,000');
await page.click('button[onclick="cashSaveSettings()"]');
const set = await page.evaluate(() => ({ s: { ...CASH_SETTINGS }, r: cashCompute() }));
check('安全水位設定：2 個月、每月 15 萬，立即生效', set.s.reserveMonths === 2 && set.s.ownerMonthlyDraw === 150000 && set.r.safety === Math.round(2 * (set.r.overhead.average + 150000)), set.s);
await page.evaluate(() => { const i = CASH_ITEMS.find(x => x.name === '玉山銀行 活存'); document.getElementById(`cash-val-${i.id}`).value = '600,000'; });
await page.fill('#cash-snap-date', '2026-10-13');
await page.click('button[onclick="cashSaveBalances()"]');
// a receivable collected after the balances were saved (the 2026-11-20 石牌 739,000 case)
const late = await page.evaluate(() => { const x = RECEIVABLES.find(r => !(Number(r.collectAmt) > 0)); x.collectAmt = 88000; x.collectDate = '2026-10-13'; x.status = 'collected'; x.updatedAt = new Date(Date.now() + 60000).toISOString(); cashRender(); return { id: x.id, warn: document.getElementById('cash-container').innerText }; });
check('餘額儲存後又記收款：上方提醒銀行餘額可能要重新登錄', late.warn.includes('又記了 1 筆收付款（收 $88,000／付 $0）'), late.warn.slice(0, 600));
await page.click('button[onclick="cashOpenSettle()"]');
const lateUi = await page.evaluate(() => ({ text: document.getElementById('cash-settle-body').innerText, box: !!document.getElementById('cash-settle-moves-ok') }));
check('結算視窗列出那筆收款，要勾選確認', lateUi.box && lateUi.text.includes(`收款 #${late.id}`) && lateUi.text.includes('+$88,000'), lateUi);
await page.fill('#cash-settle-date', '2026-10-13');
await page.click('#cash-settle-submit');
check('沒勾確認不能結算', (await lastToast(page)) === '請確認餘額儲存後的收付款都已反映在銀行餘額，或先更新銀行餘額' && (await page.evaluate(() => CASH_SNAPSHOTS.length)) === 1);
await page.check('#cash-settle-moves-ok');
await page.click('#cash-settle-submit');
const hist = await page.evaluate(() => { const s = cashSortedSnapshots(); return { n: s.length, d: s[0].own - s[1].own, latest: s[0].date, text: document.getElementById('cash-container').innerText }; });
check('第二期：歷史結算列兩期，「與上次結算差額」＝兩期自有資金相減', hist.n === 2 && hist.latest === '2026-10-13' && hist.text.includes('與上次結算差額') && hist.text.includes('歷史結算'), { n: hist.n, d: hist.d });
check('結算紀錄記下餘額儲存時間、之後的收付款筆數，和含預估的數字', await page.evaluate(() => { const s = cashSortedSnapshots()[0]; return !!s.balanceSavedAt && s.movesAfterBalance === 1 && s.estimate && Number.isFinite(s.estimate.own) && s.estimate.cases === 1 && document.getElementById('cash-container').innerText.includes('含預估自有資金'); }));
await page.fill('#cash-snap-date', '2026-12-31');
await page.click('button[onclick="cashSaveBalances()"]');
const futBal = await lastToast(page);
await page.fill('#cash-snap-date', '2026-10-13');
await page.evaluate(() => { cashOpenSettle(); document.getElementById('cash-settle-date').value = '2026-12-31'; const b = document.getElementById('cash-settle-moves-ok'); if (b) b.checked = true; cashConfirmSettle(); });
check('餘額日期、結算日都不能是未來日期', futBal === '餘額日期不能是未來日期' && (await lastToast(page)) === '結算日不能是未來日期' && (await page.evaluate(() => CASH_SNAPSHOTS.length)) === 2);
await page.evaluate(() => closeModal('modal-cash-settle'));

const keepEst = await page.evaluate(() => JSON.stringify(CASH_ESTIMATES.map(e => [e.id, e.caseCode, e.finalRevenue, e.finalCost])));
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
check('重新載入後個案預估還在', (await page.evaluate(() => JSON.stringify(CASH_ESTIMATES.map(e => [e.id, e.caseCode, e.finalRevenue, e.finalCost])))) === keepEst && keepEst.includes('3000000'), keepEst);
await nav(page, 'cash');
await page.evaluate(A => cashClearEstimate(A), A);
check('清除預估：甲案回到保守排除，留下刪除紀錄', await page.evaluate(A => !cashEstimateRow(A) && AUDIT_LOGS.some(a => a.action === 'delete' && a.targetType === 'cashEstimate') && cashCompute().estimate.lines.find(l => l.label.startsWith('未填預估個案淨收款')).detail.includes('QA資金甲'), A));
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
for (const fn of ['cashCreateDefaults', 'cashSaveBalances', 'cashOpenSettle', 'cashConfirmSettle', 'cashSaveSettings', 'cashSaveEstimate']) { await page.evaluate(fn => { window.__toasts = []; window[fn](); }, fn); pengToasts.push(await lastToast(page)); }
const pengWrites = await page.evaluate(t => ({ toasts: t, snaps: CASH_SNAPSHOTS.length, html: document.getElementById('cash-container').innerHTML }), pengToasts);
check('其他人（彭俞豪）看不到選單、進不去、所有寫入都被拒', !pengNav && pengToast === '您沒有此功能的權限' && pengWrites.toasts.length === 6 && pengWrites.toasts.every(t => t === '您沒有此功能的權限') && pengWrites.snaps === 1 && pengWrites.html === '', { pengNav, pengToast, pengWrites: { ...pengWrites, html: pengWrites.html.length } });
await page.evaluate(() => { try { navTo('profit'); } catch (e) {} });
check('其他人（彭俞豪）的成本控制表沒有預估毛利欄', (await page.evaluate(() => document.querySelectorAll('.cash-est-col').length)) === 0);
const after = await counts(page);
check('其他集合只多了測試個案與測試收付款', after.CASES === before.CASES + 3 && after.RECEIVABLES === before.RECEIVABLES + 2 && after.PAYABLES === before.PAYABLES + 2 && after.EXPENSES === before.EXPENSES && after.VENDORS === before.VENDORS && after.PAYROLL === before.PAYROLL, { before, after });
await ctx.close();

const fails = await H.finish(outJson, { finalCloudData: JSON.parse(JSON.stringify(H.state.cloud?.data || {})) });
process.exit(fails ? 1 : 0);
