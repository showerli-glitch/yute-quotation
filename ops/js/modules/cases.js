// CASES MODULE. Extracted verbatim from ops/index.html at main@754460e.

// ══════════════════════════════════
// CASES TABLE
// ══════════════════════════════════
function dcToggleCaseDropdown() {
  const dd = document.getElementById('case-filter-dropdown');
  if (!dd) return;
  const isOpen = dd.style.display !== 'none';
  if (!isOpen) {
    const container = document.getElementById('case-filter-checkboxes');
    if (container) {
      const visibleCases = CASES.filter(c => userCanViewCaseFinancials(c.code, 'dashboard') || userCanViewCaseFinancials(c.code, 'profit'));
      container.innerHTML = buildCaseCheckboxGroups(visibleCases, c => dcSelCases === null || dcSelCases.has(c.code), 'dcCaseCheckChange()');
      const allCb = document.getElementById('case-filter-all');
      if (allCb) allCb.checked = dcSelCases === null;
    }
  }
  dd.style.display = isOpen ? 'none' : 'block';
}

function dcCaseAllToggle(cb) {
  const boxes = document.querySelectorAll('#case-filter-checkboxes input[type=checkbox]');
  boxes.forEach(b => b.checked = cb.checked);
  dcSelCases = cb.checked ? null : new Set();
  dcUpdateCaseBtn();
  renderCases();
}

function dcCaseCheckChange() {
  const boxes = [...document.querySelectorAll('#case-filter-checkboxes input[type=checkbox]')];
  const checked = boxes.filter(b => b.checked).map(b => b.value);
  const visibleCount = CASES.filter(c => userCanViewCaseFinancials(c.code, 'dashboard') || userCanViewCaseFinancials(c.code, 'profit')).length;
  dcSelCases = checked.length === visibleCount ? null : new Set(checked);
  const allCb = document.getElementById('case-filter-all');
  if (allCb) allCb.checked = dcSelCases === null;
  dcUpdateCaseBtn();
  renderCases();
}

function dcUpdateCaseBtn() {
  const btn = document.getElementById('case-filter-btn');
  if (!btn) return;
  btn.textContent = dcSelCases === null ? '全部個案 ▾' : `已選 ${dcSelCases.size} 筆個案 ▾`;
}

document.addEventListener('click', e => {
  const wrap = document.getElementById('case-filter-wrap');
  if (wrap && !wrap.contains(e.target)) {
    const dd = document.getElementById('case-filter-dropdown');
    if (dd) dd.style.display = 'none';
  }
});

// ── 建立案件 <option> 字串，供所有下拉使用 ──
function isClosedCase(code) {
  return CASES.find(c => c.code === code)?.status === '結案';
}

function groupedCases(cases) {
  const rows = (Array.isArray(cases) ? cases : []).filter(Boolean);
  return {
    open: dashboardSortOpenCases(rows.filter(c => c.status !== '結案')),
    closed: rows.filter(c => c.status === '結案')
  };
}

function openCaseDetail(caseCode) {
  const c = CASES.find(x => x.code === caseCode);
  if (!c) return;

  // 標題
  document.getElementById('cd-title').textContent = c.name;
  document.getElementById('cd-subtitle').textContent = `${c.code} ｜ ${c.clientName||''} ｜ 負責：${c.person||'—'}`;

  // KPI 卡
  const rvs = caseReceivableRows(caseCode);
  const collected = caseCollectedAmount(caseCode);
  const pys = casePayableRows(caseCode, { costControlOnly:true });
  const paid = casePaidPayableAmount(caseCode, { costControlOnly:true });
  const pct = c.amount > 0 ? Math.min(100, Math.round(collected/c.amount*100)) : 0;
  document.getElementById('cd-kpis').innerHTML = `
    <div class="kpi-card" style="padding:12px 16px">
      <div class="kpi-label" style="font-size:11px">合約金額</div>
      <div style="font-size:20px;font-weight:700;color:var(--text)">${c.amount ? '$'+c.amount.toLocaleString('zh-TW') : '—'}</div>
    </div>
    <div class="kpi-card" style="padding:12px 16px">
      <div class="kpi-label" style="font-size:11px">已收款</div>
      <div style="font-size:20px;font-weight:700;color:var(--success)">$${collected.toLocaleString('zh-TW')}</div>
      <div style="font-size:11px;color:var(--text3)">${pct}% 收款進度</div>
    </div>
    <div class="kpi-card" style="padding:12px 16px">
      <div class="kpi-label" style="font-size:11px">已付廠商</div>
      <div style="font-size:20px;font-weight:700;color:var(--error)">$${paid.toLocaleString('zh-TW')}</div>
      <div style="font-size:11px;color:var(--text3)">${pys.length} 筆請款</div>
    </div>
  `;

  // 應收明細
  const rvLabel = {pending:'待入帳', collected:'已入帳'};
  const rvClass = {pending:'tag-pending', collected:'tag-done'};
  document.getElementById('cd-rv-tbody').innerHTML = rvs.length === 0
    ? '<tr><td colspan="4" style="text-align:center;padding:16px;color:var(--text3)">尚無收款記錄</td></tr>'
    : rvs.map(r => `<tr>
        <td style="padding:8px 12px;font-size:12px">${r.collectDate||'—'}</td>
        <td style="padding:8px 12px;font-size:12px">${r.item||'—'}</td>
        <td style="padding:8px 12px;text-align:right;font-family:'DM Mono',monospace;font-weight:600">$${(r.collectAmt||0).toLocaleString('zh-TW')}</td>
        <td style="padding:8px 12px"><span class="tag ${receivableIsCollected(r)?'tag-done':'tag-pending'}">${receivableIsCollected(r)?'已入帳':'待入帳'}</span></td>
      </tr>`).join('');

  // 廠商請款明細
  const pyLabel = {pending:'待審核', approved:'待付款', paid:'已付款'};
  const pyClass = {pending:'tag-pending', approved:'tag-active', paid:'tag-done'};
  document.getElementById('cd-py-tbody').innerHTML = pys.length === 0
    ? '<tr><td colspan="4" style="text-align:center;padding:16px;color:var(--text3)">尚無廠商請款</td></tr>'
    : pys.map(p => `<tr>
        <td style="padding:8px 12px;font-size:12px;font-weight:500">${p.vendor}</td>
        <td style="padding:8px 12px;font-size:12px;color:var(--text2)">${p.summary||'—'}</td>
        <td style="padding:8px 12px;text-align:right;font-family:'DM Mono',monospace;font-weight:600">$${(p.amount||0).toLocaleString('zh-TW')}</td>
        <td style="padding:8px 12px"><span class="tag ${pyClass[p.status]||'tag-draft'}">${pyLabel[p.status]||p.status}</span></td>
      </tr>`).join('');

  openModal('modal-case-detail');
}

