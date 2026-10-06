// SYSTEM NOTES MODULE. Extracted verbatim from ops/index.html at main@4e42a53.

const SYSTEM_NOTES = [
  {
    id:'family-project-rules',
    category:'特殊案件',
    status:'已寫入系統',
    title:'親友工程／成本轉付以現況個案規則為準',
    source:'李鎮宇確認／2026-06-28 對帳規則',
    body:'親友工程比照一般個案入帳：應付列廠商工程成本，應收由使用者手動建立，成本控制表看損益；差異只是不進員工分潤。',
    items:['虎林街住家已匯入：向哥哥收 1,450,000，工程成本以應付帳款明細 38 筆為準，已結案。','玉成街親友工程：廠商應付成本 9 筆合計 158,129；系統不預設合約金額，使用者若收回成本才手動建立應收。','私人借支／股東員工往來：公司付款列往來款資產，返還時沖銷，不進損益或分潤。','哥哥直付 15,800 不進公司帳；洗衣機鐵架 2,100 由公司善意負擔。']
  },
  {
    id:'maintenance-parent-case',
    category:'修繕案件',
    status:'已寫入系統',
    title:'Suzuki／Volvo 長期維修母案',
    source:'Codex/OPS工作筆記_2026-06-15.md',
    body:'同客戶多據點維修不應關閉母案；應使用「客戶母案 → 據點 → 每次修繕工單」結構，並標示保固內無償、保固內廠商負擔、保固外收費或善意無償。',
    items:['保固工單需連回原工程案與保固起訖日。','民族進水管更新正確金額 9,450。','新莊 Volvo 廁所門鎖正確金額 1,155。']
  },
  {
    id:'subcontractor-invoice-agent',
    category:'代開發票',
    status:'資料已匯入',
    title:'小張代開發票與宇德工程成本要分開',
    source:'Codex/應收應付待匯入清單_2026-06-15.md',
    body:'小張直接向宇德客戶報價施工時，宇德向客戶開發票收款，再以發票金額約除以 1.1 支付小張。2026-06-25 已先以不分潤特殊個案匯入，後續仍需正式交易類型。',
    items:['同案場可能同時有宇德承攬成本與小張直接對客戶報價。','代開發票已匯入：應付小張 5 筆合計 42,030；應收 2 筆合計實收 48,805。','中和通馬桶 1,800 保留為未收回成本／放棄對客請款，不建立客戶應收。']
  },
  {
    id:'yude-company-staging',
    category:'暫存分類',
    status:'已寫入系統',
    title:'宇德公司不是正式會計分類',
    source:'Codex/宇德公司暫存分類清單_2026-06-16.md',
    body:'案名為宇德公司的資料必須逐筆拆分為工程獎金、親友成本轉付、固定開銷、稅務／會計費、私人借支或實際工程成本，不能直接進損益。',
    items:['玉成街 9 筆合計 158,129 已歸入玉成街親友工程；應收／收款由使用者手動建立，不再由應付自動生成，也不預設合約總額。','李秋惠私人借支／支票借用 6 筆合計 596,000 已歸入「私人借支」不分潤個案；還款時手動建立應收。','修繕、維修與代開發票仍依個案看損益；私人借支只追蹤往來款餘額，不進成本控制損益或分潤。','上洋高雄 3 筆成本：柏實 7,300、柏實 25,000、丹墨整合 3,000 已補入。']
  },
  {
    id:'tax-liability',
    category:'稅務',
    status:'待開發',
    title:'營業稅／營所稅列稅務負債，不進一般公司開銷',
    source:'Codex/系統規則與計算.md',
    body:'個案毛利中的稅務成本是分潤估算用的稅務保留；實際營業稅、營所稅付款應列稅務負債／繳稅紀錄，避免公司淨利與分潤重複扣稅。',
    items:['會計師記帳費、帳務整理費可列公司開銷。','營業稅依發票日歸入固定雙月申報期；缺發票日列待歸期。','營所稅正式預留只讀已鎖定分潤結算；未結算個案僅顯示預估。','稅務管理只開放李鎮宇與 Ning，且不回寫淨利潤、公司開銷或個案成本。']
  },
  {
    id:'rent-link',
    category:'公司開銷',
    status:'部分已寫入',
    title:'房租付款要連動公司固定開銷',
    source:'Codex/宇德公司暫存分類清單_2026-06-16.md',
    body:'房租付款應建立付款紀錄並連結公司開銷固定支出，不可再新增一筆變動開銷，避免重複計入公司開銷。系統目前只在款項性質為固定開銷付款連結時才連動，避免案場房租誤寫入公司固定開銷。',
    items:['2026-06 李秋惠 5 月房租 30,000 已以固定開銷付款連結匯入。','後續仍需完整固定開銷管理介面。']
  },
  {
    id:'profit-negative-gross',
    category:'分潤',
    status:'已寫入系統',
    title:'負毛利個案不分攤公司開銷，但虧損由分潤人承擔',
    source:'Codex/系統規則與計算.md',
    body:'公司開銷只由正毛利個案依毛利比例分攤；毛利為負的個案開銷佔比與開銷金額為 0。若稅後個案淨利為負，仍依各分潤比例列為人員分潤／承擔。',
    items:['這是為將來真實虧損案件預先建立的規則。','負數代表專案負責人需承擔虧損或由後續分潤抵扣。']
  },
  {
    id:'payable-sensitive-type',
    category:'權限',
    status:'已寫入系統',
    title:'應付帳款款項性質為財務敏感欄位',
    source:'Codex/系統規則與計算.md',
    body:'款項性質只給 OWNER／FINANCE／ACCOUNTING 角色顯示；專案、設計、行政角色即使可查看應付帳款，也不顯示分潤預領、私人借支、親友成本轉付、稅務負債等標籤。',
    items:['員工管理已新增系統權限角色欄位。','正式 Google 登入後，以員工 Email 對應角色與功能權限。']
  },
  {
    id:'attendance-payroll',
    category:'出勤薪資',
    status:'部分已寫入',
    title:'打卡系統併入 OPS 並產生薪資草稿',
    source:'Codex/系統規則與計算.md',
    body:'打卡資料不直接覆蓋正式薪資；先產生薪資草稿、請假扣款、加班費與異常清單，經財務／主管覆核後才寫入薪資單。OPS 已有打卡、GPS、請假與紀錄編輯；完整薪資草稿自動生成仍待補。',
    items:['鄭詩褣為老闆娘／財務管理者，免打卡。','彭俞豪與連星羽獨立作業，月領金額視為預支自己分潤，免打卡。','孫一宣與陳虹君已離職，系統登入、打卡、分潤資格與新增資料人員選單停用；歷史薪資與費用資料保留。','每日在公司 9 小時，含午休 1 小時，正常工時認列 8 小時。','原則打卡區間 7:40-18:00，最晚上班時間先設定 9:00。','下班彈性 10 分鐘；每月累計超過 30 分鐘扣全勤 1,000。','忘記打卡由鄭詩褣核准；允許工地打卡並保存 GPS、案場與審核狀態。','薪資扣款基礎建議先採月薪 / 30 / 8。']
  },
  {
    id:'leave-law',
    category:'出勤薪資',
    status:'規則已確認',
    title:'請假與加班以勞基法為最低標準',
    source:'全國法規資料庫：勞動基準法／勞工請假規則',
    body:'公司制度只能優於法令，不可低於法令。請假以小時計算，出勤紀錄需逐日記載至分鐘並保存五年。',
    items:['普通病假一年未超過 30 日部分，工資折半。','事假一年合計不得超過 14 日，事假期間不給工資。','公假工資照給，假期視實際需要。','特休依年資給假，6 個月至 1 年 3 日，1 至 2 年 7 日，2 至 3 年 10 日，最高 30 日。','平日加班前 2 小時加給 1/3，再延長 2 小時加給 2/3。']
  },
  {
    id:'in-progress-five-cases',
    category:'進行中個案',
    status:'規則已確認',
    title:'五個近期個案先維持進行中，不進入分潤結算',
    source:'Codex/進度清單.md',
    body:'張總雖已完工收款，仍比照其他四案維持進行中；待 2026-07-10 前員工費用申請及可能新增廠商請款完整後再評估結算。',
    items:['板橋張總 D7-15F：已收 1,500,000，暫估毛利 514,725。','板橋林協理 D7-10F：已收 1,200,000，尚未與業主確認最後追加減及最終應收。','板橋安庭 E2-15F：6 月滑軌鉸鍊把手 5,429 待付款資訊補齊。','UNI MUSIC、上洋高雄仍為進行中追蹤，不可結算分潤。']
  },
  {
    id:'warranty-retention',
    category:'保固款',
    status:'已寫入系統',
    title:'保固款未入帳前不列入毛利與分潤',
    source:'Codex/系統規則與計算.md',
    body:'保固款由應收帳款新增收款紀錄，款項類型選保固保留款。尚未入帳前，只顯示待收／逾期／已收狀態，不提前列入已收毛利或可分潤金額。',
    items:['上洋嘉義保固款 450,000，預計 2026-08-05。','上洋鶯歌保固款 564,000，預計 2027-02-05。']
  },
  {
    id:'launch-blockers',
    category:'正式上線',
    status:'正式上線前',
    title:'正式上線前必須完成登入、同步與資料切換',
    source:'Codex/進度清單.md',
    body:'OPS 已是 Google 登入加 Firebase snapshot 的正式雲端同步；大量輸入前以 Firebase snapshot 為資料正本，左下角需顯示已讀取／已同步後再大量輸入。',
    items:['Firebase 規則已改為白名單與公司路徑控管，不可退回只用 auth != null。','正式切換日前資料作為期初匯入，切換日後新資料只輸入 OPS。','v1.0.97 起初始化期間的本機修改會先保留待同步 snapshot；但正式大量輸入仍應等左下角顯示雲端已同步。','下載資料備份只匯出 JSON，不改雲端；上傳本機快照會覆蓋 Firebase 共用正本，只能在確認本機資料正確且已先備份後使用。','完成進行中個案核對，確認已收、已付、待收、待付、成本與毛利差額為 0。']
  },
  {
    id:'pending-data',
    category:'待補資料',
    status:'待補資料',
    title:'目前仍待補或待確認的資料',
    source:'Codex/OPS工作筆記_2026-06-15.md',
    body:'這些項目保留在系統規則筆記中，避免被當成已完成資料匯入或正式損益。',
    items:['李秋惠 2026-05-11 借用支票 149,200：支票號碼與歸還狀態待補。','連星羽宇德公司暫存 7,634：保留來源差異註記，不覆蓋分潤結清款。','板橋安庭 5,429：廠商、銀行及單據資訊待補。','應收／應付試算表若要重新匯入，需讀取已修正的最新版，不使用舊錯位資料。']
  },
  {
    id:'production-data-boundary',
    category:'正式上線',
    status:'正式上線前',
    title:'正式資料邊界：Firebase 是正本，seed 只能補空白',
    source:'AGENTS.md / AI 協作防呆檢查',
    body:'正式上線後，Firebase snapshot 是資料正本；HTML 內的 INIT、CODEX_SEED、測試 fixture、歷史補丁與預設資料不可默默覆蓋既有主檔、交易、費用、應收、應付或分潤資料。',
    items:['seed 僅可做空白初始化、補缺漏欄位或明確 migration。','若需要修正正式資料，優先從系統 UI 修改並同步，或建立有名稱、有來源、有審計紀錄的 migration。','清除資料、匯入備份、Codex 補丁都必須先備份，並確認不會把測試資料變成正式資料來源。']
  },
  {
    id:'fixture-summary-detail-rule',
    category:'正式上線',
    status:'正式上線前',
    title:'彙總列與逐筆明細不可並存計算',
    source:'AGENTS.md / 費用與成本匯入規則',
    body:'費用、親友成本轉付、應收、應付、公司開銷與分潤資料，只能有一個正式金額來源。若逐筆明細已存在，原則留明細、移除被取代的彙總列，避免毛利、成本或分潤重複計算。',
    items:['2026 費用匯入是明細替換，不是疊加。','親友、私人借支、維修與代開案若已有應收／應付明細，不可再保留同案同用途的總額列一起計算。','歷史彙總可保留作為註記或追溯來源，但不得進正式加總。','同案同金額的應收或應付新增時，系統應提示檢查是否重複；提示只提醒，不直接阻擋。']
  },
  {
    id:'field-contract-rule',
    category:'正式上線',
    status:'正式上線前',
    title:'欄位 contract：不可為了畫面自創正式欄位',
    source:'AGENTS.md / AI 協作防呆檢查',
    body:'新欄位必須先定義名稱、來源、可寫角色、計算方式與顯示用途，才能進入正式資料。畫面需要資料時，不得臨時自創欄位並讓使用者以為已支援正式流程。',
    items:['正式欄位需能追到來源：使用者輸入、試算表匯入、Firebase、系統計算或 migration。','顯示用推導欄位只能即時計算，不應混入正式交易資料。','涉及帳務、權限、稅務、分潤、出勤薪資的新欄位，一律先寫入系統規則筆記或 AGENTS.md。']
  },
  {
    id:'business-date-rule',
    category:'正式上線',
    status:'正式上線前',
    title:'日期來源：帳務日期不可由今天日期自動猜',
    source:'AGENTS.md / AI 協作防呆檢查',
    body:'createdAt、updatedAt、審計紀錄可用系統時間；但帳期、付款日、入帳日、發票日、結算日、結案日、薪資月份等業務日期必須由資料來源或使用者確認。',
    items:['批次費用可預設當月方便填寫，但送出前月份與日期仍視為使用者確認。','分潤結算日與結案日不得因重刷或今天日期不同而改變。','匯入歷史資料時，日期以來源表為準，不用系統今天日期補正式值。']
  },
  {
    id:'amount-single-source-rule',
    category:'正式上線',
    status:'正式上線前',
    title:'正式金額要有唯一來源，前端計算只能依正式資料',
    source:'AGENTS.md / AI 協作防呆檢查',
    body:'OPS 是純前端 SPA，目前合約、應收、廠商成本、費用、稅務保留、公司開銷與分潤多由前端依資料即時計算；因此正式資料來源必須乾淨，不能把未審核、dry-run、測試或被取代的彙總列拿來算正式帳。',
    items:['畫面可以即時計算與格式化，但計算規則要寫在系統規則筆記。','未審核費用、待審核廠商請款、測試回報不應進正式毛利或分潤。','金額小數與四捨五入規則要一致，避免試算表與 OPS 尾差擴大。']
  },
  {
    id:'dry-run-session-control',
    category:'正式上線',
    status:'正式上線前',
    title:'dry-run、內測與多 AI session 要有總控邊界',
    source:'AGENTS.md / AI 協作防呆檢查',
    body:'dry-run、內測、Codex 匯入、資料補丁與正式輸入必須可區分；多個 AI 或多視窗協作時，以 AGENTS.md 與系統規則筆記為總控邊界，不能各自假設資料規則。',
    items:['另一個 session 若新增規則或分類，先回寫 AGENTS.md 或系統規則筆記，再修改正式資料。','dry-run operation log 不可被正式 read flow 當成已入帳資料。','任何會影響正式資料的修改，都要先確認可備份、可回復、有審計紀錄。']
  }
];

