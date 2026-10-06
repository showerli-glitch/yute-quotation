// Net-profit / cost-control dashboard (成本控制表) smoke test. Mock cloud only; never touches production.
//
// Setup (outside the repo):  mkdir /tmp/ops-smoke && cd /tmp/ops-smoke && npm i playwright-core
// Run:  PLAYWRIGHT_CORE=/tmp/ops-smoke/node_modules/playwright-core/index.mjs \
//         node scripts/smoke-profit.mjs <label> <rootDir> <port> <out.json>
// Frozen clock (2026-10-06 14:00 Taipei). A fixture case with known receivable / payable / expense
// amounts is added to the MOCK data so the dashboard figures can be re-derived independently:
//   revenue 500,000; vendor cost 200,000; expenses 30,000; tax 525,000 / 1.05 × 0.05 / 2 = 12,500;
//   gross = 500,000 − 200,000 − 30,000 − 12,500 = 257,500.
import { createHarness } from './smoke-lib.mjs';

const [label, rootDir, portArg, outJson] = process.argv.slice(2);
const H = await createHarness({ label, rootDir, port: Number(portArg) });
const { check, newContext, openApp, waitReady, waitSynced, lastToast, clearToasts, visible, nav, counts } = H;
const NOW = new Date('2026-10-06T14:00:00+08:00');
const QA = 'YT-QA-2026-001';
const parseMoney = t => { const m = String(t || '').replace(/,/g, '').match(/(-?)\$(\d+)/); return m ? Number(m[2]) * (m[1] ? -1 : 1) : null; };
const kpis = page => page.evaluate(() => Object.fromEntries(['revenue', 'payable', 'expense', 'gross'].map(k => [k, document.getElementById('pf-kpi-' + k).textContent])));
const kpiNum = async page => Object.fromEntries(Object.entries(await kpis(page)).map(([k, v]) => [k, parseMoney(v)]));
const uncat = page => page.evaluate(() => { const yearOk = d => pfSelYears.size === 0 || pfSelYears.has((d || '').slice(0, 4)); const codes = new Set(CASES.map(c => c.code)); return PAYABLES.filter(p => p.status === 'paid' && isCostControlPayment(p) && yearOk(p.doneDate || p.transferDate || p.wantDate) && (!p.case || !codes.has(p.case))).reduce((s, p) => s + (p.amount || 0), 0); });
const qaRowText = page => page.evaluate(code => [...document.querySelectorAll('#pf-case-tbody tr')].find(tr => tr.innerText.includes(code))?.innerText.replace(/\s+/g, ' ') || '', QA);

// ═══════════ A: manager (shower) ═══════════
H.setScenario('A-manage(shower)');
let ctx = await newContext('shower.li@yutesign.com', { fixedTime: NOW });
let page = await openApp(ctx);
page.on('dialog', d => d.accept());
const before = await counts(page);
const missing = await page.evaluate(() => ['fmtNum','pfToggleClosedCases','pfSelectDetailCase','buildPfYearPills','pfToggleYear','pfToggleCaseDropdown','pfCaseAllToggle','pfCaseCheckChange','updatePfCaseBtn','renderProfit'].filter(n => typeof window[n] !== 'function'));
const state0 = await page.evaluate(() => ({ years: pfSelYears.size, cases: pfSelCases.size, collapsed: pfClosedCollapsed, fmt: fmtNum(1234567) }));
check('儀表板函式、狀態與 fmtNum 可用', missing.length === 0 && state0.years === 0 && state0.cases === 0 && state0.collapsed === true && state0.fmt === '1,234,567', { missing, ...state0 });
await nav(page, 'profit');
check('成本控制表可進入', (await page.evaluate(() => currentPage)) === 'profit' && (await page.$$eval('#pf-case-tbody tr', t => t.length)) > 0);
const k0 = await kpiNum(page);
check('KPI 為金額（管理者看得到合計）', Object.values(k0).every(v => Number.isFinite(v)), await kpis(page));

