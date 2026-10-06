// Shared harness for OPS smoke tests: serves unmodified project files over local HTTP,
// replaces the Firebase compat SDK and Google Identity Services with an in-memory mock
// whose "cloud" lives only in this Node process, and aborts every other external request.
// It never talks to production Firebase.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const { chromium } = await import(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg', '.ico':'image/x-icon', '.svg':'image/svg+xml' };

const MOCK_FIREBASE = `(() => {
  const listeners = [];
  const email = window.__MOCK_AUTH_EMAIL || null;
  let authUser = email ? { email, uid: 'mock-' + email, emailVerified: true } : null;
  const authObj = {
    get currentUser() { return authUser; },
    onAuthStateChanged(cb) { setTimeout(() => cb(authUser), 0); return () => {}; },
    async signInWithCredential() { return { user: authUser }; },
    async signOut() { authUser = null; },
  };
  const snap = v => ({ exists: () => v != null, val: () => v == null ? null : JSON.parse(JSON.stringify(v)) });
  const ref = p => ({
    async get() { return snap(await window.__mockRtdbGet(p)); },
    async set(v) {
      const stored = await window.__mockRtdbSet(p, JSON.parse(JSON.stringify(v)));
      listeners.filter(l => l.p === p).forEach(l => setTimeout(() => l.cb(snap(stored)), 0));
    },
    on(evt, cb) { listeners.push({ p, cb }); window.__mockRtdbGet(p).then(v => cb(snap(v))); return cb; },
    off() { for (let i = listeners.length - 1; i >= 0; i--) if (listeners[i].p === p) listeners.splice(i, 1); },
  });
  const app = { name: '[DEFAULT]' };
  const fb = {
    apps: [],
    initializeApp(cfg) { window.__mockFirebaseConfig = cfg; fb.apps.push(app); return app; },
    app() { return app; },
    database() { return { ref }; },
    auth: Object.assign(() => authObj, { GoogleAuthProvider: { credential: () => ({ mock: true }) } }),
  };
  window.firebase = fb;
  window.__MOCK_FIREBASE = true;
})();`;
// Google Identity Services stub: the token client answers immediately with a mock access token, so a
// click on 「使用 Google 帳號登入」 runs the app's real login callback (userinfo is answered by the harness).
const MOCK_GSI = `window.google = { accounts: { oauth2: { initTokenClient(cfg) { return { requestAccessToken() { setTimeout(() => cfg.callback({ access_token: 'mock-access-token' }), 0); } }; }, revoke() { window.__gsiRevoked = (window.__gsiRevoked || 0) + 1; } } } };`;

// Emulates RTDB dropping null values and empty arrays/objects.
function rtdbPrune(v) {
  if (v === null || v === undefined) return undefined;
  if (Array.isArray(v)) {
    const out = v.map(rtdbPrune);
    return out.every(x => x === undefined) ? undefined : out.map(x => x === undefined ? null : x);
  }
  if (typeof v === 'object') {
    const out = {};
    for (const [k, c] of Object.entries(v)) { const pc = rtdbPrune(c); if (pc !== undefined) out[k] = pc; }
    return Object.keys(out).length ? out : undefined;
  }
  return v;
}

