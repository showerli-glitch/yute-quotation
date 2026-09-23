# 案件管理模組化對應表（Gate 1 規劃稿）

目前基準為 `main@754460e`，工作區乾淨。本輪只有唯讀盤點，沒有修改程式檔案。

## Gate 1：案件管理拆分對應表

新增目標檔案：`ops/js/modules/cases.js`

所有函式名稱維持全域、參數與函式本體逐字不變，不加入 `export`、IIFE 或命名空間。

### 搬入 cases.js

| 功能 | 現有函式與行號 |
|---|---|
| 案件篩選器 | `dcToggleCaseDropdown` 4343–4357；`dcCaseAllToggle` 4359–4365；`dcCaseCheckChange` 4367–4376；`dcUpdateCaseBtn` 4378–4382 |
| 篩選器外部點擊關閉 | 頂層 `document.addEventListener('click', …)` 4384–4390 |
| 案件共用判斷／分組 | `isClosedCase` 4393–4395；`groupedCases` 4397–4403 |
| 案件詳情 | `openCaseDetail` 4446–4502 |
| 結案 | `closeCaseIfReady` 4504–4527 |
| 刪除與關聯檢查 | `caseDeleteDependencies` 4529–4539；`deleteCase` 4541–4570 |
| 列表操作選單 | `caseActionSelect` 4572–4580 |
| 排序 | `dashboardCaseEntryDate` 4582–4592；`dashboardSortOpenCases` 4594–4603；`dashboardSortCasesLikeOverview` 4606–4612 |
| 已結案區塊 | `dcToggleClosedCases` 4614–4618 |
| 案件列表渲染 | `renderCases` 4620–4683 |
| 案場座標 | `caseHasSiteLocation` 4690–4694；`caseLocationFields` 4696–4703；`openCaseLocation` 4705–4716；`readCaseLocation` 4718–4743；`saveCaseLocation` 4745–4765；`caseUseCurrentLocation` 4767–4779 |
| 新增案件 | `openNewCaseModal` 6523–6542；`syncNewCaseTypeDefaults` 6544–6554；`submitNewCase` 6556–6620 |
| 編輯狀態 | `editCaseTarget` 6625 |
| 編輯案件 | `openEditCase` 6626–6650；`editCaseNoOverheadChange` 6651–6654；`editCaseProfitModeChange` 6655–6658；`submitEditCase` 6659–6707 |
| 保固款應收串接 | `caseGenerateRetentionReceivable` 6711–6729 |
| 案號產生 | `genCaseCode` 6734–6739；`caseCodePrefixForNewCase` 6741–6748；`nextCaseCodeForNewCase` 6750–6762 |
| 總覽儀表板 | `renderDashboard` 9743–9828 |

`cases.js` 內依上述原始出現順序排列，只允許增加檔案標題註解與必要的檔尾換行。

## 留在原處、不搬移

| 位置 | 保留內容與理由 |
|---|---|
| `ops/index.html` 1223 | 「新增個案」按鈕與 `openNewCaseModal()` 綁定；保留靜態 HTML |
| `ops/index.html` 1229–1341 | 完整案件總覽、KPI、待審核請款與近期應收 DOM；沿用上一批核准原則，不改成 JS 模板 |
| `ops/index.html` 2842–2881 | 案件詳情 modal |
| `ops/index.html` 2882–2927 | 案場座標 modal |
| `ops/index.html` 2928–3030 | 新增案件 modal |
| `ops/index.html` 3031–3119 | 編輯案件／保固款 modal |
| `ops/index.html` 491–516、559、616–628、960–977 | KPI、操作選單、案件列、進度條及儀表板請款樣式；CSS 仍維持原 cascade |
| `ops/index.html` 4187–4205 | `renderCurrentPage` 是全站路由／渲染分派，不屬案件模組 |
| `ops/index.html` 4207–4222 | `refreshAccountingLinkedViews` 是收付、稅務、分潤與案件之間的共用刷新介面 |
| `ops/index.html` 4227–4278 | `applyRole` 是全站權限套用；第 4258 行繼續以 `canCreateCase()` 控制按鈕 |
| `ops/index.html` 4406–4422 | `openPayreqForVendor` 屬廠商請款 |
| `ops/index.html` 4425–4443 | `openReceivableForClient` 屬客戶／應收 |
| `ops/index.html` 6483–6521 | `submitNewClient` 與最新客戶新增權限修正保持原樣，不納入案件拆分 |
| `form/` | 獨立客戶需求表，完全不碰 |

