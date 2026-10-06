# OPS 模組化與修正：工作摘要與 Codex 複查提示詞

## 一、精簡說明（2026-10-05 ～ 10-06）

### 目的
把原本 17,419 行、所有功能塞在一起的 `ops/index.html` 拆成小檔案。這是為了接下來用 Figma 重新設計介面，以及開發手機／平板 app。

### 拆檔（全部完成並已上線，正式版 `main@954bdaf`）

| 批次 | 新檔案 | 函式數 | 上線版本 |
|---|---|---|---|
| 客戶／廠商 | `clients.js`、`vendors.js` | 5／11 | `c9c78dd` |
| 出勤打卡 | `attendance.js` | 53 | `81b208c` |
| 廠商請款 | `payreq.js` | 11 | `9ab4749` |
| 問題回報／系統筆記／員工 | `feedback.js`、`systemnotes.js`、`employees.js` | 14／3／3 | `0ef422c` |
| 薪資（含老闆提領） | `payroll.js` | 35 | `38986cf` |
| 公司開銷 | `overhead.js` | 24 | `e602f72` |
| 淨利潤儀表板（成本控制表） | `profit.js`（原地替換 inline script） | 10 | `4318c73` |
| 稅務管理 | `tax.js` | 12 | `3bf6549` |
| 分潤（最後一批） | `profitshare.js`（原地替換 inline script） | 28 | `954bdaf` |

更早的批次（共用基礎、應收、應付、費用、案件）在本階段之前已完成。

拆檔原則：
- 所有搬移都是逐字搬移，不改任何邏輯、公式、欄位、權限。
- 畫面 HTML 與 CSS 依 2026-09-23 核准的決定，仍留在 `index.html`。

結果：
- `ops/index.html` 剩 4,425 行（−75%），只有畫面、樣式與 24 個系統骨架函式。
- 業務程式分布在 `ops/js/core/`（5 檔）與 `ops/js/modules/`（16 檔）。

### 功能修正

已上線：
- 廠商可刪除（有應付紀錄或系統內建的廠商不可刪）。
- 應付帳款的受款廠商下拉依代碼排序。
- 請款「申請人」以名字或帳號 ID 都能比對到本人，「申請自己」的人可以看到並重送自己的請款；編輯視窗的儲存鈕不再卡住。

**尚未上線（`claude/fix-known-issues`，`cb34f04`）**：`docs/known-issues.md` 的 5 項。
1. 新員工在全新瀏覽器可以登入：本機名單找不到時，從雲端員工主檔確認身分。
2. 新增廠商時狀態預設為「有效」。
3. 刪除薪資月份後月份不再跑回清單，並寫入審計紀錄；2026-07、2026-09 的錯誤刪除標記會由遷移程式移除。
4. 薪資流水號依最大編號 + 1 推算。
5. 刪除公司開銷裡沒有作用的重複函式。

### 驗證工具（都在 `scripts/`）

**逐字驗證：`verify-ops-modularization.mjs`**
- 各批次的搬移內容都和基準 commit 逐字比對。
- 拆檔後刻意修改的函式登記在 `POST_SPLIT_CHANGES`。
- 會檢查載入順序，並把 `index.html` 的內嵌函式固定為 24 個骨架函式。

**9 套 smoke test**
- 共用 `smoke-lib.mjs`：本機 HTTP、模擬 Firebase／Google 登入、攔截所有外部請求、固定時鐘。
- 每批都在新分支與 main 各跑一次，逐項結果與最終模擬資料必須逐字相同。
- 金額類測試用獨立公式重算後比對。

**正式資料唯讀摘要：`ops-prod-readonly-summary.js`**
- 只做一次 `get()` 讀取。

### 正式資料原則
- 只做唯讀檢查，從未由自動化寫入正式 Firebase。
- 每次部署前由使用者手機匯出備份並核對。
- 部署後做唯讀比對：每一批的筆數、金額與畫面數字都和部署前一致。

## 二、給 Codex 的提示詞

