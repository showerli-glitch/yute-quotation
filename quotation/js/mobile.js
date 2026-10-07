// QUOTATION PHONE LAYOUT (new code, not extracted from the baseline). Phones and portrait tablets (≤1023px,
// the same breakpoint as OPS) get their own screens: 報價單 / 工項 / 雲端檔案 / 更多, plus the item sheet and
// the project-info page. Nothing is calculated here: every screen reads the same globals (quoteItems, dbItems,
// miscItems, remarksItems …) and writes through the existing functions (addItem, updateField, updateItemCat,
// removeItem, undo, addCustomItem, saveDb, saveQuoteToDrive, driveLoad, doPrint, exportToExcel …) or the
// existing desktop inputs (#projName, #mgmtFee, #extraClean* …), so the totals, PDF and Excel are the
// desktop ones. Desktop (≥1024px) is unchanged; the phone screens are hidden there and in print.
const QM_MEDIA = window.matchMedia('(max-width: 1023px)');
let qmTab = 'quote';            // quote | items | drive | more
let qmPage = null;              // null | info | remarks | sections | prices | newitem
let qmCollapsed = new Set();
let qmItemCat = '全部';
let qmItemQuery = '';
let qmPriceQuery = '';
let qmDriveQuery = '';
let qmSheetId = null;

const qmEsc = v => escHtml(v);
const qmMoney = n => '$ ' + Math.round(Number(n) || 0).toLocaleString();
const qmShortCat = c => String(c).replace('工程', '').replace('及系統櫃', '').replace('及輕鋼架天花', '').replace('及貼磚', '').replace('及貼膜', '').replace('、設備及其他', '').replace('及鋁窗', '');
const qmEl = id => document.getElementById(id);
const qmVal = id => (qmEl(id)?.value ?? '');
const qmFind = id => quoteItems.find(i => String(i.id) === String(id));
const qmUser = () => { try { return (JSON.parse(localStorage.getItem('yutesign_session') || '{}').email || '').replace('@yutesign.com', ''); } catch (e) { return ''; } };

const QM_ICONS = {
  quote: '<path d="M7 3h10l3 3v15H4V3z"/><path d="M8 10h8M8 14h8M8 18h5"/>',
  items: '<rect x="4" y="4" width="7" height="7"/><rect x="13" y="4" width="7" height="7"/><rect x="4" y="13" width="7" height="7"/><rect x="13" y="13" width="7" height="7"/>',
  drive: '<path d="M3 7h6l2 2h10v10H3z"/>',
  more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
};
const QM_TABS = [['quote', '報價單'], ['items', '工項'], ['drive', '雲端檔案'], ['more', '更多']];

function qmActive() { return QM_MEDIA.matches; }

function qmMount() {
  if (qmEl('qm')) return;
  const root = document.createElement('div');
  root.id = 'qm';
  root.innerHTML = `
    <div id="qm-sync" class="qm-sync" style="display:none"><span></span><button type="button" onclick="qmSyncDismiss()">知道了</button></div>
    <header id="qm-head" class="qm-head"></header>
    <main id="qm-body" class="qm-body"></main>
    <div id="qm-foot"></div>
    <nav id="qm-nav" class="qm-nav">${QM_TABS.map(([k, label]) => `<button type="button" data-tab="${k}" onclick="qmGo('${k}')"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${QM_ICONS[k]}</svg>${label}</button>`).join('')}</nav>
    <div id="qm-sheet" class="qm-sheet" style="display:none" onclick="if(event.target===this)qmCloseSheet()"><div class="qm-sheet-box" id="qm-sheet-box"></div></div>
    <div id="qm-toast" class="qm-toast" style="display:none"></div>`;
  (qmEl('mainApp') || document.body).appendChild(root);
}

function qmApply() {
  const on = qmActive();
  document.body.classList.toggle('qm-on', on);
  if (on) { qmMount(); qmRender(); }
}

function qmGo(tab) {
  qmTab = tab; qmPage = null;
  const toast = qmEl('qm-toast'); if (toast) toast.style.display = 'none';
  if (tab === 'drive' && typeof driveAccessToken !== 'undefined' && driveAccessToken && !driveFilesCache.length) driveListFiles().catch(() => {});
  qmRender();
  qmEl('qm-body')?.scrollTo(0, 0);
}
function qmOpenPage(page) { qmPage = page; if (page === 'sections') openSectionManager(); qmRender(); qmEl('qm-body')?.scrollTo(0, 0); }
function qmBack() {
  const from = qmPage;
  qmPage = null;
  if (from === 'sections') closeSectionManager();
  else qmRender();
}

function qmToast(msg) {
  const t = qmEl('qm-toast'); if (!t) return;
  t.textContent = msg; t.style.display = '';
  clearTimeout(qmToast.timer);
  qmToast.timer = setTimeout(() => { t.style.display = 'none'; }, 1600);
}

