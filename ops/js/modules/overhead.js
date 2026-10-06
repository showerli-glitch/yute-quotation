// OVERHEAD MODULE. Extracted verbatim from ops/index.html at main@38986cf.

// ══════════════════════════════════
// OVERHEAD DATA
// ══════════════════════════════════
const OH_WATER_ELECTRIC_SPLIT_MONTH = '2026-03';
const OH_LEGACY_FIXED_ITEMS = [
  '房租','水電','瓦斯','勞保','健保','勞退','員工薪資',
  '衛星犬資料處理','飲水機保養費','google訂閱費','市話','公務機話費',
  '網路費','會計師記帳費','外聘清潔費','員工福利公司飲料','貨車保養維修','文具影印機紙張墨水'
];
const OH_FIXED_ITEMS = [
  '房租','水電','水費','電費','瓦斯','勞保','健保','勞退','員工薪資',
  '衛星犬資料處理','飲水機保養費','google訂閱費','市話','公務機話費',
  '網路費','會計師記帳費','外聘清潔費','員工福利公司飲料','貨車保養維修','文具影印機紙張墨水'
];
// 可自訂的固定支出項目清單（從 OH_FIXED_ITEMS 初始化，存入 snapshot）
let OH_FIXED_CONFIG = [...OH_FIXED_ITEMS];

let OVERHEAD = {};
let ohVarNextId = 1;

function ohMigrateWaterElectricSplit() {
  const legacyIdx = OH_FIXED_CONFIG.indexOf('水電');
  if (legacyIdx < 0) return false;
  let waterIdx = OH_FIXED_CONFIG.indexOf('水費');
  let electricIdx = OH_FIXED_CONFIG.indexOf('電費');
  if (waterIdx < 0) {
    OH_FIXED_CONFIG.splice(legacyIdx + 1, 0, '水費');
    Object.values(OVERHEAD).forEach(data => {
      if (!data || typeof data !== 'object') return;
      if (!Array.isArray(data.fixed)) data.fixed = [];
      if (!Array.isArray(data.fixedNotes)) data.fixedNotes = [];
      data.fixed.splice(legacyIdx + 1, 0, 0);
      data.fixedNotes.splice(legacyIdx + 1, 0, '');
    });
    waterIdx = legacyIdx + 1;
  }
  electricIdx = OH_FIXED_CONFIG.indexOf('電費');
  if (electricIdx < 0) {
    OH_FIXED_CONFIG.splice(waterIdx + 1, 0, '電費');
    Object.values(OVERHEAD).forEach(data => {
      if (!data || typeof data !== 'object') return;
      if (!Array.isArray(data.fixed)) data.fixed = [];
      if (!Array.isArray(data.fixedNotes)) data.fixedNotes = [];
      data.fixed.splice(waterIdx + 1, 0, 0);
      data.fixedNotes.splice(waterIdx + 1, 0, '');
    });
    electricIdx = waterIdx + 1;
  }
  Object.entries(OVERHEAD).forEach(([month, data]) => {
    if (month < OH_WATER_ELECTRIC_SPLIT_MONTH || !data || typeof data !== 'object') return;
    if (!Array.isArray(data.fixed)) data.fixed = [];
    if (!Array.isArray(data.fixedNotes)) data.fixedNotes = [];
    const legacyAmount = parseInt(data.fixed[legacyIdx]) || 0;
    if (legacyAmount && !(parseInt(data.fixed[electricIdx]) || 0)) data.fixed[electricIdx] = legacyAmount;
    if (legacyAmount) data.fixed[legacyIdx] = 0;
    const legacyNote = String(data.fixedNotes[legacyIdx] || '');
    if (legacyNote && !data.fixedNotes[electricIdx]) data.fixedNotes[electricIdx] = legacyNote;
    if (legacyNote) data.fixedNotes[legacyIdx] = '';
  });
  return true;
}

