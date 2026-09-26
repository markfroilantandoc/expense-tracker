const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsPromises = require('node:fs/promises');
const Module = require('node:module');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const typescript = require('typescript');

Module._extensions['.ts'] = (loadedModule, fileName) => {
  const source = fs.readFileSync(fileName, 'utf8');
  const { outputText } = typescript.transpileModule(source, {
    compilerOptions: {
      module: typescript.ModuleKind.CommonJS,
      target: typescript.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName,
  });
  loadedModule._compile(outputText, fileName);
};

let userDataPath = '';
const originalLoad = Module._load;
Module._load = function loadWithElectronStub(request, parent, isMain) {
  if (request === 'electron') {
    return { app: { isPackaged: false, getPath: () => userDataPath } };
  }
  return originalLoad.call(this, request, parent, isMain);
};
const { parseSavedReviewData } = require('../src/domain/dataMigration.ts');
const { suggestCategory } = require('../src/domain/categories.ts');
const { getManualTransactionDraft, updateDraftType } = require('../src/domain/transactions.ts');
const { loadSavedReviewData, updateExpenseKind } = require('../src/electron/reviewDataStore.ts');
Module._load = originalLoad;

function legacyData() {
  return {
    version: 1,
    accounts: [{ id: 'account-1', name: 'Checking', openingBalance: 100 }],
    imports: [{ id: 'import-1', accountId: 'account-1', statementOpeningBalance: 100, statementEndingBalance: 75, transactionIds: ['fixed-1', 'flexible-1'] }],
    transactions: [
      { id: 'fixed-1', importId: 'import-1', accountId: 'account-1', type: 'expense', categoryGroup: 'Fixed Expenses', category: 'Grocery', amount: 20 },
      { id: 'flexible-1', importId: 'import-1', accountId: 'account-1', type: 'expense', categoryGroup: 'Discretionary Expenses', category: 'Other', amount: 5 },
      { id: 'income-1', importId: 'import-1', accountId: 'account-1', type: 'income', categoryGroup: 'Income', category: 'Repayment', amount: 4 },
    ],
  };
}

test('version 1 migration preserves records and maps expense kinds', () => {
  const original = legacyData();
  const { data, migrated } = parseSavedReviewData(original);
  assert.equal(migrated, true);
  assert.equal(data.version, 2);
  assert.equal(data.accounts.length, original.accounts.length);
  assert.deepEqual(data.imports, original.imports);
  assert.deepEqual(data.transactions.map(({ id, amount, category }) => ({ id, amount, category })),
    original.transactions.map(({ id, amount, category }) => ({ id, amount, category })));
  assert.deepEqual(data.transactions.map((transaction) => transaction.expenseKind), ['fixed', 'flexible', undefined]);
  assert.ok(data.transactions.every((transaction) => !('categoryGroup' in transaction)));
  assert.deepEqual(parseSavedReviewData(data), { data, migrated: false });
});

test('unexpected expense groups and future versions fail without guessing', () => {
  const unexpected = legacyData();
  unexpected.transactions[0].categoryGroup = 'Savings';
  assert.throws(() => parseSavedReviewData(unexpected), /Cannot classify expense/);
  assert.throws(() => parseSavedReviewData({ ...legacyData(), version: 3 }), /Unsupported saved data version/);
  const invalidVersionTwo = parseSavedReviewData(legacyData()).data;
  invalidVersionTwo.transactions[0].expenseKind = undefined;
  assert.throws(() => parseSavedReviewData(invalidVersionTwo), /missing a valid Fixed\/Flexible value/);
});

test('expense suggestions can be overridden per row and cleared for non-expenses', () => {
  assert.deepEqual(suggestCategory('monthly rent', 'expense'), { category: 'Housing', expenseKind: 'fixed' });
  assert.deepEqual(suggestCategory('coffee shop', 'expense'), { category: 'Food', expenseKind: 'flexible' });
  assert.deepEqual(suggestCategory('unrecognized purchase', 'expense'), { category: 'Other', expenseKind: 'flexible' });
  const overridden = { ...getManualTransactionDraft(), category: 'Grocery', expenseKind: 'flexible' };
  assert.equal(overridden.expenseKind, 'flexible');
  const income = updateDraftType(overridden, 'income');
  assert.equal(income.category, 'Other');
  assert.equal(income.expenseKind, undefined);
  assert.equal(updateDraftType(income, 'expense').expenseKind, 'flexible');
});

test('optional legacy profile dry run preserves every transaction', {
  skip: !process.env.EXPENSE_TRACKER_LEGACY_FIXTURE,
}, async () => {
  const original = JSON.parse(await fsPromises.readFile(process.env.EXPENSE_TRACKER_LEGACY_FIXTURE, 'utf8'));
  const { data, migrated } = parseSavedReviewData(original);
  assert.equal(migrated, true);
  assert.equal(data.transactions.length, original.transactions.length);
  assert.deepEqual(data.transactions.map(({ id, amount, category }) => ({ id, amount, category })),
    original.transactions.map(({ id, amount, category }) => ({ id, amount, category })));
  assert.equal(data.transactions.filter((transaction) => transaction.expenseKind === 'fixed').length,
    original.transactions.filter((transaction) => transaction.categoryGroup === 'Fixed Expenses').length);
  assert.equal(data.transactions.filter((transaction) => transaction.expenseKind === 'flexible').length,
    original.transactions.filter((transaction) => transaction.categoryGroup === 'Discretionary Expenses').length);
});

test('automatic migration backs up the original and saved expense edits change only classification', async () => {
  userDataPath = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'expense-tracker-migration-'));
  const filePath = path.join(userDataPath, 'expense-tracker-data.json');
  const original = legacyData();
  const originalText = `${JSON.stringify(original, null, 2)}\n`;
  try {
    await fsPromises.writeFile(filePath, originalText);
    const migrated = await loadSavedReviewData();
    assert.equal(migrated.version, 2);
    const backups = await fsPromises.readdir(path.join(userDataPath, 'backups'));
    assert.equal(backups.length, 1);
    assert.equal(await fsPromises.readFile(path.join(userDataPath, 'backups', backups[0]), 'utf8'), originalText);
    assert.deepEqual(JSON.parse(await fsPromises.readFile(filePath, 'utf8')), migrated);

    const updated = await updateExpenseKind({ transactionId: 'fixed-1', expenseKind: 'flexible' });
    assert.equal(updated.transactions[0].expenseKind, 'flexible');
    assert.deepEqual({ ...updated.transactions[0], expenseKind: 'fixed' }, migrated.transactions[0]);
    await assert.rejects(updateExpenseKind({ transactionId: 'income-1', expenseKind: 'fixed' }), /selected expense/);
  } finally {
    await fsPromises.rm(userDataPath, { recursive: true, force: true });
  }
});

test('migration leaves the original file intact if its backup cannot be created', async () => {
  userDataPath = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'expense-tracker-backup-failure-'));
  const filePath = path.join(userDataPath, 'expense-tracker-data.json');
  const originalText = JSON.stringify(legacyData());
  try {
    await fsPromises.writeFile(filePath, originalText);
    await fsPromises.writeFile(path.join(userDataPath, 'backups'), 'blocking file');
    await assert.rejects(loadSavedReviewData());
    assert.equal(await fsPromises.readFile(filePath, 'utf8'), originalText);
  } finally {
    await fsPromises.rm(userDataPath, { recursive: true, force: true });
  }
});
