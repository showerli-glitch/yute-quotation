// VENDORS MODULE. Extracted verbatim from ops/index.html at main@514e655.

// ══════════════════════════════════
// VENDOR MODULE
// ══════════════════════════════════
let vdSortKey = 'code', vdSortAsc = true;
function vendorCreatedByCurrentUser(v) {
  const who = rowAuditUser();
  return !!v?.createdBy && [who, currentUser?.email, currentUser?.name].filter(Boolean).includes(v.createdBy);
}
function canEditVendor(v) { return canManage('vendors') || (canApplySelf('vendors') && vendorCreatedByCurrentUser(v)); }
function vendorPrefixForTrade(trade) {
  const counts = {};
  VENDORS.filter(v => v.trade === trade).forEach(v => {
    const match = String(v.code || '').match(/^([A-Z]+)-\d+$/);
    if (match) counts[match[1]] = (counts[match[1]] || 0) + 1;
  });
  const inferred = Object.entries(counts).sort((a,b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
  if (inferred) return inferred;
  const fallback = {'假設及拆運':'DM','土木工程':'TW','水電／照明':'EL','防水':'WP','輕隔間及輕鋼架天花板':'LG','泥作及貼磚':'TL','木作及系統櫃':'WD','門扇':'DR','鋁窗':'AL','鐵件及金屬':'MT','油漆':'PT','地坪':'FL','玻璃及貼膜':'GL','廣告及招牌':'AD','窗簾':'CR','空調':'AC','石材／人造石':'ST','衛浴設備':'BA','廚具設備':'KT','燈具／設備及其他':'EQ','完工清潔':'CL','設計製圖':'DS','專業顧問服務':'PS','建材供應':'SP','傢俱設備':'FN','其他':'OT'};
  return fallback[trade] || 'VD';
}
function vdSuggestCodeFromTrade() {
  if (vdEditCode) return;
  const trade = document.getElementById('vd-f-trade').value;
  if (!trade) return;
  const prefix = vendorPrefixForTrade(trade);
  const max = VENDORS.reduce((n, v) => {
    const match = String(v.code || '').match(new RegExp(`^${prefix}-(\\d+)$`));
    return match ? Math.max(n, Number(match[1])) : n;
  }, 0);
  document.getElementById('vd-f-code').value = `${prefix}-${String(max + 1).padStart(3,'0')}`;
}
function vdRefreshStatusForm() {
  const disabled = document.getElementById('vd-f-status').value === '停用';
  document.getElementById('vd-disabled-date-wrap').style.display = disabled ? '' : 'none';
  const btn = document.getElementById('vd-toggle-status-btn');
  btn.textContent = disabled ? '取消停用' : '停用廠商';
  btn.className = `btn ${disabled ? 'btn-ghost' : 'btn-danger'}`;
  btn.style.width = '100%';
}
function vdToggleStatusInForm() {
  const status = document.getElementById('vd-f-status');
  const date = document.getElementById('vd-f-disabledDate');
  const willDisable = status.value !== '停用';
  status.value = willDisable ? '停用' : '有效';
  date.value = willDisable ? (date.value || localDateKey()) : '';
  vdRefreshStatusForm();
}
function vdSetSort(key) {
  if (vdSortKey === key) vdSortAsc = !vdSortAsc;
  else { vdSortKey = key; vdSortAsc = true; }
  renderVendors();
}

function renderVendors() {
  const kw = (document.getElementById('vd-search')?.value || '').toLowerCase();
  const tradeF = document.getElementById('vd-filter-trade')?.value || '';
  const statusF = document.getElementById('vd-filter-status')?.value || '';
  let list = VENDORS.filter(v => {
    const matchKw = !kw || `${v.code} ${v.name} ${v.owner} ${v.trade}`.toLowerCase().includes(kw);
    const matchTrade = !tradeF || v.trade === tradeF;
    const matchStatus = !statusF || v.status === statusF;
    return matchKw && matchTrade && matchStatus;
  });

  // 排序：狀態永遠有效在前、停用在後；次要依選擇欄位
  const statusOrder = s => s === '有效' ? 0 : 1;
  list.sort((a, b) => {
    const sd = statusOrder(a.status) - statusOrder(b.status);
    if (sd !== 0) return sd;
    let cmp = 0;
    if (vdSortKey === 'code') {
      cmp = a.code.localeCompare(b.code, 'zh-TW', {numeric: true});
    } else if (vdSortKey === 'name') {
      cmp = a.name.localeCompare(b.name, 'zh-TW', {sensitivity: 'base'});
    }
    return vdSortAsc ? cmp : -cmp;
  });

  // 更新欄位標頭箭頭
  ['code','name'].forEach(k => {
    const el = document.getElementById(`vd-sort-${k}`);
    if (el) el.textContent = vdSortKey === k ? (vdSortAsc ? '↑' : '↓') : '';
  });

  const statsEl = document.getElementById('vd-stats-line');
  if (statsEl) {
    const trades = [...new Set(VENDORS.map(v => v.trade))];
    statsEl.textContent = `共 ${VENDORS.length} 家廠商 · ${trades.length} 種工種 · 顯示 ${list.length} 筆`;
  }

  const tbody = document.getElementById('vd-tbody');
  if (!tbody) return;
  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="12" style="padding:32px;text-align:center;color:var(--text3)">無符合條件的廠商</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(v => {
    const bankInfo = v.bank ? `${v.bank}${v.branch?' · '+v.branch:''}` : '—';
    const phone = v.mobile || v.tel || '—';
    return `
    <tr style="cursor:pointer" onclick="viewVendor('${v.code}')">
      <td style="padding-left:14px"><span style="font-family:'DM Mono',monospace;font-size:11px;font-weight:600;color:var(--accent)">${v.code}</span></td>
      <td style="font-weight:500">${v.name}</td>
      <td><span class="tag tag-inactive" style="font-size:10px">${v.trade||'—'}</span></td>
      <td style="font-family:'DM Mono',monospace;font-size:12px;color:var(--text3)">${v.taxId||'—'}</td>
      <td style="font-size:12px">${v.owner||'—'}</td>
      <td style="font-family:'DM Mono',monospace;font-size:12px;color:var(--text3)">${phone}</td>
      <td style="font-size:12px;color:var(--text2)">${bankInfo}</td>
      <td style="font-size:12px;color:var(--text2)">${v.accountName||'—'}</td>
      <td style="font-family:'DM Mono',monospace;font-size:11px;color:var(--text3)">${v.account||'—'}</td>
      <td style="font-size:12px;color:var(--text3);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${v.note||'—'}</td>
      <td style="text-align:center"><span class="tag ${v.status==='有效'?'tag-done':'tag-inactive'}" style="font-size:10px">${v.status}</span></td>
      <td style="text-align:center;white-space:nowrap;display:flex;gap:4px;justify-content:center">
        ${canApplySelf('payreq') ? `<button class="btn btn-primary btn-sm" style="font-size:11px" onclick="event.stopPropagation();openPayreqForVendor('${v.code}')">發起請款</button>` : ''}
        ${canEditVendor(v) ? `<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();openVendorModal('${v.code}')">編輯</button>` : '<span style="font-size:11px;color:var(--text3)">唯讀</span>'}
      </td>
    </tr>`;
  }).join('');
}

function viewVendor(code) {
  const v = VENDORS.find(x => x.code === code);
  if (!v) return;
  const phone = [v.tel, v.mobile].filter(Boolean).join(' · ') || '—';
  document.getElementById('vd-detail-title').textContent = `${v.code} · ${v.name}`;
  document.getElementById('vd-detail-body').innerHTML = `
    <div style="display:grid;gap:14px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div><div style="font-size:10px;color:var(--text3);font-family:'DM Mono',monospace;letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px">廠商代碼</div><div style="font-family:'DM Mono',monospace;font-size:14px;color:var(--accent);font-weight:600">${v.code}</div></div>
        <div><div style="font-size:10px;color:var(--text3);font-family:'DM Mono',monospace;letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px">工種</div><span class="tag tag-inactive">${v.trade||'—'}</span></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div><div style="font-size:10px;color:var(--text3);font-family:'DM Mono',monospace;letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px">統一編號</div><div style="font-family:'DM Mono',monospace">${v.taxId||'—'}</div></div>
        <div><div style="font-size:10px;color:var(--text3);font-family:'DM Mono',monospace;letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px">負責人/聯絡人</div><div>${v.owner||'—'}</div></div>
      </div>
      <div><div style="font-size:10px;color:var(--text3);font-family:'DM Mono',monospace;letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px">電話</div><div style="font-family:'DM Mono',monospace">${phone}</div></div>
      ${v.email?`<div><div style="font-size:10px;color:var(--text3);font-family:'DM Mono',monospace;letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px">Email</div><div>${v.email}</div></div>`:''}
      ${v.address?`<div><div style="font-size:10px;color:var(--text3);font-family:'DM Mono',monospace;letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px">營業地址</div><div style="font-size:13px">${v.address}</div></div>`:''}
      <div style="height:1px;background:var(--border)"></div>
      <div style="font-size:11px;color:var(--accent);font-weight:600;letter-spacing:.1em">匯款資訊</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div><div style="font-size:10px;color:var(--text3);font-family:'DM Mono',monospace;letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px">銀行</div><div style="font-size:13px">${v.bank||'—'}${v.branch?' · '+v.branch:''}</div></div>
        <div><div style="font-size:10px;color:var(--text3);font-family:'DM Mono',monospace;letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px">慣用付款</div><div>${v.payMethod||'—'}</div></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div><div style="font-size:10px;color:var(--text3);font-family:'DM Mono',monospace;letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px">帳號</div><div style="font-family:'DM Mono',monospace;font-size:13px">${v.account||'—'}</div></div>
        <div><div style="font-size:10px;color:var(--text3);font-family:'DM Mono',monospace;letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px">戶名</div><div style="font-size:13px">${v.accountName||'—'}</div></div>
      </div>
      <div><div style="font-size:10px;color:var(--text3);font-family:'DM Mono',monospace;letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px">狀態</div><div>${v.status||'有效'}${v.status==='停用' && v.disabledDate ? ` · ${v.disabledDate}` : ''}</div></div>
      ${v.note?`<div style="background:var(--surface2);border-radius:8px;padding:12px"><div style="font-size:10px;color:var(--text3);font-family:'DM Mono',monospace;letter-spacing:.1em;text-transform:uppercase;margin-bottom:6px">備註</div><div style="font-size:13px;line-height:1.6">${v.note}</div></div>`:''}
    </div>`;
  const editBtn = document.getElementById('vd-detail-edit-btn');
  editBtn.style.display = canEditVendor(v) ? '' : 'none';
  editBtn.onclick = () => { closeModal('modal-vendor-detail'); openVendorModal(code); };
  openModal('modal-vendor-detail');
}

function openVendorModal(code) {
  vdEditCode = code || null;
  const v = code ? VENDORS.find(x => x.code === code) : null;
  if (v ? !canEditVendor(v) : !canApplySelf('vendors')) { showToast('您沒有此廠商的編輯權限', 'error'); return; }
  document.getElementById('vd-modal-title').textContent = v ? `編輯廠商 · ${v.name}` : '新增廠商';
  const fields = ['code','name','trade','taxId','owner','tel','mobile','email','address','bank','branch','account','accountName','payMethod','status','note'];
  fields.forEach(f => {
    const el = document.getElementById('vd-f-'+f);
    if (!el) return;
    if (el.tagName === 'SELECT') el.value = v ? (v[f]||'') : (f==='payMethod'?'匯款':f==='status'?'有效':'');
    else if (el.tagName === 'TEXTAREA') el.value = v ? (v[f]||'') : '';
    else el.value = v ? (v[f]||'') : '';
  });
  if (v) document.getElementById('vd-f-code').readOnly = true;
  else document.getElementById('vd-f-code').readOnly = false;
  document.getElementById('vd-f-disabledDate').value = v?.disabledDate || '';
  vdRefreshStatusForm();
  document.getElementById('vd-delete-btn').style.display = v && canEditVendor(v) ? '' : 'none';
  openModal('modal-vendor');
}

function submitVendor() {
  const existing = vdEditCode ? VENDORS.find(x => x.code === vdEditCode) : null;
  if (existing ? !canEditVendor(existing) : !canApplySelf('vendors')) { showToast('您沒有此廠商的編輯權限', 'error'); return; }
  const code = document.getElementById('vd-f-code').value.trim().toUpperCase();
  const name = document.getElementById('vd-f-name').value.trim();
  const trade = document.getElementById('vd-f-trade').value;
  if (!code || !name || !trade) { showToast('代碼、廠商名稱、工種為必填', 'error'); return; }
  const obj = {
    code, name, trade,
    taxId: document.getElementById('vd-f-taxId').value.trim(),
    owner: document.getElementById('vd-f-owner').value.trim(),
    tel: document.getElementById('vd-f-tel').value.trim(),
    mobile: document.getElementById('vd-f-mobile').value.trim(),
    email: document.getElementById('vd-f-email').value.trim(),
    address: document.getElementById('vd-f-address').value.trim(),
    bank: document.getElementById('vd-f-bank').value.trim(),
    branch: document.getElementById('vd-f-branch').value.trim(),
    account: document.getElementById('vd-f-account').value.trim(),
    accountName: document.getElementById('vd-f-accountName').value.trim(),
    payMethod: document.getElementById('vd-f-payMethod').value,
    status: document.getElementById('vd-f-status').value,
    disabledDate: document.getElementById('vd-f-status').value === '停用' ? document.getElementById('vd-f-disabledDate').value : '',
    note: document.getElementById('vd-f-note').value.trim(),
  };
  if (obj.status === '停用' && !obj.disabledDate) { showToast('請選擇停用日期', 'error'); return; }
  if (vdEditCode) {
    const idx = VENDORS.findIndex(x => x.code === vdEditCode);
    if (idx >= 0) VENDORS[idx] = touchRowMeta({...VENDORS[idx], ...obj});
    saveData();
    showToast('廠商資料已更新', 'success');
  } else {
    if (VENDORS.find(x => x.code === code)) { showToast('代碼重複，請換一個', 'error'); return; }
    VENDORS.push(touchRowMeta(obj, true));
    saveData();
    showToast('新廠商已新增', 'success');
  }
  closeModal('modal-vendor');
  renderVendors();
}

// ── Post-split additions (not part of the verbatim move) ──

// 這些廠商會被系統自動補回（data.js 的 ensureCoreVendorRecords 與 applyDataSnapshot 遷移），
// 刪掉後下次載入又會出現，所以不開放刪除，不再使用請改為停用。
const VENDOR_AUTO_RESTORED_CODES = ['OT-010'];
const VENDOR_AUTO_RESTORED_NAMES = ['林振明（柏實）','台北設計工會','澤鑠科技','侑昇工程行','林繆云'];
function vendorPayableReferences(v) {
  const name = String(v?.name || '').trim();
  const code = String(v?.code || '').trim();
  return PAYABLES.filter(p => {
    const vendor = String(p.vendor || '').trim();
    return !!vendor && (vendor === name || vendor.startsWith(`${code} -`));
  });
}
// 刪除只開放給可編輯該廠商的人（完整管理，或申請自己且為建立者），而且必須沒有任何應付／請款紀錄使用。
function deleteVendor(code) {
  const index = VENDORS.findIndex(v => v.code === code);
  if (index < 0) return;
  const target = VENDORS[index];
  if (!canEditVendor(target)) { showToast('您沒有刪除此廠商的權限', 'error'); return; }
  if (VENDOR_AUTO_RESTORED_CODES.includes(target.code) || VENDOR_AUTO_RESTORED_NAMES.includes(target.name)) {
    alert(`「${target.name}」是系統內建廠商，刪除後重新整理會自動補回，因此不開放刪除。\n\n不再使用請改為「停用」。`);
    return;
  }
  const refs = vendorPayableReferences(target);
  if (refs.length) {
    const detail = refs.slice(0, 5).map(p => `- #${p.id || '-'} ${p.summary || '未填摘要'}／$${Number(p.amount || 0).toLocaleString('zh-TW')}`).join('\n');
    const more = refs.length > 5 ? `\n...另有 ${refs.length - 5} 筆` : '';
    alert(`「${target.name}」已有 ${refs.length} 筆應付／請款紀錄使用，不能刪除：\n${detail}${more}\n\n不再使用請改為「停用」。`);
    return;
  }
  if (!confirm(`確定刪除廠商「${target.name}」（${target.code}）？\n\n此動作會寫入審計紀錄。`)) return;
  const before = auditClone(target);
  VENDORS.splice(index, 1);
  recordAuditLog('delete', 'vendor', target.code, before, null, {
    riskLevel:'high',
    targetLabel:`${target.name}／${target.code}`,
    reason:'刪除沒有應付／請款紀錄的誤建廠商'
  });
  vdEditCode = null;
  saveData();
  closeModal('modal-vendor');
  closeModal('modal-vendor-detail');
  renderVendors();
  showToast(`已刪除廠商「${target.name}」`, 'success');
}
