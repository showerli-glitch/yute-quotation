// QUOTATION SECTIONS, PRINT, EXCEL, LOGO AND JSON. Extracted verbatim from index.html at main@655fd20 (quotation split).

// ===== 大項管理 =====
function openSectionManager(){
  if(!customSectionOrder){
    const inQuote=new Set(quoteItems.map(i=>i.cat));
    customSectionOrder=[...SECTION_ORDER.filter(s=>inQuote.has(s)),...[...inQuote].filter(s=>!SECTION_ORDER.includes(s))];
  }
  renderSectionManager();
  document.getElementById('sectionMgrOverlay').style.display='flex';
}
function closeSectionManager(){
  document.getElementById('sectionMgrOverlay').style.display='none';
  renderQuote();
}
function renderSectionManager(){
  const inQuote=new Set(quoteItems.map(i=>i.cat));
  const btn=(label,onclick,disabled,color)=>`<button onclick="${onclick}" ${disabled?'disabled':''} style="padding:3px 10px;border:1px solid #e0ddd5;border-radius:4px;background:#fff;cursor:pointer;font-size:13px;color:${color||'#333'};${disabled?'opacity:0.3;cursor:default':''}">${label}</button>`;
  document.getElementById('sectionMgrList').innerHTML=(customSectionOrder||[]).map((cat,i)=>{
    const hasItems=inQuote.has(cat);
    return `<div style="display:flex;align-items:center;gap:6px;padding:7px 4px;border-bottom:0.5px solid #f0ede5">
      <span style="flex:1;font-size:13px;color:${hasItems?'#1a1a1a':'#aaa'}">${escHtml(cat)}${hasItems?'':' <span style="font-size:10px">（空）</span>'}</span>
      ${btn('↑',`moveSectionUp(${i})`,i===0)}
      ${btn('↓',`moveSectionDown(${i})`,i===(customSectionOrder.length-1))}
      ${!hasItems?btn('×',`removeCustomSection(${i})`,false,'#c0392b'):''}
    </div>`;
  }).join('');
}
function moveSectionUp(i){
  if(i===0)return;
  [customSectionOrder[i-1],customSectionOrder[i]]=[customSectionOrder[i],customSectionOrder[i-1]];
  renderSectionManager();
}
function moveSectionDown(i){
  if(i===customSectionOrder.length-1)return;
  [customSectionOrder[i],customSectionOrder[i+1]]=[customSectionOrder[i+1],customSectionOrder[i]];
  renderSectionManager();
}
function addCustomSection(){
  const inp=document.getElementById('sectionMgrInput');
  const name=inp.value.trim();
  if(!name)return;
  if(customSectionOrder.includes(name)){alert('已有此大項名稱');return;}
  customSectionOrder.push(name);
  inp.value='';
  renderSectionManager();
}
function removeCustomSection(i){
  customSectionOrder.splice(i,1);
  renderSectionManager();
}

function makePageHeader(name,client,addr,date,isDetail,email){
  const metaLine = isDetail
    ? (name?'工程名稱：'+name:'')+(client?'　業主：'+client:'')+(addr?'　工程地址：'+addr:'')
    : '';
  return ''
    +'<table style="width:100%;border-collapse:collapse;margin-bottom:4pt;padding-bottom:4pt;border-bottom:1.5pt solid #000">'
    +'<tr>'
    +'<td style="vertical-align:top;padding:0;border:none">'
    +'<div style="display:flex;align-items:center;gap:5pt;margin-bottom:1pt">'
    +'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 55 60" width="26" height="28" style="display:block;flex-shrink:0"><!-- 上半外框（屋頂+煙囪） --><polygon points="27.5,0.0 9.86,10.6 9.86,4.46 6.26,4.46 6.26,12.76 0.0,16.53 0.0,27.76 1.44,27.76 1.44,17.24 27.5,1.58 53.56,17.24 53.56,28.11 55.0,28.11 55.0,16.53 27.5,0.0" fill="#4e4c4b"/><!-- 下半外框 --><polygon points="53.56,42.76 27.5,58.42 1.44,42.76 1.44,32.24 0.0,32.24 0.0,43.47 27.5,60.0 55.0,43.47 55.0,32.59 53.56,32.59 53.56,42.76" fill="#4e4c4b"/><!-- 門框（深色） --><polygon points="36.26,40.65 36.26,17.92 19.18,17.92 19.18,41.3 24.41,41.3 24.41,47.13" fill="#4e4c4b"/><!-- 開啟的門扇（白色填充） --><polygon points="25.6,24.44 35.29,19.1 35.29,40.06 25.38,45.35" fill="white"/><!-- 門把（黑色圓點） --><circle cx="27.89" cy="33.24" r="1.8" fill="#4e4c4b"/></svg>'
    +'<div style="font-size:12pt;font-weight:700;color:#000;letter-spacing:0.5px">宇德室內裝修股份有限公司</div>'
    +'</div>'
    +'<div style="font-size:7.5pt;color:#333;line-height:1.7">TEL: (02)2652-2112　　台北市忠孝東路六段70巷21弄2號　　E-mail: '+email+'</div>'
    +(metaLine?'<div style="font-size:8pt;color:#000;margin-top:1pt">'+metaLine+'</div>':'')
    +'</td>'
    +'<td style="vertical-align:middle;text-align:right;font-size:8.5pt;padding:0 0 0 6pt;border:none;white-space:nowrap;width:60pt">日期：'+date+'</td>'
    +'</tr>'
    +'</table>';
}

