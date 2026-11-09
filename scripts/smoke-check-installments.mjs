// 應付「期票分期」與資金試算連動 (claude/check-installments). Mock cloud only; never touches production.
// - 一筆總額拆成 N 張每月同一天的支票；票期已到的標已付款，之後的為待付款（預約匯款日＝票期）。
// - 新增與編輯都可以；編輯時原本那筆變成第一張。小月取月底；除不盡的尾數放最後一張。
// - 預付費用／分期攤提、分潤款等類型不能拆。
// - 資金試算把「有票期、待付款」列成「已開支票未兌現」，不和「已核准未付」重複。
//
// Setup (outside the repo):  mkdir /tmp/ops-smoke && cd /tmp/ops-smoke && npm i playwright-core
// Run:  PLAYWRIGHT_CORE=/tmp/ops-smoke/node_modules/playwright-core/index.mjs \
//         node scripts/smoke-check-installments.mjs <label> <rootDir> <port> <out.json>
import { createHarness } from './smoke-lib.mjs';

const [label, rootDir, portArg, outJson] = process.argv.slice(2);
const H = await createHarness({ label, rootDir, port: Number(portArg) });
const { check, newContext, openApp } = H;

H.setScenario('A-manage(shower)');
const ctx = await newContext('shower.li@yutesign.com', { fixedTime: new Date('2026-11-09T13:00:00+08:00') });
const page = await openApp(ctx);
page.on('dialog', d => d.accept());

const LOAN = 'YT-LOAN-QA-001';
await page.evaluate(code => {
  CASES.push({ code, name: 'QA李公司車（財盟）', client: '', status: '進行中', amount: 0, person: '李鎮宇', profitSplit: '不分潤', excludeFromProfitReports: true, caseType: '私人借支', accountingTreatment: 'receivable_from_related_party' });
  refreshAllCaseDropdowns();
  navTo('payable', document.getElementById('nav-payable'));
}, LOAN);

// 用表單填一筆並送出；fields 依序填入，最後照需要勾期票分期。
const fill = (f) => page.evaluate(f => {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  set('ap-add-payment-type', f.type); apTogglePaymentType();
  if (f.case !== undefined) { const el = document.getElementById('ap-add-case'); if (![...el.options].some(o => o.value === f.case)) { const o = document.createElement('option'); o.value = f.case; o.textContent = f.case + ' ' + f.caseName; el.appendChild(o); } el.value = f.case; }
  set('ap-add-vendor', f.vendor); set('ap-add-amount', f.amount); set('ap-add-summary', f.summary); set('ap-add-ticket', f.ticket || '');
  set('ap-add-date', f.date || '2026-10-28');
  if (f.overheadItem) set('ap-add-overhead-item', f.overheadItem);
  if (f.amStart) set('ap-add-amortization-start', f.amStart);
  if (f.amMonths) set('ap-add-amortization-months', f.amMonths);
  if (f.status) set('ap-add-status', f.status);
  document.getElementById('ap-installment-on').checked = !!f.count;
  if (f.count) set('ap-installment-count', String(f.count));
  apUpdateInstallmentPreview();
  return document.getElementById('ap-installment-preview').textContent;
}, f);
const rowsOf = vendor => page.evaluate(v => PAYABLES.filter(p => p.vendor === v).sort((a, b) => String(a.ticket).localeCompare(String(b.ticket))).map(p => ({ id: p.id, amount: p.amount, ticket: p.ticket, status: p.status, done: p.doneDate, transfer: p.transferDate, summary: p.summary, case: p.case, type: p.paymentType })), vendor);
const submit = () => page.evaluate(() => submitAddPayable());

