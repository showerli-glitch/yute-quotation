// 股東資金往來 (claude/shareholder-funds). Mock cloud only; never touches production.
// - 往來帳戶＝個案類別「私人借支」的個案；新模組列出總表與明細（轉入／收回／沖帳、期票分組、每筆之後的餘額）。
// - 分潤款可選「轉入股東資金往來」：分潤照樣已結清，不經銀行，記為公司代管；可改回銀行匯款；分段付款只轉入付的那段。
// - 差額沖帳記在往來帳戶上，可刪除；不進公司開銷。
// - 應付：私人借支只能選往來帳戶，一般廠商款不能選往來帳戶。
// - 資金試算：「股東／親友應還」預設不計入，勾選後才加進可用的錢。
// - 往來帳戶的編輯個案視窗隱藏合約金額、分潤、毛利率、保固款。只有 shower／nc 看得到模組。
//
// Setup (outside the repo):  mkdir /tmp/ops-smoke && cd /tmp/ops-smoke && npm i playwright-core
// Run:  PLAYWRIGHT_CORE=/tmp/ops-smoke/node_modules/playwright-core/index.mjs \
//         node scripts/smoke-shareholder-funds.mjs <label> <rootDir> <port> <out.json>
import { createHarness } from './smoke-lib.mjs';

const [label, rootDir, portArg, outJson] = process.argv.slice(2);
const H = await createHarness({ label, rootDir, port: Number(portArg) });
const { check, newContext, openApp, lastToast, nav, visible } = H;
const NOW = new Date('2026-11-20T13:00:00+08:00');

H.setScenario('A-owner(shower)');
let ctx = await newContext('shower.li@yutesign.com', { fixedTime: NOW });
let page = await openApp(ctx);
page.on('dialog', d => d.accept());

check('股東資金往來選單對老闆顯示', await visible(page, '#nav-shareholder'));

// 1. 用「＋新增往來帳戶」建兩個帳戶：類別自動是私人借支、不分潤，客戶自動帶「內部往來」。
await page.evaluate(() => { CLIENTS.push({ code: 'INT', shortName: '內部往來', fullName: 'Internal Accounts' }); CASES.push({ code: 'YT-QA-2026-090', name: 'QA一般工程', client: '', status: '進行中', amount: 100000, person: '李鎮宇', profitSplit: '三人' }); });
// 模擬資料裡原有的往來帳戶（李媽媽、高雄博愛）先標結案，金額只看這次建的 QA 帳戶。
await page.evaluate(() => CASES.filter(c => c.accountingTreatment === 'receivable_from_related_party').forEach(c => { c.status = '結案'; }));
await nav(page, 'shareholder');
const preset = await page.evaluate(() => { sfNewAccount(); return { type: document.getElementById('new-case-type').value, profit: document.getElementById('new-case-profit-mode').value, client: document.getElementById('new-client-code').value }; });
check('＋新增往來帳戶：類別私人借支、不分潤、客戶內部往來', preset.type === 'private_loan' && preset.profit === 'no_profit' && preset.client === 'INT', preset);
const mkAccount = name => page.evaluate(name => { sfNewAccount(); document.getElementById('new-case-name').value = name; submitNewCase(); return CASES.find(c => c.name === name); }, name);
const peng = await mkAccount('QA彭 股東往來');
const li = await mkAccount('QA李 股東往來');
check('建好的往來帳戶是私人借支、不分潤、不列分潤報表', [peng, li].every(c => c && c.accountingTreatment === 'receivable_from_related_party' && c.profitSplit === '不分潤' && c.excludeFromProfitReports === true && /LOAN/.test(c.code)), [peng?.code, li?.code]);
const P = peng.code, L = li.code;

