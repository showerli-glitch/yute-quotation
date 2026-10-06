// Payroll (薪資管理) smoke test, including owner withdrawals. Mock cloud only; never touches production.
//
// Setup (outside the repo):  mkdir /tmp/ops-smoke && cd /tmp/ops-smoke && npm i playwright-core
// Run:  PLAYWRIGHT_CORE=/tmp/ops-smoke/node_modules/playwright-core/index.mjs \
//         node scripts/smoke-payroll.mjs <label> <rootDir> <port> <out.json>
// Frozen clock (2026-10-06 14:00 Taipei) so two runs produce byte-comparable final cloud snapshots.
// Amounts are re-derived with an independent formula (A + B − C, transfer = net − advance).
// Checks labelled 「修正後」 assert the payroll fixes on claude/fix-known-issues (month deletion, prNextId, tombstone migration).
import { createHarness } from './smoke-lib.mjs';

const [label, rootDir, portArg, outJson] = process.argv.slice(2);
const H = await createHarness({ label, rootDir, port: Number(portArg) });
const { check, newContext, openApp, waitReady, waitSynced, lastToast, clearToasts, isOpen, visible, nav, counts } = H;
const NOW = new Date('2026-10-06T14:00:00+08:00');
const money = n => '$' + Number(n).toLocaleString('zh-TW');
// independent re-implementation used only for expectations
const netOf = r => {
  const n = k => Number(r?.[k] || 0);
  const custom = (r?.customItems || []).reduce((s, it) => s + Number(it.amount || 0), 0);
  const a = n('baseSalary') + n('phoneAllowance') + n('fullAttendanceBonus') + n('dutyAllowance') + n('performanceBonus') + n('mealAllowance');
  const b = n('overtimePay') + n('expenseReimbursement') + n('yearEndBonus') + n('engineeringBonus') + custom;
  const c = n('laborInsurance') + n('healthInsurance') + n('voluntaryPension') + n('leaveDeduction');
  return { a, b, c, net: a + b - c, transfer: a + b - c - n('advancePaid') };
};
const shown = page => page.evaluate(() => ({ net: document.getElementById('pr-net-pay')?.textContent, transfer: document.getElementById('pr-transfer')?.textContent, a: document.getElementById('pr-a-total')?.textContent, b: document.getElementById('pr-b-total')?.textContent, c: document.getElementById('pr-c-total')?.textContent }));
const selectMonth = async (page, m) => { await page.selectOption('#pr-filter-month', m); await page.evaluate(() => renderPayroll()); };
const selectTab = async (page, id) => { await page.evaluate(id => prSelectEmp(document.querySelector(`#payroll-emp-tabs button[onclick*="'${id}'"]`), id), id); };

// ═══════════ A: payroll manager (shower) ═══════════
H.setScenario('A-manage(shower)');
let ctx = await newContext('shower.li@yutesign.com', { fixedTime: NOW });
let page = await openApp(ctx);
let confirmAnswer = true;
const dialogs = [];
page.on('dialog', d => { dialogs.push({ type: d.type(), message: d.message() }); return d.type() === 'confirm' && !confirmAnswer ? d.dismiss() : d.accept(); });
const before = await counts(page);
const missing = await page.evaluate(() => ['prIsValidMonth','prRenderMonthOptions','openPayrollMonthModal','submitPayrollMonth','prDeleteMonth','prSelectableUsers','prRenderEmployeeTabs','prSelectEmp','ownerWithdrawalTypeLabel','ownerWithdrawalRows','prCopyOwnerWithdrawalFromLastMonth','togglePayrollRangeOverview','renderPayrollRangeOverview','renderOwnerWithdrawalPanel','openOwnerWithdrawalModal','submitOwnerWithdrawal','deleteOwnerWithdrawal','prGetConfig','renderPayroll','openEditPayroll','prAddCustomItem','prGetCustomItems','submitPayroll','printPayslip','prLiveCalc','psPayrollSum'].filter(n => typeof window[n] !== 'function'));
const data0 = await page.evaluate(() => ({ cfg: Object.keys(PR_CONFIG).length, seed: CODEX_SEED_PAYROLL.length, payroll: PAYROLL.length, months: PAYROLL_MONTHS.slice(), deleted: PAYROLL_DELETED_MONTHS.length, nextId: prNextId }));
check('薪資函式與資料宣告皆可用', missing.length === 0 && data0.cfg > 0 && data0.seed > 0 && data0.payroll > 0, { missing, ...data0, months: data0.months.length });
await nav(page, 'payroll');
check('薪資頁可進入、管理者看得到新增月份／刪除月份／編輯', (await page.evaluate(() => currentPage)) === 'payroll' && await visible(page, '#btn-payroll-add-month') && await visible(page, '#btn-payroll-delete-month'));
const monthOpts = await page.$$eval('#pr-filter-month option', os => os.map(o => o.value));
check('月份選單：由新到舊、含薪資月份', monthOpts.length > 0 && monthOpts.every((m, i) => i === 0 || monthOpts[i - 1] > m) && data0.months.every(m => monthOpts.includes(m)), monthOpts.slice(0, 4));

