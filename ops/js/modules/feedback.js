// FEEDBACK MODULE. Extracted verbatim from ops/index.html at main@4e42a53.

function tfStatusColor(status) {
  return { '待處理':'var(--warning)', '處理中':'var(--blue)', '已修正':'var(--success)', '先擱置':'var(--text3)' }[status] || 'var(--text3)';
}

function tfSeverityColor(severity) {
  return { '阻擋上線':'var(--error)', '高':'var(--error)', '中':'var(--warning)', '低':'var(--text3)' }[severity] || 'var(--text3)';
}

const TF_SCREENSHOT_MAX_EDGE = 1600;
const TF_SCREENSHOT_MAX_BYTES = 1500 * 1024;

function tfFormatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

function tfDataUrlBytes(dataUrl) {
  const base64 = String(dataUrl || '').split(',')[1] || '';
  return Math.round(base64.length * 3 / 4);
}

function initFeedbackScreenshotInput() {
  const drop = document.getElementById('tf-shot-drop');
  if (!drop || drop.dataset.ready === '1') return;
  drop.dataset.ready = '1';
  ['dragenter','dragover'].forEach(type => {
    drop.addEventListener(type, event => {
      event.preventDefault();
      drop.classList.add('dragover');
    });
  });
  ['dragleave','drop'].forEach(type => {
    drop.addEventListener(type, event => {
      event.preventDefault();
      drop.classList.remove('dragover');
    });
  });
  drop.addEventListener('drop', event => {
    const file = [...(event.dataTransfer?.files || [])].find(f => f.type.startsWith('image/'));
    if (file) handleFeedbackScreenshotFile(file);
  });
  document.addEventListener('paste', event => {
    if (currentPage !== 'feedback') return;
    const items = [...(event.clipboardData?.items || [])];
    const item = items.find(i => i.type.startsWith('image/'));
    if (!item) return;
    const file = item.getAsFile();
    if (file) {
      event.preventDefault();
      handleFeedbackScreenshotFile(file);
    }
  });
}

function compressFeedbackScreenshot(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type?.startsWith('image/')) {
      reject(new Error('not_image'));
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const ratio = Math.min(1, TF_SCREENSHOT_MAX_EDGE / Math.max(img.width || 1, img.height || 1));
      const width = Math.max(1, Math.round((img.width || 1) * ratio));
      const height = Math.max(1, Math.round((img.height || 1) * ratio));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      let quality = 0.82;
      let dataUrl = canvas.toDataURL('image/jpeg', quality);
      while (tfDataUrlBytes(dataUrl) > TF_SCREENSHOT_MAX_BYTES && quality > 0.45) {
        quality -= 0.08;
        dataUrl = canvas.toDataURL('image/jpeg', quality);
      }
      resolve({
        dataUrl,
        name: file.name || `screenshot-${new Date().toISOString().slice(0,19).replace(/[T:]/g,'-')}.jpg`,
        type: 'image/jpeg',
        size: tfDataUrlBytes(dataUrl),
        width,
        height,
        capturedAt: new Date().toISOString()
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image_load_failed'));
    };
    img.src = url;
  });
}

async function handleFeedbackScreenshotFile(file) {
  if (!file) return;
  try {
    showToast('正在壓縮截圖…', 'warning');
    const shot = await compressFeedbackScreenshot(file);
    if (shot.size > TF_SCREENSHOT_MAX_BYTES) {
      showToast('截圖仍太大，請裁切後再貼一次', 'error');
      return;
    }
    tfScreenshotDraft = shot;
    renderFeedbackScreenshotDraft();
    showToast('截圖已加入回饋', 'success');
  } catch(e) {
    console.warn('handleFeedbackScreenshotFile failed:', e);
    showToast('截圖讀取失敗，請改用 PNG/JPG 圖片', 'error');
  }
}