```text
你是這個 repo（showerli-glitch/yute-quotation，本機 ~/宇德OPS app開發）的獨立複查者。請完整重跑並複查
Claude 在 2026-10-05～10-06 對 OPS 做的模組化拆檔與修正，最後給我一份「可以 / 不可以進入 app 開發」的結論。

【先讀】
1. AGENTS.md（全部，特別是 Required execution gates、Safe-change and validation rules、Progress log 後半段）
2. docs/gate-*-mapping.md（每批的 Gate 1 對應表）、docs/known-issues.md、docs/codex-full-review.md

【狀態確認】
- main 應為 954bdaf（已部署到 GitHub Pages）；claude/fix-known-issues 應包含 cb34f04（程式修正）與其後加入本文件的 commit，未合併、未部署。
- 用 curl 比對 https://showerli-glitch.github.io/yute-quotation/ 上的 ops/ 檔案與 main 是否逐字一致。

【靜態驗證】（在 main 與 claude/fix-known-issues 各跑一次）
- node scripts/verify-ops-modularization.mjs → 應為 PASS。
  - main：537 個函式逐字一致，6 個登記在案的刻意修改。
  - fix 分支：532 個函式逐字一致，10 個刻意修改，公司開銷少 1 個重複宣告。
- JSON.parse(firebase-database.rules.json)、git diff --check。
- 不要只相信這支驗證腳本。請至少挑兩批，自己用 git show <基準commit>:ops/index.html 擷取 Gate 1 文件寫的行號範圍：
  - 一批一般批次，例如 payroll.js 對 0ef422c 第 6441–7388 行。
  - 一批原地替換批次，例如 profitshare.js 對 3bf6549 第 4424–5436 行。
  和現在的模組檔比對，確認逐字一致（只差檔頭註解）。
- 檢查 POST_SPLIT_CHANGES 裡登記的每個刻意修改都有合理理由，沒有把不該改的東西藏在裡面。

【smoke test】
- 在 repo 外安裝：mkdir /tmp/ops-smoke && cd /tmp/ops-smoke && npm i playwright-core
- 需要 Chrome：預設 /Applications/Google Chrome.app，否則設定 CHROME_PATH。
- 執行：PLAYWRIGHT_CORE=/tmp/ops-smoke/node_modules/playwright-core/index.mjs node scripts/smoke-<名稱>.mjs <label> <repo路徑> <port> <out.json>
- 9 套名稱：clients-vendors, attendance, payreq, feedback-notes-employees, payroll, overhead, profit, tax, profitshare
- 預期結果：
  - fix 分支：135/135、58/58、52/52、47/47（1 則預期警告：故意上傳非圖片）、36/36、28/28、20/20、22/22、24/24，共 422 項。
  - main：clients-vendors 134/135、feedback-notes-employees 43/47、payroll 33/36，失敗的正好是 5 項修正對應的檢查；其他套全過。
- 請確認 smoke test 真的攔截了所有外部請求（看輸出 JSON 的 blockedExternal 與 mockedExternal），完全沒有連到正式 Firebase。

【程式複查】（git diff main..claude/fix-known-issues -- ops/）
- 登入修正（ops/js/core/data.js 的 opsInitGoogleAuth）：
  - 確認沒有放寬權限：仍要求在職、Email 相符、開通角色不是 none。
  - 未開通時會登出 Firebase、撤銷 token、不寫本機快取。
  - 非 @yutesign.com 帳號不會讀雲端。
  - 對照 firebase-database.rules.json，確認沒有新增任何讀寫能力。
- 薪資：prDeleteMonth、applyDataSnapshot 的 2026-07／2026-09 遷移、prNextId 推算（applyDataSnapshot 與 ensureCodexSeedData）。
  - 遷移只移除「仍有薪資紀錄」的那兩個月。
  - 確認不會影響種子資料、雲端合併（opsCloudMergePayrollExtras）與其他月份。
- 廠商 openVendorModal、公司開銷移除重複宣告：確認行為和說明一致。
- 也請抽查已上線的修正：
  - claude/vendor-delete-and-sort：deleteVendor、應付下拉排序。
  - claude/payreq-applicant-fix：userCanViewCaseScopedRow 等。

【正式資料】
- 只能唯讀。不得新增、修改、刪除正式 Firebase 任何資料，也不得代替使用者輸入密碼登入。
- 若已有登入中的正式頁面，可在 console 執行 scripts/ops-prod-readonly-summary.js（只做一次 get()），
  把結果和 AGENTS.md 最後記錄的部署後數字比對。
  - 若 meta.savedAt 有變，差異必須能用同事的正常操作解釋。
- 沒有登入就略過這一步並註明。

【禁止】
- 不要合併到 main、不要 push main、不要部署、不要修改正式資料。
- 若發現問題，只回報與提出修正建議；需要修改程式時，另開 codex/ 分支，不要動現有分支。

【回報格式】
1. 結論：可以 / 不可以進入 app 開發（以及 claude/fix-known-issues 是否可以合併部署）。
2. 發現的問題：依嚴重度排序，每項附檔案:行號、重現方式、建議。
3. 每項驗證的實際結果，需和上面的預期數字逐一對照。
```

## 三、之後的順序
1. Codex 複查通過後，部署 `claude/fix-known-issues`：照慣例先手機備份，再合併、部署，做部署後唯讀比對。
2. 開始 app 開發：Figma 新介面，以及手機／平板版。可以一個模組一個模組地接到新介面。
