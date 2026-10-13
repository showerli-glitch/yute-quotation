// QUOTATION EDITOR AND CALCULATIONS. Extracted verbatim from index.html at main@655fd20 (quotation split).

// ── Quote functions ──
function saveQuoteState(){
  try{
    const state={
      projName:document.getElementById('projName').value,
      projClient:document.getElementById('projClient').value,
      projAddr:document.getElementById('projAddr').value,
      projDate:document.getElementById('projDate').value,
      mgmtFee:document.getElementById('mgmtFee').value,
      projEmail:document.getElementById('projEmail')?.value||'',
      projDuration:parseInt(document.getElementById('projDuration')?.value)||0,
      quoteItems:quoteItems,
      catNotes:catNotes,
      remarksItems:[...remarksItems],
      miscItems:[...miscItems],
      extraCleanMode:document.getElementById('extraCleanMode')?.value||'unit',
      extraCleanQty:document.getElementById('extraCleanQty')?.value||0,
      extraCleanPrice:document.getElementById('extraCleanPrice')?.value||700,
      extraCleanFixed:document.getElementById('extraCleanFixed')?.value||0,
      extraDesignMode:document.getElementById('extraDesignMode')?.value||'fixed',
      extraDesignFixed:document.getElementById('extraDesignFixed')?.value||0,
      extraDesignPct:document.getElementById('extraDesignPct')?.value||0,
      extraDesignQty:document.getElementById('extraDesignQty')?.value||0,
      extraDesignPrice:document.getElementById('extraDesignPrice')?.value||0,
      extraInsurance:document.getElementById('extraInsurance')?.value||0,
      customSectionOrder:customSectionOrder?[...customSectionOrder]:null,
      reviewedIds:[...reviewedIds]
    };
    localStorage.setItem('yutesign_quote',JSON.stringify(state));
  }catch(e){}
}
function loadQuoteState(){
  try{
    const saved=localStorage.getItem('yutesign_quote');
    if(!saved)return;
    const s=JSON.parse(saved);
    if(s.projName!==undefined)document.getElementById('projName').value=s.projName;
    if(s.projClient!==undefined)document.getElementById('projClient').value=s.projClient;
    if(s.projAddr!==undefined)document.getElementById('projAddr').value=s.projAddr;
    if(s.projDate!==undefined)document.getElementById('projDate').value=s.projDate;
    if(s.mgmtFee!==undefined)document.getElementById('mgmtFee').value=s.mgmtFee;
    if(s.projEmail!==undefined&&document.getElementById('projEmail'))document.getElementById('projEmail').value=s.projEmail;
    if(s.projDuration!==undefined){projDuration=s.projDuration;const el=document.getElementById('projDuration');if(el)el.value=s.projDuration;}
    if(s.quoteItems)quoteItems=s.quoteItems.map(item=>({...item,id:item.id||(Date.now()+Math.random())}));
    if(s.catNotes)catNotes=s.catNotes;
    if(s.remarksItems)remarksItems=[...s.remarksItems];
    if(s.miscItems){miscItems=[...s.miscItems];renderMiscItems();}
    if(s.extraCleanMode&&document.getElementById('extraCleanMode')){document.getElementById('extraCleanMode').value=s.extraCleanMode;toggleCleanMode();}
    if(s.extraCleanQty!==undefined&&document.getElementById('extraCleanQty'))document.getElementById('extraCleanQty').value=s.extraCleanQty;
    if(s.extraCleanPrice!==undefined&&document.getElementById('extraCleanPrice'))document.getElementById('extraCleanPrice').value=s.extraCleanPrice;
    if(s.extraCleanFixed!==undefined&&document.getElementById('extraCleanFixed'))document.getElementById('extraCleanFixed').value=s.extraCleanFixed;
    if(s.extraDesignMode&&document.getElementById('extraDesignMode')){document.getElementById('extraDesignMode').value=s.extraDesignMode;toggleDesignMode();}
    if(s.extraDesignFixed!==undefined&&document.getElementById('extraDesignFixed'))document.getElementById('extraDesignFixed').value=s.extraDesignFixed;
    if(s.extraDesignPct!==undefined&&document.getElementById('extraDesignPct'))document.getElementById('extraDesignPct').value=s.extraDesignPct;
    if(s.extraDesignQty!==undefined&&document.getElementById('extraDesignQty'))document.getElementById('extraDesignQty').value=s.extraDesignQty;
    if(s.extraDesignPrice!==undefined&&document.getElementById('extraDesignPrice'))document.getElementById('extraDesignPrice').value=s.extraDesignPrice;
    if(s.extraInsurance!==undefined&&document.getElementById('extraInsurance'))document.getElementById('extraInsurance').value=s.extraInsurance;
    if(s.customSectionOrder!==undefined)customSectionOrder=s.customSectionOrder;
    if(s.reviewedIds)reviewedIds=new Set(s.reviewedIds);
  }catch(e){}
}
function addMiscItem(){
  miscItems.push({name:'',unit:'式',qty:1,price:0});
  renderMiscItems();
}
function removeMiscItem(i){
  miscItems.splice(i,1);
  renderMiscItems();
  renderQuote();
}
function renderMiscItems(){
  const el=document.getElementById('miscItemsList');
  if(!el)return;
  el.innerHTML=miscItems.map((m,i)=>
    `<div style="display:flex;align-items:center;gap:3px;flex-wrap:nowrap">
      <input value="${escHtml(m.name||'')}" placeholder="費用名稱" style="flex:1;min-width:80px;font-size:11px;padding:2px 6px;border:1px solid #ddd;border-radius:4px" onchange="miscItems[${i}].name=this.value;renderQuote()">
      <input value="${escHtml(m.unit||'式')}" placeholder="單位" style="width:36px;font-size:11px;padding:2px 4px;border:1px solid #ddd;border-radius:4px;text-align:center" onchange="miscItems[${i}].unit=this.value">
      <input type="number" value="${m.qty||1}" min="1" style="width:44px;font-size:11px;padding:2px 4px;border:1px solid #ddd;border-radius:4px;text-align:center" onchange="miscItems[${i}].qty=parseFloat(this.value)||1;renderQuote()">
      <span style="font-size:11px;color:#aaa">×</span>
      <input type="number" value="${m.price||0}" placeholder="單價" style="width:80px;font-size:11px;padding:2px 4px;border:1px solid #ddd;border-radius:4px;text-align:right" onchange="miscItems[${i}].price=parseFloat(this.value)||0;renderQuote()">
      <button onclick="removeMiscItem(${i})" style="font-size:14px;background:none;border:none;cursor:pointer;color:#ccc;padding:0 2px;line-height:1">×</button>
    </div>`
  ).join('');
}
function saveHistory(){undoHistory.push(JSON.stringify(quoteItems));if(undoHistory.length>20)undoHistory.shift();redoHistory=[];}
function undo(){if(!undoHistory.length)return;redoHistory.push(JSON.stringify(quoteItems));quoteItems=JSON.parse(undoHistory.pop());renderQuote();}
function redo(){if(!redoHistory.length)return;undoHistory.push(JSON.stringify(quoteItems));quoteItems=JSON.parse(redoHistory.pop());renderQuote();}
function addItem(item){
  quoteItems.push({id:Date.now()+Math.random(),cat:item['類別'],name:item['工項名稱'],
    unit:item['單位']||'式',qty:1,price:item['參考單價'],
    minPrice:item['最低單價'],maxPrice:item['最高單價']});
  renderQuote();
}

