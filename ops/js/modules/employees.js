// EMPLOYEES MODULE. Extracted verbatim from ops/index.html at main@4e42a53.

// ══════════════════════════════════
// CLIENT MODULE
// ══════════════════════════════════
function renderEmployees() {
  const manage = canManage('employees');
  const kw = (document.getElementById('emp-search')?.value || '').toLowerCase();
  const statusF = document.getElementById('emp-filter-status')?.value || '';
  let list = EMPLOYEES.filter(e => {
    const status = empEffectiveStatus(e);
    const matchKw = !kw || `${e.name} ${e.role} ${e.email || ''} ${EMP_ACCESS_ROLES[employeeAccessRole(e)] || ''} ${e.attendanceRequired === false ? '免打卡' : '需打卡'}`.toLowerCase().includes(kw);
    const matchStatus = !statusF || status === statusF;
    return matchKw && matchStatus;
  });
  const tbody = document.getElementById('emp-tbody');
  if (!tbody) return;
  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="12" style="padding:32px;text-align:center;color:var(--text3)">無符合條件的員工</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(e => {
    const status = empEffectiveStatus(e);
    return `
    <tr>
      <td style="font-weight:500;padding-left:14px">${e.name}</td>
      <td style="font-size:12px;color:var(--text2)">${e.role||'—'}</td>
      <td style="font-family:'DM Mono',monospace;font-size:12px;color:var(--text3)">${e.startDate||'—'}</td>
      <td style="font-family:'DM Mono',monospace;font-size:12px;color:var(--text3)">${e.contact||'—'}</td>
      <td style="font-family:'DM Mono',monospace;font-size:12px;color:var(--text3)">${e.email||'—'}</td>
      <td style="font-family:'DM Mono',monospace;font-size:12px;color:var(--text3)">${e.laborInsuranceDate||'—'}</td>
      <td style="font-family:'DM Mono',monospace;font-size:12px;color:var(--text3)">${e.healthInsuranceDate||'—'}</td>
      <td><span class="tag" style="font-size:10px;${employeeAccessRole(e)==='none'?'opacity:.55':''}">${EMP_ACCESS_ROLES[employeeAccessRole(e)] || EMP_ACCESS_ROLES.none}</span></td>
      <td><span class="tag" style="font-size:10px;${e.attendanceRequired===false?'opacity:.55':''}">${e.attendanceRequired === false ? '免打卡' : '需打卡'}</span></td>
      <td><span class="tag" style="font-size:10px;${status==='已離職'?'opacity:.6':''}">${status}</span></td>
      <td style="font-size:12px;color:var(--text3);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${e.profitEligible?'<span style="color:var(--accent)">可參與分潤</span> · ':''}${e.note||'—'}</td>
      <td style="text-align:center;white-space:nowrap">
        ${manage ? `<button class="btn btn-ghost btn-sm" onclick="openEmployeeModal('${e.id}')">編輯</button>` : '<span style="font-size:11px;color:var(--text3)">唯讀</span>'}
      </td>
    </tr>`;
  }).join('');
}

const EMP_PERM_MODULES = [
  {key:'dashboard',   label:'儀表板'},
  {key:'payreq',      label:'廠商請款'},
  {key:'payable',     label:'應付帳款'},
  {key:'receivable',  label:'應收帳款'},
  {key:'expense',     label:'費用申請'},
  {key:'overhead',    label:'公司開銷'},
  {key:'tax',         label:'稅務管理'},
  {key:'payroll',     label:'薪資管理'},
  {key:'attendance',  label:'出勤記錄'},
  {key:'profit',      label:'成本控制'},
  {key:'profitshare', label:'分潤設定'},
  {key:'contract',    label:'合約管理'},
  {key:'quotation',   label:'報價系統'},
  {key:'feedback',    label:'客戶回饋'},
  {key:'systemnotes', label:'系統筆記'},
  {key:'employees',   label:'員工管理'},
  {key:'clients',     label:'客戶主檔'},
  {key:'vendors',     label:'廠商主檔'},
];
const EMP_PERM_LEVELS = [
  {value:'manage',               label:'完整管理'},
  {value:'view_all',             label:'查看全部'},
  {value:'view_all_apply_self',  label:'查看全部＋申請自己'},
  {value:'view_self_apply_self', label:'查看自己＋申請自己'},
  {value:'view_profit_cases_apply_self', label:'查看分潤案件＋申請自己'},
  {value:'view_self',            label:'查看自己'},
  {value:'view_profit_cases',    label:'查看有分潤案件'},
  {value:'none',                 label:'無權限'},
];

