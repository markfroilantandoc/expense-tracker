import { contextBridge, ipcRenderer } from 'electron';
import type { ExpenseTrackerApi } from './preloadApi';

const api: ExpenseTrackerApi = {
  parsePdfStatement: (fileName, data) => ipcRenderer.invoke('pdf:parse-statement', { fileName, data }),
};

contextBridge.exposeInMainWorld('expenseTracker', api);