// 2. 應付的個案選單：私人借支只列往來帳戶；一般廠商款不列往來帳戶。
await nav(page, 'payable');
const opts = await page.evaluate(({ P }) => {
  openAddPayableModal();
  const list = () => [...document.getElementById('ap-add-case').options].map(o => o.value).filter(Boolean);
  const t = document.getElementById('ap-add-payment-type');
  t.value = 'private_loan'; apTogglePaymentType(); const loan = list();
  t.value = 'vendor'; apTogglePaymentType(); const vendor = list();
  return { loan, vendor, isAccount: loan.every(c => sfIsAccountCode(c)) };
}, { P });
check('私人借支只能選往來帳戶', opts.loan.includes(P) && opts.isAccount && !opts.loan.includes('YT-QA-2026-090'), opts.loan);
check('一般廠商款不列往來帳戶', opts.vendor.includes('YT-QA-2026-090') && !opts.vendor.includes(P), opts.vendor);
const tryWrong = (type, code) => page.evaluate(({ type, code }) => {
  const sel = document.getElementById('ap-add-case');
  document.getElementById('ap-add-payment-type').value = type; apTogglePaymentType();
  if (![...sel.options].some(o => o.value === code)) { const o = document.createElement('option'); o.value = code; o.textContent = code; sel.appendChild(o); }
  sel.value = code;
  document.getElementById('ap-add-vendor').value = 'QA廠商'; document.getElementById('ap-add-amount').value = '1000'; document.getElementById('ap-add-summary').value = 'QA';
  submitAddPayable();
}, { type, code });
const n0 = await page.evaluate(() => PAYABLES.length);
await tryWrong('vendor', P);
const t1 = await lastToast(page);
await tryWrong('private_loan', 'YT-QA-2026-090');
const t2 = await lastToast(page);
await page.evaluate(() => closeModal('modal-add-payable'));
const blocked = { t1, t2, same: (await page.evaluate(() => PAYABLES.length)) === n0 };
check('掛錯會被擋：廠商款掛往來帳戶、私人借支掛工程案', blocked.same && blocked.t1.startsWith('股東資金往來帳戶只能記') && blocked.t2.startsWith('私人借支請選擇股東資金往來帳戶'), blocked);

// 3. 彭的車：和運 536,400 拆 12 張，第一張 2026-10-25。
await page.evaluate(({ P }) => {
  openAddPayableModal();
  const set = (id, v) => { document.getElementById(id).value = v; };
  set('ap-add-payment-type', 'private_loan'); apTogglePaymentType();
  set('ap-add-case', P); set('ap-add-vendor', 'QA和運'); set('ap-add-amount', '536,400'); set('ap-add-summary', '彭公司車月租金'); set('ap-add-ticket', '2026-10-25'); set('ap-add-date', '2026-10-20');
  document.getElementById('ap-installment-on').checked = true; set('ap-installment-count', '12'); apUpdateInstallmentPreview();
  submitAddPayable();
}, { P });
check('彭的往來帳戶有 12 張期票，合計 536,400', (await page.evaluate(P => PAYABLES.filter(p => p.case === P).length, P)) === 12 && (await page.evaluate(P => PAYABLES.filter(p => p.case === P).reduce((s, p) => s + p.amount, 0), P)) === 536400);

