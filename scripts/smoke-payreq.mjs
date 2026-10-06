// Vendor pay-request (廠商請款) functional smoke test. Mock cloud only; never touches production.
//
// Setup (outside the repo):  mkdir /tmp/ops-smoke && cd /tmp/ops-smoke && npm i playwright-core
// Run:  PLAYWRIGHT_CORE=/tmp/ops-smoke/node_modules/playwright-core/index.mjs \
//         node scripts/smoke-payreq.mjs <label> <rootDir> <port> <out.json>
// The browser clock is frozen at 2026-10-06 14:00 Asia/Taipei so two runs (e.g. main vs. a split
// branch) produce byte-comparable final cloud snapshots.
//
// Checks labelled 「既有問題現況」 record the known pre-existing person-name/ID mismatch described in
// docs/gate-payreq-mapping.md. They assert the current behavior so a split can be compared 1:1.
import { createHarness } from './smoke-lib.mjs';

const [label, rootDir, portArg, outJson] = process.argv.slice(2);
const H = await createHarness({ label, rootDir, port: Number(portArg) });
const { check, newContext, openApp, waitReady, waitSynced, lastToast, clearToasts, isOpen, visible, nav, counts } = H;
const NOW = new Date('2026-10-06T14:00:00+08:00');

const pendingText = page => page.locator('#payreq-pending-tbody').innerText();
const rejectedText = page => page.locator('#payreq-rejected-tbody').innerText();
const approvedText = page => page.locator('#payreq-approved-tbody').innerText();
const badges = page => page.evaluate(() => ({ pending: document.getElementById('payreq-pending-badge').textContent, rejected: document.getElementById('payreq-rejected-badge').textContent, approved: document.getElementById('payreq-approved-badge').textContent, nav: document.getElementById('badge-payreq').style.display === 'none' ? '' : document.getElementById('badge-payreq').textContent }));
const pickRadio = (page, group, text) => page.locator(`#${group} .radio-opt`, { hasText: text }).click();
async function fillForm(page, { caseCode = '', vendor, amount, summary, date, note = '' }) {
  if (caseCode !== null) await page.selectOption('#pr-case', caseCode);
  await page.fill('#pr-vendor', vendor);
  await page.fill('#pr-amount', amount);
  await page.fill('#pr-summary', summary);
  await page.fill('#pr-date', date);
  await page.fill('#payreq-note', note);
}
const docAction = (page, id, action) => page.evaluate(({ id, action }) => { const sel = document.createElement('select'); sel.innerHTML = `<option value="${action}">x</option>`; sel.value = action; payreqDocumentAction(sel, id); }, { id, action });
const row = (page, id) => page.evaluate(id => { const p = PAYABLES.find(x => x.id === id); return p && { id: p.id, status: p.status, vendor: p.vendor, amount: p.amount, summary: p.summary, case: p.case, person: p.person, invoice: p.invoice, receipt: p.receipt, wantDate: p.wantDate, note: p.note }; }, id);

// ═══════════ A: payreq manager (shower) ═══════════
H.setScenario('A-manage(shower)');
let ctx = await newContext('shower.li@yutesign.com', { fixedTime: NOW });
let page = await openApp(ctx);
let confirmAnswer = true;
page.on('dialog', d => (d.type() === 'confirm' && !confirmAnswer ? d.dismiss() : d.accept()));
const before = await counts(page);
const missingFns = await page.evaluate(() => ['openPayreqModal','setPayreqRadio','openEditPayreqModal','clonePayreq','payreqDocumentAction','submitPayReq','approveReq','rejectPayreq','payreqPendingCount','updatePayreqNavBadge','renderPayreq','openPayreqForVendor','payreqVendorPickerMouseDown','selectRadio'].filter(n => typeof window[n] !== 'function'));
check('請款函式與保留的橋接／picker／單選元件皆為全域函式', missingFns.length === 0, missingFns.join(','));
await nav(page, 'payreq');
check('廠商請款頁可進入', await page.evaluate(() => currentPage === 'payreq' && document.getElementById('page-payreq').classList.contains('active')));
const exp0 = await page.evaluate(() => ({ pending: PAYABLES.filter(p => p.status === 'pending').length, rejected: PAYABLES.filter(p => p.status === 'rejected').length, approved: PAYABLES.filter(p => ['approved','paid'].includes(p.status)).length }));
let b = await badges(page);
check('三個分類筆數徽章與資料一致、側欄徽章 = 待審核數', b.pending === `${exp0.pending} 筆` && b.rejected === `${exp0.rejected} 筆` && b.approved === `${exp0.approved} 筆` && b.nav === (exp0.pending ? String(exp0.pending) : ''), { b, exp0 });
check('管理者看得到「新增請款申請」', await visible(page, '#btn-new-payreq'));

