import { app } from 'electron';
import { randomUUID } from 'node:crypto';
import { copyFile, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Account, CreateAccountPayload } from '../domain/accounts';
import { parseSavedReviewData } from '../domain/dataMigration';
import {
  createEmptySavedReviewData,
  reviewDataVersion,
  type SavedImportRecord,
  type SavedReviewData,
  type SavedTransaction,
  type SaveReviewedImportPayload,
  type UpdateExpenseKindPayload,
} from '../domain/persistence';
import { getAppProfile, isProductionProfile } from './appProfile';

const expenseTrackerDataFileName = 'expense-tracker-data.json';
const backupsDirectoryName = 'backups';
let operationQueue: Promise<void> = Promise.resolve();

export async function loadSavedReviewData(): Promise<SavedReviewData> {
  return runSerialized(readSavedReviewData);
}

async function readSavedReviewData(): Promise<SavedReviewData> {
  const filePath = getReviewDataFilePath();
  let contents: string;

  try {
    contents = await readFile(filePath, 'utf8');
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return createEmptySavedReviewData();
    }
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch {
    throw new Error('The saved data file is not valid JSON. It was left unchanged.');
  }

  const { data, migrated } = parseSavedReviewData(parsed);
  if (migrated) {
    await writeSavedReviewData(data, true);
  }
  return data;
}

export async function saveReviewedImport(payload: SaveReviewedImportPayload): Promise<SavedReviewData> {
  return runSerialized(() => saveReviewedImportInternal(payload));
}

async function saveReviewedImportInternal(payload: SaveReviewedImportPayload): Promise<SavedReviewData> {
  const currentData = await readSavedReviewData();
  const account = currentData.accounts.find((savedAccount) => savedAccount.id === payload.accountId);

  if (!account) {
    throw new Error('Choose a saved account before saving this import.');
  }

  if (!Number.isFinite(payload.statementOpeningBalance) || !Number.isFinite(payload.statementEndingBalance)) {
    throw new Error('Statement opening and ending balances are required.');
  }

  for (const transaction of payload.transactions) {
    if (transaction.type === 'expense' && transaction.expenseKind !== 'fixed' && transaction.expenseKind !== 'flexible') {
      throw new Error('Every expense must be marked Fixed or Flexible before saving.');
    }
    if (transaction.type !== 'expense' && transaction.expenseKind !== undefined) {
      throw new Error('Only expenses can have a Fixed/Flexible value.');
    }
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
  return runSerialized(() => createAccountInternal(payload));
}

async function createAccountInternal(payload: CreateAccountPayload): Promise<SavedReviewData> {
  const currentData = await readSavedReviewData();
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

export async function updateExpenseKind(payload: UpdateExpenseKindPayload): Promise<SavedReviewData> {
  return runSerialized(async () => {
    if (payload.expenseKind !== 'fixed' && payload.expenseKind !== 'flexible') {
      throw new Error('Choose Fixed or Flexible.');
    }

    const currentData = await readSavedReviewData();
    const transaction = currentData.transactions.find((saved) => saved.id === payload.transactionId);
    if (!transaction || transaction.type !== 'expense') {
      throw new Error('The selected expense could not be found.');
    }
    if (transaction.expenseKind === payload.expenseKind) {
      return currentData;
    }

    const nextData: SavedReviewData = {
      ...currentData,
      transactions: currentData.transactions.map((saved) =>
        saved.id === payload.transactionId ? { ...saved, expenseKind: payload.expenseKind } : saved,
      ),
    };
    await writeSavedReviewData(nextData);
    return nextData;
  });
}

function getReviewDataFilePath(): string {
  return path.join(app.getPath('userData'), expenseTrackerDataFileName);
}

async function writeSavedReviewData(data: SavedReviewData, requireBackup = false): Promise<void> {
  const filePath = getReviewDataFilePath();
  await mkdir(path.dirname(filePath), { recursive: true });
  await backupExistingExpenseTrackerData(filePath, requireBackup);
  const temporaryPath = `${filePath}.tmp-${randomUUID()}`;
  try {
    await writeFile(temporaryPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    await rename(temporaryPath, filePath);
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}

async function backupExistingExpenseTrackerData(filePath: string, requireBackup: boolean): Promise<void> {
  const backupDirectoryPath = path.join(path.dirname(filePath), backupsDirectoryName);
  const backupFileName = `expense-tracker-data-${safeIdTimestamp(new Date().toISOString())}-${randomUUID()}.json`;
  const backupFilePath = path.join(backupDirectoryPath, backupFileName);

  try {
    await mkdir(backupDirectoryPath, { recursive: true });
    await copyFile(filePath, backupFilePath);
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return;
    }

    if (requireBackup || isProductionProfile(getAppProfile())) {
      throw error;
    }
  }
}

function runSerialized<T>(operation: () => Promise<T>): Promise<T> {
  const result = operationQueue.then(operation);
  operationQueue = result.then(() => undefined, () => undefined);
  return result;
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

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