function addCustomItem(){
  const name=document.getElementById('customName').value.trim();
  const unit=document.getElementById('customUnit').value.trim()||'式';
  const price=parseFloat(document.getElementById('customPrice').value)||0;
  const cat=document.getElementById('customCat').value;
  if(!name)return;
  saveHistory();
  quoteItems.push({id:Date.now()+Math.random(),cat,name,unit,qty:1,price,minPrice:price,maxPrice:price});
  const existing=dbItems.find(d=>d['類別']===cat&&d['工項名稱']===name);
  if(!existing){
    dbItems.unshift({'類別':cat,'工項名稱':name,'單位':unit,'參考單價':price,'最低單價':price,'最高單價':price,'出現次數':1});
    saveDb();
    renderCatTabs();
    renderQuoteList();
  }
  document.getElementById('customName').value='';
  document.getElementById('customUnit').value='';
  document.getElementById('customPrice').value='';
  renderQuote();
}

function removeItem(id){saveHistory();quoteItems=quoteItems.filter(i=>i.id!==id);renderQuote();}
function updateField(id,field,val){saveHistory();const item=quoteItems.find(i=>i.id===id);if(item)item[field]=parseFloat(val)||0;renderQuote();}
function updateStrField(id,field,val){saveHistory();const item=quoteItems.find(i=>i.id===id);if(item)item[field]=val;}
function buildCatOptions(sel){
  return getAllCatOrder().map(s=>`<option value="${escHtml(s)}"${s===sel?' selected':''}>${escHtml(s.replace('工程','').replace('及系統櫃','').replace('及輕鋼架天花','').replace('及貼磚','').replace('及貼膜','').replace('、設備及其他','').replace('及鋁窗',''))}</option>`).join('');
}
function updateItemCat(id,newCat){
  saveHistory();
  const item=quoteItems.find(i=>i.id===id);
  if(!item)return;
  item.cat=newCat;
  // 同步回資料庫
  const dbItem=dbItems.find(d=>d['工項名稱']===item.name);
  if(dbItem){dbItem['類別']=newCat;saveDb();}
  renderQuote();
}

