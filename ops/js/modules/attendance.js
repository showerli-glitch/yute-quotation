// ATTENDANCE MODULE. Extracted verbatim from ops/index.html at main@c9c78dd.

function attPeople() {
  return EMPLOYEES
    .filter(e => empEffectiveStatus(e) !== '已離職' && e.attendanceRequired !== false)
    .map(e => ({ id:e.id, name:e.name }));
}

function attCanManage() { return canManage('attendance'); }

function attVisiblePerson() {
  const sel = document.getElementById('att-filter-person');
  return attCanManage() ? (sel?.value || currentUser.id) : currentUser.id;
}

function attMonthValue() {
  return document.getElementById('att-filter-month')?.value || currentMonthKey();
}

function attToday() {
  return localDateKey();
}

function attMinutes(time) {
  const m = String(time || '').match(/^(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function attTimeFromMinutes(minutes) {
  if (!Number.isFinite(minutes)) return '';
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
}

function attMoney(v) {
  return '$' + Math.round(v || 0).toLocaleString('zh-TW');
}

function attExpectedWorkdays(month, person = '') {
  const match = String(month || '').match(/^(\d{4})-(\d{2})$/);
  if (!match) return 0;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const todayParts = attToday().split('-').map(Number);
  const today = new Date(todayParts[0], todayParts[1] - 1, todayParts[2]);
  const start = new Date(year, monthIndex, 1);
  const employeeStart = EMPLOYEES.find(e => e.id === person)?.startDate || '';
  if (employeeStart && employeeStart.startsWith(`${match[1]}-${match[2]}`)) {
    const startParts = employeeStart.split('-').map(Number);
    start.setDate(Math.max(1, startParts[2] || 1));
  }
  const endOfMonth = new Date(year, monthIndex + 1, 0);
  if (start > today) return 0;
  const end = endOfMonth < today ? endOfMonth : today;
  let count = 0;
  for (const date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    if (pyIsGovernmentWorkday(date)) count += 1;
  }
  return count;
}

function attMissingPastWorkDates(person, month, records, leaves) {
  const match = String(month || '').match(/^(\d{4})-(\d{2})$/);
  if (!match) return [];
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const todayKey = attToday();
  const start = new Date(year, monthIndex, 1);
  const employeeStart = EMPLOYEES.find(e => e.id === person)?.startDate || '';
  if (employeeStart && employeeStart.startsWith(`${match[1]}-${match[2]}`)) {
    start.setDate(Math.max(1, Number(employeeStart.slice(-2)) || 1));
  }
  const end = new Date(year, monthIndex + 1, 0);
  const recordedDates = new Set((records || []).map(r => r.date).filter(Boolean));
  const leaveDates = new Set((leaves || []).map(r => r.date).filter(Boolean));
  const missing = [];
  for (const date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    const key = localDateKey(date);
    if (key >= todayKey) break;
    if (!pyIsGovernmentWorkday(date) || recordedDates.has(key) || leaveDates.has(key)) continue;
    missing.push(key);
  }
  return missing;
}

function attFillPersonOptions() {
  const people = attPeople();
  const opts = people.length
    ? people.map(p => `<option value="${p.id}">${p.name}</option>`).join('')
    : '<option value="">目前無需打卡人員</option>';
  ['att-filter-person','att-rec-person','att-leave-person','att-gps-person'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const cur = el.value || currentUser.id;
    el.innerHTML = opts;
    el.value = attCanManage() ? (people.some(p => p.id === cur) ? cur : people[0]?.id || '') : currentUser.id;
    el.disabled = !attCanManage() || !people.length;
  });
}

function attFillMonthOptions() {
  const sel = document.getElementById('att-filter-month');
  if (!sel) return;
  const cur = sel.value || currentMonthKey();
  const monthSet = new Set([
    cur,
    ...PAYROLL_MONTHS,
    ...ATTENDANCE_RECORDS.map(r => String(r.date || '').slice(0,7)).filter(prIsValidMonth),
    ...ATTENDANCE_LEAVES.map(r => String(r.date || '').slice(0,7)).filter(prIsValidMonth),
  ]);
  ohAddFutureMonths(monthSet, currentMonthKey(), 3);
  ohAddFutureMonths(monthSet, cur, 1);
  const months = [...monthSet].filter(prIsValidMonth).sort((a,b)=>b.localeCompare(a));
  sel.innerHTML = months.map(month => {
    const [year, num] = month.split('-');
    return `<option value="${month}">${year}年${Number(num)}月</option>`;
  }).join('');
  sel.value = months.includes(cur) ? cur : months[0] || cur;
  attFillPersonOptions();
  attFillCaseOptions();
  renderAttendance();
}

function attFillCaseOptions() {
  ['att-rec-case','att-gps-case'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const cur = el.value;
    el.innerHTML = '<option value="">公司／無指定案場</option>' + dashboardSortCasesLikeOverview(CASES.filter(c => userCanViewCaseFinancials(c.code, 'attendance'))).map(c => `<option value="${c.code}">${c.name}</option>`).join('');
    el.value = cur || '';
  });
}

function attDefaultFormValues() {
  const today = attToday();
  ['att-rec-date','att-leave-date'].forEach(id => {
    const el = document.getElementById(id);
    if (el && !el.value) el.value = today;
  });
  const inEl = document.getElementById('att-rec-in');
  const outEl = document.getElementById('att-rec-out');
  if (inEl && !inEl.value) inEl.value = '08:00';
  // 下班時間不可預填；只有實際下班打卡或管理者明確輸入才可寫入。
  if (outEl && !attEditRecordId) outEl.value = '';
}

function attIsFutureTodayTime(date, time) {
  if (!date || !time || date !== attToday()) return false;
  const now = new Date().toLocaleTimeString('zh-TW', { hour12:false }).slice(0,5);
  return time > now;
}

function attEffectiveOutTime(row) {
  return attIsFutureTodayTime(row?.date || '', row?.outTime || '') ? '' : (row?.outTime || '');
}

function attRecordStatus(row) {
  if (!row.inTime || !attEffectiveOutTime(row)) {
    if (row.date === attToday()) return row.inTime ? '上班中' : '今日待補';
    return '缺卡';
  }
  if (row.approvedBy) return '已核准';
  return row.source === 'manual' ? '補登待核' : '正常';
}

function attGpsSetStatus(state, text) {
  const pill = document.getElementById('att-gps-pill');
  const txt = document.getElementById('att-gps-text');
  if (pill) pill.className = 'att-gps-pill ' + (state || '');
  if (txt) txt.textContent = text || '';
}

function attGpsDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function attGpsNowTime() {
  return new Date().toLocaleTimeString('zh-TW', { hour12:false });
}

function attGpsTarget() {
  const type = document.getElementById('att-gps-location-type')?.value || 'office';
  if (type === 'office') {
    const radius = Number(document.getElementById('att-gps-radius')?.value || ATTENDANCE_SETTINGS.officeRadiusMeters) || 200;
    ATTENDANCE_SETTINGS.officeRadiusMeters = radius;
    return { type, label:'公司', lat:ATTENDANCE_SETTINGS.officeLat, lng:ATTENDANCE_SETTINGS.officeLng, radius, caseCode:'', caseName:'' };
  }
  const caseCode = document.getElementById('att-gps-case')?.value || '';
  const c = CASES.find(x => x.code === caseCode);
  return {
    type,
    label:c?.name || '工地',
    lat:caseHasSiteLocation(c) ? Number(c.siteLat) : NaN,
    lng:caseHasSiteLocation(c) ? Number(c.siteLng) : NaN,
    radius:Number(c?.siteRadiusMeters) || 200,
    caseCode,
    caseName:c?.name || ''
  };
}

function attGpsRefresh() {
  const nowEl = document.getElementById('att-gps-now');
  if (nowEl) nowEl.textContent = attGpsNowTime();
  const adminActions = document.getElementById('att-gps-admin-actions');
  if (adminActions) adminActions.style.display = attCanManage() ? 'flex' : 'none';
  const caseEl = document.getElementById('att-gps-case');
  const type = document.getElementById('att-gps-location-type')?.value || 'office';
  if (caseEl) caseEl.disabled = type !== 'site';
  const radiusEl = document.getElementById('att-gps-radius');
  if (radiusEl) radiusEl.disabled = type !== 'office';
  const coordEl = document.getElementById('att-gps-coords');
  if (coordEl) coordEl.textContent = attGpsPosition ? `${attGpsPosition.lat.toFixed(6)}, ${attGpsPosition.lng.toFixed(6)}` : '--';
  const accuracyEl = document.getElementById('att-gps-accuracy');
  if (accuracyEl) accuracyEl.textContent = attGpsPosition?.accuracy ? `±${Math.round(attGpsPosition.accuracy)} m` : '--';
  const distEl = document.getElementById('att-gps-distance');
  const targetEl = document.getElementById('att-gps-target');
  const debugEl = document.getElementById('att-gps-debug');
  const inBtn = document.getElementById('att-gps-in-btn');
  const outBtn = document.getElementById('att-gps-out-btn');
  const person = attCanManage() ? document.getElementById('att-gps-person')?.value : currentUser.id;
  const target = attGpsTarget();
  if (targetEl) targetEl.textContent = Number.isFinite(target.lat) && Number.isFinite(target.lng)
    ? `${target.lat.toFixed(6)}, ${target.lng.toFixed(6)}`
    : '--';
  const hasPerson = !!person && attPeople().some(p => p.id === person);

  if (!attGpsPosition) {
    attGpsResult = { ok:false, reason:'尚未取得定位' };
    attGpsSetStatus('', '尚未取得定位');
    if (distEl) distEl.textContent = '--';
    if (debugEl) debugEl.textContent = '等待瀏覽器回報定位';
  } else if (target.type === 'site' && (!target.caseCode || !Number.isFinite(target.lat) || !Number.isFinite(target.lng))) {
    attGpsResult = { ok:false, reason:'工地尚未設定座標' };
    attGpsSetStatus('fail', '請選擇已設定座標的工地');
    if (distEl) distEl.textContent = '--';
    if (debugEl) debugEl.textContent = '案場缺少座標，請到個案總覽設定';
  } else {
    const dist = attGpsDistance(attGpsPosition.lat, attGpsPosition.lng, target.lat, target.lng);
    const rounded = Math.round(dist);
    const ok = dist <= target.radius;
    const accuracy = Math.round(attGpsPosition.accuracy || 0);
    const likelyDrift = accuracy >= 100 || (target.type === 'office' && rounded > target.radius && accuracy >= Math.min(rounded, 300));
    attGpsResult = { ok, reason: ok ? `已在${target.label}範圍內` : `距${target.label} ${rounded} 公尺`, target, distance:rounded, accuracy, likelyDrift };
    attGpsSetStatus(ok ? 'ok' : 'fail', ok ? `已在${target.label}範圍內（${rounded} 公尺）` : `距${target.label} ${rounded} 公尺，超出範圍`);
    if (distEl) distEl.textContent = `${rounded} m / ${target.radius} m`;
    if (debugEl) {
      debugEl.textContent = ok
        ? `通過，定位精度 ${accuracy || '--'} m`
        : likelyDrift
          ? `可能是手機定位精度不足，精度 ${accuracy} m`
          : `若地圖藍點正確，請校正${target.label}座標或調整半徑`;
    }
  }
  const canPunch = hasPerson && attGpsResult.ok && !attGpsPunching;
  if (inBtn) inBtn.disabled = !canPunch;
  if (outBtn) outBtn.disabled = !canPunch;
}

function attGpsUseCurrentAsOffice() {
  if (!attCanManage()) { showToast('只有出勤管理者可校正公司座標', 'error'); return; }
  if (!attGpsPosition) { showToast('尚未取得目前定位，請稍後再試', 'error'); return; }
  const before = auditClone(ATTENDANCE_SETTINGS);
  ATTENDANCE_SETTINGS.officeLat = Number(attGpsPosition.lat.toFixed(6));
  ATTENDANCE_SETTINGS.officeLng = Number(attGpsPosition.lng.toFixed(6));
  const radiusEl = document.getElementById('att-gps-radius');
  const radius = Number(radiusEl?.value || ATTENDANCE_SETTINGS.officeRadiusMeters) || 200;
  ATTENDANCE_SETTINGS.officeRadiusMeters = Math.max(50, radius);
  recordAuditLog('update', 'companySettings', 'attendanceOfficeLocation', before, auditClone(ATTENDANCE_SETTINGS), {
    riskLevel:'medium',
    reason:'校正公司 GPS 打卡座標',
    fields:['officeLat','officeLng','officeRadiusMeters']
  });
  saveData();
  attGpsRefresh();
  showToast('已用目前定位更新公司打卡座標 ✓', 'success');
}

function attGpsResetOfficeLocation() {
  if (!attCanManage()) { showToast('只有出勤管理者可還原公司座標', 'error'); return; }
  const before = auditClone(ATTENDANCE_SETTINGS);
  ATTENDANCE_SETTINGS.officeLat = ATTENDANCE_SETTINGS.defaultOfficeLat || OFFICE_LOCATION_DEFAULT.lat;
  ATTENDANCE_SETTINGS.officeLng = ATTENDANCE_SETTINGS.defaultOfficeLng || OFFICE_LOCATION_DEFAULT.lng;
  recordAuditLog('update', 'companySettings', 'attendanceOfficeLocation', before, auditClone(ATTENDANCE_SETTINGS), {
    riskLevel:'medium',
    reason:'還原預設公司 GPS 打卡座標',
    fields:['officeLat','officeLng']
  });
  saveData();
  attGpsRefresh();
  showToast('已還原預設公司打卡座標', 'success');
}

function attGpsErrorText(error) {
  if (error?.code === 1) return '定位權限未開啟，請到手機瀏覽器設定允許位置存取';
  if (error?.code === 2) return '手機目前無法取得位置，請確認系統定位服務已開啟';
  if (error?.code === 3) return '取得定位逾時，請移到窗邊或戶外後按「重新取得定位」';
  return '無法取得位置，請確認手機定位與瀏覽器權限';
}

function attGpsAcceptPosition(pos) {
  attGpsPosition = {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuracy: pos.coords.accuracy,
    capturedAt: new Date().toISOString()
  };
  attGpsRefresh();
}

function attGpsHandleError(error) {
  attGpsPosition = null;
  const reason = attGpsErrorText(error);
  if (attGpsWatchId !== null && navigator.geolocation) navigator.geolocation.clearWatch(attGpsWatchId);
  attGpsWatchId = null;
  attGpsRefresh();
  attGpsResult = { ok:false, reason };
  attGpsSetStatus('fail', reason);
  const debugEl = document.getElementById('att-gps-debug');
  if (debugEl) debugEl.textContent = `定位錯誤 ${error?.code || '—'}：${reason}`;
}

function attGpsStart(force = false) {
  if (!document.getElementById('page-attendance')) return;
  if (force && attGpsWatchId !== null && navigator.geolocation) {
    navigator.geolocation.clearWatch(attGpsWatchId);
    attGpsWatchId = null;
  }
  if (attGpsWatchId !== null) return;
  const radiusEl = document.getElementById('att-gps-radius');
  if (radiusEl) radiusEl.value = ATTENDANCE_SETTINGS.officeRadiusMeters || 200;
  if (!navigator.geolocation) {
    attGpsSetStatus('fail', '瀏覽器不支援定位');
    return;
  }
  attGpsSetStatus('checking', '定位取得中...');
  attGpsWatchId = navigator.geolocation.watchPosition(
    attGpsAcceptPosition,
    attGpsHandleError,
    { enableHighAccuracy:true, timeout:20000, maximumAge:10000 }
  );
}

function attGpsRetry() {
  attGpsPosition = null;
  attGpsResult = { ok:false, reason:'重新取得定位中' };
  attGpsSetStatus('checking', '重新取得定位中...');
  attGpsStart(true);
}

function attDailyEffectiveRecords(person = '', month = '') {
  const rows = ATTENDANCE_RECORDS.filter(r =>
    (!person || r.person === person) &&
    (!month || String(r.date || '').startsWith(month))
  );
  const grouped = new Map();
  rows.forEach(row => {
    if (row.source !== 'gps' || !row.person || !row.date) {
      grouped.set(`id:${row.id}`, { ...row });
      return;
    }
    const key = `gps:${row.person}:${row.date}`;
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, { ...row, gpsPunches:[...(row.gpsPunches || [])] });
      return;
    }
    const inTimes = [existing.inTime, row.inTime].filter(Boolean).sort();
    const outTimes = [existing.outTime, row.outTime].filter(Boolean).sort();
    existing.inTime = inTimes[0] || '';
    existing.outTime = outTimes[outTimes.length - 1] || '';
    existing.gpsPunches = [...(existing.gpsPunches || []), ...(row.gpsPunches || [])]
      .sort((a,b) => String(a.timestamp || '').localeCompare(String(b.timestamp || '')));
    if (String(row.updatedAt || '') > String(existing.updatedAt || '')) {
      ['locationType','caseCode','caseName','note','overtimeHoursOverride','updatedAt','updatedBy'].forEach(field => {
        if (row[field] !== undefined) existing[field] = row[field];
      });
    }
  });
  return [...grouped.values()];
}