// 4. 分潤結清款（像 #3528：系統結算、已付款）改成轉入股東資金往來。
const sid = await page.evaluate(() => {
  const row = { id: pyNextId++, case: '', caseName: '', vendor: '彭俞豪', summary: 'QA Golf R 車款', amount: 510857, wantDate: '2026-09-14', bank: '國泰世華 活存 078-03-501213-2', transferDate: '2026-09-14', doneDate: '2026-09-14', ticket: '', invoice: '無', receipt: '無', person: '李鎮宇',
    paymentType: 'profit_settlement', profitPerson: 'peng', profitCaseCodes: ['YT-QA-2026-090'], status: 'paid', systemLocked: true, psSettled: true, settlementId: 990001, sourceKey: 'profit-settlement-990001-peng', note: '' };
  PAYABLES.push(row); return row.id;
});
const editUi = await page.evaluate(id => { openEditPayableModal(id); return { shown: document.getElementById('ap-transfer-field').style.display !== 'none', bankMode: document.getElementById('ap-pay-method-bank').checked, title: document.getElementById('ap-modal-title').textContent }; }, sid);
check('分潤結清款的編輯視窗有「付款方式」，預設銀行匯款', editUi.shown && editUi.bankMode && editUi.title === '編輯結算款付款資訊', editUi);
const vendorUi = await page.evaluate(() => { const t = document.getElementById('ap-add-payment-type'); const keep = t.value; t.value = 'vendor'; apTogglePaymentType(); const hidden = document.getElementById('ap-transfer-field').style.display === 'none'; t.value = keep; apTogglePaymentType(); return hidden; });
check('一般廠商款沒有「轉入股東資金往來」', vendorUi);
await page.evaluate(({ P }) => {
  document.getElementById('ap-pay-method-transfer').checked = true; sfToggleTransfer();
  document.getElementById('ap-loan-transfer-case').value = P;
  document.getElementById('ap-loan-transfer-date').value = '2026-09-14';
  submitAddPayable();
}, { P });
const tr = await page.evaluate(id => { const p = PAYABLES.find(x => x.id === id); return { amount: p.amount, status: p.status, loan: p.transferToLoanCase, date: p.transferToLoanDate, bank: p.bank, settled: p.psSettled, type: p.paymentType, cases: p.profitCaseCodes, done: p.doneDate, n: PAYABLES.filter(x => x.settlementId === 990001).length }; }, sid);
check('轉入後：分潤款仍是已付款、已結清、結算個案不變，不經銀行', tr.loan === P && tr.date === '2026-09-14' && tr.status === 'paid' && tr.settled === true && tr.type === 'profit_settlement' && tr.cases.join() === 'YT-QA-2026-090' && tr.amount === 510857 && tr.n === 1 && tr.bank.startsWith('轉入股東往來 '), tr);
const reopen = await page.evaluate(id => { openEditPayableModal(id); const r = { transfer: document.getElementById('ap-pay-method-transfer').checked, loan: document.getElementById('ap-loan-transfer-case').value, bankDisabled: document.getElementById('ap-add-bank').disabled }; closeModal('modal-add-payable'); return r; }, sid);
check('再開編輯：記得是轉入、哪個帳戶，付款銀行鎖住', reopen.transfer && reopen.loan === P && reopen.bankDisabled, reopen);

// 5. 往來帳戶的帳：轉入 510,857，期票 536,400，目前 466,157，全部付完後 −25,543。
const led = await page.evaluate(P => { const l = sfLedger(P); return { inflow: l.inflowAll, out: l.outAll, outDone: l.outDone, now: l.balanceNow, all: l.balanceAll, checks: l.checks.count, next: l.checks.next?.ticket }; }, P);
check('彭的帳：轉入 510,857、付出 536,400、目前代管 466,157、全部付完後欠 25,543', led.inflow === 510857 && led.out === 536400 && led.outDone === 44700 && led.now === 466157 && led.all === -25543 && led.checks === 11 && led.next === '2026-11-25', led);
await nav(page, 'shareholder');
const detail = await page.evaluate(P => { sfOpen(P); return document.getElementById('sf-container').innerText; }, P);
check('明細：期票分組寫出受款、總額、每期、期數、區間', detail.includes('期票：彭公司車月租金') && detail.includes('受款：QA和運') && detail.includes('總額 $536,400') && detail.includes('每期 $44,700 × 12 期') && detail.includes('2026-10-25 ～ 2027-09-25'), detail.slice(0, 900));
check('明細：分潤轉入列出結算個案，每期之後的餘額遞減到欠公司 25,543', detail.includes('分潤轉入') && detail.includes('結算個案：QA一般工程') && detail.includes('公司代管 $466,157') && detail.includes('欠公司 $25,543') && detail.includes('12/12'));

