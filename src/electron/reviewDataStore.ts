import { app } from 'electron';
import { randomUUID } from 'node:crypto';
import { copyFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Account, CreateAccountPayload } from '../domain/accounts';
import {
  createEmptySavedReviewData,
  reviewDataVersion,
  type SavedImportRecord,
  type SavedReviewData,
  type SavedTransaction,
  type SaveReviewedImportPayload,
} from '../domain/persistence';
import { getAppProfile, isProductionProfile } from './appProfile';

const expenseTrackerDataFileName = 'expense-tracker-data.json';
const backupsDirectoryName = 'backups';

export async function loadSavedReviewData(): Promise<SavedReviewData> {
  const filePath = getReviewDataFilePath();

  try {
    const contents = await readFile(filePath, 'utf8');
    return normalizeSavedReviewData(JSON.parse(contents));
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return createEmptySavedReviewData();
    }

    await quarantineUnreadableFile(filePath);
    return createEmptySavedReviewData();
  }
}

export async function saveReviewedImport(payload: SaveReviewedImportPayload): Promise<SavedReviewData> {
  const currentData = await loadSavedReviewData();
  const account = currentData.accounts.find((savedAccount) => savedAccount.id === payload.accountId);

  if (!account) {
    throw new Error('Choose a saved account before saving this import.');
  }

  if (!Number.isFinite(payload.statementOpeningBalance) || !Number.isFinite(payload.statementEndingBalance)) {
    throw new Error('Statement opening and ending balances are required.');
  }

  const savedAt = new Date().toISOString();
  const importId = `import_${safeIdTimestamp(savedAt)}_${randomUUID()}`;
  const savedTransactions: SavedTransaction[] = payload.transactions.map((transaction) => {
    const transactionId = `txn_${safeIdTimestamp(savedAt)}_${randomUUID()}`;

    return {
      ...transaction,
      id: transactionId,
      originalCandidateId: transaction.id,
      importId,
      accountId: account.id,
      source: payload.source,
    };
  });
  const importRecord: SavedImportRecord = {
    id: importId,
    fileName: payload.fileName,
    savedAt,
    source: payload.source,
    accountId: account.id,
    statementOpeningBalance: payload.statementOpeningBalance,
    statementEndingBalance: payload.statementEndingBalance,
    transactionIds: savedTransactions.map((transaction) => transaction.id),
  };
  const nextData: SavedReviewData = {
    version: reviewDataVersion,
    accounts: currentData.accounts,
    imports: [...currentData.imports, importRecord],
    transactions: [...currentData.transactions, ...savedTransactions],
  };

  await writeSavedReviewData(nextData);
  return nextData;
}

export async function createAccount(payload: CreateAccountPayload): Promise<SavedReviewData> {
  const currentData = await loadSavedReviewData();
  const savedAt = new Date().toISOString();
  const account: Account = {
    id: `acct_${safeIdTimestamp(savedAt)}_${randomUUID()}`,
    name: payload.name.trim(),
    type: payload.type,
    issuer: payload.issuer.trim(),
    lastDigits: payload.lastDigits.trim() || undefined,
    openingBalance: normalizeAccountOpeningBalance(payload),
    createdAt: savedAt,
    updatedAt: savedAt,
  };

  if (!account.name) {
    throw new Error('Account name is required.');
  }

  if (!Number.isFinite(account.openingBalance)) {
    throw new Error('Opening balance must be a number.');
  }

  const nextData: SavedReviewData = {
    ...currentData,
    accounts: [...currentData.accounts, account],
  };

  await writeSavedReviewData(nextData);
  return nextData;
}

function getReviewDataFilePath(): string {
  return path.join(app.getPath('userData'), expenseTrackerDataFileName);
}

async function writeSavedReviewData(data: SavedReviewData): Promise<void> {
  const filePath = getReviewDataFilePath();
  await mkdir(path.dirname(filePath), { recursive: true });
  await backupExistingExpenseTrackerData(filePath);
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

async function backupExistingExpenseTrackerData(filePath: string): Promise<void> {
  const backupDirectoryPath = path.join(path.dirname(filePath), backupsDirectoryName);
  const backupFileName = `expense-tracker-data-${safeIdTimestamp(new Date().toISOString())}.json`;
  const backupFilePath = path.join(backupDirectoryPath, backupFileName);

  try {
    await mkdir(backupDirectoryPath, { recursive: true });
    await copyFile(filePath, backupFilePath);
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return;
    }

    if (isProductionProfile(getAppProfile())) {
      throw error;
    }
  }
}

async function quarantineUnreadableFile(filePath: string): Promise<void> {
  try {
    await rename(filePath, `${filePath}.invalid-${safeIdTimestamp(new Date().toISOString())}`);
  } catch {
    // If the file cannot be renamed, still let the app start with empty data.
  }
}

function normalizeSavedReviewData(value: unknown): SavedReviewData {
  if (!isRecord(value)) {
    return createEmptySavedReviewData();
  }

  const accounts = Array.isArray(value.accounts) ? (value.accounts as Account[]) : [];

  return {
    version: reviewDataVersion,
    accounts,
    imports: Array.isArray(value.imports)
      ? (value.imports as SavedImportRecord[]).filter((savedImport) => isPersistedImport(savedImport, accounts))
      : [],
    transactions: Array.isArray(value.transactions)
      ? (value.transactions as SavedTransaction[]).filter((transaction) => isPersistedTransaction(transaction, accounts))
      : [],
  };
}

function isPersistedImport(savedImport: SavedImportRecord, accounts: Account[]): boolean {
  return (
    typeof savedImport.accountId === 'string' &&
    accounts.some((account) => account.id === savedImport.accountId) &&
    Number.isFinite(savedImport.statementOpeningBalance) &&
    Number.isFinite(savedImport.statementEndingBalance)
  );
}

function isPersistedTransaction(transaction: SavedTransaction, accounts: Account[]): boolean {
  return (
    typeof transaction.accountId === 'string' &&
    accounts.some((account) => account.id === transaction.accountId)
  );
}

function safeIdTimestamp(value: string): string {
  return value.replace(/[:.]/g, '-');
}

function parseCurrencyAmount(value: string): number {
  return Number(value.replace(/[$,\s]/g, ''));
}

function normalizeAccountOpeningBalance(payload: CreateAccountPayload): number {
  const amount = parseCurrencyAmount(payload.openingBalance);
  return payload.type === 'credit_card' && Number.isFinite(amount) ? -Math.abs(amount) : amount;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