export async function createHarness({ label, rootDir, port }) {
  const ORIGIN = `http://127.0.0.1:${port}`;
  const served = [];
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, ORIGIN).pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(rootDir, p);
    if (!file.startsWith(path.resolve(rootDir)) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      served.push(`404 ${p}`); res.writeHead(404); res.end('not found'); return;
    }
    served.push(`200 ${p}`);
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(r => server.listen(port, '127.0.0.1', r));

  const state = { cloud: null, scenario: '' };
  const results = [];
  const consoleLog = [];
  const blocked = [];
  const mocked = new Set();
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });

  function check(name, pass, detail = '') {
    const d = typeof detail === 'string' ? detail : JSON.stringify(detail);
    results.push({ scenario: state.scenario, name, pass: !!pass, detail: d });
    console.log(`${pass ? 'PASS' : 'FAIL'} [${state.scenario}] ${name}${d ? ' — ' + d : ''}`);
  }

  async function newContext(email, { fixedTime, geolocation } = {}) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-TW', timezoneId: 'Asia/Taipei', serviceWorkers: 'block', geolocation, permissions: geolocation ? ['geolocation'] : [] });
    if (fixedTime) await ctx.clock.setFixedTime(fixedTime);
    await ctx.exposeFunction('__mockRtdbGet', p => (p === 'ops/yutesign/snapshot' ? state.cloud : null));
    await ctx.exposeFunction('__mockRtdbSet', (p, v) => {
      if (p !== 'ops/yutesign/snapshot') throw new Error('unexpected path ' + p);
      state.cloud = rtdbPrune(v);
      return state.cloud;
    });
    await ctx.addInitScript(({ email }) => {
      window.__MOCK_AUTH_EMAIL = email;
      try {
        if (!localStorage.getItem('yutesign_ops_auth_session')) {
          localStorage.setItem('yutesign_ops_auth_session', JSON.stringify({ email, loginTime: Date.now() }));
        }
      } catch (e) {}
      window.__toasts = [];
      document.addEventListener('DOMContentLoaded', () => {
        const t = document.getElementById('toast');
        if (!t) return;
        new MutationObserver(() => { if (t.classList.contains('show')) window.__toasts.push(t.textContent); })
          .observe(t, { attributes: true, childList: true, characterData: true, subtree: true });
      });
    }, { email });
    await ctx.route('**/*', route => {
      const url = route.request().url();
      if (url.startsWith(ORIGIN + '/')) return route.continue();
      if (url.startsWith('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js')) { mocked.add(url); return route.fulfill({ status: 200, contentType: 'text/javascript', body: MOCK_FIREBASE }); }
      if (url.startsWith('https://www.gstatic.com/firebasejs/10.12.0/')) { mocked.add(url); return route.fulfill({ status: 200, contentType: 'text/javascript', body: '/* mocked */' }); }
      if (url.startsWith('https://accounts.google.com/gsi/client')) { mocked.add(url); return route.fulfill({ status: 200, contentType: 'text/javascript', body: MOCK_GSI }); }
      if (url.startsWith('https://www.googleapis.com/oauth2/v2/userinfo')) { mocked.add(url); return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ email }) }); }
      blocked.push(url);
      return route.abort('blockedbyclient');
    });
    return ctx;
  }

  async function openApp(ctx) {
    const page = await ctx.newPage();
    page.on('console', m => { if (['error', 'warning'].includes(m.type())) consoleLog.push({ scenario: state.scenario, type: m.type(), text: m.text() }); });
    page.on('pageerror', e => consoleLog.push({ scenario: state.scenario, type: 'pageerror', text: String(e?.stack || e) }));
    page.on('websocket', ws => blocked.push('websocket:' + ws.url()));
    await page.goto(`${ORIGIN}/ops/`, { waitUntil: 'load' });
    await waitReady(page);
    return page;
  }
  async function waitReady(page) {
    await page.waitForFunction(() => typeof opsCloudReady !== 'undefined' && opsCloudReady === true && !document.body.classList.contains('auth-pending'), null, { timeout: 15000 });
    await page.waitForTimeout(700);
  }
  async function waitSynced(page) {
    await page.waitForFunction(() => !opsCloudPendingSnapshot && !(typeof opsCloudSaveInFlight !== 'undefined' && opsCloudSaveInFlight), null, { timeout: 15000 });
  }
  const lastToast = page => page.evaluate(() => window.__toasts[window.__toasts.length - 1] || '');
  const clearToasts = page => page.evaluate(() => { window.__toasts = []; });
  const isOpen = (page, id) => page.evaluate(id => document.getElementById(id)?.classList.contains('open') || false, id);
  const visible = (page, sel) => page.locator(sel).first().isVisible().catch(() => false);
  async function nav(page, pageName) { await page.evaluate(p => navTo(p, document.getElementById('nav-' + p)), pageName); await page.waitForTimeout(200); }
  const counts = page => page.evaluate(() => ({ CASES: CASES.length, PAYABLES: PAYABLES.length, RECEIVABLES: RECEIVABLES.length, EXPENSES: EXPENSES.length, CLIENTS: CLIENTS.length, VENDORS: VENDORS.length, PAYROLL: PAYROLL.length, ATTENDANCE_RECORDS: ATTENDANCE_RECORDS.length, ATTENDANCE_LEAVES: ATTENDANCE_LEAVES.length }));

  async function finish(outJson, extra = {}) {
    await browser.close();
    server.close();
    const appConsole = consoleLog.filter(c => !c.text.includes('ERR_BLOCKED_BY_CLIENT'));
    fs.writeFileSync(outJson, JSON.stringify({ label, rootDir, results, consoleLog, blockedExternal: blocked, mockedExternal: [...mocked], served: [...new Set(served)], ...extra }, null, 2));
    const fails = results.filter(r => !r.pass).length;
    console.log(`\n${label}: ${results.length - fails}/${results.length} passed; app console errors/warnings/pageerrors (excluding harness-blocked resources): ${appConsole.length}; blocked external: ${blocked.length}`);
    return fails;
  }

  return {
    state, check, newContext, openApp, waitReady, waitSynced, lastToast, clearToasts, isOpen, visible, nav, counts, finish,
    setScenario: name => { state.scenario = name; },
  };
}
