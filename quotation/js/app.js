// QUOTATION REMARKS, GOOGLE DRIVE, FIREBASE SYNC, LOGIN AND START-UP. Extracted verbatim from index.html at main@655fd20 (quotation split).

// ===== 備註管理 =====
function renderRemarks(){
  const list=document.getElementById('remarksList');
  if(!list) return;
  list.innerHTML=remarksItems.map((r,i)=>`
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
      <span style="font-size:11px;color:#999;min-width:16px">${i+1}.</span>
      <input value="${escHtml(r)}" style="flex:1;font-size:12px;border:1px solid #e0ddd5;border-radius:4px;padding:3px 6px"
        onchange="remarksItems[${i}]=this.value">
      <button onclick="removeRemark(${i})" style="font-size:11px;padding:1px 7px;background:#fff3f3;border:1px solid #ffcdd2;border-radius:4px;cursor:pointer;color:#c62828">✕</button>
    </div>`).join('');
  document.getElementById('projDuration').value=projDuration||0;
}
function addRemark(){
  remarksItems.push('');
  renderRemarks();
  // focus最後一個input
  setTimeout(()=>{
    const inputs=document.getElementById('remarksList').querySelectorAll('input');
    if(inputs.length) inputs[inputs.length-1].focus();
  },50);
}
function removeRemark(i){
  remarksItems.splice(i,1);
  renderRemarks();
}

init();
renderRemarks();

// ===== Google Drive 功能 =====
const CLIENT_ID = '239869421522-cqs68t3pnahjbmv9ld1k08b4p79s34k4.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const FOLDER_NAME = '宇德報價系統';
let tokenClient;
let driveAccessToken = null;
const SHARED_FOLDER_ID = '17fGaw38tzYoQ3kPXnMN8bOhCSpjkjqwX';
let driveFolderId = SHARED_FOLDER_ID;
let currentDriveFileId = null;
let lastFolderModifiedTime = null;
let driveFilesCache = [];
let pendingDriveAction = null;

function initGsi(){
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: async (resp) => {
      if(resp.error){ alert('授權失敗：'+resp.error); return; }
      driveAccessToken = resp.access_token;
      const session = JSON.parse(localStorage.getItem('yutesign_session')||'{}');
      await fbSignIn(resp.access_token, session.email).catch(err => console.warn('Firebase 登入失敗', err));
      const action = pendingDriveAction;
      pendingDriveAction = null;
      if(action) await action();
    }
  });
  // 重新整理時不自動要求 Drive token，避免 Google 將靜默授權改成帳號選擇視窗。
  // 只有使用者實際開啟雲端功能時，才由 driveAuth() 要求授權。
}

function driveAuth(action){
  if(!tokenClient){ alert('Google 授權模組尚未載入，請稍候再試'); return; }
  if(driveAccessToken){ action(); return; }
  pendingDriveAction = action;
  tokenClient.requestAccessToken({prompt:''});
}

