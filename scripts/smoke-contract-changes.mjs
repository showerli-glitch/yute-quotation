// 合約追加減 (claude/contract-changes): 編輯個案可加多筆追加／追減（名稱自己填、金額可負），
// 合約總額＝原約＋追加減；個案總覽、個案明細、儀表板合約總額、成本控制表的毛利率與收款率都用合約總額。
// Mock cloud only; never touches production.
//
// Setup (outside the repo):  mkdir /tmp/ops-smoke && cd /tmp/ops-smoke && npm i playwright-core
// Run:  PLAYWRIGHT_CORE=/tmp/ops-smoke/node_modules/playwright-core/index.mjs \
//         node scripts/smoke-contract-changes.mjs <label> <rootDir> <port> <out.json>
import { createHarness } from './smoke-lib.mjs';

const [label, rootDir, portArg, outJson] = process.argv.slice(2);
const H = await createHarness({ label, rootDir, port: Number(portArg) });
const { check, newContext, openApp, waitReady, waitSynced, lastToast, nav } = H;
const Q = 'YT-QA-2026-095';

H.setScenario('A-owner(shower)');
const ctx = await newContext('shower.li@yutesign.com', { fixedTime: new Date('2026-11-25T10:00:00+08:00') });
const page = await openApp(ctx);
page.on('dialog', d => d.accept());

// 跟石牌榮總一樣：簽約 57 萬，已收訂金 17.1 萬，已開發票未收 56.8 萬，已付廠商 419,611。
await page.evaluate(Q => {
  CASES.push({ code: Q, name: 'QA石牌宿舍', client: '', clientName: 'QA客戶', status: '進行中', amount: 570000, person: '李鎮宇', profitSplit: '三人' });
  RECEIVABLES.push({ id: rvNextId++, case: Q, caseName: 'QA石牌宿舍', item: '訂金30%', collectAmt: 171000, collectDate: '2026-09-18', invoiceAmt: 171000, invoiceDate: '2026-09-18', status: 'collected' });
  RECEIVABLES.push({ id: rvNextId++, case: Q, caseName: 'QA石牌宿舍', item: '裝修工程款', receivableAmt: 568000, invoiceAmt: 568000, invoiceDate: '2026-11-10', status: 'pending' });
  PAYABLES.push({ id: pyNextId++, case: Q, caseName: 'QA石牌宿舍', vendor: 'QA廠商', summary: '工程', amount: 419611, status: 'paid', doneDate: '2026-10-20', paymentType: 'vendor' });
  saveData();
}, Q);

await page.evaluate(Q => openEditCase(Q), Q);
const ui0 = await page.evaluate(() => ({ label: document.getElementById('edit-case-amount').closest('.form-field').querySelector('.form-label').textContent, rows: document.querySelectorAll('#edit-case-changes .case-cc-row').length, total: document.getElementById('edit-case-contract-total').textContent, btn: document.getElementById('edit-case-add-change').textContent }));
check('編輯個案：合約金額改名「原始合約金額」，下面有「＋ 新增追加減」，還沒有追加減', ui0.label === '原始合約金額（含稅）' && ui0.rows === 0 && ui0.btn === '＋ 新增追加減' && ui0.total.includes('就是原始合約金額'), ui0);

await page.click('#edit-case-add-change');
await page.fill('#edit-case-changes .case-cc-row:nth-child(1) .cc-amount', '169,000');
await page.fill('#edit-case-changes .case-cc-row:nth-child(1) .cc-date', '2026-10-15');
await page.fill('#edit-case-changes .case-cc-row:nth-child(1) .cc-note', '廚具升級');
await page.click('#edit-case-add-change');
await page.fill('#edit-case-changes .case-cc-row:nth-child(2) .cc-label', '第二次追減');
await page.fill('#edit-case-changes .case-cc-row:nth-child(2) .cc-amount', '-20,000');
const ui1 = await page.evaluate(() => ({ labels: [...document.querySelectorAll('#edit-case-changes .cc-label')].map(x => x.value), total: document.getElementById('edit-case-contract-total').textContent }));
check('新增兩筆：名稱預設「第一次追加」可改成「第二次追減」，合約總額即時算 570,000＋169,000−20,000＝719,000', ui1.labels.join() === '第一次追加,第二次追減' && ui1.total.includes('原約 $570,000') && ui1.total.includes('追加減 $149,000') && ui1.total.includes('$719,000'), ui1);

await page.click('#edit-case-add-change');
await page.fill('#edit-case-changes .case-cc-row:nth-child(3) .cc-label', '第三次追加');
await page.fill('#edit-case-changes .case-cc-row:nth-child(3) .cc-note', '還沒談好');
await page.click('#modal-edit-case button[onclick="submitEditCase()"]');
check('有名稱、沒金額的列不能存', (await lastToast(page)) === '「第三次追加」請填金額（追減填負數）' && !(await page.evaluate(Q => CASES.find(c => c.code === Q).contractChanges, Q)));
await page.click('#edit-case-changes .case-cc-row:nth-child(3) button');
await page.click('#edit-case-add-change');
await page.click('#modal-edit-case button[onclick="submitEditCase()"]');
const saved = await page.evaluate(Q => { const c = CASES.find(x => x.code === Q); const a = AUDIT_LOGS[0]; return { amount: c.amount, list: c.contractChanges, total: caseContractTotal(c), audit: a && { type: a.targetType, label: a.targetLabel } }; }, Q);
check('儲存：原約仍是 570,000，追加減兩筆（空白的預設列略過），合約總額 719,000，留下修改紀錄', saved.amount === 570000 && saved.list.length === 2 && saved.list[0].label === '第一次追加' && saved.list[0].amount === 169000 && saved.list[0].date === '2026-10-15' && saved.list[0].note === '廚具升級' && saved.list[1].amount === -20000 && saved.total === 719000 && saved.audit.type === 'caseContractChanges' && saved.audit.label.includes('$719,000'), saved);

