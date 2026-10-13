// QUOTATION CATALOG, STATE AND ITEM DATABASE. Extracted verbatim from index.html at main@655fd20 (quotation split).

const SECTION_ORDER=["假設及拆運工程", "土木工程", "水電／照明工程", "防水工程", "輕隔間及輕鋼架天花工程", "泥作及貼磚工程", "木作及系統櫃工程", "門扇工程", "鋁窗工程", "鐵件及金屬工程", "油漆工程", "地坪工程", "玻璃及貼膜工程", "廣告及招牌工程", "窗簾工程", "空調工程", "石材工程", "人造石工程", "壁紙工程", "裱布／繃皮工程", "景觀工程", "矽利康工程", "衛浴設備工程", "廚具設備工程", "燈具、設備及其他工程", "施工區域完工後清潔工程", "設計製圖費", "監工管理費", "工程保險費"];
const CAT_MAP={
  '拆運保護清潔':'假設及拆運工程','搬運機具':'假設及拆運工程',
  '水電工程':'水電／照明工程','輕隔間天花':'輕隔間及輕鋼架天花工程',
  '泥作貼磚':'泥作及貼磚工程','木作工程':'木作及系統櫃工程',
  '門窗金屬':'門扇工程','玻璃貼膜':'玻璃及貼膜工程',
  '金屬及鋁窗工程':'鋁窗工程','鋁窗工程':'鋁窗工程',
  '鐵件工程':'鐵件及金屬工程','鐵件及金屬工程':'鐵件及金屬工程',
  '油漆壁紙':'油漆工程','地坪工程':'地坪工程','空調工程':'空調工程',
  '窗簾工程':'窗簾工程','衛浴設備':'衛浴設備工程',
  '廚具設備':'廚具設備工程','廚具工程':'廚具設備工程',
  '燈具設備':'燈具、設備及其他工程','石材工程':'石材工程','人造石工程':'人造石工程',
  '壁紙工程':'壁紙工程','裱布繃皮工程':'裱布／繃皮工程',
  '景觀工程':'景觀工程','矽利康工程':'矽利康工程',
  '土木工程':'土木工程','防水工程':'防水工程',
  '其他':'燈具、設備及其他工程',
};
const NUM_ZH=['一','二','三','四','五','六','七','八','九','十',
  '十一','十二','十三','十四','十五','十六','十七','十八','十九','二十'];

// State
let mode='quote';  // 'quote' | 'edit'
const DB_VERSION='2026050505';
let dbItems=[];    // working copy of item database
let quoteItems=[];
let undoHistory=[];let redoHistory=[];
let selectedRowIds=new Set();
let reviewedIds=new Set();
let customSectionOrder=null; // per-quote 大項排序，null = 使用 SECTION_ORDER 預設
let catNotes={}; // 大表各類別備註
let remarksItems=[
  '本估價不含建築物主管機關室內裝修送審。',
  '本報價單有效期限為一個月（自報價日起算）。',
  '本工程內容以報價明細表為主，圖面僅供參考，無法現場勘查或需求不清楚者，其實際施作項目及數量依現場環境及尺寸修正。',
  '本工程工地管理不含業主自行分包之廠商管理。'
]; // 可自訂備註
let projDuration=0; // 建議工期（天）
let miscItems=[]; // 自訂雜項費用（不計入管理費/設計費基礎）
let activeCat='全部';
let dbModified=false;