// existing seed record → displayed totals
await selectMonth(page, '2026-05');
await selectTab(page, 'peng');
const pengMay = await page.evaluate(() => PAYROLL.find(r => r.person === 'peng' && r.month === '2026-05'));
let exp = netOf(pengMay);
let s = await shown(page);
check('既有薪資單：實領／轉帳金額與獨立公式一致', s.net === money(exp.net) && s.transfer === money(exp.transfer), { shown: s, expected: exp });
const tabs = await page.$$eval('#payroll-emp-tabs button', bs => bs.map(b => b.textContent.trim()));
check('員工分頁：管理者含「李鎮宇」與可選員工', tabs[0] === '李鎮宇' && tabs.includes('彭俞豪'), tabs);

// add month
await page.click('#btn-payroll-add-month');
await page.fill('#pr-new-month', '2026-11');
await page.click('#modal-payroll-month .btn-primary');
check('新增月份 2026-11', (await page.evaluate(() => PAYROLL_MONTHS.includes('2026-11'))) && (await page.inputValue('#pr-filter-month')) === '2026-11' && (await lastToast(page)) === '月份已新增 ✓');
dialogs.length = 0;
await page.click('#btn-payroll-add-month');
await page.fill('#pr-new-month', '2026-05');
await page.click('#modal-payroll-month .btn-primary');
check('重複月份被擋（提示此月份已存在）', dialogs[0]?.message === '此月份已存在' && (await page.evaluate(() => PAYROLL_MONTHS.filter(m => m === '2026-05').length)) === 1);
await page.evaluate(() => closeModal('modal-payroll-month'));

