# 問題回報／系統說明／員工管理模組化對應表（Gate 1 規劃稿）

基準為 `main@4e42a53`（已部署）。分支 `claude/ops-feedback-notes-employees` 建在 `claude/agents-deploy-log-20261006c` 上，那個分支只比基準多三筆 AGENTS.md 紀錄。本輪只做唯讀盤點，沒有修改程式檔案。

拆檔目的：之後會用 Figma 重新設計介面，並做手機／平板 app 版。這三塊和金額無關、彼此獨立，風險最低，先拆可以繼續把 `ops/index.html` 變小。

## Gate 1：拆分對應表

新增三個目標檔案，依頁面分開，之後新介面可以各自沿用：

- `ops/js/modules/feedback.js`（問題回報）
- `ops/js/modules/systemnotes.js`（系統規則筆記）
- `ops/js/modules/employees.js`（員工管理）

所有函式與常數名稱維持全域，參數與內容逐字不變。不加入 `export`、IIFE 或命名空間。

### 搬移範圍（`ops/index.html` 行號以 `4e42a53` 為準）

| 目標檔 | 行號 | 內容 |
|---|---|---|
| `feedback.js` | 4384–4390 | `tfStatusColor`、`tfSeverityColor` |
| `systemnotes.js` | 4392–4657 | 常數 `SYSTEM_NOTES`（系統規則筆記資料，4392–4573）；`snStatusColor`、`snResetFilters`、`renderSystemNotes` |
| `feedback.js` | 4659–4919 | 常數 `TF_SCREENSHOT_MAX_EDGE`、`TF_SCREENSHOT_MAX_BYTES`；`tfFormatBytes`、`tfDataUrlBytes`、`initFeedbackScreenshotInput`、`compressFeedbackScreenshot`、`handleFeedbackScreenshotFile`、`renderFeedbackScreenshotDraft`、`clearFeedbackScreenshot`、`openFeedbackScreenshot`、`submitFeedback`、`setFeedbackStatus`、`deleteFeedback`、`renderFeedback` |
| `employees.js` | 7925–8144 | 舊的 `// CLIENT MODULE` 區塊標題（客戶已搬走，標題留在員工函式上方，照原文一起搬）；`renderEmployees`；常數 `EMP_PERM_MODULES`、`EMP_PERM_LEVELS`；`openEmployeeModal`、`submitEmployee` |

4384–4919 原本是一整段連續區塊，回報和系統說明交錯排列。`feedback.js` 由兩段（4384–4390 與 4659–4919）依原順序組成。

合計 20 個函式、5 個頂層常數，沒有其他頂層敘述。

### 載入位置與安全性

三個檔案依序放在 `payreq.js` 之後、剩餘 legacy inline script 之前：`feedback.js` → `systemnotes.js` → `employees.js`。

- 5 個常數只在這批要搬的函式裡使用，沒有任何程式在載入當下讀取它們。
- 20 個函式的外部呼叫全部發生在執行期：`navTo`、`renderCurrentPage`、`applyRole`、`data.js` 的 `renderAll`（`renderFeedback`、`initFeedbackScreenshotInput`、`renderEmployees`）、分潤的 `psOpenProfitParticipantModal`（`openEmployeeModal`），以及 HTML 的 onclick／onchange。

## 留在原處、不搬移

| 位置 | 保留內容與理由 |
|---|---|
| `ops/js/core/ui.js` | `tfEsc`（HTML 跳脫，出勤、系統說明等多處共用），已在 core |
| `ops/js/core/data.js` | `TEST_FEEDBACK`、`tfNextId`、`tfScreenshotDraft`、`empNextId`、`empEditId`、`EMPLOYEES`、`USER_PERMISSIONS`、`employeeAccessRole`、`opsUserFromEmployee` 等資料、狀態與登入權限 |
| `ops/index.html` 7161 | `prRenderEmployeeTabs` 屬薪資模組（`pr` 前綴），不在本批 |
| `ops/index.html` 1163–1171 | 側欄三個頁面入口 |
| `ops/index.html` 2083–2264 | `page-feedback`、`page-systemnotes`、`page-employees` 靜態 HTML |
| `ops/index.html` 2376–2523 | `modal-employee` 員工視窗（含權限矩陣表格） |
| CSS | 維持原 cascade，不拆 |

## 特別注意：員工管理會改權限

`submitEmployee` 會寫入員工的開通角色與 `USER_PERMISSIONS` 權限矩陣。本批只搬移位置，內容逐字不變。測試會特別驗證「儲存員工 → 權限矩陣寫入 → 重新載入後權限生效」，而且只在模擬雲端裡測，不碰正式資料。

## 跨模組相依保護（驗證腳本會檢查）

- 新增本批基準 `4e42a53`：三個檔案必須等於上表範圍原文加標題，20 個函式逐字一致。
- `navTo`、`renderCurrentPage`、`applyRole`、`refreshAccountingLinkedViews`、`prRenderEmployeeTabs` 不因本批改動。
- `data.js` 除了已記錄的刻意修改外不得改動。
- 搬走的函式不得仍留在 index.html。

## 實作與驗證順序

1. 建立三個檔案，從 `ops/index.html` 移除 4384–4919 與 7925–8144，加入三行 `<script>` 載入行。
2. 更新驗證腳本，執行 `node scripts/verify-ops-modularization.mjs`，並做故意改字的反向測試。
3. 本機 HTTP smoke test：mock Firebase、攔截外部請求、時鐘固定。新增情境如下，同一套測試在 `main@4e42a53` 與新分支各跑一次，逐項結果與最後的雲端資料必須逐字相同。
   - 問題回報：送出、必填檢查、截圖上傳壓縮與清除、改狀態、刪除、權限。
   - 系統說明：分類／狀態篩選、搜尋、重設篩選、統計卡。
   - 員工：列表、新增、編輯、開通角色與權限矩陣寫入、離職狀態、權限（管理者與非管理者）。
   - 存檔後重新載入。
4. 重跑請款、出勤、客戶／廠商三套 smoke test。
5. 正式資料唯讀比對：記錄 TEST_FEEDBACK、EMPLOYEES 筆數與四大集合基準。不做任何正式寫入。
6. 單一 commit 推上 feature 分支，提交 Gate 2 證據後停下來等核准。
