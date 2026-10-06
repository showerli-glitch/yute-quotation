// Company overhead (公司開銷) smoke test. Mock cloud only; never touches production.
//
// Setup (outside the repo):  mkdir /tmp/ops-smoke && cd /tmp/ops-smoke && npm i playwright-core
// Run:  PLAYWRIGHT_CORE=/tmp/ops-smoke/node_modules/playwright-core/index.mjs \
//         node scripts/smoke-overhead.mjs <label> <rootDir> <port> <out.json>
// Frozen clock (2026-10-06 14:00 Taipei) so two runs produce byte-comparable final cloud snapshots.
import { createHarness } from './smoke-lib.mjs';

const [label, rootDir, portArg, outJson] = process.argv.slice(2);
const H = await createHarness({ label, rootDir, port: Number(portArg) });
const { check, newContext, openApp, waitReady, waitSynced, lastToast, clearToasts, isOpen, visible, nav, counts } = H;
const NOW = new Date('2026-10-06T14:00:00+08:00');
const money = n => '$' + Number(n).toLocaleString('zh-TW');
const M = '2026-11';

function withDialogs(page) {
  const queue = [];
  const seen = [];
  page.on('dialog', async d => {
    seen.push({ type: d.type(), message: d.message() });
    const next = queue.shift();
    if (d.type() === 'prompt') return next === null ? d.dismiss() : d.accept(next ?? '');
    if (d.type() === 'confirm' && next === false) return d.dismiss();
    return d.accept();
  });
  return { answer: (...v) => queue.push(...v), seen };
}
const stats = page => page.evaluate(() => ({ fixed: document.getElementById('oh-stat-fixed').textContent, variable: document.getElementById('oh-stat-variable').textContent, total: document.getElementById('oh-stat-total').textContent }));
const monthData = (page, m) => page.evaluate(m => JSON.parse(JSON.stringify(OVERHEAD[m] || null)), m);
// independent sums
const sums = d => { const f = (d?.fixed || []).reduce((s, v) => s + (parseInt(v) || 0), 0); const v = (d?.variable || []).reduce((s, x) => s + (Number(x.amount) || 0), 0); return { fixed: f, variable: v, total: f + v }; };
const fixedInput = (page, name) => page.locator('#oh-fixed-tbody tr', { has: page.locator('td', { hasText: new RegExp(`^${name}$`) }) }).locator('input').first();
const noteInput = (page, name) => page.locator('#oh-fixed-tbody tr', { has: page.locator('td', { hasText: new RegExp(`^${name}$`) }) }).locator('input').nth(1);

// ═══════════ A: overhead manager (shower) ═══════════
H.setScenario('A-manage(shower)');
let ctx = await newContext('shower.li@yutesign.com', { fixedTime: NOW });
let page = await openApp(ctx);
let dlg = withDialogs(page);
const before = await counts(page);
const missing = await page.evaluate(() => ['ohMigrateWaterElectricSplit','ohMonthLabel','ohAddMonthsAround','ohAddFutureMonths','ohRenderMonthOptions','ohInitMonth','ohPreviousMonthData','ohFixedExpenseMatchName','expApprovedFixedOverheadByMonthItem','expRebuildFixedOverheadLinks','renderOverhead','ohUpdateFixed','ohUpdateNote','ohResolveFixedExpenseReview','ohDeleteFixedItem','ohRenameFixedItem','ohCopyFixedFromPrevMonth','ohAddFixedItem','ohPromptAddFixed','ohPromptAddMonth','ohDeleteVar','submitAddOverhead','openAddOverheadModal'].filter(n => typeof window[n] !== 'function'));
const cfg0 = await page.evaluate(() => ({ items: OH_FIXED_CONFIG.slice(), months: Object.keys(OVERHEAD).length, varNext: ohVarNextId, split: OH_WATER_ELECTRIC_SPLIT_MONTH, reviewFrom: OH_FIXED_EXPENSE_REVIEW_FROM, deleteIsGuarded: ohDeleteFixedItem.toString().includes('confirm(') }));
check('開銷函式與資料宣告可用；生效的 ohDeleteFixedItem 是後宣告的版本', missing.length === 0 && cfg0.items.length > 0 && cfg0.months > 0 && cfg0.split === '2026-03' && cfg0.reviewFrom === '2026-04' && cfg0.deleteIsGuarded, { missing, items: cfg0.items.length, months: cfg0.months });
await nav(page, 'overhead');
check('公司開銷頁可進入、管理者看得到新增／複製按鈕', (await page.evaluate(() => currentPage)) === 'overhead' && await visible(page, '#btn-oh-add-fixed') && await visible(page, '#btn-oh-copy-prev') && await visible(page, '#btn-oh-add-month'));

