// Fixed overhead links (claude/fixed-overhead-fixes): company rent is counted once (rent link only, not also as a
// fixed-item group), an old double-counted month is repaired on the next rebuild, other fixed items keep their
// manual + linked behaviour, and editing a fixed overhead-link payable keeps its overhead item. Mock cloud only;
// never touches production.
//
// Setup (outside the repo):  mkdir /tmp/ops-smoke && cd /tmp/ops-smoke && npm i playwright-core
// Run:  PLAYWRIGHT_CORE=/tmp/ops-smoke/node_modules/playwright-core/index.mjs \
//         node scripts/smoke-fixed-overhead.mjs <label> <rootDir> <port> <out.json>
// Uses months 2030-01～2030-03 so the mock seed data is not touched.
import { createHarness } from './smoke-lib.mjs';

const [label, rootDir, portArg, outJson] = process.argv.slice(2);
const H = await createHarness({ label, rootDir, port: Number(portArg) });
const { check, newContext, openApp, waitReady, waitSynced } = H;
const NOW = new Date('2026-10-19T15:00:00+08:00');

H.setScenario('A-manage(shower)');
const ctx = await newContext('shower.li@yutesign.com', { fixedTime: NOW });
const page = await openApp(ctx);
page.on('dialog', d => d.accept());

const settledBefore = await page.evaluate(() => JSON.stringify({ s: PROFIT_SETTLEMENTS, c: CASES.filter(c => c.psSettled).map(c => [c.code, c.status, c.psSettledThrough || '']) }));
const state = month => page.evaluate(month => {
  const d = OVERHEAD[month] || {}; const i = n => OH_FIXED_CONFIG.indexOf(n);
  return { rent: d.fixed?.[i('房租')], rentNote: d.fixedNotes?.[i('房租')] || '', acct: d.fixed?.[i('會計師記帳費')], acctNote: d.fixedNotes?.[i('會計師記帳費')] || '', managed: Object.keys(d.fixedPayableManagedItems || {}), rentLinks: (d.rentPayableLinks || []).map(l => l.payableId) };
}, month);

// ── 1. 新的房租付款（固定＋房租）只算一次 ──
const rent1 = await page.evaluate(() => {
  ohInitMonth('2030-01');
  const i = OH_FIXED_CONFIG.indexOf('房租'); OVERHEAD['2030-01'].fixed[i] = 30000; OVERHEAD['2030-01'].fixedNotes[i] = 'QA 手動房租';
  const p = { id: pyNextId++, paymentType: 'overhead_link', overheadTreatment: 'fixed', overheadItem: '房租', vendor: 'QA房東', summary: 'QA 1月房租', amount: 30000, status: 'paid', doneDate: '2030-01-05', transferDate: '2030-01-05', case: '' };
  PAYABLES.push(p); pyRebuildRentOverhead(); return p.id;
});
const s1 = await state('2030-01');
check('房租付款（固定＋房租）：固定支出房租只算一次 30,000，不另外記成固定項目彙總', s1.rent === 30000 && !s1.managed.includes('房租') && s1.rentLinks.includes(rent1) && s1.rentNote.includes(`AP#${rent1}`), s1);

// ── 2. 舊資料已經重複（60,000）→ 下次重算修正，備註回到房租連動 ──
await page.evaluate(id => {
  const d = OVERHEAD['2030-01']; const i = OH_FIXED_CONFIG.indexOf('房租');
  d.fixedPayableManagedItems = { 房租: { manualBackup: 30000, manualNoteBackup: `AP#${id} 應付已付款連動：舊備註`, links: [{ payableId: id, amount: 30000 }] } };
  d.fixed[i] = 60000; d.fixedNotes[i] = '重複的舊備註';
  pyRebuildRentOverhead();
}, rent1);
const s2 = await state('2030-01');
check('舊的重複月份（60,000）重算後變回 30,000，重複紀錄移除，備註是房租連動', s2.rent === 30000 && !s2.managed.includes('房租') && s2.rentNote.startsWith(`AP#${rent1} 應付已付款連動`) && !s2.rentNote.includes('重複'), s2);

// ── 3. 舊格式房租（沒有 overheadTreatment，摘要含房租）照舊 ──
const rent2 = await page.evaluate(() => { const p = { id: pyNextId++, paymentType: 'overhead_link', vendor: 'QA房東', summary: 'QA 2月房租', amount: 30000, status: 'paid', doneDate: '2030-02-05', transferDate: '2030-02-05', case: '' }; PAYABLES.push(p); pyRebuildRentOverhead(); return p.id; });
const s3 = await state('2030-02');
check('舊格式房租（只靠摘要判斷）照舊寫入房租 30,000', s3.rent === 30000 && s3.rentLinks.includes(rent2) && !s3.managed.includes('房租'), s3);

