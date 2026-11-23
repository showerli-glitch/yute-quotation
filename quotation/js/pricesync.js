// QUOTATION SHARED ITEM PRICES (new code, not extracted from the baseline). The item database (工項、單位、單價、
// 類別) used to live only in each browser's localStorage, so a price changed on one computer never reached the
// others. Now every change is also written to Firebase as one record per item under quotation/yutesign/items:
// only items that differ from the built-in list (DEFAULT_ITEMS) are stored, each with who changed it and when.
// Everyone sees changes live; localStorage stays as the offline copy. Deleting an item is for the owner only.
// A device's own new items are never discarded when it first connects; they are uploaded without asking.
// Hooks only: saveDb, deleteDbItem, updateDbItem and renderEditList are wrapped; their own code is unchanged.
const QPS_PATH = 'quotation/yutesign/items';
const QPS_OWNER = 'shower.li@yutesign.com';
const QPS_CACHE_KEY = 'yutesign_quote_price_cloud';      // last cloud records (offline start)
const QPS_MIGRATED_KEY = 'yutesign_quote_price_migrated'; // this device already offered its old local changes
const QPS_PENDING_KEY = 'yutesign_quote_price_pending';   // saved while offline / not yet uploaded
let qpsRecords = null;        // cloud records { key: record } once read; null = not connected yet
let qpsBase = null;           // item list built from the cloud records (what "unchanged" means)
let qpsRenames = new Map();   // old name → new name, renamed in the desktop editor since the last save
let qpsRemoteWaiting = null;  // cloud update held back while the desktop editor has unsaved changes
let qpsListening = false;
let qpsFirstRemote = true;

// Firebase keys may not contain . $ # [ ] / and are limited to 768 bytes; very long names use a hash instead
// (the record keeps the full name in n, and every lookup goes through this same function).
function qpsKey(name) {
  const enc = encodeURIComponent(String(name)).replace(/\./g, '%2E');
  if (enc.length <= 700) return enc;
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (const ch of String(name)) { const c = ch.codePointAt(0); h1 = Math.imul(h1 ^ c, 16777619) >>> 0; h2 = Math.imul(h2 ^ c, 2246822519) >>> 0; }
  return enc.slice(0, 600) + '~' + h1.toString(16) + h2.toString(16);
}
function qpsEmail() {
  try { const u = window.firebase?.apps?.length && firebase.auth().currentUser; if (u?.email) return u.email; } catch (e) {}
  try { return JSON.parse(localStorage.getItem('yutesign_session') || '{}').email || ''; } catch (e) { return ''; }
}
function qpsIsOwner() { return qpsEmail() === QPS_OWNER; }
function qpsDefaults() { return DEFAULT_ITEMS.map(item => ({ ...item, 類別: mapCat(item['類別']) })); }
const qpsSig = i => JSON.stringify([i['類別'] || '', i['單位'] || '', Number(i['參考單價']) || 0, Number(i['最低單價']) || 0, Number(i['最高單價']) || 0]);

function qpsRecordOf(item, by) {
  const r = { n: item['工項名稱'], c: item['類別'] || '', u: item['單位'] || '', p: Number(item['參考單價']) || 0, f: Number(item['出現次數']) || 0, by, at: Date.now() };
  if (Number.isFinite(Number(item['最低單價'])) && item['最低單價'] !== undefined && item['最低單價'] !== '') r.lo = Number(item['最低單價']);
  if (Number.isFinite(Number(item['最高單價'])) && item['最高單價'] !== undefined && item['最高單價'] !== '') r.hi = Number(item['最高單價']);
  return r;
}

// Built-in list + cloud records (oldest first, so the latest change wins); new items go to the top like addNewItemToDb.
function qpsBuild(records) {
  const map = new Map();
  const order = [];
  qpsDefaults().forEach(it => { map.set(it['工項名稱'], it); order.push(it['工項名稱']); });
  Object.values(records || {}).filter(r => r && r.n).sort((a, b) => (a.at || 0) - (b.at || 0)).forEach(r => {
    if (r.del) { map.delete(r.n); return; }
    const old = map.get(r.n);
    const it = { '類別': r.c, '工項名稱': r.n, '單位': r.u, '參考單價': r.p, '出現次數': r.f ?? old?.['出現次數'] ?? 1 };
    if (r.lo !== undefined) it['最低單價'] = r.lo; else if (old && old['最低單價'] !== undefined) it['最低單價'] = old['最低單價'];
    if (r.hi !== undefined) it['最高單價'] = r.hi; else if (old && old['最高單價'] !== undefined) it['最高單價'] = old['最高單價'];
    if (!map.has(r.n) && !order.includes(r.n)) order.unshift(r.n);
    map.set(r.n, it);
  });
  return order.filter(n => map.has(n)).map(n => map.get(n));
}

