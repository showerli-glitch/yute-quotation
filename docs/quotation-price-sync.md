# 報價系統：工項單價雲端同步（第 4 步）

分支 `claude/quotation-price-sync`。程式在 `quotation/js/pricesync.js`，只包裝既有函式（`saveDb`、`deleteDbItem`、`updateDbItem`、`renderEditList`），原有程式不改。

## 資料

- 位置：`quotation/yutesign/items/<工項名稱編碼>`，和 OPS 的 `ops/yutesign/snapshot` 分開。
- 只存「和內建清單不同」的工項，每項一筆：`n` 名稱、`c` 類別、`u` 單位、`p` 參考單價、`lo`／`hi` 最低／最高單價、`f` 出現次數、`by` 修改人 Email、`at` 時間；刪除是 `del: true`（改名是 `del: true` 加 `moved: 新名稱`）。
- 顯示時 = 內建清單 + 這些紀錄（同一項以最新的為準）。每台裝置的 `localStorage` 仍保留一份，離線時照用。

## 規則（使用者決定 2026-10-08）

- 大家都可以新增、改單價／單位／類別、改名。
- 只有李鎮宇（shower.li@yutesign.com）可以刪除工項：畫面擋、存檔時還原，Firebase 規則也擋。
- 電腦版「編輯工項」與手機「編輯工項單價」顯示「最後修改：人 時間」。

## 第一次使用

- 舊裝置（以前在這台改過單價）：第一次開新版會問「這台有 N 項和雲端不同，要上傳嗎？」。只比對這台相對「內建清單」改過、而且和雲端不同的項目，逐項上傳，不會用舊價蓋掉別人新改的。按取消就改用雲端版本。
- 新裝置：直接用雲端版本，不會詢問。
- 離線時存的修改：先存在這台，下次連上自動補傳。

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

`smoke-quotation.mjs` 情境 Q-prices（14 項，模擬雲端）：改單價寫一筆並記修改人、同事開啟看到新價與修改人、報價單用新價、同事不能刪（還原）、同事可改名、李鎮宇可刪、重開後刪除與改名生效、離線先存本機再自動補傳、舊裝置第一次詢問並只上傳自己改的、不蓋掉別人的新價、手機與電腦顯示最後修改人、沒有頁面錯誤。電腦版觀察雜湊仍為 `3dfe0700454e18df`。
