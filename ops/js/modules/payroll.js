// PAYROLL MODULE. Extracted verbatim from ops/index.html at main@0ef422c.

// ══════════════════════════════════
// PAYROLL DATA
// ══════════════════════════════════
const PR_CONFIG = {
  nc:   {name:'鄭詩褣', role:'財務',    bank:'國泰世華 013', account:'699516631311',
         baseSalary:35000, phoneAllowance:1000, fullAttendanceBonus:2000, dutyAllowance:5000, performanceBonus:6000, mealAllowance:1000,
         laborInsurance:908, healthInsurance:563},
  peng: {name:'彭俞豪', role:'專案經理', bank:'', account:'',
         baseSalary:35000, phoneAllowance:0, fullAttendanceBonus:0, dutyAllowance:0, performanceBonus:0, mealAllowance:0,
         laborInsurance:0, healthInsurance:0},
  lien: {name:'連星羽', role:'設計師',  bank:'', account:'',
         baseSalary:35000, phoneAllowance:0, fullAttendanceBonus:0, dutyAllowance:0, performanceBonus:0, mealAllowance:0,
         laborInsurance:0, healthInsurance:0},
  sun:  {name:'孫一宣', role:'行銷行政', bank:'國泰世華 013', account:'043506014060',
         baseSalary:38000, phoneAllowance:0, fullAttendanceBonus:0, dutyAllowance:0, performanceBonus:0, mealAllowance:0,
         laborInsurance:955, healthInsurance:592},
  lu_yanchen: {name:'盧彥辰', role:'設計助理', bank:'銀行未設定', account:'',
         baseSalary:38000, phoneAllowance:0, fullAttendanceBonus:0, dutyAllowance:0, performanceBonus:0, mealAllowance:0,
         laborInsurance:0, healthInsurance:0},
  chen_hongjun: {name:'陳虹君', role:'會計', bank:'銀行未設定', account:'',
         baseSalary:0, phoneAllowance:0, fullAttendanceBonus:0, dutyAllowance:0, performanceBonus:0, mealAllowance:0,
         laborInsurance:0, healthInsurance:0},
};
const PAYROLL_EMPLOYEE_ACCOUNTS = {};

// 2025/10 ~ 2026/5 實領薪資匯入（其餘項目暫以0填入；2026/5 行政薪資待正式薪資明細複核）
const CODEX_SEED_PAYROLL = [
  {person:'sun', month:'2025-10', baseSalary:35000, phoneAllowance:0, fullAttendanceBonus:0, dutyAllowance:0, performanceBonus:0, mealAllowance:0, overtimePay:0, expenseReimbursement:0, yearEndBonus:0, laborInsurance:908, healthInsurance:563, voluntaryPension:0, leaveDeduction:3528, leaveNote:'請假10/9.10/29.10/31半天10/13(1小時)10/7.10/28共3天1小時', advancePaid:0, payDate:'11/5', note:'匯入：薪資明細表'},
  {person:'sun', month:'2025-11', baseSalary:35000, phoneAllowance:0, fullAttendanceBonus:0, dutyAllowance:0, performanceBonus:0, mealAllowance:0, overtimePay:0, expenseReimbursement:0, yearEndBonus:0, laborInsurance:908, healthInsurance:563, voluntaryPension:0, leaveDeduction:4081, leaveNote:'請假11/5.11/14.11/26(半天)11/17.11/21共3天4小時', advancePaid:0, payDate:'12/5', note:'匯入：薪資明細表'},
  {person:'sun', month:'2025-12', baseSalary:35000, phoneAllowance:0, fullAttendanceBonus:0, dutyAllowance:0, performanceBonus:0, mealAllowance:0, overtimePay:0, expenseReimbursement:0, yearEndBonus:0, laborInsurance:908, healthInsurance:563, voluntaryPension:0, leaveDeduction:9032, leaveNote:'請假12/8.9.18.19.24.26.29.30共8天', advancePaid:0, payDate:'1/5', note:'匯入：薪資明細表'},
  {person:'sun', month:'2026-01', baseSalary:35000, phoneAllowance:0, fullAttendanceBonus:0, dutyAllowance:0, performanceBonus:0, mealAllowance:0, overtimePay:0, expenseReimbursement:0, yearEndBonus:70000, laborInsurance:908, healthInsurance:563, voluntaryPension:0, leaveDeduction:6774, leaveNote:'請假1/7.26.27.28共4天請假4/12.20.22.23共2天', advancePaid:0, payDate:'2/5', note:'匯入：薪資明細表（含年終獎金）'},
  {person:'sun', month:'2026-02', baseSalary:35000, phoneAllowance:0, fullAttendanceBonus:0, dutyAllowance:0, performanceBonus:0, mealAllowance:0, overtimePay:0, expenseReimbursement:0, yearEndBonus:0, laborInsurance:908, healthInsurance:563, voluntaryPension:0, leaveDeduction:1875, leaveNote:'請假2/9共1天請假2/10共0.5天', advancePaid:0, payDate:'3/5', note:'匯入：薪資明細表'},
  {person:'sun', month:'2026-03', baseSalary:35000, phoneAllowance:0, fullAttendanceBonus:0, dutyAllowance:0, performanceBonus:0, mealAllowance:0, overtimePay:0, expenseReimbursement:0, yearEndBonus:0, laborInsurance:908, healthInsurance:563, voluntaryPension:0, leaveDeduction:5927, leaveNote:'請假3/11.3/23.3/30共3天 3/12.3/20.3/24.3/25共2天 3/10.3/13共2小時', advancePaid:0, payDate:'4/3', note:'匯入：薪資明細表'},
  {person:'sun', month:'2026-04', baseSalary:38000, phoneAllowance:0, fullAttendanceBonus:0, dutyAllowance:0, performanceBonus:0, mealAllowance:0, overtimePay:0, expenseReimbursement:0, yearEndBonus:0, laborInsurance:908, healthInsurance:563, voluntaryPension:0, leaveDeduction:7918, leaveNote:'請假4/20.4/21.4/22.4/24共4天 4/13.4/14.4/27.4/30共2天 4/1.4/2共2小時（底薪調整為38,000）', advancePaid:0, payDate:'5/5', note:'匯入：薪資明細表'},
  {person:'nc', month:'2025-10', baseSalary:35000, phoneAllowance:1000, fullAttendanceBonus:2000, dutyAllowance:5000, performanceBonus:6000, mealAllowance:1000, overtimePay:0, expenseReimbursement:0, yearEndBonus:0, laborInsurance:908, healthInsurance:563, voluntaryPension:0, leaveDeduction:0, leaveNote:'', advancePaid:0, payDate:'11/4', note:'匯入：薪資明細表'},
  {person:'nc', month:'2025-11', baseSalary:35000, phoneAllowance:1000, fullAttendanceBonus:2000, dutyAllowance:5000, performanceBonus:6000, mealAllowance:1000, overtimePay:0, expenseReimbursement:0, yearEndBonus:0, laborInsurance:908, healthInsurance:563, voluntaryPension:0, leaveDeduction:0, leaveNote:'', advancePaid:0, payDate:'12/5', note:'匯入：薪資明細表'},
  {person:'nc', month:'2025-12', baseSalary:35000, phoneAllowance:1000, fullAttendanceBonus:2000, dutyAllowance:5000, performanceBonus:6000, mealAllowance:1000, overtimePay:0, expenseReimbursement:0, yearEndBonus:0, laborInsurance:908, healthInsurance:563, voluntaryPension:0, leaveDeduction:0, leaveNote:'', advancePaid:0, payDate:'1/5', note:'匯入：薪資明細表'},
  {person:'nc', month:'2026-01', baseSalary:35000, phoneAllowance:1000, fullAttendanceBonus:2000, dutyAllowance:5000, performanceBonus:6000, mealAllowance:1000, overtimePay:0, expenseReimbursement:0, yearEndBonus:100000, laborInsurance:908, healthInsurance:563, voluntaryPension:0, leaveDeduction:0, leaveNote:'', advancePaid:0, payDate:'2/5', note:'匯入：薪資明細表（含年終獎金）'},
  {person:'nc', month:'2026-02', baseSalary:35000, phoneAllowance:1000, fullAttendanceBonus:2000, dutyAllowance:5000, performanceBonus:6000, mealAllowance:1000, overtimePay:0, expenseReimbursement:0, yearEndBonus:0, laborInsurance:908, healthInsurance:563, voluntaryPension:0, leaveDeduction:0, leaveNote:'', advancePaid:0, payDate:'3/5', note:'匯入：薪資明細表'},
  {person:'nc', month:'2026-03', baseSalary:35000, phoneAllowance:1000, fullAttendanceBonus:2000, dutyAllowance:5000, performanceBonus:6000, mealAllowance:1000, overtimePay:0, expenseReimbursement:0, yearEndBonus:0, laborInsurance:908, healthInsurance:563, voluntaryPension:0, leaveDeduction:0, leaveNote:'', advancePaid:0, payDate:'4/5', note:'匯入：薪資明細表'},
  {person:'nc', month:'2026-04', baseSalary:35000, phoneAllowance:1000, fullAttendanceBonus:2000, dutyAllowance:5000, performanceBonus:6000, mealAllowance:1000, overtimePay:0, expenseReimbursement:0, yearEndBonus:0, laborInsurance:908, healthInsurance:563, voluntaryPension:0, leaveDeduction:0, leaveNote:'', advancePaid:0, payDate:'5/5', note:'匯入：薪資明細表'},
  {person:'nc', month:'2026-05', baseSalary:35000, phoneAllowance:1000, fullAttendanceBonus:2000, dutyAllowance:5000, performanceBonus:6000, mealAllowance:1000, overtimePay:0, expenseReimbursement:0, yearEndBonus:0, laborInsurance:908, healthInsurance:563, voluntaryPension:0, leaveDeduction:0, leaveNote:'', advancePaid:0, payDate:'6/5', note:'依 Ning2026薪資明細截圖 2026-06-16 匯入；本次匯入 48,529'},
  {person:'sun', month:'2026-05', baseSalary:38000, phoneAllowance:0, fullAttendanceBonus:0, dutyAllowance:0, performanceBonus:0, mealAllowance:0, overtimePay:0, expenseReimbursement:0, yearEndBonus:0, laborInsurance:955, healthInsurance:592, voluntaryPension:0, leaveDeduction:6895, leaveNote:'請假5/7、5/25、5/26、5/27 共4天；5/7、5/21 共1天；5/13、5/19、5/22、5/29 共5小時', advancePaid:0, payDate:'6/5', note:'依 Sun2026薪資明細截圖 2026-06-16 匯入；本次匯入 29,558'},
  ...['2025-10','2025-11','2025-12','2026-01','2026-02','2026-03','2026-04','2026-05'].flatMap(month => ['peng','lien'].map(person => (
    {person, month, baseSalary:35000, phoneAllowance:0, fullAttendanceBonus:0, dutyAllowance:0, performanceBonus:0, mealAllowance:0, overtimePay:0, expenseReimbursement:0, yearEndBonus:0, laborInsurance:0, healthInsurance:0, voluntaryPension:0, leaveDeduction:0, leaveNote:'', advancePaid:0, payDate:'', note:'匯入：固定實領35000'}
  ))),
];