// fixture case with known amounts
await page.evaluate(code => {
  CASES.push({ code, name: 'QA測試案場', client: 'QA', clientName: 'QA客戶', status: '進行中', amount: 1000000, collected: 0, person: '李鎮宇', pct: 0, profitSplit: '三人' });
  RECEIVABLES.push({ id: rvNextId++, case: code, caseName: 'QA測試案場', buyer: 'QA客戶', item: 'QA一期款', receivableAmt: 525000, invoiceAmt: 525000, invoiceDate: '2026-10-01', invoiceNo: 'QA00000001', collectAmt: 500000, collectDate: '2026-10-01', status: 'collected' });
  PAYABLES.push({ id: pyNextId++, case: code, caseName: 'QA測試案場', vendor: 'QA廠商', summary: 'QA工程款', amount: 200000, wantDate: '2026-10-02', transferDate: '2026-10-02', doneDate: '2026-10-02', status: 'paid', person: '李鎮宇', invoice: '有', receipt: '有' });
  EXPENSES.push({ id: expNextId++, month: '2026-10', caseKey: code, item: 'QA材料', category: '材料', amount: 30000, status: 'approved', person: 'shower' });
  saveData();
  renderProfit();
}, QA);
const k1 = await kpiNum(page);
const d = { revenue: k1.revenue - k0.revenue, payable: k1.payable - k0.payable, expense: k1.expense - k0.expense, gross: k1.gross - k0.gross };
check('加入測試案件後 KPI 增加量 = 獨立計算（收入 500,000／成本 200,000／費用 30,000／毛利 257,500）', d.revenue === 500000 && d.payable === 200000 && d.expense === 30000 && d.gross === 257500, d);
const row = await qaRowText(page);
check('成本控制表出現測試案件與金額', row.includes(QA) && row.includes('500,000') && row.includes('200,000') && row.includes('257,500'), row.slice(0, 160));
await page.evaluate(code => pfSelectDetailCase(code), QA);
const detail = await page.evaluate(() => ({ sel: document.getElementById('pf-detail-case').value, text: document.getElementById('pf-detail-panel').innerText.replace(/\s+/g, ' ') }));
check('點案件顯示明細（入帳、付款、費用）', detail.sel === QA && detail.text.includes('QA一期款') && detail.text.includes('QA工程款') && detail.text.includes('QA材料'), detail.text.slice(0, 120));

// year filter
const yearPills = await page.$$eval('#pf-year-pills button', bs => bs.map(b => b.textContent.trim()));
await page.evaluate(() => pfToggleYear('2025'));
const k2025 = await kpiNum(page);
const row2025 = await qaRowText(page);
check('年份篩選 2025：測試案件（2026 資料）不計入', (await page.evaluate(() => [...pfSelYears].join(','))) === '2025' && !row2025.includes('500,000') && k2025.revenue < k1.revenue, { pills: yearPills, revenue2025: k2025.revenue, row: row2025.slice(0, 80) });
await page.evaluate(() => pfToggleYear('2025'));
check('取消年份篩選回到全部', (await page.evaluate(() => pfSelYears.size)) === 0 && (await kpiNum(page)).revenue === k1.revenue);