// add month (invalid, then valid)
await clearToasts(page);
dlg.answer('abc');
await page.click('#btn-oh-add-month');
check('新增月份：格式錯誤被擋', (await lastToast(page)) === '月份格式需為 YYYY-MM，例如 2026-08');
dlg.answer(M);
await page.click('#btn-oh-add-month');
let d = await monthData(page, M);
check('新增月份：建立空白月份並切換過去', d && d.fixed.length > 0 && d.fixed.every(v => v === 0) && d.variable.length === 0 && (await page.inputValue('#oh-filter-month')) === M && (await lastToast(page)) === '已新增 2026年11月 公司開銷月份', { fixedLen: d?.fixed?.length });

// fixed amounts + notes
const editable = await page.evaluate(() => OH_FIXED_CONFIG.filter(n => !['房租', '員工薪資', '水電'].includes(n)).slice(0, 2));
await fixedInput(page, editable[0]).click();
await fixedInput(page, editable[0]).fill('12,345');
await page.keyboard.press('Enter');
await fixedInput(page, editable[1]).click();
await fixedInput(page, editable[1]).fill('6800');
await page.keyboard.press('Enter');
await noteInput(page, editable[0]).click();
await noteInput(page, editable[0]).fill('QA備註');
await page.keyboard.press('Enter');
d = await monthData(page, M);
const idx0 = await page.evaluate(n => OH_FIXED_CONFIG.indexOf(n), editable[0]);
const idx1 = await page.evaluate(n => OH_FIXED_CONFIG.indexOf(n), editable[1]);
check('固定支出：輸入金額（去千分位）與備註', d.fixed[idx0] === 12345 && d.fixed[idx1] === 6800 && d.fixedNotes[idx0] === 'QA備註', { items: editable, a: d.fixed[idx0], b: d.fixed[idx1] });
let s = await stats(page);
let e = sums(d);
check('合計：固定／不固定／總計與獨立加總一致', s.fixed === money(e.fixed) && s.variable === money(e.variable) && s.total === money(e.total), { s, e });
const salary = await page.evaluate(m => { const i = OH_FIXED_CONFIG.indexOf('員工薪資'); return { inData: OVERHEAD[m].fixed[i], expected: PAYROLL.filter(r => r.month === m && isOperatingPayrollPerson(r.person)).reduce((t, r) => t + payrollNetAmount(r), 0), locked: !document.querySelector('#oh-fixed-tbody').innerText.includes('員工薪資') ? null : [...document.querySelectorAll('#oh-fixed-tbody tr')].find(tr => tr.cells[0]?.innerText.trim() === '員工薪資')?.querySelector('input') === null }; }, '2026-05');
await page.selectOption('#oh-filter-month', '2026-05');
await page.evaluate(() => renderOverhead());
const salaryMay = await page.evaluate(() => { const i = OH_FIXED_CONFIG.indexOf('員工薪資'); const row = [...document.querySelectorAll('#oh-fixed-tbody tr')].find(tr => tr.cells[0]?.innerText.trim() === '員工薪資'); return { value: OVERHEAD['2026-05'].fixed[i], locked: !!row && !row.querySelector('input'), note: row?.cells[2]?.innerText.trim() }; });
check('員工薪資列：自動等於薪資模組加總、鎖定不可編輯', salaryMay.value === salary.expected && salaryMay.locked && salaryMay.note === '自動同步薪資模組', { ...salaryMay, expected: salary.expected });
await page.selectOption('#oh-filter-month', M);
await page.evaluate(() => renderOverhead());

