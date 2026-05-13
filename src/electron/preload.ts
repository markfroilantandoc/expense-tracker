import { contextBridge, ipcRenderer } from 'electron';
import type { ExpenseTrackerApi } from './preloadApi';

const api: ExpenseTrackerApi = {
  parsePdfStatement: (fileName, data) => ipcRenderer.invoke('pdf:parse-statement', { fileName, data }),
  loadSavedReviewData: () => ipcRenderer.invoke('review-data:load'),
  createAccount: (payload) => ipcRenderer.invoke('accounts:create', payload),
  saveReviewedImport: (payload) => ipcRenderer.invoke('review-data:save-import', payload),
};

contextBridge.exposeInMainWorld('expenseTracker', api);
