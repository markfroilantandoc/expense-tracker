import type { PdfParseResult } from '../domain/statements';

export type ExpenseTrackerApi = {
  parsePdfStatement: (fileName: string, data: ArrayBuffer) => Promise<PdfParseResult>;
};