// add / rename / delete fixed item
dlg.answer('QA雜支');
await page.click('#btn-oh-add-fixed');
const added = await page.evaluate(() => ({ has: OH_FIXED_CONFIG.includes('QA雜支'), lens: Object.values(OVERHEAD).every(x => !Array.isArray(x.fixed) || x.fixed.length === OH_FIXED_CONFIG.length) }));
check('新增固定項目：每個月份都補上 0', added.has && added.lens && (await lastToast(page)) === '已新增「QA雜支」', added);
dlg.answer('QA雜支');
await page.click('#btn-oh-add-fixed');
check('新增固定項目：重複名稱被擋', (await lastToast(page)) === '已有相同名稱的項目');
const qaIdx = await page.evaluate(() => OH_FIXED_CONFIG.indexOf('QA雜支'));
dlg.answer('QA雜項');
await page.evaluate(i => ohRenameFixedItem(i), qaIdx);
check('改名固定項目', (await page.evaluate(i => OH_FIXED_CONFIG[i], qaIdx)) === 'QA雜項' && (await lastToast(page)) === '已將「QA雜支」改名為「QA雜項」');
await page.evaluate(() => ohRenameFixedItem(OH_FIXED_CONFIG.indexOf('房租')));
const r1 = await lastToast(page);
await page.evaluate(() => ohDeleteFixedItem(OH_FIXED_CONFIG.indexOf('員工薪資')));
const r2 = await lastToast(page);
check('房租不可改名、員工薪資不可刪除', r1 === '此項目與系統其他模組自動連動，不可改名' && r2 === '此項目與系統其他模組自動連動，不可刪除', [r1, r2]);
dlg.answer(false);
await page.evaluate(i => ohDeleteFixedItem(i), qaIdx);
check('刪除固定項目按取消：保留', await page.evaluate(() => OH_FIXED_CONFIG.includes('QA雜項')));
dlg.answer(true);
await page.evaluate(i => ohDeleteFixedItem(i), qaIdx);
const del = await page.evaluate(() => ({ has: OH_FIXED_CONFIG.includes('QA雜項'), lens: Object.values(OVERHEAD).every(x => !Array.isArray(x.fixed) || x.fixed.length === OH_FIXED_CONFIG.length) }));
check('刪除固定項目：每個月份同步移除該欄', !del.has && del.lens && (await lastToast(page)) === '已刪除「QA雜項」', del);

// copy previous month
const prev = await page.evaluate(m => { const r = ohPreviousMonthData(m); return { prevMonth: r.prevMonth, fixed: r.prevData?.fixed?.slice() }; }, M);
dlg.answer(false);
await page.click('#btn-oh-copy-prev');
check('複製上月按取消：不變', (await monthData(page, M)).fixed[idx0] === 12345);
dlg.answer(true);
await page.click('#btn-oh-copy-prev');
d = await monthData(page, M);
const salIdx = await page.evaluate(() => OH_FIXED_CONFIG.indexOf('員工薪資'));
check('複製上月：固定金額照抄（員工薪資除外，自動同步）、備註清空', d.fixed.every((v, i) => i === salIdx || v === (parseInt(prev.fixed[i]) || 0)) && d.fixedNotes.every(n => n === '') && (await lastToast(page)) === '已複製上月固定支出金額 ✓', { prevMonth: prev.prevMonth });

