// 公司不固定支出連結 and the overhead link / amortization view (claude/overhead-payable-link). Mock cloud only;
// never touches production.
//
// Setup (outside the repo):  mkdir /tmp/ops-smoke && cd /tmp/ops-smoke && npm i playwright-core
// Run:  PLAYWRIGHT_CORE=/tmp/ops-smoke/node_modules/playwright-core/index.mjs \
//         node scripts/smoke-overhead-link.mjs <label> <rootDir> <port> <out.json>
// Frozen clock (2026-10-13 14:00 Taipei). Payables use QA vendors in the MOCK data only. confirm() is accepted;
// prompt() answers `promptAnswer`.
import { createHarness } from './smoke-lib.mjs';

const [label, rootDir, portArg, outJson] = process.argv.slice(2);
const H = await createHarness({ label, rootDir, port: Number(portArg) });
const { check, newContext, openApp, waitReady, waitSynced, lastToast, clearToasts, nav, counts } = H;
const NOW = new Date('2026-10-13T14:00:00+08:00');

H.setScenario('A-manage(shower)');
const ctx = await newContext('shower.li@yutesign.com', { fixedTime: NOW });
const page = await openApp(ctx);
let promptAnswer = '';
page.on('dialog', d => (d.type() === 'prompt' ? d.accept(promptAnswer) : d.accept()));
const before = await counts(page);
const missing = await page.evaluate(() => ['apIsOverheadVariablePayable', 'apPaymentTypeDisplayLabel', 'apOverheadSchedule', 'apOverheadLinkLine', 'apOpenOverheadLinkModal', 'apGoOverheadMonth', 'apFillOverheadVarItems'].filter(n => typeof window[n] !== 'function'));
check('不固定支出連結函式可用', missing.length === 0, { missing });
const optionText = await page.evaluate(() => [...document.querySelectorAll('#ap-add-payment-type option')].map(o => `${o.value}:${o.textContent.trim()}`));
check('款項性質多了「公司不固定支出連結」，固定開銷付款連結仍在', optionText.includes('overhead_variable:公司不固定支出連結') && optionText.includes('overhead_link:固定開銷付款連結'), optionText);

// 固定支出（房租、會計師記帳費等）完全不能變：記下目前所有月份的 fixed／fixedNotes／rent 連動。
// 只比對一開始就存在的月份（攤提會替未來月份建立空白月份，那些月份的固定支出本來就是新建的）。
const fixedMonths = await page.evaluate(() => Object.keys(OVERHEAD).sort());
const fixedState = () => page.evaluate(months => JSON.stringify(months.map(m => [m, OVERHEAD[m]?.fixed, OVERHEAD[m]?.fixedNotes, OVERHEAD[m]?.rentPayableLinks || null, OVERHEAD[m]?.fixedPayableManagedItems || null])), fixedMonths);
const fixedBefore = await fixedState();

const submit = f => page.evaluate(f => {
  if (f.editId) openEditPayableModal(f.editId); else openAddPayableModal();
  const set = (id, v) => { if (v !== undefined) document.getElementById(id).value = v; };
  if (f.type) { set('ap-add-payment-type', f.type); apTogglePaymentType(); }
  set('ap-add-vendor', f.vendor); set('ap-add-amount', f.amount); set('ap-add-summary', f.summary);
  set('ap-add-overhead-var-item', f.item); set('ap-add-status', f.status); set('ap-add-done-date', f.doneDate);
  set('ap-add-overhead-item', f.amItem); set('ap-add-amortization-start', f.amStart); set('ap-add-amortization-months', f.amMonths);
  const n = PAYABLES.length;
  submitAddPayable();
  const row = f.editId ? PAYABLES.find(p => p.id === f.editId) : (PAYABLES.length > n ? PAYABLES[PAYABLES.length - 1] : null);
  const open = document.getElementById('modal-add-payable').classList.contains('open');
  if (open) closeModal('modal-add-payable');
  return { added: PAYABLES.length - n, modalStillOpen: open, row: row && { id: row.id, paymentType: row.paymentType, overheadTreatment: row.overheadTreatment, overheadItem: row.overheadItem, status: row.status, doneDate: row.doneDate, case: row.case } };
}, f);
const varRows = (month, id) => page.evaluate(({ month, id }) => (OVERHEAD[month]?.variable || []).filter(v => String(v.sourcePayableId) === String(id)).map(v => ({ name: v.name, amount: v.amount, sourceType: v.sourceType })), { month, id });