// open modal + validation
await page.click('#btn-new-payreq');
const modal0 = await page.evaluate(() => ({ open: document.getElementById('modal-payreq').classList.contains('open'), title: document.querySelector('#modal-payreq .modal-title').textContent, applicant: document.getElementById('pr-applicant').value, applicantDisabled: document.getElementById('pr-applicant').disabled, btn: document.getElementById('pr-submit-btn').textContent, inv: document.querySelector('#rg-invoice .radio-opt.selected')?.textContent.trim(), dl: [...document.querySelectorAll('#dl-vendors option')].map(o => o.value.split(' - ')[0]) }));
check('新增視窗：標題、申請人可選、預設有發票／收據', modal0.open && modal0.title === '廠商請款申請' && modal0.applicant === '李鎮宇' && !modal0.applicantDisabled && modal0.btn === '送出申請' && modal0.inv === '有', { ...modal0, dl: modal0.dl.length });
check('新增視窗：廠商選單依代碼排序', modal0.dl.every((c, i) => i === 0 || modal0.dl[i - 1].localeCompare(c, 'zh-TW', { numeric: true }) <= 0));
const vendor = await page.evaluate(() => { const v = VENDORS.find(v => v.status === '有效'); return { code: v.code, name: v.name }; });
const caseA = await page.evaluate(() => CASES.find(c => c.status === '進行中').code);
const msgs = [];
for (const [field, val] of [['pr-vendor', `${vendor.code} - ${vendor.name}`], ['pr-amount', '12,345'], ['pr-summary', 'QA請款'], ['pr-date', '2026-10-20']]) {
  await clearToasts(page);
  await page.click('#pr-submit-btn');
  msgs.push(await lastToast(page));
  await page.fill(`#${field}`, val);
}
check('必填檢查依序：廠商→金額→摘要→付款日', JSON.stringify(msgs) === JSON.stringify(['請填寫受款廠商', '請填寫付款金額', '請填寫摘要', '請選擇希望付款日']), msgs);
await page.selectOption('#pr-case', caseA);
await pickRadio(page, 'rg-invoice', '待補');
await page.fill('#payreq-note', 'QA備註');
const nextId = await page.evaluate(() => pyNextId);
await page.click('#pr-submit-btn');
let r1 = await row(page, nextId);
check('送出：寫入待審核，廠商只存名稱、金額去千分位', r1 && r1.status === 'pending' && r1.vendor === vendor.name && r1.amount === 12345 && r1.case === caseA && r1.invoice === '待補' && r1.receipt === '有' && r1.person === '李鎮宇' && r1.note === 'QA備註', r1);
check('送出：視窗關閉、提示、列表與徽章更新', !(await isOpen(page, 'modal-payreq')) && (await lastToast(page)) === '請款申請已送出，等待財務審核 ✓' && (await pendingText(page)).includes('QA請款') && (await badges(page)).pending === `${exp0.pending + 1} 筆`);

// duplicate + double-submit guard
await page.click('#btn-new-payreq');
await fillForm(page, { caseCode: caseA, vendor: `${vendor.code} - ${vendor.name}`, amount: '12345', summary: 'QA請款', date: '2026-10-20' });
await pickRadio(page, 'rg-invoice', '待補');
await page.click('#pr-submit-btn');
check('完全相同的待審核請款不重複新增', (await lastToast(page)) === '已有一筆完全相同的待審核請款，本次未重複新增' && (await page.evaluate(() => pyNextId)) === nextId + 1);
await page.fill('#pr-summary', 'QA連點');
const dbl = await page.evaluate(() => { const t = () => document.getElementById('toast').textContent; submitPayReq(); const first = t(); submitPayReq(); const second = t(); return { toasts: [first, second], n: PAYABLES.filter(p => p.summary === 'QA連點').length }; });
check('連點送出只寫入一筆並提示勿重複點選', dbl.n === 1 && dbl.toasts[0] === '請款申請已送出，等待財務審核 ✓' && dbl.toasts[1] === '請款正在送出，請勿重複點選', dbl);
await page.waitForTimeout(1700);

