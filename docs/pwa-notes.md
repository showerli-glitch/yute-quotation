# PWA 開發筆記（交接用）

更新：2026-10-07。給新對話接手手機／平板版用。先讀 `CLAUDE.md`、`AGENTS.md`，再讀這份。

## 1. 目標與已確定的事

- 目標：讓 OPS 方便在手機、平板操作。使用者已選 **PWA**：同一個網站，可以加到主畫面，不做原生 app。
- 拆檔已完成（`main` 已部署）：`ops/index.html` 只剩 HTML、CSS 和 24 個系統骨架函式；業務程式在 `ops/js/core/`（5 檔）與 `ops/js/modules/`（16 檔）。
- 以後的開發和維護希望在雲端（claude.ai/code）進行，方便跨裝置。雲端沒有使用者已登入的 Chrome，部署前後的正式資料比對要靠使用者匯出的備份。
- 已知問題 #1、#6 暫緩，不要主動處理（見 `docs/known-issues.md`）。

## 2. 兩版畫面提案

| | Claude | Codex |
|---|---|---|
| 工具 | Claude Design（Artifact 畫布） | Figma |
| 連結 | https://claude.ai/artifact/Ji6Keq7tdLRWCMn23zMzwh | https://www.figma.com/design/iiR14nnNz4T4FGPw0RxYfk （只有 6 個元件，畫面在 PDF） |
| PDF | 共用雲端硬碟 `宇德公用資料/宇德系統/手機、平板PWA/宇德 OPS PWA claude code畫面架構.pdf`（9 頁） | 同資料夾 `Yutesign_OPS_PWA_Codex_Independent_Proposal.pdf`（5 頁） |
| 畫面 | 手機：首頁、打卡、費用申請、廠商請款、審核中心、更多；平板：淨利潤儀表、應付帳款（左清單右明細） | 手機：今日、案件、打卡；平板：管理者工作台 |

### 主要差異

- **底部分頁**
  - Codex：所有人都是「今天／案件／財務／我的」，權限只決定畫面裡出現哪些動作。
  - Claude：依角色不同。
    - 員工：首頁／打卡／＋申請／我的／更多
    - 財務：首頁／審核／收付／報表／更多
    - 老闆：首頁／審核／案件／報表／更多
- **首頁**：兩版幾乎一樣，都是「今天先處理什麼」、快速動作、待辦卡。Codex 的「今日優先 N 件、N 件已逾期」寫法比較好。
- **涵蓋範圍**：Codex 沒畫輸入表單（費用、請款）、審核中心、更多、平板應付。
- **視覺**
  - Codex：深綠配螢光黃綠，對比強。
  - Claude：米色配咖啡金，比較安靜。

### Claude 的建議（使用者尚未決定）

1. 首頁和視覺用 Codex 的：「今天」寫法、逾期提示、配色。
2. 分頁用 Codex 的四個，再加兩個調整：
   - 沒有財務權限的人隱藏「財務」分頁。
   - 員工首頁的快速動作第一顆固定是打卡。
3. 費用申請、廠商請款、審核中心、平板應付用 Claude 的版本，它們直接對應現有模組。
4. 案件卡不加新欄位，見第 4 節。

### 等使用者決定

1. 底部分頁要「大家一樣的四個」，還是「依角色不同」？
2. 視覺要深綠配黃綠，還是米色配咖啡金？
3. 合併版設計稿要用 Claude Design 還是 Figma？

決定後的下一步：先畫合併版設計稿給使用者確認，再開始寫程式。

## 3. 設計規格（參考值）

- Claude 版：
  - 色票：背景 `#F6F4EF`；文字 `#1D1C1A`；次要文字 `#55524C`；框線 `#E3DED3`；主色 `#7A5C25`；主色淡底 `#F3EBDC`；成功 `#2F6B4F`；危險 `#A23B2A`；警示底 `#FBEFD9`。
  - 字體：Noto Sans TC，金額用 DM Mono。
  - 尺寸：手機框 390×844、平板框 1180×820；觸控目標至少 44px；底部分頁高 76px。
- Codex 版（從 PDF 目測，非精確值）：
  - 色票：深綠約 `#123D33`；螢光黃綠約 `#D9F25A`；米白底約 `#F2F1EA`；逾期紅字；狀態色有黃（待結算）、淡綠、淡紫、橘四個入口色。
  - 字體：Noto Sans TC，金額和代碼用等寬字。
  - 卡片：白底、圓角約 16px、淡灰框。
