// RECEIPTS (單據). New feature, not extracted from the baseline.
// Photos and files are uploaded to the signed-in person's own folder in the shared drive (行政管理部 → 費用單據 →
// 費用單據個人拍照存檔區 → <name>費用單據); OPS stores only the links, as `attachments` on the request row
// (and fills the legacy `invoiceLink` of a pay request, which the payables screen already shows).
// The Drive permission is requested on demand (not at login), so only people who upload see the extra consent.
// No OCR in this version: amounts and vendors are typed by the person.

const RECEIPT_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';
const RECEIPT_PARENT_FOLDER = '1qmfkZ47Nya0PiY1SRBR3LwHCo75o5lFs';
const RECEIPT_FOLDERS = {
  shower: '1DqA3iYqYfR2fH69RTLm6IolCSD_ZESMu',
  lu_yanchen: '1_lP1JYUKFBxetz7uHDFQZLtmIUAj3cJz',
  nc: '1h2zruFXG5s-R5QufX0di26HagwAvcUm_',
  peng: '1dIKOwkoslvwT5T8ss2PQh9S-LWLIe78B',
  lien: '1YQ6D5zQDxaOb8Asdb9ycgkt7K_sFYeY3',
};
const RECEIPT_MAX_EDGE = 2000;
const RECEIPT_TOKEN_MS = 50 * 60 * 1000;

let receiptToken = '';
let receiptTokenAt = 0;
let receiptTokenClient = null;
let receiptBusy = false;
// Where the next picked files go: { kind: 'form', form: 'expense'|'payreq' } or { kind: 'row', collection, id }.
let receiptTarget = null;
const receiptPending = { expense: [], payreq: [] };

function receiptFolderId() {
  return RECEIPT_FOLDERS[currentUser?.id] || '';
}

function receiptTokenValid() {
  return !!receiptToken && Date.now() - receiptTokenAt < RECEIPT_TOKEN_MS;
}

// Must run inside a tap: the Google consent popup is blocked otherwise.
function receiptConnect() {
  if (typeof google === 'undefined' || !google.accounts?.oauth2) { showToast('Google 登入元件尚未載入，請稍後再試', 'error'); return; }
  if (!receiptTokenClient) {
    receiptTokenClient = google.accounts.oauth2.initTokenClient({
      client_id: OPS_GOOGLE_CLIENT_ID,
      scope: RECEIPT_DRIVE_SCOPE,
      callback: resp => {
        if (resp && resp.access_token) {
          receiptToken = resp.access_token;
          receiptTokenAt = Date.now();
          showToast('雲端硬碟已連線，請再按一次', 'success');
        } else {
          showToast('雲端硬碟授權失敗：' + ((resp && (resp.error_description || resp.error)) || '已取消'), 'error');
        }
      },
      error_callback: () => showToast('雲端硬碟授權視窗被關閉或擋下', 'error'),
    });
  }
  receiptTokenClient.requestAccessToken({ prompt: receiptToken ? '' : 'consent' });
}

// Runs `action` right away when connected, otherwise starts the consent flow and asks for one more tap.
function receiptWithDrive(action) {
  if (!currentUser) return;
  if (!receiptFolderId()) { showToast('您的單據資料夾尚未設定，請通知管理員', 'error'); return; }
  if (receiptTokenValid()) action(); else receiptConnect();
}

function receiptSafeName(name) {
  return String(name || 'photo').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80);
}

function receiptStamp() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function receiptCompress(file) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, RECEIPT_MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => resolve(blob ? { blob, compressed: true } : { blob: file, compressed: false }), 'image/jpeg', 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve({ blob: file, compressed: false }); };
    img.src = url;
  });
}

async function receiptUploadFile(file) {
  const folder = receiptFolderId();
  let blob = file;
  let name = receiptSafeName(file.name || 'photo.jpg');
  let type = file.type || 'application/octet-stream';
  if (/^image\//.test(type)) {
    const out = await receiptCompress(file);
    blob = out.blob;
    if (out.compressed) { type = 'image/jpeg'; name = name.replace(/\.[^.]+$/, '') + '.jpg'; }
  }
  const metadata = { name: receiptStamp() + '_' + name, parents: [folder] };
  const boundary = 'ops' + Math.random().toString(36).slice(2);
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
    `--${boundary}\r\nContent-Type: ${type}\r\n\r\n`, blob, `\r\n--${boundary}--`,
  ]);
  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink,mimeType', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + receiptToken, 'Content-Type': 'multipart/related; boundary=' + boundary },
    body,
  });
  if (res.status === 401) { receiptToken = ''; throw new Error('授權已過期，請再按一次連線'); }
  if (!res.ok) throw new Error('上傳失敗（' + res.status + '）');
  const data = await res.json();
  return { id: data.id, name: data.name, url: data.webViewLink || `https://drive.google.com/file/d/${data.id}/view`, at: new Date().toISOString(), by: currentUser?.name || '' };
}

async function receiptUploadMany(files) {
  const list = [...files];
  const done = [];
  receiptBusy = true;
  receiptRenderBusy();
  try {
    for (let i = 0; i < list.length; i += 1) {
      showToast(`上傳單據 ${i + 1}/${list.length}…`);
      done.push(await receiptUploadFile(list[i]));
    }
    if (list.length) showToast(`已上傳 ${list.length} 個單據 ✓`, 'success');
  } catch (e) {
    showToast(String(e && e.message || e), 'error');
  } finally {
    receiptBusy = false;
    receiptRenderBusy();
  }
  return done;
}

