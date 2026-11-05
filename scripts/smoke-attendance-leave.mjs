// 請假與打卡串聯、依假別扣全勤 (claude/attendance-leave-link). Mock cloud only; never touches production.
// - 有請假的那天：實際在公司的時數（扣 12:00–13:00 午休）補足「8 小時 − 請假時數」就不算早退；晚到也不另外提醒。
// - 全勤：事假扣全額；家庭照顧假按時數比例（全額 / 30 / 8 × 時數）；彈性早退超過每月上限扣 1,000；合計不超過全額。
// - 家庭照顧假的工資比照事假不給。
//
// Setup (outside the repo):  mkdir /tmp/ops-smoke && cd /tmp/ops-smoke && npm i playwright-core
// Run:  PLAYWRIGHT_CORE=/tmp/ops-smoke/node_modules/playwright-core/index.mjs \
//         node scripts/smoke-attendance-leave.mjs <label> <rootDir> <port> <out.json>
import { createHarness } from './smoke-lib.mjs';

const [label, rootDir, portArg, outJson] = process.argv.slice(2);
const H = await createHarness({ label, rootDir, port: Number(portArg) });
const { check, newContext, openApp } = H;

H.setScenario('A-manage(shower)');
const ctx = await newContext('shower.li@yutesign.com', { fixedTime: new Date('2026-11-05T10:00:00+08:00') });
const page = await openApp(ctx);
page.on('dialog', d => d.accept());
const LU = 'lu_yanchen';

// 10 月每個上班日都 08:00–17:00 正常打卡，再依情境覆寫某幾天；請假與 10 月以前的薪資單全部清掉，全勤全額回到預設 1,000。
const setup = (days = {}, leaves = [], payroll = []) => page.evaluate(({ LU, days, leaves, payroll }) => {
  for (let i = ATTENDANCE_RECORDS.length - 1; i >= 0; i--) if (ATTENDANCE_RECORDS[i].person === LU) ATTENDANCE_RECORDS.splice(i, 1);
  for (let i = ATTENDANCE_LEAVES.length - 1; i >= 0; i--) if (ATTENDANCE_LEAVES[i].person === LU) ATTENDANCE_LEAVES.splice(i, 1);
  for (let i = PAYROLL.length - 1; i >= 0; i--) if (PAYROLL[i].person === LU) PAYROLL.splice(i, 1);
  for (let d = new Date(2026, 9, 1); d.getMonth() === 9; d.setDate(d.getDate() + 1)) {
    if (!pyIsGovernmentWorkday(d)) continue;
    const date = localDateKey(d);
    const t = days[date] || ['08:00', '17:00'];
    if (t === 'none') continue;
    ATTENDANCE_RECORDS.push({ id: attNextId++, person: LU, date, inTime: t[0], outTime: t[1], locationType: 'office', caseCode: '', caseName: '', source: 'gps', approvedBy: '', approvedAt: '', note: '', gpsPunches: [] });
  }
  leaves.forEach(l => ATTENDANCE_LEAVES.push({ id: attLeaveNextId++, person: LU, note: '', approvedBy: 'shower', ...l }));
  payroll.forEach(p => PAYROLL.push({ id: prNextId++, person: LU, ...p }));
}, { LU, days, leaves, payroll });
const draft = () => page.evaluate(LU => { const d = attComputeDraft(LU, '2026-10'); return { grace: d.graceUsed, base: d.fullAttendanceBase, penalty: d.fullAttendancePenalty, reasons: d.fullAttendanceReasons, leaveDeduction: d.leaveDeduction, hourly: d.hourly, warnings: d.warnings }; }, LU);

await setup();
const d0 = await draft();
check('全部正常打卡：沒有早退、不扣全勤，全勤全額預設 1,000', d0.grace === 0 && d0.penalty === 0 && d0.base === 1000 && !d0.warnings.length, d0);

// 彥辰 10/14 的實際情況：病假 3 小時，14:22 下班。
await setup({ '2026-10-14': ['08:15', '14:22'] }, [{ date: '2026-10-14', type: 'sick', hours: 3 }]);
const d1 = await draft();
check('病假 3 小時、14:22 下班：不算早退、不扣全勤（以前會算 163 分、扣 1,000）', d1.grace === 0 && d1.penalty === 0, d1);

await setup({ '2026-10-14': ['08:15', '14:22'] });
const d1b = await draft();
check('同一天沒有請假：仍照原規則算早退並扣全勤', d1b.grace === 163 && d1b.penalty === 1000, d1b);