// ══════════════════════════════════
// OVERHEAD MODULE
// ══════════════════════════════════
function ohMonthLabel(month) {
  const [year, num] = String(month || '').split('-');
  return `${year}年${Number(num)}月`;
}

function ohAddMonthsAround(months, anchor, monthsBack = 8) {
  const m = String(anchor || '').match(/^(\d{4})-(\d{2})$/);
  if (!m) return;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, 1);
  for (let i = 0; i <= monthsBack; i++) {
    const y = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    months.add(`${y}-${mm}`);
    d.setMonth(d.getMonth() - 1);
  }
}

function ohAddFutureMonths(months, anchor, monthsForward = 3) {
  const m = String(anchor || '').match(/^(\d{4})-(\d{2})$/);
  if (!m) return;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, 1);
  for (let i = 1; i <= monthsForward; i++) {
    d.setMonth(d.getMonth() + 1);
    const y = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    months.add(`${y}-${mm}`);
  }
}

function ohRenderMonthOptions(preferredMonth) {
  const sel = document.getElementById('oh-filter-month');
  if (!sel) return;
  const current = preferredMonth || sel.value || currentMonthKey();
  const months = new Set();
  Object.keys(OVERHEAD || {}).forEach(month => { if (prIsValidMonth(month)) months.add(month); });
  EXPENSES.forEach(row => { if (prIsValidMonth(row.month)) months.add(row.month); });
  PAYROLL_MONTHS.forEach(month => { if (prIsValidMonth(month)) months.add(month); });
  ohAddMonthsAround(months, currentMonthKey(), 8);
  ohAddFutureMonths(months, currentMonthKey(), 3);
  ohAddMonthsAround(months, current, 3);
  ohAddFutureMonths(months, current, 1);
  const sorted = [...months].sort((a,b) => b.localeCompare(a));
  sel.innerHTML = sorted.map(month => `<option value="${month}">${ohMonthLabel(month)}</option>`).join('');
  if (sorted.includes(current)) sel.value = current;
  else if (sorted.length) sel.value = sorted[0];
}

function ohInitMonth(month) {
  // 新月份只建立空白資料，避免瀏覽月份時自動產生看似正式的支出金額。
  OVERHEAD[month] = {
    fixed: OH_FIXED_CONFIG.map(()=>0),
    fixedNotes: OH_FIXED_CONFIG.map(()=>''),
    variable: []
  };
}

function ohPreviousMonthData(month) {
  const sorted = Object.keys(OVERHEAD || {}).filter(m => prIsValidMonth(m) && m < month).sort();
  const prevMonth = sorted[sorted.length - 1];
  return { prevMonth, prevData: prevMonth ? OVERHEAD[prevMonth] : null };
}