function attMergeDuplicateGpsRows(person, date) {
  const duplicates = ATTENDANCE_RECORDS.filter(r => r.source === 'gps' && r.person === person && r.date === date);
  if (duplicates.length <= 1) return duplicates[0] || null;
  const merged = attDailyEffectiveRecords(person).find(r => r.source === 'gps' && r.date === date);
  const keep = duplicates.slice().sort((a,b) => Number(a.id || 0) - Number(b.id || 0))[0];
  const duplicateIds = new Set(duplicates.slice(1).map(r => String(r.id)));
  Object.assign(keep, merged, { id:keep.id, updatedAt:new Date().toISOString(), updatedBy:currentUser.name });
  ATTENDANCE_RECORDS = ATTENDANCE_RECORDS.filter(r => !duplicateIds.has(String(r.id)));
  recordAuditLog('update', 'attendanceRecord', keep.id, duplicates, keep, {
    riskLevel:'medium',
    targetLabel:`${date} ${person}`,
    reason:'合併同日重複 GPS 打卡紀錄'
  });
  return keep;
}

function attWaitForCloudSync(timeoutMs = 12000) {
  if (!OPS_AUTH_ENFORCED || !opsAuthenticatedEmail) return Promise.resolve(true);
  return new Promise(resolve => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (!opsCloudPendingSync) { clearInterval(timer); resolve(true); }
      else if (Date.now() - started >= timeoutMs) { clearInterval(timer); resolve(false); }
    }, 200);
  });
}