// variable expenses
await page.click('#btn-new-overhead');
check('不固定支出視窗開啟', await isOpen(page, 'modal-add-overhead'));
await page.fill('#oh-add-name', '');
await page.click('#modal-add-overhead .btn-primary');
const v1 = await lastToast(page);
await page.fill('#oh-add-name', 'QA停車費');
await page.fill('#oh-add-amount', '');
await page.click('#modal-add-overhead .btn-primary');
const v2 = await lastToast(page);
check('不固定支出必填：名稱→金額', v1 === '請填寫名稱' && v2 === '請填寫金額', [v1, v2]);
await page.fill('#oh-add-amount', '1,500');
await page.fill('#oh-add-note', 'QA備註2');
const varId = await page.evaluate(() => ohVarNextId);
await page.click('#modal-add-overhead .btn-primary');
d = await monthData(page, M);
check('新增不固定支出', d.variable.some(v => v.id === varId && v.amount === 1500 && v.note === 'QA備註2') && (await lastToast(page)) === '不固定支出已新增 ✓' && !(await isOpen(page, 'modal-add-overhead')));
await page.click('#btn-new-overhead');
await page.fill('#oh-add-name', 'QA待刪');
await page.fill('#oh-add-amount', '99');
await page.click('#modal-add-overhead .btn-primary');
const delVarId = (await monthData(page, M)).variable.find(v => v.name === 'QA待刪').id;
await page.evaluate(({ m, id }) => ohDeleteVar(m, id), { m: M, id: delVarId });
d = await monthData(page, M);
check('刪除不固定支出', !d.variable.some(v => v.id === delVarId) && d.variable.length === 1);
s = await stats(page);
e = sums(d);
check('異動後合計仍與獨立加總一致', s.fixed === money(e.fixed) && s.variable === money(e.variable) && s.total === money(e.total), { s, e });

// expense → fixed overhead review (approved expense rows added to the MOCK data as fixtures)
const itemA = editable[0], itemB = editable[1];
await page.evaluate(({ m, a, b }) => {
  EXPENSES.push({ id: expNextId++, month: m, caseKey: '固定開銷', item: `QA ${a} 費用`, amount: 20000, status: 'approved', person: 'shower' });
  EXPENSES.push({ id: expNextId++, month: m, caseKey: '固定開銷', item: `QA ${b} 費用`, amount: 7000, status: 'approved', person: 'shower' });
  renderOverhead();
}, { m: M, a: itemA, b: itemB });
const review = await page.evaluate(() => ({ shown: getComputedStyle(document.getElementById('oh-fixed-expense-review-wrap')).display !== 'none', list: ohFixedExpenseReviewList.map(r => [r.month, r.item, r.currentAmount, r.expenseTotal, r.diff]) }));
check('費用核准金額與固定支出不符時列出待確認', review.shown && review.list.length === 2 && review.list.some(r => r[1] === itemA && r[3] === 20000) && review.list.some(r => r[1] === itemB && r[3] === 7000), review.list);
await page.evaluate(({ m, a }) => ohResolveFixedExpenseReview(m, a, 'adopt'), { m: M, a: itemA });
d = await monthData(page, M);
check('採用核准金額：固定支出改為費用合計、備註註明來源', d.fixed[idx0] === 20000 && d.fixedNotes[idx0].startsWith('依費用申請核准金額採用') && d.fixedExpenseReviewResolved?.[itemA] === true && (await lastToast(page)) === '已改用費用申請核准合計');
const keepBefore = d.fixed[idx1];
await page.evaluate(({ m, b }) => ohResolveFixedExpenseReview(m, b, 'keep'), { m: M, b: itemB });
d = await monthData(page, M);
check('保留目前金額：不改金額、不再提示', d.fixed[idx1] === keepBefore && d.fixedExpenseReviewResolved?.[itemB] === true && (await page.evaluate(() => ohFixedExpenseReviewList.length)) === 0);
await page.waitForTimeout(1200);
await waitSynced(page);
await ctx.close();

