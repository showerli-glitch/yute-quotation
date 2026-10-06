# 稅務管理模組化對應表（Gate 1 規劃稿）

基準為 `main@4318c73`（已部署）。分支 `claude/ops-tax-modularize` 建在 `claude/agents-deploy-log-20261006g` 上，比基準多一筆 AGENTS.md 紀錄。本輪只做唯讀盤點，沒有修改程式檔案。

稅務管理頁做的事：
- 依應收發票試算營業稅預留、依年度顯示稅務負債，並可新增、編輯、刪除稅務負債（`TAX_LIABILITIES`）。
- 原始碼註明「read-only reconciliation; never posts to profit/overhead/cost」：它不會寫入分潤、開銷或成本。

這批只做原文搬移，稅額公式一個字都不改。

## Gate 1：拆分對應表

新增目標檔案：`ops/js/modules/tax.js`

`ops/index.html` 第 4977–5180 行是一整段連續區塊，原樣整段搬移，順序不變。所有名稱維持全域。

### 搬入 tax.js

| 段落 | 行號 | 內容 |
|---|---|---|
| 狀態 | 4977–4981 | `// TAX MANAGEMENT` 標題；`TAX_SELECTED_YEAR`、`TAX_EDIT_ID` |
| 工具與試算 | 4983–5021 | `taxEscape`、`taxMoney`、`taxVatReserve`（營業稅預留）、`taxVatPeriodKey`（申報期別）、`taxAvailableYears` |
| 操作 | 5022–5092 | `taxSelectYear`、`taxStartEdit`、`taxCancelEdit`、`taxSaveLiability`、`taxDeleteLiability`、`taxOpenIncomeEstimate` |
| 頁面 | 5093–5180 | `renderTaxManagement` |

共 12 個函式、2 個頂層 `let`。這段單獨解析語法正確，沒有其他頂層敘述。

### 載入位置與安全性

`<script src="js/modules/tax.js"></script>` 放在 `overhead.js` 之後、剩餘 legacy inline script（分潤）之前。

- 兩個狀態變數的初始值是空字串與 `null`，只在這段裡使用。
- 搬移後只會更早宣告。
- `renderTaxManagement` 由 `navTo`、`renderCurrentPage`、`refreshAccountingLinkedViews` 在執行期呼叫；其他函式由 `renderTaxManagement` 產生的 HTML 按鈕呼叫。沒有其他模組呼叫。

## 留在原處、不搬移

| 位置 | 保留內容與理由 |
|---|---|
| `ops/js/core/data.js` | `TAX_LIABILITIES`、`CODEX_SEED_TAX_LIABILITIES`、稅務負債同步（`syncTaxLiabilityForPayable`）、雲端逐筆合併設定 |
| `ops/index.html` 4424–4976 | 分潤資料與 `psComputeData`（最後一批） |
| `ops/index.html` 5182 起 | 分潤頁（最後一批） |
| `ops/index.html` 1138 | 側欄「稅務管理」 |
| `ops/index.html` 2067–2069 | `page-tax` 容器（內容由 `renderTaxManagement` 產生） |

## 跨模組相依保護（驗證腳本會檢查）

- 新增本批基準 `4318c73`：`tax.js` 必須等於第 4977–5180 行原文加標題，12 個函式逐字一致。
- `navTo`、`renderCurrentPage`、`applyRole`、`refreshAccountingLinkedViews`、`psComputeData` 不因本批改動。
- 搬走的函式與 2 個狀態變數不得仍留在 index.html。

## 實作與驗證順序

1. 建立 `tax.js`，從 `ops/index.html` 移除 4977–5181（含後方空行），加入 `<script>` 載入行。
2. 更新驗證腳本，執行並做故意改字的反向測試。
3. 本機 HTTP smoke test：mock Firebase、攔截外部請求、時鐘固定。同一套測試在 `main@4318c73` 與新分支各跑一次，逐項結果與最後的雲端資料必須逐字相同。涵蓋：
   - 頁面渲染與年度切換。
   - 營業稅預留：用固定測試發票獨立重算 `taxVatReserve` 與申報期別。
   - 稅務負債的新增、編輯、取消、刪除，以及必填檢查。
   - 所得稅試算視窗。
   - 權限：完整管理、無權限。
   - 存檔後重新載入。
4. 重跑其他七套 smoke test。
5. 正式資料唯讀比對：記錄 TAX_LIABILITIES 筆數與金額、四大集合基準，並唯讀讀取稅務頁的主要數字。不做任何正式寫入。
6. 單一 commit 推上 feature 分支，提交 Gate 2 證據後停下來等核准。
