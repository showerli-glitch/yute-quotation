// 月份費用批次申請 layout (claude/expense-batch-layout): fixed-height modal, the table scrolls in its own box with
// the horizontal scrollbar inside the visible area, sticky header and sticky #／歸屬個案 columns. Mock cloud only;
// never touches production.
//
// Setup (outside the repo):  mkdir /tmp/ops-smoke && cd /tmp/ops-smoke && npm i playwright-core
// Run:  PLAYWRIGHT_CORE=/tmp/ops-smoke/node_modules/playwright-core/index.mjs \
//         node scripts/smoke-expense-layout.mjs <label> <rootDir> <port> <out.json>
import { createHarness } from './smoke-lib.mjs';

const [label, rootDir, portArg, outJson] = process.argv.slice(2);
const H = await createHarness({ label, rootDir, port: Number(portArg) });
const { check, newContext, openApp } = H;
const NOW = new Date('2026-10-19T14:00:00+08:00');

for (const [w, h, name] of [[960, 640, '平板直式寬度 960'], [1366, 700, '筆電 1366'], [390, 844, '手機 390']]) {
  H.setScenario(name);
  const ctx = await newContext('shower.li@yutesign.com', { fixedTime: NOW });
  const page = await openApp(ctx);
  await page.setViewportSize({ width: w, height: h });
  await page.evaluate(() => { navTo('expense', document.getElementById('nav-expense')); expBatchEditId = null; expBatchInit(); openModal('modal-add-expense'); });
  await page.waitForTimeout(250);
  const geo = () => page.evaluate(() => {
    const m = document.querySelector('#modal-add-expense .modal').getBoundingClientRect();
    const s = document.querySelector('#modal-add-expense .expense-batch-scroll');
    const sr = s.getBoundingClientRect();
    const add = [...document.querySelectorAll('#modal-add-expense .modal-body > button')].find(b => b.textContent.includes('新增一列')).getBoundingClientRect();
    const foot = document.querySelector('#modal-add-expense .modal-footer').getBoundingClientRect();
    return { top: Math.round(m.top), bottom: Math.round(m.bottom), width: Math.round(m.width), scrollBottom: Math.round(sr.bottom), scrollTop: Math.round(sr.top), addBottom: Math.round(add.bottom), footTop: Math.round(foot.top), clientW: s.clientWidth, scrollW: s.scrollWidth, innerH: innerHeight, innerW: innerWidth, rows: document.querySelectorAll('#exp-batch-tbody tr').length };
  });
  const g6 = await geo();
  check('視窗在畫面內，寬度用到畫面 96%（手機全寬），不再限制 640', g6.top >= 0 && g6.bottom <= g6.innerH && g6.width >= Math.min(g6.innerW * 0.95, 1400) - 2, g6);
  check('表格框、新增一列、送出按鈕都在畫面內', g6.scrollBottom <= g6.addBottom && g6.addBottom <= g6.footTop && g6.footTop < g6.innerH, g6);
  await page.evaluate(() => { for (let i = 0; i < 20; i++) expBatchAddRow(false); });
  await page.evaluate(() => expBatchAddRow());
  await page.waitForTimeout(250);
  const g27 = await geo();
  check('新增到 27 列：視窗位置與高度完全不變（不再上下長）', g27.rows === 27 && g27.top === g6.top && g27.bottom === g6.bottom && g27.scrollBottom === g6.scrollBottom, { g6, g27 });
  const focused = await page.evaluate(() => { const a = document.activeElement; const tr = a?.closest('tr'); const s = document.querySelector('#modal-add-expense .expense-batch-scroll').getBoundingClientRect(); const r = tr?.getBoundingClientRect(); return { inLastRow: tr === document.querySelector('#exp-batch-tbody tr:last-child'), visible: !!r && r.top >= s.top - 1 && r.bottom <= s.bottom + 1 }; });
  check('按新增一列：游標在新的最後一列，且這列捲到看得到', focused.inLastRow && focused.visible, focused);
  if (g27.scrollW > g27.clientW) {
    const sticky = await page.evaluate(() => {
      const s = document.querySelector('#modal-add-expense .expense-batch-scroll');
      s.scrollTop = Math.round((s.scrollHeight - s.clientHeight) / 2); s.scrollLeft = s.scrollWidth;
      const sr = s.getBoundingClientRect();
      const th = document.querySelector('#modal-add-expense .expense-batch-table thead th:nth-child(5)').getBoundingClientRect();
      const row = document.querySelectorAll('#exp-batch-tbody tr')[12];
      const c1 = row.cells[0].getBoundingClientRect(), c2 = row.cells[1].getBoundingClientRect();
      return { headerAtTop: Math.abs(th.top - sr.top) <= 2, numLeft: Math.abs(c1.left - sr.left) <= 2, caseLeft: Math.abs(c2.left - c1.right) <= 2, hScrollBoxBottomVisible: s.scrollWidth > s.clientWidth && sr.bottom <= innerHeight, scrolledRight: s.scrollLeft > 0 };
    });
    check('捲到中間又往右捲：表頭固定在框頂、# 與歸屬個案固定在左邊、左右捲軸在框底且在畫面內', Object.values(sticky).every(Boolean), sticky);
  } else {
    check('畫面夠寬時整個表格不用左右捲', g27.scrollW <= g27.clientW + 1, g27);
  }
  await page.evaluate(() => closeModal('modal-add-expense'));
  await ctx.close();
}

const fails = await H.finish(outJson);
process.exit(fails ? 1 : 0);
