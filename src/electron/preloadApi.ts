import type { PdfParseResult } from '../domain/statements';
import type { SavedReviewData, SaveReviewedImportPayload } from '../domain/persistence';

export type ExpenseTrackerApi = {
  parsePdfStatement: (fileName: string, data: ArrayBuffer) => Promise<PdfParseResult>;
  loadSavedReviewData: () => Promise<SavedReviewData>;
  saveReviewedImport: (payload: SaveReviewedImportPayload) => Promise<SavedReviewData>;
};
