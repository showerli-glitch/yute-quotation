# Yutesign OPS repository guide

## Purpose and source of truth

- This repository is the GitHub Pages site for `showerli-glitch/yute-quotation`.
- The only development source of truth for the OPS refactor is `ops/index.html` in this repository.
- Google Drive `Yutesign_OPS_v2.html` is a manual backup only. Do not edit it, compare against it, or restore from it during this refactor.
- The current refactor branch is `ops-modularize`.
- The pre-refactor rollback tag is `pre-refactor-baseline-20260922`, resolving to commit `719f439e8c2489d5202b1c9d42030f4536db0e0d` (`Codex v1.3.37`). On 2026-09-22, local `HEAD`, local `main`, `origin/main`, and GitHub remote `main` all resolved to this commit.

## Current repository structure

- `ops/index.html`: Yutesign OPS. This is a no-build, vanilla HTML/CSS/JavaScript single-page application. Before modularization it contains the whole OPS UI, styles, global state, historical seed data and migrations, authentication, Firebase synchronization, calculations, and all feature modules in one file.
- `firebase-database.rules.json`: Firebase Realtime Database rules for the current snapshot and proposed/versioned paths.
- `index.html`: the separate quotation system entry page. It is not the OPS entry and is outside this refactor except for preserving the existing link from OPS.
- `Yutesign-attendance.html` and `cheliwo_zhonghe.html`: standalone legacy/special-purpose pages, outside this refactor.
- `favicon.*`, `logo.jpg`, and `ops/favicon.*`: static assets.
- `README.md`: minimal repository description.
- There is currently no package manifest, bundler, linter, typechecker, test runner, or CI configuration in the repository.

## Current OPS runtime architecture

- Deployment: static GitHub Pages files; no server-side rendering and no application backend in this repository.
- Runtime: browser-native HTML, CSS, and classic JavaScript using global functions and inline event handlers.
- External browser dependencies loaded by `ops/index.html`:
  - Google Identity Services (`https://accounts.google.com/gsi/client`).
  - Firebase compat SDK 10.12.0: app, auth, and Realtime Database.
  - Google Fonts (`Noto Sans TC`, `DM Mono`, `Playfair Display`).
- Authentication:
  - Google OAuth token client requests `userinfo.email`.
  - The browser calls `https://www.googleapis.com/oauth2/v2/userinfo`.
  - The employee record must be active, have a matching email, and have a non-`none` access role; a small legacy allowlist remains as fallback.
  - The Google access token is exchanged for a Firebase Google credential.
  - HTTP(S) enforces login. `file://` intentionally runs as local development mode without Firebase login.
- Authorization remains in the client permission matrix (`USER_PERMISSIONS`) plus Firebase rules. Do not weaken or reinterpret either layer while splitting files.
- Navigation is an in-page SPA controlled by `navTo`, `PAGE_TITLES`, `PAGE_NAV_IDS`, and global render functions. URL query/hash aliases are supported.

## Current data model and persistence contract

The running app uses mutable in-memory arrays/objects and serializes one complete snapshot. Keep field names, status values, formulas, and snapshot shape unchanged during modularization.

Primary collections include:

- `CASES`: cases/projects and financial override metadata.
- `PAYABLES`: pay requests, approved/paid payables, profit settlement payables, tax/private-loan entries, and attachment links.
- `RECEIVABLES`: expected receivables, invoices, collections, retention receivables, and attachment links.
- `EXPENSES`: employee expense applications, approval state, project/fixed-overhead allocation, and post-close treatment.
- `CLIENTS`, `VENDORS`, `EMPLOYEES`.
- `COMPANY_ALLOCATIONS`, `TAX_LIABILITIES`, `TEST_FEEDBACK`, `ATTENDANCE_RECORDS`, `ATTENDANCE_LEAVES`, `ATTENDANCE_SETTINGS`, `OVERHEAD`, `OH_FIXED_CONFIG`, `PAYROLL`, `PAYROLL_MONTHS`, `PAYROLL_DELETED_MONTHS`, `PAYROLL_EMPLOYEE_ACCOUNTS`, `DELETED_SOURCE_KEYS`, `USER_PERMISSIONS`, `PROFIT_SETTLEMENTS`, `AUDIT_LOGS`, and next-id counters.

