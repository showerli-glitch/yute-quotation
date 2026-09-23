/**
 * 宇德住宅裝修需求表：寄送備份信給客戶
 *
 * 部署方式：script.google.com 以 shower.li@yutesign.com 建立專案 → 貼上本檔 →
 * 部署 → 新增部署作業 → 網頁應用程式（執行身分：我；存取權：所有人）。
 *
 * 安全設計：
 * - 表單只送來修改連結 token；收件人、內容一律由本程式回 Firebase 讀取，
 *   不信任網頁送來的任何 Email 或內容，無法被拿來寄信給任意對象。
 * - 同一版本（updatedAt）只寄一次；同一張需求表最多寄 MAX_MAILS_PER_TOKEN 封。
 *
 * 欄位順序與名稱需與 form/schema.js 的 LEAD_SECTIONS 一致；新增欄位時兩邊都要改。
 */

const DB_URL = 'https://yutesign-sync-default-rtdb.asia-southeast1.firebasedatabase.app';
const EDIT_PATH = 'leads/yutesign/edits';
const FORM_URL = 'https://showerli-glitch.github.io/yute-quotation/form/';
const MAX_MAILS_PER_TOKEN = 10;
const COMPANY = '宇德室內裝修股份有限公司';
const COMPANY_PHONE = '02-2652-2112';
const REPLY_TO = 'shower.li@yutesign.com';

const SECTIONS = [
  ['基本資料', [['name', '姓名'], ['phone', '聯絡電話'], ['email', '電子郵件'], ['line', 'LINE ID'], ['address', '裝修地址'], ['contact', '偏好聯繫方式']]],
  ['家庭成員', [['people', '居住人數'], ['family', '家庭組成'], ['members', '家中成員'], ['petOther', '寵物種類'], ['liveFocus', '居家使用重點']]],
  ['空間資訊', [['houseType', '房屋類型'], ['area', '坪數（坪）'], ['layout', '格局'], ['houseAge', '屋齡'], ['floor', '樓層'], ['spaces', '希望施工的空間'], ['renoType', '裝修類型']]],
  ['施工需求', [['workItems', '施工項目'], ['style', '風格偏好'], ['colorPref', '色調偏好'], ['priorities', '特別重視的項目'], ['startDate', '希望開工日期'], ['endDate', '希望完工日期']]],
  ['預算與服務', [['budget', '預算範圍（萬元）'], ['designer', '設計規劃方式'], ['reference', '是否有參考案例或靈感圖片'], ['services', '希望服務項目'], ['source', '您從哪裡得知宇德？'], ['sourceOther', '從哪裡得知'], ['notes', '其他需求與備註']]],
  ['收納需求', [['shoes', '鞋子數量（雙）'], ['clothes', '衣物量'], ['storage', '特殊收納需求']]],
  ['設備與照明', [['smart', '智能設備'], ['lighting', '照明偏好']]],
  ['參考資料', [['refs', '目前已有的參考資料']]],
];

function doPost(e) {
  let result;
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    result = sendBackup_(String(body.token || ''));
  } catch (err) {
    console.error(err);
    result = { ok: false, reason: 'error' };
  }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

function sendBackup_(token) {
  if (!/^[A-Za-z0-9]{32}$/.test(token)) return { ok: false, reason: 'bad-token' };

  // 公開規則只允許讀取未過期的單一連結；讀不到就代表 token 無效或已過期
  const res = UrlFetchApp.fetch(`${DB_URL}/${EDIT_PATH}/${token}.json`, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) return { ok: false, reason: 'not-found' };
  const record = JSON.parse(res.getContentText() || 'null');
  if (!record || !record.form) return { ok: false, reason: 'not-found' };

  const email = String(record.form.email || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, reason: 'no-email' };

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const props = PropertiesService.getScriptProperties();
    const key = 'm_' + token;
    const state = JSON.parse(props.getProperty(key) || '{"n":0,"v":[]}');
    const version = String(record.updatedAt || '');
    if (state.v.indexOf(version) !== -1) return { ok: true, reason: 'already-sent' };
    if (state.n >= MAX_MAILS_PER_TOKEN) return { ok: false, reason: 'limit' };

    const isUpdate = state.n > 0;
    MailApp.sendEmail({
      to: email,
      subject: isUpdate ? `【${COMPANY}】您的裝修需求表已更新` : `【${COMPANY}】已收到您的裝修需求表`,
      htmlBody: mailHtml_(record, token, isUpdate),
      name: COMPANY,
      replyTo: REPLY_TO,
    });
    state.n += 1;
    state.v.push(version);
    state.at = Date.now();
    props.setProperty(key, JSON.stringify(state));
  } finally {
    lock.releaseLock();
  }
  cleanupOldProps_();
  return { ok: true };
}

