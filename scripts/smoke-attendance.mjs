// Attendance (出勤打卡) functional smoke test. Mock cloud only; never touches production.
//
// Setup (outside the repo):  mkdir /tmp/ops-smoke && cd /tmp/ops-smoke && npm i playwright-core
// Run:  PLAYWRIGHT_CORE=/tmp/ops-smoke/node_modules/playwright-core/index.mjs \
//         node scripts/smoke-attendance.mjs <label> <rootDir> <port> <out.json>
// The browser clock is frozen at 2026-10-06 14:00 Asia/Taipei and GPS is emulated, so two runs
// (e.g. main vs. a split branch) produce byte-comparable final cloud snapshots.
import { createHarness } from './smoke-lib.mjs';

const [label, rootDir, portArg, outJson] = process.argv.slice(2);
const H = await createHarness({ label, rootDir, port: Number(portArg) });
const { check, newContext, openApp, waitReady, waitSynced, lastToast, clearToasts, visible, nav, counts } = H;

const NOW = new Date('2026-10-06T14:00:00+08:00');
const OFFICE = { latitude: 25.046124, longitude: 121.584709 };
const NEAR = { latitude: OFFICE.latitude + 0.0003, longitude: OFFICE.longitude, accuracy: 15 }; // ~33 m
const FAR = { latitude: OFFICE.latitude + 0.05, longitude: OFFICE.longitude, accuracy: 15 };    // ~5.6 km

const gpsText = page => page.locator('#att-gps-text').innerText();
async function waitGps(page, re) {
  await page.waitForFunction(src => new RegExp(src).test(document.getElementById('att-gps-text')?.textContent || ''), re.source, { timeout: 10000 }).catch(() => {});
  return gpsText(page);
}
async function waitToast(page, text) {
  await page.waitForFunction(t => window.__toasts.includes(t), text, { timeout: 15000 }).catch(() => {});
  return page.evaluate(t => window.__toasts.includes(t), text);
}
const rowsText = page => page.locator('#att-record-tbody').innerText();
const leaveText = page => page.locator('#att-leave-tbody').innerText();

// ═══════════ A: attendance manager (shower) ═══════════
H.setScenario('A-manage(shower)');
let ctx = await newContext('shower.li@yutesign.com', { fixedTime: NOW, geolocation: NEAR });
let page = await openApp(ctx);
page.on('dialog', d => d.accept());
const before = await counts(page);
const people = await page.evaluate(() => attPeople());
const LU = 'lu_yanchen';
check('需打卡人員包含盧彥辰', people.some(p => p.id === LU), people);
const fnsMissing = await page.evaluate(() => ['attPeople','attGpsPunch','attAddRecord','attAddLeave','attApproveRecord','attComputeDraft','attApplyDraftToPayroll','renderAttendance','attFillMonthOptions'].filter(n => typeof window[n] !== 'function'));
check('出勤函式皆為全域函式', fnsMissing.length === 0, fnsMissing.join(','));

await nav(page, 'attendance');
check('出勤頁可進入', await page.evaluate(() => currentPage === 'attendance' && document.getElementById('page-attendance').classList.contains('active')));
const monthOpts = await page.$$eval('#att-filter-month option', os => os.map(o => o.value));
check('月份選單含本月且已選本月', monthOpts.includes('2026-10') && (await page.inputValue('#att-filter-month')) === '2026-10', monthOpts.slice(0, 6));
const personOpts = await page.$$eval('#att-filter-person option', os => os.map(o => o.value));
check('人員選單 = 需打卡人員、管理者可切換', JSON.stringify(personOpts) === JSON.stringify(people.map(p => p.id)) && !(await page.locator('#att-filter-person').isDisabled()));
await page.selectOption('#att-filter-person', LU);
await page.evaluate(() => renderAttendance());
const summary = await page.locator('#att-summary').innerText();
check('KPI：應出勤／實際出勤／請假／缺卡／加班試算／特休', ['應出勤', '實際出勤', '請假', '缺卡', '加班試算', '特休剩餘'].every(k => summary.includes(k)), summary.replace(/\s+/g, ' '));
check('特休：到職未滿6個月', summary.includes('未滿6個月'));
check('管理者看得到 GPS 校正按鈕與加班欄', await visible(page, '#att-gps-admin-actions') && await visible(page, '#att-rec-overtime-wrap'));