Snapshot envelope created by `createDataSnapshot()`:

- `format: "yutesign-ops-backup"`
- `formatVersion: 1`
- `appVersion: "1.3.37"` at the baseline
- `companyId: "yutesign"`
- all collections/settings/counters listed above
- `savedAt` ISO timestamp

Local persistence:

- Current cache key: `yutesign_ops_v2`.
- Legacy fallback keys: `yutesign_ops_codex_v1`, `yutesign_ops_v1`.
- Theme key: `yutesign_ops_v2_theme`.
- Auth session key: `yutesign_ops_auth_session`, with a four-hour client session window.
- Local storage is only a cache/development fallback. It must never replace the controlled production Firebase source.

Production Firebase persistence:

- Firebase project: `yutesign-sync`.
- Realtime Database URL: `https://yutesign-sync-default-rtdb.asia-southeast1.firebasedatabase.app`.
- Current application path: `ops/yutesign/snapshot` (`OPS_CLOUD_PATH`).
- Stored shape: `{ data: <complete snapshot>, meta: { companyId, appVersion, savedAt, savedBy, savedByName, source } }`.
- `meta.source` is `ops-v2-cloud-sync`.
- On the initial authenticated connection, the Firebase snapshot always wins over a local pending copy. This behavior protects production data and must not change.
- `saveData()` writes the local cache and queues a complete snapshot save. Conflict handling performs three-way merges for selected collections and otherwise blocks on conflict.
- The rules require a verified `@yutesign.com` Firebase-authenticated email for the current snapshot, validate company/source/format metadata, and require at least `CASES`, `PAYABLES`, `RECEIVABLES`, and `EMPLOYEES` in `data`.

Rules also define `ops/yutesign/v1/*` and `ops/companies/$companyId/{snapshot,v1/*}` paths. The baseline OPS page does not use those versioned collection paths. Do not migrate to them or treat them as the production source during this batch.

## Accounting behavior that must remain exact

- A receivable is collected when `collectAmt > 0` or `collectDate` is present. `receivableExpectedAmount` keeps backward compatibility for rows without `receivableAmt`.
- Case collection totals and payable totals are derived from live `RECEIVABLES`/`PAYABLES`; some historical cases intentionally use explicit reconciliation overrides.
- Payment categories distinguish project cost, profit settlement/advance, shareholder distribution, private loan, tax liability, and other non-project movements. These predicates feed cost control and profit calculations.
- Expense approval can create post-close profit adjustments or linked company overhead. Editing/deleting/rejecting must preserve the current side-effect rules.
- Seed and migration routines contain production reconciliation corrections and deletion tombstones. They are data-preservation logic, not disposable sample data.
- `saveData`, `applyDataSnapshot`, seed normalization, audit logging, cloud merge behavior, and next-id counters are part of the persistence contract.

## This refactor batch

In scope:

1. Common foundation: shared data contracts/JSDoc types, constants, utilities, permissions used by the selected modules, persistence/Firebase access, and shared accounting calculations.
2. Receivables: page view, modal views, UI logic, calculations, and CRUD orchestration.
3. Payables: page view, modal views, UI logic, calculations, and CRUD orchestration.
4. Expenses: page view, modal view, UI logic, calculations, approval flow, and existing overhead/profit side effects.
5. Minimal entry/router/bootstrap adjustments required to load the extracted files.

Explicitly out of scope for this batch: cases, clients, vendors, quotations, vendor pay-request workflow as its own module, payment/cash-position modules, profit/cost-control modules, bank reconciliation, Figma/mobile redesign, and all new features. Cross-module helper calls needed to preserve current behavior are allowed; do not proactively move those modules.

## Gate 1 structural baseline and approved adjustment

The original Gate 1 map approved on 2026-09-22 proposed a fine-grained split: four CSS files under `ops/styles/`; `contracts`, `config`, `utils`, `access`, `ui`, `accounting`, `storage`, and `cloud` files under `ops/scripts/core/`; and separate `data.js`, `view.js`, and `module.js` files for each of receivables, payables, and expenses. It also proposed moving the selected pages and modal markup into JavaScript view templates while retaining `ops/index.html` as the shell and integration entry.

Implementation deliberately converged on a coarser structure to preserve behavior through contiguous, byte-for-byte source moves:

| Original Gate 1 target | Approved implemented target | Difference and reason |
|---|---|---|
| `ops/styles/core.css`, `receivables.css`, `payables.css`, `expenses.css` | CSS remains inline in `ops/index.html` | The baseline cascade contains shared and interleaved selectors. Leaving it in place avoids changing selector order, specificity, responsive behavior, or the appearance of deferred modules. |
| Receivable/payable/expense `view.js` files | Static page and modal HTML remains in `ops/index.html` | The baseline views are literal HTML rather than JavaScript templates. Moving them would require template injection and initialization changes instead of a mechanical source move. |
| `ops/scripts/core/contracts.js` | `ops/js/core/types.js` | Naming/path changed only; it remains documentation-only JSDoc and does not alter runtime data. |
| Separate `config.js`, `utils.js`, `access.js`, `storage.js`, and `cloud.js` | `ops/js/core/config.js`, `data.js`, and `ui.js` | The baseline data script has tightly ordered global state, seed/migration, permissions, persistence, authentication, and Firebase synchronization. `data.js` intentionally keeps the large contiguous dependency block together; safely isolated UI/search/row helpers are in `ui.js`. This preserves classic-script declaration order and global entry points. |
| `ops/scripts/core/accounting.js` | `ops/js/core/accounting.js` | Path changed; the accounting predicates and calculations were moved byte-for-byte without formula changes. |
| Receivables `data.js` / `view.js` / `module.js` | State/seed stays in `ops/js/core/data.js`, static HTML stays in `ops/index.html`, and behavior is in `ops/js/modules/receivables.js` | Avoids rewriting initialization or view mounting while still separating the receivable feature functions. |
| Payables `data.js` / `view.js` / `module.js` | State/seed stays in `ops/js/core/data.js`, static HTML stays in `ops/index.html`, and behavior is in `ops/js/modules/payables.js` | Avoids rewriting initialization or view mounting while still separating the payable feature functions. The separate vendor pay-request workflow remains inline and out of scope. |
| Expenses `data.js` / `view.js` / `module.js` | The contiguous expense data/behavior block is in `ops/js/modules/expenses.js`; static HTML stays in `ops/index.html` | Preserves ordering and the existing overhead/profit side-effect calls without moving those deferred modules. |

The approved split order remains unchanged: foundation, receivables, payables, then expenses. The coarser structure does not authorize formula, schema, API, permission, UI behavior, or historical-data changes; it only changes extraction granularity and target paths.

- Approval status: **已取得使用者核准**. On 2026-09-23, the user explicitly ratified this implemented structure as the new Gate 1 baseline, including the decision not to force-split CSS or static HTML and to prioritize the lower-risk contiguous extraction. This supersedes the original fine-grained Gate 1 file map for this batch.
- Process note: the implementation reached this coarser structure before the difference was documented. The technical choice was consistent with the minimum-risk objective, but the map change should have been reported before Gate 2 was presented. This section records both the deviation and its subsequent explicit approval.

## Required execution gates

1. Before code changes, present an existing-file-to-target-module map and the split order; stop for approval.
2. After the foundation plus receivable, payable, and expense slices all pass validation, present the complete diff and acceptance evidence; stop for approval.
3. Before merging to `main` or deploying GitHub Pages, present a freshly downloaded Firebase backup, the `ops-modularize` versus production-baseline comparison, and complete validation evidence; stop for final approval.

Do not add extra approval stops between these gates unless a change could affect saved data, production amounts, an existing API contract, or an unclear business rule.

## Safe-change and validation rules

- Preserve all unrelated user changes. Never overwrite or delete work outside the requested slice.
- Do not change the database schema, snapshot/API contract, field names, permissions, amounts, formulas, UI behavior, or historical data.
- Do not replace Firebase data with mock data, local storage, or copied fixtures.
- Never perform create/update/delete tests against production Firebase. Production verification is read-only: read/list/total/open existing records/refresh only.
- Before and after every slice, compare read-only production counts and key totals for `CASES`, `PAYABLES`, `RECEIVABLES`, and `EXPENSES` from `ops/yutesign/snapshot/data`.
- Re-run every available static/runtime check after each independently verifiable slice. With the baseline repository this includes, at minimum, JSON validation, extracted-JavaScript syntax checks, static asset/path checks, local HTTP smoke tests, and browser behavior checks. Add lint/typecheck/build only if the refactor introduces those tools.
- Each passing slice gets its own commit. If a slice fails, return that slice to the preceding passing commit before continuing, then repair and redo it.
- Keep classic-script load order and global entry points compatible with existing inline event handlers unless a separately verified change replaces them safely.
- Do not touch the Google Drive backup.