function qpsDiff(base, current) {
  const b = new Map(base.map(i => [i['工項名稱'], i]));
  const c = new Map(current.map(i => [i['工項名稱'], i]));
  return {
    changed: current.filter(i => !b.has(i['工項名稱']) || qpsSig(b.get(i['工項名稱'])) !== qpsSig(i)),
    deleted: [...b.keys()].filter(n => !c.has(n)),
  };
}

function qpsWriteLocal(items) {
  try {
    localStorage.setItem('yutesign_db', JSON.stringify(items));
    localStorage.setItem('yutesign_db_ver', DB_VERSION);
  } catch (e) {}
}

function qpsRefreshViews() {
  try { renderCatTabs(); renderLeftPanel(); refreshCatDropdowns(); } catch (e) {}
  if (typeof qmRender === 'function' && typeof qmActive === 'function' && qmActive()) qmRender();
}

async function qpsUpload(changed, deleted, renames = new Map()) {
  if (!fbDb || !qpsEmail()) throw new Error('尚未連線雲端');
  const by = qpsEmail();
  const update = {};
  changed.forEach(item => { update[qpsKey(item['工項名稱'])] = qpsRecordOf(item, by); });
  deleted.forEach(name => {
    const rec = { n: name, del: true, by, at: Date.now() };
    if (renames.has(name)) rec.moved = renames.get(name);
    update[qpsKey(name)] = rec;
  });
  if (!Object.keys(update).length) return 0;
  await fbDb.ref(QPS_PATH).update(update);
  return Object.keys(update).length;
}

// Upload what this device changed relative to the cloud. Non-owners cannot delete: those items are put back.
async function qpsPushLocalChanges({ silent } = {}) {
  if (!qpsBase) { try { localStorage.setItem(QPS_PENDING_KEY, '1'); } catch (e) {} return; }
  const diff = qpsDiff(qpsBase, dbItems);
  const renames = qpsRenames;
  let blocked = [];
  if (!qpsIsOwner()) {
    blocked = diff.deleted.filter(n => !renames.has(n));
    diff.deleted = diff.deleted.filter(n => renames.has(n));
    if (blocked.length) {
      const back = qpsBase.filter(i => blocked.includes(i['工項名稱']));
      dbItems.push(...back);
      qpsWriteLocal(dbItems);
      qpsRefreshViews();
      alert('只有李鎮宇可以刪除工項，以下工項已還原：\n' + blocked.slice(0, 8).join('\n') + (blocked.length > 8 ? `\n…等 ${blocked.length} 項` : ''));
    }
  }
  try {
    const n = await qpsUpload(diff.changed, diff.deleted, renames);
    qpsRenames = new Map();
    try { localStorage.removeItem(QPS_PENDING_KEY); } catch (e) {}
    if (n && !silent && typeof qmToast === 'function' && typeof qmActive === 'function' && qmActive()) qmToast('已同步到雲端');
  } catch (e) {
    try { localStorage.setItem(QPS_PENDING_KEY, '1'); } catch (err) {}
    console.warn('工項單價同步失敗', e);
    if (!silent) alert('工項已存在這台裝置，但同步到雲端失敗（' + (e.message || e) + '）。連上網路後重新開啟報價系統會再上傳。');
  }
}