// GPS in range → punch in / out
let t = await waitGps(page, /範圍內/);
check('GPS：公司附近顯示在範圍內', /已在公司範圍內（\d+ 公尺）/.test(t), t);
check('GPS：範圍內打卡按鈕可按', !(await page.locator('#att-gps-in-btn').isDisabled()) && !(await page.locator('#att-gps-out-btn').isDisabled()));
await page.selectOption('#att-gps-person', LU);
await clearToasts(page);
await page.click('#att-gps-in-btn');
check('GPS 上班打卡：同步雲端', await waitToast(page, '上班打卡已同步雲端 ✓'));
let gpsRow = await page.evaluate(p => ATTENDANCE_RECORDS.filter(r => r.person === p && r.date === '2026-10-06' && r.source === 'gps'), LU);
check('GPS 上班打卡：建立當日 GPS 紀錄', gpsRow.length === 1 && gpsRow[0].inTime === '14:00' && gpsRow[0].gpsPunches?.length === 1 && gpsRow[0].gpsPunches[0].type === 'in', gpsRow.map(r => ({ in: r.inTime, punches: r.gpsPunches?.length, note: r.note })));
await page.click('#att-gps-out-btn');
check('GPS 下班打卡：同步雲端', await waitToast(page, '下班打卡已同步雲端 ✓'));
gpsRow = await page.evaluate(p => ATTENDANCE_RECORDS.filter(r => r.person === p && r.date === '2026-10-06' && r.source === 'gps'), LU);
check('GPS 下班打卡：同一筆加上下班、不重複建立', gpsRow.length === 1 && gpsRow[0].outTime === '14:00' && gpsRow[0].gpsPunches?.length === 2, gpsRow.map(r => ({ in: r.inTime, out: r.outTime, punches: r.gpsPunches?.length })));
check('GPS 紀錄出現在列表並標示 GPS', /2026-10-06[\s\S]*GPS/.test(await rowsText(page)));

// GPS out of range
await ctx.setGeolocation(FAR);
await page.evaluate(() => attGpsRetry());
t = await waitGps(page, /超出範圍/);
check('GPS：遠離公司顯示超出範圍、按鈕停用', /超出範圍/.test(t) && await page.locator('#att-gps-in-btn').isDisabled(), t);
await clearToasts(page);
await page.evaluate(() => attGpsPunch('in'));
check('GPS：範圍外直接呼叫打卡被拒且未寫入', /^距公司 \d+ 公尺$/.test(await lastToast(page)) && (await page.evaluate(p => ATTENDANCE_RECORDS.find(r => r.person === p && r.source === 'gps' && r.date === '2026-10-06').gpsPunches.length, LU)) === 2, await lastToast(page));

// site without coordinates, then site with coordinates (mock data fixture)
await ctx.setGeolocation(NEAR);
await page.evaluate(() => attGpsRetry());
await waitGps(page, /範圍內/);
const siteCase = await page.evaluate(() => CASES.find(c => c.status === '進行中')?.code);
await page.selectOption('#att-gps-location-type', 'site');
await page.selectOption('#att-gps-case', siteCase);
t = await waitGps(page, /工地|範圍/);
check('GPS：工地未設定座標時不能打卡', t === '請選擇已設定座標的工地' && await page.locator('#att-gps-in-btn').isDisabled(), t);
await page.evaluate(({ code, lat, lng }) => { const c = CASES.find(x => x.code === code); c.siteLat = lat; c.siteLng = lng; c.siteRadiusMeters = 100; attGpsRefresh(); }, { code: siteCase, lat: NEAR.latitude, lng: NEAR.longitude });
t = await gpsText(page);
check('GPS：工地有座標且在半徑內可打卡', /^已在.+範圍內（0 公尺）$/.test(t) && !(await page.locator('#att-gps-in-btn').isDisabled()), t);
await page.evaluate(code => { const c = CASES.find(x => x.code === code); delete c.siteLat; delete c.siteLng; delete c.siteRadiusMeters; }, siteCase);
await page.selectOption('#att-gps-location-type', 'office');

