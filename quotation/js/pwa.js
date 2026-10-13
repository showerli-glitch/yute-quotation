// QUOTATION PWA (new code, not extracted from the baseline): service worker on phones/tablets and in the
// installed app, Google sign-in by full-page redirect inside the installed app (the popup cannot report back
// there; Google shows "400 malformed"), and a new-version notice. Same approach as OPS (ops/js/modules/mobile.js).
const QPWA_OAUTH_KEY = 'yutesign_quote_oauth_pending';

function qpwaIsStandalone() {
  return !!(window.__forceStandalone || window.matchMedia('(display-mode: standalone)').matches || navigator.standalone);
}

function qpwaRedirect(purpose) {
  const state = purpose + '.' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  try { localStorage.setItem(QPWA_OAUTH_KEY, JSON.stringify({ state, purpose, at: Date.now() })); } catch (e) { alert('這支手機無法暫存登入狀態，請改用 Safari 開啟'); return; }
  const scope = purpose === 'login' ? 'https://www.googleapis.com/auth/userinfo.email ' + SCOPES : SCOPES;
  const params = new URLSearchParams({
    client_id: CLIENT_ID, redirect_uri: location.origin + location.pathname, response_type: 'token',
    scope, include_granted_scopes: 'true', prompt: purpose === 'login' ? 'select_account' : '', state,
  });
  if (!params.get('prompt')) params.delete('prompt');
  location.assign('https://accounts.google.com/o/oauth2/v2/auth?' + params.toString());
}

// The same steps as the login popup callback in app.js (initLoginGsi); keep the two in step.
async function qpwaCompleteLogin(token) {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: 'Bearer ' + token } });
    const user = await res.json();
    if (!user.email || !user.email.endsWith('@' + ALLOWED_DOMAIN)) {
      showLoginError('此帳號無使用權限，請使用 @yutesign.com 帳號');
      if (window.google?.accounts?.oauth2?.revoke) google.accounts.oauth2.revoke(token);
      return;
    }
    driveAccessToken = token;
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = '';
    localStorage.setItem('yutesign_session', JSON.stringify({ email: user.email, loginTime: Date.now() }));
    await fbSignIn(token, user.email).catch(err => console.warn('Firebase 登入失敗', err));
    await driveListFiles();
  } catch (e) {
    showLoginError('驗證失敗：' + e.message);
  }
}

function qpwaHandleReturn() {
  const hash = String(location.hash || '');
  if (!/[#&](access_token|error)=/.test(hash)) return;
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  let pending = null;
  try { pending = JSON.parse(localStorage.getItem(QPWA_OAUTH_KEY) || 'null'); localStorage.removeItem(QPWA_OAUTH_KEY); } catch (e) { pending = null; }
  history.replaceState(null, '', location.pathname + location.search);
  if (!pending || pending.state !== params.get('state') || Date.now() - pending.at > 10 * 60 * 1000) { showLoginError('登入逾時或狀態不符，請再按一次登入。'); return; }
  const token = params.get('access_token');
  if (params.get('error') || !token) { if (pending.purpose === 'login') showLoginError('授權失敗，請再試一次'); return; }
  if (pending.purpose === 'login') qpwaCompleteLogin(token);
  else {
    driveAccessToken = token;
    const session = JSON.parse(localStorage.getItem('yutesign_session') || '{}');
    fbSignIn(token, session.email).catch(err => console.warn('Firebase 登入失敗', err));
    setTimeout(() => alert('雲端硬碟已連線，請再按一次剛才的雲端功能'), 300);
  }
}

(function qpwaHook() {
  const originalStart = window.startLogin;
  window.startLogin = function () {
    if (qpwaIsStandalone()) {
      document.getElementById('btnLogin').textContent = '登入中...';
      document.getElementById('btnLogin').disabled = true;
      qpwaRedirect('login');
      return;
    }
    return originalStart.apply(this, arguments);
  };
  const originalDriveAuth = window.driveAuth;
  window.driveAuth = function (action) {
    if (qpwaIsStandalone() && !driveAccessToken) { qpwaRedirect('drive'); return; }
    return originalDriveAuth.apply(this, arguments);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(qpwaHandleReturn, 0));
  else setTimeout(qpwaHandleReturn, 0);
})();

// Service worker: phones, tablets and the installed app only; desktop browsers keep plain website behaviour.
function qpwaRegisterServiceWorker() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  if (!window.matchMedia('(max-width: 1279px), (display-mode: standalone)').matches) return;
  navigator.serviceWorker.register('quotation-sw.js').catch(() => {});
}
window.addEventListener('load', qpwaRegisterServiceWorker);

// New-version notice from the cache-busting stamp (15 s after load, every 5 minutes, on return to the app).
let qpwaNoticeShown = false;
function qpwaCurrentStamp() {
  return ((document.querySelector('script[src*="quotation/js/pwa.js"]')?.getAttribute('src') || '').match(/\?v=([0-9a-f]{8})/) || [])[1] || '';
}
async function qpwaCheckNewVersion() {
  if (qpwaNoticeShown || location.protocol === 'file:') return false;
  const current = qpwaCurrentStamp();
  if (!current) return false;
  try {
    const res = await fetch(location.pathname, { cache: 'no-store' });
    if (!res.ok) return false;
    const remote = ((await res.text()).match(/quotation\/js\/pwa\.js\?v=([0-9a-f]{8})/) || [])[1] || '';
    if (remote && remote !== current) {
      qpwaNoticeShown = true;
      const bar = document.createElement('div');
      bar.id = 'qpwa-new-version';
      bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:#123D33;color:#fff;padding:10px 16px;font-size:14px;display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap';
      const text = document.createElement('span'); text.textContent = '報價系統已更新，請重新整理（' + remote + '）。';
      const btn = document.createElement('button'); btn.textContent = '立即重新整理'; btn.style.cssText = 'background:#D5EBDD;color:#123D33;border:0;border-radius:8px;padding:8px 14px;font-weight:700;min-height:40px'; btn.onclick = () => location.reload();
      const later = document.createElement('button'); later.textContent = '稍後'; later.style.cssText = 'background:transparent;color:#fff;border:1px solid #fff;border-radius:8px;padding:8px 12px;min-height:40px'; later.onclick = () => bar.remove();
      bar.append(text, btn, later);
      document.body.prepend(bar);
      return true;
    }
  } catch (e) { /* offline */ }
  return false;
}
setTimeout(qpwaCheckNewVersion, 15000);
setInterval(qpwaCheckNewVersion, 5 * 60 * 1000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') qpwaCheckNewVersion(); });
