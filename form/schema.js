// 住宅裝修需求表欄位定義：客戶填寫頁（index.html）與內部檢視頁（admin.html）共用。
// 欄位 key 會直接成為 Firebase leads/yutesign/items/{id}/form/{key}，改名前要考慮舊資料相容。
const LEAD_FORM_VERSION = '2026-09-23.2';
const LEAD_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAz-MeKorzgp-_EjiMWvugiz_JFDjk4NIs',
  authDomain: 'yutesign-sync.firebaseapp.com',
  databaseURL: 'https://yutesign-sync-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'yutesign-sync',
  storageBucket: 'yutesign-sync.firebasestorage.app',
  messagingSenderId: '709833651829',
  appId: '1:709833651829:web:6d52a99ceefc1915caaa3c'
};
const LEAD_ROOT_PATH = 'leads/yutesign';
const LEAD_DB_PATH = LEAD_ROOT_PATH + '/items';
const LEAD_EDIT_PATH = LEAD_ROOT_PATH + '/edits';
const LEAD_EDIT_DAYS = 7;

const LEAD_STATUSES = [
  { value: 'new', label: '新進' },
  { value: 'contacted', label: '已聯繫' },
  { value: 'quoted', label: '已報價' },
  { value: 'won', label: '成案' },
  { value: 'lost', label: '未成案' },
];

