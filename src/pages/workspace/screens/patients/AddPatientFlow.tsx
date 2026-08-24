import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertCircle, Check, ClipboardPlus } from 'lucide-react';
import { api } from '@/lib/api';

const STEPS = [
  { id: 'identity', label: 'Identity' },
  { id: 'contact', label: 'Contact' },
  { id: 'coverage', label: 'Coverage' },
  { id: 'consents', label: 'Consents' },
  { id: 'review', label: 'Review' },
] as const;

export type NewPatientForm = {
  firstName: string;
  middleName: string;
  lastName: string;
  dob: string;
  mrn: string;
  sex: string;
  sexForBilling: string;
  phone: string;
  email: string;
  line1: string;
  locality: string;
  region: string;
  postalCode: string;
  preferredLocale: string;
  planName: string;
  memberId: string;
  payerId: string;
  payerName: string;
  relationshipToSubscriber: string;
  cobPriority: string;
  tpoNotice: boolean;
  communicationConsent: boolean;
  nationalIdUnavailableReason: string;
  force: boolean;
};

const emptyForm = (): NewPatientForm => ({
  firstName: '',
  middleName: '',
  lastName: '',
  dob: '',
  mrn: '',
  sex: '',
  sexForBilling: '',
  phone: '',
  email: '',
  line1: '',
  locality: '',
  region: '',
  postalCode: '',
  preferredLocale: '',
  planName: '',
  memberId: '',
  payerId: '',
  payerName: '',
  relationshipToSubscriber: 'SELF',
  cobPriority: '1',
  tpoNotice: false,
  communicationConsent: false,
  nationalIdUnavailableReason: '',
  force: false,
});

type Props = {
  onCreated: (patientId: string, message: string) => void;
  onCancel: () => void;
};

