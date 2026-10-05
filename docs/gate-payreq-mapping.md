# 廠商請款模組化對應表（Gate 1 規劃稿）

基準為 `main@81b208c`（已部署）。分支 `claude/ops-payreq-modularize` 建在 `claude/agents-deploy-log-20261006` 上，那個分支只比基準多一筆 AGENTS.md 紀錄。本輪只做唯讀盤點，沒有修改程式檔案。

拆檔目的：之後會用 Figma 重新設計介面，並做手機／平板 app 版。廠商請款是專案經理在現場最常用手機送出的功能，所以排在出勤之後。

## Gate 1：廠商請款拆分對應表

新增目標檔案：`ops/js/modules/payreq.js`

所有函式名稱維持全域，參數與函式本體逐字不變。不加入 `export`、IIFE 或命名空間。

### 搬入 payreq.js（三段，依原始順序串接）

| 段落 | `ops/index.html` 行號 | 內容 |
|---|---|---|
| A | 4934–4969 | `// SUBMIT` 區塊標題；`openPayreqModal` 4937 |
| B | 4976–5154 | `setPayreqRadio` 4976；`openEditPayreqModal` 4986；`clonePayreq` 5021；`payreqDocumentAction` 5039；`submitPayReq` 5048；`approveReq` 5124；`rejectPayreq` 5138 |
| C | 8141–8254 | `// DASHBOARD RENDER` 標題；`payreqPendingCount` 8144；`updatePayreqNavBadge` 8148；`// PAY REQUEST PAGE RENDER` 標題；`renderPayreq` 8164 |

共 11 個函式。三段裡沒有任何頂層敘述，只有函式宣告和註解。`payreq.js` 的內容是檔案標題註解，加上 A、B、C 三段原文，段與段之間空一行。

### 載入位置

`<script src="js/modules/payreq.js"></script>` 放在 `attendance.js` 之後、剩餘 legacy inline script 之前。

已確認區塊外沒有任何程式在「載入當下」呼叫這 11 個函式。所有呼叫都發生在執行期，包括：
- `navTo`、`renderCurrentPage`、`refreshAccountingLinkedViews`、`applyRole`（在 `DOMContentLoaded` 後才執行）。
- `data.js` 的 `renderAll`。
- `payables.js` 的 `renderPayreq`。
- `cases.js` 儀表板的 `updatePayreqNavBadge`，以及模板字串裡的 `approveReq`／`rejectPayreq` onclick。
- 分潤的 `psRunSettlement`／`psUndoSettlement`。
- `openPayreqForVendor`，以及 HTML 的 onclick／oninput。

## 留在原處、不搬移

| 位置 | 保留內容與理由 |
|---|---|
| `ops/index.html` 4343 | `openPayreqForVendor`：客戶／廠商批次已核准把它當作跨模組橋接，留在 index.html，驗證腳本也有檢查 |
| `ops/index.html` 4971–4974 | `payreqVendorPickerMouseDown`：請款與應付帳款（`ap-add-vendor`）共用的 picker，同樣是已核准的保留項目 |
| `ops/index.html` 4921–4932 | `selectRadio`：通用單選元件，案件（`rg-status`）、應付（`rg-ap-inv`）、請款都在用 |
| `ops/index.html` 1119–1121 | 側欄「廠商請款」與待審核徽章 `badge-payreq` |
| `ops/index.html` 1343–1433 | `page-payreq` 靜態 HTML；沿用已核准原則，不改成 JS 模板 |
| `ops/index.html` 2752–2843 | `modal-payreq` 請款申請視窗 |
| CSS | 維持原 cascade，不拆 |

## core/ 保留內容（不動）

- `ops/js/core/data.js`：`payreqEditId` 1118、`payreqSubmitting` 1119、`USER_PERMISSIONS`、`userCanViewCaseFinancials`、`userCanViewCaseScopedRow`、`fillActiveUserNameSelect`、`PAYABLES` 和 `pyNextId`。
- 請款寫入的仍然是 `PAYABLES`（`status: pending / approved / rejected`），欄位與快照格式不變。

## 拆檔時發現的既有問題（本批不修，另開修正）

請款的 `person` 欄位存的是申請人**名字**：`submitPayReq` 寫入 `currentUser.name` 或下拉選的名字。但下面三處判斷「是不是本人」時，比對的是帳號 **ID**（`currentUser.id`），兩者永遠不會相等：

- `data.js` 的 `userCanViewCaseScopedRow`：權限是「只看有分潤的個案＋自己申請」的人，看不到自己送出、沒有指定個案的請款。
- `renderPayreq` 的已退回列表：非管理者看不到自己被退回請款的「選項⋯」，所以無法照退回訊息說的「修改後重新送出」。
- `openEditPayreqModal`：非管理者打開自己已退回的請款會被拒。

這屬於行為修正，會影響權限判斷，所以依規則不在拆檔批次修改。本批的 smoke test 會在 main 與新分支上記錄同樣的現況。拆檔完成後再另開分支修正，修正前會先唯讀確認正式資料裡 `person` 的實際值。

## 跨模組相依保護（驗證腳本會檢查）

- `scripts/verify-ops-modularization.mjs` 新增請款批次基準 `81b208c`：`payreq.js` 必須等於基準的三段原文加標題，11 個函式逐字一致。
- `navTo`、`renderCurrentPage`、`applyRole`、`refreshAccountingLinkedViews` 不因本批改動。
- `openPayreqForVendor`、`payreqVendorPickerMouseDown`、`selectRadio` 必須仍在 index.html，而且內容不變。
- 搬走的 11 個函式不得仍留在 index.html。

## 實作與驗證順序

1. 建立 `payreq.js`，從 `ops/index.html` 移除 A、B、C 三段，加入 `<script>` 載入行。
2. 更新驗證腳本，執行 `node scripts/verify-ops-modularization.mjs`，並做故意改字的反向測試。
3. 本機 HTTP smoke test：mock Firebase，攔截所有外部請求，時鐘固定。新增請款情境：
   - 新增：必填檢查、指定／不指定個案、重複送出擋下。
   - 編輯待審核、複製單據。
   - 核准後轉入應付、退回後移到已退回。
   - 搜尋、排序、待審核徽章數。
   - 從廠商主檔發起請款的橋接，以及 picker 點擊清除。
   - 三種權限：完整管理、申請自己（含上面的既有問題現況）、唯讀或無權限。
   - 存檔後重新載入。
   - 同一套測試在 `main@81b208c` 與新分支各跑一次，逐項結果與最後的雲端資料必須逐字相同。
4. 重跑出勤、客戶／廠商兩套 smoke test，確認沒有連帶影響。
5. 正式資料唯讀比對：記錄 PAYABLES 待審核／已核准／已退回／已付款的筆數與金額，以及其他集合的基準。不做任何正式寫入。
6. 單一 commit 推上 feature 分支，提交 Gate 2 證據後停下來等核准。合併 main 與部署另需核准，並先做新備份（Gate 3）。