- 現有 OPS 的字體是 Noto Sans TC、DM Mono、Playfair Display。

## 4. 資料的實際狀況（設計時不要假設不存在的欄位）

- **案件**
  - 狀態：進行中／待開工／完工／結案。
  - 個案總覽的百分比是**收款進度**（已收 ÷ 合約金額），不是施工進度。
  - 沒有「下一步」欄位。若要施工進度或下一步，屬於新功能，會改資料結構，要另外核准。
- **廠商請款**：申請人 `person` 存的是**名字**。費用申請的 `person` 存的是**員工 id**。
- **待審核來源**
  - 廠商請款：PAYABLES 的 pending。
  - 費用：EXPENSES 的 pending。
  - 出勤補登：ATTENDANCE_RECORDS 的待審手動紀錄。
- **打卡**：GPS 打卡、請假、補登都在 `ops/js/modules/attendance.js`。辦公室座標可校正；超出範圍不能打卡。
- **權限**
  - `USER_PERMISSIONS[員工id][模組] = 等級`。
  - 等級有 manage／view_all／view_all_apply_self／view_self_apply_self／view_profit_cases_apply_self／view_self／view_profit_cases／none。
  - 「新增案件」另外看 `canCreateCase`。
  - 新畫面必須沿用同一套權限判斷，不能放寬。
- **模組（18 頁）**：dashboard 個案總覽、payreq 廠商請款、payable 應付、receivable 應收、expense 費用、overhead 公司開銷、tax 稅務、payroll 薪資、profit 成本控制表、profitshare 淨利潤儀表、attendance 出勤、contract 合約（開發中）、quotation 報價（外部連結）、feedback 問題回報、systemnotes 系統規則筆記、employees 員工、clients 客戶、vendors 廠商。

## 5. 技術限制與要先想清楚的事

- **不改資料契約**：不改快照格式、欄位名稱、金額公式。正式資料是一份完整快照（`ops/yutesign/snapshot`），每次存檔寫整份。
- **離線**
  - 存檔是整份快照，第一次連線時「雲端快照一定贏」。
  - 所以離線排隊送出（例如離線打卡）不能只是把整份快照晚點送，否則會撞到衝突視窗，或被雲端蓋掉。
  - 離線功能要單獨設計，第一版建議只做「離線可開啟、顯示上次資料，連線後才能送出」。
- **快取**
  - `index.html` 引用的 js 沒有版本號。2026-10-07 部署時觀察到新 HTML 配舊 js，登入鈕卡在「載入中...」，GitHub Pages 約 10 分鐘快取才會更新。
  - 做 service worker 時要一起處理：給檔案加版本號、新版上線時提示重新整理。現有程式有 `opsCheckForNewVersion`／新版橫幅可以沿用。
- **改法選擇（尚未決定）**
  - 方案一：在現有 `ops/index.html` 加手機版的 CSS 和底部分頁。
  - 方案二：另開手機版入口，重用 `ops/js/core` 與 `ops/js/modules` 的函式。
  - 兩者都要保留現有桌面版行為。
  - 頁面 HTML 目前是寫死在 `index.html` 的大段標記，手機版若要不同版型，可能需要先把個別頁面的畫面抽成可重用的產生函式。這要先列對照表給使用者核准（比照拆檔的 Gate 1）。
- **登入**：Google 帳號 → Firebase。PWA 加到主畫面後，iOS 的獨立視窗開 Google 登入彈窗可能有問題，要實機測。
- **建議先做**：首頁加打卡（員工最常用、手機需求最高），再做費用和請款表單，最後是審核和平板頁。

## 6. 規則（摘要，完整在 `CLAUDE.md`）

- 繁體中文回覆。`claude/*` 分支可以直接推。
- 合併 main、部署、寫入正式 Firebase、改 Firebase 規則都要先問，並先請使用者備份、核對數字。
- 正式資料只能讀；測試只用模擬雲端（`scripts/smoke-*.mjs`，基準 427 項）。改到既有函式要登記在 `scripts/verify-ops-modularization.mjs` 的 `POST_SPLIT_CHANGES`。