let PAYROLL = [];
const DEFAULT_PAYROLL_MONTHS = [...new Set(CODEX_SEED_PAYROLL.map(r => r.month))].sort((a,b) => b.localeCompare(a));
const PAYROLL_MONTHS = [...DEFAULT_PAYROLL_MONTHS];
const PAYROLL_DELETED_MONTHS = [];
const DELETED_SOURCE_KEYS = [];
let prNextId = 1;
let prCurrentEmp = 'nc';
let prRangeExpanded = false;

// ══════════════════════════════════
// PAYROLL MODULE
// ══════════════════════════════════
function prIsValidMonth(month) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(month || ''));
}

function prRenderMonthOptions(preferredMonth) {
  const sel = document.getElementById('pr-filter-month');
  if (!sel) return;
  const current = preferredMonth || sel.value || currentMonthKey();
  const monthSet = new Set(PAYROLL_MONTHS.filter(prIsValidMonth));
  if (prIsValidMonth(current)) monthSet.add(current);
  const months = [...monthSet].sort((a,b) => b.localeCompare(a));
  PAYROLL_MONTHS.length = 0;
  PAYROLL_MONTHS.push(...months);
  sel.innerHTML = months.map(month => {
    const [year, num] = month.split('-');
    return `<option value="${month}">${year}年${Number(num)}月</option>`;
  }).join('');
  if (months.includes(current)) sel.value = current;
  else if (months.length) sel.value = months[0];
  prRenderRangeMonthOptions();
}

function prRenderRangeMonthOptions() {
  const fromEl = document.getElementById('pr-range-from');
  const toEl = document.getElementById('pr-range-to');
  if (!fromEl || !toEl) return;
  const months = [...new Set(PAYROLL_MONTHS.filter(prIsValidMonth))].sort((a,b) => b.localeCompare(a));
  const optionHtml = months.map(month => {
    const [year, num] = month.split('-');
    return `<option value="${month}">${year}年${Number(num)}月</option>`;
  }).join('');
  const prevFrom = fromEl.value;
  const prevTo = toEl.value;
  fromEl.innerHTML = optionHtml;
  toEl.innerHTML = optionHtml;
  fromEl.value = months.includes(prevFrom) ? prevFrom : (months[5] || months[months.length - 1] || months[0] || '');
  toEl.value = months.includes(prevTo) ? prevTo : (months[0] || '');
}

function openPayrollMonthModal() {
  if (!requireManage('payroll')) return;
  const sel = document.getElementById('pr-filter-month');
  if (!sel) return;
  const input = document.getElementById('pr-new-month');
  if (input) input.value = sel.value || localDateKey().slice(0,7);
  openModal('modal-payroll-month');
}

function submitPayrollMonth() {
  if (!requireManage('payroll')) return;
  const month = document.getElementById('pr-new-month')?.value || '';
  if (!prIsValidMonth(month)) { showToast('請選擇正確月份', 'error'); return; }
  if (PAYROLL_MONTHS.includes(month)) { alert('此月份已存在'); prRenderMonthOptions(month); renderPayroll(); return; }
  PAYROLL_MONTHS.push(month);
  prRenderMonthOptions(month);
  closeModal('modal-payroll-month');
  renderPayroll();
  saveData();
  showToast('月份已新增 ✓','success');
}

function prDeleteMonth() {
  if (!requireManage('payroll')) return;
  const sel = document.getElementById('pr-filter-month');
  if (!sel) return;
  const month = sel.value;
  if (!month) return;
  if (!confirm(`確定要刪除「${sel.options[sel.selectedIndex].textContent}」這個月份嗎？\n所有員工該月份的薪資紀錄都會被一併刪除，且無法復原。`)) return;
  for (let i = PAYROLL.length - 1; i >= 0; i--) {
    if (PAYROLL[i].month === month) PAYROLL.splice(i, 1);
  }
  const monthIndex = PAYROLL_MONTHS.indexOf(month);
  if (monthIndex >= 0) PAYROLL_MONTHS.splice(monthIndex, 1);
  if (!PAYROLL_DELETED_MONTHS.includes(month)) PAYROLL_DELETED_MONTHS.push(month);
  prRenderMonthOptions();
  renderPayroll();
  saveData();
  showToast('月份已刪除 ✓','success');
}

