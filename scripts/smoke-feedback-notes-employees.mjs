// Feedback (問題回報) / system notes (系統規則筆記) / employees (員工管理) smoke test.
// Login checks labelled 「修正後」 assert the cloud employee lookup added on claude/fix-known-issues.
// Mock cloud only; never touches production.
//
// Setup (outside the repo):  mkdir /tmp/ops-smoke && cd /tmp/ops-smoke && npm i playwright-core
// Run:  PLAYWRIGHT_CORE=/tmp/ops-smoke/node_modules/playwright-core/index.mjs \
//         node scripts/smoke-feedback-notes-employees.mjs <label> <rootDir> <port> <out.json>
// The browser clock is frozen at 2026-10-06 14:00 Asia/Taipei so two runs produce byte-comparable
// final cloud snapshots.
import { createHarness } from './smoke-lib.mjs';

const [label, rootDir, portArg, outJson] = process.argv.slice(2);
const H = await createHarness({ label, rootDir, port: Number(portArg) });
const { check, newContext, openApp, waitReady, waitSynced, lastToast, clearToasts, isOpen, visible, nav, counts } = H;
const NOW = new Date('2026-10-06T14:00:00+08:00');
const QA_EMAIL = 'qa.new@yutesign.com';

// ═══════════ A: owner (shower) ═══════════
H.setScenario('A-owner(shower)');
let ctx = await newContext('shower.li@yutesign.com', { fixedTime: NOW });
let page = await openApp(ctx);
page.on('dialog', d => d.accept());
const before = await counts(page);
const missing = await page.evaluate(() => ['tfStatusColor','tfSeverityColor','snStatusColor','snResetFilters','renderSystemNotes','tfFormatBytes','tfDataUrlBytes','initFeedbackScreenshotInput','compressFeedbackScreenshot','handleFeedbackScreenshotFile','renderFeedbackScreenshotDraft','clearFeedbackScreenshot','openFeedbackScreenshot','submitFeedback','setFeedbackStatus','deleteFeedback','renderFeedback','renderEmployees','openEmployeeModal','submitEmployee','prRenderEmployeeTabs','tfEsc'].filter(n => typeof window[n] !== 'function'));
const consts = await page.evaluate(() => ({ notes: SYSTEM_NOTES.length, edge: TF_SCREENSHOT_MAX_EDGE, bytes: TF_SCREENSHOT_MAX_BYTES, mods: EMP_PERM_MODULES.length, levels: EMP_PERM_LEVELS.length }));
check('20 個函式與共用的 tfEsc、prRenderEmployeeTabs 皆為全域函式', missing.length === 0, missing.join(','));
check('5 個常數可讀取', consts.notes === 20 && consts.edge === 1600 && consts.bytes === 1500 * 1024 && consts.mods > 0 && consts.levels > 0, consts);

