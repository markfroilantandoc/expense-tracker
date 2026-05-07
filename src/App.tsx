type TransactionType = 'expense' | 'income' | 'transfer';

type Transaction = {
  id: string;
  date: string;
  description: string;
  category: string;
  type: TransactionType;
  amount: number;
};

const transactions: Transaction[] = [];

export function App() {
  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <h1>Expense Tracker</h1>
          <p>Import credit card statements and review extracted transactions locally.</p>
        </div>
        <label className="upload-button">
          <input type="file" accept="application/pdf,.pdf" />
          Upload PDF Statement
        </label>
      </header>

      <section className="transactions-section" aria-labelledby="transactions-title">
        <div className="section-header">
          <h2 id="transactions-title">Transactions</h2>
          <span>{transactions.length} imported</span>
        </div>

        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Category</th>
              <th>Type</th>
              <th className="amount-column">Amount</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr>
                <td className="empty-state" colSpan={5}>
                  No transactions yet. Upload a credit card statement PDF to begin.
                </td>
              </tr>
            ) : (
              transactions.map((transaction) => (
                <tr key={transaction.id}>
                  <td>{transaction.date}</td>
                  <td>{transaction.description}</td>
                  <td>{transaction.category}</td>
                  <td>{transaction.type}</td>
                  <td className="amount-column">${transaction.amount.toFixed(2)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
