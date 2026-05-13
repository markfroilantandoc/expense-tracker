import type { StatementSource } from './statements';
import type { ConfirmedTransaction } from './transactions';

export const reviewDataVersion = 1;

export type SavedImportRecord = {
  id: string;
  fileName: string;
  savedAt: string;
  source: StatementSource;
  transactionIds: string[];
};

export type SavedTransaction = ConfirmedTransaction & {
  id: string;
  importId: string;
  source: StatementSource;
  originalCandidateId: string;
};

export type SavedReviewData = {
  version: typeof reviewDataVersion;
  imports: SavedImportRecord[];
  transactions: SavedTransaction[];
};

export type SaveReviewedImportPayload = {
  fileName: string;
  source: StatementSource;
  transactions: ConfirmedTransaction[];
};

export function createEmptySavedReviewData(): SavedReviewData {
  return {
    version: reviewDataVersion,
    imports: [],
    transactions: [],
  };
}
