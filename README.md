# Expense Tracker

Lightweight local-first desktop expense tracking app built with Electron, React, TypeScript, Vite, and Electron Forge.

## Overview

Expense Tracker helps review statement activity from credit card and bank statement PDFs. It extracts selectable PDF text, turns likely transaction lines into editable rows, and saves confirmed transactions locally after the import reconciles against the statement balances.

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
- Shows saved transactions on the home screen across app launches

## Current Workflow

The app opens to a saved transactions view backed by locally persisted review data. From there, a PDF statement can be imported into a focused review workspace.

During import, the PDF text is extracted through the Electron main/preload bridge. The parser makes a best-effort pass at detecting source metadata and transaction candidates from the extracted lines.

Before reviewing rows, the user confirms the statement source by selecting or creating an account, entering the statement start and end dates, and entering the statement opening and ending balances. Parsed issuer and account text are treated as hints only; saved account selection is the source of truth.

The review workspace separates candidate rows from confirmed rows. Candidate rows can be edited inline, categorized, selected in bulk, and moved into the confirmed transactions table. Confirmed rows can be returned to candidates if they need more editing. Missing rows can be added manually.

The app calculates the expected ending balance from the statement opening balance and confirmed transactions. A reviewed import can only be saved when the calculated ending balance matches the statement ending balance.

## App Design

Expense Tracker uses a transactions-first layout. Saved transactions are the default view, and the import workspace is used only when adding new statement activity.

The import workspace is organized around source confirmation, candidate review, confirmed transactions, reconciliation, and parser diagnostics. Parser diagnostics expose extracted text and candidate lines so parsing issues can be inspected without leaving the app.

Transaction categorization is separate from accounting semantics. Transaction `type` describes how money affects the account, while `categoryGroup` and `category` describe how the user wants to analyze the transaction.

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

Transactions also carry categorization fields for reporting:

- `categoryGroup`: high-level reporting bucket
- `category`: second-level category within the selected group

Current category groups:

- `Fixed Expenses`: Housing, Utilities, Grocery, Transportation, Other
- `Discretionary Expenses`: Food, Shopping, Subscription, Other
- `Savings`: Stocks, Interest Account, Other
- `Income`: Salary, Interest, Repayment, Other
- `Transfer`: Transfer

## Local Persistence

Reviewed import data is saved locally on disk by the Electron main process. The renderer does not access the filesystem directly; it uses safe APIs exposed from `src/electron/preload.ts`.

The app uses separate local data profiles so development data and preserved production data do not share the same storage folder. Local development runs use the `dev` profile by default. Packaged builds use the `prod` profile by default. A development run can explicitly use production data with `npm run start:prod-data`.

The current persistent format stores accounts, reviewed imports, and confirmed transactions in `expense-tracker-data.json` under the active profile's Electron app user data directory. On Windows, the two profile paths resolve to:

```text
C:\Users\<user>\AppData\Roaming\expense-tracker-dev\expense-tracker-data.json
C:\Users\<user>\AppData\Roaming\expense-tracker-prod\expense-tracker-data.json
```

Before an existing data file is overwritten, the app creates a timestamped backup in the active profile's `backups` directory. In the `prod` profile, a backup failure stops the write. In the `dev` profile, backup failures are ignored so test data work can continue.

Backup files use this shape:

```text
C:\Users\<user>\AppData\Roaming\expense-tracker-prod\backups\expense-tracker-data-<timestamp>.json
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
- `src/domain/`: Shared app concepts and pure business logic. Transaction types, statement/source types, category rules, validation helpers, and sorting/conversion helpers live here.
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

Build/package the app:

```powershell
npm run package
```

## Current Limitations

- In-progress candidate drafts are not persisted.
- Duplicate detection is not implemented.
- Accounts can be created during import, but there is no dedicated accounts screen.
- Saved transactions and saved imports do not have edit/delete workflows yet.
- Imports and transactions without account ids are treated as unsupported legacy data.
- Scanned/image-only PDFs are not supported because OCR is not implemented.
- Parsing is generic and conservative, not issuer-specific.
- Budgeting and reporting views are not implemented.