// 員工只在「到職～離職」區間內才能被選到（即使當月薪資還沒建立，也要能新增）；
// 區間外、且當月沒有薪資紀錄則隱藏。在職員工不檢查離職日（沒有離職日），但仍檢查到職日
// （例：盧彥辰 2026-06 到職，6 月之前不應出現）。startDate／endDate 不明時不主動隱藏，避免擋到補登。
function prPersonActiveForMonth(id, month) {
  if (!month) return true;
  const emp = employeeById(id);
  if (!emp) return true;
  const active = isActiveEmployeeId(id);
  const startMonth = emp.startDate ? emp.startDate.slice(0,7) : '';
  const endMonth = active ? '' : (emp.endDate ? emp.endDate.slice(0,7) : '');
  if (startMonth && month < startMonth) return false;
  if (endMonth && month > endMonth) return false;
  return true;
}

function prSelectableUsers(month = '') {
  // 離職員工若曾有薪資紀錄，仍要留在名單裡——那筆歷史薪資已經算進公司開銷／分潤等下游總額，
  // 選單完全排除會讓人看不到、對不起帳，誤以為總額少算或多算。
  // 但每個人只在「到職～離職區間」或「當月確實有薪資紀錄」時顯示，避免離職後的月份仍出現舊人名、
  // 或到職前的月份提早出現（例：陳虹君 2026-07-15 離職 2026-08 起不再顯示；盧彥辰 2026-06-01 到職，
  // 之前月份不顯示；區間內即使當月尚未建立紀錄仍可選取以新增）。
  // 注意：不能沿用 activeSystemUsers()，它只看「目前是否在職」、不看月份，會讓在職員工繞過到職日檢查。
  const payrollHistoryIds = new Set(PAYROLL.map(r => r.person).filter(Boolean));
  const monthRecordIds = month ? new Set(PAYROLL.filter(r => r.month === month).map(r => r.person)) : null;
  const candidateIds = new Set([...payrollHistoryIds, ...USERS.filter(u => isActiveEmployeeId(u.id)).map(u => u.id)]);
  const people = USERS.filter(u => candidateIds.has(u.id) && ((monthRecordIds && monthRecordIds.has(u.id)) || prPersonActiveForMonth(u.id, month)))
    .filter(u => u.id !== 'shower' && (PR_CONFIG[u.id] || employeeById(u.id)));
  if (canManage('payroll')) people.unshift({id:'shower', name:'李鎮宇', role:'股東／分潤提領'});
  return people;
}

function prCanSeeAllPrivatePayroll() {
  return ['shower', 'nc'].includes(currentUser?.id);
}

function prOwnerWithdrawalPerson(row) {
  return profitOffsetPerson(row) || row.shareholderPerson || row.profitPerson || '';
}

function prVisibleOwnerWithdrawalRows(month = '') {
  return ownerWithdrawalRows(month).filter(row => {
    if (prCanSeeAllPrivatePayroll()) return true;
    return prOwnerWithdrawalPerson(row) === currentUser?.id;
  });
}

function prRenderEmployeeTabs() {
  const tabs = document.getElementById('payroll-emp-tabs');
  if (!tabs) return;
  const selfOnly = permissionLevel('payroll') === 'view_self';
  if (selfOnly) {
    tabs.style.display = 'none';
    return;
  }
  const month = document.getElementById('pr-filter-month')?.value || '';
  const people = prSelectableUsers(month);
  if (!people.some(u => u.id === prCurrentEmp)) prCurrentEmp = people[0]?.id || 'nc';
  tabs.style.display = '';
  tabs.innerHTML = people.map(u => `
    <button class="btn ${u.id === prCurrentEmp ? 'btn-primary active' : 'btn-ghost'} btn-sm pr-emp-tab" onclick="prSelectEmp(this,'${u.id}')">${u.name}</button>
  `).join('');
}

function prSelectEmp(el, person) {
  if (!canManage('payroll') && person !== currentUser.id) { showToast('您只能查看自己的薪資', 'error'); return; }
  // 離職員工的歷史薪資仍要能查／能核對，只是不能再產生新的出勤薪資草稿（那段邏輯本來就只認在職員工）。
  document.querySelectorAll('.pr-emp-tab').forEach(b => { b.classList.remove('btn-primary','active'); b.classList.add('btn-ghost'); });
  el.classList.remove('btn-ghost'); el.classList.add('btn-primary','active');
  prCurrentEmp = person;
  renderPayroll();
}

function ownerWithdrawalTypeLabel(type) {
  return {
    fixed_profit_advance:'固定分潤預領',
    ad_hoc_profit_advance:'臨時分潤預領',
    shareholder_distribution:'股東盈餘分配',
  }[type] || '分潤提領';
}

function ownerWithdrawalPayableType(type) {
  return type === 'shareholder_distribution' ? 'shareholder_distribution' : 'profit_advance';
}

function ownerWithdrawalDate(row) {
  if (!row) return '';
  return row.doneDate || row.transferDate || row.wantDate || '';
}

function ownerWithdrawalRows(month = '') {
  return PAYABLES.filter(row => {
    if (!row.ownerWithdrawalType) return false;
    if (month && ownerWithdrawalDate(row).slice(0,7) !== month) return false;
    return true;
  }).sort((a,b) => ownerWithdrawalDate(b).localeCompare(ownerWithdrawalDate(a)) || (b.id||0) - (a.id||0));
}

// 找出最近一個「已有股東／分潤提領紀錄」且早於目前月份的月份，不強制要求是連續上一個月
// （中間可能有月份沒有任何提領紀錄），這樣「複製上個月」在有資料斷層時仍能找到最近可複製的來源。
function prPreviousOwnerWithdrawalMonth(month) {
  const months = [...new Set(PAYABLES.filter(r => r.ownerWithdrawalType).map(r => ownerWithdrawalDate(r).slice(0,7)))]
    .filter(m => prIsValidMonth(m) && m < month)
    .sort();
  return months[months.length - 1] || '';
}

function prCopyOwnerWithdrawalFromLastMonth() {
  if (!requireManage('payroll', '您沒有新增股東／分潤提領的權限')) return;
  const month = document.getElementById('pr-filter-month')?.value || '';
  if (!month) { showToast('請先選擇月份', 'error'); return; }
  const prevMonth = prPreviousOwnerWithdrawalMonth(month);
  const prevRows = prevMonth ? ownerWithdrawalRows(prevMonth) : [];
  if (!prevRows.length) { showToast('找不到可複製的上個月股東／分潤提領紀錄', 'error'); return; }
  if (!confirm(`確定要把 ${prevMonth} 的 ${prevRows.length} 筆股東／分潤提領複製到 ${month} 嗎？\n日期會依原本的「日」對應到本月（月底日期不足會自動調整）；金額、類型、帳戶、提領人照抄；狀態一律設為「待付款」，請於實際入帳後再改成已付款。`)) return;

  const daysInMonth = new Date(Number(month.slice(0,4)), Number(month.slice(5,7)), 0).getDate();
  const existingInMonth = ownerWithdrawalRows(month);
  let copiedCount = 0;
  prevRows.forEach(src => {
    const srcDate = ownerWithdrawalDate(src);
    const day = Math.min(Number(srcDate.slice(8,10)) || 1, daysInMonth);
    const newDate = `${month}-${String(day).padStart(2,'0')}`;
    // 避免重複點擊把同一筆複製兩次：同人、同類型、同金額、同帳戶、同日期已存在就跳過。
    const isDuplicate = existingInMonth.some(r =>
      r.shareholderPerson === src.shareholderPerson &&
      r.ownerWithdrawalType === src.ownerWithdrawalType &&
      (r.amount||0) === (src.amount||0) &&
      (r.bank||'') === (src.bank||'') &&
      ownerWithdrawalDate(r) === newDate
    );
    if (isDuplicate) return;
    const label = ownerWithdrawalTypeLabel(src.ownerWithdrawalType);
    const defaultNote = `${srcDate} ${label}`;
    const note = (src.note && src.note !== defaultNote) ? src.note : `${newDate} ${label}`;
    const personName = psPersonName(src.shareholderPerson) || src.vendor || '';
    const row = {
      id: pyNextId++,
      sourceKey: `owner-withdrawal-${src.shareholderPerson}-${src.ownerWithdrawalType}-${newDate}-${Date.now()}-${copiedCount}`,
      case:'', caseName:'',
      vendor: src.vendor || personName,
      summary: label,
      amount: src.amount || 0,
      wantDate: newDate,
      transferDate: '',
      doneDate: '',
      ticket: '',
      bank: src.bank || '',
      invoice: '無',
      receipt: '無',
      person: currentUser.name,
      paymentType: src.paymentType,
      profitPerson: src.profitPerson || '',
      profitCaseCodes: [],
      ownerWithdrawalType: src.ownerWithdrawalType,
      shareholderPerson: src.shareholderPerson,
      status: 'approved',
      note
    };
    touchRowMeta(row, true);
    PAYABLES.push(row);
    existingInMonth.push(row);
    copiedCount++;
    recordAuditLog('create', 'ownerWithdrawal', row.id, null, auditSummary(), {
      riskLevel:'high',
      targetLabel:`${personName}／${label}（複製自 ${prevMonth}）`,
      diff:[
        { field:'amount', beforeValue:null, afterValue:row.amount },
        { field:'paymentType', beforeValue:null, afterValue:row.paymentType },
        { field:'copiedFromMonth', beforeValue:null, afterValue:prevMonth }
      ]
    });
  });

  if (!copiedCount) { showToast('本月已有相同的提領紀錄，未新增', 'error'); return; }

  normalizeProfitPayables();
  renderOwnerWithdrawalPanel();
  renderPayrollRangeOverview();
  renderPayable();
  renderProfitShare();
  saveData();
  showToast(`已從 ${prevMonth} 複製 ${copiedCount} 筆到 ${month}（狀態為待付款）✓`, 'success');
}