function quoteDriveFileName(){
  const name=(document.getElementById('projName').value||'未命名工程').trim().replace(/[\\/:*?"<>|]/g,'_');
  const date=document.getElementById('projDate').value||new Date().toISOString().slice(0,10);
  return `宇德報價_${name}_${date}.json`;
}

function buildQuoteJson(){
  return JSON.stringify(Object.assign({version:1,savedAt:new Date().toISOString()},getQuoteData()),null,2);
}

async function uploadQuoteJson(fileName, json){
  if(currentDriveFileId && lastFolderModifiedTime){
    const latest=await driveApi(`https://www.googleapis.com/drive/v3/files/${currentDriveFileId}?fields=modifiedTime&supportsAllDrives=true`);
    if(latest.modifiedTime && latest.modifiedTime!==lastFolderModifiedTime && !confirm('這份報價已被其他人更新。\n若繼續，將覆寫雲端的較新版本，確定嗎？')) return null;
  }
  const boundary='yutesign_'+Date.now().toString(36);
  const metadata=currentDriveFileId ? {name:fileName} : {name:fileName,parents:[driveFolderId],mimeType:'application/json'};
  const body=`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${json}\r\n--${boundary}--`;
  const method=currentDriveFileId?'PATCH':'POST';
  const target=currentDriveFileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${currentDriveFileId}?uploadType=multipart&supportsAllDrives=true&fields=id,name,modifiedTime`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,modifiedTime';
  const saved=await driveApi(target,{method,headers:{'Content-Type':`multipart/related; boundary=${boundary}`},body});
  currentDriveFileId=saved.id;
  lastFolderModifiedTime=saved.modifiedTime||null;
  return saved;
}

function saveQuoteToDrive(){
  if(!quoteItems.length){alert('請先加入工項再儲存');return;}
  driveAuth(async()=>{
    try{
      const saved=await uploadQuoteJson(quoteDriveFileName(),buildQuoteJson());
      if(!saved) return;
      const session=JSON.parse(localStorage.getItem('yutesign_session')||'{}');
      if(session.email) await fbSyncNotify(session.email,saved.name);
      await driveListFiles();
      alert(`✅ 已儲存到公司 Google Drive\n${saved.name}`);
    }catch(err){
      console.error(err);
      alert('雲端儲存失敗：'+err.message);
    }
  });
}

function openDriveQuotes(){
  driveAuth(async()=>{
    try{
      await driveListFiles();
      const box=document.getElementById('driveFileList');
      if(box){ box.style.display='block'; box.scrollIntoView({behavior:'smooth',block:'center'}); }
    }catch(err){
      console.error(err);
      alert('雲端清單載入失敗：'+err.message);
    }
  });
}

async function driveApi(url, options={}){
  const res = await fetch(url, {
    ...options,
    headers: { 'Authorization': 'Bearer ' + driveAccessToken, ...(options.headers||{}) }
  });
  if(!res.ok){ const t=await res.text(); throw new Error(t); }
  if(res.status===204) return null;
  return res.json();
}

async function ensureDriveFolder(){
  const data = await driveApi(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`)}&fields=files(id,name)`);
  if(data.files && data.files.length > 0){
    driveFolderId = data.files[0].id;
  } else {
    const res = await driveApi('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' })
    });
    driveFolderId = res.id;
  }
}


async function driveListFiles(){
  if(!driveAccessToken || !driveFolderId) return;
  const data = await driveApi(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`'${driveFolderId}' in parents and trashed=false`)}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime+desc&supportsAllDrives=true&includeItemsFromAllDrives=true`);
  const files = data.files || [];
  // 初始化資料夾最新時間戳（只在第一次設定，之後由 polling 更新）
  if(!lastFolderModifiedTime && files.length) lastFolderModifiedTime = files[0].modifiedTime;
  driveFilesCache = files;
  renderDriveFiles();
}

function renderDriveFiles(){
  const container = document.getElementById('driveFiles');
  if(!container) return;
  const kw = (document.getElementById('driveFileSearch')?.value || '').trim().toLowerCase();
  const matched = kw ? driveFilesCache.filter(f => f.name.toLowerCase().includes(kw)) : driveFilesCache;
  const files = matched.slice(0,5);
  if(!files.length){ container.innerHTML = `<div style="font-size:12px;color:#999;padding:4px 0">${kw?'沒有符合的檔案':''}</div>`; return; }
  let html = files.map(f => `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
      <span style="font-size:12px;flex:1;color:#333">${escHtml(f.name)}</span>
      <button onclick="driveLoad('${f.id}')" style="font-size:11px;padding:2px 8px;background:#e8f5e9;border:1px solid #a5d6a7;border-radius:4px;cursor:pointer;color:#2e7d32">載入</button>
      <button onclick="driveDeleteFile('${f.id}')" style="font-size:11px;padding:2px 8px;background:#fff3f3;border:1px solid #ffcdd2;border-radius:4px;cursor:pointer;color:#c62828">刪除</button>
    </div>`).join('');
  if(matched.length>5) html += `<div style="font-size:11px;color:#999;padding:2px 0">還有 ${matched.length-5} 筆，請輸入關鍵字縮小範圍</div>`;
  container.innerHTML = html;
}