async function attGpsPunch(type) {
  if (!canAccess('attendance')) { showToast('您沒有出勤功能權限', 'error'); return; }
  if (attGpsPunching) { showToast('打卡正在寫入，請勿重複點選', 'warning'); return; }
  attGpsRefresh();
  const person = attCanManage() ? document.getElementById('att-gps-person')?.value : currentUser.id;
  if (!person) { showToast('請先選擇打卡人員', 'error'); return; }
  if (!attGpsResult.ok || !attGpsPosition) { showToast(attGpsResult.reason || '定位未通過，無法打卡', 'error'); return; }
  const now = new Date();
  const date = localDateKey(now);
  const time = now.toLocaleTimeString('zh-TW', { hour12:false }).slice(0,5);
  const target = attGpsResult.target || attGpsTarget();
  attGpsPunching = true;
  attGpsRefresh();
  let row = attMergeDuplicateGpsRows(person, date) || ATTENDANCE_RECORDS.find(r => r.person === person && r.date === date && r.source === 'gps');
  if (!row) {
    row = {
      id: attNextId++,
      person, date, inTime:'', outTime:'',
      locationType: target.type === 'site' ? 'site' : 'office',
      caseCode: target.caseCode || '',
      caseName: target.caseName || '',
      source:'gps',
      approvedBy:'',
      approvedAt:'',
      note:'',
      gpsPunches:[],
      createdAt:now.toISOString(),
      createdBy:currentUser.name,
      companyId:COMPANY_ID
    };
    ATTENDANCE_RECORDS.unshift(row);
  }
  if (type === 'in') row.inTime = time;
  else row.outTime = time;
  row.locationType = target.type === 'site' ? 'site' : row.locationType || 'office';
  row.caseCode = target.caseCode || row.caseCode || '';
  row.caseName = target.caseName || row.caseName || '';
  row.updatedAt = now.toISOString();
  row.updatedBy = currentUser.name;
  if (!Array.isArray(row.gpsPunches)) row.gpsPunches = [];
  row.gpsPunches.push({
    type,
    time,
    timestamp: now.toISOString(),
    lat: attGpsPosition.lat,
    lng: attGpsPosition.lng,
    accuracy: attGpsPosition.accuracy,
    targetLabel: target.label,
    distanceMeters: attGpsResult.distance,
    radiusMeters: target.radius
  });
  row.note = `${target.label} GPS ${type === 'in' ? '上班' : '下班'}打卡；距離 ${attGpsResult.distance}m`;
  saveData();
  if (opsCloudReady) opsCloudFlushPendingSave();
  renderAttendance();
  showToast(`${type === 'in' ? '上班' : '下班'}打卡已寫入，正在同步雲端…`, 'success');
  const synced = await attWaitForCloudSync();
  attGpsPunching = false;
  attGpsRefresh();
  showToast(synced ? `${type === 'in' ? '上班' : '下班'}打卡已同步雲端 ✓` : '打卡已存在手機，雲端尚未確認，請保留畫面並按「重試同步」', synced ? 'success' : 'error');
}

