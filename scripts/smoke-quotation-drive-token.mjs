// Quotation Drive token expiry (claude/quotation-drive-token). Google access tokens last about an hour; the page
// used to keep the first token forever, so 雲端儲存 after an hour failed with 401 "Invalid Credentials".
// Mock Google only; never touches production or the real Drive.
//
// Setup (outside the repo):  mkdir /tmp/ops-smoke && cd /tmp/ops-smoke && npm i playwright-core
// Run:  PLAYWRIGHT_CORE=/tmp/ops-smoke/node_modules/playwright-core/index.mjs \
//         node scripts/smoke-quotation-drive-token.mjs <label> <rootDir> <port> <out.json>
import { createHarness } from './smoke-lib.mjs';

const [label, rootDir, portArg, outJson] = process.argv.slice(2);
const H = await createHarness({ label, rootDir, port: Number(portArg) });
const { check, newContext } = H;
const ORIGIN = `http://127.0.0.1:${portArg}`;

H.setScenario('Q-drive-token');
const ctx = await newContext('shower.li@yutesign.com', { fixedTime: new Date('2026-10-19T14:00:00+08:00') });
await ctx.addInitScript(() => {
  try { if (!localStorage.getItem('yutesign_session')) localStorage.setItem('yutesign_session', JSON.stringify({ email: 'shower.li@yutesign.com', loginTime: Date.now() })); } catch (e) {}
});
const page = await ctx.newPage();
const errors = [];
const alerts = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('dialog', d => { alerts.push(d.message()); d.accept(); });
// 模擬 Google：帶「被撤銷」權杖的請求回 401；其餘照常（上傳、清單由 smoke-lib 模擬）。
const seenTokens = [];
await page.route('https://www.googleapis.com/**', route => {
  const auth = route.request().headers()['authorization'] || '';
  seenTokens.push(auth.replace('Bearer ', ''));
  if (auth.includes('revoked-token')) return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: { code: 401, message: 'Request had invalid authentication credentials.', status: 'UNAUTHENTICATED' } }) });
  const url = route.request().url();
  if (/\/drive\/v3\/files\/[^/?]+\?fields=modifiedTime/.test(url)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ modifiedTime: '2026-10-19T06:00:00.000Z' }) });
  if (/\/drive\/v3\/files\/[^/?]+\?alt=media/.test(url)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ projName: 'QA 雲端載入', quoteItems: [] }) });
  return route.fallback();
});
await page.goto(`${ORIGIN}/`, { waitUntil: 'load' });
await page.waitForFunction(() => typeof renderQuote === 'function' && document.getElementById('mainApp')?.style.display !== 'none', null, { timeout: 15000 });
await page.waitForTimeout(400);

const fns = await page.evaluate(() => ['setDriveAccessToken', 'driveTokenValid'].filter(n => typeof window[n] !== 'function'));
check('權杖到期函式可用', fns.length === 0, fns);
await page.evaluate(() => {
  addItem(dbItems[0]);
  document.getElementById('projName').value = 'QA 權杖測試';
  window.__tokenRequests = 0;
  const orig = tokenClient.requestAccessToken.bind(tokenClient);
  tokenClient.requestAccessToken = (...a) => { window.__tokenRequests += 1; return orig(...a); };
});
const save = async () => { alerts.length = 0; await page.evaluate(() => saveQuoteToDrive()); await page.waitForTimeout(600); return { requests: await page.evaluate(() => window.__tokenRequests), alerts: alerts.slice(), token: await page.evaluate(() => driveAccessToken), valid: await page.evaluate(() => driveTokenValid()) }; };

// 1. 第一次存：向 Google 要權杖，存檔成功，記下約 1 小時的到期時間
const s1 = await save();
const exp = await page.evaluate(() => Math.round((driveTokenExpiresAt - Date.now()) / 60000));
check('第一次雲端儲存：取得權杖、存檔成功、權杖約 60 分鐘到期', s1.requests === 1 && s1.alerts.some(a => a.includes('已儲存到公司 Google Drive')) && exp === 60, { s1, exp });

// 2. 1 小時內再存：沿用同一個權杖
const s2 = await save();
check('1 小時內再存：不重新要權杖，直接存檔成功', s2.requests === 1 && s2.alerts.some(a => a.includes('已儲存')), s2);

// 3. 權杖過期（模擬開著報價單超過 1 小時）：先重新要權杖再存，不再 401
await page.evaluate(() => { driveAccessToken = 'expired-token'; driveTokenExpiresAt = Date.now() - 1000; });
const before3 = seenTokens.length;
const s3 = await save();
check('權杖過期後按雲端儲存：自動重新取得權杖並存檔成功（舊權杖沒有送出去）', s3.requests === 2 && s3.alerts.some(a => a.includes('已儲存')) && !s3.alerts.some(a => a.includes('401')) && !seenTokens.slice(before3).includes('expired-token') && s3.valid, { s3, sent: seenTokens.slice(before3) });

// 4. Google 中途撤銷權杖（回 401）：顯示好懂的訊息、清掉權杖；再按一次就重新取得並成功
await page.evaluate(() => { driveAccessToken = 'revoked-token'; driveTokenExpiresAt = Date.now() + 3600 * 1000; });
const s4 = await save();
check('Google 回 401：顯示「授權已過期，請再按一次」而不是一大段英文錯誤，權杖清掉', s4.alerts.some(a => a.includes('雲端授權已過期，請再按一次')) && !s4.alerts.some(a => a.includes('UNAUTHENTICATED')) && s4.token === null, s4);
const s5 = await save();
check('再按一次：重新取得權杖並存檔成功', s5.requests === 3 && s5.alerts.some(a => a.includes('已儲存')), s5);

// 5. 雲端清單上的「載入」：權杖過期時也會先重新取得
await page.evaluate(() => { driveAccessToken = 'expired-token'; driveTokenExpiresAt = Date.now() - 1000; });
alerts.length = 0;
await page.evaluate(() => driveLoad('qa-file-1'));
await page.waitForTimeout(600);
const l = await page.evaluate(() => ({ requests: window.__tokenRequests, name: document.getElementById('projName').value }));
check('權杖過期時按「載入」：先重新取得權杖再載入', l.requests === 4 && l.name === 'QA 雲端載入', { l, alerts: alerts.slice() });
check('沒有頁面錯誤', errors.length === 0, errors);
await ctx.close();

const fails = await H.finish(outJson);
process.exit(fails ? 1 : 0);