// 1. 新增：財盟 956,400，12 張，第一張 2026-11-05（已過）。
await page.evaluate(() => openAddPayableModal());
const fieldShown = await page.evaluate(() => document.getElementById('ap-installment-field')?.style.display !== 'none' && !document.getElementById('ap-installment-on').checked);
check('新增應付：表單有「期票分期」，預設不勾', fieldShown);
const preview = await fill({ type: 'private_loan', case: LOAN, caseName: 'QA李公司車（財盟）', vendor: 'QA財盟', amount: '956,400', summary: '李公司車租金', ticket: '2026-11-05', count: 12 });
check('預覽：12 張每張 $79,700、票期 2026-11-05～2027-10-05、已到 1 張', preview.includes('12 張，每張 $79,700') && preview.includes('2026-11-05 ～ 2027-10-05') && preview.includes('前 1 張標已付款'), preview);
await submit();
const fm = await rowsOf('QA財盟');
const tickets = fm.map(r => r.ticket);
check('建立 12 筆：每張 79,700、總額 956,400、票期每月 5 日', fm.length === 12 && fm.every(r => r.amount === 79700) && fm.reduce((s, r) => s + r.amount, 0) === 956400 && tickets[0] === '2026-11-05' && tickets[11] === '2027-10-05' && tickets.every(t => t.endsWith('-05')), tickets);
check('11/05 已兌現→已付款、完成匯款日＝票期；其餘待付款、預約匯款日＝票期', fm[0].status === 'paid' && fm[0].done === '2026-11-05' && fm.slice(1).every(r => r.status === 'approved' && !r.done && r.transfer === r.ticket), fm.slice(0, 3));
check('每筆都是私人借支、同一個往來個案，摘要標「期票 n/12」', fm.every(r => r.type === 'private_loan' && r.case === LOAN) && fm[0].summary === '李公司車租金（期票 1/12）' && fm[11].summary === '李公司車租金（期票 12/12）', fm.map(r => r.summary));

// 2. 編輯既有的一筆（像現在的和運：預付費用攤提、10/28 一次付清）→ 改私人借支並拆 12 張，原本那筆變第一張，攤提消失。
const heId = await page.evaluate(code => {
  const row = { id: pyNextId++, case: '', caseName: '', vendor: 'QA和運', summary: '彭公司車月租金', amount: 536400, wantDate: '2026-10-28', bank: '瑞興銀行 支存 11-1160730', transferDate: '2026-10-28', doneDate: '', ticket: '', invoice: '無', receipt: '無', person: '鄭詩褣', paymentType: 'prepaid_expense', profitPerson: '', profitCaseCodes: [], overheadItem: 'QA彭公司車攤提', amortizationStartMonth: '2026-10', amortizationMonths: 12, status: 'paid', note: '' };
  PAYABLES.push(row); pyRebuildRentOverhead();
  return row.id;
}, LOAN);
const ohBefore = await page.evaluate(() => Object.values(OVERHEAD).flatMap(m => m.variable || []).filter(v => v.name === 'QA彭公司車攤提').length);
await page.evaluate(id => openEditPayableModal(id), heId);
check('編輯模式：期票分期預設不勾', !(await page.evaluate(() => document.getElementById('ap-installment-on').checked)));
await fill({ type: 'private_loan', case: LOAN, caseName: 'QA李公司車（財盟）', vendor: 'QA和運', amount: '536400', summary: '彭公司車月租金', ticket: '2026-10-25', count: 12 });
await submit();
const he = await rowsOf('QA和運');
const ohAfter = await page.evaluate(() => Object.values(OVERHEAD).flatMap(m => m.variable || []).filter(v => v.name === 'QA彭公司車攤提').length);
check('編輯拆票：原本那筆成為第一張，共 12 筆 44,700、合計 536,400', he.length === 12 && he[0].id === heId && he.every(r => r.amount === 44700) && he.reduce((s, r) => s + r.amount, 0) === 536400 && he[0].ticket === '2026-10-25' && he[11].ticket === '2027-09-25', he.map(r => [r.id, r.ticket]));
check('10/25 已兌現→已付款；11/25 起待付款', he[0].status === 'paid' && he[0].done === '2026-10-25' && he[1].status === 'approved' && he[1].ticket === '2026-11-25', he.slice(0, 2));
check('改成私人借支後，原本攤進公司開銷的 12 期消失', ohBefore === 12 && ohAfter === 0, { ohBefore, ohAfter });

