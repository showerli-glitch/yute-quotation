// PROFIT SHARE MODULE. Extracted verbatim from ops/index.html at main@3bf6549.

// ══════════════════════════════════
// PROFIT SHARE DATA（分潤 — 與淨利潤儀表板連動）
// ══════════════════════════════════
// 各案件依 CASES[].profitSplit 標記分潤類型，依下列比例分配「個案毛利」
// 原則：李鎮宇 60% / 彭俞豪 20% / 連星羽 20%；
// 文威豐由連星羽帶進來的案子，改為李 40% / 彭 20% / 連 40%
const PROFIT_SPLIT_RATIOS = {
  '三人':   { shower: 0.6, peng: 0.2, lien: 0.2 },
  '李連6040': { shower: 0.4, peng: 0.2, lien: 0.4 },
  '李':     { shower: 1 },
  '自訂':   {},
  '不分潤': {},
};
const PROFIT_SHARE_PERSON_NAMES = { shower:'李鎮宇', peng:'彭俞豪', lien:'連星羽' };


function psParticipantList() {
  const owner = { id:'shower', name:'李鎮宇' };
  const employees = EMPLOYEES.filter(e => e.profitEligible && empEffectiveStatus(e) !== '已離職')
    .map(e => ({ id:e.id, name:e.name }));
  return [owner, ...employees.filter(e => e.id !== owner.id)];
}

function psPersonName(id) {
  return PROFIT_SHARE_PERSON_NAMES[id] || EMPLOYEES.find(e => e.id === id)?.name || id;
}

function psRatioLabel(ratios) {
  const entries = Object.entries(ratios || {}).filter(([,ratio]) => ratio > 0);
  if (!entries.length) return '不分潤（全數留公司）';
  return entries.map(([id,ratio]) => `${psPersonName(id)} ${Math.round(ratio*1000)/10}%`).join('／');
}

// 個案的結算基準日：取 psSettledThrough 與 PROFIT_SETTLEMENTS 裡包含本案的最近一次結算日期，
// 兩者較晚者。增量結算功能上線前的結算沒有寫入 psSettledThrough，不能直接退回 closedDate，
// 否則「結案後才結算」的個案，結案到結算之間已經分過的款項會被當成新交易重算；欄位停在較早
// 日期時也不能遮蔽較新的結算紀錄。psSettledThrough 可能晚於結算紀錄日期（例：上洋嘉義結算日
// 2025-09-30、尾款與分潤 2025-10-15 才收付清），所以取較晚者。兩者都沒有才退回 closedDate。
function psCaseSettlementCutoff(c) {
  if (!c) return '';
  const latestSettlementDate = (Array.isArray(PROFIT_SETTLEMENTS) ? PROFIT_SETTLEMENTS : [])
    .filter(s => (s.cases || []).some(x => x.code === c.code))
    .map(s => String(s.date || ''))
    .filter(Boolean)
    .sort()
    .pop();
  const candidates = [c.psSettledThrough, latestSettlementDate].filter(Boolean).sort();
  return candidates.pop() || c.closedDate || '';
}

function psIsProfitSettlementCase(c) {
  if (!(c && c.profitSplit && !c.excludeFromProfitReports && (c.splitRatio || PROFIT_SPLIT_RATIOS[c.profitSplit]))) return false;
  if (!c.psSettled) return true;
  // 已經結算過的個案，只有在結算基準日之後又有新的已收款／已付款／費用（例如保固款、保留款這種
  // 結案後才進帳的款項），才代表有新增毛利可以再跑一次增量結算；沒有結算基準日的舊資料維持原本
  // 「結算過就不再出現」的行為，避免把舊資料意外判定成可再結算。
  const cutoff = psCaseSettlementCutoff(c);
  if (!cutoff) return false;
  return RECEIVABLES.some(r => r.case === c.code && receivableIsCollected(r) && String(r.collectDate||'') > cutoff)
    || PAYABLES.some(p => p.case === c.code && p.status === 'paid' && isProjectCostPayment(p) && String(p.doneDate||'') > cutoff)
    || EXPENSES.some(e => e.caseKey === c.code && e.status === 'approved' && e.postCloseTreatment !== 'company_absorb' && String(e.date || (e.month ? e.month+'-01' : '') || '') > cutoff);
}

// 預留營業所得稅率（可調整，預設3%）
let PS_TAX_RATE = 0.03;
// 已結算紀錄（每次結算鎖定的個案/開銷月份與結果快照）
let PROFIT_SETTLEMENTS = [];
// 本次結算暫選的個案（未選=全部未結算個案）；開銷月份範圍
let PS_SELECTED_CASES = null;
let PS_OH_START = null, PS_OH_END = null;
const PS_INITIAL_OVERHEAD_LOCKED_THROUGH = '2025-09';

function psSettlementCutoffMonth() {
  const months = new Set([PS_INITIAL_OVERHEAD_LOCKED_THROUGH]);
  Object.entries(OVERHEAD || {}).forEach(([month, data]) => {
    if (prIsValidMonth(month) && data?.settled) months.add(month);
  });
  PROFIT_SETTLEMENTS.forEach(settlement => {
    (settlement.ohMonths || []).forEach(item => {
      const month = typeof item === 'string' ? item : item?.month;
      if (prIsValidMonth(month) && !item?.postCloseOnly) months.add(month);
    });
  });
  return [...months].filter(prIsValidMonth).sort().pop() || '';
}

function psAvailableOverheadMonths() {
  const cutoff = psSettlementCutoffMonth();
  return Object.keys(OVERHEAD || {}).filter(month => prIsValidMonth(month) && (!cutoff || month > cutoff)).sort();
}

function psNormalizeOhRange(months) {
  if (!Array.isArray(months) || !months.length) {
    if (PS_OH_START && !prIsValidMonth(PS_OH_START)) PS_OH_START = null;
    if (PS_OH_END && !prIsValidMonth(PS_OH_END)) PS_OH_END = null;
    return;
  }
  if (PS_OH_START && !months.includes(PS_OH_START)) PS_OH_START = months[0];
  if (PS_OH_END && !months.includes(PS_OH_END)) PS_OH_END = months[months.length - 1];
  if (PS_OH_START && PS_OH_END && PS_OH_START > PS_OH_END) PS_OH_END = PS_OH_START;
}

function psSetTaxRate(val) {
  if (!requireManage('profitshare')) return;
  const pct = Math.max(0, Math.min(100, parseFloat(val) || 0));
  PS_TAX_RATE = pct / 100;
  renderProfitShare();
  saveData();
}

function psToggleCase(code, checked) {
  if (!requireManage('profitshare')) return;
  if (!Array.isArray(PS_SELECTED_CASES)) {
    PS_SELECTED_CASES = CASES.filter(psIsProfitSettlementCase).map(c => c.code);
  }
  if (checked) {
    if (!PS_SELECTED_CASES.includes(code)) PS_SELECTED_CASES.push(code);
  } else {
    PS_SELECTED_CASES = PS_SELECTED_CASES.filter(x => x !== code);
  }
  renderProfitShare();
}

function psSetOhRange(which, val) {
  if (!requireManage('profitshare')) return;
  if (which === 'start') PS_OH_START = val; else PS_OH_END = val;
  renderProfitShare();
}

