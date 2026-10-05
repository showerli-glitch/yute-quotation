// OPS production READ-ONLY summary.
//
// Paste into the DevTools console of an already signed-in production OPS tab
// (https://showerli-glitch.github.io/yute-quotation/ops/). It performs exactly one
// Firebase read (`opsCloudRef().get()`) of ops/yutesign/snapshot and computes counts,
// key totals and the snapshot timestamp from that payload. It never calls set/update/
// push/remove/transaction, saveData, or any render/apply function, and it does not
// touch localStorage. The result is printed and copied to the clipboard as JSON.
//
// Definitions follow the live app code:
//   - receivable collected  = receivableIsCollected(): collectAmt > 0 || collectDate
//   - receivable pending amt = receivableExpectedAmount()
//   - missing invoice        = rvNeedsInvoice(r) && !r.invoiceNo
//   - case contract amount   = CASES[].amount
(async () => {
  if (typeof opsCloudRef !== 'function' || typeof firebase === 'undefined') throw new Error('Not an OPS page with Firebase loaded');
  const user = firebase.auth().currentUser;
  if (!user) throw new Error('Not signed in to Firebase; sign in through the normal OPS login first');
  const snap = await opsCloudRef().get();
  if (!snap.exists()) throw new Error('Snapshot path is empty');
  const payload = snap.val();
  const d = payload.data || {};
  const meta = payload.meta || {};
  const arr = v => Array.isArray(v) ? v.filter(Boolean) : Object.values(v || {}).filter(Boolean);
  const num = v => Number(v || 0) || 0;
  const sum = (rows, f) => Math.round(rows.reduce((s, r) => s + (typeof f === 'function' ? f(r) : num(r[f])), 0) * 100) / 100;
  const group = (rows, key, amt) => {
    const out = {};
    rows.forEach(r => { const k = r[key] ?? '(empty)'; out[k] = out[k] || { count: 0, amount: 0 }; out[k].count++; out[k].amount += amt ? (typeof amt === 'function' ? amt(r) : num(r[amt])) : 0; });
    Object.values(out).forEach(o => { o.amount = Math.round(o.amount * 100) / 100; });
    return out;
  };
  const isCollected = r => num(r.collectAmt) > 0 || !!r.collectDate;
  const expected = r => { const e = num(r.receivableAmt); if (e > 0) return e; if (isCollected(r)) return num(r.collectAmt); return num(r.invoiceAmt || r.contractAmt); };
  const needsInvoice = r => num(r.invoiceAmt) > 0 || !!r.invoiceDate || !!r.invoiceNo;

  const CASES = arr(d.CASES), PAYABLES = arr(d.PAYABLES), RECEIVABLES = arr(d.RECEIVABLES), EXPENSES = arr(d.EXPENSES);
  const CLIENTS = arr(d.CLIENTS), VENDORS = arr(d.VENDORS);
  const collected = RECEIVABLES.filter(isCollected), pending = RECEIVABLES.filter(r => !isCollected(r));
  const summary = {
    readAt: new Date().toISOString(),
    readBy: user.email,
    path: 'ops/yutesign/snapshot',
    meta: { savedAt: meta.savedAt, savedBy: meta.savedBy, appVersion: meta.appVersion, source: meta.source, companyId: meta.companyId },
    CASES: { count: CASES.length, byStatus: group(CASES, 'status', 'amount'), contractAmount: sum(CASES, 'amount') },
    PAYABLES: { count: PAYABLES.length, byStatus: group(PAYABLES, 'status', 'amount'), totalAmount: sum(PAYABLES, 'amount') },
    RECEIVABLES: {
      count: RECEIVABLES.length,
      collected: { count: collected.length, collectAmt: sum(collected, 'collectAmt') },
      pending: { count: pending.length, expectedAmt: sum(pending, expected) },
      missingInvoice: RECEIVABLES.filter(r => needsInvoice(r) && !r.invoiceNo).length,
    },
    EXPENSES: { count: EXPENSES.length, byStatus: group(EXPENSES, 'status', 'amount'), totalAmount: sum(EXPENSES, 'amount') },
    CLIENTS: { count: CLIENTS.length, codes: CLIENTS.map(c => c.code).sort() },
    VENDORS: { count: VENDORS.length, byStatus: group(VENDORS, 'status') },
  };
  const json = JSON.stringify(summary, null, 2);
  try { await navigator.clipboard.writeText(json); } catch (e) {}
  console.log(json);
  return summary;
})();
