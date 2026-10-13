// Duplicate-entry warnings, delete audit and the 淨利率 column (claude/case-settings). Mock cloud only;
// never touches production.
//
// Setup (outside the repo):  mkdir /tmp/ops-smoke && cd /tmp/ops-smoke && npm i playwright-core
// Run:  PLAYWRIGHT_CORE=/tmp/ops-smoke/node_modules/playwright-core/index.mjs \
//         node scripts/smoke-duplicates.mjs <label> <rootDir> <port> <out.json>
// Frozen clock (2026-10-13 14:00 Taipei). A fixture case YT-QA-2026-030 and client QADUP are added to the MOCK
// data only. Every confirm() is recorded; `confirmAnswer` decides whether it is accepted.
import { createHarness } from './smoke-lib.mjs';

const [label, rootDir, portArg, outJson] = process.argv.slice(2);
const H = await createHarness({ label, rootDir, port: Number(portArg) });
const { check, newContext, openApp, waitReady, waitSynced, nav, counts } = H;
const NOW = new Date('2026-10-13T14:00:00+08:00');
const QA = 'YT-QA-2026-030';
const QA2 = 'YT-QA-2026-031';

H.setScenario('A-manage(shower)');
let ctx = await newContext('shower.li@yutesign.com', { fixedTime: NOW });
let page = await openApp(ctx);
let confirmAnswer = true;
let dialogs = [];
page.on('dialog', d => { if (d.type() === 'confirm') dialogs.push(d.message()); return d.type() === 'confirm' && !confirmAnswer ? d.dismiss() : d.accept(); });
const before = await counts(page);
const missing = await page.evaluate(() => ['confirmDuplicateReceivableEntry', 'confirmDuplicatePayableEntry', 'confirmDuplicateExpenseEntries', 'auditDeletedRow', 'psNetMarginCell'].filter(n => typeof window[n] !== 'function'));
check('防呆、刪除紀錄、淨利率函式可用', missing.length === 0, { missing });

await page.evaluate(({ QA, QA2 }) => {
  CLIENTS.push({ code: 'QADUP', name: 'QA防呆客戶股份有限公司', shortName: 'QA防呆客戶', status: '有效' });
  CASES.push({ code: QA, name: 'QA防呆個案', client: 'QADUP', clientName: 'QA防呆客戶', status: '進行中', amount: 1000000, person: '李鎮宇' });
  CASES.push({ code: QA2, name: 'QA防呆個案二', client: 'QADUP', clientName: 'QA防呆客戶', status: '進行中', amount: 500000, person: '李鎮宇' });
  saveData();
}, { QA, QA2 });

// ── 應收 ──
const addReceivable = (f) => page.evaluate(f => {
  openAddReceivableModal();
  document.getElementById('rv-add-case').value = f.case;
  document.getElementById('rv-add-client').value = 'QADUP';
  document.getElementById('rv-add-buyer').value = 'QA防呆客戶股份有限公司';
  document.getElementById('rv-add-item').value = f.item;
  document.getElementById('rv-add-collect-amt').value = f.collect ? String(f.collect) : '';
  document.getElementById('rv-add-collect-date').value = f.date || '';
  document.getElementById('rv-add-invoice-amt').value = f.invoice ? String(f.invoice) : '';
  document.getElementById('rv-add-invoice-no').value = f.invoiceNo || '';
  const n = RECEIVABLES.length;
  submitAddReceivable();
  return { added: RECEIVABLES.length - n, id: RECEIVABLES[RECEIVABLES.length - 1].id };
}, f);
dialogs = [];
const r1 = await addReceivable({ case: QA, item: '第一期', collect: 100000, date: '2026-09-01', invoice: 100000, invoiceNo: 'QA11110001' });
check('應收：第一筆沒有重複，不跳提醒', r1.added === 1 && dialogs.length === 0, { r1, dialogs });
dialogs = []; confirmAnswer = false;
const r2c = await addReceivable({ case: QA, item: '第二期', collect: 100000, date: '2026-10-01' });
check('應收：同個案、同客戶、同金額 → 提醒；按取消不新增', r2c.added === 0 && dialogs.length === 1 && dialogs[0].includes('可能重複輸入') && dialogs[0].includes(`#${r1.id}`) && dialogs[0].includes('已入帳 $100,000（2026-09-01）'), { r2c, dialogs });
dialogs = []; confirmAnswer = true;
const r2 = await addReceivable({ case: QA, item: '第二期', collect: 100000, date: '2026-10-01' });
check('應收：按確定才新增（確定是另一期款）', r2.added === 1 && dialogs.length === 1, { r2, dialogs });
dialogs = []; confirmAnswer = false;
const r3c = await addReceivable({ case: QA2, item: '別案', collect: 50000, date: '2026-10-02', invoice: 50000, invoiceNo: 'QA11110001' });
check('應收：同一張發票號碼（即使不同個案、不同金額）→ 提醒', r3c.added === 0 && dialogs.length === 1 && dialogs[0].includes('發票號碼 QA11110001'), { r3c, dialogs });
dialogs = []; confirmAnswer = true;
const r4 = await addReceivable({ case: QA2, item: '別案不同金額', collect: 100000, date: '2026-10-02' });
check('應收：不同個案、同客戶同金額、無發票 → 不提醒', r4.added === 1 && dialogs.length === 0, { r4, dialogs });
const editR = (id, patch) => page.evaluate(({ id, patch }) => {
  openEditReceivableModal(id);
  Object.entries(patch).forEach(([k, v]) => { document.getElementById(k).value = v; });
  submitAddReceivable();
  const r = RECEIVABLES.find(x => x.id === id);
  return { note: r.note, collectAmt: r.collectAmt };
}, { id, patch });
dialogs = [];
const e1 = await editR(r2.id, { 'rv-add-note': '只改備註' });
check('應收：編輯但個案／客戶／金額／發票沒變 → 不重複提醒', e1.note === '只改備註' && dialogs.length === 0, { e1, dialogs });
dialogs = []; confirmAnswer = false;
const e2 = await editR(r4.id, { 'rv-add-invoice-no': 'QA11110001', 'rv-add-invoice-amt': '100000' });
check('應收：編輯改成重複的發票號碼 → 提醒；取消則不存', dialogs.length === 1 && (await page.evaluate(id => RECEIVABLES.find(x => x.id === id).invoiceNo || '', r4.id)) === '', { e2, dialogs });
confirmAnswer = true;
await page.evaluate(() => closeModal('modal-add-receivable'));