// edit pending — known pre-existing issue: after a submit the button stays disabled in the edit modal
await docAction(page, nextId, 'edit');
check('既有問題現況：送出後直接開「編輯」，儲存鈕仍停用', await page.locator('#pr-submit-btn').isDisabled());
await page.evaluate(() => { closeModal('modal-payreq'); openPayreqModal(); closeModal('modal-payreq'); });
await docAction(page, nextId, 'edit');
const edit0 = await page.evaluate(() => ({ title: document.querySelector('#modal-payreq .modal-title').textContent, amount: document.getElementById('pr-amount').value, vendor: document.getElementById('pr-vendor').value, btn: document.getElementById('pr-submit-btn').textContent, editId: payreqEditId }));
check('編輯待審核：載入資料', edit0.title === '編輯廠商請款申請' && edit0.amount === '12,345' && edit0.vendor === vendor.name && edit0.btn === '儲存修改' && edit0.editId === nextId, edit0);
await page.fill('#pr-amount', '13000');
await page.click('#pr-submit-btn');
r1 = await row(page, nextId);
check('編輯待審核：同一筆更新金額、仍為待審核', r1.amount === 13000 && r1.status === 'pending' && (await lastToast(page)) === '請款申請已更新 ✓');

// clone
await docAction(page, nextId, 'clone');
const clone0 = await page.evaluate(() => ({ title: document.querySelector('#modal-payreq .modal-title').textContent, btn: document.getElementById('pr-submit-btn').textContent, amount: document.getElementById('pr-amount').value, editId: payreqEditId, inv: document.querySelector('#rg-invoice .radio-opt.selected')?.textContent.trim() }));
check('複製單據：帶入原資料、建立新請款', clone0.title === '複製廠商請款申請' && clone0.btn === '建立新請款' && clone0.amount === '13,000' && clone0.editId === null && clone0.inv === '待補', clone0);
await page.fill('#pr-summary', 'QA複製');
const cloneId = await page.evaluate(() => pyNextId);
await page.click('#pr-submit-btn');
check('複製單據：新增一筆待審核', (await row(page, cloneId))?.summary === 'QA複製' && (await row(page, nextId)).summary === 'QA請款');

// reject (cancel, then confirm), resubmit, approve
confirmAnswer = false;
await page.evaluate(id => rejectPayreq(id), cloneId);
check('退回按取消：維持待審核', (await row(page, cloneId)).status === 'pending');
confirmAnswer = true;
await page.locator('#payreq-pending-tbody tr', { hasText: 'QA複製' }).locator('button', { hasText: '退回' }).click();
check('退回：移到已退回、提示', (await row(page, cloneId)).status === 'rejected' && (await rejectedText(page)).includes('QA複製') && (await lastToast(page)) === '已退回，申請人可修改後重新送出');
await page.evaluate(() => { openPayreqModal(); closeModal('modal-payreq'); }); // re-enable the save button (see 既有問題現況 above)
await docAction(page, cloneId, 'edit');
await page.fill('#pr-summary', 'QA複製-重送');
await page.click('#pr-submit-btn');
check('管理者修改已退回請款後重新送出 → 待審核', (await row(page, cloneId)).status === 'pending' && (await row(page, cloneId)).summary === 'QA複製-重送');
const payablesApprovedBefore = await page.evaluate(() => PAYABLES.filter(p => p.status === 'approved').length);
await page.locator('#payreq-pending-tbody tr', { hasText: 'QA請款' }).locator('button', { hasText: '核准' }).click();
check('核准：狀態 approved、移到已核准、提示', (await row(page, nextId)).status === 'approved' && (await approvedText(page)).includes('QA請款') && (await lastToast(page)) === '已核准，已轉入應付帳款 ✓');
await nav(page, 'payable');
check('核准後出現在應付帳款（approved +1）', (await page.evaluate(() => PAYABLES.filter(p => p.status === 'approved').length)) === payablesApprovedBefore + 1);
await nav(page, 'payreq');

// search + sort
await page.fill('#payreq-search', 'QA連點');
check('搜尋：只顯示符合的待審核', (await pendingText(page)).includes('QA連點') && !(await pendingText(page)).includes('QA複製-重送'));
await page.fill('#payreq-search', '13,000');
check('搜尋：可用金額找', (await approvedText(page)).includes('QA請款'));
await page.fill('#payreq-search', '');
await page.evaluate(() => renderPayreq());
const sortRes = {};
for (const mode of ['date-desc', 'date-asc', 'vendor-asc', 'amount-desc', 'created-desc', 'updated-desc']) {
  await page.selectOption('#payreq-sort', mode);
  sortRes[mode] = (await page.$$eval('#payreq-approved-tbody tr', trs => trs.slice(0, 3).map(tr => tr.cells[4]?.innerText.trim() + '|' + tr.cells[5]?.innerText.trim()))).join(' ; ');
}
check('排序：六種排序都可切換並重繪', Object.values(sortRes).every(Boolean) && sortRes['date-desc'] !== sortRes['date-asc'], sortRes);
await page.selectOption('#payreq-sort', 'date-desc');