function psRunSettlement() {
  if (!requireManage('profitshare')) return;
  if (!confirm('結算後，本次納入的個案與公司開銷月份將被鎖定，無法再被下次結算重複計算，確定要執行嗎？')) return;
  const result = psComputeData();
  if (!result.caseRows.length) { showToast('沒有可結算的個案','error'); return; }
  const beforeSummary = auditSummary();
  const settlementId = PROFIT_SETTLEMENTS.reduce((m,s)=>Math.max(m,s.id||0),0) + 1;
  const settlementDate = localDateKey();
  const caseCodes = result.caseRows.map(c => c.code);
  const postCloseAdjustmentApplications = [];
  result.rows.forEach(r => {
    let remaining = r.adjustment || 0;
    result.postCloseAdjustments.filter(x => x.person === r.person).forEach(detail => {
      if (remaining <= 0) return;
      const expense = EXPENSES.find(e => e.id === detail.expenseId);
      if (!expense) return;
      const applied = Math.min(remaining, detail.outstanding);
      expense.profitAdjustmentApplied = expense.profitAdjustmentApplied || {};
      expense.profitAdjustmentApplied[r.person] = (expense.profitAdjustmentApplied[r.person] || 0) + applied;
      postCloseAdjustmentApplications.push({ expenseId:expense.id, person:r.person, amount:applied });
      remaining -= applied;
    });
  });
  const generatedPayables = result.rows.filter(r => r.unpaid > 0.5).map(r => ({
    ...buildProfitSettlementPayable({ id:settlementId, date:settlementDate, cases:caseCodes.map(code => ({ code })) }, r),
    profitCaseCodes:caseCodes.slice()
  })).filter(Boolean);
  generatedPayables.forEach(row => touchRowMeta(row, true));
  PAYABLES.push(...generatedPayables);
  PROFIT_SETTLEMENTS.push({
    id: settlementId,
    date: settlementDate,
    cases: result.caseRows.map(c => ({ code:c.code, name:c.name, gross:c.gross, ohRatio:c.ohRatio, ohShare:c.ohShare, preTaxNet:c.preTaxNet, taxReserve:c.taxReserve, caseNet:c.caseNet, invoiceTotal:c.invoiceTotal })),
    ohMonths: result.ohMonths,
    overheadTotal: result.overheadTotal,
    grandGross: result.grandGross,
    grandPreTaxNet: result.grandPreTaxNet,
    grandNet: result.grandNet,
    grandTax: result.grandTax,
    persons: result.rows.map(r => ({ person:r.person, name:r.name, net:r.net, salary:r.salary, bonus:r.bonus, adjustment:r.adjustment, unpaid:r.unpaid })),
    postCloseAdjustmentApplications,
    advancePayableIds: result.profitPayables.map(r => r.id),
    generatedPayableIds: generatedPayables.map(r => r.id),
    claimMonths: result.claimMonths,
    taxRate: PS_TAX_RATE,
  });
  result.caseRows.forEach(c => {
    const cs = CASES.find(x=>x.code===c.code);
    if (cs) {
      cs.psSettled = true;
      cs.status = '結案';
      cs.closedDate = cs.closedDate || settlementDate;
      // 每次結算（含增量結算）都要往前推進結算基準日，下次再有新款項進帳時，
      // 才知道要從這裡開始算新的，不會又把這次剛分完的重算一次。
      cs.psSettledThrough = settlementDate;
    }
  });
  result.ohMonths.forEach(m => {
    const data = OVERHEAD[m.month];
    if (!data) return;
    if (!m.postCloseOnly) data.settled = true;
    (data.variable || []).forEach(v => {
      if ((m.postCloseVariableIds || []).includes(v.id)) v.postCloseSettled = true;
    });
  });
  result.profitPayables.forEach(r => { r.psSettled = true; });
  PS_SELECTED_CASES = null;
  PS_OH_START = null; PS_OH_END = null;
  recordAuditLog('settle', 'profitSettlement', settlementId, beforeSummary, auditSummary(), {
    riskLevel:'critical',
    targetLabel:`分潤結算 #${settlementId}`,
    diff:[
      { field:'caseCount', beforeValue:0, afterValue:result.caseRows.length },
      { field:'generatedPayables', beforeValue:0, afterValue:generatedPayables.length },
      { field:'grandNet', beforeValue:null, afterValue:result.grandNet },
      { field:'grandTax', beforeValue:null, afterValue:result.grandTax }
    ]
  });
  renderProfitShare(); renderPayable(); renderPayreq(); renderCases(); renderDashboard();
  saveData();
  showToast(`結算完成，已建立 ${generatedPayables.length} 筆待付分潤款 ✓`,'success');
}

function psUndoSettlement(id) {
  if (!requireManage('profitshare')) return;
  const settlement = PROFIT_SETTLEMENTS.find(s => s.id === id);
  if (!settlement) return;
  const before = auditClone(settlement);
  const generatedIds = settlement.generatedPayableIds || [];
  const generated = PAYABLES.filter(p => generatedIds.includes(p.id));
  if (generated.some(p => p.status === 'paid')) {
    showToast('本次結算已有分潤款付款，不能撤銷','error');
    return;
  }
  if (!confirm(`確定撤銷 ${settlement.date} 的分潤結算？尚未付款的系統結算款將一併移除。`)) return;
  settlement.cases.forEach(item => {
    const c = CASES.find(x => x.code === item.code);
    if (c) { c.psSettled = false; c.status = '完工'; }
  });
  settlement.ohMonths.forEach(item => {
    const data = OVERHEAD[item.month];
    if (!data) return;
    if (!item.postCloseOnly) data.settled = false;
    (data.variable || []).forEach(v => {
      if ((item.postCloseVariableIds || []).includes(v.id)) v.postCloseSettled = false;
    });
  });
  (settlement.postCloseAdjustmentApplications || []).forEach(app => {
    const expense = EXPENSES.find(e => e.id === app.expenseId);
    if (!expense?.profitAdjustmentApplied) return;
    expense.profitAdjustmentApplied[app.person] = Math.max(0, (expense.profitAdjustmentApplied[app.person] || 0) - app.amount);
  });
  const advanceIds = settlement.advancePayableIds || settlement.profitPayableIds || [];
  PAYABLES.forEach(p => { if (advanceIds.includes(p.id)) p.psSettled = false; });
  PAYABLES = PAYABLES.filter(p => !generatedIds.includes(p.id));
  const idx = PROFIT_SETTLEMENTS.findIndex(s => s.id === id);
  if (idx >= 0) PROFIT_SETTLEMENTS.splice(idx, 1);
  PS_SELECTED_CASES = null;
  recordAuditLog('void', 'profitSettlement', id, before, null, {
    riskLevel:'critical',
    targetLabel:`撤銷分潤結算 #${id}`
  });
  renderProfitShare(); renderPayable(); renderPayreq(); renderCases(); renderDashboard();
  saveData();
  showToast('已撤銷結算並還原資料','success');
}

// 取得案件分潤比例：優先用案件自訂的 splitRatio，否則用 profitSplit 預設值
function psGetSplitRatio(c) {
  return c.splitRatio || PROFIT_SPLIT_RATIOS[c.profitSplit] || PROFIT_SPLIT_RATIOS['三人'];
}

// 調整單一案件的分潤比例（輸入百分比，自動套用至 splitRatio 並儲存）
function psSetRatio(code, person, val) {
  if (!requireManage('profitshare')) return;
  const c = CASES.find(x => x.code === code);
  if (!c) return;
  const pct = Math.max(0, Math.min(100, parseFloat(val) || 0));
  const cur = { ...psGetSplitRatio(c) };
  cur[person] = pct / 100;
  c.profitSplit = '自訂';
  c.splitRatio = cur;
  renderProfitShare();
  saveData();
}

function psOpenProfitParticipantModal() {
  if (!requireManage('employees', '請先到員工管理開通分潤人員')) return;
  navTo('employees', document.getElementById('nav-employees'));
  setTimeout(() => {
    openEmployeeModal();
    const profitEl = document.getElementById('emp-f-profitEligible');
    if (profitEl) profitEl.checked = true;
    const accessEl = document.getElementById('emp-f-accessRole');
    if (accessEl && !accessEl.value) accessEl.value = 'none';
  }, 50);
}

function psSetProfitMode(code, mode) {
  if (!requireManage('profitshare')) return;
  const c = CASES.find(x => x.code === code);
  if (!c || c.psSettled) return;
  if (mode === '自訂') {
    const currentRatios = { ...psGetSplitRatio(c) };
    c.profitSplit = '自訂';
    c.splitRatio = currentRatios;
  } else if (mode) {
    c.profitSplit = mode;
    delete c.splitRatio;
  } else {
    delete c.profitSplit;
    delete c.splitRatio;
  }
  PS_SELECTED_CASES = null;
  renderProfitShare();
  saveData();
}

// 薪資依公司開銷月份歸屬；工程獎金與分潤款改讀取已付款的應付帳款。
function psPersonPaidTotal(person, monthKeys) {
  const months = new Set(monthKeys || []);
  if (person === 'peng' || person === 'lien') {
    // 連星羽、彭俞豪月領視為預支自己分潤；分潤這裡一律用底薪 35,000 計算，
    // 不受薪資系統實際代扣勞健保金額影響（正式薪資單仍照實際代扣，僅分潤預支基準固定用底薪）。
    const paidMonths = new Set(PAYROLL.filter(r => r.person === person && months.has(r.month)).map(r => r.month));
    return paidMonths.size * 35000;
  }
  return PAYROLL.filter(r => r.person === person && months.has(r.month)).reduce((s,r) => {
    const a = (r.baseSalary||0)+(r.phoneAllowance||0)+(r.fullAttendanceBonus||0)+(r.dutyAllowance||0)+(r.performanceBonus||0)+(r.mealAllowance||0);
    const b = (r.overtimePay||0)+(r.expenseReimbursement||0)+(r.yearEndBonus||0);
    const c = (r.laborInsurance||0)+(r.healthInsurance||0)+(r.voluntaryPension||0)+(r.leaveDeduction||0);
    return s + (a+b-c);
  }, 0);
}

function isProfitSharePayout(row) {
  if (!row || row.status !== 'paid') return false;
  if (PROFIT_PAYMENT_TYPES[row.paymentType]) return true;
  return row.paymentType === 'shareholder_distribution' && profitOffsetPerson(row) === 'shower';
}

function psProfitPayoutBelongsToCurrentBatch(row, selectedCaseCodes = null) {
  if (!isProfitSharePayout(row)) return false;
  // 歷史結清款只屬於原結算，不得再扣目前尚未結算案件。
  if (row.paymentType === 'profit_settlement' || row.psSettled) return false;
  const linkedCodes = [...new Set([...(row.profitCaseCodes || []), row.case].filter(Boolean))];
  if (!linkedCodes.length) return true; // 未指定案件的未沖抵預領，留給下一批結算。
  const unsettledLinkedCodes = linkedCodes.filter(code => {
    const linkedCase = CASES.find(c => c.code === code);
    return linkedCase && !linkedCase.psSettled;
  });
  if (!unsettledLinkedCodes.length) return false;
  if (!Array.isArray(selectedCaseCodes)) return true;
  const selected = new Set(selectedCaseCodes);
  return unsettledLinkedCodes.some(code => selected.has(code));
}