// 6. 差額沖帳 25,543：公司負擔稅金。
const ohBefore = await page.evaluate(() => JSON.stringify(OVERHEAD));
const adj = await page.evaluate(P => { sfOpenAdjust(P); return { open: document.getElementById('modal-sf-adjust').classList.contains('open'), amount: document.getElementById('sf-adjust-amount').value, reason: document.getElementById('sf-adjust-reason').value }; }, P);
check('差額沖帳：自動帶入差額 25,543、原因預設公司負擔稅金', adj.open && adj.amount === '25,543' && adj.reason === 'tax', adj);
await page.evaluate(() => { sfSubmitAdjust(); });
check('沒寫說明不能沖帳', (await lastToast(page)) === '請寫明差額的原因說明' && (await page.evaluate(P => (CASES.find(c => c.code === P).loanAdjustments || []).length, P)) === 0);
await page.evaluate(() => { document.getElementById('sf-adjust-note').value = '月租含 5% 營業稅，由公司負擔；會計師確認可扣抵'; sfSubmitAdjust(); });
const afterAdj = await page.evaluate(P => { const l = sfLedger(P); return { all: l.balanceAll, now: l.balanceNow, adj: CASES.find(c => c.code === P).loanAdjustments }; }, P);
check('沖帳後：全部付完後 $0 結清，沖帳記在往來帳戶上', afterAdj.all === 0 && afterAdj.now === 466157 + 25543 && afterAdj.adj.length === 1 && afterAdj.adj[0].amount === 25543 && afterAdj.adj[0].reason === 'tax', afterAdj);
check('沖帳不進公司開銷', ohBefore === (await page.evaluate(() => JSON.stringify(OVERHEAD))));
const text2 = await page.evaluate(() => document.getElementById('sf-container').innerText);
check('明細列出差額沖帳和原因', text2.includes('差額沖帳') && text2.includes('公司負擔稅金') && text2.includes('$0 結清'));
const adjId = afterAdj.adj[0].id;
check('差額沖帳那一列有「編輯」和「刪除」', await page.evaluate(id => { const b = [...document.querySelectorAll('#sf-container button')].filter(x => (x.getAttribute('onclick') || '').includes(id)).map(x => x.textContent); return b.includes('編輯') && b.includes('刪除'); }, adjId));
const editAdj = await page.evaluate(({ P, adjId }) => { sfOpenAdjust(P, adjId); const v = id => document.getElementById(id).value; return { open: document.getElementById('modal-sf-adjust').classList.contains('open'), id: v('sf-adjust-id'), amount: v('sf-adjust-amount'), reason: v('sf-adjust-reason'), note: v('sf-adjust-note'), date: v('sf-adjust-date'), title: document.getElementById('sf-adjust-title').textContent, btn: document.getElementById('sf-adjust-submit').textContent, summary: document.getElementById('sf-adjust-summary').innerText }; }, { P, adjId });
check('編輯差額沖帳：帶出原本的金額、原因、日期、說明，按鈕是「儲存」', editAdj.open && editAdj.id === adjId && editAdj.amount === '25,543' && editAdj.reason === 'tax' && editAdj.note.startsWith('月租含 5%') && editAdj.date === afterAdj.adj[0].date && editAdj.title.startsWith('編輯差額沖帳') && editAdj.btn === '儲存' && editAdj.summary.includes('不含這筆的差額') && editAdj.summary.includes('$25,543'), editAdj);
const auditBefore = await page.evaluate(() => AUDIT_LOGS.length);
await page.evaluate(() => { document.getElementById('sf-adjust-amount').value = '25,000'; document.getElementById('sf-adjust-reason').value = 'other'; document.getElementById('sf-adjust-note').value = '改正金額'; sfSubmitAdjust(); });
const edited = await page.evaluate(P => { const c = CASES.find(x => x.code === P); const last = AUDIT_LOGS[0]; return { rows: c.loanAdjustments.map(a => ({ id: a.id, amount: a.amount, reason: a.reason, note: a.note })), all: sfLedger(P).balanceAll, audit: last && { action: last.action, label: last.targetLabel } }; }, P);
check('儲存後：同一筆改成 25,000、原因其他，沒有多出一筆，留下修改紀錄', edited.rows.length === 1 && edited.rows[0].id === adjId && edited.rows[0].amount === 25000 && edited.rows[0].reason === 'other' && edited.rows[0].note === '改正金額' && edited.all === -543 && (await page.evaluate(() => AUDIT_LOGS.length)) === auditBefore + 1 && edited.audit.action === 'update' && edited.audit.label.includes('$25,543 → $25,000'), edited);
check('編輯後提示已更新', (await lastToast(page)) === '已更新差額沖帳 $25,000 ✓');
await page.evaluate(({ P, adjId }) => { sfOpenAdjust(P, adjId); document.getElementById('sf-adjust-amount').value = ''; sfSubmitAdjust(); }, { P, adjId });
check('編輯時金額清空不能儲存', (await lastToast(page)) === '請填寫沖帳金額' && (await page.evaluate(P => CASES.find(x => x.code === P).loanAdjustments[0].amount, P)) === 25000);
await page.evaluate(() => closeModal('modal-sf-adjust'));
const newAfterEdit = await page.evaluate(P => { sfOpenAdjust(P); const r = { id: document.getElementById('sf-adjust-id').value, btn: document.getElementById('sf-adjust-submit').textContent, amount: document.getElementById('sf-adjust-amount').value }; closeModal('modal-sf-adjust'); return r; }, P);
check('編輯過後再按「差額沖帳」是新增，帶入剩下的 543', newAfterEdit.id === '' && newAfterEdit.btn === '沖帳' && newAfterEdit.amount === '543', newAfterEdit);
await page.evaluate(({ P, adjId }) => sfDeleteAdjust(P, adjId), { P, adjId });
check('差額沖帳可以刪除', (await page.evaluate(P => sfLedger(P).balanceAll, P)) === -25543 && (await page.evaluate(P => CASES.find(x => x.code === P).loanAdjustments.length, P)) === 0);
await page.evaluate(P => { sfOpenAdjust(P); document.getElementById('sf-adjust-note').value = '公司負擔稅金'; sfSubmitAdjust(); }, P);