function attSetRecordEditMode(row) {
  attEditRecordId = row?.id || null;
  const saveBtn = document.getElementById('att-rec-save-btn');
  const cancelBtn = document.getElementById('att-rec-cancel-btn');
  if (saveBtn) saveBtn.textContent = attEditRecordId ? '更新打卡紀錄' : '儲存打卡紀錄';
  if (cancelBtn) cancelBtn.style.display = attEditRecordId ? '' : 'none';
}

function attCancelEditRecord() {
  attEditRecordId = null;
  attSetRecordEditMode(null);
  const inEl = document.getElementById('att-rec-in'); if (inEl) inEl.value = '';
  const outEl = document.getElementById('att-rec-out'); if (outEl) outEl.value = '';
  attDefaultFormValues();
  const noteEl = document.getElementById('att-rec-note');
  if (noteEl) noteEl.value = '';
  const overtimeEl = document.getElementById('att-rec-overtime');
  if (overtimeEl) overtimeEl.value = '';
  showToast('已取消編輯', 'success');
}

function attEditRecord(id) {
  if (!attCanManage()) { showToast('只有出勤管理者可編輯', 'error'); return; }
  const row = ATTENDANCE_RECORDS.find(r => Number(r.id) === Number(id));
  if (!row) { showToast('找不到這筆出勤紀錄', 'error'); return; }
  const set = (id, value) => { const el = document.getElementById(id); if (el) el.value = value ?? ''; };
  set('att-rec-person', row.person);
  set('att-rec-date', row.date);
  set('att-rec-in', row.inTime);
  set('att-rec-out', attEffectiveOutTime(row));
  set('att-rec-location-type', row.locationType || 'office');
  set('att-rec-case', row.caseCode);
  set('att-rec-overtime', row.overtimeHoursOverride ?? '');
  set('att-rec-note', row.note);
  attSetRecordEditMode(row);
  document.getElementById('att-rec-person')?.scrollIntoView({ behavior:'smooth', block:'center' });
  showToast('已載入紀錄，可修改後更新', 'success');
}

function attAddRecord() {
  if (!canAccess('attendance')) { showToast('您沒有出勤功能權限', 'error'); return; }
  const person = attCanManage() ? document.getElementById('att-rec-person')?.value : currentUser.id;
  const date = document.getElementById('att-rec-date')?.value || '';
  const inTime = document.getElementById('att-rec-in')?.value || '';
  const outTime = document.getElementById('att-rec-out')?.value || '';
  const locationType = document.getElementById('att-rec-location-type')?.value || 'office';
  const caseCode = document.getElementById('att-rec-case')?.value || '';
  const note = document.getElementById('att-rec-note')?.value || '';
  const overtimeRaw = document.getElementById('att-rec-overtime')?.value ?? '';
  const overtimeHoursOverride = attCanManage() && overtimeRaw !== '' ? Math.max(0, Number(overtimeRaw) || 0) : null;
  if (!person || !date) { showToast('請選擇人員與日期', 'error'); return; }
  if (!inTime && !outTime) { showToast('請至少填寫上班或下班時間', 'error'); return; }
  if (attIsFutureTodayTime(date, outTime)) { showToast('下班時間不可晚於目前時間；尚未下班請保持空白', 'error'); return; }
  const c = CASES.find(x => x.code === caseCode);
  if (attEditRecordId) {
    const idx = ATTENDANCE_RECORDS.findIndex(r => Number(r.id) === Number(attEditRecordId));
    if (idx < 0) { attSetRecordEditMode(null); showToast('找不到要更新的紀錄', 'error'); return; }
    const before = auditClone(ATTENDANCE_RECORDS[idx]);
    Object.assign(ATTENDANCE_RECORDS[idx], {
      person, date, inTime, outTime, locationType, caseCode, caseName: c?.name || '',
      note, overtimeHoursOverride,
      approvedBy: attCanManage() ? currentUser.name : ATTENDANCE_RECORDS[idx].approvedBy || '',
      approvedAt: attCanManage() ? new Date().toISOString() : ATTENDANCE_RECORDS[idx].approvedAt || '',
      updatedAt:new Date().toISOString(),
      updatedBy:currentUser.name,
      companyId:COMPANY_ID
    });
    recordAuditLog('update', 'attendanceRecord', attEditRecordId, before, ATTENDANCE_RECORDS[idx], {
      targetLabel:`${date} ${person}`,
      reason:'出勤紀錄人工修正'
    });
    attSetRecordEditMode(null);
    showToast('出勤紀錄已更新 ✓', 'success');
  } else {
    ATTENDANCE_RECORDS.unshift({
      id: attNextId++,
      person, date, inTime, outTime, locationType, caseCode, caseName: c?.name || '',
      source:'manual',
      overtimeHoursOverride,
      approvedBy: attCanManage() ? currentUser.name : '',
      approvedAt: attCanManage() ? new Date().toISOString() : '',
      note,
      createdAt:new Date().toISOString(),
      createdBy:currentUser.name,
      companyId:COMPANY_ID
    });
    showToast('出勤紀錄已儲存 ✓', 'success');
  }
  const noteEl = document.getElementById('att-rec-note'); if (noteEl) noteEl.value = '';
  const overtimeEl = document.getElementById('att-rec-overtime'); if (overtimeEl) overtimeEl.value = '';
  const inEl = document.getElementById('att-rec-in'); if (inEl) inEl.value = '';
  const outEl = document.getElementById('att-rec-out'); if (outEl) outEl.value = '';
  attDefaultFormValues();
  saveData();
  renderAttendance();
}

