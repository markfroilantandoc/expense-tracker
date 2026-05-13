import type { ExpenseTrackerApi } from '../electron/preloadApi';

declare global {
  interface Window {
    expenseTracker: ExpenseTrackerApi;
  }
}

export {};