// 固定開銷費用項目跟公司開銷固定支出的對應關係：費用申請「付款項目」文字裡包含這個固定支出名稱，就算同一項。
// 房租、員工薪資已經各自有自動連動來源（應付帳款／薪資模組），這裡不重複搶著管。
function ohFixedExpenseMatchName(item) {
  const text = String(item || '');
  return OH_FIXED_CONFIG.find(name => name !== '房租' && name !== '員工薪資' && text.includes(name)) || '';
}
function expApprovedFixedOverheadByMonthItem() {
  const map = new Map();
  EXPENSES.filter(e => e.status === 'approved' && e.caseKey === '固定開銷').forEach(e => {
    const matchName = ohFixedExpenseMatchName(e.item);
    if (!matchName) return;
    const key = `${e.month}|${matchName}`;
    if (!map.has(key)) map.set(key, { month:e.month, item:matchName, total:0, rows:[] });
    const g = map.get(key);
    g.total += Number(e.amount) || 0;
    g.rows.push(e);
  });
  return map;
}
// 2026-04 起：固定支出格子如果跟已核准「固定開銷」費用金額對不起來，只列出來讓使用者自己選「採用目前」或「採用核准」，永遠不自動覆蓋、也不鎖定格子
// （使用者常會先複製上個月數字帶入新月份，若自動連動會把核准金額加在複製的數字上面造成重複計算，所以改成每個月都要人工確認）。
// 2026-03 及更早維持不動，完全不處理（對過帳的期間）。
const OH_FIXED_EXPENSE_REVIEW_FROM = '2026-04';
let ohFixedExpenseReviewList = [];
function expRebuildFixedOverheadLinks() {
  const groups = expApprovedFixedOverheadByMonthItem();
  ohFixedExpenseReviewList = [];
  // 還原舊版（v1.2.99～v1.3.0）9月起自動連動鎖定過的欄位，改回人工可編輯，金額退回鎖定前的手動值
  Object.entries(OVERHEAD || {}).forEach(([, data]) => {
    Object.entries(data?.fixedExpenseManagedItems || {}).forEach(([item, meta]) => {
      const idx = OH_FIXED_CONFIG.indexOf(item);
      if (idx >= 0) {
        data.fixed[idx] = Number(meta.manualBackup) || 0;
        data.fixedNotes[idx] = String(meta.manualNoteBackup || '');
      }
      delete data.fixedExpenseManagedItems[item];
    });
  });
  groups.forEach(g => {
    if (g.month < OH_FIXED_EXPENSE_REVIEW_FROM) return;
    const idx = OH_FIXED_CONFIG.indexOf(g.item);
    if (idx < 0) return;
    if (!OVERHEAD[g.month]) return;
    if (OVERHEAD[g.month].fixedExpenseReviewResolved?.[g.item]) return;
    const current = Number(OVERHEAD[g.month].fixed?.[idx]) || 0;
    const diff = g.total - current;
    if (diff === 0) return;
    ohFixedExpenseReviewList.push({ month:g.month, item:g.item, currentAmount:current, expenseTotal:g.total, diff, count:g.rows.length });
  });
  ohFixedExpenseReviewList.sort((a,b) => a.month === b.month ? a.item.localeCompare(b.item,'zh-TW') : a.month.localeCompare(b.month));
}