function togglePayrollRangeOverview() {
  prRangeExpanded = !prRangeExpanded;
  renderPayrollRangeOverview();
}

function prMonthsInRange(fromMonth, toMonth) {
  const months = [...new Set(PAYROLL_MONTHS.filter(prIsValidMonth))].sort();
  if (!months.length) return [];
  let from = fromMonth || months[0];
  let to = toMonth || months[months.length - 1];
  if (from > to) [from, to] = [to, from];
  return months.filter(month => month >= from && month <= to);
}

function prRecordNet(rec) {
  if (!rec) return 0;
  const custom = (rec.customItems || []).reduce((s,it) => s + (Number(it.amount) || 0), 0);
  const a = (rec.baseSalary||0)+(rec.phoneAllowance||0)+(rec.fullAttendanceBonus||0)+(rec.dutyAllowance||0)+(rec.performanceBonus||0)+(rec.mealAllowance||0);
  const b = (rec.overtimePay||0)+(rec.expenseReimbursement||0)+(rec.yearEndBonus||0)+(rec.engineeringBonus||0)+custom;
  const c = (rec.laborInsurance||0)+(rec.healthInsurance||0)+(rec.voluntaryPension||0)+(rec.leaveDeduction||0);
  return a + b - c - (rec.advancePaid || 0);
}

function renderPayrollRangeOverview() {
  const box = document.getElementById('pr-range-overview');
  if (!box) return;
  prRenderRangeMonthOptions();
  const from = document.getElementById('pr-range-from')?.value || '';
  const to = document.getElementById('pr-range-to')?.value || '';
  const months = prMonthsInRange(from, to);
  const monthSet = new Set(months);
  const people = prSelectableUsers();
  const canSeeAll = prCanSeeAllPrivatePayroll();
  const visiblePeople = canSeeAll ? people : people.filter(p => p.id === currentUser.id);
  const payrollRows = visiblePeople.map(person => {
    const records = PAYROLL.filter(r => r.person === person.id && monthSet.has(r.month));
    const net = records.reduce((s,r) => s + prRecordNet(r), 0);
    return { person, count:records.length, net };
  }).filter(row => row.count || row.net);
  const withdrawalRows = prVisibleOwnerWithdrawalRows().filter(row => monthSet.has(ownerWithdrawalDate(row).slice(0,7)));
  const withdrawalTotal = withdrawalRows.reduce((s,row) => s + (Number(row.amount) || 0), 0);
  const payrollTotal = payrollRows.reduce((s,row) => s + row.net, 0);
  const fmt = n => '$' + Math.round(Number(n)||0).toLocaleString('zh-TW');
  const summary = document.getElementById('pr-range-summary');
  if (summary) summary.textContent = months.length ? `${months[0]} ～ ${months[months.length - 1]}｜薪資 ${fmt(payrollTotal)}｜提領 ${fmt(withdrawalTotal)}` : '尚無月份';
  const toggle = document.getElementById('btn-pr-range-toggle');
  if (toggle) toggle.textContent = prRangeExpanded ? '收合' : '展開';
  box.style.display = prRangeExpanded ? '' : 'none';
  if (!prRangeExpanded) {
    box.innerHTML = '';
    return;
  }
  const payrollBody = payrollRows.length ? payrollRows.map(row => `
    <tr style="border-bottom:1px solid var(--border)">
      <td style="padding:8px 12px;font-size:12px;font-weight:600">${row.person.name}</td>
      <td style="padding:8px 12px;text-align:center;font-size:12px;color:var(--text2)">${row.count} 個月</td>
      <td style="padding:8px 12px;text-align:right;font-family:'DM Mono',monospace;font-size:12px;font-weight:700">${fmt(row.net)}</td>
    </tr>`).join('') : `<tr><td colspan="3" style="padding:16px;text-align:center;font-size:12px;color:var(--text3)">區間內沒有薪資紀錄</td></tr>`;
  const withdrawalBody = withdrawalRows.length ? withdrawalRows.map(row => `
    <tr style="border-bottom:1px solid var(--border)">
      <td style="padding:8px 12px;font-size:12px">${ownerWithdrawalDate(row) || '—'}</td>
      <td style="padding:8px 12px;font-size:12px;font-weight:600">${row.vendor || psPersonName(profitOffsetPerson(row))}</td>
      <td style="padding:8px 12px;font-size:12px">${ownerWithdrawalTypeLabel(row.ownerWithdrawalType)}</td>
      <td style="padding:8px 12px;text-align:right;font-family:'DM Mono',monospace;font-size:12px;font-weight:700">${fmt(row.amount)}</td>
      <td style="padding:8px 12px;text-align:center"><span class="tag ${row.status === 'paid' ? 'tag-done' : 'tag-active'}">${row.status === 'paid' ? '已付款' : '待付款'}</span></td>
    </tr>`).join('') : `<tr><td colspan="5" style="padding:16px;text-align:center;font-size:12px;color:var(--text3)">區間內沒有股東／分潤提領紀錄</td></tr>`;
  box.innerHTML = `
    <div style="display:grid;grid-template-columns:minmax(280px,0.8fr) minmax(420px,1.2fr);gap:14px">
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;overflow:hidden">
        <div style="padding:10px 14px;background:var(--surface2);font-size:13px;font-weight:700">薪資區間彙總</div>
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="border-bottom:1px solid var(--border2)">
            <th style="padding:7px 12px;text-align:left;font-size:11px;color:var(--text3)">人員</th>
            <th style="padding:7px 12px;text-align:center;font-size:11px;color:var(--text3)">月份數</th>
            <th style="padding:7px 12px;text-align:right;font-size:11px;color:var(--text3)">實領合計</th>
          </tr></thead>
          <tbody>${payrollBody}</tbody>
        </table>
      </div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;overflow:hidden">
        <div style="padding:10px 14px;background:var(--surface2);font-size:13px;font-weight:700">股東／分潤提領區間明細</div>
        <div style="overflow-x:auto">
          <table style="width:100%;min-width:620px;border-collapse:collapse">
            <thead><tr style="border-bottom:1px solid var(--border2)">
              <th style="padding:7px 12px;text-align:left;font-size:11px;color:var(--text3)">日期</th>
              <th style="padding:7px 12px;text-align:left;font-size:11px;color:var(--text3)">提領人</th>
              <th style="padding:7px 12px;text-align:left;font-size:11px;color:var(--text3)">類型</th>
              <th style="padding:7px 12px;text-align:right;font-size:11px;color:var(--text3)">金額</th>
              <th style="padding:7px 12px;text-align:center;font-size:11px;color:var(--text3)">狀態</th>
            </tr></thead>
            <tbody>${withdrawalBody}</tbody>
          </table>
        </div>
      </div>
    </div>`;
}