function renderFeedbackScreenshotDraft() {
  const preview = document.getElementById('tf-shot-preview');
  const img = document.getElementById('tf-shot-img');
  const name = document.getElementById('tf-shot-name');
  const meta = document.getElementById('tf-shot-meta');
  if (!preview || !img || !name || !meta) return;
  if (!tfScreenshotDraft) {
    preview.classList.remove('show');
    img.removeAttribute('src');
    name.textContent = '';
    meta.textContent = '';
    return;
  }
  preview.classList.add('show');
  img.src = tfScreenshotDraft.dataUrl;
  name.textContent = tfScreenshotDraft.name || '問題截圖';
  meta.textContent = `${tfScreenshotDraft.width}×${tfScreenshotDraft.height}｜${tfFormatBytes(tfScreenshotDraft.size)}`;
}

function clearFeedbackScreenshot() {
  tfScreenshotDraft = null;
  const input = document.getElementById('tf-shot-file');
  if (input) input.value = '';
  renderFeedbackScreenshotDraft();
}

function openFeedbackScreenshot(id) {
  const row = TEST_FEEDBACK.find(r => r.id === id);
  if (!row?.screenshotDataUrl) return;
  const img = document.getElementById('tf-shot-modal-img');
  const title = document.getElementById('tf-shot-modal-title');
  const meta = document.getElementById('tf-shot-modal-meta');
  if (img) img.src = row.screenshotDataUrl;
  if (title) title.textContent = `${row.page || '問題'} · 截圖`;
  if (meta) {
    const size = row.screenshotSize ? tfFormatBytes(row.screenshotSize) : '';
    const dims = row.screenshotWidth && row.screenshotHeight ? `${row.screenshotWidth}×${row.screenshotHeight}` : '';
    meta.textContent = [row.screenshotName || '', dims, size].filter(Boolean).join('｜');
  }
  openModal('modal-feedback-shot');
}