function esc_(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function mailHtml_(record, token, isUpdate) {
  const f = record.form;
  const link = `${FORM_URL}?edit=${token}`;
  const until = Utilities.formatDate(new Date(record.expiresAt), 'Asia/Taipei', 'yyyy/MM/dd HH:mm');
  const sections = SECTIONS.map(([title, fields]) => {
    const rows = fields.filter(([k]) => f[k]).map(([k, label]) =>
      `<tr><td style="padding:6px 12px 6px 0;color:#8a7462;vertical-align:top;white-space:nowrap">${esc_(label)}</td><td style="padding:6px 0;color:#3a2e24;white-space:pre-wrap">${esc_(f[k])}</td></tr>`).join('');
    return rows ? `<h3 style="font-size:14px;color:#5c4a35;border-left:3px solid #c47f5f;padding-left:8px;margin:22px 0 6px">${esc_(title)}</h3><table style="border-collapse:collapse;font-size:14px">${rows}</table>` : '';
  }).join('');
  const intro = isUpdate
    ? `${esc_(f.name)} 您好，<br>您的裝修需求表已更新，以下是最新內容。`
    : `${esc_(f.name)} 您好，<br>感謝您填寫宇德的住宅裝修需求表，我們會盡快與您聯繫。以下是您填寫的內容備份。`;
  return `<div style="font-family:'PingFang TC','Noto Sans TC','Microsoft JhengHei',sans-serif;max-width:640px;margin:0 auto;color:#3a2e24;line-height:1.7">
  <div style="background:#f3ebe1;border-radius:12px;padding:22px;text-align:center">
    <div style="font-size:13px;letter-spacing:0.2em;color:#8a7462">${COMPANY}</div>
    <div style="font-size:22px;letter-spacing:0.15em;margin-top:6px">住宅裝修需求表</div>
  </div>
  <p style="margin:20px 0 0">${intro}</p>
  <div style="background:#faf6f0;border:1px solid #e6d9c8;border-radius:10px;padding:14px 16px;margin:18px 0">
    <div style="font-weight:600">需要修改或補充？</div>
    <div style="font-size:14px">請點下方按鈕修改，連結可使用到 <b>${until}</b>。此連結僅供您本人使用，請勿轉寄。</div>
    <div style="margin-top:12px"><a href="${link}" style="display:inline-block;background:#8c6f5a;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px">修改我的需求表</a></div>
    <div style="font-size:12px;color:#8a7462;margin-top:8px">連結過期後，請直接來電 ${COMPANY_PHONE} 或回覆本信與我們聯繫。</div>
  </div>
  ${sections}
  <p style="font-size:12px;color:#8a7462;margin-top:28px;border-top:1px solid #e6d9c8;padding-top:12px">${COMPANY}　電話 ${COMPANY_PHONE}<br>本信由系統自動寄出；如有任何問題，可直接回覆此信。若您未曾填寫需求表，請忽略本信。</p>
</div>`;
}

// 超過 30 天的寄送紀錄可以清掉，避免指令碼屬性無限增加
function cleanupOldProps_() {
  const props = PropertiesService.getScriptProperties();
  const all = props.getProperties();
  const cutoff = Date.now() - 30 * 86400000;
  Object.keys(all).forEach(k => {
    if (k.indexOf('m_') !== 0) return;
    try { if ((JSON.parse(all[k]).at || 0) < cutoff) props.deleteProperty(k); } catch (e) { props.deleteProperty(k); }
  });
}

// 部署前可在編輯器執行一次，觸發 MailApp／UrlFetchApp 授權
function authorize() {
  UrlFetchApp.fetch(DB_URL + '/.json?shallow=true', { muteHttpExceptions: true });
  console.log('剩餘寄信額度：' + MailApp.getRemainingDailyQuota());
}
