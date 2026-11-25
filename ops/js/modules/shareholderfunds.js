// 股東資金往來 (claude/shareholder-funds). New module, not part of the verbatim split.
//
// 往來帳戶＝個案類別「私人借支」的個案（accountingTreatment 'receivable_from_related_party'），股東、親友各一個。
// 帳戶裡的錢分四種：
//   轉入：分潤款的付款方式選「轉入股東資金往來」（payable.transferToLoanCase）——錢沒領走，公司代管。
//   收回：這個帳戶的應收（股東實際拿錢進公司）。
//   沖帳：帳戶上的「差額沖帳」（case.loanAdjustments），例如公司負擔的稅金。
//   付出：這個帳戶的應付（私人借支，含期票分期）。
// 餘額＝轉入＋收回＋沖帳−付出：正數是公司代管股東的錢，負數是股東欠公司。
// 不進營收、成本、公司開銷、淨利潤或分潤。只有 shower／nc 能開（同資金試算）。
// 接進既有畫面的方式和 cash.js 一樣：包住 navTo／renderCurrentPage／applyRole 與應付、個案、資金試算的函式，不改原檔。

const SF_TRANSFER_TYPES = ['profit_advance', 'engineering_bonus', 'profit_settlement', 'shareholder_distribution'];
const SF_ADJUST_REASONS = {
  tax: '公司負擔稅金（進項可扣抵銷項）',
  absorb: '公司吸收',
  other: '其他',
};
let sfViewCode = null;

function sfCanAccess() {
  return !!currentUser && ['shower', 'nc'].includes(currentUser.id);
}

function sfIsAccount(c) {
  return !!c && c.accountingTreatment === 'receivable_from_related_party';
}

function sfIsAccountCode(code) {
  return !!code && sfIsAccount(CASES.find(c => c.code === code));
}

function sfAccounts() {
  return CASES.filter(sfIsAccount).sort((a, b) => (a.status === '結案') - (b.status === '結案') || String(b.code).localeCompare(String(a.code)));
}