// permission denied
await ctx.clearPermissions();
await page.evaluate(() => attGpsRetry());
t = await waitGps(page, /權限/);
check('GPS：定位權限被拒顯示提示', t === '定位權限未開啟，請到手機瀏覽器設定允許位置存取' && await page.locator('#att-gps-in-btn').isDisabled(), t);
await ctx.grantPermissions(['geolocation']);
await page.evaluate(() => attGpsRetry());
await waitGps(page, /範圍內/);

// office calibration + reset
await clearToasts(page);
await page.evaluate(() => attGpsUseCurrentAsOffice());
let office = await page.evaluate(() => ({ lat: ATTENDANCE_SETTINGS.officeLat, lng: ATTENDANCE_SETTINGS.officeLng, audit: AUDIT_LOGS[0]?.reason }));
check('GPS：用目前位置校正公司座標並記錄審計', office.lat === Number(NEAR.latitude.toFixed(6)) && office.audit === '校正公司 GPS 打卡座標', office);
await page.evaluate(() => attGpsResetOfficeLocation());
office = await page.evaluate(() => ({ lat: ATTENDANCE_SETTINGS.officeLat, lng: ATTENDANCE_SETTINGS.officeLng, audit: AUDIT_LOGS[0]?.reason }));
check('GPS：還原預設公司座標', office.lat === OFFICE.latitude && office.lng === OFFICE.longitude && office.audit === '還原預設公司 GPS 打卡座標', office);

// manual record: validation, create (auto-approved for manager), overtime
await page.selectOption('#att-rec-person', LU);
await page.fill('#att-rec-date', '2026-10-05');
await page.fill('#att-rec-in', '');
await page.fill('#att-rec-out', '');
await clearToasts(page);
await page.click('#att-rec-save-btn');
check('補登：未填時間被拒', (await lastToast(page)) === '請至少填寫上班或下班時間');
await page.fill('#att-rec-date', '2026-10-06');
await page.fill('#att-rec-in', '08:00');
await page.fill('#att-rec-out', '15:00');
await page.click('#att-rec-save-btn');
check('補登：今天下班時間晚於現在被拒', (await lastToast(page)) === '下班時間不可晚於目前時間；尚未下班請保持空白');
await page.fill('#att-rec-date', '2026-10-05');
await page.fill('#att-rec-in', '08:00');
await page.fill('#att-rec-out', '19:00');
await page.fill('#att-rec-note', 'QA補登');
await page.click('#att-rec-save-btn');
const manual = await page.evaluate(p => { const r = ATTENDANCE_RECORDS.find(x => x.person === p && x.date === '2026-10-05' && x.source === 'manual'); return r && { id: r.id, in: r.inTime, out: r.outTime, approvedBy: r.approvedBy, status: attRecordStatus(r), ot: attRecordOvertimeMinutes(r) }; }, LU);
check('補登：管理者新增自動核准', manual && manual.approvedBy === '李鎮宇' && manual.status === '已核准' && (await lastToast(page)) === '出勤紀錄已儲存 ✓', manual);
check('加班試算：08:00–19:00 = 120 分鐘', manual?.ot === 120, manual?.ot);
check('列表顯示加班 2 小時', /2026-10-05[\s\S]*加班 2 小時/.test(await rowsText(page)));