// 7. 李的車：財盟 956,400 拆 12 張（第一張 11/05 已兌現），沒有分潤轉入 → 欠公司。
await page.evaluate(({ L }) => {
  openAddPayableModal();
  const set = (id, v) => { document.getElementById(id).value = v; };
  set('ap-add-payment-type', 'private_loan'); apTogglePaymentType();
  set('ap-add-case', L); set('ap-add-vendor', 'QA財盟'); set('ap-add-amount', '956400'); set('ap-add-summary', '李公司車租金'); set('ap-add-ticket', '2026-11-05'); set('ap-add-date', '2026-11-01');
  document.getElementById('ap-installment-on').checked = true; set('ap-installment-count', '12'); apUpdateInstallmentPreview();
  submitAddPayable();
}, { L });
const list = await page.evaluate(() => { sfOpen(null); return document.getElementById('sf-container').innerText; });
check('總表：彭代管 491,700（沖帳後）、李欠公司 79,700，未兌現期票 22 張', list.includes('QA彭 股東往來') && list.includes('公司代管 $491,700') && list.includes('欠公司 $79,700') && list.includes('欠公司 $956,400') && list.includes('22 張'), list.slice(0, 700));

// 8. 資金試算：「股東／親友應還」預設不計入；勾選後才加進資金。
const cashOff = await page.evaluate(() => { const r = cashCompute(); const line = r.lines.find(l => l.label.startsWith('股東／親友應還')); return { label: line?.label, amount: line?.amount, detail: line?.detail, assets: r.assets }; });
check('資金試算：預設列出「股東／親友應還（未計入）」金額 0，說明寫預估 956,400', cashOff.label === '股東／親友應還（未計入）' && cashOff.amount === 0 && cashOff.detail.includes('預估 $956,400'), cashOff);
await page.evaluate(() => sfSetIncludeCash(true));
const cashOn = await page.evaluate(() => { const r = cashCompute(); const line = r.lines.find(l => l.label.startsWith('股東／親友應還')); return { label: line?.label, amount: line?.amount, assets: r.assets }; });
check('勾選計入後：應還 956,400 加進可用的錢', cashOn.amount === 956400 && cashOn.assets === cashOff.assets + 956400, { cashOff, cashOn });
await page.evaluate(() => sfSetIncludeCash(false));