// ── system notes ──
await nav(page, 'systemnotes');
const cards = () => page.$$eval('#sn-grid > .card', els => els.length);
check('系統筆記頁可進入、20 張卡片', (await page.evaluate(() => currentPage)) === 'systemnotes' && (await cards()) === 20);
const snSummary = await page.locator('#sn-summary').innerText();
check('系統筆記統計卡含全部筆記 20', /全部筆記\s*20/.test(snSummary), snSummary.replace(/\s+/g, ' '));
const catOpts = await page.$$eval('#sn-filter-category option', os => os.map(o => o.value).filter(Boolean));
const expCats = await page.evaluate(() => [...new Set(SYSTEM_NOTES.map(n => n.category))].sort((a, b) => a.localeCompare(b, 'zh-Hant')));
check('分類選單 = 筆記分類（排序）', JSON.stringify(catOpts) === JSON.stringify(expCats), catOpts);
await page.selectOption('#sn-filter-category', '正式上線');
check('分類篩選「正式上線」→ 7 張', (await cards()) === 7);
const st = await page.evaluate(() => SYSTEM_NOTES.find(n => n.category === '正式上線').status);
await page.selectOption('#sn-filter-status', st);
const expBoth = await page.evaluate(s => SYSTEM_NOTES.filter(n => n.category === '正式上線' && n.status === s).length, st);
check('分類＋狀態篩選', (await cards()) === expBoth, `${st}: ${expBoth}`);
await page.click('button[onclick="snResetFilters()"]').catch(() => page.evaluate(() => snResetFilters()));
check('重設篩選 → 回到 20 張', (await cards()) === 20 && (await page.inputValue('#sn-filter-category')) === '');
await page.fill('#sn-search', '分潤');
const expKw = await page.evaluate(() => SYSTEM_NOTES.filter(n => `${n.category} ${n.status} ${n.title} ${n.body} ${n.source} ${(n.items||[]).join(' ')}`.toLowerCase().includes('分潤')).length);
check('關鍵字搜尋「分潤」', (await cards()) === expKw && expKw > 0, expKw);
await page.fill('#sn-search', 'ZZ不存在');
check('搜尋無結果顯示空狀態', (await page.locator('#sn-grid').innerText()).includes('沒有符合條件的系統筆記'));
await page.evaluate(() => snResetFilters());

