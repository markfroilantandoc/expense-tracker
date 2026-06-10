import type { CreateAccountPayload } from '../domain/accounts';
import type { PdfParseResult } from '../domain/statements';
import type { SavedReviewData, SaveReviewedImportPayload } from '../domain/persistence';
import type { AppEnvironment } from './appProfile';

export type ExpenseTrackerApi = {
  parsePdfStatement: (fileName: string, data: ArrayBuffer) => Promise<PdfParseResult>;
  loadSavedReviewData: () => Promise<SavedReviewData>;
  createAccount: (payload: CreateAccountPayload) => Promise<SavedReviewData>;
  saveReviewedImport: (payload: SaveReviewedImportPayload) => Promise<SavedReviewData>;
  getAppEnvironment: () => Promise<AppEnvironment>;
};