// ── 應付 ──
const addPayable = (f) => page.evaluate(f => {
  openAddPayableModal();
  document.getElementById('ap-add-case').value = f.case;
  document.getElementById('ap-add-vendor').value = f.vendor;
  document.getElementById('ap-add-amount').value = String(f.amount);
  document.getElementById('ap-add-summary').value = f.summary || 'QA工程款';
  document.getElementById('ap-add-date').value = '2026-10-20';
  const n = PAYABLES.length;
  submitAddPayable();
  return { added: PAYABLES.length - n, id: PAYABLES[PAYABLES.length - 1].id };
}, f);
dialogs = [];
const p1 = await addPayable({ case: QA, vendor: 'QA-001 - QA防呆廠商', amount: 30000 });
check('應付：第一筆不提醒', p1.added === 1 && dialogs.length === 0, { p1, dialogs });
dialogs = []; confirmAnswer = false;
const p2 = await addPayable({ case: QA, vendor: 'QA防呆廠商', amount: 30000, summary: '同一筆再輸入' });
check('應付：同個案、同廠商（含不含代碼都算）、同金額 → 提醒；取消不新增', p2.added === 0 && dialogs.length === 1 && dialogs[0].includes(`#${p1.id}`) && dialogs[0].includes('相同廠商、相同金額'), { p2, dialogs });
dialogs = []; confirmAnswer = true;
const p3 = await addPayable({ case: QA, vendor: '另一家廠商', amount: 30000 });
const p4 = await addPayable({ case: QA, vendor: 'QA防呆廠商', amount: 31000 });
check('應付：不同廠商同金額、同廠商不同金額 → 都不提醒', p3.added === 1 && p4.added === 1 && dialogs.length === 0, { p3, p4, dialogs });
await page.evaluate(() => closeModal('modal-add-payable'));

// ── 廠商請款（同一份 PAYABLES） ──
const addPayreq = (f) => page.evaluate(f => {
  openPayreqModal();
  document.getElementById('pr-case').value = f.case;
  document.getElementById('pr-vendor').value = f.vendor;
  document.getElementById('pr-amount').value = String(f.amount);
  document.getElementById('pr-summary').value = f.summary;
  document.getElementById('pr-date').value = '2026-10-25';
  payreqSubmitting = false;
  const n = PAYABLES.length;
  submitPayReq();
  payreqSubmitting = false;
  return { added: PAYABLES.length - n };
}, f);
dialogs = []; confirmAnswer = false;
const q1 = await addPayreq({ case: QA, vendor: 'QA防呆廠商', amount: 30000, summary: '請款再送一次' });
check('廠商請款：和既有應付同個案、同廠商、同金額 → 提醒；取消不送出', q1.added === 0 && dialogs.length === 1 && dialogs[0].includes('廠商請款'), { q1, dialogs });
dialogs = []; confirmAnswer = true;
const q2 = await addPayreq({ case: QA, vendor: 'QA防呆廠商', amount: 30000, summary: '確定是另一筆' });
check('廠商請款：確定後送出', q2.added === 1 && dialogs.length === 1, { q2, dialogs });
await page.evaluate(() => closeModal('modal-payreq'));