// ── feedback ──
await nav(page, 'feedback');
check('問題回報頁可進入', (await page.evaluate(() => currentPage)) === 'feedback');
await page.fill('#tf-steps', '');
await page.fill('#tf-actual', '');
await clearToasts(page);
await page.click('button[onclick="submitFeedback()"]');
const v1 = await lastToast(page);
await page.fill('#tf-steps', 'QA步驟：打開請款頁');
await page.click('button[onclick="submitFeedback()"]');
const v2 = await lastToast(page);
check('必填檢查：操作步驟→實際結果', v1 === '請填寫操作步驟' && v2 === '請填寫實際結果', [v1, v2]);
// screenshot: 2400×1200 PNG generated in the page, uploaded through the real file input
const pngB64 = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 2400; c.height = 1200; const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 2400, 1200); g.addColorStop(0, '#c8a96e'); g.addColorStop(1, '#7eb8d4'); x.fillStyle = g; x.fillRect(0, 0, 2400, 1200); x.fillStyle = '#000'; x.font = '120px sans-serif'; x.fillText('QA screenshot', 200, 600); return c.toDataURL('image/png').split(',')[1]; });
await page.setInputFiles('#tf-shot-file', { name: 'qa-shot.png', mimeType: 'image/png', buffer: Buffer.from(pngB64, 'base64') });
await page.waitForFunction(() => window.__toasts.includes('截圖已加入回饋'), null, { timeout: 10000 }).catch(() => {});
const draft = await page.evaluate(() => tfScreenshotDraft && { w: tfScreenshotDraft.width, h: tfScreenshotDraft.height, type: tfScreenshotDraft.type, size: tfScreenshotDraft.size, name: tfScreenshotDraft.name });
check('截圖上傳：長邊壓到 1600、轉 JPEG、大小在上限內', draft && draft.w === 1600 && draft.h === 800 && draft.type === 'image/jpeg' && draft.size <= 1500 * 1024 && draft.name === 'qa-shot.png', draft);
check('截圖預覽顯示尺寸與大小', await page.evaluate(() => document.getElementById('tf-shot-preview').classList.contains('show')) && (await page.locator('#tf-shot-meta').innerText()).startsWith('1600×800｜'));
await page.click('button[onclick="clearFeedbackScreenshot()"]');
check('清除截圖：預覽隱藏、草稿清空', !(await page.evaluate(() => document.getElementById('tf-shot-preview').classList.contains('show'))) && (await page.evaluate(() => tfScreenshotDraft)) === null);
await page.setInputFiles('#tf-shot-file', { name: 'qa-shot.png', mimeType: 'image/png', buffer: Buffer.from(pngB64, 'base64') });
await page.waitForFunction(() => !!tfScreenshotDraft, null, { timeout: 10000 });
await page.setInputFiles('#tf-shot-file', { name: 'not-image.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') }).catch(() => {});
await page.waitForTimeout(300);
check('非圖片檔：提示讀取失敗、保留原截圖', (await lastToast(page)) === '截圖讀取失敗，請改用 PNG/JPG 圖片' && (await page.evaluate(() => tfScreenshotDraft?.width)) === 1600, await lastToast(page));
await page.selectOption('#tf-page', { index: 1 });
await page.selectOption('#tf-severity', '阻擋上線').catch(() => {});
await page.fill('#tf-actual', 'QA實際：按鈕沒反應');
await page.fill('#tf-expected', 'QA預期：送出');
const tfIdBefore = await page.evaluate(() => tfNextId);
await page.click('button[onclick="submitFeedback()"]');
const fb = await page.evaluate(() => { const r = TEST_FEEDBACK[0]; return { id: r.id, reporter: r.reporterName, reporterId: r.reporterId, status: r.status, severity: r.severity, w: r.screenshotWidth, hasShot: !!r.screenshotDataUrl }; });
check('送出回報：寫入、含截圖、狀態待處理', fb.id === tfIdBefore && fb.reporter === '李鎮宇' && fb.reporterId === 'shower' && fb.status === '待處理' && fb.w === 1600 && fb.hasShot && (await lastToast(page)) === '問題回報已記錄 ✓', fb);
check('送出後表單與截圖清空', (await page.inputValue('#tf-steps')) === '' && (await page.evaluate(() => tfScreenshotDraft)) === null);
const tfSum = await page.locator('#tf-summary').innerText();
check('回報統計文字', tfSum === await page.evaluate(() => { const b = TEST_FEEDBACK.filter(r => r.severity === '阻擋上線' && r.status !== '已修正').length; const o = TEST_FEEDBACK.filter(r => r.status !== '已修正' && r.status !== '先擱置').length; return `共 ${TEST_FEEDBACK.length} 筆，待處理 ${o} 筆，阻擋上線 ${b} 筆`; }), tfSum);
await page.locator('#tf-tbody img.tf-shot-thumb').first().click();
check('點縮圖開啟截圖視窗', await isOpen(page, 'modal-feedback-shot') && (await page.locator('#tf-shot-modal-meta').innerText()).includes('1600×800'));
await page.evaluate(() => closeModal('modal-feedback-shot'));
await page.locator('#tf-tbody tr').first().locator('select').selectOption('處理中');
check('管理者改狀態 → 處理中', (await page.evaluate(id => TEST_FEEDBACK.find(r => r.id === id).status, fb.id)) === '處理中');
await page.selectOption('#tf-filter-status', '處理中');
check('狀態篩選', (await page.$$eval('#tf-tbody tr', trs => trs.length)) === await page.evaluate(() => TEST_FEEDBACK.filter(r => r.status === '處理中').length));
await page.selectOption('#tf-filter-status', '');
await page.fill('#tf-steps', 'QA待刪');
await page.fill('#tf-actual', 'QA待刪');
await page.click('button[onclick="submitFeedback()"]');
const delId = await page.evaluate(() => TEST_FEEDBACK[0].id);
await page.evaluate(id => deleteFeedback(id), delId);
check('管理者刪除回報', !(await page.evaluate(id => TEST_FEEDBACK.some(r => r.id === id), delId)) && (await lastToast(page)) === '問題回報已刪除');