function qpsApply(records) {
  qpsRecords = records || {};
  try { localStorage.setItem(QPS_CACHE_KEY, JSON.stringify(qpsRecords)); } catch (e) {}
  const built = qpsBuild(qpsRecords);
  const first = qpsFirstRemote;
  qpsFirstRemote = false;
  // Changes made on this device before it was connected: offer them once (old local edits), or upload directly
  // (edits saved while offline).
  let pending = false, migrated = true;
  try { pending = localStorage.getItem(QPS_PENDING_KEY) === '1'; migrated = localStorage.getItem(QPS_MIGRATED_KEY) === '1'; } catch (e) {}
  // Every start, not only the first: anything this device has that the last cloud copy it saw did not (its own
  // new items, edits saved offline) is uploaded, so nothing local is overwritten by the cloud. Only a device that
  // never synced before (old local edits compared with the built-in list) is asked about different prices.
  if (first) {
    // What this device itself changed: against the built-in list for old local edits, against the last cloud
    // copy for edits saved offline. Only items that still differ from the cloud are uploaded, item by item, so a
    // device never overwrites someone else's newer price with the old built-in one.
    const refIsCloud = !!((pending || migrated) && qpsBase);
    const ref = refIsCloud ? qpsBase : qpsDefaults();
    const ask = !migrated && !pending;
    const diff = qpsDiff(ref, dbItems);
    const cloud = new Map(built.map(i => [i['工項名稱'], i]));
    // Items that exist only on this device (a colleague's own new items) are never thrown away: they are
    // uploaded without asking. Only a different price/unit/category for an item the cloud already has is asked.
    const added = diff.changed.filter(i => !cloud.has(i['工項名稱']));
    const modified = diff.changed.filter(i => cloud.has(i['工項名稱']) && qpsSig(cloud.get(i['工項名稱'])) !== qpsSig(i));
    // Compared with the last cloud copy, an item someone else has changed since then keeps their newer version.
    if (refIsCloud) {
      const refMap = new Map(ref.map(i => [i['工項名稱'], i]));
      for (let k = modified.length - 1; k >= 0; k--) {
        const n = modified[k]['工項名稱'];
        if (refMap.has(n) && qpsSig(cloud.get(n)) !== qpsSig(refMap.get(n))) modified.splice(k, 1);
      }
    }
    const deleted = (qpsIsOwner() ? diff.deleted : []).filter(n => cloud.has(n));
    const askCount = modified.length + deleted.length;
    try { localStorage.setItem(QPS_MIGRATED_KEY, '1'); } catch (e) {}
    if (added.length || askCount) {
      let take = [];
      if (askCount) {
        const sample = [...modified.map(i => i['工項名稱']), ...deleted.map(n => n + '（刪除）')].slice(0, 5).join('、');
        const keepNote = added.length ? `\n\n這台新建的 ${added.length} 項工項不論選哪個都會保留並上傳。` : '';
        take = (!ask || confirm(`這台裝置有 ${askCount} 項工項的單價或內容和雲端共用的版本不同（例如：${sample}）。\n\n要上傳這台的版本，讓大家共用嗎？\n按「取消」則這幾項改用雲端版本。${keepNote}`)) ? 'all' : 'none';
      }
      const upChanged = take === 'all' ? [...added, ...modified] : added;
      const upDeleted = take === 'all' ? deleted : [];
      const by = qpsEmail();
      const local = {};
      upChanged.forEach(i => { local[qpsKey(i['工項名稱'])] = qpsRecordOf(i, by); });
      upDeleted.forEach(n => { local[qpsKey(n)] = { n, del: true, by, at: Date.now() }; });
      qpsUpload(upChanged, upDeleted).then(n => {
        try { localStorage.removeItem(QPS_PENDING_KEY); } catch (e) {}
        if (n && typeof qmToast === 'function') try { qmToast('已上傳 ' + n + ' 項工項'); } catch (e) {}
      }).catch(e => {
        try { localStorage.setItem(QPS_PENDING_KEY, '1'); } catch (err) {}
        console.warn('工項單價上傳失敗', e);
      });
      qpsBase = built;
      dbItems = qpsBuild({ ...qpsRecords, ...local }).map(i => ({ ...i }));
      qpsWriteLocal(dbItems);
      qpsRefreshViews();
      return;
    }
    try { localStorage.removeItem(QPS_PENDING_KEY); } catch (e) {}
  }
  if (typeof dbModified !== 'undefined' && dbModified) { qpsRemoteWaiting = records; return; }
  // Three-way merge with what this device has not uploaded yet (e.g. a save while offline): items only this
  // device has are kept, and its own edits are kept unless someone else changed the same item in the cloud.
  const prevBase = qpsBase;
  let next = built.map(i => ({ ...i }));
  if (prevBase && !first) {
    const prev = new Map(prevBase.map(i => [i['工項名稱'], i]));
    const now = new Map(next.map(i => [i['工項名稱'], i]));
    const keepNew = [];
    let unsynced = 0;
    qpsDiff(prevBase, dbItems).changed.forEach(i => {
      const name = i['工項名稱'];
      if (!now.has(name)) {
        if (prev.has(name)) return; // removed in the cloud by the owner after this device last synced
        keepNew.push({ ...i }); unsynced++; return;
      }
      if (qpsSig(now.get(name)) === qpsSig(prev.get(name) || {})) { now.set(name, { ...i }); unsynced++; }
    });
    next = [...keepNew, ...next.map(i => now.get(i['工項名稱']))];
    if (unsynced) { try { localStorage.setItem(QPS_PENDING_KEY, '1'); } catch (e) {} }
  }
  qpsBase = built;
  dbItems = next;
  qpsWriteLocal(dbItems);
  qpsRefreshViews();
}