## Working state at creation

- Date/time zone: 2026-09-22, Asia/Taipei.
- Branch: `ops-modularize`.
- Baseline commit: `719f439e8c2489d5202b1c9d42030f4536db0e0d`.
- Working tree before creating this file: clean; no pre-existing tracked or untracked changes.
- No `AGENTS.md` or `CLAUDE.md` existed in the repository.

## Progress log

Update this section after every completed slice with the commit, entry files, validation evidence, remaining legacy modules, known risks, and next step.

- Foundation: complete in `49d0774` (`refactor(ops): extract shared foundation`). Entry files are `ops/js/core/types.js`, `config.js`, `data.js`, `accounting.js`, and `ui.js`; `ops/index.html` loads them in that order before the remaining inline application code.
- Receivables: complete in `f85456f` (`refactor(ops): extract receivables module`). Entry file is `ops/js/modules/receivables.js`.
- Payables: complete in `e4225df` (`refactor(ops): extract payables module`). Entry file is `ops/js/modules/payables.js`.
- Expenses: complete in `3f88f32` (`refactor(ops): extract expenses module`). Entry file is `ops/js/modules/expenses.js`.
- Gate 2 verification at `3f88f32` plus verification commit `1083e1a`:
  - `node scripts/verify-ops-modularization.mjs`: 8 local scripts have valid JavaScript syntax; 7 extracted source blocks and 300 moved function bodies match `pre-refactor-baseline-20260922` byte-for-byte after normalizing only the intentional file header/newline boundaries.
  - `firebase-database.rules.json` parses as JSON; `git diff --check` passes.
  - Local browser smoke: all 8 local scripts load with zero console errors/warnings. The full local development-mode smoke covered all 18 existing pages and rendered the existing seed collections (payables 275, receivables 32, expenses 228) without changing production data.
  - Production Firebase verification was read-only. Before, during, and after all four slices, the cloud snapshot remained at `2026/09/22 17:38`: CASES 27; PAYABLES 572 (pending 1 / $120,000; approved 2 / $17,296; paid 569 / $43,860,677.25); RECEIVABLES 74 (collected 69 / $53,280,699; pending 5 / $1,572,421; missing invoice 1); EXPENSES 836 (pending $123; approved $1,793,709; total $1,793,832). A final production-page refresh showed the same timestamp and counts. No production create/update/delete action was performed.
  - `ops/index.html` is 10,473 lines versus 17,419 lines at the baseline. The remaining size is intentional because deferred modules stay in place for the next batch.
- Gate 2 structural acceptance: complete on 2026-09-23. The user explicitly approved the coarser implemented structure documented above as the replacement Gate 1 baseline; therefore the retained inline CSS/static HTML and consolidated `data.js`/single-file feature modules are intentional, accepted outcomes rather than outstanding Gate 2 defects.
- Known risks/limits: the repository still has no package-based lint/typecheck/build/test runner or CI; classic-script global load order remains a runtime contract; production write flows were not exercised because this batch explicitly forbids production writes. The authenticated modular branch cannot be exercised against production Firebase until it is served from an authorized HTTP(S) preview/origin, so Gate 2 evidence combines byte-for-byte extraction checks, local full-page smoke tests, and separate read-only production data/UI checks.
- Deferred legacy modules: cases, clients, vendors, quotations, vendor pay requests, payments/cash position, cost control/profit/profit share, bank reconciliation, payroll, attendance, overhead, tax, feedback, system notes, employees. They remain inline because they are explicitly outside this batch.
- Next step: Gate 2 is complete. A subsequent task may prepare Gate 3 evidence only: first re-check the current `origin/main`/production baseline, then create a fresh read-only Firebase backup outside the repository, compare `ops-modularize` with that verified baseline, rerun complete verification, and stop again before merging to `main`, pushing `main`, or deploying GitHub Pages. The modular branch has not yet been pushed or deployed.