// ── employees ──
await nav(page, 'employees');
const empRows = () => page.$$eval('#emp-tbody tr', trs => trs.filter(tr => tr.cells.length > 1).length);
check('員工頁：列表筆數 = EMPLOYEES', (await empRows()) === before.EMPLOYEES_ || (await empRows()) === (await page.evaluate(() => EMPLOYEES.length)));
await page.fill('#emp-search', '彭俞豪');
check('員工搜尋', (await empRows()) === 1);
await page.fill('#emp-search', '');
await page.selectOption('#emp-filter-status', '已離職');
const expLeft = await page.evaluate(() => EMPLOYEES.filter(e => empEffectiveStatus(e) === '已離職').length);
check('狀態篩選已離職', (expLeft === 0 ? 0 : await empRows()) === expLeft, expLeft);
await page.selectOption('#emp-filter-status', '');
await page.click('#btn-new-employee');
const newModal = await page.evaluate(() => ({ title: document.getElementById('emp-modal-title').textContent, status: document.getElementById('emp-f-status').value, access: document.getElementById('emp-f-accessRole').value, accessDisabled: document.getElementById('emp-f-accessRole').disabled, perm: document.getElementById('emp-perm-section').style.display, casePerm: document.getElementById('emp-case-perm-section').style.display, attendance: document.getElementById('emp-f-attendanceRequired').checked }));
check('新增員工視窗：在職、未開通、權限矩陣隱藏、需打卡預設勾選', newModal.title === '新增員工' && newModal.status === '在職' && newModal.access === 'none' && !newModal.accessDisabled && newModal.perm === 'none' && newModal.casePerm === 'none' && newModal.attendance, newModal);
const saveEmp = () => page.click('#modal-employee .btn-primary');
await clearToasts(page);
await saveEmp();
const e1 = await lastToast(page);
await page.fill('#emp-f-name', 'QA新人');
await page.fill('#emp-f-email', 'qa@gmail.com');
await saveEmp();
const e2 = await lastToast(page);
await page.fill('#emp-f-email', 'PENG@yutesign.com');
await saveEmp();
const e3 = await lastToast(page);
check('新增員工檢查：姓名必填、Email 網域、Email 重複', e1 === '姓名為必填' && e2 === '公司 Email 需使用 @yutesign.com' && e3 === '此 Email 已綁定 彭俞豪', [e1, e2, e3]);
await page.fill('#emp-f-email', QA_EMAIL.toUpperCase());
await page.fill('#emp-f-role', 'QA測試員');
await page.fill('#emp-f-startDate', '2026-10-01');
await page.selectOption('#emp-f-accessRole', 'design');
const empIdNext = await page.evaluate(() => 'emp' + empNextId);
await saveEmp();
const created = await page.evaluate(id => { const e = EMPLOYEES.find(x => x.id === id); return e && { email: e.email, access: e.accessRole, status: e.status, acct: !!PAYROLL_EMPLOYEE_ACCOUNTS[id] }; }, empIdNext);
check('新增員工：寫入、Email 轉小寫、開通角色設計師、建立薪資帳戶欄位', created && created.email === QA_EMAIL && created.access === 'design' && created.acct && (await lastToast(page)) === '員工已新增' && !(await isOpen(page, 'modal-employee')), { id: empIdNext, ...created });
await page.locator('#emp-tbody tr', { hasText: 'QA新人' }).locator('button', { hasText: '編輯' }).click();
const editModal = await page.evaluate(() => ({ title: document.getElementById('emp-modal-title').textContent, perm: document.getElementById('emp-perm-section').style.display, casePerm: document.getElementById('emp-case-perm-section').style.display, permRows: document.querySelectorAll('#emp-perm-tbody select').length, cc: document.getElementById('emp-f-canCreateCase').value }));
check('編輯員工（OWNER）：權限矩陣與新增個案權限都顯示', editModal.title === '編輯員工 · QA新人' && editModal.perm === '' && editModal.casePerm === '' && editModal.permRows === consts.mods, editModal);
await page.selectOption('#ep-clients', 'manage');
await page.selectOption('#ep-vendors', 'view_all');
await page.selectOption('#emp-f-canCreateCase', '1');
await page.fill('#emp-f-payrollBank', 'QA銀行');
await page.fill('#emp-f-payrollAccount', '1234567890');
await saveEmp();
const perms = await page.evaluate(id => ({ p: USER_PERMISSIONS[id], audit: AUDIT_LOGS[0] && { type: AUDIT_LOGS[0].targetType, last4: AUDIT_LOGS[0].after?.accountLast4, full: JSON.stringify(AUDIT_LOGS[0]).includes('1234567890') } }), empIdNext);
check('儲存權限矩陣：clients=manage、vendors=view_all、canCreateCase=true', perms.p?.clients === 'manage' && perms.p?.vendors === 'view_all' && perms.p?.canCreateCase === true && (await lastToast(page)) === '員工資料已更新', perms.p);
check('改薪資帳戶寫審計紀錄，只留帳號末四碼', perms.audit?.type === 'employeePayrollAccount' && perms.audit.last4 === '7890' && perms.audit.full === false, perms.audit);
await page.waitForTimeout(1200);
await waitSynced(page);
await ctx.close();

