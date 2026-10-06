# 分潤模組化對應表（Gate 1 規劃稿，最後一批）

基準為 `main@3bf6549`（已部署）。分支 `claude/ops-profitshare-modularize` 建在 `claude/agents-deploy-log-20261006h` 上，比基準多一筆 AGENTS.md 紀錄。本輪只做唯讀盤點，沒有修改程式檔案。

分潤是風險最高的模組，原因有三：
- 結算（`psRunSettlement`）會依案件毛利、公司開銷分攤、薪資與稅率計算每人分潤並產生分潤應付款；撤銷結算（`psUndoSettlement`）會反向處理。
- 正式資料有歷史結算紀錄 `PROFIT_SETTLEMENTS`。
- 應付、費用、薪資、稅務、案件都會呼叫分潤的函式。

這批只做原文搬移，公式、比例、結算與撤銷規則一個字都不改。

## Gate 1：拆分對應表

新增目標檔案：`ops/js/modules/profitshare.js`

### 原地替換最後一個 inline script

`ops/index.html` 第 4423–5437 行是最後一個 `<script>…</script>`，接在 `tax.js` 之後，裡面只有分潤程式。做法與成本控制表批次相同：

- 把第 4424–5436 行（script 內容）逐字搬進 `profitshare.js`。
- 把第 4423–5437 行原地換成一行 `<script src="js/modules/profitshare.js"></script>`。

載入位置不變，仍是最後一個載入、在 `</body>` 之前。所有宣告與兩個讀取 localStorage 的初始值，執行時機都和現在完全相同。

### 搬入 profitshare.js

| 段落 | 原行號 | 內容 |
|---|---|---|
| 分潤資料 | 4424–4495 | `// PROFIT SHARE DATA` 標題與分潤原則註解；`PROFIT_SPLIT_RATIOS`、`PROFIT_SHARE_PERSON_NAMES`、`PS_TAX_RATE`、`PROFIT_SETTLEMENTS`、`PS_SELECTED_CASES`、`PS_OH_START`／`PS_OH_END`、`PS_INITIAL_OVERHEAD_LOCKED_THROUGH`；`psParticipantList`、`psPersonName`、`psRatioLabel`、`psCaseSettlementCutoff`、`psIsProfitSettlementCase` |
| 結算設定與執行 | 4496–4731 | `psSettlementCutoffMonth`、`psAvailableOverheadMonths`、`psNormalizeOhRange`、`psSetTaxRate`、`psToggleCase`、`psSetOhRange`、`psRunSettlement`、`psUndoSettlement`、`psGetSplitRatio`、`psSetRatio`、`psOpenProfitParticipantModal`、`psSetProfitMode` |
| 已付與待付 | 4732–4819 | `psPersonPaidTotal`、`isProfitSharePayout`、`psProfitPayoutBelongsToCurrentBatch`、`psUnsettledProfitPayables`、`psPayrollBreakdown`、`psPayrollSum`、`psOutstandingPostCloseAdjustments` |
| 計算核心 | 4820–4977 | `psComputeData` |
| 頁面 | 4978–5436 | `// PROFIT SHARE MODULE` 標題；`psPayoutSettledCollapsed`、`psOhFutureCollapsed`（載入時讀 localStorage）；`psTogglePayoutSettled`、`psToggleOhFuture`、`renderProfitShare` |

共 28 個函式（沒有同名）、9 個頂層 `const`／`let`（`PS_OH_START, PS_OH_END` 為同一行宣告）。這段單獨解析語法正確，沒有其他頂層敘述。

### 外部相依（全部在執行期，名稱不變）

- `renderProfitShare`：`data.js`、`cases.js`、`employees.js`、`expenses.js`、`payables.js`、`payreq.js`、`payroll.js`，以及 `navTo`／`renderCurrentPage`／`refreshAccountingLinkedViews`。
- `psParticipantList`、`psPersonName`：`payables.js`、`payroll.js`。
- `psIsProfitSettlementCase`：`payables.js`；`psGetSplitRatio`：`expenses.js`；`psCaseSettlementCutoff`：`tax.js`。
- `PROFIT_SETTLEMENTS`：`data.js`、`payables.js`、`cases.js`、`tax.js`；`PS_TAX_RATE`：`data.js`、`tax.js`；`PROFIT_SPLIT_RATIOS`：`data.js`。

## 留在原處、不搬移

| 位置 | 保留內容與理由 |
|---|---|
| `ops/index.html` 3927–4404 | 系統骨架：導覽、權限（`applyRole`）、初始化、通用單選元件、兩個橋接／picker。照原規劃留在 index.html 當入口 |
| `ops/js/core/accounting.js` | 付款分類（含分潤預領、股東分配）判斷 |
| `ops/js/core/data.js` | 分潤應付正規化（`normalizeProfitPayables`）、存檔／讀檔與合併 |
| `ops/index.html` 2063–2066 | `page-profitshare` 容器（內容由 `renderProfitShare` 產生） |
| CSS | 維持原 cascade，不拆 |

## 跨模組相依保護（驗證腳本會檢查）

- 新增本批基準 `3bf6549`：`profitshare.js` 必須等於第 4424–5436 行原文加標題，28 個函式逐字一致。
- `profitshare.js` 必須是最後一個載入的本機 script，並緊接在 `tax.js` 之後。
- `ops/index.html` 不得再有任何含程式碼的 inline script（拆檔完成的條件），只保留系統骨架那一段與既有的小段。
- 各批既有的保護項目：例如 `psComputeData` 改為在 `profitshare.js` 內逐字比對。

## 實作與驗證順序

1. 建立 `profitshare.js`，原地替換 inline script。
2. 更新驗證腳本：前幾批對 `psComputeData`、`psPayrollSum`、`psPayrollBreakdown`、`psOpenProfitParticipantModal` 在 index.html 的保護，改由本批逐字比對；新增載入順序檢查。執行並做故意改字的反向測試。
3. 本機 HTTP smoke test：mock Firebase、攔截外部請求、時鐘固定。同一套測試在 `main@3bf6549` 與新分支各跑一次，逐項結果與最後的雲端資料必須逐字相同。涵蓋：
   - 頁面渲染、選案、稅率與開銷期間設定。
   - **結算**：用固定測試案件獨立重算每人分潤，比對產生的分潤應付款金額，以及結算紀錄與案件標記。
   - **撤銷結算**：資料還原。
   - 分潤比例調整、分潤模式切換。
   - 收合偏好記住，含重新載入。
   - 權限：完整管理、只看自己、無權限。
4. 重跑其他八套 smoke test。
5. 正式資料唯讀比對：記錄 `PROFIT_SETTLEMENTS` 筆數與合計、分潤應付款、四大集合，並唯讀讀取分潤頁每人分潤金額。不做任何正式寫入。
6. 單一 commit 推上 feature 分支，提交 Gate 2 證據後停下來等核准。
