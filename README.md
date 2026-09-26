# Expense Tracker

Lightweight local-first desktop expense tracking app built with Electron, React, TypeScript, Vite, and Electron Forge.

## Overview

Expense Tracker helps review statement activity from credit card and bank statement PDFs. It extracts selectable PDF text, turns likely transaction lines into editable rows, saves confirmed transactions locally after the import reconciles against the statement balances, and summarizes current account balances from saved activity.

The app is designed for local desktop use. It does not require a backend, cloud account, remote database, authentication, or sync service.

## What the App Does

- Imports selectable-text PDF statements
- Detects statement source details such as issuer, account hints, and statement period when possible
- Lets each import be assigned to a saved account
- Supports credit card, checking, savings, and other account types
- Extracts transaction candidates from statement text
- Lets transaction rows be reviewed, edited, categorized, confirmed, or returned for more editing
- Supports manual transaction entry for missing rows
- Requires reviewed imports to reconcile before saving
- Saves accounts, reviewed imports, and confirmed transactions to local JSON storage
- Shows account balance summaries, latest statement balances, import counts, and transaction counts
- Opens to an Overview with monthly totals, fixed/flexible spending, top categories, recent activity, and accounts
- Filters saved transactions by account, date, description, source, type, expense kind, category, and amount
- Lets saved expenses be corrected from Fixed to Flexible or vice versa
- Sorts saved transactions by table column and paginates the results
- Analyzes monthly income, expenses, transfers, net cash flow, and savings rate
- Shows expense breakdowns by category and merchant, plus a comparison with the previous month

## Current Workflow

The app opens to a transactions view backed by locally persisted review data. The home view shows saved account balance summaries and saved transactions. Selecting an account summary card or using the account filter limits the transaction table to that account. From there, a PDF statement can be imported into a focused review workspace.

During import, the PDF text is extracted through the Electron main/preload bridge. The parser makes a best-effort pass at detecting source metadata and transaction candidates from the extracted lines.

Before reviewing rows, the user confirms the statement source by selecting or creating an account, entering the statement start and end dates, and entering the statement opening and ending balances. Parsed issuer and account text are treated as hints only; saved account selection is the source of truth.

The review workspace separates candidate rows from confirmed rows. Candidate rows can be edited inline, categorized, selected in bulk, and moved into the confirmed transactions table. Expense rows receive a suggested Fixed or Flexible value, which can be changed per transaction. Confirmed rows can be returned to candidates if they need more editing. Missing rows can be added manually.

The app calculates the expected ending balance from the statement opening balance and confirmed transactions. A reviewed import can only be saved when the calculated ending balance matches the statement ending balance.

After saving, account summaries are calculated from the account opening balance plus saved transactions. The latest reconciled statement ending balance is shown separately so the calculated balance can be compared against the most recent imported statement. The saved transaction table has quick search and expense-kind filters, with additional column filters that can be expanded when needed. It can be sorted by any column and viewed in pages of 10, 25, 50, or 100 rows. Its Fixed/Flexible selector can correct a saved expense without changing its amount or statement reconciliation.

The Analysis view summarizes saved transactions for a selected month and account. It shows income, expenses, transfers, net cash flow, and savings rate; expense totals by category and merchant; and category changes from the previous month. Transfers are shown separately and are excluded from the income and expense totals used for net cash flow and savings rate.

## App Design

Expense Tracker opens to an Overview of the latest saved month, with a month selector, income, expenses, net cash flow, fixed versus flexible spending, top categories, recent transactions, and account balances. Sidebar navigation separates Overview, Transactions, Insights, and Import. The Overview links into the detailed transaction ledger and monthly Insights view. No budgeting or forecasting is implied by these summaries.

The import workspace is organized around source confirmation, candidate review, confirmed transactions, reconciliation, and parser diagnostics. Parser diagnostics expose extracted text and candidate lines so parsing issues can be inspected without leaving the app.

Transaction categorization is separate from accounting semantics. Transaction `type` describes how money affects the account, `category` is a single reporting label, and expense transactions also have an `expenseKind` of `fixed` or `flexible`.

## Data Model

Each saved account has a name, account type, issuer, optional last digits, and opening balance. Supported account types are:

- `credit_card`
- `checking`
- `savings`
- `other`

Balances are stored as ledger-signed values:

- Asset accounts such as checking and savings are positive when money is available.
- Credit card accounts are negative when money is owed.
- In the import UI, credit card balance fields are entered as positive amounts owed and converted to negative ledger balances internally.

Transaction amounts are normalized as positive numbers. Each transaction has a semantic `type`:

- `expense`: purchases, withdrawals, fees, outgoing payments, and other spending
- `income`: deposits, refunds, cashback, credits
- `transfer`: card payments, bank transfers, or balance movement between accounts

Transaction effects depend on account type:

- For credit cards, `expense` increases the amount owed, while `income` and `transfer` reduce the amount owed.
- For non-credit-card accounts, `income` increases the balance, while `expense` and `transfer` decrease the balance.

Current account balances are calculated from the saved account opening balance plus all saved transactions for that account. Latest statement balances come from the most recent saved import for the account.

Transactions carry one `category` for reporting. Current choices are Housing, Utilities, Grocery, Transportation, Food, Shopping, Subscription, Stocks, Interest Account, Salary, Interest, Repayment, Transfer, and Other. Expense transactions additionally require `expenseKind: fixed | flexible`; income and transfers have no expense kind. Category suggestions do not lock the expense kind: it can be changed for each expense.

## Local Persistence

Reviewed import data is saved locally on disk by the Electron main process. The renderer does not access the filesystem directly; it uses safe APIs exposed from `src/electron/preload.ts`.

The app uses separate local data profiles so development data and preserved production data do not share the same storage folder. Local development runs use the `dev` profile by default. Packaged builds use the `prod` profile by default. A development run can explicitly use production data with `npm run start:prod-data`.

The current persistent format stores accounts, reviewed imports, and confirmed transactions in `expense-tracker-data.json` under the active profile's Electron app user data directory. On Windows, the two profile paths resolve to:

```text
C:\Users\<user>\AppData\Roaming\expense-tracker-dev\expense-tracker-data.json
C:\Users\<user>\AppData\Roaming\expense-tracker-prod\expense-tracker-data.json
```

Before an existing data file is overwritten, the app creates a timestamped backup in the active profile's `backups` directory. In the `prod` profile, a backup failure stops the write. In the `dev` profile, backup failures are ignored for routine writes. A migration backup must succeed in either profile.

The current file format is version 2. On first open, each profile's version 1 file is migrated automatically: `Fixed Expenses` becomes `expenseKind: fixed`, `Discretionary Expenses` becomes `expenseKind: flexible`, and `categoryGroup` is removed. Accounts, imports, transaction IDs, categories, amounts, and balances are preserved. Migration creates a backup before replacing the file. If a legacy expense cannot be classified, the backup fails, or the file has an unsupported version, the original stays in place and the app shows a load error.

Backup files use this shape:

```text
C:\Users\<user>\AppData\Roaming\expense-tracker-prod\backups\expense-tracker-data-<timestamp>-<id>.json
```

The file uses a simple flat shape:

- `version`: persistence format version
- `accounts`: saved account records
- `imports`: reviewed import metadata, account id, source snapshot, statement balances, save timestamp, and saved transaction ids
- `transactions`: top-level normalized transaction records shared across imports; every saved transaction must have `accountId`

Keeping `transactions` top-level supports future account, category, date range, and source analysis. `importId` and import-level `transactionIds` preserve provenance without nesting transactions under imports.

## Project Structure

- `src/electron/`: Desktop-side Electron code. Creates windows, owns IPC handlers, exposes safe APIs through the preload script, and owns local JSON persistence.
- `src/renderer/`: React UI code. Contains screens, forms, tables, styling, and UI workflow hooks.
- `src/domain/`: Shared app concepts and pure business logic. Transaction types, statement/source types, category rules, balance calculation helpers, validation helpers, and sorting/conversion helpers live here.
- `src/pdf/`: PDF-specific import logic. Extracts selectable PDF text, detects statement metadata, and converts statement lines into domain transaction candidates.
- Root config files: Electron Forge, Vite, TypeScript, npm scripts, and the renderer HTML shell live at the project root.

## Development Commands

Start the app locally:

```powershell
npm run start
```

Start the app locally with development data:

```powershell
npm run start:dev
```

Start the app locally with production data:

```powershell
npm run start:prod-data
```

Run lint:

```powershell
npm run lint
```

Run migration and categorization tests:

```powershell
npm test
```

To dry-run migration checks against an existing version 1 file without modifying it, set `EXPENSE_TRACKER_LEGACY_FIXTURE` to its path before running `npm test`.

Run the TypeScript check:

```powershell
npx tsc --noEmit
```

Build/package the app:

```powershell
npm run package
```

## Current Limitations

- In-progress candidate drafts are not persisted.
- Duplicate detection is not implemented.
- Accounts can be created during import, but there is no dedicated accounts screen.
- Account summaries are read-only; account editing and archiving are not implemented.
- Saved transaction filtering exists, but per-transaction running balance rows are not implemented yet.
- Saved expense kind can be edited; other saved transaction fields and saved imports do not have edit/delete workflows yet.
- Imports and transactions without account ids are treated as unsupported legacy data.
- Scanned/image-only PDFs are not supported because OCR is not implemented.
- Parsing is generic and conservative, not issuer-specific.
- Budgeting is not implemented. The Analysis view provides monthly expense reporting, but does not offer custom date ranges or export.