function psUnsettledProfitPayables(person = '', selectedCaseCodes = null) {
  return PAYABLES
    .filter(r => psProfitPayoutBelongsToCurrentBatch(r, selectedCaseCodes) && (!person || profitOffsetPerson(r) === person))
    .map(r => {
      const amount = Number(r.amount) || 0;
      const offset = Number(r.profitSettlementOffsetAmount) || 0;
      const remaining = Math.max(0, amount - offset);
      if (remaining <= 0.5) return null;
      return remaining === amount ? r : { ...r, amount: remaining };
    })
    .filter(Boolean);
}

function psPayrollBreakdown(monthKeys) {
  const months = new Set(monthKeys || []);
  return Object.entries(PR_CONFIG).map(([person,cfg]) => {
    const records = PAYROLL.filter(r => r.person === person && months.has(r.month));
    const total = records.reduce((s,r) => {
      const a = (r.baseSalary||0)+(r.phoneAllowance||0)+(r.fullAttendanceBonus||0)+(r.dutyAllowance||0)+(r.performanceBonus||0)+(r.mealAllowance||0);
      const b = (r.overtimePay||0)+(r.expenseReimbursement||0)+(r.yearEndBonus||0)+(r.engineeringBonus||0)+(r.customItems||[]).reduce((x,it)=>x+(it.amount||0),0);
      const c = (r.laborInsurance||0)+(r.healthInsurance||0)+(r.voluntaryPension||0)+(r.leaveDeduction||0);
      return s + a + b - c;
    }, 0);
    return { person, name:cfg.name, months:records.length, total };
  });
}

// 計算薪資模組中營運員工在某月的實領總額（計入公司開銷的員工薪資）
function psPayrollSum(month) {
  return PAYROLL.filter(r => r.month === month && isOperatingPayrollPerson(r.person))
    .reduce((s,r) => s + payrollNetAmount(r), 0);
}

function psOutstandingPostCloseAdjustments() {
  const byPerson = {};
  const details = [];
  EXPENSES.filter(e => e.status === 'approved' && e.postCloseTreatment === 'post_close_cost').forEach(e => {
    e.profitAdjustmentShares = e.profitAdjustmentShares || expPostCloseShares(e.caseKey, e.amount || 0);
    e.profitAdjustmentApplied = e.profitAdjustmentApplied || {};
    Object.entries(e.profitAdjustmentShares).forEach(([person,total]) => {
      const outstanding = Math.max(0, total - (e.profitAdjustmentApplied[person] || 0));
      if (outstanding <= 0) return;
      byPerson[person] = (byPerson[person] || 0) + outstanding;
      details.push({ expenseId:e.id, caseKey:e.caseKey, caseName:e.caseName, item:e.item, person, total, outstanding });
    });
  });
  return { byPerson, details };
}