// 3. 尾數與小月。
await page.evaluate(() => openAddPayableModal());
await fill({ type: 'vendor', case: 'YT-LOAN-QA-001', caseName: 'QA', vendor: 'QA尾數', amount: '100000', summary: 'QA尾數', ticket: '2027-01-31', count: 3 });
await submit();
const tail = await rowsOf('QA尾數');
check('除不盡：33,333／33,333／33,334；1/31 起小月取月底（2/28、3/31）', tail.map(r => r.amount).join(',') === '33333,33333,33334' && tail.map(r => r.ticket).join(',') === '2027-01-31,2027-02-28,2027-03-31' && tail.every(r => r.status === 'approved'), tail);

// 4. 不能拆的類型、少填欄位。
const before = await page.evaluate(() => PAYABLES.length);
await page.evaluate(() => openAddPayableModal());
const badPreview = await fill({ type: 'prepaid_expense', vendor: 'QA攤提', amount: '120000', summary: 'QA攤提', ticket: '2026-12-01', count: 12, overheadItem: 'QA攤提', amStart: '2026-12', amMonths: '12' });
await submit();
check('預付費用／分期攤提不能拆期票：提示且不新增', badPreview.includes('不能拆期票') && (await page.evaluate(() => PAYABLES.length)) === before && (await H.lastToast(page)) === '這個付款類型不能拆期票', badPreview);
await fill({ type: 'private_loan', case: LOAN, caseName: 'QA', vendor: 'QA少票期', amount: '120000', summary: 'QA少票期', ticket: '', count: 12 });
await submit();
check('沒填第一張票期：提示且不新增', (await page.evaluate(() => PAYABLES.length)) === before && (await H.lastToast(page)).startsWith('期票分期：請填'));

// 5. 不勾期票分期：照舊新增一筆。
await fill({ type: 'private_loan', case: LOAN, caseName: 'QA', vendor: 'QA單筆', amount: '5000', summary: 'QA單筆', ticket: '2026-12-10', count: 0, status: 'approved' });
await submit();
const single = await rowsOf('QA單筆');
check('不勾期票分期：只新增一筆，金額不變', single.length === 1 && single[0].amount === 5000 && single[0].summary === 'QA單筆', single);

// 6. 資金試算：有票期的待付款另列「已開支票未兌現」，不和已核准未付重複。
const cash = await page.evaluate(() => {
  const r = cashCompute();
  const line = l => r.lines.find(x => x.label.startsWith(l));
  const checks = PAYABLES.filter(p => p.status === 'approved' && p.ticket);
  const others = PAYABLES.filter(p => p.status === 'approved' && !p.ticket);
  return { checkLine: line('已開支票未兌現'), approvedLine: line('已核准未付'), expChecks: checks.reduce((s, p) => s + p.amount, 0), nChecks: checks.length, expOthers: others.reduce((s, p) => s + p.amount, 0),
    allApproved: PAYABLES.filter(p => p.status === 'approved').reduce((s, p) => s + p.amount, 0) };
});
check('資金試算：「已開支票未兌現」張數與金額＝有票期的待付款', cash.checkLine && cash.checkLine.label === `已開支票未兌現（${cash.nChecks} 張）` && cash.checkLine.amount === cash.expChecks && cash.nChecks === 11 + 11 + 3 + 1, cash);
check('資金試算：依票期列出接下來的到期日（最早 11/25 和運）', cash.checkLine?.detail.startsWith('2026-11-25 QA和運 $44,700') && cash.checkLine.detail.includes('2026-12-05 QA財盟 $79,700'), cash.checkLine?.detail);
check('資金試算：已核准未付不含支票，兩行加起來＝全部待付款（沒有重複）', cash.approvedLine.amount === cash.expOthers && cash.approvedLine.amount + cash.checkLine.amount === cash.allApproved, cash);
await ctx.close();

const fails = await H.finish(outJson);
process.exit(fails ? 1 : 0);