function submitFeedback() {
  if (!canAccess('feedback')) { showToast('您沒有新增問題回報的權限', 'error'); return; }
  const page = document.getElementById('tf-page')?.value || '其他';
  const type = document.getElementById('tf-type')?.value || '錯誤';
  const severity = document.getElementById('tf-severity')?.value || '中';
  const steps = document.getElementById('tf-steps')?.value.trim() || '';
  const expected = document.getElementById('tf-expected')?.value.trim() || '';
  const actual = document.getElementById('tf-actual')?.value.trim() || '';
  const note = document.getElementById('tf-note')?.value.trim() || '';
  if (!steps) { showToast('請填寫操作步驟', 'error'); return; }
  if (!actual) { showToast('請填寫實際結果', 'error'); return; }
  TEST_FEEDBACK.unshift({
    id: tfNextId++,
    createdAt: new Date().toISOString(),
    reporterId: currentUser.id,
    reporterName: currentUser.name,
    page, type, severity, steps, expected, actual, note,
    screenshotDataUrl: tfScreenshotDraft?.dataUrl || '',
    screenshotName: tfScreenshotDraft?.name || '',
    screenshotType: tfScreenshotDraft?.type || '',
    screenshotSize: tfScreenshotDraft?.size || 0,
    screenshotWidth: tfScreenshotDraft?.width || 0,
    screenshotHeight: tfScreenshotDraft?.height || 0,
    screenshotCapturedAt: tfScreenshotDraft?.capturedAt || '',
    status:'待處理',
    updatedAt: new Date().toISOString(),
    updatedBy: currentUser.name
  });
  ['tf-steps','tf-expected','tf-actual','tf-note'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  clearFeedbackScreenshot();
  renderFeedback();
  saveData();
  showToast('問題回報已記錄 ✓', 'success');
}

function setFeedbackStatus(id, status) {
  if (!['OWNER','FINANCE'].includes(currentUser.roleCode)) { showToast('只有完整管理者可以變更回饋狀態', 'error'); return; }
  const row = TEST_FEEDBACK.find(r => r.id === id);
  if (!row) return;
  row.status = status;
  row.updatedAt = new Date().toISOString();
  row.updatedBy = currentUser.name;
  renderFeedback();
  saveData();
}

function deleteFeedback(id) {
  if (!['OWNER','FINANCE'].includes(currentUser.roleCode)) { showToast('只有完整管理者可以刪除回饋', 'error'); return; }
  if (!confirm('確定刪除這筆問題回報？')) return;
  TEST_FEEDBACK = TEST_FEEDBACK.filter(r => r.id !== id);
  renderFeedback();
  saveData();
  showToast('問題回報已刪除', 'success');
}

function renderFeedback() {
  const tbody = document.getElementById('tf-tbody');
  if (!tbody) return;
  const statusFilter = document.getElementById('tf-filter-status')?.value || '';
  const severityFilter = document.getElementById('tf-filter-severity')?.value || '';
  const rows = TEST_FEEDBACK.filter(r =>
    (!statusFilter || r.status === statusFilter) &&
    (!severityFilter || r.severity === severityFilter)
  );
  const summary = document.getElementById('tf-summary');
  if (summary) {
    const blockers = TEST_FEEDBACK.filter(r => r.severity === '阻擋上線' && r.status !== '已修正').length;
    const open = TEST_FEEDBACK.filter(r => r.status !== '已修正' && r.status !== '先擱置').length;
    summary.textContent = `共 ${TEST_FEEDBACK.length} 筆，待處理 ${open} 筆，阻擋上線 ${blockers} 筆`;
  }
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="padding:22px;text-align:center;color:var(--text3)">目前沒有符合條件的問題回報</td></tr>`;
    return;
  }
  const canAdmin = ['OWNER','FINANCE'].includes(currentUser.roleCode);
  tbody.innerHTML = rows.map(r => {
    const created = formatDateTimeTW(r.createdAt);
    const screenshot = r.screenshotDataUrl
      ? `<button type="button" onclick="openFeedbackScreenshot(${r.id})" style="margin-top:8px;border:0;background:transparent;padding:0;display:block" title="查看問題截圖">
          <img class="tf-shot-thumb" src="${r.screenshotDataUrl}" alt="問題截圖">
        </button>`
      : '';
    const statusSelect = canAdmin
      ? `<select class="filter-select" onchange="setFeedbackStatus(${r.id}, this.value)" style="min-width:96px;height:28px;font-size:11px">
          ${['待處理','處理中','已修正','先擱置'].map(s => `<option value="${s}" ${r.status===s?'selected':''}>${s}</option>`).join('')}
        </select>`
      : `<span style="color:${tfStatusColor(r.status)}">${tfEsc(r.status)}</span>`;
    return `
      <tr style="border-bottom:1px solid var(--border)">
        <td style="padding:10px 12px;color:var(--text3);white-space:nowrap">${created}</td>
        <td style="padding:10px 12px;white-space:nowrap">${tfEsc(r.reporterName)}</td>
        <td style="padding:10px 12px;white-space:nowrap">${tfEsc(r.page)}</td>
        <td style="padding:10px 12px;white-space:nowrap">${tfEsc(r.type)}</td>
        <td style="padding:10px 12px;white-space:nowrap;color:${tfSeverityColor(r.severity)};font-weight:700">${tfEsc(r.severity)}</td>
        <td style="padding:10px 12px;min-width:320px">
          <div style="font-weight:600;color:var(--text);line-height:1.5">${tfEsc(r.actual)}</div>
          <div style="margin-top:5px;color:var(--text3);line-height:1.5">步驟：${tfEsc(r.steps)}</div>
          ${r.expected ? `<div style="margin-top:3px;color:var(--text3);line-height:1.5">預期：${tfEsc(r.expected)}</div>` : ''}
          ${r.note ? `<div style="margin-top:3px;color:var(--text3);line-height:1.5">備註：${tfEsc(r.note)}</div>` : ''}
          ${screenshot}
        </td>
        <td style="padding:10px 12px;white-space:nowrap">${statusSelect}</td>
        <td style="padding:10px 12px;text-align:center;white-space:nowrap">${canAdmin ? `<button class="btn btn-ghost btn-sm" onclick="deleteFeedback(${r.id})" style="font-size:11px;color:var(--error)">刪除</button>` : '—'}</td>
      </tr>`;
  }).join('');
}
