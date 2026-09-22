// Shared accounting predicates and calculations. Function bodies are moved verbatim.

function isFamilyPassThroughCaseRecord(c) {
  return !!c && (c.caseType === '親友協助／成本轉付' || c.billingMode === '實際成本轉付' || c.invoiceMode === '不開發票');
}

function isFamilyPassThroughReceivable(row) {
  if (!row) return false;
  const c = CASES.find(x => x.code === row.case);
  return row.receivableType === 'family_pass_through' || isFamilyPassThroughCaseRecord(c);
}

function isFamilyAggregateReceivable(row) {
  return isFamilyPassThroughReceivable(row) &&
    !row.sourcePayableId &&
    !row.sourceKey &&
    String(row.item || '').includes('總額');
}

function isFamilySettlementReceivable(row) {
  return isFamilyPassThroughReceivable(row) &&
    !row.sourcePayableId &&
    !row.sourceKey &&
    (String(row.item || '').includes('結清') || row.status === 'collected' || Number(row.collectAmt || 0) > 0);
}

function isFamilyDetailReceivable(row) {
  return isFamilyPassThroughReceivable(row) &&
    (row.sourcePayableId || row.sourceKey || String(row.item || '').startsWith('親友成本轉付：'));
}

function familyReceivableCostAmount(row) {
  return Number(row?.invoiceAmt || row?.contractAmt || row?.collectAmt || 0) || 0;
}

function receivableIsCollected(row) {
  return Number(row?.collectAmt || 0) > 0 || !!row?.collectDate;
}

// 本次應收金額與發票金額是不同概念。舊資料沒有 receivableAmt 時，
// 已收款以實際入帳金額、未收款以發票／合約金額相容顯示，避免搬移時改寫正式資料。
function receivableExpectedAmount(row) {
  const explicit = Number(row?.receivableAmt || 0);
  if (explicit > 0) return explicit;
  if (receivableIsCollected(row)) return Number(row?.collectAmt || 0);
  return Number(row?.invoiceAmt || row?.contractAmt || 0);
}

function normalizeReceivableStatus(row) {
  if (!row) return row;
  row.status = receivableIsCollected(row) ? 'collected' : 'pending';
  return row;
}

function caseReceivableRows(caseCode, { includeRetention = true, dateOk = null } = {}) {
  return RECEIVABLES.filter(r =>
    r.case === caseCode &&
    (includeRetention || r.receivableType !== 'retention') &&
    (!dateOk || dateOk(r.collectDate || r.invoiceDate || ''))
  );
}

function caseCollectedAmount(caseCode, options = {}) {
  return caseReceivableRows(caseCode, options)
    .filter(receivableIsCollected)
    .reduce((s, r) => s + (Number(r.collectAmt) || 0), 0);
}

function caseReceivableTotalAmount(caseCode, options = {}) {
  return caseReceivableRows(caseCode, options)
    .reduce((s, r) => s + receivableExpectedAmount(r), 0);
}

function casePayableRows(caseCode, { dateOk = null, costControlOnly = false } = {}) {
  return PAYABLES.filter(p =>
    p.case === caseCode &&
    (!costControlOnly || isCostControlPayment(p)) &&
    (!dateOk || dateOk(p.doneDate || p.transferDate || p.wantDate || ''))
  );
}

function casePaidPayableAmount(caseCode, options = {}) {
  return casePayableRows(caseCode, options)
    .filter(p => p.status === 'paid')
    .reduce((s, p) => s + (Number(p.amount) || 0), 0);
}

const PROFIT_PAYMENT_TYPES = {
  profit_advance:'分潤預領',
  engineering_bonus:'工程獎金',
  profit_settlement:'分潤結清款',
};
const SPECIAL_PAYMENT_TYPES = {
  shareholder_distribution:'股東盈餘分配',
  family_pass_through:'親友成本轉付',
  private_loan:'私人借支／支票借用',
  overhead_link:'固定開銷付款連結',
  prepaid_expense:'預付費用／分期攤提',
  tax_liability:'稅務負債／繳稅',
  historical_profit_evidence:'歷史分潤付款佐證',
};
const NON_PROJECT_COST_PAYMENT_TYPES = {
  ...PROFIT_PAYMENT_TYPES,
  ...SPECIAL_PAYMENT_TYPES,
};

function paymentTypeLabel(type) {
  return PROFIT_PAYMENT_TYPES[type] || SPECIAL_PAYMENT_TYPES[type] || '';
}

function isProfitPaymentType(type) {
  return !!PROFIT_PAYMENT_TYPES[type];
}

function isProjectCostPayment(p) {
  return !NON_PROJECT_COST_PAYMENT_TYPES[p?.paymentType];
}

function isCostControlPayment(p) {
  // 私人借支／股東員工往來是資產負債往來，不是工程成本或公司損益。
  return isProjectCostPayment(p) || p?.paymentType === 'family_pass_through';
}