function closeCaseIfReady(caseCode) {
  if (!requireManage('dashboard', '您沒有結案個案的權限')) return;
  const c = CASES.find(x => x.code === caseCode);
  if (!c) return;
  if (c.status === '結案') { showToast('此個案已結案', 'warning'); return; }
  const pendingReceivables = RECEIVABLES.filter(r => r.case === caseCode && !receivableIsCollected(r) && receivableExpectedAmount(r) > 0);
  const pendingPayables = PAYABLES.filter(p => p.case === caseCode && p.status !== 'paid' && Number(p.amount || 0) > 0);
  const warnings = [];
  if (pendingReceivables.length) warnings.push(`尚有 ${pendingReceivables.length} 筆應收未入帳`);
  if (pendingPayables.length) warnings.push(`尚有 ${pendingPayables.length} 筆應付未付款`);
  if (c.profitSplit !== '不分潤' && !c.psSettled) warnings.push('此案為正常分潤案，尚未鎖定分潤結算');
  const msg = warnings.length
    ? `「${c.name}」仍有待處理項目：\n${warnings.map(x => `- ${x}`).join('\n')}\n\n仍要標記為結案嗎？`
    : `確定將「${c.name}」標記為結案？`;
  if (!confirm(msg)) return;
  c.status = '結案';
  c.closedDate = new Date().toISOString().slice(0,10);
  touchRowMeta(c);
  renderCases();
  renderProfit();
  renderProfitShare();
  saveData();
  showToast('個案已結案 ✓', 'success');
}

function caseDeleteDependencies(caseCode) {
  const checks = [
    ['應收', RECEIVABLES.filter(r => r.case === caseCode).length],
    ['應付／廠商請款', PAYABLES.filter(r => r.case === caseCode).length],
    ['費用申請', EXPENSES.filter(r => r.caseKey === caseCode).length],
    ['公司分攤', COMPANY_ALLOCATIONS.filter(r => r.caseKey === caseCode).length],
    ['出勤紀錄', ATTENDANCE_RECORDS.filter(r => r.caseCode === caseCode).length],
    ['分潤結算', PROFIT_SETTLEMENTS.filter(s => (s.cases || []).some(c => c.code === caseCode)).length],
  ];
  return checks.filter(([, count]) => count > 0);
}

function deleteCase(caseCode) {
  if (!['shower','nc'].includes(currentUser?.id) || !canManage('dashboard')) {
    showToast('只有李鎮宇與 Ning 可以刪除誤建個案', 'error');
    return;
  }
  const index = CASES.findIndex(c => c.code === caseCode);
  if (index < 0) return;
  const target = CASES[index];
  const dependencies = caseDeleteDependencies(caseCode);
  if (dependencies.length) {
    alert(`「${target.name}」已被其他資料使用，不能刪除：\n${dependencies.map(([label,count]) => `- ${label}：${count} 筆`).join('\n')}\n\n請先修正或移轉關聯資料。`);
    return;
  }
  if (!confirm(`確定刪除誤建個案「${target.name}」（${target.code}）？\n\n此動作會寫入審計紀錄。`)) return;
  const before = auditClone(target);
  CASES.splice(index, 1);
  recordAuditLog('delete', 'case', caseCode, before, null, {
    riskLevel:'high',
    targetLabel:`${target.name}／${target.code}`,
    reason:'OWNER 刪除無關聯資料的誤建個案'
  });
  if (dcSelCases instanceof Set) dcSelCases.delete(caseCode);
  refreshAllCaseDropdowns();
  renderCases();
  renderDashboard();
  renderProfit();
  renderProfitShare();
  saveData();
  showToast(`已刪除誤建個案「${target.name}」`, 'success');
}

