# 報價系統：工項單價雲端同步（第 4 步）

分支 `claude/quotation-price-sync-v2`（2026-11-23 在 `main@10d13c2` 上重做；舊分支 `claude/quotation-price-sync` 停用）。程式在 `quotation/js/pricesync.js`，只包裝既有函式（`saveDb`、`deleteDbItem`、`updateDbItem`、`renderEditList`），原有程式不改。

## 資料

- 位置：`quotation/yutesign/items/<工項名稱編碼>`，和 OPS 的 `ops/yutesign/snapshot` 分開。
- 只存「和內建清單不同」的工項，每項一筆：`n` 名稱、`c` 類別、`u` 單位、`p` 參考單價、`lo`／`hi` 最低／最高單價、`f` 出現次數、`by` 修改人 Email、`at` 時間；刪除是 `del: true`（改名是 `del: true` 加 `moved: 新名稱`）。
- 顯示時 = 內建清單 + 這些紀錄（同一項以最新的為準）。每台裝置的 `localStorage` 仍保留一份，離線時照用。

## 規則（使用者決定 2026-10-08）

- 大家都可以新增、改單價／單位／類別、改名。
- 只有李鎮宇（shower.li@yutesign.com）可以刪除工項：畫面擋、存檔時還原，Firebase 規則也擋。
- 電腦版「編輯工項」與手機「編輯工項單價」顯示「最後修改：人 時間」。

## 第一次使用與「不能刪掉同事建的」（使用者 2026-11-23）

- **只存在某台裝置的工項（同事自己建的）一律保留並自動上傳，不詢問、也不會因為按「取消」而消失。**
- 舊裝置（以前在這台改過單價）：第一次開新版時，只有「雲端也有、但單價／單位／類別不同」的項目會問「要上傳這台的版本嗎？」。按取消只是這幾項改用雲端版本。
- 新裝置：直接用雲端版本，不會詢問。
- 每次開啟都會拿這台和「上次看到的雲端版本」比對：這台新增或離線時改的，自動補傳；別人在這段時間改過的同一項，以別人的新版本為準，不會被舊價蓋掉。
- 使用中收到別人的更新時，這台還沒上傳的新增工項和修改會保留（三方合併），不會被雲端版本洗掉。
- 刪除仍只有李鎮宇能做（改名例外）。
- 同事電腦裡的工項要等**那台電腦**打開新版才會上傳，所以上線後請每位同事在平常用的電腦／手機打開一次報價系統。

## 需要核准後才部署的 Firebase 規則

在 `firebase-database.rules.json` 的 `rules` 底下新增（`sync`、`ops`、`leads` 不動）：

```json
"quotation": {
  ".read": false,
  ".write": false,
  "yutesign": {
    ".read": false,
    ".write": false,
    "items": {
      ".read": "auth != null && auth.token.email_verified == true && auth.token.email.matches(/^[^@]+@yutesign[.]com$/)",
      "$key": {
        ".write": "auth != null && auth.token.email_verified == true && auth.token.email.matches(/^[^@]+@yutesign[.]com$/) && newData.exists()",
        ".validate": "newData.hasChildren(['n', 'by', 'at']) && newData.child('by').val() == auth.token.email && (newData.child('del').val() == true ? (auth.token.email == 'shower.li@yutesign.com' || newData.child('moved').isString()) : newData.hasChildren(['c', 'u', 'p']))",
        "n": { ".validate": "newData.isString() && newData.val().length > 0 && newData.val().length <= 300" },
        "c": { ".validate": "newData.isString() && newData.val().length <= 100" },
        "u": { ".validate": "newData.isString() && newData.val().length <= 20" },
        "p": { ".validate": "newData.isNumber()" },
        "lo": { ".validate": "newData.isNumber()" },
        "hi": { ".validate": "newData.isNumber()" },
        "f": { ".validate": "newData.isNumber()" },
        "by": { ".validate": "newData.isString()" },
        "at": { ".validate": "newData.isNumber() && newData.val() <= now + 60000" },
        "del": { ".validate": "newData.isBoolean()" },
        "moved": { ".validate": "newData.isString() && newData.val().length <= 300" },
        "$other": { ".validate": false }
      }
    }
  }
}
```

意思：只有已驗證的 @yutesign.com 帳號能讀寫；每筆一定記錄寫入者本人（不能冒用別人名字）；不能整筆刪掉紀錄（`newData.exists()`），刪除工項只能寫 `del: true`，而且只有李鎮宇能寫（改名例外）；只接受上面列出的欄位。

## 上線順序

1. 使用者同意規則 → 修改規則檔、部署規則（Firebase 主控台或 CLI，由使用者決定方式）。規則沒部署前，新版會讀寫失敗，單價只存在各自裝置（和現在一樣），並提示同步失敗。
2. 備份 OPS（照慣例）→ 合併部署程式。
3. 使用者先在**改過單價的那台電腦**開報價系統，按「確定」上傳；再開手機確認看到同樣的單價。

## 測試

`smoke-quotation.mjs` 情境 Q-prices（17 項，模擬雲端；新增：同事按取消仍保留並上傳自己建的工項、離線新增的工項在別人更新後仍保留、重開後補傳且不蓋掉別人的新價）：改單價寫一筆並記修改人、同事開啟看到新價與修改人、報價單用新價、同事不能刪（還原）、同事可改名、李鎮宇可刪、重開後刪除與改名生效、離線先存本機再自動補傳、舊裝置第一次詢問並只上傳自己改的、不蓋掉別人的新價、手機與電腦顯示最後修改人、沒有頁面錯誤。電腦版觀察雜湊仍為 `3dfe0700454e18df`。
