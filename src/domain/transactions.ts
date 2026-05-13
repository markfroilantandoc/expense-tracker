import { getDefaultCategory, suggestCategory, type CategoryGroup } from './categories';

export type TransactionType = 'expense' | 'income' | 'transfer';

export type TransactionCandidate = {
  id: string;
  lineNumber: number;
  originalText: string;
  date: string;
  description: string;
  type: TransactionType;
  amount: number;
  confidence: 'medium' | 'low';
};

export type CategorizedTransaction = TransactionCandidate & {
  categoryGroup: CategoryGroup;
  category: string;
};

export type CandidateDraft = Omit<CategorizedTransaction, 'amount'> & {
  amount: string;
};

export type ConfirmedTransaction = CategorizedTransaction;

export const transactionTypes: TransactionType[] = ['expense', 'income', 'transfer'];

export function candidateToDraft(candidate: TransactionCandidate): CandidateDraft {
  const suggestedCategory = suggestCategory(candidate.description, candidate.type);

  return {
    ...candidate,
    amount: candidate.amount.toFixed(2),
    categoryGroup: suggestedCategory.group,
    category: suggestedCategory.name,
  };
}

export function draftToConfirmed(candidate: CandidateDraft): ConfirmedTransaction {
  return {
    ...candidate,
    amount: parseAmount(candidate.amount),
  };
}

export function updateDraftCategoryGroup(candidate: CandidateDraft, categoryGroup: CategoryGroup): CandidateDraft {
  return {
    ...candidate,
    categoryGroup,
    category: getDefaultCategory(categoryGroup),
  };
}

export function getManualTransactionDraft(): CandidateDraft {
  const suggestedCategory = suggestCategory('', 'expense');

  return {
    id: 'manual_draft',
    lineNumber: Number.MAX_SAFE_INTEGER,
    originalText: 'Manual transaction',
    date: '',
    description: '',
    type: 'expense',
    amount: '',
    confidence: 'medium',
    categoryGroup: suggestedCategory.group,
    category: suggestedCategory.name,
  };
}

export function compareConfirmedTransactions(a: ConfirmedTransaction, b: ConfirmedTransaction): number {
  const dateComparison = a.date.localeCompare(b.date);
  return dateComparison === 0 ? a.lineNumber - b.lineNumber : dateComparison;
}

export function compareCandidateDraftsByLine(a: CandidateDraft, b: CandidateDraft): number {
  return a.lineNumber - b.lineNumber;
}

export function isValidAmount(value: string): boolean {
  const amount = parseAmount(value);
  return Number.isFinite(amount) && amount > 0;
}

export function isValidCurrencyAmount(value: string): boolean {
  const amount = parseAmount(value);
  return Number.isFinite(amount);
}

export function parseAmount(value: string): number {
  return Number(value.replace(/[$,\s]/g, ''));
}