function renderOverhead() {
  const manage = canManage('overhead');
  ohRenderMonthOptions();
  expRebuildFixedOverheadLinks();
  const month = document.getElementById('oh-filter-month')?.value || currentMonthKey();
  if (!OVERHEAD[month]) ohInitMonth(month);
  const data = OVERHEAD[month];
  // 確保陣列長度與設定同步
  while (data.fixed.length < OH_FIXED_CONFIG.length) data.fixed.push(0);
  while (data.fixedNotes.length < OH_FIXED_CONFIG.length) data.fixedNotes.push('');
  if (!Array.isArray(data.variable)) data.variable = [];
  // 員工薪資：自動從薪資模組加總，不可手動編輯
  const payrollSum = PAYROLL.filter(r => r.month === month && isOperatingPayrollPerson(r.person))
    .reduce((s,r) => s + payrollNetAmount(r), 0);
  const salaryIdx = OH_FIXED_CONFIG.indexOf('員工薪資');
  if (salaryIdx >= 0) data.fixed[salaryIdx] = payrollSum;

  const fixedTbody = document.getElementById('oh-fixed-tbody');
  if (fixedTbody) {
    fixedTbody.innerHTML = OH_FIXED_CONFIG.map((name,i) => {
      if (month < OH_WATER_ELECTRIC_SPLIT_MONTH && (name === '水費' || name === '電費')) return '';
      if (month >= OH_WATER_ELECTRIC_SPLIT_MONTH && name === '水電') return '';
      const isPayroll = i === salaryIdx;
      const isLinkedRent = name === '房租' && data.rentPayableManaged;
      const isLinkedFixed = !!data.fixedPayableManagedItems?.[name];
      const isLocked = isPayroll || isLinkedRent || isLinkedFixed;
      return `
      <tr style="border-bottom:1px solid var(--border)" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">
        <td style="padding:8px 14px;font-size:12px;white-space:nowrap">${name}</td>
        <td style="padding:4px 8px;text-align:right;white-space:nowrap">
          ${isLocked
            ? `<span style="display:inline-block;width:100px;text-align:right;font-family:'DM Mono',monospace;font-size:12px;font-weight:600;color:var(--text);padding:3px 5px">$${(data.fixed[i]||0).toLocaleString('zh-TW')}</span>`
            : `<span style="font-family:'DM Mono',monospace;font-size:12px;color:var(--text3);padding:3px 2px">$</span><input type="text" value="${(data.fixed[i]||0).toLocaleString('zh-TW')}" ${manage?'':'readonly'}
            style="background:transparent;border:none;outline:none;width:90px;text-align:right;font-family:'DM Mono',monospace;font-size:12px;font-weight:600;color:var(--text);padding:3px 5px;border-radius:4px"
            onfocus="this.style.background='var(--surface2)';this.style.border='1px solid var(--border)';this.value=String(${data.fixed[i]||0})"
            onblur="this.style.background='transparent';this.style.border='none';ohUpdateFixed('${month}',${i},this.value)"
            onkeydown="if(event.key==='Enter')this.blur()">`}
        </td>
        <td style="padding:4px 8px">
          ${isLocked
            ? `<span style="font-size:11px;color:var(--text3)">${isPayroll ? '自動同步薪資模組' : (data.fixedNotes[i] || '由已付款應付帳款自動彙總')}</span>`
            : `<input type="text" value="${(data.fixedNotes[i]||'').replace(/"/g,'&quot;')}" placeholder="備註…" ${manage?'':'readonly'}
              style="background:transparent;border:none;outline:none;width:100%;font-size:11px;color:var(--text3);padding:2px 4px;border-radius:4px"
              onfocus="this.style.background='var(--surface2)';this.style.border='1px solid var(--border)'"
              onblur="this.style.background='transparent';this.style.border='none';ohUpdateNote('${month}',${i},this.value)"
              onkeydown="if(event.key==='Enter')this.blur()">`}
        </td>
          <td style="padding:4px 4px;text-align:center;white-space:nowrap">${(manage && !isLocked) ? `<button class="btn btn-ghost btn-sm" style="font-size:10px;padding:2px 6px" title="改名" onclick="ohRenameFixedItem(${i})">✎</button> <button class="btn btn-ghost btn-sm" style="font-size:10px;padding:2px 6px;color:var(--error)" title="刪除項目" onclick="ohDeleteFixedItem(${i})">✕</button>` : ''}</td>
      </tr>`;
    }).join('');
  }
  // 費用申請對帳建議（2026-04 起，每個月持續檢查）
  const reviewWrap = document.getElementById('oh-fixed-expense-review-wrap');
  const reviewTbody = document.getElementById('oh-fixed-expense-review-tbody');
  if (reviewWrap && reviewTbody) {
    if (manage && ohFixedExpenseReviewList.length) {
      reviewWrap.style.display = '';
      reviewTbody.innerHTML = ohFixedExpenseReviewList.map(r => `
        <tr style="border-bottom:1px solid var(--border)">
          <td style="padding:5px 8px">${ohMonthLabel(r.month)}</td>
          <td style="padding:5px 8px">${r.item}</td>
          <td style="padding:5px 8px;text-align:right;font-family:'DM Mono',monospace">$${r.currentAmount.toLocaleString('zh-TW')}</td>
          <td style="padding:5px 8px;text-align:right;font-family:'DM Mono',monospace">$${r.expenseTotal.toLocaleString('zh-TW')}</td>
          <td style="padding:5px 8px;text-align:right;font-family:'DM Mono',monospace;color:${r.diff===0?'var(--text3)':'var(--error)'}">${r.diff===0?'—':(r.diff>0?'+':'')+r.diff.toLocaleString('zh-TW')}</td>
          <td style="padding:5px 8px;text-align:center">${r.count} 筆</td>
          <td style="padding:5px 8px;text-align:center;white-space:nowrap">
            <button class="btn btn-ghost btn-sm" style="font-size:10px;padding:2px 6px" onclick="ohResolveFixedExpenseReview('${r.month}','${r.item}','keep')">採用目前</button>
            <button class="btn btn-ghost btn-sm" style="font-size:10px;padding:2px 6px" onclick="ohResolveFixedExpenseReview('${r.month}','${r.item}','adopt')">採用核准</button>
          </td>
        </tr>`).join('');
    } else {
      reviewWrap.style.display = 'none';
      reviewTbody.innerHTML = '';
    }
  }
  // Variable
  const varTbody = document.getElementById('oh-variable-tbody');
  if (varTbody) {
    if (data.variable.length === 0) {
      varTbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text3);font-size:12px">無不固定支出</td></tr>`;
    } else {
      varTbody.innerHTML = data.variable.map((v,i) => `
        <tr style="border-bottom:1px solid var(--border)" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">
          <td style="padding:8px 14px;color:var(--text3);font-size:11px">${i+1}</td>
          <td style="padding:8px 14px;font-size:12px">${v.name}</td>
          <td style="padding:8px 14px;text-align:right;font-family:'DM Mono',monospace;font-size:12px;font-weight:600">$${(v.amount||0).toLocaleString('zh-TW')}</td>
          <td style="padding:8px 14px;font-size:11px;color:var(--text3)">${v.note||''}</td>
          <td style="padding:8px 8px;text-align:center">${manage ? `<button class="btn btn-ghost btn-sm" style="font-size:10px;color:var(--error)" onclick="ohDeleteVar('${month}',${v.id})">✕</button>` : ''}</td>
        </tr>`).join('');
    }
  }
  // 顯示/隱藏「新增項目」按鈕
  const btnAddFixed = document.getElementById('btn-oh-add-fixed');
  if (btnAddFixed) btnAddFixed.style.display = manage ? '' : 'none';
  const btnCopyPrev = document.getElementById('btn-oh-copy-prev');
  if (btnCopyPrev) btnCopyPrev.style.display = manage ? '' : 'none';
  const btnAddMonth = document.getElementById('btn-oh-add-month');
  if (btnAddMonth) btnAddMonth.style.display = manage ? '' : 'none';

  // Stats
  const fixedSum = data.fixed.reduce((s,v)=>s+(parseInt(v)||0),0);
  const varSum   = data.variable.reduce((s,v)=>s+(v.amount||0),0);
  const set = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
  set('oh-stat-fixed',    '$'+fixedSum.toLocaleString('zh-TW'));
  set('oh-stat-variable', '$'+varSum.toLocaleString('zh-TW'));
  set('oh-stat-total',    '$'+(fixedSum+varSum).toLocaleString('zh-TW'));
  set('oh-fixed-subtotal','$'+fixedSum.toLocaleString('zh-TW'));
  set('oh-variable-subtotal','$'+varSum.toLocaleString('zh-TW'));
}