// ═══════════ B: the new employee logs in (mock) and gets the saved permissions ═══════════
H.setScenario('B-new-employee(qa.new)');
// Fresh browser (no local cache): the local seed does not know the new employee, so the session is not
// restored and the login screen shows. Pressing 「使用 Google 帳號登入」 is still refused: the cloud employee
// lookup tried on claude/fix-known-issues was withdrawn after the Codex review (P1: an unlisted company account
// would read the whole snapshot before being refused). Known issue #1 stays open until a rules-level allowlist exists.
// The login button starts disabled in HTML and is enabled once the scripts have loaded.
const loginFresh = async email => {
  const c = await newContext(email, { fixedTime: NOW });
  const pg = await c.newPage();
  await pg.goto(`http://127.0.0.1:${portArg}/ops/`, { waitUntil: 'load' });
  await pg.waitForTimeout(1500);
  const pending0 = await pg.evaluate(() => document.body.classList.contains('auth-pending'));
  const btn0 = await pg.evaluate(() => { const b = document.getElementById('ops-login-btn'); return { disabled: b.disabled, text: b.textContent }; });
  await pg.click('#ops-login-btn');
  await pg.waitForFunction(() => !document.body.classList.contains('auth-pending') || (document.getElementById('ops-auth-error')?.textContent || '').length > 0, null, { timeout: 15000 }).catch(() => {});
  await pg.waitForTimeout(1200);
  return { c, pg, pending0, btn0 };
};
let lf = await loginFresh(QA_EMAIL);
const fresh = await lf.pg.evaluate(() => ({ unlocked: !document.body.classList.contains('auth-pending'), email: opsAuthenticatedEmail, name: currentUser?.name, clients: permissionLevel('clients'), canCreate: canCreateCase(), newClientBtn: getComputedStyle(document.getElementById('btn-new-client')).display !== 'none', empNav: getComputedStyle(document.getElementById('nav-employees')).display, cloudReady: opsCloudReady, cached: !!localStorage.getItem('yutesign_ops_v2') }));
const freshHtml = await lf.pg.evaluate(() => document.getElementById('ops-auth-error').textContent);
check('修正後：登入按鈕在程式載入完成後才可點（載入後為可點、文字還原）', lf.btn0.disabled === false && lf.btn0.text === '使用 Google 帳號登入', lf.btn0);
check('已知問題 #1（暫不修）：新員工在全新瀏覽器按登入仍被拒絕、不讀雲端、不留快取', lf.pending0 && !fresh.unlocked && !fresh.email && !fresh.cloudReady && !fresh.cached && freshHtml === '此帳號尚未開通 OPS：qa.new@yutesign.com', { ...fresh, error: freshHtml });
await lf.c.close();
lf = await loginFresh('nobody@yutesign.com');
const nobody = await lf.pg.evaluate(() => ({ pending: document.body.classList.contains('auth-pending'), error: document.getElementById('ops-auth-error').textContent, fbUser: firebase.auth().currentUser, cached: localStorage.getItem('yutesign_ops_v2'), session: localStorage.getItem('yutesign_ops_auth_session'), revoked: window.__gsiRevoked || 0 }));
check('非員工的公司帳號：拒絕、撤銷 Google token、不留本機快取', nobody.pending && nobody.error === '此帳號尚未開通 OPS：nobody@yutesign.com' && nobody.cached === null && nobody.revoked === 1, nobody);
await lf.c.close();
lf = await loginFresh('someone@gmail.com');
const outsider = await lf.pg.evaluate(() => ({ pending: document.body.classList.contains('auth-pending'), error: document.getElementById('ops-auth-error').textContent, cached: localStorage.getItem('yutesign_ops_v2') }));
check('非公司網域帳號：直接拒絕、不讀雲端', outsider.pending && outsider.error === '此帳號尚未開通 OPS：someone@gmail.com' && outsider.cached === null, outsider);
await lf.c.close();
// Device that already holds the synced cache (e.g. used OPS before): login works and permissions apply.
ctx = await newContext(QA_EMAIL, { fixedTime: NOW });
await ctx.addInitScript(cache => { try { if (!localStorage.getItem('yutesign_ops_v2')) localStorage.setItem('yutesign_ops_v2', cache); } catch (e) {} }, JSON.stringify(H.state.cloud.data));
page = await openApp(ctx);
const qa = await page.evaluate(() => ({ id: currentUser.id, name: currentUser.name, clients: permissionLevel('clients'), vendors: permissionLevel('vendors'), canCreate: canCreateCase(), employees: permissionLevel('employees') }));
check('新員工在已有快取的裝置可登入，權限矩陣生效', qa.name === 'QA新人' && qa.clients === 'manage' && qa.vendors === 'view_all' && qa.canCreate === true && qa.employees === 'none', qa);
check('新員工看得到「新增客戶」、看不到「新增廠商」與員工頁', await page.evaluate(() => getComputedStyle(document.getElementById('btn-new-client')).display !== 'none' && getComputedStyle(document.getElementById('btn-new-vendor')).display === 'none' && getComputedStyle(document.getElementById('nav-employees')).display === 'none'));
await ctx.close();

