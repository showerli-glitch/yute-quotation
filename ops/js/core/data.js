// OPS shared state, persistence, migrations, authentication, and Firebase access.

// Business-calculation helpers are loaded separately from accounting.js.

function tagCompany(arr) {
  (arr || []).forEach(x => { if (x && typeof x === 'object' && !x.companyId) x.companyId = COMPANY_ID; });
  return arr;
}

function removeReplacedExpenseAggregates() {
  // 2026 個人費用改以逐筆資料為主；舊成本控制表彙總列必須替換掉，不能疊加進毛利。
  const duplicateRules = [
    row => String(row.note || '').includes('Codex匯入：2026費用統計 Jan-Apr'),
    row => String(row.note || '').includes('木柵suzuki連動0326ok；總額24,452'),
    row => String(row.note || '').includes('凱揚濱江連動0326ok；總額3,565'),
    row => String(row.note || '').includes('文威豐連動0326ok；總額14,276'),
    row => {
      const month = String(row.month || '');
      const item = String(row.item || '');
      return month.startsWith('2026-') &&
        row.sourceType !== 'expense_patch' &&
        row.category === '歷史費用' &&
        item.includes('成本控制表') &&
        item.includes('2026') &&
        item.includes('彙總');
    },
  ];
  let removed = 0;
  for (let i = EXPENSES.length - 1; i >= 0; i--) {
    const row = EXPENSES[i];
    if (duplicateRules.some(rule => rule(row))) {
      EXPENSES.splice(i, 1);
      removed += 1;
    }
  }
  return removed;
}



function removeReplacedPassThroughReceivableAggregates() {
  const casesWithDetails = new Set(
    RECEIVABLES
      .filter(isFamilyDetailReceivable)
      .map(r => r.case)
      .filter(Boolean)
  );
  let removed = 0;
  for (let i = RECEIVABLES.length - 1; i >= 0; i--) {
    const row = RECEIVABLES[i];
    if (casesWithDetails.has(row.case) && isFamilyAggregateReceivable(row)) {
      RECEIVABLES.splice(i, 1);
      removed += 1;
    }
  }
  return removed;
}

function nextRowId(rows) {
  return Math.max(0, ...rows.map(row => Number(row.id) || 0)) + 1;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sourceKeyWasDeleted(sourceKey) {
  return !!sourceKey && DELETED_SOURCE_KEYS.includes(String(sourceKey));
}

function rememberDeletedSourceKey(sourceKey) {
  const key = String(sourceKey || '').trim();
  if (key && !DELETED_SOURCE_KEYS.includes(key)) DELETED_SOURCE_KEYS.push(key);
}

function upsertCaseByCode(seed) {
  const row = CASES.find(c => c.code === seed.code);
  if (row) Object.entries(seed).forEach(([key, value]) => {
    if (row[key] === undefined || row[key] === null || row[key] === '') row[key] = value;
  });
  else CASES.push({ ...seed });
}

function upsertReceivableBySourceKey(seed) {
  const row = RECEIVABLES.find(r => r.sourceKey === seed.sourceKey) ||
    RECEIVABLES.find(r => r.case === seed.case && String(r.item || '').trim() === String(seed.item || '').trim());
  if (row) Object.assign(row, { ...seed, id: row.id });
  else RECEIVABLES.push({ id: seed.id || nextRowId(RECEIVABLES), ...seed });
}



const SOURCE_OF_TRUTH_CASE_CODES = new Set([
  'YT-FAM-2026-001',
  'YT-FAM-2026-002',
  'YT-INV-2026-001',
  'YT-SUZ-REP-2026-001',
  'YT-VOL-REP-2026-001',
  'YT-VOL-REP-2026-002',
  'YT-LOAN-2026-001',
  'YT-LOAN-2026-002',
]);

function shouldUseCaseFinancialOverride(caseRecord) {
  return caseRecord && !SOURCE_OF_TRUTH_CASE_CODES.has(caseRecord.code);
}

function normalizeCaseFilterValue(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const exact = CASES.find(c => c.code === raw);
  if (exact) return exact.code;
  const codeMatch = raw.match(/YT-[A-Z]+-[A-Z]+-\d{4}-\d{3}|YT-[A-Z]+-\d{4}-\d{3}/);
  if (codeMatch) return codeMatch[0];
  const byName = CASES.find(c => raw === c.name || raw === `${c.code} ${c.name}` || raw.includes(c.name));
  return byName?.code || raw;
}

function upsertReceivableSeedPreserveEntry(seed) {
  if (sourceKeyWasDeleted(seed.sourceKey)) return;
  const row = RECEIVABLES.find(r => r.sourceKey === seed.sourceKey);
  if (!row) {
    RECEIVABLES.push({ id: seed.id || nextRowId(RECEIVABLES), ...clone(seed) });
    return;
  }
  const legacyWrongCollectAmt = {
    'volvo-zhonghe-rv-2720': 15740,
    'volvo-xinzhuang-wall-rv-2723': 8990,
  };
  const shouldCorrectLegacyAmt = legacyWrongCollectAmt[seed.sourceKey] === Number(row.collectAmt || 0);
  const shouldBackfillEmptyCollectedSeed = Number(seed.collectAmt || 0) > 0 && !receivableIsCollected(row);
  const legacyInvoicePassBuyer = {
    'invoice-pass-rv-2721': 'Volvo 維修客戶',
    'invoice-pass-rv-2722': '維修客戶',
  };
  const shouldCorrectLegacyBuyer = legacyInvoicePassBuyer[seed.sourceKey] === String(row.buyer || '').trim();
  const preserved = {
    id: row.id,
    buyer: shouldCorrectLegacyBuyer ? seed.buyer : row.buyer,
    collectDate: shouldBackfillEmptyCollectedSeed ? seed.collectDate : row.collectDate,
    collectAmt: (shouldCorrectLegacyAmt || shouldBackfillEmptyCollectedSeed) ? seed.collectAmt : row.collectAmt,
    bank: shouldBackfillEmptyCollectedSeed ? seed.bank : row.bank,
    status: row.status,
    invoiceAmt: (shouldCorrectLegacyAmt || (shouldBackfillEmptyCollectedSeed && !Number(row.invoiceAmt || 0))) ? seed.invoiceAmt : row.invoiceAmt,
    invoiceDate: row.invoiceDate || '',
    invoiceNo: row.invoiceNo || seed.invoiceNo,
    contractAmt: (shouldCorrectLegacyAmt || (shouldBackfillEmptyCollectedSeed && !Number(row.contractAmt || 0))) ? seed.contractAmt : row.contractAmt,
    progress: row.progress || seed.progress,
    note: row.note || seed.note,
    invoiceLink: row.invoiceLink || seed.invoiceLink,
  };
  Object.assign(row, { ...clone(seed), ...preserved });
  normalizeReceivableStatus(row);
}

function upsertPayableBySourceKey(seed) {
  const row = PAYABLES.find(p => p.sourceKey === seed.sourceKey);
  if (row) Object.assign(row, { ...seed, id: row.id });
  else PAYABLES.push({ id: seed.id || nextRowId(PAYABLES), ...seed });
}

function payableRowWasEditedByUser(row) {
  return !!(row?.updatedAt || row?.updatedBy);
}

function applyKnownPayableSeedCorrections(row, seed) {
  if (!row || !seed?.sourceKey) return;
  const key = seed.sourceKey;
  if (['hulin-family-ap-2025-7','hulin-family-ap-2025-8','hulin-family-ap-2025-9','hulin-family-ap-2025-10'].includes(key) && row.vendor === '陳志瑋') {
    row.vendor = '陳志璋';
    if (String(row.note || '').includes('陳志瑋')) row.note = String(row.note || '').replaceAll('陳志瑋', '陳志璋');
  }
  if (key === 'hulin-family-ap-2026-1' && row.vendor === '李嘉航') row.vendor = '富卯';
  if (key === 'hulin-family-ap-2026-2' && row.vendor === '王育鈞（阿義）') row.vendor = '王有鈞（阿義）';
  if (key === 'hulin-family-ap-2026-22' && Number(row.amount) === 9339.75) row.amount = 9340;
  if (!row.caseName && seed.caseName) row.caseName = seed.caseName;
  if (!row.paymentType && seed.paymentType) row.paymentType = seed.paymentType;
}

function syncSeededPayablesPreserveManualRows(seeds) {
  seeds.forEach(seed => {
    if (sourceKeyWasDeleted(seed.sourceKey)) return;
    const row = PAYABLES.find(p => p.sourceKey === seed.sourceKey);
    if (!row) {
      PAYABLES.push({ id: seed.id || nextRowId(PAYABLES), ...clone(seed) });
      return;
    }
    if (payableRowWasEditedByUser(row)) {
      applyKnownPayableSeedCorrections(row, seed);
      return;
    }
    Object.assign(row, { ...clone(seed), id: row.id });
  });
}

function normalizeCasePayableDuplicates(caseCode) {
  const seen = new Map();
  for (let i = PAYABLES.length - 1; i >= 0; i--) {
    const row = PAYABLES[i];
    if (row.case !== caseCode) continue;
    const key = [
      String(row.summary || '').trim(),
      Number(row.amount || 0),
      String(row.wantDate || row.doneDate || '').slice(0, 10)
    ].join('|');
    const current = seen.get(key);
    if (!current) {
      seen.set(key, { row, index: i });
      continue;
    }
    const currentLooksSeeded = !!current.row.sourceKey && !String(current.row.vendor || '').includes('待補');
    const rowLooksSeeded = !!row.sourceKey && !String(row.vendor || '').includes('待補');
    if (rowLooksSeeded && !currentLooksSeeded) {
      PAYABLES.splice(current.index, 1);
      seen.set(key, { row, index: i });
    } else {
      PAYABLES.splice(i, 1);
    }
  }
}

function resetSeededCasePayables(caseCode, seeds) {
  const seedKeys = new Set(seeds.map(seed => seed.sourceKey).filter(Boolean));
  const seen = new Set();
  PAYABLES = PAYABLES.filter(row => {
    if (row.case !== caseCode || !row.sourceKey || !seedKeys.has(row.sourceKey)) return true;
    if (!seen.has(row.sourceKey)) {
      seen.add(row.sourceKey);
      return true;
    }
    return payableRowWasEditedByUser(row);
  });
  syncSeededPayablesPreserveManualRows(seeds);
}

const SPECIAL_CASE_RECEIVABLE_SEEDS = [
  { sourceKey:'hulin-family-ar-total-1450000', case:'YT-FAM-2026-002', caseName:'虎林街住家', client:'LCH', clientName:'李啟弘', collectDate:'2026-05-03', buyer:'李啟弘', item:'虎林街住家結清款', collectAmt:1450000, bank:'抵付／已結清', invoiceAmt:0, invoiceDate:'', invoiceNo:'', contractAmt:1450000, progress:'2026-05-03 已結清', invoiceLink:'', status:'collected', receivableType:'normal', note:'親友案比照一般個案，只保留一筆應收；不分潤。' },
  { sourceKey:'invoice-pass-rv-2721', case:'YT-INV-2026-001', caseName:'代開發票', collectDate:'2026-03-05', buyer:'凱銳北區汽車股份有限公司', item:'中和新莊 Volvo 維修（小張代開）', collectAmt:21935, bank:'國泰', invoiceAmt:21945, invoiceDate:'', invoiceNo:'XH38605857', contractAmt:21945, progress:'已入帳', invoiceLink:'', status:'collected', receivableType:'normal', note:'代開發票，不分潤。' },
  { sourceKey:'invoice-pass-rv-2722', case:'YT-INV-2026-001', caseName:'代開發票', collectDate:'2026-04-05', buyer:'凱銳北區汽車股份有限公司', item:'污水馬達更新工程', collectAmt:26870, bank:'國泰', invoiceAmt:26880, invoiceDate:'', invoiceNo:'ZK97113610', contractAmt:26880, progress:'已入帳', invoiceLink:'', status:'collected', receivableType:'normal', note:'代開發票，不分潤。' },
  { sourceKey:'suzuki-repair-rv-2718', case:'YT-SUZ-REP-2026-001', caseName:'Suzuki 維修－民族', collectDate:'2026-06-27', buyer:'凱騰鈴木', item:'民族進水管更新', collectAmt:9450, bank:'國泰', invoiceAmt:9450, invoiceDate:'', invoiceNo:'BP08421850', contractAmt:9450, progress:'已入帳', invoiceLink:'', status:'collected', receivableType:'normal', note:'Suzuki 維修，不分潤。' },
  { sourceKey:'volvo-zhonghe-rv-2720', case:'YT-VOL-REP-2026-001', caseName:'Volvo 修繕－中和', collectDate:'2026-06-27', buyer:'凱銳 Volvo', item:'中和 Volvo 地磚修繕工程', collectAmt:15750, bank:'國泰', invoiceAmt:15750, invoiceDate:'', invoiceNo:'XH38605856', contractAmt:15750, progress:'已入帳', invoiceLink:'', status:'collected', receivableType:'normal', note:'Volvo 修繕，不分潤。' },
  { sourceKey:'volvo-xinzhuang-wall-rv-2723', case:'YT-VOL-REP-2026-002', caseName:'Volvo 修繕－新莊', collectDate:'2026-06-27', buyer:'凱銳 Volvo', item:'新莊 Volvo 牆面修繕款', collectAmt:9000, bank:'國泰', invoiceAmt:9000, invoiceDate:'', invoiceNo:'ZK97113607', contractAmt:9000, progress:'已入帳', invoiceLink:'', status:'collected', receivableType:'normal', note:'Volvo 修繕，不分潤。' },
  { sourceKey:'volvo-xinzhuang-lock-rv-2724', case:'YT-VOL-REP-2026-002', caseName:'Volvo 修繕－新莊', collectDate:'2026-06-27', buyer:'凱銳 Volvo', item:'新莊 Volvo 廁所門鎖更換', collectAmt:1155, bank:'國泰', invoiceAmt:1155, invoiceDate:'', invoiceNo:'BP08421851', contractAmt:1155, progress:'已入帳', invoiceLink:'', status:'collected', receivableType:'normal', note:'Volvo 修繕，不分潤。' },
];

const SPECIAL_CASE_PAYABLE_SEEDS = [
  { sourceKey:'invoice-pass-ap-202602-1', case:'YT-INV-2026-001', caseName:'代開發票', vendor:'益鴻小張', summary:'中和門鎖', amount:3150, wantDate:'2026-02-10', doneDate:'2026-02-10', bank:'國泰', invoice:'無', receipt:'有', person:'李鎮宇', paymentType:'vendor', status:'paid', note:'代開發票協力商成本；不分潤。' },
  { sourceKey:'invoice-pass-ap-202602-2', case:'YT-INV-2026-001', caseName:'代開發票', vendor:'益鴻小張', summary:'新莊漏電斷路器更換', amount:3240, wantDate:'2026-02-10', doneDate:'2026-02-10', bank:'國泰', invoice:'無', receipt:'有', person:'李鎮宇', paymentType:'vendor', status:'paid', note:'代開發票協力商成本；不分潤。' },
  { sourceKey:'invoice-pass-ap-202602-3', case:'YT-INV-2026-001', caseName:'代開發票', vendor:'益鴻小張', summary:'新莊攝影機 IP 分享器安裝', amount:12420, wantDate:'2026-02-10', doneDate:'2026-02-10', bank:'國泰', invoice:'無', receipt:'有', person:'李鎮宇', paymentType:'vendor', status:'paid', note:'代開發票協力商成本；不分潤。' },
  { sourceKey:'invoice-pass-ap-202603-1', case:'YT-INV-2026-001', caseName:'代開發票', vendor:'益鴻小張', summary:'拆除、點工', amount:3780, wantDate:'2026-03-10', doneDate:'2026-03-10', bank:'國泰', invoice:'無', receipt:'有', person:'李鎮宇', paymentType:'vendor', status:'paid', note:'代開發票協力商成本；不分潤。' },
  { sourceKey:'invoice-pass-ap-202604-1', case:'YT-INV-2026-001', caseName:'代開發票', vendor:'益鴻小張', summary:'污水馬達更新工程', amount:19440, wantDate:'2026-04-10', doneDate:'2026-04-10', bank:'國泰', invoice:'無', receipt:'有', person:'李鎮宇', paymentType:'vendor', status:'paid', note:'代開發票協力商成本；不分潤。' },
  { sourceKey:'volvo-zhonghe-tile-ap-15000', case:'YT-VOL-REP-2026-001', caseName:'Volvo 修繕－中和', vendor:'待補廠商', summary:'中和辦公室地磚更新', amount:15000, wantDate:'2026-06-20', doneDate:'2026-06-20', bank:'國泰', invoice:'無', receipt:'有', person:'李鎮宇', paymentType:'vendor', status:'paid', note:'Volvo 修繕成本；不分潤。' },
  { sourceKey:'volvo-xinzhuang-paint-ap-9450', case:'YT-VOL-REP-2026-002', caseName:'Volvo 修繕－新莊', vendor:'待補廠商', summary:'油漆點工 10/20 新莊 3 工', amount:9450, wantDate:'2026-06-20', doneDate:'2026-06-20', bank:'國泰', invoice:'無', receipt:'有', person:'李鎮宇', paymentType:'vendor', status:'paid', note:'Volvo 修繕成本；不分潤。' },
];

function normalizeOrdinaryProjectAccounting() {
  [
    {
      code:'YT-FAM-2026-001', name:'玉成街親友工程', client:'LMO', clientName:'李媽媽',
      status:'進行中', amount:0, collected:0, person:'李鎮宇', pct:0,
      profitSplit:'不分潤', caseType:'不分潤／成本追蹤', billingMode:'一般個案損益',
      invoiceMode:'不開發票', excludeFromProfitReports:true, closedDate:'',
      taxCostOverride:0,
      reconciliationNote:'不分潤個案；依一般工程損益邏輯列入成本控制表。廠商成本 9 筆合計 158,129；應收／收款由使用者手動建立，不再由系統預設合約或補應收；不進分潤儀表。'
    },
    {
      code:'YT-FAM-2026-002', name:'虎林街住家', client:'LCH', clientName:'李啟弘',
      status:'結案', amount:1450000, collected:1450000, person:'李鎮宇', pct:0,
      profitSplit:'不分潤', caseType:'不分潤／成本追蹤', billingMode:'一般個案損益',
      invoiceMode:'不開發票', excludeFromProfitReports:true, closedDate:'2026-05-03',
      taxCostOverride:0,
      reconciliationNote:'不分潤個案；依一般工程損益邏輯列入成本控制表。應收／已收 1,450,000；廠商成本 2025 年 13 筆 462,806 + 2026 年 25 筆 951,949 = 1,414,755；不進分潤儀表。'
    },
    {
      code:'YT-INV-2026-001', name:'代開發票', client:'INV', clientName:'代開發票',
      status:'完工', amount:48805, collected:48805, person:'李鎮宇', pct:0,
      profitSplit:'不分潤', caseType:'不分潤／成本追蹤', excludeFromProfitReports:true,
      taxCostOverride:0,
      reconciliationNote:'不分潤個案；應收已收 48,805，協力商成本 42,030，列入成本控制表但不進分潤儀表。'
    },
    {
      code:'YT-SUZ-REP-2026-001', name:'Suzuki 維修－民族', client:'SUZ', clientName:'凱騰鈴木',
      status:'完工', amount:9450, collected:9450, person:'李鎮宇', pct:0,
      profitSplit:'不分潤', caseType:'不分潤／成本追蹤', excludeFromProfitReports:true,
      taxCostOverride:0,
      reconciliationNote:'不分潤維修個案；民族進水管更新已收 9,450，列入成本控制表但不進分潤儀表。'
    },
    {
      code:'YT-VOL-REP-2026-001', name:'Volvo 修繕－中和', client:'VOL', clientName:'凱銳 Volvo',
      status:'完工', amount:15750, collected:15750, person:'李鎮宇', pct:0,
      profitSplit:'不分潤', caseType:'不分潤／成本追蹤', excludeFromProfitReports:true,
      taxCostOverride:0,
      reconciliationNote:'不分潤維修個案；中和地磚修繕已收 15,750，廠商成本 15,000，列入成本控制表但不進分潤儀表。'
    },
    {
      code:'YT-VOL-REP-2026-002', name:'Volvo 修繕－新莊', client:'VOL', clientName:'凱銳 Volvo',
      status:'完工', amount:10155, collected:10155, person:'李鎮宇', pct:0,
      profitSplit:'不分潤', caseType:'不分潤／成本追蹤', excludeFromProfitReports:true,
      taxCostOverride:0,
      reconciliationNote:'不分潤維修個案；新莊牆面修繕與廁所門鎖更換已收 10,155，廠商成本 9,450，列入成本控制表但不進分潤儀表。'
    },
    {
      code:'YT-LOAN-2026-001', name:'李媽媽私人借支', client:'LMO', clientName:'李媽媽',
      status:'進行中', amount:596000, collected:0, person:'李鎮宇', pct:0,
      profitSplit:'不分潤', caseType:'私人借支', accountingTreatment:'receivable_from_related_party', excludeFromProfitReports:true,
      taxCostOverride:0, reconciliationNote:'私人借支／股東員工往來；公司付款列往來款資產，返還時沖銷，不進收入、成本、公司開銷、淨利潤或員工分潤。'
    },
    {
      code:'YT-LOAN-2026-002', name:'高雄博愛－舊案修繕往來', client:'', clientName:'內部往來',
      status:'進行中', amount:79820, collected:0, person:'李鎮宇', pct:0,
      profitSplit:'不分潤', caseType:'私人借支／股東員工往來', accountingTreatment:'receivable_from_related_party', excludeFromProfitReports:true,
      companyAdvanceAmount:79820,
      relatedPartyShares:[{person:'peng',name:'彭俞豪',ratio:0.3,amount:23946},{person:'shower',name:'李鎮宇',ratio:0.7,amount:55874}],
      taxCostOverride:0, reconciliationNote:'舊案修繕款由公司先支付 79,820；彭俞豪負擔 30%＝23,946，李鎮宇負擔 70%＝55,874。列股東員工往來款，返還時沖銷，不進公司開銷、個案成本、淨利潤或分潤。'
    },
  ].forEach(upsertCaseByCode);

  [
    { sourceKey:'related-party-kaohsiung-boai-peng-23946', case:'YT-LOAN-2026-002', caseName:'高雄博愛－舊案修繕往來', buyer:'彭俞豪', item:'公司代付舊案修繕款－應返還 30%', collectAmt:0, collectDate:'', bank:'', invoiceAmt:0, invoiceDate:'', invoiceNo:'', contractAmt:23946, progress:'待返還公司', status:'pending', receivableType:'private_loan', note:'公司代付 79,820 × 30%＝23,946；股東員工往來款，不列收入。' },
    { sourceKey:'related-party-kaohsiung-boai-shower-55874', case:'YT-LOAN-2026-002', caseName:'高雄博愛－舊案修繕往來', buyer:'李鎮宇', item:'公司代付舊案修繕款－應返還 70%', collectAmt:0, collectDate:'', bank:'', invoiceAmt:0, invoiceDate:'', invoiceNo:'', contractAmt:55874, progress:'待返還公司', status:'pending', receivableType:'private_loan', note:'公司代付 79,820 × 70%＝55,874；股東員工往來款，不列收入。' },
  ].forEach(seed => {
    if (!RECEIVABLES.some(r => r.sourceKey === seed.sourceKey)) RECEIVABLES.push({ id:nextRowId(RECEIVABLES), ...seed });
  });

  SOURCE_OF_TRUTH_CASE_CODES.forEach(code => {
    const c = CASES.find(x => x.code === code);
    if (!c) return;
    delete c.revenueOverride;
    delete c.vendorCostOverride;
    delete c.grossOverride;
  });

  RECEIVABLES = RECEIVABLES.filter(r => {
    if (r.receivableType !== 'family_pass_through') return true;
    if (r.case === 'YT-FAM-2026-001' || r.case === 'YT-FAM-2026-002') return false;
    return !(r.sourcePayableId || String(r.sourceKey || '').startsWith('payable:'));
  });
  RECEIVABLES = RECEIVABLES.filter(r =>
    !(r.receivableType === 'private_loan' && (r.sourcePayableId || String(r.sourceKey || '').startsWith('payable:')))
  );
  RECEIVABLES = RECEIVABLES.filter(r =>
    !(r.case === 'YT-FAM-2026-001' && (
      r.sourceKey === 'yucheng-family-ar-total-158129' ||
      r.sourceKey === 'yucheng-family-ar-total-137399' ||
      String(r.item || '').includes('玉成街親友工程結清款')
    ))
  );
  RECEIVABLES = RECEIVABLES.filter(r => {
    if (r.case !== 'YT-INV-2026-001') return true;
    if (r.sourceKey === 'invoice-pass-rv-2721' || r.sourceKey === 'invoice-pass-rv-2722') return true;
    const amt = Number(r.collectAmt || r.invoiceAmt || r.contractAmt || 0);
    const text = `${r.item || ''} ${r.progress || ''}`;
    const noEntryDate = !r.collectDate && !r.invoiceDate;
    if (noEntryDate && (amt === 21935 || amt === 26870) && /中和新莊|污水馬達/.test(text)) return false;
    return true;
  });
  // 虎林街／玉成街已改由 syncSeededPayablesPreserveManualRows 處理（保留手動編輯，只修正已知錯誤值），
  // 不可在此再用 resetSeededCasePayables 整批清空重建，否則會蓋掉使用者手動修正的資料。
  SPECIAL_CASE_RECEIVABLE_SEEDS.forEach(upsertReceivableSeedPreserveEntry);

  ['YT-INV-2026-001','YT-VOL-REP-2026-001','YT-VOL-REP-2026-002']
    .forEach(caseCode => resetSeededCasePayables(caseCode, SPECIAL_CASE_PAYABLE_SEEDS.filter(seed => seed.case === caseCode)));

  PAYABLES.forEach(p => {
    if (p.paymentType !== 'private_loan') return;
    // 已明確歸屬其他股東員工往來個案者必須保留；只替舊版沒有個案的李媽媽借支補預設歸屬。
    if (!p.case) {
      p.case = 'YT-LOAN-2026-001';
      p.caseName = '李媽媽私人借支';
    }
    p.accountingTreatment = 'receivable_from_related_party';
  });

  normalizeCasePayableDuplicates('YT-FAM-2026-001');
  normalizeCasePayableDuplicates('YT-FAM-2026-002');
  normalizeCasePayableDuplicates('YT-LOAN-2026-001');
}

function normalizeProfitPayables() {
  const lienFinal = PAYABLES.find(row => row.sourceKey === 'lien-profit-20260520');
  if (lienFinal) {
    lienFinal.amount = 7634;
    lienFinal.note = '2026-05-20 依家裡正確版公司開銷校正結清；尾款 7,634';
  }
  resetProfitSettlementOffsets();
  applyProfitAdvanceSettlementOffsets();
}

function profitPaymentDate(row) {
  return row?.doneDate || row?.transferDate || row?.wantDate || '';
}

function profitOffsetPerson(row) {
  if (!row) return '';
  if (row.paymentType === 'shareholder_distribution') return row.profitPerson || row.shareholderPerson || '';
  return row.profitPerson || '';
}

function resetProfitSettlementOffsets() {
  PAYABLES.forEach(row => {
    if (row.paymentType !== 'profit_settlement' || !row.settlementOffsetAmount) return;
    const original = Number(row.originalSettlementAmount) || (Number(row.amount) || 0) + (Number(row.settlementOffsetAmount) || 0);
    row.originalSettlementAmount = original;
    row.amount = Math.round(original);
    row.settlementOffsetAmount = 0;
    if (row.status === 'paid' && String(row.note || '').includes('已由分潤預領全額沖抵')) {
      row.status = 'approved';
      row.doneDate = '';
      row.transferDate = '';
    }
    row.note = String(row.note || '')
      .replace(/；?已由[^；]*?沖抵/g, '')
      .replace(/；?已由分潤預領全額沖抵/g, '')
      .replace(/^；|；$/g, '');
  });
  PAYABLES.forEach(row => {
    if (!row.ownerWithdrawalType) return;
    row.profitSettlementOffsetAmount = 0;
    row.offsetSettlementPayableIds = [];
    if (row.psSettled && ['profit_advance','shareholder_distribution'].includes(row.paymentType)) row.psSettled = false;
  });
}

function isSettlementOffsetAdvance(row) {
  if (row?.status !== 'paid') return false;
  if (row.paymentType === 'profit_advance') {
    return ['fixed_profit_advance','ad_hoc_profit_advance'].includes(row.ownerWithdrawalType) && !!profitOffsetPerson(row);
  }
  return row.paymentType === 'shareholder_distribution' && profitOffsetPerson(row) === 'shower';
}

function applyProfitAdvanceSettlementOffsets() {
  const advances = PAYABLES
    .filter(isSettlementOffsetAdvance)
    .sort((a,b) => profitPaymentDate(a).localeCompare(profitPaymentDate(b)) || (a.id||0) - (b.id||0));
  advances.forEach(advance => {
    const advancePerson = profitOffsetPerson(advance);
    if (!advancePerson) return;
    const alreadyApplied = Math.max(0, Number(advance.profitSettlementOffsetAmount) || 0);
    let remaining = Math.max(0, (Number(advance.amount) || 0) - alreadyApplied);
    if (remaining <= 0.5) {
      advance.psSettled = true;
      return;
    }
    const targets = PAYABLES
      .filter(row => row.paymentType === 'profit_settlement' &&
        row.systemLocked &&
        row.profitPerson === advancePerson &&
        row.status !== 'paid' &&
        (Number(row.amount) || 0) > 0)
      .sort((a,b) => profitPaymentDate(a).localeCompare(profitPaymentDate(b)) || (a.id||0) - (b.id||0));
    targets.forEach(target => {
      if (remaining <= 0.5) return;
      const currentAmount = Math.max(0, Number(target.amount) || 0);
      if (!currentAmount) return;
      if (!target.originalSettlementAmount) target.originalSettlementAmount = currentAmount;
      const applied = Math.min(remaining, currentAmount);
      target.amount = Math.round(currentAmount - applied);
      target.settlementOffsetAmount = Math.round((Number(target.settlementOffsetAmount) || 0) + applied);
      const ids = new Set(advance.offsetSettlementPayableIds || []);
      ids.add(target.id);
      advance.offsetSettlementPayableIds = [...ids];
      advance.profitSettlementOffsetAmount = Math.round((Number(advance.profitSettlementOffsetAmount) || 0) + applied);
      remaining -= applied;
      const label = ownerWithdrawalTypeLabel(advance.ownerWithdrawalType) || PROFIT_PAYMENT_TYPES[advance.paymentType] || SPECIAL_PAYMENT_TYPES[advance.paymentType] || '提領';
      const marker = `已由${profitPaymentDate(advance) || label} ${label} ${Math.round(applied).toLocaleString('zh-TW')} 沖抵`;
      if (!String(target.note || '').includes(marker)) target.note = `${target.note || ''}${target.note ? '；' : ''}${marker}`;
      if (target.amount <= 0.5) {
        target.amount = 0;
        target.status = 'paid';
        target.doneDate = target.doneDate || profitPaymentDate(advance);
        target.transferDate = target.transferDate || profitPaymentDate(advance);
        if (!String(target.note || '').includes('已由分潤預領全額沖抵')) target.note = `${target.note || ''}；已由分潤預領全額沖抵`;
      }
    });
    if ((Number(advance.profitSettlementOffsetAmount) || 0) >= (Number(advance.amount) || 0) - 0.5) {
      advance.psSettled = true;
    }
  });
}

function psCaseNameSort(a, b) {
  const nameCmp = String(a?.name || '').localeCompare(String(b?.name || ''), 'zh-Hant-u-co-stroke');
  if (nameCmp !== 0) return nameCmp;
  return String(a?.code || '').localeCompare(String(b?.code || ''));
}

function normalizeEmployeeEmploymentStatus() {
  const today = localDateKey();
  const sun = EMPLOYEES.find(e => e.id === 'sun');
  if (sun) {
    sun.status = '已離職';
    sun.accessRole = 'none';
    sun.attendanceRequired = false;
    sun.profitEligible = false;
    sun.endReason = sun.endReason || '離職';
    const marker = '2026-07-30 使用者確認已離職';
    const note = String(sun.note || '');
    if (!note.includes(marker)) sun.note = `${note}${note ? '；' : ''}${marker}；實際離職日期待補`;
  }
  EMPLOYEES.forEach(e => {
    if (empEffectiveStatus(e, today) !== '已離職') return;
    e.status = '已離職';
    e.accessRole = 'none';
    e.attendanceRequired = false;
    e.profitEligible = false;
  });
}

function normalizeCompanyData() {
  [CASES, PAYABLES, RECEIVABLES, EXPENSES, COMPANY_ALLOCATIONS, PAYROLL, CLIENTS, VENDORS, EMPLOYEES, PROFIT_SETTLEMENTS, TAX_LIABILITIES, TEST_FEEDBACK, ATTENDANCE_RECORDS, ATTENDANCE_LEAVES, AUDIT_LOGS]
    .forEach(tagCompany);
  EMPLOYEES.forEach(e => {
    if (!('email' in e)) e.email = '';
    if (e.id === 'nc' && !e.email) e.email = 'nc@yutesign.com';
  });
  const correctedVendor = VENDORS.find(v => v.name === '高一實業社' && v.code === 'WD014');
  if (correctedVendor && !VENDORS.some(v => v !== correctedVendor && v.code === 'WD-014')) correctedVendor.code = 'WD-014';
  VENDORS.forEach(v => {
    if (!v.status) v.status = '有效';
    if (v.status !== '停用') v.disabledDate = '';
  });
  // 一次性清除 2026-06-25 對帳時暫建、後來確認無正式個案代碼的孤兒應收。
  // 必須同時符合 ID、空 case、待確認案名、金額與發票號碼，避免誤刪正式上洋高雄 $11,378 紀錄。
  RECEIVABLES = RECEIVABLES.filter(r => !(
    Number(r.id) === 2719 && !String(r.case || '').trim() &&
    String(r.caseName || '') === '上洋高雄／待確認' &&
    Number(r.invoiceAmt || r.contractAmt || 0) === 11393 &&
    String(r.invoiceNo || '') === 'BP08421853'
  ));
  ['peng','lien'].forEach(id => {
    if (USER_PERMISSIONS[id]?.vendors === 'view_all') USER_PERMISSIONS[id].vendors = 'view_all_apply_self';
  });
  // 廠商請款的「view_all_apply_self」名不符實：實際只看得到自己有分潤的個案＋自己送出的申請，
  // 改用 view_profit_cases_apply_self 讓權限矩陣畫面標示與實際行為一致；行為本身不變。
  ['peng','lien','sun','lu_yanchen'].forEach(id => {
    if (USER_PERMISSIONS[id]?.payreq === 'view_all_apply_self') USER_PERMISSIONS[id].payreq = 'view_profit_cases_apply_self';
  });
  const duplicateShengFeng = PAYABLES.filter(p =>
    p.status === 'pending' && p.case === 'YT-VOL-2026-004' &&
    p.vendor === '盛豐起重工程行' && p.summary === '宏匯傢俱搬至新莊Volvo' &&
    Number(p.amount) === 19845 && p.wantDate === '2026-08-31'
  ).sort((a,b) => Number(a.id || 0) - Number(b.id || 0));
  if (duplicateShengFeng.length > 1) {
    const rowsToRemove = new Set(duplicateShengFeng.slice(1));
    for (let i = PAYABLES.length - 1; i >= 0; i--) {
      if (rowsToRemove.has(PAYABLES[i])) PAYABLES.splice(i, 1);
    }
  }
  ensureLuYanchenOpsAccess();
  normalizeEmployeeEmploymentStatus();
  PROFIT_SETTLEMENTS.forEach(settlement => {
    [settlement.cases, settlement.ohMonths, settlement.persons].forEach(tagCompany);
  });
  Object.values(OVERHEAD || {}).forEach(month => {
    if (!month || typeof month !== 'object') return;
    if (!month.companyId) month.companyId = COMPANY_ID;
    tagCompany(month.variable);
  });
  const may2025 = OVERHEAD?.['2025-05'];
  const may2025IsEmpty = may2025 &&
    (may2025.fixed || []).every(v => !Number(v)) &&
    (may2025.fixedNotes || []).every(v => !String(v || '').trim()) &&
    !(may2025.variable || []).length;
  if (may2025IsEmpty) delete OVERHEAD['2025-05'];
  normalizeProfitPayables();
  normalizeOrdinaryProjectAccounting();
  PAYABLES.filter(p => p.paymentType === 'tax_liability').forEach(syncTaxLiabilityForPayable);
  normalizeSpecialCaseClients();
  removeReplacedExpenseAggregates();
}

const USERS = [
  {id:'shower', name:'李鎮宇', role:'老闆', roleCode:'OWNER', initial:'李', color:'#c8a96e',
   nav:['dashboard','payreq','payable','receivable','expense','overhead','tax','payroll','attendance','profit','profitshare','contract','quotation','feedback','systemnotes','employees','clients','vendors']},
  {id:'nc',     name:'鄭詩褣', role:'財務', roleCode:'FINANCE', initial:'鄭', color:'#7eb8d4',
   nav:['dashboard','payreq','payable','receivable','expense','overhead','tax','payroll','attendance','profit','profitshare','contract','quotation','feedback','systemnotes','employees','clients','vendors']},
  {id:'peng',   name:'彭俞豪', role:'專案經理', roleCode:'PM', initial:'彭', color:'#6eb894',
   nav:['dashboard','payreq','payable','receivable','expense','payroll','profit','profitshare','contract','quotation','feedback','clients','vendors']},
  {id:'lien',   name:'連星羽', role:'設計師', roleCode:'DESIGN', initial:'連', color:'#b894e0',
   nav:['dashboard','payreq','payable','receivable','expense','payroll','profit','profitshare','contract','quotation','feedback','clients','vendors']},
  {id:'sun',    name:'孫一宣', role:'行銷行政', roleCode:'ADMIN', initial:'孫', color:'#e07070',
   nav:['dashboard','payreq','payable','receivable','expense','payroll','profit','profitshare','contract','quotation','feedback','clients','vendors']},
  {id:'lu_yanchen', name:'盧彥辰', role:'設計助理', roleCode:'STAFF', initial:'盧', color:'#6aa88c',
   nav:['payreq','receivable','expense','payroll','attendance','profit','contract','quotation','feedback','clients','vendors']},
  {id:'chen_hongjun', name:'陳虹君', role:'會計', roleCode:'ACCOUNTING', initial:'陳', color:'#6aa88c',
   nav:['dashboard','payreq','payable','receivable','expense','payroll','attendance','profit','contract','quotation','feedback','clients','vendors']},
];
tagCompany(USERS);

// 來源：Yutesign_OPS_權限調整回饋表.xlsx（2026-06-23 更新版）
const USER_PERMISSIONS = {
  shower: {dashboard:'manage',payreq:'manage',payable:'manage',receivable:'manage',expense:'manage',overhead:'manage',tax:'manage',payroll:'manage',attendance:'manage',profit:'manage',profitshare:'manage',contract:'manage',quotation:'manage',feedback:'manage',systemnotes:'manage',employees:'manage',clients:'manage',vendors:'manage',canCreateCase:true},
  nc:     {dashboard:'manage',payreq:'manage',payable:'manage',receivable:'manage',expense:'manage',overhead:'manage',tax:'manage',payroll:'manage',attendance:'manage',profit:'manage',profitshare:'manage',contract:'manage',quotation:'manage',feedback:'manage',systemnotes:'manage',employees:'manage',clients:'manage',vendors:'manage',canCreateCase:true},
  peng:   {dashboard:'view_profit_cases',payreq:'view_profit_cases_apply_self',payable:'view_profit_cases',receivable:'view_profit_cases',expense:'view_self_apply_self',overhead:'none',payroll:'view_self',attendance:'none',profit:'view_profit_cases',profitshare:'view_self',contract:'view_all',quotation:'manage',feedback:'manage',employees:'none',clients:'view_all',vendors:'view_all_apply_self',canCreateCase:true},
  lien:   {dashboard:'view_profit_cases',payreq:'view_profit_cases_apply_self',payable:'view_profit_cases',receivable:'view_profit_cases',expense:'view_self_apply_self',overhead:'none',payroll:'view_self',attendance:'none',profit:'view_profit_cases',profitshare:'view_self',contract:'view_all',quotation:'manage',feedback:'manage',employees:'none',clients:'view_all',vendors:'view_all_apply_self',canCreateCase:true},
  sun:    {dashboard:'view_profit_cases',payreq:'view_profit_cases_apply_self',payable:'view_profit_cases',receivable:'view_profit_cases',expense:'view_self_apply_self',overhead:'none',payroll:'view_self',attendance:'none',profit:'view_profit_cases',profitshare:'view_self',contract:'view_all',quotation:'view_all',feedback:'manage',employees:'none',clients:'view_all',vendors:'view_all',canCreateCase:false},
  lu_yanchen: {dashboard:'none',payreq:'view_profit_cases_apply_self',payable:'none',receivable:'view_profit_cases',expense:'view_self_apply_self',overhead:'none',payroll:'view_self',attendance:'view_self',profit:'view_profit_cases',profitshare:'none',contract:'view_all',quotation:'view_all',feedback:'manage',employees:'none',clients:'view_all',vendors:'view_all',canCreateCase:false},
  chen_hongjun: {dashboard:'view_all',payreq:'manage',payable:'manage',receivable:'manage',expense:'manage',overhead:'none',payroll:'view_self',attendance:'view_self',profit:'view_all',profitshare:'none',contract:'view_all',quotation:'view_all',feedback:'manage',employees:'none',clients:'manage',vendors:'manage',canCreateCase:false},
};
const LU_YANCHEN_OPS_PERMISSIONS = { ...USER_PERMISSIONS.lu_yanchen };
const EMP_ACCESS_PERMISSION_TEMPLATES = {
  owner: USER_PERMISSIONS.shower,
  finance: USER_PERMISSIONS.nc,
  accounting: USER_PERMISSIONS.nc,
  pm: USER_PERMISSIONS.peng,
  design: USER_PERMISSIONS.lien,
  admin: USER_PERMISSIONS.sun,
  none: {},
};
const EMP_ROLE_CODE = { owner:'OWNER', finance:'FINANCE', accounting:'ACCOUNTING', pm:'PM', design:'DESIGN', admin:'ADMIN', none:'NONE' };
const EMP_ROLE_COLOR = { owner:'#c8a96e', finance:'#7eb8d4', accounting:'#7eb8d4', pm:'#6eb894', design:'#b894e0', admin:'#e07070', none:'#949494' };

function permissionLevel(page) {
  const explicit = USER_PERMISSIONS[currentUser?.id];
  if (explicit) return explicit[page] || 'none';
  if (currentUser?.roleCode === 'STAFF') {
    if (page === 'attendance') return 'view_self';
    if (page === 'feedback') return 'manage';
    if (page === 'payroll') return 'view_self';
    return 'none';
  }
  const emp = EMPLOYEES.find(e => e.id === currentUser?.id);
  const role = employeeAccessRole(emp);
  return EMP_ACCESS_PERMISSION_TEMPLATES[role]?.[page] || 'none';
}
function canManage(page) { return permissionLevel(page) === 'manage'; }
function canAccess(page) { return permissionLevel(page) !== 'none'; }
function canApplySelf(page) { return ['manage','view_all_apply_self','view_self_apply_self','view_profit_cases_apply_self'].includes(permissionLevel(page)); }
// 新增個案權限是獨立於模組權限（dashboard 等）之外的單一布林欄位，只放在 USER_PERMISSIONS[id].canCreateCase。
// 沒有明確設定這個欄位的員工（例如只靠 accessRole 對應範本、沒有 USER_PERMISSIONS 個別項目的人），
// 退回沿用原本「dashboard 完整管理才能新增個案」的行為，確保改動前後這些人的實際權限不變。
function canCreateCaseFor(empId) {
  const explicit = USER_PERMISSIONS[empId];
  if (explicit && typeof explicit.canCreateCase === 'boolean') return explicit.canCreateCase;
  const emp = EMPLOYEES.find(e => e.id === empId);
  const role = employeeAccessRole(emp);
  return EMP_ACCESS_PERMISSION_TEMPLATES[role]?.dashboard === 'manage';
}
function canCreateCase() { return canCreateCaseFor(currentUser?.id); }
function canViewPaymentType() { return ['OWNER','FINANCE','ACCOUNTING'].includes(currentUser?.roleCode); }
function canSeeFinancialTotals() { return ['OWNER','FINANCE','ACCOUNTING'].includes(currentUser?.roleCode); }
function canSeeRestrictedCase(c) { return !c?.excludeFromProfitReports || canSeeFinancialTotals(); }

function ensureLuYanchenOpsAccess() {
  const emp = EMPLOYEES.find(e => e.id === 'lu_yanchen');
  if (!emp || empEffectiveStatus(emp) === '已離職') return;
  const marker = '2026-07-21 OPS 登入開通確認';
  const note = String(emp.note || '');
  if (!note.includes(marker)) {
    emp.email = String(emp.email || '').trim().toLowerCase() || 'lu@yutesign.com';
    if (!emp.accessRole || emp.accessRole === 'none') emp.accessRole = 'design';
    emp.attendanceRequired = true;
    emp.profitEligible = false;
    emp.note = `${note}${note ? '；' : ''}${marker}`;
  }
  const current = USER_PERMISSIONS.lu_yanchen || {};
  USER_PERMISSIONS.lu_yanchen = { ...current };
  Object.entries(LU_YANCHEN_OPS_PERMISSIONS).forEach(([page, level]) => {
    if (!Object.prototype.hasOwnProperty.call(USER_PERMISSIONS.lu_yanchen, page)) {
      USER_PERMISSIONS.lu_yanchen[page] = level;
    }
  });
}
function isOperatingPayrollPerson(person) {
  return !!person && !['shower','peng','lien'].includes(person);
}
function payrollNetAmount(r) {
  return (r.baseSalary||0)+(r.phoneAllowance||0)+(r.fullAttendanceBonus||0)+(r.dutyAllowance||0)+(r.performanceBonus||0)+(r.mealAllowance||0)+(r.overtimePay||0)+(r.expenseReimbursement||0)+(r.yearEndBonus||0)-(r.laborInsurance||0)-(r.healthInsurance||0)-(r.voluntaryPension||0)-(r.leaveDeduction||0);
}
function userHasProfitShareInCase(c, userId = currentUser?.id) {
  if (!c || !userId || c.excludeFromProfitReports || c.profitSplit === '不分潤') return false;
  const ratios = c.splitRatio || PROFIT_SPLIT_RATIOS[c.profitSplit] || {};
  return Number(ratios[userId] || 0) > 0;
}

function userCanViewCaseFinancials(caseCode, page) {
  const level = permissionLevel(page);
  const c = CASES.find(row => row.code === caseCode);
  if (c && !canSeeRestrictedCase(c)) return false;
  if (['manage','view_all','view_all_apply_self'].includes(level)) return true;
  if (level === 'none') return false;
  if (!c || !currentUser?.id) return false;
  return userHasProfitShareInCase(c);
}

function userCanViewCaseScopedRow(caseCode, page, rowPerson = '') {
  const level = permissionLevel(page);
  if (['manage','view_all','view_all_apply_self'].includes(level)) return true;
  if (caseCode) return userCanViewCaseFinancials(caseCode, page);
  return !!rowPerson && rowPerson === currentUser?.id;
}
const EMP_ACCESS_ROLES = {
  none: '不開通系統',
  admin: '行政',
  design: '設計師',
  pm: '專案經理',
  finance: '財務',
  accounting: '會計',
  owner: '老闆／完整管理者',
};
function defaultEmployeeAccessRole(e) {
  if (!e) return 'none';
  if (e.id === 'shower') return 'owner';
  if (e.id === 'nc') return 'finance';
  if (e.id === 'peng') return 'pm';
  if (e.id === 'lien') return 'design';
  if (e.id === 'sun') return 'admin';
  const role = String(e.role || '');
  if (role.includes('會計')) return 'accounting';
  if (role.includes('財務')) return 'finance';
  if (role.includes('專案')) return 'pm';
  if (role.includes('設計')) return 'design';
  if (role.includes('行政')) return 'admin';
  return 'none';
}
function employeeAccessRole(e) {
  return e?.accessRole || defaultEmployeeAccessRole(e);
}
function localDateKey(date = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
function empEffectiveStatus(e, today = localDateKey()) {
  if (!e) return '在職';
  const endDate = String(e.endDate || '').trim();
  if (e.status === '已離職' || (endDate && endDate <= today)) return '已離職';
  return e.status || '在職';
}
function employeeById(id) {
  return EMPLOYEES.find(e => e.id === id);
}
function isActiveEmployeeId(id) {
  const emp = employeeById(id);
  return !emp || empEffectiveStatus(emp) !== '已離職';
}
function systemUserById(id) {
  return USERS.find(u => u.id === id);
}
function activeSystemUsers(options = {}) {
  const includeIds = new Set(options.includeIds || []);
  return USERS.filter(u => includeIds.has(u.id) || isActiveEmployeeId(u.id));
}
function userOptionHtml(users, selectedId = '') {
  return users.map(u => `<option value="${u.id}" ${u.id === selectedId ? 'selected' : ''}>${u.name}</option>`).join('');
}
function userNameOptionHtml(users, selectedName = '') {
  return users.map(u => `<option ${u.name === selectedName ? 'selected' : ''}>${u.name}</option>`).join('');
}
function fillActiveUserSelect(id, selectedId = '', options = {}) {
  const el = document.getElementById(id);
  if (!el) return;
  const includeIds = options.includeInactive && selectedId ? [selectedId] : [];
  const users = activeSystemUsers({ includeIds });
  el.innerHTML = `${options.allLabel ? `<option value="">${options.allLabel}</option>` : ''}${userOptionHtml(users, selectedId)}`;
  el.value = selectedId && [...el.options].some(o => o.value === selectedId) ? selectedId : (options.allLabel ? '' : (users[0]?.id || ''));
}
function fillActiveUserNameSelect(id, selectedName = '', options = {}) {
  const el = document.getElementById(id);
  if (!el) return;
  const users = activeSystemUsers();
  const names = users.map(u => u.name);
  if (options.includeInactive && selectedName && !names.includes(selectedName)) {
    names.push(selectedName);
  }
  el.innerHTML = names.map(name => `<option ${name === selectedName ? 'selected' : ''}>${name}</option>`).join('');
  el.value = selectedName && names.includes(selectedName) ? selectedName : (names[0] || '');
}
function requireManage(page, message='您沒有修改此資料的權限') {
  if (canManage(page)) return true;
  showToast(message, 'error');
  return false;
}
function requireCreateCase(message='您沒有新增個案的權限') {
  if (canCreateCase()) return true;
  showToast(message, 'error');
  return false;
}

// ══════════════════════════════════
// 歷史資料預設值（localStorage 清空後重載會使用這些）
// ══════════════════════════════════
const _NAT = '國泰世華 活存 078-03-501213-2';
const _RXS = '瑞興銀行 支存 11-1160730';
const _RXH = '瑞興銀行 活存 0154211160760';

const INIT_CASES = [
  { code:'YT-VOL-2025-001', name:'林口三井', client:'VOL', clientName:'凱銳 Volvo', status:'結案', amount:860000, collected:0, person:'李鎮宇', pct:0, profitSplit:'三人' },
];
const INIT_PAYABLES = [
  // ── 林口三井 (YT-VOL-2025-001) ──────────────
  { id:1,  case:'YT-VOL-2025-001', caseName:'林口三井', vendor:'鴻浚工程有限公司',       summary:'三井鋁窗',                               amount:135450, wantDate:'2025-10-30', transferDate:'2025-10-28', doneDate:'2025-10-30', ticket:'', bank:_NAT, invoice:'有', receipt:'有', person:'彭俞豪', status:'paid', note:'' },
  { id:2,  case:'YT-VOL-2025-001', caseName:'林口三井', vendor:'小君工程行',             summary:'地毯',                                   amount:1444,   wantDate:'2025-11-10', transferDate:'',           doneDate:'2025-11-11', ticket:'', bank:_NAT, invoice:'無', receipt:'無', person:'連星羽', status:'paid', note:'' },
  { id:3,  case:'YT-VOL-2025-001', caseName:'林口三井', vendor:'新財圓環保建材工程行',   summary:'垃圾清運',                               amount:7000,   wantDate:'2025-11-10', transferDate:'2025-11-07', doneDate:'2025-11-10', ticket:'', bank:_NAT, invoice:'無', receipt:'有', person:'李鎮宇', status:'paid', note:'' },
  { id:4,  case:'YT-VOL-2025-001', caseName:'林口三井', vendor:'新財圓環保建材工程行',   summary:'垃圾清運',                               amount:4000,   wantDate:'2025-11-10', transferDate:'2025-11-07', doneDate:'2025-11-10', ticket:'', bank:_NAT, invoice:'無', receipt:'有', person:'李鎮宇', status:'paid', note:'' },
  { id:5,  case:'YT-VOL-2025-001', caseName:'林口三井', vendor:'富懋建材有限公司',       summary:'建材美耐板',                             amount:6064,   wantDate:'2025-11-30', transferDate:'2025-11-25', doneDate:'',           ticket:'2025-11-30', bank:_RXS, invoice:'有', receipt:'有', person:'李鎮宇', status:'paid', note:'' },
  { id:6,  case:'YT-VOL-2025-001', caseName:'林口三井', vendor:'東榮（幸全）工程行',     summary:'木作建材',                               amount:40488,  wantDate:'2025-11-30', transferDate:'2025-11-27', doneDate:'',           ticket:'2025-11-30', bank:_RXS, invoice:'有', receipt:'有', person:'李鎮宇', status:'paid', note:'' },
  { id:7,  case:'YT-VOL-2025-001', caseName:'林口三井', vendor:'林新貴',               summary:'木工工資10/8、9、12、13 阿哲4工、簡聽恆4工=8', amount:37600,  wantDate:'2025-10-20', transferDate:'2025-10-16', doneDate:'2025-10-20', ticket:'', bank:_NAT, invoice:'無', receipt:'無', person:'李鎮宇', status:'paid', note:'' },
  { id:8,  case:'YT-VOL-2025-001', caseName:'林口三井', vendor:'翔宇廣告',             summary:'林口三井Volvo發光字防撞貼腰帶',           amount:75285,  wantDate:'2025-11-10', transferDate:'2025-11-07', doneDate:'2025-11-10', ticket:'', bank:_NAT, invoice:'無', receipt:'無', person:'李鎮宇', status:'paid', note:'' },
  { id:9,  case:'YT-VOL-2025-001', caseName:'林口三井', vendor:'兩億花房',             summary:'林口三井開幕花藍',                       amount:6000,   wantDate:'2025-10-20', transferDate:'2025-10-16', doneDate:'2025-10-17', ticket:'', bank:_NAT, invoice:'無', receipt:'有', person:'李鎮宇', status:'paid', note:'' },
  { id:10, case:'YT-VOL-2025-001', caseName:'林口三井', vendor:'廣源工程行',           summary:'水電冷氣工程',                           amount:62160,  wantDate:'2025-11-10', transferDate:'2025-11-07', doneDate:'2025-11-10', ticket:'', bank:_NAT, invoice:'無', receipt:'有', person:'連星羽', status:'paid', note:'' },
  { id:11, case:'YT-VOL-2025-001', caseName:'林口三井', vendor:'威美英清潔',           summary:'清潔',                                   amount:21600,  wantDate:'2025-11-10', transferDate:'2025-11-07', doneDate:'2025-11-10', ticket:'', bank:_NAT, invoice:'無', receipt:'無', person:'連星羽', status:'paid', note:'' },
  { id:12, case:'YT-VOL-2025-001', caseName:'林口三井', vendor:'衛岳（阿瑞）',         summary:'玻璃保護貼膜及點工',                     amount:72476,  wantDate:'2025-11-20', transferDate:'2025-11-18', doneDate:'2025-11-20', ticket:'', bank:_NAT, invoice:'無', receipt:'無', person:'李鎮宇', status:'paid', note:'' },
  { id:13, case:'YT-VOL-2025-001', caseName:'林口三井', vendor:'東榮（幸全）工程行',   summary:'稅金4451-折扣2745',                     amount:1706,   wantDate:'2025-11-30', transferDate:'2025-11-27', doneDate:'',           ticket:'2025-11-30', bank:_RXS, invoice:'有', receipt:'有', person:'李鎮宇', status:'paid', note:'' },
  { id:14, case:'YT-VOL-2025-001', caseName:'林口三井', vendor:'牧門工程行',           summary:'輕鋼架工程',                             amount:21315,  wantDate:'2025-11-10', transferDate:'2025-11-07', doneDate:'',           ticket:'', bank:_NAT, invoice:'有', receipt:'無', person:'李鎮宇', status:'paid', note:'' },
  { id:15, case:'YT-VOL-2025-001', caseName:'林口三井', vendor:'盛揚高空車',           summary:'高空作業工程',                           amount:23100,  wantDate:'2025-10-30', transferDate:'2025-10-22', doneDate:'2025-10-30', ticket:'2025-10-30', bank:_RXS, invoice:'有', receipt:'有', person:'李鎮宇', status:'paid', note:'' },
  { id:16, case:'YT-VOL-2025-001', caseName:'林口三井', vendor:'九德工程行',           summary:'油漆工程',                               amount:39900,  wantDate:'2026-02-10', transferDate:'2026-02-09', doneDate:'2026-02-10', ticket:'', bank:_RXS, invoice:'有', receipt:'有', person:'李鎮宇', status:'paid', note:'' },
  { id:17, case:'YT-VOL-2025-001', caseName:'林口三井', vendor:'簡黃傳',               summary:'塑膠地磚',                               amount:3500,   wantDate:'2026-02-10', transferDate:'2026-02-09', doneDate:'2026-02-10', ticket:'', bank:_NAT, invoice:'無', receipt:'無', person:'李鎮宇', status:'paid', note:'' },
];
const INIT_RECEIVABLES = [
  // ── 林口三井 (YT-VOL-2025-001) ──────────────
  { id:1, case:'YT-VOL-2025-001', caseName:'林口三井', collectDate:'2025-11-27', buyer:'凱銳北區汽車股份有限公司', item:'裝修工程', collectAmt:860000, bank:_RXH, invoiceAmt:860000, invoiceDate:'2025-11-07', invoiceNo:'VK09980305', contractAmt:860000, progress:'完收', invoiceLink:'', status:'collected', note:'' },
];

let CASES = tagCompany(JSON.parse(JSON.stringify(INIT_CASES)));

// ══════════════════════════════════
// PAYABLE DATA
// ══════════════════════════════════
let pyNextId = INIT_PAYABLES.length + 1; // 從 id 18 開始
let PAYABLES = tagCompany(JSON.parse(JSON.stringify(INIT_PAYABLES)));
let pyTab_current = 'all';
let pyApproveTarget = null;

// ══════════════════════════════════
// RECEIVABLE DATA  (按實際入帳紀錄)
// ══════════════════════════════════
let RECEIVABLES = tagCompany(JSON.parse(JSON.stringify(INIT_RECEIVABLES)));
let rvNextId = INIT_RECEIVABLES.length + 1;
let rvTab_current = 'all';
let rvInvoiceTarget = null;

// ══════════════════════════════════
// CLIENT DATA
// ══════════════════════════════════
let EMPLOYEES = [
  {id:'nc',   name:'鄭詩褣', role:'財務', email:'nc@yutesign.com', profitEligible:false, attendanceRequired:false, startDate:'', contact:'', laborInsuranceDate:'', healthInsuranceDate:'', idNumber:'', emergencyContact:'', address:'', status:'在職', endDate:'', endReason:'', note:'老闆娘／財務管理者，免打卡'},
  {id:'peng', name:'彭俞豪', role:'專案經理', email:'peng@yutesign.com', profitEligible:true, attendanceRequired:false, startDate:'', contact:'', laborInsuranceDate:'', healthInsuranceDate:'', idNumber:'', emergencyContact:'', address:'', status:'在職', endDate:'', endReason:'', note:'獨立作業；薪資視為分潤預支，免打卡'},
  {id:'lien', name:'連星羽', role:'設計師', email:'lien@yutesign.com', profitEligible:true, attendanceRequired:false, startDate:'', contact:'', laborInsuranceDate:'', healthInsuranceDate:'', idNumber:'', emergencyContact:'', address:'', status:'在職', endDate:'', endReason:'', note:'獨立作業；薪資視為分潤預支，免打卡'},
  {id:'sun',  name:'孫一宣', role:'行銷行政', email:'sun@yutesign.com', accessRole:'none', profitEligible:false, attendanceRequired:false, startDate:'', contact:'', laborInsuranceDate:'', healthInsuranceDate:'', idNumber:'', emergencyContact:'', address:'', status:'已離職', endDate:'', endReason:'離職', note:'既有制度過渡；2026-07-30 使用者確認已離職；實際離職日期待補；後續外包採分潤制，不納入打卡規範'},
  {id:'lu_yanchen', name:'盧彥辰', role:'設計助理', email:'lu@yutesign.com', accessRole:'design', profitEligible:false, attendanceRequired:true, startDate:'2026-06-01', contact:'', laborInsuranceDate:'', healthInsuranceDate:'', idNumber:'', emergencyContact:'', address:'', status:'在職', endDate:'', endReason:'', note:'2026-06-01 到職；設計助理；2026-06-29 正式開通 OPS 登入，模組權限仍以 USER_PERMISSIONS.lu_yanchen 為準'},
  {id:'chen_hongjun', name:'陳虹君', role:'會計', email:'wendy@yutesign.com', accessRole:'none', profitEligible:false, attendanceRequired:false, startDate:'2026-07-01', contact:'', laborInsuranceDate:'', healthInsuranceDate:'', idNumber:'', emergencyContact:'', address:'', status:'已離職', endDate:'2026-07-15', endReason:'離職', note:'2026-07-01 到職；2026-07-15 離職；OPS 登入已停用'},
];
const INIT_EMPLOYEES = JSON.parse(JSON.stringify(EMPLOYEES));
const CODEX_REQUIRED_EMPLOYEES = INIT_EMPLOYEES
  .filter(e => ['lu_yanchen', 'chen_hongjun'].includes(e.id))
  .map(e => JSON.parse(JSON.stringify(e)));
let empNextId = 1;
let empEditId = null;

let CLIENTS = [
  {code:'VOL',shortName:'凱銳 Volvo',fullName:'凱銳北區汽車股份有限公司',taxId:'34604232',address:'新北市中和區板南路468號',type:'汽車展間',group:'凱銳集團',contact:'歐陽蕾',phone:'',email:'',note:'前名凱銳汽車，2025/05更名；含凱銳北區、博愛、控股'},
  {code:'JET',shortName:'凱銳能源',fullName:'凱銳能源股份有限公司',taxId:'82806784',address:'臺北市內湖區陽光街300號7樓',type:'商業空間',group:'凱銳集團',contact:'歐陽蕾',phone:'',email:'',note:'英文名 Jet Energy，嘉義據點'},
  {code:'KYG',shortName:'凱揚汽車',fullName:'凱揚汽車股份有限公司',taxId:'96782777',address:'新北市新莊區中正路58號',type:'汽車展間',group:'凱銳集團',contact:'歐陽蕾',phone:'',email:'',note:'濱江、同協路（高雄）'},
  {code:'SUZ',shortName:'凱騰鈴木',fullName:'凱騰鈴木汽車股份有限公司',taxId:'95491532',address:'新北市新莊區中正路58號',type:'汽車展間',group:'凱銳集團',contact:'歐陽蕾',phone:'',email:'',note:'木柵、民族、北投、基隆、南港'},
  {code:'UPY',shortName:'上洋產業',fullName:'上洋產業股份有限公司',taxId:'12978735',address:'新北市五股區五權六路39號',type:'廠辦',group:'',contact:'張文彬',phone:'',email:'',note:'英文名 Up Young，含東洋洗濯'},
  {code:'TOY',shortName:'東洋洗濯',fullName:'東洋洗濯事業股份有限公司',taxId:'60762111',address:'新北市鶯歌區八德路3之8號',type:'廠辦',group:'上洋集團',contact:'',phone:'',email:'',note:'上洋集團旗下子公司'},
  {code:'CHL',shortName:'俊林實業',fullName:'俊林實業股份有限公司',taxId:'86868796',address:'臺北市松山區東光里南京東路五段37-1號',type:'商業空間',group:'',contact:'林建修',phone:'',email:'',note:'英文名 Chill Lin'},
  {code:'WWF',shortName:'文威豐',fullName:'文威豐股份有限公司',taxId:'60762111',address:'新北市新莊區五權一路3號3樓之5',type:'商業空間',group:'',contact:'邱董',phone:'',email:'',note:''},
  {code:'ATG',shortName:'安庭傢俱',fullName:'安庭傢俱有限公司',taxId:'80503763',address:'臺北市中山區明水路581巷23號',type:'住宅/傢俱',group:'',contact:'林政賢',phone:'',email:'',note:''},
  {code:'FBP',shortName:'富邦產物保險',fullName:'富邦產物保險股份有限公司',taxId:'70826461',address:'臺北市中山區遼寧街179號7-14樓',type:'商業空間',group:'',contact:'',phone:'',email:'',note:''},
  {code:'ZFP',shortName:'兆豐產物保險',fullName:'兆豐產物保險股份有限公司',taxId:'03090217',address:'臺北市中正區武昌街一段58號',type:'商業空間',group:'',contact:'',phone:'',email:'',note:''},
  {code:'YYS',shortName:'有意思藝文',fullName:'有意思藝文整合有限公司',taxId:'94113169',address:'臺北市大安區安和路1段135巷13號地下樓',type:'商業空間',group:'',contact:'林柏勳',phone:'',email:'',note:''},
  {code:'ZHG',shortName:'板橋張總',fullName:'張文海（個人）',taxId:'（個人）',address:'待補',type:'住宅',group:'',contact:'張文海',phone:'',email:'',note:'新美齊画世代'},
  {code:'LIN',shortName:'板橋林協理',fullName:'林麗茜（個人）',taxId:'（個人）',address:'待補',type:'住宅',group:'',contact:'林麗茜',phone:'',email:'',note:''},
  {code:'BAR',shortName:'Barry 內湖',fullName:'昀晉有限公司',taxId:'90414059',address:'新北市板橋區三民路2段37號18樓之3',type:'住宅',group:'',contact:'呂詩偉',phone:'',email:'',note:''},
  {code:'LMO',shortName:'李媽媽',fullName:'李秋惠（李媽媽）',taxId:'（個人）',address:'待補',type:'自然人／親友',group:'特殊個案',contact:'李媽媽',phone:'',email:'',note:'玉成街親友工程與私人借支收回款使用；個案類別控制是否進入員工分潤。'},
  {code:'LCH',shortName:'李啟弘',fullName:'李啟弘（虎林街住家）',taxId:'（個人）',address:'待補',type:'親友工程',group:'特殊個案',contact:'李啟弘',phone:'',email:'',note:'虎林街住家親友工程客戶主檔；個案類別控制是否進入員工分潤。'},
];
tagCompany(CLIENTS);
let clEditCode = null;

// ══════════════════════════════════
// VENDOR DATA
// ══════════════════════════════════
let VENDORS = [
  {code:'DM-001',name:'元翔高空有限公司',trade:'假設及拆運',taxId:'45141292',owner:'',tel:'',mobile:'0938-302-586',email:'',address:'高雄市楠梓區常興街75號7樓',bank:'台灣土地銀行',branch:'大社分行',account:'067001035484',accountName:'元翔高空有限公司',payMethod:'匯款',note:'',status:'有效'},
  {code:'DM-002',name:'冠宥企業社',trade:'假設及拆運',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'第一銀行',branch:'嘉義分行',account:'50157003971',accountName:'侯舜議',payMethod:'匯款',note:'',status:'有效'},
  {code:'DM-003',name:'家禾起重工程行',trade:'假設及拆運',taxId:'31868293',owner:'黃鉉傑',tel:'02-3393-1226',mobile:'',email:'',address:'台北市中正區南昌路一段59巷12號',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'',status:'有效'},
  {code:'DM-004',name:'新財圓環保建材工程行',trade:'假設及拆運',taxId:'',owner:'洪竑憶',tel:'02-8662-6926',mobile:'0910-993230',email:'',address:'台北市信義區基隆路一段186號9樓之4',bank:'合作金庫銀行',branch:'新店分行',account:'0080765745300',accountName:'洪程謙',payMethod:'匯款',note:'',status:'有效'},
  {code:'DM-005',name:'東亨企業（清運）',trade:'假設及拆運',taxId:'54218716',owner:'',tel:'',mobile:'',email:'',address:'高雄市仁武區大灣里仁雄路369號1樓',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'',status:'有效'},
  {code:'DM-006',name:'永登環保（清運）',trade:'假設及拆運',taxId:'',owner:'',tel:'07-7824338',mobile:'',email:'',address:'高雄市大寮區潮寮里潮龍路135號1樓',bank:'高雄銀行',branch:'九如分部',account:'221102335186',accountName:'永登環保有限公司',payMethod:'匯款',note:'帳戶已過期',status:'有效'},
  {code:'DM-007',name:'盛揚高空車有限公司',trade:'假設及拆運',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'',status:'有效'},
  {code:'DM-008',name:'祥展企業社',trade:'假設及拆運',taxId:'40921116',owner:'陳雅君',tel:'',mobile:'0912-817386',email:'',address:'嘉義縣民雄鄉三興村三豐路256號一樓',bank:'台灣土地銀行',branch:'民雄分行',account:'066001026969',accountName:'祥展企業社',payMethod:'匯款',note:'',status:'有效'},
  {code:'DM-009',name:'紘吉工程行',trade:'假設及拆運',taxId:'85153792',owner:'林信吉',tel:'02-26239601',mobile:'',email:'',address:'新北市八里區埤頭二街67巷3號',bank:'中國信託商業銀行',branch:'劍潭分行',account:'248540086375',accountName:'紘吉工程行',payMethod:'匯款',note:'',status:'有效'},
  {code:'DM-010',name:'艾群營造有限公司（高空車）',trade:'假設及拆運',taxId:'',owner:'王韋翔',tel:'05-2685196',mobile:'0933-901-502',email:'',address:'嘉義縣⽔上鄉龍德村三鎮路200號附17',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'',status:'有效'},
  {code:'TL-009',name:'莊自強',trade:'泥作及貼磚',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'中華郵政',branch:'後壁營業郵局',account:'01910620104564',accountName:'莊自強',payMethod:'匯款',note:'',status:'有效'},
  {code:'DM-012',name:'衡岳室內裝修工程有限公司 阿瑞',trade:'假設及拆運',taxId:'91032277',owner:'',tel:'',mobile:'',email:'',address:'桃園市龜山區樂善里樂善二路181號27樓之1',bank:'中國信託商業銀行',branch:'城東分行',account:'071513117655',accountName:'邱睿墉',payMethod:'匯款',note:'',status:'有效'},
  {code:'DM-013',name:'陳美滿（麗文山）垃圾車',trade:'假設及拆運',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'',status:'有效'},
  {code:'DM-014',name:'雅吉企業社（清運）',trade:'假設及拆運',taxId:'',owner:'邱麟貴',tel:'07-3710760',mobile:'',email:'',address:'高雄市仁武區仁雄路369號',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'',status:'有效'},
  {code:'TW-001',name:'俊民工程有限公司',trade:'土木工程',taxId:'23296960',owner:'陳俊宏',tel:'02-2786-4786',mobile:'0937-200-500',email:'',address:'台北市南港區忠孝東路六段110巷12號',bank:'富邦銀行',branch:'玉成分行',account:'00303102002370',accountName:'俊民工程有限公司',payMethod:'匯款',note:'',status:'有效'},
  {code:'TW-002',name:'元山五金工業股份有限公司',trade:'土木工程',taxId:'33031525',owner:'吳綺洋',tel:'02-2268-4986',mobile:'',email:'',address:'新北市土城區中央路四段29號',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'',status:'有效'},
  {code:'TW-003',name:'達樺企業',trade:'土木工程',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'華南銀行',branch:'松山分行',account:'115-10-015062-4',accountName:'達樺企業有限公司',payMethod:'匯款',note:'',status:'有效'},
  {code:'EL-001',name:'世翃企業有限公司',trade:'水電／照明',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'',status:'有效'},
  {code:'EL-002',name:'勵欣水電行',trade:'水電／照明',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'',status:'有效'},
  {code:'EL-003',name:'宸昌企業社',trade:'水電／照明',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'',status:'有效'},
  {code:'EL-004',name:'廣源水電行',trade:'水電／照明',taxId:'41054937',owner:'蔡忠源',tel:'02-2283-0173',mobile:'0938-318620',email:'',address:'新北市蘆洲區長安街131巷4弄1號',bank:'蘆洲區農會',branch:'長安分部',account:'70503-01-070000-6',accountName:'廣源水電行',payMethod:'匯款',note:'',status:'有效'},
  {code:'EL-005',name:'懿品企業有限公司（建興水電）',trade:'水電／照明',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'台北市第五信用合作社',branch:'松山分社',account:'00054111208330',accountName:'懿品企業有限公司',payMethod:'匯款',note:'',status:'有效'},
  {code:'EL-006',name:'林信富',trade:'水電／照明',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'中華郵政',branch:'士林郵局',account:'00012841266049',accountName:'林信富',payMethod:'匯款',note:'',status:'有效'},
  {code:'EL-007',name:'益鴻小張',trade:'水電／照明',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'台北富邦銀行',branch:'師大分行',account:'610168227941',accountName:'張文榕',payMethod:'匯款',note:'',status:'有效'},
  {code:'EL-008',name:'陳信宏',trade:'水電／照明',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'中國信託商業銀行',branch:'鳳山分行',account:'229531065586',accountName:'陳信宏',payMethod:'匯款',note:'',status:'有效'},
  {code:'WP-001',name:'丹利歐國際有限公司 謝承璋',trade:'防水',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'',status:'有效'},
  {code:'PT-001',name:'牧門工程行',trade:'輕隔間及輕鋼架天花板',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'新光銀行',branch:'新埔分行',account:'0338101011821',accountName:'牧門工程行',payMethod:'匯款',note:'',status:'有效'},
  {code:'PT-002',name:'竹庭工程行',trade:'輕隔間及輕鋼架天花板',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'高雄三信',branch:'陽明分社',account:'01600102008006',accountName:'竹庭工程行 王藝橙',payMethod:'匯款',note:'',status:'有效'},
  {code:'TL-001',name:'吳東原泥作',trade:'泥作及貼磚',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'台新國際商業銀行',branch:'天母分行',account:'2017100031185-7',accountName:'吳東原',payMethod:'匯款',note:'',status:'有效'},
  {code:'TL-002',name:'堉騰工程行',trade:'泥作及貼磚',taxId:'94323812',owner:'莊自強',tel:'',mobile:'',email:'',address:'臺南市後壁區長短樹里長短樹111號',bank:'後壁區農會',branch:'寶安分部',account:'54702-01-000004-6',accountName:'堉騰工程行',payMethod:'匯款',note:'',status:'有效'},
  {code:'TL-003',name:'廣利宇股份有限公司（冠軍磁磚）',trade:'泥作及貼磚',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'',status:'有效'},
  {code:'TL-004',name:'怡東國際企業股份有限公司（自平泥）',trade:'泥作及貼磚',taxId:'',owner:'陳書毅',tel:'02-2712-2556',mobile:'',email:'',address:'台北市大安區仁愛路三段123巷26弄8號1樓',bank:'彰化商業銀行',branch:'晴光分行',account:'9721-01-099893-00',accountName:'怡東國際企業股份有限公司',payMethod:'匯款',note:'',status:'有效'},
  {code:'TL-005',name:'王宥鈞（阿義）',trade:'泥作及貼磚',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'中國信託商業銀行',branch:'丹鳳分行',account:'761540146624',accountName:'王宥鈞',payMethod:'匯款',note:'',status:'有效'},
  {code:'TL-006',name:'陳文池泥作',trade:'泥作及貼磚',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'泰山區農會',branch:'泰林分部',account:'78806-11-100044-9',accountName:'陳文池',payMethod:'匯款',note:'',status:'有效'},
  {code:'TL-007',name:'陳柏任',trade:'泥作及貼磚',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'中華郵政',branch:'台北松德郵局',account:'00015120628764',accountName:'陳柏任',payMethod:'匯款',note:'',status:'有效'},
  {code:'TL-008',name:'龍益窯業股份有限公司',trade:'泥作及貼磚',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'',status:'有效'},
  {code:'WD-001',name:'圓融系統櫥櫃有限公司',trade:'木作及系統櫃',taxId:'60791354',owner:'黃雅玫',tel:'',mobile:'0965-251-891',email:'',address:'高雄市前金區自強一路22號3樓之1',bank:'國泰世華銀行',branch:'苓雅分行',account:'029-03-501025-2',accountName:'圓融系統廚櫃有限公司',payMethod:'匯款',note:'',status:'有效'},
  {code:'WD-002',name:'杰騰室內',trade:'木作及系統櫃',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'國泰世華銀行',branch:'板橋分行',account:'205-03-500719-0',accountName:'杰騰室內裝修有限公司',payMethod:'匯款',note:'',status:'有效'},
  {code:'WD-003',name:'林建成木工',trade:'木作及系統櫃',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'台北富邦銀行',branch:'玉成分行',account:'00303221014505',accountName:'林建成',payMethod:'匯款',note:'',status:'有效'},
  {code:'WD-004',name:'林新貴木工',trade:'木作及系統櫃',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'',status:'有效'},
  {code:'WD-005',name:'林阿照',trade:'木作及系統櫃',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'瑞興銀行',branch:'南港分行',account:'0154220112810',accountName:'林阿照',payMethod:'匯款',note:'',status:'有效'},
  {code:'WD-006',name:'森沅木作工程有限公司',trade:'木作及系統櫃',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'',status:'有效'},
  {code:'WD-007',name:'樂晴（寯工）木工',trade:'木作及系統櫃',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'',status:'有效'},
  {code:'WD-008',name:'永藏系統傢俱有限公司',trade:'木作及系統櫃',taxId:'94158475',owner:'李宗憶',tel:'02-22570802',mobile:'0938-780-701',email:'',address:'新北市板橋民生路二段226巷8弄16-1號',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'',status:'有效'},
  {code:'WD-009',name:'游志松（貴威）',trade:'木作及系統櫃',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'台灣土地銀行',branch:'大園分行',account:'136001001701',accountName:'貫威室內裝修工程有限公司',payMethod:'匯款',note:'',status:'有效'},
  {code:'WD-010',name:'簡秋隆',trade:'木作及系統櫃',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'中華郵政',branch:'三芝郵局',account:'24413310131826',accountName:'簡秋隆',payMethod:'匯款',note:'',status:'有效'},
  {code:'WD-011',name:'胡地',trade:'木作及系統櫃',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'中華郵政',branch:'板橋後埔郵局',account:'03110350365164',accountName:'胡地',payMethod:'匯款',note:'',status:'有效'},
  {code:'WD-012',name:'陳志璋',trade:'木作及系統櫃',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'',status:'有效'},
  {code:'WD-013',name:'陳玄宗',trade:'木作及系統櫃',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'國泰世華銀行',branch:'北投分行',account:'115-53-000177-8',accountName:'陳玄宗',payMethod:'匯款',note:'',status:'有效'},
  {code:'DR-001',name:'弘威自動門有限公司',trade:'門扇',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'',status:'有效'},
  {code:'AL-001',name:'達洛維門窗股份有限公司',trade:'鋁窗',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'',status:'有效'},
  {code:'AL-002',name:'鋁工藝',trade:'鋁窗',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'',status:'有效'},
  {code:'AL-003',name:'鴻昇鋁門窗',trade:'鋁窗',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'',status:'有效'},
  {code:'AL-004',name:'鴻泩工程有限公司',trade:'鋁窗',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'合作金庫銀行',branch:'三重分行',account:'0100717156140',accountName:'鴻泩工程有限公司',payMethod:'匯款',note:'',status:'有效'},
  {code:'MT-001',name:'上新金屬工程行陳明義',trade:'鐵件及金屬',taxId:'38781595',owner:'陳明義',tel:'05-3878-1595',mobile:'0910-125698',email:'',address:'雲林縣斗南鎮光里光華路2之8號1樓',bank:'彰化銀行',branch:'斗南分行',account:'61170100939000',accountName:'上新金屬工程行陳明義',payMethod:'匯款',note:'',status:'有效'},
  {code:'MT-002',name:'利保金屬',trade:'鐵件及金屬',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'',status:'有效'},
  {code:'MT-003',name:'富晟帆布鐵架企業社',trade:'鐵件及金屬',taxId:'13845684',owner:'關宗吉',tel:'02-2651-9393',mobile:'',email:'',address:'台北市成功路1段88號',bank:'華南商業銀行',branch:'南港分行',account:'158-10-003225-1',accountName:'富晟帆布鐵架企業社',payMethod:'匯款',note:'',status:'有效'},
  {code:'MT-004',name:'陳順發門窗行',trade:'鐵件及金屬',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'陽信銀行',branch:'石牌分行',account:'007420089157',accountName:'陳順發門窗行',payMethod:'匯款',note:'',status:'有效'},
  {code:'MT-005',name:'鴻晟企業有限公司',trade:'鐵件及金屬',taxId:'',owner:'',tel:'04-2515-7558',mobile:'',email:'',address:'',bank:'合作金庫銀行',branch:'美村分行',account:'1988-717-131729',accountName:'鴻晟企業有限公司',payMethod:'匯款',note:'',status:'有效'},
  {code:'PA-001',name:'九億工程行',trade:'油漆',taxId:'42356903',owner:'賴炯典',tel:'02-25979234',mobile:'',email:'',address:'臺北市萬華區民和街55巷8號3樓',bank:'第一銀行',branch:'圓山分行',account:'140-10-050421',accountName:'九億工程行',payMethod:'匯款',note:'',status:'有效'},
  {code:'PA-002',name:'全彩企業社',trade:'油漆',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'新光銀行',branch:'嘉義分行',account:'0620-10-100793-1',accountName:'全彩企業社',payMethod:'匯款',note:'',status:'有效'},
  {code:'PA-003',name:'猿彩',trade:'油漆',taxId:'',owner:'',tel:'8303-8657',mobile:'0936-707-437',email:'',address:'新北市板橋區府中路265巷18弄10號3樓',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'',status:'有效'},
  {code:'PA-004',name:'螺宇工程行（陳建榮）',trade:'油漆',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'合作金庫銀行',branch:'南桃園分行',account:'1210717640801',accountName:'嶸宇工程行',payMethod:'匯款',note:'',status:'有效'},
  {code:'PA-005',name:'鴻正興工程',trade:'油漆',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'台新國際商業銀行',branch:'苓雅分行',account:'2015-10-5028063-4',accountName:'葉建龍',payMethod:'匯款',note:'',status:'有效'},
  {code:'FL-001',name:'伊諾華',trade:'地坪',taxId:'00210305',owner:'',tel:'02-2255-4777',mobile:'',email:'',address:'',bank:'合作金庫銀行',branch:'海山分行',account:'1036-898-000425',accountName:'馬來西亞商伊諾華國際有限公司台灣分公司',payMethod:'匯款',note:'',status:'有效'},
  {code:'FL-002',name:'唐承國際股份有限公司',trade:'地坪',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'',status:'有效'},
  {code:'FL-003',name:'大金國際百貨行（洗車區地格柵材料）',trade:'地坪',taxId:'47940270',owner:'',tel:'',mobile:'0980-468933',email:'',address:'',bank:'中國信託商業銀行',branch:'',account:'148540279091',accountName:'大金國際百貨行',payMethod:'匯款',note:'',status:'有效'},
  {code:'FL-004',name:'宸薏工程行EPOXY',trade:'地坪',taxId:'',owner:'',tel:'',mobile:'0930-540953',email:'',address:'814高雄市仁武區澄合街588號',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'支票付款',status:'有效'},
  {code:'FL-005',name:'小君工程行',trade:'地坪',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'華南銀行',branch:'士林分行',account:'123-10-008611-7',accountName:'小君工程行',payMethod:'匯款',note:'',status:'有效'},
  {code:'FL-006',name:'東沐工程行',trade:'地坪',taxId:'93443640',owner:'',tel:'04-2515-1788',mobile:'0925-236972',email:'',address:'台中市豐原區北陽里豐東路29號1樓',bank:'三信商業銀行',branch:'',account:'14-2-003024-6',accountName:'東沐工程行',payMethod:'匯款',note:'',status:'有效'},
  {code:'FL-007',name:'簡黃傳',trade:'地坪',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'上海商業儲蓄銀行',branch:'士林分行',account:'36203000055415',accountName:'簡黃傳',payMethod:'匯款',note:'',status:'有效'},
  {code:'FL-008',name:'譽展EPOXY',trade:'地坪',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'',status:'有效'},
  {code:'FL-009',name:'長龍工程行',trade:'地坪',taxId:'99091538',owner:'莊龍溪',tel:'02-2904-3818',mobile:'0928-220-731',email:'',address:'新北市新莊區鳳山街56巷31號4F',bank:'安泰銀行',branch:'新莊分行',account:'00612601751500',accountName:'長龍工程行',payMethod:'匯款',note:'',status:'有效'},
  {code:'FL-010',name:'陳中棟（洗車區地格柵）',trade:'地坪',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'中國信託商業銀行',branch:'中壢分行',account:'129533859052',accountName:'陳中棟',payMethod:'匯款',note:'',status:'有效'},
  {code:'GL-001',name:'凱軒有限公司',trade:'玻璃及貼膜',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'',status:'有效'},
  {code:'GL-002',name:'宏冠玻璃行',trade:'玻璃及貼膜',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'華南銀行',branch:'東湖分行',account:'134-10-001258-1',accountName:'宏冠玻璃行陳宏聲',payMethod:'匯款',note:'',status:'有效'},
  {code:'GL-003',name:'承明玻璃有限公司',trade:'玻璃及貼膜',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'',status:'有效'},
  {code:'GL-004',name:'林家暉',trade:'玻璃及貼膜',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'中國信託商業銀行',branch:'東湖簡分行',account:'587540118425',accountName:'林家暉',payMethod:'匯款',note:'',status:'有效'},
  {code:'SG-001',name:'翔宇廣告有限公司',trade:'廣告及招牌',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'玉山銀行',branch:'民權分行',account:'0598-440-001326',accountName:'翔宇廣告有限公司',payMethod:'匯款',note:'',status:'有效'},
  {code:'CR-001',name:'多芝星國際有限公司',trade:'窗簾',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'',status:'有效'},
  {code:'CR-002',name:'連文彬',trade:'窗簾',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'中華郵政',branch:'台北永春郵局',account:'00019900249061',accountName:'連文彬',payMethod:'匯款',note:'',status:'有效'},
  {code:'AC-001',name:'上洋產業股份有限公司',trade:'空調',taxId:'12978735',owner:'',tel:'',mobile:'',email:'',address:'新北市五股區五權六路39號',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'',status:'有效'},
  {code:'AC-002',name:'揚達空調',trade:'空調',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'',status:'有效'},
  {code:'AC-003',name:'晟廷空調工程行',trade:'空調',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'',status:'有效'},
  {code:'AC-004',name:'侑昇工程行',trade:'空調',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'',status:'有效'},
  {code:'ST-001',name:'奇碁科創有限公司',trade:'石材／人造石',taxId:'',owner:'',tel:'02-2602-3099',mobile:'',email:'',address:'',bank:'國泰世華銀行',branch:'南崁分行',account:'135-03-000637-5',accountName:'奇碁科創有限公司',payMethod:'匯款',note:'',status:'有效'},
  {code:'ST-002',name:'石家莊林明正（美容）',trade:'石材／人造石',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'國泰世華銀行',branch:'北投分行',account:'115-03-500090-1',accountName:'石家莊工程行林明正',payMethod:'匯款',note:'',status:'有效'},
  {code:'ST-003',name:'碇國',trade:'石材／人造石',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'',status:'有效'},
  {code:'BT-001',name:'王子建材有限公司',trade:'衛浴設備',taxId:'52581078',owner:'王傑生/劉苡妮',tel:'02-23036888',mobile:'0966-437-581',email:'',address:'台北市萬華區興寧街62之2號1樓',bank:'中國信託商業銀行',branch:'萬華分行',account:'668540200294',accountName:'王子建材有限公司',payMethod:'匯款',note:'',status:'有效'},
  {code:'BT-002',name:'章記企業有限公司',trade:'衛浴設備',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'',status:'有效'},
  {code:'BT-003',name:'腱欣企業股份有限公司（TOTO）',trade:'衛浴設備',taxId:'80231382',owner:'',tel:'02-29958380',mobile:'',email:'',address:'新北市三重區光復路一段68巷24弄1-1號',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'',status:'有效'},
  {code:'KT-001',name:'禾興廚具企業社',trade:'廚具設備',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'',status:'有效'},
  {code:'KT-002',name:'立穩宏業有限公司（不鏽鋼）',trade:'廚具設備',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'永豐銀行',branch:'仁愛分行',account:'160-018-000-05806',accountName:'立穩宏業有限公司',payMethod:'匯款',note:'',status:'有效'},
  {code:'KT-003',name:'賀安企業股份有限公司 賀眾飲水機',trade:'廚具設備',taxId:'93496569',owner:'',tel:'02-2786-1100',mobile:'',email:'',address:'臺北市南港區忠孝東路六段65號',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'',status:'有效'},
  {code:'KT-004',name:'里荷雅企業股份有限公司',trade:'廚具設備',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'元大銀行',branch:'中科分行',account:'20952000046268',accountName:'里荷雅企業股份有限公司',payMethod:'匯款',note:'',status:'有效'},
  {code:'LT-001',name:'信威金屬（燈具）',trade:'燈具／設備及其他',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'',status:'有效'},
  {code:'LT-002',name:'北富耀企業有限公司',trade:'燈具／設備及其他',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'合作金庫銀行',branch:'沙鹿分行',account:'0210717504610',accountName:'北富耀企業有限公司',payMethod:'匯款',note:'',status:'有效'},
  {code:'LT-003',name:'源韋股份有限公司',trade:'燈具／設備及其他',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'玉山銀行',branch:'雙和分行',account:'0129-440-032296',accountName:'源韋股份有限公司',payMethod:'匯款',note:'',status:'有效'},
  {code:'LT-004',name:'華彩光電有限公司',trade:'燈具／設備及其他',taxId:'42993516',owner:'',tel:'02-8792-6066',mobile:'',email:'',address:'台北市內湖區新湖三路168號7樓',bank:'永豐銀行',branch:'三興分行',account:'147-018-0004081-9',accountName:'華彩光電有限公司',payMethod:'匯款',note:'',status:'有效'},
  {code:'LT-005',name:'電火國際有限公司',trade:'燈具／設備及其他',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'玉山銀行',branch:'安南分行',account:'1403940022517',accountName:'電火國際有限公司',payMethod:'匯款',note:'',status:'有效'},
  {code:'LT-006',name:'澤鑠科技',trade:'燈具／設備及其他',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'',status:'有效'},
  {code:'CL-001',name:'威美英',trade:'完工清潔',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'中華郵政',branch:'',account:'00010063056595',accountName:'戚美英',payMethod:'匯款',note:'',status:'有效'},
  {code:'CL-002',name:'陳進財',trade:'完工清潔',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'桃園市龜山區農會',branch:'龍壽分部',account:'76804-01-000472-7',accountName:'陳進財',payMethod:'匯款',note:'',status:'有效'},
  {code:'CL-003',name:'林繆云',trade:'完工清潔',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'實際做清潔的廠商；請木作廠商森沅代開發票，付款記錄寫「林繆云（森沅發票）」。',status:'有效'},
  {code:'PS-004',name:'吳毓昌建築師事務所',trade:'專業顧問服務',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'國泰世華銀行',branch:'三民分行',account:'057-50-501703-1',accountName:'吳毓昌',payMethod:'匯款',note:'',status:'有效'},
  {code:'PS-005',name:'宗誠林文宗結構土木事務所',trade:'專業顧問服務',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'台北富邦商業銀行',branch:'仁愛分行',account:'00704102006302',accountName:'宗誠結構土木技師事務所',payMethod:'匯款',note:'',status:'有效'},
  {code:'DS-001',name:'李鎮宇',trade:'設計製圖',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'',status:'有效'},
  {code:'DS-005',name:'深圳市祺德設計有限公司',trade:'設計製圖',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'',status:'有效'},
  {code:'DS-006',name:'連星羽',trade:'設計製圖',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'',status:'有效'},
  {code:'SP-001',name:'上順五金行',trade:'建材供應',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'瑞興銀行',branch:'',account:'0084221986691',accountName:'程千綺',payMethod:'匯款',note:'',status:'有效'},
  {code:'SP-002',name:'創意玩家股份有限公司',trade:'建材供應',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'',status:'有效'},
  {code:'SP-003',name:'富卯實業股份有限公司',trade:'建材供應',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'',status:'有效'},
  {code:'SP-004',name:'富懋建材事業股份有限公司',trade:'建材供應',taxId:'86308247',owner:'',tel:'',mobile:'',email:'',address:'台北市內湖區陽光街381號',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'',status:'有效'},
  {code:'SP-005',name:'帝宏實業股份有限公司（木扶手）',trade:'建材供應',taxId:'86548350',owner:'陳俊昌',tel:'06-5976688',mobile:'',email:'',address:'台南市安定區港尾里港子尾35-20號',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'',status:'有效'},
  {code:'SP-006',name:'幸全企業有限公司 東榮',trade:'建材供應',taxId:'04467318',owner:'李欽洸',tel:'02-8668-5500',mobile:'',email:'',address:'新北市永和區永元路89號7F',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'',status:'有效'},
  {code:'SP-007',name:'弘宇建材',trade:'建材供應',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'',status:'有效'},
  {code:'SP-008',name:'松潤實業有限公司（金屬收邊）',trade:'建材供應',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'',status:'有效'},
  {code:'SP-009',name:'永明木材行',trade:'建材供應',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'',status:'有效'},
  {code:'SP-010',name:'泰旺建材（水泥沙漿）',trade:'建材供應',taxId:'00214787',owner:'林建佑',tel:'02-2610-1855',mobile:'',email:'',address:'新北市八里區觀海大道269-1號',bank:'淡水信用合作社',branch:'',account:'00070110705010',accountName:'泰旺建材有限公司',payMethod:'匯款',note:'',status:'有效'},
  {code:'SP-011',name:'環舜五金有限公司',trade:'建材供應',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'',status:'有效'},
  {code:'SP-012',name:'發強五金有限公司',trade:'建材供應',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'華泰商業銀行',branch:'大同分行',account:'0403000132380',accountName:'發強五金有限公司',payMethod:'匯款',note:'',status:'有效'},
  {code:'SP-013',name:'福松興業有限公司（磁磚水泥砂）',trade:'建材供應',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'',status:'有效'},
  {code:'SP-014',name:'福門企業有限公司（塑膠地磚）',trade:'建材供應',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'遠東國際商業銀行',branch:'台中朝富分行',account:'050-001-0000218-9',accountName:'福門企業有限公司',payMethod:'匯款',note:'',status:'有效'},
  {code:'SP-015',name:'網建行',trade:'建材供應',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'玉山銀行',branch:'新莊分行',account:'0059-940-038887',accountName:'網建行興業有限公司',payMethod:'匯款',note:'',status:'有效'},
  {code:'SP-016',name:'豐渥實業有限公司（木皮板）',trade:'建材供應',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'',status:'有效'},
  {code:'SP-017',name:'金能有限公司（塑膠地磚）',trade:'建材供應',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'',status:'有效'},
  {code:'SP-018',name:'金通企業有限公司',trade:'建材供應',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'瑞興銀行',branch:'長安分行',account:'0075210619970',accountName:'金通企業有限公司',payMethod:'匯款',note:'',status:'有效'},
  {code:'FN-001',name:'安庭傢俱',trade:'傢俱設備',taxId:'94084903',owner:'林士鈞',tel:'02-2532-9275',mobile:'',email:'atcasa.sam@gmail.com',address:'台北市中山區樂群三路187號8樓',bank:'第一銀行',branch:'大直分行',account:'107-10-026669',accountName:'安琝家具設計有限公司',payMethod:'匯款',note:'',status:'有效'},
  {code:'FN-002',name:'新傳興業',trade:'傢俱設備',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'',status:'有效'},
  {code:'OT-001',name:'南山產物',trade:'其他',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'',status:'有效'},
  {code:'OT-002',name:'嘉義太保房租',trade:'其他',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'陽信銀行',branch:'向上分行',account:'07702-001767-1',accountName:'周秀貞',payMethod:'匯款',note:'',status:'有效'},
  {code:'OT-003',name:'國豐輪胎',trade:'其他',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'',status:'有效'},
  {code:'PS-001',name:'柏實會計事務所',trade:'專業顧問服務',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'',status:'有效'},
  {code:'PS-002',name:'林振明（柏實）',trade:'專業顧問服務',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'柏實會計事務所記帳人員；過去付款記錄曾用「林振銘」「柏實」等別名。',status:'有效'},
  {code:'PS-003',name:'統領律師事務所',trade:'專業顧問服務',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'新光銀行',branch:'古亭分行',account:'0471100889066',accountName:'統領法律事務所',payMethod:'匯款',note:'',status:'有效'},
  {code:'PS-006',name:'台北設計工會',trade:'專業顧問服務',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'',status:'有效'},
  {code:'OT-006',name:'美兆健檢中心',trade:'其他',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'',status:'有效'},
  {code:'OT-007',name:'鎔德股份有限公司',trade:'其他',taxId:'38648416',owner:'',tel:'',mobile:'',email:'',address:'',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'',status:'有效'},
  {code:'OT-008',name:'雨儂花房',trade:'其他',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'',status:'有效'},
  {code:'OT-009',name:'顏志洋：蝸牛家建設有限公司',trade:'其他',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'彰化銀行',branch:'三和路分行',account:'9641-95-02049-2-00',accountName:'顏志洋',payMethod:'匯款',note:'',status:'有效'},
  {code:'OT-010',name:'李媽媽（李秋惠）',trade:'私人借支／親友往來',taxId:'（個人）',owner:'李秋惠',tel:'',mobile:'',email:'',address:'',bank:'',branch:'',account:'',accountName:'李秋惠',payMethod:'匯款',note:'同一人可同時存在於客戶主檔與廠商主檔；應付為借出或代付款，應收為收回款。',status:'有效'},
];
tagCompany(VENDORS);
let vdEditCode = null;

const INIT_CLIENTS = JSON.parse(JSON.stringify(CLIENTS));
const INIT_VENDORS = JSON.parse(JSON.stringify(VENDORS));

function ensureCoreClientRecords() {
  INIT_CLIENTS.forEach(seed => {
    const existing = CLIENTS.find(c => c.code === seed.code);
    if (!existing) CLIENTS.push(JSON.parse(JSON.stringify(seed)));
    else ['shortName','fullName','type','group','note'].forEach(key => {
      if (!existing[key] && seed[key]) existing[key] = seed[key];
    });
  });
  tagCompany(CLIENTS);
}

function ensureCoreVendorRecords() {
  ['OT-010'].forEach(code => {
    const seed = INIT_VENDORS.find(v => v.code === code);
    if (!seed) return;
    const existing = VENDORS.find(v => v.code === code);
    if (!existing) VENDORS.push(JSON.parse(JSON.stringify(seed)));
    else ['name','trade','taxId','owner','accountName','payMethod','note','status'].forEach(key => {
      if (!existing[key] && seed[key]) existing[key] = seed[key];
    });
  });
  tagCompany(VENDORS);
}

function normalizeSpecialCaseClients() {
  ensureCoreClientRecords();
  ensureCoreVendorRecords();
  const yucheng = CASES.find(c => c.code === 'YT-FAM-2026-001');
  if (yucheng) {
    if (!yucheng.client || yucheng.client === 'FAM') yucheng.client = 'LMO';
    if (!yucheng.clientName || yucheng.clientName === '親友工程') yucheng.clientName = '李媽媽';
    if (!yucheng.caseType || yucheng.caseType === '不分潤／成本追蹤') yucheng.caseType = '親友工程／成本轉付';
    if (yucheng.profitSplit === '不分潤' || yucheng.excludeFromProfitReports === undefined) yucheng.excludeFromProfitReports = true;
  }
  const hulin = CASES.find(c => c.code === 'YT-FAM-2026-002');
  if (hulin) {
    if (!hulin.client || hulin.client === 'FAM') hulin.client = 'LCH';
    if (!hulin.clientName || hulin.clientName === '親友工程') hulin.clientName = '李啟弘';
    if (!hulin.caseType || hulin.caseType === '不分潤／成本追蹤') hulin.caseType = '親友工程／成本轉付';
    if (hulin.profitSplit === '不分潤' || hulin.excludeFromProfitReports === undefined) hulin.excludeFromProfitReports = true;
  }
  const loan = CASES.find(c => c.code === 'YT-LOAN-2026-001');
  if (loan) {
    if (!loan.client || loan.client === 'LOAN') loan.client = 'LMO';
    if (!loan.clientName || loan.clientName === '私人借支') loan.clientName = '李媽媽';
    if (!loan.name || loan.name === '私人借支') loan.name = '李媽媽私人借支';
    if (!loan.caseType || loan.caseType === '不分潤／成本追蹤') loan.caseType = '私人借支';
    loan.accountingTreatment = 'receivable_from_related_party';
    if (loan.profitSplit === '不分潤' || loan.excludeFromProfitReports === undefined) loan.excludeFromProfitReports = true;
  }
  RECEIVABLES.forEach(r => {
    if (r.case === 'YT-FAM-2026-001') {
      if (!r.client || r.client === 'FAM') r.client = 'LMO';
      if (!r.clientName || r.clientName === '親友工程') r.clientName = '李媽媽';
      if (r.buyer === '親友工程') r.buyer = '李媽媽';
    } else if (r.case === 'YT-FAM-2026-002') {
      if (!r.client || r.client === 'FAM') r.client = 'LCH';
      if (!r.clientName || r.clientName === '親友工程') r.clientName = '李啟弘';
      if (r.buyer === '親友工程') r.buyer = '李啟弘';
    } else if (r.case === 'YT-LOAN-2026-001') {
      if (!r.client || r.client === 'LOAN') r.client = 'LMO';
      if (!r.clientName || r.clientName === '私人借支') r.clientName = '李媽媽';
      if (r.caseName === '私人借支') r.caseName = '李媽媽私人借支';
    }
  });
  PAYABLES.forEach(p => {
    if (p.case !== 'YT-LOAN-2026-001') return;
    if (p.caseName === '私人借支') p.caseName = '李媽媽私人借支';
  });
}

// ══════════════════════════════════
// STATE
// ══════════════════════════════════
let currentUser = USERS[0];
let currentPage = 'dashboard';
const periodInitializedPages = new Set(); // 記錄本次瀏覽已套用過預設區間的頁面，避免切換模組時把使用者調整過的區間重置回當月
let dcSelCases = null; // null = 全部案件；空 Set = 零個案件
let dcClosedCollapsed = localStorage.getItem('yutesign-ops-dashboard-closed-collapsed') === '1';
let TEST_FEEDBACK = [];
let tfNextId = 1;
let tfScreenshotDraft = null;
let ATTENDANCE_RECORDS = [];
let ATTENDANCE_LEAVES = [];
let attNextId = 1;
let attLeaveNextId = 1;
let attEditRecordId = null;
let attLeaveEditId = null;
let payreqEditId = null;
let payreqSubmitting = false;
let AUDIT_LOGS = [];
let auditNextId = 1;
const OFFICE_LOCATION_DEFAULT = { lat: 25.046124, lng: 121.584709 };
const OFFICE_LOCATION_OLD_DEFAULT = { lat: 25.0503, lng: 121.5918 };
const ATTENDANCE_SETTINGS = {
  workdayMinutes: 540,
  paidWorkMinutes: 480,
  lunchMinutes: 60,
  earliestIn: '07:40',
  latestIn: '09:00',
  graceEarlyLeaveMinutes: 10,
  monthlyGraceMinutes: 30,
  fullAttendancePenalty: 1000,
  overtimeStart: 'dynamic',
  overtimeUnitMinutes: 30,
  hourlyBase: 'monthly30',
  officeLat: OFFICE_LOCATION_DEFAULT.lat,
  officeLng: OFFICE_LOCATION_DEFAULT.lng,
  defaultOfficeLat: OFFICE_LOCATION_DEFAULT.lat,
  defaultOfficeLng: OFFICE_LOCATION_DEFAULT.lng,
  officeRadiusMeters: 200
};
let attGpsWatchId = null;
let attGpsPosition = null;
let attGpsResult = { ok:false, reason:'尚未取得定位' };
let attGpsPunching = false;


// ══════════════════════════════════
// LOCAL STORAGE 自動存檔
// ══════════════════════════════════
const STORAGE_KEY = 'yutesign_ops_v2';
const LEGACY_STORAGE_KEYS = ['yutesign_ops_codex_v1', 'yutesign_ops_v1'];
const THEME_KEY = 'yutesign_ops_v2_theme';

const CODEX_SEED_CASES = [
  { code:'YT-UPY-2025-001', name:'上洋嘉義', client:'UPY', clientName:'上洋產業', status:'結案', amount:10364351, collected:9921486, person:'李鎮宇', pct:0, retentionAmt:450000, retentionDue:'2026-08-05', profitSplit:'自訂', splitRatio:{shower:0.55,peng:0.25,lien:0.20}, psSettled:true, closedDate:'2025-09-30', revenueOverride:9951486, vendorCostOverride:6135110, taxCostOverride:236942, grossOverride:3309011, fixedOverheadShare:587521, taxReserveOverride:410943, reconciliationNote:'依2025上洋成本控制表與2025-2026分潤表核對：總售價9,951,486／廠商成本6,135,110／當案費用270,423／稅務成本（營業稅×0.5）236,942／毛利3,309,011／公司開銷587,521／預留營業所得稅410,943／2025-09-30歷史結算／2025-10-15分潤付清' },
  { code:'YT-UPY-2025-002', name:'上洋鶯歌', client:'UPY', clientName:'上洋產業', status:'完工', amount:12961028, collected:12960913, person:'李鎮宇', pct:0, closedDate:'2026-05-19', retentionAmt:564000, retentionDue:'2027-02-05', profitSplit:'三人' },
  { code:'YT-SUZ-2025-001', name:'木柵 Suzuki', client:'SUZ', clientName:'凱騰鈴木', status:'完工', amount:4831500, collected:4831450, person:'李鎮宇', pct:0, closedDate:'2026-05-19', profitSplit:'三人' },
  { code:'YT-SUZ-2025-002', name:'民族 Suzuki 服務廠', client:'SUZ', clientName:'凱騰鈴木', status:'完工', amount:260000, collected:260000, person:'李鎮宇', pct:0, closedDate:'2026-05-19', profitSplit:'三人' },
  { code:'YT-KYG-2025-001', name:'凱揚濱江', client:'KYG', clientName:'凱揚汽車', status:'完工', amount:3077075, collected:3077075, person:'李鎮宇', pct:0, closedDate:'2026-05-19', profitSplit:'三人' },
  { code:'YT-WWF-2025-001', name:'文威豐', client:'WWF', clientName:'文威豐股份有限公司', status:'完工', amount:2913588, collected:2913588, person:'李鎮宇', pct:0, closedDate:'2026-05-19', profitSplit:'李連6040' },
  { code:'YT-ZHG-2025-001', name:'板橋張總15F', client:'ZHG', clientName:'張文海', status:'進行中', amount:1500000, collected:1500000, person:'李鎮宇', pct:0, profitSplit:'三人', taxCostOverride:35714, reconciliationNote:'工程已完工且款項已收齊，但先比照其他四案維持進行中，不進入分潤結算。等待2026-07-10前員工完成6月份費用申請，其中仍可能新增張總家費用，並同步確認是否還有廠商尚未請款；待費用與請款完整後再鎖定最終成本。依目前資料：銷售1,500,000／已知工程成本928,320／當案費用21,241／稅務成本35,714／暫估毛利514,725；保證金不列成本，預估油漆成本150,000已刪除。' },
  { code:'YT-LIN-2026-001', name:'板橋林協理10F', client:'LIN', clientName:'林麗茜', status:'進行中', amount:1200000, collected:1200000, person:'李鎮宇', pct:0, profitSplit:'三人', reconciliationNote:'進行中，尚未與業主確認最後追加減及最終應收金額，不可結算分潤。依2026應收、應付及成本控制表核對：目前已收1,200,000／35筆工程成本淨額1,230,235.5，原則上均已付款／原始費用表累計34,766；費用統計與成本控制表暫只計29,646，漏列2026-06李鎮宇丹麥杯盤組5,120。' },
  { code:'YT-ATG-2026-001', name:'板橋安庭E2-15F', client:'ATG', clientName:'安庭傢俱有限公司', status:'進行中', amount:636000, collected:636000, person:'李鎮宇', pct:0, profitSplit:'三人', taxCostOverride:15142.85714, reconciliationNote:'案件仍在進行中，目前損益僅供追蹤，不可結算分潤。依2026應收、應付、五份費用表及板橋安庭E2-15F連動成本控制表核對：銷售及已收636,000／17筆已付工程成本588,945／當案費用7,189／稅務成本15,142.86／目前暫估毛利24,723.14（3.89%）。2026-06滑軌、鉸鍊、把手5,429已歸屬本案，預計2026-06-20付款；付款後工程成本將為594,374，暫估毛利將為19,294.14。' },
  { code:'YT-UNI-2026-001', name:'UNI MUSIC 音樂教室', client:'YYS', clientName:'有意思藝文整合有限公司', status:'進行中', amount:753000, collected:753000, person:'李鎮宇', pct:0, profitSplit:'三人', taxCostOverride:17928.57143, reconciliationNote:'案件仍在進行中，目前損益僅供追蹤，不可結算分潤。依2026應收、應付、五份費用表及UNI MUSIC安和路音樂教室成本控制表核對：銷售及已收753,000／6筆工程成本214,971.5，均已付款／當案費用2,700／稅務成本17,928.57／目前暫估毛利517,399.93（68.71%）。舊分潤表顯示毛利520,060為舊數字。' },
  { code:'YT-UPY-2026-001', name:'上洋高雄', client:'UPY', clientName:'上洋產業股份有限公司', status:'進行中', amount:2954985, collected:2954985, person:'李鎮宇', pct:0, profitSplit:'三人', taxCostOverride:70356.78571, reconciliationNote:'依上洋高雄連動成本控制表、2026應收、應付及五份原始費用表核對：實際銷售及已收2,954,985（發票2,955,000）／工程成本2,470,740，包含2025年兩筆3D圖費用6,750及2026年33筆2,463,990／2025當案費用63,020／2026原始費用截至6月267,501／稅務成本70,356.79／最新毛利83,367.21（2.82%）。成本控制表目前只帶入2026年1至5月費用255,578，顯示毛利95,290；原始費用表另有6月11,907，且4月比統計表多16，後續需回寫成本表。6/20元翔高空10,500尚待付款。' },
  { code:'YT-FAM-2026-001', name:'玉成街親友工程', client:'LMO', clientName:'李媽媽', status:'進行中', amount:0, collected:0, person:'李鎮宇', pct:0, profitSplit:'不分潤', caseType:'親友協助／成本轉付', billingMode:'實際成本轉付', invoiceMode:'不開發票', excludeFromProfitReports:true, taxCostOverride:0, reconciliationNote:'親友工程比照一般個案入帳，只是不分潤。應付廠商成本 9 筆合計 158,129；應收／收款由使用者手動建立，成本控制表可看損益，分潤儀表排除，收款完成後可手動結案。' },
  { code:'YT-FAM-2026-002', name:'虎林街住家', client:'LCH', clientName:'李啟弘', status:'結案', amount:1450000, collected:1450000, person:'李鎮宇', pct:0, profitSplit:'不分潤', caseType:'親友協助／成本轉付', billingMode:'實際成本轉付', invoiceMode:'不開發票', excludeFromProfitReports:true, closedDate:'2026-05-03', taxCostOverride:0, reconciliationNote:'親友成本轉付案；2025 應付 13 筆合計 462,806，2026 應付 25 筆合計 951,949，工程成本以應付帳款 1,414,755 為準。應收／成本收回 1,450,000，2026-05-03 已結清。廠商明細只列成本，不逐筆轉應收。差異說明：哥哥直付鋁工藝 15,800 不進公司應付；洗衣機鐵架 2,100 由宇德善意負擔。' },
];
const CODEX_SEED_RECEIVABLES = [
  { id:2, case:'YT-UPY-2025-002', caseName:'上洋鶯歌', collectDate:'2026-02-05', buyer:'上洋產業股份有限公司', item:'裝修工程款', collectAmt:6767965, bank:'國泰', invoiceAmt:6768000, invoiceDate:'2026-01-23', invoiceNo:'XH38605852', contractAmt:12961028, progress:'完收', invoiceLink:'', status:'collected', note:'Codex匯入：上洋鶯歌成本控制表' },
  { id:3, case:'YT-UPY-2025-002', caseName:'上洋鶯歌', collectDate:'2026-03-05', buyer:'上洋產業股份有限公司', item:'拆除及裝修工程款', collectAmt:400000, bank:'國泰', invoiceAmt:400000, invoiceDate:'2026-02-09', invoiceNo:'XH38605859', contractAmt:12961028, progress:'完收', invoiceLink:'', status:'collected', note:'Codex匯入：上洋鶯歌成本控制表' },
  { id:4, case:'YT-UPY-2025-002', caseName:'上洋鶯歌', collectDate:'2026-03-05', buyer:'上洋產業股份有限公司', item:'拆除、外牆噴漆工程', collectAmt:109990, bank:'國泰', invoiceAmt:110000, invoiceDate:'2026-02-10', invoiceNo:'XH38605860', contractAmt:12961028, progress:'完收', invoiceLink:'', status:'collected', note:'Codex匯入：上洋鶯歌成本控制表' },
  { id:5, case:'YT-UPY-2025-002', caseName:'上洋鶯歌', collectDate:'2026-05-05', buyer:'東洋洗濯事業股份有限公司', item:'弱電配管工程', collectAmt:332523, bank:'國泰', invoiceAmt:332553, invoiceDate:'2026-04-01', invoiceNo:'ZK97113604', contractAmt:12961028, progress:'完收', invoiceLink:'', status:'collected', note:'Codex匯入：上洋鶯歌成本控制表' },
  { id:6, case:'YT-UPY-2025-002', caseName:'上洋鶯歌', collectDate:'2026-04-24', buyer:'上洋產業股份有限公司', item:'裝修工程', collectAmt:351218, bank:'國泰', invoiceAmt:351228, invoiceDate:'2026-04-01', invoiceNo:'ZK97113603', contractAmt:12961028, progress:'完收', invoiceLink:'', status:'collected', note:'Codex匯入：上洋鶯歌成本控制表' },
  { id:7, case:'YT-UPY-2025-002', caseName:'上洋鶯歌', collectDate:'2026-04-24', buyer:'上洋產業股份有限公司', item:'配管工程、弱電配管工程', collectAmt:1517447, bank:'國泰', invoiceAmt:1517447, invoiceDate:'2026-04-01', invoiceNo:'ZK97113605', contractAmt:12961028, progress:'完收', invoiceLink:'', status:'collected', note:'Codex匯入：上洋鶯歌成本控制表' },
  { id:8, case:'YT-UPY-2025-002', caseName:'上洋鶯歌', collectDate:'2025-11-25', buyer:'上洋產業股份有限公司', item:'epoxy修補工程', collectAmt:79990, bank:'國泰', invoiceAmt:80000, invoiceDate:'2025-11-03', invoiceNo:'VK09980300', contractAmt:12961028, progress:'完收', invoiceLink:'', status:'collected', note:'Codex匯入：上洋鶯歌成本控制表' },
  { id:9, case:'YT-UPY-2025-002', caseName:'上洋鶯歌', collectDate:'2025-11-25', buyer:'上洋產業股份有限公司', item:'水管修補工程', collectAmt:17790, bank:'國泰', invoiceAmt:17800, invoiceDate:'2025-11-03', invoiceNo:'VK09980301', contractAmt:12961028, progress:'完收', invoiceLink:'', status:'collected', note:'Codex匯入：上洋鶯歌成本控制表' },
  { id:10, case:'YT-UPY-2025-002', caseName:'上洋鶯歌', collectDate:'2025-11-28', buyer:'上洋產業股份有限公司', item:'裝潢工程訂金款', collectAmt:3383990, bank:'國泰', invoiceAmt:3384000, invoiceDate:'2025-11-25', invoiceNo:'VK09980313', contractAmt:12961028, progress:'完收', invoiceLink:'', status:'collected', note:'Codex匯入：上洋鶯歌成本控制表' },
  { id:11, case:'YT-UPY-2025-002', caseName:'上洋鶯歌', collectDate:'', buyer:'上洋產業股份有限公司', item:'主合約5%保固保留款', collectAmt:0, bank:'', invoiceAmt:564000, invoiceDate:'', invoiceNo:'', contractAmt:12961028, progress:'保固款一年後（預計2027-02-05）', invoiceLink:'', status:'pending', note:'主合約11,280,000之5%保固款；行事曆已設提醒；分潤暫不列入已收毛利' },
  { id:12, case:'YT-UPY-2025-001', caseName:'上洋嘉義', collectDate:'', buyer:'上洋產業股份有限公司', item:'保固保留款', collectAmt:0, bank:'', invoiceAmt:450000, invoiceDate:'', invoiceNo:'', contractAmt:10364351, progress:'保固款一年後（預計2026-08-05）', invoiceLink:'', status:'pending', note:'行事曆已設提醒；待到期開發票請款；分潤暫不列入已收毛利' },
  { id:13, case:'YT-SUZ-2025-001', caseName:'木柵 Suzuki', collectDate:'2025-11-10', buyer:'凱騰鈴木汽車股份有限公司', item:'裝潢工程訂金款', collectAmt:1157985, bank:'瑞興', invoiceAmt:1158000, invoiceDate:'2025-11-03', invoiceNo:'VK09980302', contractAmt:4831500, progress:'第一期', invoiceLink:'', status:'collected', note:'Codex匯入：應收帳款與木柵成本控制表' },
  { id:14, case:'YT-SUZ-2025-001', caseName:'木柵 Suzuki', collectDate:'2026-04-27', buyer:'凱騰鈴木汽車股份有限公司', item:'裝修工程', collectAmt:3673465, bank:'瑞興', invoiceAmt:3673500, invoiceDate:'2026-04-08', invoiceNo:'ZK97113609', contractAmt:4831500, progress:'完收', invoiceLink:'', status:'collected', note:'Codex匯入：應收帳款與木柵成本控制表' },
  { id:15, case:'YT-SUZ-2025-002', caseName:'民族 Suzuki 服務廠', collectDate:'2026-04-27', buyer:'凱騰鈴木汽車股份有限公司', item:'裝修工程款', collectAmt:260000, bank:'瑞興', invoiceAmt:260000, invoiceDate:'2026-04-01', invoiceNo:'ZK97113606', contractAmt:260000, progress:'完收', invoiceLink:'', status:'collected', note:'Codex匯入：民族Suzuki服務廠連動0326ok' },
  { id:16, case:'YT-KYG-2025-001', caseName:'凱揚濱江', collectDate:'2026-03-25', buyer:'凱揚汽車股份有限公司濱江分公司', item:'濱江裝修工程款', collectAmt:2960000, bank:'瑞興', invoiceAmt:2960000, invoiceDate:'2026-03-16', invoiceNo:'ZK97113601', contractAmt:3077075, progress:'完收', invoiceLink:'', status:'collected', note:'Codex匯入：凱揚濱江連動0326ok' },
  { id:17, case:'YT-KYG-2025-001', caseName:'凱揚濱江', collectDate:'2026-01-12', buyer:'凱揚汽車股份有限公司', item:'北投廠招牌、濱江廠招牌', collectAmt:117075, bank:'瑞興', invoiceAmt:117075, invoiceDate:'2025-11-03', invoiceNo:'VK09980304', contractAmt:3077075, progress:'完收', invoiceLink:'', status:'collected', note:'Codex匯入：凱揚濱江連動0326ok' },
  { id:18, case:'YT-WWF-2025-001', caseName:'文威豐', collectDate:'2025-10-22', buyer:'文威豐股份有限公司', item:'裝潢工程訂金款', collectAmt:656800, bank:'瑞興', invoiceAmt:656800, invoiceDate:'2025-10-15', invoiceNo:'TK21949769', contractAmt:2913588, progress:'第一期', invoiceLink:'', status:'collected', note:'Codex匯入：文威豐連動0326ok' },
  { id:19, case:'YT-WWF-2025-001', caseName:'文威豐', collectDate:'2025-11-19', buyer:'文威豐股份有限公司', item:'裝潢工程', collectAmt:656800, bank:'瑞興', invoiceAmt:656800, invoiceDate:'2025-11-10', invoiceNo:'VK09980306', contractAmt:2913588, progress:'第二期', invoiceLink:'', status:'collected', note:'Codex匯入：文威豐連動0326ok' },
  { id:20, case:'YT-WWF-2025-001', caseName:'文威豐', collectDate:'2025-12-03', buyer:'文威豐股份有限公司', item:'裝潢工程', collectAmt:656800, bank:'瑞興', invoiceAmt:656800, invoiceDate:'2025-11-26', invoiceNo:'VK09980315', contractAmt:2913588, progress:'第三期', invoiceLink:'', status:'collected', note:'Codex匯入：文威豐連動0326ok' },
  { id:21, case:'YT-WWF-2025-001', caseName:'文威豐', collectDate:'2026-01-05', buyer:'文威豐股份有限公司', item:'裝潢工程完工款', collectAmt:219188, bank:'瑞興', invoiceAmt:219188, invoiceDate:'2025-12-23', invoiceNo:'VK09980317', contractAmt:2913588, progress:'完工款', invoiceLink:'', status:'collected', note:'Codex匯入：文威豐連動0326ok' },
  { id:22, case:'YT-WWF-2025-001', caseName:'文威豐', collectDate:'2026-01-05', buyer:'文威豐股份有限公司', item:'裝潢工程追加工程款', collectAmt:724000, bank:'瑞興', invoiceAmt:724000, invoiceDate:'2025-12-23', invoiceNo:'VK09980318', contractAmt:2913588, progress:'追加工程款', invoiceLink:'', status:'collected', note:'Codex匯入：文威豐連動0326ok' },
  { id:2301, case:'YT-ZHG-2025-001', caseName:'板橋張總15F', collectDate:'2026-01-14', buyer:'張文海', item:'木作工程', collectAmt:420000, bank:'瑞興', invoiceAmt:420000, invoiceDate:'2026-01-15', invoiceNo:'XH38605850', contractAmt:1500000, progress:'', invoiceLink:'', status:'collected', note:'Codex匯入：2026應收帳款與張總成本控制表' },
  { id:2302, case:'YT-ZHG-2025-001', caseName:'板橋張總15F', collectDate:'2026-03-04', buyer:'張文海', item:'木作工程', collectAmt:420000, bank:'瑞興', invoiceAmt:0, invoiceDate:'', invoiceNo:'', contractAmt:1500000, progress:'', invoiceLink:'', status:'collected', note:'Codex匯入：2026應收帳款與張總成本控制表' },
  { id:2303, case:'YT-ZHG-2025-001', caseName:'板橋張總15F', collectDate:'2026-04-01', buyer:'張文海', item:'木作工程', collectAmt:420000, bank:'瑞興', invoiceAmt:0, invoiceDate:'', invoiceNo:'', contractAmt:1500000, progress:'', invoiceLink:'', status:'collected', note:'Codex匯入：2026應收帳款與張總成本控制表' },
  { id:2304, case:'YT-ZHG-2025-001', caseName:'板橋張總15F', collectDate:'2026-06-01', buyer:'張文海', item:'水電、木作、油漆工程', collectAmt:240000, bank:'瑞興', invoiceAmt:1080000, invoiceDate:'2026-06-02', invoiceNo:'BP08421852', contractAmt:1500000, progress:'', invoiceLink:'', status:'collected', note:'Codex匯入：2026應收帳款與張總成本控制表' },
  { id:2401, case:'YT-LIN-2026-001', caseName:'板橋林協理10F', collectDate:'2026-03-11', buyer:'林麗茜', item:'木作工程', collectAmt:350000, bank:'國泰', invoiceAmt:0, invoiceDate:'', invoiceNo:'', contractAmt:1200000, progress:'', invoiceLink:'', status:'collected', note:'Codex匯入：2026應收帳款與林協理成本控制表' },
  { id:2402, case:'YT-LIN-2026-001', caseName:'板橋林協理10F', collectDate:'2026-03-11', buyer:'林麗茜', item:'木作工程', collectAmt:10000, bank:'現金', invoiceAmt:0, invoiceDate:'', invoiceNo:'', contractAmt:1200000, progress:'', invoiceLink:'', status:'collected', note:'連星羽與業主開會收取現金；Codex匯入' },
  { id:2403, case:'YT-LIN-2026-001', caseName:'板橋林協理10F', collectDate:'2026-04-30', buyer:'林麗茜', item:'木作工程', collectAmt:360000, bank:'國泰', invoiceAmt:0, invoiceDate:'', invoiceNo:'', contractAmt:1200000, progress:'', invoiceLink:'', status:'collected', note:'Codex匯入：2026應收帳款與林協理成本控制表' },
  { id:2404, case:'YT-LIN-2026-001', caseName:'板橋林協理10F', collectDate:'2026-06-01', buyer:'林麗茜', item:'第三期木作', collectAmt:480000, bank:'國泰', invoiceAmt:0, invoiceDate:'', invoiceNo:'', contractAmt:1200000, progress:'', invoiceLink:'', status:'collected', note:'Codex匯入：2026應收帳款與林協理成本控制表；尾款與追加減待確認' },
  { id:2501, case:'YT-ATG-2026-001', caseName:'板橋安庭E2-15F', collectDate:'2026-04-01', buyer:'安庭傢俱有限公司', item:'裝修工程訂金款', collectAmt:318000, bank:'國泰', invoiceAmt:318000, invoiceDate:'2026-04-01', invoiceNo:'ZK97113608', contractAmt:636000, progress:'第一期', invoiceLink:'', status:'collected', note:'Codex匯入：2026應收帳款與安庭成本控制表' },
  { id:2502, case:'YT-ATG-2026-001', caseName:'板橋安庭E2-15F', collectDate:'2026-05-04', buyer:'安庭傢俱有限公司', item:'木作工程', collectAmt:318000, bank:'國泰', invoiceAmt:318000, invoiceDate:'2026-04-29', invoiceNo:'ZK97113612', contractAmt:636000, progress:'完收', invoiceLink:'', status:'collected', note:'Codex匯入：2026應收帳款與安庭成本控制表' },
  { id:2601, case:'YT-UNI-2026-001', caseName:'UNI MUSIC 音樂教室', collectDate:'2026-04-22', buyer:'有意思藝文整合有限公司', item:'裝修工程', collectAmt:753000, bank:'國泰', invoiceAmt:753000, invoiceDate:'2026-04-23', invoiceNo:'ZK97113611', contractAmt:753000, progress:'完收', invoiceLink:'', status:'collected', note:'Codex匯入：2026應收帳款與UNI MUSIC成本控制表' },
  { id:2701, case:'YT-UPY-2026-001', caseName:'上洋高雄', collectDate:'2026-02-13', buyer:'上洋產業股份有限公司', item:'裝修工程訂金款', collectAmt:2954985, bank:'國泰', invoiceAmt:2955000, invoiceDate:'2026-02-02', invoiceNo:'XH38605855', contractAmt:2955000, progress:'完收', invoiceLink:'', status:'collected', note:'Codex匯入：2026應收帳款與上洋高雄連動成本控制表' },
];
const CODEX_SEED_PAYABLES = [
  [18,'衡岳（阿瑞）','嘉義最後點工清潔',2700,'2025-11-20'], [19,'東沐工程行','地坪修補',51975,'2025-10-20'],
  [20,'新財圓','垃圾車',84630,'2025-12-30'], [21,'新財圓','垃圾車及水泥',50400,'2026-12-10'],
  [22,'金能','塑膠地磚材料',163485,'2025-12-27'], [23,'南山產物','工地保險（營造綜合險）',10000,'2025-12-20'],
  [24,'南山產物','工地保險（雇主責任險）',3600,'2025-12-20'], [25,'李嘉航','棋德3D代付款',4000,'2025-09-03'],
  [26,'廣源','水電工程',10500,'2025-11-10'], [27,'華彩','燈具',25242,''],
  [28,'華彩','燈具',36913,'2025-12-30'], [29,'牧門工程行','輕鋼架工程第一期款',500000,'2026-12-30'],
  [30,'盛揚','高空作業工程',37800,'2026-12-10'], [31,'衡岳（阿瑞）','點工拆除',108424,'2026-12-30'],
  [32,'簡秋隆','工資、便當、五金',178700,'2026-01-10'], [33,'富懋','美耐板',9902,'2026-01-30'],
  [34,'富卯','創意玩家石晶薄板、收邊條、膠',60333,'2026-01-30'], [35,'鴻泩','鋁窗',35385,'2026-01-10'],
  [36,'盛揚','高空作業工程',13860,'2026-01-10'], [37,'新財圓','垃圾車',14700,'2026-01-10'],
  [38,'發強五金','水平鎖、合頁、矽利康、門弓器、把手',18664,'2026-01-10'], [39,'金能','塑膠地磚膠',15960,'2026-01-07'],
  [40,'廣源','冷氣',280518,'2026-01-30'], [41,'碇國','人造石',18748,'2026-01-30'],
  [42,'陳柏任','泥作',138500,'2026-01-30'], [43,'廣源','空調大電',337717,'2026-01-30'],
  [44,'東榮（幸全）','木作材料',157190,'2026-01-30'], [45,'東榮（幸全）','稅金10,087-折扣214,464*0.03=6,434',3653,'2026-01-30'],
  [46,'戚美英','1/15-1/22 6日共23工 加清潔劑',62454,'2026-01-30'], [47,'連文彬','更衣室拉簾',38640,'2026-01-30'],
  [48,'富懋','木作材料（美耐板）',9623,'2026-02-10'], [49,'新財圓','垃圾車',10500,'2026-02-10'],
  [50,'陳巧君','金屬工程改鐵門、修補、補鐵板',36225,'2026-02-10'], [51,'奇碁（碇國）','人造石水槽龍頭',63409.5,'2026-02-10'],
  [52,'游志松（貫威）','踢腳板',22512,'2026-02-10'], [53,'簡秋隆','木工',127000,'2026-02-10'],
  [54,'凱軒','貼膜',32200,'2026-02-10'], [55,'弘威','自動門 雙開＊1單開＊2、紅外線感應＊2',134925,'2026-02-10'],
  [56,'盛揚','本工程自走車',34020,'2026-02-10'], [57,'牧門','總額126-預付50輕隔間、輕鋼架',760000,'2026-02-10'],
  [58,'宏冠玻璃','玻璃隔間玻璃門',301413,'2026-02-10'], [59,'九億','油漆工程',916020,'2026-02-10'],
  [60,'簡黃傳','塑膠地磚',138950,'2026-02-10'], [61,'東榮（幸全）','木作材料',22665,'2026-02-10'],
  [62,'東榮（幸全）','稅金3,622-折扣(74,578*0.03=2,237)=1,382',1382,'2026-02-10'],
  [63,'廣源','水電工程鶯歌全區ap監控佈管工程',821100,'2026-02-10'], [64,'廣源','水電工程 辦公室及大廳',226506,'2026-02-10'],
  [65,'戚美英','鶯歌區2/8—1工+200+50（去滯油）',2750,'2026-02-14'], [66,'王子建材','衛浴設備',22529,'2026-03-10'],
  [67,'北富耀','燈具',4257.75,'2026-03-10'], [68,'永藏系統櫃','系統櫃',106867,'2026-03-10'],
  [69,'衡岳（阿瑞）','拆除、點工',33810,'2026-03-20'], [70,'北富耀','燈具',-3024,'2026-04-20'],
  [71,'廣源','跳電查修',9377,'2026-04-30'],
].map(([id, vendor, summary, amount, date]) => ({
  id, case:'YT-UPY-2025-002', caseName:'上洋鶯歌', vendor, summary, amount,
  wantDate:date, transferDate:'', doneDate:date, ticket:'', bank:'', invoice:'', receipt:'',
  person:'李鎮宇', status:'paid', note:'Codex匯入：上洋鶯歌成本控制表'
}));
const CODEX_SEED_ZHANG_PAYABLES = [
  [2305,'簡秋隆','木工',37330,'2026-02-10','2026-02-06','','2026-02-10','國泰','無','有','連星羽'],
  [2306,'發強','木作五金',21064,'2026-02-10','2026-02-06','','2026-02-10','國泰','有','有','連星羽'],
  [2307,'華彩','燈具',26636,'2026-02-10','2026-02-06','','2026-02-10','國泰','有','有','連星羽'],
  [2308,'東榮（幸全）','木作材料',42064,'2026-02-10','2026-02-09','2026-02-10','2026-02-10','瑞興票','有','有','李鎮宇'],
  [2309,'建成、阿土','新美齊張總 板橋木工（李媽媽代付）3/20還款李鎮宇',63500,'2026-02-12','','','2026-02-12','國泰','','有',''],
  [2310,'南山產物','工地保險（營造綜合險）',1626,'2026-03-20','2026-03-19','','2026-03-20','國泰','','有',''],
  [2311,'南山產物','工地保險（雇主責任險）',1574,'2026-03-20','2026-03-19','','2026-03-20','國泰','','有',''],
  [2312,'發強','五金',15385,'2026-03-10','2026-03-09','','2026-03-10','國泰','有','有','連星羽'],
  [2313,'鴻晟','鋁拉門',15645,'2026-03-06','','','2026-03-06','國泰','有','有','連星羽'],
  [2314,'東榮（幸全）','木作材料-折扣1971＋稅3227',64186,'2026-03-20','2026-03-24','','2026-03-24','瑞興票','有','有','李鎮宇'],
  [2315,'林建成','木工工資',73710,'2026-03-16','2026-03-13','','2026-03-16','國泰','無','無','連星羽'],
  [2316,'衡岳（阿瑞）','拆除、點工',6510,'2026-03-20','2026-03-19','','2026-03-20','國泰','有','','李鎮宇'],
  [2317,'簡秋隆','木工工資22工、便當4110、五金1175',91085,'2026-03-25','2026-03-19','','2026-03-25','國泰','有','','連星羽'],
  [2318,'華彩','燈具',17139,'2026-04-02','2026-04-02','','2026-04-02','國泰','有','有','連星羽'],
  [2319,'華彩','燈具開關',908,'2026-04-10','2026-04-09','','2026-04-10','國泰','有','有','連星羽'],
  [2320,'新財圓','垃圾車',15000,'2026-04-10','2026-04-09','','2026-04-10','國泰','有','有','連星羽'],
  [2321,'林建成','木工工資7工',24500,'2026-04-10','2026-04-09','','2026-04-10','國泰','無','有','李鎮宇'],
  [2322,'簡秋隆','木工工資5工',20000,'2026-04-10','2026-04-09','','2026-04-10','國泰','無','有','連星羽'],
  [2323,'戚美英','清潔',17500,'2026-04-10','2026-04-09','','2026-04-10','國泰','無','有','連星羽'],
  [2324,'發強','木作五金退貨',-2520,'2026-04-20','2026-04-16','','2026-04-20','國泰','有','有','李鎮宇'],
  [2325,'北富耀','燈具',8579,'2026-04-20','2026-04-16','','2026-04-20','國泰','有','有','李鎮宇'],
  [2326,'華彩','燈具',3665,'2026-04-20','2026-04-20','','2026-04-20','國泰','有','有','連星羽'],
  [2327,'安庭家具','皮革、木皮、門片、鍍鈦',102900,'2026-04-20','2026-04-20','','2026-04-20','國泰','有','有','李鎮宇'],
  [2328,'廣源','板橋水電統籌工程',169250,'2026-04-30','2026-04-29','','2026-04-30','國泰','有','有','連星羽'],
  [2329,'林建成','板橋木工工資',11030,'2026-04-30','2026-04-29','','2026-04-30','國泰','無','有','李鎮宇'],
  [2330,'陳順發','鐵件',73500,'2026-05-20','2026-05-19','','2026-05-20','國泰','有','有','連星羽'],
  [2331,'東榮（幸全）','木作材料板橋220＋汐止5200',5420,'2026-05-30','2026-05-29','2026-05-30','2026-05-30','瑞興票','有','有','李鎮宇'],
  [2332,'發強五金','木作五金',1134,'2026-05-21','2026-05-20','','2026-05-21','國泰','有','有','連星羽'],
].map(([id,vendor,summary,amount,wantDate,transferDate,ticket,doneDate,bank,invoice,receipt,person]) => ({
  id, sourceKey:`zhang-ap-${id}`, case:'YT-ZHG-2025-001', caseName:'板橋張總15F', vendor, summary, amount,
  wantDate, transferDate, ticket, doneDate, bank, invoice, receipt, person, status:'paid',
  note:'Codex匯入：2026年宇德廠商請款記錄表；已與張總成本控制表核對'
}));
const CODEX_SEED_LIN_PAYABLES = [
  [2401,'華彩','燈具',6077,'2026-03-25','2026-03-24','','2026-03-25','國泰','有','','連星羽'],
  [2402,'南山產物','工地保險（營造綜合險）',1507,'2026-04-20','2026-04-16','','2026-04-20','國泰','','有',''],
  [2403,'南山產物','工地保險（雇主責任險）',1493,'2026-04-20','2026-04-16','','2026-04-20','國泰','','有',''],
  [2404,'林建成','木工工資10工',35000,'2026-04-10','2026-04-09','','2026-04-10','國泰','無','有','李鎮宇'],
  [2405,'簡秋隆','木工工資',82270,'2026-04-10','2026-04-09','','2026-04-10','國泰','無','有','連星羽'],
  [2406,'鴻晟','鋁拉門',54336,'2026-04-13','2026-04-10','','2026-04-13','國泰','有','有','連星羽'],
  [2407,'林建成','木工工資4/7-4/10建成阿土7工（1工3500）',24500,'2026-04-10','2026-04-10','','2026-04-10','國泰','無','有','李鎮宇'],
  [2408,'發強','木作五金',49371,'2026-04-20','2026-04-16','','2026-04-20','國泰','有','有','李鎮宇'],
  [2409,'北富耀','燈具',9586.5,'2026-04-20','2026-04-16','','2026-04-20','國泰','有','有','李鎮宇'],
  [2410,'東榮（幸全）','木作材料-折扣＋稅金',121033,'2026-04-21','2026-04-22','2026-04-20','2026-04-23','瑞興票','有','有','李鎮宇'],
  [2411,'鴻晟','鋁框拉門',1575,'2026-04-20','2026-04-20','','2026-04-20','國泰','有','有','連星羽'],
  [2412,'華彩','燈具',29000,'2026-04-20','2026-04-20','','2026-04-20','國泰','有','有','連星羽'],
  [2413,'伊諾華','木工造型板材',3990,'2026-04-30','2026-04-29','','2026-04-30','國泰','有','有','連星羽'],
  [2414,'廣源','板橋水電統籌工程',132601,'2026-04-30','2026-04-29','','2026-04-30','國泰','有','有','連星羽'],
  [2415,'網建行','不鏽鋼飾條、洞洞板配件',16706,'2026-04-24','2026-04-24','','2026-04-24','國泰','有','有','連星羽'],
  [2416,'林建成','板橋木工工資',57200,'2026-04-30','2026-04-29','','2026-04-30','國泰','無','有','李鎮宇'],
  [2417,'小連（蝦皮）','水電五金-馬桶噴槍',3241,'2026-05-08','2026-05-08','','2026-05-08','國泰','','','連星羽'],
  [2418,'小連（蝦皮）','燈具',4481,'2026-05-08','2026-05-08','','2026-05-08','國泰','','','連星羽'],
  [2419,'陳玄宗（杰騰）','板橋木工工資',88000,'2026-05-10','2026-05-07','','2026-05-08','國泰','無','有','連星羽'],
  [2420,'伊諾華','造型石牆',4148,'2026-05-10','2026-05-07','','2026-05-08','國泰','有','有','連星羽'],
  [2421,'簡秋隆','木工工資',92280,'2026-05-10','2026-05-07','','2026-05-08','國泰','無','有','連星羽'],
  [2422,'華彩','林協理家退款',-12941,'2026-05-06','','','2026-05-06','國泰','無','有','連星羽'],
  [2423,'東榮（幸全）','木作材料',135254,'2026-05-30','2026-05-29','2026-05-30','2026-05-30','瑞興票','有','有','李鎮宇'],
  [2424,'北富耀','燈具',4536,'2026-05-21','2026-05-20','','2026-05-21','國泰','有','有','彭俞豪'],
  [2425,'發強五金','木作五金',62066,'2026-05-21','2026-05-20','','2026-05-21','國泰','有','有','連星羽'],
  [2426,'新財圓','垃圾車',14700,'2026-05-19','2026-05-19','','2026-05-20','國泰','有','有','連星羽'],
  [2427,'林建成','木工工資',38500,'2026-05-20','2026-05-19','','2026-05-20','國泰','無','有','李鎮宇'],
  [2428,'衡岳（阿瑞）','拆除、點工',5040,'2026-05-30','2026-05-29','','2026-05-30','國泰','有','有','連星羽'],
  [2429,'華彩','LED燈具',10188,'2026-05-30','2026-05-29','','2026-05-30','國泰','有','有','連星羽'],
  [2430,'簡秋隆','木工工資',96395,'2026-06-10','2026-06-08','','2026-06-10','國泰','無','有','連星羽'],
  [2431,'連星羽','各式五金',10202,'2026-06-02','2026-06-02','','2026-06-02','國泰','無','有','連星羽'],
  [2432,'凱軒','玻璃膜',1900,'2026-06-10','2026-06-08','','2026-06-10','國泰','有','有','連星羽'],
  [2433,'戚美英','清潔',20000,'2026-06-10','2026-06-08','','2026-06-10','國泰','無','有',''],
  [2434,'宏冠','玻璃',11300,'2026-06-20','','','','國泰','有','有',''],
  [2435,'新財圓','廢棄物清運',14700,'2026-06-20','','','','國泰','有','有',''],
].map(([id,vendor,summary,amount,wantDate,transferDate,ticket,doneDate,bank,invoice,receipt,person]) => ({
  id, sourceKey:`lin-ap-${id}`, case:'YT-LIN-2026-001', caseName:'板橋林協理10F', vendor, summary, amount,
  wantDate, transferDate, ticket, doneDate, bank, invoice, receipt, person,
  status:'paid', note:'Codex匯入：2026年宇德廠商請款記錄表；已與林協理成本控制表核對；依李鎮宇確認此案成本付款原則上均已完成'
}));
const CODEX_SEED_ANTING_PAYABLES = [
  [2501,'發強','木作五金',15309,'2026-04-20','2026-04-16','','2026-04-20','國泰','有','有','李鎮宇'],
  [2502,'東榮（幸全）','木作材料',41930,'2026-04-20','2026-04-22','2026-04-20','2026-04-23','瑞興票','有','有','李鎮宇'],
  [2503,'杰騰','木工工資',122000,'2026-04-15','2026-04-14','','2026-04-15','國泰','無','有','連星羽'],
  [2504,'林信富','水電',50346,'2026-04-14','2026-04-14','','2026-04-14','國泰','無','有','連星羽'],
  [2505,'小連（蝦皮）','燈具',2120,'2026-05-08','2026-05-08','','2026-05-08','國泰','','','連星羽'],
  [2506,'小連（昇耀）','五金',3812,'2026-05-08','2026-05-08','','2026-05-08','國泰','','','連星羽'],
  [2507,'林信富','水電工資',20038,'2026-05-10','2026-05-07','','2026-05-08','國泰','有','有','連星羽'],
  [2508,'陳玄宗（杰騰）','板橋木工工資',12000,'2026-05-10','2026-05-07','','2026-05-08','國泰','無','有','連星羽'],
  [2509,'奇碁科創','人造石',41580,'2026-05-10','2026-05-07','','2026-05-08','國泰','有','有','連星羽'],
  [2510,'伊諾華','造型石牆',13650,'2026-05-10','2026-05-07','','2026-05-08','國泰','有','有','連星羽'],
  [2511,'東榮（幸全）','木作材料-折扣＋稅金',95051,'2026-05-30','2026-05-29','2026-05-30','2026-05-30','瑞興票','有','有','李鎮宇'],
  [2512,'發強五金','木作五金',7476,'2026-05-21','2026-05-20','','2026-05-21','國泰','有','有','連星羽'],
  [2513,'南山產物','工地保險（營造綜合險）',1377,'2026-05-20','2026-05-19','','2026-05-20','國泰','無','有',''],
  [2514,'南山產物','工地保險（雇主責任險）',1423,'2026-05-20','2026-05-19','','2026-05-20','國泰','無','有',''],
  [2515,'陳玄宗（杰騰）','木工工資',128000,'2026-05-30','2026-05-29','','2026-05-30','國泰','無','有','連星羽'],
  [2516,'連星羽','燈具',2120,'2026-06-02','2026-06-02','','2026-06-02','國泰','無','有','連星羽'],
  [2517,'華彩','燈具',30713,'2026-06-10','2026-06-09','','2026-06-10','國泰','有','有',''],
  [2518,'廠商待補','滑軌、鉸鍊、把手',5429,'2026-06-20','','','','','','','','pending'],
].map(([id,vendor,summary,amount,wantDate,transferDate,ticket,doneDate,bank,invoice,receipt,person,status='paid']) => ({
  id, sourceKey:`anting-ap-${id}`, case:'YT-ATG-2026-001', caseName:'板橋安庭E2-15F', vendor, summary, amount,
  wantDate, transferDate, ticket, doneDate, bank, invoice, receipt, person, status,
  note:id === 2518 ? '案場已確認歸屬板橋安庭E2-15F；預計2026-06-20付款，廠商、銀行及單據資訊待補' : 'Codex匯入：2026年宇德廠商請款記錄表；已與板橋安庭成本控制表核對'
}));
const CODEX_SEED_UNI_PAYABLES = [
  [2601,'南山產物','工地保險（營造綜合險）',2322,'2026-05-20','2026-05-19','','2026-05-20','國泰','無','有',''],
  [2602,'南山產物','工地保險（雇主責任險）',2278,'2026-05-20','2026-05-19','','2026-05-20','國泰','無','有',''],
  [2603,'紘吉','安和路垃圾車',78750,'2026-05-30','2026-05-29','','2026-05-30','國泰','有','有','連星羽'],
  [2604,'衡岳（阿瑞）','拆除、點工',79369.5,'2026-05-30','2026-05-29','','2026-05-30','國泰','有','有','連星羽'],
  [2605,'陳柏任','泥作工程',50000,'2026-05-30','2026-05-29','','2026-05-30','國泰','無','有','連星羽'],
  [2606,'華彩','燈具',2252,'2026-06-10','2026-06-09','','2026-06-10','國泰','有','有',''],
].map(([id,vendor,summary,amount,wantDate,transferDate,ticket,doneDate,bank,invoice,receipt,person]) => ({
  id, sourceKey:`uni-ap-${id}`, case:'YT-UNI-2026-001', caseName:'UNI MUSIC 音樂教室', vendor, summary, amount,
  wantDate, transferDate, ticket, doneDate, bank, invoice, receipt, person, status:'paid',
  note:'Codex匯入：2026年宇德廠商請款記錄表；已與UNI MUSIC安和路音樂教室成本控制表核對'
}));
const CODEX_SEED_UPY_KAOHSIUNG_PAYABLES = [
  [2701,'李嘉航','3D示意圖訂金（嘉航代付）',3375,'2025-02-28','','','','','','李鎮宇','paid'],
  [2702,'李嘉航','3D示意圖尾款（嘉航代付）',3375,'2025-03-05','','','','','','李鎮宇','paid'],
  [2703,'陳柏霖','高雄房租',68000,'2026-01-04','2026-01-04','','玉山','','','彭俞豪','paid'],
  [2704,'南山產物','工地保險（雇主責任險）',3631,'2026-01-30','2026-01-29','2026-01-30','國泰','無','無','','paid'],
  [2705,'南山產物','工地保險（營造綜合險）',9869,'2026-01-30','2026-01-29','2026-01-30','國泰','無','無','','paid'],
  [2706,'森沅','木作工程一樓',210000,'2026-02-10','2026-02-06','2026-02-10','瑞興票','有','','彭俞豪','paid'],
  [2707,'堉騰工程行','泥作貼磚暫請款',105000,'2026-02-10','2026-02-05','2026-02-10','瑞興票','有','無','彭俞豪','paid'],
  [2708,'信威金屬工業有限公司','訂製造型燈具訂金',15750,'2026-02-10','2026-02-06','2026-02-10','國泰','有','有','連星羽','paid'],
  [2709,'陳柏霖','2月房租',26000,'2026-02-10','2026-02-10','2026-02-10','國泰','','','彭俞豪','paid'],
  [2710,'元翔','高空作業車',10500,'2026-02-10','2026-02-09','2026-02-10','國泰','有','有','彭俞豪','paid'],
  [2711,'永登環保','垃圾子母車',3360,'2026-03-10','2026-02-26','2026-03-10','國泰','有','有','彭俞豪','paid'],
  [2712,'堉騰工程行','地磚工程',101987,'2026-03-10','2026-03-09','2026-03-10','國泰票','有','有','彭俞豪','paid'],
  [2713,'陳柏霖','3.4.5月房租',78000,'2026-03-12','2026-03-12','2026-03-12','國泰','','','','paid'],
  [2714,'永登環保','垃圾子母車',3360,'2026-03-31','2026-03-30','2026-03-31','國泰','有','有','彭俞豪','paid'],
  [2715,'信威金屬','吊燈燈具',36750,'2026-04-10','2026-04-09','2026-04-10','國泰','有','有','彭俞豪','paid'],
  [2716,'華彩','燈具',69067,'2026-04-20','2026-04-20','2026-04-20','國泰','有','有','連星羽','paid'],
  [2717,'圓融','系統櫃',121728,'2026-04-30','2026-04-28','2026-04-30','國泰','有','有','彭俞豪','paid'],
  [2718,'永登','垃圾子母車',3360,'2026-04-30','2026-04-29','2026-04-30','國泰','有','有','彭俞豪','paid'],
  [2719,'彭俞豪（東亨）','廢棄物清運',21000,'2026-04-30','2026-04-28','2026-04-30','國泰','有','無','彭俞豪','paid'],
  [2720,'彭俞豪（昱名）','ab 膠',2352,'2026-04-30','2026-04-28','2026-04-30','國泰','有','無','彭俞豪','paid'],
  [2721,'元翔','高空車',10500,'2026-04-30','2026-04-28','2026-04-30','國泰','有','有','彭俞豪','paid'],
  [2722,'森沅','木作工程',387870,'2026-05-10','2026-05-07','2026-05-08','國泰','有','有','彭俞豪','paid'],
  [2723,'彭俞豪（帝宏）','扶手材料',19304,'2026-05-10','2026-05-07','2026-05-08','國泰','有','有','彭俞豪','paid'],
  [2724,'彭俞豪（冠驊）','3/25、4/7、4/16、4/22粗工4工',7200,'2026-05-10','2026-05-07','2026-05-08','國泰','無','有','彭俞豪','paid'],
  [2725,'堉騰工程行','電梯地磚工資',8610,'2026-05-10','2026-05-07','2026-05-08','國泰','有','有','彭俞豪','paid'],
  [2726,'北富耀','燈具',24570,'2026-05-21','2026-05-20','2026-05-21','國泰','有','有','彭俞豪','paid'],
  [2727,'鴻正興工程行','大廳藝術漆費用',89250,'2026-05-20','2026-05-20','2026-05-20','國泰','有','','彭俞豪','paid'],
  [2728,'利保金屬','鐵件欄桿及電梯封板',104580,'2026-05-20','2026-05-29','2026-05-30','國泰票','有','有','彭俞豪','paid'],
  [2729,'顏志洋','宇德公司遠端開鐵捲門',17500,'2026-05-20','2026-05-19','2026-05-20','國泰','無','有','李鎮宇','paid'],
  [2730,'勵欣機電','水電預付款',210000,'2026-05-30','2026-06-01','2026-06-02','國泰','有','有','彭俞豪','paid'],
  [2731,'竹庭工程行','輕隔間工程',652218,'2026-06-10','2026-06-09','2026-06-10','國泰票','有','有','彭俞豪','paid'],
  [2732,'陳柏霖','6月房租',26000,'2026-06-02','2026-06-02','2026-06-02','玉山','無','無','彭俞豪','paid'],
  [2733,'華彩','鋁殼燈',2814,'2026-06-02','2026-06-02','2026-06-02','國泰','有','有','彭俞豪','paid'],
  [2734,'永登環保','廢棄物清運',3360,'2026-06-10','2026-06-09','2026-06-10','國泰','有','有','彭俞豪','paid'],
  [2735,'元翔高空','起重工程',10500,'2026-06-20','','','','有','有','彭俞豪','pending'],
].map(([id,vendor,summary,amount,wantDate,transferDate,doneDate,bank,invoice,receipt,person,status]) => ({
  id, sourceKey:`upy-kaohsiung-ap-${id}`, case:'YT-UPY-2026-001', caseName:'上洋高雄', vendor, summary, amount,
  wantDate, transferDate, ticket:'', doneDate, bank, invoice, receipt, person, status,
  note:'Codex匯入：上洋高雄連動成本控制表及2026年宇德廠商請款記錄表'
}));
const CODEX_SEED_MUZHA_PAYABLES = [
  [1001,'龍益窯業','60＊60拋光',33600,'2025-12-10'],
  [1002,'王宥均（阿義）','地磚工資',61588,'2025-12-20'],
  [1003,'新財圓','垃圾清運',32550,'2025-11-30'],
  [1004,'新財圓','垃圾車及山貓',20475,'2025-12-30'],
  [1005,'新財圓','垃圾車及水泥',82950,'2025-12-10'],
  [1006,'南山產物','工地保險（營造綜合險）',2600,'2025-12-10'],
  [1007,'南山產物','工地保險（雇主責任險）',1900,'2025-12-10'],
  [1008,'富卯','彈性結構膠6支',1764,'2025-12-30'],
  [1009,'俊民工程','怪手工程',37800,'2025-12-10'],
  [1010,'東榮（幸全）','木作材料',69031,'2025-12-30'],
  [1011,'簡秋隆','木工工資',104750,'2025-12-10'],
  [1012,'陳志瑋','木工工資2工*3700=7400',7400,'2025-12-20'],
  [1013,'衡岳（阿瑞）','木柵路',14800,'2025-11-20'],
  [1014,'盛揚高空車','木柵高空車',11550,'2025-11-10'],
  [1015,'陳文池','泥作',90200,'2025-12-10'],
  [1016,'陳柏任','泥作',17660,'2025-12-30'],
  [1017,'陳文池','泥作',19000,'2025-12-30'],
  [1018,'北富耀','燈具',23625,'2025-12-30'],
  [1019,'宏冠玻璃','玻璃',59143,'2025-12-30'],
  [1020,'陳進財','磨地板',9000,'2025-10-30'],
  [1021,'衡岳（阿瑞）','稅金',9036,'2025-11-20'],
  [1022,'東榮（幸全）','稅金',10632,'2025-12-30'],
  [1023,'上順五金行','裝潢五金',2600,'2025-12-30'],
  [1024,'世翊','請電費用',231000,'2025-11-30'],
  [1025,'牧門工程行','輕隔間輕鋼架完工款（全款）',249533,'2025-12-30'],
  [1026,'盛揚','高空作業工程',3468,'2025-12-10'],
  [1027,'衡岳（阿瑞）','點工拆除',43300,'2025-12-30'],
  [1028,'泰旺建材','建材',43822,'2026-01-10'],
  [1029,'廣源','冷氣',295155,'2026-01-10'],
  [1030,'北富耀','燈具',81500,'2026-01-10'],
  [1031,'龍益窯業','磁磚',4200,'2026-01-10'],
  [1032,'鴻泩','鋁窗',174300,'2026-01-10'],
  [1033,'盛揚','高空作業工程',11550,'2026-01-10'],
  [1034,'富晟帆布','洗車簾',31500,'2026-01-30'],
  [1035,'世翃水電','木柵室內水電工程',414918,'2026-01-30'],
  [1036,'長龍工程行','epoxy地坪',148575,'2026-01-30'],
  [1037,'東榮（幸全）','木作材料',20106,'2026-01-30'],
  [1038,'陳進財','清潔',24000,'2026-01-30'],
  [1039,'戚美英','1/24 共2工',5000,'2026-01-30'],
  [1040,'新財圓','垃圾車',86940,'2026-02-10'],
  [1041,'陳巧君','金屬工程',245385,'2026-02-10'],
  [1042,'弘威','控制盤、按壓',9450,'2026-02-10'],
  [1043,'盛揚','本工程自走車',8092,'2026-02-10'],
  [1044,'石家莊林明正','磁磚美容、高壓灌注',3000,'2026-02-10'],
  [1045,'陳柏任','磁磚修補',2500,'2026-02-10'],
  [1046,'九億','油漆工程',420000,'2026-02-10'],
  [1047,'簡黃傳','塑膠地磚',5000,'2026-02-10'],
  [1048,'紘吉','垃圾1台',13650,'2026-02-10'],
  [1049,'戚美英','木柵2/2—1工',2500,'2026-02-14'],
  [1050,'王子建材','衛浴設備',10137,'2026-03-10'],
  [1051,'阿瑞','年終紅包',6000,'2026-03-20'],
  [1052,'衡岳（阿瑞）','拆除、點工',30030,'2026-03-20'],
].map(([id, vendor, summary, amount, date]) => ({
  id, case:'YT-SUZ-2025-001', caseName:'木柵 Suzuki', vendor, summary, amount,
  wantDate:date, transferDate:'', doneDate:date, ticket:'', bank:'', invoice:'', receipt:'',
  person:'李鎮宇', status:'paid', note:'Codex匯入：木柵suzuki連動0326ok'
}));
const CODEX_SEED_MINZU_PAYABLES = [
  [1101,'陳順發門窗行','民族東屋頂清板',6300,'2025-12-30'],
  [1102,'北富耀','民族軌道燈、北投泛光燈',3245,'2025-10-20'],
  [1103,'盛揚高空車','高空作業工程（民族補漆）',5250,'2025-10-30'],
  [1104,'衡岳（阿瑞）','點工拆除',8400,'2025-12-30'],
  [1105,'牧門工程行','假隔間及廠區修復',15750,'2026-01-30'],
  [1106,'世翃水電','燈具安裝配電',5040,'2026-01-30'],
  [1107,'陳巧君','南港修漏水',3150,'2026-02-10'],
  [1108,'弘威','自動門定位調整',1575,'2026-02-10'],
  [1109,'盛揚','油漆自走車',8400,'2026-02-10'],
  [1110,'九億','油漆點工1/31民族1.5工、10/1濱江2工',16538,'2026-02-10'],
  [1111,'紘吉','碎石6米垃圾一台',22890,'2026-02-10'],
  [1112,'長龍工程行','epoxy',26250,'2026-04-10'],
  [1113,'廣源','水電工程修理管線',7980,'2026-06-10'],
].map(([id, vendor, summary, amount, date]) => ({
  id, case:'YT-SUZ-2025-002', caseName:'民族 Suzuki 服務廠', vendor, summary, amount,
  wantDate:date, transferDate:'', doneDate:date, ticket:'', bank:'', invoice:'', receipt:'',
  person:'李鎮宇', status:'paid', note:'Codex匯入：民族Suzuki服務廠連動0326ok'
}));
const CODEX_SEED_KAIYANG_PAYABLES = [
  [1201,'翔宇廣告','北投凱揚汽車招牌',36225,'2025-11-10'],
  [1202,'世翊','大電線材',525000,'2025-11-30'],
  [1203,'陳順發門窗行','扶手樓梯欄杆小平台、樓板修改開孔、花板、洗車區架拆裝',164850,'2025-12-30'],
  [1204,'陳柏任','泥作',4000,'2025-12-30'],
  [1205,'翔宇廣告','濱江凱揚汽車招牌',57750,'2025-11-10'],
  [1206,'達樺企業','濱江地板切割',26250,'2025-11-10'],
  [1207,'新財圓','濱江垃圾清運',205800,'2025-11-30'],
  [1208,'新財圓','濱江垃圾車及水泥',31542,'2025-12-10'],
  [1209,'南山產物','濱江工地保險（營造綜合險）',2455,'2025-12-10'],
  [1210,'南山產物','濱江工地保險（雇主責任險）',1845,'2025-12-10'],
  [1211,'俊民工程','濱江怪手工程',72135,'2025-12-10'],
  [1212,'新財圓','稅金',2750,'2025-11-10'],
  [1213,'北富耀','稅金',1264,'2025-11-10'],
  [1214,'衡岳（阿瑞）','點工拆除',45000,'2025-12-30'],
  [1215,'盛揚','濱江高空作業工程',11550,'2026-01-10'],
  [1216,'新財圓','濱江垃圾車',14700,'2026-01-10'],
  [1217,'牧門工程行','假隔間及廠區修復',17304,'2026-01-30'],
  [1218,'世翃水電','濱江請電工程尾款',371080,'2026-01-30'],
  [1219,'世翃水電','濱江室內水電工程',366660,'2026-01-30'],
  [1220,'益鴻小張','北投燈具更換工資',2000,'2026-01-30'],
  [1221,'宏冠玻璃','濱江茶玻',5250,'2026-02-10'],
  [1222,'紘吉','台泥、混沙',5754,'2026-02-10'],
].map(([id, vendor, summary, amount, date]) => ({
  id, case:'YT-KYG-2025-001', caseName:'凱揚濱江', vendor, summary, amount,
  wantDate:date, transferDate:'', doneDate:date, ticket:'', bank:'', invoice:'', receipt:'',
  person:'李鎮宇', status:'paid', note:'Codex匯入：凱揚濱江連動0326ok；來源表跨年誤植已依年度區段修正'
}));
const CODEX_SEED_WENWEIFENG_PAYABLES = [
  [1301,'衡岳（阿瑞）','10/18、10/19大小點工拆除',28200,'2025-11-20'],
  [1302,'立穩宏業','不鏽鋼鐵板',10847,'2025-11-15'],
  [1303,'東沐工程行','五權一路epoxy',248063,'2025-12-10'],
  [1304,'立穩宏業','五股不鏽鋼檯面',16384,'2025-11-06'],
  [1305,'發強五金','五金',13351,'2025-12-10'],
  [1306,'陳順發門窗行','冷氣架、鐵門含烤漆、輔助鎖',63840,'2025-12-30'],
  [1307,'新財圓','垃圾車及水泥',14700,'2025-12-10'],
  [1308,'南山產物','工地保險（營造綜合險）',2140,'2025-12-10'],
  [1309,'南山產物','工地保險（雇主責任險）',1760,'2025-12-10'],
  [1310,'富卯','彈性結構膠24支',7056,'2025-12-30'],
  [1311,'東榮（幸全）','木作建材',1386,'2025-11-30'],
  [1312,'東榮（幸全）','木作材料',97325,'2025-12-30'],
  [1313,'簡秋隆','木工工資',62300,'2025-12-10'],
  [1314,'陳柏任','泥作工程（來源表日期空白）',50000,'2025-11-30'],
  [1315,'陳柏任','泥作工程',70000,'2025-11-30'],
  [1316,'戚美英','清潔',15100,'2025-12-30'],
  [1317,'宏冠玻璃','玻璃',26093,'2025-12-30'],
  [1318,'衡岳（阿瑞）','稅金',10746,'2025-12-30'],
  [1319,'衡岳（阿瑞）','蘆洲和平路拆除',3600,'2025-12-30'],
  [1320,'牧門工程行','輕隔間輕鋼架完工款（少付72,000於一月補）',319755,'2025-12-30'],
  [1321,'衡岳（阿瑞）','點工拆除',6200,'2025-12-30'],
  [1322,'簡秋隆','工資、便當、五金',49030,'2026-01-10'],
  [1323,'鴻泩','鋁窗',105000,'2026-01-10'],
  [1324,'發強五金','水平鎖、合頁、矽利康、門弓器、把手',3250,'2026-01-10'],
  [1325,'碇國','人造石',23231,'2026-01-30'],
  [1326,'邱董','現金提領',100000,'2026-01-19'],
  [1327,'廣源','現金提領',30000,'2026-01-19'],
  [1328,'東榮（幸全）','木作材料',3190,'2026-01-30'],
  [1329,'牧門','補12月輕隔間輕鋼架少匯的完工款差額',72000,'2026-01-20'],
  [1330,'九億','油漆工程',235620,'2026-02-10'],
  [1331,'紘吉','磚角兩台',22050,'2026-02-10'],
  [1332,'北富耀','燈具退貨',-2835,'2026-03-10'],
  [1333,'永藏系統櫃','系統櫃',140839,'2026-03-10'],
].map(([id, vendor, summary, amount, date]) => ({
  id, case:'YT-WWF-2025-001', caseName:'文威豐', vendor, summary, amount,
  wantDate:date, transferDate:'', doneDate:date, ticket:'', bank:'', invoice:'', receipt:'',
  person:'李鎮宇', status:'paid', note:'Codex匯入：文威豐連動0326ok；來源表跨年誤植已依年度區段修正'
}));
const CODEX_SEED_UPY_JIAYI_PAYABLES = [
  { sourceKey:'upy-jiayi-ap-01', case:'YT-UPY-2025-001', caseName:'上洋嘉義', vendor:"宸薏工程行", summary:"epoxy工程", amount:429125, wantDate:"2025-07-30", transferDate:"2025-07-28", ticket:"2025-07-30", doneDate:"2025-07-30", bank:"國泰票", invoice:"有", receipt:"有", person:"彭俞豪", status:'paid', note:'來源：2025宇德廠商請款記錄表' },
  { sourceKey:'upy-jiayi-ap-02', case:'YT-UPY-2025-001', caseName:'上洋嘉義', vendor:"宸昌企業社", summary:"上洋水電完工款含追加", amount:131766, wantDate:"2025-08-20", transferDate:"", ticket:"2025-08-20", doneDate:"2025-08-19", bank:"國泰票", invoice:"有", receipt:"有", person:"彭俞豪", status:'paid', note:'來源：2025宇德廠商請款記錄表' },
  { sourceKey:'upy-jiayi-ap-03', case:'YT-UPY-2025-001', caseName:'上洋嘉義', vendor:"全彩企業社", summary:"上洋油漆完工款（預留三萬保留款）", amount:317441, wantDate:"2025-08-20", transferDate:"", ticket:"2025-08-20", doneDate:"2025-08-19", bank:"國泰票", invoice:"有", receipt:"有", person:"彭俞豪", status:'paid', note:'來源：2025宇德廠商請款記錄表' },
  { sourceKey:'upy-jiayi-ap-04', case:'YT-UPY-2025-001', caseName:'上洋嘉義', vendor:"奇碁", summary:"人造石", amount:36088, wantDate:"2025-07-30", transferDate:"2025-07-28", ticket:"", doneDate:"2025-07-30", bank:"國泰", invoice:"有", receipt:"有", person:"連星羽", status:'paid', note:'來源：2025宇德廠商請款記錄表' },
  { sourceKey:'upy-jiayi-ap-05', case:'YT-UPY-2025-001', caseName:'上洋嘉義', vendor:"周秀貞", summary:"嘉義太保房租", amount:75000, wantDate:"", transferDate:"", ticket:"", doneDate:"2025-05-11", bank:"國泰", invoice:"無", receipt:"無", person:"李鎮宇", status:'paid', note:'來源：2025宇德廠商請款記錄表' },
  { sourceKey:'upy-jiayi-ap-06', case:'YT-UPY-2025-001', caseName:'上洋嘉義', vendor:"富耀", summary:"嘉義燈具", amount:6164, wantDate:"2025-07-30", transferDate:"2025-07-28", ticket:"", doneDate:"2025-07-30", bank:"國泰", invoice:"有", receipt:"有", person:"李鎮宇", status:'paid', note:'來源：2025宇德廠商請款記錄表' },
  { sourceKey:'upy-jiayi-ap-07', case:'YT-UPY-2025-001', caseName:'上洋嘉義', vendor:"祥展", summary:"垃圾清運", amount:147000, wantDate:"", transferDate:"2025-05-19", ticket:"", doneDate:"2025-05-20", bank:"國泰", invoice:"無", receipt:"有", person:"彭俞豪", status:'paid', note:'來源：2025宇德廠商請款記錄表' },
  { sourceKey:'upy-jiayi-ap-08', case:'YT-UPY-2025-001', caseName:'上洋嘉義', vendor:"連星羽代付（冠宥企業社）", summary:"垃圾車", amount:39900, wantDate:"2025-06-13", transferDate:"", ticket:"", doneDate:"2025-06-13", bank:"國泰", invoice:"有", receipt:"無", person:"連星羽", status:'paid', note:'來源：2025宇德廠商請款記錄表' },
  { sourceKey:'upy-jiayi-ap-09', case:'YT-UPY-2025-001', caseName:'上洋嘉義', vendor:"連星羽代付", summary:"垃圾車", amount:35700, wantDate:"2025-07-10", transferDate:"2025-07-09", ticket:"", doneDate:"2025-07-10", bank:"國泰", invoice:"無", receipt:"無", person:"連星羽", status:'paid', note:'來源：2025宇德廠商請款記錄表' },
  { sourceKey:'upy-jiayi-ap-10', case:'YT-UPY-2025-001', caseName:'上洋嘉義', vendor:"陳美滿垃圾車", summary:"垃圾車", amount:18900, wantDate:"2025-07-28", transferDate:"2025-07-29", ticket:"", doneDate:"2025-07-29", bank:"國泰", invoice:"有", receipt:"有", person:"連星羽", status:'paid', note:'來源：2025宇德廠商請款記錄表' },
  { sourceKey:'upy-jiayi-ap-11', case:'YT-UPY-2025-001', caseName:'上洋嘉義', vendor:"福門", summary:"塑膠地磚", amount:261604, wantDate:"2025-07-10", transferDate:"2025-07-07", ticket:"", doneDate:"2025-07-10", bank:"國泰", invoice:"有", receipt:"有", person:"連星羽", status:'paid', note:'來源：2025宇德廠商請款記錄表' },
  { sourceKey:'upy-jiayi-ap-12', case:'YT-UPY-2025-001', caseName:'上洋嘉義', vendor:"簡黃傳", summary:"塑膠地磚工資、底墊、樓梯", amount:196850, wantDate:"2025-07-20", transferDate:"2025-07-18", ticket:"2025-07-20", doneDate:"2025-07-21", bank:"瑞興票", invoice:"無", receipt:"有", person:"李鎮宇", status:'paid', note:'來源：2025宇德廠商請款記錄表' },
  { sourceKey:'upy-jiayi-ap-13', case:'YT-UPY-2025-001', caseName:'上洋嘉義', vendor:"衡岳(阿瑞)", summary:"小工點工工資6工含加班", amount:20475, wantDate:"2025-07-30", transferDate:"2025-07-18", ticket:"2025-07-30", doneDate:"2025-07-30", bank:"瑞興票", invoice:"有", receipt:"有", person:"李鎮宇", status:'paid', note:'來源：2025宇德廠商請款記錄表' },
  { sourceKey:'upy-jiayi-ap-14', case:'YT-UPY-2025-001', caseName:'上洋嘉義', vendor:"李鎮宇", summary:"工程保險", amount:12600, wantDate:"2025-05-29", transferDate:"2025-05-22", ticket:"", doneDate:"2025-05-29", bank:"國泰", invoice:"無", receipt:"無", person:"李鎮宇", status:'paid', note:'來源：2025宇德廠商請款記錄表' },
  { sourceKey:'upy-jiayi-ap-15', case:'YT-UPY-2025-001', caseName:'上洋嘉義', vendor:"堉騰工程行", summary:"廁所地磚及第二區泥作及第三區洗滌區泥作", amount:70631, wantDate:"2025-06-30", transferDate:"2025-06-20", ticket:"", doneDate:"2025-06-30", bank:"國泰", invoice:"有", receipt:"有", person:"彭俞豪", status:'paid', note:'來源：2025宇德廠商請款記錄表' },
  { sourceKey:'upy-jiayi-ap-16', case:'YT-UPY-2025-001', caseName:'上洋嘉義', vendor:"衡岳(阿瑞)", summary:"拆除工程", amount:231413, wantDate:"2025-06-20", transferDate:"2025-06-13", ticket:"", doneDate:"2025-06-30", bank:"國泰", invoice:"有", receipt:"無", person:"李鎮宇", status:'paid', note:'來源：2025宇德廠商請款記錄表' },
  { sourceKey:'upy-jiayi-ap-17', case:'YT-UPY-2025-001', caseName:'上洋嘉義', vendor:"上順五金行", summary:"搗擺站腳五金", amount:2250, wantDate:"2025-07-10", transferDate:"", ticket:"", doneDate:"2025-07-10", bank:"國泰", invoice:"有", receipt:"有", person:"李鎮宇", status:'paid', note:'來源：2025宇德廠商請款記錄表' },
  { sourceKey:'upy-jiayi-ap-18', case:'YT-UPY-2025-001', caseName:'上洋嘉義', vendor:"森沅木作", summary:"木作工程第二次請款", amount:745710, wantDate:"2025-08-10", transferDate:"2025-08-05", ticket:"2025-08-10", doneDate:"2025-08-10", bank:"國泰票", invoice:"有", receipt:"有", person:"彭俞豪", status:'paid', note:'來源：2025宇德廠商請款記錄表' },
  { sourceKey:'upy-jiayi-ap-19', case:'YT-UPY-2025-001', caseName:'上洋嘉義', vendor:"森沅", summary:"木工", amount:420000, wantDate:"2025-06-20", transferDate:"2025-06-16", ticket:"2025-06-20", doneDate:"2025-06-20", bank:"國泰票", invoice:"有", receipt:"有", person:"連星羽", status:'paid', note:'來源：2025宇德廠商請款記錄表' },
  { sourceKey:'upy-jiayi-ap-20', case:'YT-UPY-2025-001', caseName:'上洋嘉義', vendor:"翔展企業社", summary:"木頭廢棄物", amount:31500, wantDate:"2025-07-20", transferDate:"2025-07-17", ticket:"", doneDate:"2025-07-18", bank:"國泰", invoice:"有", receipt:"有", person:"彭俞豪", status:'paid', note:'來源：2025宇德廠商請款記錄表' },
  { sourceKey:'upy-jiayi-ap-21', case:'YT-UPY-2025-001', caseName:'上洋嘉義', vendor:"宸昌企業社", summary:"水電三期款含追加", amount:221000, wantDate:"2025-08-10", transferDate:"2025-08-05", ticket:"2025-08-10", doneDate:"2025-08-10", bank:"國泰票", invoice:"有", receipt:"有", person:"彭俞豪", status:'paid', note:'來源：2025宇德廠商請款記錄表' },
  { sourceKey:'upy-jiayi-ap-22', case:'YT-UPY-2025-001', caseName:'上洋嘉義', vendor:"宸昌企業社", summary:"水電主合約第二期款", amount:162000, wantDate:"2025-06-30", transferDate:"2025-06-20", ticket:"2025-06-30", doneDate:"2025-06-30", bank:"國泰票", invoice:"有", receipt:"無", person:"彭俞豪", status:'paid', note:'來源：2025宇德廠商請款記錄表' },
  { sourceKey:'upy-jiayi-ap-23', case:'YT-UPY-2025-001', caseName:'上洋嘉義', vendor:"宸昌", summary:"水電工程訂金", amount:216000, wantDate:"2025-05-10", transferDate:"", ticket:"2025-05-10", doneDate:"2025-05-09", bank:"瑞興票", invoice:"有", receipt:"無", person:"彭俞豪", status:'paid', note:'來源：2025宇德廠商請款記錄表' },
  { sourceKey:'upy-jiayi-ap-24', case:'YT-UPY-2025-001', caseName:'上洋嘉義', vendor:"宸昌", summary:"水電追加二期款", amount:170000, wantDate:"2025-07-10", transferDate:"2025-07-07", ticket:"2025-07-10", doneDate:"2025-07-10", bank:"國泰票", invoice:"有", receipt:"有", person:"彭俞豪", status:'paid', note:'來源：2025宇德廠商請款記錄表' },
  { sourceKey:'upy-jiayi-ap-25', case:'YT-UPY-2025-001', caseName:'上洋嘉義', vendor:"全彩", summary:"油漆工程", amount:100000, wantDate:"", transferDate:"2025-05-27", ticket:"", doneDate:"2025-05-28", bank:"國泰", invoice:"有", receipt:"無", person:"李鎮宇", status:'paid', note:'來源：2025宇德廠商請款記錄表' },
  { sourceKey:'upy-jiayi-ap-26', case:'YT-UPY-2025-001', caseName:'上洋嘉義', vendor:"全彩企業社", summary:"油漆工程", amount:30000, wantDate:"2025-09-20", transferDate:"2025-09-15", ticket:"", doneDate:"2025-09-19", bank:"國泰", invoice:"有", receipt:"無", person:"彭俞豪", status:'paid', note:'來源：2025宇德廠商請款記錄表' },
  { sourceKey:'upy-jiayi-ap-27', case:'YT-UPY-2025-001', caseName:'上洋嘉義', vendor:"全彩", summary:"油漆第二期款", amount:200000, wantDate:"2025-06-30", transferDate:"2025-06-20", ticket:"2025-06-30", doneDate:"2025-06-30", bank:"國泰票", invoice:"無", receipt:"有", person:"彭俞豪", status:'paid', note:'來源：2025宇德廠商請款記錄表' },
  { sourceKey:'upy-jiayi-ap-28', case:'YT-UPY-2025-001', caseName:'上洋嘉義', vendor:"全彩", summary:"油漆追加款", amount:96075, wantDate:"2025-07-10", transferDate:"2025-07-07", ticket:"2025-07-10", doneDate:"2025-07-10", bank:"國泰票", invoice:"有", receipt:"無", person:"彭俞豪", status:'paid', note:'來源：2025宇德廠商請款記錄表' },
  { sourceKey:'upy-jiayi-ap-29', case:'YT-UPY-2025-001', caseName:'上洋嘉義', vendor:"戚美英", summary:"清潔工程", amount:60000, wantDate:"2025-08-10", transferDate:"2025-08-05", ticket:"", doneDate:"2025-08-08", bank:"國泰", invoice:"無", receipt:"有", person:"李鎮宇", status:'paid', note:'來源：2025宇德廠商請款記錄表' },
  { sourceKey:'upy-jiayi-ap-30', case:'YT-UPY-2025-001', caseName:'上洋嘉義', vendor:"承明玻璃有限公司", summary:"玻璃工程含貼膜", amount:166438, wantDate:"2025-07-30", transferDate:"2025-07-28", ticket:"2025-07-30", doneDate:"2025-07-30", bank:"國泰票", invoice:"有", receipt:"有", person:"彭俞豪", status:'paid', note:'來源：2025宇德廠商請款記錄表' },
  { sourceKey:'upy-jiayi-ap-31', case:'YT-UPY-2025-001', caseName:'上洋嘉義', vendor:"衡岳（阿瑞）", summary:"粗工點工", amount:18200, wantDate:"2025-08-10", transferDate:"2025-08-06", ticket:"", doneDate:"2025-08-08", bank:"國泰", invoice:"有", receipt:"有", person:"李鎮宇", status:'paid', note:'來源：2025宇德廠商請款記錄表' },
  { sourceKey:'upy-jiayi-ap-32', case:'YT-UPY-2025-001', caseName:'上洋嘉義', vendor:"王子建材", summary:"衛浴設備（馬桶、壁掛便斗、臉盆龍頭、衛生紙架）", amount:40807, wantDate:"2025-07-10", transferDate:"2025-07-07", ticket:"2025-07-10", doneDate:"2025-07-10", bank:"瑞興票", invoice:"有", receipt:"有", person:"連星羽", status:'paid', note:'來源：2025宇德廠商請款記錄表' },
  { sourceKey:'upy-jiayi-ap-33', case:'YT-UPY-2025-001', caseName:'上洋嘉義', vendor:"竹庭工程行", summary:"輕隔間、輕鋼架天花", amount:1013471, wantDate:"2025-08-10", transferDate:"2025-08-06", ticket:"", doneDate:"2025-08-09", bank:"國泰票", invoice:"有", receipt:"有", person:"李鎮宇", status:'paid', note:'來源：2025宇德廠商請款記錄表' },
  { sourceKey:'upy-jiayi-ap-34', case:'YT-UPY-2025-001', caseName:'上洋嘉義', vendor:"宸昌", summary:"追加工程訂金", amount:226000, wantDate:"2025-06-05", transferDate:"", ticket:"2025-06-05", doneDate:"2025-06-05", bank:"國泰", invoice:"有", receipt:"有", person:"彭俞豪", status:'paid', note:'來源：2025宇德廠商請款記錄表' },
  { sourceKey:'upy-jiayi-ap-35', case:'YT-UPY-2025-001', caseName:'上洋嘉義', vendor:"鴻昇鋁窗", summary:"鋁窗工程", amount:69900, wantDate:"2025-08-10", transferDate:"2025-08-06", ticket:"", doneDate:"2025-08-10", bank:"國泰票", invoice:"有", receipt:"有", person:"連星羽", status:'paid', note:'來源：2025宇德廠商請款記錄表' },
  { sourceKey:'upy-jiayi-ap-36', case:'YT-UPY-2025-001', caseName:'上洋嘉義', vendor:"上新金屬工程行陳明義", summary:"鐵花板及四片鐵門", amount:86100, wantDate:"2025-07-30", transferDate:"2025-07-28", ticket:"", doneDate:"2025-07-30", bank:"國泰", invoice:"有", receipt:"有", person:"彭俞豪", status:'paid', note:'來源：2025宇德廠商請款記錄表' },
  { sourceKey:'upy-jiayi-ap-37', case:'YT-UPY-2025-001', caseName:'上洋嘉義', vendor:"莊自強", summary:"防水基座點工", amount:4500, wantDate:"2025-07-10", transferDate:"2025-07-09", ticket:"", doneDate:"2025-07-10", bank:"國泰", invoice:"無", receipt:"有", person:"彭俞豪", status:'paid', note:'來源：2025宇德廠商請款記錄表' },
  { sourceKey:'upy-jiayi-ap-38', case:'YT-UPY-2025-001', caseName:'上洋嘉義', vendor:"艾群營造", summary:"高空車施作6/1-7/15", amount:24501, wantDate:"2025-07-30", transferDate:"2025-07-28", ticket:"2025-07-30", doneDate:"2025-07-30", bank:"國泰票", invoice:"有", receipt:"有", person:"彭俞豪", status:'paid', note:'來源：2025宇德廠商請款記錄表' },
];
const CODEX_SEED_YUCHENG_PAYABLES = [
  { sourceKey:'yucheng-family-ap-20260210-jiuyi', case:'YT-FAM-2026-001', caseName:'玉成街親友工程', vendor:'九億', summary:'油漆點工', amount:7350, wantDate:'2026-02-10', transferDate:'2026-02-09', doneDate:'2026-02-10', ticket:'2026-02-10', bank:'瑞興票', invoice:'有', receipt:'有', person:'李鎮宇', paymentType:'family_pass_through', passThroughReceivable:false, status:'paid', note:'來源：2026應付帳款；玉成街親友成本轉付；本次不向玉成街收款，只列廠商成本。' },
  { sourceKey:'yucheng-family-ap-20260214-chi', case:'YT-FAM-2026-001', caseName:'玉成街親友工程', vendor:'戚美英', summary:'玉成街2/13–2工、2/14–2工', amount:10000, wantDate:'2026-02-14', transferDate:'', doneDate:'', ticket:'', bank:'國泰', invoice:'無', receipt:'無', person:'李鎮宇', paymentType:'family_pass_through', passThroughReceivable:false, status:'paid', note:'來源：2026應付帳款；玉成街親友成本轉付；本次不向玉成街收款，只列廠商成本。' },
  { sourceKey:'yucheng-family-ap-20260320-shangshun', case:'YT-FAM-2026-001', caseName:'玉成街親友工程', vendor:'上順五金', summary:'五金', amount:880, wantDate:'2026-03-20', transferDate:'2026-03-26', doneDate:'', ticket:'', bank:'瑞興', invoice:'無', receipt:'無', person:'李鎮宇', paymentType:'family_pass_through', passThroughReceivable:false, status:'paid', note:'來源：2026應付帳款；玉成街親友成本轉付；本次不向玉成街收款，只列廠商成本。' },
  { sourceKey:'yucheng-family-ap-20260410-clean', case:'YT-FAM-2026-001', caseName:'玉成街親友工程', vendor:'戚美英', summary:'清潔', amount:2500, wantDate:'2026-04-10', transferDate:'2026-04-09', doneDate:'2026-04-10', ticket:'', bank:'國泰', invoice:'無', receipt:'有', person:'連星羽', paymentType:'family_pass_through', passThroughReceivable:false, status:'paid', note:'來源：2026應付帳款；玉成街親友成本轉付；本次不向玉成街收款，只列廠商成本。' },
  { sourceKey:'yucheng-family-ap-20260510-tangcheng', case:'YT-FAM-2026-001', caseName:'玉成街親友工程', vendor:'唐承', summary:'玉成街木地板', amount:86071, wantDate:'2026-05-10', transferDate:'2026-05-07', doneDate:'2026-05-08', ticket:'', bank:'國泰', invoice:'有', receipt:'有', person:'李鎮宇', paymentType:'family_pass_through', passThroughReceivable:true, status:'paid', note:'來源：2026應付帳款；玉成街親友成本轉付；本次向玉成街收款。' },
  { sourceKey:'yucheng-family-ap-20260530-dongrong', case:'YT-FAM-2026-001', caseName:'玉成街親友工程', vendor:'東榮（幸全）', summary:'玉成街木作材料', amount:17229, wantDate:'2026-05-30', transferDate:'2026-05-29', doneDate:'2026-05-30', ticket:'2026-05-30', bank:'瑞興票', invoice:'有', receipt:'有', person:'李鎮宇', paymentType:'family_pass_through', passThroughReceivable:true, status:'paid', note:'來源：2026應付帳款；玉成街親友成本轉付；本次向玉成街收款。' },
  { sourceKey:'yucheng-family-ap-20260520-xincaiyuan', case:'YT-FAM-2026-001', caseName:'玉成街親友工程', vendor:'新財圓', summary:'玉成街地板拆除垃圾＋上期未付750', amount:16500, wantDate:'2026-05-20', transferDate:'2026-05-19', doneDate:'2026-05-20', ticket:'', bank:'國泰', invoice:'有', receipt:'有', person:'李鎮宇', paymentType:'family_pass_through', passThroughReceivable:true, status:'paid', note:'來源：2026應付帳款；玉成街親友成本轉付；含上期未付750；本次向玉成街收款。' },
  { sourceKey:'yucheng-family-ap-20260520-chi-clean', case:'YT-FAM-2026-001', caseName:'玉成街親友工程', vendor:'戚美英', summary:'玉成街清潔', amount:5000, wantDate:'2026-05-20', transferDate:'2026-05-19', doneDate:'2026-05-20', ticket:'', bank:'國泰', invoice:'無', receipt:'有', person:'李鎮宇', paymentType:'family_pass_through', passThroughReceivable:true, status:'paid', note:'來源：2026應付帳款；玉成街親友成本轉付；本次向玉成街收款。' },
  { sourceKey:'yucheng-family-ap-20260530-hengyue', case:'YT-FAM-2026-001', caseName:'玉成街親友工程', vendor:'衡岳（阿瑞）', summary:'玉成街拆除工資', amount:12599, wantDate:'2026-05-30', transferDate:'2026-05-29', doneDate:'2026-05-30', ticket:'', bank:'國泰', invoice:'有', receipt:'有', person:'連星羽', paymentType:'family_pass_through', passThroughReceivable:true, status:'paid', note:'來源：2026應付帳款；玉成街親友成本轉付；本次向玉成街收款。' },
];
const CODEX_SEED_HULIN_PAYABLES = [
  { sourceKey:'hulin-family-ap-2025-1', case:'YT-FAM-2026-002', caseName:'虎林街住家', vendor:'衡岳（阿瑞）', summary:'10/17、10/19、10/20、10/21 大小點工搬料、保護、拆除', amount:24150, wantDate:'2025-11-20', doneDate:'2025-11-20', bank:'國泰', paymentType:'family_pass_through', passThroughReceivable:false, status:'paid', note:'來源：2025年宇德廠商請款記錄表／連動總表細項；原表來源備註：衡岳20251113請款單。虎林街廠商成本明細，不逐筆轉應收。' },
  { sourceKey:'hulin-family-ap-2025-2', case:'YT-FAM-2026-002', caseName:'虎林街住家', vendor:'李嘉航', summary:'3D棋德列印代付', amount:4000, wantDate:'2025-10-23', doneDate:'2025-10-23', bank:'國泰', paymentType:'family_pass_through', passThroughReceivable:false, status:'paid', note:'來源：2025年宇德廠商請款記錄表／連動總表細項；原表來源備註：褀德20251023匯款截圖.PNG。虎林街廠商成本明細，不逐筆轉應收。' },
  { sourceKey:'hulin-family-ap-2025-3', case:'YT-FAM-2026-002', caseName:'虎林街住家', vendor:'新財圓', summary:'垃圾清運', amount:8000, wantDate:'2025-11-10', doneDate:'2025-11-10', bank:'國泰', paymentType:'family_pass_through', passThroughReceivable:false, status:'paid', note:'來源：2025年宇德廠商請款記錄表／連動總表細項；原表來源備註：新財圓202510請款單、發票。虎林街廠商成本明細，不逐筆轉應收。' },
  { sourceKey:'hulin-family-ap-2025-4', case:'YT-FAM-2026-002', caseName:'虎林街住家', vendor:'新財圓', summary:'垃圾車', amount:9450, wantDate:'2025-12-30', doneDate:'2025-12-30', bank:'國泰', paymentType:'family_pass_through', passThroughReceivable:false, status:'paid', note:'來源：2025年宇德廠商請款記錄表／連動總表細項；原表來源備註：新財圓20251217請款單＋發票。虎林街廠商成本明細，不逐筆轉應收。' },
  { sourceKey:'hulin-family-ap-2025-5', case:'YT-FAM-2026-002', caseName:'虎林街住家', vendor:'東榮（幸全）', summary:'木作建材', amount:49622, wantDate:'2025-11-30', doneDate:'2025-11-30', bank:'瑞興票', paymentType:'family_pass_through', passThroughReceivable:false, status:'paid', note:'來源：2025年宇德廠商請款記錄表／連動總表細項；原表來源備註：東榮20251024請款單＋發票。虎林街廠商成本明細，不逐筆轉應收。' },
  { sourceKey:'hulin-family-ap-2025-6', case:'YT-FAM-2026-002', caseName:'虎林街住家', vendor:'東榮（幸全）', summary:'木作材料-折扣219010*0.03=6570', amount:46084, wantDate:'2025-12-30', doneDate:'2025-12-30', bank:'瑞興票', paymentType:'family_pass_through', passThroughReceivable:false, status:'paid', note:'來源：2025年宇德廠商請款記錄表／連動總表細項；原表來源備註：幸全20251127請款單＋發票。虎林街廠商成本明細，不逐筆轉應收。' },
  { sourceKey:'hulin-family-ap-2025-7', case:'YT-FAM-2026-002', caseName:'虎林街住家', vendor:'陳志璋', summary:'木工工資 10/21-10/31 豪哥8工志瑋7天，共15工*3700=55,500', amount:55500, wantDate:'2025-11-04', doneDate:'2025-11-04', bank:'國泰', paymentType:'family_pass_through', passThroughReceivable:false, status:'paid', note:'來源：2025年宇德廠商請款記錄表／連動總表細項；原表來源備註：2025 表完成匯款日 11/4。虎林街廠商成本明細，不逐筆轉應收。' },
  { sourceKey:'hulin-family-ap-2025-8', case:'YT-FAM-2026-002', caseName:'虎林街住家', vendor:'陳志璋', summary:'木工工資 11/1-11/15 豪哥10工 志瑋9天，共19工*3700=70,300', amount:70300, wantDate:'2025-11-20', doneDate:'2025-11-20', bank:'國泰', paymentType:'family_pass_through', passThroughReceivable:false, status:'paid', note:'來源：2025年宇德廠商請款記錄表／連動總表細項；原表來源備註：陳志璋20251120匯款截圖。虎林街廠商成本明細，不逐筆轉應收。' },
  { sourceKey:'hulin-family-ap-2025-9', case:'YT-FAM-2026-002', caseName:'虎林街住家', vendor:'陳志璋', summary:'木工工資 11/15-11/30 豪哥10工 志瑋8.5天，12/1-12/15豪哥10 志瑋10，共38.5工*3700=142,450', amount:142450, wantDate:'2025-12-19', doneDate:'2025-12-19', bank:'國泰', paymentType:'family_pass_through', passThroughReceivable:false, status:'paid', note:'來源：2025年宇德廠商請款記錄表／連動總表細項；原表來源備註：2025 表完成匯款日 12/19。虎林街廠商成本明細，不逐筆轉應收。' },
  { sourceKey:'hulin-family-ap-2025-10', case:'YT-FAM-2026-002', caseName:'虎林街住家', vendor:'陳志璋', summary:'木工工資 12/15-12/19 豪哥1工 志瑋3.5工，共4.5工*3700=16,650', amount:16650, wantDate:'2025-12-19', doneDate:'2025-12-19', bank:'國泰', paymentType:'family_pass_through', passThroughReceivable:false, status:'paid', note:'來源：2025年宇德廠商請款記錄表／連動總表細項；原表來源備註：2025 表完成匯款日 12/19。虎林街廠商成本明細，不逐筆轉應收。' },
  { sourceKey:'hulin-family-ap-2025-11', case:'YT-FAM-2026-002', caseName:'虎林街住家', vendor:'胡地', summary:'木工工資3500*2工', amount:7000, wantDate:'2025-12-27', doneDate:'2025-12-27', bank:'國泰', paymentType:'family_pass_through', passThroughReceivable:false, status:'paid', note:'來源：2025年宇德廠商請款記錄表／連動總表細項；原表來源備註：2025 表完成匯款日 12/27。虎林街廠商成本明細，不逐筆轉應收。' },
  { sourceKey:'hulin-family-ap-2025-12', case:'YT-FAM-2026-002', caseName:'虎林街住家', vendor:'陳文池', summary:'泥作', amount:8000, wantDate:'2025-12-10', doneDate:'2025-12-10', bank:'國泰', paymentType:'family_pass_through', passThroughReceivable:false, status:'paid', note:'來源：2025年宇德廠商請款記錄表／連動總表細項；原表來源備註：2025 表完成匯款日 12/10。虎林街廠商成本明細，不逐筆轉應收。' },
  { sourceKey:'hulin-family-ap-2025-13', case:'YT-FAM-2026-002', caseName:'虎林街住家', vendor:'北富耀', summary:'燈具', amount:21600, wantDate:'2025-11-10', doneDate:'2025-11-10', bank:'國泰', paymentType:'family_pass_through', passThroughReceivable:false, status:'paid', note:'來源：2025年宇德廠商請款記錄表／連動總表細項；原表來源備註：北富耀20251031請款單（備註）。虎林街廠商成本明細，不逐筆轉應收。' },
  { sourceKey:'hulin-family-ap-2026-1', case:'YT-FAM-2026-002', caseName:'虎林街住家', vendor:'富卯', summary:'創意玩家石晶薄板、收邊條、膠', amount:90027, wantDate:'2026-01-30', doneDate:'2026-01-30', bank:'瑞興票', paymentType:'family_pass_through', passThroughReceivable:false, status:'paid', note:'來源：2026年宇德廠商請款記錄表；虎林街廠商成本明細，不逐筆轉應收。' },
  { sourceKey:'hulin-family-ap-2026-2', case:'YT-FAM-2026-002', caseName:'虎林街住家', vendor:'王有鈞（阿義）', summary:'磁磚修補貼磚工資', amount:5000, wantDate:'2026-01-09', doneDate:'2026-01-09', bank:'國泰', paymentType:'family_pass_through', passThroughReceivable:false, status:'paid', note:'來源：2026年宇德廠商請款記錄表；虎林街廠商成本明細，不逐筆轉應收。' },
  { sourceKey:'hulin-family-ap-2026-3', case:'YT-FAM-2026-002', caseName:'虎林街住家', vendor:'新財圓', summary:'垃圾車', amount:7350, wantDate:'2026-01-10', doneDate:'2026-01-09', bank:'國泰', paymentType:'family_pass_through', passThroughReceivable:false, status:'paid', note:'來源：2026年宇德廠商請款記錄表；虎林街廠商成本明細，不逐筆轉應收。' },
  { sourceKey:'hulin-family-ap-2026-4', case:'YT-FAM-2026-002', caseName:'虎林街住家', vendor:'唐承', summary:'SPC地板工程', amount:11441, wantDate:'2026-01-30', doneDate:'2026-01-30', bank:'國泰', paymentType:'family_pass_through', passThroughReceivable:false, status:'paid', note:'來源：2026年宇德廠商請款記錄表；虎林街廠商成本明細，不逐筆轉應收。' },
  { sourceKey:'hulin-family-ap-2026-5', case:'YT-FAM-2026-002', caseName:'虎林街住家', vendor:'林阿照', summary:'淋浴拉門拆裝工資', amount:10000, wantDate:'2026-01-19', doneDate:'2026-01-19', bank:'國泰', paymentType:'family_pass_through', passThroughReceivable:false, status:'paid', note:'來源：2026年宇德廠商請款記錄表；虎林街廠商成本明細，不逐筆轉應收。' },
  { sourceKey:'hulin-family-ap-2026-6', case:'YT-FAM-2026-002', caseName:'虎林街住家', vendor:'東榮（幸全）', summary:'木作材料', amount:33978, wantDate:'2026-01-30', doneDate:'2026-01-30', bank:'瑞興票', paymentType:'family_pass_through', passThroughReceivable:false, status:'paid', note:'來源：2026年宇德廠商請款記錄表；虎林街廠商成本明細，不逐筆轉應收。' },
  { sourceKey:'hulin-family-ap-2026-7', case:'YT-FAM-2026-002', caseName:'虎林街住家', vendor:'禾興', summary:'廚具', amount:94500, wantDate:'2026-01-30', doneDate:'2026-01-30', bank:'國泰', paymentType:'family_pass_through', passThroughReceivable:false, status:'paid', note:'來源：2026年宇德廠商請款記錄表；虎林街廠商成本明細，不逐筆轉應收。' },
  { sourceKey:'hulin-family-ap-2026-8', case:'YT-FAM-2026-002', caseName:'虎林街住家', vendor:'戚美英', summary:'1/27 4工加班加1工', amount:12500, wantDate:'2026-01-30', doneDate:'2026-01-30', bank:'國泰', paymentType:'family_pass_through', passThroughReceivable:false, status:'paid', note:'來源：2026年宇德廠商請款記錄表；虎林街廠商成本明細，不逐筆轉應收。' },
  { sourceKey:'hulin-family-ap-2026-9', case:'YT-FAM-2026-002', caseName:'虎林街住家', vendor:'富卯', summary:'STO 防黴礦物塗料', amount:26775, wantDate:'2026-02-10', doneDate:'2026-02-10', bank:'瑞興票', paymentType:'family_pass_through', passThroughReceivable:false, status:'paid', note:'來源：2026年宇德廠商請款記錄表；虎林街廠商成本明細，不逐筆轉應收。' },
  { sourceKey:'hulin-family-ap-2026-10', case:'YT-FAM-2026-002', caseName:'虎林街住家', vendor:'陳巧君', summary:'廚具背牆不鏽鋼、雨遮修復', amount:74000, wantDate:'2026-02-10', doneDate:'2026-02-10', bank:'瑞興票', paymentType:'family_pass_through', passThroughReceivable:false, status:'paid', note:'來源：2026年宇德廠商請款記錄表；虎林街廠商成本明細，不逐筆轉應收。' },
  { sourceKey:'hulin-family-ap-2026-11', case:'YT-FAM-2026-002', caseName:'虎林街住家', vendor:'奇碁（碇園）', summary:'人造石水槽龍頭', amount:63000, wantDate:'2026-02-10', doneDate:'2026-02-10', bank:'瑞興票', paymentType:'family_pass_through', passThroughReceivable:false, status:'paid', note:'來源：2026年宇德廠商請款記錄表；虎林街廠商成本明細，不逐筆轉應收。' },
  { sourceKey:'hulin-family-ap-2026-12', case:'YT-FAM-2026-002', caseName:'虎林街住家', vendor:'鋁工藝詹勝', summary:'鋁窗、三合一門', amount:40000, wantDate:'2026-02-10', doneDate:'2026-02-10', bank:'國泰', paymentType:'family_pass_through', passThroughReceivable:false, status:'paid', note:'來源：2026年宇德廠商請款記錄表；虎林街廠商成本明細，不逐筆轉應收。' },
  { sourceKey:'hulin-family-ap-2026-13', case:'YT-FAM-2026-002', caseName:'虎林街住家', vendor:'廣源', summary:'冷氣工程', amount:20000, wantDate:'2026-02-10', doneDate:'2026-02-10', bank:'國泰', paymentType:'family_pass_through', passThroughReceivable:false, status:'paid', note:'來源：2026年宇德廠商請款記錄表；虎林街廠商成本明細，不逐筆轉應收。' },
  { sourceKey:'hulin-family-ap-2026-14', case:'YT-FAM-2026-002', caseName:'虎林街住家', vendor:'廣源', summary:'冷氣工程', amount:40058, wantDate:'2026-02-10', doneDate:'2026-02-10', bank:'國泰', paymentType:'family_pass_through', passThroughReceivable:false, status:'paid', note:'來源：2026年宇德廠商請款記錄表；虎林街廠商成本明細，不逐筆轉應收。' },
  { sourceKey:'hulin-family-ap-2026-15', case:'YT-FAM-2026-002', caseName:'虎林街住家', vendor:'游志松（賢威）', summary:'踢腳板', amount:4200, wantDate:'2026-02-10', doneDate:'2026-02-10', bank:'國泰', paymentType:'family_pass_through', passThroughReceivable:false, status:'paid', note:'來源：2026年宇德廠商請款記錄表；虎林街廠商成本明細，不逐筆轉應收。' },
  { sourceKey:'hulin-family-ap-2026-16', case:'YT-FAM-2026-002', caseName:'虎林街住家', vendor:'宏冠玻璃', summary:'明鏡、櫥櫃玻璃門', amount:5517, wantDate:'2026-02-10', doneDate:'2026-02-10', bank:'瑞興票', paymentType:'family_pass_through', passThroughReceivable:false, status:'paid', note:'來源：2026年宇德廠商請款記錄表；虎林街廠商成本明細，不逐筆轉應收。' },
  { sourceKey:'hulin-family-ap-2026-17', case:'YT-FAM-2026-002', caseName:'虎林街住家', vendor:'九億', summary:'油漆工程', amount:125000, wantDate:'2026-02-10', doneDate:'2026-02-10', bank:'瑞興票', paymentType:'family_pass_through', passThroughReceivable:false, status:'paid', note:'來源：2026年宇德廠商請款記錄表；虎林街廠商成本明細，不逐筆轉應收。' },
  { sourceKey:'hulin-family-ap-2026-18', case:'YT-FAM-2026-002', caseName:'虎林街住家', vendor:'陳信宏', summary:'水電工、料費', amount:160000, wantDate:'2026-02-10', doneDate:'2026-02-10', bank:'國泰', paymentType:'family_pass_through', passThroughReceivable:false, status:'paid', note:'來源：2026年宇德廠商請款記錄表；虎林街廠商成本明細，不逐筆轉應收。' },
  { sourceKey:'hulin-family-ap-2026-19', case:'YT-FAM-2026-002', caseName:'虎林街住家', vendor:'螢品（建興）', summary:'水電材料', amount:90434, wantDate:'2026-02-10', doneDate:'2026-02-10', bank:'國泰', paymentType:'family_pass_through', passThroughReceivable:false, status:'paid', note:'來源：2026年宇德廠商請款記錄表；虎林街廠商成本明細，不逐筆轉應收。' },
  { sourceKey:'hulin-family-ap-2026-20', case:'YT-FAM-2026-002', caseName:'虎林街住家', vendor:'東榮（幸全）', summary:'木作材料', amount:9949, wantDate:'2026-02-10', doneDate:'2026-02-10', bank:'瑞興票', paymentType:'family_pass_through', passThroughReceivable:false, status:'paid', note:'來源：2026年宇德廠商請款記錄表；虎林街廠商成本明細，不逐筆轉應收。' },
  { sourceKey:'hulin-family-ap-2026-21', case:'YT-FAM-2026-002', caseName:'虎林街住家', vendor:'新財圓', summary:'垃圾清運', amount:11500, wantDate:'2026-02-10', doneDate:'2026-02-10', bank:'國泰', paymentType:'family_pass_through', passThroughReceivable:false, status:'paid', note:'來源：2026年宇德廠商請款記錄表；虎林街廠商成本明細，不逐筆轉應收。' },
  { sourceKey:'hulin-family-ap-2026-22', case:'YT-FAM-2026-002', caseName:'虎林街住家', vendor:'北富耀', summary:'燈具', amount:9340, wantDate:'2026-03-10', doneDate:'2026-03-10', bank:'國泰', paymentType:'family_pass_through', passThroughReceivable:false, status:'paid', note:'來源：2026年宇德廠商請款記錄表；虎林街廠商成本明細，不逐筆轉應收。' },
  { sourceKey:'hulin-family-ap-2026-23', case:'YT-FAM-2026-002', caseName:'虎林街住家', vendor:'東榮（幸全）', summary:'木作材料', amount:2760, wantDate:'2026-03-20', doneDate:'2026-03-24', bank:'瑞興票', paymentType:'family_pass_through', passThroughReceivable:false, status:'paid', note:'來源：2026年宇德廠商請款記錄表；虎林街廠商成本明細，不逐筆轉應收。' },
  { sourceKey:'hulin-family-ap-2026-24', case:'YT-FAM-2026-002', caseName:'虎林街住家', vendor:'衡岳（阿瑞）', summary:'拆除、點工', amount:2520, wantDate:'2026-03-20', doneDate:'2026-03-20', bank:'國泰', paymentType:'family_pass_through', passThroughReceivable:false, status:'paid', note:'來源：2026年宇德廠商請款記錄表；虎林街廠商成本明細，不逐筆轉應收。' },
  { sourceKey:'hulin-family-ap-2026-25', case:'YT-FAM-2026-002', caseName:'虎林街住家', vendor:'陳順發', summary:'洗衣機鐵架', amount:2100, wantDate:'2026-05-20', doneDate:'2026-05-20', bank:'國泰', paymentType:'family_pass_through', passThroughReceivable:false, status:'paid', note:'來源：2026年宇德廠商請款記錄表；此筆由宇德善意負擔，不再向親友收回。虎林街廠商成本明細，不逐筆轉應收。' },
];
const CODEX_SEED_HULIN_RECEIVABLES = [];
const CODEX_SEED_PRIVATE_LOAN_PAYABLES = [
  { sourceKey:'yude-private-loan-20260112-li-99200', case:'YT-LOAN-2026-001', caseName:'李媽媽私人借支', vendor:'李秋惠', summary:'借款', amount:99200, wantDate:'2026-01-12', transferDate:'2026-01-12', doneDate:'2026-01-12', ticket:'', bank:'國泰', invoice:'無', receipt:'無', person:'李鎮宇', paymentType:'private_loan', status:'paid', note:'私人借支；列入私人借支不分潤個案，還款時手動建立應收。' },
  { sourceKey:'yude-private-loan-20260209-li-99200', case:'YT-LOAN-2026-001', caseName:'李媽媽私人借支', vendor:'李秋惠', summary:'借款', amount:99200, wantDate:'2026-02-09', transferDate:'', doneDate:'2026-02-09', ticket:'2026-02-09', bank:'瑞興票', invoice:'無', receipt:'無', person:'李鎮宇', paymentType:'private_loan', status:'paid', note:'私人借支；列入私人借支不分潤個案，還款時手動建立應收。' },
  { sourceKey:'yude-private-loan-20260309-li-98400', case:'YT-LOAN-2026-001', caseName:'李媽媽私人借支', vendor:'李秋惠', summary:'支票借款', amount:98400, wantDate:'2026-03-09', transferDate:'2026-03-09', doneDate:'2026-03-09', ticket:'', bank:'國泰', invoice:'無', receipt:'無', person:'李鎮宇', paymentType:'private_loan', status:'paid', note:'私人借支；列入私人借支不分潤個案，還款時手動建立應收。' },
  { sourceKey:'yude-private-loan-20260309-li-50000', case:'YT-LOAN-2026-001', caseName:'李媽媽私人借支', vendor:'李秋惠', summary:'支票借款', amount:50000, wantDate:'2026-03-09', transferDate:'2026-03-09', doneDate:'2026-03-09', ticket:'', bank:'國泰', invoice:'無', receipt:'無', person:'李鎮宇', paymentType:'private_loan', status:'paid', note:'私人借支；列入私人借支不分潤個案，還款時手動建立應收。' },
  { sourceKey:'yude-private-loan-20260413-li-100000', case:'YT-LOAN-2026-001', caseName:'李媽媽私人借支', vendor:'李秋惠', summary:'借用支票', amount:100000, wantDate:'2026-04-13', transferDate:'2026-04-13', doneDate:'2026-04-13', ticket:'2026-04-13', bank:'國泰', invoice:'無', receipt:'無', person:'連星羽', paymentType:'private_loan', status:'paid', note:'私人借支／支票借用；列入私人借支不分潤個案，還款時手動建立應收。' },
  { sourceKey:'yude-private-loan-20260511-li-149200', case:'YT-LOAN-2026-001', caseName:'李媽媽私人借支', vendor:'李秋惠', summary:'借用支票', amount:149200, wantDate:'2026-05-11', transferDate:'2026-05-11', doneDate:'2026-05-11', ticket:'', bank:'國泰', invoice:'無', receipt:'無', person:'李鎮宇', paymentType:'private_loan', status:'paid', note:'私人借支／支票借用；原月表第三欄為51，連動總表帶出李秋惠；支票號碼與歸還狀態待補；列入私人借支不分潤個案，還款時手動建立應收。' },
];
const CODEX_SEED_UPY_KAOHSIUNG_MISC_PAYABLES = [
  { sourceKey:'upy-kaohsiung-misc-20260110-baishi-fees', case:'YT-UPY-2026-001', caseName:'上洋高雄', vendor:'柏實', summary:'代付（規費、代刻印章）', amount:7300, wantDate:'2026-01-10', transferDate:'2026-01-10', doneDate:'2026-01-10', ticket:'', bank:'', invoice:'無', receipt:'無', person:'李鎮宇', paymentType:'vendor', status:'paid', note:'來源：宇德公司暫存分類；已確認歸上洋高雄成本' },
  { sourceKey:'upy-kaohsiung-misc-20260110-baishi-capital', case:'YT-UPY-2026-001', caseName:'上洋高雄', vendor:'柏實', summary:'增資（含資本額簽證）', amount:25000, wantDate:'2026-01-10', transferDate:'2026-01-10', doneDate:'2026-01-10', ticket:'', bank:'', invoice:'無', receipt:'無', person:'李鎮宇', paymentType:'vendor', status:'paid', note:'來源：宇德公司暫存分類；已確認歸上洋高雄成本' },
  { sourceKey:'upy-kaohsiung-misc-20260210-danmo-card', case:'YT-UPY-2026-001', caseName:'上洋高雄', vendor:'丹墨整合', summary:'公司名片', amount:3000, wantDate:'2026-02-10', transferDate:'2026-02-10', doneDate:'2026-02-10', ticket:'', bank:'', invoice:'無', receipt:'無', person:'李鎮宇', paymentType:'vendor', status:'paid', note:'來源：宇德公司暫存分類；已確認歸上洋高雄成本' },
];
const CODEX_SEED_TAX_LIABILITIES = [
  { id:1, sourceKey:'tax-20260110-vat-84912', taxType:'營業稅', period:'2025-11~12', vendor:'林振明（柏實）', summary:'營業稅代付', amount:84912, payDate:'2026-01-10', status:'paid', note:'來源：宇德公司暫存分類；不列一般公司開銷' },
  { id:2, sourceKey:'tax-20260310-vat-47019', taxType:'營業稅', period:'2026-01~02', vendor:'林振明（柏實）', summary:'營業稅代付 1-2月', amount:47019, payDate:'2026-03-10', status:'paid', note:'來源：宇德公司暫存分類；不列一般公司開銷' },
  { id:3, sourceKey:'tax-20260510-vat-391799', taxType:'營業稅', period:'2026-03~04', vendor:'林振明', summary:'3.4月營業稅', amount:391799, payDate:'2026-05-10', status:'paid', note:'來源：宇德公司暫存分類；不列一般公司開銷' },
  { id:4, sourceKey:'tax-20260510-income-69428', taxType:'營所稅', period:'2025', vendor:'林振銘（柏實）', summary:'114 營所稅結算', amount:69428, payDate:'2026-05-10', status:'paid', note:'來源：宇德公司暫存分類；不列一般公司開銷' },
];
const CODEX_SEED_UPY_JIAYI_RECEIVABLES = [
  { id:2101, collectDate:"2025-06-05", buyer:"上洋產業股份有限公司", item:"裝潢工程訂金款", collectAmt:2759985, bank:"國泰", invoiceAmt:2760000, invoiceDate:"2025-05-20", invoiceNo:"PJ84443555", contractAmt:9200000, progress:"0.3", case:'YT-UPY-2025-001', caseName:'上洋嘉義', invoiceLink:'', status:'collected', note:'來源：2025應收帳款' },
  { id:2102, collectDate:"2025-08-25", buyer:"上洋產業股份有限公司/12978735", item:"裝潢工程", collectAmt:5519970, bank:"國泰", invoiceAmt:5520000, invoiceDate:"2025-08-01", invoiceNo:"RJ99436352", contractAmt:9200000, progress:"", case:'YT-UPY-2025-001', caseName:'上洋嘉義', invoiceLink:'', status:'collected', note:'來源：2025應收帳款' },
  { id:2103, collectDate:"2025-08-15", buyer:"上洋產業股份有限公司", item:"油漆工程", collectAmt:7190, bank:"國泰", invoiceAmt:7200, invoiceDate:"2025-08-06", invoiceNo:"RJ99436354", contractAmt:10364351, progress:"", case:'YT-UPY-2025-001', caseName:'上洋嘉義', invoiceLink:'', status:'collected', note:'來源：2025應收帳款' },
  { id:2104, collectDate:"2025-10-15", buyer:"上洋產業股份有限公司", item:"裝潢工程", collectAmt:1634341, bank:"國泰", invoiceAmt:1634351, invoiceDate:"2025-09-30", invoiceNo:"TK21949768", contractAmt:10364351, progress:"", case:'YT-UPY-2025-001', caseName:'上洋嘉義', invoiceLink:'', status:'collected', note:'來源：2025應收帳款' },
];

const CODEX_SEED_UPY_JIAYI_EXPENSES = [
  { id:2105, person:'shower', personName:'李鎮宇', month:'2025-02', caseKey:'YT-UPY-2025-001', caseName:'上洋嘉義', date:'2025-02-01', item:'月份嘉義費用申請（彙總）', amount:90, category:'其他', receipt:'無', status:'approved', note:'來源：2025上洋成本控制表' },
  { id:2106, person:'shower', personName:'李鎮宇', month:'2025-03', caseKey:'YT-UPY-2025-001', caseName:'上洋嘉義', date:'2025-03-01', item:'月份嘉義費用申請（彙總）', amount:2100, category:'其他', receipt:'無', status:'approved', note:'來源：2025上洋成本控制表' },
];

const CODEX_SEED_EXPENSES = [
  [229,'shower','李鎮宇','2026-01',2165,'停車'], [230,'shower','李鎮宇','2026-01',7280,'加油'],
  [231,'shower','李鎮宇','2026-01',2365,'辦公用品'], [232,'shower','李鎮宇','2026-01',4370,'餐費'],
  [233,'shower','李鎮宇','2026-02',920,'停車'], [234,'shower','李鎮宇','2026-02',4649,'加油'],
  [235,'shower','李鎮宇','2026-02',3368,'辦公用品'], [236,'shower','李鎮宇','2026-02',2790,'餐費'],
  [237,'shower','李鎮宇','2026-03',1450,'交通費'], [238,'shower','李鎮宇','2026-03',660,'交際費'],
  [239,'shower','李鎮宇','2026-03',2700,'停車'], [240,'shower','李鎮宇','2026-03',6725,'加油'],
  [241,'shower','李鎮宇','2026-03',1040,'工程'], [242,'shower','李鎮宇','2026-04',35799,'辦公用品'],
  [243,'nc','鄭詩褣','2026-01',397,'其他'], [244,'nc','鄭詩褣','2026-01',204,'水電瓦斯'],
  [245,'nc','鄭詩褣','2026-01',243,'郵資'], [246,'sun','孫一宣','2026-01',1580,'辦公用品'],
  [247,'sun','孫一宣','2026-01',327,'郵資'], [248,'sun','孫一宣','2026-04',28,'郵資'],
  [249,'lien','連星羽','2026-01',200,'停車'], [250,'lien','連星羽','2026-01',6942,'加油'],
  [251,'lien','連星羽','2026-01',5880,'工程'], [252,'lien','連星羽','2026-01',1939,'餐費'],
  [253,'shower','李鎮宇','2025-12',124481,'歷史費用'],
  [254,'shower','李鎮宇','2026-03',24452,'歷史費用'],
].map(([id, person, personName, month, amount, category]) => ({
  id, person, personName, month,
  caseKey:id === 254 ? 'YT-SUZ-2025-001' : 'YT-UPY-2025-002',
  caseName:id === 254 ? '木柵 Suzuki' : '上洋鶯歌',
  date:month+'-01',
  item:id === 254 ? '成本控制表：當案費用2026（彙總）' :
       id === 253 ? '成本控制表：宇德費用2025（彙總）' : '月度費用申請（匯總）',
  amount, category, receipt:'無', status:'approved',
  note:id === 254 ? 'Codex匯入：木柵suzuki連動0326ok；總額24,452' :
       id === 253 ? 'Codex匯入：成本控制表宇德費用2025' : 'Codex匯入：2026費用統計 Jan-Apr'
}));
const CODEX_SEED_PROJECT_ADJUSTMENTS = [
  [257,'YT-KYG-2025-001','凱揚濱江','2026-03',3565,'歷史費用','成本控制表：當案費用2026（彙總）','Codex匯入：凱揚濱江連動0326ok；總額3,565'],
  [259,'YT-WWF-2025-001','文威豐','2026-03',14276,'歷史費用','成本控制表：當案費用2026（彙總）','Codex匯入：文威豐連動0326ok；總額14,276'],
  [2333,'YT-ZHG-2025-001','板橋張總15F','2026-05',21241,'歷史費用','成本控制表：當案費用2026（彙總）','Codex匯入：板橋張總15F連動成本控制表；總額21,241'],
  [2436,'YT-LIN-2026-001','板橋林協理10F','2026-03',865,'歷史費用','成本控制表：當案費用2026-03（彙總）','Codex匯入：五份原始費用表；3月865'],
  [2437,'YT-LIN-2026-001','板橋林協理10F','2026-04',20680,'歷史費用','成本控制表：當案費用2026-04（彙總）','Codex匯入：五份原始費用表；4月20,680'],
  [2438,'YT-LIN-2026-001','板橋林協理10F','2026-05',8101,'歷史費用','成本控制表：當案費用2026-05（彙總）','Codex匯入：五份原始費用表；5月8,101'],
  [2439,'YT-LIN-2026-001','板橋林協理10F','2026-06',5120,'歷史費用','成本控制表：當案費用2026-06（彙總）','Codex匯入：李鎮宇費用表；6/5丹麥杯盤組5,120；費用統計表尚未納入'],
  [2520,'YT-ATG-2026-001','板橋安庭E2-15F','2026-03',489,'歷史費用','成本控制表：當案費用2026-03（彙總）','Codex匯入：五份原始費用表；3月489'],
  [2521,'YT-ATG-2026-001','板橋安庭E2-15F','2026-04',2857,'歷史費用','成本控制表：當案費用2026-04（彙總）','Codex匯入：五份原始費用表；4月2,857'],
  [2522,'YT-ATG-2026-001','板橋安庭E2-15F','2026-05',3843,'歷史費用','成本控制表：當案費用2026-05（彙總）','Codex匯入：五份原始費用表；5月3,843'],
  [2610,'YT-UNI-2026-001','UNI MUSIC 音樂教室','2026-04',40,'歷史費用','成本控制表：當案費用2026-04（彙總）','Codex匯入：連星羽原始費用表；4月40'],
  [2611,'YT-UNI-2026-001','UNI MUSIC 音樂教室','2026-05',2660,'歷史費用','成本控制表：當案費用2026-05（彙總）','Codex匯入：連星羽原始費用表；5月2,660'],
  [2740,'YT-UPY-2026-001','上洋高雄','2026-01',97111,'歷史費用','成本控制表：當案費用2026-01（彙總）','Codex匯入：五份原始費用表；1月97,111'],
  [2741,'YT-UPY-2026-001','上洋高雄','2026-02',12892,'歷史費用','成本控制表：當案費用2026-02（彙總）','Codex匯入：五份原始費用表；2月12,892'],
  [2742,'YT-UPY-2026-001','上洋高雄','2026-03',47107,'歷史費用','成本控制表：當案費用2026-03（彙總）','Codex匯入：五份原始費用表；3月47,107'],
  [2743,'YT-UPY-2026-001','上洋高雄','2026-04',56317,'歷史費用','成本控制表：當案費用2026-04（彙總）','Codex匯入：五份原始費用表；4月56,317，費用統計表少16'],
  [2744,'YT-UPY-2026-001','上洋高雄','2026-05',42167,'歷史費用','成本控制表：當案費用2026-05（彙總）','Codex匯入：五份原始費用表；5月42,167'],
  [2745,'YT-UPY-2026-001','上洋高雄','2026-06',11907,'歷史費用','成本控制表：當案費用2026-06（彙總）','Codex匯入：彭俞豪原始費用表；6月11,907，成本控制表尚未納入'],
].map(([id, caseKey, caseName, month, amount, category, item, note]) => ({
  id, person:'shower', personName:'李鎮宇', month, caseKey, caseName,
  date:month+'-01', item, amount, category, receipt:'無', status:'approved', note
}));

const CODEX_SEED_COMPANY_ALLOCATIONS = [
  { id:1, caseKey:'YT-VOL-2025-001', caseName:'林口三井', amount:56642, settlementDate:'2026-05-19', source:'2025-2026年分潤表' },
  { id:2, caseKey:'YT-UPY-2025-002', caseName:'上洋鶯歌', amount:1293809, settlementDate:'2026-05-19', source:'2025-2026年分潤表' },
  { id:3, caseKey:'YT-SUZ-2025-001', caseName:'木柵 Suzuki', amount:261881, settlementDate:'2026-05-19', source:'2025-2026年分潤表' },
  { id:4, caseKey:'YT-SUZ-2025-002', caseName:'民族 Suzuki 服務廠', amount:23209, settlementDate:'2026-05-19', source:'2025-2026年分潤表' },
  { id:5, caseKey:'YT-KYG-2025-001', caseName:'凱揚濱江', amount:193825, settlementDate:'2026-05-19', source:'2025-2026年分潤表' },
  { id:6, caseKey:'YT-WWF-2025-001', caseName:'文威豐', amount:209436, settlementDate:'2026-05-19', source:'2025-2026年分潤表' },
];
let COMPANY_ALLOCATIONS = [];
let TAX_LIABILITIES = [];

// 舊版曾匯入 2025/10–2026/4 月總額，與後續匯入的開銷細項重複，已停用。
const REMOVED_CODEX_OVERHEAD_MONTHS = ['2025-10','2025-11','2025-12','2026-01','2026-02','2026-03','2026-04'];

// 分潤預領以應付帳款的實際付款紀錄為準，不混入薪資月份。
const CODEX_SEED_PROFIT_PAYABLES = [
  { sourceKey:'lien-profit-20260107', case:'', caseName:'', vendor:'連星羽', summary:'工程獎金／分潤預領', amount:400000, wantDate:'2026-01-07', transferDate:'2026-01-07', doneDate:'2026-01-07', ticket:'', bank:'', invoice:'無', receipt:'無', person:'李鎮宇', profitPerson:'lien', paymentType:'engineering_bonus', status:'paid', note:'來源：連星羽預付款記錄' },
  { sourceKey:'lien-profit-20260210', case:'', caseName:'', vendor:'連星羽', summary:'工程獎金／分潤預領', amount:500000, wantDate:'2026-02-10', transferDate:'2026-02-10', doneDate:'2026-02-10', ticket:'', bank:'', invoice:'無', receipt:'無', person:'李鎮宇', profitPerson:'lien', paymentType:'engineering_bonus', status:'paid', note:'來源：連星羽預付款記錄' },
  { sourceKey:'lien-profit-20260316', case:'', caseName:'', vendor:'連星羽', summary:'工程獎金／分潤預領', amount:300000, wantDate:'2026-03-16', transferDate:'2026-03-16', doneDate:'2026-03-16', ticket:'', bank:'', invoice:'無', receipt:'無', person:'李鎮宇', profitPerson:'lien', paymentType:'engineering_bonus', status:'paid', note:'來源：連星羽預付款記錄' },
  { sourceKey:'lien-profit-20260421', case:'', caseName:'', vendor:'連星羽', summary:'工程獎金／分潤預領', amount:200000, wantDate:'2026-04-21', transferDate:'2026-04-21', doneDate:'2026-04-21', ticket:'', bank:'', invoice:'無', receipt:'無', person:'李鎮宇', profitPerson:'lien', paymentType:'engineering_bonus', status:'paid', note:'來源：連星羽預付款記錄' },
  { sourceKey:'lien-profit-20260520', case:'', caseName:'', vendor:'連星羽', summary:'分潤尾款結清', amount:7634, wantDate:'2026-05-20', transferDate:'2026-05-20', doneDate:'2026-05-20', ticket:'', bank:'', invoice:'無', receipt:'無', person:'李鎮宇', profitPerson:'lien', paymentType:'profit_settlement', status:'paid', note:'2026-05-20 依家裡正確版公司開銷校正結清；尾款 7,634' },
];
const CODEX_202605_PROFIT_CASES = ['YT-VOL-2025-001','YT-UPY-2025-002','YT-SUZ-2025-001','YT-SUZ-2025-002','YT-KYG-2025-001','YT-WWF-2025-001'];
CODEX_SEED_PROFIT_PAYABLES.forEach(r => { r.profitCaseCodes = CODEX_202605_PROFIT_CASES.slice(); });

// 上洋嘉義於 2025/9 完成歷史結算，舊分潤表 2025/10/15 已全數付清。
const CODEX_UPY_JIAYI_SETTLEMENT_ID = 20250930;
const CODEX_SEED_UPY_JIAYI_PROFIT_PAYABLES = [
  { id:2201, sourceKey:'upy-jiayi-profit-paid-shower', settlementId:CODEX_UPY_JIAYI_SETTLEMENT_ID, systemLocked:true, case:'YT-UPY-2025-001', caseName:'上洋嘉義', vendor:'李鎮宇', summary:'上洋嘉義分潤結清', amount:1270801, wantDate:'2025-10-15', transferDate:'2025-10-15', doneDate:'2025-10-15', ticket:'', bank:'', invoice:'無', receipt:'無', person:'李鎮宇', profitPerson:'shower', paymentType:'profit_settlement', profitCaseCodes:['YT-UPY-2025-001'], status:'paid', psSettled:true, note:'2025-09-30 歷史結算；依舊分潤表 2025-10-15 已付清' },
  { id:2202, sourceKey:'upy-jiayi-profit-paid-peng', settlementId:CODEX_UPY_JIAYI_SETTLEMENT_ID, systemLocked:true, case:'YT-UPY-2025-001', caseName:'上洋嘉義', vendor:'彭俞豪', summary:'上洋嘉義分潤結清', amount:577637, wantDate:'2025-10-15', transferDate:'2025-10-15', doneDate:'2025-10-15', ticket:'', bank:'', invoice:'無', receipt:'無', person:'李鎮宇', profitPerson:'peng', paymentType:'profit_settlement', profitCaseCodes:['YT-UPY-2025-001'], status:'paid', psSettled:true, note:'2025-09-30 歷史結算；依舊分潤表 2025-10-15 已付清' },
  { id:2203, sourceKey:'upy-jiayi-profit-paid-lien', settlementId:CODEX_UPY_JIAYI_SETTLEMENT_ID, systemLocked:true, case:'YT-UPY-2025-001', caseName:'上洋嘉義', vendor:'連星羽', summary:'上洋嘉義分潤結清', amount:462109, wantDate:'2025-10-15', transferDate:'2025-10-15', doneDate:'2025-10-15', ticket:'', bank:'', invoice:'無', receipt:'無', person:'李鎮宇', profitPerson:'lien', paymentType:'profit_settlement', profitCaseCodes:['YT-UPY-2025-001'], status:'paid', psSettled:true, note:'2025-09-30 歷史結算；依舊分潤表 2025-10-15 已付清' },
];
const CODEX_SEED_UPY_JIAYI_SETTLEMENT = {
  id:CODEX_UPY_JIAYI_SETTLEMENT_ID, date:'2025-09-30', historical:true,
  cases:[{ code:'YT-UPY-2025-001', name:'上洋嘉義', gross:3309011, ohRatio:0, ohShare:-587521, preTaxNet:2721490, taxReserve:-410943, caseNet:2310547, invoiceTotal:9921551 }],
  ohMonths:[{ month:'上洋嘉義歷史分攤', fixed:0, variable:587521, payroll:0, total:587521, historicalCaseCode:'YT-UPY-2025-001', postCloseOnly:true, postCloseVariableIds:[] }],
  overheadTotal:587521, grandGross:3309011, grandPreTaxNet:2721490, grandNet:2310547, grandTax:-410943,
  persons:[
    { person:'shower', name:'李鎮宇', net:1270801, salary:0, bonus:1270801, adjustment:0, unpaid:0 },
    { person:'peng', name:'彭俞豪', net:577637, salary:0, bonus:577637, adjustment:0, unpaid:0 },
    { person:'lien', name:'連星羽', net:462109, salary:0, bonus:462109, adjustment:0, unpaid:0 },
  ],
  postCloseAdjustmentApplications:[], advancePayableIds:[], generatedPayableIds:[2201,2202,2203], claimMonths:'2025-02 ～ 2025-09', taxRate:null,
  note:'2025-09-30 作為歷史結算節點；舊分潤表 2025-10-15 已全數付清'
};

// 2026/1~4 公司開銷細項（來源：2026公司開銷 Google Sheet）
// 舊資料順序對應 OH_LEGACY_FIXED_ITEMS：房租,水電,瓦斯,勞保,健保,勞退,員工薪資(由薪資模組自動帶入,此處填0),
// 衛星犬資料處理,飲水機保養費,google訂閱費,市話,公務機話費,網路費,會計師記帳費,外聘清潔費,員工福利公司飲料,貨車保養維修,文具影印機紙張墨水
const CODEX_SEED_OH_DETAIL = [
  { month:'2025-10',
    fixed: [30000,1500,200,21296,16625,7768,0,300,133,2156,392,397,1599,15000,3400,2000,2000,500],
    fixedNotes: {4:'2025/12/15', 5:'2026/01/02'},
    extraVariable: [] },
  { month:'2025-11',
    fixed: [30000,1500,200,21296,16625,8712,0,300,133,2593,1996,397,1599,15000,1700,2000,2000,500],
    fixedNotes: {3:'2026/01/02', 4:'2026/01/15', 5:'2026/02/03'},
    extraVariable: [] },
  { month:'2025-12',
    fixed: [30000,1500,200,21296,16625,8712,0,300,133,2593,1974,397,1599,15000,1700,2000,2000,500],
    fixedNotes: {3:'扣款日2026/02/03', 4:'扣款日2026/02/23', 5:'扣款日2026/03/03'},
    extraVariable: [] },
  { month:'2026-01',
    fixed: [30000,1500,204,21296,16919,8712,0,300,1500,2593,1979,397,1599,15000,1700,2000,2000,500],
    fixedNotes: {4:'0115/03/15'},
    extraVariable: [] },
  { month:'2026-02',
    fixed: [30000,1500,220,21296,16919,8712,0,300,1500,2593,1599,397,1599,15000,1700,2000,2000,500],
    fixedNotes: {4:'0115/04/15'},
    extraVariable: [{ name:'市話月租', amount:373, note:'2026公司開銷' }] },
  { month:'2026-03',
    fixed: [30000,1500,220,21296,16919,8712,0,0,1500,2650,378,397,1599,15000,1700,2348,2000,500],
    fixedNotes: {4:'0115/05/15', 12:'0115/04/28'},
    extraVariable: [
      { name:'公司濾心', amount:800, note:'2026公司開銷' },
      { name:'公司開銷校正', amount:410, note:'家裡正確版：補足連星羽82元分潤差額' }
    ] },
  { month:'2026-04',
    fixed: [30000,1500,0,21296,128681,8712,0,0,1500,2696,372,397,1599,15000,2300,2000,2000,500],
    fixedNotes: {3:'0115/04/01', 4:'0115/06/15', 5:'0115/04/01'},
    extraVariable: [{ name:'貨車稅金', amount:2700, note:'2026公司開銷' }] },
];

function ensureCodexSeedData() {
  const clone = v => JSON.parse(JSON.stringify(v));
  const maxId = arr => Math.max(0, ...arr.map(x => Number(x.id) || 0));
  const near = (a, b) => Math.abs(Number(a) - Number(b)) < 0.000001;
  const addByKey = (arr, rows, keyFn) => {
    const existing = new Set(arr.map(keyFn));
    rows.forEach(seed => {
      if (sourceKeyWasDeleted(seed.sourceKey)) return;
      const key = keyFn(seed);
      if (existing.has(key)) return;
      const row = clone(seed);
      if (row.id && arr.some(x => x.id === row.id)) row.id = maxId(arr) + 1;
      arr.push(row);
      existing.add(keyFn(row));
    });
  };
  EMPLOYEES.forEach(e => {
    if (typeof e.profitEligible !== 'boolean') e.profitEligible = ['peng','lien'].includes(e.id);
    if (['nc','peng','lien','sun'].includes(e.id)) e.attendanceRequired = false;
    else if (typeof e.attendanceRequired !== 'boolean') e.attendanceRequired = true;
    if (!e.accessRole) e.accessRole = defaultEmployeeAccessRole(e);
  });
  addByKey(EMPLOYEES, CODEX_REQUIRED_EMPLOYEES, r => r.id);
  CODEX_REQUIRED_EMPLOYEES.forEach(seed => {
    const row = EMPLOYEES.find(e => e.id === seed.id);
    if (!row) return;
    ['name','role','email','accessRole','attendanceRequired','startDate','status','endDate','endReason','note'].forEach(field => {
      if (row[field] === undefined || row[field] === null || row[field] === '') row[field] = seed[field];
    });
  });
  ATTENDANCE_SETTINGS.defaultOfficeLat = OFFICE_LOCATION_DEFAULT.lat;
  ATTENDANCE_SETTINGS.defaultOfficeLng = OFFICE_LOCATION_DEFAULT.lng;
  if (
    near(ATTENDANCE_SETTINGS.officeLat, OFFICE_LOCATION_OLD_DEFAULT.lat) &&
    near(ATTENDANCE_SETTINGS.officeLng, OFFICE_LOCATION_OLD_DEFAULT.lng)
  ) {
    ATTENDANCE_SETTINGS.officeLat = OFFICE_LOCATION_DEFAULT.lat;
    ATTENDANCE_SETTINGS.officeLng = OFFICE_LOCATION_DEFAULT.lng;
  }
  addByKey(CASES, CODEX_SEED_CASES, r => r.code);
  CASES.forEach(row => {
    // 舊版匯入時曾把「完工」誤標為「結案」；分潤尚未鎖定前統一還原為完工。
    if (row.status === '結案' && !row.psSettled && row.profitSplit !== '不分潤' && !row.excludeFromProfitReports) row.status = '完工';
    if (row.profitSplit === '李彭') {
      row.profitSplit = '自訂';
      row.splitRatio = row.splitRatio || { shower:0.8, peng:0.2 };
    } else if (row.profitSplit === '李連') {
      row.profitSplit = '自訂';
      row.splitRatio = row.splitRatio || { shower:0.8, lien:0.2 };
    }
  });
  {
    const vol = CASES.find(c => c.code === 'YT-VOL-2025-001');
    if (vol && vol.profitSplit === undefined) vol.profitSplit = '三人';
    const jiayi = CASES.find(c => c.code === 'YT-UPY-2025-001');
    if (jiayi) Object.assign(jiayi, {
      status:'結案', psSettled:true, closedDate:'2025-09-30', collected:9921486,
      profitSplit:'自訂', splitRatio:{shower:0.55,peng:0.25,lien:0.20},
      revenueOverride:9951486, vendorCostOverride:6135110, taxCostOverride:236942,
      grossOverride:3309011, fixedOverheadShare:587521, taxReserveOverride:410943,
      reconciliationNote:'依2025上洋成本控制表與2025-2026分潤表核對：總售價9,951,486／廠商成本6,135,110／當案費用270,423／稅務成本（營業稅×0.5）236,942／毛利3,309,011／公司開銷587,521／預留營業所得稅410,943／2025-09-30歷史結算／2025-10-15分潤付清'
    });
  }
  CODEX_SEED_CASES.forEach(seed => {
    const row = CASES.find(c => c.code === seed.code);
    if (row) Object.assign(row, { retentionAmt: seed.retentionAmt, retentionDue: seed.retentionDue });
    if (row && row.profitSplit === undefined && seed.profitSplit) row.profitSplit = seed.profitSplit;
    if (row && ['YT-SUZ-2025-001','YT-SUZ-2025-002','YT-KYG-2025-001','YT-WWF-2025-001','YT-ZHG-2025-001','YT-LIN-2026-001','YT-ATG-2026-001','YT-UNI-2026-001','YT-UPY-2026-001'].includes(seed.code)) Object.assign(row, {
      name:seed.name, client:seed.client, clientName:seed.clientName, status:seed.status,
      amount:seed.amount, collected:seed.collected, person:seed.person, closedDate:seed.closedDate,
      profitSplit:seed.profitSplit, taxCostOverride:seed.taxCostOverride, caseType:seed.caseType,
      billingMode:seed.billingMode, invoiceMode:seed.invoiceMode, excludeFromProfitReports:seed.excludeFromProfitReports,
      revenueOverride:seed.revenueOverride, vendorCostOverride:seed.vendorCostOverride, grossOverride:seed.grossOverride,
      reconciliationNote:seed.reconciliationNote
    });
  });
  const canonicalCaseNames = new Map(CODEX_SEED_CASES.map(seed => [seed.code, seed.name]));
  // 舊版曾將分潤表的公司分攤誤存為費用；移除並改由獨立模組保存。
  for (let i = EXPENSES.length - 1; i >= 0; i--) {
    const row = EXPENSES[i];
    if (row.category === '公司分攤' && String(row.note || '').includes('2025-2026分潤表')) EXPENSES.splice(i, 1);
  }
  EXPENSES.forEach(row => {
    if (canonicalCaseNames.has(row.caseKey)) row.caseName = canonicalCaseNames.get(row.caseKey);
    if (String(row.note || '').includes('成本控制表宇德費用2025')) {
      row.category = '歷史費用';
      row.item = '成本控制表：宇德費用2025（彙總）';
    }
  });
  const jiayiSepPostage = EXPENSES.find(r => r.id === 222 && r.caseKey === 'YT-UPY-2025-001');
  if (jiayiSepPostage) jiayiSepPostage.amount = 60;
  const jiayiAugPostage = EXPENSES.find(r => r.id === 223 && r.caseKey === 'YT-UPY-2025-001');
  if (jiayiAugPostage) jiayiAugPostage.amount = 44;
  addByKey(RECEIVABLES, CODEX_SEED_RECEIVABLES, r => [r.case,r.collectDate,r.invoiceNo,r.collectAmt].join('|'));
  addByKey(RECEIVABLES, CODEX_SEED_UPY_JIAYI_RECEIVABLES, r => [r.case,r.collectDate,r.invoiceNo,r.collectAmt].join('|'));
  addByKey(RECEIVABLES, CODEX_SEED_HULIN_RECEIVABLES, r => r.sourceKey || [r.case,r.item,r.collectAmt].join('|'));
  CODEX_SEED_RECEIVABLES.forEach(seed => {
    const row = RECEIVABLES.find(r => r.case === seed.case && r.item === seed.item && r.invoiceAmt === seed.invoiceAmt);
    if (row && row.status !== 'collected') Object.assign(row, clone(seed), { id: row.id });
  });
  CODEX_SEED_HULIN_RECEIVABLES.forEach(seed => {
    const row = RECEIVABLES.find(r => r.sourceKey === seed.sourceKey || (r.case === seed.case && r.item === seed.item));
    if (row) Object.assign(row, clone(seed), { id: row.id });
  });
  addByKey(PAYABLES, CODEX_SEED_PAYABLES, r => [r.case,r.vendor,r.summary,r.amount,r.wantDate].join('|'));
  addByKey(PAYABLES, CODEX_SEED_ZHANG_PAYABLES, r => r.sourceKey);
  addByKey(PAYABLES, CODEX_SEED_LIN_PAYABLES, r => r.sourceKey);
  addByKey(PAYABLES, CODEX_SEED_ANTING_PAYABLES, r => r.sourceKey);
  addByKey(PAYABLES, CODEX_SEED_UNI_PAYABLES, r => r.sourceKey);
  addByKey(PAYABLES, CODEX_SEED_UPY_KAOHSIUNG_PAYABLES, r => r.sourceKey);
  addByKey(PAYABLES, CODEX_SEED_UPY_KAOHSIUNG_MISC_PAYABLES, r => r.sourceKey);
  addByKey(PAYABLES, CODEX_SEED_UPY_JIAYI_PAYABLES, r => r.sourceKey);
  addByKey(PAYABLES, CODEX_SEED_YUCHENG_PAYABLES, r => r.sourceKey);
  addByKey(PAYABLES, CODEX_SEED_HULIN_PAYABLES, r => r.sourceKey);
  addByKey(PAYABLES, CODEX_SEED_PRIVATE_LOAN_PAYABLES, r => r.sourceKey);
  addByKey(PAYABLES, CODEX_SEED_MUZHA_PAYABLES, r => [r.case,r.vendor,r.summary,r.amount,r.wantDate].join('|'));
  addByKey(PAYABLES, CODEX_SEED_MINZU_PAYABLES, r => [r.case,r.vendor,r.summary,r.amount,r.wantDate].join('|'));
  addByKey(PAYABLES, CODEX_SEED_KAIYANG_PAYABLES, r => [r.case,r.vendor,r.summary,r.amount,r.wantDate].join('|'));
  addByKey(PAYABLES, CODEX_SEED_WENWEIFENG_PAYABLES, r => [r.case,r.vendor,r.summary,r.amount,r.wantDate].join('|'));
  ['YT-SUZ-2025-001','YT-SUZ-2025-002','YT-KYG-2025-001','YT-WWF-2025-001'].forEach(normalizeCasePayableDuplicates);
  addByKey(PAYABLES, CODEX_SEED_PROFIT_PAYABLES, r => r.sourceKey || [r.paymentType,r.profitPerson,r.amount,r.doneDate||r.transferDate||r.wantDate].join('|'));
  addByKey(PAYABLES, CODEX_SEED_UPY_JIAYI_PROFIT_PAYABLES, r => r.sourceKey);
  syncSeededPayablesPreserveManualRows([...CODEX_SEED_YUCHENG_PAYABLES, ...CODEX_SEED_HULIN_PAYABLES]);
  CODEX_SEED_PROFIT_PAYABLES.forEach(seed => {
    const row = PAYABLES.find(r => r.sourceKey === seed.sourceKey);
    if (row) Object.assign(row, clone(seed), { id: row.id });
  });
  CODEX_SEED_UPY_JIAYI_PROFIT_PAYABLES.forEach(seed => {
    const row = PAYABLES.find(r => r.sourceKey === seed.sourceKey);
    if (row) Object.assign(row, clone(seed), { id:seed.id });
  });
  addByKey(PROFIT_SETTLEMENTS, [CODEX_SEED_UPY_JIAYI_SETTLEMENT], r => r.id);
  PAYABLES.filter(r => r.sourceKey && !r.id).forEach(r => { r.id = maxId(PAYABLES) + 1; });
  rvNextId = Math.max(rvNextId || 1, maxId(RECEIVABLES) + 1);
  normalizeOrdinaryProjectAccounting();
  PAYABLES.filter(r => r.paymentType === 'private_loan').forEach(syncDerivedReceivableForPayable);
  addByKey(EXPENSES, CODEX_SEED_EXPENSES, r => [r.caseKey,r.person,r.month,r.category,r.amount,r.note].join('|'));
  addByKey(EXPENSES, CODEX_SEED_UPY_JIAYI_EXPENSES, r => [r.caseKey,r.person,r.month,r.category,r.amount,r.note].join('|'));
  addByKey(EXPENSES, CODEX_SEED_PROJECT_ADJUSTMENTS, r => [r.caseKey,r.person,r.month,r.category,r.amount,r.note].join('|'));
  removeReplacedExpenseAggregates();
  addByKey(COMPANY_ALLOCATIONS, CODEX_SEED_COMPANY_ALLOCATIONS, r => r.caseKey);
  addByKey(TAX_LIABILITIES, CODEX_SEED_TAX_LIABILITIES, r => r.sourceKey);
  // 每次載入都執行，清除各台電腦 localStorage 中可能殘留的重複月總額。
  REMOVED_CODEX_OVERHEAD_MONTHS.forEach(month => {
    const data = OVERHEAD[month];
    if (!data) return;
    data.variable = (data.variable || []).filter(v =>
      v.name !== '公司開銷（Codex匯入月總額）' && v.note !== '2025-2026分潤表'
    );
    data.monthTotalImported = true;
    data.duplicateMonthTotalRemoved = true;
  });
  // 2026/1~4 公司開銷細項匯入（來源：2026公司開銷 Google Sheet，員工薪資由薪資模組自動帶入）
  CODEX_SEED_OH_DETAIL.forEach(({month, fixed, fixedNotes, extraVariable}) => {
    if (!OVERHEAD[month]) OVERHEAD[month] = { fixed: OH_FIXED_CONFIG.map(()=>0), fixedNotes: OH_FIXED_CONFIG.map(()=>''), variable:[] };
    const data = OVERHEAD[month];
    if (data.ohDetailImported) return;
    data.fixed = OH_FIXED_CONFIG.map(name => {
      if (name === '水費') return 0;
      if (name === '電費') return month >= OH_WATER_ELECTRIC_SPLIT_MONTH ? (fixed[OH_LEGACY_FIXED_ITEMS.indexOf('水電')] || 0) : 0;
      if (name === '水電' && month >= OH_WATER_ELECTRIC_SPLIT_MONTH) return 0;
      return fixed[OH_LEGACY_FIXED_ITEMS.indexOf(name)] || 0;
    });
    data.fixedNotes = OH_FIXED_CONFIG.map(name => {
      if (name === '水費') return '';
      if (name === '電費') return month >= OH_WATER_ELECTRIC_SPLIT_MONTH ? (fixedNotes[OH_LEGACY_FIXED_ITEMS.indexOf('水電')] || '') : '';
      if (name === '水電' && month >= OH_WATER_ELECTRIC_SPLIT_MONTH) return '';
      return fixedNotes[OH_LEGACY_FIXED_ITEMS.indexOf(name)] || '';
    });
    data.variable = data.variable.filter(v => v.note !== '2025-2026分潤表');
    extraVariable.forEach(v => data.variable.push({ id: ohVarNextId++, ...v }));
    data.ohDetailImported = true;
  });
  if (!OVERHEAD['2026-05']) {
    OVERHEAD['2026-05'] = { fixed: OH_FIXED_CONFIG.map(()=>0), fixedNotes: OH_FIXED_CONFIG.map(()=>''), variable:[], note:'Codex 2026-05 薪資歸屬月份' };
  }
  pyRebuildRentOverhead();
  pyNextId = Math.max(pyNextId || 1, maxId(PAYABLES) + 1);
  rvNextId = Math.max(rvNextId || 1, maxId(RECEIVABLES) + 1);
  if (typeof expNextId !== 'undefined') expNextId = Math.max(expNextId || 1, maxId(EXPENSES) + 1);
  CODEX_SEED_PAYROLL.forEach(seed => {
    if (PAYROLL_DELETED_MONTHS.includes(seed.month)) return;
    const row = PAYROLL.find(r => r.person === seed.person && r.month === seed.month);
    if (!row) {
      PAYROLL.push({ id: prNextId++, ...seed });
    }
  });
  CODEX_SEED_PAYROLL
    .filter(seed => seed.month === '2026-05' && ['nc','sun'].includes(seed.person))
    .forEach(seed => {
      const row = PAYROLL.find(r => r.person === seed.person && r.month === seed.month);
      if (row) Object.assign(row, clone(seed), { id: row.id });
    });

  PAYROLL.forEach(r => {
    // 舊版曾把連星羽分潤預領塞入薪資；改由應付帳款產生分潤領款子帳。
    if (r._engBonusSeeded) { r.engineeringBonus = 0; delete r._engBonusSeeded; }
    if (typeof r.engineeringBonus !== 'number') r.engineeringBonus = 0;
    if (!Array.isArray(r.customItems)) r.customItems = [];
  });
  ohVarNextId = Math.max(ohVarNextId || 1, 1 + Math.max(0, ...Object.values(OVERHEAD).flatMap(data => (data.variable || []).map(v => Number(v.id) || 0))));
  EXPENSES.forEach(expFinalizePostClose);
  normalizeProfitPayables();
  normalizeOrdinaryProjectAccounting();
  normalizeSpecialCaseClients();
  removeReplacedExpenseAggregates();
}

function syncPayrollEmployeeAccountsFromConfig() {
  EMPLOYEES.forEach(emp => {
    const hasEmployeeContract = ['payrollBank','payrollBranch','payrollAccountName','payrollAccount']
      .some(field => Object.prototype.hasOwnProperty.call(emp, field));
    const legacy = PAYROLL_EMPLOYEE_ACCOUNTS[emp.id] || {};
    const cfg = PR_CONFIG[emp.id] || {};
    if (!hasEmployeeContract) {
      emp.payrollBank = String(legacy.bank || cfg.bank || '').trim();
      emp.payrollBranch = '';
      emp.payrollAccountName = emp.name || '';
      emp.payrollAccount = String(legacy.account || cfg.account || '').trim();
    } else {
      emp.payrollBank = String(emp.payrollBank || '').trim();
      emp.payrollBranch = String(emp.payrollBranch || '').trim();
      emp.payrollAccountName = String(emp.payrollAccountName || '').trim();
      emp.payrollAccount = String(emp.payrollAccount || '').trim();
    }
    PAYROLL_EMPLOYEE_ACCOUNTS[emp.id] = {
      bank: emp.payrollBank,
      account: emp.payrollAccount
    };
  });
}

function createDataSnapshot() {
  normalizeCompanyData();
  syncPayrollEmployeeAccountsFromConfig();
  return {
    format:'yutesign-ops-backup', formatVersion:1, appVersion:'1.3.37', companyId:COMPANY_ID,
    CASES, PAYABLES, RECEIVABLES, EXPENSES, COMPANY_ALLOCATIONS, TAX_LIABILITIES, TEST_FEEDBACK, ATTENDANCE_RECORDS, ATTENDANCE_LEAVES, ATTENDANCE_SETTINGS, OVERHEAD, OH_FIXED_CONFIG: [...OH_FIXED_CONFIG], PAYROLL, PAYROLL_MONTHS, PAYROLL_DELETED_MONTHS, PAYROLL_EMPLOYEE_ACCOUNTS, DELETED_SOURCE_KEYS, CLIENTS, VENDORS, EMPLOYEES,
    USER_PERMISSIONS: JSON.parse(JSON.stringify(USER_PERMISSIONS)),
    PROFIT_SETTLEMENTS, PS_TAX_RATE, AUDIT_LOGS,
    pyNextId, rvNextId, empNextId, tfNextId, attNextId, attLeaveNextId, auditNextId, expNextId: (typeof expNextId !== 'undefined' ? expNextId : 1),
    savedAt: new Date().toISOString()
  };
}

function auditClone(value) {
  if (value === undefined) return null;
  try { return JSON.parse(JSON.stringify(value)); }
  catch(e) { return { error:'clone_failed' }; }
}

function auditDiff(before, after, fields) {
  const prev = before && typeof before === 'object' ? before : {};
  const next = after && typeof after === 'object' ? after : {};
  const keys = fields || Array.from(new Set([...Object.keys(prev), ...Object.keys(next)]));
  return keys.filter(key => JSON.stringify(prev[key] ?? null) !== JSON.stringify(next[key] ?? null))
    .slice(0, 80)
    .map(key => ({ field:key, beforeValue:prev[key] ?? null, afterValue:next[key] ?? null }));
}

function auditSummary() {
  return {
    cases: CASES.length,
    payables: PAYABLES.length,
    receivables: RECEIVABLES.length,
    expenses: EXPENSES.length,
    employees: EMPLOYEES.length,
    payroll: PAYROLL.length,
    profitSettlements: PROFIT_SETTLEMENTS.length,
    taxLiabilities: TAX_LIABILITIES.length,
    auditLogs: AUDIT_LOGS.length
  };
}

function recordAuditLog(action, targetType, targetId, before, after, options = {}) {
  try {
    const actor = currentUser || {};
    const row = {
      id: auditNextId++,
      companyId: COMPANY_ID,
      at: new Date().toISOString(),
      actorUid: opsAuthenticatedUserId || actor.id || '',
      actorEmail: opsAuthenticatedEmail || actor.email || '',
      actorName: actor.name || '',
      actorRole: actor.roleCode || actor.role || '',
      action,
      targetType,
      targetId: String(targetId ?? ''),
      targetLabel: options.targetLabel || '',
      source: OPS_AUTH_ENFORCED ? 'ops-web' : 'ops-local',
      reason: options.reason || '',
      before: auditClone(before),
      after: auditClone(after),
      diff: options.diff || auditDiff(before, after, options.fields),
      riskLevel: options.riskLevel || 'medium',
      requestId: options.requestId || '',
      sessionId: opsAuthenticatedEmail || actor.id || '',
      clientInfo: { appVersion:'1.3.37', userAgent:navigator.userAgent },
      schemaVersion: 1
    };
    AUDIT_LOGS.unshift(row);
    if (AUDIT_LOGS.length > 1000) AUDIT_LOGS.length = 1000;
    return row;
  } catch(e) {
    console.warn('recordAuditLog failed:', e);
    return null;
  }
}

function setSaveIndicator(state) {
  const ind = document.getElementById('save-indicator');
  if (!ind) return;
  clearTimeout(ind._t);
  ind.style.display = 'inline';
  if (state === 'syncing') {
    ind.style.color = 'var(--text3)';
    ind.textContent = '💾 同步雲端中…';
  } else if (state === 'synced') {
    ind.style.color = 'var(--text3)';
    ind.textContent = '✅ 已同步雲端';
    ind._t = setTimeout(() => { ind.style.display = 'none'; }, 2000);
  } else if (state === 'error') {
    ind.style.color = '#c0392b';
    ind.textContent = '⚠️ 雲端同步失敗';
  } else {
    ind.style.color = 'var(--text3)';
    ind.textContent = '💾 已存檔';
    ind._t = setTimeout(() => { ind.style.display = 'none'; }, 2000);
  }
}

function saveData() {
  try {
    const snapshot = createDataSnapshot();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    updateDataStatus(snapshot);
    if (OPS_AUTH_ENFORCED) {
      opsCloudQueueSave(snapshot);
    } else {
      setSaveIndicator('local');
    }
  } catch(e) {
    console.warn('saveData failed:', e);
  }
}

window.addEventListener('beforeunload', (e) => {
  if (!opsCloudPendingSync) return;
  e.preventDefault();
  e.returnValue = '';
  return '';
});

function formatDateTimeTW(value) {
  if (!value) return '尚未存檔';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '時間格式異常';
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth()+1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function getLocalDataMeta() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return {
      savedAt: data.savedAt || '',
      appVersion: data.appVersion || '',
      cases: Array.isArray(data.CASES) ? data.CASES.length : 0,
      payables: Array.isArray(data.PAYABLES) ? data.PAYABLES.length : 0,
      receivables: Array.isArray(data.RECEIVABLES) ? data.RECEIVABLES.length : 0
    };
  } catch(e) {
    return { error:true };
  }
}

function opsSnapshotSummary(data) {
  if (!data || typeof data !== 'object') return '';
  const cases = Array.isArray(data.CASES) ? data.CASES.length : 0;
  const payables = Array.isArray(data.PAYABLES) ? data.PAYABLES.length : 0;
  const receivables = Array.isArray(data.RECEIVABLES) ? data.RECEIVABLES.length : 0;
  const attendance = Array.isArray(data.ATTENDANCE_RECORDS) ? data.ATTENDANCE_RECORDS.length : 0;
  return `${cases} 案｜應付 ${payables}｜應收 ${receivables}｜出勤 ${attendance}`;
}

function updateDataStatus(snapshot) {
  const savedEl = document.getElementById('ds-saved');
  const storageEl = document.getElementById('ds-storage');
  const syncEl = document.getElementById('ds-sync');
  const cloudEl = document.getElementById('ds-cloud');
  if (!savedEl && !storageEl && !syncEl && !cloudEl) return;
  const meta = snapshot ? {
    savedAt: snapshot.savedAt,
    appVersion: snapshot.appVersion,
    cases: snapshot.CASES?.length || 0,
    payables: snapshot.PAYABLES?.length || 0,
    receivables: snapshot.RECEIVABLES?.length || 0
  } : getLocalDataMeta();
  if (storageEl) {
    if (!OPS_AUTH_ENFORCED) storageEl.textContent = '本機瀏覽器';
    else storageEl.textContent = opsCloudReady ? '雲端同步＋本機快取' : '雲端同步初始化中';
  }
  if (syncEl) {
    if (!OPS_AUTH_ENFORCED) syncEl.textContent = '本機模式，未連線雲端';
    else if (opsCloudConflict) {
      syncEl.textContent = '偵測到雲端有較新資料，請先檢查雲端快照';
    }
    else if (opsCloudReady && opsCloudLastSavedAt) {
      const by = opsCloudLastSavedBy ? `｜${opsCloudLastSavedBy}` : '';
      syncEl.textContent = `雲端已同步：${formatDateTimeTW(opsCloudLastSavedAt)}${by}`;
    } else {
      syncEl.textContent = '已上雲端網址；等待資料庫同步';
    }
  }
  if (cloudEl) {
    if (!OPS_AUTH_ENFORCED) cloudEl.textContent = '本機模式不檢查';
    else if (opsCloudLastSummary) cloudEl.textContent = opsCloudLastSummary;
    else cloudEl.textContent = '尚未讀取 Firebase';
  }
  if (savedEl) {
    if (!meta) savedEl.textContent = '尚未存檔';
    else if (meta.error) savedEl.textContent = '資料讀取異常';
    else savedEl.textContent = `${formatDateTimeTW(meta.savedAt)}｜${meta.cases} 案`;
  }
}

function openTestGuide() {
  openModal('modal-test-guide');
}

function backupFileName(date = new Date()) {
  const pad = value => String(value).padStart(2,'0');
  return `Yutesign_OPS_backup_${date.getFullYear()}${pad(date.getMonth()+1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}.json`;
}

function downloadBackupSnapshot(snapshot, fileName = backupFileName()) {
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type:'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportBackup(options = {}) {
  if (!requireManage('dashboard', '只有完整管理者可以下載完整資料備份')) return false;
  try {
    const snapshot = createDataSnapshot();
    downloadBackupSnapshot(snapshot, options.fileName || backupFileName());
    if (!options.silent) showToast('資料備份已下載 ✓', 'success');
    return true;
  } catch(e) {
    console.warn('exportBackup failed:', e);
    if (!options.silent) showToast('備份下載失敗', 'error');
    return false;
  }
}

function openBackupImport() {
  if (!requireManage('dashboard', '只有完整管理者可以匯入資料備份')) return;
  const input = document.getElementById('backup-import-file');
  if (!input) return;
  input.value = '';
  input.click();
}

function openExpensePatchPaste() {
  if (!requireManage('dashboard', '只有完整管理者可以匯入費用補丁')) return;
  const input = document.getElementById('expense-patch-json');
  if (input) input.value = '';
  openModal('modal-expense-patch');
  setTimeout(() => document.getElementById('expense-patch-json')?.focus(), 80);
}

function submitExpensePatchPaste() {
  if (!requireManage('dashboard', '只有完整管理者可以匯入費用補丁')) return;
  const raw = document.getElementById('expense-patch-json')?.value || '';
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    if (data.format === OPS_AP_RECONCILIATION_PATCH_FORMAT) {
      const error = validateApReconciliationPatch(data);
      if (error) { showToast(error, 'error'); return; }
      const label = data.title || '應付帳款對帳補丁';
      const rowCount = data.payables.length;
      const rowTotal = data.payables.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
      if (!confirm(`確定匯入「${label}」？\n\n會依來源鍵新增應付、修正指定既有列，並重建連動公司開銷；不會覆蓋整份快照。\n新增候選：${rowCount} 筆\n日期修正：${data.updates.length} 筆\n候選合計：$${rowTotal.toLocaleString('zh-TW')}`)) return;
      applyApReconciliationPatch(data, 'pasted AP reconciliation patch');
      closeModal('modal-expense-patch');
      return;
    }
    const error = validateExpensePatch(data);
    if (error) { showToast(error, 'error'); return; }
    const label = data.title || '費用明細補丁';
    const rowCount = data.rows.length;
    const rowTotal = data.rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
    if (!confirm(`確定匯入「${label}」？\n\n此動作只會替換費用明細，不會覆蓋個案、應收、應付或測試回報。\n明細：${rowCount} 筆\n合計：$${rowTotal.toLocaleString('zh-TW')}`)) return;
    applyExpensePatch(data, 'pasted expense patch');
    closeModal('modal-expense-patch');
  } catch(e) {
    console.warn('submitExpensePatchPaste failed:', e);
    showToast('費用補丁 JSON 無法解析', 'error');
  }
}

function validateBackupSnapshot(data) {
  if (!data || typeof data !== 'object') return '檔案內容不是有效資料';
  if (data.format && data.format !== 'yutesign-ops-backup') return '不是宇德 OPS 備份檔';
  const requiredArrays = ['CASES','PAYABLES','RECEIVABLES','EXPENSES','CLIENTS','VENDORS','EMPLOYEES'];
  const missing = requiredArrays.filter(key => !Array.isArray(data[key]));
  if (missing.length) return `備份檔缺少必要資料：${missing.join('、')}`;
  if (!data.OVERHEAD || typeof data.OVERHEAD !== 'object' || Array.isArray(data.OVERHEAD)) return '備份檔缺少公司開銷資料';
  return '';
}

const OPS_EXPENSE_PATCH_FORMAT = 'yutesign-ops-expense-patch';
const OPS_AP_RECONCILIATION_PATCH_FORMAT = 'yutesign-ops-ap-reconciliation-patch';

function apPatchText(value) {
  return String(value || '').replace(/[\s　（）()／/·・,.，。－_-]/g, '').toLowerCase();
}

function apPatchDateSet(row) {
  return new Set([row.wantDate, row.transferDate, row.doneDate].map(v => String(v || '').slice(0, 10)).filter(Boolean));
}

function findApPatchMatches(spec) {
  return PAYABLES.filter(row => {
    if (spec.sourceKey && row.sourceKey === spec.sourceKey) return true;
    if (spec.case !== undefined && String(row.case || '') !== String(spec.case || '')) return false;
    if (spec.amount !== undefined && Math.abs(Number(row.amount || 0) - Number(spec.amount || 0)) > Number(spec.amountTolerance ?? 0.51)) return false;
    if (spec.vendorIncludes && !apPatchText(row.vendor).includes(apPatchText(spec.vendorIncludes))) return false;
    if (spec.summaryIncludes && !apPatchText(row.summary).includes(apPatchText(spec.summaryIncludes))) return false;
    if (spec.date && !apPatchDateSet(row).has(spec.date)) return false;
    return true;
  });
}

function validateApReconciliationPatch(data) {
  if (!data || typeof data !== 'object') return '檔案內容不是有效資料';
  if (data.format !== OPS_AP_RECONCILIATION_PATCH_FORMAT) return '不是 OPS 應付帳款對帳補丁';
  if (!Array.isArray(data.payables) || !Array.isArray(data.updates)) return '補丁缺少 payables 或 updates';
  const badPayable = data.payables.find(row => !row?.sourceKey || !row.vendor || !row.summary || !Number.isFinite(Number(row.amount)) || !row.doneDate || !row.paymentType);
  if (badPayable) return `應付新增資料格式不完整：${badPayable?.sourceKey || badPayable?.summary || '未命名資料'}`;
  const badUpdate = data.updates.find(row => !row?.match || !row?.set || !Object.keys(row.set).length);
  if (badUpdate) return '日期修正資料格式不完整';
  const ambiguous = data.updates.map(update => ({ update, matches:findApPatchMatches(update.match) })).find(item => item.matches.length !== 1);
  if (ambiguous) return `日期修正找不到唯一 OPS 資料：${ambiguous.update.label || ambiguous.update.match.summaryIncludes || ambiguous.update.match.vendorIncludes || '未命名'}（找到 ${ambiguous.matches.length} 筆）`;
  return '';
}

function apPatchDuplicate(row) {
  if (PAYABLES.some(existing => existing.sourceKey === row.sourceKey)) return true;
  return PAYABLES.some(existing => {
    if (String(existing.case || '') !== String(row.case || '')) return false;
    if (Math.abs(Number(existing.amount || 0) - Number(row.amount || 0)) > 0.51) return false;
    if (!apPatchDateSet(existing).has(row.doneDate) && !apPatchDateSet(existing).has(row.wantDate)) return false;
    const vendorSame = apPatchText(existing.vendor).includes(apPatchText(row.vendor)) || apPatchText(row.vendor).includes(apPatchText(existing.vendor));
    const summarySame = apPatchText(existing.summary).includes(apPatchText(row.summary)) || apPatchText(row.summary).includes(apPatchText(existing.summary));
    return vendorSame && summarySame;
  });
}

function applyApReconciliationPatch(data, fileName = 'AP reconciliation patch') {
  const error = validateApReconciliationPatch(data);
  if (error) { showToast(error, 'error'); return false; }
  const beforeSummary = auditSummary();
  const updateTargets = data.updates.map(update => ({ update, row:findApPatchMatches(update.match)[0] }));
  updateTargets.forEach(({update, row}) => {
    Object.assign(row, update.set);
    touchRowMeta(row);
  });
  let added = 0;
  let skipped = 0;
  data.payables.forEach(input => {
    const row = clone(input);
    if (apPatchDuplicate(row)) { skipped += 1; return; }
    row.id = pyNextId++;
    row.companyId = COMPANY_ID;
    row.sourceType = row.sourceType || 'ap_reconciliation_patch';
    row.importedAt = row.importedAt || localDateKey();
    PAYABLES.push(row);
    added += 1;
  });
  pyNextId = Math.max(pyNextId, Math.max(0, ...PAYABLES.map(row => Number(row.id) || 0)) + 1);
  normalizeOrdinaryProjectAccounting();
  pyRebuildRentOverhead();
  recordAuditLog('import', 'apReconciliationPatch', fileName, beforeSummary, auditSummary(), {
    riskLevel:'high', targetLabel:data.title || '應付帳款對帳補丁',
    reason:`依 2026 應付帳款回覆表新增 ${added} 筆、略過重複 ${skipped} 筆、修正 ${updateTargets.length} 筆；公司開銷與攤提同步重建`,
    diff:[{ field:'payables', beforeValue:beforeSummary.payables, afterValue:PAYABLES.length }]
  });
  saveData();
  renderAll();
  showToast(`應付帳款對帳已匯入：新增 ${added}、重複略過 ${skipped}、修正 ${updateTargets.length} 筆 ✓`, 'success');
  return true;
}

function validateExpensePatch(data) {
  if (!data || typeof data !== 'object') return '檔案內容不是有效資料';
  if (data.format !== OPS_EXPENSE_PATCH_FORMAT) return '不是 OPS 費用明細補丁檔';
  if (!Array.isArray(data.rows)) return '補丁檔缺少費用明細 rows';
  const bad = data.rows.find(r => !r || !r.sourceKey || !r.month || !r.person || !r.caseKey || !r.date || !r.item || !Number.isFinite(Number(r.amount)));
  if (bad) return `補丁檔有費用明細格式不完整：${bad.sourceKey || bad.item || '未命名資料'}`;
  return '';
}

function expensePatchShouldReplace(row, patch) {
  if (!row) return false;
  const replace = patch.replace || {};
  const sourceKey = String(row.sourceKey || '');
  if ((replace.sourceKeyPrefixes || []).some(prefix => sourceKey.startsWith(prefix))) return true;
  if (replace.months && !replace.months.includes(row.month)) return false;
  const item = String(row.item || '');
  const note = String(row.note || '');
  if ((replace.noteIncludes || []).some(text => note.includes(text))) return true;
  if ((replace.itemIncludes || []).some(text => item.includes(text))) return true;
  return false;
}

function applyExpensePatch(data, fileName = 'expense patch') {
  const error = validateExpensePatch(data);
  if (error) { showToast(error, 'error'); return false; }
  const rows = data.rows.map(row => ({
    ...row,
    id: Number(row.id) || 0,
    amount: Math.round(Number(row.amount) || 0),
    status: row.status || 'approved',
    receipt: row.receipt || '無',
    companyId: COMPANY_ID,
    sourceType: row.sourceType || 'expense_patch',
    importedAt: row.importedAt || new Date().toISOString().slice(0,10)
  }));
  const summary = data.summary || {};
  const label = data.title || '費用明細補丁';
  const rowTotal = rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  const rowCount = rows.length;
  const beforeSummary = auditSummary();
  const beforeCount = EXPENSES.length;
  if (data.replaceAllExpenses === true) {
    EXPENSES.length = 0;
  } else {
    for (let i = EXPENSES.length - 1; i >= 0; i--) {
      if (expensePatchShouldReplace(EXPENSES[i], data)) EXPENSES.splice(i, 1);
    }
  }
  const existingKeys = new Set(EXPENSES.map(row => String(row.sourceKey || '')).filter(Boolean));
  const nextBaseId = Math.max(Number(expNextId) || 1, Math.max(0, ...EXPENSES.map(row => Number(row.id) || 0)) + 1);
  let nextId = nextBaseId;
  let added = 0;
  rows.forEach(row => {
    if (existingKeys.has(row.sourceKey)) return;
    if (!row.id || EXPENSES.some(existing => Number(existing.id) === Number(row.id))) row.id = nextId++;
    EXPENSES.push(row);
    existingKeys.add(row.sourceKey);
    added += 1;
  });
  expNextId = Math.max(nextId, Math.max(0, ...EXPENSES.map(row => Number(row.id) || 0)) + 1);
  recordAuditLog('import', 'expensePatch', fileName, beforeSummary, auditSummary(), {
    riskLevel:'high',
    targetLabel:label,
    reason:`匯入費用明細補丁：移除 ${beforeCount - (EXPENSES.length - added)} 筆舊資料，新增 ${added}/${rowCount} 筆，補丁合計 ${rowTotal.toLocaleString('zh-TW')}`,
    diff:[{ field:'expenses', beforeValue:beforeSummary.expenses, afterValue:EXPENSES.length }]
  });
  saveData();
  renderAll();
  showToast(`${label} 已匯入：新增 ${added} 筆，合計 $${rowTotal.toLocaleString('zh-TW')} ✓`, 'success');
  if (summary.note) console.info(summary.note);
  return true;
}

function importBackupFile(input) {
  const file = input?.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result || ''));
      if (data.format === OPS_EXPENSE_PATCH_FORMAT) {
        const patchError = validateExpensePatch(data);
        if (patchError) { showToast(patchError, 'error'); return; }
        const label = data.title || '費用明細補丁';
        const rowCount = data.rows.length;
        const rowTotal = data.rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
        if (!confirm(`確定匯入「${label}」？\n\n此動作只會替換費用明細，不會覆蓋個案、應收、應付或測試回報。\n明細：${rowCount} 筆\n合計：$${rowTotal.toLocaleString('zh-TW')}`)) return;
        applyExpensePatch(data, file.name || 'expense patch');
        return;
      }
      const error = validateBackupSnapshot(data);
      if (error) { showToast(error, 'error'); return; }
      const savedAt = data.savedAt ? new Date(data.savedAt).toLocaleString('zh-TW') : '未知時間';
      const summary = `${data.CASES.length} 個案、${data.PAYABLES.length} 筆應付、${data.RECEIVABLES.length} 筆應收、${data.EXPENSES.length} 筆費用`;
      if (!confirm(`確定匯入此備份？\n備份時間：${savedAt}\n資料內容：${summary}\n\n匯入後目前資料會由此檔案取代。`)) return;
      const shouldBackup = confirm('匯入前要先下載目前資料備份嗎？\n\n建議保留備份；若剛剛已經下載過，可以按「取消」直接匯入。');
      if (shouldBackup && !exportBackup({ silent:true, fileName:backupFileName() })) {
        if (!confirm('目前資料備份下載失敗，仍要繼續匯入嗎？')) return;
      }
      const beforeSummary = auditSummary();
      if (!applyDataSnapshot(data)) { showToast('備份套用失敗', 'error'); return; }
      recordAuditLog('import', 'backup', file.name || 'backup', beforeSummary, auditSummary(), {
        riskLevel:'critical',
        targetLabel:file.name || 'OPS backup',
        reason:'完整備份匯入'
      });
      saveData();
      renderAll();
      showToast(opsCloudReady ? '備份匯入完成，正在同步雲端…' : '備份匯入完成', 'success');
    } catch(e) {
      console.warn('importBackupFile failed:', e);
      showToast('備份檔無法解析，請確認檔案是否完整', 'error');
    }
  };
  reader.onerror = () => showToast('無法讀取備份檔', 'error');
  reader.readAsText(file, 'utf-8');
}

function applyDataSnapshot(d) {
  if (!d || typeof d !== 'object') return false;
  if (d.CASES)       { CASES.length = 0;       CASES.push(...d.CASES); }
  if (d.PAYABLES)    { PAYABLES.length = 0;    PAYABLES.push(...d.PAYABLES); }
  // migration: 森沅（林繆云）清潔款改記為林繆云（森沅發票），實際廠商是林繆云、森沅木作代開發票
  { const p = PAYABLES.find(x => x.vendor === '森沅（林繆云）' && x.summary === '清潔' && x.amount === 80640); if (p) p.vendor = '林繆云（森沅發票）'; }
  // migration: 受款廠商曾誤存成「廠商代碼 - 廠商名稱」（picker 選取時整段存進去），只留廠商名稱
  PAYABLES.forEach(p => {
    const m = String(p.vendor || '').match(/^[A-Z]{2,3}-\d{3,4}\s*-\s*(.+)$/);
    if (m) p.vendor = m[1].trim();
  });
  if (d.RECEIVABLES) { RECEIVABLES.length = 0; RECEIVABLES.push(...d.RECEIVABLES); }
  if (d.CLIENTS)     { CLIENTS.length = 0;     CLIENTS.push(...d.CLIENTS); }
  if (d.VENDORS)     { VENDORS.length = 0;     VENDORS.push(...d.VENDORS); }
  // migration: DM-011 莊自強 → TL-009 泥作及貼磚
  { const v = VENDORS.find(x => x.code === 'DM-011' && x.name === '莊自強'); if (v) { v.code = 'TL-009'; v.trade = '泥作及貼磚'; } }
  // migration: 新增「專業顧問服務」類別（會計師／律師／建築師等），移入既有廠商並補建常用聯絡人
  { const v = VENDORS.find(x => x.code === 'OT-004' && x.name === '柏寶會計事務所'); if (v) { v.code = 'PS-001'; v.name = '柏實會計事務所'; v.trade = '專業顧問服務'; } }
  if (!VENDORS.some(x => x.name === '林振明（柏實）')) {
    VENDORS.push({code:'PS-002',name:'林振明（柏實）',trade:'專業顧問服務',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'柏實會計事務所記帳人員；過去付款記錄曾用「林振銘」「柏實」等別名。',status:'有效'});
  }
  { const v = VENDORS.find(x => x.code === 'OT-005' && x.name === '統領律師事務所'); if (v) { v.code = 'PS-003'; v.trade = '專業顧問服務'; } }
  { const v = VENDORS.find(x => x.code === 'DS-001' && x.name === '吳毓昌建築師事務所'); if (v) { v.code = 'PS-004'; v.trade = '專業顧問服務'; } }
  { const v = VENDORS.find(x => x.code === 'DS-002' && x.name === '宗誠林文宗結構土木事務所'); if (v) { v.code = 'PS-005'; v.trade = '專業顧問服務'; } }
  // migration: 李鎮宇（DS-004）改為 DS-001（原吳毓昌事務所已移出 DS-001，代碼空出）
  { const v = VENDORS.find(x => x.code === 'DS-004' && x.name === '李鎮宇'); if (v) { v.code = 'DS-001'; } }
  if (!VENDORS.some(x => x.name === '台北設計工會')) {
    VENDORS.push({code:'PS-006',name:'台北設計工會',trade:'專業顧問服務',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'',status:'有效'});
  }
  // migration: 設計製圖費類別更名為「設計製圖」（建築師／結構技師已移至專業顧問服務）
  VENDORS.filter(x => x.trade === '設計製圖費').forEach(x => { x.trade = '設計製圖'; });
  // migration: 刪除未使用的舊廠商「恣在空間整合有限公司 連星羽」(DS-003)；同名「連星羽」(DS-006) 仍有付款記錄引用，保留
  { const idx = VENDORS.findIndex(x => x.code === 'DS-003' && x.name === '恣在空間整合有限公司 連星羽'); if (idx >= 0) VENDORS.splice(idx, 1); }
  // migration: 新增燈具、空調、清潔廠商（原本只在應付帳款用簡稱，未建廠商主檔）
  if (!VENDORS.some(x => x.name === '澤鑠科技')) {
    VENDORS.push({code:'LT-006',name:'澤鑠科技',trade:'燈具／設備及其他',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'',status:'有效'});
  }
  if (!VENDORS.some(x => x.name === '侑昇工程行')) {
    VENDORS.push({code:'AC-004',name:'侑昇工程行',trade:'空調',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'',status:'有效'});
  }
  if (!VENDORS.some(x => x.name === '林繆云')) {
    VENDORS.push({code:'CL-003',name:'林繆云',trade:'完工清潔',taxId:'',owner:'',tel:'',mobile:'',email:'',address:'',bank:'',branch:'',account:'',accountName:'',payMethod:'匯款',note:'實際做清潔的廠商；請木作廠商森沅代開發票，付款記錄寫「林繆云（森沅發票）」。',status:'有效'});
  }
  if (d.EMPLOYEES)   { EMPLOYEES.length = 0;   EMPLOYEES.push(...d.EMPLOYEES); }
  // migration: 補上孫一宣實際離職日期（2026-09-09 李鎮宇確認為 2026-07-15），先前只設定離職狀態、日期欄位空白
  {
    const e = EMPLOYEES.find(x => x.id === 'sun');
    if (e && !e.endDate) {
      e.endDate = '2026-07-15';
      e.note = String(e.note || '').replace('；實際離職日期待補', '');
    }
  }
  if (d.EXPENSES && d.EXPENSES.length) { EXPENSES.length = 0; EXPENSES.push(...d.EXPENSES); }
  else { EXPENSES.length = 0; EXPENSES.push(...JSON.parse(JSON.stringify(INIT_EXPENSES))); }
  if (d.COMPANY_ALLOCATIONS) { COMPANY_ALLOCATIONS.length = 0; COMPANY_ALLOCATIONS.push(...d.COMPANY_ALLOCATIONS); }
  if (d.TAX_LIABILITIES) { TAX_LIABILITIES.length = 0; TAX_LIABILITIES.push(...d.TAX_LIABILITIES); }
  if (Array.isArray(d.TEST_FEEDBACK)) { TEST_FEEDBACK.length = 0; TEST_FEEDBACK.push(...d.TEST_FEEDBACK); }
  if (Array.isArray(d.ATTENDANCE_RECORDS)) { ATTENDANCE_RECORDS.length = 0; ATTENDANCE_RECORDS.push(...d.ATTENDANCE_RECORDS); }
  // migration: 修正盧彥辰 2026-09-04 出勤——當天測試出勤系統時刪除了真正的 GPS 上班紀錄又手動補登回去，
  // 導致下班 GPS 打卡找不到當天既有的 GPS 紀錄、另外新開一筆，變成「手動 08:22 上班無下班」＋「GPS 17:50 下班無上班」兩筆，合併回一筆。
  {
    const day = ATTENDANCE_RECORDS.filter(r => r.person === 'lu_yanchen' && r.date === '2026-09-04');
    const inRow = day.find(r => r.source === 'manual' && r.inTime === '08:22' && !r.outTime);
    const outRow = day.find(r => r.source === 'gps' && r.outTime === '17:50' && !r.inTime);
    if (inRow && outRow) {
      outRow.inTime = '08:22';
      outRow.note = [outRow.note, '已合併 09-04 因測試誤拆分的上班紀錄'].filter(Boolean).join('；');
      ATTENDANCE_RECORDS = ATTENDANCE_RECORDS.filter(r => r !== inRow);
    }
  }
  if (Array.isArray(d.ATTENDANCE_LEAVES)) { ATTENDANCE_LEAVES.length = 0; ATTENDANCE_LEAVES.push(...d.ATTENDANCE_LEAVES); }
  if (Array.isArray(d.AUDIT_LOGS)) { AUDIT_LOGS.length = 0; AUDIT_LOGS.push(...d.AUDIT_LOGS); }
  if (d.ATTENDANCE_SETTINGS && typeof d.ATTENDANCE_SETTINGS === 'object') Object.assign(ATTENDANCE_SETTINGS, d.ATTENDANCE_SETTINGS);
  // 正式加班規則：每日預計下班時間＝上班時間＋9 小時，超過部分每滿 30 分鐘才列入。
  // 只固定計算單位，避免舊 snapshot 把零碎分鐘跨日累加成 3.7 小時。
  ATTENDANCE_SETTINGS.overtimeStart = 'dynamic';
  ATTENDANCE_SETTINGS.overtimeUnitMinutes = 30;
  if (d.OVERHEAD)    {
    Object.keys(OVERHEAD).forEach(k => delete OVERHEAD[k]);
    Object.assign(OVERHEAD, d.OVERHEAD);
  }
  if (Array.isArray(d.OH_FIXED_CONFIG) && d.OH_FIXED_CONFIG.length > 0) {
    OH_FIXED_CONFIG.length = 0; OH_FIXED_CONFIG.push(...d.OH_FIXED_CONFIG);
  }
  ohMigrateWaterElectricSplit();
  // migration: 移除沒有使用過的固定支出項目「律師顧問費」（$0，跟「法律顧問費攤提」不固定支出是分開兩筆，重複容易混淆）
  {
    const idx = OH_FIXED_CONFIG.indexOf('律師顧問費');
    if (idx >= 0) {
      const hasAmount = Object.values(OVERHEAD).some(data => Number(data?.fixed?.[idx]) > 0);
      if (!hasAmount) {
        OH_FIXED_CONFIG.splice(idx, 1);
        Object.values(OVERHEAD).forEach(data => {
          if (Array.isArray(data.fixed)) data.fixed.splice(idx, 1);
          if (Array.isArray(data.fixedNotes)) data.fixedNotes.splice(idx, 1);
        });
      }
    }
  }
  if (d.PAYROLL)     { PAYROLL.length = 0;     PAYROLL.push(...d.PAYROLL); }
  // migration: 刪除陳虹君 2026-06 誤植的薪資紀錄——她 2026-07-01 才到職，6月不可能有薪資；
  // 金額全部是 0，不影響任何已對過的總額，只是讓「連續月份檢視」的月份數不對。
  {
    const idx = PAYROLL.findIndex(r => r.person === 'chen_hongjun' && r.month === '2026-06');
    if (idx >= 0) {
      const r = PAYROLL[idx];
      const hasAnyAmount = ['baseSalary','phoneAllowance','fullAttendanceBonus','dutyAllowance','performanceBonus','mealAllowance','overtimePay','expenseReimbursement','yearEndBonus','engineeringBonus','laborInsurance','healthInsurance','voluntaryPension','leaveDeduction','advancePaid']
        .some(k => Number(r[k]) > 0);
      if (!hasAnyAmount) PAYROLL.splice(idx, 1);
    }
  }
  if (d.PAYROLL_EMPLOYEE_ACCOUNTS && typeof d.PAYROLL_EMPLOYEE_ACCOUNTS === 'object') {
    Object.entries(d.PAYROLL_EMPLOYEE_ACCOUNTS).forEach(([person, account]) => {
      if (!account || typeof account !== 'object') return;
      const bank = String(account.bank || '').trim();
      const number = String(account.account || '').trim();
      if (!bank && !number) return;
      PAYROLL_EMPLOYEE_ACCOUNTS[person] = { bank, account:number };
    });
  }
  if (Array.isArray(d.PAYROLL_MONTHS)) {
    PAYROLL_MONTHS.length = 0;
    PAYROLL_MONTHS.push(...d.PAYROLL_MONTHS.filter(prIsValidMonth));
  } else {
    PAYROLL.forEach(row => {
      if (prIsValidMonth(row.month) && !PAYROLL_MONTHS.includes(row.month)) PAYROLL_MONTHS.push(row.month);
    });
  }
  if (Array.isArray(d.PAYROLL_DELETED_MONTHS)) {
    PAYROLL_DELETED_MONTHS.length = 0;
    PAYROLL_DELETED_MONTHS.push(...d.PAYROLL_DELETED_MONTHS.filter(prIsValidMonth));
  }
  if (Array.isArray(d.DELETED_SOURCE_KEYS)) {
    DELETED_SOURCE_KEYS.length = 0;
    DELETED_SOURCE_KEYS.push(...[...new Set(d.DELETED_SOURCE_KEYS.map(String).filter(Boolean))]);
  }
  if (d.PROFIT_SETTLEMENTS) { PROFIT_SETTLEMENTS.length = 0; PROFIT_SETTLEMENTS.push(...d.PROFIT_SETTLEMENTS); }
  if (typeof d.PS_TAX_RATE === 'number') PS_TAX_RATE = d.PS_TAX_RATE;
  if (d.pyNextId)    pyNextId  = d.pyNextId;
  if (d.rvNextId)    rvNextId  = d.rvNextId;
  if (d.tfNextId)    tfNextId  = d.tfNextId;
  if (d.attNextId)   attNextId = d.attNextId;
  if (d.attLeaveNextId) attLeaveNextId = d.attLeaveNextId;
  if (d.auditNextId) auditNextId = d.auditNextId;
  const derivedEmpNextId = Math.max(1, ...EMPLOYEES.map(e => Number(String(e.id || '').match(/^emp(\d+)$/)?.[1]) + 1 || 1));
  empNextId = Math.max(Number(d.empNextId) || 1, derivedEmpNextId);
  tfNextId = Math.max(Number(tfNextId) || 1, Math.max(0, ...TEST_FEEDBACK.map(r => Number(r.id) || 0)) + 1);
  attNextId = Math.max(Number(attNextId) || 1, Math.max(0, ...ATTENDANCE_RECORDS.map(r => Number(r.id) || 0)) + 1);
  attLeaveNextId = Math.max(Number(attLeaveNextId) || 1, Math.max(0, ...ATTENDANCE_LEAVES.map(r => Number(r.id) || 0)) + 1);
  auditNextId = Math.max(Number(auditNextId) || 1, Math.max(0, ...AUDIT_LOGS.map(r => Number(r.id) || 0)) + 1);
  if (d.expNextId && typeof expNextId !== 'undefined') expNextId = d.expNextId;
  if (d.USER_PERMISSIONS && typeof d.USER_PERMISSIONS === 'object') {
    Object.entries(d.USER_PERMISSIONS).forEach(([uid, perms]) => {
      if (perms && typeof perms === 'object') USER_PERMISSIONS[uid] = { ...USER_PERMISSIONS[uid], ...perms };
    });
  }
  normalizeCompanyData();
  syncPayrollEmployeeAccountsFromConfig();
  return true;
}

function loadData() {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const legacyKey = LEGACY_STORAGE_KEYS.find(key => localStorage.getItem(key));
      if (legacyKey) raw = localStorage.getItem(legacyKey);
    }
    if (!raw) return false;
    return applyDataSnapshot(JSON.parse(raw));
  } catch(e) {
    console.warn('loadData failed:', e);
    return false;
  }
}

function applyTheme(theme) {
  const nextTheme = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = nextTheme;
  try { localStorage.setItem(THEME_KEY, nextTheme); } catch(e) {}
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = nextTheme === 'light' ? '深色模式' : '亮色模式';
}

function toggleTheme() {
  const current = document.documentElement.dataset.theme || 'light';
  applyTheme(current === 'light' ? 'dark' : 'light');
}

// ══════════════════════════════════
// INIT
// ══════════════════════════════════
function opsAuthUserByEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  const emp = EMPLOYEES.find(e =>
    empEffectiveStatus(e) !== '已離職' &&
    String(e.email || '').trim().toLowerCase() === normalized &&
    employeeAccessRole(e) !== 'none'
  );
  if (emp) return opsUserFromEmployee(emp);
  const userId = OPS_ALLOWED_USERS[normalized];
  if (!userId) return null;
  const fallbackEmp = EMPLOYEES.find(e => e.id === userId);
  if (fallbackEmp && (empEffectiveStatus(fallbackEmp) === '已離職' || employeeAccessRole(fallbackEmp) === 'none')) return null;
  return isActiveEmployeeId(userId) ? USERS.find(u => u.id === userId) : null;
}

function opsUserFromEmployee(emp) {
  const role = employeeAccessRole(emp);
  const permissions = EMP_ACCESS_PERMISSION_TEMPLATES[role] || {};
  return {
    id: emp.id,
    name: emp.name,
    role: EMP_ACCESS_ROLES[role] || emp.role || '員工',
    roleCode: EMP_ROLE_CODE[role] || 'STAFF',
    initial: String(emp.name || '員').slice(0,1),
    color: EMP_ROLE_COLOR[role] || '#949494',
    nav: Object.keys(PAGE_TITLES || {}).filter(page => (permissions[page] || 'none') !== 'none')
  };
}

function opsTestUserFromAttendanceEmployee(emp) {
  return {
    id: emp.id,
    name: emp.name,
    role: '打卡人員',
    roleCode: 'STAFF',
    initial: String(emp.name || '員').slice(0,1),
    color: '#6aa88c',
    nav: ['attendance','feedback']
  };
}

function opsAuthSetError(message) {
  const el = document.getElementById('ops-auth-error');
  if (!el) return;
  el.textContent = message || '';
  el.style.display = message ? '' : 'none';
}

function opsAuthSetLoading(loading) {
  const btn = document.getElementById('ops-login-btn');
  if (!btn) return;
  btn.disabled = !!loading;
  btn.textContent = loading ? '登入中...' : '使用 Google 帳號登入';
}

function opsReadAuthSession() {
  try {
    const raw = localStorage.getItem(OPS_AUTH_SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!session.email || !opsAuthUserByEmail(session.email)) return null;
    if (Date.now() - Number(session.loginTime || 0) > OPS_AUTH_SESSION_HOURS * 3600 * 1000) return null;
    return session;
  } catch(e) {
    return null;
  }
}

function renderAll() {
  renderCases();
  renderPayable();
  renderReceivable();
  refreshAllCaseDropdowns();
  renderExpense();
  renderOverhead();
  prRenderMonthOptions();
  renderPayroll();
  renderProfit();
  renderProfitShare();
  renderPayreq();
  renderDashboard();
  renderFeedback();
  initFeedbackScreenshotInput();
  attFillMonthOptions();
  renderAttendance();
  renderEmployees();
  renderClients();
  renderVendors();
}

function renderAfterDataSettles(reason = '') {
  renderAll();
  try {
    const restorePage = sessionStorage.getItem('opsRestorePage');
    if (restorePage && restorePage !== currentPage) {
      sessionStorage.removeItem('opsRestorePage');
      setTimeout(() => { if (canAccess(restorePage)) navTo(restorePage); }, 200);
      return;
    }
  } catch(e) {}
  if (activateRequestedPageFromUrl()) return;
  if (activateDefaultPageForUser()) return;
  setTimeout(renderCurrentPage, 150);
  setTimeout(renderCurrentPage, 500);
}

function opsInitFirebase() {
  if (!OPS_AUTH_ENFORCED) return false;
  if (!window.firebase) throw new Error('Firebase SDK not loaded');
  if (!opsFbApp) {
    opsFbApp = firebase.apps?.length ? firebase.app() : firebase.initializeApp(OPS_FIREBASE_CONFIG);
    opsFbDb = firebase.database();
  }
  return true;
}

function opsCloudRef() {
  if (!opsFbDb) opsInitFirebase();
  return opsFbDb.ref(OPS_CLOUD_PATH);
}

async function opsCloudRequireFirebaseUser() {
  opsInitFirebase();
  const user = firebase.auth().currentUser;
  const email = String(user?.email || '').toLowerCase();
  if (!user || email !== String(opsAuthenticatedEmail || '').toLowerCase()) {
    opsCloudReady = false;
    opsCloudLastSummary = 'Firebase Auth 未連線';
    updateDataStatus();
    throw new Error('請先按「登出」後重新用 Google 帳號登入，再檢查或上傳雲端快照。');
  }
  return user;
}

function opsCloudErrorMessage(error, action = '雲端操作') {
  const code = String(error?.code || '');
  const message = String(error?.message || error || '');
  if (message.includes('OPS_CLOUD_CONFLICT')) {
    return '雲端已有較新的資料，已停止覆蓋。請先下載目前資料備份，再按「檢查雲端快照」確認最新版本。';
  }
  if (message.includes('請先按')) return message;
  if (code === 'PERMISSION_DENIED' || message.includes('PERMISSION_DENIED') || message.includes('permission_denied')) {
    return `${action}被 Firebase 規則拒絕；請確認 Realtime Database rules 已發布，並登出後重新登入。`;
  }
  if (message.includes('contains undefined')) return `${action}失敗：資料內仍有空值格式需要清理，請重新整理後再試一次。`;
  if (message.includes('Firebase SDK not loaded')) return 'Firebase 模組尚未載入，請重新整理頁面。';
  return `${action}失敗：${message.slice(0, 80) || '未知錯誤'}`;
}

function opsCloudSanitizeValue(value) {
  if (value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) return value.map(opsCloudSanitizeValue);
  if (value && typeof value === 'object') {
    const out = {};
    Object.entries(value).forEach(([key, child]) => {
      out[key] = opsCloudSanitizeValue(child);
    });
    return out;
  }
  return value;
}

async function opsFirebaseSignIn(accessToken, expectedEmail) {
  opsInitFirebase();
  const credential = firebase.auth.GoogleAuthProvider.credential(null, accessToken);
  const result = await firebase.auth().signInWithCredential(credential);
  const email = String(result?.user?.email || '').toLowerCase();
  if (email !== String(expectedEmail || '').toLowerCase()) {
    await firebase.auth().signOut();
    throw new Error('Firebase login email mismatch');
  }
  return result.user;
}

function opsCloudPayload(snapshot) {
  const cleanSnapshot = opsCloudSanitizeValue(snapshot || createDataSnapshot());
  const savedAt = cleanSnapshot?.savedAt || new Date().toISOString();
  return {
    data: cleanSnapshot,
    meta: {
      companyId: COMPANY_ID,
      appVersion: cleanSnapshot?.appVersion || '',
      savedAt,
      savedBy: opsAuthenticatedEmail || '',
      savedByName: currentUser?.name || '',
      source: 'ops-v2-cloud-sync'
    }
  };
}

function opsCloudPayloadSavedAt(payload) {
  const data = payload?.data || payload;
  const meta = payload?.meta || {};
  return meta.savedAt || data?.savedAt || '';
}

function opsCloudClone(value) {
  return JSON.parse(JSON.stringify(value || null));
}

function opsCloudRowKey(row) {
  if (!row || typeof row !== 'object') return '';
  if (row.id !== undefined && row.id !== null && row.id !== '') return `id:${row.id}`;
  if (row.sourceKey) return `source:${row.sourceKey}`;
  return '';
}

function opsCloudRowFingerprint(row) {
  if (!row || typeof row !== 'object') return '';
  const clean = opsCloudClone(row);
  return JSON.stringify(clean);
}

function opsCloudMapRows(rows) {
  const map = new Map();
  (rows || []).forEach(row => {
    const key = opsCloudRowKey(row);
    if (key) map.set(key, row);
  });
  return map;
}

function opsCloudMapRowsBy(rows, keyFn) {
  const map = new Map();
  (rows || []).forEach(row => {
    const key = keyFn(row);
    if (key) map.set(key, row);
  });
  return map;
}

function opsCloudNextNumericId(rows) {
  return Math.max(0, ...(rows || []).map(row => Number(row?.id) || 0)) + 1;
}

function rowHasNonNumericId(row) {
  return row?.id !== undefined && row?.id !== null && row?.id !== '' && !Number.isFinite(Number(row.id));
}

function opsCloudMergeAuditLogs(remoteData, localData) {
  const out = [...(remoteData.AUDIT_LOGS || [])];
  const seenFp = new Set(out.map(row => opsCloudRowFingerprint(row)));
  let nextId = opsCloudNextNumericId(out);
  (localData.AUDIT_LOGS || []).forEach(row => {
    const fp = opsCloudRowFingerprint(row);
    if (seenFp.has(fp)) return;
    const next = opsCloudClone(row);
    if (next.id !== undefined && next.id !== null && out.some(r => String(r.id) === String(next.id))) {
      next.id = nextId++;
    }
    out.unshift(next);
    seenFp.add(opsCloudRowFingerprint(next));
  });
  out.sort((a,b) => opsSnapshotTimeMs(b?.at) - opsSnapshotTimeMs(a?.at));
  return out.slice(0, 1000);
}

function opsCloudChangedOutsideReceivables(baseData, localData) {
  const allowed = new Set(['RECEIVABLES','AUDIT_LOGS','USER_PERMISSIONS','rvNextId','auditNextId','savedAt','appVersion']);
  const keys = new Set([...Object.keys(baseData || {}), ...Object.keys(localData || {})]);
  for (const key of keys) {
    if (allowed.has(key)) continue;
    if (JSON.stringify(baseData?.[key] ?? null) !== JSON.stringify(localData?.[key] ?? null)) return true;
  }
  return false;
}

function opsCloudMergeUserPermissions(baseData, localData, remoteData) {
  const basePerms = baseData?.USER_PERMISSIONS || {};
  const localPerms = localData?.USER_PERMISSIONS || {};
  const remotePerms = remoteData?.USER_PERMISSIONS || {};
  const out = opsCloudClone(remotePerms) || {};
  const conflicts = [];
  const keys = new Set([...Object.keys(basePerms), ...Object.keys(localPerms)]);
  keys.forEach(key => {
    const baseHas = Object.prototype.hasOwnProperty.call(basePerms, key);
    const localHas = Object.prototype.hasOwnProperty.call(localPerms, key);
    const remoteHas = Object.prototype.hasOwnProperty.call(remotePerms, key);
    const baseFp = baseHas ? JSON.stringify(basePerms[key]) : '';
    const localFp = localHas ? JSON.stringify(localPerms[key]) : '';
    const remoteFp = remoteHas ? JSON.stringify(remotePerms[key]) : '';
    const localChanged = localFp !== baseFp;
    const remoteChanged = remoteFp !== baseFp;
    if (!localChanged) return;
    if (remoteChanged && remoteFp !== localFp) {
      conflicts.push(key);
      return;
    }
    if (localHas) out[key] = opsCloudClone(localPerms[key]);
    else delete out[key];
  });
  if (conflicts.length) return { ok:false, conflicts };
  return { ok:true, data:out };
}

function opsCloudMergeRowsByKey(baseRows, localRows, remoteRows, options = {}) {
  const keyFn = options.keyFn || opsCloudRowKey;
  const baseMap = opsCloudMapRowsBy(baseRows, keyFn);
  const localMap = opsCloudMapRowsBy(localRows, keyFn);
  const remoteMap = opsCloudMapRowsBy(remoteRows, keyFn);
  const mergedRows = (remoteRows || []).map(opsCloudClone);
  const mergedMap = opsCloudMapRowsBy(mergedRows, keyFn);
  const conflicts = [];
  let nextId = Math.max(
    opsCloudNextNumericId(mergedRows),
    opsCloudNextNumericId(localRows),
    Number(options.remoteNextId) || 1,
    Number(options.localNextId) || 1
  );

  const putLocalRow = (key, localRow) => {
    const row = opsCloudClone(localRow);
    const existing = mergedMap.get(key);
    if (existing) {
      const idx = mergedRows.indexOf(existing);
      if (idx >= 0) mergedRows[idx] = row;
      mergedMap.set(key, row);
      return;
    }
    if (row.id !== undefined && row.id !== null && mergedRows.some(r => String(r.id) === String(row.id))) {
      row.id = nextId++;
    }
    mergedRows.push(row);
    mergedMap.set(keyFn(row), row);
  };

  const allKeys = new Set([...baseMap.keys(), ...localMap.keys()]);
  allKeys.forEach(key => {
    const base = baseMap.get(key);
    const local = localMap.get(key);
    const remote = remoteMap.get(key);
    const baseFp = opsCloudRowFingerprint(base);
    const localFp = opsCloudRowFingerprint(local);
    const remoteFp = opsCloudRowFingerprint(remote);
    const localChanged = base ? localFp !== baseFp : !!local;
    const remoteChanged = base ? remoteFp !== baseFp : !!remote;
    if (!localChanged) return;

    if (!base && local && remote && remoteFp !== localFp) {
      if (options.reassignIdOnNewCollision !== true || rowHasNonNumericId(local)) {
        conflicts.push(key);
        return;
      }
      const row = opsCloudClone(local);
      row.id = nextId++;
      mergedRows.push(row);
      mergedMap.set(keyFn(row), row);
      return;
    }

    if (base && !local) {
      if (remote && remoteChanged) {
        conflicts.push(key);
        return;
      }
      const existing = mergedMap.get(key);
      if (existing) {
        const idx = mergedRows.indexOf(existing);
        if (idx >= 0) mergedRows.splice(idx, 1);
        mergedMap.delete(key);
      }
      return;
    }

    if (base && local && remoteChanged && remoteFp !== localFp) {
      conflicts.push(key);
      return;
    }
    if (local) putLocalRow(key, local);
  });

  if (conflicts.length) return { ok:false, conflicts };
  return { ok:true, rows:mergedRows, nextId:Math.max(nextId, opsCloudNextNumericId(mergedRows)) };
}

function opsCloudMergeObjectByKey(baseObj = {}, localObj = {}, remoteObj = {}) {
  const out = opsCloudClone(remoteObj) || {};
  const conflicts = [];
  const keys = new Set([...Object.keys(baseObj || {}), ...Object.keys(localObj || {})]);
  keys.forEach(key => {
    const baseHas = Object.prototype.hasOwnProperty.call(baseObj, key);
    const localHas = Object.prototype.hasOwnProperty.call(localObj, key);
    const remoteHas = Object.prototype.hasOwnProperty.call(remoteObj, key);
    const baseFp = baseHas ? JSON.stringify(baseObj[key]) : '';
    const localFp = localHas ? JSON.stringify(localObj[key]) : '';
    const remoteFp = remoteHas ? JSON.stringify(remoteObj[key]) : '';
    const localChanged = localFp !== baseFp;
    const remoteChanged = remoteFp !== baseFp;
    if (!localChanged) return;
    if (remoteChanged && remoteFp !== localFp) {
      conflicts.push(key);
      return;
    }
    if (localHas) out[key] = opsCloudClone(localObj[key]);
    else delete out[key];
  });
  return conflicts.length ? { ok:false, conflicts } : { ok:true, data:out };
}

function opsCloudMergePayrollExtras(merged, baseData, localData, remoteData, mergedRows) {
  const accounts = opsCloudMergeObjectByKey(
    baseData?.PAYROLL_EMPLOYEE_ACCOUNTS || {},
    localData?.PAYROLL_EMPLOYEE_ACCOUNTS || {},
    remoteData?.PAYROLL_EMPLOYEE_ACCOUNTS || {}
  );
  if (!accounts.ok) return { ok:false, reason:'payroll-account-conflict', conflicts:accounts.conflicts };
  const deletedMonths = [...new Set([
    ...(remoteData?.PAYROLL_DELETED_MONTHS || []),
    ...(localData?.PAYROLL_DELETED_MONTHS || [])
  ].filter(prIsValidMonth))].sort((a,b) => b.localeCompare(a));
  const deletedSet = new Set(deletedMonths);
  const months = new Set([
    ...(remoteData?.PAYROLL_MONTHS || []),
    ...(localData?.PAYROLL_MONTHS || []),
    ...(mergedRows || []).map(r => r?.month)
  ].filter(prIsValidMonth));
  deletedSet.forEach(month => months.delete(month));
  merged.PAYROLL_EMPLOYEE_ACCOUNTS = accounts.data;
  merged.PAYROLL_DELETED_MONTHS = deletedMonths;
  merged.PAYROLL_MONTHS = [...months].sort((a,b) => b.localeCompare(a));
  return { ok:true };
}

function opsCloudChangedOutsideCollection(baseData, localData, allowed) {
  const keys = new Set([...Object.keys(baseData || {}), ...Object.keys(localData || {})]);
  for (const key of keys) {
    if (allowed.has(key)) continue;
    if (JSON.stringify(baseData?.[key] ?? null) !== JSON.stringify(localData?.[key] ?? null)) return true;
  }
  return false;
}

const OPS_CLOUD_ROW_MERGE_CONFIGS = [
  { collection:'EXPENSES', nextIdField:'expNextId', label:'費用申請', reassignIdOnNewCollision:true },
  { collection:'TEST_FEEDBACK', nextIdField:'tfNextId', label:'問題回報', reassignIdOnNewCollision:true },
  { collection:'ATTENDANCE_RECORDS', nextIdField:'attNextId', label:'出勤紀錄', reassignIdOnNewCollision:true },
  { collection:'ATTENDANCE_LEAVES', nextIdField:'attLeaveNextId', label:'請假紀錄', reassignIdOnNewCollision:true },
  { collection:'CLIENTS', label:'客戶主檔', keyFn: row => row?.code ? `code:${row.code}` : opsCloudRowKey(row) },
  { collection:'VENDORS', label:'廠商主檔', keyFn: row => row?.code ? `code:${row.code}` : opsCloudRowKey(row) },
  { collection:'EMPLOYEES', nextIdField:'empNextId', label:'員工主檔', keyFn: row => row?.id ? `id:${row.id}` : '' },
  { collection:'COMPANY_ALLOCATIONS', label:'公司分攤資料', keyFn: row => row?.caseKey ? `case:${row.caseKey}` : opsCloudRowKey(row) },
  { collection:'TAX_LIABILITIES', label:'稅務負債資料', keyFn: row => row?.sourceKey ? `source:${row.sourceKey}` : opsCloudRowKey(row) },
  { collection:'PAYROLL', nextIdField:'prNextId', label:'薪資資料', keyFn: row => row?.person && row?.month ? `person:${row.person}|month:${row.month}` : opsCloudRowKey(row), extraFields:['PAYROLL_MONTHS','PAYROLL_DELETED_MONTHS','PAYROLL_EMPLOYEE_ACCOUNTS'], mergeExtra:opsCloudMergePayrollExtras }
];

function opsCloudMergeSingleCollection(baseData, localData, remoteData, config) {
  const allowed = new Set([config.collection,'AUDIT_LOGS','USER_PERMISSIONS','auditNextId','savedAt','appVersion']);
  if (config.nextIdField) allowed.add(config.nextIdField);
  (config.extraFields || []).forEach(field => allowed.add(field));
  if (opsCloudChangedOutsideCollection(baseData, localData, allowed)) return { ok:false, reason:'outside-change' };
  const mergedPermissions = opsCloudMergeUserPermissions(baseData, localData, remoteData);
  if (!mergedPermissions.ok) return { ok:false, reason:'user-permission-conflict', conflicts:mergedPermissions.conflicts };
  const mergedRows = opsCloudMergeRowsByKey(
    baseData?.[config.collection] || [],
    localData?.[config.collection] || [],
    remoteData?.[config.collection] || [],
    {
      keyFn: config.keyFn || opsCloudRowKey,
      localNextId: config.nextIdField ? localData?.[config.nextIdField] : 1,
      remoteNextId: config.nextIdField ? remoteData?.[config.nextIdField] : 1,
      reassignIdOnNewCollision: config.reassignIdOnNewCollision === true
    }
  );
  if (!mergedRows.ok) return { ok:false, reason:'row-conflict', conflicts:mergedRows.conflicts };
  const merged = opsCloudClone(remoteData);
  merged[config.collection] = mergedRows.rows;
  if (typeof config.mergeExtra === 'function') {
    const extra = config.mergeExtra(merged, baseData, localData, remoteData, mergedRows.rows);
    if (!extra.ok) return extra;
  }
  merged.USER_PERMISSIONS = mergedPermissions.data;
  merged.AUDIT_LOGS = opsCloudMergeAuditLogs(remoteData, localData);
  if (config.nextIdField) merged[config.nextIdField] = Math.max(mergedRows.nextId, Number(remoteData?.[config.nextIdField]) || 1, Number(localData?.[config.nextIdField]) || 1);
  merged.auditNextId = Math.max(Number(remoteData.auditNextId) || 1, Number(localData.auditNextId) || 1, opsCloudNextNumericId(merged.AUDIT_LOGS));
  merged.savedAt = new Date().toISOString();
  merged.appVersion = '1.3.37';
  return { ok:true, data:merged };
}

function opsCloudLocalChangedOnlyCollection(baseData, localData, config) {
  const allowed = new Set([config.collection,'AUDIT_LOGS','USER_PERMISSIONS','auditNextId','savedAt','appVersion']);
  if (config.nextIdField) allowed.add(config.nextIdField);
  (config.extraFields || []).forEach(field => allowed.add(field));
  if (opsCloudChangedOutsideCollection(baseData, localData, allowed)) return false;
  const baseRows = baseData?.[config.collection] || [];
  const localRows = localData?.[config.collection] || [];
  if (JSON.stringify(baseRows) !== JSON.stringify(localRows)) return true;
  if (config.nextIdField && Number(baseData?.[config.nextIdField] || 1) !== Number(localData?.[config.nextIdField] || 1)) return true;
  if ((config.extraFields || []).some(field => JSON.stringify(baseData?.[field] ?? null) !== JSON.stringify(localData?.[field] ?? null))) return true;
  const basePerms = baseData?.USER_PERMISSIONS || {};
  const localPerms = localData?.USER_PERMISSIONS || {};
  return JSON.stringify(basePerms) !== JSON.stringify(localPerms);
}

async function opsCloudTryMergePendingCollection(localSnapshot, config) {
  if (!opsCloudBaseSnapshot || !localSnapshot) return false;
  if (!opsCloudLocalChangedOnlyCollection(opsCloudBaseSnapshot, localSnapshot, config)) return false;
  const snap = await opsCloudRef().get();
  if (!snap.exists()) return false;
  const remotePayload = snap.val();
  const remoteData = remotePayload?.data || remotePayload;
  const error = validateBackupSnapshot(remoteData);
  if (error) return false;
  const merged = opsCloudMergeSingleCollection(opsCloudBaseSnapshot, localSnapshot, remoteData, config);
  if (!merged.ok) {
	    if (merged.reason === 'row-conflict') {
	      opsCloudLastSummary = `同一筆${config.label}已被其他人更新：${merged.conflicts.length} 筆`;
	    } else if (merged.reason === 'user-permission-conflict') {
	      opsCloudLastSummary = `同一位員工權限已被其他人更新：${merged.conflicts.length} 筆`;
	    } else if (merged.reason === 'payroll-account-conflict') {
	      opsCloudLastSummary = `同一位員工薪資帳戶已被其他人更新：${merged.conflicts.length} 筆`;
	    }
    return false;
  }
  const payload = await opsCloudSaveNow(merged.data, { force:true });
  opsApplyCloudPayload(payload, { silent:true });
  showToast(`已逐筆合併${config.label}並同步雲端`, 'success');
  return true;
}

async function opsCloudTryMergePendingOtherRows(localSnapshot) {
  for (const config of OPS_CLOUD_ROW_MERGE_CONFIGS) {
    const merged = await opsCloudTryMergePendingCollection(localSnapshot, config);
    if (merged) return true;
  }
  return false;
}

function opsCloudChangedOutsideOverhead(baseData, localData) {
  const allowed = new Set(['OVERHEAD','OH_FIXED_CONFIG','AUDIT_LOGS','USER_PERMISSIONS','auditNextId','savedAt','appVersion']);
  return opsCloudChangedOutsideCollection(baseData, localData, allowed);
}

function opsCloudLocalChangedOnlyOverhead(baseData, localData) {
  if (!baseData || !localData) return false;
  if (opsCloudChangedOutsideOverhead(baseData, localData)) return false;
  return JSON.stringify(baseData.OVERHEAD || {}) !== JSON.stringify(localData.OVERHEAD || {})
    || JSON.stringify(baseData.OH_FIXED_CONFIG || []) !== JSON.stringify(localData.OH_FIXED_CONFIG || [])
    || JSON.stringify(baseData.USER_PERMISSIONS || {}) !== JSON.stringify(localData.USER_PERMISSIONS || {});
}

function opsCloudMergeOverhead(baseData, localData, remoteData) {
  if (!baseData || !localData || !remoteData) return { ok:false, reason:'missing-base' };
  if (opsCloudChangedOutsideOverhead(baseData, localData)) return { ok:false, reason:'outside-overhead-change' };
  const mergedPermissions = opsCloudMergeUserPermissions(baseData, localData, remoteData);
  if (!mergedPermissions.ok) return { ok:false, reason:'user-permission-conflict', conflicts:mergedPermissions.conflicts };

  const baseConfig = JSON.stringify(baseData.OH_FIXED_CONFIG || []);
  const localConfig = JSON.stringify(localData.OH_FIXED_CONFIG || []);
  const remoteConfig = JSON.stringify(remoteData.OH_FIXED_CONFIG || []);
  const localConfigChanged = localConfig !== baseConfig;
  const remoteConfigChanged = remoteConfig !== baseConfig;
  if (localConfigChanged && remoteConfigChanged && localConfig !== remoteConfig) {
    return { ok:false, reason:'overhead-config-conflict', conflicts:['OH_FIXED_CONFIG'] };
  }

  const baseOverhead = baseData.OVERHEAD || {};
  const localOverhead = localData.OVERHEAD || {};
  const remoteOverhead = remoteData.OVERHEAD || {};
  const mergedOverhead = opsCloudClone(remoteOverhead) || {};
  const conflicts = [];
  const keys = new Set([...Object.keys(baseOverhead), ...Object.keys(localOverhead)]);
  keys.forEach(month => {
    const baseHas = Object.prototype.hasOwnProperty.call(baseOverhead, month);
    const localHas = Object.prototype.hasOwnProperty.call(localOverhead, month);
    const remoteHas = Object.prototype.hasOwnProperty.call(remoteOverhead, month);
    const baseFp = baseHas ? JSON.stringify(baseOverhead[month]) : '';
    const localFp = localHas ? JSON.stringify(localOverhead[month]) : '';
    const remoteFp = remoteHas ? JSON.stringify(remoteOverhead[month]) : '';
    const localChanged = localFp !== baseFp;
    const remoteChanged = remoteFp !== baseFp;
    if (!localChanged) return;
    if (!baseHas && localHas && remoteHas && remoteFp !== localFp) {
      conflicts.push(month);
      return;
    }
    if (baseHas && !localHas) {
      if (remoteHas && remoteChanged) {
        conflicts.push(month);
        return;
      }
      delete mergedOverhead[month];
      return;
    }
    if (baseHas && localHas && remoteChanged && remoteFp !== localFp) {
      conflicts.push(month);
      return;
    }
    if (localHas) mergedOverhead[month] = opsCloudClone(localOverhead[month]);
  });
  if (conflicts.length) return { ok:false, reason:'overhead-month-conflict', conflicts };

  const merged = opsCloudClone(remoteData);
  merged.OVERHEAD = mergedOverhead;
  if (localConfigChanged) merged.OH_FIXED_CONFIG = opsCloudClone(localData.OH_FIXED_CONFIG || []);
  merged.USER_PERMISSIONS = mergedPermissions.data;
  merged.AUDIT_LOGS = opsCloudMergeAuditLogs(remoteData, localData);
  merged.auditNextId = Math.max(Number(remoteData.auditNextId) || 1, Number(localData.auditNextId) || 1, opsCloudNextNumericId(merged.AUDIT_LOGS));
  merged.savedAt = new Date().toISOString();
  merged.appVersion = '1.3.37';
  return { ok:true, data:merged };
}

async function opsCloudTryMergePendingOverhead(localSnapshot) {
  if (!opsCloudBaseSnapshot || !localSnapshot) return false;
  if (!opsCloudLocalChangedOnlyOverhead(opsCloudBaseSnapshot, localSnapshot)) return false;
  const snap = await opsCloudRef().get();
  if (!snap.exists()) return false;
  const remotePayload = snap.val();
  const remoteData = remotePayload?.data || remotePayload;
  const error = validateBackupSnapshot(remoteData);
  if (error) return false;
  const merged = opsCloudMergeOverhead(opsCloudBaseSnapshot, localSnapshot, remoteData);
  if (!merged.ok) {
    if (merged.reason === 'overhead-month-conflict') {
      opsCloudLastSummary = `同一月份公司開銷已被其他人更新：${merged.conflicts.join('、')}`;
    } else if (merged.reason === 'overhead-config-conflict') {
      opsCloudLastSummary = '公司開銷固定支出欄位設定已被其他人更新';
    } else if (merged.reason === 'user-permission-conflict') {
      opsCloudLastSummary = `同一位員工權限已被其他人更新：${merged.conflicts.length} 筆`;
    }
    return false;
  }
  const payload = await opsCloudSaveNow(merged.data, { force:true });
  opsApplyCloudPayload(payload, { silent:true });
  showToast('已逐月合併公司開銷並同步雲端', 'success');
  return true;
}

function opsCloudMergeReceivables(baseData, localData, remoteData) {
  if (!baseData || !localData || !remoteData) return { ok:false, reason:'missing-base' };
  if (opsCloudChangedOutsideReceivables(baseData, localData)) return { ok:false, reason:'outside-receivable-change' };
  const mergedPermissions = opsCloudMergeUserPermissions(baseData, localData, remoteData);
  if (!mergedPermissions.ok) return { ok:false, reason:'user-permission-conflict', conflicts:mergedPermissions.conflicts };
  const baseRows = baseData.RECEIVABLES || [];
  const localRows = localData.RECEIVABLES || [];
  const remoteRows = remoteData.RECEIVABLES || [];
  const baseMap = opsCloudMapRows(baseRows);
  const localMap = opsCloudMapRows(localRows);
  const remoteMap = opsCloudMapRows(remoteRows);
  const mergedRows = remoteRows.map(opsCloudClone);
  const mergedMap = opsCloudMapRows(mergedRows);
  const conflicts = [];
  let nextId = Math.max(opsCloudNextNumericId(mergedRows), opsCloudNextNumericId(localRows), Number(remoteData.rvNextId) || 1, Number(localData.rvNextId) || 1);

  const putLocalRow = (key, localRow) => {
    const row = opsCloudClone(localRow);
    const existing = mergedMap.get(key);
    if (existing) {
      const idx = mergedRows.indexOf(existing);
      if (idx >= 0) mergedRows[idx] = row;
      mergedMap.set(key, row);
      return;
    }
    if (row.id !== undefined && row.id !== null && mergedRows.some(r => String(r.id) === String(row.id))) {
      row.id = nextId++;
    }
    mergedRows.push(row);
    mergedMap.set(opsCloudRowKey(row), row);
  };

  const allKeys = new Set([...baseMap.keys(), ...localMap.keys()]);
  allKeys.forEach(key => {
    const base = baseMap.get(key);
    const local = localMap.get(key);
    const remote = remoteMap.get(key);
    const baseFp = opsCloudRowFingerprint(base);
    const localFp = opsCloudRowFingerprint(local);
    const remoteFp = opsCloudRowFingerprint(remote);
    const localChanged = base ? localFp !== baseFp : !!local;
    const remoteChanged = base ? remoteFp !== baseFp : !!remote;
    if (!localChanged) return;

    if (!base && local && remote && remoteFp !== localFp) {
      const row = opsCloudClone(local);
      row.id = nextId++;
      mergedRows.push(row);
      mergedMap.set(opsCloudRowKey(row), row);
      return;
    }

    if (base && !local) {
      if (remote && remoteChanged) {
        conflicts.push(key);
        return;
      }
      const existing = mergedMap.get(key);
      if (existing) {
        const idx = mergedRows.indexOf(existing);
        if (idx >= 0) mergedRows.splice(idx, 1);
        mergedMap.delete(key);
      }
      return;
    }

    if (base && local && remoteChanged && remoteFp !== localFp) {
      conflicts.push(key);
      return;
    }
    if (local) putLocalRow(key, local);
  });

  if (conflicts.length) return { ok:false, reason:'row-conflict', conflicts };

  const merged = opsCloudClone(remoteData);
  merged.RECEIVABLES = mergedRows;
  merged.USER_PERMISSIONS = mergedPermissions.data;
  merged.AUDIT_LOGS = opsCloudMergeAuditLogs(remoteData, localData);
  merged.rvNextId = Math.max(nextId, opsCloudNextNumericId(mergedRows));
  merged.auditNextId = Math.max(Number(remoteData.auditNextId) || 1, Number(localData.auditNextId) || 1, opsCloudNextNumericId(merged.AUDIT_LOGS));
  merged.savedAt = new Date().toISOString();
  merged.appVersion = '1.3.37';
  return { ok:true, data:merged };
}

async function opsCloudTryMergePendingReceivables(localSnapshot) {
  if (!opsCloudBaseSnapshot || !localSnapshot) return false;
  const snap = await opsCloudRef().get();
  if (!snap.exists()) return false;
  const remotePayload = snap.val();
  const remoteData = remotePayload?.data || remotePayload;
  const error = validateBackupSnapshot(remoteData);
  if (error) return false;
  const merged = opsCloudMergeReceivables(opsCloudBaseSnapshot, localSnapshot, remoteData);
  if (!merged.ok) {
    if (merged.reason === 'row-conflict') {
      opsCloudLastSummary = `同一筆應收帳款已被其他人更新：${merged.conflicts.length} 筆`;
    } else if (merged.reason === 'user-permission-conflict') {
      opsCloudLastSummary = `同一位員工權限已被其他人更新：${merged.conflicts.length} 筆`;
    }
    return false;
  }
  const payload = await opsCloudSaveNow(merged.data, { force:true });
  opsApplyCloudPayload(payload, { silent:true });
  showToast('已逐筆合併應收帳款並同步雲端', 'success');
  return true;
}

function opsCloudChangedOutsidePayables(baseData, localData) {
  const allowed = new Set(['PAYABLES','AUDIT_LOGS','USER_PERMISSIONS','pyNextId','auditNextId','savedAt','appVersion']);
  const keys = new Set([...Object.keys(baseData || {}), ...Object.keys(localData || {})]);
  for (const key of keys) {
    if (allowed.has(key)) continue;
    if (JSON.stringify(baseData?.[key] ?? null) !== JSON.stringify(localData?.[key] ?? null)) return true;
  }
  return false;
}

function opsCloudMergePayables(baseData, localData, remoteData) {
  if (!baseData || !localData || !remoteData) return { ok:false, reason:'missing-base' };
  if (opsCloudChangedOutsidePayables(baseData, localData)) return { ok:false, reason:'outside-payable-change' };
  const mergedPermissions = opsCloudMergeUserPermissions(baseData, localData, remoteData);
  if (!mergedPermissions.ok) return { ok:false, reason:'user-permission-conflict', conflicts:mergedPermissions.conflicts };
  const baseRows = baseData.PAYABLES || [];
  const localRows = localData.PAYABLES || [];
  const remoteRows = remoteData.PAYABLES || [];
  const baseMap = opsCloudMapRows(baseRows);
  const localMap = opsCloudMapRows(localRows);
  const remoteMap = opsCloudMapRows(remoteRows);
  const mergedRows = remoteRows.map(opsCloudClone);
  const mergedMap = opsCloudMapRows(mergedRows);
  const conflicts = [];
  let nextId = Math.max(opsCloudNextNumericId(mergedRows), opsCloudNextNumericId(localRows), Number(remoteData.pyNextId) || 1, Number(localData.pyNextId) || 1);

  const putLocalRow = (key, localRow) => {
    const row = opsCloudClone(localRow);
    const existing = mergedMap.get(key);
    if (existing) {
      const idx = mergedRows.indexOf(existing);
      if (idx >= 0) mergedRows[idx] = row;
      mergedMap.set(key, row);
      return;
    }
    if (row.id !== undefined && row.id !== null && mergedRows.some(r => String(r.id) === String(row.id))) {
      row.id = nextId++;
    }
    mergedRows.push(row);
    mergedMap.set(opsCloudRowKey(row), row);
  };

  const allKeys = new Set([...baseMap.keys(), ...localMap.keys()]);
  allKeys.forEach(key => {
    const base = baseMap.get(key);
    const local = localMap.get(key);
    const remote = remoteMap.get(key);
    const baseFp = opsCloudRowFingerprint(base);
    const localFp = opsCloudRowFingerprint(local);
    const remoteFp = opsCloudRowFingerprint(remote);
    const localChanged = base ? localFp !== baseFp : !!local;
    const remoteChanged = base ? remoteFp !== baseFp : !!remote;
    if (!localChanged) return;

    if (!base && local && remote && remoteFp !== localFp) {
      const row = opsCloudClone(local);
      row.id = nextId++;
      mergedRows.push(row);
      mergedMap.set(opsCloudRowKey(row), row);
      return;
    }

    if (base && !local) {
      if (remote && remoteChanged) {
        conflicts.push(key);
        return;
      }
      const existing = mergedMap.get(key);
      if (existing) {
        const idx = mergedRows.indexOf(existing);
        if (idx >= 0) mergedRows.splice(idx, 1);
        mergedMap.delete(key);
      }
      return;
    }

    if (base && local && remoteChanged && remoteFp !== localFp) {
      conflicts.push(key);
      return;
    }
    if (local) putLocalRow(key, local);
  });

  if (conflicts.length) return { ok:false, reason:'row-conflict', conflicts };

  const merged = opsCloudClone(remoteData);
  merged.PAYABLES = mergedRows;
  merged.USER_PERMISSIONS = mergedPermissions.data;
  merged.AUDIT_LOGS = opsCloudMergeAuditLogs(remoteData, localData);
  merged.pyNextId = Math.max(nextId, opsCloudNextNumericId(mergedRows));
  merged.auditNextId = Math.max(Number(remoteData.auditNextId) || 1, Number(localData.auditNextId) || 1, opsCloudNextNumericId(merged.AUDIT_LOGS));
  merged.savedAt = new Date().toISOString();
  merged.appVersion = '1.3.37';
  return { ok:true, data:merged };
}

async function opsCloudTryMergePendingPayables(localSnapshot) {
  if (!opsCloudBaseSnapshot || !localSnapshot) return false;
  const snap = await opsCloudRef().get();
  if (!snap.exists()) return false;
  const remotePayload = snap.val();
  const remoteData = remotePayload?.data || remotePayload;
  const error = validateBackupSnapshot(remoteData);
  if (error) return false;
  const merged = opsCloudMergePayables(opsCloudBaseSnapshot, localSnapshot, remoteData);
  if (!merged.ok) {
    if (merged.reason === 'row-conflict') {
      opsCloudLastSummary = `同一筆應付帳款已被其他人更新：${merged.conflicts.length} 筆`;
    } else if (merged.reason === 'user-permission-conflict') {
      opsCloudLastSummary = `同一位員工權限已被其他人更新：${merged.conflicts.length} 筆`;
    }
    return false;
  }
  const payload = await opsCloudSaveNow(merged.data, { force:true });
  opsApplyCloudPayload(payload, { silent:true });
  showToast('已逐筆合併應付帳款並同步雲端', 'success');
  return true;
}

async function opsCloudAssertNoRemoteConflict(options = {}) {
  if (options.force || !OPS_AUTH_ENFORCED || !opsCloudReady || opsApplyingRemote) return true;
  const snap = await opsCloudRef().get();
  if (!snap.exists()) return true;
  const payload = snap.val();
  const remoteSavedAt = opsCloudPayloadSavedAt(payload);
  const remoteBy = payload?.meta?.savedBy || '';
  if (remoteSavedAt && opsCloudLastSavedAt && remoteSavedAt !== opsCloudLastSavedAt) {
    opsCloudConflict = true;
    const by = remoteBy ? `｜${remoteBy}` : '';
    opsCloudLastSummary = `雲端有較新資料：${formatDateTimeTW(remoteSavedAt)}${by}`;
    updateDataStatus();
    throw new Error(`OPS_CLOUD_CONFLICT:${remoteSavedAt}`);
  }
  return true;
}

async function opsCloudSaveNow(snapshot, options = {}) {
  if (!OPS_AUTH_ENFORCED || !opsAuthenticatedEmail || opsApplyingRemote) return false;
  await opsCloudRequireFirebaseUser();
  await opsCloudAssertNoRemoteConflict(options);
  const payload = opsCloudPayload(snapshot || createDataSnapshot());
  await opsCloudRef().set(payload);
  opsCloudReady = true;
  opsCloudConflict = false;
  opsCloudLastSavedAt = payload.meta.savedAt;
  opsCloudLastSavedBy = payload.meta.savedBy;
  opsCloudLastSummary = `${formatDateTimeTW(payload.meta.savedAt)}｜${opsSnapshotSummary(payload.data)}`;
  opsCloudBaseSnapshot = opsCloudClone(payload.data);
  updateDataStatus(payload.data);
  return payload;
}

function showCloudConflictModal() {
  if (opsCloudConflictModalShown) return;
  opsCloudConflictModalShown = true;
  const msgEl = document.getElementById('cloud-conflict-message');
  if (msgEl) msgEl.textContent = opsCloudLastSummary || '雲端已有較新的資料。';
  openModal('modal-cloud-conflict');
}

function prLiveCalc() {
  const p = id => parseMoneyInput(document.getElementById(id)?.value || '0') || 0;
  const aTotal = p('pr-baseSalary') + p('pr-phoneAllowance') + p('pr-fullAttendanceBonus') + p('pr-dutyAllowance') + p('pr-performanceBonus') + p('pr-mealAllowance');
  const bBase  = p('pr-overtimePay') + p('pr-expenseReimbursement') + p('pr-yearEndBonus') + p('pr-engineeringBonus');
  const bCustom = prGetCustomItems ? prGetCustomItems().reduce((s,it)=>s+it.amount,0) : 0;
  const bTotal = bBase + bCustom;
  const cTotal = p('pr-laborInsurance') + p('pr-healthInsurance') + p('pr-voluntaryPension') + p('pr-leaveDeduction');
  const net = aTotal + bTotal - cTotal;
  const transfer = net - p('pr-advancePaid');
  const fmt = n => '$' + Math.round(n).toLocaleString('zh-TW');
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = fmt(val); };
  set('pr-live-a', aTotal);
  set('pr-live-b', bTotal);
  set('pr-live-c', cTotal);
  set('pr-live-net', net);
  set('pr-live-transfer', transfer);
}

function reloadForCloudConflict() {
  try { sessionStorage.setItem('opsRestorePage', currentPage); } catch(e) {}
  location.reload();
}

function opsSnapshotTimeMs(value) {
  const t = Date.parse(value || '');
  return Number.isFinite(t) ? t : 0;
}

// 同步卡住警告視窗：存檔一直沒送上雲端時跳出來，不會被使用者沒注意到的小提示蓋過去。
function showSyncStuckModal() {
  if (opsCloudStuckModalShown) return;
  opsCloudStuckModalShown = true;
  const msgEl = document.getElementById('sync-stuck-message');
  if (msgEl) {
    const sec = opsCloudPendingSince ? Math.round((Date.now() - opsCloudPendingSince) / 1000) : 0;
    msgEl.textContent = `已經 ${sec} 秒沒有成功同步到雲端，你剛剛輸入的資料目前只存在這台電腦，同事還看不到。`;
  }
  openModal('modal-sync-stuck');
}
function hideSyncStuckModalIfShown() {
  if (!opsCloudStuckModalShown) return;
  opsCloudStuckModalShown = false;
  closeModal('modal-sync-stuck');
}
function opsCloudRetrySyncNow() {
  showToast('正在重新嘗試同步…', 'success');
  opsCloudFlushPendingSave();
}

// 存檔成功或失敗都會清掉/重設這個狀態，watchdog 每幾秒檢查一次有沒有卡住。
function opsCloudFlushPendingSave() {
  if (!opsCloudPendingSnapshot || opsApplyingRemote) return;
  if (!opsCloudReady) return; // 還沒連上雲端，等下一次 watchdog tick 再試
  // 存檔本身是兩段網路來回（先讀一次雲端確認沒衝突、再寫入），單趟若超過 4 秒（watchdog 週期）
  // 就可能跟下一次 watchdog tick 或下一筆修改的存檔同時送出。兩個 opsCloudSaveNow() 同時在路上時，
  // 後送出的那個讀到「雲端已經是前一個自己剛寫入的版本」，卻因為前一個還沒把 opsCloudLastSavedAt
  // 更新完成，就會誤判成「被別人（或別的分頁）覆蓋」而跳出衝突視窗——實際上只是自己跟自己搶跑。
  // 這裡用 opsCloudSaveInFlight 擋掉重疊呼叫；存檔期間如果又有新的修改進來，等這次存完再補送一次。
  if (opsCloudSaveInFlight) return;
  const frozen = opsCloudPendingSnapshot;
  clearTimeout(opsCloudSaveTimer);
  opsCloudSaveTimer = null;
  opsCloudSaveInFlight = true;
  setSaveIndicator('syncing');
  opsCloudSaveNow(frozen).then(() => {
    opsCloudSaveInFlight = false;
    opsCloudConsecutiveFailures = 0;
    if (opsCloudPendingSnapshot === frozen) {
      opsCloudPendingSync = false;
      opsCloudPendingSnapshot = null;
      opsCloudPendingSince = null;
      hideSyncStuckModalIfShown();
      setSaveIndicator('synced');
    } else {
      // 存檔期間又累積了更新的修改，立刻補送最新版本，不要等下一次 watchdog tick。
      setSaveIndicator('synced');
      opsCloudFlushPendingSave();
    }
  }).catch(e => {
    opsCloudSaveInFlight = false;
    opsCloudConsecutiveFailures++;
    console.warn('OPS cloud save failed:', e);
    updateDataStatus(frozen);
    setSaveIndicator('error');
    if (String(e?.message || '').includes('OPS_CLOUD_CONFLICT')) {
      opsCloudTryMergePendingReceivables(frozen).then(merged => {
        if (merged) return true;
        return opsCloudTryMergePendingPayables(frozen);
      }).then(merged => {
        if (merged) return true;
        return opsCloudTryMergePendingOtherRows(frozen);
      }).then(merged => {
        if (merged) return true;
        return opsCloudTryMergePendingOverhead(frozen);
      }).then(merged => {
        if (merged) {
          opsCloudConsecutiveFailures = 0;
          hideSyncStuckModalIfShown();
          setSaveIndicator('synced');
          if (opsCloudPendingSnapshot === frozen) {
            opsCloudPendingSync = false;
            opsCloudPendingSnapshot = null;
            opsCloudPendingSince = null;
          } else {
            opsCloudFlushPendingSave();
          }
        } else {
          showCloudConflictModal();
        }
      }).catch(mergeErr => {
        console.warn('OPS row merge failed:', mergeErr);
        showCloudConflictModal();
      });
    } else {
      showToast(opsCloudErrorMessage(e, '雲端同步'), 'error');
    }
  });
}

function opsCloudWatchdogTick() {
  if (!OPS_AUTH_ENFORCED || !opsAuthenticatedEmail) return;
  if (!opsCloudPendingSnapshot) { hideSyncStuckModalIfShown(); return; }
  const stuckMs = opsCloudPendingSince ? Date.now() - opsCloudPendingSince : 0;
  if (stuckMs > 8000) showSyncStuckModal();
  if (!opsCloudReady) {
    // 雲端連線本身還沒 ready（可能是 Firebase 初始化失敗），不能只乾等，嘗試重新連線。
    opsCloudStart().catch(e => console.warn('OPS cloud watchdog reconnect failed:', e));
    return;
  }
  // 不管目前是否已顯示警告，只要還有沒送出的資料，每次 tick 都嘗試補推一次。
  opsCloudFlushPendingSave();
}
function opsCloudStartWatchdog() {
  if (opsCloudWatchdogTimer) return;
  opsCloudWatchdogTimer = setInterval(opsCloudWatchdogTick, 4000);
}

function opsCloudQueueSave(snapshot) {
  if (!OPS_AUTH_ENFORCED || opsApplyingRemote) return;
  if (!opsAuthenticatedEmail) { setSaveIndicator('local'); return; }
  clearTimeout(opsCloudSaveTimer);
  opsCloudPendingSync = true;
  if (!opsCloudPendingSnapshot) opsCloudPendingSince = Date.now();
  setSaveIndicator('syncing');
  const frozen = JSON.parse(JSON.stringify(snapshot));
  opsCloudPendingSnapshot = frozen;
  opsCloudStartWatchdog();
  if (!opsCloudReady) {
    updateDataStatus(frozen);
    return;
  }
  opsCloudSaveTimer = setTimeout(() => opsCloudFlushPendingSave(), 900);
}

function opsApplyCloudPayload(payload, options = {}) {
  const data = payload?.data || payload;
  const meta = payload?.meta || {};
  const error = validateBackupSnapshot(data);
  if (error) {
    console.warn('OPS cloud snapshot invalid:', error);
    showToast(`雲端資料格式異常：${error}`, 'error');
    return false;
  }
  opsApplyingRemote = true;
  try {
    applyDataSnapshot(data);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    opsCloudReady = true;
    opsCloudConflict = false;
    opsCloudLastSavedAt = meta.savedAt || data.savedAt || '';
    opsCloudLastSavedBy = meta.savedBy || '';
    opsCloudLastSummary = `${formatDateTimeTW(opsCloudLastSavedAt)}｜${opsSnapshotSummary(data)}`;
    opsCloudBaseSnapshot = opsCloudClone(data);
    renderAfterDataSettles('cloud-apply');
    updateDataStatus(data);
    if (!options.silent) {
      const by = opsCloudLastSavedBy ? `（${opsCloudLastSavedBy}）` : '';
      showToast(`已套用雲端資料${by}`, 'success');
    }
    return true;
  } finally {
    opsApplyingRemote = false;
  }
}

async function opsCloudCheckNow() {
  if (!OPS_AUTH_ENFORCED) { showToast('本機 file 模式不會連 Firebase', 'warning'); return false; }
  if (!opsAuthenticatedEmail) { showToast('請先用 Google 帳號登入', 'error'); return false; }
  if (!requireManage('dashboard', '只有完整管理者可以檢查雲端快照')) return false;
  try {
    await opsCloudRequireFirebaseUser();
    const snap = await opsCloudRef().get();
    if (!snap.exists()) {
      opsCloudReady = false;
      opsCloudLastSavedAt = '';
      opsCloudLastSavedBy = '';
      opsCloudBaseSnapshot = null;
      opsCloudLastSummary = 'Firebase 尚無資料';
      updateDataStatus();
      showToast('Firebase 尚無 OPS 快照，可按「上傳本機快照」建立', 'warning');
      return false;
    }
    const payload = snap.val();
    const data = payload?.data || payload;
    const meta = payload?.meta || {};
    const error = validateBackupSnapshot(data);
    if (error) {
      opsCloudLastSummary = `格式異常：${error}`;
      updateDataStatus();
      showToast(`雲端快照格式異常：${error}`, 'error');
      return false;
    }
    const remoteSavedAt = meta.savedAt || data.savedAt || '';
    const localMeta = getLocalDataMeta();
    const localDiffers = !localMeta ||
      localMeta.savedAt !== remoteSavedAt ||
      Number(localMeta.cases || 0) !== Number(data.CASES?.length || 0) ||
      Number(localMeta.payables || 0) !== Number(data.PAYABLES?.length || 0) ||
      Number(localMeta.receivables || 0) !== Number(data.RECEIVABLES?.length || 0);
    if (localDiffers) {
      opsApplyCloudPayload(payload, { silent:true });
      showToast('已套用雲端快照並更新畫面', 'success');
      return true;
    }
    opsCloudReady = true;
    opsCloudConflict = false;
    opsCloudLastSavedAt = remoteSavedAt;
    opsCloudLastSavedBy = meta.savedBy || '';
    opsCloudLastSummary = `${formatDateTimeTW(opsCloudLastSavedAt)}｜${opsSnapshotSummary(data)}`;
    opsCloudBaseSnapshot = opsCloudClone(data);
    updateDataStatus(data);
    showToast('雲端快照檢查完成', 'success');
    return true;
  } catch(e) {
    console.warn('OPS cloud check failed:', e);
    opsCloudReady = false;
    opsCloudLastSummary = 'Firebase 檢查失敗';
    updateDataStatus();
    showToast(opsCloudErrorMessage(e, '雲端快照檢查'), 'error');
    return false;
  }
}

async function opsCloudPushLocalNow() {
  if (!OPS_AUTH_ENFORCED) { showToast('本機 file 模式不會連 Firebase', 'warning'); return false; }
  if (!opsAuthenticatedEmail) { showToast('請先用 Google 帳號登入', 'error'); return false; }
  if (!requireManage('dashboard', '只有完整管理者可以上傳雲端快照')) return false;
  const snapshot = createDataSnapshot();
  const summary = opsSnapshotSummary(snapshot);
  let remoteWarning = '';
  try {
    await opsCloudRequireFirebaseUser();
    const snap = await opsCloudRef().get();
    if (snap.exists()) {
      const payload = snap.val();
      const remoteSavedAt = opsCloudPayloadSavedAt(payload);
      if (remoteSavedAt && remoteSavedAt !== opsCloudLastSavedAt) {
        const remoteBy = payload?.meta?.savedBy || '';
        const remoteSummary = opsSnapshotSummary(payload?.data || payload);
        remoteWarning = `\n\n⚠️ 雲端目前的資料比你最後看到的更新：\n${formatDateTimeTW(remoteSavedAt)}${remoteBy ? '｜' + remoteBy : ''}\n${remoteSummary}\n上傳會覆蓋掉這份雲端資料！`;
      }
    }
  } catch(e) {
    console.warn('OPS cloud pre-check failed:', e);
  }
  if (!confirm(`確定要用目前這台瀏覽器資料覆蓋 Firebase 快照？\n\n${summary}${remoteWarning}\n\n測試前建議先下載資料備份。`)) return false;
  try {
    await opsCloudSaveNow(snapshot, { force:true });
    showToast('本機快照已上傳到 Firebase', 'success');
    return true;
  } catch(e) {
    console.warn('OPS cloud push failed:', e);
    showToast(opsCloudErrorMessage(e, '上傳雲端快照'), 'error');
    return false;
  }
}

async function opsCloudStart() {
  if (!OPS_AUTH_ENFORCED || !opsAuthenticatedEmail) return;
  try {
    await opsCloudRequireFirebaseUser();
    const ref = opsCloudRef();
    const initial = await ref.get();
    if (initial.exists()) {
      const payload = initial.val();
      // 初次連上雲端時一律以雲端資料為準，不管本機看起來多新都不自動覆蓋雲端：
      // 「本機比較新就補推」這個邏輯曾經造成真實資料遺失事故——使用者在頁面剛載入、
      // Firebase 還沒連上的那一兩秒內隨手做了一個操作，觸發 saveData() 把當下還沒
      // 套用雲端資料的舊本機快取存進 opsCloudPendingSnapshot，等 Firebase 連上後，
      // 這份「時間戳碼比雲端新，但內容其實沒有雲端最新資料」的舊快取被判定成「比較新」，
      // 整包覆蓋掉雲端，蓋掉同事已經同步好的資料。修正後一律套用雲端，本機若有還沒送出
      // 的編輯就清掉並提示使用者，不再讓任何本機快取有機會在初次連線時贏過雲端正本。
      const hadPending = !!opsCloudPendingSnapshot;
      opsCloudPendingSnapshot = null;
      opsCloudPendingSync = false;
      opsCloudPendingSince = null;
      hideSyncStuckModalIfShown();
      opsApplyCloudPayload(payload, { silent:true });
      if (hadPending) {
        showToast('剛剛雲端連線完成前的本機修改可能還沒送出，請確認資料是否需要重新輸入一次', 'error');
      }
    } else {
      await opsCloudSaveNow(createDataSnapshot());
      showToast('已建立 OPS 雲端同步資料庫', 'success');
    }
    ref.off('value');
    ref.on('value', snap => {
      const payload = snap.val();
      if (!payload) return;
      const meta = payload.meta || {};
      if (meta.savedAt && meta.savedAt === opsCloudLastSavedAt) return;
      if (opsCloudPendingSnapshot) {
        // 本機還有沒存出去的修改：不要直接套用同事剛存的版本蓋過你正在打的東西。
        // 等你這筆存檔送出時，opsCloudAssertNoRemoteConflict 會偵測到衝突並跳出提醒重新整理。
        return;
      }
      opsApplyCloudPayload(payload, { silent: meta.savedBy === opsAuthenticatedEmail });
    }, err => {
      console.warn('OPS cloud listener failed:', err);
      showToast('雲端監聽中斷，請重新整理後再測試', 'error');
    });
    updateDataStatus();
  } catch(e) {
    console.warn('OPS cloud start failed:', e);
    opsCloudReady = false;
    updateDataStatus();
    showToast(opsCloudErrorMessage(e, '雲端同步'), 'error');
  }
}

// 手機瀏覽器背景化（鎖螢幕／切到其他 App）常會暫停 JS 計時器與即時監聽的連線；
// 回到前景時單靠既有的 `.on('value')` 監聽或 4 秒一次的 watchdog 不一定會馬上補回來，
// 導致手機畫面停在舊資料，或剛送出的請款卡在本機沒真的推上 Firebase。
// 回到前景時主動補推待送資料、並在沒有待送資料時重新讀一次雲端正本，兩邊都不會覆蓋掉使用者還沒送出的編輯。
async function opsCloudRefreshOnForeground() {
  if (!OPS_AUTH_ENFORCED || !opsAuthenticatedEmail) return;
  if (opsCloudPendingSnapshot) { opsCloudFlushPendingSave(); return; }
  if (!opsCloudReady) { opsCloudStart().catch(e => console.warn('OPS cloud foreground reconnect failed:', e)); return; }
  try {
    const snap = await opsCloudRef().get();
    if (!snap.exists()) return;
    const payload = snap.val();
    const meta = payload?.meta || {};
    if (meta.savedAt && meta.savedAt === opsCloudLastSavedAt) return;
    if (opsCloudPendingSnapshot) return;
    opsApplyCloudPayload(payload, { silent: meta.savedBy === opsAuthenticatedEmail });
  } catch(e) {
    console.warn('OPS cloud foreground refresh failed:', e);
  }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') opsCloudRefreshOnForeground();
});
window.addEventListener('pageshow', () => {
  if (document.visibilityState === 'visible') opsCloudRefreshOnForeground();
});

function opsUnlockForUser(user, email = '', options = {}) {
  if (!user) return false;
  opsAuthenticatedEmail = String(email || '').toLowerCase();
  opsAuthenticatedUserId = user.id;
  document.body.classList.remove('auth-pending');
  const authUserEl = document.getElementById('ops-auth-user');
  if (authUserEl) {
    authUserEl.style.display = OPS_AUTH_ENFORCED ? '' : 'none';
    authUserEl.textContent = OPS_AUTH_ENFORCED ? `登入：${opsAuthenticatedEmail}` : '';
  }
  const logoutBtn = document.getElementById('ops-logout-btn');
  if (logoutBtn) logoutBtn.style.display = OPS_AUTH_ENFORCED ? '' : 'none';
  const modeMsg = document.getElementById('ops-mode-message');
  if (modeMsg) {
    modeMsg.innerHTML = OPS_AUTH_ENFORCED
      ? '目前以 <strong style="color:var(--accent)">正式雲端同步</strong> 執行：僅開放公司帳號登入，資料即時同步到 Firebase Realtime Database，並保留本機快取。'
      : '目前以 <strong style="color:var(--accent)">本機離線模式</strong> 執行：資料只存在這台瀏覽器，未連上正式雲端同步，僅供本機開發／除錯使用。';
  }
  // applyRole 跟畫面渲染若拋錯，不能讓它往上傳到呼叫端，否則登入流程後面要做的
  // opsCloudStart()（建立雲端連線）會被整段跳過，造成「畫面渲染小 bug 卻讓雲端同步永久連不上」。
  try {
    applyRole(user);
    initRoleOptions();
    if (options.render !== false) renderAfterDataSettles('auth-unlock');
  } catch (e) {
    console.warn('OPS applyRole/render failed (cloud sync will continue):', e);
    showToast('登入後部分畫面渲染異常，請重新整理頁面；雲端同步仍會繼續嘗試連線。', 'error');
  }
  return true;
}

function opsInitGoogleAuth() {
  if (!OPS_AUTH_ENFORCED) {
    opsUnlockForUser(USERS[0], 'local-dev');
    return;
  }
  const session = opsReadAuthSession();
  const sessionUser = session ? opsAuthUserByEmail(session.email) : null;
  if (sessionUser) {
    try {
      opsInitFirebase();
      firebase.auth().onAuthStateChanged(async user => {
        const email = String(user?.email || '').toLowerCase();
        if (email === String(session.email || '').toLowerCase()) {
          opsAuthSetError('');
          opsUnlockForUser(sessionUser, session.email, { render:false });
          await opsCloudStart();
          renderAfterDataSettles('session-cloud-ready');
        } else {
          localStorage.removeItem(OPS_AUTH_SESSION_KEY);
          opsAuthSetError('請重新登入以啟用雲端同步。');
        }
      });
    } catch(e) {
      console.warn('OPS session cloud auth failed:', e);
      localStorage.removeItem(OPS_AUTH_SESSION_KEY);
      opsAuthSetError('雲端同步模組尚未載入，請稍候重新整理。');
    }
    return;
  }
  if (!window.google?.accounts?.oauth2) {
    if (opsAuthInitAttempts < 20) {
      opsAuthInitAttempts += 1;
      setTimeout(opsInitGoogleAuth, 300);
      return;
    }
    opsAuthSetError('Google 登入模組尚未載入，請稍候重新整理。');
    return;
  }
  opsAuthInitAttempts = 0;
  opsLoginTokenClient = google.accounts.oauth2.initTokenClient({
    client_id: OPS_GOOGLE_CLIENT_ID,
    scope: 'https://www.googleapis.com/auth/userinfo.email',
    callback: async (resp) => {
      opsAuthSetLoading(false);
      if (resp.error) {
        opsAuthSetError('Google 授權失敗，請再試一次。');
        return;
      }
      try {
        const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: 'Bearer ' + resp.access_token }
        });
        const profile = await res.json();
        const email = String(profile.email || '').toLowerCase();
        const user = opsAuthUserByEmail(email);
        if (!user) {
          opsAuthSetError(`此帳號尚未開通 OPS：${email || '未知帳號'}`);
          if (window.google?.accounts?.oauth2?.revoke) google.accounts.oauth2.revoke(resp.access_token);
          return;
        }
        await opsFirebaseSignIn(resp.access_token, email);
        localStorage.setItem(OPS_AUTH_SESSION_KEY, JSON.stringify({ email, loginTime: Date.now() }));
        opsAuthSetError('');
        opsUnlockForUser(user, email, { render:false });
        await opsCloudStart();
        renderAfterDataSettles('login-cloud-ready');
        showToast(`已登入：${user.name}`, 'success');
      } catch(e) {
        console.warn('OPS auth failed:', e);
        opsAuthSetError('登入驗證失敗，請確認網路與 Google 帳號狀態。');
      }
    }
  });
}

function opsStartGoogleLogin() {
  if (!OPS_AUTH_ENFORCED) {
    opsUnlockForUser(USERS[0], 'local-dev');
    return;
  }
  if (!opsLoginTokenClient) {
    opsInitGoogleAuth();
    if (!opsLoginTokenClient) return;
  }
  opsAuthSetError('');
  opsAuthSetLoading(true);
  opsLoginTokenClient.requestAccessToken({ prompt:'select_account' });
}

function opsLogout() {
  localStorage.removeItem(OPS_AUTH_SESSION_KEY);
  if (window.firebase?.auth) firebase.auth().signOut().catch(e => console.warn('OPS firebase signOut failed:', e));
  if (OPS_AUTH_ENFORCED) location.reload();
}

function initSidebarStatusResizer() {
  const key = 'yutesign_ops_sidebar_bottom_h_v2';
  const root = document.documentElement;
  const resizer = document.getElementById('sidebar-resizer');
  const sidebar = document.getElementById('sidebar');
  const bottom = document.querySelector('.sidebar-bottom');
  if (!resizer || !bottom || !sidebar) return;
  const maxBottom = () => Math.min(360, Math.round(window.innerHeight * 0.42));
  const clamp = value => Math.max(112, Math.min(maxBottom(), Number(value) || 210));
  const applyHeight = value => {
    const next = clamp(value);
    root.style.setProperty('--sidebar-bottom-h', next + 'px');
    localStorage.setItem(key, String(next));
  };
  const saved = parseInt(localStorage.getItem(key) || '', 10);
  applyHeight(saved || 210);

  let dragging = false;
  let startY = 0;
  let startH = 0;
  let moved = false;
  const currentHeight = () => parseInt(getComputedStyle(bottom).height || '', 10) || 210;
  const stop = e => {
    if (!dragging) return;
    dragging = false;
    resizer.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    if (e?.pointerId != null && resizer.releasePointerCapture) {
      try { resizer.releasePointerCapture(e.pointerId); } catch (_) {}
    }
    if (!moved) {
      const h = currentHeight();
      applyHeight(h > 150 ? 112 : 210);
    }
  };
  const move = e => {
    if (!dragging) return;
    const dy = e.clientY - startY;
    if (Math.abs(dy) > 3) moved = true;
    applyHeight(startH - dy);
    e.preventDefault();
  };
  const start = e => {
    if (window.innerWidth <= 768) return;
    dragging = true;
    moved = false;
    startY = e.clientY;
    startH = currentHeight();
    resizer.classList.add('dragging');
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    if (e.pointerId != null && resizer.setPointerCapture) resizer.setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  resizer.addEventListener('pointerdown', start);
  resizer.addEventListener('pointermove', move);
  resizer.addEventListener('pointerup', stop);
  resizer.addEventListener('pointercancel', stop);
  window.addEventListener('resize', () => applyHeight(currentHeight()));
}