// edit record with manual overtime override
await page.evaluate(id => attEditRecord(id), manual.id);
check('編輯：載入紀錄、按鈕改為更新', (await page.inputValue('#att-rec-out')) === '19:00' && (await page.locator('#att-rec-save-btn').innerText()) === '更新打卡紀錄' && await visible(page, '#att-rec-cancel-btn'));
await page.fill('#att-rec-out', '18:00');
await page.fill('#att-rec-overtime', '1.5');
await page.click('#att-rec-save-btn');
const editedRec = await page.evaluate(id => { const r = ATTENDANCE_RECORDS.find(x => x.id === id); return { out: r.outTime, override: r.overtimeHoursOverride, ot: attRecordOvertimeMinutes(r), audit: AUDIT_LOGS[0]?.reason, edit: attEditRecordId }; }, manual.id);
check('編輯：更新下班時間與手動加班 1.5 小時、寫審計', editedRec.out === '18:00' && editedRec.override === 1.5 && editedRec.ot === 90 && editedRec.audit === '出勤紀錄人工修正' && editedRec.edit === null, editedRec);
check('列表顯示手動加班', /加班 1\.5 小時（手動）/.test(await rowsText(page)));

// leaves
await page.selectOption('#att-leave-person', LU);
await page.fill('#att-leave-date', '2026-10-02');
await page.fill('#att-leave-hours', '0');
await page.click('#att-leave-save-btn');
check('請假：時數 0 被拒', (await lastToast(page)) === '請填寫請假人員、日期與時數');
await page.fill('#att-leave-hours', '4');
await page.selectOption('#att-leave-type', 'personal');
await page.fill('#att-leave-note', 'QA事假');
await page.click('#att-leave-save-btn');
const leave = await page.evaluate(p => ATTENDANCE_LEAVES.find(r => r.person === p && r.date === '2026-10-02'), LU);
check('請假：新增事假 4 小時（管理者自動核准）', leave?.type === 'personal' && leave.hours === 4 && leave.approvedBy === '李鎮宇' && /事假/.test(await leaveText(page)), leave && { id: leave.id, type: leave.type });
await page.evaluate(id => attEditLeave(id), leave.id);
await page.selectOption('#att-leave-type', 'sick');
await page.click('#att-leave-save-btn');
check('請假：修改為病假、寫審計', (await page.evaluate(id => ATTENDANCE_LEAVES.find(r => r.id === id)?.type, leave.id)) === 'sick' && (await page.evaluate(() => AUDIT_LOGS[0]?.reason)) === '修改請假假別／時數／備註' && /病假/.test(await leaveText(page)));
await page.fill('#att-leave-date', '2026-10-01');
await page.fill('#att-leave-hours', '8');
await page.selectOption('#att-leave-type', 'personal');
await page.click('#att-leave-save-btn');
const tmpLeave = await page.evaluate(p => ATTENDANCE_LEAVES.find(r => r.person === p && r.date === '2026-10-01')?.id, LU);
await page.evaluate(id => attDeleteLeave(id), tmpLeave);
check('請假：刪除', !(await page.evaluate(id => ATTENDANCE_LEAVES.some(r => r.id === id), tmpLeave)));