function ohUpdateFixed(month, idx, val) {
  if (!requireManage('overhead')) return;
  if (!OVERHEAD[month]) return;
  if (OH_FIXED_CONFIG[idx] === '房租' && OVERHEAD[month].rentPayableManaged) {
    showToast('這個月份的房租由已付款應付帳款自動彙總，請到應付帳款修改', 'warning');
    renderOverhead();
    return;
  }
  OVERHEAD[month].fixed[idx] = parseInt(val.replace(/[^0-9]/g,'')) || 0;
  renderOverhead();
  saveData();
}
function ohUpdateNote(month, idx, val) {
  if (!requireManage('overhead')) return;
  if (!OVERHEAD[month]) return;
  if (!Array.isArray(OVERHEAD[month].fixedNotes)) OVERHEAD[month].fixedNotes = OH_FIXED_CONFIG.map(()=>'');
  OVERHEAD[month].fixedNotes[idx] = val.trim();
  saveData();
}
// 費用申請對帳建議（2026-04 起，每個月都會檢查）一鍵採用：keep=保留公司開銷目前金額，adopt=改用費用申請核准合計。兩種都會把這列標記為已處理，之後不再提示。
function ohResolveFixedExpenseReview(month, item, action) {
  if (!requireManage('overhead')) return;
  if (!OVERHEAD[month]) return;
  const idx = OH_FIXED_CONFIG.indexOf(item);
  if (idx < 0) return;
  const data = OVERHEAD[month];
  if (action === 'adopt') {
    const g = expApprovedFixedOverheadByMonthItem().get(`${month}|${item}`);
    if (g) {
      data.fixed[idx] = g.total;
      const linkedNotes = g.rows.map(e => `費用#${e.id} ${e.item}／${(Number(e.amount)||0).toLocaleString('zh-TW')}`).join('；');
      data.fixedNotes[idx] = ['依費用申請核准金額採用', linkedNotes].filter(Boolean).join('；');
    }
  }
  data.fixedExpenseReviewResolved = data.fixedExpenseReviewResolved || {};
  data.fixedExpenseReviewResolved[item] = true;
  renderOverhead();
  saveData();
  showToast(action === 'adopt' ? '已改用費用申請核准合計' : '已保留目前金額，不再提示這列', 'success');
}
function ohDeleteFixedItem(idx) {
  if (!requireManage('overhead')) return;
  showToast('固定支出項目刪除已停用，避免移除歷史資料','error');
}
function ohRenameFixedItem(idx) {
  if (!requireManage('overhead')) return;
  const oldName = OH_FIXED_CONFIG[idx];
  if (oldName === '房租' || oldName === '員工薪資') {
    showToast('此項目與系統其他模組自動連動，不可改名','error');
    return;
  }
  const newName = prompt('修改項目名稱：', oldName);
  if (newName === null) return;
  const trimmed = newName.trim();
  if (!trimmed) { showToast('名稱不可為空','error'); return; }
  if (trimmed === oldName) return;
  if (OH_FIXED_CONFIG.includes(trimmed)) { showToast('已有相同名稱的項目','error'); return; }
  OH_FIXED_CONFIG[idx] = trimmed;
  renderOverhead();
  saveData();
  showToast(`已將「${oldName}」改名為「${trimmed}」`, 'success');
}
function ohDeleteFixedItem(idx) {
  if (!requireManage('overhead')) return;
  const name = OH_FIXED_CONFIG[idx];
  if (name === '房租' || name === '員工薪資') {
    showToast('此項目與系統其他模組自動連動，不可刪除','error');
    return;
  }
  const monthsWithAmount = Object.entries(OVERHEAD).filter(([,data]) => Number(data.fixed?.[idx]) > 0);
  const totalAmount = monthsWithAmount.reduce((s,[,data]) => s + Number(data.fixed[idx] || 0), 0);
  const warn = monthsWithAmount.length ? `\n\n注意：這個項目在 ${monthsWithAmount.length} 個月份有金額資料，合計 $${totalAmount.toLocaleString('zh-TW')}，刪除後這些金額會一起消失。` : '';
  if (!confirm(`確定要刪除固定支出項目「${name}」？${warn}`)) return;
  OH_FIXED_CONFIG.splice(idx, 1);
  Object.values(OVERHEAD).forEach(data => {
    if (Array.isArray(data.fixed)) data.fixed.splice(idx, 1);
    if (Array.isArray(data.fixedNotes)) data.fixedNotes.splice(idx, 1);
  });
  renderOverhead();
  saveData();
  showToast(`已刪除「${name}」`, 'success');
}
function ohCopyFixedFromPrevMonth() {
  if (!requireManage('overhead')) return;
  const month = document.getElementById('oh-filter-month')?.value || currentMonthKey();
  if (!OVERHEAD[month]) ohInitMonth(month);
  const { prevMonth, prevData } = ohPreviousMonthData(month);
  if (!prevData) { showToast('找不到上個月份可複製','error'); return; }
  if (!confirm(`確定要把 ${ohMonthLabel(prevMonth)} 的固定支出金額複製到 ${ohMonthLabel(month)}？\n目前月份固定支出金額會被取代，備註不會複製。`)) return;
  OVERHEAD[month].fixed = OH_FIXED_CONFIG.map((_,i) => parseInt(prevData.fixed?.[i]) || 0);
  OVERHEAD[month].fixedNotes = OH_FIXED_CONFIG.map(()=>'');
  if (month >= OH_WATER_ELECTRIC_SPLIT_MONTH && prevMonth < OH_WATER_ELECTRIC_SPLIT_MONTH) {
    const legacyIdx = OH_FIXED_CONFIG.indexOf('水電');
    const electricIdx = OH_FIXED_CONFIG.indexOf('電費');
    if (legacyIdx >= 0 && electricIdx >= 0) {
      OVERHEAD[month].fixed[electricIdx] = OVERHEAD[month].fixed[legacyIdx] || 0;
      OVERHEAD[month].fixed[legacyIdx] = 0;
    }
  }
  renderOverhead();
  saveData();
  showToast('已複製上月固定支出金額 ✓', 'success');
}
function ohAddFixedItem(name) {
  name = (name || '').trim();
  if (!name) { showToast('請輸入項目名稱','error'); return; }
  if (OH_FIXED_CONFIG.includes(name)) { showToast('已有相同名稱的項目','error'); return; }
  OH_FIXED_CONFIG.push(name);
  Object.values(OVERHEAD).forEach(data => {
    if (Array.isArray(data.fixed)) data.fixed.push(0);
    if (Array.isArray(data.fixedNotes)) data.fixedNotes.push('');
  });
  renderOverhead();
  saveData();
  showToast(`已新增「${name}」`, 'success');
}
function ohPromptAddFixed() {
  if (!requireManage('overhead')) return;
  const name = prompt('新固定支出項目名稱：');
  if (name === null) return;
  ohAddFixedItem(name);
}

