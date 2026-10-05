# 出勤打卡模組化對應表（Gate 1 規劃稿）

基準為 `main@c9c78dd`（已部署），分支 `claude/ops-attendance-modularize` 建在 `claude/agents-deploy-log-20261005`（只多一筆 AGENTS.md 紀錄）之上。本輪只有唯讀盤點，沒有修改程式檔案。

拆檔目的：之後要用 Figma 重新設計介面並做手機／平板 app 版，出勤打卡（GPS 打卡、請假、出勤紀錄）是員工最常在手機上用的功能，所以優先拆出。

## Gate 1：出勤打卡拆分對應表

新增目標檔案：`ops/js/modules/attendance.js`

所有函式名稱維持全域、參數與函式本體逐字不變，不加入 `export`、IIFE 或命名空間。

### 搬入 attendance.js

`ops/index.html` 第 4921–5849 行是一整段連續區塊，只有 53 個函式宣告、沒有任何頂層敘述，單獨解析語法正確。整段原樣搬移，順序不變：

| 功能 | 現有函式與行號 |
|---|---|
| 人員／權限／月份 | `attPeople` 4921；`attCanManage` 4927；`attVisiblePerson` 4929；`attMonthValue` 4934；`attToday` 4938 |
| 時間與金額工具 | `attMinutes` 4942；`attTimeFromMinutes` 4947；`attMoney` 4953 |
| 應出勤日與缺卡 | `attExpectedWorkdays` 4957；`attMissingPastWorkDates` 4980 |
| 下拉選單填充 | `attFillPersonOptions` 5004；`attFillMonthOptions` 5019；`attFillCaseOptions` 5042；`attDefaultFormValues` 5052 |
| 紀錄狀態判斷 | `attIsFutureTodayTime` 5065；`attEffectiveOutTime` 5071；`attRecordStatus` 5075 |
| GPS 定位與打卡 | `attGpsSetStatus` 5084；`attGpsDistance` 5091；`attGpsNowTime` 5099；`attGpsTarget` 5103；`attGpsRefresh` 5123；`attGpsUseCurrentAsOffice` 5181；`attGpsResetOfficeLocation` 5200；`attGpsErrorText` 5215；`attGpsAcceptPosition` 5222；`attGpsHandleError` 5232；`attGpsStart` 5244；`attGpsRetry` 5265 |
| 每日有效紀錄與重複合併 | `attDailyEffectiveRecords` 5272；`attMergeDuplicateGpsRows` 5304；`attWaitForCloudSync` 5320；`attGpsPunch`（async）5331 |
| 出勤紀錄新增／編輯 | `attSetRecordEditMode` 5393；`attCancelEditRecord` 5401；`attEditRecord` 5414；`attAddRecord` 5432 |
| 請假新增／編輯 | `attSetLeaveEditMode` 5490；`attCancelEditLeave` 5498；`attEditLeave` 5506；`attAddLeave` 5521 |
| 刪除與核准 | `attDeleteRecord` 5556；`attDeleteLeave` 5571；`attApproveRecord` 5580 |
| 特休計算 | `attServiceYearsAt` 5612；`attAnnualLeaveDaysForYears` 5620；`attDateKey` 5628；`attAnnualLeaveWindow` 5631；`attAnnualLeaveStatus` 5647 |
| 加班與薪資草稿 | `attRecordOvertimeMinutes` 5664；`attComputeDraft` 5677；`attApplyDraftToPayroll` 5729 |
| 出勤頁渲染 | `renderAttendance` 5768–5849 |

`attendance.js` 內容 = 檔案標題註解 + 上述區塊原文，只允許增加標題註解與必要的檔尾換行。

### 載入位置

`<script src="js/modules/attendance.js"></script>` 放在 `vendors.js` 之後、剩餘 legacy inline script 之前（與前幾批相同的位置規則）。