// ── 新增：待付款，尚未列入公司開銷 ──
await clearToasts(page);
const a = await submit({ type: 'overhead_variable', vendor: 'QA木材公會', amount: '4,700', summary: 'QA木材公會會員費', item: '', status: 'approved' });
check('新增不固定支出連結：存成 overhead_link＋variable，項目空白時用摘要', a.added === 1 && a.row.paymentType === 'overhead_link' && a.row.overheadTreatment === 'variable' && a.row.overheadItem === 'QA木材公會會員費' && a.row.case === '', a);
check('待付款時不列入公司開銷', (await page.evaluate(id => Object.values(OVERHEAD).some(d => (d.variable || []).some(v => String(v.sourcePayableId) === String(id))), a.row.id)) === false);

// ── 已付款但沒填完成匯款日 → 擋下 ──
await clearToasts(page);
const noDate = await submit({ editId: a.row.id, status: 'paid', doneDate: '' });
check('已付款卻沒有完成匯款日 → 不存，提示要填日期', noDate.modalStillOpen && noDate.row.status === 'approved' && (await lastToast(page)).includes('完成匯款日'), { noDate, toast: await lastToast(page) });

// ── 填完成匯款日 → 依月份列入不固定支出 ──
const paid = await submit({ editId: a.row.id, doneDate: '2026-10-05' });
check('填完成匯款日後自動改已付款', paid.row.status === 'paid' && paid.row.doneDate === '2026-10-05', paid);
check('公司開銷 2026-10 不固定支出多一列，金額 4,700、名稱為項目', JSON.stringify(await varRows('2026-10', a.row.id)) === JSON.stringify([{ name: 'QA木材公會會員費', amount: 4700, sourceType: 'payable_overhead_link' }]), await varRows('2026-10', a.row.id));

// ── 編輯：開窗帶回原設定；改項目名稱與月份 ──
const reopened = await page.evaluate(id => { openEditPayableModal(id); const r = { type: document.getElementById('ap-add-payment-type').value, item: document.getElementById('ap-add-overhead-var-item').value, shown: document.getElementById('ap-overhead-var-fields').style.display !== 'none', amortShown: document.getElementById('ap-amortization-fields').style.display !== 'none' }; closeModal('modal-add-payable'); return r; }, a.row.id);
check('編輯時款項性質顯示「公司不固定支出連結」並帶回項目名稱', reopened.type === 'overhead_variable' && reopened.item === 'QA木材公會會員費' && reopened.shown && !reopened.amortShown, reopened);
const renamed = await submit({ editId: a.row.id, item: 'QA公會會費', doneDate: '2026-09-28' });
check('改項目名稱與完成匯款日 → 移到 2026-09，舊月份不留', renamed.row.overheadItem === 'QA公會會費' && JSON.stringify(await varRows('2026-09', a.row.id)) === JSON.stringify([{ name: 'QA公會會費', amount: 4700, sourceType: 'payable_overhead_link' }]) && (await varRows('2026-10', a.row.id)).length === 0, { renamed, sep: await varRows('2026-09', a.row.id), oct: await varRows('2026-10', a.row.id) });

// ── 房租不可走不固定支出 ──
await clearToasts(page);
const rent = await submit({ type: 'overhead_variable', vendor: 'QA房東', amount: '30,000', summary: 'QA 10月房租', status: 'approved' });
check('摘要含房租 → 擋下，提示用固定開銷付款連結', rent.added === 0 && (await lastToast(page)).includes('固定開銷付款連結'), { rent, toast: await lastToast(page) });

// ── 標記付款：詢問實際付款日 ──
const b = await submit({ type: 'overhead_variable', vendor: 'QA設計公會', amount: '3,855', summary: 'QA回訓報名費', item: 'QA回訓報名費', status: 'approved' });
promptAnswer = '2026-08-20';
await page.evaluate(id => markPaid(id), b.row.id);
const bRow = await page.evaluate(id => { const p = PAYABLES.find(x => x.id === id); return { status: p.status, doneDate: p.doneDate }; }, b.row.id);
check('標記付款時詢問實際完成付款日，並列入該月份', bRow.status === 'paid' && bRow.doneDate === '2026-08-20' && (await varRows('2026-08', b.row.id)).length === 1, { bRow, aug: await varRows('2026-08', b.row.id) });