// 9. 改回銀行匯款：拿掉轉入。
await page.evaluate(id => { openEditPayableModal(id); document.getElementById('ap-pay-method-bank').checked = true; sfToggleTransfer(); document.getElementById('ap-add-bank').value = '國泰世華 活存 078-03-501213-2'; submitAddPayable(); }, sid);
const back = await page.evaluate(id => { const p = PAYABLES.find(x => x.id === id); return { loan: p.transferToLoanCase, bank: p.bank, status: p.status }; }, sid);
check('改回銀行匯款：轉入紀錄拿掉，銀行照選的', !back.loan && back.bank === '國泰世華 活存 078-03-501213-2' && back.status === 'paid', back);
check('改回後：彭的帳不再有分潤轉入', (await page.evaluate(P => sfLedger(P).entries.filter(e => e.kind === 'transfer').length, P)) === 0);

// 10. 分段：待付款的分潤結清款 100,000，只轉入 60,000。
const pid = await page.evaluate(() => {
  const row = { id: pyNextId++, case: '', caseName: '', vendor: '彭俞豪', summary: 'QA 分段結清', amount: 100000, wantDate: '2026-11-20', bank: '', transferDate: '', doneDate: '', ticket: '', invoice: '無', receipt: '無', person: '李鎮宇',
    paymentType: 'profit_settlement', profitPerson: 'peng', profitCaseCodes: ['YT-QA-2026-090'], status: 'approved', systemLocked: true, psSettled: true, settlementId: 990002, sourceKey: 'profit-settlement-990002-peng', note: '' };
  PAYABLES.push(row); return row.id;
});
await page.evaluate(({ pid, P }) => { openEditPayableModal(pid); document.getElementById('ap-add-amount').value = '60,000'; document.getElementById('ap-pay-method-transfer').checked = true; sfToggleTransfer(); document.getElementById('ap-loan-transfer-case').value = P; document.getElementById('ap-loan-transfer-date').value = '2026-11-20'; submitAddPayable(); }, { pid, P });
const part = await page.evaluate(pid => { const parent = PAYABLES.find(x => x.id === pid); const child = PAYABLES.find(x => x.parentPayableId === pid); return { parent: { amount: parent.amount, status: parent.status, loan: parent.transferToLoanCase || '' }, child: child && { amount: child.amount, status: child.status, loan: child.transferToLoanCase } }; }, pid);
check('分段轉入：只有付的 60,000 轉入往來，剩 40,000 待付不轉入', part.child && part.child.amount === 60000 && part.child.status === 'paid' && part.child.loan === P && part.parent.amount === 40000 && part.parent.status === 'approved' && !part.parent.loan, part);

// 11. 編輯個案：往來帳戶隱藏合約金額、分潤、毛利率、保固款；一般工程案照舊。
const hide = await page.evaluate(P => {
  const shown = id => document.getElementById(id).closest('.form-field').style.display !== 'none';
  openEditCase(P); const a = { amount: shown('edit-case-amount'), profit: shown('edit-case-profit-mode'), margin: shown('edit-case-est-margin'), retention: shown('edit-case-retention-amt'), name: shown('edit-case-name'), status: shown('edit-case-status'), hint: document.getElementById('edit-case-account-hint').style.display !== 'none' };
  closeModal('modal-edit-case');
  openEditCase('YT-QA-2026-090'); const b = { amount: shown('edit-case-amount'), margin: shown('edit-case-est-margin'), hint: document.getElementById('edit-case-account-hint').style.display !== 'none' };
  closeModal('modal-edit-case');
  return { a, b };
}, P);
check('往來帳戶的編輯個案只留名稱、負責人、狀態', !hide.a.amount && !hide.a.profit && !hide.a.margin && !hide.a.retention && hide.a.name && hide.a.status && hide.a.hint, hide.a);
check('一般工程案的編輯個案照舊', hide.b.amount && hide.b.margin && !hide.b.hint, hide.b);
await ctx.close();

// 12. 其他人看不到模組。
H.setScenario('B-peng');
ctx = await newContext('peng@yutesign.com', { fixedTime: NOW });
page = await openApp(ctx);
check('彭俞豪看不到股東資金往來', !(await visible(page, '#nav-shareholder')));
await page.evaluate(() => navTo('shareholder'));
check('彭俞豪直接開也會被擋', (await lastToast(page)) === '您沒有此功能的權限' && (await page.evaluate(() => currentPage)) !== 'shareholder');
await ctx.close();

const fails = await H.finish(outJson);
process.exit(fails ? 1 : 0);
