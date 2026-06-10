import { type ChangeEvent, useEffect, useState } from 'react';
import type { AppEnvironment } from '../electron/appProfile';
import { ConfirmedTransactionsTable } from './components/ConfirmedTransactionsTable';
import { ParserDiagnostics } from './components/ParserDiagnostics';
import { SavedTransactionsTable } from './components/SavedTransactionsTable';
import { SourceConfirmationForm } from './components/SourceConfirmationForm';
import { StatusBanner } from './components/StatusBanner';
import { SummaryItem } from './components/SummaryItem';
import { TransactionCandidatesTable } from './components/TransactionCandidatesTable';
import { useImportReview } from './hooks/useImportReview';

type AppView = 'transactions' | 'import';

export function App() {
  const review = useImportReview();
  const [activeView, setActiveView] = useState<AppView>('transactions');
  const [appEnvironment, setAppEnvironment] = useState<AppEnvironment | null>(null);
  const isImportView = activeView === 'import';

  useEffect(() => {
    let isActive = true;

    async function loadAppEnvironment() {
      let environment: AppEnvironment;

      try {
        environment = await window.expenseTracker.getAppEnvironment();
      } catch {
        return;
      }

      if (isActive) {
        setAppEnvironment(environment);
      }
    }

    loadAppEnvironment();

    return () => {
      isActive = false;
    };
  }, []);

  function handleImportFileChange(event: ChangeEvent<HTMLInputElement>) {
    setActiveView('import');
    review.handleFileChange(event);
  }

  const uploadLabel = review.status === 'parsing' ? 'Parsing PDF...' : 'Import PDF';
  const hasActiveImport = Boolean(review.parseResult) || review.status === 'parsing';
  const profileBadge = appEnvironment ? (
    <span className={`profile-badge profile-badge-${appEnvironment.profile}`} title={appEnvironment.userDataPath}>
      {appEnvironment.profile.toUpperCase()}
    </span>
  ) : null;

  return (
    <main className={`app-shell ${isImportView ? 'import-workspace-shell' : 'transactions-workspace-shell'}`}>
      {isImportView ? (
        <header className="app-header import-header">
          <button className="secondary-button" type="button" onClick={() => setActiveView('transactions')}>
            Back to Transactions
          </button>
          <div>
            <div className="header-title-row">
              <h1>Import Statement</h1>
              {profileBadge}
            </div>
            <p>Review the statement source, edit extracted rows, and save confirmed transactions.</p>
          </div>
          <label className="upload-button">
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={handleImportFileChange}
              disabled={review.status === 'parsing'}
            />
            {review.status === 'parsing' ? 'Parsing PDF...' : 'Choose Different PDF'}
          </label>
        </header>
      ) : (
        <header className="app-header dashboard-header">
          <div>
            <div className="header-title-row">
              <h1>Transactions</h1>
              {profileBadge}
            </div>
            <p>Saved reviewed transactions are shown first. Import a PDF when you are ready to add more.</p>
          </div>
          <div className="dashboard-actions">
            {hasActiveImport ? (
              <button className="secondary-button" type="button" onClick={() => setActiveView('import')}>
                Resume Import
              </button>
            ) : null}
            <label className="upload-button">
              <input
                type="file"
                accept="application/pdf,.pdf"
                onChange={handleImportFileChange}
                disabled={review.status === 'parsing'}
              />
              {uploadLabel}
            </label>
          </div>
        </header>
      )}

      {review.status === 'parsing' ? (
        <StatusBanner tone="info" title="Parsing statement" message="Extracting selectable text from the PDF." />
      ) : null}

      {review.status === 'error' && review.importError ? (
        <StatusBanner tone="error" title={review.importError.title} message={review.importError.message} />
      ) : null}

      {review.reviewError ? <StatusBanner tone="error" title="Review issue" message={review.reviewError} /> : null}

      {review.persistenceError ? (
        <StatusBanner tone="error" title="Persistence issue" message={review.persistenceError} />
      ) : null}

      {review.saveMessage ? <StatusBanner tone="info" title="Saved import" message={review.saveMessage} /> : null}

      {isImportView ? (
        <>
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
                  accounts={review.savedReviewData.accounts}
                  selectedAccountId={review.selectedAccountId}
                  accountDraft={review.accountDraft}
                  statementStartDate={review.statementStartDate}
                  statementEndDate={review.statementEndDate}
                  statementOpeningBalance={review.statementOpeningBalance}
                  statementEndingBalance={review.statementEndingBalance}
                  isSaving={review.persistenceStatus === 'saving'}
                  onSelectedAccountChange={review.handleSelectedAccountChange}
                  onAccountDraftChange={review.handleAccountDraftChange}
                  onAccountTypeChange={review.handleAccountTypeChange}
                  onCreateAccount={review.createAccountFromDraft}
                  onStatementStartDateChange={review.handleStatementStartDateChange}
                  onStatementEndDateChange={review.handleStatementEndDateChange}
                  onStatementOpeningBalanceChange={review.handleStatementOpeningBalanceChange}
                  onStatementEndingBalanceChange={review.handleStatementEndingBalanceChange}
                  onSubmit={review.handleSourceConfirmation}
                />
              ) : null}

              {review.status === 'parsed' && review.confirmedSource ? (
                <div className="confirmed-source">
                  <span>{review.confirmedSource.issuer}</span>
                  <span>{review.selectedAccount?.name ?? `Account ${review.confirmedSource.account}`}</span>
                  <span>{review.confirmedSource.statementPeriod}</span>
                  <span>Opening {review.statementOpeningBalance}</span>
                  <span>Ending {review.statementEndingBalance}</span>
                </div>
              ) : null}
            </section>
          ) : (
            <section className="import-empty-state" aria-labelledby="import-empty-title">
              <div>
                <h2 id="import-empty-title">Choose a PDF statement</h2>
                <p>The import workspace will stay focused on parsing, source confirmation, and row review.</p>
              </div>
              <label className="upload-button">
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={handleImportFileChange}
                  disabled={review.status === 'parsing'}
                />
                {uploadLabel}
              </label>
            </section>
          )}

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
            manualTransactionDraft={review.manualTransactionDraft}
            selectedIds={review.selectedConfirmedIds}
            canSave={
              Boolean(review.parseResult && review.confirmedSource && review.selectedAccount) &&
              review.confirmedTransactions.length > 0 &&
              review.reconciliation.canSave &&
              review.persistenceStatus !== 'loading'
            }
            isSaving={review.persistenceStatus === 'saving'}
            isCreditCardAccount={review.selectedAccount?.type === 'credit_card'}
            reconciliationDifference={review.reconciliation.difference}
            calculatedEndingBalance={review.reconciliation.calculatedEndingBalance}
            onManualFieldChange={review.handleManualTransactionFieldChange}
            onManualTypeChange={review.handleManualTransactionTypeChange}
            onManualCategoryGroupChange={review.handleManualTransactionCategoryGroupChange}
            onManualCategoryChange={review.handleManualTransactionCategoryChange}
            onAddManualTransaction={review.addManualTransaction}
            onReturnSelected={review.returnSelectedConfirmed}
            onSaveReviewedImport={review.saveCurrentReviewedImport}
            onToggleAll={review.toggleAllConfirmed}
            onToggleRow={(id) => review.toggleRowSelection('confirmed', id)}
          />

          {review.parseResult ? <ParserDiagnostics parseResult={review.parseResult} /> : null}
        </>
      ) : (
        <SavedTransactionsTable
          transactions={review.savedReviewData.transactions}
          accounts={review.savedReviewData.accounts}
          importCount={review.savedReviewData.imports.length}
          isLoading={review.persistenceStatus === 'loading'}
        />
      )}

    </main>
  );
}
