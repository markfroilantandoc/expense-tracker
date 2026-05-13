import { app } from 'electron';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  createEmptySavedReviewData,
  reviewDataVersion,
  type SavedImportRecord,
  type SavedReviewData,
  type SavedTransaction,
  type SaveReviewedImportPayload,
} from '../domain/persistence';

const reviewDataFileName = 'review-data.json';

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
  const savedAt = new Date().toISOString();
  const importId = `import_${safeIdTimestamp(savedAt)}_${randomUUID()}`;
  const savedTransactions: SavedTransaction[] = payload.transactions.map((transaction) => {
    const transactionId = `txn_${safeIdTimestamp(savedAt)}_${randomUUID()}`;

    return {
      ...transaction,
      id: transactionId,
      originalCandidateId: transaction.id,
      importId,
      source: payload.source,
    };
  });
  const importRecord: SavedImportRecord = {
    id: importId,
    fileName: payload.fileName,
    savedAt,
    source: payload.source,
    transactionIds: savedTransactions.map((transaction) => transaction.id),
  };
  const nextData: SavedReviewData = {
    version: reviewDataVersion,
    imports: [...currentData.imports, importRecord],
    transactions: [...currentData.transactions, ...savedTransactions],
  };

  await writeSavedReviewData(nextData);
  return nextData;
}

function getReviewDataFilePath(): string {
  return path.join(app.getPath('userData'), reviewDataFileName);
}

async function writeSavedReviewData(data: SavedReviewData): Promise<void> {
  const filePath = getReviewDataFilePath();
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
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

  return {
    version: reviewDataVersion,
    imports: Array.isArray(value.imports) ? (value.imports as SavedImportRecord[]) : [],
    transactions: Array.isArray(value.transactions) ? (value.transactions as SavedTransaction[]) : [],
  };
}

function safeIdTimestamp(value: string): string {
  return value.replace(/[:.]/g, '-');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