function snStatusColor(status) {
  return {
    '已寫入系統':'var(--success)',
    '資料已匯入':'var(--success)',
    '部分已寫入':'var(--blue)',
    '規則已確認':'var(--accent)',
    '待補資料':'var(--warning)',
    '待開發':'var(--blue)',
    '正式上線前':'var(--error)'
  }[status] || 'var(--text3)';
}

function snResetFilters() {
  ['sn-search','sn-filter-category','sn-filter-status'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  renderSystemNotes();
}

function renderSystemNotes() {
  const grid = document.getElementById('sn-grid');
  if (!grid) return;
  const catEl = document.getElementById('sn-filter-category');
  if (catEl && catEl.options.length <= 1) {
    [...new Set(SYSTEM_NOTES.map(n => n.category))].sort((a,b)=>a.localeCompare(b,'zh-Hant')).forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      catEl.appendChild(opt);
    });
  }
  const statusEl = document.getElementById('sn-filter-status');
  if (statusEl && statusEl.options.length <= 1) {
    [...new Set(SYSTEM_NOTES.map(n => n.status))].forEach(status => {
      const opt = document.createElement('option');
      opt.value = status;
      opt.textContent = status;
      statusEl.appendChild(opt);
    });
  }
  const kw = (document.getElementById('sn-search')?.value || '').trim().toLowerCase();
  const category = catEl?.value || '';
  const status = statusEl?.value || '';
  const rows = SYSTEM_NOTES.filter(n => {
    const haystack = `${n.category} ${n.status} ${n.title} ${n.body} ${n.source} ${(n.items||[]).join(' ')}`.toLowerCase();
    return (!category || n.category === category) && (!status || n.status === status) && (!kw || haystack.includes(kw));
  });
  const summary = document.getElementById('sn-summary');
  if (summary) {
    const written = SYSTEM_NOTES.filter(n => ['已寫入系統','資料已匯入','部分已寫入'].includes(n.status)).length;
    const pending = SYSTEM_NOTES.filter(n => ['待補資料','待開發','正式上線前'].includes(n.status)).length;
    summary.innerHTML = [
      ['全部筆記', SYSTEM_NOTES.length, 'var(--accent)'],
      ['已寫入', written, 'var(--success)'],
      ['待處理', pending, 'var(--warning)'],
    ].map(([label,val,color]) => `
      <div class="kpi-card" style="padding:10px 12px">
        <div class="kpi-label" style="font-size:10px">${label}</div>
        <div style="font-size:18px;font-weight:800;color:${color}">${val}</div>
      </div>`).join('');
  }
  if (!rows.length) {
    grid.innerHTML = `<div class="card" style="padding:28px;text-align:center;color:var(--text3);grid-column:1/-1">沒有符合條件的系統筆記</div>`;
    return;
  }
  grid.innerHTML = rows.map(n => `
    <div class="card" style="padding:16px;display:flex;flex-direction:column;gap:10px">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px">
        <div>
          <div style="font-size:13px;font-weight:800;line-height:1.5">${tfEsc(n.title)}</div>
          <div style="font-size:10px;color:var(--text3);margin-top:3px">${tfEsc(n.source)}</div>
        </div>
        <div style="display:flex;gap:6px;align-items:center;flex-shrink:0">
          <span class="tag tag-client" style="font-size:10px">${tfEsc(n.category)}</span>
          <span class="tag" style="font-size:10px;color:${snStatusColor(n.status)};border-color:${snStatusColor(n.status)}">${tfEsc(n.status)}</span>
        </div>
      </div>
      <div style="font-size:12px;color:var(--text2);line-height:1.7">${tfEsc(n.body)}</div>
      ${(n.items||[]).length ? `<ul style="margin:0;padding-left:18px;color:var(--text3);font-size:12px;line-height:1.7">${n.items.map(it => `<li>${tfEsc(it)}</li>`).join('')}</ul>` : ''}
    </div>
  `).join('');
}
