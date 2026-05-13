import { categoriesByGroup, categoryGroups, type CategoryGroup } from '../../domain/categories';
import { isValidAmount, transactionTypes, type CandidateDraft, type TransactionType } from '../../domain/transactions';

type TransactionCandidatesTableProps = {
  candidates: CandidateDraft[];
  selectedIds: string[];
  onConfirmSelected: () => void;
  onToggleAll: (checked: boolean) => void;
  onToggleRow: (id: string) => void;
  onFieldChange: (id: string, field: keyof CandidateDraft, value: string) => void;
  onTypeChange: (id: string, value: TransactionType) => void;
  onCategoryGroupChange: (id: string, value: CategoryGroup) => void;
  onCategoryChange: (id: string, value: string) => void;
};

export function TransactionCandidatesTable({
  candidates,
  selectedIds,
  onConfirmSelected,
  onToggleAll,
  onToggleRow,
  onFieldChange,
  onTypeChange,
  onCategoryGroupChange,
  onCategoryChange,
}: TransactionCandidatesTableProps) {
  return (
    <section className="transactions-section" aria-labelledby="transactions-title">
      <div className="section-header table-toolbar">
        <div>
          <h2 id="transactions-title">Transaction Candidates</h2>
          <span>{candidates.length} remaining</span>
        </div>
        <button type="button" onClick={onConfirmSelected} disabled={selectedIds.length === 0}>
          Confirm Selected
        </button>
      </div>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th className="select-column">
                <input
                  aria-label="Select all candidate transactions"
                  type="checkbox"
                  checked={candidates.length > 0 && selectedIds.length === candidates.length}
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
            {candidates.length === 0 ? (
              <tr>
                <td className="empty-state" colSpan={7}>
                  Upload a PDF and confirm its source to review candidates, or return confirmed rows for more edits.
                </td>
              </tr>
            ) : (
              candidates.map((transaction) => (
                <tr key={transaction.id} title={transaction.originalText}>
                  <td className="select-column">
                    <input
                      aria-label={`Select candidate line ${transaction.lineNumber}`}
                      type="checkbox"
                      checked={selectedIds.includes(transaction.id)}
                      onChange={() => onToggleRow(transaction.id)}
                    />
                  </td>
                  <td>
                    <input
                      className="table-input date-input"
                      value={transaction.date}
                      onChange={(event) => onFieldChange(transaction.id, 'date', event.target.value)}
                    />
                  </td>
                  <td>
                    <div className="description-cell">
                      <input
                        className="table-input description-input"
                        value={transaction.description}
                        onChange={(event) => onFieldChange(transaction.id, 'description', event.target.value)}
                      />
                    </div>
                  </td>
                  <td>
                    <select
                      className="table-input type-select"
                      value={transaction.type}
                      onChange={(event) => onTypeChange(transaction.id, event.target.value as TransactionType)}
                    >
                      {transactionTypes.map((transactionType) => (
                        <option key={transactionType} value={transactionType}>
                          {transactionType}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      className="table-input category-group-select"
                      value={transaction.categoryGroup}
                      onChange={(event) => onCategoryGroupChange(transaction.id, event.target.value as CategoryGroup)}
                    >
                      {categoryGroups.map((categoryGroup) => (
                        <option key={categoryGroup} value={categoryGroup}>
                          {categoryGroup}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      className="table-input category-select"
                      value={transaction.category}
                      onChange={(event) => onCategoryChange(transaction.id, event.target.value)}
                    >
                      {categoriesByGroup[transaction.categoryGroup].map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="amount-column">
                    <input
                      className={`table-input amount-input ${isValidAmount(transaction.amount) ? '' : 'input-invalid'}`}
                      value={transaction.amount}
                      onChange={(event) => onFieldChange(transaction.id, 'amount', event.target.value)}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
