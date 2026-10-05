// CLIENTS MODULE. Extracted verbatim from ops/index.html at main@514e655.

function submitNewClient() {
  if (!requireApplySelf('clients', '您沒有新增客戶的權限')) return;
  const code  = document.getElementById('nc-code').value.trim().toUpperCase();
  const nameZh = document.getElementById('nc-name-zh').value.trim();
  const nameEn = document.getElementById('nc-name-en').value.trim();

  if (!code || code.length < 2)  { showToast('請輸入至少2碼的客戶代碼', 'error'); return; }
  if (!nameZh) { showToast('請輸入客戶名稱', 'error'); return; }

  // 檢查代碼是否已存在：直接查 CLIENTS 主檔，不能只看這個下拉目前有什麼選項
  // （下拉是從 CLIENTS 建出來的畫面而已，不是正式資料來源）。
  if (CLIENTS.find(x => x.code === code)) { showToast(`代碼 ${code} 已存在，請換一個`, 'error'); return; }

  // 這裡原本只把選項加進下拉、沒有真的寫進 CLIENTS 主檔——重整頁面或換一台裝置這筆客戶就會
  // 消失，也不會同步到雲端，等於是假新增。改成跟「客戶主檔」頁面一樣，真的存進 CLIENTS。
  CLIENTS.push({
    code, shortName: nameZh, fullName: nameEn || '',
    taxId:'', type:'', group:'', address:'', contact:'', phone:'', email:'', note:''
  });
  saveData();

  const label = nameEn ? `${code} ｜ ${nameZh}（${nameEn}）` : `${code} ｜ ${nameZh}`;
  const sel = document.getElementById('new-client-code');
  const opt = document.createElement('option');
  opt.value = code;
  opt.textContent = label;
  sel.appendChild(opt);

  document.getElementById('nc-code').value = '';
  document.getElementById('nc-name-zh').value = '';
  document.getElementById('nc-name-en').value = '';

  closeModal('modal-new-client');
  // 回到新增案件並自動選取剛新增的客戶
  sel.value = code;
  genCaseCode();
  renderClients();
  showToast(`客戶「${nameZh}」已新增 ✓`, 'success');
}