function openEmployeeModal(id) {
  if (!requireManage('employees')) return;
  empEditId = id || null;
  const e = id ? EMPLOYEES.find(x => x.id === id) : null;
  document.getElementById('emp-modal-title').textContent = e ? `編輯員工 · ${e.name}` : '新增員工';
  const fields = ['name','role','startDate','contact','email','laborInsuranceDate','healthInsuranceDate','idNumber','emergencyContact','address','payrollBank','payrollBranch','payrollAccountName','payrollAccount','status','endDate','endReason','note'];
  fields.forEach(f => {
    const el = document.getElementById('emp-f-'+f);
    if (!el) return;
    el.value = e ? (f === 'status' ? empEffectiveStatus(e) : (e[f] || '')) : (f==='status'?'在職':'');
  });
  const accessEl = document.getElementById('emp-f-accessRole');
  if (accessEl) {
    accessEl.value = e ? employeeAccessRole(e) : 'none';
    accessEl.disabled = currentUser.roleCode !== 'OWNER';
  }
  const profitEl = document.getElementById('emp-f-profitEligible');
  if (profitEl) profitEl.checked = !!e?.profitEligible;
  const attendanceEl = document.getElementById('emp-f-attendanceRequired');
  if (attendanceEl) attendanceEl.checked = e ? e.attendanceRequired !== false : true;
  // 權限矩陣（OWNER 編輯既有員工才顯示）
  const permSection = document.getElementById('emp-perm-section');
  const permTbody = document.getElementById('emp-perm-tbody');
  if (permSection && permTbody) {
    const isOwner = currentUser.roleCode === 'OWNER';
    const isEdit = !!e;
    permSection.style.display = (isOwner && isEdit) ? '' : 'none';
    if (isOwner && isEdit) {
      const curPerms = USER_PERMISSIONS[e.id] || {};
      const optHtml = EMP_PERM_LEVELS.map(l => `<option value="${l.value}">${l.label}</option>`).join('');
      permTbody.innerHTML = EMP_PERM_MODULES.map(m => {
        const cur = curPerms[m.key] || 'none';
        return `<tr style="border-bottom:1px solid var(--border2)">
          <td style="padding:5px 8px;color:var(--text2);font-size:12px;white-space:nowrap">${m.label}</td>
          <td style="padding:4px 8px">
            <select class="form-select" id="ep-${m.key}" style="font-size:12px;padding:3px 8px;height:28px">${optHtml}</select>
          </td>
        </tr>`;
      }).join('');
      EMP_PERM_MODULES.forEach(m => {
        const sel = document.getElementById('ep-'+m.key);
        if (sel) sel.value = curPerms[m.key] || 'none';
      });
    }
  }
  // 新增個案權限（獨立於模組權限矩陣，OWNER／FINANCE 編輯既有員工都能調整）
  const casePermSection = document.getElementById('emp-case-perm-section');
  if (casePermSection) {
    const isEdit = !!e;
    const canSeeCasePerm = ['OWNER','FINANCE'].includes(currentUser.roleCode) && isEdit;
    casePermSection.style.display = canSeeCasePerm ? '' : 'none';
    if (canSeeCasePerm) {
      const ccSel = document.getElementById('emp-f-canCreateCase');
      if (ccSel) ccSel.value = canCreateCaseFor(e.id) ? '1' : '0';
    }
  }
  openModal('modal-employee');
}