function caseActionSelect(select, caseCode) {
  const action = select?.value || '';
  if (select) select.value = '';
  if (action === 'location') openCaseLocation(caseCode);
  else if (action === 'close') closeCaseIfReady(caseCode);
  else if (action === 'edit') openEditCase(caseCode);
  else if (action === 'delete') deleteCase(caseCode);
  else if (action === 'detail') openCaseDetail(caseCode);
}

function dashboardCaseEntryDate(c) {
  const explicit = String(c?.entryDate || c?.createdAt || c?.startDate || '').slice(0,10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(explicit)) return explicit;
  const dates = [
    ...RECEIVABLES.filter(r => r.case === c.code).flatMap(r => [r.invoiceDate, r.collectDate]),
    ...PAYABLES.filter(r => r.case === c.code).flatMap(r => [r.wantDate, r.transferDate, r.doneDate]),
    ...EXPENSES.filter(r => r.caseKey === c.code).map(r => r.date || (r.month ? `${r.month}-01` : '')),
  ].filter(d => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''))).sort();
  const codeYear = String(c?.code || '').match(/20\d{2}/)?.[0] || '';
  return dates[0] || (codeYear ? `${codeYear}-01-01` : '');
}

function dashboardSortOpenCases(rows) {
  const mode = document.getElementById('case-sort')?.value || 'entry-desc';
  const list = rows.slice();
  const byText = (a,b,key) => String(a[key] || '').localeCompare(String(b[key] || ''), 'zh-Hant', {numeric:true, sensitivity:'base'});
  if (mode === 'entry-asc') return list.sort((a,b) => dashboardCaseEntryDate(a).localeCompare(dashboardCaseEntryDate(b)) || byText(a,b,'code'));
  if (mode === 'name-asc') return list.sort((a,b) => byText(a,b,'name') || byText(a,b,'code'));
  if (mode === 'code-asc') return list.sort((a,b) => byText(a,b,'code'));
  if (mode === 'code-desc') return list.sort((a,b) => byText(b,a,'code'));
  return list.sort((a,b) => dashboardCaseEntryDate(b).localeCompare(dashboardCaseEntryDate(a)) || byText(b,a,'code'));
}

// 共用個案總覽排列：未結案依目前排序設定，已結案統一置底。
function dashboardSortCasesLikeOverview(rows) {
  const list = (Array.isArray(rows) ? rows : []).filter(Boolean);
  return [
    ...dashboardSortOpenCases(list.filter(c => c.status !== '結案')),
    ...list.filter(c => c.status === '結案')
  ];
}

function dcToggleClosedCases() {
  dcClosedCollapsed = !dcClosedCollapsed;
  localStorage.setItem('yutesign-ops-dashboard-closed-collapsed', dcClosedCollapsed ? '1' : '0');
  renderCases();
}

function renderCases() {
  dcUpdateCaseBtn();
  const tbody = document.getElementById('case-tbody');
  const visibleCases = CASES.filter(c => userCanViewCaseFinancials(c.code, 'dashboard') || userCanViewCaseFinancials(c.code, 'profit'));
  const selected = dcSelCases === null ? visibleCases : visibleCases.filter(c => dcSelCases.has(c.code));
  const caseKw = (document.getElementById('case-search')?.value || '').toLowerCase();
  const data = selected.filter(c => searchTextMatches([c.code, c.name, c.clientName].filter(Boolean).join(' '), caseKw));
  const canSetLocation = ['shower','nc'].includes(currentUser?.id) && canManage('dashboard');
  document.querySelectorAll('#case-table .case-location-col').forEach(el => { el.style.display = canSetLocation ? '' : 'none'; });
  const statusTag = {
    '進行中': 'tag-active',
    '待開工': 'tag-pending',
    '完工':   'tag-done',
    '結案':   'tag-inactive',
  };
  const renderRow = c => {
    const caseCollected = caseCollectedAmount(c.code, { includeRetention: false });
    const pct = c.amount > 0 ? Math.min(100, Math.round(caseCollected / c.amount * 100)) : (c.pct || 0);
    const retention = RECEIVABLES.find(r => r.case === c.code && (`${r.item||''} ${r.progress||''}`).includes('保固'));
    const retentionAmt = c.retentionAmt || retention?.invoiceAmt || retention?.collectAmt || 0;
    const retentionDue = retention?.retentionDue || c.retentionDue || '';
    const retentionPaid = !!retention && receivableIsCollected(retention);
    const retentionOverdue = !retentionPaid && retentionAmt > 0 && retentionDue && retentionDue < new Date().toISOString().slice(0,10);
    const retentionLabel = !retentionAmt ? '—' : retentionPaid ? '已收' : retentionOverdue ? '已逾期' : '待收';
    const retentionTag = retentionPaid ? 'tag-done' : retentionOverdue ? 'tag-pending' : 'tag-active';
    return `
    <tr>
      <td><span class="case-code">${caseCodeBreak(c.code)}</span></td>
      <td><div class="case-name">${c.name}</div></td>
      <td><span class="tag tag-client">${c.clientName}</span></td>
      <td><span class="tag ${statusTag[c.status]||'tag-draft'}">${c.status === '完工' && !c.psSettled ? '完工待結算' : c.status}</span></td>
      <td><div class="amount">${c.amount ? '$'+fmtNum(c.amount) : '—'}</div></td>
      <td style="min-width:120px">
        <div class="prog-wrap">
          <div class="prog-bar"><div class="prog-fill" style="width:${pct}%"></div></div>
          <div class="prog-pct">${pct}%</div>
        </div>
      </td>
      <td style="text-align:right;white-space:nowrap"><div class="amount">${retentionAmt ? '$'+fmtNum(retentionAmt) : '—'}</div></td>
      <td class="nowrap-col" style="font-size:12px;text-align:center">${retentionDue || '—'}</td>
      <td style="text-align:center">${retentionAmt ? `<span class="tag ${retentionTag}">${retentionLabel}</span>` : '<span style="color:var(--text3)">—</span>'}</td>
      <td style="font-size:12px;color:var(--text2);min-width:3em;white-space:nowrap">${c.person}</td>
      ${canSetLocation ? `<td style="text-align:center">${caseHasSiteLocation(c) ? '<span class="tag tag-done">已設定</span>' : '<span class="tag tag-pending">未設定</span>'}</td>` : ''}
      <td style="white-space:nowrap;text-align:center">
        ${canSetLocation ? `<select class="filter-select compact-action-select" aria-label="${c.name} 操作" onchange="caseActionSelect(this,'${c.code}')">
          <option value="">選項⋯</option>
          <option value="location">座標設定</option>
          ${c.status !== '結案' ? '<option value="close">標記結案</option>' : ''}
          <option value="edit">編輯個案</option>
          <option value="delete">刪除個案</option>
          <option value="detail">查看詳情</option>
        </select>` : `<button type="button" class="btn btn-ghost btn-sm" style="font-size:11px;white-space:nowrap" onclick="openCaseDetail('${c.code}')">查看詳情</button>`}
      </td>
    </tr>`;
  };
  const open = dashboardSortOpenCases(data.filter(c => c.status !== '結案'));
  const closed = data.filter(c => c.status === '結案');
  let html = open.map(renderRow).join('');
  if (closed.length) {
    html += `<tr><td colspan="${canSetLocation ? 12 : 11}" style="padding:5px 14px;border-top:2px solid var(--border2);background:var(--surface2);font-size:11px;color:var(--text3)"><div style="display:flex;align-items:center;gap:8px"><span>已結案個案（${closed.length}）</span><button type="button" class="btn btn-ghost btn-sm" onclick="dcToggleClosedCases()" style="font-size:10px;padding:2px 8px">${dcClosedCollapsed ? '展開 ▾' : '收折 ▴'}</button></div></td></tr>`;
    if (!dcClosedCollapsed) html += closed.map(renderRow).join('');
  }
  tbody.innerHTML = html;
}

