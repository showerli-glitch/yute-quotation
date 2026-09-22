// OPS runtime configuration and cloud state. Extracted verbatim from ops/index.html.

// 多公司預留欄位（現階段僅宇德，畫面不顯示切換器）
const COMPANY_ID = 'yutesign';
const OPS_GOOGLE_CLIENT_ID = '239869421522-cqs68t3pnahjbmv9ld1k08b4p79s34k4.apps.googleusercontent.com';
const OPS_ALLOWED_USERS = {
  'shower.li@yutesign.com': 'shower',
  'nc@yutesign.com': 'nc',
};
const OPS_AUTH_SESSION_KEY = 'yutesign_ops_auth_session';
const OPS_AUTH_SESSION_HOURS = 4;
const OPS_AUTH_ENFORCED = location.protocol === 'http:' || location.protocol === 'https:';
const OPS_CLOUD_PATH = 'ops/yutesign/snapshot';
const OPS_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAz-MeKorzgp-_EjiMWvugiz_JFDjk4NIs',
  authDomain: 'yutesign-sync.firebaseapp.com',
  databaseURL: 'https://yutesign-sync-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'yutesign-sync',
  storageBucket: 'yutesign-sync.firebasestorage.app',
  messagingSenderId: '709833651829',
  appId: '1:709833651829:web:6d52a99ceefc1915caaa3c'
};
let opsLoginTokenClient = null;
let opsAuthenticatedEmail = '';
let opsAuthenticatedUserId = '';
let opsAuthInitAttempts = 0;
let opsFbApp = null;
let opsFbDb = null;
let opsCloudReady = false;
let opsApplyingRemote = false;
let opsCloudSaveTimer = null;
let opsCloudLastSavedAt = '';
let opsCloudLastSavedBy = '';
let opsCloudLastSummary = '';
let opsCloudBaseSnapshot = null;
let opsCloudConflict = false;
let opsCloudPendingSync = false;
let opsCloudPendingSnapshot = null;
let opsCloudConflictModalShown = false;
let opsCloudPendingSince = null;
let opsCloudSaveInFlight = false;
let opsCloudStuckModalShown = false;
let opsCloudWatchdogTimer = null;
let opsCloudConsecutiveFailures = 0;