// ═══════════ B: read-only (lu_yanchen with overhead 'view_all' in the MOCK cloud only) ═══════════
H.setScenario('B-readonly(lu,mock view_all)');
H.state.cloud.data.USER_PERMISSIONS.lu_yanchen.overhead = 'view_all';
ctx = await newContext('lu@yutesign.com', { fixedTime: NOW });
page = await openApp(ctx);
withDialogs(page);
await page.reload({ waitUntil: 'load' }); await waitReady(page);
await nav(page, 'overhead');
await page.selectOption('#oh-filter-month', M);
await page.evaluate(() => renderOverhead());
const ro = await page.evaluate(() => ({ level: permissionLevel('overhead'), editableInputs: [...document.querySelectorAll('#oh-fixed-tbody input')].filter(i => !i.readOnly).length, review: getComputedStyle(document.getElementById('oh-fixed-expense-review-wrap')).display }));
check('唯讀：權限 view_all、所有欄位唯讀、管理按鈕隱藏', ro.level === 'view_all' && ro.editableInputs === 0 && !(await visible(page, '#btn-oh-add-fixed')) && !(await visible(page, '#btn-oh-copy-prev')) && !(await visible(page, '#btn-oh-add-month')), ro);
const dBefore = await monthData(page, M);
const ts = [];
for (const code of [`ohUpdateFixed('${M}', ${idx0}, '1')`, `ohUpdateNote('${M}', ${idx0}, 'x')`, `ohCopyFixedFromPrevMonth()`, `ohDeleteVar('${M}', ${varId})`, `submitAddOverhead()`, `ohPromptAddFixed()`, `ohRenameFixedItem(${idx0})`, `ohDeleteFixedItem(${idx0})`]) {
  await page.evaluate(c => { window.__toasts = []; eval(c); }, code);
  ts.push(await lastToast(page));
}
check('唯讀：直接呼叫所有修改都被拒且資料不變', ts.every(t => t === '您沒有修改此資料的權限') && JSON.stringify(await monthData(page, M)) === JSON.stringify(dBefore), ts);
await ctx.close();
H.state.cloud.data.USER_PERMISSIONS.lu_yanchen.overhead = 'none';

// ═══════════ C: no access (peng) ═══════════
H.setScenario('C-none(peng)');
ctx = await newContext('peng@yutesign.com', { fixedTime: NOW });
page = await openApp(ctx);
await clearToasts(page);
await page.evaluate(() => navTo('overhead'));
check('無權限：公司開銷頁被拒、側欄隱藏', (await page.evaluate(() => permissionLevel('overhead'))) === 'none' && (await lastToast(page)) === '您沒有此功能的權限' && !(await visible(page, '#nav-overhead')));
await ctx.close();

// ═══════════ D: persistence ═══════════
H.setScenario('D-persistence(shower)');
ctx = await newContext('shower.li@yutesign.com', { fixedTime: NOW });
page = await openApp(ctx);
const pruneSrc = `(function prune(v) { if (v === null || v === undefined) return undefined; if (Array.isArray(v)) { const o = v.map(prune); return o.every(x => x === undefined) ? undefined : o.map(x => x === undefined ? null : x); } if (typeof v === 'object') { const o = {}; for (const [k, c] of Object.entries(v)) { const pc = prune(c); if (pc !== undefined) o[k] = pc; } return Object.keys(o).length ? o : undefined; } return v; })`;
const snap = () => page.evaluate(({ code, m }) => { const prune = eval(code); return JSON.stringify(prune({ month: OVERHEAD[m], cfg: OH_FIXED_CONFIG, months: Object.keys(OVERHEAD).sort() })); }, { code: pruneSrc, m: M });
const s1 = await snap();
await page.reload({ waitUntil: 'load' }); await waitReady(page);
const s2 = await snap();
if (s1 !== s2) console.log('RELOAD-DIFF', s1.slice(0, 300), '\n', s2.slice(0, 300));
check('重新載入後月份資料／固定項目設定一樣', s1 === s2);
const after = await counts(page);
check('其他集合不變；EXPENSES +2（測試用核准費用）', ['CASES', 'PAYABLES', 'RECEIVABLES', 'CLIENTS', 'VENDORS', 'PAYROLL', 'ATTENDANCE_RECORDS'].every(k => after[k] === before[k]) && after.EXPENSES === before.EXPENSES + 2, { before, after });
await ctx.close();

const fails = await H.finish(outJson, { finalCloudData: JSON.parse(JSON.stringify(H.state.cloud?.data || {})) });
process.exit(fails ? 1 : 0);