// 本次分潤結算的核心計算：個案毛利／開銷分攤／個案淨利／人員分潤
function psComputeData() {
  const rvPaid = RECEIVABLES.filter(receivableIsCollected);
  // 分潤結清款、預領、股東分配等不是個案成本（分潤款另由 psUnsettledProfitPayables 抵扣），
  // 只取 isProjectCostPayment 的工程成本付款，避免結算後才付的分潤款被當成增量成本重扣。
  const pyPaid = PAYABLES.filter(p => p.status === 'paid' && isProjectCostPayment(p));
  const expApproved = EXPENSES.filter(e => e.status === 'approved' && e.caseKey !== '固定開銷' && e.postCloseTreatment !== 'company_absorb');
  const salaryIdx = OH_FIXED_CONFIG.indexOf('員工薪資');

  const unsettledCases = dashboardSortCasesLikeOverview(CASES.filter(psIsProfitSettlementCase));
  const selectedCodes = Array.isArray(PS_SELECTED_CASES) ? PS_SELECTED_CASES : unsettledCases.map(c=>c.code);
  const selectedCases = unsettledCases.filter(c => selectedCodes.includes(c.code));

  let grandGross = 0;
  const baseRows = selectedCases.map(c => {
    // 個案結算過一次之後（psSettled），若後續又有新的已收款／已付款／費用（例如保固款、保留款
    // 這種結案後才進帳的款項），這個案會再次被 psIsProfitSettlementCase 選入可結算名單，這裡就要
    // 只算「結算基準日之後」新增的部分，不能連同上次已經分過的舊金額一起重算一次。
    // 結算基準日由 psCaseSettlementCutoff 決定（psSettledThrough → 最近一次結算日期 → closedDate）；
    // 未結算過的個案 cutoff 為空字串＝全部都算，行為跟以前一樣。
    const cutoff = c.psSettled ? psCaseSettlementCutoff(c) : '';
    const isIncrementalRound = !!cutoff;
    const rvRows = rvPaid.filter(r => r.case === c.code && (!cutoff || String(r.collectDate||'') > cutoff));
    const pyRows = pyPaid.filter(p => p.case === c.code && (!cutoff || String(p.doneDate||'') > cutoff));
    const expRows = expApproved.filter(e => e.caseKey === c.code && (!cutoff || String(e.date || (e.month ? e.month+'-01' : '') || '') > cutoff));
    // 歷史核對用的 override（revenueOverride 等）是第一次結算時的精確對帳快照，不適用於增量這一輪，
    // 一律改用即時數字重算，只算 cutoff 之後的新交易。
    const useOverride = shouldUseCaseFinancialOverride(c) && !isIncrementalRound;
    const recordedRevenue = rvRows.reduce((s,r) => s + (r.collectAmt||0), 0);
    const recordedCost = pyRows.reduce((s,p) => s + (p.amount||0), 0);
    const revenue = useOverride && Number.isFinite(c.revenueOverride) ? c.revenueOverride : recordedRevenue;
    const cost    = useOverride && Number.isFinite(c.vendorCostOverride) ? c.vendorCostOverride : recordedCost;
    const expCost = expRows.reduce((s,e) => s + (e.amount||0), 0);
    const calculatedTaxCost = rvRows.reduce((s,r) => s + ((r.invoiceAmt||0)/1.05*0.05/2), 0);
    const taxCost = (useOverride && Number.isFinite(c.taxCostOverride)) ? c.taxCostOverride : calculatedTaxCost;
    const calculatedGross = revenue - cost - expCost - taxCost;
    const gross   = useOverride && Number.isFinite(c.grossOverride) ? c.grossOverride : calculatedGross;
    const invoiceTotal = rvRows.reduce((s,r) => s + (r.invoiceAmt||0), 0);
    grandGross += gross;
    // 增量這一輪依政策確認：不套用原本那次結算的固定開銷／稅務 override 數字（那些數字已經在第一次
    // 結算時用掉了），一律當作「沒有 override」，開銷份額固定為 0、稅務照這批正常比例重新預留。
    const fixedOverheadShare = isIncrementalRound ? 0 : c.fixedOverheadShare;
    const taxReserveOverride = isIncrementalRound ? undefined : c.taxReserveOverride;
    return {
      code:c.code, name:c.name, gross, calculatedGross, invoiceTotal, ratios:psGetSplitRatio(c),
      fixedOverheadShare, taxReserveOverride, isIncrementalRound,
      reconciliationNote:c.reconciliationNote || ''
    };
  });

  // 已鎖定的公司開銷月份不再出現在後續結算，避免重複計算。
  const allMonths = psAvailableOverheadMonths();
  psNormalizeOhRange(allMonths);
  const inRange = m => (!PS_OH_START || m >= PS_OH_START) && (!PS_OH_END || m <= PS_OH_END);
  const monthKeys = allMonths.filter(inRange);
  const ohMonths = monthKeys.map(m => {
    const data = OVERHEAD[m];
    const postCloseOnly = !!data.settled;
    const vars = postCloseOnly
      ? (data.variable || []).filter(v => v.postClosePending && !v.postCloseSettled)
      : (data.variable || []).filter(v => !v.postCloseSettled);
    const fixedSum = postCloseOnly ? 0 : (data.fixed||[]).reduce((s,v,i) => s + (i===salaryIdx ? 0 : (parseInt(v)||0)), 0);
    const varSum = vars.reduce((s,v) => s + (v.amount||0), 0);
    const payroll = postCloseOnly ? 0 : psPayrollSum(m);
    return {
      month:m, fixed:fixedSum, variable:varSum, payroll, total:fixedSum + varSum + payroll,
      postCloseOnly, postCloseVariableIds:vars.filter(v => v.postClosePending).map(v => v.id)
    };
  });
  const dynamicOverheadTotal = ohMonths.reduce((s,m) => s + m.total, 0);
  const fixedOverheadRows = baseRows.filter(c => Number.isFinite(c.fixedOverheadShare) && c.fixedOverheadShare > 0).map(c => ({
    month:`${c.name}歷史分攤`, fixed:0, variable:c.fixedOverheadShare, payroll:0, total:c.fixedOverheadShare,
    historicalCaseCode:c.code, postCloseOnly:true, postCloseVariableIds:[]
  }));
  ohMonths.push(...fixedOverheadRows);
  const overheadTotal = dynamicOverheadTotal + fixedOverheadRows.reduce((s,m) => s + m.total, 0);
  const claimMonths = monthKeys.length
    ? (monthKeys[0] === monthKeys[monthKeys.length - 1] ? monthKeys[0] : `${monthKeys[0]} ～ ${monthKeys[monthKeys.length - 1]}`)
    : '無月份';

  const allocatableGross = baseRows
    .filter(c => !Number.isFinite(c.fixedOverheadShare) && c.gross > 0)
    .reduce((s,c) => s + c.gross, 0);
  // 本批個案若全部虧損（沒有任何毛利為正的個案可以吸收開銷），開銷仍是公司實際成本，
  // 不能悄悄從結算數字中消失、也不能算進公司承擔。改用虧損金額佔比分攤到各虧損個案，
  // 這樣該筆開銷還是會併入該案的 caseNet，最後仍依「這個案自己的」分潤比例分給分潤人——
  // 不是跨案用混合權重分攤，虧損吸收比例維持跟該案原本的分潤比例一致。
  const lossAllocatableAbsGross = allocatableGross > 0 ? 0 : baseRows
    .filter(c => !Number.isFinite(c.fixedOverheadShare) && c.gross < 0)
    .reduce((s,c) => s + Math.abs(c.gross), 0);
  const taxAllocatableRows = baseRows.filter(c => !Number.isFinite(c.taxReserveOverride) && c.gross > 0);
  const taxAllocatableGross = taxAllocatableRows.reduce((s,c) => s + c.gross, 0);
  const defaultTaxReserveTotal = -baseRows
    .filter(c => !Number.isFinite(c.taxReserveOverride))
    .reduce((s,c) => s + c.invoiceTotal, 0) * PS_TAX_RATE;
  const caseRows = baseRows.map(c => {
    const hasFixedOverhead = Number.isFinite(c.fixedOverheadShare);
    const participatesOverhead = !hasFixedOverhead && c.gross > 0 && allocatableGross > 0;
    const participatesLossOverhead = !hasFixedOverhead && !participatesOverhead && c.gross < 0 && lossAllocatableAbsGross > 0;
    const ohRatio = hasFixedOverhead ? 0
      : participatesOverhead ? c.gross / allocatableGross
      : participatesLossOverhead ? Math.abs(c.gross) / lossAllocatableAbsGross
      : 0;
    const ohShare = hasFixedOverhead ? -c.fixedOverheadShare : ((participatesOverhead || participatesLossOverhead) ? -ohRatio * dynamicOverheadTotal : 0);
    const preTaxNet = c.gross + ohShare;
    const taxRatio = (!Number.isFinite(c.taxReserveOverride) && c.gross > 0 && taxAllocatableGross > 0) ? c.gross / taxAllocatableGross : 0;
    const taxReserve = Number.isFinite(c.taxReserveOverride) ? -Math.abs(c.taxReserveOverride) : defaultTaxReserveTotal * taxRatio;
    const caseNet = preTaxNet + taxReserve;
    return { ...c, ohRatio, ohShare, preTaxNet, taxReserve, caseNet };
  });
  // 極端情況：本批個案毛利全部剛好是 0（既無正毛利、也無虧損可分攤），開銷仍會無處可去；
  // 這種情況機率極低，保留一個最後防線，依分潤人於本批個案的分潤比例加總權重分攤，避免憑空消失。
  const fullyUnallocatedOverhead = (allocatableGross <= 0 && lossAllocatableAbsGross <= 0) ? dynamicOverheadTotal : 0;
  const grandPreTaxNet = caseRows.reduce((s,c) => s + c.preTaxNet, 0) - fullyUnallocatedOverhead;
  const grandNet = caseRows.reduce((s,c) => s + c.caseNet, 0) - fullyUnallocatedOverhead;
  const grandTax = caseRows.reduce((s,c) => s + c.taxReserve, 0);
  const grandInvoice = caseRows.reduce((s,c) => s + c.invoiceTotal, 0);

  const participants = psParticipantList();
  const personGross = Object.fromEntries(participants.map(p => [p.id, 0]));
  caseRows.forEach(c => Object.entries(c.ratios).forEach(([p,r]) => {
    if (!(p in personGross)) personGross[p] = 0;
    personGross[p] += c.caseNet * r;
  }));
  if (fullyUnallocatedOverhead > 0) {
    const ratioWeight = {};
    caseRows.forEach(c => Object.entries(c.ratios).forEach(([p,r]) => { ratioWeight[p] = (ratioWeight[p] || 0) + r; }));
    const weightSum = Object.values(ratioWeight).reduce((s,v) => s + v, 0);
    if (weightSum > 0) {
      Object.entries(ratioWeight).forEach(([p,w]) => {
        if (!(p in personGross)) personGross[p] = 0;
        personGross[p] -= fullyUnallocatedOverhead * (w / weightSum);
      });
    }
  }
  const persons = [...new Set([...participants.map(p => p.id), ...Object.keys(personGross)])];
  const profitPayables = psUnsettledProfitPayables('', selectedCodes);
  const adjustments = psOutstandingPostCloseAdjustments();
  const rows = persons.map(p => {
    const net = personGross[p];
    const salary = (p === 'peng' || p === 'lien') ? psPersonPaidTotal(p, monthKeys) : 0;
    const personPayables = profitPayables.filter(r => r.profitPerson === p);
    const bonus = personPayables.reduce((s,r) => s + (r.amount||0), 0);
    const availableBeforeAdjustment = net - salary - bonus;
    const outstandingAdjustment = adjustments.byPerson[p] || 0;
    const adjustment = Math.min(Math.max(0, availableBeforeAdjustment), outstandingAdjustment);
    const adv = { salary, bonus, adjustment, outstandingAdjustment, note: `薪資 ${claimMonths}：${salary.toLocaleString('zh-TW')}；已付款分潤款：${bonus.toLocaleString('zh-TW')}；結案後抵扣：${adjustment.toLocaleString('zh-TW')}` };
    const unpaidRaw = availableBeforeAdjustment - adjustment;
    const unpaid = Math.abs(unpaidRaw) < 0.5 ? 0 : unpaidRaw;
    return { person:p, name:psPersonName(p), net, ...adv, unpaid };
  });
  const payrollBreakdown = psPayrollBreakdown(monthKeys);
  const payrollGrandTotal = payrollBreakdown.reduce((s,r) => s + r.total, 0);
  const allocatedProfit = rows.reduce((s,r) => s + r.net, 0);
  const companyRetained = grandNet - allocatedProfit;

  return { caseRows, ohMonths, overheadTotal, grandGross, grandPreTaxNet, grandNet, grandTax, grandInvoice, rows, unsettledCases, selectedCodes, claimMonths, payrollBreakdown, payrollGrandTotal, allocatedProfit, companyRetained, profitPayables, postCloseAdjustments:adjustments.details };
}

// ══════════════════════════════════
// PROFIT SHARE MODULE
// ══════════════════════════════════
let psPayoutSettledCollapsed = localStorage.getItem('yutesign-ops-profitshare-payout-settled-collapsed') !== '0';
function psTogglePayoutSettled() {
  psPayoutSettledCollapsed = !psPayoutSettledCollapsed;
  localStorage.setItem('yutesign-ops-profitshare-payout-settled-collapsed', psPayoutSettledCollapsed ? '1' : '0');
  renderProfitShare();
}

// 開銷月份清單常常包含還沒發生的未來月份（例如員工薪資排到很後面月份、固定開銷先建好空白月），
// 預設收折未來月份，只顯示已發生（含當月）的，避免清單看起來很長又沒意義。
let psOhFutureCollapsed = localStorage.getItem('yutesign-ops-profitshare-oh-future-collapsed') !== '0';
function psToggleOhFuture() {
  psOhFutureCollapsed = !psOhFutureCollapsed;
  localStorage.setItem('yutesign-ops-profitshare-oh-future-collapsed', psOhFutureCollapsed ? '1' : '0');
  renderProfitShare();
}