// ── 費用 ──
const addExpenses = (rows) => page.evaluate(({ rows, QA }) => {
  expBatchEditId = null; expBatchInit();
  document.getElementById('exp-batch-month').value = '2026-10';
  const trs = [...document.querySelectorAll('#exp-batch-tbody tr')];
  rows.forEach((r, i) => {
    const ins = trs[i].querySelectorAll('input,select');
    ins[0].value = QA; expBatchCaseChanged(ins[0]);
    ins[2].value = r.date; ins[3].value = r.item; ins[4].value = String(r.amount);
  });
  const n = EXPENSES.length;
  submitBatchExpense();
  return { added: EXPENSES.length - n, ids: EXPENSES.slice(n).map(e => e.id) };
}, { rows, QA });
dialogs = [];
const x1 = await addExpenses([{ date: '2026-10-05', item: 'QA材料', amount: 1234 }]);
check('費用：第一筆不提醒', x1.added === 1 && dialogs.length === 0, { x1, dialogs });
dialogs = []; confirmAnswer = false;
const x2 = await addExpenses([{ date: '2026-10-06', item: 'QA材料（又一次）', amount: 1234 }, { date: '2026-10-07', item: 'QA其他', amount: 999 }, { date: '2026-10-07', item: 'QA其他', amount: 999 }]);
check('費用：同申請人、同個案、同金額（既有與批次內）→ 一次提醒列出；取消整批不送', x2.added === 0 && dialogs.length === 1 && dialogs[0].includes(`既有 #${x1.ids[0]}`) && dialogs[0].includes('第 3 列和第 2 列'), { x2, dialogs });
dialogs = []; confirmAnswer = true;
const x3 = await addExpenses([{ date: '2026-10-08', item: 'QA不同金額', amount: 4321 }]);
check('費用：不同金額不提醒', x3.added === 1 && dialogs.length === 0, { x3, dialogs });
await page.evaluate(() => expBatchClose());

// ── 刪除紀錄 ──
const delAudit = (type, id) => page.evaluate(({ type, id }) => { const a = AUDIT_LOGS.find(l => l.action === 'delete' && l.targetType === type && String(l.targetId) === String(id)); return a ? { who: a.actorName, email: a.actorEmail, before: a.before, label: a.targetLabel, risk: a.riskLevel } : null; }, { type, id });
await page.evaluate(id => deleteReceivableConfirm(id), r2.id);
let a = await delAudit('receivable', r2.id);
check('刪除應收：審計紀錄有刪除人與整筆原資料', a && a.who === '李鎮宇' && a.email === 'shower.li@yutesign.com' && a.before?.collectAmt === 100000 && a.before?.item === '第二期' && a.risk === 'high' && !(await page.evaluate(id => RECEIVABLES.some(r => r.id === id), r2.id)), a);
await page.evaluate(id => deletePayableConfirm(id), p3.id);
a = await delAudit('payable', p3.id);
check('刪除應付：審計紀錄有刪除人與整筆原資料', a && a.who === '李鎮宇' && a.before?.vendor === '另一家廠商' && a.before?.amount === 30000, a);
await page.evaluate(id => deleteExpense(id), x3.ids[0]);
a = await delAudit('expense', x3.ids[0]);
check('刪除費用：審計紀錄有刪除人與整筆原資料', a && a.who === '李鎮宇' && a.before?.amount === 4321 && a.before?.item === 'QA不同金額', a);
const others = await page.evaluate(() => {
  const tax = { id: 'QA-TAX-1', taxType: '營業稅', period: '2030-01~02', amount: 1000, status: 'pending', source: 'manual_tax_management' };
  TAX_LIABILITIES.push(tax);
  if (!OVERHEAD['2030-03']) OVERHEAD['2030-03'] = { fixed: OH_FIXED_CONFIG.map(() => 0), variable: [] };
  OVERHEAD['2030-03'].variable.push({ id: 987654, name: 'QA臨時開銷', amount: 500 });
  const leave = { id: 98765, person: 'lu_yanchen', date: '2030-03-02', type: '特休', hours: 8 };
  ATTENDANCE_LEAVES.push(leave);
  taxDeleteLiability('QA-TAX-1'); ohDeleteVar('2030-03', 987654); attDeleteLeave(98765);
  const find = (t, id) => AUDIT_LOGS.find(l => l.action === 'delete' && l.targetType === t && String(l.targetId) === String(id));
  return { tax: find('taxLiability', 'QA-TAX-1')?.before?.amount, oh: find('overheadVariable', 987654)?.before?.name, leave: find('attendanceLeave', 98765)?.before?.date,
    gone: !TAX_LIABILITIES.some(r => r.id === 'QA-TAX-1') && !OVERHEAD['2030-03'].variable.some(v => v.id === 987654) && !ATTENDANCE_LEAVES.some(r => r.id === 98765) };
});
check('刪除繳稅紀錄、公司變動開銷、請假紀錄也會寫審計', others.tax === 1000 && others.oh === 'QA臨時開銷' && others.leave === '2030-03-02' && others.gone, others);