// ══════════════════════════════════
// MODALS
// ══════════════════════════════════


function caseHasSiteLocation(c) {
  return c && c.siteLat !== '' && c.siteLat !== null && c.siteLat !== undefined &&
    c.siteLng !== '' && c.siteLng !== null && c.siteLng !== undefined &&
    Number.isFinite(Number(c.siteLat)) && Number.isFinite(Number(c.siteLng));
}

function caseLocationFields(prefix) {
  return {
    address: document.getElementById(`${prefix}-address`),
    lat: document.getElementById(`${prefix}-lat`) || document.getElementById(`${prefix}-site-lat`),
    lng: document.getElementById(`${prefix}-lng`) || document.getElementById(`${prefix}-site-lng`),
    radius: document.getElementById(`${prefix}-radius`) || document.getElementById(`${prefix}-site-radius`)
  };
}

function openCaseLocation(caseCode) {
  if (!requireManage('dashboard', '您沒有設定案場座標的權限')) return;
  const c = CASES.find(x => x.code === caseCode);
  if (!c) return;
  document.getElementById('case-location-code').value = c.code;
  document.getElementById('case-location-subtitle').textContent = `${c.code} ｜ ${c.name}`;
  document.getElementById('case-location-address').value = c.address || c.siteAddress || '';
  document.getElementById('case-location-lat').value = c.siteLat ?? '';
  document.getElementById('case-location-lng').value = c.siteLng ?? '';
  document.getElementById('case-location-radius').value = c.siteRadiusMeters || 200;
  openModal('modal-case-location');
}

function readCaseLocation(prefix) {
  const f = caseLocationFields(prefix);
  const latRaw = f.lat?.value?.trim() || '';
  const lngRaw = f.lng?.value?.trim() || '';
  const radius = Number(f.radius?.value || 200) || 200;
  const lat = latRaw === '' ? null : Number(latRaw);
  const lng = lngRaw === '' ? null : Number(lngRaw);
  if ((latRaw || lngRaw) && (!Number.isFinite(lat) || !Number.isFinite(lng))) {
    showToast('座標格式不正確', 'error');
    return null;
  }
  if ((latRaw || lngRaw) && (lat < -90 || lat > 90 || lng < -180 || lng > 180)) {
    showToast('座標超出有效範圍', 'error');
    return null;
  }
  if (radius < 50) {
    showToast('打卡半徑至少 50 公尺', 'error');
    return null;
  }
  return {
    address: f.address?.value?.trim() || '',
    siteLat: latRaw ? lat : '',
    siteLng: lngRaw ? lng : '',
    siteRadiusMeters: radius
  };
}