// edit a new payslip (prefilled from the latest earlier record)
await selectMonth(page, '2026-11');
await selectTab(page, 'peng');
await page.click('#btn-payroll-edit');
const pre = await page.evaluate(() => ({ title: document.getElementById('pr-modal-title').textContent, base: document.getElementById('pr-baseSalary').value, overtime: document.getElementById('pr-overtimePay').value }));
check('編輯新月份：沿用最近一期的固定項、變動項歸零', await isOpen(page, 'modal-edit-payroll') && pre.title === '彭俞豪 2026-11 薪資單' && pre.base === String(pengMay.baseSalary) && pre.overtime === '0', pre);
await page.fill('#pr-overtimePay', '3000');
await page.fill('#pr-performanceBonus', '6000');
await page.click('button[onclick="prAddCustomItem()"]');
await page.locator('#pr-custom-items > div').last().locator('input').nth(0).fill('QA交通補助');
await page.locator('#pr-custom-items > div').last().locator('input').nth(1).fill('1,200');
await page.fill('#pr-leaveDeduction', '500');
await page.fill('#pr-voluntaryPension', '700');
await page.fill('#pr-advancePaid', '2000');
await page.fill('#pr-bank', 'QA銀行');
await page.fill('#pr-account', '000111222333');
await page.evaluate(() => prLiveCalc());
const live = await page.evaluate(() => ({ net: document.getElementById('pr-live-net').textContent, transfer: document.getElementById('pr-live-transfer').textContent }));
const draftRec = { ...pengMay, overtimePay: 3000, performanceBonus: 6000, expenseReimbursement: 0, yearEndBonus: 0, engineeringBonus: 0, customItems: [{ name: 'QA交通補助', amount: 1200 }], leaveDeduction: 500, voluntaryPension: 700, advancePaid: 2000 };
exp = netOf(draftRec);
check('即時試算：實領／轉帳', live.net === money(exp.net) && live.transfer === money(exp.transfer), { live, expected: exp });
const nextPr = await page.evaluate(() => prNextId);
await page.click('#modal-edit-payroll .btn-primary');
const saved = await page.evaluate(() => PAYROLL.find(r => r.person === 'peng' && r.month === '2026-11'));
check('儲存薪資單：新紀錄、欄位與自訂加項', saved && saved.id === nextPr && saved.overtimePay === 3000 && saved.performanceBonus === 6000 && saved.customItems?.[0]?.amount === 1200 && saved.leaveDeduction === 500 && saved.advancePaid === 2000 && (await lastToast(page)) === '薪資單已儲存 ✓', saved && { id: saved.id, ot: saved.overtimePay });
s = await shown(page);
check('薪資頁：實領與轉帳金額', s.net === money(netOf(saved).net) && s.transfer === money(netOf(saved).transfer), { shown: s, expected: netOf(saved) });
const acctAudit = await page.evaluate(() => { const a = AUDIT_LOGS[0]; return { type: a?.targetType, last4: a?.after?.accountLast4, leaks: JSON.stringify(a || {}).includes('000111222333'), cfg: PR_CONFIG.peng.account, emp: EMPLOYEES.find(e => e.id === 'peng')?.payrollAccount }; });
check('匯款帳戶更新：寫入員工與設定、審計只留末四碼', acctAudit.type === 'employeePayrollAccount' && acctAudit.last4 === '2333' && !acctAudit.leaks && acctAudit.cfg === '000111222333' && acctAudit.emp === '000111222333', acctAudit);
await page.click('#btn-payroll-edit');
await page.fill('#pr-overtimePay', '3500');
await page.click('#modal-edit-payroll .btn-primary');
check('再次編輯同月：更新同一筆、不新增', (await page.evaluate(() => PAYROLL.filter(r => r.person === 'peng' && r.month === '2026-11').length)) === 1 && (await page.evaluate(() => PAYROLL.find(r => r.person === 'peng' && r.month === '2026-11').overtimePay)) === 3500);

// print payslip (capture the popup HTML)
const printed = await page.evaluate(() => { let html = ''; const orig = window.open; window.open = () => ({ document: { write: h => { html += h; }, close() {} }, focus() {}, print() {} }); try { printPayslip(); } finally { window.open = orig; } return html; });
const pengNov = await page.evaluate(() => PAYROLL.find(r => r.person === 'peng' && r.month === '2026-11'));
check('列印薪資單：內容含姓名、月份與實領金額', printed.includes('彭俞豪') && printed.includes('2026') && printed.includes(netOf(pengNov).net.toLocaleString('zh-TW')), { length: printed.length });

