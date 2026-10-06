# 公司開銷模組化對應表（Gate 1 規劃稿）

基準為 `main@38986cf`（已部署）。分支 `claude/ops-overhead-modularize` 建在 `claude/agents-deploy-log-20261006e` 上，比基準多三筆文件紀錄（AGENTS.md、known-issues.md）。本輪只做唯讀盤點，沒有修改程式檔案。

公司開銷影響金額：分潤的公司開銷分攤、成本控制都會讀取每月固定與變動開銷，費用核准也會連動「固定開銷」。所以這批只做原文搬移，公式、資料與連動規則一個字都不改。

## Gate 1：公司開銷拆分對應表

新增目標檔案：`ops/js/modules/overhead.js`

`ops/index.html` 第 4769–5228 行是一整段連續區塊，原樣整段搬移，順序不變。所有名稱維持全域，不加入 `export`、IIFE 或命名空間。

### 搬入 overhead.js

| 段落 | 行號 | 內容 |
|---|---|---|
| 開銷資料 | 4769–4830 | `// OVERHEAD DATA` 標題；`OH_WATER_ELECTRIC_SPLIT_MONTH`、`OH_LEGACY_FIXED_ITEMS`、`OH_FIXED_ITEMS`、`OH_FIXED_CONFIG`、`OVERHEAD`、`ohVarNextId`；`ohMigrateWaterElectricSplit`（水電拆分遷移） |
| 月份 | 4831–4897 | `// OVERHEAD MODULE` 標題；`ohMonthLabel`、`ohAddMonthsAround`、`ohAddFutureMonths`、`ohRenderMonthOptions`、`ohInitMonth`、`ohPreviousMonthData` |
| 費用↔固定開銷連動 | 4898–4947 | `ohFixedExpenseMatchName`、`expApprovedFixedOverheadByMonthItem`、`OH_FIXED_EXPENSE_REVIEW_FROM`、`ohFixedExpenseReviewList`、`expRebuildFixedOverheadLinks` |
| 頁面與編輯 | 4948–5228 | `renderOverhead`、`ohUpdateFixed`、`ohUpdateNote`、`ohResolveFixedExpenseReview`、`ohDeleteFixedItem`（兩次，見下）、`ohRenameFixedItem`、`ohCopyFixedFromPrevMonth`、`ohAddFixedItem`、`ohPromptAddFixed`、`ohPromptAddMonth`、`ohDeleteVar`、`submitAddOverhead`、`openAddOverheadModal` |

共 24 個函式宣告（23 個名稱）、8 個頂層資料宣告。這段單獨解析語法正確，只有函式與 `const`／`let` 宣告，沒有其他頂層敘述。

### 同名函式 `ohDeleteFixedItem`

原檔第 5098 行與第 5120 行各宣告一次 `ohDeleteFixedItem`。classic script 以後宣告的為準，所以目前實際生效的是第 5120 行那一個。兩個會照原文、照原順序一起搬，生效的仍是後面那個，行為不變。

驗證腳本目前用「函式名稱」逐一比對，遇到同名會互相蓋掉。這批會改成依出現順序比對：第 1 個對第 1 個、第 2 個對第 2 個。整檔逐字比對本來就涵蓋兩者。

這個重複宣告不在本批修正（多出的那個實際上沒有作用），會記到 `docs/known-issues.md`。

### 為什麼資料宣告可以一起搬

前例是「費用」與「薪資」批次，資料和功能一起搬。這批的情況是：

- **初始值都不依賴外部**：8 個資料宣告的初始值都是固定字串、陣列、空物件，或只引用同一區塊的 `OH_FIXED_ITEMS`。
- **只會變得更早宣告**：新位置（`payroll.js` 之後）比原位置（最後一個 inline script 的開頭）更早執行。
- **外部都是執行期才用**：`data.js` 的存檔／讀檔與遷移（`ohMigrateWaterElectricSplit`、`OVERHEAD`、`OH_FIXED_CONFIG`、`ohVarNextId`）、`payables.js`（`OVERHEAD`、`OH_FIXED_CONFIG`、`ohInitMonth`、`renderOverhead`）、`expenses.js`（`OVERHEAD`、`ohInitMonth`、`renderOverhead`、`ohAddFutureMonths`）、`attendance.js`（`ohAddFutureMonths`），以及仍留在 index.html 的分潤／成本控制，都在執行期才使用。

### 載入位置

`<script src="js/modules/overhead.js"></script>` 放在 `payroll.js` 之後、剩餘 legacy inline script 之前。

區塊外的呼叫全部發生在執行期：`navTo`、`renderCurrentPage`、`applyRole`、`applyDefaultPeriodForPage`、`data.js` 的 `renderAll`、應付與費用模組，以及 HTML 的 onclick／onchange。

## 留在原處、不搬移

| 位置 | 保留內容與理由 |
|---|---|
| `ops/js/core/data.js` | 開銷的存檔／讀檔、雲端合併（`opsCloudMergeOverhead` 等） |
| `ops/index.html` 5229 起 | 分潤（`PROFIT SHARE DATA`）、稅務、成本控制，不在本批 |
| `ops/index.html` 1135 | 側欄「公司開銷」 |
| `ops/index.html` 1726–1793 | `page-overhead` 靜態 HTML |
| `ops/index.html` 3640 起 | `modal-add-overhead` |
| CSS | 維持原 cascade，不拆 |

## 跨模組相依保護（驗證腳本會檢查）

- 新增本批基準 `38986cf`：`overhead.js` 必須等於第 4769–5228 行原文加標題，24 個函式宣告依序逐字一致。
- `navTo`、`renderCurrentPage`、`applyRole`、`refreshAccountingLinkedViews`、`applyDefaultPeriodForPage`、`psComputeData` 不因本批改動。
- 搬走的函式與 8 個資料宣告不得仍留在 index.html。

## 實作與驗證順序

1. 建立 `overhead.js`，從 `ops/index.html` 移除 4769–5228，加入 `<script>` 載入行。
2. 更新驗證腳本（含同名函式依序比對），執行並做故意改字的反向測試。
3. 本機 HTTP smoke test：mock Firebase、攔截外部請求、時鐘固定。同一套測試在 `main@38986cf` 與新分支各跑一次，逐項結果與最後的雲端資料必須逐字相同。涵蓋：
   - 月份選單、新增月份。
   - 固定開銷：編輯金額與備註、新增、改名、刪除項目、複製上月。
   - 變動開銷：新增、刪除。
   - 月合計金額（獨立重算）。
   - 費用核准後連動到固定開銷的審核清單。
   - 權限：完整管理、無權限。
   - 存檔後重新載入。
4. 重跑其他五套 smoke test。
5. 正式資料唯讀比對：記錄 OVERHEAD 月數、固定／變動合計與四大集合基準。不做任何正式寫入。
6. 單一 commit 推上 feature 分支，提交 Gate 2 證據後停下來等核准。