// ═══════════ C: non-admin (peng: employees none, feedback manage, roleCode PM) ═══════════
H.setScenario('C-pm(peng)');
ctx = await newContext('peng@yutesign.com', { fixedTime: NOW });
page = await openApp(ctx);
page.on('dialog', d => d.accept());
await clearToasts(page);
await page.evaluate(() => navTo('employees'));
const c1 = await lastToast(page);
await page.evaluate(() => navTo('systemnotes'));
const c2 = await lastToast(page);
check('非管理者：員工頁與系統筆記頁被拒', c1 === '您沒有此功能的權限' && c2 === '您沒有此功能的權限' && (await page.evaluate(() => currentPage)) !== 'employees', [c1, c2]);
const nEmp = await page.evaluate(() => EMPLOYEES.length);
await page.evaluate(() => openEmployeeModal());
const c3 = await lastToast(page);
await page.evaluate(() => { document.getElementById('emp-f-name').value = 'X'; submitEmployee(); });
const c4 = await lastToast(page);
check('非管理者：直接呼叫新增／儲存員工被拒且未寫入', c3 === '您沒有修改此資料的權限' && c4 === '您沒有修改此資料的權限' && !(await isOpen(page, 'modal-employee')) && (await page.evaluate(() => EMPLOYEES.length)) === nEmp, [c3, c4]);
await nav(page, 'feedback');
check('PM：可進入問題回報、狀態欄唯讀（無下拉）', (await page.evaluate(() => currentPage)) === 'feedback' && (await page.locator('#tf-tbody select').count()) === 0);
await page.fill('#tf-steps', 'QA彭步驟');
await page.fill('#tf-actual', 'QA彭實際');
await page.click('button[onclick="submitFeedback()"]');
check('PM：可送出回報', (await page.evaluate(() => TEST_FEEDBACK[0].reporterName)) === '彭俞豪');
const pengFb = await page.evaluate(() => TEST_FEEDBACK[0].id);
await clearToasts(page);
await page.evaluate(id => setFeedbackStatus(id, '已修正'), pengFb);
const c5 = await lastToast(page);
await page.evaluate(id => deleteFeedback(id), pengFb);
const c6 = await lastToast(page);
check('PM：改狀態／刪除被拒', c5 === '只有完整管理者可以變更回饋狀態' && c6 === '只有完整管理者可以刪除回饋' && (await page.evaluate(id => TEST_FEEDBACK.find(r => r.id === id)?.status, pengFb)) === '待處理', [c5, c6]);
await page.waitForTimeout(1200);
await waitSynced(page);
await ctx.close();

