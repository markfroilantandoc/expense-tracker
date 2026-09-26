import { contextBridge, ipcRenderer } from 'electron';
import type { ExpenseTrackerApi } from './preloadApi';

const api: ExpenseTrackerApi = {
  parsePdfStatement: (fileName, data) => ipcRenderer.invoke('pdf:parse-statement', { fileName, data }),
  loadSavedReviewData: () => ipcRenderer.invoke('review-data:load'),
  createAccount: (payload) => ipcRenderer.invoke('accounts:create', payload),
  saveReviewedImport: (payload) => ipcRenderer.invoke('review-data:save-import', payload),
  updateExpenseKind: (payload) => ipcRenderer.invoke('review-data:update-expense-kind', payload),
  getAppEnvironment: () => ipcRenderer.invoke('app:get-environment'),
};

contextBridge.exposeInMainWorld('expenseTracker', api);
