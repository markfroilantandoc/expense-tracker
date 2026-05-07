import { contextBridge, ipcRenderer } from 'electron';
import type { PdfParseResult } from './pdfImport';

export type ExpenseTrackerApi = {
  parsePdfStatement: (fileName: string, data: ArrayBuffer) => Promise<PdfParseResult>;
};

const api: ExpenseTrackerApi = {
  parsePdfStatement: (fileName, data) => ipcRenderer.invoke('pdf:parse-statement', { fileName, data }),
};

contextBridge.exposeInMainWorld('expenseTracker', api);