function renderProfitShare() {
  const container = document.getElementById('ps-container');
  if (!container) return;
  const canSeeAll = ['OWNER','FINANCE'].includes(currentUser.roleCode);
  const fmt = n => {
    const rounded = Math.round(Number(n) || 0);
    return (rounded < 0 ? '-' : '') + '$' + Math.abs(rounded).toLocaleString('zh-TW');
  };
  const esc = text => String(text || '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const compactPayoutNote = r => {
    const raw = String(r.note || r.summary || '').trim();
    const parts = [];
    const date = raw.match(/\d{4}-\d{2}-\d{2}/)?.[0];
    if (date) parts.push(date);
    if (raw.includes('已付清')) parts.push('已付清');
    if (raw.includes('已納入結算') || r.psSettled) parts.push('已納入結算');
    if (raw.includes('尾款')) parts.push((raw.match(/尾款\s*[\d,]+/) || ['尾款'])[0]);
    if (raw.includes('預付款記錄')) parts.push('來源：預付款記錄');
    if (raw.includes('歷史結算')) parts.push('歷史結算');
    if (!parts.length) parts.push(raw.slice(0, 48));
    return parts.filter(Boolean).join('／');
  };

  const data = psComputeData();
  const { caseRows, ohMonths, overheadTotal, grandGross, grandPreTaxNet, grandNet, grandTax, grandInvoice, rows, unsettledCases, claimMonths, payrollBreakdown, payrollGrandTotal, allocatedProfit, companyRetained, profitPayables } = data;

  // ── 人員分潤總覽 ──
  const visibleRows = canSeeAll ? rows : rows.filter(r => r.person === currentUser.id);
  const personRowsHtml = visibleRows.map(r => `
    <tr style="border-bottom:1px solid var(--border)">
      <td style="padding:8px 14px;font-size:12px;font-weight:600">${r.name}</td>
      <td style="padding:8px 14px;text-align:right;font-family:'DM Mono',monospace;font-size:12px;font-weight:700;color:${r.net < 0 ? 'var(--error)' : 'var(--success)'}">${fmt(r.net)}</td>
      <td style="padding:8px 14px;text-align:right;font-family:'DM Mono',monospace;font-size:12px">${(r.salary||r.bonus) ? fmt(r.salary + r.bonus) : '—'}</td>
      <td style="padding:8px 14px;text-align:right;font-family:'DM Mono',monospace;font-size:12px;color:${r.adjustment?'var(--error)':'var(--text3)'}">${r.adjustment ? fmt(-r.adjustment) : '—'}</td>
      <td style="padding:8px 14px;text-align:right;font-family:'DM Mono',monospace;font-size:12px;font-weight:700;${r.unpaid ? 'color:var(--warning)' : ''}">${fmt(r.unpaid)}</td>
      <td style="padding:8px 14px;font-size:11px;color:var(--text3)">${r.note || ''}</td>
    </tr>`).join('');

  const personTable = `
    <div style="border:1px solid var(--border);border-radius:8px;overflow:hidden">
      <div style="padding:10px 14px;background:var(--surface2);font-size:13px;font-weight:600">人員分潤／虧損承擔（依稅後個案淨利 × 分潤比例計算）</div>
      <table style="width:100%;border-collapse:collapse">
        <thead><tr style="border-bottom:1px solid var(--border2)">
          <th style="padding:8px 14px;text-align:left;font-size:11px;color:var(--text3)">人員</th>
          <th style="padding:8px 14px;text-align:right;font-size:11px;color:var(--text3)">分潤／承擔</th>
          <th style="padding:8px 14px;text-align:right;font-size:11px;color:var(--text3)">本批已請領</th>
          <th style="padding:8px 14px;text-align:right;font-size:11px;color:var(--text3)">結案後抵扣</th>
          <th style="padding:8px 14px;text-align:right;font-size:11px;color:var(--text3)">未領</th>
          <th style="padding:8px 14px;text-align:left;font-size:11px;color:var(--text3)">備註</th>
        </tr></thead>
        <tbody>${personRowsHtml}</tbody>
      </table>
      ${canSeeAll ? `<div style="padding:8px 14px;font-size:11px;color:var(--text3)">稅前個案淨利：<b style="color:var(--text)">${fmt(grandPreTaxNet)}</b>　預留營業所得稅：<b style="color:var(--error)">${fmt(grandTax)}</b>　稅後個案淨利：<b style="color:var(--success)">${fmt(grandNet)}</b></div>` : ''}
    </div>`;

  const allProfitPayables = PAYABLES.filter(isProfitSharePayout);
  const visibleProfitPayables = canSeeAll ? allProfitPayables : allProfitPayables.filter(r => profitOffsetPerson(r) === currentUser.id);
  const payoutSortMode = document.getElementById('ps-payout-sort')?.value || 'date-desc';
  const payoutDateGetter = r => r.doneDate || r.transferDate || r.wantDate || '';
  const payoutPersonGetter = r => psPersonName(profitOffsetPerson(r)) || r.vendor || '';
  const sortPayouts = list => sortOpsRows(list, payoutSortMode, payoutDateGetter, payoutPersonGetter, r => r.amount || 0);
  const renderPayoutRow = r => {
    const noteFull = `${r.note||r.summary||''}${r.psSettled?' · 已納入結算':''}`;
    const noteShort = compactPayoutNote(r);
    return `
    <tr style="border-bottom:1px solid var(--border)">
      <td style="padding:8px 12px;font-size:12px;white-space:normal;line-height:1.35">${r.doneDate||r.transferDate||r.wantDate||'—'}</td>
      ${canSeeAll ? `<td style="padding:8px 12px;font-size:12px;white-space:normal;line-height:1.35">${psPersonName(profitOffsetPerson(r))||r.vendor||'—'}</td>` : ''}
      <td style="padding:8px 12px;font-size:12px;white-space:normal;line-height:1.35">${PROFIT_PAYMENT_TYPES[r.paymentType]||SPECIAL_PAYMENT_TYPES[r.paymentType]||'分潤款'}</td>
      <td style="padding:7px 12px;text-align:right;font-family:'DM Mono',monospace;font-size:12px">${fmt(r.amount||0)}</td>
      <td style="padding:8px 12px;font-size:11px;color:var(--text2);white-space:normal;line-height:1.55">${(r.profitCaseCodes||[]).map(code => CASES.find(c=>c.code===code)?.name || code).join('、') || '未指定'}</td>
      <td style="padding:8px 12px;font-size:11px;color:var(--text3);white-space:normal;line-height:1.6;overflow-wrap:anywhere" title="${esc(noteFull)}">
        <div style="display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden">${esc(noteShort)}</div>
      </td>
    </tr>`;
  };
  const payoutColspan = canSeeAll ? 6 : 5;
  // 已納入結算的領款紀錄會隨時間持續累積；預設收折只顯示未結算，避免清單無限變長。
  const unsettledPayables = sortPayouts(visibleProfitPayables.filter(r => !r.psSettled));
  const settledPayables = sortPayouts(visibleProfitPayables.filter(r => r.psSettled));
  const payoutRows = unsettledPayables.map(renderPayoutRow).join('') + (settledPayables.length ? `
    <tr><td colspan="${payoutColspan}" style="padding:5px 14px;border-top:2px solid var(--border2);background:var(--surface2);font-size:11px;color:var(--text3)">
      <div style="display:flex;align-items:center;gap:8px"><span>已結算領款（${settledPayables.length}）</span><button type="button" class="btn btn-ghost btn-sm" onclick="psTogglePayoutSettled()" style="font-size:10px;padding:2px 8px">${psPayoutSettledCollapsed ? '展開 ▾' : '收折 ▴'}</button></div>
    </td></tr>${psPayoutSettledCollapsed ? '' : settledPayables.map(renderPayoutRow).join('')}` : '');
  const payoutTable = `
    <div style="margin-top:14px;border:1px solid var(--border);border-radius:8px;overflow:hidden">
      <div style="padding:10px 14px;background:var(--surface2);font-size:13px;font-weight:600;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
        <span>分潤領款紀錄（來自已付款應付帳款）</span>
        <select class="filter-select" id="ps-payout-sort" onchange="renderProfitShare()" style="height:28px;min-width:148px;font-size:12px">
          <option value="date-desc">日期新到舊</option>
          <option value="date-asc">日期舊到新</option>
          ${canSeeAll ? '<option value="person-asc">領款人 A→Z</option>' : ''}
          <option value="amount-desc">金額高到低</option>
        </select>
      </div>
      <div style="overflow-x:auto">
      <table style="width:100%;min-width:${canSeeAll ? 1020 : 930}px;table-layout:fixed;border-collapse:collapse">
        <colgroup>
          <col style="width:78px">
          ${canSeeAll ? '<col style="width:78px">' : ''}
          <col style="width:82px">
          <col style="width:112px">
          <col style="width:210px">
          <col>
        </colgroup>
        <thead><tr style="border-bottom:1px solid var(--border2)">
          <th style="padding:7px 12px;text-align:left;font-size:11px;color:var(--text3)">付款日</th>
          ${canSeeAll ? '<th style="padding:7px 12px;text-align:left;font-size:11px;color:var(--text3)">領款人</th>' : ''}
          <th style="padding:7px 12px;text-align:left;font-size:11px;color:var(--text3)">性質</th>
          <th style="padding:7px 12px;text-align:right;font-size:11px;color:var(--text3)">金額</th>
          <th style="padding:7px 12px;text-align:left;font-size:11px;color:var(--text3)">關聯個案</th>
          <th style="padding:7px 12px;text-align:left;font-size:11px;color:var(--text3)">備註</th>
        </tr></thead>
        <tbody>${payoutRows || `<tr><td colspan="${payoutColspan}" style="padding:14px;text-align:center;color:var(--text3);font-size:12px">尚無分潤領款紀錄</td></tr>`}</tbody>
      </table>
      </div>
    </div>`;

  if (!canSeeAll) {
    const myCaseRows = caseRows.filter(c => (c.ratios[currentUser.id] || 0) > 0);
    const myCaseRowsHtml = myCaseRows.map(c => `
      <tr style="border-bottom:1px solid var(--border)">
        <td style="padding:8px 14px;font-size:12px">${c.name}</td>
        <td style="padding:8px 14px;text-align:right;font-family:'DM Mono',monospace;font-size:12px;font-weight:700;color:var(--accent)">${Math.round((c.ratios[currentUser.id] || 0) * 1000) / 10}%</td>
        <td style="padding:8px 14px;text-align:right;font-family:'DM Mono',monospace;font-size:12px">${fmt(c.gross)}</td>
        <td style="padding:8px 14px;text-align:right;font-family:'DM Mono',monospace;font-size:12px;color:var(--text3)">${(c.ohRatio*100).toFixed(2)}%</td>
        <td style="padding:8px 14px;text-align:right;font-family:'DM Mono',monospace;font-size:12px;color:var(--error)">${fmt(c.ohShare)}</td>
        <td style="padding:8px 14px;text-align:right;font-family:'DM Mono',monospace;font-size:12px;font-weight:700">${fmt(c.preTaxNet)}</td>
        <td style="padding:8px 14px;text-align:right;font-family:'DM Mono',monospace;font-size:12px">${fmt(c.invoiceTotal)}</td>
        <td style="padding:8px 14px;text-align:right;font-family:'DM Mono',monospace;font-size:12px;color:var(--error)">${fmt(c.taxReserve)}</td>
        <td style="padding:8px 14px;text-align:right;font-family:'DM Mono',monospace;font-size:12px;font-weight:700;color:var(--success)">${fmt(c.caseNet)}</td>
      </tr>`).join('') || `<tr><td colspan="9" style="text-align:center;padding:20px;color:var(--text3);font-size:12px">本次結算範圍內沒有您參與分潤的個案</td></tr>`;
    const myCaseTable = `
      <div style="border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-bottom:14px">
        <div style="padding:10px 14px;background:var(--surface2);font-size:13px;font-weight:600">個案淨利明細（本次結算範圍）</div>
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="border-bottom:1px solid var(--border2)">
            <th style="padding:8px 14px;text-align:left;font-size:11px;color:var(--text3)">個案名稱</th>
            <th style="padding:8px 14px;text-align:right;font-size:11px;color:var(--text3)">我的分潤比例</th>
            <th style="padding:8px 14px;text-align:right;font-size:11px;color:var(--text3)">毛利</th>
            <th style="padding:8px 14px;text-align:right;font-size:11px;color:var(--text3)">開銷佔比</th>
            <th style="padding:8px 14px;text-align:right;font-size:11px;color:var(--text3)">開銷</th>
            <th style="padding:8px 14px;text-align:right;font-size:11px;color:var(--text3)">稅前個案淨利</th>
            <th style="padding:8px 14px;text-align:right;font-size:11px;color:var(--text3)">總銷售額(發票)</th>
            <th style="padding:8px 14px;text-align:right;font-size:11px;color:var(--text3)">預留營業所得稅</th>
            <th style="padding:8px 14px;text-align:right;font-size:11px;color:var(--text3)">稅後個案淨利</th>
          </tr></thead>
          <tbody>${myCaseRowsHtml}</tbody>
        </table>
      </div>`;

    // 已全部領完的結算款不再列在這裡——那筆錢已經是「已付款」的應付帳款，
    // 對應的紀錄會出現在下面的「分潤領款紀錄」；這張表只留「還有金額待領」的，
    // 才不會跟領款紀錄顯示同一筆資料，卻在這裡永遠停在 $0。
    const mySettlementPayables = PAYABLES
      .filter(p => p.paymentType === 'profit_settlement' && p.profitPerson === currentUser.id && p.systemLocked)
      .filter(p => (p.status === 'paid' ? 0 : (Number(p.amount) || 0)) > 0)
      .sort((a,b) => String(b.wantDate||b.transferDate||b.doneDate||'').localeCompare(String(a.wantDate||a.transferDate||a.doneDate||'')));
    const mySettlementRows = mySettlementPayables.map(p => {
      const original = Number(p.originalSettlementAmount) || (Number(p.amount) || 0) + (Number(p.settlementOffsetAmount) || 0);
      const offset = Number(p.settlementOffsetAmount) || 0;
      const remaining = Number(p.amount) || 0;
      const caseNames = (p.profitCaseCodes || []).map(code => CASES.find(c => c.code === code)?.name || code).join('、') || p.caseName || '結算款';
      const statusText = '待領';
      return `
        <tr style="border-bottom:1px solid var(--border)">
          <td style="padding:8px 12px;font-size:12px;white-space:normal;line-height:1.45">${p.wantDate||p.transferDate||p.doneDate||'—'}</td>
          <td style="padding:8px 12px;text-align:right;font-family:'DM Mono',monospace;font-size:12px;font-weight:700;color:${remaining ? 'var(--warning)' : 'var(--success)'}">${fmt(remaining)}</td>
          <td style="padding:8px 12px;text-align:right;font-family:'DM Mono',monospace;font-size:12px;color:var(--text2)">${offset ? fmt(offset) : '—'}</td>
          <td style="padding:8px 12px;text-align:right;font-family:'DM Mono',monospace;font-size:12px;color:var(--text3)">${fmt(original)}</td>
          <td style="padding:8px 12px;font-size:11px;color:var(--text2);white-space:normal;line-height:1.55">${esc(caseNames)}</td>
          <td style="padding:8px 12px;text-align:center;font-size:12px"><span class="tag ${remaining ? 'tag-active' : 'tag-done'}">${statusText}</span></td>
        </tr>`;
    }).join('');
    const mySettlementTable = `
      <div style="margin-top:14px;border:1px solid var(--border);border-radius:8px;overflow:hidden">
        <div style="padding:10px 14px;background:var(--surface2);font-size:13px;font-weight:600">分潤結算待領（來自結算後應付帳款）</div>
        <div style="overflow-x:auto">
          <table style="width:100%;min-width:860px;table-layout:fixed;border-collapse:collapse">
            <colgroup>
              <col style="width:92px">
              <col style="width:120px">
              <col style="width:120px">
              <col style="width:120px">
              <col>
              <col style="width:92px">
            </colgroup>
            <thead><tr style="border-bottom:1px solid var(--border2)">
              <th style="padding:7px 12px;text-align:left;font-size:11px;color:var(--text3)">結算日</th>
              <th style="padding:7px 12px;text-align:right;font-size:11px;color:var(--text3)">目前待領</th>
              <th style="padding:7px 12px;text-align:right;font-size:11px;color:var(--text3)">已沖抵</th>
              <th style="padding:7px 12px;text-align:right;font-size:11px;color:var(--text3)">原結算額</th>
              <th style="padding:7px 12px;text-align:left;font-size:11px;color:var(--text3)">關聯個案</th>
              <th style="padding:7px 12px;text-align:center;font-size:11px;color:var(--text3)">狀態</th>
            </tr></thead>
            <tbody>${mySettlementRows || `<tr><td colspan="6" style="padding:14px;text-align:center;color:var(--text3);font-size:12px">尚無已產生的分潤結算待領款</td></tr>`}</tbody>
          </table>
        </div>
      </div>`;

    container.innerHTML = myCaseTable + personTable + mySettlementTable + payoutTable + `
      <div style="margin-top:10px;font-size:11px;color:var(--text3)">
        ※ 分潤／承擔＝稅後個案淨利（毛利扣除公司開銷分攤與預留營業所得稅）× 您在該案的分潤比例；負數代表需由後續分潤抵扣。
      </div>`;
    return;
  }

  // ── 結算設定區 ──
  const allMonths = psAvailableOverheadMonths();
  psNormalizeOhRange(allMonths);
  const lockedThrough = psSettlementCutoffMonth();
  const modeCases = dashboardSortCasesLikeOverview(CASES.filter(c => !c.psSettled && !c.excludeFromProfitReports));
  const modeParticipants = psParticipantList();
  const modeOptions = [
    ['', '未設定'],
    ['三人', psRatioLabel(PROFIT_SPLIT_RATIOS['三人'])],
    ['李連6040', psRatioLabel(PROFIT_SPLIT_RATIOS['李連6040'])],
    ['李', psRatioLabel(PROFIT_SPLIT_RATIOS['李'])],
    ['自訂', '自訂人員與比例'],
    ['不分潤', '不分潤（全數留公司）'],
  ];
  const modeRows = modeCases.map(c => {
    const ratios = psGetSplitRatio(c);
    const ratioInputs = c.profitSplit === '自訂' ? `<div style="display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-top:6px">
      ${modeParticipants.map(p => `<label style="font-size:11px;color:var(--text3);white-space:nowrap">${p.name} <input type="number" min="0" max="100" step="0.1" value="${Math.round((ratios[p.id] || 0) * 1000) / 10}" onchange="psSetRatio('${c.code}','${p.id}',this.value)" style="width:62px;text-align:right;background:transparent;border:1px solid var(--border);border-radius:4px;font-family:'DM Mono',monospace;font-size:12px;padding:3px 5px;color:var(--text)">%</label>`).join('')}
    </div>` : '';
    return `
    <tr style="border-bottom:1px solid var(--border)">
      <td style="padding:7px 12px;font-size:12px">${c.name}<div style="font-size:10px;color:var(--text3);font-family:'DM Mono',monospace">${c.code}</div></td>
      <td style="padding:7px 12px;text-align:right">
        <select onchange="psSetProfitMode('${c.code}',this.value)" style="min-width:310px;max-width:100%;font-size:12px;padding:4px 7px;border:1px solid var(--border);border-radius:5px;background:var(--surface);color:var(--text)">
          ${modeOptions.map(([v,label]) => `<option value="${v}" ${(c.profitSplit||'')===v?'selected':''}>${label}</option>`).join('')}
        </select>
        ${ratioInputs}
      </td>
    </tr>`;
  }).join('');
  const modePanel = `
    <div style="border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-bottom:14px">
      <div style="padding:10px 14px;background:var(--surface2);display:flex;justify-content:space-between;align-items:center;gap:10px"><span style="font-size:13px;font-weight:600">個案分潤模式與比例</span><button class="btn btn-ghost btn-sm" onclick="psOpenProfitParticipantModal()">＋ 新增分潤人員</button></div>
      <div style="padding:8px 14px;font-size:11px;color:var(--text3)">選擇預設模式即套用對應比例；選「自訂」時直接在同一列調整各人百分比。親友、維修、代開發票、私人借支等成本追蹤案不進員工分潤。</div>
      <table style="width:100%;border-collapse:collapse"><tbody>${modeRows || '<tr><td style="padding:14px;color:var(--text3);font-size:12px">目前沒有待設定的分潤個案</td></tr>'}</tbody></table>
    </div>`;
  const selectedCodes = data.selectedCodes;
  const caseChecks = unsettledCases.map(c => `
    <label style="display:inline-flex;align-items:center;gap:4px;font-size:12px;margin:2px 10px 2px 0">
      <input type="checkbox" ${selectedCodes.includes(c.code)?'checked':''} onchange="psToggleCase('${c.code}',this.checked)"> ${c.name}
    </label>`).join('');
  const monthOpts = (sel) => allMonths.map(m => `<option value="${m}" ${m===sel?'selected':''}>${m}</option>`).join('');
  const settleBar = `
    <div style="border:1px solid var(--border);border-radius:8px;padding:12px 14px;margin-bottom:14px">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px">
        <span style="font-size:12px;color:var(--text3)">預留營業所得稅率</span>
        <input type="number" min="0" max="100" step="0.1" value="${(PS_TAX_RATE*100).toFixed(1)}"
          style="width:60px;text-align:right;background:transparent;border:1px solid var(--border);border-radius:4px;font-family:'DM Mono',monospace;font-size:12px;padding:3px 5px;color:var(--text)"
          onchange="psSetTaxRate(this.value)"> %
        <span style="color:var(--border);padding:0 6px">│</span>
        <span style="font-size:12px;color:var(--text3)">公司開銷／月薪歸屬月份範圍</span>
        <select onchange="psSetOhRange('start',this.value)" style="font-size:12px;padding:3px 6px;border:1px solid var(--border);border-radius:4px;background:transparent;color:var(--text)">
          <option value="">全部</option>${monthOpts(PS_OH_START)}
        </select> ～
        <select onchange="psSetOhRange('end',this.value)" style="font-size:12px;padding:3px 6px;border:1px solid var(--border);border-radius:4px;background:transparent;color:var(--text)">
          <option value="">全部</option>${monthOpts(PS_OH_END)}
        </select>
      </div>
      <div style="font-size:11px;color:var(--text3);margin:-2px 0 8px">目前同步月份：${claimMonths}。已鎖定至：${lockedThrough || '尚未鎖定'}；選單只顯示未結算月份。彭／連月薪依此範圍歸屬；只有尚未歸屬歷史結算、且屬於本次所選案件的已付款預領會列入「本批已請領」。</div>
      <div style="margin-bottom:8px">
        <div style="font-size:12px;color:var(--text3);margin-bottom:4px">納入本次結算的個案：</div>
        ${caseChecks || '<span style="font-size:12px;color:var(--text3)">沒有可結算的個案</span>'}
      </div>
      <button class="btn btn-primary btn-sm" onclick="psRunSettlement()" ${caseRows.length?'':'disabled'}>執行結算並鎖定</button>
      <span style="font-size:11px;color:var(--text3);margin-left:8px">結算後，所選個案與開銷月份將被鎖定，避免重複計算。</span>
    </div>`;

  // ── 個案淨利明細表（仿原試算表格式）──
  const caseRowsHtml = caseRows.map(c => `
    <tr style="border-bottom:1px solid var(--border)">
      <td style="padding:8px 14px;font-size:12px">${c.name}</td>
      <td style="padding:8px 14px;text-align:right;font-family:'DM Mono',monospace;font-size:12px">${fmt(c.gross)}</td>
      <td style="padding:8px 14px;text-align:right;font-family:'DM Mono',monospace;font-size:12px;color:var(--text3)">${(c.ohRatio*100).toFixed(2)}%</td>
      <td style="padding:8px 14px;text-align:right;font-family:'DM Mono',monospace;font-size:12px;color:var(--error)">${fmt(c.ohShare)}</td>
      <td style="padding:8px 14px;text-align:right;font-family:'DM Mono',monospace;font-size:12px;font-weight:700">${fmt(c.preTaxNet)}</td>
      <td style="padding:8px 14px;text-align:right;font-family:'DM Mono',monospace;font-size:12px">${fmt(c.invoiceTotal)}</td>
      <td style="padding:8px 14px;text-align:right;font-family:'DM Mono',monospace;font-size:12px;color:var(--error)">${fmt(c.taxReserve)}</td>
      <td style="padding:8px 14px;text-align:right;font-family:'DM Mono',monospace;font-size:12px;font-weight:700;color:var(--success)">${fmt(c.caseNet)}</td>
    </tr>`).join('') || `<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--text3);font-size:12px">沒有可顯示的個案</td></tr>`;

  const thisMonthKey = localDateKey().slice(0,7);
  const renderOhSideRow = m => `
    <tr style="border-bottom:1px solid var(--border)">
      <td style="padding:6px 14px;font-size:12px">${m.month}</td>
      <td style="padding:6px 14px;text-align:right;font-family:'DM Mono',monospace;font-size:12px">${fmt(m.total)}</td>
    </tr>`;
  const ohPastMonths = ohMonths.filter(m => m.month <= thisMonthKey);
  const ohFutureMonths = ohMonths.filter(m => m.month > thisMonthKey);
  const ohSideRows = ohPastMonths.map(renderOhSideRow).join('') + (ohFutureMonths.length ? `
    <tr><td colspan="2" style="padding:5px 14px;border-top:2px solid var(--border2);background:var(--surface2);font-size:11px;color:var(--text3)">
      <div style="display:flex;align-items:center;gap:8px"><span>未來月份（${ohFutureMonths.length}）</span><button type="button" class="btn btn-ghost btn-sm" onclick="psToggleOhFuture()" style="font-size:10px;padding:2px 8px">${psOhFutureCollapsed ? '展開 ▾' : '收折 ▴'}</button></div>
    </td></tr>${psOhFutureCollapsed ? '' : ohFutureMonths.map(renderOhSideRow).join('')}` : '')
    || `<tr><td colspan="2" style="text-align:center;padding:14px;color:var(--text3);font-size:12px">無未結算開銷月份</td></tr>`;

  const payrollRows = payrollBreakdown.map(p => `
    <tr style="border-bottom:1px solid var(--border)">
      <td style="padding:7px 12px;font-size:12px">${p.name}</td>
      <td style="padding:7px 12px;text-align:center;font-size:11px;color:var(--text3)">${p.months} 個月</td>
      <td style="padding:7px 12px;text-align:right;font-family:'DM Mono',monospace;font-size:12px">${fmt(p.total)}</td>
    </tr>`).join('');
  const companyOverview = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px">
      <div class="kpi-card"><div class="kpi-label">員工薪資加總</div><div class="kpi-val" style="font-size:18px">${fmt(payrollGrandTotal)}</div><div class="kpi-sub">${claimMonths}</div></div>
      <div class="kpi-card"><div class="kpi-label">公司開銷分攤</div><div class="kpi-val" style="font-size:18px;color:var(--error)">${fmt(overheadTotal)}</div><div class="kpi-sub">含營運薪資與固定開銷</div></div>
      <div class="kpi-card"><div class="kpi-label">個人分潤／承擔合計</div><div class="kpi-val" style="font-size:18px;color:${allocatedProfit < 0 ? 'var(--error)' : 'var(--accent)'}">${fmt(allocatedProfit)}</div><div class="kpi-sub">${psParticipantList().map(p=>p.name).join('／')}</div></div>
      <div class="kpi-card" style="border-color:var(--success);background:var(--success-bg)"><div class="kpi-label">公司保留淨利</div><div class="kpi-val" style="font-size:18px;color:var(--success)">${fmt(companyRetained)}</div><div class="kpi-sub">不分潤個案及未分配餘額</div></div>
    </div>
    <div style="margin-bottom:14px">
      <div style="border:1px solid var(--border);border-radius:8px;overflow:hidden">
        <div style="padding:10px 14px;background:var(--surface2);font-size:13px;font-weight:600">員工薪資加總</div>
        <table style="width:100%;border-collapse:collapse"><tbody>${payrollRows}</tbody>
          <tfoot><tr style="font-weight:700;border-top:1px solid var(--border)"><td style="padding:7px 12px">合計</td><td></td><td style="padding:7px 12px;text-align:right;font-family:'DM Mono',monospace">${fmt(payrollGrandTotal)}</td></tr></tfoot>
        </table>
      </div>
    </div>`;

  const mainSection = `
    <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start">
      <div style="flex:3;min-width:480px;border:1px solid var(--border);border-radius:8px;overflow:hidden">
        <div style="padding:10px 14px;background:var(--surface2);font-size:13px;font-weight:600">個案淨利明細（本次結算範圍）</div>
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="border-bottom:1px solid var(--border2)">
            <th style="padding:8px 14px;text-align:left;font-size:11px;color:var(--text3)">個案名稱</th>
            <th style="padding:8px 14px;text-align:right;font-size:11px;color:var(--text3)">毛利</th>
            <th style="padding:8px 14px;text-align:right;font-size:11px;color:var(--text3)">開銷佔比</th>
            <th style="padding:8px 14px;text-align:right;font-size:11px;color:var(--text3)">開銷</th>
            <th style="padding:8px 14px;text-align:right;font-size:11px;color:var(--text3)">稅前個案淨利</th>
            <th style="padding:8px 14px;text-align:right;font-size:11px;color:var(--text3)">總銷售額(發票)</th>
            <th style="padding:8px 14px;text-align:right;font-size:11px;color:var(--text3)">預留營業所得稅</th>
            <th style="padding:8px 14px;text-align:right;font-size:11px;color:var(--text3)">稅後個案淨利</th>
          </tr></thead>
          <tbody>${caseRowsHtml}</tbody>
          <tfoot><tr style="border-top:1px solid var(--border2);font-weight:700">
            <td style="padding:8px 14px;font-size:12px">小計</td>
            <td style="padding:8px 14px;text-align:right;font-family:'DM Mono',monospace;font-size:12px">${fmt(grandGross)}</td>
            <td></td>
            <td style="padding:8px 14px;text-align:right;font-family:'DM Mono',monospace;font-size:12px;color:var(--error)">${fmt(-overheadTotal)}</td>
            <td style="padding:8px 14px;text-align:right;font-family:'DM Mono',monospace;font-size:12px">${fmt(grandPreTaxNet)}</td>
            <td style="padding:8px 14px;text-align:right;font-family:'DM Mono',monospace;font-size:12px">${fmt(grandInvoice)}</td>
            <td style="padding:8px 14px;text-align:right;font-family:'DM Mono',monospace;font-size:12px;color:var(--error)">${fmt(grandTax)}</td>
            <td style="padding:8px 14px;text-align:right;font-family:'DM Mono',monospace;font-size:12px;color:var(--success)">${fmt(grandNet)}</td>
          </tr></tfoot>
        </table>
      </div>
      <div style="flex:1;min-width:200px;border:1px solid var(--border);border-radius:8px;overflow:hidden">
        <div style="padding:10px 14px;background:var(--surface2);font-size:13px;font-weight:600">公司開銷分攤月份（同步已請領薪資）</div>
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="border-bottom:1px solid var(--border2)">
            <th style="padding:6px 14px;text-align:left;font-size:11px;color:var(--text3)">月份</th>
            <th style="padding:6px 14px;text-align:right;font-size:11px;color:var(--text3)">金額</th>
          </tr></thead>
          <tbody>${ohSideRows}</tbody>
          <tfoot><tr style="border-top:1px solid var(--border2);font-weight:700">
            <td style="padding:6px 14px;font-size:12px">小計</td>
            <td style="padding:6px 14px;text-align:right;font-family:'DM Mono',monospace;font-size:12px;color:var(--error)">${fmt(overheadTotal)}</td>
          </tr></tfoot>
        </table>
      </div>
    </div>`;

  // ── 結算歷史 ──
  let historyHtml = '';
  if (PROFIT_SETTLEMENTS.length) {
    const rowsH = PROFIT_SETTLEMENTS.slice().reverse().map(s => {
      const generated = PAYABLES.filter(p => (s.generatedPayableIds || []).includes(p.id) || (p.settlementId === s.id && p.paymentType === 'profit_settlement'));
      const hasPaid = generated.some(p => p.status === 'paid');
      const generatedPeople = new Set(generated.filter(p => p.status !== 'rejected').map(p => p.profitPerson || p.vendor));
      const missingPayables = (s.persons || []).filter(p => (Number(p.unpaid) || 0) > 0.5 && !generatedPeople.has(p.person) && !generatedPeople.has(p.name));
      const personSummary = (s.persons || []).map(p => {
        const unpaid = Number(p.unpaid) || 0;
        const color = unpaid > 0.5 ? 'var(--warning)' : unpaid < -0.5 ? 'var(--error)' : 'var(--text3)';
        const state = unpaid > 0.5 ? '待建立/付款' : unpaid < -0.5 ? '後續抵扣' : '已結清';
        return `<div style="white-space:nowrap"><b>${p.name}</b>：<span style="font-family:'DM Mono',monospace;color:${color}">${fmt(unpaid)}</span><span style="color:var(--text3)"> ${state}</span></div>`;
      }).join('') || '<span style="color:var(--text3)">—</span>';
      const generatedSummary = generated.length
        ? generated.map(p => `<div style="white-space:nowrap"><b>${p.vendor}</b>：<span style="font-family:'DM Mono',monospace">${fmt(p.amount)}</span><span style="color:var(--text3)"> ${p.status === 'paid' ? '已付款' : p.status === 'approved' ? '待付款' : '待審核'}</span></div>`).join('')
        : '<span style="color:var(--text3)">未產生待付款</span>';
      const ensureBtn = missingPayables.length && canManage('profitshare')
        ? `<button class="btn btn-primary btn-sm" style="margin-bottom:6px" onclick="psEnsureSettlementPayables(${s.id})">補產生應付</button>`
        : '';
      return `
      <tr style="border-bottom:1px solid var(--border)">
        <td style="padding:8px 14px;font-size:12px">${s.date}</td>
        <td style="padding:8px 14px;font-size:12px">${s.cases.map(c=>c.name).join('、')}</td>
        <td style="padding:8px 14px;font-size:12px">${s.ohMonths.map(m=>m.month).join('、') || '—'}</td>
        <td style="padding:8px 14px;text-align:right;font-family:'DM Mono',monospace;font-size:12px;color:var(--success)">${fmt(s.grandNet)}</td>
        <td style="padding:8px 14px;text-align:right;font-family:'DM Mono',monospace;font-size:12px;color:var(--error)">${fmt(s.grandTax)}</td>
        <td style="padding:8px 14px;font-size:11px;line-height:1.65">${personSummary}</td>
        <td style="padding:8px 14px;font-size:11px;line-height:1.65">${ensureBtn}${generatedSummary}</td>
        <td style="padding:8px 14px;text-align:center;white-space:nowrap">
          ${hasPaid ? '<span style="font-size:11px;color:var(--text3)">已付款，不可撤銷</span>' : `<button class="btn btn-ghost btn-sm" onclick="psUndoSettlement(${s.id})">撤銷結算</button>`}
        </td>
      </tr>`;
    }).join('');
    historyHtml = `
      <div style="margin-top:14px;border:1px solid var(--border);border-radius:8px;overflow:hidden">
        <div style="padding:10px 14px;background:var(--surface2);font-size:13px;font-weight:600">結算歷史</div>
        <div style="overflow-x:auto">
        <table style="width:100%;min-width:1180px;border-collapse:collapse">
          <thead><tr style="border-bottom:1px solid var(--border2)">
            <th style="padding:8px 14px;text-align:left;font-size:11px;color:var(--text3)">結算日期</th>
            <th style="padding:8px 14px;text-align:left;font-size:11px;color:var(--text3)">納入個案</th>
            <th style="padding:8px 14px;text-align:left;font-size:11px;color:var(--text3)">納入開銷月份</th>
            <th style="padding:8px 14px;text-align:right;font-size:11px;color:var(--text3)">個案淨利合計</th>
            <th style="padding:8px 14px;text-align:right;font-size:11px;color:var(--text3)">預留營業所得稅</th>
            <th style="padding:8px 14px;text-align:left;font-size:11px;color:var(--text3)">人員結算</th>
            <th style="padding:8px 14px;text-align:left;font-size:11px;color:var(--text3)">產生應付</th>
            <th style="padding:8px 14px;text-align:center;font-size:11px;color:var(--text3)">操作</th>
          </tr></thead>
          <tbody>${rowsH}</tbody>
        </table>
        </div>
      </div>`;
  }

  container.innerHTML = `
    ${modePanel}
    ${settleBar}
    ${companyOverview}
    ${mainSection}
    <div style="margin-top:14px">${personTable}</div>
    ${payoutTable}
    ${historyHtml}
    <div style="margin-top:10px;font-size:11px;color:var(--text3)">
      ※ 開銷佔比＝正毛利個案毛利／正毛利合計；預留營業所得稅總額＝納入個案總銷售額×稅率，再依正毛利占比分攤；毛利為負的個案不分攤公司開銷與預留稅，金額直接為 0。稅前個案淨利＝毛利＋開銷；稅後個案淨利＝稅前個案淨利－預留營業所得稅；人員分潤／承擔＝Σ(稅後個案淨利×該人於該案的分潤比例)，負數代表該分潤人按比例承擔或由後續分潤抵扣。
    </div>`;
}