原本這段在第 3926–6087 行那個 inline script 中間。搬走後該 inline script 會比 `attendance.js` 早執行，但已確認：
- 區塊外沒有任何程式在「載入當下」呼叫出勤函式；所有呼叫都在執行期：`navTo`（4171）、`renderCurrentPage`（4192）、`data.js` 的 `renderAll`（2787–2788，在 `DOMContentLoaded` 後才跑），以及 HTML 的 onclick/onchange。
- 區塊本身沒有頂層敘述，不會在載入時存取任何尚未宣告的變數。

## 留在原處、不搬移

| 位置 | 保留內容與理由 |
|---|---|
| `ops/index.html` 1144 | 側欄「出勤打卡」導覽項目 |
| `ops/index.html` 1872–1979 | `page-attendance` 靜態 HTML（GPS 打卡面板、表單、列表容器）；沿用已核准原則，不改成 JS 模板 |
| `ops/index.html` 410–1014 間的 `.att*` 樣式 | CSS 維持原 cascade，不拆 |
| `ops/index.html` 4171、4192 | `navTo`／`renderCurrentPage` 是全站路由，只呼叫 `renderAttendance`，不動 |
| `ops/index.html` 4266 | `applyRole` 內 `btn-attendance-payroll-draft` 的權限顯示，不動 |
| 薪資模組（inline） | `attApplyDraftToPayroll` 會呼叫薪資相關函式；薪資不在本批，跨模組呼叫保持原樣 |

## core/ 保留內容（不動）

- `ops/js/core/data.js`
  - 資料：`ATTENDANCE_RECORDS` 1112、`ATTENDANCE_LEAVES` 1113、`ATTENDANCE_SETTINGS` 1124。
  - 計數器與編輯狀態：`attNextId` 1114、`attLeaveNextId` 1115、`attEditRecordId` 1116、`attLeaveEditId` 1117。
  - GPS 狀態：`attGpsWatchId` 1142、`attGpsPosition` 1143、`attGpsResult` 1144、`attGpsPunching` 1145。
  - 雲端逐筆合併設定：`OPS_CLOUD_ROW_MERGE_CONFIGS` 的 `ATTENDANCE_RECORDS`／`ATTENDANCE_LEAVES`（3140–3141）。
  - 登入：`opsTestUserFromAttendanceEmployee` 2733。
  - `renderAll` 2787–2788 呼叫 `attFillMonthOptions()`、`renderAttendance()`。
- `ops/js/modules/cases.js` 的 `caseDeleteDependencies` 讀 `ATTENDANCE_RECORDS`（資料，在 data.js），不受影響。

資料結構、欄位名稱、快照格式、Firebase 路徑、權限、金額與加班／特休公式全部不變。

## 跨模組相依保護（驗證腳本會檢查）

- `scripts/verify-ops-modularization.mjs` 新增出勤批次基準 `c9c78dd`：`attendance.js` 必須等於基準 `ops/index.html` 第 4921–5849 行加標題註解，53 個函式逐字一致。
- 保護 `navTo`、`renderCurrentPage`、`applyRole` 與 `data.js` 不因本批改動。
- 現有 `POST_SPLIT_CHANGES`（廠商刪除、應付下拉排序）規則維持。

## 實作與驗證順序

1. 建立 `attendance.js`（區塊原文 + 標題），從 `ops/index.html` 移除該區塊，加入 `<script>` 載入行。
2. 更新驗證腳本，執行 `node scripts/verify-ops-modularization.mjs`。
3. 本機 HTTP smoke test（mock Firebase、攔截所有外部請求），新增出勤情境：頁面渲染、手動新增／編輯／刪除出勤紀錄、請假新增／編輯／刪除、核准、特休與加班計算、薪資草稿計算、GPS 打卡（以瀏覽器模擬定位，含距離內／外與定位失敗）、三種權限、存檔後重新載入；同一套測試在 `main@c9c78dd` 與本分支各跑一次，結果必須相同。
4. 正式資料唯讀比對：記錄 `ATTENDANCE_RECORDS`、`ATTENDANCE_LEAVES` 筆數與 CASES／PAYABLES／RECEIVABLES／EXPENSES 基準；不做任何正式寫入。
5. 單一 commit，推上 feature 分支，提交 Gate 2 證據後停下來等核准；合併 main 與部署另需核准與新備份（Gate 3）。