// type: text | tel | email | number | date | select | radio | checks | textarea | budget
// row: 同一 row 值的相鄰欄位排成同一列
// other: 勾選指定選項時顯示補充文字欄，存成獨立欄位 key
const LEAD_SECTIONS = [
  { title: '基本資料', fields: [
    { key: 'name', label: '姓名', type: 'text', required: true, max: 50, placeholder: '王小明', row: 'a' },
    { key: 'phone', label: '聯絡電話', type: 'tel', required: true, max: 30, placeholder: '0912-345-678', row: 'a' },
    { key: 'email', label: '電子郵件', type: 'email', max: 100, placeholder: 'example@email.com', row: 'b' },
    { key: 'line', label: 'LINE ID', type: 'text', max: 50, placeholder: '輸入 LINE ID 方便聯繫', row: 'b' },
    { key: 'address', label: '裝修地址', type: 'text', max: 200, placeholder: '台北市信義區…' },
    { key: 'contact', label: '偏好聯繫方式', type: 'radio', options: ['電話', 'LINE', 'Email', '皆可'] },
  ]},
  { title: '家庭成員', fields: [
    { key: 'people', label: '居住人數', type: 'select', options: ['1人', '2人', '3人', '4人', '5人', '6人以上'], row: 'a' },
    { key: 'family', label: '家庭組成', type: 'select', options: ['單身獨居', '兩人同住（夫妻／情侶）', '小家庭（夫妻＋子女）', '三代同堂', '與父母同住', '室友合租'], row: 'a' },
    { key: 'members', label: '家中成員（可複選）', type: 'checks', options: ['嬰幼兒', '學齡兒童', '青少年', '長者（60歲以上）', '行動不便者', '貓', '狗', '其他寵物'], other: { option: '其他寵物', key: 'petOther', label: '請說明寵物種類', max: 100 } },
    { key: 'liveFocus', label: '居家使用重點（可複選）', type: 'checks', options: ['大量收納', '在家工作／書房', '親子互動空間', '長輩無障礙需求', '寵物友善設計', '娛樂影音空間', '健身空間'] },
  ]},
  { title: '空間資訊', fields: [
    { key: 'houseType', label: '房屋類型', type: 'select', options: ['新成屋', '中古屋', '預售屋', '透天厝', '別墅'], row: 'a' },
    { key: 'area', label: '坪數（坪）', type: 'number', min: 1, max: 9999, placeholder: '30', row: 'a' },
    { key: 'layout', label: '格局', type: 'select', options: ['套房', '1房1廳', '2房1廳', '2房2廳', '3房2廳', '4房2廳', '5房以上'], row: 'b' },
    { key: 'houseAge', label: '屋齡', type: 'select', options: ['新成屋（未入住）', '1～5年', '6～10年', '11～20年', '21～30年', '30年以上'], row: 'b' },
    { key: 'floor', label: '樓層', type: 'select', options: ['1樓', '2～5樓', '6～10樓', '11～20樓', '21樓以上', '透天整棟'], row: 'b' },
    { key: 'spaces', label: '希望施工的空間（可複選）', type: 'checks', options: ['客廳', '餐廳', '廚房', '主臥室', '次臥室', '兒童房', '老人房', '書房', '視聽室', '健身／娛樂室', '多功能室', '主衛浴', '客衛浴', '玄關', '陽台', '儲藏室', '全室'] },
    { key: 'renoType', label: '裝修類型（可複選）', type: 'checks', options: ['全室翻新', '局部翻修', '新屋裝潢', '老屋改造', '二次裝修'] },
  ]},
  { title: '施工需求', fields: [
    { key: 'workItems', label: '施工項目（可複選）', type: 'checks', options: ['拆除工程', '木作工程', '油漆粉刷', '泥作地磚', '木地板', '水電配管', '廚具更換', '衛浴翻新', '冷氣空調', '燈光規劃', '系統傢俱', '窗簾安裝', '鋁窗更換', '大門更換', '隔間牆調整', '天花板工程', '防水工程', '智慧家居'] },
    { key: 'style', label: '風格偏好（可複選）', type: 'checks', options: ['現代簡約', '北歐風', '工業風', '日式和風', '侘寂風', '美式鄉村', '古典歐式', '輕奢風', '新中式', '混搭', '尚未決定'] },
    { key: 'colorPref', label: '色調偏好（可複選）', type: 'checks', options: ['白色／淺色系', '大地色系', '深色系', '灰色系', '木質暖色調', '撞色設計', '尚未決定'] },
    { key: 'priorities', label: '特別重視的項目（可複選）', type: 'checks', options: ['收納機能', '採光通風', '隔音效果', '節能省電', '低甲醛環保材料', '無障礙安全設計', '易清潔好維護', '防滑、耐刮磨材質', '防油煙設計', '內外防水', '多功能複合空間', '動線規劃（走向）', '成本預算控制'] },
    { key: 'startDate', label: '希望開工日期', type: 'date', row: 'a' },
    { key: 'endDate', label: '希望完工日期', type: 'date', row: 'a', hint: '※ 若有入住期限或特殊時程需求，請於備註說明' },
  ]},
  { title: '預算與服務', fields: [
    { key: 'budget', label: '預算範圍（萬元）', type: 'budget', min: 5, max: 500, step: 5, initial: 100 },
    { key: 'designer', label: '設計規劃方式', type: 'radio', options: ['已自行找到可配合的設計師', '與宇德配合設計及裝修', '自行規劃'] },
    { key: 'reference', label: '是否有參考案例或靈感圖片', type: 'radio', options: ['有，會另外提供', '沒有', '需要設計師建議'] },
    { key: 'services', label: '希望服務項目（可複選）', type: 'checks', options: ['平立面空間規劃配置圖面', '3D 建模（僅素模）', '3D 渲染圖（建模＋材質搭配效果及出圖）', '裝修風格簡報', '施工全程監工', '新舊家具搬遷處理', '完工清潔', '完工拍攝（照片／影音）', '保固維修服務'] },
    { key: 'source', label: '您從哪裡得知宇德？', type: 'radio', options: ['親友介紹', 'Google 搜尋', 'Facebook／Instagram', '實品屋／樣品屋', '看過施工案例', '其他'], other: { option: '其他', key: 'sourceOther', label: '請說明從哪裡得知', max: 100 } },
    { key: 'notes', label: '其他需求與備註', type: 'textarea', max: 2000, placeholder: '請說明特殊需求、注意事項、入住期限或其他想法…' },
  ]},
  { title: '收納需求', fields: [
    { key: 'shoes', label: '鞋子數量（雙）', type: 'number', min: 0, max: 9999, placeholder: '20', row: 'a' },
    { key: 'clothes', label: '衣物量', type: 'select', options: ['少（1個衣櫃以內）', '中（1～2個衣櫃）', '多（3個衣櫃以上）'], row: 'a' },
    { key: 'storage', label: '特殊收納需求（可複選）', type: 'checks', options: ['包包展示', '公仔／模型展示', '行李箱收納', '掃地機器人位置', '家電收納'] },
  ]},
  { title: '設備與照明', fields: [
    { key: 'smart', label: '智能設備（可複選）', type: 'checks', options: ['智能燈控', '電動窗簾', '指紋鎖', '監控系統', '智能音響'] },
    { key: 'lighting', label: '照明偏好（可複選）', type: 'checks', options: ['明亮', '間接光', '飯店氛圍', '展示重點燈光', '無主燈設計'] },
  ]},
  { title: '參考資料', fields: [
    { key: 'refs', label: '目前已有的參考資料（可複選）', type: 'checks', options: ['已有平面圖', '已有3D圖', '已有喜歡的參考照片', 'Pinterest／Instagram參考風格'] },
  ]},
];

function leadEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

// 所有欄位 key → 顯示名稱（含「其他」補充欄），供後台顯示與修改紀錄使用
const LEAD_FIELD_LABELS = {};
LEAD_SECTIONS.forEach(s => s.fields.forEach(f => {
  LEAD_FIELD_LABELS[f.key] = f.label.replace(/（可複選）/, '');
  if (f.other) LEAD_FIELD_LABELS[f.other.key] = f.other.label.replace(/^請說明/, '');
}));
