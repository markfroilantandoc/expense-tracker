import type { Account } from './accounts';
import type { StatementSource } from './statements';
import type { ConfirmedTransaction } from './transactions';

export const reviewDataVersion = 1;

export type SavedImportRecord = {
  id: string;
  fileName: string;
  savedAt: string;
  source: StatementSource;
  accountId: string;
  statementOpeningBalance: number;
  statementEndingBalance: number;
  transactionIds: string[];
};

export type SavedTransaction = ConfirmedTransaction & {
  id: string;
  importId: string;
  accountId: string;
  source: StatementSource;
  originalCandidateId: string;
};

export type SavedReviewData = {
  version: typeof reviewDataVersion;
  accounts: Account[];
  imports: SavedImportRecord[];
  transactions: SavedTransaction[];
};

export type SaveReviewedImportPayload = {
  fileName: string;
  source: StatementSource;
  accountId: string;
  statementOpeningBalance: number;
  statementEndingBalance: number;
  transactions: ConfirmedTransaction[];
};

export function createEmptySavedReviewData(): SavedReviewData {
  return {
    version: reviewDataVersion,
    accounts: [],
    imports: [],
    transactions: [],
  };
}