function escHtml(value){
  return String(value == null ? '' : value)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function jsonForHtmlAttr(value){
  return JSON.stringify(value).replace(/&/g,'\\u0026').replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/"/g,'&quot;');
}

// ── Init ──
function init(){
  initLogo();
  document.getElementById('projDate').value=new Date().toISOString().split('T')[0];
  loadDb();
  loadQuoteState();
  renderCatTabs();
  renderLeftPanel();
  renderQuote();
}

// ── Database persistence (localStorage) ──
function loadDb(){
  try{
    const saved=localStorage.getItem('yutesign_db');
    const savedVer=localStorage.getItem('yutesign_db_ver');
    if(saved && savedVer===DB_VERSION){
      dbItems=JSON.parse(saved);
    } else {
      dbItems=DEFAULT_ITEMS.map(item=>({...item,類別:mapCat(item['類別'])}));
      localStorage.setItem('yutesign_db_ver',DB_VERSION);
      localStorage.setItem('yutesign_db',JSON.stringify(dbItems));
    }
  } catch(e){
    dbItems=DEFAULT_ITEMS.map(item=>({...item,類別:mapCat(item['類別'])}));
  }
}

function saveDb(){
  try{
    localStorage.setItem('yutesign_db',JSON.stringify(dbItems));
    dbModified=false;
    const st=document.getElementById('editStatus');
    if(st){st.textContent='✓ 已儲存';st.className='edit-status saved';}
    setTimeout(()=>{
      if(st){st.textContent='工項資料庫 — 點選各項目可修改類別與單價';st.className='edit-status';}
    },2000);
    // Re-render left panel to reflect changes
    renderCatTabs();
    renderLeftPanel();
  } catch(e){
    alert('儲存失敗：'+e.message);
  }
}

function mapCat(cat){return CAT_MAP[cat]||cat;}

// ── Mode switching ──

function filterItems(){
  if(mode==='quote') renderQuoteList();
  else renderEditList();
}

function onSearch(){activeCat='全部';renderCatTabs();renderLeftPanel();}

function setMode(m){
  mode=m;
  document.getElementById('btnQuoteMode').className='mode-btn'+(m==='quote'?' active':'');
  document.getElementById('btnEditMode').className='mode-btn'+(m==='edit'?' active':'');
  document.getElementById('modeLabel').textContent=m==='quote'?'報價模式':'編輯工項資料庫';
  document.getElementById('editSaveBar').style.display=m==='edit'?'block':'none';
  document.getElementById('addCustomArea').style.display=m==='edit'?'none':'flex';
  // Reset search
  document.getElementById('searchInput').value='';
  activeCat='全部';
  renderCatTabs();
  renderLeftPanel();
  if(m==='edit'){
    document.getElementById('rightContent').innerHTML=
      '<div class="edit-mode-msg"><strong>目前在編輯工項資料庫模式</strong>左側可修改每個工項的類別、單位、單價，也可以新增或刪除工項。改完記得按「儲存變更」。切回「報價」模式後即可使用更新的資料庫。</div>';
  } else {
    renderQuote();
  }
}

// ── Category tabs ──
function getAllCatOrder(){
  return customSectionOrder?[...new Set([...customSectionOrder,...SECTION_ORDER])]:SECTION_ORDER;
}
function getCats(){
  const cats=new Set(dbItems.map(d=>d['類別']));
  const order=getAllCatOrder();
  return ['全部',...order.filter(s=>cats.has(s)),...[...cats].filter(c=>!order.includes(c))];
}
function refreshCatDropdowns(){
  const allCats=getAllCatOrder();
  const opts=allCats.map(s=>`<option value="${escHtml(s)}">${escHtml(s)}</option>`).join('');
  ['newItemCat','customCat'].forEach(id=>{
    const el=document.getElementById(id);
    if(!el)return;
    const prev=el.value;
    el.innerHTML=opts;
    if(prev&&allCats.includes(prev))el.value=prev;
  });
}

function renderCatTabs(){
  const el=document.getElementById('catTabs');
  const cats=getCats();
  el.innerHTML=cats.map(c=>{
    const count=c==='全部'?dbItems.length:dbItems.filter(i=>i['類別']===c).length;
    const label=c==='全部'?'全部':c.replace('工程','').replace('及系統櫃','').replace('及輕鋼架天花','').replace('及貼磚','').replace('及貼膜','').replace('、設備及其他','').replace('及鋁窗','');
    return `<button class="cat-tab${c===activeCat?' active':''}" data-cat="${escHtml(c)}" onclick="setCat(this.dataset.cat)">${escHtml(label)}<span class="tag-freq" style="margin-left:3px">${count}</span></button>`;
  }).join('');
}

function setCat(cat){activeCat=cat;renderCatTabs();renderLeftPanel();}

function onSearch(){activeCat='全部';renderCatTabs();renderLeftPanel();}

// ── Left panel rendering (quote vs edit mode) ──
function getFilteredItems(){
  const q=document.getElementById('searchInput').value.toLowerCase();
  let items=dbItems;
  if(activeCat!=='全部') items=items.filter(i=>i['類別']===activeCat);
  if(q) items=items.filter(i=>i['工項名稱'].toLowerCase().includes(q)||i['類別'].includes(q));
  return items;
}

function renderLeftPanel(){
  if(mode==='quote') renderQuoteList();
  else renderEditList();
}

function renderQuoteList(){
  const items=getFilteredItems().sort((a,b)=>b['出現次數']-a['出現次數']);
  const el=document.getElementById('itemList');
  if(!items.length){el.innerHTML='<div class="no-results">沒有符合的工項</div>';return;}
  el.innerHTML=items.slice(0,200).map(item=>{
    const safe=jsonForHtmlAttr(item);
    return `<div class="item-row" onclick="addItem(${safe})">
      <div class="item-info">
        <div class="item-name">${escHtml(item['工項名稱'])}</div>
        <div class="item-sub">${escHtml(item['類別'].replace('工程','').slice(0,8))} ${item['出現次數']>1?'<span class=\"tag-freq\">×'+item['出現次數']+'</span>':''}</div>
      </div>
      <div><div class="item-price">$${item['參考單價'].toLocaleString()}</div><div class="item-unit">${escHtml(item['單位'])}</div></div>
      <button class="add-btn">+</button>
    </div>`;
  }).join('');
}

function renderEditList(){
  const items=getFilteredItems().sort((a,b)=>b['出現次數']-a['出現次數']);
  const el=document.getElementById('itemList');
  if(!items.length){el.innerHTML='<div class="no-results">沒有符合的工項</div>';return;}
  const catOptions=SECTION_ORDER.map(s=>`<option value="${s}">${s}</option>`).join('');
  el.innerHTML=items.map((item,idx)=>{
    const globalIdx=dbItems.indexOf(item);
    return `<div class="edit-row" id="erow_${globalIdx}">
      <div class="edit-row-top">
        <input class="edit-name" value="${escHtml(item['工項名稱'])}" onchange="updateDbItem(${globalIdx},'工項名稱',this.value)" style="flex:1;font-size:12px;border:1px solid #ddd;border-radius:3px;padding:2px 4px">
        <button class="edit-del-btn" onclick="deleteDbItem(${globalIdx})" title="刪除">×</button>
      </div>
      <div class="edit-row-fields">
        <select class="edit-select" onchange="updateDbItem(${globalIdx},'類別',this.value)">${
          SECTION_ORDER.map(s=>`<option value="${escHtml(s)}"${s===item['類別']?' selected':''}>${escHtml(s)}</option>`).join('')
        }</select>
        <input class="edit-unit" value="${escHtml(item['單位'])}" placeholder="單位" onchange="updateDbItem(${globalIdx},'單位',this.value)">
        <input class="edit-input" type="number" value="${item['參考單價']}" placeholder="單價" onchange="updateDbItem(${globalIdx},'參考單價',parseFloat(this.value)||0)">
      </div>
    </div>`;
  }).join('');
}

function updateDbItem(idx,field,val){
  dbItems[idx][field]=val;
  dbModified=true;
  const st=document.getElementById('editStatus');
  if(st){st.textContent='有未儲存的變更';st.className='edit-status';}
}

function deleteDbItem(idx){
  if(!confirm('確定要刪除「'+dbItems[idx]['工項名稱']+'」？')) return;
  dbItems.splice(idx,1);
  dbModified=true;
  renderCatTabs();
  renderEditList();
}

function addNewItemToDb(){
  const name=document.getElementById('newItemName').value.trim();
  const unit=document.getElementById('newItemUnit').value.trim()||'式';
  const price=parseFloat(document.getElementById('newItemPrice').value)||0;
  const cat=document.getElementById('newItemCat').value;
  if(!name) return;
  dbItems.unshift({'類別':cat,'工項名稱':name,'單位':unit,'參考單價':price,'最低單價':price,'最高單價':price,'出現次數':1});
  document.getElementById('newItemName').value='';
  document.getElementById('newItemUnit').value='';
  document.getElementById('newItemPrice').value='';
  dbModified=true;
  renderCatTabs();
  renderEditList();
}