function ohPromptAddMonth() {
  if (!requireManage('overhead')) return;
  const current = document.getElementById('oh-filter-month')?.value || currentMonthKey();
  const month = (prompt('請輸入要新增的月份（格式 YYYY-MM）：', current) || '').trim();
  if (!month) return;
  if (!prIsValidMonth(month)) {
    showToast('月份格式需為 YYYY-MM，例如 2026-08', 'error');
    return;
  }
  if (!OVERHEAD[month]) ohInitMonth(month);
  ohRenderMonthOptions(month);
  renderOverhead();
  saveData();
  showToast(`已新增 ${ohMonthLabel(month)} 公司開銷月份`, 'success');
}

function ohDeleteVar(month, id) {
  if (!requireManage('overhead')) return;
  if (!OVERHEAD[month]) return;
  OVERHEAD[month].variable = OVERHEAD[month].variable.filter(v=>v.id!==id);
  renderOverhead();
  saveData();
  showToast('已刪除','success');
}
function submitAddOverhead() {
  if (!requireManage('overhead')) return;
  const month = document.getElementById('oh-filter-month')?.value || currentMonthKey();
  const name  = document.getElementById('oh-add-name').value.trim();
  const amtRaw= document.getElementById('oh-add-amount').value.trim();
  if (!name)   { showToast('請填寫名稱','error'); return; }
  if (!amtRaw) { showToast('請填寫金額','error'); return; }
  if (!OVERHEAD[month]) ohInitMonth(month);
  OVERHEAD[month].variable.push({
    id: ohVarNextId++,
    name, amount: parseInt(amtRaw.replace(/[^0-9]/g,''))||0,
    note: document.getElementById('oh-add-note').value.trim()
  });
  closeModal('modal-add-overhead');
  renderOverhead();
  saveData();
  showToast('不固定支出已新增 ✓','success');
}

function openAddOverheadModal() {
  if (!requireManage('overhead', '您沒有新增公司開銷的權限')) return;
  openModal('modal-add-overhead');
}
