import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AlertCircle, Building2, Check } from 'lucide-react';
import { api } from '@/lib/api';

const STEPS = [
  { id: 'identity', label: 'Identity' },
  { id: 'routing', label: 'Routing' },
  { id: 'review', label: 'Review' },
] as const;

type PayerForm = {
  name: string;
  legalName: string;
  country: string;
  payerType: string;
  claimStandard: string;
  routingId: string;
};

const emptyForm = (): PayerForm => ({
  name: '',
  legalName: '',
  country: 'US',
  payerType: 'COMMERCIAL',
  claimStandard: 'X12-5010',
  routingId: '',
});

type Props = {
  onCreated: (payerId: string, message: string) => void;
  onCancel: () => void;
};

export function AddPayerFlow({ onCreated, onCancel }: Props) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<PayerForm>(emptyForm);
  const [note, setNote] = useState('');

  const set = (key: keyof PayerForm, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const missing = useMemo(() => {
    const items: string[] = [];
    if (!form.name.trim()) items.push('Payer name');
    if (!form.country.trim()) items.push('Country');
    return items;
  }, [form.name, form.country]);

  const save = useMutation({
    mutationFn: () =>
      api.createPayer({
        name: form.name.trim(),
        legalName: form.legalName.trim() || form.name.trim(),
        country: form.country.trim(),
        payerType: form.payerType,
        claimStandard: form.claimStandard.trim() || undefined,
        routingId: form.routingId.trim() || undefined,
        status: 'DRAFT',
      }),
    onSuccess: (data) => {
      if (data?.error) {
        setNote(String(data.error));
        return;
      }
      const payer = data.payer;
      onCreated(
        payer?.id ?? '',
        data.existed ? `Existed: ${payer?.name}` : `Draft payer ${payer?.name} — activate after plans and routing are complete`,
      );
    },
    onError: (error: Error) => setNote(error.message),
  });

  const current = STEPS[step];

  return (
    <div className="ax-patient-flow">
      <div className="ax-patient-flow-main">
        <ol className="ax-stepper">
          {STEPS.map((entry, index) => (
            <li key={entry.id} className={index === step ? 'active' : index < step ? 'done' : ''}>
              <button type="button" onClick={() => setStep(index)}>
                <span>{index < step ? <Check size={12} /> : index + 1}</span>
                {entry.label}
              </button>
            </li>
          ))}
        </ol>

        {note ? (
          <div className="ax-insight-strip">
            <AlertCircle size={16} />
            <span>{note}</span>
          </div>
        ) : null}

        {current.id === 'identity' ? (
          <div className="ax-setting-fields">
            <label>
              Payer name *
              <input value={form.name} onChange={(e) => set('name', e.target.value)} data-testid="input-payer-name" />
            </label>
            <label>
              Legal name
              <input value={form.legalName} onChange={(e) => set('legalName', e.target.value)} placeholder="Same as name if blank" />
            </label>
            <label>
              Country *
              <input value={form.country} onChange={(e) => set('country', e.target.value)} />
            </label>
            <label>
              Payer type
              <select value={form.payerType} onChange={(e) => set('payerType', e.target.value)}>
                <option value="COMMERCIAL">Commercial</option>
                <option value="GOVERNMENT">Government</option>
                <option value="TPA">TPA</option>
                <option value="SELF_PAY">Self-pay</option>
                <option value="OTHER">Other</option>
              </select>
            </label>
          </div>
        ) : null}

        {current.id === 'routing' ? (
          <div className="ax-setting-fields">
            <label>
              Claim standard
              <input value={form.claimStandard} onChange={(e) => set('claimStandard', e.target.value)} placeholder="X12-5010, NPHIES, FHIR…" />
            </label>
            <label>
              Routing ID
              <input
                value={form.routingId}
                onChange={(e) => set('routingId', e.target.value)}
                placeholder="Payer routing / trading-partner ID"
              />
            </label>
            <p className="ax-muted">Saved as DRAFT. Activate only after routing identifiers and at least one published plan exist.</p>
          </div>
        ) : null}

        {current.id === 'review' ? (
          <div className="ax-detail-list">
            <div>
              <span>Insurance company</span>
              <b>{form.name || 'Missing'}</b>
            </div>
            <div>
              <span>Type / market</span>
              <b>
                {form.payerType} · {form.country}
              </b>
            </div>
            <div>
              <span>Standard</span>
              <b>{form.claimStandard || 'GENERIC'}</b>
            </div>
            <div>
              <span>Routing</span>
              <b>{form.routingId || 'None yet'}</b>
            </div>
          </div>
        ) : null}

        <div className="ax-reg-actions">
          <button className="ax-ghost-button" type="button" onClick={onCancel}>
            Cancel
          </button>
          {step > 0 ? (
            <button className="ax-ghost-button" type="button" onClick={() => setStep((s) => s - 1)}>
              Back
            </button>
          ) : null}
          {step < STEPS.length - 1 ? (
            <button className="ax-primary-button" type="button" onClick={() => setStep((s) => s + 1)}>
              Next
            </button>
          ) : (
            <button
              className="ax-primary-button"
              type="button"
              disabled={save.isPending || missing.length > 0}
              onClick={() => save.mutate()}
              data-testid="button-add-payer-save"
            >
              {save.isPending ? 'Saving…' : 'Save as draft'}
            </button>
          )}
        </div>
      </div>

      <aside className="ax-patient-rail">
        <div className="ax-panel">
          <div className="ax-panel-head">
            <div>
              <span className="ax-kicker">Payer rail</span>
              <h2>Master-data checks</h2>
            </div>
            <Building2 size={16} />
          </div>
          <div className="ax-reason">
            <span className="ax-kicker">Missing</span>
            <p>{missing.length ? missing.join(', ') : 'Minimum identity is complete. Draft can be saved.'}</p>
          </div>
          <div className="ax-reason">
            <span className="ax-kicker">Lifecycle</span>
            <p>Draft → Active → Suspended → Retired. Plans publish independently of payer status.</p>
          </div>
        </div>
      </aside>
    </div>
  );
}
