# Expense Tracker

Lightweight local-first desktop expense tracking app built with Electron, React, TypeScript, Vite, and Electron Forge.

## Product Goal

Build a simple desktop app for importing credit card and bank statement PDFs, extracting transactions, categorizing spending, and making it easy to review or correct the imported data.

The app should prioritize end-to-end usefulness over perfect abstractions. The main UX goal is to minimize manual correction work after import.

## Current Scope

- Credit card and bank statements
- PDF statement import from selectable-text PDFs
- Local desktop app only
- In-memory import review with local save after review
- Local JSON persistence for accounts, reviewed imports, and confirmed transactions
- No backend, server, cloud sync, auth, or remote database
- No receipt scanning
- No budgeting reports yet

## Local Persistence

No backend means the app does not require a server, cloud service, auth system, or remote database. Reviewed import data is saved locally on disk by the Electron main process.

The current persistent version stores accounts, reviewed imports, and confirmed transactions in `review-data.json` under Electron's app user data directory. On Windows during development, that resolves to a path like:

```text
C:\Users\<user>\AppData\Roaming\expense-tracker\review-data.json
```

The file uses a simple flat shape:

- `version`: persistence format version
- `accounts`: saved account records with name, type, issuer, optional last digits, and opening balance
- `imports`: reviewed import metadata, account id, source snapshot, statement balances, save timestamp, and saved transaction ids
- `transactions`: top-level normalized transaction records shared across imports; every saved transaction must have `accountId`

Keeping `transactions` top-level makes future year, quarter, month, category, account, and source analysis straightforward. `importId` and import-level `transactionIds` preserve provenance without nesting transactions under imports.

The renderer should not access the filesystem directly. Use `src/electron/preload.ts` to expose safe renderer APIs backed by filesystem reads and writes in the Electron main process.

Future local files may include:

- `categories.json`: category rules and user corrections

## Account Model

Each new imported statement must belong to a saved account. Account selection is the source of truth for new imports; parsed issuer/account text is only used as a hint when creating an account.

Account types:

- `credit_card`
- `checking`
- `savings`
- `other`

Accounts store a ledger-signed opening balance:

- Asset accounts such as checking and savings are positive when money is available.
- Credit card accounts are negative when money is owed.
- In the import UI, credit card balance fields are entered as positive amounts owed and converted to negative ledger balances internally.

Each new reviewed import requires statement start/end dates, a statement opening balance, and a statement ending balance. The app calculates the expected ending balance from confirmed transactions and blocks saving until the import reconciles.

For credit cards:

- `expense` decreases the balance, meaning more owed.
- `income` and `transfer` increase the balance, meaning refunds, credits, or payments toward zero.

For non-credit-card accounts:

- `income` increases the balance.
- `expense` and `transfer` decrease the balance.

## Transaction Model

Transaction amounts are normalized as positive numbers.

Each transaction has a `type`:

- `expense`: purchases, withdrawals, fees, outgoing payments, and other spending
- `income`: deposits, refunds, cashback, credits
- `transfer`: card payments, bank transfers, or balance movement between accounts

Examples:

- Purchase = `expense`
- Bank fee = `expense`
- Paycheck deposit = `income`
- Refund or cashback = `income`
- Credit card payment or transfer between accounts = `transfer`

Transactions also carry user-facing categorization fields for analysis:

- `categoryGroup`: high-level reporting bucket
- `category`: second-level category within the selected group

Current category groups:

- `Fixed Expenses`: Housing, Utilities, Grocery, Transportation, Other
- `Discretionary Expenses`: Food, Shopping, Subscription, Other
- `Savings`: Stocks, Interest Account, Other
- `Income`: Salary, Interest, Repayment, Other
- `Transfer`: Transfer

These category fields coexist with `type`. The `type` field is for accounting semantics; category group and category are for user analysis.

## Current App State

The current app implements the first local import and review workflow:

- PDF statement upload
- PDF text extraction through the Electron main/preload bridge
- Best-effort source detection for issuer, account, and statement period
- Import source confirmation through saved account selection, statement dates, and statement balance entry
- Inline account creation during import
- Required reconciliation from statement opening balance to statement ending balance before save
- Generic transaction candidate detection from extracted text
- Editable candidate rows for date, description, type, amount, category group, and category
- Built-in keyword-based auto-categorization
- Multi-select candidate confirmation
- Separate Confirmed Transactions table
- Manual confirmed transaction entry for missing rows needed to reconcile
- Return selected confirmed transactions back to candidates
- Save reviewed imports locally
- Reload saved transactions across launches
- Transactions-first home screen showing saved transactions backed by `review-data.json`
- Full-height Saved Transactions table that expands with the app window
- Focused import workspace for source confirmation, candidate review, confirmed rows, and parser diagnostics
- Parser diagnostics showing extracted text and candidate lines
- Electron launches without opening DevTools by default

Current limitations:

- In-progress candidate drafts are not persisted.
- No duplicate detection.
- No dedicated accounts screen outside the import workflow.
- No edit/delete workflow for saved transactions or saved imports.
- This early data model intentionally treats imports and transactions without account ids as unsupported legacy data.
- No OCR; scanned/image-only PDFs are not supported yet.
- Parsing is generic and conservative, not issuer-specific.

## Project Structure

- `src/electron/`: Desktop-side Electron code. This is where the app creates windows, owns IPC handlers, exposes safe APIs to the renderer through the preload script, and owns local JSON persistence.
- `src/renderer/`: React UI code. This is the part of the app the user sees and clicks: screens, forms, tables, styling, and UI workflow hooks. It should call safe APIs exposed by Electron instead of importing Electron or filesystem APIs directly.
- `src/domain/`: Shared app concepts and pure business logic. Transaction types, statement/source types, category rules, validation helpers, and sorting/conversion helpers live here so they can be reused by the parser, UI, and future persistence/reporting features.
- `src/pdf/`: PDF-specific import logic. This layer extracts selectable PDF text, detects statement metadata, and converts statement lines into domain transaction candidates.
- Root config files: Electron Forge, Vite, TypeScript, npm scripts, and the renderer HTML shell live at the project root.

## Commands

Start the app locally:

```powershell
npm run start
```

Run lint:

```powershell
npm run lint
```

Build/package the app:

```powershell
npm run package
```

Verified status:

- `npm run lint` passes
- `npm run package` passed after the initial accounts implementation; the latest rerun after UX refinements was interrupted before completion
- `npm run start` has not been rerun after the latest UX refinements

## Architecture Notes

- Keep the architecture simple and incremental.
- Prefer local-first behavior.
- Avoid introducing a backend, server, cloud sync, auth, or remote database.
- Start with local JSON persistence before considering an embedded database such as SQLite.
- Use the Electron preload layer for renderer access to filesystem or native APIs.
- Keep transaction normalization explicit: positive `amount` plus semantic `type`.
- Associate every imported transaction with a source account.
- Treat balances as ledger-signed values. Use statement opening and ending balances to reconcile each new import before saving.
- Build thin vertical slices before expanding abstractions.

## Suggested Next Step

Recommended next thin slices:

1. Add duplicate detection using import metadata and transaction fingerprints.
2. Add a dedicated Accounts screen for reviewing account balances and imported statement history.
3. Add edit/delete workflows for saved transactions and imports.
4. Add local JSON persistence for category rules.
5. Start learning category rules from user corrections once `categories.json` exists.