export function AddPatientFlow({ onCreated, onCancel }: Props) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<NewPatientForm>(emptyForm);
  const [note, setNote] = useState('');
  const payers = useQuery({ queryKey: ['payers'], queryFn: api.payers });
  const fields = useQuery({ queryKey: ['field-definitions', 'add_patient'], queryFn: () => api.fieldDefinitions('add_patient') });

  const set = (key: keyof NewPatientForm, value: string | boolean) =>
    setForm((current) => ({ ...current, [key]: value }));

  const missing = useMemo(() => {
    const items: string[] = [];
    if (!form.firstName.trim()) items.push('First name');
    if (!form.lastName.trim()) items.push('Last name');
    if (!form.dob) items.push('Date of birth');
    return items;
  }, [form.firstName, form.lastName, form.dob]);

  const payload = (commit: boolean) => ({
    firstName: form.firstName,
    middleName: form.middleName || undefined,
    lastName: form.lastName,
    dob: form.dob,
    mrn: form.mrn || undefined,
    sex: form.sex || undefined,
    sexForBilling: form.sexForBilling || form.sex || undefined,
    phone: form.phone || undefined,
    email: form.email || undefined,
    line1: form.line1 || undefined,
    locality: form.locality || undefined,
    region: form.region || undefined,
    postalCode: form.postalCode || undefined,
    preferredLocale: form.preferredLocale || undefined,
    tpoNotice: form.tpoNotice,
    communicationConsent: form.communicationConsent,
    nationalIdUnavailableReason: form.nationalIdUnavailableReason || undefined,
    commit,
    force: form.force,
  });

  const save = useMutation({
    mutationFn: async (commit: boolean) => {
      const created = await api.createPatient(payload(commit));
      if (created?.requiresReview || created?.duplicates?.length) return created;
      if (created?.error) return created;
      if (commit && form.planName && form.memberId && created.patient?.id) {
        await api.createCoverage({
          patientId: created.patient.id,
          planName: form.planName,
          memberId: form.memberId,
          payerId: form.payerId || undefined,
          payerName: form.payerName || undefined,
          relationshipToSubscriber: form.relationshipToSubscriber,
          cobPriority: Number(form.cobPriority) || 1,
        });
      }
      return created;
    },
    onSuccess: (data) => {
      if (data?.requiresReview || data?.duplicates?.length) {
        setNote(String(data.error || 'Possible duplicate — review the right rail, then finalize with override.'));
        setForm((current) => ({ ...current, force: true }));
        return;
      }
      if (data?.error) {
        setNote(String(data.error));
        return;
      }
      onCreated(
        data.patient?.id ?? '',
        `${data.patient?.registrationStatus === 'DRAFT' ? 'Draft saved' : 'Registered'} ${data.patient?.firstName} ${data.patient?.lastName} · ${data.patient?.mrn}`,
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
              First name *
              <input value={form.firstName} onChange={(e) => set('firstName', e.target.value)} data-testid="input-pat-first" />
            </label>
            <label>
              Middle name
              <input value={form.middleName} onChange={(e) => set('middleName', e.target.value)} />
            </label>
            <label>
              Last name *
              <input value={form.lastName} onChange={(e) => set('lastName', e.target.value)} data-testid="input-pat-last" />
            </label>
            <label>
              Date of birth *
              <input type="date" value={form.dob} onChange={(e) => set('dob', e.target.value)} data-testid="input-pat-dob" />
            </label>
            <label>
              Chart number
              <input value={form.mrn} onChange={(e) => set('mrn', e.target.value)} placeholder="Filled in if you leave this blank" />
            </label>
            <label>
              Sex
              <select value={form.sex} onChange={(e) => set('sex', e.target.value)}>
                <option value="">—</option>
                <option value="F">Female</option>
                <option value="M">Male</option>
                <option value="U">Unknown</option>
              </select>
            </label>
            <label>
              Sex on the claim
              <select value={form.sexForBilling} onChange={(e) => set('sexForBilling', e.target.value)}>
                <option value="">Same as sex</option>
                <option value="F">Female</option>
                <option value="M">Male</option>
                <option value="U">Unknown</option>
              </select>
            </label>
            <label>
              Why national ID is missing
              <input
                value={form.nationalIdUnavailableReason}
                onChange={(e) => set('nationalIdUnavailableReason', e.target.value)}
                placeholder="Leave blank if you have an ID"
              />
            </label>
          </div>
        ) : null}

        {current.id === 'contact' ? (
          <div className="ax-setting-fields">
            <label>
              Phone
              <input value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            </label>
            <label>
              Email
              <input value={form.email} onChange={(e) => set('email', e.target.value)} />
            </label>
            <label>
              Street address
              <input value={form.line1} onChange={(e) => set('line1', e.target.value)} />
            </label>
            <label>
              City
              <input value={form.locality} onChange={(e) => set('locality', e.target.value)} />
            </label>
            <label>
              State / region
              <input value={form.region} onChange={(e) => set('region', e.target.value)} />
            </label>
            <label>
              ZIP / postal code
              <input value={form.postalCode} onChange={(e) => set('postalCode', e.target.value)} />
            </label>
            <label>
              Language
              <input value={form.preferredLocale} onChange={(e) => set('preferredLocale', e.target.value)} />
            </label>
          </div>
        ) : null}

        {current.id === 'coverage' ? (
          <div className="ax-setting-fields">
            <label>
              Insurance plan name
              <input value={form.planName} onChange={(e) => set('planName', e.target.value)} />
            </label>
            <label>
              Insurance member ID
              <input value={form.memberId} onChange={(e) => set('memberId', e.target.value)} />
            </label>
            <label>
              Insurance company
              <select value={form.payerId} onChange={(e) => set('payerId', e.target.value)}>
                <option value="">Add a new company</option>
                {(payers.data ?? []).map((payer: { id: string; name: string }) => (
                  <option key={payer.id} value={payer.id}>
                    {payer.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Or type a new company name
              <input value={form.payerName} onChange={(e) => set('payerName', e.target.value)} />
            </label>
            <label>
              Who holds the policy
              <select value={form.relationshipToSubscriber} onChange={(e) => set('relationshipToSubscriber', e.target.value)}>
                <option value="SELF">Self</option>
                <option value="SPOUSE">Spouse</option>
                <option value="CHILD">Child</option>
                <option value="OTHER">Other</option>
              </select>
            </label>
            <label>
              Which plan pays first
              <select value={form.cobPriority} onChange={(e) => set('cobPriority', e.target.value)}>
                <option value="1">Primary</option>
                <option value="2">Secondary</option>
                <option value="3">Tertiary</option>
              </select>
            </label>
          </div>
        ) : null}

        {current.id === 'consents' ? (
          <div className="ax-consent-stack">
            <label className="ax-check-row">
              <input type="checkbox" checked={form.tpoNotice} onChange={(e) => set('tpoNotice', e.target.checked)} />
              Privacy notice given
            </label>
            <label className="ax-check-row">
              <input
                type="checkbox"
                checked={form.communicationConsent}
                onChange={(e) => set('communicationConsent', e.target.checked)}
              />
              OK to text or email
            </label>
            <p className="ax-muted">Consent is stored as versioned evidence with purpose — not a silent checkbox on Patient.</p>
          </div>
        ) : null}

        {current.id === 'review' ? (
          <div className="ax-detail-list">
            <div>
              <span>Identity</span>
              <b>
                {form.firstName} {form.lastName} · {form.dob || 'DOB missing'}
              </b>
            </div>
            <div>
              <span>Contact</span>
              <b>{form.phone || form.email || 'None yet'}</b>
            </div>
            <div>
              <span>Coverage</span>
              <b>{form.planName ? `${form.planName} / ${form.memberId || 'no member ID'}` : 'Not attached'}</b>
            </div>
            <div>
              <span>Country pack fields</span>
              <b>{fields.data?.countryPack || 'Active pack'}</b>
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
          ) : null}
          <button
            className="ax-ghost-button"
            type="button"
            disabled={save.isPending || missing.length > 0}
            onClick={() => save.mutate(false)}
          >
            Save draft
          </button>
          <button
            className="ax-primary-button"
            type="button"
            disabled={save.isPending || missing.length > 0}
            onClick={() => save.mutate(true)}
            data-testid="button-add-patient-save"
          >
            {save.isPending ? 'Saving…' : form.force ? 'Finalize anyway' : 'Finalize registration'}
          </button>
        </div>
      </div>

      <aside className="ax-patient-rail">
        <div className="ax-panel">
          <div className="ax-panel-head">
            <div>
              <span className="ax-kicker">Registration rail</span>
              <h2>Safety checks</h2>
            </div>
            <ClipboardPlus size={16} />
          </div>
          <div className="ax-reason">
            <span className="ax-kicker">Missing critical fields</span>
            <p>{missing.length ? missing.join(', ') : 'Minimum identity is complete. Draft can be saved.'}</p>
          </div>
          <div className="ax-reason">
            <span className="ax-kicker">Coverage</span>
            <p>
              Coverage is a first-class record. Patient will not store insurance as four text boxes.
            </p>
          </div>
          <div className="ax-reason">
            <span className="ax-kicker">Duplicate policy</span>
            <p>Exact MRN blocks. Name + DOB opens review. Fuzzy match never auto-merges.</p>
          </div>
        </div>
      </aside>
    </div>
  );
}
