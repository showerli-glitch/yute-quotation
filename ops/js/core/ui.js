// Shared UI, filtering, row metadata, and rendering helpers. Moved verbatim.

let toastTimer;

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function currentYearKey() {
  return currentMonthKey().slice(0, 4);
}

function monthDateRange(month = currentMonthKey()) {
  const match = String(month || '').match(/^(\d{4})-(\d{2})$/);
  if (!match) return { start:'', end:'' };
  const year = Number(match[1]);
  const monthNum = Number(match[2]);
  const lastDay = new Date(year, monthNum, 0).getDate();
  return {
    start: `${year}-${String(monthNum).padStart(2, '0')}-01`,
    end: `${year}-${String(monthNum).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  };
}

function setControlValue(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  if (el.tagName === 'SELECT' && value && !Array.from(el.options).some(option => option.value === value)) {
    el.add(new Option(value, value));
  }
  el.value = value;
}

function caseOptionLabel(c) {
  return `${c.code} ${c.name || ''}`.trim();
}

function caseOptionHtml(c) {
  return `<option value="${c.code}">${caseOptionLabel(c)}</option>`;
}

function buildGroupedCaseOptionsFromRows(cases, placeholder='', includeOverhead=false) {
  let html = placeholder ? `<option value="">${placeholder}</option>` : '';
  if (includeOverhead) html += `<option value="固定開銷">固定開銷</option>`;
  const { open, closed } = groupedCases(cases);
  if (open.length) html += '<optgroup label="進行中／未結案個案">' + open.map(caseOptionHtml).join('') + '</optgroup>';
  if (closed.length) html += '<optgroup label="已結案個案">' + closed.map(caseOptionHtml).join('') + '</optgroup>';
  return html;
}

function buildCaseOptions(placeholder='── 選擇個案名稱 ──', includeOverhead=false, activeOnly=false, currentCode='', filterFn=null) {
  const allowed = CASES.filter(c => !filterFn || filterFn(c));
  let html = buildGroupedCaseOptionsFromRows(allowed, placeholder, includeOverhead);
  if (!groupedCases(allowed).open.length && activeOnly) {
    html += '<option value="" disabled>目前沒有進行中個案</option>';
  }
  return html;
}

function caseGroupLabel(label) {
  return `<div style="flex-basis:100%;padding:6px 6px 3px;margin-top:4px;font-size:10px;color:var(--text3);border-top:1px solid var(--border)">${label}</div>`;
}

function buildCaseCheckboxGroups(cases, selectedFn, onchange, options = {}) {
  const { open, closed } = groupedCases(cases);
  const row = c => `<label style="display:flex;align-items:center;gap:8px;padding:5px 6px;cursor:pointer;font-size:12px;border-radius:4px${options.flexItem ? ';min-width:210px' : ''}" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">
    <input type="checkbox" value="${c.code}" ${selectedFn(c) ? 'checked' : ''} onchange="${onchange}">
    <span style="font-family:'DM Mono',monospace;color:var(--accent);font-size:10px;min-width:110px">${c.code}</span>
    <span style="flex:1">${c.name}${c.status==='結案'?' <span style="color:var(--text3)">（已結案）</span>':''}</span>
  </label>`;
  const section = (label, rows) => rows.length ? caseGroupLabel(label) + rows.map(row).join('') : '';
  return section('進行中／未結案個案', open) + section('已結案個案', closed);
}

// ── 刷新所有頁面的案件下拉 ──
function refreshAllCaseDropdowns() {
  const ids = [
    { id:'pr-case',         ph:'── 選擇個案名稱 ──',  oh:false, activeOnly:true  },
    { id:'py-filter-case',  ph:'── 全部個案 ──',       oh:false, activeOnly:false },
    { id:'rv-filter-case',  ph:'── 全部個案 ──',       oh:false, activeOnly:false },
    { id:'ap-add-case',     ph:'── 選擇個案名稱 ──',  oh:false, activeOnly:true  },
    { id:'rv-add-case',     ph:'── 選擇個案名稱 ──',  oh:false, activeOnly:false },
    { id:'exp-add-case',    ph:'── 歸屬個案 ──',  oh:true,  activeOnly:true  },
    { id:'exp-filter-case', ph:'── 全部個案 ──',  oh:true,  activeOnly:false },
  ];
  ids.forEach(({ id, ph, oh, activeOnly }) => {
    const el = document.getElementById(id);
    if (!el) return;
    const cur = el.value;
    const pageById = {
      'pr-case':'payreq', 'py-filter-case':'payable', 'rv-filter-case':'receivable',
      'ap-add-case':'payable', 'rv-add-case':'receivable',
      'exp-add-case':'expense', 'exp-filter-case':'expense'
    };
    const page = pageById[id];
    const filterFn = page ? (c => userCanViewCaseFinancials(c.code, page)) : null;
    el.innerHTML = buildCaseOptions(ph, oh, activeOnly, cur, filterFn);
    if (cur) el.value = cur;
  });
}


// ── 從廠商主檔發起請款 ──────────────────────────────────────────

function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

function tfEsc(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}

function rowAuditUser() {
  return currentUser?.email || currentUser?.name || 'system';
}

function touchRowMeta(row, isNew = false) {
  if (!row) return row;
  const now = new Date().toISOString();
  if (isNew && !row.createdAt) {
    row.createdAt = now;
    row.createdBy = rowAuditUser();
  }
  row.updatedAt = now;
  row.updatedBy = rowAuditUser();
  return row;
}

function inDateRange(dateValue, fromValue, toValue) {
  if (!fromValue && !toValue) return true;
  if (!dateValue) return false;
  const d = String(dateValue).slice(0,10);
  if (fromValue && d < fromValue) return false;
  if (toValue && d > toValue) return false;
  return true;
}

function normalizeSearchLoose(value) {
  return String(value || '').toLowerCase().replace(/[,\s$，]/g, '');
}

function searchTextMatches(haystack, keyword) {
  const kw = String(keyword || '').trim().toLowerCase();
  if (!kw) return true;
  const text = String(haystack || '').toLowerCase();
  return text.includes(kw) || normalizeSearchLoose(text).includes(normalizeSearchLoose(kw));
}

function searchAmountText(value) {
  const n = Number(value) || 0;
  const rounded = Math.round(n);
  return [
    String(n),
    String(rounded),
    Math.abs(rounded).toLocaleString('zh-TW'),
    '$' + Math.abs(rounded).toLocaleString('zh-TW')
  ].join(' ');
}

function duplicateAmountWarning(rows, { caseCode, amount, excludeId, label, describe }) {
  const amt = Number(amount) || 0;
  if (!caseCode || !amt) return true;
  const matches = rows.filter(row =>
    row.id !== excludeId &&
    row.case === caseCode &&
    Math.round(Number(row.amount || row.collectAmt || row.invoiceAmt || row.contractAmt || 0)) === Math.round(amt)
  );
  if (!matches.length) return true;
  const caseName = CASES.find(c => c.code === caseCode)?.name || caseCode;
  const detail = matches.slice(0, 5).map(describe).join('\n');
  const more = matches.length > 5 ? `\n...另有 ${matches.length - 5} 筆` : '';
  return confirm(
    `提醒：${caseName} 已有相同金額 $${Math.round(amt).toLocaleString('zh-TW')} 的${label}。\n\n${detail}${more}\n\n請確認不是重複記錄。仍要繼續儲存嗎？`
  );
}

function confirmDuplicatePayable({ caseCode, amount, excludeId }) {
  return duplicateAmountWarning(PAYABLES, {
    caseCode, amount, excludeId, label:'應付帳款',
    describe: p => `#${p.id || '-'} ${p.vendor || '未填廠商'}／${p.summary || '未填摘要'}／${p.status || ''}`
  });
}