function getSections(){
  const g={};
  quoteItems.forEach(item=>{if(!g[item.cat])g[item.cat]=[];g[item.cat].push(item);});
  const order=customSectionOrder||SECTION_ORDER;
  const sorted={};
  order.forEach(s=>{if(g[s])sorted[s]=g[s];});
  Object.keys(g).forEach(s=>{if(!sorted[s])sorted[s]=g[s];});
  return sorted;
}

function toggleCleanMode(){
  const mode=document.getElementById('extraCleanMode')?.value||'unit';
  const uw=document.getElementById('cleanUnitWrap');
  const fw=document.getElementById('cleanFixedWrap');
  if(uw) uw.style.display=mode==='unit'?'flex':'none';
  if(fw) fw.style.display=mode==='fixed'?'flex':'none';
  renderQuote();
}
function updateClean(){
  const mode=document.getElementById('extraCleanMode')?.value||'unit';
  let val=0;
  if(mode==='fixed'){
    val=parseFloat(document.getElementById('extraCleanFixed')?.value)||0;
  } else {
    const qty=parseFloat(document.getElementById('extraCleanQty')?.value)||0;
    const price=parseFloat(document.getElementById('extraCleanPrice')?.value)||700;
    val=Math.round(qty*price);
  }
  const el=document.getElementById('extraClean');
  if(el) el.value=val;
  renderQuote();
}
function toggleDesignMode(){
  const mode=document.getElementById('extraDesignMode')?.value||'fixed';
  const fw=document.getElementById('designFixedWrap');
  const pw=document.getElementById('designPctWrap');
  const uw=document.getElementById('designUnitWrap');
  if(fw) fw.style.display=mode==='fixed'?'flex':'none';
  if(pw) pw.style.display=mode==='pct'?'flex':'none';
  if(uw) uw.style.display=mode==='unit'?'flex':'none';
}
function getExtraItems(){
  const cleanMode=document.getElementById('extraCleanMode')?.value||'unit';
  const cleanQty=parseFloat(document.getElementById('extraCleanQty')?.value)||0;
  const cleanPrice=parseFloat(document.getElementById('extraCleanPrice')?.value)||700;
  const cleanFixed=parseFloat(document.getElementById('extraCleanFixed')?.value)||0;
  const clean=cleanMode==='fixed'?Math.round(cleanFixed):Math.round(cleanQty*cleanPrice);
  const insurance=parseFloat(document.getElementById('extraInsurance')?.value)||0;
  const mode=document.getElementById('extraDesignMode')?.value||'fixed';
  let design=0, designQty=0, designPrice=0, designPct=0;
  // 基礎 = 工項小計 + 清潔費
  let subtotal=0; quoteItems.forEach(i=>subtotal+=i.qty*i.price);
  const mgmtBase=subtotal+clean;
  if(mode==='fixed'){
    design=parseFloat(document.getElementById('extraDesignFixed')?.value)||0;
  } else if(mode==='pct'){
    designPct=parseFloat(document.getElementById('extraDesignPct')?.value)||0;
    design=Math.round(mgmtBase*(designPct/100));
  } else {
    designQty=parseFloat(document.getElementById('extraDesignQty')?.value)||0;
    designPrice=parseFloat(document.getElementById('extraDesignPrice')?.value)||0;
    design=designQty*designPrice;
  }
  const miscTotal=miscItems.reduce((s,m)=>s+(m.qty||1)*(m.price||0),0);
  return {clean, cleanMode, cleanQty, cleanPrice, cleanFixed, designQty, designPrice, designPct, designMode:mode, design, insurance, mgmtBase, miscTotal, miscItems:[...miscItems]};
}
function getCalc(){
  const mgmtPct=parseFloat(document.getElementById('mgmtFee').value)||0;
  let subtotal=0;quoteItems.forEach(i=>subtotal+=i.qty*i.price);
  const _extraData=getExtraItems();
  const {clean,design,insurance,miscTotal}=_extraData;
  const extras=clean+design+insurance+(miscTotal||0);
  // 管理費基礎 = 工項小計 + 清潔費（同Excel）
  const _mgmtBase=_extraData.mgmtBase||(subtotal+_extraData.clean);
  const mgmt=_mgmtBase*(mgmtPct/100),beforeTax=subtotal+mgmt+extras,tax=beforeTax*0.05,total=beforeTax+tax;
  return {subtotal,mgmt,mgmtPct,extras,clean,design,insurance,beforeTax,tax,total};
}