// ── 預付費用攤提 ──
const c = await submit({ type: 'prepaid_expense', vendor: 'QA律師', amount: '100,000', summary: 'QA三年法律顧問費', amItem: 'QA法律顧問費攤提', amStart: '2026-07', amMonths: '36', status: 'paid', doneDate: '2026-07-08' });
const sched = await page.evaluate(id => apOverheadSchedule(PAYABLES.find(p => p.id === id)), c.row.id);
const amortRows = await page.evaluate(id => Object.entries(OVERHEAD).flatMap(([m, d]) => (d.variable || []).filter(v => String(v.sourcePayableId) === String(id)).map(v => [m, v.amount])).sort(), c.row.id);
check('攤提明細和公司開銷實際寫入的 36 期完全一致', sched.length === 36 && JSON.stringify(sched.map(r => [r.month, r.amount]).sort()) === JSON.stringify(amortRows) && sched[35].amount === 2770 && sched[0].amount === 2778, { first: sched[0], last: sched[35], n: amortRows.length });

// ── 應付列表的連結 ──
await nav(page, 'payable');
await page.evaluate(() => { document.getElementById('py-search').value = 'QA'; renderPayable(); });
const lines = await page.evaluate(() => document.getElementById('py-tbody').innerText);
check('列表：不固定支出連結顯示「→ 公司開銷 2026-09 不固定支出「QA公會會費」」', lines.includes('公司不固定支出連結') && lines.includes('→ 公司開銷 2026-09 不固定支出「QA公會會費」'), lines.slice(0, 600));
check('列表：攤提顯示 2026-07～2029-06・已攤 4/36 期 $11,112・未攤 $88,888', lines.includes('→ 攤提 2026-07～2029-06・已攤 4/36 期 $11,112・未攤 $88,888'), lines.slice(0, 900));

// ── 點開攤提明細 → 看公司開銷 ──
await page.getByText('→ 攤提 2026-07～2029-06', { exact: false }).first().click();
const modal = await page.evaluate(() => ({ open: document.getElementById('modal-ap-overhead-link').classList.contains('open'), title: document.getElementById('ap-oh-link-title').textContent, rows: document.querySelectorAll('#ap-oh-link-body tbody tr').length, text: document.getElementById('ap-oh-link-body').innerText, edit: !!document.querySelector('#ap-oh-link-footer .btn-primary') }));
check('點攤提連結 → 開出 36 期明細，本月標示「本月」，可編輯這筆應付', modal.open && modal.title === '預付費用攤提明細' && modal.rows === 36 && modal.text.includes('本月') && modal.text.includes('$2,770') && modal.edit, { ...modal, text: modal.text.slice(0, 300) });
await page.locator('#ap-oh-link-body tbody tr').nth(1).getByText('看公司開銷').click();
await page.waitForTimeout(200);
const oh = await page.evaluate(() => ({ active: document.getElementById('page-overhead').classList.contains('active'), month: document.getElementById('oh-filter-month').value, modalOpen: document.getElementById('modal-ap-overhead-link').classList.contains('open'), html: document.getElementById('oh-variable-tbody').innerHTML, text: document.getElementById('oh-variable-tbody').innerText }));
check('「看公司開銷」→ 跳到公司開銷 2026-08，看得到攤提列與不固定支出列', oh.active && oh.month === '2026-08' && !oh.modalOpen && oh.text.includes('QA法律顧問費攤提') && oh.text.includes('QA回訓報名費'), { ...oh, html: undefined });
check('公司開銷：應付帶入的列顯示「應付 #編號」，不給刪除鈕', oh.html.includes(`apOpenOverheadLinkModal(${b.row.id})`) && oh.html.includes(`apOpenOverheadLinkModal(${c.row.id})`) && !oh.html.includes(`ohDeleteVar('2026-08',${await page.evaluate(id => OVERHEAD['2026-08'].variable.find(v => String(v.sourcePayableId) === String(id)).id, b.row.id)})`));
const manual = await page.evaluate(() => { OVERHEAD['2026-08'].variable.push({ id: 987650, name: 'QA手動雜支', amount: 123, note: '' }); renderOverhead(); const h = document.getElementById('oh-variable-tbody').innerHTML; OVERHEAD['2026-08'].variable = OVERHEAD['2026-08'].variable.filter(v => v.id !== 987650); renderOverhead(); return h.includes("ohDeleteVar('2026-08',987650)"); });
check('公司開銷：手動輸入的不固定支出仍可刪除', manual);
await page.getByRole('button', { name: `應付 #${b.row.id}` }).click();
const fromOh = await page.evaluate(() => ({ open: document.getElementById('modal-ap-overhead-link').classList.contains('open'), title: document.getElementById('ap-oh-link-title').textContent, text: document.getElementById('ap-oh-link-body').innerText }));
check('從公司開銷點「應付 #編號」→ 開出這筆應付的連動資訊', fromOh.open && fromOh.title === '公司不固定支出連動' && fromOh.text.includes('QA設計公會') && fromOh.text.includes('2026-08'), fromOh);
await page.evaluate(() => closeModal('modal-ap-overhead-link'));