// owner withdrawal
await page.evaluate(() => openOwnerWithdrawalModal());
const owDef = await page.evaluate(() => ({ title: document.getElementById('ow-modal-title').textContent, person: document.getElementById('ow-person').value, type: document.getElementById('ow-type').value, status: document.getElementById('ow-status').value, date: document.getElementById('ow-date').value }));
check('股東／分潤提領視窗預設值', owDef.title === '新增股東／分潤提領' && owDef.person === 'shower' && owDef.type === 'fixed_profit_advance' && owDef.status === 'paid', owDef);
await page.fill('#ow-amount', '');
await clearToasts(page);
await page.click('#ow-submit-btn');
check('提領金額必填', (await lastToast(page)) === '請填寫提領金額');
await page.fill('#ow-date', '2026-11-05');
await page.fill('#ow-amount', '30,000');
await page.fill('#ow-bank', 'QA提領帳戶');
const pyBefore = await page.evaluate(() => pyNextId);
await page.click('#ow-submit-btn');
const ow = await page.evaluate(id => { const r = PAYABLES.find(x => x.id === id); return r && { amount: r.amount, paymentType: r.paymentType, type: r.ownerWithdrawalType, status: r.status, transfer: r.transferDate, profitPerson: r.profitPerson, vendor: r.vendor, summary: r.summary }; }, pyBefore);
check('新增提領：寫入應付（分潤預領、已付款、日期）', ow && ow.amount === 30000 && ow.paymentType === 'profit_advance' && ow.type === 'fixed_profit_advance' && ow.status === 'paid' && ow.transfer === '2026-11-05' && ow.profitPerson === 'shower' && ow.summary === '固定分潤預領', ow);
check('提領出現在本月提領清單、寫審計', (await page.evaluate(() => prVisibleOwnerWithdrawalRows('2026-11').some(r => r.amount === 30000))) && (await page.evaluate(() => AUDIT_LOGS[0].targetType)) === 'ownerWithdrawal');
// range overview
await page.evaluate(() => { if (!prRangeExpanded) togglePayrollRangeOverview(); });
await page.selectOption('#pr-range-from', '2026-05').catch(() => page.fill('#pr-range-from', '2026-05'));
await page.selectOption('#pr-range-to', '2026-11').catch(() => page.fill('#pr-range-to', '2026-11'));
await page.evaluate(() => renderPayrollRangeOverview());
const range = await page.evaluate(() => ({ summary: document.getElementById('pr-range-summary').textContent, recs: PAYROLL.filter(r => r.month >= '2026-05' && r.month <= '2026-11'), wd: ownerWithdrawalRows().filter(r => { const d = ownerWithdrawalDate(r).slice(0, 7); return d >= '2026-05' && d <= '2026-11'; }).reduce((s, r) => s + (Number(r.amount) || 0), 0) }));
const payrollSum = range.recs.reduce((s, r) => s + netOf(r).transfer, 0);
check('區間總覽：薪資與提領合計（獨立重算）', range.summary.startsWith('2026-05 ～ 2026-11') && range.summary.includes(`提領 ${money(range.wd)}`) && range.summary.includes(`薪資 ${money(payrollSum)}`), { summary: range.summary, payrollSum, wd: range.wd });
// copy owner withdrawals into a new month
await page.click('#btn-payroll-add-month');
await page.fill('#pr-new-month', '2026-12');
await page.click('#modal-payroll-month .btn-primary');
await selectMonth(page, '2026-12');
await page.evaluate(() => prCopyOwnerWithdrawalFromLastMonth());
const copied = await page.evaluate(() => ownerWithdrawalRows('2026-12').map(r => ({ id: r.id, amount: r.amount, status: r.status, date: ownerWithdrawalDate(r), bank: r.bank })));
check('複製上月提領：日期對應本月、狀態待付款', copied.length === 1 && copied[0].amount === 30000 && copied[0].status === 'approved' && copied[0].date === '2026-12-05' && copied[0].bank === 'QA提領帳戶', copied);
await page.evaluate(() => prCopyOwnerWithdrawalFromLastMonth());
check('重複複製被擋', (await lastToast(page)) === '本月已有相同的提領紀錄，未新增' && (await page.evaluate(() => ownerWithdrawalRows('2026-12').length)) === 1);
await page.evaluate(id => deleteOwnerWithdrawal(id), copied[0].id);
check('刪除提領：移除並寫審計', (await page.evaluate(() => ownerWithdrawalRows('2026-12').length)) === 0 && (await page.evaluate(() => AUDIT_LOGS[0].action + '/' + AUDIT_LOGS[0].targetType)) === 'delete/ownerWithdrawal');
// delete month (cancel, then confirm)
confirmAnswer = false;
await page.click('#btn-payroll-delete-month');
check('刪除月份按取消：保留', await page.evaluate(() => PAYROLL_MONTHS.includes('2026-12')));
confirmAnswer = true;
await page.evaluate(() => { PAYROLL.push({ id: prNextId++, person: 'peng', month: '2026-12', baseSalary: 1, customItems: [] }); });
await page.click('#btn-payroll-delete-month');
check('刪除月份：該月薪資紀錄刪除、記入刪除月份墓碑', !(await page.evaluate(() => PAYROLL.some(r => r.month === '2026-12'))) && (await page.evaluate(() => PAYROLL_DELETED_MONTHS.includes('2026-12'))) && (await lastToast(page)) === '月份已刪除 ✓');
const afterDel = await page.evaluate(() => ({ listed: PAYROLL_MONTHS.includes('2026-12'), sel: document.getElementById('pr-filter-month').value, first: PAYROLL_MONTHS[0], audit: AUDIT_LOGS[0] && { action: AUDIT_LOGS[0].action, type: AUDIT_LOGS[0].targetType, id: AUDIT_LOGS[0].targetId, rows: (AUDIT_LOGS[0].before?.rows || []).length } }));
check('修正後：刪除的月份不再出現在清單、選單改選其他月份、寫審計', !afterDel.listed && afterDel.sel !== '2026-12' && afterDel.sel === afterDel.first && afterDel.audit?.action === 'delete' && afterDel.audit.type === 'payrollMonth' && afterDel.audit.id === '2026-12' && afterDel.audit.rows === 1, afterDel);