let _dragId=null;
function qDS(e,id){_dragId=id;e.dataTransfer.effectAllowed='move';setTimeout(()=>e.target.closest('.quote-row').classList.add('dragging'),0);}
function qDE(){document.querySelectorAll('.quote-row').forEach(el=>el.classList.remove('dragging','drag-over'));}
function qDO(e){e.preventDefault();e.currentTarget.classList.add('drag-over');}
function qDL(e){e.currentTarget.classList.remove('drag-over');}
function qDP(e,targetId){
  e.preventDefault();
  document.querySelectorAll('.quote-row').forEach(el=>el.classList.remove('drag-over'));
  if(_dragId===targetId)return;
  const si=quoteItems.findIndex(i=>i.id===_dragId);
  const ti=quoteItems.findIndex(i=>i.id===targetId);
  if(si<0||ti<0)return;
  saveHistory();
  const[moved]=quoteItems.splice(si,1);
  quoteItems.splice(ti,0,moved);
  renderQuote();
}

function renderQuote(){saveQuoteState();refreshCatDropdowns();
  if(mode==='edit') return;
  const area=document.getElementById('rightContent');
  const {subtotal,mgmt,mgmtPct,beforeTax,tax,total}=getCalc();
  // 搜尋過濾
  const qsEl=document.getElementById('quoteSearch');
  const qsClear=document.getElementById('quoteSearchClear');
  const qKeyword=(qsEl?.value||'').trim().toLowerCase();
  if(qsClear) qsClear.style.display=qKeyword?'':'none';
  if(!quoteItems.length){
    area.innerHTML='<div class="empty-state">從左側工項資料庫選取項目，或手動新增工項</div>';
    updateStats(0,subtotal,mgmtPct);
    updateGrandTotals(beforeTax,tax,total);
    return;
  }
  const grouped=getSections();
  if(qKeyword){
    Object.keys(grouped).forEach(cat=>{
      grouped[cat]=grouped[cat].filter(i=>i.name.toLowerCase().includes(qKeyword)||(i.note||'').toLowerCase().includes(qKeyword));
      if(!grouped[cat].length) delete grouped[cat];
    });
  }
  if(qKeyword && !Object.keys(grouped).length){
    area.innerHTML=`<div class="empty-state">找不到含「${escHtml(qKeyword)}」的工項</div>`;
    updateStats(quoteItems.length,subtotal,mgmtPct);
    updateGrandTotals(beforeTax,tax,total);
    return;
  }
  let num=1;
  let html=`<div class="quote-table">
    <div class="table-header">
      <span>#</span><span>工項名稱</span>
      <span style="text-align:right">單位</span><span style="text-align:right">數量</span>
      <span style="text-align:right">單價</span><span style="text-align:right">複價</span>
      <span style="text-align:center;font-size:11px">備註</span><span></span>
    </div>`;
  Object.entries(grouped).forEach(([cat,items])=>{
    const catTotal=items.reduce((s,i)=>s+i.qty*i.price,0);
    html+=`<div class="section-header"><span></span>
      <span class="section-title">${escHtml(cat)} <span class="section-subtotal">$${Math.round(catTotal).toLocaleString()}</span></span>
      <span></span><span></span><span></span><span></span>
      <input class="row-input" placeholder="大表備註" value="${escHtml(catNotes[cat]||'')}" data-cat="${escHtml(cat)}" style="width:100%;font-size:11px" onchange="catNotes[this.dataset.cat]=this.value">
      <span></span></div>`;
    items.forEach(item=>{
      const amt=item.qty*item.price;
      const hint=item.minPrice!==item.maxPrice?`<div class="price-hint">$${item.minPrice.toLocaleString()}～$${item.maxPrice.toLocaleString()}</div>`:'';
      const isReviewed=reviewedIds.has(item.id);
      html+=`<div class="quote-row${selectedRowIds.has(item.id)?' selected':''}${isReviewed?' reviewed':''}" data-id="${item.id}" ondragover="qDO(event)" ondragleave="qDL(event)" ondrop="qDP(event,${item.id})">
        <span class="row-num" draggable="true" ondragstart="qDS(event,${item.id})" ondragend="qDE()" onclick="toggleReviewed(event,${item.id})" title="點擊標記已審閱｜拖曳排序" style="cursor:grab">${isReviewed?'<span style="font-size:13px">✓</span>'+(num++):'<span class="drag-icon">⠿</span>'+num++}</span>
        <div style="display:flex;flex-direction:column;gap:2px">
          <input class="row-input row-name" value="${escHtml(item.name)}" onchange="updateStrField(${item.id},'name',this.value)" style="width:100%;text-align:left">
          <select style="font-size:10px;padding:1px 3px;border:1px solid #e0ddd5;border-radius:3px;background:#fafaf8;color:#888;width:100%" onchange="updateItemCat(${item.id},this.value)">${buildCatOptions(item.cat)}</select>
        </div>
        <span style="text-align:right"><input class="row-input" value="${escHtml(item.unit)}" style="width:60px;text-align:center" onchange="updateStrField(${item.id},'unit',this.value)"></span>
        <span style="text-align:right"><input class="row-input" type="number" value="${item.qty}" onchange="updateField(${item.id},'qty',this.value)" style="width:60px"></span>
        <span style="text-align:right"><input class="row-input" type="number" value="${item.price}" onchange="updateField(${item.id},'price',this.value)" style="width:90px">${hint}</span>
        <span class="row-amount" onclick="selectRow(event,${item.id})" title="點擊選取加總" style="cursor:pointer;border-radius:4px;padding:2px 4px;transition:background 0.1s">$${Math.round(amt).toLocaleString()}</span>
        <span><input class="row-input" value="${escHtml(item.note||'')}" placeholder="備註" style="width:100%;font-size:11px" onchange="updateStrField(${item.id},'note',this.value)"></span>
        <button class="row-delete" onclick="removeItem(${item.id})">×</button>
      </div>`;
    });
  });
  html+=`</div>`;
  area.innerHTML=html;
  updateStats(quoteItems.length,subtotal,mgmtPct);
  updateGrandTotals(beforeTax,tax,total);
}