function renderOwnerWithdrawalPanel() {
  const box = document.getElementById('owner-withdrawal-panel');
  if (!box) return;
  const month = document.getElementById('pr-filter-month')?.value || '';
  const rows = prVisibleOwnerWithdrawalRows(month);
  const paid = rows.filter(r => r.status === 'paid');
  const pending = rows.filter(r => r.status !== 'paid');
  const sum = list => list.reduce((s,r) => s + (Number(r.amount) || 0), 0);
  const statusLabel = { approved:'待付款', pending:'待審核', paid:'已付款' };
  const body = rows.length ? rows.map(row => `
    <tr style="border-bottom:1px solid var(--border)">
      <td style="padding:8px 12px;font-size:12px">${ownerWithdrawalDate(row) || '—'}</td>
      <td style="padding:8px 12px;font-size:12px;font-weight:600">${row.vendor || psPersonName(row.profitPerson)}</td>
      <td style="padding:8px 12px;font-size:12px">${ownerWithdrawalTypeLabel(row.ownerWithdrawalType)}</td>
      <td style="padding:8px 12px;text-align:right;font-family:'DM Mono',monospace;font-size:12px;font-weight:600">$${(row.amount||0).toLocaleString('zh-TW')}</td>
      <td style="padding:8px 12px;font-size:12px">${row.bank || '—'}</td>
      <td style="padding:8px 12px;text-align:center"><span class="tag ${row.status === 'paid' ? 'tag-done' : 'tag-active'}">${statusLabel[row.status] || row.status || '—'}</span></td>
      <td style="padding:8px 12px;font-size:11px;color:var(--text3);line-height:1.45">${row.note || ''}</td>
      <td style="padding:8px 12px;text-align:center;white-space:nowrap">
        ${canManage('payroll') ? `<button class="btn btn-ghost btn-sm" style="padding:3px 7px;font-size:11px" onclick="openOwnerWithdrawalModal(${row.id})">修改</button>
        <button class="btn btn-ghost btn-sm" style="padding:3px 7px;font-size:11px;color:var(--error)" onclick="deleteOwnerWithdrawal(${row.id})">刪除</button>` : ''}
      </td>
    </tr>`).join('') : `<tr><td colspan="8" style="padding:24px;text-align:center;color:var(--text3);font-size:12px">本月尚無股東／分潤提領紀錄</td></tr>`;
  box.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;overflow:hidden">
      <div style="padding:12px 16px;background:var(--surface2);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div>
          <div style="font-size:13px;font-weight:700">股東／分潤提領</div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px">${month || '目前月份'}：已付款 $${sum(paid).toLocaleString('zh-TW')}／待付款 $${sum(pending).toLocaleString('zh-TW')}</div>
        </div>
        ${canManage('payroll') ? `<div style="display:flex;gap:8px">
          <button class="btn btn-ghost btn-sm" onclick="prCopyOwnerWithdrawalFromLastMonth()">複製上個月</button>
          <button class="btn btn-ghost btn-sm" onclick="openOwnerWithdrawalModal()">＋ 新增提領</button>
        </div>` : ''}
      </div>
      <div style="overflow-x:auto">
        <table style="width:100%;min-width:900px;border-collapse:collapse">
          <thead><tr style="border-bottom:1px solid var(--border2)">
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:var(--text3)">日期</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:var(--text3)">提領人</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:var(--text3)">類型</th>
            <th style="padding:8px 12px;text-align:right;font-size:11px;color:var(--text3)">金額</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:var(--text3)">帳戶</th>
            <th style="padding:8px 12px;text-align:center;font-size:11px;color:var(--text3)">狀態</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:var(--text3)">備註</th>
            <th style="padding:8px 12px;text-align:center;font-size:11px;color:var(--text3)">操作</th>
          </tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </div>`;
}

function openOwnerWithdrawalModal(id = null) {
  if (!requireManage('payroll', '您沒有新增或編輯股東／分潤提領的權限')) return;
  const row = id ? PAYABLES.find(r => r.id === id && r.ownerWithdrawalType) : null;
  const title = document.getElementById('ow-modal-title');
  const submitBtn = document.getElementById('ow-submit-btn');
  const editEl = document.getElementById('ow-edit-id');
  if (title) title.textContent = row ? '編輯股東／分潤提領' : '新增股東／分潤提領';
  if (submitBtn) submitBtn.textContent = row ? '儲存修改' : '新增提領';
  if (editEl) editEl.value = row?.id || '';
  const personEl = document.getElementById('ow-person');
  if (personEl) {
    const people = psParticipantList();
    personEl.innerHTML = people.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    personEl.value = profitOffsetPerson(row) || 'shower';
  }
  const month = document.getElementById('pr-filter-month')?.value || '';
  const today = new Date().toISOString().slice(0,10);
  const dateEl = document.getElementById('ow-date');
  if (dateEl) dateEl.value = ownerWithdrawalDate(row) || (month ? `${month}-${today.slice(8,10)}` : today);
  const typeEl = document.getElementById('ow-type'); if (typeEl) typeEl.value = row?.ownerWithdrawalType || 'fixed_profit_advance';
  const statusEl = document.getElementById('ow-status'); if (statusEl) statusEl.value = row?.status || 'paid';
  const amountEl = document.getElementById('ow-amount'); if (amountEl) amountEl.value = row?.amount ? row.amount.toLocaleString('zh-TW') : '';
  const bankEl = document.getElementById('ow-bank'); if (bankEl) bankEl.value = row?.bank || '';
  const noteEl = document.getElementById('ow-note'); if (noteEl) noteEl.value = row?.note || '';
  openModal('modal-owner-withdrawal');
}

function submitOwnerWithdrawal() {
  if (!requireManage('payroll', '您沒有新增股東／分潤提領的權限')) return;
  const person = document.getElementById('ow-person')?.value || 'shower';
  const type = document.getElementById('ow-type')?.value || 'fixed_profit_advance';
  const date = document.getElementById('ow-date')?.value || '';
  const amountRaw = document.getElementById('ow-amount')?.value || '';
  const amount = parseInt(amountRaw.replace(/[^0-9-]/g,''), 10) || 0;
  const bank = document.getElementById('ow-bank')?.value.trim() || '';
  const status = document.getElementById('ow-status')?.value || 'paid';
  const note = document.getElementById('ow-note')?.value.trim() || '';
  if (!date) { showToast('請填寫提領日期', 'error'); return; }
  if (amount <= 0) { showToast('請填寫提領金額', 'error'); return; }
  const personName = psPersonName(person);
  const label = ownerWithdrawalTypeLabel(type);
  const paymentType = ownerWithdrawalPayableType(type);
  const editId = Number(document.getElementById('ow-edit-id')?.value || 0);
  const existing = editId ? PAYABLES.find(r => r.id === editId && r.ownerWithdrawalType) : null;
  const before = existing ? auditClone(existing) : null;
  const beforeSummary = existing ? null : auditSummary();
  const row = {
    id: existing?.id || pyNextId++,
    sourceKey: existing?.sourceKey || `owner-withdrawal-${person}-${type}-${date}-${Date.now()}`,
    case:'', caseName:'',
    vendor:personName,
    summary:label,
    amount,
    wantDate:date,
    transferDate:status === 'paid' ? date : '',
    doneDate:status === 'paid' ? date : '',
    ticket:'',
    bank,
    invoice:'無',
    receipt:'無',
    person:currentUser.name,
    paymentType,
    profitPerson: paymentType === 'profit_advance' || paymentType === 'shareholder_distribution' ? person : '',
    profitCaseCodes:[],
    ownerWithdrawalType:type,
    shareholderPerson:person,
    status,
    note: note || `${date} ${label}`
  };
  touchRowMeta(row, !existing);
  if (existing) Object.assign(existing, row);
  else PAYABLES.push(row);
  normalizeProfitPayables();
  recordAuditLog(existing ? 'update' : 'create', 'ownerWithdrawal', row.id, existing ? before : beforeSummary, existing ? row : auditSummary(), {
    riskLevel:'high',
    targetLabel:`${personName}／${label}`,
    diff:[
      { field:'amount', beforeValue:null, afterValue:amount },
      { field:'paymentType', beforeValue:null, afterValue:paymentType },
      { field:'status', beforeValue:null, afterValue:status }
    ]
  });
  closeModal('modal-owner-withdrawal');
  renderOwnerWithdrawalPanel();
  renderPayrollRangeOverview();
  renderPayable();
  renderProfitShare();
  saveData();
  showToast(existing ? '股東／分潤提領已更新 ✓' : '股東／分潤提領已新增 ✓', 'success');
}

function deleteOwnerWithdrawal(id) {
  if (!requireManage('payroll', '您沒有刪除股東／分潤提領的權限')) return;
  const idx = PAYABLES.findIndex(r => r.id === id && r.ownerWithdrawalType);
  if (idx < 0) return;
  const row = PAYABLES[idx];
  if (!confirm(`確定刪除「${row.vendor || ''}／${ownerWithdrawalTypeLabel(row.ownerWithdrawalType)}／$${(row.amount||0).toLocaleString('zh-TW')}」？`)) return;
  const before = auditClone(row);
  PAYABLES.splice(idx, 1);
  normalizeProfitPayables();
  recordAuditLog('delete', 'ownerWithdrawal', id, before, null, {
    riskLevel:'high',
    targetLabel:`${row.vendor || '提領人未填'}／${ownerWithdrawalTypeLabel(row.ownerWithdrawalType)}`
  });
  renderOwnerWithdrawalPanel();
  renderPayrollRangeOverview();
  renderPayable();
  renderProfitShare();
  saveData();
  showToast('股東／分潤提領已刪除 ✓', 'success');
}

function prGetConfig(person) {
  const emp = EMPLOYEES.find(e => e.id === person) || USERS.find(u => u.id === person);
  const fallback = {
    name: emp?.name || '未設定員工',
    role: emp?.role || emp?.roleCode || '員工',
    bank: '',
    account: '',
    baseSalary: 0,
    phoneAllowance: 0,
    fullAttendanceBonus: 0,
    dutyAllowance: 0,
    performanceBonus: 0,
    mealAllowance: 0,
    laborInsurance: 0,
    healthInsurance: 0,
  };
  const base = PR_CONFIG[person] || fallback;
  const savedAccount = PAYROLL_EMPLOYEE_ACCOUNTS[person] || {};
  return {
    ...base,
    bank: emp?.payrollBank ?? savedAccount.bank ?? base.bank ?? '',
    branch: emp?.payrollBranch ?? '',
    accountName: emp?.payrollAccountName ?? '',
    account: emp?.payrollAccount ?? savedAccount.account ?? base.account ?? '',
  };
}

function renderPayroll() {
  const selfOnly = permissionLevel('payroll') === 'view_self';
  if (selfOnly) prCurrentEmp = currentUser.id;
  prRenderEmployeeTabs();
  const month = document.getElementById('pr-filter-month')?.value || '2026-03';
  const cfg   = prGetConfig(prCurrentEmp);
  const rec = PAYROLL.find(r => r.person===prCurrentEmp && r.month===month);
  const previousRec = rec ? null : PAYROLL
    .filter(r => r.person === prCurrentEmp && r.month < month)
    .sort((a,b) => b.month.localeCompare(a.month))[0];
  const recurring = rec || previousRec || cfg;
  const editBtn = document.getElementById('btn-payroll-edit');
  if (editBtn) {
    editBtn.style.display = canManage('payroll') && prCurrentEmp !== 'shower' ? '' : 'none';
    editBtn.disabled = false;
    editBtn.textContent = '編輯薪資單';
    editBtn.title = '';
  }

  // Emp info bar
  const infoEl = document.getElementById('pr-emp-info');
  if (infoEl) {
    infoEl.innerHTML = `
      <div style="width:42px;height:42px;border-radius:50%;background:var(--accent2);border:2px solid var(--accent);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:var(--accent);font-family:'DM Mono',monospace">${cfg.name[0]}</div>
      <div style="flex:1">
        <div style="font-size:15px;font-weight:600">${cfg.name}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px">${cfg.role} · ${cfg.bank||'銀行未設定'} · ${cfg.account||'帳號未設定'}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:11px;color:var(--text3)">底薪</div>
        <div style="font-size:16px;font-weight:700;font-family:'DM Mono',monospace;color:var(--accent)">$${(recurring?.baseSalary ?? cfg.baseSalary).toLocaleString('zh-TW')}</div>
        ${!rec && previousRec ? `<div style="font-size:10px;color:var(--warning);margin-top:2px">承接 ${previousRec.month}，當月尚未儲存</div>` : ''}
      </div>`;
  }

  const a = {
    底薪:         recurring?.baseSalary || 0,
    油資電話津貼:  recurring?.phoneAllowance || 0,
    全勤獎金:     recurring?.fullAttendanceBonus || 0,
    職務津貼:     recurring?.dutyAllowance || 0,
    績效獎金:     recurring?.performanceBonus || 0,
    誤餐費:       recurring?.mealAllowance || 0,
  };
  const b = rec ? {加班費:rec.overtimePay,費用墊支:rec.expenseReimbursement,年終獎金:rec.yearEndBonus,工程獎金:rec.engineeringBonus} : {加班費:0,費用墊支:0,年終獎金:0,工程獎金:0};
  (rec?.customItems||[]).forEach(it => { b[it.name||'其他項目'] = it.amount||0; });
  const c = {
    勞保費: recurring?.laborInsurance || 0,
    健保費: recurring?.healthInsurance || 0,
    自願提撥退休金: rec?.voluntaryPension || 0,
    請假扣款: rec?.leaveDeduction || 0,
  };
  const leaveNote = rec?.leaveNote || '';
  const engBonusNote = rec?.engineeringBonusNote || '';

  const renderRows = (obj, tbodyId) => {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    tbody.innerHTML = Object.entries(obj).map(([k,v]) => `
      <tr style="border-bottom:1px solid var(--border)">
        <td style="padding:9px 14px;font-size:12px;color:var(--text2)">${k}${k==='請假扣款'&&leaveNote?`<div style="font-size:10px;color:var(--text3);margin-top:2px">${leaveNote}</div>`:''}${k==='工程獎金'&&engBonusNote?`<div style="font-size:10px;color:var(--text3);margin-top:2px">${engBonusNote}</div>`:''}</td>
        <td style="padding:9px 14px;text-align:right;font-family:'DM Mono',monospace;font-size:12px">$${(v||0).toLocaleString('zh-TW')}</td>
      </tr>`).join('');
  };
  renderRows(a, 'pr-salary-tbody');
  renderRows(b, 'pr-bonus-tbody');
  renderRows(c, 'pr-deduct-tbody');

  const aTotal = Object.values(a).reduce((s,v)=>s+(v||0),0);
  const bTotal = Object.values(b).reduce((s,v)=>s+(v||0),0);
  const cTotal = Object.values(c).reduce((s,v)=>s+(v||0),0);
  const net    = aTotal + bTotal - cTotal;
  const advance= rec?.advancePaid || 0;
  const set = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
  set('pr-a-total',   '$'+aTotal.toLocaleString('zh-TW'));
  set('pr-b-total',   '$'+bTotal.toLocaleString('zh-TW'));
  set('pr-c-total',   '$'+cTotal.toLocaleString('zh-TW'));
  set('pr-net-pay',   '$'+net.toLocaleString('zh-TW'));
  set('pr-advance',   '$'+advance.toLocaleString('zh-TW'));
  set('pr-transfer',  '$'+(net-advance).toLocaleString('zh-TW'));
  set('pr-pay-date',  rec?.payDate || '—');
  const noteEl = document.getElementById('pr-note-display');
  if (noteEl) noteEl.innerHTML = rec?.note
    ? `備註：${rec.note}`
    : previousRec
      ? `本月尚未建立正式薪資；固定薪資與保險暫時承接 ${previousRec.month}，變動項目待出勤草稿與人工覆核。`
      : '';
  renderPayrollRangeOverview();
  renderOwnerWithdrawalPanel();
}

function openEditPayroll() {
  if (!requireManage('payroll', '您只有查看薪資的權限')) return;
  const month = document.getElementById('pr-filter-month')?.value || '2026-03';
  const cfg   = prGetConfig(prCurrentEmp);
  const rec   = PAYROLL.find(r=>r.person===prCurrentEmp && r.month===month);
  const t = document.getElementById('pr-modal-title');
  const i = document.getElementById('pr-modal-info');
  if (t) t.textContent = `${cfg?.name||''} ${month} 薪資單`;
  const bankEl = document.getElementById('pr-bank'); if (bankEl) bankEl.value = cfg?.bank||'';
  const acctEl = document.getElementById('pr-account'); if (acctEl) acctEl.value = cfg?.account||'';
  const fill = (id, val) => { const el=document.getElementById(id); if(el) el.value=(val||0); };
  // 若該月尚無紀錄，找最近一個有紀錄的月份當作預設值（用修改的比較快）
  let src = rec;
  if (!src) {
    const prevRecs = PAYROLL.filter(r=>r.person===prCurrentEmp && r.month < month).sort((a,b)=>b.month.localeCompare(a.month));
    src = prevRecs[0] || cfg || {};
  }
  src = src || cfg || {};
  fill('pr-baseSalary',         src.baseSalary||cfg?.baseSalary||0);
  fill('pr-phoneAllowance',     src.phoneAllowance||cfg?.phoneAllowance||0);
  fill('pr-fullAttendanceBonus',src.fullAttendanceBonus||cfg?.fullAttendanceBonus||0);
  fill('pr-dutyAllowance',      src.dutyAllowance||cfg?.dutyAllowance||0);
  fill('pr-performanceBonus',   src.performanceBonus||cfg?.performanceBonus||0);
  fill('pr-mealAllowance',      src.mealAllowance||cfg?.mealAllowance||0);
  fill('pr-overtimePay',        rec?.overtimePay||0);
  fill('pr-expenseReimbursement',rec?.expenseReimbursement||0);
  fill('pr-yearEndBonus',       rec?.yearEndBonus||0);
  fill('pr-engineeringBonus',   rec?.engineeringBonus||0);
  const ebnEl = document.getElementById('pr-engineeringBonusNote');
  if (ebnEl) ebnEl.value = rec?.engineeringBonusNote||'';
  prRenderCustomItems(rec?.customItems||[]);
  fill('pr-laborInsurance',     src.laborInsurance||cfg?.laborInsurance||0);
  fill('pr-healthInsurance',    src.healthInsurance||cfg?.healthInsurance||0);
  fill('pr-voluntaryPension',   src.voluntaryPension||0);
  fill('pr-leaveDeduction',     rec?.leaveDeduction||0);
  const lnEl = document.getElementById('pr-leaveNote');
  if (lnEl) lnEl.value = rec?.leaveNote||'';
  fill('pr-advancePaid',        rec?.advancePaid||0);
  const pdEl = document.getElementById('pr-payDate');
  if (pdEl) pdEl.value = rec?.payDate||'';
  const ntEl = document.getElementById('pr-note');
  if (ntEl) ntEl.value = rec?.note||'';
  openModal('modal-edit-payroll');
  setTimeout(prLiveCalc, 50);
}

function prRenderCustomItems(items) {
  const box = document.getElementById('pr-custom-items');
  if (!box) return;
  box.innerHTML = (items||[]).map((it,idx) => `
    <div style="display:flex;gap:8px;margin-bottom:6px" data-custom-row="${idx}">
      <input class="form-input" placeholder="項目名稱" value="${(it.name||'').replace(/"/g,'&quot;')}" style="flex:2">
      <input class="form-input" placeholder="金額" value="${it.amount||0}" style="flex:1">
      <button type="button" class="btn btn-ghost btn-sm" onclick="this.parentElement.remove()">刪除</button>
    </div>`).join('');
}

function prAddCustomItem() {
  const box = document.getElementById('pr-custom-items');
  if (!box) return;
  const div = document.createElement('div');
  div.style.cssText = 'display:flex;gap:8px;margin-bottom:6px';
  div.innerHTML = `
    <input class="form-input" placeholder="項目名稱" style="flex:2">
    <input class="form-input" placeholder="金額" style="flex:1">
    <button type="button" class="btn btn-ghost btn-sm" onclick="this.parentElement.remove()">刪除</button>`;
  box.appendChild(div);
}

function prGetCustomItems() {
  const box = document.getElementById('pr-custom-items');
  if (!box) return [];
  return [...box.children].map(row => {
    const inputs = row.querySelectorAll('input');
    const name = inputs[0]?.value.trim() || '';
    const amount = parseInt((inputs[1]?.value||'0').replace(/[^0-9-]/g,'')) || 0;
    return { name, amount };
  }).filter(it => it.name);
}

function submitPayroll() {
  if (!requireManage('payroll', '您只有查看薪資的權限')) return;
  const month  = document.getElementById('pr-filter-month')?.value || '2026-03';
  const p = v => parseInt((document.getElementById(v)?.value||'0').replace(/[^0-9]/g,''))||0;
  const s = v => document.getElementById(v)?.value||'';
  const existing = PAYROLL.find(r=>r.person===prCurrentEmp && r.month===month);
  const data = {
    person:prCurrentEmp, month,
    payDate:              s('pr-payDate'),
    baseSalary:           p('pr-baseSalary'),
    phoneAllowance:       p('pr-phoneAllowance'),
    fullAttendanceBonus:  p('pr-fullAttendanceBonus'),
    dutyAllowance:        p('pr-dutyAllowance'),
    performanceBonus:     p('pr-performanceBonus'),
    mealAllowance:        p('pr-mealAllowance'),
    overtimePay:          p('pr-overtimePay'),
    expenseReimbursement: p('pr-expenseReimbursement'),
    yearEndBonus:         p('pr-yearEndBonus'),
    engineeringBonus:     p('pr-engineeringBonus'),
    engineeringBonusNote: s('pr-engineeringBonusNote'),
    customItems:          prGetCustomItems(),
    laborInsurance:       p('pr-laborInsurance'),
    healthInsurance:      p('pr-healthInsurance'),
    voluntaryPension:     p('pr-voluntaryPension'),
    leaveDeduction:       p('pr-leaveDeduction'),
    leaveNote:            s('pr-leaveNote'),
    advancePaid:          p('pr-advancePaid'),
    note:                 s('pr-note'),
  };
  if (existing) { Object.assign(existing, data); }
  else          { PAYROLL.push({id:prNextId++, ...data}); }
  const bank = s('pr-bank').trim();
  const account = s('pr-account').trim();
  const emp = EMPLOYEES.find(e => e.id === prCurrentEmp);
  const beforeAccount = emp ? {
    bank: emp.payrollBank || '',
    accountLast4: emp.payrollAccount ? String(emp.payrollAccount).slice(-4) : '',
    hasAccount: !!emp.payrollAccount
  } : null;
  if (emp) {
    emp.payrollBank = bank;
    emp.payrollAccount = account;
    if (!Object.prototype.hasOwnProperty.call(emp, 'payrollBranch')) emp.payrollBranch = '';
    if (!Object.prototype.hasOwnProperty.call(emp, 'payrollAccountName')) emp.payrollAccountName = emp.name || '';
  }
  PAYROLL_EMPLOYEE_ACCOUNTS[prCurrentEmp] = { bank, account };
  if (PR_CONFIG[prCurrentEmp]) {
    PR_CONFIG[prCurrentEmp].bank = bank;
    PR_CONFIG[prCurrentEmp].account = account;
  }
  const afterAccount = {
    bank,
    accountLast4: account ? account.slice(-4) : '',
    hasAccount: !!account
  };
  if (JSON.stringify(beforeAccount) !== JSON.stringify(afterAccount)) {
    recordAuditLog('update', 'employeePayrollAccount', prCurrentEmp, beforeAccount, afterAccount, {
      targetLabel: emp?.name || prCurrentEmp,
      reason: '薪資模組更新員工匯款帳戶',
      riskLevel: 'high'
    });
  }
  closeModal('modal-edit-payroll');
  renderPayroll();
  saveData();
  showToast('薪資單已儲存 ✓','success');
}

function printPayslip() {
  const month = document.getElementById('pr-filter-month')?.value || '';
  const cfg = PR_CONFIG[prCurrentEmp] || {};
  const p = v => parseInt((document.getElementById(v)?.value||'0').replace(/[^0-9]/g,''))||0;
  const s = v => document.getElementById(v)?.value||'';
  const a = {底薪:p('pr-baseSalary'),油資電話津貼:p('pr-phoneAllowance'),全勤獎金:p('pr-fullAttendanceBonus'),職務津貼:p('pr-dutyAllowance'),績效獎金:p('pr-performanceBonus'),誤餐費:p('pr-mealAllowance')};
  const b = {加班費:p('pr-overtimePay'),費用墊支:p('pr-expenseReimbursement'),年終獎金:p('pr-yearEndBonus'),工程獎金:p('pr-engineeringBonus')};
  prGetCustomItems().forEach(it => { b[it.name] = it.amount; });
  const c = {勞保費:p('pr-laborInsurance'),健保費:p('pr-healthInsurance'),自願提撥退休金:p('pr-voluntaryPension'),請假扣款:p('pr-leaveDeduction')};
  const aTotal = Object.values(a).reduce((x,y)=>x+y,0);
  const bTotal = Object.values(b).reduce((x,y)=>x+y,0);
  const cTotal = Object.values(c).reduce((x,y)=>x+y,0);
  const net = aTotal + bTotal - cTotal;
  const advance = p('pr-advancePaid');
  const transfer = net - advance;
  const leaveNote = s('pr-leaveNote');
  const row = (k,v) => `<tr><td class="lbl">${k}</td><td class="val">$${(v||0).toLocaleString('zh-TW')}</td></tr>`;
  const win = window.open('', '_blank');
  win.document.write(`
    <html><head><title>${cfg.name||''} ${month} 薪資單</title>
    <meta charset="utf-8">
    <style>
      * { box-sizing:border-box }
      body{font-family:'Helvetica Neue','PingFang TC','Microsoft JhengHei',sans-serif;padding:36px;color:#2b2b2b;max-width:760px;margin:0 auto}
      .doc-header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #2b2b2b;padding-bottom:14px;margin-bottom:18px}
      .doc-header .company{font-size:20px;font-weight:700;letter-spacing:.05em}
      .doc-header .company small{display:block;font-size:11px;font-weight:400;color:#888;letter-spacing:.1em;margin-top:2px}
      .doc-header .title{text-align:right}
      .doc-header .title h1{font-size:17px;margin:0}
      .doc-header .title div{font-size:12px;color:#888;margin-top:2px}
      .meta{display:flex;justify-content:space-between;font-size:12px;color:#555;margin-bottom:18px;padding:10px 14px;background:#f7f7f7;border-radius:6px}
      .grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:14px}
      .section{border:1px solid #ddd;border-radius:6px;overflow:hidden}
      .section h2{margin:0;padding:8px 12px;font-size:12px;font-weight:700;background:#f0f0f0;border-bottom:1px solid #ddd;letter-spacing:.05em}
      table{border-collapse:collapse;width:100%;font-size:12.5px}
      td{padding:7px 12px;border-bottom:1px solid #eee}
      .lbl{color:#555}
      .val{text-align:right;font-family:'DM Mono',monospace}
      .total td{font-weight:700;background:#fafafa;border-top:1px solid #ddd;border-bottom:none}
      .note{padding:6px 12px;font-size:11px;color:#888;background:#fcfcfc}
      .summary{margin-top:6px;border:1px solid #2b2b2b;border-radius:6px;overflow:hidden}
      .summary table{font-size:13px}
      .summary .total td{font-size:15px;background:#fff8e6}
      .remark{margin-top:14px;font-size:12px;color:#555}
      .sign{margin-top:32px;display:flex;gap:60px;font-size:13px}
      .sign div{flex:1;border-top:1px solid #999;padding-top:6px;color:#555}
      @page{ size:A4; margin:10mm }
      @media print{ body{padding:0;max-width:none} .doc-header,.meta,.grid3,.summary,.remark,.sign{page-break-inside:avoid} }
    </style></head><body>
      <div class="doc-header">
        <div class="company">宇德室內裝修股份有限公司<small>YUTE INTERIOR DESIGN CO., LTD.</small></div>
        <div class="title"><h1>員工薪資單</h1><div>Payroll Statement</div></div>
      </div>
      <div class="meta">
        <div>姓名：<b>${cfg.name||''}</b>　職稱：${cfg.role||''}</div>
        <div>薪資月份：<b>${month}</b></div>
        <div>入帳銀行：${s('pr-bank')||'—'}　帳號：${s('pr-account')||'—'}</div>
      </div>
      <div class="grid3">
        <div class="section">
          <h2>薪資結構 (A)</h2>
          <table>
            ${Object.entries(a).map(([k,v])=>row(k,v)).join('')}
            <tr class="total">${row('小計 A', aTotal)}</tr>
          </table>
        </div>
        <div class="section">
          <h2>非固定項目 (B)</h2>
          <table>
            ${Object.entries(b).map(([k,v])=>row(k,v)).join('')}
            <tr class="total">${row('小計 B', bTotal)}</tr>
          </table>
          ${s('pr-engineeringBonusNote') ? `<div class="note">工程獎金備註：${s('pr-engineeringBonusNote')}</div>` : ''}
        </div>
        <div class="section">
          <h2>應代扣項目 (C)</h2>
          <table>
            ${Object.entries(c).map(([k,v])=>row(k,v)).join('')}
            <tr class="total">${row('小計 C', cTotal)}</tr>
          </table>
          ${leaveNote ? `<div class="note">請假備註：${leaveNote}</div>` : ''}
        </div>
      </div>
      <div class="summary">
        <table>
          <tr class="total">${row('實領金額 (A+B-C)', net)}</tr>
          ${row('扣除已領金額', advance)}
          <tr class="total">${row('本次應匯款金額', transfer)}</tr>
          <tr><td class="lbl">發薪日</td><td class="val" style="font-family:inherit">${s('pr-payDate') || '—'}</td></tr>
        </table>
      </div>
      ${s('pr-note') ? `<div class="remark">備註：${s('pr-note')}</div>` : ''}
      <div class="sign"><div>員工簽收</div><div>主管核發</div></div>
      <script>window.print()<\/script>
    </body></html>`);
  win.document.close();
}