// attendance → payroll draft link
await nav(page, 'attendance');
await page.selectOption('#att-filter-person', 'lu_yanchen');
await page.selectOption('#att-filter-month', '2026-10');
await page.evaluate(() => renderAttendance());
const draft = await page.evaluate(() => attComputeDraft('lu_yanchen', '2026-10'));
await page.evaluate(() => attApplyDraftToPayroll());
await nav(page, 'payroll');
await selectMonth(page, '2026-10');
await selectTab(page, 'lu_yanchen');
const luRec = await page.evaluate(() => PAYROLL.find(r => r.person === 'lu_yanchen' && r.month === '2026-10'));
s = await shown(page);
check('出勤寫入薪資草稿後，薪資頁顯示該筆與金額', luRec && luRec.leaveDeduction === draft.leaveDeduction && luRec.overtimePay === draft.overtimePay && s.net === money(netOf(luRec).net), { shown: s, expected: netOf(luRec), note: luRec?.note?.slice(0, 20) });
await page.waitForTimeout(1200);
await waitSynced(page);
await ctx.close();

// ═══════════ B: view_self (peng) ═══════════
H.setScenario('B-view_self(peng)');
ctx = await newContext('peng@yutesign.com', { fixedTime: NOW });
page = await openApp(ctx);
await nav(page, 'payroll');
check('只看自己：權限 view_self、員工分頁隱藏、編輯／月份按鈕隱藏', (await page.evaluate(() => permissionLevel('payroll'))) === 'view_self' && !(await visible(page, '#payroll-emp-tabs')) && !(await visible(page, '#btn-payroll-edit')) && !(await visible(page, '#btn-payroll-add-month')));
await selectMonth(page, '2026-11');
const selfRec = await page.evaluate(() => PAYROLL.find(r => r.person === 'peng' && r.month === '2026-11'));
s = await shown(page);
check('只看自己：看到自己的薪資金額', (await page.evaluate(() => prCurrentEmp)) === 'peng' && s.net === money(netOf(selfRec).net) && s.transfer === money(netOf(selfRec).transfer), s);
check('只看自己：看不到別人的提領', (await page.evaluate(() => prVisibleOwnerWithdrawalRows().length)) === 0 && (await page.evaluate(() => ownerWithdrawalRows().length)) > 0);
await clearToasts(page);
const t = [];
for (const fn of ['openEditPayroll()', 'submitPayroll()', 'openPayrollMonthModal()', 'prDeleteMonth()', 'openOwnerWithdrawalModal()', 'submitOwnerWithdrawal()', 'prCopyOwnerWithdrawalFromLastMonth()']) {
  await page.evaluate(code => { window.__toasts = []; eval(code); }, fn);
  t.push(await lastToast(page));
}
check('只看自己：編輯／儲存／月份／提領都被拒', t[0] === '您只有查看薪資的權限' && t[1] === '您只有查看薪資的權限' && t[2] === '您沒有修改此資料的權限' && t[3] === '您沒有修改此資料的權限' && t[4] === '您沒有新增或編輯股東／分潤提領的權限' && t[5] === '您沒有新增股東／分潤提領的權限' && t[6] === '您沒有新增股東／分潤提領的權限', t);
check('只看自己：被拒操作沒有改資料', (await page.evaluate(() => PAYROLL.find(r => r.person === 'peng' && r.month === '2026-11').overtimePay)) === 3500 && !(await isOpen(page, 'modal-edit-payroll')));
await ctx.close();

// ═══════════ C: no access (lu_yanchen with payroll 'none' in the MOCK cloud only) ═══════════
H.setScenario('C-none(lu,mock)');
H.state.cloud.data.USER_PERMISSIONS.lu_yanchen.payroll = 'none';
ctx = await newContext('lu@yutesign.com', { fixedTime: NOW });
page = await openApp(ctx);
await page.reload({ waitUntil: 'load' }); await waitReady(page);
await clearToasts(page);
await page.evaluate(() => navTo('payroll'));
check('無權限：薪資頁被拒、側欄隱藏', (await lastToast(page)) === '您沒有此功能的權限' && (await page.evaluate(() => currentPage)) !== 'payroll' && !(await visible(page, '#nav-payroll')));
await ctx.close();
H.state.cloud.data.USER_PERMISSIONS.lu_yanchen.payroll = 'view_self';

