import { categoriesByGroup, categoryGroups, type CategoryGroup } from '../../domain/categories';
import {
  isValidAmount,
  transactionTypes,
  type CandidateDraft,
  type ConfirmedTransaction,
  type TransactionType,
} from '../../domain/transactions';

type ConfirmedTransactionsTableProps = {
  transactions: ConfirmedTransaction[];
  manualTransactionDraft: CandidateDraft;
  selectedIds: string[];
  canSave: boolean;
  isSaving: boolean;
  isCreditCardAccount: boolean;
  reconciliationDifference: number | null;
  calculatedEndingBalance: number | null;
  onManualFieldChange: (field: keyof CandidateDraft, value: string) => void;
  onManualTypeChange: (value: TransactionType) => void;
  onManualCategoryGroupChange: (value: CategoryGroup) => void;
  onManualCategoryChange: (value: string) => void;
  onAddManualTransaction: () => void;
  onReturnSelected: () => void;
  onSaveReviewedImport: () => void;
  onToggleAll: (checked: boolean) => void;
  onToggleRow: (id: string) => void;
};

export function ConfirmedTransactionsTable({
  transactions,
  manualTransactionDraft,
  selectedIds,
  canSave,
  isSaving,
  isCreditCardAccount,
  reconciliationDifference,
  calculatedEndingBalance,
  onManualFieldChange,
  onManualTypeChange,
  onManualCategoryGroupChange,
  onManualCategoryChange,
  onAddManualTransaction,
  onReturnSelected,
  onSaveReviewedImport,
  onToggleAll,
  onToggleRow,
}: ConfirmedTransactionsTableProps) {
  const displayedCalculatedEndingBalance =
    calculatedEndingBalance === null
      ? null
      : isCreditCardAccount
        ? Math.abs(calculatedEndingBalance)
        : calculatedEndingBalance;

  return (
    <section className="transactions-section" aria-labelledby="confirmed-transactions-title">
      <div className="section-header table-toolbar">
        <div>
          <h2 id="confirmed-transactions-title">Confirmed Transactions</h2>
          <span>
            {transactions.length} ready to save
            {calculatedEndingBalance === null
              ? ''
              : ` · calculated ending $${displayedCalculatedEndingBalance?.toFixed(2)}`}
            {reconciliationDifference === null
              ? ''
              : ` · difference $${reconciliationDifference.toFixed(2)}`}
          </span>
        </div>
        <div className="toolbar-actions">
          <button type="button" onClick={onReturnSelected} disabled={selectedIds.length === 0 || isSaving}>
            Return Selected
          </button>
          <button type="button" onClick={onSaveReviewedImport} disabled={!canSave || isSaving}>
            {isSaving ? 'Saving...' : 'Save Reviewed Import'}
          </button>
        </div>
      </div>

      <div className="manual-transaction-panel">
        <input
          className="table-input date-input"
          placeholder="Date"
          value={manualTransactionDraft.date}
          onChange={(event) => onManualFieldChange('date', event.target.value)}
        />
        <input
          className="table-input description-input"
          placeholder="Description"
          value={manualTransactionDraft.description}
          onChange={(event) => onManualFieldChange('description', event.target.value)}
        />
        <select
          className="table-input type-select"
          value={manualTransactionDraft.type}
          onChange={(event) => onManualTypeChange(event.target.value as TransactionType)}
        >
          {transactionTypes.map((transactionType) => (
            <option key={transactionType} value={transactionType}>
              {transactionType}
            </option>
          ))}
        </select>
        <select
          className="table-input category-group-select"
          value={manualTransactionDraft.categoryGroup}
          onChange={(event) => onManualCategoryGroupChange(event.target.value as CategoryGroup)}
        >
          {categoryGroups.map((categoryGroup) => (
            <option key={categoryGroup} value={categoryGroup}>
              {categoryGroup}
            </option>
          ))}
        </select>
        <select
          className="table-input category-select"
          value={manualTransactionDraft.category}
          onChange={(event) => onManualCategoryChange(event.target.value)}
        >
          {categoriesByGroup[manualTransactionDraft.categoryGroup].map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
        <input
          className={`table-input amount-input ${isValidAmount(manualTransactionDraft.amount) || !manualTransactionDraft.amount ? '' : 'input-invalid'}`}
          inputMode="decimal"
          placeholder="Amount"
          value={manualTransactionDraft.amount}
          onChange={(event) => onManualFieldChange('amount', event.target.value)}
        />
        <button type="button" onClick={onAddManualTransaction} disabled={isSaving}>
          Add Manual
        </button>
      </div>

      <div className="table-scroll confirmed-table-scroll">
        <table>
          <thead>
            <tr>
              <th className="select-column">
                <input
                  aria-label="Select all confirmed transactions"
                  type="checkbox"
                  checked={transactions.length > 0 && selectedIds.length === transactions.length}
                  onChange={(event) => onToggleAll(event.target.checked)}
                />
              </th>
              <th>Date</th>
              <th>Description</th>
              <th>Type</th>
              <th>Group</th>
              <th>Category</th>
              <th className="amount-column">Amount</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr>
                <td className="empty-state" colSpan={7}>
                  Confirm selected candidates to build the temporary transaction list.
                </td>
              </tr>
            ) : (
              transactions.map((transaction) => (
                <tr key={transaction.id} title={transaction.originalText}>
                  <td className="select-column">
                    <input
                      aria-label={`Select confirmed line ${transaction.lineNumber}`}
                      type="checkbox"
                      checked={selectedIds.includes(transaction.id)}
                      onChange={() => onToggleRow(transaction.id)}
                    />
                  </td>
                  <td>{transaction.date}</td>
                  <td>
                    <div className="description-cell">
                      <span>{transaction.description}</span>
                    </div>
                  </td>
                  <td>{transaction.type}</td>
                  <td>{transaction.categoryGroup}</td>
                  <td>{transaction.category}</td>
                  <td className="amount-column">${transaction.amount.toFixed(2)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