// vendor bridge + picker
await nav(page, 'vendors');
await page.locator('#vd-tbody tr', { hasText: vendor.code }).first().locator('button', { hasText: '發起請款' }).click();
await page.waitForTimeout(400);
check('廠商主檔「發起請款」帶入廠商並開啟視窗', (await page.evaluate(() => currentPage)) === 'payreq' && await isOpen(page, 'modal-payreq') && (await page.inputValue('#pr-vendor')) === `${vendor.code} - ${vendor.name}`);
await page.locator('#pr-vendor').click();
check('請款 picker：點擊清除', (await page.inputValue('#pr-vendor')) === '');
await page.evaluate(() => closeModal('modal-payreq'));
await page.waitForTimeout(1200);
await waitSynced(page);
await ctx.close();

// ═══════════ B: apply-self (peng: payreq view_profit_cases_apply_self) ═══════════
H.setScenario('B-applyself(peng)');
ctx = await newContext('peng@yutesign.com', { fixedTime: NOW });
page = await openApp(ctx);
page.on('dialog', d => d.accept());
await nav(page, 'payreq');
const permB = await page.evaluate(() => ({ level: permissionLevel('payreq'), cases: CASES.filter(c => userCanViewCaseFinancials(c.code, 'payreq')).map(c => c.code) }));
check('申請自己：權限與可選個案（只限有分潤的個案）', permB.level === 'view_profit_cases_apply_self' && permB.cases.length > 0, { level: permB.level, cases: permB.cases.length });
await page.click('#btn-new-payreq');
const modalB = await page.evaluate(() => ({ applicant: document.getElementById('pr-applicant').value, disabled: document.getElementById('pr-applicant').disabled, options: [...document.getElementById('pr-case').options].map(o => o.value).filter(Boolean) }));
check('申請自己：申請人鎖定本人、個案選單只有可看的個案', modalB.applicant === '彭俞豪' && modalB.disabled && JSON.stringify(modalB.options.slice().sort()) === JSON.stringify(permB.cases.slice().sort()), { applicant: modalB.applicant, disabled: modalB.disabled, options: modalB.options.length });
const pengCase = permB.cases[0];
await fillForm(page, { caseCode: pengCase, vendor: `${vendor.code} - ${vendor.name}`, amount: '5000', summary: 'QA彭有個案', date: '2026-10-21' });
const pengId = await page.evaluate(() => pyNextId);
await page.click('#pr-submit-btn');
check('申請自己：可送出（有個案）', (await row(page, pengId))?.person === '彭俞豪' && (await row(page, pengId)).status === 'pending');
check('申請自己：待審核列沒有核准／退回', (await pendingText(page)).includes('QA彭有個案') && !/核准|退回/.test(await page.locator('#payreq-pending-tbody tr', { hasText: 'QA彭有個案' }).innerText()));
await page.click('#btn-new-payreq');
await fillForm(page, { caseCode: '', vendor: vendor.name, amount: '800', summary: 'QA彭無個案', date: '2026-10-22' });
const pengNoCase = await page.evaluate(() => pyNextId);
await page.click('#pr-submit-btn');
check('申請自己：可送出（不指定個案）', (await row(page, pengNoCase))?.case === '' && (await lastToast(page)) === '請款申請已送出，等待財務審核 ✓');
check('既有問題現況：本人看不到自己不指定個案的請款', !(await pendingText(page)).includes('QA彭無個案'));
await page.evaluate(() => { const sel = document.getElementById('pr-case'); });
await clearToasts(page);
await page.evaluate(id => approveReq(id), pengId);
const tA = await lastToast(page);
await page.evaluate(id => rejectPayreq(id), pengId);
const tR = await lastToast(page);
await page.evaluate(id => openEditPayreqModal(id), pengId);
const tE = await lastToast(page);
check('申請自己：核准／退回／編輯待審核都被拒', tA === '您沒有核准請款的權限' && tR === '您沒有退回請款的權限' && tE === '您沒有編輯請款申請的權限' && (await row(page, pengId)).status === 'pending', [tA, tR, tE]);
await page.waitForTimeout(1700);
await waitSynced(page);
await ctx.close();