function attSetLeaveEditMode(row) {
  attLeaveEditId = row?.id || null;
  const saveBtn = document.getElementById('att-leave-save-btn');
  const cancelBtn = document.getElementById('att-leave-cancel-btn');
  if (saveBtn) saveBtn.textContent = attLeaveEditId ? '更新請假紀錄' : '儲存請假';
  if (cancelBtn) cancelBtn.style.display = attLeaveEditId ? '' : 'none';
}

function attCancelEditLeave() {
  attSetLeaveEditMode(null);
  ['att-leave-date','att-leave-note'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const hoursEl = document.getElementById('att-leave-hours'); if (hoursEl) hoursEl.value = '8';
  const typeEl = document.getElementById('att-leave-type'); if (typeEl) typeEl.value = 'personal';
  showToast('已取消編輯', 'success');
}

function attEditLeave(id) {
  if (!attCanManage()) { showToast('只有出勤管理者可編輯', 'error'); return; }
  const row = ATTENDANCE_LEAVES.find(r => Number(r.id) === Number(id));
  if (!row) { showToast('找不到這筆請假紀錄', 'error'); return; }
  const set = (elId, value) => { const el = document.getElementById(elId); if (el) el.value = value ?? ''; };
  set('att-leave-person', row.person);
  set('att-leave-date', row.date);
  set('att-leave-type', row.type);
  set('att-leave-hours', row.hours);
  set('att-leave-note', row.note);
  attSetLeaveEditMode(row);
  document.getElementById('att-leave-person')?.scrollIntoView({ behavior:'smooth', block:'center' });
  showToast('已載入請假紀錄，可修改假別後更新', 'success');
}

function attAddLeave() {
  if (!canAccess('attendance')) { showToast('您沒有出勤功能權限', 'error'); return; }
  const person = attCanManage() ? document.getElementById('att-leave-person')?.value : currentUser.id;
  const date = document.getElementById('att-leave-date')?.value || '';
  const type = document.getElementById('att-leave-type')?.value || 'personal';
  const hours = parseFloat(document.getElementById('att-leave-hours')?.value || '0') || 0;
  const note = document.getElementById('att-leave-note')?.value || '';
  if (!person || !date || hours <= 0) { showToast('請填寫請假人員、日期與時數', 'error'); return; }
  if (attLeaveEditId) {
    const row = ATTENDANCE_LEAVES.find(r => Number(r.id) === Number(attLeaveEditId));
    if (!row) { showToast('找不到這筆請假紀錄', 'error'); attSetLeaveEditMode(null); return; }
    const before = { ...row };
    Object.assign(row, { person, date, type, hours, note });
    recordAuditLog('update', 'attendanceLeave', row.id, before, row, {
      targetLabel: `${date} ${person} 請假`,
      reason:'修改請假假別／時數／備註'
    });
    attSetLeaveEditMode(null);
  } else {
    ATTENDANCE_LEAVES.unshift({
      id: attLeaveNextId++,
      person, date, type, hours, note,
      approvedBy: attCanManage() ? currentUser.name : '',
      approvedAt: attCanManage() ? new Date().toISOString() : '',
      createdAt:new Date().toISOString(),
      createdBy:currentUser.name,
      companyId:COMPANY_ID
    });
  }
  const noteEl = document.getElementById('att-leave-note'); if (noteEl) noteEl.value = '';
  saveData();
  renderAttendance();
  showToast('請假紀錄已儲存 ✓', 'success');
}

function attDeleteRecord(id) {
  if (!attCanManage()) { showToast('只有出勤管理者可刪除', 'error'); return; }
  if (!confirm('確定刪除此出勤紀錄？')) return;
  const before = ATTENDANCE_RECORDS.find(r => Number(r.id) === Number(id));
  ATTENDANCE_RECORDS = ATTENDANCE_RECORDS.filter(r => r.id !== id);
  if (Number(attEditRecordId) === Number(id)) attSetRecordEditMode(null);
  recordAuditLog('delete', 'attendanceRecord', id, before, null, {
    targetLabel: before ? `${before.date || ''} ${before.person || ''}` : '',
    reason:'刪除測試或錯誤出勤紀錄'
  });
  saveData();
  renderAttendance();
  showToast('出勤紀錄已刪除', 'success');
}

function attDeleteLeave(id) {
  if (!attCanManage()) { showToast('只有出勤管理者可刪除', 'error'); return; }
  if (!confirm('確定刪除此請假紀錄？')) return;
  ATTENDANCE_LEAVES = ATTENDANCE_LEAVES.filter(r => r.id !== id);
  if (Number(attLeaveEditId) === Number(id)) attSetLeaveEditMode(null);
  saveData();
  renderAttendance();
}

function attApproveRecord(id) {
  if (!attCanManage()) { showToast('只有出勤管理者可核准補登', 'error'); return; }
  const row = ATTENDANCE_RECORDS.find(r => Number(r.id) === Number(id));
  if (!row) { showToast('找不到這筆補登紀錄', 'error'); return; }
  if (row.source !== 'manual' || row.approvedBy) { showToast('這筆紀錄不需要核准', 'warning'); return; }
  if (!confirm(`確定核准 ${row.date || ''} 的補登打卡？\n同一天因手機打卡失敗留下的缺卡紀錄會一併合併。`)) return;
  const before = auditClone(ATTENDANCE_RECORDS.filter(r => r.person === row.person && r.date === row.date));
  const sameDay = ATTENDANCE_RECORDS.filter(r => r.person === row.person && r.date === row.date);
  const inTimes = sameDay.map(r => r.inTime).filter(Boolean).sort();
  const outTimes = sameDay.map(r => attEffectiveOutTime(r)).filter(Boolean).sort();
  row.inTime = inTimes[0] || row.inTime || '';
  row.outTime = outTimes[outTimes.length - 1] || row.outTime || '';
  row.approvedBy = currentUser.name;
  row.approvedAt = new Date().toISOString();
  row.updatedAt = row.approvedAt;
  row.updatedBy = currentUser.name;
  row.note = [row.note, '補登已核准；同日手機缺卡紀錄已合併'].filter(Boolean).join('；');
  const keepId = Number(row.id);
  ATTENDANCE_RECORDS = ATTENDANCE_RECORDS.filter(r =>
    Number(r.id) === keepId || r.person !== row.person || r.date !== row.date
  );
  recordAuditLog('update', 'attendanceRecord', row.id, before, auditClone(row), {
    riskLevel:'medium',
    targetLabel:`${row.date || ''} ${row.person || ''}`,
    reason:'核准補登並合併同日手機缺卡紀錄'
  });
  saveData();
  renderAttendance();
  showToast('補登已核准，同日缺卡紀錄已合併 ✓', 'success');
}

// ── 特休（勞基法第38條）：週年制年資試算＋當期已用天數 ──
function attServiceYearsAt(startDate, atDate) {
  const start = new Date(startDate + 'T00:00:00');
  const at = new Date(atDate + 'T00:00:00');
  let years = at.getFullYear() - start.getFullYear();
  const annivThisYear = new Date(at.getFullYear(), start.getMonth(), start.getDate());
  if (at < annivThisYear) years -= 1;
  return years;
}
function attAnnualLeaveDaysForYears(years) {
  if (years < 1) return 3;   // 滿6個月未滿1年
  if (years < 2) return 7;   // 滿1年未滿2年
  if (years < 3) return 10;  // 滿2年未滿3年
  if (years < 5) return 14;  // 滿3年未滿5年
  if (years < 10) return 15; // 滿5年未滿10年
  return Math.min(30, 15 + (years - 9)); // 滿10年起每滿1年加1天，上限30天
}
function attDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function attAnnualLeaveWindow(startDate, asOfDate) {
  if (!startDate) return null;
  const start = new Date(startDate + 'T00:00:00');
  const now = new Date(asOfDate + 'T00:00:00');
  if (now < start) return null;
  const sixMonthMark = new Date(start); sixMonthMark.setMonth(sixMonthMark.getMonth() + 6);
  if (now < sixMonthMark) return { eligible: false, windowStart: null, windowEnd: null, days: 0 };
  const oneYearMark = new Date(start); oneYearMark.setFullYear(oneYearMark.getFullYear() + 1);
  if (now < oneYearMark) {
    return { eligible: true, windowStart: attDateKey(sixMonthMark), windowEnd: attDateKey(oneYearMark), days: 3 };
  }
  const years = attServiceYearsAt(startDate, asOfDate);
  const windowStart = new Date(start.getFullYear() + years, start.getMonth(), start.getDate());
  const windowEnd = new Date(start.getFullYear() + years + 1, start.getMonth(), start.getDate());
  return { eligible: true, windowStart: attDateKey(windowStart), windowEnd: attDateKey(windowEnd), days: attAnnualLeaveDaysForYears(years) };
}
function attAnnualLeaveStatus(person, asOfDate) {
  const startDate = EMPLOYEES.find(e => e.id === person)?.startDate || '';
  const win = attAnnualLeaveWindow(startDate, asOfDate || attToday());
  if (!win) return null;
  if (!win.eligible) return { eligible: false, entitlementDays: 0, usedHours: 0, remainingDays: 0 };
  const usedHours = ATTENDANCE_LEAVES.filter(r => r.person === person && r.type === 'annual' && r.date >= win.windowStart && r.date < win.windowEnd)
    .reduce((s, r) => s + (Number(r.hours) || 0), 0);
  const entitlementHours = win.days * 8;
  const remainingHours = Math.max(0, entitlementHours - usedHours);
  return {
    eligible: true, entitlementDays: win.days, usedHours,
    remainingDays: Math.round(remainingHours / 8 * 10) / 10,
    windowStart: win.windowStart, windowEnd: win.windowEnd
  };
}

// 單筆出勤紀錄的加班分鐘數：有手動覆寫用手動值，否則從上下班時間自動試算（08:00 前打卡以 08:00 起算；每日滿 9 小時後，每滿 30 分鐘計）。
function attRecordOvertimeMinutes(r) {
  const inM = attMinutes(r.inTime);
  const outM = attMinutes(attEffectiveOutTime(r));
  if (!Number.isFinite(inM) || !Number.isFinite(outM)) return 0;
  const hasOvertimeOverride = r.overtimeHoursOverride !== undefined && r.overtimeHoursOverride !== null && r.overtimeHoursOverride !== '';
  if (hasOvertimeOverride) return Math.max(0, Math.round(Number(r.overtimeHoursOverride) * 60));
  const scheduledIn = Math.max(inM, attMinutes('08:00'));
  const expectedOut = scheduledIn + ATTENDANCE_SETTINGS.workdayMinutes;
  const overtimeUnit = Math.max(1, Number(ATTENDANCE_SETTINGS.overtimeUnitMinutes) || 30);
  const rawOvertime = Math.max(0, outM - expectedOut);
  return Math.floor(rawOvertime / overtimeUnit) * overtimeUnit;
}

function attComputeDraft(person, month) {
  const cfg = PR_CONFIG[person] || {};
  // 時薪要用這個人「目前實際底薪」（當月已存的薪資單→上一次存過的月份→員工預設值表），
  // 不能只看 PR_CONFIG 的預設值，否則底薪已經在薪資管理調整過的人，出勤試算的請假扣款／加班費會用舊的（甚至 0）底薪算。
  const currentPayroll = PAYROLL.find(r => r.person === person && r.month === month);
  const priorPayroll = PAYROLL.filter(r => r.person === person && r.month < month).sort((a,b)=>b.month.localeCompare(a.month))[0];
  const effectiveBaseSalary = currentPayroll?.baseSalary || priorPayroll?.baseSalary || cfg.baseSalary || 0;
  const hourly = effectiveBaseSalary / 30 / 8;
  const records = attDailyEffectiveRecords(person, month);
  const leaves = ATTENDANCE_LEAVES.filter(r => r.person === person && String(r.date || '').startsWith(month));
  let workMinutes = 0;
  let overtimeMinutes = 0;
  let graceUsed = 0;
  let missingPunches = 0;
  const warnings = [];
  records.forEach(r => {
    const inM = attMinutes(r.inTime);
    const outM = attMinutes(attEffectiveOutTime(r));
    if (!Number.isFinite(inM) || !Number.isFinite(outM)) {
      if (r.date < attToday()) { missingPunches += 1; warnings.push(`${r.date} 缺卡`); }
      return;
    }
    const stay = Math.max(0, outM - inM);
    const paid = Math.max(0, stay - ATTENDANCE_SETTINGS.lunchMinutes);
    workMinutes += paid;
    // 07:40 起可先打卡，但早於 08:00 不會讓正常下班時間提前；晚於 08:00 則依實際上班時間順延。
    const scheduledIn = Math.max(inM, attMinutes('08:00'));
    const expectedOut = scheduledIn + ATTENDANCE_SETTINGS.workdayMinutes;
    const early = Math.max(0, expectedOut - outM - ATTENDANCE_SETTINGS.graceEarlyLeaveMinutes);
    graceUsed += early;
    overtimeMinutes += attRecordOvertimeMinutes(r);
    if (inM > attMinutes(ATTENDANCE_SETTINGS.latestIn)) warnings.push(`${r.date} 上班晚於 ${ATTENDANCE_SETTINGS.latestIn}`);
    if (r.locationType === 'site' && !r.caseCode) warnings.push(`${r.date} 工地打卡未指定案場`);
  });
  const absentDates = attMissingPastWorkDates(person, month, records, leaves);
  missingPunches += absentDates.length;
  absentDates.forEach(date => warnings.push(`${date} 未打卡且未請假`));
  const leaveHours = leaves.reduce((s,r)=>s+(Number(r.hours)||0),0);
  const personalHours = leaves.filter(r => r.type === 'personal').reduce((s,r)=>s+(Number(r.hours)||0),0);
  const sickHours = leaves.filter(r => r.type === 'sick').reduce((s,r)=>s+(Number(r.hours)||0),0);
  // 生理假：性別工作平等法第14條，一年3天(24小時)以內半薪且不併入病假日數；超過部分併入病假（實務上一樣是半薪，這裡先不追蹤跨月的年度3天上限）。
  const menstrualHours = leaves.filter(r => r.type === 'menstrual').reduce((s,r)=>s+(Number(r.hours)||0),0);
  const unpaidOtherHours = leaves.filter(r => r.type === 'other').reduce((s,r)=>s+(Number(r.hours)||0),0);
  const leaveDeduction = Math.round(personalHours * hourly + (sickHours + menstrualHours) * hourly * 0.5 + unpaidOtherHours * hourly);
  const fullAttendancePenalty = graceUsed > ATTENDANCE_SETTINGS.monthlyGraceMinutes ? ATTENDANCE_SETTINGS.fullAttendancePenalty : 0;
  const overtimeHours = Math.round(overtimeMinutes / 60 * 10) / 10;
  const overtimePay = Math.round(Math.min(overtimeHours, 2) * hourly * 4 / 3 + Math.max(0, overtimeHours - 2) * hourly * 5 / 3);
  const attendanceDays = new Set(records.map(r => r.date).filter(Boolean)).size;
  const expectedWorkdays = attExpectedWorkdays(month, person);
  return { person, month, cfg, hourly, records, leaves, attendanceDays, expectedWorkdays, workMinutes, overtimeHours, overtimePay, leaveHours, leaveDeduction, fullAttendancePenalty, graceUsed, missingPunches, warnings };
}

function attApplyDraftToPayroll() {
  if (!requireManage('attendance', '只有出勤管理者可以寫入薪資草稿')) return;
  const person = attVisiblePerson();
  const month = attMonthValue();
  const draft = attComputeDraft(person, month);
  if (!PAYROLL_MONTHS.includes(month)) PAYROLL_MONTHS.push(month);
  const existing = PAYROLL.find(r => r.person === person && r.month === month);
  const src = existing || PAYROLL.filter(r => r.person === person && r.month < month).sort((a,b)=>b.month.localeCompare(a.month))[0] || PR_CONFIG[person] || {};
  const data = {
    person, month,
    payDate: existing?.payDate || '',
    baseSalary: src.baseSalary || draft.cfg.baseSalary || 0,
    phoneAllowance: src.phoneAllowance || draft.cfg.phoneAllowance || 0,
    fullAttendanceBonus: Math.max(0, (src.fullAttendanceBonus || draft.cfg.fullAttendanceBonus || 0) - draft.fullAttendancePenalty),
    dutyAllowance: src.dutyAllowance || draft.cfg.dutyAllowance || 0,
    performanceBonus: src.performanceBonus || draft.cfg.performanceBonus || 0,
    mealAllowance: src.mealAllowance || draft.cfg.mealAllowance || 0,
    overtimePay: draft.overtimePay,
    expenseReimbursement: existing?.expenseReimbursement || 0,
    yearEndBonus: existing?.yearEndBonus || 0,
    engineeringBonus: existing?.engineeringBonus || 0,
    engineeringBonusNote: existing?.engineeringBonusNote || '',
    customItems: existing?.customItems || [],
    laborInsurance: src.laborInsurance || draft.cfg.laborInsurance || 0,
    healthInsurance: src.healthInsurance || draft.cfg.healthInsurance || 0,
    voluntaryPension: existing?.voluntaryPension || 0,
    leaveDeduction: draft.leaveDeduction,
    leaveNote: `出勤草稿：請假 ${draft.leaveHours} 小時；彈性早退累計 ${draft.graceUsed} 分；缺卡 ${draft.missingPunches} 筆${draft.fullAttendancePenalty ? '；全勤扣 1,000' : ''}`,
    advancePaid: existing?.advancePaid || 0,
    note: `由出勤管理 ${month} 草稿寫入；請財務覆核。${draft.warnings.length ? '異常：' + draft.warnings.join('、') : ''}`,
  };
  if (existing) Object.assign(existing, data);
  else PAYROLL.push({ id:prNextId++, ...data });
  prRenderMonthOptions(month);
  renderPayroll();
  saveData();
  showToast('薪資草稿已寫入薪資管理 ✓', 'success');
}

function renderAttendance() {
  if (!document.getElementById('page-attendance')) return;
  attFillPersonOptions();
  attFillCaseOptions();
  attDefaultFormValues();
  attGpsStart();
  attGpsRefresh();
  const monthSel = document.getElementById('att-filter-month');
  if (monthSel && !monthSel.value) attFillMonthOptions();
  const person = attVisiblePerson();
  const month = attMonthValue();
  const people = attPeople();
  if (attCanManage() && !people.length) {
    const summary = document.getElementById('att-summary');
    if (summary) summary.innerHTML = `<div class="card" style="padding:18px;grid-column:1/-1;color:var(--text3);line-height:1.7">目前沒有需打卡人員。鄭詩褣、彭俞豪、連星羽已設定為免打卡；孫一宣、陳虹君已離職停用。之後新進正職員工可在員工管理勾選「需打卡並連動薪資草稿」。</div>`;
    const tbody = document.getElementById('att-record-tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:18px">目前沒有需打卡人員</td></tr>`;
    const ltbody = document.getElementById('att-leave-tbody');
    if (ltbody) ltbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:16px">目前沒有需打卡人員</td></tr>`;
    const draftEl = document.getElementById('att-draft');
    if (draftEl) draftEl.innerHTML = `<div style="font-size:13px;line-height:1.8;color:var(--text2)">出勤薪資草稿目前待新進需打卡員工啟用後使用。</div>`;
    return;
  }
  const draft = attComputeDraft(person, month);
  const nameOf = id => PR_CONFIG[id]?.name || EMPLOYEES.find(e => e.id === id)?.name || id;
  const summary = document.getElementById('att-summary');
  if (summary) {
    const annualStatus = attAnnualLeaveStatus(person, attToday());
    const annualLeaveCard = annualStatus
      ? (annualStatus.eligible
        ? ['特休剩餘', `${annualStatus.remainingDays} / ${annualStatus.entitlementDays} 天`, 'var(--accent)']
        : ['特休剩餘', '未滿6個月', 'var(--text3)'])
      : null;
    summary.innerHTML = [
      ['應出勤', draft.expectedWorkdays + ' 天', 'var(--text)'],
      ['實際出勤', draft.attendanceDays + ' 天', 'var(--accent)'],
      ['請假', draft.leaveHours + ' 小時', 'var(--warning)'],
      ['缺卡', draft.missingPunches + ' 筆', draft.missingPunches ? 'var(--error)' : 'var(--success)'],
      ['加班試算', attMoney(draft.overtimePay), 'var(--success)'],
      ...(annualLeaveCard ? [annualLeaveCard] : []),
    ].map(([label,val,color]) => `<div class="kpi-card" style="padding:12px 14px"><div class="kpi-label">${label}</div><div style="font-size:18px;font-weight:800;color:${color}">${val}</div></div>`).join('');
  }
  const overtimeWrap = document.getElementById('att-rec-overtime-wrap');
  if (overtimeWrap) overtimeWrap.style.display = attCanManage() ? '' : 'none';
  const rows = attDailyEffectiveRecords(person, month).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  const tbody = document.getElementById('att-record-tbody');
  if (tbody) {
    tbody.innerHTML = rows.length ? rows.map(r => {
      const hasOvertimeOverride = r.overtimeHoursOverride !== undefined && r.overtimeHoursOverride !== null && r.overtimeHoursOverride !== '';
      const otMinutes = attRecordOvertimeMinutes(r);
      const otHours = Math.round(otMinutes / 60 * 10) / 10;
      const otLabel = otMinutes > 0 ? `<br><span style="font-size:10px;color:var(--accent)">加班 ${otHours} 小時${hasOvertimeOverride ? '（手動）' : ''}</span>` : '';
      return `<tr>
      <td>${r.date || '—'}</td><td>${nameOf(r.person)}</td><td>${r.inTime || '—'}</td><td>${attEffectiveOutTime(r) || '—'}</td>
      <td>${r.locationType === 'site' ? '工地' : '公司'}${r.caseName ? '｜'+tfEsc(r.caseName) : ''}${r.source === 'gps' ? '<br><span style="font-size:10px;color:var(--success)">GPS</span>' : ''}</td>
      <td><span class="tag ${attRecordStatus(r)==='缺卡'?'tag-pending':(['上班中','今日待補'].includes(attRecordStatus(r))?'tag-active':'tag-done')}">${attRecordStatus(r)}</span>${otLabel}</td>
      <td style="text-align:center;white-space:nowrap">${attCanManage() ? `${attRecordStatus(r)==='補登待核' ? `<button class="btn btn-primary btn-sm" onclick="attApproveRecord(${r.id})">核准</button> ` : ''}<button class="btn btn-ghost btn-sm" onclick="attEditRecord(${r.id})">編輯</button> <button class="btn btn-ghost btn-sm" onclick="attDeleteRecord(${r.id})" style="color:var(--error)">刪除</button>` : '—'}</td>
    </tr>`;
    }).join('') : `<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:18px">尚無出勤紀錄</td></tr>`;
  }
  const leaveRows = ATTENDANCE_LEAVES.filter(r => r.person === person && String(r.date || '').startsWith(month)).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  const leaveLabel = {personal:'事假', sick:'病假', menstrual:'生理假', annual:'特休', official:'公假', bereavement:'喪假', other:'其他'};
  const ltbody = document.getElementById('att-leave-tbody');
  if (ltbody) {
    ltbody.innerHTML = leaveRows.length ? leaveRows.map(r => `<tr>
      <td>${r.date}</td><td>${leaveLabel[r.type] || r.type}</td><td style="text-align:right">${r.hours}</td><td>${tfEsc(r.note || '')}</td>
      <td style="text-align:center;white-space:nowrap">${attCanManage() ? `<button class="btn btn-ghost btn-sm" onclick="attEditLeave(${r.id})">編輯</button> <button class="btn btn-ghost btn-sm" onclick="attDeleteLeave(${r.id})" style="color:var(--error)">刪除</button>` : '—'}</td>
    </tr>`).join('') : `<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:16px">尚無請假紀錄</td></tr>`;
  }
  const draftEl = document.getElementById('att-draft');
  if (draftEl) {
    draftEl.innerHTML = `
      <div style="font-size:13px;line-height:1.8;color:var(--text2)">
        <div><strong style="color:var(--text)">${nameOf(person)}｜${month}</strong></div>
        <div>時薪基礎：${attMoney(draft.hourly)}（月薪 / 30 / 8）</div>
        <div>請假扣款：${attMoney(draft.leaveDeduction)}；全勤扣款：${attMoney(draft.fullAttendancePenalty)}</div>
        <div>加班試算：${draft.overtimeHours} 小時，${attMoney(draft.overtimePay)}（08:00 前打卡以 08:00 起算；每日滿 9 小時後，每滿 30 分鐘計）</div>
        <div>薪資草稿會寫入「請假扣款、加班費、全勤獎金調整與備註」，正式發薪前仍需財務覆核。</div>
      </div>
      ${draft.warnings.length ? `<div style="margin-top:10px;padding:10px;border:1px solid rgba(224,112,112,.35);border-radius:8px;background:var(--error-bg);color:var(--error);font-size:12px;line-height:1.7">${draft.warnings.map(tfEsc).join('<br>')}</div>` : `<div style="margin-top:10px;color:var(--success);font-size:12px">目前沒有出勤異常。</div>`}`;
  }
}