function saveCaseLocation() {
  if (!requireManage('dashboard', '您沒有設定案場座標的權限')) return;
  const code = document.getElementById('case-location-code')?.value || '';
  const c = CASES.find(x => x.code === code);
  if (!c) return;
  const loc = readCaseLocation('case-location');
  if (!loc) return;
  c.address = loc.address;
  c.siteAddress = loc.address;
  c.siteLat = loc.siteLat;
  c.siteLng = loc.siteLng;
  c.siteRadiusMeters = loc.siteRadiusMeters;
  c.locationUpdatedAt = new Date().toISOString();
  c.locationUpdatedBy = currentUser.name;
  saveData();
  renderCases();
  attFillCaseOptions();
  attGpsRefresh();
  closeModal('modal-case-location');
  showToast('案場座標已儲存 ✓', 'success');
}

function caseUseCurrentLocation(prefix) {
  if (!navigator.geolocation) { showToast('瀏覽器不支援定位', 'error'); return; }
  showToast('正在取得目前定位…', 'success');
  navigator.geolocation.getCurrentPosition(pos => {
    const f = caseLocationFields(prefix);
    if (f.lat) f.lat.value = pos.coords.latitude.toFixed(6);
    if (f.lng) f.lng.value = pos.coords.longitude.toFixed(6);
    if (f.radius && !f.radius.value) f.radius.value = 200;
    showToast('已填入目前定位 ✓', 'success');
  }, () => {
    showToast('無法取得目前定位，請允許瀏覽器定位權限', 'error');
  }, { enableHighAccuracy:true, timeout:12000, maximumAge:30000 });
}