function buildPrintDoc(){
  const name=document.getElementById('projName').value||'';
  const client=document.getElementById('projClient').value||'';
  const addr=document.getElementById('projAddr').value||'';
  const date=document.getElementById('projDate').value||'';
  const email=document.getElementById('projEmail').value||'shower.li@yutesign.com';
  const {subtotal,mgmt,mgmtPct,beforeTax,tax,total}=getCalc();
  const grouped=getSections();
  const sections=Object.entries(grouped);

  // PAGE 1: Summary
  let p1=`<div class="pd">
    ${makePageHeader(name,client,addr,date,false,email).replace(/`/g,"'")}
    <div class="pd-title">工 程 報 價 單</div>
    <div class="pd-meta">
      工程名稱：${name||'　　　　　　　　　　　　'}${client?`　　　業主：${client}`:''}
      ${addr?`<br>工程地址：${addr}`:''}
    </div>
    <table class="pd">
      <thead><tr>
        <th style="width:34pt;white-space:nowrap">項次</th>
        <th>名稱與說明</th>
        <th style="width:25pt">單位</th>
        <th style="width:30pt">預估數量</th>
        <th style="width:55pt">單　價</th>
        <th style="width:62pt">複　價</th>
        <th style="width:55pt">備　註</th>
      </tr></thead><tbody>`;
  let sIdx=0;
  sections.forEach(([cat,items])=>{
    const catTotal=items.reduce((s,i)=>s+i.qty*i.price,0);
    p1+=`<tr><td class="tc">${NUM_ZH[sIdx]||sIdx+1}</td><td>${cat}</td>
      <td class="tc">式</td><td class="tc">1</td>
      <td class="tr">${Math.round(catTotal).toLocaleString()}</td>
      <td class="tr">${Math.round(catTotal).toLocaleString()}</td>
      <td style="font-size:9pt">${catNotes[cat]||''}</td></tr>`;sIdx++;
  });
  const pExtras=getExtraItems(); const {clean:pClean,design:pDesign,insurance:pIns,mgmtBase:pMgmtBase}=pExtras; const pMgmtAmt=pMgmtBase*(mgmtPct/100);
  if(pClean>0){
    const cMode=pExtras.cleanMode||'unit';
    const cUnit=cMode==='fixed'?'式':'坪';
    const cQty=cMode==='fixed'?1:(pExtras.cleanQty||1);
    const cPrice=cMode==='fixed'?Math.round(pClean):Math.round(pExtras.cleanPrice||pClean);
    p1+=`<tr><td class="tc">${NUM_ZH[sIdx]||sIdx+1}</td><td>施工區域完工後清潔</td>
      <td class="tc">${cUnit}</td><td class="tc">${cQty}</td>
      <td class="tr">${cPrice.toLocaleString()}</td>
      <td class="tr">${Math.round(pClean).toLocaleString()}</td>
      <td></td></tr>`;sIdx++;
  }
  if(mgmtPct>0){
    const mgmtAmt=pMgmtAmt;
    p1+=`<tr><td class="tc">${NUM_ZH[sIdx]||sIdx+1}</td><td>監工管理費(${mgmtPct}%)</td>
      <td class="tc">式</td><td class="tc">1</td>
      <td class="tr">${Math.round(mgmtAmt).toLocaleString()}</td>
      <td class="tr">${Math.round(mgmtAmt).toLocaleString()}</td>
      <td></td></tr>`;sIdx++;
  }
  if(pDesign>0){
    const dMode=pExtras.designMode||'fixed';
    const dName=dMode==='pct'?`設計規劃製圖費(${pExtras.designPct}%)`:'設計製圖費';
    const dUnit=dMode==='unit'?'坪':'式';
    const dQty=dMode==='unit'?pExtras.designQty:1;
    const dPrice=dMode==='unit'?Math.round(pExtras.designPrice).toLocaleString():Math.round(pDesign).toLocaleString();
    p1+=`<tr><td class="tc">${NUM_ZH[sIdx]||sIdx+1}</td><td>${dName}</td>
      <td class="tc">${dUnit}</td><td class="tc">${dQty}</td>
      <td class="tr">${dPrice}</td>
      <td class="tr">${Math.round(pDesign).toLocaleString()}</td>
      <td></td></tr>`;sIdx++;
  }
  for(const m of (pExtras.miscItems||[])){
    const mAmt=Math.round((m.qty||1)*(m.price||0));
    if(mAmt>0){
      p1+=`<tr><td class="tc">${NUM_ZH[sIdx]||sIdx+1}</td><td>${m.name||'（未命名）'}</td>
        <td class="tc">${m.unit||'式'}</td><td class="tc">${m.qty||1}</td>
        <td class="tr">${Math.round(m.price||0).toLocaleString()}</td>
        <td class="tr">${mAmt.toLocaleString()}</td>
        <td></td></tr>`;sIdx++;
    }
  }
  if(pIns>0){
    p1+=`<tr><td class="tc">${NUM_ZH[sIdx]||sIdx+1}</td><td>工程保險費</td>
      <td class="tc">式</td><td class="tc">1</td>
      <td class="tr">${Math.round(pIns).toLocaleString()}</td>
      <td class="tr">${Math.round(pIns).toLocaleString()}</td>
      <td></td></tr>`;
  }
  p1+=`</tbody><tfoot>
    <tr class="total-row"><td colspan="5" class="tr" style="border:0.5pt solid #aaa">合　計</td><td class="tr">${Math.round(beforeTax).toLocaleString()}</td><td style="border:0.5pt solid #aaa"></td></tr>
    <tr class="tax-row"><td colspan="5" class="tr" style="border:0.5pt solid #aaa">營業稅5%</td><td class="tr">${Math.round(tax).toLocaleString()}</td><td style="border:0.5pt solid #aaa"></td></tr>
    <tr class="grand-row"><td colspan="5" class="tr" style="border:0.5pt solid #aaa">總　金　額</td><td class="tr">${Math.round(total).toLocaleString()}</td><td style="border:0.5pt solid #aaa"></td></tr>
  </tfoot></table>
  <div class="pd-remarks"><strong>備　註</strong><br>
    ${[...remarksItems,...(projDuration>0?['建議工期為'+projDuration+'天']:[])].map((r,i)=>`${i+1}. ${r}`).join('<br>\n    ')}
  </div></div>`;

                  // PAGE 2+: entire detail in ONE table, full header in <thead> for auto-repeat
  let detailNum=1; sIdx=0;
  const metaLine=(name?'工程名稱：'+name:'')+(client?'　業主：'+client:'')+(addr?'　工程地址：'+addr:'');

  const theadHTML=''
    +'<thead>'
    +'<tr><td colspan="7" style="border:none;padding:0 0 4pt 0;height:44pt">'
    +makePageHeader(name,client,addr,date,true,email)
    +'</td></tr>'
    // Section title row
    +'<tr><td colspan="7" style="border:none;padding:4pt 0 2pt;text-align:center;font-size:13pt;font-weight:700;letter-spacing:3pt;color:#c0392b">報 價 明 細 表</td></tr>'
    +'</thead>';

  let p2='<div class="pd pd-page-break">'
    +'<table class="pd-detail-table" style="width:100%;border-collapse:collapse;font-size:9pt">'
    +theadHTML
    +'<tbody>';

  sections.forEach(([cat,items])=>{
    detailNum=1; // 每個大項重新從1開始
    const catTotal=items.reduce((s,i)=>s+i.qty*i.price,0);
    p2+='<tr><td colspan="7" style="border:none;padding:6pt 0 2pt;font-size:10.5pt;font-weight:700;border-bottom:0.5pt solid #888">'+( NUM_ZH[sIdx]||sIdx+1)+'、'+cat+'</td></tr>';
    p2+='<tr style="background:#ebebeb">'+'<th style="border:0.5pt solid #888;padding:3pt 4pt;text-align:center;font-size:8pt;width:26pt">項次</th>'+'<th style="border:0.5pt solid #888;padding:3pt 4pt;text-align:center;font-size:8pt">名稱與說明</th>'+'<th style="border:0.5pt solid #888;padding:3pt 4pt;text-align:center;font-size:8pt;width:25pt">單位</th>'+'<th style="border:0.5pt solid #888;padding:3pt 4pt;text-align:center;font-size:8pt;width:30pt">預估數量</th>'+'<th style="border:0.5pt solid #888;padding:3pt 4pt;text-align:center;font-size:8pt;width:55pt">單　價</th>'+'<th style="border:0.5pt solid #888;padding:3pt 4pt;text-align:center;font-size:8pt;width:62pt">複　價</th>'+'<th style="border:0.5pt solid #888;padding:3pt 4pt;text-align:center;font-size:8pt;width:55pt">備　註</th>'+'</tr>';
    items.forEach(item=>{
      p2+='<tr>'
        +'<td style="border:0.5pt solid #aaa;padding:3pt 4pt;text-align:center">'+detailNum+'</td>'
        +'<td style="border:0.5pt solid #aaa;padding:3pt 4pt">'+item.name+'</td>'
        +'<td style="border:0.5pt solid #aaa;padding:3pt 4pt;text-align:center">'+item.unit+'</td>'
        +'<td style="border:0.5pt solid #aaa;padding:3pt 4pt;text-align:center">'+item.qty+'</td>'
        +'<td style="border:0.5pt solid #aaa;padding:3pt 4pt;text-align:right">'+Math.round(item.price).toLocaleString()+'</td>'
        +'<td style="border:0.5pt solid #aaa;padding:3pt 4pt;text-align:right">'+Math.round(item.qty*item.price).toLocaleString()+'</td>'
        +'<td style="border:0.5pt solid #aaa;padding:3pt 4pt;width:55pt;word-break:break-all;white-space:normal;font-size:7.5pt">'+(item.note||'')+'</td></tr>';
      detailNum++;
    });
    p2+='<tr style="background:#f5f5f5">'
      +'<td colspan="5" style="border:0.5pt solid #777;padding:3pt 4pt;text-align:right;font-weight:600">小　計</td>'
      +'<td style="border:0.5pt solid #777;padding:3pt 4pt;text-align:right;font-weight:600">'+Math.round(catTotal).toLocaleString()+'</td>'
      +'<td style="border:0.5pt solid #777;padding:3pt 4pt"></td>'
      +'</tr>'
      +'<tr><td colspan="7" style="border:none;padding:3pt 0"></td></tr>';
    sIdx++;
  });

  p2+='</tbody></table></div>';
  return p1+p2;
}

function doPrint(){
  const doc=document.getElementById('printDoc');
  doc.innerHTML=buildPrintDoc();
  const name=document.getElementById('projName').value||'未命名工程';
  const date=document.getElementById('projDate').value||new Date().toISOString().split('T')[0];
  const origTitle=document.title;
  document.title='宇德報價單_'+name+'_'+date;
  window.print();
  setTimeout(()=>{doc.innerHTML='';document.title=origTitle;},1000);
}



async function exportToExcel(){
  if(!quoteItems.length){alert('請先加入工項再匯出');return;}

  const name=document.getElementById('projName').value||'新工程';
  const client=document.getElementById('projClient').value||'';
  const addr=document.getElementById('projAddr').value||'';
  const date=document.getElementById('projDate').value||new Date().toISOString().split('T')[0];
  const {mgmtPct,beforeTax,tax,total}=getCalc();
  const grouped=getSections();
  const sections=Object.entries(grouped);
  const pExtras=getExtraItems();
  const {clean:pClean,design:pDesign,insurance:pIns}=pExtras;
  const pMgmtAmt=pExtras.mgmtBase*(mgmtPct/100);

  // ── Style helpers ──
  const tb=(c='AAAAAA')=>({style:'thin',color:{rgb:c}});
  const mb=(c='000000')=>({style:'medium',color:{rgb:c}});
  function s(fill,font,align,border){
    const o={};
    if(fill) o.fill={fgColor:{rgb:fill},patternType:'solid'};
    if(font) o.font=Object.assign({name:'Arial'},font);
    if(align) o.alignment=align;
    if(border) o.border=border;
    return o;
  }
  const bAll={top:tb(),bottom:tb(),left:tb(),right:tb()};
  const bTopMed={top:mb(),bottom:tb(),left:tb(),right:tb()};
  const bTopBotMed={top:mb(),bottom:mb(),left:tb(),right:tb()};

  const ST={
    co:    s('F2F2F2',{sz:8,color:{rgb:'444444'}},{horizontal:'left',vertical:'center',wrapText:false},null),
    title: s('C0392B',{bold:true,sz:15,color:{rgb:'FFFFFF'}},{horizontal:'center',vertical:'center'},null),
    meta:  s(null,{sz:10},{horizontal:'left',vertical:'center'},null),
    date:  s(null,{sz:10},{horizontal:'right',vertical:'center'},null),
    hdr:   s('DCDCDC',{bold:true,sz:9},{horizontal:'center',vertical:'center'},bAll),
    cHdr:  s('EBEBEB',{bold:true,sz:10},{horizontal:'left',vertical:'center'},bAll),
    dL:    s(null,{sz:9},{horizontal:'left',vertical:'center'},bAll),
    dC:    s(null,{sz:9},{horizontal:'center',vertical:'center'},bAll),
    dR:    s(null,{sz:9},{horizontal:'right',vertical:'center'},bAll),
    dRB:   s(null,{bold:true,sz:9},{horizontal:'right',vertical:'center'},bAll),
    sub:   s('F5F5F5',{bold:true,sz:9},{horizontal:'right',vertical:'center'},bAll),
    tot:   s('F9F9F9',{bold:true,sz:10},{horizontal:'right',vertical:'center'},bTopMed),
    grand: s('FFF3F3',{bold:true,sz:12,color:{rgb:'C0392B'}},{horizontal:'right',vertical:'center'},bTopBotMed),
    remL:  s('F9F8F6',{bold:true,sz:9},{horizontal:'left',vertical:'center'},bAll),
    remN:  s('F9F8F6',{sz:9},{horizontal:'center',vertical:'center'},bAll),
    remB:  s(null,{sz:9},{horizontal:'left',vertical:'center',wrapText:true},bAll),
    blank: s(null,{sz:8},null,null),
  };

  function sc(ws,r,c,st){
    const a=XLSX.utils.encode_cell({r,c});
    if(!ws[a]) ws[a]={t:'z',v:''};
    ws[a].s=st;
  }
  function scRow(ws,r,styles){styles.forEach((st,c)=>{if(st)sc(ws,r,c,st);});}
  function scRange(ws,r0,r1,c0,c1,st){for(let r=r0;r<=r1;r++)for(let c=c0;c<=c1;c++)sc(ws,r,c,st);}
  function nfmt(ws,r,c){const a=XLSX.utils.encode_cell({r,c});if(ws[a]&&typeof ws[a].v==='number')ws[a].z='#,##0';}
  function pgSetup(ws){
    ws['!pageSetup']={paperSize:9,orientation:'portrait',fitToPage:true,fitToWidth:1,fitToHeight:0};
    ws['!margins']={left:0.47,right:0.47,top:0.59,bottom:0.79,header:0.2,footer:0.2};
  }

  const COLS=[{wch:5},{wch:48},{wch:6},{wch:8},{wch:12},{wch:13},{wch:18}];
  const CO_TXT='宇德室內裝修股份有限公司  TEL: (02)2652-2112  台北市忠孝東路六段70巷21弄2號  E-mail: shower.li@yutesign.com';

  function buildHeader(rows,merges,r,titleTxt){
    rows.push([CO_TXT,'','','','','','']);  merges.push({s:{r,c:0},e:{r,c:5}});
    rows.push([titleTxt,'','','','','','']); merges.push({s:{r:r+1,c:0},e:{r:r+1,c:6}});
    rows.push(['工程名稱：'+name+(client?'　　業主：'+client:''),'','','','日期：',date,'']); merges.push({s:{r:r+2,c:0},e:{r:r+2,c:3}});
    rows.push(['工程地址：'+(addr||''),'','','','','','']); merges.push({s:{r:r+3,c:0},e:{r:r+3,c:6}});
  }
  function styleHeader(ws,r){
    scRange(ws,r,r,0,6,ST.co);
    scRange(ws,r+1,r+1,0,6,ST.title);
    scRow(ws,r+2,[ST.meta,ST.meta,ST.meta,ST.meta,ST.date,ST.date,ST.meta]);
    scRange(ws,r+3,r+3,0,6,ST.meta);
  }

  const WB=XLSX.utils.book_new();

  // 7 columns matching PDF: 項次 | 名稱與說明 | 單位 | 預估數量 | 單價 | 複價 | 備註

  // Build the 4-row header block; r = 0-based starting row index
  function makeHeaderBlock(titleText, r, merges){
    const rows=[];
    const co='宇德室內裝修股份有限公司  TEL: (02)2652-2112  台北市忠孝東路六段70巷21弄2號  E-mail: shower.li@yutesign.com';
    rows.push([co,'','','','','','']);
    merges.push({s:{r,c:0},e:{r,c:5}});
    rows.push([titleText,'','','','','','']);
    merges.push({s:{r:r+1,c:0},e:{r:r+1,c:6}});
    rows.push(['工程名稱：'+name+(client?'　　業主：'+client:''),'','','','日期：',date,'']);
    merges.push({s:{r:r+2,c:0},e:{r:r+2,c:3}});
    rows.push(['工程地址：'+(addr||''),'','','','','','']);
    merges.push({s:{r:r+3,c:0},e:{r:r+3,c:6}});
    return rows;
  }

  // ── SHEET 1: 工程報價單 ──
  const s1=[]; const s1m=[];
  makeHeaderBlock('工 程 報 價 單',0,s1m).forEach(r=>s1.push(r));
  // Column headers (row 4)
  s1.push(['項次','名稱與說明','單位','預估數量','單    價','複      價','備     註']);

  // Category summary rows
  let sIdx=0;
  sections.forEach(([cat,items])=>{
    const catTotal=items.reduce((s,i)=>s+i.qty*i.price,0);
    s1.push([NUM_ZH[sIdx]||String(sIdx+1), cat, '式', 1, Math.round(catTotal), Math.round(catTotal), catNotes[cat]||'']);
    sIdx++;
  });
  // Extra items (matching PDF page 1)
  if(pClean>0){
    const cMode=pExtras.cleanMode||'unit';
    const cUnit=cMode==='fixed'?'式':'坪';
    const cQty=cMode==='fixed'?1:(pExtras.cleanQty||0);
    const cPrice=cMode==='fixed'?Math.round(pClean):Math.round(pExtras.cleanPrice||0);
    s1.push([NUM_ZH[sIdx]||String(sIdx+1),'施工區域完工後清潔',cUnit,cQty,cPrice,Math.round(pClean),'']);
    sIdx++;
  }
  if(mgmtPct>0){
    s1.push([NUM_ZH[sIdx]||String(sIdx+1),'監工管理費('+mgmtPct+'%)','式',1,Math.round(pMgmtAmt),Math.round(pMgmtAmt),'']);
    sIdx++;
  }
  if(pDesign>0){
    const dMode=pExtras.designMode||'fixed';
    const dName=dMode==='pct'?'設計規劃製圖費('+pExtras.designPct+'%)':'設計製圖費';
    const dUnit=dMode==='unit'?'坪':'式';
    const dQty=dMode==='unit'?pExtras.designQty:1;
    const dPrice=dMode==='unit'?Math.round(pExtras.designPrice):Math.round(pDesign);
    s1.push([NUM_ZH[sIdx]||String(sIdx+1),dName,dUnit,dQty,dPrice,Math.round(pDesign),'']);
    sIdx++;
  }
  for(const m of (pExtras.miscItems||[])){
    const mAmt=Math.round((m.qty||1)*(m.price||0));
    if(mAmt>0){
      s1.push([NUM_ZH[sIdx]||String(sIdx+1),m.name||'（未命名）',m.unit||'式',m.qty||1,Math.round(m.price||0),mAmt,'']);
      sIdx++;
    }
  }
  if(pIns>0){
    s1.push([NUM_ZH[sIdx]||String(sIdx+1),'工程保險費','式',1,Math.round(pIns),Math.round(pIns),'']);
  }
  // Total rows — A:E merged for label, F = amount
  const totalRowBase=s1.length;
  s1.push(['合     計','','','','',Math.round(beforeTax),'']);
  s1m.push({s:{r:totalRowBase,c:0},e:{r:totalRowBase,c:4}});
  s1.push(['營業稅5%','','','','',Math.round(tax),'']);
  s1m.push({s:{r:totalRowBase+1,c:0},e:{r:totalRowBase+1,c:4}});
  s1.push(['總　金　額','','','','',Math.round(total),'']);
  s1m.push({s:{r:totalRowBase+2,c:0},e:{r:totalRowBase+2,c:4}});
  // Remarks
  const remBase=s1.length;
  s1.push(['備　註',1,'本估價不含建築物主管機關室內裝修送審。','','','','']);
  s1.push(['',2,'本報價單有效期限為一個月（自報價日起算）。','','','','']);
  s1.push(['',3,'本工程內容以報價明細表為主，圖面僅供參考，無法現場勘查或需求不清楚者，其實際施作項目及數量依現場環境及尺寸修正。','','','','']);
  s1.push(['',4,'本工程工地管理不含業主自行分包之廠商管理。','','','','']);
  for(let i=0;i<4;i++) s1m.push({s:{r:remBase+i,c:2},e:{r:remBase+i,c:6}});

  const ws1=XLSX.utils.aoa_to_sheet(s1);
  ws1['!cols']=COLS;
  ws1['!rows']=[{hpt:50},{hpt:26},{hpt:22},{hpt:22},{hpt:26}];
  ws1['!merges']=s1m;
  XLSX.utils.book_append_sheet(WB,ws1,'報價單');

  // ── SHEET 2: 報價明細表 ──
  const s2=[]; const s2m=[];
  makeHeaderBlock('報 價 明 細 表',0,s2m).forEach(r=>s2.push(r));

  sIdx=0;
  sections.forEach(([cat,items])=>{
    const catTotal=items.reduce((s,i)=>s+i.qty*i.price,0);
    // Category heading row (spans all 7 cols)
    const catRow=s2.length;
    s2.push([(NUM_ZH[sIdx]||String(sIdx+1))+'、'+cat,'','','','','','']);
    s2m.push({s:{r:catRow,c:0},e:{r:catRow,c:6}});
    // Column headers for this section
    s2.push(['項次','名稱與說明','單位','預估數量','單    價','複      價','備     註']);
    // Items — numbered from 1 per category (matching PDF)
    items.forEach((item,idx)=>{
      s2.push([
        idx+1,
        item.name,
        item.unit,
        item.qty,
        Math.round(item.price),
        Math.round(item.qty*item.price),
        item.note||''
      ]);
    });
    // Subtotal row
    const subRow=s2.length;
    s2.push(['小　計','','','','',Math.round(catTotal),'']);
    s2m.push({s:{r:subRow,c:0},e:{r:subRow,c:4}});
    // Spacer
    s2.push(['','','','','','','']);
    sIdx++;
  });

  const ws2=XLSX.utils.aoa_to_sheet(s2);
  ws2['!cols']=COLS;
  ws2['!rows']=[{hpt:50},{hpt:26},{hpt:22},{hpt:22}];
  ws2['!merges']=s2m;
  XLSX.utils.book_append_sheet(WB,ws2,'明細表');

  // Download
  const fname='宇德報價單_'+name+'_'+date+'.xlsx';
  const wbout=XLSX.write(WB,{bookType:'xlsx',type:'array',cellStyles:true});
  const dlBlob=new Blob([wbout],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  if(window.showSaveFilePicker){
    try{
      const fh=await window.showSaveFilePicker({suggestedName:fname,types:[{description:'Excel 試算表',accept:{'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':['.xlsx']}}]});
      const writable=await fh.createWritable();
      await writable.write(dlBlob);
      await writable.close();
      return;
    }catch(e){if(e.name==='AbortError')return;}
  }
  const dlURL=URL.createObjectURL(dlBlob);
  const dlA=document.createElement('a');
  dlA.href=dlURL; dlA.download=fname; dlA.click();
  setTimeout(()=>URL.revokeObjectURL(dlURL),1000);
}


function drawLogoToBase64(){
  const canvas = document.createElement('canvas');
  canvas.width = 200;
  canvas.height = 200;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,200,200);

  const cx=100, cy=105;
  ctx.strokeStyle='#2a2a2a';
  ctx.lineWidth=5;
  ctx.fillStyle='rgba(0,0,0,0)';

  // Hexagon
  ctx.beginPath();
  for(let i=0;i<6;i++){
    const angle=(Math.PI/180)*(60*i-30);
    const x=cx+78*Math.cos(angle);
    const y=cy+78*Math.sin(angle);
    i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
  }
  ctx.closePath();
  ctx.stroke();

  // Roof line (house shape inside)
  ctx.beginPath();
  ctx.moveTo(38,90);
  ctx.lineTo(100,38);
  ctx.lineTo(162,90);
  ctx.stroke();

  // Chimney
  ctx.beginPath();
  ctx.moveTo(100,38);
  ctx.lineTo(100,22);
  ctx.lineWidth=7;
  ctx.stroke();
  ctx.lineWidth=5;

  // Door frame left bracket
  ctx.beginPath();
  ctx.moveTo(55,90);
  ctx.lineTo(55,155);
  ctx.moveTo(55,90);
  ctx.lineTo(62,90);
  ctx.moveTo(55,155);
  ctx.lineTo(62,155);
  ctx.stroke();

  // Door frame right bracket
  ctx.beginPath();
  ctx.moveTo(145,90);
  ctx.lineTo(145,155);
  ctx.moveTo(145,90);
  ctx.lineTo(138,90);
  ctx.moveTo(145,155);
  ctx.lineTo(138,155);
  ctx.stroke();

  // Door (open, 3D perspective)
  ctx.lineWidth=3;
  // Door back face
  ctx.beginPath();
  ctx.moveTo(80,95);
  ctx.lineTo(80,150);
  ctx.lineTo(115,150);
  ctx.lineTo(115,95);
  ctx.closePath();
  ctx.fillStyle='#555';
  ctx.fill();
  ctx.stroke();

  // Door front face (open at angle)
  ctx.beginPath();
  ctx.moveTo(80,95);
  ctx.lineTo(68,100);
  ctx.lineTo(68,153);
  ctx.lineTo(80,150);
  ctx.closePath();
  ctx.fillStyle='#888';
  ctx.fill();
  ctx.strokeStyle='#ccc';
  ctx.stroke();

  // Door knob
  ctx.strokeStyle='#2a2a2a';
  ctx.fillStyle='#ccc';
  ctx.beginPath();
  ctx.arc(110,125,4,0,Math.PI*2);
  ctx.fill();

  return canvas.toDataURL('image/png');
}

// Draw once at startup, store globally
let LOGO_DATA_URL = '';
function initLogo(){
  try { LOGO_DATA_URL = drawLogoToBase64(); } catch(e){ LOGO_DATA_URL=''; }
}

async function exportJSON(){
  if(!quoteItems.length){alert('請先加入工項再匯出');return;}
  const name=document.getElementById('projName').value||'未命名工程';
  const date=document.getElementById('projDate').value||new Date().toISOString().split('T')[0];
  const saveData=Object.assign({version:1,savedAt:new Date().toISOString()},getQuoteData());
  const json=JSON.stringify(saveData,null,2);
  const fileName=`宇德報價_${name}_${date}.json`;
  let actualFileName = fileName;
  if(window.showSaveFilePicker){
    try{
      const fh=await window.showSaveFilePicker({
        suggestedName:fileName,
        types:[{description:'JSON 報價檔',accept:{'application/json':['.json']}}]
      });
      actualFileName = fh.name; // 使用者在存檔視窗可能改過檔名，取實際名稱
      const writable=await fh.createWritable();
      await writable.write(json);
      await writable.close();
    }catch(e){if(e.name==='AbortError')return;}
  } else {
    const blob=new Blob([json],{type:'application/json'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download=fileName;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  // JSON 下載僅作本機備份，不觸發雲端版本通知。
}

async function importJSON(){
  let text;
  if(window.showOpenFilePicker){
    try{
      const [fh]=await window.showOpenFilePicker({
        types:[{description:'JSON 報價檔',accept:{'application/json':['.json']}}]
      });
      const file=await fh.getFile();
      text=await file.text();
    }catch(e){if(e.name==='AbortError')return; throw e;}
  }else{
    text=await new Promise((res,rej)=>{
      const input=document.createElement('input');
      input.type='file';input.accept='.json';
      input.onchange=e=>{
        const file=e.target.files[0];if(!file)return res(null);
        const reader=new FileReader();
        reader.onload=ev=>res(ev.target.result);
        reader.onerror=rej;
        reader.readAsText(file);
      };
      input.click();
    });
    if(!text)return;
  }
  try{
    const data=JSON.parse(text);
    if(!data.quoteItems){alert('檔案格式不正確');return;}
    if(!confirm('載入「'+(data.projName||'未命名工程')+'」？目前的報價內容會被取代。'))return;
    currentDriveFileId=null;
    lastFolderModifiedTime=null;
    document.getElementById('projName').value=data.projName||'';
    document.getElementById('projClient').value=data.projClient||'';
    document.getElementById('projAddr').value=data.projAddr||'';
    document.getElementById('projDate').value=data.projDate||'';
    document.getElementById('mgmtFee').value=data.mgmtFee||5;
    if(document.getElementById('projEmail'))document.getElementById('projEmail').value=data.projEmail||'';
    quoteItems=(data.quoteItems||[]).map(item=>({...item,id:item.id||(Date.now()+Math.random())}));
    catNotes=data.catNotes||{};
    if(data.remarksItems)remarksItems=[...data.remarksItems];
    projDuration=data.projDuration||0;
    renderRemarks();
    miscItems=data.miscItems||[];
    renderMiscItems();
    if(data.extraCleanMode&&document.getElementById('extraCleanMode')){document.getElementById('extraCleanMode').value=data.extraCleanMode;toggleCleanMode();}
    if(data.extraCleanQty!==undefined&&document.getElementById('extraCleanQty'))document.getElementById('extraCleanQty').value=data.extraCleanQty;
    if(data.extraCleanPrice!==undefined&&document.getElementById('extraCleanPrice'))document.getElementById('extraCleanPrice').value=data.extraCleanPrice;
    if(data.extraCleanFixed!==undefined&&document.getElementById('extraCleanFixed'))document.getElementById('extraCleanFixed').value=data.extraCleanFixed;
    if(data.extraDesignMode&&document.getElementById('extraDesignMode')){document.getElementById('extraDesignMode').value=data.extraDesignMode;toggleDesignMode();}
    if(data.extraDesignFixed!==undefined&&document.getElementById('extraDesignFixed'))document.getElementById('extraDesignFixed').value=data.extraDesignFixed;
    if(data.extraDesignPct!==undefined&&document.getElementById('extraDesignPct'))document.getElementById('extraDesignPct').value=data.extraDesignPct;
    if(data.extraDesignQty!==undefined&&document.getElementById('extraDesignQty'))document.getElementById('extraDesignQty').value=data.extraDesignQty;
    if(data.extraDesignPrice!==undefined&&document.getElementById('extraDesignPrice'))document.getElementById('extraDesignPrice').value=data.extraDesignPrice;
    if(data.extraInsurance!==undefined&&document.getElementById('extraInsurance'))document.getElementById('extraInsurance').value=data.extraInsurance;
    customSectionOrder=data.customSectionOrder||null;
    reviewedIds=new Set(data.reviewedIds||[]);
    renderQuote();
  }catch(e){alert('檔案讀取失敗：'+e.message);}
}