// draft
const draft = await page.evaluate(p => { const d = attComputeDraft(p, '2026-10'); return { hourly: d.hourly, leaveHours: d.leaveHours, leaveDeduction: d.leaveDeduction, overtimeHours: d.overtimeHours, overtimePay: d.overtimePay, missing: d.missingPunches, expected: d.expectedWorkdays, days: d.attendanceDays, penalty: d.fullAttendancePenalty, warnings: d.warnings }; }, LU);
check('薪資試算：病假 4 小時半薪扣款', draft.leaveHours === 4 && draft.leaveDeduction === Math.round(4 * draft.hourly * 0.5), draft);
check('薪資試算：加班 1.5 小時 × 4/3', draft.overtimeHours === 1.5 && draft.overtimePay === Math.round(1.5 * draft.hourly * 4 / 3), { ot: draft.overtimeHours, pay: draft.overtimePay });
check('薪資試算：應出勤／缺卡／警示', draft.expected > 0 && draft.days === 2 && draft.missing === draft.warnings.filter(w => /缺卡|未打卡/.test(w)).length, { expected: draft.expected, days: draft.days, missing: draft.missing, warnings: draft.warnings });
const draftText = await page.locator('#att-draft').innerText();
check('薪資試算區塊顯示扣款與加班', draftText.includes('請假扣款') && draftText.includes(`加班試算：1.5 小時`));
await page.waitForTimeout(1200);
await waitSynced(page);
await ctx.close();

// ═══════════ B: self-service employee (lu_yanchen, attendance view_self) ═══════════
H.setScenario('B-self(lu_yanchen)');
ctx = await newContext('lu@yutesign.com', { fixedTime: NOW, geolocation: NEAR });
page = await openApp(ctx);
page.on('dialog', d => d.accept());
await nav(page, 'attendance');
check('本人：權限為 view_self', (await page.evaluate(() => permissionLevel('attendance'))) === 'view_self');
check('本人：人員選單鎖定本人', (await page.inputValue('#att-filter-person')) === LU && await page.locator('#att-filter-person').isDisabled() && await page.locator('#att-rec-person').isDisabled());
check('本人：隱藏 GPS 校正與手動加班欄', !(await visible(page, '#att-gps-admin-actions')) && !(await visible(page, '#att-rec-overtime-wrap')));
check('本人：看得到管理者幫他建立的紀錄', /2026-10-05/.test(await rowsText(page)) && /2026-10-06/.test(await rowsText(page)));
check('本人：列表沒有編輯／刪除', !/編輯|刪除/.test(await rowsText(page)) && !/編輯|刪除/.test(await leaveText(page)));
await page.fill('#att-rec-date', '2026-10-02');
await page.fill('#att-rec-in', '08:30');
await page.fill('#att-rec-out', '17:30');
await page.fill('#att-rec-note', 'QA本人補登');
await page.click('#att-rec-save-btn');
const selfRec = await page.evaluate(() => { const r = ATTENDANCE_RECORDS.find(x => x.person === 'lu_yanchen' && x.date === '2026-10-02' && x.source === 'manual'); return r && { id: r.id, approvedBy: r.approvedBy, status: attRecordStatus(r) }; });
check('本人：補登為待核准', selfRec?.approvedBy === '' && selfRec.status === '補登待核' && /補登待核/.test(await rowsText(page)), selfRec);
await page.fill('#att-leave-date', '2026-10-07');
await page.fill('#att-leave-hours', '8');
await page.selectOption('#att-leave-type', 'personal');
await page.click('#att-leave-save-btn');
check('本人：可請假（未核准）', (await page.evaluate(() => ATTENDANCE_LEAVES.find(r => r.person === 'lu_yanchen' && r.date === '2026-10-07')?.approvedBy)) === '');
await clearToasts(page);
await page.evaluate(id => attEditRecord(id), selfRec.id);
const t1 = await lastToast(page);
await page.evaluate(id => attDeleteRecord(id), selfRec.id);
const t2 = await lastToast(page);
await page.evaluate(id => attApproveRecord(id), selfRec.id);
const t3 = await lastToast(page);
await page.evaluate(() => attApplyDraftToPayroll());
const t4 = await lastToast(page);
await page.evaluate(() => attGpsUseCurrentAsOffice());
const t5 = await lastToast(page);
check('本人：編輯／刪除／核准／寫薪資草稿／校正座標都被拒', t1 === '只有出勤管理者可編輯' && t2 === '只有出勤管理者可刪除' && t3 === '只有出勤管理者可核准補登' && t4 === '只有出勤管理者可以寫入薪資草稿' && t5 === '只有出勤管理者可校正公司座標', [t1, t2, t3, t4, t5]);
check('本人：被拒操作沒有改資料', (await page.evaluate(id => ATTENDANCE_RECORDS.find(r => r.id === id)?.approvedBy, selfRec.id)) === '');
await page.waitForTimeout(1200);
await waitSynced(page);
await ctx.close();

