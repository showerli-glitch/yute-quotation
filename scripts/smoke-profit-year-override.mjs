// 成本控制表年度篩選 × 整案結算總數 (claude/profit-year-override)：
// revenueOverride／vendorCostOverride／grossOverride／taxCostOverride 是整個個案的數字，選年度時只算在歸屬年
// （結案年 → 最後一筆收款年 → 編號年）；其他年度只看那一年實際的收付款。稅額 0（不計稅）每年都適用。
// Mock cloud only; never touches production.
//
// Setup (outside the repo):  mkdir /tmp/ops-smoke && cd /tmp/ops-smoke && npm i playwright-core
// Run:  PLAYWRIGHT_CORE=/tmp/ops-smoke/node_modules/playwright-core/index.mjs \
//         node scripts/smoke-profit-year-override.mjs <label> <rootDir> <port> <out.json>
import { createHarness } from './smoke-lib.mjs';

const [label, rootDir, portArg, outJson] = process.argv.slice(2);
const H = await createHarness({ label, rootDir, port: Number(portArg) });
const { check, newContext, openApp, nav } = H;
const OLD = 'YT-QA-2025-091';   // 上洋嘉義型：2025 結案，存整案總數，2026 另收保固款
const RUN = 'YT-QA-2026-092';   // 進行中，存了非 0 稅額，收款都在 2026
const NOTAX = 'YT-QA-2026-093'; // 稅額 0 = 不計稅

H.setScenario('A-owner(shower)');
const ctx = await newContext('shower.li@yutesign.com', { fixedTime: new Date('2026-11-25T10:00:00+08:00') });
const page = await openApp(ctx);
page.on('dialog', d => d.accept());

await page.evaluate(({ OLD, RUN, NOTAX }) => {
  CASES.push({ code: OLD, name: 'QA舊案', status: '結案', amount: 1000000, closedDate: '2025-09-30', psSettled: true, profitSplit: '三人',
    revenueOverride: 990000, vendorCostOverride: 600000, taxCostOverride: 23000, grossOverride: 350000 });
  RECEIVABLES.push({ id: rvNextId++, case: OLD, caseName: 'QA舊案', item: '工程款', collectAmt: 950000, collectDate: '2025-08-01', invoiceAmt: 950000, invoiceDate: '2025-08-01', status: 'collected' });
  RECEIVABLES.push({ id: rvNextId++, case: OLD, caseName: 'QA舊案', item: '保固款', collectAmt: 42000, collectDate: '2026-08-05', invoiceAmt: 42000, invoiceDate: '2026-08-05', status: 'collected' });
  PAYABLES.push({ id: pyNextId++, case: OLD, caseName: 'QA舊案', vendor: 'QA廠商', summary: '保固維修', amount: 5000, status: 'paid', doneDate: '2026-08-10', paymentType: 'vendor' });
  CASES.push({ code: RUN, name: 'QA進行中', status: '進行中', amount: 500000, profitSplit: '三人', taxCostOverride: 7000 });
  RECEIVABLES.push({ id: rvNextId++, case: RUN, caseName: 'QA進行中', item: '一期款', collectAmt: 210000, collectDate: '2026-06-01', invoiceAmt: 210000, invoiceDate: '2026-06-01', status: 'collected' });
  CASES.push({ code: NOTAX, name: 'QA不計稅', status: '進行中', amount: 300000, profitSplit: '三人', taxCostOverride: 0 });
  RECEIVABLES.push({ id: rvNextId++, case: NOTAX, caseName: 'QA不計稅', item: '一期款', collectAmt: 105000, collectDate: '2026-06-01', invoiceAmt: 105000, invoiceDate: '2026-06-01', status: 'collected' });
  saveData();
}, { OLD, RUN, NOTAX });

await nav(page, 'profit');
const rowsFor = years => page.evaluate(({ years, codes }) => {
  pfClosedCollapsed = false; pfSelYears.clear(); years.forEach(y => pfSelYears.add(y)); renderProfit();
  const out = {};
  codes.forEach(code => {
    const tr = [...document.querySelectorAll('#pf-case-tbody tr')].find(t => (t.getAttribute('onclick') || '').includes(code));
    const n = i => tr ? Number(tr.children[i].textContent.replace(/[^0-9-]/g, '')) : null;
    out[code] = tr ? { rev: n(2), cost: n(3), tax: n(5), gross: n(6) } : null;
  });
  return out;
}, { years, codes: ['YT-QA-2025-091', 'YT-QA-2026-092', 'YT-QA-2026-093'] });

const all = await rowsFor([]);
check('全部年度：舊案照存的整案總數（收 990,000／成本 600,000／稅 23,000／毛利 350,000）', JSON.stringify(all[OLD]) === JSON.stringify({ rev: 990000, cost: 600000, tax: 23000, gross: 350000 }), all[OLD]);
check('全部年度：進行中個案用存的稅額 7,000', all[RUN]?.tax === 7000, all[RUN]);

const y2025 = await rowsFor(['2025']);
check('選 2025（結案年）：舊案照整案總數', !!all[OLD] && JSON.stringify(y2025[OLD]) === JSON.stringify(all[OLD]), y2025[OLD]);
check('選 2025：進行中個案（收款都在 2026）沒有收入、稅額 0', y2025[RUN]?.rev === 0 && y2025[RUN]?.tax === 0, y2025[RUN]);

const y2026 = await rowsFor(['2026']);
const oldTax2026 = Math.round(42000 / 1.05 * 0.05 / 2);
check('選 2026：舊案只算 2026 實際收付（保固款 42,000、維修 5,000、稅照發票算），不再套整案總數', JSON.stringify(y2026[OLD]) === JSON.stringify({ rev: 42000, cost: 5000, tax: oldTax2026, gross: 42000 - 5000 - oldTax2026 }), y2026[OLD]);
check('選 2026（最後收款年）：進行中個案用存的稅額 7,000', y2026[RUN]?.rev === 210000 && y2026[RUN]?.tax === 7000, y2026[RUN]);

const y2027 = await rowsFor(['2027']);
check('選 2027：舊案和進行中個案都沒有任何金額', JSON.stringify(y2027[OLD]) === JSON.stringify({ rev: 0, cost: 0, tax: 0, gross: 0 }) && y2027[RUN]?.tax === 0 && y2027[RUN]?.gross === 0, { old: y2027[OLD], run: y2027[RUN] });

const both = await rowsFor(['2025', '2026']);
check('同時選 2025＋2026：舊案用整案總數（不重複加 2026 保固款）', !!all[OLD] && JSON.stringify(both[OLD]) === JSON.stringify(all[OLD]), both[OLD]);

check('稅額 0（不計稅）：每個年度都是 0', [all, y2025, y2026, y2027].every(r => r[NOTAX]?.tax === 0), [all, y2026].map(r => r[NOTAX]));

// 模擬資料裡的上洋嘉義（2025 結案、存整案總數）在 2027 不再出現金額
const jiayi = await page.evaluate(() => { pfClosedCollapsed = false; pfSelYears.clear(); pfSelYears.add('2027'); renderProfit(); const tr = [...document.querySelectorAll('#pf-case-tbody tr')].find(t => (t.getAttribute('onclick') || '').includes('YT-UPY-2025-001')); const r = tr ? [...tr.children].slice(2, 7).map(td => td.textContent.trim()) : null; pfSelYears.clear(); renderProfit(); return r; });
check('上洋嘉義選 2027：收入、成本、稅、毛利都是 $0', !!jiayi && jiayi.every(t => t === '$0'), jiayi);
await ctx.close();

const fails = await H.finish(outJson);
process.exit(fails ? 1 : 0);