await nav(page, 'cases');
const row = await page.evaluate(Q => { const tr = [...document.querySelectorAll('#case-table tbody tr')].find(t => t.textContent.includes('QA石牌宿舍')); const amt = tr?.querySelector('.amount'); return { text: amt?.textContent, title: amt?.getAttribute('title') }; }, Q);
check('個案總覽：合約金額顯示合約總額，滑鼠移上去看得到原約', row.text === '$719,000' && row.title.includes('原約 $570,000') && row.title.includes('2 筆'), row);
await page.evaluate(Q => openCaseDetail(Q), Q);
const detail = await page.evaluate(() => document.getElementById('cd-kpis').innerText);
check('個案明細：合約金額 719,000，下面列出原約和每筆追加減，收款進度用合約總額算（171,000÷719,000＝24%）', detail.includes('$719,000') && detail.includes('原約 $570,000') && detail.includes('＋$169,000（第一次追加）') && detail.includes('−$20,000（第二次追減）') && detail.includes('24% 收款進度'), detail);
await page.evaluate(() => closeModal('modal-case-detail'));
const kpi = await page.evaluate(() => { renderDashboard(); const active = CASES.filter(c => !c.psSettled && c.status !== '結案' && userCanViewCaseFinancials(c.code, 'dashboard')); return { shown: document.getElementById('dash-kpi-contract').textContent, exp: `${Math.round(active.reduce((s, c) => s + caseContractTotal(c), 0) / 10000).toLocaleString('zh-TW')}萬`, old: `${Math.round(active.reduce((s, c) => s + (c.amount || 0), 0) / 10000).toLocaleString('zh-TW')}萬` }; });
check('儀表板合約總額 KPI 含追加減', kpi.shown === kpi.exp && kpi.exp !== kpi.old, kpi);

await nav(page, 'profit');
const pf = await page.evaluate(Q => { const tr = [...document.querySelectorAll('#pf-case-tbody tr')].find(t => (t.getAttribute('onclick') || '').includes(Q)); return tr ? [...tr.children].map(td => td.textContent.trim()) : null; }, Q);
const gross = 171000 - 419611 - 171000 / 1.05 * 0.05 / 2;
check('成本控制表：合約金額 719,000，毛利率、收款率用合約總額算', pf && pf[1] === '$719,000' && pf[7] === `${(gross / 719000 * 100).toFixed(1)}%` && pf[8] === `${(171000 / 719000 * 100).toFixed(1)}%`, pf);

await nav(page, 'cash');
const hint = await page.evaluate(Q => { const el = document.getElementById(`cash-est-r-${Q}`); return el ? { ph: el.placeholder, title: el.title, value: el.value } : null; }, Q);
check('資金試算：還沒填預估時，「預估還可收」淡色提示合約總額−已收（719,000−171,000＝548,000），不自動帶入', hint && hint.ph === '參考 548,000' && hint.value === '' && hint.title.includes('只是參考'), hint);

// 刪掉一筆、重開還在
await page.evaluate(Q => openEditCase(Q), Q);
check('重開編輯：兩筆追加減都帶出來', (await page.evaluate(() => [...document.querySelectorAll('#edit-case-changes .cc-amount')].map(x => x.value).join('|'))) === '169,000|-20,000');
await page.click('#edit-case-changes .case-cc-row:nth-child(2) button');
await page.click('#modal-edit-case button[onclick="submitEditCase()"]');
check('刪掉追減那筆：合約總額回到 739,000', (await page.evaluate(Q => { const c = CASES.find(x => x.code === Q); return [c.contractChanges.length, caseContractTotal(c)].join(); }, Q)) === '1,739000');
await waitSynced(page);
await page.reload({ waitUntil: 'load' }); await waitReady(page);
const kept = await page.evaluate(Q => { const c = CASES.find(x => x.code === Q); return { list: c.contractChanges, total: caseContractTotal(c) }; }, Q);
check('重新載入後追加減還在（雲端同步）', kept.list.length === 1 && kept.list[0].label === '第一次追加' && kept.total === 739000, kept);

// 全部刪掉 → 不留空欄位
await page.evaluate(Q => openEditCase(Q), Q);
await page.click('#edit-case-changes .case-cc-row:nth-child(1) button');
await page.click('#modal-edit-case button[onclick="submitEditCase()"]');
check('全部刪掉：不留 contractChanges，合約總額＝原約', await page.evaluate(Q => { const c = CASES.find(x => x.code === Q); return !('contractChanges' in c) && caseContractTotal(c) === 570000; }, Q));

// 往來帳戶不顯示追加減
const loan = await page.evaluate(() => { const c = CASES.find(x => x.accountingTreatment === 'receivable_from_related_party'); if (!c) return null; openEditCase(c.code); const box = document.getElementById('edit-case-changes').closest('.form-field'); const r = box.style.display; closeModal('modal-edit-case'); return r; });
check('股東／親友往來帳戶的編輯視窗不顯示追加減', loan === 'none', loan);
await ctx.close();

const fails = await H.finish(outJson);
process.exit(fails ? 1 : 0);
