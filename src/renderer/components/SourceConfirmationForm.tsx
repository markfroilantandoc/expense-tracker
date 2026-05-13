import type { FormEvent } from 'react';
import type { StatementSource } from '../../domain/statements';

type SourceConfirmationFormProps = {
  source: StatementSource;
  onChange: (field: keyof StatementSource, value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function SourceConfirmationForm({ source, onChange, onSubmit }: SourceConfirmationFormProps) {
  return (
    <form className="source-form" onSubmit={onSubmit}>
      <label>
        Issuer
        <input value={source.issuer} onChange={(event) => onChange('issuer', event.target.value)} />
      </label>
      <label>
        Account
        <input value={source.account} onChange={(event) => onChange('account', event.target.value)} />
      </label>
      <label>
        Statement period
        <input value={source.statementPeriod} onChange={(event) => onChange('statementPeriod', event.target.value)} />
      </label>
      <button type="submit">Confirm Source</button>
    </form>
  );
}
