# Claude 工作須知（宇德 OPS）

開始任何工作前，先讀 `AGENTS.md`（架構、資料契約、批次進度與部署紀錄）和 `docs/known-issues.md`（已知問題）。這份檔案只記使用者的工作偏好與規則；細節以 `AGENTS.md` 為準。

## 溝通

- 一律用繁體中文回覆，精簡說明做了什麼、結果如何。
- 使用者常用手機遠端或公司電腦操作，回報要能單獨看懂，不要假設對方記得前面的對話。

## 可以直接做、不用先問

- 在 `claude/*` 分支上修改、commit，並直接推上 GitHub。推完簡短告訴使用者做了什麼。
- 本機模擬測試、驗證腳本、唯讀查詢正式資料。

## 一定要先取得使用者明確同意

- 合併到 `main`、推 `main`、部署 GitHub Pages。
- 任何正式 Firebase 寫入（新增、修改、刪除、核准），以及修改或部署 `firebase-database.rules.json`。
- 合併或部署前，使用者要先備份：從 OPS 按「↓ 下載資料備份」。手機 Chrome 只能存到 Google Drive「我的雲端硬碟/透過 Chrome 儲存」，電腦則存到共用雲端硬碟「宇德公用資料/宇德系統/備份」。拿到檔名後，先核對備份的筆數與金額和正式資料一致，再動手。
- 部署後要做唯讀檢查：程式檔與 `main` 逐字相同、沒有 console 錯誤、正式資料的筆數與金額和部署前一致（`meta.savedAt` 若有變，差異要能用同事的正常操作解釋）。結果記進 `AGENTS.md` 的 Progress log。

## 絕對不要做

- 不要對正式 Firebase 做任何寫入測試；正式環境只能讀（讀取、列表、加總、開啟既有資料、重新整理）。
- 不要代替使用者輸入密碼或處理兩步驟驗證。用 OPS 的「使用 Google 帳號登入」時，只有在選擇既有帳號、不需要密碼的情況下才可以繼續；需要密碼就停下來請使用者登入。
- 不要修改、比對或還原 Google Drive 上的 `Yutesign_OPS_v2.html`（只是手動備份）。
- 不要用模擬資料、localStorage 或複製的資料取代正式 Firebase。

## 專案方向

- 拆檔（2026-09-22～10-06）已完成，目的是讓程式小到可以重新設計介面。下一步是手機／平板版，使用者已選擇做 PWA（不是原生 app）。
- 畫面設計目前有兩版提案：Claude 的版本用 Claude Design 製作；Codex 的獨立提案用 Figma，PDF 在共用雲端硬碟「宇德公用資料/宇德系統/手機、平板PWA」。
- 已知問題 #1（新員工第一次在新裝置登入）與 #6（雲端合併在空集合時不啟動）使用者已決定暫緩，不要主動修，除非使用者提出。

## 驗證

- 每次修改後跑 `node scripts/verify-ops-modularization.mjs`、`python3 -m json.tool firebase-database.rules.json`、`git diff --check`。刻意修改的函式要登記在驗證腳本的 `POST_SPLIT_CHANGES`。
- 9 套本機模擬測試在 `scripts/smoke-*.mjs`，只用模擬雲端、攔截所有外部請求，不會碰正式資料。需要 `playwright-core`（裝在 repo 外的 `/tmp/ops-smoke`）和 Chrome／Chromium，透過環境變數 `PLAYWRIGHT_CORE` 與 `CHROME_PATH` 指定；用法寫在各腳本開頭。全部通過的基準是 427 項（135、58、52、47、41、28、20、22、24；員工那套有 1 則預期警告）。
- 正式資料唯讀摘要：`scripts/ops-prod-readonly-summary.js`，在已登入的正式 OPS 分頁 console 執行，只做一次 `get()`。雲端環境沒有使用者已登入的 Chrome，這一步改由使用者匯出備份讓你比對，或在有登入 Chrome 的電腦上做。