function renderClients() {
  const manage = canManage('clients');
  const kw = (document.getElementById('cl-search')?.value || '').toLowerCase();
  const typeF = document.getElementById('cl-filter-type')?.value || '';
  let list = CLIENTS.filter(c => {
    const matchKw = !kw || `${c.code} ${c.shortName} ${c.fullName} ${c.contact}`.toLowerCase().includes(kw);
    const matchType = !typeF || c.type === typeF;
    return matchKw && matchType;
  });

  // Stats
  const statsEl = document.getElementById('cl-stats');
  if (statsEl) {
    const types = [...new Set(CLIENTS.map(c => c.type))];
    const groups = [...new Set(CLIENTS.map(c => c.group).filter(Boolean))];
    statsEl.innerHTML = `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px 20px">
        <div style="font-size:10px;color:var(--text3);font-family:'DM Mono',monospace;letter-spacing:.1em;text-transform:uppercase;margin-bottom:8px">客戶總數</div>
        <div style="font-size:26px;font-family:'DM Mono',monospace;font-weight:500">${CLIENTS.length}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:4px">顯示 ${list.length} 筆</div>
      </div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px 20px">
        <div style="font-size:10px;color:var(--text3);font-family:'DM Mono',monospace;letter-spacing:.1em;text-transform:uppercase;margin-bottom:8px">汽車展間</div>
        <div style="font-size:26px;font-family:'DM Mono',monospace;font-weight:500">${CLIENTS.filter(c=>c.type==='汽車展間').length}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:4px">個</div>
      </div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px 20px">
        <div style="font-size:10px;color:var(--text3);font-family:'DM Mono',monospace;letter-spacing:.1em;text-transform:uppercase;margin-bottom:8px">商業空間</div>
        <div style="font-size:26px;font-family:'DM Mono',monospace;font-weight:500">${CLIENTS.filter(c=>c.type==='商業空間').length}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:4px">個</div>
      </div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px 20px">
        <div style="font-size:10px;color:var(--text3);font-family:'DM Mono',monospace;letter-spacing:.1em;text-transform:uppercase;margin-bottom:8px">集團數</div>
        <div style="font-size:26px;font-family:'DM Mono',monospace;font-weight:500">${groups.length}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:4px">個集團</div>
      </div>
    `;
  }

  const tbody = document.getElementById('cl-tbody');
  if (!tbody) return;
  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" style="padding:32px;text-align:center;color:var(--text3)">無符合條件的客戶</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(c => `
    <tr style="cursor:pointer" onclick="viewClient('${c.code}')">
      <td style="padding-left:14px"><span style="font-family:'DM Mono',monospace;font-size:12px;font-weight:600;color:var(--accent)">${c.code}</span></td>
      <td style="font-weight:500">${c.shortName}</td>
      <td style="font-size:12px;color:var(--text2)">${c.fullName||'—'}</td>
      <td style="font-family:'DM Mono',monospace;font-size:12px;color:var(--text3)">${c.taxId||'—'}</td>
      <td><span class="tag tag-client" style="font-size:10px">${c.type||'—'}</span></td>
      <td style="font-size:12px;color:var(--text3)">${c.group||'—'}</td>
      <td style="font-size:13px">${c.contact||'—'}</td>
      <td style="font-family:'DM Mono',monospace;font-size:12px;color:var(--text3)">${c.phone||'—'}</td>
      <td style="font-size:12px;color:var(--text3);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.note||'—'}</td>
      <td style="text-align:center;white-space:nowrap;display:flex;gap:4px;justify-content:center">
        ${canManage('receivable') ? `<button class="btn btn-primary btn-sm" style="font-size:11px" onclick="event.stopPropagation();openReceivableForClient('${c.code}')">新增收款</button>` : ''}
        ${manage ? `<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();openClientModal('${c.code}')">編輯</button>` : '<span style="font-size:11px;color:var(--text3)">唯讀</span>'}
      </td>
    </tr>`).join('');
}

function viewClient(code) {
  const c = CLIENTS.find(x => x.code === code);
  if (!c) return;
  document.getElementById('cl-detail-title').textContent = `${c.code} · ${c.shortName}`;
  document.getElementById('cl-detail-body').innerHTML = `
    <div style="display:grid;gap:14px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div><div style="font-size:10px;color:var(--text3);font-family:'DM Mono',monospace;letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px">客戶代碼</div><div style="font-family:'DM Mono',monospace;font-size:14px;color:var(--accent);font-weight:600">${c.code}</div></div>
        <div><div style="font-size:10px;color:var(--text3);font-family:'DM Mono',monospace;letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px">類型</div><span class="tag tag-client">${c.type||'—'}</span></div>
      </div>
      <div><div style="font-size:10px;color:var(--text3);font-family:'DM Mono',monospace;letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px">法人全名</div><div style="font-size:14px;font-weight:500">${c.fullName||'—'}</div></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div><div style="font-size:10px;color:var(--text3);font-family:'DM Mono',monospace;letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px">統一編號</div><div style="font-family:'DM Mono',monospace">${c.taxId||'—'}</div></div>
        <div><div style="font-size:10px;color:var(--text3);font-family:'DM Mono',monospace;letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px">所屬集團</div><div>${c.group||'—'}</div></div>
      </div>
      <div><div style="font-size:10px;color:var(--text3);font-family:'DM Mono',monospace;letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px">登記地址</div><div style="font-size:13px">${c.address||'—'}</div></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div><div style="font-size:10px;color:var(--text3);font-family:'DM Mono',monospace;letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px">主要聯絡人</div><div>${c.contact||'—'}</div></div>
        <div><div style="font-size:10px;color:var(--text3);font-family:'DM Mono',monospace;letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px">電話</div><div style="font-family:'DM Mono',monospace">${c.phone||'—'}</div></div>
      </div>
      ${c.email?`<div><div style="font-size:10px;color:var(--text3);font-family:'DM Mono',monospace;letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px">Email</div><div>${c.email}</div></div>`:''}
      ${c.note?`<div style="background:var(--surface2);border-radius:8px;padding:12px"><div style="font-size:10px;color:var(--text3);font-family:'DM Mono',monospace;letter-spacing:.1em;text-transform:uppercase;margin-bottom:6px">備註</div><div style="font-size:13px;line-height:1.6">${c.note}</div></div>`:''}
    </div>`;
  const editBtn = document.getElementById('cl-detail-edit-btn');
  editBtn.style.display = canManage('clients') ? '' : 'none';
  editBtn.onclick = () => { closeModal('modal-client-detail'); openClientModal(code); };
  openModal('modal-client-detail');
}

function openClientModal(code) {
  clEditCode = code || null;
  const c = code ? CLIENTS.find(x => x.code === code) : null;
  // 新增客戶只需要「申請自己」等級（跟廠商主檔一致）；編輯既有客戶資料仍需完整管理權限。
  if (c ? !requireManage('clients', '您沒有編輯客戶的權限') : !requireApplySelf('clients', '您沒有新增客戶的權限')) return;
  document.getElementById('cl-modal-title').textContent = c ? `編輯客戶 · ${c.shortName}` : '新增客戶';
  const fields = ['code','shortName','fullName','taxId','type','group','address','contact','phone','email','note'];
  fields.forEach(f => {
    const el = document.getElementById('cl-f-'+f);
    if (!el) return;
    if (el.tagName === 'SELECT') el.value = c ? (c[f]||'') : '';
    else if (el.tagName === 'TEXTAREA') el.value = c ? (c[f]||'') : '';
    else el.value = c ? (c[f]||'') : '';
  });
  if (c) document.getElementById('cl-f-code').readOnly = true;
  else document.getElementById('cl-f-code').readOnly = false;
  openModal('modal-client');
}

function submitClient() {
  if (clEditCode ? !requireManage('clients', '您沒有編輯客戶的權限') : !requireApplySelf('clients', '您沒有新增客戶的權限')) return;
  const code = document.getElementById('cl-f-code').value.trim().toUpperCase();
  const shortName = document.getElementById('cl-f-shortName').value.trim();
  if (!code || !shortName) { showToast('代碼與客戶簡稱為必填', 'error'); return; }
  const obj = {
    code, shortName,
    fullName: document.getElementById('cl-f-fullName').value.trim(),
    taxId: document.getElementById('cl-f-taxId').value.trim(),
    type: document.getElementById('cl-f-type').value,
    group: document.getElementById('cl-f-group').value.trim(),
    address: document.getElementById('cl-f-address').value.trim(),
    contact: document.getElementById('cl-f-contact').value.trim(),
    phone: document.getElementById('cl-f-phone').value.trim(),
    email: document.getElementById('cl-f-email').value.trim(),
    note: document.getElementById('cl-f-note').value.trim(),
  };
  if (clEditCode) {
    const idx = CLIENTS.findIndex(x => x.code === clEditCode);
    if (idx >= 0) CLIENTS[idx] = obj;
    saveData();
    showToast('客戶資料已更新', 'success');
  } else {
    if (CLIENTS.find(x => x.code === code)) { showToast('代碼重複，請換一個', 'error'); return; }
    CLIENTS.push(obj);
    saveData();
    showToast('新客戶已新增', 'success');
  }
  closeModal('modal-client');
  renderClients();
}