function sfEsc(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function sfMoney(value) {
  const n = Math.round(Number(value) || 0);
  return `${n < 0 ? '−' : ''}$${Math.abs(n).toLocaleString('zh-TW')}`;
}

function sfBalanceText(value) {
  const n = Math.round(Number(value) || 0);
  if (n > 0) return `公司代管 ${sfMoney(n)}`;
  if (n < 0) return `欠公司 ${sfMoney(-n)}`;
  return '$0 結清';
}

function sfBalanceColor(value) {
  const n = Math.round(Number(value) || 0);
  return n > 0 ? 'var(--success)' : n < 0 ? 'var(--error)' : 'var(--text2)';
}

const SF_CHECK_TAG = /（期票 (\d+)\/(\d+)）$/;

// 一個往來帳戶的所有進出，依日期排序並算出每一筆之後的餘額。
function sfLedger(code) {
  const account = CASES.find(c => c.code === code);
  const entries = [];
  PAYABLES.filter(p => p.transferToLoanCase === code && p.status === 'paid').forEach(p => entries.push({
    kind: 'transfer', date: p.transferToLoanDate || p.doneDate || p.transferDate || '', amount: Math.round(Number(p.amount) || 0), done: true, row: p,
  }));
  RECEIVABLES.filter(r => r.case === code).forEach(r => {
    const collected = receivableIsCollected(r);
    const amount = Math.round(collected ? (Number(r.collectAmt) || receivableExpectedAmount(r)) : receivableExpectedAmount(r));
    if (!amount) return;
    entries.push({ kind: 'receive', date: r.collectDate || r.invoiceDate || '', amount, done: collected, row: r });
  });
  (account?.loanAdjustments || []).forEach(a => entries.push({
    kind: 'adjust', date: a.date || '', amount: Math.round(Number(a.amount) || 0), done: true, row: a,
  }));
  PAYABLES.filter(p => p.case === code && ['paid', 'approved', 'pending'].includes(p.status)).forEach(p => entries.push({
    kind: 'out', date: p.ticket || p.doneDate || p.transferDate || p.wantDate || '', amount: -Math.round(Number(p.amount) || 0), done: p.status === 'paid', row: p,
  }));
  const order = { transfer: 0, receive: 1, adjust: 2, out: 3 };
  entries.sort((a, b) => String(a.date || '9999').localeCompare(String(b.date || '9999')) || order[a.kind] - order[b.kind] || (Number(a.row.id) || 0) - (Number(b.row.id) || 0));
  let running = 0;
  entries.forEach(e => { running += e.amount; e.running = running; });
  const sum = (list) => list.reduce((s, e) => s + e.amount, 0);
  const inflows = entries.filter(e => e.amount > 0);
  const outs = entries.filter(e => e.kind === 'out');
  const checks = outs.filter(e => !e.done && e.row.status === 'approved' && e.row.ticket);
  return {
    account, entries,
    inflowAll: sum(inflows), inflowDone: sum(inflows.filter(e => e.done)),
    outAll: -sum(outs), outDone: -sum(outs.filter(e => e.done)),
    balanceNow: sum(entries.filter(e => e.done)), balanceAll: running,
    checks: { count: checks.length, amount: -sum(checks), next: checks[0]?.row || null },
  };
}

// 應付裡用「期票分期」拆出來的支票，依受款廠商＋摘要分組，算出總額、每期金額與區間。
function sfCheckGroups(outEntries) {
  const groups = new Map();
  const others = [];
  outEntries.forEach(e => {
    const m = String(e.row.summary || '').match(SF_CHECK_TAG);
    if (!m) { others.push(e); return; }
    const base = String(e.row.summary).replace(SF_CHECK_TAG, '');
    const key = `${e.row.vendor || ''}|${base}|${m[2]}`;
    if (!groups.has(key)) groups.set(key, { vendor: e.row.vendor || '', base, total: Number(m[2]), entries: [] });
    groups.get(key).entries.push({ ...e, seq: Number(m[1]) });
  });
  const list = [...groups.values()].map(g => {
    g.entries.sort((a, b) => a.seq - b.seq);
    const amounts = g.entries.map(e => -e.amount);
    const tickets = g.entries.map(e => e.row.ticket || '').filter(Boolean).sort();
    return { ...g, sum: amounts.reduce((s, x) => s + x, 0), min: Math.min(...amounts), max: Math.max(...amounts),
      first: tickets[0] || '', last: tickets[tickets.length - 1] || '', bank: g.entries[0].row.bank || '',
      paid: g.entries.filter(e => e.done), waiting: g.entries.filter(e => !e.done) };
  });
  return { groups: list, others };
}

function sfOwedTotals() {
  return sfAccounts().filter(c => c.status !== '結案').map(c => ({ c, l: sfLedger(c.code) }));
}

// ── 頁面接進既有導覽（不改 index.html 的骨架函式） ──
(function sfHookShell() {
  const originalNavTo = window.navTo;
  window.navTo = function (page, el) {
    if (page !== 'shareholder') return originalNavTo.call(this, page, el);
    if (!sfCanAccess()) { showToast('您沒有此功能的權限', 'error'); return; }
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    (el || document.getElementById('nav-shareholder'))?.classList.add('active');
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-shareholder')?.classList.add('active');
    const main = document.querySelector('.main'); if (main) main.scrollTop = 0;
    document.getElementById('topbar-title').textContent = '股東資金往來';
    document.getElementById('topbar-sub').textContent = 'Shareholder Accounts';
    currentPage = 'shareholder';
    sfRender();
    closeMobileSidebar();
  };
  const originalRender = window.renderCurrentPage;
  window.renderCurrentPage = function () {
    originalRender.apply(this, arguments);
    if (currentPage === 'shareholder') sfRender();
  };
  const originalRole = window.applyRole;
  window.applyRole = function () {
    const result = originalRole.apply(this, arguments);
    const nav = document.getElementById('nav-shareholder');
    if (nav) nav.style.display = sfCanAccess() ? '' : 'none';
    return result;
  };
})();

// ── 畫面 ──
function sfOpen(code) {
  sfViewCode = code || null;
  sfRender();
  const box = document.getElementById('sf-container'); if (box) box.scrollTop = 0;
}

function sfKpi(label, value, sub, color = 'var(--text)') {
  return `<div class="kpi-card"><div class="kpi-label">${label}</div><div class="kpi-val" style="font-size:20px;color:${color}">${value}</div><div class="kpi-sub">${sub}</div></div>`;
}

function sfCard(title, sum, body) {
  return `<div style="border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-bottom:14px;background:var(--surface)">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 14px;background:var(--surface2);font-size:13px;font-weight:600">
      <span>${title}</span><span style="font-family:'DM Mono',monospace;font-size:11px;color:var(--accent)">${sum}</span></div>
    <div style="overflow-x:auto">${body}</div></div>`;
}

const SF_TH = 'padding:7px 12px;font-size:11px;color:var(--text3);font-weight:600;text-align:left;border-bottom:1px solid var(--border);white-space:nowrap';
const SF_TD = 'padding:8px 12px;font-size:12px;border-bottom:1px solid var(--border);vertical-align:top';
const SF_NUM = "text-align:right;font-family:'DM Mono',monospace;white-space:nowrap";

function sfTag(text, color, bg) {
  return `<span style="display:inline-block;font-size:10px;padding:1px 8px;border-radius:999px;color:${color};background:${bg};white-space:nowrap">${text}</span>`;
}

function sfStatusTag(e) {
  if (e.kind === 'out') {
    if (e.row.status === 'paid') return sfTag(e.row.ticket ? '已兌現' : '已付款', 'var(--success)', 'var(--success-bg)');
    if (e.row.status === 'pending') return sfTag('待審核', 'var(--text3)', 'var(--surface2)');
    return sfTag(e.row.ticket ? '待兌現' : '待付款', 'var(--warning)', 'var(--warning-bg)');
  }
  if (e.kind === 'receive') return e.done ? sfTag('已入帳', 'var(--success)', 'var(--success-bg)') : sfTag('待入帳', 'var(--warning)', 'var(--warning-bg)');
  return sfTag('已記帳', 'var(--accent)', 'var(--accent2)');
}

function sfRender() {
  const box = document.getElementById('sf-container');
  if (!box) return;
  if (!sfCanAccess()) { box.innerHTML = ''; return; }
  if (sfViewCode && !sfIsAccountCode(sfViewCode)) sfViewCode = null;
  box.innerHTML = sfViewCode ? sfDetailHtml(sfViewCode) : sfListHtml();
}

function sfListHtml() {
  const rows = sfAccounts().map(c => ({ c, l: sfLedger(c.code) }));
  const active = rows.filter(x => x.c.status !== '結案');
  const held = active.filter(x => x.l.balanceNow > 0.5).reduce((s, x) => s + x.l.balanceNow, 0);
  const owed = active.filter(x => x.l.balanceNow < -0.5).reduce((s, x) => s - x.l.balanceNow, 0);
  const checks = active.flatMap(x => x.l.entries.filter(e => e.kind === 'out' && !e.done && e.row.status === 'approved' && e.row.ticket));
  checks.sort((a, b) => String(a.row.ticket).localeCompare(String(b.row.ticket)));
  const checkSum = checks.reduce((s, e) => s - e.amount, 0);
  const next = checks[0]?.row;
  const include = typeof CASH_SETTINGS === 'object' && CASH_SETTINGS.includeLoanOwed === true;
  const table = rows.length ? `<table style="width:100%;border-collapse:collapse;min-width:820px">
    <thead><tr><th style="${SF_TH}">往來帳戶</th><th style="${SF_TH}">客戶</th><th style="${SF_TH};text-align:right">公司已付</th><th style="${SF_TH};text-align:right">待兌現／待付</th>
      <th style="${SF_TH};text-align:right">轉入／收回／沖帳</th><th style="${SF_TH};text-align:right">目前餘額</th><th style="${SF_TH};text-align:right">全部付完後</th><th style="${SF_TH}">狀態</th></tr></thead>
    <tbody>${rows.map(({ c, l }) => {
      const waiting = l.outAll - l.outDone;
      const waitingCount = l.entries.filter(e => e.kind === 'out' && !e.done).length;
      return `<tr style="cursor:pointer" onclick="sfOpen('${sfEsc(c.code)}')" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">
        <td style="${SF_TD}"><b>${sfEsc(c.name)}</b><div style="font-size:10px;color:var(--accent);font-family:'DM Mono',monospace">${sfEsc(c.code)}</div></td>
        <td style="${SF_TD};color:var(--text2)">${sfEsc(c.clientName || '')}</td>
        <td style="${SF_TD};${SF_NUM}">${sfMoney(l.outDone)}</td>
        <td style="${SF_TD};${SF_NUM}">${waiting > 0.5 ? `${sfMoney(waiting)}<div style="font-size:10px;color:var(--text3)">${waitingCount} 筆</div>` : '<span style="color:var(--text3)">—</span>'}</td>
        <td style="${SF_TD};${SF_NUM};color:var(--success)">${sfMoney(l.inflowAll)}</td>
        <td style="${SF_TD};${SF_NUM};color:${sfBalanceColor(l.balanceNow)}">${sfBalanceText(l.balanceNow)}</td>
        <td style="${SF_TD};${SF_NUM};color:${sfBalanceColor(l.balanceAll)}">${sfBalanceText(l.balanceAll)}</td>
        <td style="${SF_TD}">${c.status === '結案' ? sfTag('結案', 'var(--text3)', 'var(--surface2)') : sfTag(c.status || '進行中', 'var(--warning)', 'var(--warning-bg)')}</td>
      </tr>`;
    }).join('')}</tbody></table>` : '<div style="padding:24px;text-align:center;color:var(--text3);font-size:13px">還沒有往來帳戶。按右上「＋ 新增往來帳戶」建立。</div>';
  return `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:14px">
      <div style="font-size:12px;color:var(--text3);line-height:1.7;max-width:720px">股東、親友和公司之間的錢：公司替他付的（應付「私人借支」）、他留在公司的（分潤「轉入股東資金往來」）、他還給公司的（應收），以及公司同意吸收的差額（差額沖帳）。不進營收、成本、公司開銷或分潤。</div>
      <button class="btn btn-primary btn-sm" onclick="sfNewAccount()">＋ 新增往來帳戶</button>
    </div>
    <div class="profit-kpi-grid" style="margin-bottom:14px">
      ${sfKpi('公司代管股東的錢', sfMoney(held), '分潤未領、留在公司扣抵', 'var(--success)')}
      ${sfKpi('股東／親友欠公司', sfMoney(owed), '扣到目前已付的款項', 'var(--error)')}
      ${sfKpi('未兌現期票', sfMoney(checkSum), checks.length ? `${checks.length} 張，下一張 ${sfEsc(next.ticket)} ${sfEsc(next.vendor || '')} ${sfMoney(next.amount)}` : '沒有')}
    </div>
    ${sfCard('往來帳戶', `${rows.length} 個帳戶・進行中 ${active.length}`, table)}
    <label style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text2);margin-top:4px">
      <input type="checkbox" id="sf-include-cash" ${include ? 'checked' : ''} onchange="sfSetIncludeCash(this.checked)">
      資金試算計入「股東／親友應還」（全部付完後還欠公司的金額）。股東何時還、是否還現金未定時，建議不要計入。
    </label>`;
}

function sfDetailHtml(code) {
  const l = sfLedger(code);
  const c = l.account;
  const inflows = l.entries.filter(e => e.amount > 0 || (e.kind === 'receive'));
  const outs = l.entries.filter(e => e.kind === 'out');
  const { groups, others } = sfCheckGroups(outs);
  const transferSum = l.entries.filter(e => e.kind === 'transfer').reduce((s, e) => s + e.amount, 0);
  const receiveSum = l.entries.filter(e => e.kind === 'receive').reduce((s, e) => s + e.amount, 0);
  const adjustSum = l.entries.filter(e => e.kind === 'adjust').reduce((s, e) => s + e.amount, 0);
  const inSub = [transferSum && `轉入 ${sfMoney(transferSum)}`, receiveSum && `收回 ${sfMoney(receiveSum)}`, adjustSum && `沖帳 ${sfMoney(adjustSum)}`].filter(Boolean).join('＋') || '沒有';
  const kindLabel = { transfer: '分潤轉入', receive: '收回', adjust: '差額沖帳' };
  const inRows = inflows.map(e => {
    let source = '', note = '', action = '';
    if (e.kind === 'transfer') {
      const names = (e.row.profitCaseCodes || []).map(cc => CASES.find(x => x.code === cc)?.name || cc);
      source = `#${sfEsc(e.row.id)} ${sfEsc(paymentTypeLabel(e.row.paymentType) || '分潤款')}${names.length ? `<div style="font-size:10px;color:var(--text3);margin-top:2px">結算個案：${sfEsc(names.join('、'))}</div>` : ''}`;
      note = '未實際領取，留在公司扣抵';
    } else if (e.kind === 'receive') {
      source = `應收 #${sfEsc(e.row.id)}`;
      note = sfEsc(e.row.item || '');
    } else {
      source = sfEsc(SF_ADJUST_REASONS[e.row.reason] || e.row.reasonLabel || '差額沖帳');
      note = sfEsc(e.row.note || '');
      const btn = 'class="btn btn-ghost btn-sm" style="font-size:11px;padding:2px 8px;height:auto;white-space:nowrap"';
      action = `<span style="display:inline-flex;gap:4px"><button ${btn} onclick="event.stopPropagation();sfOpenAdjust('${sfEsc(code)}','${sfEsc(e.row.id)}')">編輯</button><button ${btn} onclick="event.stopPropagation();sfDeleteAdjust('${sfEsc(code)}','${sfEsc(e.row.id)}')">刪除</button></span>`;
    }
    return `<tr><td style="${SF_TD};font-family:'DM Mono',monospace;white-space:nowrap">${sfEsc(e.date || '—')}</td><td style="${SF_TD}">${sfTag(kindLabel[e.kind], 'var(--accent)', 'var(--accent2)')}</td>
      <td style="${SF_TD}">${source}</td><td style="${SF_TD};color:var(--text2)">${note}</td><td style="${SF_TD}">${sfStatusTag(e)}</td>
      <td style="${SF_TD};${SF_NUM};color:var(--success)">${sfMoney(e.amount)}</td><td style="${SF_TD};text-align:right">${action}</td></tr>`;
  }).join('');
  const inTable = inRows ? `<table style="width:100%;border-collapse:collapse;min-width:760px"><thead><tr><th style="${SF_TH}">日期</th><th style="${SF_TH}">類別</th><th style="${SF_TH}">來源</th><th style="${SF_TH}">說明</th><th style="${SF_TH}">狀態</th><th style="${SF_TH};text-align:right">金額</th><th style="${SF_TH}"></th></tr></thead><tbody>${inRows}</tbody></table>`
    : '<div style="padding:16px;text-align:center;color:var(--text3);font-size:12px">沒有轉入、收回或沖帳。股東還錢請到應收帳款記在這個帳戶；分潤留在公司請在分潤款選「轉入股東資金往來」。</div>';

  const outRow = (e, first) => `<tr>
      ${first}
      <td style="${SF_TD};font-family:'DM Mono',monospace;white-space:nowrap">${sfEsc(e.date || '—')}</td>
      <td style="${SF_TD}">${sfEsc(String(e.row.summary || '').replace(SF_CHECK_TAG, ''))}<div style="font-size:10px;color:var(--text3)">#${sfEsc(e.row.id)} ${sfEsc(e.row.vendor || '')}</div></td>
      <td style="${SF_TD};${SF_NUM};color:var(--error)">${sfMoney(-e.amount)}</td>
      <td style="${SF_TD}">${sfStatusTag(e)}</td>
      <td style="${SF_TD};${SF_NUM};color:${sfBalanceColor(e.running)}">${sfBalanceText(e.running)}</td></tr>`;
  const outHead = (firstCol) => `<thead><tr>${firstCol ? `<th style="${SF_TH}">${firstCol}</th>` : ''}<th style="${SF_TH}">日期</th><th style="${SF_TH}">摘要</th><th style="${SF_TH};text-align:right">金額</th><th style="${SF_TH}">狀態</th><th style="${SF_TH};text-align:right">這筆之後的餘額</th></tr></thead>`;
  const groupCards = groups.map(g => {
    const per = g.min === g.max ? `每期 <b style="font-family:'DM Mono',monospace">${sfMoney(g.min)}</b>` : `每期 <b style="font-family:'DM Mono',monospace">${sfMoney(g.min)}～${sfMoney(g.max)}</b>`;
    const plan = `<div style="display:flex;flex-wrap:wrap;gap:6px 22px;padding:10px 14px;font-size:12px;border-bottom:1px solid var(--border);background:var(--surface)">
      <span>受款：<b>${sfEsc(g.vendor || '—')}</b></span><span>總額 <b style="font-family:'DM Mono',monospace">${sfMoney(g.sum)}</b></span>
      <span>${per} × <b>${g.entries.length}</b> 期${g.entries.length !== g.total ? `（原拆 ${g.total} 期）` : ''}</span>
      <span>區間 <b style="font-family:'DM Mono',monospace">${sfEsc(g.first)} ～ ${sfEsc(g.last)}</b></span>
      ${g.bank ? `<span>付款帳戶：${sfEsc(pyBankShort(g.bank).replace(/<[^>]+>/g, ''))}</span>` : ''}</div>`;
    const body = `<table style="width:100%;border-collapse:collapse;min-width:700px">${outHead('期別')}<tbody>${g.entries.map(e => outRow(e, `<td style="${SF_TD};white-space:nowrap">${e.seq}/${g.total}</td>`)).join('')}</tbody></table>`;
    return sfCard(`期票：${sfEsc(g.base)}`, `已兌現 ${g.paid.length} 張 ${sfMoney(g.paid.reduce((s, e) => s - e.amount, 0))} / 待兌現 ${g.waiting.length} 張 ${sfMoney(g.waiting.reduce((s, e) => s - e.amount, 0))}`, plan + body);
  }).join('');
  const otherCard = others.length ? sfCard('其他付出', `${others.length} 筆 ${sfMoney(others.reduce((s, e) => s - e.amount, 0))}`,
    `<table style="width:100%;border-collapse:collapse;min-width:640px">${outHead('')}<tbody>${others.map(e => outRow(e, '')).join('')}</tbody></table>`) : '';
  const outEmpty = !outs.length ? sfCard('公司付出', '沒有', '<div style="padding:16px;text-align:center;color:var(--text3);font-size:12px">還沒有付出。公司替他付的錢請到應付帳款，款項性質選「私人借支」、個案選這個帳戶。</div>') : '';
  const shortfall = l.balanceAll < -0.5;
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px">
      <button class="btn btn-ghost btn-sm" onclick="sfOpen(null)">← 全部往來帳戶</button>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-ghost btn-sm" onclick="openEditCase('${sfEsc(code)}')">編輯帳戶</button>
        <button class="btn btn-primary btn-sm" onclick="sfOpenAdjust('${sfEsc(code)}')">差額沖帳</button>
      </div>
    </div>
    <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:12px">
      <div style="font-size:17px;font-weight:700">${sfEsc(c.name)}</div>
      <div style="font-size:11px;color:var(--accent);font-family:'DM Mono',monospace">${sfEsc(c.code)}</div>
      <div style="font-size:11px;color:var(--text3)">${sfEsc(c.clientName || '')}・負責 ${sfEsc(c.person || '')}・${sfEsc(c.status || '')}</div>
    </div>
    <div class="profit-kpi-grid" style="margin-bottom:14px">
      ${sfKpi('轉入／收回／沖帳', sfMoney(l.inflowAll), inSub, 'var(--success)')}
      ${sfKpi('公司付出', sfMoney(l.outAll), `已付 ${sfMoney(l.outDone)}・待付 ${sfMoney(l.outAll - l.outDone)}`, 'var(--error)')}
      ${sfKpi('目前餘額', sfBalanceText(l.balanceNow), '只算已付、已入帳、已記帳的', sfBalanceColor(l.balanceNow))}
      ${sfKpi('全部付完後', sfBalanceText(l.balanceAll), shortfall ? '可用「差額沖帳」說明並沖掉' : '所有期票都兌現後', sfBalanceColor(l.balanceAll))}
    </div>
    ${sfCard('轉入／收回／沖帳明細', inSub, inTable)}
    ${groupCards}${otherCard}${outEmpty}`;
}

// ── 新增往來帳戶：沿用新增個案視窗，類別預設私人借支、不分潤，客戶預設「內部往來」 ──
function sfNewAccount() {
  if (typeof openNewCaseModal !== 'function') return;
  openNewCaseModal();
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  set('new-case-type', 'private_loan');
  set('new-case-profit-mode', 'no_profit');
  const client = CLIENTS.find(cl => cl.shortName === '內部往來') || CLIENTS.find(cl => cl.code === 'INT');
  if (client) set('new-client-code', client.code);
  if (typeof genCaseCode === 'function') genCaseCode();
  const nameEl = document.getElementById('new-case-name');
  if (nameEl) { nameEl.placeholder = '例：彭俞豪 股東往來'; nameEl.focus(); }
}

// ── 差額沖帳 ──
// 不含某一筆沖帳時，全部付完後的差額（正數＝欠公司）。編輯時用來比對新金額。
function sfShortfallExcluding(code, adjustId) {
  const l = sfLedger(code);
  const row = adjustId ? (l.account?.loanAdjustments || []).find(a => String(a.id) === String(adjustId)) : null;
  const without = row ? Math.round(Number(row.amount) || 0) : 0;
  return { l, row, shortfall: Math.round(-(l.balanceAll - without)), inflow: l.inflowAll - without };
}

function sfOpenAdjust(code, adjustId) {
  if (!sfCanAccess()) { showToast('您沒有此功能的權限', 'error'); return; }
  const { l, row, shortfall, inflow } = sfShortfallExcluding(code, adjustId);
  if (adjustId && !row) { showToast('找不到這筆差額沖帳', 'error'); return; }
  if (!row && !(l.balanceAll < -0.5)) { showToast('這個帳戶全部付完後沒有欠款，不需要差額沖帳', 'warning'); return; }
  document.getElementById('sf-adjust-code').value = code;
  document.getElementById('sf-adjust-id').value = row ? row.id : '';
  document.getElementById('sf-adjust-title').textContent = `${row ? '編輯差額沖帳' : '差額沖帳'}・${l.account.name}`;
  document.getElementById('sf-adjust-submit').textContent = row ? '儲存' : '沖帳';
  const gap = shortfall > 0
    ? `<span>${row ? '不含這筆的差額' : '差額'} <b style="font-family:'DM Mono',monospace;color:var(--error)">${sfMoney(shortfall)}</b>（欠公司）</span>`
    : `<span>${row ? '不含這筆的差額' : '差額'} <b style="font-family:'DM Mono',monospace;color:var(--success)">${sfMoney(-shortfall)}</b>（公司代管）</span>`;
  document.getElementById('sf-adjust-summary').innerHTML = `<span>公司付出 <b style="font-family:'DM Mono',monospace">${sfMoney(l.outAll)}</b></span>
    <span>${row ? '轉入／收回／其他沖帳' : '轉入／收回／沖帳'} <b style="font-family:'DM Mono',monospace">${sfMoney(inflow)}</b></span>
    ${gap}`;
  document.getElementById('sf-adjust-reason').value = row ? (SF_ADJUST_REASONS[row.reason] ? row.reason : 'other') : 'tax';
  document.getElementById('sf-adjust-amount').value = (row ? Math.round(Number(row.amount) || 0) : Math.max(shortfall, 0)).toLocaleString('zh-TW');
  document.getElementById('sf-adjust-date').value = row ? (row.date || '') : localDateKey();
  document.getElementById('sf-adjust-note').value = row ? (row.note || '') : '';
  openModal('modal-sf-adjust');
}

function sfSubmitAdjust() {
  if (!sfCanAccess()) { showToast('您沒有此功能的權限', 'error'); return; }
  const code = document.getElementById('sf-adjust-code').value;
  const editId = document.getElementById('sf-adjust-id').value;
  const c = CASES.find(x => x.code === code);
  if (!sfIsAccount(c)) { showToast('找不到往來帳戶', 'error'); return; }
  const existing = editId ? (c.loanAdjustments || []).find(a => String(a.id) === String(editId)) : null;
  if (editId && !existing) { showToast('找不到這筆差額沖帳，可能已被刪除', 'error'); return; }
  const reason = document.getElementById('sf-adjust-reason').value;
  const amount = Math.round(Number(String(document.getElementById('sf-adjust-amount').value || '').replace(/[^0-9.]/g, '')) || 0);
  const date = document.getElementById('sf-adjust-date').value;
  const note = document.getElementById('sf-adjust-note').value.trim();
  if (!SF_ADJUST_REASONS[reason]) { showToast('請選擇差額原因', 'error'); return; }
  if (!(amount > 0)) { showToast('請填寫沖帳金額', 'error'); return; }
  if (!date) { showToast('請填寫沖帳日', 'error'); return; }
  if (!note) { showToast('請寫明差額的原因說明', 'error'); return; }
  const { shortfall } = sfShortfallExcluding(code, existing ? existing.id : null);
  if (amount > shortfall && !confirm(`沖帳金額 ${sfMoney(amount)} 大於${existing ? '不含這筆的' : '目前'}差額 ${sfMoney(Math.max(shortfall, 0))}，沖完後會變成公司代管 ${sfMoney(amount - Math.max(shortfall, 0))}。確定嗎？`)) return;
  const before = auditClone(c.loanAdjustments || []);
  if (existing) {
    const oldAmount = Math.round(Number(existing.amount) || 0);
    c.loanAdjustments = c.loanAdjustments.map(a => {
      if (String(a.id) !== String(existing.id)) return a;
      const row = { ...a, date, amount, reason, reasonLabel: SF_ADJUST_REASONS[reason], note };
      touchRowMeta(row);
      return row;
    });
    touchRowMeta(c);
    recordAuditLog('update', 'loanAdjustment', code, before, auditClone(c.loanAdjustments), { targetLabel: `${c.name} 差額沖帳 ${sfMoney(oldAmount)} → ${sfMoney(amount)}`, riskLevel: 'medium' });
  } else {
    const row = { id: `adj-${Date.now()}`, date, amount, reason, reasonLabel: SF_ADJUST_REASONS[reason], note };
    touchRowMeta(row, true);
    c.loanAdjustments = [...(c.loanAdjustments || []), row];
    touchRowMeta(c);
    recordAuditLog('create', 'loanAdjustment', code, before, auditClone(c.loanAdjustments), { targetLabel: `${c.name} 差額沖帳 ${sfMoney(amount)}`, riskLevel: 'medium' });
  }
  closeModal('modal-sf-adjust');
  saveData();
  sfRender();
  showToast(existing ? `已更新差額沖帳 ${sfMoney(amount)} ✓` : `已沖帳 ${sfMoney(amount)} ✓`, 'success');
}

function sfDeleteAdjust(code, id) {
  if (!sfCanAccess()) { showToast('您沒有此功能的權限', 'error'); return; }
  const c = CASES.find(x => x.code === code);
  const row = (c?.loanAdjustments || []).find(a => String(a.id) === String(id));
  if (!row) return;
  if (!confirm(`刪除這筆差額沖帳？\n${row.date} ${SF_ADJUST_REASONS[row.reason] || ''} ${sfMoney(row.amount)}`)) return;
  const before = auditClone(c.loanAdjustments);
  c.loanAdjustments = c.loanAdjustments.filter(a => String(a.id) !== String(id));
  touchRowMeta(c);
  recordAuditLog('delete', 'loanAdjustment', code, before, auditClone(c.loanAdjustments), { targetLabel: `${c.name} 差額沖帳 ${sfMoney(row.amount)}`, riskLevel: 'medium' });
  saveData();
  sfRender();
  showToast('已刪除差額沖帳', 'success');
}

function sfSetIncludeCash(on) {
  if (!sfCanAccess() || typeof CASH_SETTINGS !== 'object') return;
  const before = { ...CASH_SETTINGS };
  CASH_SETTINGS = { ...CASH_SETTINGS, includeLoanOwed: !!on };
  recordAuditLog('update', 'cashSettings', 'settings', before, { ...CASH_SETTINGS }, { targetLabel: '資金試算計入股東應還', riskLevel: 'medium' });
  saveData();
  showToast(on ? '資金試算會計入股東／親友應還' : '資金試算不計入股東／親友應還', 'success');
}

// ── 應付：分潤款可選「轉入股東資金往來」；私人借支只能選往來帳戶 ──
function sfFillTransferCases(current) {
  const sel = document.getElementById('ap-loan-transfer-case');
  if (!sel) return;
  const list = sfAccounts().filter(c => c.status !== '結案' || c.code === current);
  sel.innerHTML = '<option value="">── 選擇往來帳戶 ──</option>' + list.map(c => `<option value="${sfEsc(c.code)}">${sfEsc(c.code)} ${sfEsc(c.name)}</option>`).join('');
  sel.value = current || '';
}

function sfTransferOn() {
  const field = document.getElementById('ap-transfer-field');
  return !!field && field.style.display !== 'none' && !!document.getElementById('ap-pay-method-transfer')?.checked;
}

function sfToggleTransfer() {
  const on = sfTransferOn();
  const body = document.getElementById('ap-transfer-body'); if (body) body.style.display = on ? '' : 'none';
  const bank = document.getElementById('ap-add-bank');
  if (bank) {
    bank.disabled = on;
    bank.title = on ? '轉入股東資金往來不經銀行' : '';
  }
  if (on) {
    const dateEl = document.getElementById('ap-loan-transfer-date');
    if (dateEl && !dateEl.value) dateEl.value = document.getElementById('ap-add-done-date')?.value || document.getElementById('ap-add-transfer-date')?.value || localDateKey();
  }
}

function sfSetPayMethod(transfer, loanCase = '', date = '') {
  const b = document.getElementById('ap-pay-method-bank'); if (b) b.checked = !transfer;
  const t = document.getElementById('ap-pay-method-transfer'); if (t) t.checked = !!transfer;
  sfFillTransferCases(loanCase);
  const d = document.getElementById('ap-loan-transfer-date'); if (d) d.value = date;
  sfToggleTransfer();
}

function sfFilterPayableCases() {
  const type = document.getElementById('ap-add-payment-type')?.value || 'vendor';
  if (!['vendor', 'family_pass_through', 'private_loan'].includes(type)) return;
  const el = document.getElementById('ap-add-case');
  if (!el) return;
  const cur = el.value;
  const loanMode = type === 'private_loan';
  el.innerHTML = buildCaseOptions('── 選擇個案名稱 ──', false, true, cur, c => userCanViewCaseFinancials(c.code, 'payable') && sfIsAccount(c) === loanMode);
  if ([...el.options].some(o => o.value === cur)) el.value = cur;
}

(function sfHookPayables() {
  const originalToggle = window.apTogglePaymentType;
  window.apTogglePaymentType = function () {
    const result = originalToggle.apply(this, arguments);
    const type = document.getElementById('ap-add-payment-type')?.value || 'vendor';
    const field = document.getElementById('ap-transfer-field');
    if (field) {
      const show = SF_TRANSFER_TYPES.includes(type) && sfCanAccess();
      field.style.display = show ? '' : 'none';
      if (!show) sfSetPayMethod(false);
      else sfToggleTransfer();
    }
    sfFilterPayableCases();
    return result;
  };

  const originalOpenAdd = window.openAddPayableModal;
  window.openAddPayableModal = function () {
    sfSetPayMethod(false);
    const result = originalOpenAdd.apply(this, arguments);
    sfFilterPayableCases();
    return result;
  };

  const originalOpenEdit = window.openEditPayableModal;
  window.openEditPayableModal = function (id) {
    sfSetPayMethod(false);
    const result = originalOpenEdit.apply(this, arguments);
    const p = PAYABLES.find(x => x.id === id);
    if (p && p.transferToLoanCase) {
      sfSetPayMethod(true, p.transferToLoanCase, p.transferToLoanDate || p.doneDate || '');
    }
    sfFilterPayableCases();
    return result;
  };

  const originalSubmit = window.submitAddPayable;
  window.submitAddPayable = function () {
    const type = document.getElementById('ap-add-payment-type')?.value || 'vendor';
    const caseVal = document.getElementById('ap-add-case')?.value || '';
    if (type === 'private_loan' && caseVal && !sfIsAccountCode(caseVal)) {
      showToast('私人借支請選擇股東資金往來帳戶（個案類別「私人借支」）', 'error'); return;
    }
    if (['vendor', 'family_pass_through'].includes(type) && caseVal && sfIsAccountCode(caseVal)) {
      showToast('股東資金往來帳戶只能記「私人借支」，請改選款項性質或個案', 'error'); return;
    }
    const editId = parseInt(document.getElementById('ap-edit-id')?.value || '') || null;
    const editRow = editId ? PAYABLES.find(x => x.id === editId) : null;
    const transfer = sfTransferOn() && SF_TRANSFER_TYPES.includes(type);
    let loanCase = '', loanDate = '';
    if (transfer) {
      loanCase = document.getElementById('ap-loan-transfer-case')?.value || '';
      loanDate = document.getElementById('ap-loan-transfer-date')?.value || '';
      if (!sfIsAccountCode(loanCase)) { showToast('請選擇要轉入的股東資金往來帳戶', 'error'); return; }
      if (!loanDate) { showToast('請填寫轉入日', 'error'); return; }
      const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
      set('ap-add-done-date', loanDate);
      set('ap-add-transfer-date', loanDate);
      set('ap-add-status', 'paid');
      const bankEl = document.getElementById('ap-add-bank'); if (bankEl) { bankEl.disabled = false; bankEl.value = ''; }
    } else if (!editRow?.transferToLoanCase) {
      return originalSubmit.apply(this, arguments);
    }
    const beforeIds = new Set(PAYABLES.map(p => p.id));
    const realSave = window.saveData;
    let saved = false;
    window.saveData = function () { saved = true; };
    let result;
    try { result = originalSubmit.apply(this, arguments); }
    finally { window.saveData = realSave; if (transfer) { const bankEl = document.getElementById('ap-add-bank'); if (bankEl) bankEl.disabled = true; } }
    if (!saved) return result;
    if (transfer) {
      const added = PAYABLES.filter(p => !beforeIds.has(p.id));
      const row = (editId && added.find(p => p.parentPayableId === editId && p.status === 'paid'))
        || (editId ? PAYABLES.find(p => p.id === editId) : added.find(p => p.status === 'paid') || added[0]);
      const account = CASES.find(c => c.code === loanCase);
      if (row && account) {
        Object.assign(row, { transferToLoanCase: loanCase, transferToLoanCaseName: account.name, transferToLoanDate: loanDate, bank: `轉入股東往來 ${account.name}` });
        touchRowMeta(row);
        recordAuditLog('update', 'payableLoanTransfer', row.id, null, { transferToLoanCase: loanCase, transferToLoanDate: loanDate, amount: row.amount },
          { targetLabel: `${row.vendor || ''} ${sfMoney(row.amount)} 轉入 ${account.name}`, riskLevel: 'medium' });
      }
      PAYABLES.filter(p => p !== row && p.id === editId).forEach(p => { delete p.transferToLoanCase; delete p.transferToLoanCaseName; delete p.transferToLoanDate; });
    } else if (editRow) {
      // 改回銀行匯款：拿掉轉入紀錄，銀行照使用者這次選的。
      delete editRow.transferToLoanCase; delete editRow.transferToLoanCaseName; delete editRow.transferToLoanDate;
      touchRowMeta(editRow);
    }
    realSave();
    refreshAccountingLinkedViews();
    return result;
  };
})();

// ── 個案：往來帳戶的編輯視窗只留名稱、負責人、狀態 ──
(function sfHookCaseEdit() {
  const original = window.openEditCase;
  window.openEditCase = function (code) {
    const result = original.apply(this, arguments);
    const isAccount = sfIsAccountCode(code);
    ['edit-case-amount', 'edit-case-changes', 'edit-case-profit-mode', 'edit-case-no-overhead', 'edit-case-retention-amt'].forEach(id => {
      const el = document.getElementById(id);
      const box = el?.closest('.form-field') || el?.parentElement;
      if (box) box.style.display = isAccount ? 'none' : '';
    });
    const ratio = document.getElementById('edit-case-ratio-wrap');
    if (ratio && isAccount) ratio.style.display = 'none';
    const hint = document.getElementById('edit-case-account-hint');
    if (hint) hint.style.display = isAccount ? '' : 'none';
    return result;
  };
})();

// ── 資金試算：「股東／親友應還（預估）」預設不計入，在股東資金往來勾選後才計入 ──
(function sfHookCash() {
  if (typeof window.cashCompute !== 'function') return;
  const original = window.cashCompute;
  window.cashCompute = function () {
    const r = original.apply(this, arguments);
    const owed = sfOwedTotals().filter(x => x.l.balanceAll < -0.5);
    if (!owed.length) return r;
    const total = Math.round(owed.reduce((s, x) => s - x.l.balanceAll, 0));
    const include = CASH_SETTINGS.includeLoanOwed === true;
    const list = owed.map(x => `${x.c.name} ${cashMoney(-x.l.balanceAll)}`).join('；');
    const line = include
      ? { side: 'asset', group: '股東應還', label: `股東／親友應還（${owed.length} 個帳戶）`, amount: total, detail: `全部付完後還欠公司：${list}`, source: 'auto' }
      : { side: 'asset', group: '股東應還', label: '股東／親友應還（未計入）', amount: 0, detail: `預估 ${cashMoney(total)}：${list}。何時還、是否還現金未定，到「股東資金往來」可改為計入`, source: 'auto' };
    // 保守與含預估利潤兩種算法都加上這一行（各自一份明細）。
    [r, r.estimate].filter(Boolean).forEach(v => {
      let at = 0;
      v.lines.forEach((l, i) => { if (l.side === 'asset') at = i + 1; });
      v.lines.splice(at, 0, { ...line });
      if (include) { v.assets += total; v.own += total; v.available += total; }
    });
    return r;
  };
})();