function confirmDuplicateReceivable({ caseCode, amount, excludeId }) {
  return duplicateAmountWarning(RECEIVABLES, {
    caseCode, amount, excludeId, label:'應收帳款',
    describe: r => `#${r.id || '-'} ${r.buyer || '未填買受人'}／${r.item || '未填項目'}／${r.status || ''}`
  });
}

function sortOpsRows(rows, sortMode, dateGetter, textGetter, amountGetter) {
  const dir = sortMode.endsWith('-asc') ? 1 : -1;
  const getTime = v => {
    const s = v ? String(v).slice(0,10) : '';
    return s ? Date.parse(s) || 0 : 0;
  };
  const getMetaTime = (row, field) => Date.parse(row?.[field] || '') || 0;
  return rows.slice().sort((a,b) => {
    if (sortMode.startsWith('created')) return (getMetaTime(a,'createdAt') - getMetaTime(b,'createdAt') || ((a.id||0)-(b.id||0))) * dir;
    if (sortMode.startsWith('updated')) return (getMetaTime(a,'updatedAt') - getMetaTime(b,'updatedAt') || ((a.id||0)-(b.id||0))) * dir;
    if (sortMode.startsWith('amount')) return (((amountGetter(a)||0) - (amountGetter(b)||0)) || ((a.id||0)-(b.id||0))) * dir;
    if (sortMode.includes('vendor') || sortMode.includes('buyer') || sortMode.includes('person')) {
      const cmp = String(textGetter(a)||'').localeCompare(String(textGetter(b)||''), 'zh-Hant');
      return cmp || ((a.id||0)-(b.id||0));
    }
    return (getTime(dateGetter(a)) - getTime(dateGetter(b)) || ((a.id||0)-(b.id||0))) * dir;
  });
}

function showToast(msg, type='') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}