// ═══════════ D: persistence ═══════════
H.setScenario('D-persistence(shower)');
ctx = await newContext('shower.li@yutesign.com', { fixedTime: NOW });
page = await openApp(ctx);
const prune = `(function prune(v) { if (v === null || v === undefined) return undefined; if (Array.isArray(v)) { const o = v.map(prune); return o.every(x => x === undefined) ? undefined : o.map(x => x === undefined ? null : x); } if (typeof v === 'object') { const o = {}; for (const [k, c] of Object.entries(v)) { const pc = prune(c); if (pc !== undefined) o[k] = pc; } return Object.keys(o).length ? o : undefined; } return v; })`;
const snap = () => page.evaluate(code => { const prune = eval(code); return JSON.stringify(prune({ p: PAYROLL.filter(r => r.month >= '2026-10'), m: PAYROLL_MONTHS, d: PAYROLL_DELETED_MONTHS, w: ownerWithdrawalRows().map(r => [r.id, r.amount, r.status, ownerWithdrawalDate(r)]), a: PAYROLL_EMPLOYEE_ACCOUNTS.peng })); }, prune);
const s1 = await snap();
await page.reload({ waitUntil: 'load' }); await waitReady(page);
const s2 = await snap();
if (s2 !== s1) { const a = JSON.parse(s1), b = JSON.parse(s2); const diffs = []; const walk = (x, y, path) => { if (JSON.stringify(x) === JSON.stringify(y)) return; if (x && y && typeof x === 'object' && typeof y === 'object') new Set([...Object.keys(x), ...Object.keys(y)]).forEach(k => walk(x[k], y[k], path + '.' + k)); else diffs.push(`${path}: ${JSON.stringify(x)} → ${JSON.stringify(y)}`); }; walk(a, b, ''); console.log('RELOAD-DIFF', diffs.slice(0, 10).join(' | ')); }
check('重新載入後薪資／月份／刪除墓碑／提領／帳戶一樣', s2 === s1);
const ids = await page.evaluate(() => ({ next: prNextId, maxId: Math.max(...PAYROLL.map(r => Number(r.id) || 0)) }));
check('修正後：重新載入後薪資流水號 = 現有最大編號 + 1', ids.next === ids.maxId + 1, ids);
// tombstone migration: a tombstoned month that still has payroll rows (2026-07) is restored; one without rows (2026-09) and others stay
await ctx.close();
H.state.cloud.data.PAYROLL.push({ id: 9001, person: 'peng', month: '2026-07', baseSalary: 35000 });
H.state.cloud.data.PAYROLL_MONTHS = [...new Set([...(H.state.cloud.data.PAYROLL_MONTHS || []), '2026-07', '2026-09'])];
H.state.cloud.data.PAYROLL_DELETED_MONTHS = ['2026-07', '2026-09', '2026-12'];
ctx = await newContext('shower.li@yutesign.com', { fixedTime: NOW });
page = await openApp(ctx);
const tomb = await page.evaluate(() => ({ deleted: PAYROLL_DELETED_MONTHS.slice().sort(), rows0709: PAYROLL.filter(r => ['2026-07', '2026-09'].includes(r.month)).length }));
check('遷移：2026-07 有薪資紀錄 → 移除刪除標記；2026-09 無紀錄與其他月份保留', JSON.stringify(tomb.deleted) === JSON.stringify(['2026-09', '2026-12']) && tomb.rows0709 === 1, tomb);
const after = await counts(page);
check('其他集合不變；PAYROLL +3（含遷移測試 1 筆）、PAYABLES +1（提領）', ['CASES', 'RECEIVABLES', 'EXPENSES', 'CLIENTS', 'VENDORS', 'ATTENDANCE_RECORDS'].every(k => after[k] === before[k]) && after.PAYROLL === before.PAYROLL + 3 && after.PAYABLES === before.PAYABLES + 1, { before, after });
await ctx.close();

const fails = await H.finish(outJson, { finalCloudData: JSON.parse(JSON.stringify(H.state.cloud?.data || {})) });
process.exit(fails ? 1 : 0);