async function driveLoad(fileId){
  try {
    const [res, meta] = await Promise.all([
      fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: {'Authorization': 'Bearer ' + driveAccessToken}
      }),
      driveApi(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=modifiedTime&supportsAllDrives=true`)
    ]);
    if(!res.ok) throw new Error(await res.text());
    const data = await res.json();
    currentDriveFileId = fileId;
    lastFolderModifiedTime = meta.modifiedTime;
    syncDismiss();
    document.getElementById('projName').value = data.projName||'';
    document.getElementById('projEmail').value = data.projEmail||'shower.li@yutesign.com';
    document.getElementById('projClient').value = data.projClient||'';
    document.getElementById('projAddr').value = data.projAddr||'';
    document.getElementById('projDate').value = data.projDate||'';
    document.getElementById('mgmtFee').value = data.mgmtFee||5;
    quoteItems = (data.quoteItems||[]).map(item=>({...item,id:item.id||(Date.now()+Math.random())}));
    catNotes = data.catNotes||{};
    if(data.remarksItems) remarksItems=[...data.remarksItems];
    projDuration=data.projDuration||0;
    renderRemarks();
    if(document.getElementById('extraCleanMode')){document.getElementById('extraCleanMode').value=data.extraCleanMode||'unit';toggleCleanMode();}
    if(document.getElementById('extraCleanQty')) document.getElementById('extraCleanQty').value=data.extraCleanQty||0;
    if(document.getElementById('extraCleanPrice')) document.getElementById('extraCleanPrice').value=data.extraCleanPrice||700;
    if(document.getElementById('extraCleanFixed')) document.getElementById('extraCleanFixed').value=data.extraCleanFixed||0;
    if(document.getElementById('extraDesignMode')){document.getElementById('extraDesignMode').value=data.extraDesignMode||'fixed';toggleDesignMode();}
    if(document.getElementById('extraDesignFixed')) document.getElementById('extraDesignFixed').value=data.extraDesignFixed||0;
    if(document.getElementById('extraDesignPct')) document.getElementById('extraDesignPct').value=data.extraDesignPct||0;
    if(document.getElementById('extraDesignQty')) document.getElementById('extraDesignQty').value=data.extraDesignQty||0;
    if(document.getElementById('extraDesignPrice')) document.getElementById('extraDesignPrice').value=data.extraDesignPrice||0;
    if(document.getElementById('extraInsurance')) document.getElementById('extraInsurance').value=data.extraInsurance||0;
    miscItems=data.miscItems||[];
    renderMiscItems();
    customSectionOrder=data.customSectionOrder||null;
    reviewedIds=new Set(data.reviewedIds||[]);
    renderQuote();
    alert('✅ 報價已載入');
  } catch(e){ alert('載入失敗：'+e.message); }
}

async function driveDeleteFile(fileId){
  if(!confirm('確定要刪除這份報價嗎？')) return;
  await driveApi(`https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true`, { method: 'DELETE' });
  if(currentDriveFileId === fileId){ currentDriveFileId = null; }
  await driveListFiles();
}

// ===== Firebase 即時同步通知 =====
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAz-MeKorzgp-_EjiMWvugiz_JFDjk4NIs",
  authDomain: "yutesign-sync.firebaseapp.com",
  databaseURL: "https://yutesign-sync-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "yutesign-sync",
  storageBucket: "yutesign-sync.firebasestorage.app",
  messagingSenderId: "709833651829",
  appId: "1:709833651829:web:6d52a99ceefc1915caaa3c"
};
let fbDb = null;
let fbMyEmail = null;
let fbListening = false;

function initFirebase(){
  if(fbDb) return;
  firebase.initializeApp(FIREBASE_CONFIG);
  fbDb = firebase.database();
}

async function fbSignIn(accessToken, expectedEmail){
  initFirebase();
  if(!accessToken) throw new Error('缺少 Google access token');
  const credential = firebase.auth.GoogleAuthProvider.credential(null, accessToken);
  const result = await firebase.auth().signInWithCredential(credential);
  const email = result.user && result.user.email;
  if(!email || !email.endsWith('@yutesign.com') || (expectedEmail && email !== expectedEmail)){
    await firebase.auth().signOut();
    throw new Error('Firebase 帳號不符合公司網域');
  }
  fbSyncListen(email);
  return result.user;
}

async function fbSyncNotify(email, fileName){
  if(!fbDb || !firebase.auth().currentUser) return;
  try {
    await fbDb.ref('sync/lastSave').set({ who: email, fileName, at: Date.now() });
  } catch(err) {
    console.warn('Firebase 同步通知失敗', err);
  }
}

function fbSyncListen(email){
  if(!fbDb || !firebase.auth().currentUser) return;
  fbMyEmail = email;
  const ref = fbDb.ref('sync/lastSave');
  if(fbListening) ref.off();
  fbListening = true;
  ref.on('value', snap => {
    const d = snap.val();
    if(!d) return;
    if(d.who === fbMyEmail) return;
    if(Date.now() - d.at > 5 * 60 * 1000) return; // 超過 5 分鐘的舊通知不顯示
    const who = d.who.replace('@yutesign.com', '');
    showSyncBanner(`${who} 剛存了「${d.fileName}」`);
  }, err => console.warn('Firebase 同步監聽失敗', err));
}

function showSyncBanner(msg){
  const b = document.getElementById('syncBanner');
  const sp = b.querySelector('span');
  if(sp) sp.textContent = '⚠️ ' + msg;
  b.style.display = 'flex';
}

function syncDismiss(){
  document.getElementById('syncBanner').style.display = 'none';
}


function getQuoteData(){
  return {
    projName: document.getElementById('projName').value,
    projEmail: document.getElementById('projEmail').value||'shower.li@yutesign.com',
    projClient: document.getElementById('projClient').value,
    projAddr: document.getElementById('projAddr').value,
    projDate: document.getElementById('projDate').value,
    mgmtFee: document.getElementById('mgmtFee').value,
    quoteItems,
    catNotes,
    remarksItems: [...remarksItems],
    projDuration: parseInt(document.getElementById('projDuration')?.value)||0,
    extraCleanMode: document.getElementById('extraCleanMode')?.value||'unit',
    extraCleanQty: parseFloat(document.getElementById('extraCleanQty')?.value)||0,
    extraCleanPrice: parseFloat(document.getElementById('extraCleanPrice')?.value)||700,
    extraCleanFixed: parseFloat(document.getElementById('extraCleanFixed')?.value)||0,
    extraDesignMode: document.getElementById('extraDesignMode')?.value||'fixed',
    extraDesignFixed: parseFloat(document.getElementById('extraDesignFixed')?.value)||0,
    extraDesignPct: parseFloat(document.getElementById('extraDesignPct')?.value)||0,
    extraDesignQty: parseFloat(document.getElementById('extraDesignQty')?.value)||0,
    extraDesignPrice: parseFloat(document.getElementById('extraDesignPrice')?.value)||0,
    extraInsurance: parseFloat(document.getElementById('extraInsurance')?.value)||0,
    miscItems: [...miscItems],
    customSectionOrder: customSectionOrder ? [...customSectionOrder] : null,
    reviewedIds: [...reviewedIds]
  };
}

initFirebase();
loadGsi();

// ===== 登入驗證 =====
const ALLOWED_DOMAIN = 'yutesign.com';
const SESSION_HOURS = 4; // 重開頁面幾小時內免重新登入
let loginTokenClient;

function startLogin(){
  if(!loginTokenClient){ alert('Google 模組尚未載入，請稍候再試'); return; }
  document.getElementById('btnLogin').textContent = '登入中...';
  document.getElementById('btnLogin').disabled = true;
  loginTokenClient.requestAccessToken({prompt: 'select_account'});
}

function initLoginGsi(){
  loginTokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: 'https://www.googleapis.com/auth/userinfo.email ' + SCOPES,
    callback: async (resp) => {
      if(resp.error){
        document.getElementById('btnLogin').textContent = '使用公司帳號登入';
        document.getElementById('btnLogin').disabled = false;
        showLoginError('授權失敗，請再試一次');
        return;
      }
      // 取得使用者email
      try {
        const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: {'Authorization': 'Bearer ' + resp.access_token}
        });
        const user = await res.json();
        if(!user.email || !user.email.endsWith('@' + ALLOWED_DOMAIN)){
          showLoginError('此帳號無使用權限，請使用 @yutesign.com 帳號');
          document.getElementById('btnLogin').textContent = '使用公司帳號登入';
          document.getElementById('btnLogin').disabled = false;
          google.accounts.oauth2.revoke(resp.access_token);
          return;
        }
        // 驗證通過，進入系統
        driveAccessToken = resp.access_token;
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainApp').style.display = '';
        localStorage.setItem('yutesign_session', JSON.stringify({email: user.email, loginTime: Date.now()}));
        await fbSignIn(resp.access_token, user.email).catch(err => console.warn('Firebase 登入失敗', err));
        await driveListFiles();
      } catch(e){
        showLoginError('驗證失敗：' + e.message);
        document.getElementById('btnLogin').textContent = '使用公司帳號登入';
        document.getElementById('btnLogin').disabled = false;
      }
    }
  });
}

function showLoginError(msg){
  const el = document.getElementById('loginError');
  el.textContent = msg;
  el.style.display = '';
}

// 覆寫loadGsi，同時初始化登入用tokenClient
function loadGsi(){
  const s = document.createElement('script');
  s.src = 'https://accounts.google.com/gsi/client';
  s.onload = () => {
    initGsi();
    initLoginGsi();
  };
  document.head.appendChild(s);
}
