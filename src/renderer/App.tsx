import { type ChangeEvent, useEffect, useMemo, useState } from 'react';
import type { AppEnvironment } from '../electron/appProfile';
import { buildAccountBalanceSummaries } from '../domain/balances';
import { AccountsSummary } from './components/AccountsSummary';
import { AnalysisDashboard } from './components/AnalysisDashboard';
import { OverviewDashboard } from './components/OverviewDashboard';
import { ConfirmedTransactionsTable } from './components/ConfirmedTransactionsTable';
import { ParserDiagnostics } from './components/ParserDiagnostics';
import { SavedTransactionsTable } from './components/SavedTransactionsTable';
import { SourceConfirmationForm } from './components/SourceConfirmationForm';
import { StatusBanner } from './components/StatusBanner';
import { SummaryItem } from './components/SummaryItem';
import { TransactionCandidatesTable } from './components/TransactionCandidatesTable';
import { useImportReview } from './hooks/useImportReview';

type AppView = 'overview' | 'transactions' | 'analysis' | 'import';

export function App() {
  const review = useImportReview();
  const [activeView, setActiveView] = useState<AppView>('overview');
  const [appEnvironment, setAppEnvironment] = useState<AppEnvironment | null>(null);
  const [selectedTransactionAccountId, setSelectedTransactionAccountId] = useState('');
  const isImportView = activeView === 'import';
  const isAnalysisView = activeView === 'analysis';

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

  function showTransactions(accountId = '') {
    setSelectedTransactionAccountId(accountId);
    setActiveView('transactions');
  }

  const uploadLabel = review.status === 'parsing' ? 'Parsing PDF...' : 'Import PDF';
  const hasActiveImport = Boolean(review.parseResult) || review.status === 'parsing';
  const accountBalanceSummaries = useMemo(
    () => buildAccountBalanceSummaries(review.savedReviewData),
    [review.savedReviewData],
  );
  const savedTransactionsForSelectedAccount = useMemo(
    () =>
      selectedTransactionAccountId
        ? review.savedReviewData.transactions.filter(
            (transaction) => transaction.accountId === selectedTransactionAccountId,
          )
        : review.savedReviewData.transactions,
    [review.savedReviewData.transactions, selectedTransactionAccountId],
  );
  const profileBadge = appEnvironment ? (
    <span className={`profile-badge profile-badge-${appEnvironment.profile}`} title={appEnvironment.userDataPath}>
      {appEnvironment.profile.toUpperCase()}
    </span>
  ) : null;

  return (
    <main className="app-layout">
      <aside className="app-sidebar" aria-label="Main navigation">
        <div className="brand-mark"><span className="brand-symbol">◒</span><span>Expense<br />Tracker</span></div>
        <div className="sidebar-group-label">WORKSPACE</div>
        <nav className="sidebar-nav">
          {([
            ['overview', 'Overview', '◫'],
            ['transactions', 'Transactions', '≡'],
            ['analysis', 'Insights', '◩'],
            ['import', 'Import', '↥'],
          ] as const).map(([view, label, icon]) => (
            <button key={view} className={`sidebar-link ${activeView === view ? 'sidebar-link-active' : ''}`} type="button" onClick={() => setActiveView(view)} aria-current={activeView === view ? 'page' : undefined}>
              <span aria-hidden="true">{icon}</span>{label}{view === 'import' && hasActiveImport ? <i aria-label="Import in progress" /> : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer"><span>LOCAL-FIRST FINANCES</span>{profileBadge}</div>
      </aside>
      <div className={`app-shell ${isImportView ? 'import-workspace-shell' : 'transactions-workspace-shell'}`}>
        {activeView !== 'overview' ? (
          <header className="app-header page-header">
            <div>
              <span className="eyebrow">{isImportView ? 'STATEMENT WORKSPACE' : isAnalysisView ? 'YOUR MONEY IN CONTEXT' : 'YOUR ACTIVITY'}</span>
              <h1>{isImportView ? 'Import statement' : isAnalysisView ? 'Insights' : 'Transactions'}</h1>
              <p>{isImportView ? 'Review, reconcile, and save a PDF statement.' : isAnalysisView ? 'Explore monthly trends and spending patterns.' : 'Search and refine your saved transaction history.'}</p>
            </div>
            <div className="dashboard-actions">
              {hasActiveImport && !isImportView ? <button className="secondary-button" type="button" onClick={() => setActiveView('import')}>Resume import</button> : null}
              <label className="upload-button"><input type="file" accept="application/pdf,.pdf" onChange={handleImportFileChange} disabled={review.status === 'parsing'} />{isImportView && review.parseResult ? 'Choose different PDF' : uploadLabel}</label>
            </div>
          </header>
        ) : null}

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

      {activeView === 'overview' ? (
        <OverviewDashboard data={review.savedReviewData} isLoading={review.persistenceStatus === 'loading'} onImport={() => setActiveView('import')} onTransactions={showTransactions} onInsights={() => setActiveView('analysis')} />
      ) : isImportView ? (
        <>
          <div className="import-steps" aria-label="Import progress">
            <span className={review.parseResult ? 'step-complete' : 'step-current'}><b>1</b> Choose PDF</span>
            <span className={review.status === 'confirming' ? 'step-current' : review.status === 'parsed' ? 'step-complete' : ''}><b>2</b> Confirm source</span>
            <span className={review.status === 'parsed' ? 'step-current' : ''}><b>3</b> Review & save</span>
          </div>
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
            onExpenseKindChange={review.handleCandidateExpenseKindChange}
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
            onManualExpenseKindChange={review.handleManualTransactionExpenseKindChange}
            onManualCategoryChange={review.handleManualTransactionCategoryChange}
            onAddManualTransaction={review.addManualTransaction}
            onReturnSelected={review.returnSelectedConfirmed}
            onSaveReviewedImport={review.saveCurrentReviewedImport}
            onToggleAll={review.toggleAllConfirmed}
            onToggleRow={(id) => review.toggleRowSelection('confirmed', id)}
          />

          {review.parseResult ? <ParserDiagnostics parseResult={review.parseResult} /> : null}
        </>
      ) : isAnalysisView ? (
        <AnalysisDashboard savedReviewData={review.savedReviewData} />
      ) : (
        <>
          <AccountsSummary
            summaries={accountBalanceSummaries}
            selectedAccountId={selectedTransactionAccountId}
            onSelectAccount={setSelectedTransactionAccountId}
          />

          <SavedTransactionsTable
            transactions={savedTransactionsForSelectedAccount}
            accounts={review.savedReviewData.accounts}
            selectedAccountId={selectedTransactionAccountId}
            totalTransactionCount={review.savedReviewData.transactions.length}
            importCount={review.savedReviewData.imports.length}
            isLoading={review.persistenceStatus === 'loading'}
            updatingExpenseKindId={review.updatingExpenseKindId}
            onAccountFilterChange={setSelectedTransactionAccountId}
            onExpenseKindChange={review.updateSavedExpenseKind}
          />
        </>
      )}

      </div>
    </main>
  );
}