function submitEmployee() {
  if (!requireManage('employees')) return;
  const name = document.getElementById('emp-f-name').value.trim();
  if (!name) { showToast('姓名為必填', 'error'); return; }
  const fields = ['role','startDate','contact','email','laborInsuranceDate','healthInsuranceDate','idNumber','emergencyContact','address','payrollBank','payrollBranch','payrollAccountName','payrollAccount','status','endDate','endReason','note'];
  const obj = {
    name,
    profitEligible: !!document.getElementById('emp-f-profitEligible')?.checked,
    attendanceRequired: !!document.getElementById('emp-f-attendanceRequired')?.checked
  };
  fields.forEach(f => { obj[f] = document.getElementById('emp-f-'+f).value.trim(); });
  obj.email = String(obj.email || '').trim().toLowerCase();
  if (obj.email && !obj.email.endsWith('@yutesign.com')) {
    showToast('公司 Email 需使用 @yutesign.com', 'error');
    return;
  }
  if (obj.email) {
    const duplicate = EMPLOYEES.find(e => e.id !== empEditId && String(e.email || '').trim().toLowerCase() === obj.email);
    if (duplicate) {
      showToast(`此 Email 已綁定 ${duplicate.name}`, 'error');
      return;
    }
  }
  const accessEl = document.getElementById('emp-f-accessRole');
  if (currentUser.roleCode === 'OWNER') obj.accessRole = accessEl?.value || 'none';
  if (empEffectiveStatus(obj) === '已離職') {
    obj.status = '已離職';
    obj.accessRole = 'none';
    obj.attendanceRequired = false;
    obj.profitEligible = false;
  }
  if (empEditId) {
    const idx = EMPLOYEES.findIndex(x => x.id === empEditId);
    const previousEmployee = idx >= 0 ? auditClone(EMPLOYEES[idx]) : null;
    if (idx >= 0) EMPLOYEES[idx] = { ...EMPLOYEES[idx], ...obj };
    PAYROLL_EMPLOYEE_ACCOUNTS[empEditId] = {
      bank: obj.payrollBank || '',
      account: obj.payrollAccount || ''
    };
    // 儲存細部權限（OWNER 才有權限矩陣）；新增個案權限跟著這個區塊一起存，
    // 避免下面這行整包覆蓋 USER_PERMISSIONS[empEditId] 時，把獨立存的 canCreateCase 洗掉。
    const casePermVisible = document.getElementById('emp-case-perm-section')?.style.display !== 'none';
    const ccSel = document.getElementById('emp-f-canCreateCase');
    if (currentUser.roleCode === 'OWNER' && document.getElementById('emp-perm-section')?.style.display !== 'none') {
      const perms = {};
      EMP_PERM_MODULES.forEach(m => {
        const sel = document.getElementById('ep-'+m.key);
        if (sel) perms[m.key] = sel.value;
      });
      if (casePermVisible && ccSel) perms.canCreateCase = ccSel.value === '1';
      else if (typeof USER_PERMISSIONS[empEditId]?.canCreateCase === 'boolean') perms.canCreateCase = USER_PERMISSIONS[empEditId].canCreateCase;
      USER_PERMISSIONS[empEditId] = perms;
    } else if (['OWNER','FINANCE'].includes(currentUser.roleCode) && casePermVisible && ccSel) {
      // FINANCE 看不到模組權限矩陣，只調整這一個獨立欄位，不動其他既有的模組權限。
      USER_PERMISSIONS[empEditId] = USER_PERMISSIONS[empEditId] || {};
      USER_PERMISSIONS[empEditId].canCreateCase = ccSel.value === '1';
    }
    const accountChanged = previousEmployee && (
      String(previousEmployee.payrollBank || '') !== String(obj.payrollBank || '') ||
      String(previousEmployee.payrollBranch || '') !== String(obj.payrollBranch || '') ||
      String(previousEmployee.payrollAccountName || '') !== String(obj.payrollAccountName || '') ||
      String(previousEmployee.payrollAccount || '') !== String(obj.payrollAccount || '')
    );
    if (accountChanged) {
      const masked = employee => ({
        bank: employee?.payrollBank || '',
        branch: employee?.payrollBranch || '',
        accountName: employee?.payrollAccountName || '',
        accountLast4: employee?.payrollAccount ? String(employee.payrollAccount).slice(-4) : '',
        hasAccount: !!employee?.payrollAccount
      });
      recordAuditLog('update', 'employeePayrollAccount', empEditId, masked(previousEmployee), masked(obj), {
        targetLabel: obj.name,
        reason: '員工主檔更新薪資匯款帳戶',
        riskLevel: 'high'
      });
    }
    showToast('員工資料已更新', 'success');
  } else {
    const newId = 'emp'+(empNextId++);
    EMPLOYEES.push({ id:newId, accessRole:'none', ...obj });
    PAYROLL_EMPLOYEE_ACCOUNTS[newId] = { bank:obj.payrollBank || '', account:obj.payrollAccount || '' };
    showToast('員工已新增', 'success');
  }
  closeModal('modal-employee');
  renderEmployees();
  renderProfitShare();
  saveData();
}
