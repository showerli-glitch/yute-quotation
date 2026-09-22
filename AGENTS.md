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

- Foundation: not started.
- Receivables: not started.
- Payables: not started.
- Expenses: not started.
- Deferred legacy modules: cases, clients, vendors, quotations, vendor pay requests, payments/cash position, cost control/profit/profit share, bank reconciliation, payroll, attendance, overhead, tax, feedback, system notes, employees.