function updateGrandTotals(beforeTax,tax,total){
  const _tAmt='$'+Math.round(total).toLocaleString();
  const _tBreak=`小計 $${Math.round(beforeTax).toLocaleString()} + 營業稅 $${Math.round(tax).toLocaleString()}`;
  const totalA=document.getElementById('grandTotal');
  const breakA=document.getElementById('taxBreak');
  const totalB=document.getElementById('grandTotal2');
  const breakB=document.getElementById('taxBreak2');
  if(totalA)totalA.textContent=_tAmt;
  if(breakA)breakA.textContent=_tBreak;
  if(totalB)totalB.textContent=_tAmt;
  if(breakB)breakB.textContent=_tBreak;
}

function updateStats(count,subtotal,mgmtPct){
  const {mgmt,total}=getCalc();
  document.getElementById('statItems').textContent=count;
  document.getElementById('statSubtotal').textContent='$'+Math.round(subtotal).toLocaleString();
  document.getElementById('statMgmt').textContent='$'+Math.round(mgmt).toLocaleString();
  document.getElementById('statTotal').textContent='$'+Math.round(total).toLocaleString();
}

function selectRow(event,id){
  if(['INPUT','BUTTON','SELECT'].includes(event.target.tagName))return;
  if(event.metaKey||event.ctrlKey){
    selectedRowIds.has(id)?selectedRowIds.delete(id):selectedRowIds.add(id);
  } else {
    const onlyThis=selectedRowIds.size===1&&selectedRowIds.has(id);
    selectedRowIds.clear();
    if(!onlyThis)selectedRowIds.add(id);
  }
  document.querySelectorAll('.quote-row').forEach(r=>r.classList.toggle('selected',selectedRowIds.has(parseInt(r.dataset.id))));
  updateSelectionSum();
}
function updateSelectionSum(){
  const block=document.getElementById('selectionSumBlock');
  if(!block)return;
  if(!selectedRowIds.size){block.style.display='none';return;}
  const sel=quoteItems.filter(i=>selectedRowIds.has(i.id));
  const sum=sel.reduce((s,i)=>s+i.qty*i.price,0);
  document.getElementById('selectionSumAmt').textContent='$'+Math.round(sum).toLocaleString();
  document.getElementById('selectionSumCount').textContent=`已選 ${sel.length} 項`;
  block.style.display='';
}
function toggleReviewed(e,id){
  e.stopPropagation();
  const nowReviewed=!reviewedIds.has(id);
  nowReviewed?reviewedIds.add(id):reviewedIds.delete(id);
  const row=e.currentTarget.closest('.quote-row');
  row.classList.toggle('reviewed',nowReviewed);
  const numSpan=e.currentTarget;
  const num=numSpan.textContent.replace('✓','').trim();
  numSpan.innerHTML=nowReviewed?`<span style="font-size:13px">✓</span>${num}`:`<span class="drag-icon">⠿</span>${num}`;
  requestAnimationFrame(()=>setTimeout(saveQuoteState,0));
}
function clearAll(){if(!quoteItems.length||confirm('確定要清除所有工項？')){saveHistory();selectedRowIds.clear();updateSelectionSum();reviewedIds.clear();customSectionOrder=null;quoteItems=[];miscItems=[];currentDriveFileId=null;lastFolderModifiedTime=null;renderMiscItems();renderQuote();}}