// ── 淨利率 ──
await nav(page, 'profitshare');
const margin = await page.evaluate(() => {
  const table = [...document.querySelectorAll('#page-profitshare table')].find(t => [...t.querySelectorAll('th')].some(th => th.textContent.trim() === '淨利率'));
  if (!table) return { table: false };
  const heads = [...table.querySelectorAll('thead th')].map(th => th.textContent.trim());
  const r = psComputeData();
  const fmtRate = (net, rev) => rev > 0 ? (net / rev * 100).toFixed(1) + '%' : '—';
  const bodyRows = [...table.querySelectorAll('tbody tr')].map(tr => [tr.cells[0]?.textContent.trim(), tr.cells[tr.cells.length - 1]?.textContent.trim()]);
  const expected = r.caseRows.map(c => [c.name, fmtRate(c.caseNet, c.revenue)]);
  const foot = table.querySelector('tfoot tr');
  const totalRev = r.caseRows.reduce((s, c) => s + (c.revenue || 0), 0);
  return { table: true, last: heads[heads.length - 1], bodyRows, expected, foot: foot?.cells[foot.cells.length - 1]?.textContent.trim(), expFoot: fmtRate(r.grandNet, totalRev), withRevenue: r.caseRows.filter(c => c.revenue > 0).length };
});
check('淨利潤儀表：最後一欄是淨利率＝稅後個案淨利÷本次收入，小計同', margin.table && margin.last === '淨利率' && JSON.stringify(margin.bodyRows) === JSON.stringify(margin.expected) && margin.foot === margin.expFoot && margin.withRevenue > 0, margin);
const qaRevenue = await page.evaluate(() => {
  const c = psComputeData().caseRows[0];
  return c ? { revenue: c.revenue, recomputed: RECEIVABLES.filter(r => r.case === c.code && receivableIsCollected(r) && (!c.isIncrementalRound || String(r.collectDate || '') > psCaseSettlementCutoff(CASES.find(x => x.code === c.code)))).reduce((s, r) => s + (r.collectAmt || 0), 0), override: Number.isFinite(CASES.find(x => x.code === c.code)?.revenueOverride) } : null;
});
check('本次收入＝本次結算範圍內的已入帳金額（未用歷史 override 時）', qaRevenue && (qaRevenue.override || qaRevenue.revenue === qaRevenue.recomputed), qaRevenue);

// ── 重新載入 ──
await waitSynced(page);
await page.reload({ waitUntil: 'load' }); await waitReady(page);
const persisted = await page.evaluate(({ r2, p3, x3 }) => ['receivable:' + r2, 'payable:' + p3, 'expense:' + x3, 'taxLiability:QA-TAX-1', 'overheadVariable:987654', 'attendanceLeave:98765']
  .every(k => { const [t, id] = k.split(':'); return AUDIT_LOGS.some(l => l.action === 'delete' && l.targetType === t && String(l.targetId) === id); }), { r2: r2.id, p3: p3.id, x3: x3.ids[0] });
check('重新載入後刪除紀錄仍在（已同步）', persisted);
const after = await counts(page);
check('集合變化只有測試資料', after.CASES === before.CASES + 2 && after.CLIENTS === before.CLIENTS + 1 && after.RECEIVABLES === before.RECEIVABLES + 2 && after.PAYABLES === before.PAYABLES + 3 && after.EXPENSES === before.EXPENSES + 1 && after.VENDORS === before.VENDORS && after.PAYROLL === before.PAYROLL && after.ATTENDANCE_LEAVES === before.ATTENDANCE_LEAVES, { before, after });
await ctx.close();

const fails = await H.finish(outJson, { finalCloudData: JSON.parse(JSON.stringify(H.state.cloud?.data || {})) });
process.exit(fails ? 1 : 0);