## core/ 保留內容

- `ops/js/core/data.js`
  - `USER_PERMISSIONS`：592–600。
  - `canCreateCaseFor`／`canCreateCase`：633–640。
  - `userCanViewCaseFinancials`／`userCanViewCaseScopedRow`：677–691。
  - `requireCreateCase`：779–783。
  - `INIT_CASES`：792–794；可變 `CASES`：820。
  - 儀表板篩選狀態 `dcSelCases`／`dcClosedCollapsed`：1107–1108。
  - Seed、migration、snapshot、Firebase、`saveData`、`applyDataSnapshot` 全數不動。

- `ops/js/core/accounting.js`
  - 親友轉付判斷與應收認列：3–53。
  - `caseReceivableRows`、`caseCollectedAmount`、`caseReceivableTotalAmount`：55–72。
  - `casePayableRows`、`casePaidPayableAmount`：74–85。
  - 這些是收付、成本控制與案件詳情共用公式，不能搬回案件模組。

- `ops/js/core/ui.js`
  - 案件選項、分組下拉與共用刷新：35–101。
  - 繼續透過全域 `groupedCases()` 呼叫 `cases.js`。

- `ops/js/modules/payables.js`
  - `caseCodeBreak` 19–26 暫留原處，避免改動已核准的應付模組。
  - 它目前也供應收與案件畫面使用；載入順序會確保呼叫時已存在。

## 跨模組相依保護

`cases.js` 必須繼續提供相同全域名稱：

- `groupedCases`：被 `core/ui.js` 的案件下拉元件使用。
- `isClosedCase`：被 `payables.js` 及 `expenses.js` 使用。
- `renderCases`／`renderDashboard`：被 `core/data.js` 的 `renderAll()`、應付流程及共用刷新流程使用。
- `dashboardSortCasesLikeOverview`：被出勤、淨利潤及分潤結算使用。
- `caseHasSiteLocation`：被出勤 GPS 目標判斷使用。
- `caseGenerateRetentionReceivable`：呼叫既有應收 modal API。
- `renderDashboard`：呼叫既有請款核准／退回與應收顯示函式。

建議在目前 `expenses.js` 載入後、剩餘 legacy inline script 前載入 `cases.js`。所有互相引用仍採現有 classic-script 全域介面，且真正執行會在全部 script 載入完成後的 `DOMContentLoaded` 階段。

## 實作與驗證順序

1. 以 `754460e` 作為本批逐字比對基準。
2. 建立 `cases.js`，按上表逐字搬移。
3. 只在 `ops/index.html` 移除原區塊並加入一個 script 標籤；HTML/CSS 不搬。
4. 擴充驗證腳本，逐一核對上述 34 個函式及頂層事件區塊與 `754460e` 完全一致。
5. 確認 `canCreateCase`、客戶新增權限修正及 `form/` 零差異。
6. 重跑語法、JSON、路徑、HTTP、全頁 browser smoke，以及案件新增／編輯／結案／座標／詳情的本機測試。
7. 正式 Firebase 僅做拆分前後筆數、金額與時間戳讀取，不做任何寫入。
8. 驗證通過後建立案件 slice 單獨 commit，提交 Gate 2 證據後再次停止。

這份是規劃稿；尚未建立案件拆分分支、檔案或修改程式，等待使用者核准。
