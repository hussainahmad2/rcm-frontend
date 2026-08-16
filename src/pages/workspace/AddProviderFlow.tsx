import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertCircle, Check, Hospital } from 'lucide-react';
import { api } from '@/lib/api';

const STEPS = [
  { id: 'identity', label: 'Identity' },
  { id: 'identifiers', label: 'Identifiers' },
  { id: 'review', label: 'Review' },
] as const;

const IDENTIFIER_TYPES = [
  { value: 'NATIONAL_PROVIDER_ID', label: 'National provider ID' },
  { value: 'LICENSE', label: 'Professional license' },
  { value: 'TAX_ID', label: 'Tax / organization ID' },
  { value: 'FACILITY_ID', label: 'Facility identifier' },
  { value: 'OTHER', label: 'Other' },
];

type ProviderForm = {
  name: string;
  specialty: string;
  country: string;
  roleBilling: boolean;
  roleRendering: boolean;
  roleReferring: boolean;
  identifierType: string;
  identifierValue: string;
  issuer: string;
};

const emptyForm = (): ProviderForm => ({
  name: '',
  specialty: 'General',
  country: 'US',
  roleBilling: true,
  roleRendering: true,
  roleReferring: false,
  identifierType: 'NPI',
  identifierValue: '',
  issuer: '',
});

type Props = {
  onCreated: (providerId: string, message: string) => void;
  onCancel: () => void;
};

export function AddProviderFlow({ onCreated, onCancel }: Props) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<ProviderForm>(emptyForm);
  const [note, setNote] = useState('');
  const packs = useQuery({ queryKey: ['country-packs'], queryFn: api.countryPacks });

  const set = (key: keyof ProviderForm, value: string | boolean) =>
    setForm((current) => ({ ...current, [key]: value }));

  const identifierOptions = useMemo(() => {
    const pack = (packs.data ?? []).find((item: { code?: string }) => item.code === form.country.toUpperCase());
    const fromPack = (pack?.identifierTypes as string[] | undefined) ?? [];
    if (fromPack.length) return fromPack.map((value) => ({ value, label: value }));
    return IDENTIFIER_TYPES;
  }, [packs.data, form.country]);

  const roles = useMemo(() => {
    const list: string[] = [];
    if (form.roleBilling) list.push('BILLING');
    if (form.roleRendering) list.push('RENDERING');
    if (form.roleReferring) list.push('REFERRING');
    return list;
  }, [form.roleBilling, form.roleRendering, form.roleReferring]);

  const missing = useMemo(() => {
    const items: string[] = [];
    if (!form.name.trim()) items.push('Provider name');
    if (!roles.length) items.push('At least one role');
    return items;
  }, [form.name, roles.length]);

  const save = useMutation({
    mutationFn: () =>
      api.createProvider({
        name: form.name.trim(),
        specialty: form.specialty.trim() || 'General',
        country: form.country.trim() || undefined,
        roles,
        identifierType: form.identifierType || undefined,
        identifierValue: form.identifierValue.trim() || undefined,
        issuer: form.issuer.trim() || undefined,
      }),
    onSuccess: (data) => {
      if (data?.error) {
        setNote(String(data.error));
        return;
      }
      onCreated(
        data.provider?.id ?? '',
        `Added provider ${data.provider?.name}${data.provider?.identifiers?.length ? ` · ${data.provider.identifiers.length} identifier(s)` : ''}`,
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
              Display name *
              <input value={form.name} onChange={(e) => set('name', e.target.value)} data-testid="input-provider-name" />
            </label>
            <label>
              Specialty
              <input value={form.specialty} onChange={(e) => set('specialty', e.target.value)} />
            </label>
            <label>
              Country
              <input
                value={form.country}
                onChange={(e) => {
                  const country = e.target.value.toUpperCase();
                  const pack = (packs.data ?? []).find((item: { code?: string }) => item.code === country);
                  const types = (pack?.identifierTypes as string[] | undefined) ?? IDENTIFIER_TYPES.map((item) => item.value);
                  setForm((current) => ({
                    ...current,
                    country,
                    identifierType: types.includes(current.identifierType) ? current.identifierType : types[0],
                  }));
                }}
                placeholder="ISO country code"
              />
            </label>
            <div className="ax-consent-stack">
              <span className="ax-kicker">Roles on the claim</span>
              <label className="ax-check-row">
                <input type="checkbox" checked={form.roleBilling} onChange={(e) => set('roleBilling', e.target.checked)} />
                Billing
              </label>
              <label className="ax-check-row">
                <input type="checkbox" checked={form.roleRendering} onChange={(e) => set('roleRendering', e.target.checked)} />
                Rendering
              </label>
              <label className="ax-check-row">
                <input type="checkbox" checked={form.roleReferring} onChange={(e) => set('roleReferring', e.target.checked)} />
                Referring
              </label>
            </div>
          </div>
        ) : null}

        {current.id === 'identifiers' ? (
          <div className="ax-setting-fields">
            <label>
              Identifier type
              <select value={form.identifierType} onChange={(e) => set('identifierType', e.target.value)}>
                {identifierOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Identifier value
              <input
                value={form.identifierValue}
                onChange={(e) => set('identifierValue', e.target.value)}
                placeholder="Typed ID — not assumed to be NPI"
              />
            </label>
            <label>
              Issuer
              <input value={form.issuer} onChange={(e) => set('issuer', e.target.value)} placeholder="Registry or issuing body" />
            </label>
            <p className="ax-muted">Identifiers are satellites. Country packs decide which type is required — do not hard-code NPI on the provider row.</p>
          </div>
        ) : null}

        {current.id === 'review' ? (
          <div className="ax-detail-list">
            <div>
              <span>Name</span>
              <b>{form.name || 'Missing'}</b>
            </div>
            <div>
              <span>Specialty / market</span>
              <b>
                {form.specialty || 'General'} · {form.country || '—'}
              </b>
            </div>
            <div>
              <span>Roles</span>
              <b>{roles.join(', ') || 'None'}</b>
            </div>
            <div>
              <span>Identifier</span>
              <b>{form.identifierValue ? `${form.identifierType} ${form.identifierValue}` : 'None yet'}</b>
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
              data-testid="button-add-provider-save"
            >
              {save.isPending ? 'Saving…' : 'Add provider'}
            </button>
          )}
        </div>
      </div>

      <aside className="ax-patient-rail">
        <div className="ax-panel">
          <div className="ax-panel-head">
            <div>
              <span className="ax-kicker">Provider rail</span>
              <h2>Enrollment checks</h2>
            </div>
            <Hospital size={16} />
          </div>
          <div className="ax-reason">
            <span className="ax-kicker">Missing</span>
            <p>{missing.length ? missing.join(', ') : 'Minimum identity is complete.'}</p>
          </div>
          <div className="ax-reason">
            <span className="ax-kicker">Roles</span>
            <p>Billing, rendering, and referring are claim roles — not country-specific columns.</p>
          </div>
        </div>
      </aside>
    </div>
  );
}