// ── 改回別的款項性質 → 公司開銷的列跟著移除 ──
const switched = await submit({ editId: b.row.id, type: 'tax_liability' });
check('改成其他款項性質 → overheadTreatment 清掉，公司開銷列移除', switched.row.paymentType === 'tax_liability' && !switched.row.overheadTreatment && (await varRows('2026-08', b.row.id)).length === 0, { switched, aug: await varRows('2026-08', b.row.id) });
await page.evaluate(id => rejectPayable(id), b.row.id);

// ── 退回 → 列移除 ──
await page.evaluate(id => rejectPayable(id), a.row.id);
check('退回這筆應付 → 公司開銷不固定支出列移除', !(await page.evaluate(id => PAYABLES.some(p => p.id === id) || Object.values(OVERHEAD).some(d => (d.variable || []).some(v => String(v.sourcePayableId) === String(id))), a.row.id)));

// ── 固定支出完全沒變；房租走原本的固定開銷付款連結 ──
const fixedMid = await fixedState();
check('整個過程中所有月份的固定支出（含房租連動）完全沒變', fixedMid === fixedBefore);
const r = await submit({ type: 'overhead_link', vendor: 'QA房東', amount: '30,000', summary: 'QA 11月房租', status: 'paid', doneDate: '2026-11-05' });
const rentNov = await page.evaluate(id => ({ fixed: OVERHEAD['2026-11'].fixed[OH_FIXED_CONFIG.indexOf('房租')], links: (OVERHEAD['2026-11'].rentPayableLinks || []).map(l => l.payableId), variable: (OVERHEAD['2026-11'].variable || []).filter(v => String(v.sourcePayableId) === String(id)).length }), r.row.id);
check('固定開銷付款連結（房租）照舊寫入固定支出房租，不進不固定支出', r.added === 1 && !r.row.overheadTreatment && rentNov.links.includes(r.row.id) && rentNov.variable === 0, { r, rentNov });
await page.evaluate(id => rejectPayable(id), r.row.id);

// ── 同步與重新載入 ──
await waitSynced(page);
await page.reload({ waitUntil: 'load' }); await waitReady(page);
const persisted = await page.evaluate(id => { const p = PAYABLES.find(x => x.id === id); return p && p.paymentType === 'prepaid_expense' && Object.values(OVERHEAD).reduce((s, d) => s + (d.variable || []).filter(v => String(v.sourcePayableId) === String(id)).length, 0); }, c.row.id);
check('重新載入後攤提仍是 36 期（已同步雲端）', persisted === 36, persisted);
check('重新載入後固定支出仍與一開始相同', (await fixedState()) === fixedBefore);
const after = await counts(page);
check('集合變化只有測試資料（留下 1 筆攤提應付）', after.PAYABLES === before.PAYABLES + 1 && after.RECEIVABLES === before.RECEIVABLES && after.EXPENSES === before.EXPENSES && after.CASES === before.CASES && after.VENDORS === before.VENDORS && after.PAYROLL === before.PAYROLL, { before, after });
await ctx.close();

const fails = await H.finish(outJson, { finalCloudData: JSON.parse(JSON.stringify(H.state.cloud?.data || {})) });
process.exit(fails ? 1 : 0);
