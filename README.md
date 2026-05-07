# Expense Tracker

Lightweight local-first desktop expense tracking app built with Electron, React, TypeScript, Vite, and Electron Forge.

## Product Goal

Build a simple desktop app for importing credit card and bank statement PDFs, extracting transactions, categorizing spending, and making it easy to review or correct the imported data.

The app should prioritize end-to-end usefulness over perfect abstractions. The main UX goal is to minimize manual correction work after import.

## Current Scope

- Credit card and bank statements
- PDF statement import only
- Local desktop app only
- Local file-based persistence
- No backend, server, cloud sync, auth, or remote database
- No receipt scanning
- No budgeting features yet

## Local Persistence

No backend means the app does not require a server, cloud service, auth system, or remote database. User data can still be saved locally on disk by the Electron main process.

For the first persistent version, store app data as local JSON files under Electron's app user data directory. This keeps the app simple, inspectable, and fully local-first while still remembering imported expenses, account balances, import history, and user corrections across launches.

Suggested local files:

- `accounts.json`: account names, account types, opening balances, and current known balances
- `transactions.json`: normalized imported transactions
- `imports.json`: imported statement metadata, source account, import date, and duplicate tracking hints
- `categories.json`: optional future category rules and user corrections

The renderer should not access the filesystem directly. Use `src/preload.ts` to expose safe renderer APIs backed by filesystem reads and writes in the Electron main process.

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

## Current App State

The Electron scaffold was created from `create-electron-app` with the Vite TypeScript template.

The renderer has been converted to React 18.

The current UI includes:

- App title
- PDF statement upload button
- Empty transaction table placeholder

The upload button currently opens a file picker only. PDF parsing, transaction extraction, account selection, and local persistence are not implemented yet.

## Project Structure

- `src/main.ts`: Electron main process. Creates the desktop `BrowserWindow` and loads the Vite renderer.
- `src/preload.ts`: Electron preload script. Currently empty; this is where safe main/renderer APIs should be exposed later.
- `src/renderer.tsx`: React renderer entry point.
- `src/App.tsx`: Current homepage UI.
- `src/index.css`: Renderer styles.
- `index.html`: Renderer HTML shell with the React root element.
- `forge.config.ts`: Electron Forge configuration, including Vite build targets and packaging options.
- `vite.main.config.ts`: Vite config for the Electron main process.
- `vite.preload.config.ts`: Vite config for the preload script.
- `vite.renderer.config.ts`: Vite config for the renderer.
- `tsconfig.json`: TypeScript configuration.
- `package.json`: npm scripts and dependencies.

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

Implement the first import flow:

1. User selects a PDF statement.
2. App captures the selected file metadata.
3. User selects or creates the source account for the statement.
4. UI shows an uploaded statement state.
5. Add PDF text extraction as the next separate step.
6. Convert extracted rows into normalized draft transactions.
7. Let the user review and correct draft transactions before saving.
8. Save accepted transactions to local JSON files and update account balances.
