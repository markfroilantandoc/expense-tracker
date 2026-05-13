import { ConfirmedTransactionsTable } from './components/ConfirmedTransactionsTable';
import { ParserDiagnostics } from './components/ParserDiagnostics';
import { SourceConfirmationForm } from './components/SourceConfirmationForm';
import { StatusBanner } from './components/StatusBanner';
import { SummaryItem } from './components/SummaryItem';
import { TransactionCandidatesTable } from './components/TransactionCandidatesTable';
import { useImportReview } from './hooks/useImportReview';

export function App() {
  const review = useImportReview();

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <h1>Expense Tracker</h1>
          <p>Import credit card statements and review extracted transactions locally.</p>
        </div>
        <label className="upload-button">
          <input
            type="file"
            accept="application/pdf,.pdf"
            onChange={review.handleFileChange}
            disabled={review.status === 'parsing'}
          />
          {review.status === 'parsing' ? 'Parsing PDF...' : 'Upload PDF Statement'}
        </label>
      </header>

      {review.status === 'parsing' ? (
        <StatusBanner tone="info" title="Parsing statement" message="Extracting selectable text from the PDF." />
      ) : null}

      {review.status === 'error' && review.importError ? (
        <StatusBanner tone="error" title={review.importError.title} message={review.importError.message} />
      ) : null}

      {review.reviewError ? <StatusBanner tone="error" title="Review issue" message={review.reviewError} /> : null}

      {review.parseResult && review.status !== 'parsing' ? (
        <section className="import-section" aria-labelledby="import-title">
          <div className="section-header">
            <h2 id="import-title">Import Review</h2>
            <span>{review.parseResult.fileName}</span>
          </div>

          <div className="import-summary">
            <SummaryItem label="Pages" value={String(review.parseResult.pageCount)} />
            <SummaryItem label="Text lines" value={String(review.parseResult.lineCount)} />
            <SummaryItem label="Remaining" value={String(review.candidateDrafts.length)} />
            <SummaryItem label="Confirmed" value={String(review.confirmedTransactions.length)} />
          </div>

          {review.parseResult.warnings.length > 0 ? (
            <div className="warning-list">
              {review.parseResult.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          ) : null}

          {review.status === 'confirming' ? (
            <SourceConfirmationForm
              source={review.sourceForm}
              onChange={review.handleSourceChange}
              onSubmit={review.handleSourceConfirmation}
            />
          ) : null}

          {review.status === 'parsed' && review.confirmedSource ? (
            <div className="confirmed-source">
              <span>{review.confirmedSource.issuer}</span>
              <span>Account {review.confirmedSource.account}</span>
              <span>{review.confirmedSource.statementPeriod}</span>
            </div>
          ) : null}
        </section>
      ) : null}

      <TransactionCandidatesTable
        candidates={review.candidateDrafts}
        selectedIds={review.selectedCandidateIds}
        onConfirmSelected={review.confirmSelectedCandidates}
        onToggleAll={review.toggleAllCandidates}
        onToggleRow={(id) => review.toggleRowSelection('candidate', id)}
        onFieldChange={review.handleCandidateFieldChange}
        onTypeChange={review.handleCandidateTypeChange}
        onCategoryGroupChange={review.handleCandidateCategoryGroupChange}
        onCategoryChange={review.handleCandidateCategoryChange}
      />

      <ConfirmedTransactionsTable
        transactions={review.sortedConfirmedTransactions}
        selectedIds={review.selectedConfirmedIds}
        onReturnSelected={review.returnSelectedConfirmed}
        onToggleAll={review.toggleAllConfirmed}
        onToggleRow={(id) => review.toggleRowSelection('confirmed', id)}
      />

      {review.parseResult ? <ParserDiagnostics parseResult={review.parseResult} /> : null}
    </main>
  );
}