// case dropdown
await page.click('#pf-case-filter-btn');
check('案件下拉開啟', await page.evaluate(() => document.getElementById('pf-case-dropdown').style.display !== 'none'));
await page.evaluate(code => { document.getElementById('pf-case-all').checked = false; pfCaseAllToggle(document.getElementById('pf-case-all')); const cb = [...document.querySelectorAll('#pf-case-checkboxes input[type=checkbox]')].find(x => x.value === code); cb.checked = true; pfCaseCheckChange(); }, QA);
const onlyQa = await page.evaluate(() => ({ sel: [...pfSelCases], rows: [...document.querySelectorAll('#pf-case-tbody tr')].filter(tr => tr.getAttribute('onclick')?.includes('pfSelectDetailCase')).map(tr => tr.getAttribute('onclick').match(/'([^']+)'/)[1]), btn: document.getElementById('pf-case-filter-btn').textContent.trim() }));
const kOnly = await kpiNum(page);
const u = await uncat(page);
check('只選測試案件：表格只剩它，KPI = 測試案件（成本／毛利另含未指定案件付款）', JSON.stringify(onlyQa.sel) === JSON.stringify([QA]) && JSON.stringify(onlyQa.rows) === JSON.stringify([QA]) && kOnly.revenue === 500000 && kOnly.expense === 30000 && kOnly.payable === 200000 + u && kOnly.gross === 257500 - u, { ...onlyQa, kOnly, uncat: u });
await page.mouse.click(5, 5);
check('點外面關閉案件下拉', await page.evaluate(() => document.getElementById('pf-case-dropdown').style.display === 'none'));
await page.evaluate(() => { const all = document.getElementById('pf-case-all'); all.checked = true; pfCaseAllToggle(all); });
check('全選案件回到全部', (await page.evaluate(() => pfSelCases.size)) === 0 && (await kpiNum(page)).revenue === k1.revenue);

// closed cases collapse + persisted preference
const closedBefore = await page.evaluate(() => pfClosedCollapsed);
await page.evaluate(() => pfToggleClosedCases());
const pref = await page.evaluate(() => ({ state: pfClosedCollapsed, stored: localStorage.getItem('yutesign-ops-profit-closed-collapsed') }));
check('已結案收合切換並記住偏好', pref.state === !closedBefore && pref.stored === (pref.state ? '1' : '0'), pref);

// a new paid payable updates the dashboard
await page.evaluate(code => { PAYABLES.push({ id: pyNextId++, case: code, caseName: 'QA測試案場', vendor: 'QA廠商2', summary: 'QA追加', amount: 50000, wantDate: '2026-10-03', transferDate: '2026-10-03', doneDate: '2026-10-03', status: 'paid', person: '李鎮宇', invoice: '有', receipt: '有' }); saveData(); renderProfit(); }, QA);
const k3 = await kpiNum(page);
check('新增已付款付款後成本 +50,000、毛利 −50,000', k3.payable - k1.payable === 50000 && k1.gross - k3.gross === 50000, { payable: k3.payable - k1.payable, gross: k1.gross - k3.gross });
await page.waitForTimeout(1200);
await waitSynced(page);
await page.reload({ waitUntil: 'load' }); await waitReady(page);
await nav(page, 'profit');
check('重新載入：收合偏好保留、KPI 與重載前相同', (await page.evaluate(() => pfClosedCollapsed)) === pref.state && JSON.stringify(await kpiNum(page)) === JSON.stringify(k3));
await ctx.close();

// ═══════════ B: profit-cases-only (peng: profit view_profit_cases, roleCode PM) ═══════════
H.setScenario('B-profit-cases(peng)');
ctx = await newContext('peng@yutesign.com', { fixedTime: NOW });
page = await openApp(ctx);
await nav(page, 'profit');
const pB = await page.evaluate(() => ({ level: permissionLevel('profit'), totals: canSeeFinancialTotals(), rows: [...document.querySelectorAll('#pf-case-tbody tr')].filter(tr => tr.getAttribute('onclick')?.includes('pfSelectDetailCase')).map(tr => tr.getAttribute('onclick').match(/'([^']+)'/)[1]), allowed: CASES.filter(c => userCanViewCaseFinancials(c.code, 'profit')).map(c => c.code) }));
check('只看分潤案件：權限 view_profit_cases、KPI 合計隱藏', pB.level === 'view_profit_cases' && !pB.totals && Object.values(await kpis(page)).every(v => v === '—'), await kpis(page));
check('只看分潤案件：表格只列可看的案件', pB.rows.length > 0 && pB.rows.every(c => pB.allowed.includes(c)), { rows: pB.rows.length, allowed: pB.allowed.length });
await ctx.close();

// ═══════════ C: no access (lu_yanchen with profit 'none' in the MOCK cloud only) ═══════════
H.setScenario('C-none(lu,mock)');
H.state.cloud.data.USER_PERMISSIONS.lu_yanchen.profit = 'none';
ctx = await newContext('lu@yutesign.com', { fixedTime: NOW });
page = await openApp(ctx);
await page.reload({ waitUntil: 'load' }); await waitReady(page);
await clearToasts(page);
await page.evaluate(() => navTo('profit'));
check('無權限：成本控制表被拒、側欄隱藏', (await lastToast(page)) === '您沒有此功能的權限' && !(await visible(page, '#nav-profit')));
await ctx.close();
H.state.cloud.data.USER_PERMISSIONS.lu_yanchen.profit = 'view_profit_cases';

// ═══════════ D: fresh browser reads the same numbers ═══════════
H.setScenario('D-fresh(shower)');
ctx = await newContext('shower.li@yutesign.com', { fixedTime: NOW });
page = await openApp(ctx);
await nav(page, 'profit');
check('全新瀏覽器（只讀雲端）KPI 相同', JSON.stringify(await kpiNum(page)) === JSON.stringify(k3), await kpis(page));
const after = await counts(page);
check('集合變化只有測試資料（案件 +1、應收 +1、應付 +2、費用 +1）', after.CASES === before.CASES + 1 && after.RECEIVABLES === before.RECEIVABLES + 1 && after.PAYABLES === before.PAYABLES + 2 && after.EXPENSES === before.EXPENSES + 1 && ['CLIENTS', 'VENDORS', 'PAYROLL'].every(k => after[k] === before[k]), { before, after });
await ctx.close();

const fails = await H.finish(outJson, { finalCloudData: JSON.parse(JSON.stringify(H.state.cloud?.data || {})) });
process.exit(fails ? 1 : 0);