function receiptRenderBusy() {
  document.querySelectorAll('[data-receipt-busy]').forEach(el => { el.disabled = receiptBusy; });
}

// Called by the hidden file inputs.
async function receiptFilesChosen(input) {
  const files = [...(input.files || [])];
  input.value = '';
  if (!files.length || !receiptTarget) return;
  const target = receiptTarget;
  const uploaded = await receiptUploadMany(files);
  if (uploaded.length) receiptDeliver(target, uploaded);
}

function receiptDeliver(target, atts) {
  if (target.kind === 'inbox') {
    if (typeof mobileLoadInbox === 'function') mobileLoadInbox();
  } else if (target.kind === 'form') {
    receiptPending[target.form].push(...atts);
    if (typeof mobileRenderAttachChips === 'function') mobileRenderAttachChips();
  } else if (target.kind === 'row') {
    const row = receiptRow(target.collection, target.id);
    if (!row) { showToast('找不到要加單據的紀錄', 'error'); return; }
    receiptApplyTo(row, atts);
    saveData();
    receiptRefreshViews();
  }
}

function receiptRow(collection, id) {
  const list = collection === 'EXPENSES' ? EXPENSES : collection === 'PAYABLES' ? PAYABLES : [];
  return list.find(r => Number(r.id) === Number(id));
}

function receiptApplyTo(row, atts) {
  if (!row || !atts.length) return;
  row.attachments = [...(Array.isArray(row.attachments) ? row.attachments : []), ...atts];
  if ('invoiceLink' in row && !row.invoiceLink) row.invoiceLink = atts[0].url;
  touchRowMeta(row);
}

function receiptCanAttach(collection, row) {
  if (!row || !currentUser) return false;
  if (collection === 'EXPENSES') return expCanManageAll() || (row.person === currentUser.id && ['pending', 'rejected'].includes(row.status));
  return canManage('payreq') || (['pending', 'rejected'].includes(row.status) && (row.person === currentUser.name || row.person === currentUser.id));
}

function receiptRefreshViews() {
  if (typeof renderExpense === 'function') renderExpense();
  if (typeof renderPayreq === 'function') renderPayreq();
  if (typeof mobileRenderOwnPage === 'function' && typeof MOBILE_OWN_PAGES !== 'undefined' && MOBILE_OWN_PAGES.includes(currentPage)) mobileRenderOwnPage(currentPage);
  receiptRenderAttachModal();
}

// ── pickers (all start from a tap) ──
function receiptPick(target, mode) {
  receiptTarget = target;
  receiptWithDrive(() => {
    const input = document.getElementById(mode === 'camera' ? 'receipt-file-camera' : 'receipt-file-any');
    if (input) input.click();
  });
}

function receiptAddLink(target) {
  const url = (window.prompt('貼上單據連結（雲端硬碟或其他網址）', '') || '').trim();
  if (!url) return;
  if (!/^https?:\/\//i.test(url)) { showToast('連結必須以 http:// 或 https:// 開頭', 'error'); return; }
  receiptDeliver(target, [{ id: '', name: '連結', url, at: new Date().toISOString(), by: currentUser?.name || '' }]);
}

function receiptAttachmentEls(row) {
  const wrap = document.createElement('div');
  wrap.className = 'rc-links';
  (Array.isArray(row?.attachments) ? row.attachments : []).forEach(a => {
    const link = document.createElement('a');
    link.href = a.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
    link.textContent = '📎 ' + (a.name || '單據');
    wrap.appendChild(link);
  });
  return wrap;
}

// ── attachments modal for an existing row (desktop and phone) ──
let receiptModalTarget = null;

function receiptOpenAttachModal(collection, id) {
  const row = receiptRow(collection, id);
  if (!row) return;
  receiptModalTarget = { collection, id };
  openModal('modal-attachments');
  receiptRenderAttachModal();
}

function receiptRenderAttachModal() {
  const modal = document.getElementById('modal-attachments');
  if (!modal || !modal.classList.contains('open') || !receiptModalTarget) return;
  const row = receiptRow(receiptModalTarget.collection, receiptModalTarget.id);
  if (!row) return;
  const label = receiptModalTarget.collection === 'EXPENSES' ? (row.item || '') : ((row.vendor || '') + '・' + (row.summary || ''));
  document.getElementById('rc-modal-summary').textContent = label;
  const list = document.getElementById('rc-modal-list');
  list.textContent = '';
  const atts = Array.isArray(row.attachments) ? row.attachments : [];
  if (!atts.length) { const e = document.createElement('div'); e.className = 'rc-empty'; e.textContent = '還沒有單據'; list.appendChild(e); }
  list.appendChild(receiptAttachmentEls(row));
  const can = receiptCanAttach(receiptModalTarget.collection, row);
  document.getElementById('rc-modal-actions').hidden = !can;
}

function receiptModalPick(mode) {
  if (!receiptModalTarget) return;
  const target = { kind: 'row', ...receiptModalTarget };
  if (mode === 'link') receiptAddLink(target); else receiptPick(target, mode);
}