// ── 4. 其他固定項目（會計師記帳費）維持「手動＋連結」 ──
const acct = await page.evaluate(() => {
  ohInitMonth('2030-03'); const i = OH_FIXED_CONFIG.indexOf('會計師記帳費'); OVERHEAD['2030-03'].fixed[i] = 15000; OVERHEAD['2030-03'].fixedNotes[i] = 'QA 手動估列';
  const p = { id: pyNextId++, paymentType: 'overhead_link', overheadTreatment: 'fixed', overheadItem: '會計師記帳費', vendor: 'QA會計師', summary: 'QA 1–2月帳務整理費', amount: 14000, status: 'paid', doneDate: '2030-03-10', transferDate: '2030-03-10', case: '' };
  PAYABLES.push(p); pyRebuildRentOverhead(); return p.id;
});
const s4 = await state('2030-03');
check('會計師記帳費等非房租固定項目：行為不變（手動 15,000＋連結 14,000）', s4.acct === 29000 && s4.managed.includes('會計師記帳費') && s4.acctNote.includes(`AP#${acct}`), s4);

// ── 5. 編輯固定開銷付款連結：開銷項目不再被清空 ──
const edit = await page.evaluate(id => {
  openEditPayableModal(id);
  const type = document.getElementById('ap-add-payment-type').value;
  document.getElementById('ap-add-note').value = 'QA 只改備註';
  submitAddPayable();
  const p = PAYABLES.find(x => x.id === id);
  return { type, overheadItem: p.overheadItem, overheadTreatment: p.overheadTreatment, note: p.note };
}, acct);
const s5 = await state('2030-03');
check('編輯會計師記帳費那筆（只改備註）：開銷項目與歸類保留，公司開銷仍是 29,000', edit.type === 'overhead_link' && edit.overheadItem === '會計師記帳費' && edit.overheadTreatment === 'fixed' && edit.note === 'QA 只改備註' && s5.acct === 29000 && s5.managed.includes('會計師記帳費'), { edit, s5 });
const editRent = await page.evaluate(id => { openEditPayableModal(id); document.getElementById('ap-add-note').value = 'QA 房租備註'; submitAddPayable(); const p = PAYABLES.find(x => x.id === id); return { overheadItem: p.overheadItem, overheadTreatment: p.overheadTreatment }; }, rent1);
const s6 = await state('2030-01');
check('編輯房租那筆：仍是固定＋房租，房租仍是 30,000', editRent.overheadItem === '房租' && editRent.overheadTreatment === 'fixed' && s6.rent === 30000 && s6.rentLinks.includes(rent1), { editRent, s6 });

// ── 6. 改成不固定支出連結時才換掉 ──
const toVar = await page.evaluate(id => { openEditPayableModal(id); document.getElementById('ap-add-payment-type').value = 'overhead_variable'; apTogglePaymentType(); document.getElementById('ap-add-overhead-var-item').value = 'QA 改列不固定'; submitAddPayable(); const p = PAYABLES.find(x => x.id === id); return { overheadItem: p.overheadItem, overheadTreatment: p.overheadTreatment, varRows: (OVERHEAD['2030-03'].variable || []).filter(v => v.sourcePayableId === id).length, acct: OVERHEAD['2030-03'].fixed[OH_FIXED_CONFIG.indexOf('會計師記帳費')] }; }, acct);
check('改成「公司不固定支出連結」：改列不固定支出，固定支出回到手動 15,000', toVar.overheadTreatment === 'variable' && toVar.overheadItem === 'QA 改列不固定' && toVar.varRows === 1 && toVar.acct === 15000, toVar);

// ── 已結算資料不受影響、同步後重新載入仍正確 ──
await page.evaluate(() => saveData());
await waitSynced(page);
await page.reload({ waitUntil: 'load' }); await waitReady(page);
const s7 = await state('2030-01');
check('重新載入後 2030-01 房租仍是 30,000', s7.rent === 30000 && !s7.managed.includes('房租'), s7);
const settledAfter = await page.evaluate(() => JSON.stringify({ s: PROFIT_SETTLEMENTS, c: CASES.filter(c => c.psSettled).map(c => [c.code, c.status, c.psSettledThrough || '']) }));
// 雲端（RTDB）存檔會丟掉空陣列／null 並改變鍵的順序，所以兩邊都先做同樣的整理再比。
const canon = json => { const prune = v => Array.isArray(v) ? v.map(prune).filter(x => x !== undefined) : (v && typeof v === 'object') ? Object.fromEntries(Object.keys(v).sort().map(k => [k, prune(v[k])]).filter(([, x]) => x !== undefined && x !== null && !(Array.isArray(x) && !x.length) && !(typeof x === 'object' && !Array.isArray(x) && !Object.keys(x).length))) : v; return JSON.stringify(prune(JSON.parse(json))); };
check('分潤結算紀錄與已結算個案完全不變', canon(settledAfter) === canon(settledBefore), canon(settledAfter) === canon(settledBefore) ? '' : { before: canon(settledBefore).slice(0, 600), after: canon(settledAfter).slice(0, 600) });
await ctx.close();

const fails = await H.finish(outJson);
process.exit(fails ? 1 : 0);