function openNewCaseModal() {
  if (!requireCreateCase('您沒有新增個案的權限')) return;
  // 動態填充客戶下拉（從 CLIENTS 主檔）
  const sel = document.getElementById('new-client-code');
  if (sel) {
    sel.innerHTML = '<option value="">── 選擇客戶 ──</option>' +
      CLIENTS.map(c => `<option value="${c.code}">${c.code} ｜ ${c.shortName}</option>`).join('');
  }
  document.getElementById('new-case-code').value = '';
  document.getElementById('new-case-name').value = '';
  if (document.getElementById('new-case-amount')) document.getElementById('new-case-amount').value = '';
  ['new-case-address','new-case-site-lat','new-case-site-lng'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const profitModeEl = document.getElementById('new-case-profit-mode');
  if (profitModeEl) profitModeEl.value = 'profit';
  const caseTypeEl = document.getElementById('new-case-type');
  if (caseTypeEl) caseTypeEl.value = 'normal';
  const radiusEl = document.getElementById('new-case-site-radius');
  if (radiusEl) radiusEl.value = 200;
  openModal('modal-new-case');
}

function syncNewCaseTypeDefaults() {
  const type = document.getElementById('new-case-type')?.value || 'normal';
  const profitModeEl = document.getElementById('new-case-profit-mode');
  if (!profitModeEl) return;
  if (type === 'normal') {
    if (profitModeEl.value !== 'no_profit') profitModeEl.value = 'profit';
  } else {
    profitModeEl.value = 'no_profit';
  }
  genCaseCode();
}

function submitNewCase() {
  if (!requireCreateCase('您沒有新增個案的權限')) return;
  const clientCode = document.getElementById('new-client-code').value;
  const caseCode   = document.getElementById('new-case-code').value.trim();
  const caseName   = document.getElementById('new-case-name').value.trim();
  if (!clientCode) { showToast('請選擇客戶', 'error'); return; }
  if (!caseName)   { showToast('請填寫個案名稱', 'error'); return; }
  const caseKind = document.getElementById('new-case-type')?.value || 'normal';
  const caseCodeFinal = (!caseCode || CASES.some(c => c.code === caseCode))
    ? nextCaseCodeForNewCase(clientCode, caseKind)
    : caseCode;
  const client  = CLIENTS.find(cl=>cl.code===clientCode)||{code:clientCode,shortName:''};
  const amtRaw  = document.getElementById('new-case-amount')?.value.trim()||'';
  const amount  = parseInt(amtRaw.replace(/[^0-9]/g,''))||0;
  const person  = document.getElementById('new-case-person')?.value||currentUser.name;
  const profitMode = document.getElementById('new-case-profit-mode')?.value || 'profit';
  const loc = readCaseLocation('new-case');
  if (!loc) return;
  const caseRow = {
    code: caseCodeFinal,
    name: caseName,
    client: clientCode,
    clientName: client.shortName,
    status: '進行中',
    amount,
    collected: 0,
    person,
    pct: 0,
    address: loc.address,
    siteAddress: loc.address,
    siteLat: loc.siteLat,
    siteLng: loc.siteLng,
    siteRadiusMeters: loc.siteRadiusMeters
  };
  const specialCaseTypeMap = {
    family_pass_through: '親友工程／成本轉付',
    repair: '維修／修繕',
    invoice_proxy: '代開發票',
    private_loan: '私人借支',
  };
  if (profitMode === 'no_profit' || caseKind !== 'normal') {
    Object.assign(caseRow, {
      profitSplit: '不分潤',
      excludeFromProfitReports: true,
      caseType: specialCaseTypeMap[caseKind] || '不分潤／成本追蹤',
      billingMode: caseKind === 'family_pass_through' ? '實際成本轉付' : '',
      invoiceMode: caseKind === 'invoice_proxy' ? '代開發票' : '',
      reconciliationNote: `新增個案時設定為${specialCaseTypeMap[caseKind] || '不分潤'}；仍列入成本控制表供 OWNER／FINANCE 檢視，不列入分潤儀表。`
    });
    if (caseKind === 'private_loan') {
      caseRow.accountingTreatment = 'receivable_from_related_party';
      caseRow.reconciliationNote = '私人借支／股東員工往來；公司付款列往來款資產，返還時沖銷，不進收入、成本、公司開銷、淨利潤或員工分潤。';
    }
  } else {
    caseRow.profitSplit = '三人';
    caseRow.excludeFromProfitReports = false;
  }
  touchRowMeta(caseRow, true);
  CASES.push(caseRow);
  refreshAllCaseDropdowns();
  renderCases();
  closeModal('modal-new-case');
  saveData();
  showToast(`個案 ${caseCodeFinal} 已建立 ✓`, 'success');
}

// ══════════════════════════════════
// EDIT CASE
// ══════════════════════════════════
let editCaseTarget = null;
function openEditCase(caseCode) {
  if (!requireManage('dashboard', '您沒有編輯個案的權限')) return;
  const c = CASES.find(x => x.code === caseCode);
  if (!c) return;
  editCaseTarget = c;
  document.getElementById('edit-case-code-display').textContent = caseCode + '　' + (c.name||'');
  document.getElementById('edit-case-name').value   = c.name || '';
  document.getElementById('edit-case-amount').value = c.amount ? c.amount.toLocaleString('zh-TW') : '';
  document.getElementById('edit-case-person').value = c.person || '李鎮宇';
  document.getElementById('edit-case-status').value = c.status || '進行中';
  const pm = c.profitSplit === '不分潤' ? '不分潤' : c.profitSplit === '自訂' ? '自訂' : '三人';
  document.getElementById('edit-case-profit-mode').value = pm;
  const ratio = c.splitRatio || {};
  document.getElementById('edit-ratio-shower').value = Math.round((ratio.shower||0)*100) || '';
  document.getElementById('edit-ratio-peng').value   = Math.round((ratio.peng  ||0)*100) || '';
  document.getElementById('edit-ratio-lien').value   = Math.round((ratio.lien  ||0)*100) || '';
  document.getElementById('edit-case-ratio-wrap').style.display = pm === '自訂' ? '' : 'none';
  document.getElementById('edit-case-locked-notice').style.display = c.psSettled ? '' : 'none';
  document.getElementById('edit-case-no-overhead').checked = Number.isFinite(c.fixedOverheadShare);
  document.getElementById('edit-case-no-overhead-amt').value = Number.isFinite(c.fixedOverheadShare) ? c.fixedOverheadShare.toLocaleString('zh-TW') : '0';
  document.getElementById('edit-case-no-overhead-amt-wrap').style.display = Number.isFinite(c.fixedOverheadShare) ? '' : 'none';
  document.getElementById('edit-case-retention-amt').value = c.retentionAmt ? c.retentionAmt.toLocaleString('zh-TW') : '';
  document.getElementById('edit-case-retention-due').value = c.retentionDue || '';
  openModal('modal-edit-case');
}
function editCaseNoOverheadChange() {
  const checked = document.getElementById('edit-case-no-overhead').checked;
  document.getElementById('edit-case-no-overhead-amt-wrap').style.display = checked ? '' : 'none';
}
function editCaseProfitModeChange() {
  const pm = document.getElementById('edit-case-profit-mode').value;
  document.getElementById('edit-case-ratio-wrap').style.display = pm === '自訂' ? '' : 'none';
}
function submitEditCase() {
  if (!editCaseTarget) return;
  const name   = document.getElementById('edit-case-name').value.trim();
  if (!name) { showToast('請填寫個案名稱', 'error'); return; }
  const amtRaw = document.getElementById('edit-case-amount').value.trim();
  const amount = parseInt(amtRaw.replace(/[^0-9]/g,'')) || 0;
  const person = document.getElementById('edit-case-person').value;
  const status = document.getElementById('edit-case-status').value;
  const pm     = document.getElementById('edit-case-profit-mode').value;
  editCaseTarget.name   = name;
  editCaseTarget.amount = amount;
  editCaseTarget.person = person;
  editCaseTarget.status = status;
  if (pm === '不分潤') {
    editCaseTarget.profitSplit = '不分潤';
    editCaseTarget.excludeFromProfitReports = true;
    editCaseTarget.caseType = editCaseTarget.caseType || '不分潤／成本追蹤';
  } else if (pm === '自訂') {
    const s = parseFloat(document.getElementById('edit-ratio-shower').value)||0;
    const p = parseFloat(document.getElementById('edit-ratio-peng').value)||0;
    const l = parseFloat(document.getElementById('edit-ratio-lien').value)||0;
    if (Math.round(s+p+l) !== 100) { showToast('分潤比例合計必須等於 100%', 'error'); return; }
    editCaseTarget.profitSplit = '自訂';
    editCaseTarget.splitRatio  = { shower: s/100, peng: p/100, lien: l/100 };
    editCaseTarget.excludeFromProfitReports = false;
  } else {
    editCaseTarget.profitSplit = '三人';
    editCaseTarget.excludeFromProfitReports = false;
    delete editCaseTarget.splitRatio;
  }
  const noOverhead = document.getElementById('edit-case-no-overhead').checked;
  if (noOverhead) {
    // 直接讀畫面上的金額，不要悄悄套用舊值——固定金額是多少必須讓使用者自己看得到、自己填。
    const amtRaw = document.getElementById('edit-case-no-overhead-amt').value.trim();
    editCaseTarget.fixedOverheadShare = parseInt(amtRaw.replace(/[^0-9]/g,'')) || 0;
  } else {
    delete editCaseTarget.fixedOverheadShare;
  }
  const retentionAmtRaw = document.getElementById('edit-case-retention-amt').value.trim();
  const retentionAmt = parseInt(retentionAmtRaw.replace(/[^0-9]/g,'')) || 0;
  if (retentionAmt > 0) editCaseTarget.retentionAmt = retentionAmt; else delete editCaseTarget.retentionAmt;
  const retentionDue = document.getElementById('edit-case-retention-due').value;
  if (retentionDue) editCaseTarget.retentionDue = retentionDue; else delete editCaseTarget.retentionDue;
  closeModal('modal-edit-case');
  renderCases();
  renderDashboard();
  saveData();
  showToast(`${name} 已更新 ✓`, 'success');
}

// 個案編輯視窗「生成保固款應收」：只是幫忙把個案裡填好的保固款金額／到期日帶進「新增收款紀錄」
// 視窗，方便使用者不用重打一次；實際的應收紀錄仍要在那個視窗按下新增才會真的建立。
function caseGenerateRetentionReceivable() {
  if (!editCaseTarget) return;
  const c = editCaseTarget;
  const amtRaw = document.getElementById('edit-case-retention-amt').value.trim();
  const amt = parseInt(amtRaw.replace(/[^0-9]/g,'')) || 0;
  if (amt <= 0) { showToast('請先填寫保固款金額', 'error'); return; }
  const due = document.getElementById('edit-case-retention-due').value;
  closeModal('modal-edit-case');
  openAddReceivableModal();
  const caseEl = document.getElementById('rv-add-case'); if (caseEl) caseEl.value = c.code;
  const clientEl = document.getElementById('rv-add-client'); if (clientEl) clientEl.value = c.clientName || c.client || '';
  document.getElementById('rv-add-buyer').value = c.clientName || c.client || '';
  document.getElementById('rv-add-item').value = '保固保留款';
  document.getElementById('rv-add-receivable-amt').value = amt.toLocaleString('zh-TW');
  const typeEl = document.getElementById('rv-add-type'); if (typeEl) typeEl.value = 'retention';
  const dueEl = document.getElementById('rv-add-retention-due'); if (dueEl) dueEl.value = due;
  rvToggleReceivableType();
  showToast('已帶入保固款資料，確認無誤後按「新增」送出', 'success');
}

// ══════════════════════════════════
// CASE CODE GENERATOR
// ══════════════════════════════════
function genCaseCode() {
  const code = document.getElementById('new-client-code').value;
  if (!code) { document.getElementById('new-case-code').value = ''; return; }
  const caseKind = document.getElementById('new-case-type')?.value || 'normal';
  document.getElementById('new-case-code').value = nextCaseCodeForNewCase(code, caseKind);
}

function caseCodePrefixForNewCase(clientCode, caseKind) {
  const specialPrefixes = {
    family_pass_through: 'FAM',
    invoice_proxy: 'INV',
    private_loan: 'LOAN',
  };
  return specialPrefixes[caseKind] || clientCode;
}

function nextCaseCodeForNewCase(clientCode, caseKind, year = new Date().getFullYear()) {
  const prefixCode = caseCodePrefixForNewCase(clientCode, caseKind);
  const prefix = `YT-${prefixCode}-${year}-`;
  const used = new Set(CASES
    .map(c => String(c.code || ''))
    .filter(code => code.startsWith(prefix))
    .map(code => Number(code.slice(prefix.length)))
    .filter(num => Number.isInteger(num) && num > 0)
  );
  let seq = 1;
  while (used.has(seq)) seq += 1;
  return `${prefix}${String(seq).padStart(3, '0')}`;
}

function renderDashboard() {
  const canReviewPayreq = canManage('payreq');
  const canSeeTotals = canSeeFinancialTotals();
  const kpiGrid = document.getElementById('dashboard-kpi-grid');
  if (kpiGrid) kpiGrid.style.display = canSeeTotals ? '' : 'none';
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

  // KPI 1: 個案總數；未結案/待結算狀態在列表標籤呈現。
  const visibleCases = CASES.filter(c => userCanViewCaseFinancials(c.code, 'dashboard') || userCanViewCaseFinancials(c.code, 'profit'));
  const displayCases = dcSelCases === null ? visibleCases : visibleCases.filter(c => dcSelCases.has(c.code));
  const displayCaseCodes = new Set(displayCases.map(c => c.code));
  const inDashboardCaseFilter = code => !code || dcSelCases === null || displayCaseCodes.has(code);
  const activeCases = displayCases.filter(c => !c.psSettled && c.status !== '結案');
  const kpiCases = document.getElementById('dash-kpi-cases');
  if (kpiCases) kpiCases.innerHTML = canSeeTotals ? `${displayCases.length}<span>個</span>` : '—';
  const kpiCasesSub = document.getElementById('dash-kpi-cases-sub');
  if (kpiCasesSub) kpiCasesSub.textContent = dcSelCases === null ? '目前可見個案' : '目前篩選個案';

  // KPI 2: 合約總金額
  const totalContract = activeCases.reduce((s,c) => s+(c.amount||0), 0);
  const kpiContract = document.getElementById('dash-kpi-contract');
  if (kpiContract) kpiContract.innerHTML = canSeeTotals ? `${Math.round(totalContract/10000).toLocaleString('zh-TW')}<span>萬</span>` : '—';

  // KPI 3: 本月已收款
  const visibleReceivables = RECEIVABLES.filter(r => inDashboardCaseFilter(r.case) && (userCanViewCaseFinancials(r.case, 'dashboard') || userCanViewCaseFinancials(r.case, 'receivable')));
  const monthCollected = visibleReceivables.filter(r => receivableIsCollected(r) && r.collectDate?.startsWith(thisMonth)).reduce((s,r) => s+(r.collectAmt||0), 0);
  const totalPending   = visibleReceivables.filter(r => !receivableIsCollected(r)).reduce((s,r) => s+(r.invoiceAmt||0), 0);
  const kpiCollected = document.getElementById('dash-kpi-collected');
  if (kpiCollected) kpiCollected.innerHTML = canSeeTotals ? `${Math.round(monthCollected/10000).toLocaleString('zh-TW')}<span>萬</span>` : '—';
  const kpiCollectedSub = document.getElementById('dash-kpi-collected-sub');
  if (kpiCollectedSub) kpiCollectedSub.textContent = canSeeTotals ? `待入帳 ${Math.round(totalPending/10000)} 萬` : '僅管理者';

  // KPI 4: 待付廠商款（approved）；待審核另列提醒。
  const visiblePayables = PAYABLES.filter(p => inDashboardCaseFilter(p.case) && (
    userCanViewCaseScopedRow(p.case, 'dashboard', p.person) || userCanViewCaseScopedRow(p.case, 'payable', p.person)
  ));
  const pendingItems = visiblePayables.filter(p => p.status==='pending');
  const approvedItems = visiblePayables.filter(p => p.status==='approved');
  const approvedAmt   = approvedItems.reduce((s,p) => s+(p.amount||0), 0);
  const kpiPayable = document.getElementById('dash-kpi-payable');
  if (kpiPayable) kpiPayable.innerHTML = canSeeTotals ? `${Math.round(approvedAmt/10000).toLocaleString('zh-TW')}<span>萬</span>` : '—';
  const kpiPayableSub = document.getElementById('dash-kpi-payable-sub');
  if (kpiPayableSub) kpiPayableSub.textContent = canSeeTotals ? `${approvedItems.length} 筆待付款｜另 ${pendingItems.length} 筆待審核` : '僅管理者';

  // 待審核請款列表
  const dashBadge = document.getElementById('dash-payreq-badge');
  if (dashBadge) dashBadge.textContent = `${pendingItems.length} 筆`;
  updatePayreqNavBadge();
  const list = document.getElementById('pending-payreq-list');
  if (list) {
    list.innerHTML = pendingItems.length === 0
      ? '<div style="padding:20px;text-align:center;color:var(--text3);font-size:13px">目前無待審核請款</div>'
      : pendingItems.map((p, i) => `
        <div class="req-row">
          <div class="req-num">${i+1}</div>
          <div class="req-info">
            <div class="req-title">${p.vendor} — ${p.summary}</div>
            <div class="req-meta">
              <span>🏗️ ${p.caseName}</span>
              ${p.person?`<span>申請人：${p.person}</span>`:''}
              ${p.wantDate?`<span>希望付款：${p.wantDate}</span>`:''}
            </div>
            ${canReviewPayreq ? `<div class="req-actions">
              <button class="btn btn-sm" style="background:var(--success-bg);color:var(--success);border:1px solid rgba(110,184,148,0.3)" onclick="approveReq(${p.id})">核准</button>
              <button class="btn btn-ghost btn-sm" onclick="rejectPayreq(${p.id})">退回</button>
            </div>` : ''}
          </div>
          <div class="req-amount">${p.amount>=0?'':'-'}$${Math.abs(p.amount).toLocaleString('zh-TW')}</div>
        </div>`).join('');
  }

  // 近期應收帳款
  const rvTbody = document.getElementById('dash-rv-tbody');
  if (rvTbody) {
    const recent = visibleReceivables.slice().sort((a,b) => (b.collectDate||b.invoiceDate||'').localeCompare(a.collectDate||a.invoiceDate||'')).slice(0, 6);
    rvTbody.innerHTML = recent.map(r => `
      <tr>
        <td style="font-size:11px;font-family:'DM Mono',monospace;color:var(--text3)">${r.collectDate||r.invoiceDate||'—'}</td>
        <td><div style="font-size:12px;font-weight:500">${r.caseName}</div><div class="case-code" style="font-size:11px">${caseCodeBreak(r.case)}</div></td>
        <td style="font-size:12px">${r.item}</td>
        <td><div class="amount" style="font-size:12px">${r.collectAmt>0?'$'+r.collectAmt.toLocaleString('zh-TW'):'—'}</div></td>
        <td><span class="tag ${receivableIsCollected(r)?'tag-done':'tag-pending'}">${receivableIsCollected(r)?'已入帳':'待入帳'}</span></td>
      </tr>`).join('');
  }
}
