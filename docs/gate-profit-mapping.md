# 淨利潤儀表板模組化對應表（Gate 1 規劃稿）

基準為 `main@e602f72`（已部署）。分支 `claude/ops-profit-modularize` 建在 `claude/agents-deploy-log-20261006f` 上，比基準多一筆 AGENTS.md 紀錄。本輪只做唯讀盤點，沒有修改程式檔案。

淨利潤儀表板（側欄「成本控制表」）會依應收、應付、費用、薪資、公司開銷，即時計算每個案件與全公司的毛利與淨利。這批只做原文搬移，所有計算公式一個字都不改。

## Gate 1：拆分對應表

新增目標檔案：`ops/js/modules/profit.js`

### 原地替換整個 inline script

`ops/index.html` 第 4410–4757 行是一個獨立的 `<script>…</script>`，夾在 `receivables.js` 與 `expenses.js` 之間。做法如下：

- 把第 4411–4756 行（script 內容）逐字搬進 `profit.js`。
- 把第 4410–4757 行（含 `<script>` 與 `</script>`）原地換成一行 `<script src="js/modules/profit.js"></script>`。

載入順序和現在完全相同：`receivables.js` → `profit.js` → `expenses.js`。不需要做「提早宣告是否安全」的分析，頂層程式的執行時機也不變。

### 搬入 profit.js

| 段落 | 原行號 | 內容 |
|---|---|---|
| 共用小工具 | 4411–4417 | `// HELPERS` 標題；`fmtNum`（數字千分位，`cases.js` 也會在執行期使用） |
| 篩選狀態 | 4418–4425 | `// PROFIT DASHBOARD` 標題；`pfSelYears`、`pfSelCases`、`pfClosedCollapsed`（載入時讀取 localStorage 的收合偏好） |
| 篩選操作 | 4426–4511 | `pfToggleClosedCases`、`pfSelectDetailCase`、`buildPfYearPills`、`pfToggleYear`、`pfToggleCaseDropdown`、`pfCaseAllToggle`、`pfCaseCheckChange`、`updatePfCaseBtn` |
| 點外面關閉下拉 | 4512–4519 | 頂層 `document.addEventListener('click', …)` |
| 儀表板計算與渲染 | 4521–4756 | `renderProfit` |

共 10 個函式、3 個頂層 `let`、1 個頂層事件監聽。這段單獨解析語法正確。

### 外部相依

全部發生在執行期：
- `renderProfit` 由以下呼叫：`navTo`、`renderCurrentPage`、`refreshAccountingLinkedViews`、`data.js` 的 `renderAll`、`cases.js`、`expenses.js`、`payables.js`、`payreq.js`，以及 HTML。
- `fmtNum` 由 `cases.js` 呼叫。
- `pfToggleCaseDropdown`、`pfCaseAllToggle` 由 HTML 呼叫。
- 3 個 `pf*` 狀態變數只在這段裡使用。

## 留在原處、不搬移

| 位置 | 保留內容與理由 |
|---|---|
| `ops/js/core/accounting.js` | 付款分類、應收認列等共用會計判斷（已在 core） |
| `ops/js/core/data.js` | 案件、應收、應付、費用等資料與存檔 |
| `ops/index.html` 4769 起 | 分潤、稅務、資金部位（最後一批） |
| `ops/index.html` 1147 | 側欄「成本控制表」 |
| `ops/index.html` 1980–2062 | `page-profit` 靜態 HTML |
| CSS | 維持原 cascade，不拆 |

## 跨模組相依保護（驗證腳本會檢查）

- 新增本批基準 `e602f72`：`profit.js` 必須等於第 4411–4756 行原文加標題，10 個函式逐字一致。
- `index.html` 在 `receivables.js` 之後、`expenses.js` 之前必須正好是 `profit.js`（確認載入順序不變）。
- `navTo`、`renderCurrentPage`、`applyRole`、`refreshAccountingLinkedViews`、`psComputeData` 不因本批改動。
- 搬走的函式與 3 個狀態變數不得仍留在 index.html。

## 實作與驗證順序

1. 建立 `profit.js`，原地替換 inline script。
2. 更新驗證腳本，執行並做故意改字的反向測試。
3. 本機 HTTP smoke test：mock Firebase、攔截外部請求、時鐘固定。同一套測試在 `main@e602f72` 與新分支各跑一次，逐項結果與最後的雲端資料必須逐字相同。涵蓋：
   - 儀表板 KPI 與各案件毛利／淨利：用固定測試資料比對畫面數字，並用獨立方式重算案件收入、成本合計。
   - 年份篩選、案件下拉（全選、單選、點外面關閉）、已結案收合（含 localStorage 偏好）、案件明細。
   - 新增應收或應付後儀表板跟著更新。
   - 權限：完整管理、只看有分潤案件、無權限。
4. 重跑其他六套 smoke test。
5. 正式資料唯讀比對：記錄四大集合基準，並在正式頁面唯讀讀取儀表板 KPI 數字。不做任何正式寫入。
6. 單一 commit 推上 feature 分支，提交 Gate 2 證據後停下來等核准。