function qpsStart() {
  if (qpsListening || !fbDb) return;
  try { if (!firebase.auth().currentUser) return; } catch (e) { return; }
  qpsListening = true;
  fbDb.ref(QPS_PATH).on('value', snap => qpsApply(snap.val() || {}), err => { qpsListening = false; console.warn('工項單價讀取失敗', err); });
}

// 「最後由誰修改」: from the cloud record of that item (items never changed show nothing).
function qpsMeta(name) {
  const r = qpsRecords && qpsRecords[qpsKey(name)];
  if (!r || r.del || !r.by) return null;
  return { by: String(r.by).replace(/@yutesign\.com$/, ''), at: r.at };
}
function qpsMetaText(name) {
  const m = qpsMeta(name);
  if (!m) return '';
  const d = new Date(m.at);
  const when = isNaN(d) ? '' : `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `最後修改：${m.by} ${when}`;
}

(function qpsHook() {
  const wrap = (name, make) => { const original = window[name]; if (typeof original === 'function') window[name] = make(original); };
  wrap('saveDb', original => function () {
    const out = original.apply(this, arguments);
    if (qpsRecords !== null || qpsBase) qpsPushLocalChanges();
    else { try { localStorage.setItem(QPS_PENDING_KEY, '1'); } catch (e) {} }
    if (qpsRemoteWaiting) { const r = qpsRemoteWaiting; qpsRemoteWaiting = null; setTimeout(() => qpsApply(r), 0); }
    return out;
  });
  wrap('deleteDbItem', original => function (idx) {
    if (!qpsIsOwner()) { alert('只有李鎮宇可以刪除工項。'); return; }
    return original.apply(this, arguments);
  });
  wrap('updateDbItem', original => function (idx, field, val) {
    if (field === '工項名稱' && dbItems[idx]) {
      const oldName = dbItems[idx]['工項名稱'];
      if (oldName !== val) {
        const origin = [...qpsRenames.entries()].find(([, to]) => to === oldName)?.[0] || oldName;
        qpsRenames.set(origin, val);
      }
    }
    return original.apply(this, arguments);
  });
  wrap('renderEditList', original => function () {
    const out = original.apply(this, arguments);
    document.querySelectorAll('#itemList .edit-row').forEach(row => {
      const idx = Number(String(row.id).replace('erow_', ''));
      const text = dbItems[idx] ? qpsMetaText(dbItems[idx]['工項名稱']) : '';
      if (!text) return;
      const tag = document.createElement('div');
      tag.className = 'qps-meta';
      tag.style.cssText = 'font-size:10px;color:#999;margin-top:2px';
      tag.textContent = text;
      row.appendChild(tag);
    });
    return out;
  });
  // Offline start: show the last cloud prices right away; the live listener replaces them once connected.
  try {
    const cached = JSON.parse(localStorage.getItem(QPS_CACHE_KEY) || 'null');
    // Also when edits are waiting to upload: the cached copy is the base they are compared with, so only this
    // device's own edits go up and a newer price from someone else is not overwritten with a stale one.
    if (cached && localStorage.getItem(QPS_MIGRATED_KEY) === '1') {
      qpsRecords = cached;
      qpsBase = qpsBuild(cached);
    }
  } catch (e) {}
  const begin = () => { try { firebase.auth().onAuthStateChanged(u => { if (u && /@yutesign\.com$/.test(u.email || '')) qpsStart(); }); } catch (e) {} };
  if (window.firebase?.apps?.length) begin(); else setTimeout(begin, 0);
})();