await setup({ '2026-10-14': ['13:00', '17:05'] }, [{ date: '2026-10-14', type: 'sick', hours: 4 }]);
const d2 = await draft();
check('上午請病假 4 小時、13:00 才到：不算早退、不提醒晚到、不扣全勤', d2.grace === 0 && d2.penalty === 0 && !d2.warnings.some(w => w.includes('晚於')), d2);

await setup({ '2026-10-14': ['08:00', '14:30'] }, [{ date: '2026-10-14', type: 'sick', hours: 2 }]);
const d3 = await draft();
check('請 2 小時卻提早 30 分走：扣掉每日 10 分彈性，算 20 分早退（未超過每月 30 分，不扣全勤）', d3.grace === 20 && d3.penalty === 0, d3);

await setup({ '2026-10-14': ['13:00', '17:00'] }, [{ date: '2026-10-14', type: 'personal', hours: 4 }]);
const d4 = await draft();
check('事假 4 小時：全勤扣全額 1,000，工資扣 4 小時', d4.penalty === 1000 && d4.reasons.some(r => r.startsWith('事假')) && d4.leaveDeduction === Math.round(4 * d4.hourly), d4);

await setup({ '2026-10-14': ['13:00', '17:00'] }, [{ date: '2026-10-14', type: 'family', hours: 4 }]);
const d5 = await draft();
check('家庭照顧假 4 小時：全勤按比例扣 1,000/30/8×4 = 17，工資比照事假扣 4 小時', d5.penalty === 17 && d5.reasons.some(r => r.startsWith('家庭照顧假')) && d5.leaveDeduction === Math.round(4 * d5.hourly), d5);

await setup({ '2026-10-14': 'none' }, [{ date: '2026-10-14', type: 'family', hours: 8 }], [{ month: '2026-09', baseSalary: 38000, fullAttendanceBonus: 1990, fullAttendanceBonusBase: 2000 }]);
const d6 = await draft();
check('上個月草稿記下全勤全額 2,000：家庭照顧假 8 小時按比例扣 67', d6.base === 2000 && d6.penalty === 67, d6);

await setup({ '2026-10-14': ['13:00', '17:00'], '2026-10-15': ['08:00', '16:00'] }, [{ date: '2026-10-14', type: 'personal', hours: 4 }]);
const d7 = await draft();
check('事假加早退超過上限：全勤扣款不超過全額', d7.penalty === 1000 && d7.reasons.length === 2, d7);

// 寫入薪資草稿：全勤 = 全額 − 扣款，並記下全額；重寫一次不會重複扣。
await setup({ '2026-10-14': ['13:00', '17:00'] }, [{ date: '2026-10-14', type: 'family', hours: 4 }]);
await page.evaluate(() => { navTo('attendance', document.getElementById('nav-attendance')); });
await page.evaluate(LU => {
  const p = document.getElementById('att-filter-person'); if (![...p.options].some(o => o.value === LU)) { const o = document.createElement('option'); o.value = LU; p.appendChild(o); } p.value = LU;
  const m = document.getElementById('att-filter-month'); if (![...m.options].some(o => o.value === '2026-10')) { const o = document.createElement('option'); o.value = '2026-10'; m.appendChild(o); } m.value = '2026-10';
  attApplyDraftToPayroll(); attApplyDraftToPayroll();
}, LU);
const pay = await page.evaluate(LU => PAYROLL.find(r => r.person === LU && r.month === '2026-10'), LU);
check('寫入薪資草稿：全勤 983、記下全額 1,000，重寫兩次不重複扣，備註寫明原因', pay && pay.fullAttendanceBonus === 983 && pay.fullAttendanceBonusBase === 1000 && pay.leaveNote.includes('全勤扣 17（家庭照顧假 4 小時按比例 17）'), pay);

const ui = await page.evaluate(() => { renderAttendance(); return { option: [...document.querySelectorAll('#att-leave-type option')].some(o => o.value === 'family' && o.textContent === '家庭照顧假'), list: document.getElementById('att-leave-tbody')?.textContent || '', card: document.getElementById('att-draft')?.textContent || '' }; });
check('假別選單有「家庭照顧假」，請假紀錄與草稿卡片顯示中文和扣款原因', ui.option && ui.list.includes('家庭照顧假') && ui.card.includes('全勤全額 $1,000') && ui.card.includes('家庭照顧假 4 小時按比例 17'), ui);
await ctx.close();

const fails = await H.finish(outJson);
process.exit(fails ? 1 : 0);