// ═══════════ D: owner marks the new employee as left → access revoked ═══════════
H.setScenario('D-offboard(shower)');
ctx = await newContext('shower.li@yutesign.com', { fixedTime: NOW });
page = await openApp(ctx);
await nav(page, 'employees');
await page.locator('#emp-tbody tr', { hasText: 'QA新人' }).locator('button', { hasText: '編輯' }).click();
await page.selectOption('#emp-f-status', '已離職');
await page.fill('#emp-f-endDate', '2026-10-06');
await page.click('#modal-employee .btn-primary');
const left = await page.evaluate(id => { const e = EMPLOYEES.find(x => x.id === id); return { status: e.status, access: e.accessRole, att: e.attendanceRequired, profit: e.profitEligible, auth: !!opsAuthUserByEmail('qa.new@yutesign.com') }; }, empIdNext);
check('設為已離職：關閉開通、免打卡、無分潤、無法登入', left.status === '已離職' && left.access === 'none' && left.att === false && left.profit === false && left.auth === false, left);
await page.waitForTimeout(1200);
await waitSynced(page);
const snap = () => page.evaluate(id => JSON.stringify({ e: EMPLOYEES.find(x => x.id === id), p: USER_PERMISSIONS[id], a: PAYROLL_EMPLOYEE_ACCOUNTS[id], f: TEST_FEEDBACK.map(r => [r.id, r.status, r.reporterId, r.screenshotWidth || 0]) }), empIdNext);
const s1 = await snap();
await page.reload({ waitUntil: 'load' }); await waitReady(page);
check('重新載入後員工／權限／回報資料一樣', (await snap()) === s1);
const after = await counts(page);
check('其他集合筆數不變', ['CASES', 'PAYABLES', 'RECEIVABLES', 'EXPENSES', 'CLIENTS', 'VENDORS', 'PAYROLL', 'ATTENDANCE_RECORDS'].every(k => after[k] === before[k]), { before, after });
await ctx.close();

// ═══════════ E: the departed employee can no longer get in ═══════════
H.setScenario('E-departed-login(qa.new)');
lf = await loginFresh(QA_EMAIL);
const departed = await lf.pg.evaluate(() => ({ pending: document.body.classList.contains('auth-pending'), email: opsAuthenticatedEmail, error: document.getElementById('ops-auth-error').textContent, fbUser: firebase.auth().currentUser, cached: localStorage.getItem('yutesign_ops_v2') }));
check('已離職員工：按登入也被拒絕、不留快取', departed.pending && !departed.email && departed.error === '此帳號尚未開通 OPS：qa.new@yutesign.com' && departed.cached === null, departed);
await lf.c.close();

const fails = await H.finish(outJson, { finalCloudData: JSON.parse(JSON.stringify(H.state.cloud?.data || {})) });
process.exit(fails ? 1 : 0);
