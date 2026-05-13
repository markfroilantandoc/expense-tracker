import type { TransactionCandidate } from './transactions';

export type StatementSource = {
  issuer: string;
  account: string;
  statementPeriod: string;
};

export type PdfParseResult = {
  fileName: string;
  pageCount: number;
  characterCount: number;
  lineCount: number;
  source: StatementSource;
  candidates: TransactionCandidate[];
  candidateLines: string[];
  extractedText: string;
  warnings: string[];
};

export const emptySource: StatementSource = {
  issuer: '',
  account: '',
  statementPeriod: '',
};

export function sourceValue(value: string): string {
  return value === 'Unknown' ? '' : value;
}

export function confirmSource(source: StatementSource): StatementSource {
  return {
    issuer: source.issuer.trim() || 'Unknown',
    account: source.account.trim() || 'Unknown',
    statementPeriod: source.statementPeriod.trim() || 'Unknown',
  };
}