// ═══════════ C: no attendance access (peng) ═══════════
H.setScenario('C-none(peng)');
ctx = await newContext('peng@yutesign.com', { fixedTime: NOW, geolocation: NEAR });
page = await openApp(ctx);
check('無權限：權限為 none、側欄隱藏', (await page.evaluate(() => permissionLevel('attendance'))) === 'none' && !(await visible(page, '#nav-attendance')));
await clearToasts(page);
await page.evaluate(() => navTo('attendance'));
check('無權限：進入出勤頁被拒', (await lastToast(page)) === '您沒有此功能的權限' && (await page.evaluate(() => currentPage)) !== 'attendance');
const nBefore = await page.evaluate(() => ATTENDANCE_RECORDS.length);
await page.evaluate(() => attGpsPunch('in'));
const n1 = await lastToast(page);
await page.evaluate(() => attAddRecord());
const n2 = await lastToast(page);
await page.evaluate(() => attAddLeave());
const n3 = await lastToast(page);
check('無權限：打卡／補登／請假都被拒且未寫入', [n1, n2, n3].every(x => x === '您沒有出勤功能權限') && (await page.evaluate(() => ATTENDANCE_RECORDS.length)) === nBefore, [n1, n2, n3]);
await ctx.close();

// ═══════════ D: manager approves, writes payroll draft, deletes; persistence ═══════════
H.setScenario('D-approve+payroll(shower)');
ctx = await newContext('shower.li@yutesign.com', { fixedTime: NOW, geolocation: NEAR });
page = await openApp(ctx);
page.on('dialog', d => d.accept());
await nav(page, 'attendance');
await page.selectOption('#att-filter-person', LU);
await page.evaluate(() => renderAttendance());
check('管理者看到本人補登待核與核准鈕', /補登待核[\s\S]*核准/.test(await rowsText(page)));
// a same-day GPS row with a missing out-punch, to be merged on approval
await page.evaluate(() => { ATTENDANCE_RECORDS.unshift({ id: attNextId++, person: 'lu_yanchen', date: '2026-10-02', inTime: '08:20', outTime: '', locationType: 'office', caseCode: '', caseName: '', source: 'gps', approvedBy: '', approvedAt: '', note: 'QA缺卡', gpsPunches: [], createdAt: new Date().toISOString(), createdBy: '盧彥辰', companyId: COMPANY_ID }); });
await page.evaluate(id => attApproveRecord(id), selfRec.id);
const approved = await page.evaluate(() => ATTENDANCE_RECORDS.filter(r => r.person === 'lu_yanchen' && r.date === '2026-10-02').map(r => ({ id: r.id, in: r.inTime, out: r.outTime, by: r.approvedBy, status: attRecordStatus(r) })));
check('核准：同日紀錄合併為一筆、取最早上班與最晚下班', approved.length === 1 && approved[0].id === selfRec.id && approved[0].in === '08:20' && approved[0].out === '17:30' && approved[0].status === '已核准' && (await lastToast(page)) === '補登已核准，同日缺卡紀錄已合併 ✓', approved);
const payBefore = await page.evaluate(() => PAYROLL.find(r => r.person === 'lu_yanchen' && r.month === '2026-10') || null);
const draftD = await page.evaluate(() => attComputeDraft('lu_yanchen', '2026-10'));
await page.evaluate(() => attApplyDraftToPayroll());
const pay = await page.evaluate(() => PAYROLL.find(r => r.person === 'lu_yanchen' && r.month === '2026-10'));
check('寫入薪資草稿：請假扣款／加班費／備註', pay && pay.leaveDeduction === draftD.leaveDeduction && pay.overtimePay === draftD.overtimePay && pay.note.startsWith('由出勤管理 2026-10 草稿寫入') && (await lastToast(page)) === '薪資草稿已寫入薪資管理 ✓', { existedBefore: !!payBefore, leaveDeduction: pay?.leaveDeduction, overtimePay: pay?.overtimePay });
check('寫入薪資草稿：月份加入薪資月份清單', await page.evaluate(() => PAYROLL_MONTHS.includes('2026-10')));
const gpsId = await page.evaluate(() => ATTENDANCE_RECORDS.find(r => r.person === 'lu_yanchen' && r.date === '2026-10-06' && r.source === 'gps').id);
await page.evaluate(id => attDeleteRecord(id), gpsId);
check('刪除出勤紀錄並寫審計', !(await page.evaluate(id => ATTENDANCE_RECORDS.some(r => r.id === id), gpsId)) && (await page.evaluate(() => AUDIT_LOGS[0]?.action + '/' + AUDIT_LOGS[0]?.targetType)) === 'delete/attendanceRecord');
await page.waitForTimeout(1200);
await waitSynced(page);
const afterD = await counts(page);
// Firebase RTDB drops null values and empty arrays/objects, so compare both sides after the same pruning.
const snapState = () => page.evaluate(() => {
  const prune = v => { if (v === null || v === undefined) return undefined; if (Array.isArray(v)) { const o = v.map(prune); return o.every(x => x === undefined) ? undefined : o.map(x => x === undefined ? null : x); } if (typeof v === 'object') { const o = {}; for (const [k, c] of Object.entries(v)) { const pc = prune(c); if (pc !== undefined) o[k] = pc; } return Object.keys(o).length ? o : undefined; } return v; };
  return JSON.stringify(prune({ r: ATTENDANCE_RECORDS, l: ATTENDANCE_LEAVES, p: PAYROLL.filter(x => x.person === 'lu_yanchen'), s: ATTENDANCE_SETTINGS }));
});
const stateBeforeReload = await snapState();
await page.reload({ waitUntil: 'load' });
await waitReady(page);
const stateAfterReload = await snapState();
if (stateAfterReload !== stateBeforeReload) { const a = JSON.parse(stateBeforeReload), b = JSON.parse(stateAfterReload); const diffs = []; const walk = (x, y, path) => { if (JSON.stringify(x) === JSON.stringify(y)) return; if (x && y && typeof x === 'object' && typeof y === 'object') { new Set([...Object.keys(x), ...Object.keys(y)]).forEach(k => walk(x[k], y[k], path + '.' + k)); } else diffs.push(`${path}: ${JSON.stringify(x)} → ${JSON.stringify(y)}`); }; walk(a, b, ''); console.log('DIFF', diffs.slice(0, 20).join('\n')); }
check('重新載入後出勤／請假／薪資草稿／設定都一樣（依 Firebase 規則略過空值）', stateAfterReload === stateBeforeReload);
await ctx.close();
ctx = await newContext('shower.li@yutesign.com', { fixedTime: NOW });
page = await openApp(ctx);
check('全新瀏覽器（只讀雲端）資料一樣（依 Firebase 規則略過空值）', (await snapState()) === stateBeforeReload);
const fresh = await counts(page);
check('其他集合筆數不變（案件／應付／應收／費用／客戶／廠商）', ['CASES', 'PAYABLES', 'RECEIVABLES', 'EXPENSES', 'CLIENTS', 'VENDORS'].every(k => fresh[k] === before[k] && afterD[k] === before[k]), { before, fresh });
await ctx.close();

// Final mock-cloud data, for byte comparison between two runs.
const finalData = JSON.parse(JSON.stringify(H.state.cloud?.data || {}));
const fails = await H.finish(outJson, { finalCloudData: finalData });
process.exit(fails ? 1 : 0);