function qmRender() {
  if (!qmActive() || !qmEl('qm')) return;
  const head = qmEl('qm-head'), body = qmEl('qm-body'), foot = qmEl('qm-foot');
  const keepScroll = body.scrollTop;
  let view;
  if (qmPage) view = qmPageView(qmPage);
  else view = { quote: qmQuoteView, items: qmItemsView, drive: qmDriveView, more: qmMoreView }[qmTab]();
  head.innerHTML = view.head;
  body.innerHTML = view.body;
  foot.innerHTML = view.foot || '';
  qmEl('qm-nav').style.display = qmPage ? 'none' : '';
  document.querySelectorAll('#qm-nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === qmTab));
  if (view.keep) body.scrollTop = keepScroll;
  if (view.after) view.after();
  if (qmSheetId !== null) qmRenderItemSheet();
}

function qmHeadTop(right) { return `<div class="qm-kicker"><span>YUTE / 報價</span><span>${right || ''}</span></div>`; }

function qmTotalsBar() {
  const c = getCalc();
  return `<div class="qm-totals">
    <div>工項小計<b>${qmMoney(c.subtotal)}</b></div>
    <div>管理費 ${qmEsc(c.mgmtPct)}%<b>${qmMoney(c.mgmt)}</b></div>
    <div>稅 5%<b>${qmMoney(c.tax)}</b></div>
    <div class="qm-total">總計<b id="qm-grand">${qmMoney(c.total)}</b></div>
  </div>`;
}

// ── 報價單 ──
function qmQuoteView() {
  const name = qmVal('projName').trim() || '未命名工程';
  const sub = [qmVal('projClient').trim() || '未填業主', qmVal('projDate'), quoteItems.length + ' 項'].filter(Boolean).join('・');
  const head = `${qmHeadTop('● 已自動存草稿')}<button type="button" class="qm-title-btn" onclick="qmOpenPage('info')"><span class="qm-title">${qmEsc(name)}</span><span class="qm-sub">${qmEsc(sub)}　編輯 ›</span></button>`;
  let body = `<div class="qm-actions"><button type="button" class="qm-btn qm-primary" onclick="qmGo('items')">＋ 加工項</button><button type="button" class="qm-btn qm-outline" onclick="qmOpenCustom()">自訂工項</button><button type="button" class="qm-btn qm-icon" onclick="undo()" aria-label="復原">↶</button></div>`;
  if (!quoteItems.length) {
    body += '<div class="qm-empty">報價單還沒有工項。<br>按「＋ 加工項」從工項資料庫挑選，或按「自訂工項」自己輸入。</div>';
  } else {
    const sections = getSections();
    Object.entries(sections).forEach(([cat, items], si) => {
      const total = items.reduce((s, i) => s + i.qty * i.price, 0);
      const closed = qmCollapsed.has(cat);
      body += `<button type="button" class="qm-sec" data-cat="${qmEsc(cat)}" onclick="qmToggleSec(this.dataset.cat)"><span>${NUM_ZH[si] || si + 1}、${qmEsc(cat)}</span><span class="qm-mono">${qmMoney(total)} ${closed ? '▸' : '▾'}</span></button>`;
      if (closed) return;
      items.forEach((it, k) => {
        body += `<div class="qm-card qm-qcard" data-id="${it.id}" onclick="qmOpenItem(this.dataset.id)">
          <div class="qm-row"><span class="qm-name">${qmEsc(it.name)}</span><span class="qm-mono qm-amt">${qmMoney(it.qty * it.price)}</span></div>
          <div class="qm-row qm-meta"><span class="qm-mono">${qmEsc(it.qty)} ${qmEsc(it.unit)} × ${qmMoney(it.price)}</span>
            <span class="qm-move"><button type="button" ${k === 0 ? 'disabled' : ''} onclick="event.stopPropagation();qmMove(this.closest('.qm-card').dataset.id,-1)" aria-label="上移">▲</button><button type="button" ${k === items.length - 1 ? 'disabled' : ''} onclick="event.stopPropagation();qmMove(this.closest('.qm-card').dataset.id,1)" aria-label="下移">▼</button></span></div>
          ${it.note ? `<div class="qm-note">${qmEsc(it.note)}</div>` : ''}
        </div>`;
      });
    });
    const x = getExtraItems();
    const extras = [['清潔費', x.clean], ['設計費', x.design], ['雜項費用', x.miscTotal], ['工程保險費', x.insurance]].filter(([, v]) => v);
    if (extras.length) body += `<button type="button" class="qm-card qm-extras" onclick="qmOpenPage('info')">${extras.map(([k, v]) => `<div class="qm-row"><span>${k}</span><span class="qm-mono">${qmMoney(v)}</span></div>`).join('')}</button>`;
  }
  return { head, body, foot: qmTotalsBar(), keep: true };
}

function qmToggleSec(cat) { qmCollapsed.has(cat) ? qmCollapsed.delete(cat) : qmCollapsed.add(cat); qmRender(); }

function qmMove(id, dir) {
  const item = qmFind(id); if (!item) return;
  const same = getSections()[item.cat] || [];
  const k = same.indexOf(item), other = same[k + dir];
  if (!other) return;
  saveHistory();
  const a = quoteItems.indexOf(item), b = quoteItems.indexOf(other);
  [quoteItems[a], quoteItems[b]] = [quoteItems[b], quoteItems[a]];
  renderQuote();
}

// ── 修改工項（下拉面板）──
function qmOpenItem(id) { qmSheetId = id; qmRenderItemSheet(); qmEl('qm-sheet').style.display = ''; }
function qmCloseSheet() { qmSheetId = null; qmEl('qm-sheet').style.display = 'none'; qmEl('qm-sheet-box').innerHTML = ''; }

function qmRenderItemSheet() {
  const it = qmFind(qmSheetId);
  if (!it) { qmCloseSheet(); return; }
  const box = qmEl('qm-sheet-box');
  if (box.dataset.for === String(it.id) && box.contains(document.activeElement) && document.activeElement.tagName !== 'BUTTON') {
    const amt = qmEl('qm-sheet-amt'); if (amt) amt.textContent = qmMoney(it.qty * it.price);
    return;
  }
  const db = dbItems.find(d => d['工項名稱'] === it.name);
  const ref = db ? `參考 ${qmMoney(db['參考單價'])}` : '';
  const range = it.minPrice !== it.maxPrice ? `範圍 ${qmMoney(it.minPrice)}–${Math.round(it.maxPrice).toLocaleString()}` : '';
  const hint = [ref, range].filter(Boolean).join('，');
  box.dataset.for = String(it.id);
  box.innerHTML = `
    <div class="qm-row"><span class="qm-muted">${qmEsc(it.cat)}</span><button type="button" class="qm-x" onclick="qmCloseSheet()" aria-label="關閉">✕</button></div>
    <label class="qm-field"><span>工項名稱</span><input id="qm-i-name" value="${qmEsc(it.name)}" onchange="updateStrField(qmFind(qmSheetId).id,'name',this.value);renderQuote()"></label>
    <div class="qm-two">
      <label class="qm-field qm-grow"><span>數量</span><div class="qm-step"><button type="button" onclick="qmStep(-1)">−</button><input id="qm-i-qty" type="number" inputmode="decimal" value="${qmEsc(it.qty)}" onchange="updateField(qmFind(qmSheetId).id,'qty',this.value)"><button type="button" onclick="qmStep(1)">＋</button></div></label>
      <label class="qm-field qm-unit"><span>單位</span><input id="qm-i-unit" value="${qmEsc(it.unit)}" onchange="updateStrField(qmFind(qmSheetId).id,'unit',this.value);renderQuote()"></label>
    </div>
    <label class="qm-field"><span>單價${hint ? '（' + qmEsc(hint) + '）' : ''}</span><div class="qm-money"><b>$</b><input id="qm-i-price" type="number" inputmode="decimal" value="${qmEsc(it.price)}" onchange="updateField(qmFind(qmSheetId).id,'price',this.value)"></div></label>
    <label class="qm-field"><span>大項</span><select id="qm-i-cat" onchange="updateItemCat(qmFind(qmSheetId).id,this.value)">${buildCatOptions(it.cat)}</select></label>
    <label class="qm-field"><span>備註</span><input id="qm-i-note" value="${qmEsc(it.note || '')}" placeholder="（選填）" onchange="updateStrField(qmFind(qmSheetId).id,'note',this.value);renderQuote()"></label>
    <div class="qm-subtotal"><span>小計</span><b class="qm-mono" id="qm-sheet-amt">${qmMoney(it.qty * it.price)}</b></div>
    <div class="qm-actions"><button type="button" class="qm-btn qm-danger" onclick="qmDeleteItem()">刪除</button><button type="button" class="qm-btn qm-primary qm-wide" onclick="qmCloseSheet()">完成</button></div>`;
}

function qmStep(d) {
  const it = qmFind(qmSheetId); if (!it) return;
  const next = Math.max(0, Math.round(((Number(it.qty) || 0) + d) * 100) / 100);
  updateField(it.id, 'qty', next);
  const q = qmEl('qm-i-qty'); if (q) q.value = next;
}
function qmDeleteItem() {
  const it = qmFind(qmSheetId); if (!it) return;
  if (!confirm(`刪除「${it.name}」？（可以按 ↶ 復原）`)) return;
  qmCloseSheet();
  removeItem(it.id);
}

// ── 自訂工項 ──
function qmOpenCustom() {
  qmSheetId = null;
  const box = qmEl('qm-sheet-box');
  box.dataset.for = '';
  box.innerHTML = `
    <div class="qm-row"><b>自訂工項</b><button type="button" class="qm-x" onclick="qmCloseSheet()" aria-label="關閉">✕</button></div>
    <label class="qm-field"><span>工項名稱</span><input id="qm-c-name" placeholder="例如：現場保護工程"></label>
    <div class="qm-two"><label class="qm-field qm-unit"><span>單位</span><input id="qm-c-unit" placeholder="式"></label><label class="qm-field qm-grow"><span>單價</span><div class="qm-money"><b>$</b><input id="qm-c-price" type="number" inputmode="decimal" placeholder="0"></div></label></div>
    <label class="qm-field"><span>大項</span><select id="qm-c-cat">${getAllCatOrder().map(s => `<option value="${qmEsc(s)}">${qmEsc(s)}</option>`).join('')}</select></label>
    <div class="qm-hint">新的工項也會加進工項資料庫，下次可以直接搜尋。</div>
    <div class="qm-actions"><button type="button" class="qm-btn qm-primary qm-wide" onclick="qmAddCustom()">加入報價單</button></div>`;
  qmEl('qm-sheet').style.display = '';
}
function qmAddCustom() {
  const name = qmVal('qm-c-name').trim();
  if (!name) { alert('請輸入工項名稱'); return; }
  qmEl('customName').value = name;
  qmEl('customUnit').value = qmVal('qm-c-unit');
  qmEl('customPrice').value = qmVal('qm-c-price');
  qmEl('customCat').value = qmVal('qm-c-cat');
  qmCloseSheet();
  addCustomItem();
  qmToast('已加入：' + name);
}

// ── 工項 ──
function qmItemsView() {
  const head = `${qmHeadTop(dbItems.length.toLocaleString() + ' 項')}<div class="qm-title">工項</div>
    <input id="qm-item-q" class="qm-search" type="search" placeholder="搜尋工項名稱…" value="${qmEsc(qmItemQuery)}" oninput="qmItemQuery=this.value;qmRenderItemList()">
    <div class="qm-chips">${getCats().map(c => `<button type="button" class="${c === qmItemCat ? 'on' : ''}" data-cat="${qmEsc(c)}" onclick="qmItemCat=this.dataset.cat;qmRender()">${qmEsc(c === '全部' ? '全部' : qmShortCat(c))}</button>`).join('')}</div>`;
  return { head, body: '<div id="qm-item-list"></div>', foot: qmItemsFoot(), after: () => { qmRenderItemList(); qmEl('qm-head').querySelector('.qm-chips .on')?.scrollIntoView({ inline: 'center', block: 'nearest' }); } };
}
function qmItemsFoot() { return `<div class="qm-dark-bar"><span>報價單 ${quoteItems.length} 項</span><b class="qm-mono">總計 ${qmMoney(getCalc().total)}</b></div>`; }

function qmRenderItemList() {
  const el = qmEl('qm-item-list'); if (!el) return;
  const q = qmItemQuery.trim().toLowerCase();
  let items = dbItems;
  if (qmItemCat !== '全部') items = items.filter(i => i['類別'] === qmItemCat);
  if (q) items = items.filter(i => i['工項名稱'].toLowerCase().includes(q) || i['類別'].includes(q));
  items = [...items].sort((a, b) => (b['出現次數'] || 0) - (a['出現次數'] || 0));
  if (!items.length) { el.innerHTML = '<div class="qm-empty">沒有符合的工項</div>'; return; }
  el.innerHTML = items.slice(0, 120).map(d => {
    const inQuote = quoteItems.find(i => i.name === d['工項名稱'] && i.cat === d['類別']);
    const idx = dbItems.indexOf(d);
    return `<div class="qm-card qm-icard"><div class="qm-grow"><div class="qm-name">${qmEsc(d['工項名稱'])}</div><div class="qm-muted">${qmEsc(d['類別'])}・${qmEsc(d['單位'])}</div></div>
      <span class="qm-mono">${qmMoney(d['參考單價'])}</span>
      <button type="button" class="qm-add${inQuote ? ' qm-in' : ''}" onclick="qmAddDb(${idx})" aria-label="加入">${inQuote ? '×' + qmEsc(inQuote.qty) : '＋'}</button></div>`;
  }).join('') + (items.length > 120 ? `<div class="qm-hint">還有 ${items.length - 120} 項，請輸入關鍵字縮小範圍。</div>` : '<div class="qm-hint">已在報價單裡的工項顯示數量（×3），點一下數量加 1。</div>');
}

function qmAddDb(idx) {
  const d = dbItems[idx]; if (!d) return;
  const inQuote = quoteItems.find(i => i.name === d['工項名稱'] && i.cat === d['類別']);
  if (inQuote) { updateField(inQuote.id, 'qty', (Number(inQuote.qty) || 0) + 1); qmToast(`${d['工項名稱']} ×${inQuote.qty}`); }
  else { addItem(d); qmToast('已加入：' + d['工項名稱']); }
}

// ── 雲端檔案 ──
function qmDriveView() {
  const head = `${qmHeadTop('宇德報價系統 資料夾')}<div class="qm-title">雲端檔案</div>
    <input id="qm-drive-q" class="qm-search" type="search" placeholder="搜尋報價單名稱…" value="${qmEsc(qmDriveQuery)}" oninput="qmDriveQuery=this.value;qmRenderDriveList()">`;
  const connected = typeof driveAccessToken !== 'undefined' && !!driveAccessToken;
  const cur = currentDriveFileId ? (driveFilesCache.find(f => f.id === currentDriveFileId)?.name || qmVal('projName')) : '';
  let body = `<div class="qm-actions"><button type="button" class="qm-btn qm-primary qm-wide" onclick="saveQuoteToDrive()">存到雲端</button><button type="button" class="qm-btn qm-outline qm-wide" onclick="qmSaveAs()">另存新檔</button></div>
    <div class="qm-muted">${cur ? `目前開啟：${qmEsc(cur)}${lastFolderModifiedTime ? '・最後儲存 ' + qmEsc(qmTime(lastFolderModifiedTime)) : ''}` : '目前的報價單還沒存到雲端。'}</div>`;
  body += connected ? '<div id="qm-drive-list"></div>' : `<div class="qm-empty">要先連線公司 Google 雲端硬碟才能看到報價清單。<br><button type="button" class="qm-btn qm-soft" onclick="openDriveQuotes()">連線雲端硬碟</button></div>`;
  return { head, body, after: qmRenderDriveList };
}
function qmTime(iso) { const d = new Date(iso); return isNaN(d) ? '' : `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }

function qmRenderDriveList() {
  const el = qmEl('qm-drive-list'); if (!el) return;
  const q = qmDriveQuery.trim().toLowerCase();
  const files = q ? driveFilesCache.filter(f => f.name.toLowerCase().includes(q)) : driveFilesCache;
  if (!files.length) { el.innerHTML = `<div class="qm-empty">${q ? '沒有符合的檔案' : '資料夾裡還沒有報價單'}</div>`; return; }
  el.innerHTML = files.slice(0, 30).map(f => `<div class="qm-card qm-fcard${f.id === currentDriveFileId ? ' qm-current' : ''}">
      <div class="qm-row"><span class="qm-name">${qmEsc(f.name.replace(/^宇德報價_/, '').replace(/\.json$/, ''))}</span><span class="qm-muted">${qmEsc(qmTime(f.modifiedTime))}</span></div>
      <div class="qm-actions"><button type="button" class="qm-btn qm-soft qm-wide" data-id="${qmEsc(f.id)}" onclick="qmDriveOpen(this.dataset.id)">開啟</button><button type="button" class="qm-btn qm-ghost-danger" data-id="${qmEsc(f.id)}" onclick="driveDeleteFile(this.dataset.id).then(()=>qmRender())">刪除</button></div>
    </div>`).join('') + (files.length > 30 ? `<div class="qm-hint">還有 ${files.length - 30} 筆，請輸入關鍵字縮小範圍。</div>` : '');
}

async function qmDriveOpen(id) {
  if (quoteItems.length && !confirm('開啟這份報價？目前畫面上的報價單會被取代（若還沒存到雲端請先存）。')) return;
  await driveLoad(id);
  qmGo('quote');
}

function qmSaveAs() {
  if (!quoteItems.length) { alert('請先加入工項再儲存'); return; }
  if (!confirm('另存成一份新的雲端檔案？原本開啟的那份不會被改動。')) return;
  currentDriveFileId = null;
  lastFolderModifiedTime = null;
  saveQuoteToDrive();
}

// ── 更多 ──
function qmMoreView() {
  const head = `${qmHeadTop(qmEsc(qmUser()))}<div class="qm-title">更多</div>`;
  const body = `
    <div class="qm-label">輸出給客戶（版型和電腦版相同）</div>
    <div class="qm-actions"><button type="button" class="qm-btn qm-primary qm-wide qm-tall" onclick="qmPdf()">輸出 PDF</button><button type="button" class="qm-btn qm-outline qm-wide qm-tall" onclick="exportToExcel()">下載 Excel</button></div>
    <div class="qm-hint">PDF：產生 A4 檔案後可以直接分享到 Line、Email，或存到「檔案」。</div>
    <div class="qm-label">報價單</div>
    <div class="qm-list">
      <button type="button" onclick="qmOpenPage('info')">工程資訊與費用設定<span>›</span></button>
      <button type="button" onclick="qmOpenPage('sections')">大項順序<span>›</span></button>
      <button type="button" onclick="qmOpenPage('remarks')">備註條款<span>${remarksItems.length} 條 ›</span></button>
      <button type="button" class="qm-red" onclick="clearAll()">清除全部工項</button>
    </div>
    <div class="qm-label">工項資料庫</div>
    <div class="qm-list">
      <button type="button" onclick="qmOpenPage('prices')">編輯工項單價<span>›</span></button>
      <button type="button" onclick="qmOpenPage('newitem')">新增工項到資料庫<span>›</span></button>
    </div>
    <div class="qm-actions"><button type="button" class="qm-btn qm-plain qm-wide" onclick="exportJSON()">匯出 JSON</button><button type="button" class="qm-btn qm-plain qm-wide" onclick="importJSON()">匯入 JSON</button></div>
    <div class="qm-actions"><button type="button" class="qm-btn qm-plain qm-wide qm-red" onclick="qmLogout()">登出</button></div>`;
  return { head, body };
}

function qmToday() {
  const d = new Date();
  const v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  qmSet('projDate', v);
  const el = qmEl('qm-f-projDate'); if (el) el.value = v;
}

// PDF. In a browser tab the desktop print (doPrint → 列印／儲存為 PDF). The installed iPhone app ignores
// window.print(), so there the same buildPrintDoc() pages are turned into an A4 PDF file (html2pdf, loaded
// only when needed) and handed to the share sheet (Line, Email, 儲存到檔案).
const QM_HTML2PDF = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
let qmPdfFile = null;
function qmLoadScript(src) {
  return new Promise((resolve, reject) => {
    if (window.html2pdf) return resolve();
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = () => reject(new Error('PDF 模組載入失敗，請確認網路連線'));
    document.head.appendChild(s);
  });
}
function qmPdfFileName() {
  const name = (qmVal('projName') || '未命名工程').trim().replace(/[\\/:*?"<>|]/g, '_');
  const date = qmVal('projDate') || new Date().toISOString().split('T')[0];
  return '宇德報價單_' + name + '_' + date + '.pdf';
}
async function qmPdf() {
  if (!quoteItems.length && !confirm('報價單沒有工項，仍要輸出嗎？')) return;
  if (!qpwaIsStandalone()) { doPrint(); return; }
  const box = qmEl('qm-sheet-box');
  qmSheetId = null; box.dataset.for = '';
  box.innerHTML = '<div class="qm-row"><b>輸出 PDF</b></div><div class="qm-hint">正在產生 PDF（A4，版型和電腦版相同），請稍候…</div>';
  qmEl('qm-sheet').style.display = '';
  // The pages are laid out in a hidden holder; html2pdf copies the inner page (which has no off-screen style).
  const page = document.createElement('div');
  page.style.cssText = 'position:fixed;left:-10000px;top:0;width:186mm';
  const sheet = document.createElement('div');
  sheet.style.cssText = 'width:186mm;background:#fff;color:#000';
  page.appendChild(sheet);
  try {
    await qmLoadScript(QM_HTML2PDF);
    sheet.innerHTML = buildPrintDoc();
    document.body.appendChild(page);
    const fileName = qmPdfFileName();
    const blob = await html2pdf().set({
      margin: [12, 12, 15, 12], filename: fileName,
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: 2, backgroundColor: '#ffffff', useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'], avoid: 'tr' },
    }).from(sheet).outputPdf('blob');
    qmPdfFile = new File([blob], fileName, { type: 'application/pdf' });
    box.innerHTML = `<div class="qm-row"><b>PDF 已產生</b><button type="button" class="qm-x" onclick="qmCloseSheet()" aria-label="關閉">✕</button></div>
      <div class="qm-hint">${qmEsc(fileName)}（${Math.max(1, Math.round(blob.size / 1024))} KB）<br>按「分享」可以傳 Line、Email，或選「儲存到檔案」。</div>
      <div class="qm-actions"><button type="button" class="qm-btn qm-outline qm-wide" onclick="qmPdfDownload()">下載</button><button type="button" class="qm-btn qm-primary qm-wide" onclick="qmPdfShare()">分享</button></div>`;
  } catch (e) {
    box.innerHTML = `<div class="qm-row"><b>輸出 PDF</b><button type="button" class="qm-x" onclick="qmCloseSheet()" aria-label="關閉">✕</button></div><div class="qm-hint">PDF 產生失敗：${qmEsc(e.message || e)}</div>`;
  } finally {
    page.remove();
  }
}
async function qmPdfShare() {
  if (!qmPdfFile) return;
  if (navigator.canShare && navigator.canShare({ files: [qmPdfFile] })) {
    try { await navigator.share({ files: [qmPdfFile], title: qmPdfFile.name }); } catch (e) { if (e.name !== 'AbortError') alert('分享失敗：' + e.message); }
    return;
  }
  qmPdfDownload();
}
function qmPdfDownload() {
  if (!qmPdfFile) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(qmPdfFile); a.download = qmPdfFile.name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}

function qmLogout() {
  if (!confirm('登出報價系統？')) return;
  try { localStorage.removeItem('yutesign_session'); } catch (e) {}
  try { if (window.firebase?.apps?.length) firebase.auth().signOut(); } catch (e) {}
  location.reload();
}

// ── 次頁：工程資訊與費用、備註、大項順序、編輯單價、新增工項 ──
function qmPageView(page) {
  const titles = { info: '工程資訊與費用', remarks: '備註條款', sections: '大項順序', prices: '編輯工項單價', newitem: '新增工項到資料庫' };
  const backTo = page === 'info' && qmTab === 'quote' ? '報價單' : '更多';
  let head = `<button type="button" class="qm-back" onclick="qmBack()">← ${backTo}</button><div class="qm-title">${titles[page]}</div>`;
  let body = '', after = null;
  if (page === 'info') body = qmInfoBody();
  if (page === 'remarks') body = qmRemarksBody();
  if (page === 'sections') body = qmSectionsBody();
  if (page === 'newitem') body = qmNewItemBody();
  if (page === 'prices') {
    head += `<input class="qm-search" type="search" placeholder="搜尋要改單價的工項…" value="${qmEsc(qmPriceQuery)}" oninput="qmPriceQuery=this.value;qmRenderPriceList()">`;
    body = '<div id="qm-price-list"></div>';
    after = qmRenderPriceList;
  }
  return { head, body, after, keep: page === 'sections' || page === 'remarks' };
}

// Writes a desktop input and fires the same handler the desktop control uses.
function qmSet(id, value, then) {
  const el = qmEl(id); if (!el) return;
  el.value = value;
  if (then) then(); else renderQuote();
}

function qmInfoBody() {
  const x = getExtraItems();
  const cleanMode = qmVal('extraCleanMode') || 'unit';
  const designMode = qmVal('extraDesignMode') || 'fixed';
  const inp = (id, label, type = 'text', extra = '') => `<label class="qm-field"><span>${label}</span><input id="qm-f-${id}" type="${type}" value="${qmEsc(qmVal(id))}" ${type === 'number' ? 'inputmode="decimal"' : ''} ${extra} onchange="qmSet('${id}',this.value)"></label>`;
  return `
    ${inp('projName', '工程名稱')}
    ${inp('projClient', '業主')}
    <div class="qm-field"><span>日期</span><div class="qm-two qm-date"><input id="qm-f-projDate" type="date" value="${qmEsc(qmVal('projDate'))}" onchange="qmSet('projDate',this.value)"><button type="button" class="qm-btn qm-soft" onclick="qmToday()">今天</button></div></div>
    ${inp('projAddr', '工程地址')}
    ${inp('projEmail', '負責人 Email', 'email')}
    <div class="qm-label qm-strong">費用設定</div>
    <div class="qm-panel">
      <div class="qm-prow"><span>管理費</span><span class="qm-inline"><input type="number" inputmode="decimal" value="${qmEsc(qmVal('mgmtFee'))}" onchange="qmSet('mgmtFee',this.value)"> %</span></div>
      <div class="qm-prow qm-col"><div class="qm-row"><span>清潔費</span><select onchange="qmSet('extraCleanMode',this.value,()=>{toggleCleanMode();qmRender()})"><option value="unit"${cleanMode === 'unit' ? ' selected' : ''}>坪 × 單價</option><option value="fixed"${cleanMode === 'fixed' ? ' selected' : ''}>1 式固定</option></select></div>
        ${cleanMode === 'unit'
          ? `<span class="qm-inline"><input type="number" inputmode="decimal" value="${qmEsc(qmVal('extraCleanQty'))}" onchange="qmSet('extraCleanQty',this.value,updateClean)"> 坪 × $ <input type="number" inputmode="decimal" value="${qmEsc(qmVal('extraCleanPrice'))}" onchange="qmSet('extraCleanPrice',this.value,updateClean)"></span>`
          : `<span class="qm-inline">$ <input type="number" inputmode="decimal" value="${qmEsc(qmVal('extraCleanFixed'))}" onchange="qmSet('extraCleanFixed',this.value,updateClean)"></span>`}
        <span class="qm-muted">= ${qmMoney(x.clean)}</span></div>
      <div class="qm-prow qm-col"><div class="qm-row"><span>設計製圖費</span><select onchange="qmSet('extraDesignMode',this.value,()=>{toggleDesignMode();renderQuote()})"><option value="fixed"${designMode === 'fixed' ? ' selected' : ''}>固定金額</option><option value="pct"${designMode === 'pct' ? ' selected' : ''}>% 計價</option><option value="unit"${designMode === 'unit' ? ' selected' : ''}>坪 × 單價</option></select></div>
        ${designMode === 'fixed' ? `<span class="qm-inline">$ <input type="number" inputmode="decimal" value="${qmEsc(qmVal('extraDesignFixed'))}" onchange="qmSet('extraDesignFixed',this.value)"></span>`
          : designMode === 'pct' ? `<span class="qm-inline"><input type="number" inputmode="decimal" value="${qmEsc(qmVal('extraDesignPct'))}" onchange="qmSet('extraDesignPct',this.value)"> %</span>`
          : `<span class="qm-inline"><input type="number" inputmode="decimal" value="${qmEsc(qmVal('extraDesignQty'))}" onchange="qmSet('extraDesignQty',this.value)"> 坪 × $ <input type="number" inputmode="decimal" value="${qmEsc(qmVal('extraDesignPrice'))}" onchange="qmSet('extraDesignPrice',this.value)"></span>`}
        <span class="qm-muted">= ${qmMoney(x.design)}</span></div>
      <div class="qm-prow qm-col"><div class="qm-row"><span>自訂費用</span><button type="button" class="qm-btn qm-soft qm-small" onclick="addMiscItem();qmRender()">＋ 新增</button></div>
        ${miscItems.map((m, i) => `<div class="qm-misc"><input value="${qmEsc(m.name || '')}" placeholder="費用名稱" onchange="miscItems[${i}].name=this.value;renderMiscItems();renderQuote()"><input value="${qmEsc(m.unit || '式')}" class="qm-w3" onchange="miscItems[${i}].unit=this.value;renderMiscItems();saveQuoteState()"><input type="number" inputmode="decimal" class="qm-w3" value="${qmEsc(m.qty || 1)}" onchange="miscItems[${i}].qty=parseFloat(this.value)||1;renderMiscItems();renderQuote()">×<input type="number" inputmode="decimal" class="qm-w5" value="${qmEsc(m.price || 0)}" onchange="miscItems[${i}].price=parseFloat(this.value)||0;renderMiscItems();renderQuote()"><button type="button" class="qm-x" onclick="removeMiscItem(${i})" aria-label="刪除">✕</button></div>`).join('')}</div>
      <div class="qm-prow"><span>工程保險費</span><span class="qm-inline">$ <input type="number" inputmode="decimal" value="${qmEsc(qmVal('extraInsurance'))}" onchange="qmSet('extraInsurance',this.value)"></span></div>
      <div class="qm-prow"><span>建議工期</span><span class="qm-inline"><input type="number" inputmode="numeric" value="${qmEsc(projDuration || 0)}" onchange="projDuration=parseInt(this.value)||0;qmSet('projDuration',projDuration,saveQuoteState)"> 天</span></div>
    </div>
    ${qmTotalsBar()}
    <div class="qm-hint">欄位和計算方式與電腦版完全相同，改這裡和改電腦版是同一份報價單。</div>`;
}

function qmRemarksBody() {
  return `<div class="qm-hint">印在報價單最後的備註，每一條一行。</div>
    ${remarksItems.map((r, i) => `<div class="qm-remark"><span>${i + 1}.</span><textarea rows="3" onchange="remarksItems[${i}]=this.value;renderRemarks();saveQuoteState()">${qmEsc(r)}</textarea><button type="button" class="qm-x" onclick="removeRemark(${i});saveQuoteState();qmRender()" aria-label="刪除">✕</button></div>`).join('')}
    <div class="qm-actions"><button type="button" class="qm-btn qm-soft qm-wide" onclick="remarksItems.push('');renderRemarks();qmRender();setTimeout(()=>{const t=[...document.querySelectorAll('.qm-remark textarea')].pop();t&&t.focus()},50)">＋ 新增備註</button></div>`;
}

function qmSectionsBody() {
  const inQuote = new Set(quoteItems.map(i => i.cat));
  const order = customSectionOrder || [];
  return `<div class="qm-hint">調整大項在報價單、PDF 和 Excel 裡的先後順序。</div>
    <div class="qm-panel">${order.map((cat, i) => `<div class="qm-prow"><span class="${inQuote.has(cat) ? '' : 'qm-muted'}">${qmEsc(cat)}${inQuote.has(cat) ? '' : '（空）'}</span>
      <span class="qm-move"><button type="button" ${i === 0 ? 'disabled' : ''} onclick="moveSectionUp(${i});qmRender()" aria-label="上移">▲</button><button type="button" ${i === order.length - 1 ? 'disabled' : ''} onclick="moveSectionDown(${i});qmRender()" aria-label="下移">▼</button>${inQuote.has(cat) ? '' : `<button type="button" onclick="removeCustomSection(${i});qmRender()" aria-label="移除">✕</button>`}</span></div>`).join('')}</div>
    <div class="qm-two"><input id="sectionMgrInputM" class="qm-search qm-grow" placeholder="新增大項名稱"><button type="button" class="qm-btn qm-primary" onclick="qmEl('sectionMgrInput').value=qmVal('sectionMgrInputM');addCustomSection();qmRender()">新增</button></div>`;
}

function qmRenderPriceList() {
  const el = qmEl('qm-price-list'); if (!el) return;
  const q = qmPriceQuery.trim().toLowerCase();
  if (!q) { el.innerHTML = '<div class="qm-empty">輸入工項名稱搜尋，再修改參考單價。改好會立刻存檔。</div>'; return; }
  const items = dbItems.filter(i => i['工項名稱'].toLowerCase().includes(q) || i['類別'].includes(q)).slice(0, 60);
  if (!items.length) { el.innerHTML = '<div class="qm-empty">沒有符合的工項</div>'; return; }
  el.innerHTML = items.map(d => {
    const idx = dbItems.indexOf(d);
    return `<div class="qm-card"><div class="qm-name">${qmEsc(d['工項名稱'])}</div><div class="qm-muted">${qmEsc(d['類別'])}</div>
      <div class="qm-two"><label class="qm-field qm-unit"><span>單位</span><input value="${qmEsc(d['單位'])}" onchange="qmDbSet(${idx},'單位',this.value)"></label><label class="qm-field qm-grow"><span>參考單價</span><div class="qm-money"><b>$</b><input type="number" inputmode="decimal" value="${qmEsc(d['參考單價'])}" onchange="qmDbSet(${idx},'參考單價',parseFloat(this.value)||0)"></div></label></div></div>`;
  }).join('');
}
function qmDbSet(idx, field, val) { updateDbItem(idx, field, val); saveDb(); qmToast('已儲存'); }

function qmNewItemBody() {
  return `<label class="qm-field"><span>工項名稱</span><input id="qm-n-name"></label>
    <div class="qm-two"><label class="qm-field qm-unit"><span>單位</span><input id="qm-n-unit" placeholder="式"></label><label class="qm-field qm-grow"><span>參考單價</span><div class="qm-money"><b>$</b><input id="qm-n-price" type="number" inputmode="decimal"></div></label></div>
    <label class="qm-field"><span>大項</span><select id="qm-n-cat">${getAllCatOrder().map(s => `<option value="${qmEsc(s)}">${qmEsc(s)}</option>`).join('')}</select></label>
    <div class="qm-actions"><button type="button" class="qm-btn qm-primary qm-wide" onclick="qmAddNewDb()">新增到資料庫</button></div>`;
}
function qmAddNewDb() {
  const name = qmVal('qm-n-name').trim();
  if (!name) { alert('請輸入工項名稱'); return; }
  qmEl('newItemName').value = name;
  qmEl('newItemUnit').value = qmVal('qm-n-unit');
  qmEl('newItemPrice').value = qmVal('qm-n-price');
  qmEl('newItemCat').value = qmVal('qm-n-cat');
  addNewItemToDb();
  saveDb();
  qmToast('已新增：' + name);
  qmRender();
}

// ── 同步通知（沿用電腦版的 Firebase 通知）──
function qmSyncDismiss() { syncDismiss(); }

// ── Hooks: re-render the phone screens after the existing functions run ──
(function qmHook() {
  const wrap = (name, after) => {
    const original = window[name];
    if (typeof original !== 'function') return;
    window[name] = function () {
      const out = original.apply(this, arguments);
      if (out && typeof out.then === 'function') return out.finally(after);
      after();
      return out;
    };
  };
  const refresh = () => { if (qmActive()) qmRender(); };
  ['renderQuote', 'renderDriveFiles', 'renderSectionManager'].forEach(n => wrap(n, refresh));
  wrap('showSyncBanner', () => { const b = qmEl('qm-sync'); const src = qmEl('syncBanner')?.querySelector('span'); if (b) { b.querySelector('span').textContent = src ? src.textContent : '同事剛儲存了新版本'; b.style.display = ''; } });
  wrap('syncDismiss', () => { const b = qmEl('qm-sync'); if (b) b.style.display = 'none'; });
  QM_MEDIA.addEventListener('change', qmApply);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', qmApply);
  else qmApply();
})();