// manager rejects peng's case request
H.setScenario('C-reject-peng(shower)');
ctx = await newContext('shower.li@yutesign.com', { fixedTime: NOW });
page = await openApp(ctx);
page.on('dialog', d => d.accept());
await nav(page, 'payreq');
check('管理者看得到彭的兩筆請款（含不指定個案）', (await pendingText(page)).includes('QA彭有個案') && (await pendingText(page)).includes('QA彭無個案'));
await page.evaluate(id => rejectPayreq(id), pengId);
check('管理者退回彭的請款', (await row(page, pengId)).status === 'rejected');
await page.waitForTimeout(1200);
await waitSynced(page);
await ctx.close();

H.setScenario('D-peng-rejected');
ctx = await newContext('peng@yutesign.com', { fixedTime: NOW });
page = await openApp(ctx);
await nav(page, 'payreq');
const rejRow = await page.locator('#payreq-rejected-tbody tr', { hasText: 'QA彭有個案' }).innerText().catch(() => '');
check('申請自己：已退回列表看得到自己的請款', rejRow.includes('QA彭有個案'));
check('既有問題現況：已退回列沒有「選項⋯」可修改', !(await page.locator('#payreq-rejected-tbody tr', { hasText: 'QA彭有個案' }).locator('select').count()));
await clearToasts(page);
await page.evaluate(id => openEditPayreqModal(id), pengId);
check('既有問題現況：本人打開自己已退回的請款被拒', (await lastToast(page)) === '您沒有修改這筆請款的權限' && !(await isOpen(page, 'modal-payreq')));
await ctx.close();

// ═══════════ E: read-only (lu_yanchen with payreq overridden to view_all in the MOCK cloud only) ═══════════
H.setScenario('E-readonly(lu,mock view_all)');
H.state.cloud.data.USER_PERMISSIONS.lu_yanchen.payreq = 'view_all';
ctx = await newContext('lu@yutesign.com', { fixedTime: NOW });
page = await openApp(ctx);
await page.reload({ waitUntil: 'load' }); await waitReady(page);
await nav(page, 'payreq');
check('唯讀：權限 view_all、隱藏新增按鈕', (await page.evaluate(() => permissionLevel('payreq'))) === 'view_all' && !(await visible(page, '#btn-new-payreq')));
check('唯讀：看得到全部待審核、沒有核准／退回', (await pendingText(page)).includes('QA連點') && !/核准|退回/.test(await pendingText(page)));
const nE = await page.evaluate(() => PAYABLES.length);
await clearToasts(page);
await page.evaluate(() => openPayreqModal());
const e1 = await lastToast(page);
await page.evaluate(() => submitPayReq());
const e2 = await lastToast(page);
check('唯讀：開視窗與送出都被拒、未寫入', e1 === '您沒有新增請款的權限' && e2 === '您沒有新增請款的權限' && !(await isOpen(page, 'modal-payreq')) && (await page.evaluate(() => PAYABLES.length)) === nE, [e1, e2]);
await ctx.close();
H.state.cloud.data.USER_PERMISSIONS.lu_yanchen.payreq = 'view_profit_cases_apply_self';

// ═══════════ F: persistence ═══════════
H.setScenario('F-persistence(shower)');
ctx = await newContext('shower.li@yutesign.com', { fixedTime: NOW });
page = await openApp(ctx);
const prState = () => page.evaluate(() => JSON.stringify(PAYABLES.filter(p => /^QA/.test(p.summary || '')).map(p => [p.id, p.status, p.vendor, p.amount, p.summary, p.case, p.person, p.invoice, p.receipt, p.wantDate])));
const s1 = await prState();
await page.reload({ waitUntil: 'load' }); await waitReady(page);
check('重新載入後請款資料一樣', (await prState()) === s1 && JSON.parse(s1).length === 5, JSON.parse(s1).map(x => `${x[0]}:${x[1]}:${x[4]}`));
const after = await counts(page);
check('其他集合筆數不變、PAYABLES +5', ['CASES', 'RECEIVABLES', 'EXPENSES', 'CLIENTS', 'VENDORS', 'PAYROLL'].every(k => after[k] === before[k]) && after.PAYABLES === before.PAYABLES + 5, { before: before.PAYABLES, after: after.PAYABLES });
await ctx.close();

const fails = await H.finish(outJson, { finalCloudData: JSON.parse(JSON.stringify(H.state.cloud?.data || {})) });
process.exit(fails ? 1 : 0);
