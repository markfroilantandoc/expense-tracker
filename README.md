# Expense Tracker

Lightweight local-first desktop expense tracking app built with Electron, React, TypeScript, Vite, and Electron Forge.

## Product Goal

Build a simple desktop app for importing credit card and bank statement PDFs, extracting transactions, categorizing spending, and making it easy to review or correct the imported data.

The app should prioritize end-to-end usefulness over perfect abstractions. The main UX goal is to minimize manual correction work after import.

## Current Scope

- Credit card and bank statements
- PDF statement import from selectable-text PDFs
- Local desktop app only
- In-memory import review only
- No backend, server, cloud sync, auth, or remote database
- No receipt scanning
- No persistence yet
- No budgeting reports yet

## Local Persistence

No backend means the app does not require a server, cloud service, auth system, or remote database. User data can still be saved locally on disk by the Electron main process.

For the first persistent version, store app data as local JSON files under Electron's app user data directory. This keeps the app simple, inspectable, and fully local-first while still remembering imported expenses, account balances, import history, and user corrections across launches.

Suggested local files:

- `accounts.json`: account names, account types, opening balances, and current known balances
- `transactions.json`: normalized imported transactions
- `imports.json`: imported statement metadata, source account, import date, and duplicate tracking hints
- `categories.json`: optional future category rules and user corrections

The renderer should not access the filesystem directly. Use `src/electron/preload.ts` to expose safe renderer APIs backed by filesystem reads and writes in the Electron main process.

## Account Model

Each imported statement should belong to an account.

Account types:

- `credit_card`
- `checking`
- `savings`
- `other`

Account balances can be tracked locally by combining a manually entered opening balance with saved transactions. Later, statement ending balances can be used for reconciliation.

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
- Source confirmation before transaction review
- Generic transaction candidate detection from extracted text
- Editable candidate rows for date, description, type, amount, category group, and category
- Built-in keyword-based auto-categorization
- Multi-select candidate confirmation
- Separate Confirmed Transactions table
- Return selected confirmed transactions back to candidates
- Parser diagnostics showing extracted text and candidate lines

Current limitations:

- No persistence; confirmed transactions are temporary in-memory state.
- No duplicate detection.
- No account creation or saved account model.
- No OCR; scanned/image-only PDFs are not supported yet.
- Parsing is generic and conservative, not issuer-specific.

## Project Structure

- `src/electron/`: Desktop-side Electron code. This is where the app creates windows, owns IPC handlers, and exposes safe APIs to the renderer through the preload script. Future local file persistence should live behind this layer.
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
- `npm run package` passes
- `npm run start` launches the Electron app

## Architecture Notes

- Keep the architecture simple and incremental.
- Prefer local-first behavior.
- Avoid introducing a backend, server, cloud sync, auth, or remote database.
- Start with local JSON persistence before considering an embedded database such as SQLite.
- Use the Electron preload layer for renderer access to filesystem or native APIs.
- Keep transaction normalization explicit: positive `amount` plus semantic `type`.
- Associate every imported transaction with a source account.
- Treat balances as local state derived from opening balances plus saved transactions, with statement balances reserved for later reconciliation.
- Build thin vertical slices before expanding abstractions.

## Suggested Next Step

Recommended next thin slices:

1. Add local JSON persistence for accounts, imports, confirmed transactions, and category rules.
2. Let users create/select the source account before saving an import.
3. Save confirmed transactions and reload them across launches.
4. Add duplicate detection using import metadata and transaction fingerprints.
5. Start learning category rules from user corrections once `categories.json` exists.
