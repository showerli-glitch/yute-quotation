# 薪資管理模組化對應表（Gate 1 規劃稿）

基準為 `main@0ef422c`（已部署）。分支 `claude/ops-payroll-modularize` 建在 `claude/agents-deploy-log-20261006d` 上，比基準多一筆 AGENTS.md 紀錄和 `docs/known-issues.md`。本輪只做唯讀盤點，沒有修改程式檔案。

這是第一個牽涉金額的批次：薪資會計算實領、勞健保、請假扣款，也包含老闆提領。所以這批只做原文搬移，公式與資料一個字都不改，測試也會比對金額。

## Gate 1：薪資拆分對應表

新增目標檔案：`ops/js/modules/payroll.js`

`ops/index.html` 第 6441–7388 行是一整段連續區塊，原樣整段搬移，順序不變。所有名稱維持全域，不加入 `export`、IIFE 或命名空間。

### 搬入 payroll.js

| 段落 | 行號 | 內容 |
|---|---|---|
| 薪資資料 | 6441–6496 | `// PAYROLL DATA` 標題；`PR_CONFIG`（各員工薪資預設值）、`PAYROLL_EMPLOYEE_ACCOUNTS`、`CODEX_SEED_PAYROLL`（2025/10–2026/5 歷史薪資種子）、`PAYROLL`、`DEFAULT_PAYROLL_MONTHS`、`PAYROLL_MONTHS`、`PAYROLL_DELETED_MONTHS`、`DELETED_SOURCE_KEYS`、`prNextId`、`prCurrentEmp`、`prRangeExpanded` |
| 月份與人員 | 6498–6652 | `// PAYROLL MODULE` 標題；`prIsValidMonth`、`prRenderMonthOptions`、`prRenderRangeMonthOptions`、`openPayrollMonthModal`、`submitPayrollMonth`、`prDeleteMonth`、`prPersonActiveForMonth`、`prSelectableUsers`、`prCanSeeAllPrivatePayroll`、`prOwnerWithdrawalPerson`、`prVisibleOwnerWithdrawalRows`、`prRenderEmployeeTabs`、`prSelectEmp` |
| 老闆提領 | 6653–6764、6862–7026 | `ownerWithdrawalTypeLabel`、`ownerWithdrawalPayableType`、`ownerWithdrawalDate`、`ownerWithdrawalRows`、`prPreviousOwnerWithdrawalMonth`、`prCopyOwnerWithdrawalFromLastMonth`、`renderOwnerWithdrawalPanel`、`openOwnerWithdrawalModal`、`submitOwnerWithdrawal`、`deleteOwnerWithdrawal` |
| 區間總覽 | 6765–6861 | `togglePayrollRangeOverview`、`prMonthsInRange`、`prRecordNet`、`renderPayrollRangeOverview` |
| 薪資單 | 7027–7388 | `prGetConfig`、`renderPayroll`、`openEditPayroll`、`prRenderCustomItems`、`prAddCustomItem`、`prGetCustomItems`、`submitPayroll`、`printPayslip` |

共 35 個函式、11 個頂層資料宣告。這段單獨解析語法正確，而且只有函式與 `const`／`let` 宣告，沒有其他頂層敘述。

### 為什麼資料宣告可以一起搬

「費用」批次已經有前例：資料與功能一起搬進 `expenses.js`。這批的情況是：

- **初始值都不依賴外部**：11 個資料宣告的初始值都是固定數字、字串或空陣列，或只引用同一區塊裡的 `CODEX_SEED_PAYROLL`，沒有用到外部的東西。
- **只會變得更早宣告**：新位置（`employees.js` 之後）比原位置（最後一個 inline script 的後段）更早執行。任何原本能讀到這些資料的程式，搬移後一樣讀得到。
- **外部都是執行期才用**：`data.js` 的存檔／讀檔／種子（`createDataSnapshot`、`applyDataSnapshot`、`ensureCodexSeedData` 等）、`attendance.js`（`PR_CONFIG`、`PAYROLL`、`PAYROLL_MONTHS`、`prNextId`）、`employees.js`（`PAYROLL_EMPLOYEE_ACCOUNTS`），以及 `applyRole` 設定 `prCurrentEmp`，都在執行期才使用。
- **跨檔重新指定仍有效**：`let PAYROLL`、`let prNextId` 等全域變數在不同 classic script 之間共用，`data.js` 重新指定仍然有效，行為和原本相同。

### 載入位置

`<script src="js/modules/payroll.js"></script>` 放在 `employees.js` 之後、剩餘 legacy inline script 之前。

35 個函式的外部呼叫全部發生在執行期：
- `navTo`、`renderCurrentPage`、`applyRole`、`applyDefaultPeriodForPage`。
- `data.js` 的 `renderAll`（`prRenderMonthOptions`、`renderPayroll`）與雲端存檔（`prGetCustomItems`）。
- 分潤與利潤結算中的老闆提領標籤 `ownerWithdrawalTypeLabel`。
- `payables.js`、公司開銷、分潤裡的 `prIsValidMonth`。
- `attendance.js` 的薪資草稿。
- HTML 的 onclick／onchange。

## 留在原處、不搬移

| 位置 | 保留內容與理由 |
|---|---|
| `ops/js/core/data.js` | `prLiveCalc`（薪資視窗即時試算）、雲端合併設定 `PAYROLL`／`PAYROLL_MONTHS`／`PAYROLL_DELETED_MONTHS`／`PAYROLL_EMPLOYEE_ACCOUNTS`、存檔與讀檔 |
| 分潤模組（inline） | `psPayrollBreakdown`、`psPayrollSum` 屬分潤計算，不在本批 |
| `ops/index.html` 1141 | 側欄「薪資管理」 |
| `ops/index.html` 1794–1871 | `page-payroll` 靜態 HTML |
| `ops/index.html` 3670 起 | `modal-payroll-month`、`modal-owner-withdrawal`、`modal-edit-payroll` |
| CSS | 維持原 cascade，不拆 |

公式（實領 = 應發 A + 加項 B − 扣項 C、轉帳 = 實領 − 預支）、勞健保、請假扣款、老闆提領轉應付的規則、薪資月份刪除的墓碑（`PAYROLL_DELETED_MONTHS`），以及歷史種子資料，全部不變。

## 跨模組相依保護（驗證腳本會檢查）

- 新增本批基準 `0ef422c`：`payroll.js` 必須等於第 6441–7388 行原文加標題，35 個函式逐字一致。
- `navTo`、`renderCurrentPage`、`applyRole`、`refreshAccountingLinkedViews`、`psPayrollBreakdown`、`psPayrollSum` 不因本批改動。
- `data.js` 除了已記錄的刻意修改外不得改動。
- 搬走的函式與 11 個資料宣告不得仍留在 index.html。

## 實作與驗證順序

1. 建立 `payroll.js`，從 `ops/index.html` 移除 6441–7388，加入 `<script>` 載入行。
2. 更新驗證腳本，執行並做故意改字的反向測試。
3. 本機 HTTP smoke test：mock Firebase、攔截外部請求、時鐘固定。新增薪資情境如下，同一套測試在 `main@0ef422c` 與新分支各跑一次，逐項結果與最後的雲端資料必須逐字相同。
   - 月份選單、新增月份、刪除月份（含墓碑）。
   - 員工分頁切換、編輯薪資單（A／B／C 各欄、自訂加項、即時試算），並驗證實領與轉帳金額。
   - 區間總覽加總。
   - 老闆提領：新增、上月複製、刪除、轉應付。
   - 列印薪資單（攔截新視窗）。
   - 權限：完整管理、只看自己（view_self）、無權限。
   - 存檔後重新載入；出勤寫入薪資草稿的連動。
4. 重跑回報／筆記／員工、請款、出勤、客戶／廠商四套 smoke test。
5. 正式資料唯讀比對：記錄 PAYROLL 筆數、月份數、實領合計與四大集合基準。不做任何正式寫入。
6. 單一 commit 推上 feature 分支，提交 Gate 2 證據後停下來等核准。
