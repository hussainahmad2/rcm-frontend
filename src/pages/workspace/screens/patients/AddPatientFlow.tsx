import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertCircle, Check } from 'lucide-react';
import { api } from '@/lib/api';

const STEPS = [
  { id: 'identity', label: 'Identity' },
  { id: 'demographics', label: 'Demographics' },
  { id: 'contact', label: 'Contact & address' },
  { id: 'coverage', label: 'Coverage' },
  { id: 'emergency', label: 'Emergency & work' },
  { id: 'consents', label: 'Consents' },
  { id: 'review', label: 'Review' },
] as const;

export type NewPatientForm = {
  firstName: string;
  middleName: string;
  lastName: string;
  namePrefix: string;
  nameSuffix: string;
  dob: string;
  mrn: string;
  sex: string;
  sexForBilling: string;
  genderIdentity: string;
  maritalStatus: string;
  race: string;
  ethnicity: string;
  nationalId: string;
  ssnLast4: string;
  phone: string;
  email: string;
  line1: string;
  line2: string;
  locality: string;
  region: string;
  postalCode: string;
  preferredLocale: string;
  planName: string;
  memberId: string;
  groupNumber: string;
  payerId: string;
  payerName: string;
  relationshipToSubscriber: string;
  subscriberName: string;
  cobPriority: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
  employerName: string;
  occupation: string;
  preferredPharmacy: string;
  tpoNotice: boolean;
  communicationConsent: boolean;
  nationalIdUnavailableReason: string;
  force: boolean;
};

const emptyForm = (): NewPatientForm => ({
  firstName: '',
  middleName: '',
  lastName: '',
  namePrefix: '',
  nameSuffix: '',
  dob: '',
  mrn: '',
  sex: '',
  sexForBilling: '',
  genderIdentity: '',
  maritalStatus: '',
  race: '',
  ethnicity: '',
  nationalId: '',
  ssnLast4: '',
  phone: '',
  email: '',
  line1: '',
  line2: '',
  locality: '',
  region: '',
  postalCode: '',
  preferredLocale: '',
  planName: '',
  memberId: '',
  groupNumber: '',
  payerId: '',
  payerName: '',
  relationshipToSubscriber: 'SELF',
  subscriberName: '',
  cobPriority: '1',
  emergencyContactName: '',
  emergencyContactPhone: '',
  emergencyContactRelation: '',
  employerName: '',
  occupation: '',
  preferredPharmacy: '',
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

  const set = (key: keyof NewPatientForm, value: string | boolean) =>
    setForm((current) => ({ ...current, [key]: value }));

  const missing = useMemo(() => {
    const items: string[] = [];
    if (!form.firstName.trim()) items.push('Legal first name');
    if (!form.lastName.trim()) items.push('Legal last name');
    if (!form.dob) items.push('Date of birth');
    return items;
  }, [form.firstName, form.lastName, form.dob]);

  const payload = (commit: boolean) => ({
    firstName: form.firstName,
    middleName: form.middleName || undefined,
    namePrefix: form.namePrefix || undefined,
    nameSuffix: form.nameSuffix || undefined,
    lastName: form.lastName,
    dob: form.dob,
    mrn: form.mrn || undefined,
    sex: form.sex || undefined,
    sexForBilling: form.sexForBilling || form.sex || undefined,
    genderIdentity: form.genderIdentity || undefined,
    maritalStatus: form.maritalStatus || undefined,
    race: form.race || undefined,
    ethnicity: form.ethnicity || undefined,
    nationalId: form.nationalId || undefined,
    ssnLast4: form.ssnLast4 || undefined,
    phone: form.phone || undefined,
    email: form.email || undefined,
    line1: form.line1 || undefined,
    line2: form.line2 || undefined,
    locality: form.locality || undefined,
    region: form.region || undefined,
    postalCode: form.postalCode || undefined,
    preferredLocale: form.preferredLocale || undefined,
    emergencyContactName: form.emergencyContactName || undefined,
    emergencyContactPhone: form.emergencyContactPhone || undefined,
    emergencyContactRelation: form.emergencyContactRelation || undefined,
    employerName: form.employerName || undefined,
    occupation: form.occupation || undefined,
    preferredPharmacy: form.preferredPharmacy || undefined,
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
          subscriberName: form.subscriberName || undefined,
          groupNumber: form.groupNumber || undefined,
        });
      }
      return created;
    },
    onSuccess: (data) => {
      if (data?.requiresReview || data?.duplicates?.length) {
        setNote(String(data.error || 'Possible duplicate — review, then finalize with override.'));
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
          <div className="ax-reg-fields">
            <label>Prefix<input value={form.namePrefix} onChange={(e) => set('namePrefix', e.target.value)} placeholder="Mr / Ms / Dr" /></label>
            <label>Suffix<input value={form.nameSuffix} onChange={(e) => set('nameSuffix', e.target.value)} placeholder="Jr / III" /></label>
            <label>Legal first name *<input value={form.firstName} onChange={(e) => set('firstName', e.target.value)} data-testid="input-pat-first" /></label>
            <label>Middle name<input value={form.middleName} onChange={(e) => set('middleName', e.target.value)} /></label>
            <label>Legal last name *<input value={form.lastName} onChange={(e) => set('lastName', e.target.value)} data-testid="input-pat-last" /></label>
            <label>Date of birth *<input type="date" value={form.dob} onChange={(e) => set('dob', e.target.value)} data-testid="input-pat-dob" /></label>
            <label>MRN<input value={form.mrn} onChange={(e) => set('mrn', e.target.value)} placeholder="Auto if blank" /></label>
            <label>
              Administrative sex
              <select value={form.sex} onChange={(e) => set('sex', e.target.value)}>
                <option value="">—</option>
                <option value="F">Female</option>
                <option value="M">Male</option>
                <option value="U">Unknown</option>
                <option value="O">Other</option>
              </select>
            </label>
            <label className="ax-reg-span-2">
              Sex for billing
              <select value={form.sexForBilling} onChange={(e) => set('sexForBilling', e.target.value)}>
                <option value="">Same as administrative</option>
                <option value="F">Female</option>
                <option value="M">Male</option>
                <option value="U">Unknown</option>
              </select>
            </label>
          </div>
        ) : null}

        {current.id === 'demographics' ? (
          <div className="ax-reg-fields">
            <label>
              Gender identity
              <input value={form.genderIdentity} onChange={(e) => set('genderIdentity', e.target.value)} placeholder="Optional (USCDI)" />
            </label>
            <label>
              Marital status
              <select value={form.maritalStatus} onChange={(e) => set('maritalStatus', e.target.value)}>
                <option value="">—</option>
                <option value="S">Single</option>
                <option value="M">Married</option>
                <option value="D">Divorced</option>
                <option value="W">Widowed</option>
                <option value="U">Unknown</option>
              </select>
            </label>
            <label>Race<input value={form.race} onChange={(e) => set('race', e.target.value)} placeholder="US Core race category" /></label>
            <label>Ethnicity<input value={form.ethnicity} onChange={(e) => set('ethnicity', e.target.value)} placeholder="e.g. Hispanic or Latino" /></label>
            <label>National / government ID<input value={form.nationalId} onChange={(e) => set('nationalId', e.target.value)} /></label>
            <label>SSN last 4<input value={form.ssnLast4} maxLength={4} onChange={(e) => set('ssnLast4', e.target.value.replace(/\D/g, '').slice(0, 4))} /></label>
            <label className="ax-reg-span-2">
              National ID unavailable reason
              <input value={form.nationalIdUnavailableReason} onChange={(e) => set('nationalIdUnavailableReason', e.target.value)} placeholder="Never invent a placeholder ID" />
            </label>
            <label>Preferred language<input value={form.preferredLocale} onChange={(e) => set('preferredLocale', e.target.value)} placeholder="en / ar / …" /></label>
          </div>
        ) : null}

        {current.id === 'contact' ? (
          <div className="ax-reg-fields">
            <label>Phone<input value={form.phone} onChange={(e) => set('phone', e.target.value)} /></label>
            <label>Email<input value={form.email} onChange={(e) => set('email', e.target.value)} /></label>
            <label className="ax-reg-span-2">Address line 1<input value={form.line1} onChange={(e) => set('line1', e.target.value)} /></label>
            <label className="ax-reg-span-2">Address line 2<input value={form.line2} onChange={(e) => set('line2', e.target.value)} /></label>
            <label>City / locality<input value={form.locality} onChange={(e) => set('locality', e.target.value)} /></label>
            <label>State / province / region<input value={form.region} onChange={(e) => set('region', e.target.value)} /></label>
            <label>Postal code<input value={form.postalCode} onChange={(e) => set('postalCode', e.target.value)} /></label>
          </div>
        ) : null}

        {current.id === 'coverage' ? (
          <div className="ax-reg-fields">
            <label>Plan / product<input value={form.planName} onChange={(e) => set('planName', e.target.value)} /></label>
            <label>Member ID<input value={form.memberId} onChange={(e) => set('memberId', e.target.value)} /></label>
            <label>Group number<input value={form.groupNumber} onChange={(e) => set('groupNumber', e.target.value)} /></label>
            <label>
              Existing payer
              <select value={form.payerId} onChange={(e) => set('payerId', e.target.value)}>
                <option value="">Create / default</option>
                {(payers.data ?? []).map((payer: { id: string; name: string }) => (
                  <option key={payer.id} value={payer.id}>{payer.name}</option>
                ))}
              </select>
            </label>
            <label>Or new payer name<input value={form.payerName} onChange={(e) => set('payerName', e.target.value)} /></label>
            <label>Subscriber name<input value={form.subscriberName} onChange={(e) => set('subscriberName', e.target.value)} placeholder="If different from patient" /></label>
            <label>
              Relationship to subscriber
              <select value={form.relationshipToSubscriber} onChange={(e) => set('relationshipToSubscriber', e.target.value)}>
                <option value="SELF">Self</option>
                <option value="SPOUSE">Spouse</option>
                <option value="CHILD">Child</option>
                <option value="OTHER">Other</option>
              </select>
            </label>
            <label>
              COB priority
              <select value={form.cobPriority} onChange={(e) => set('cobPriority', e.target.value)}>
                <option value="1">Primary</option>
                <option value="2">Secondary</option>
                <option value="3">Tertiary</option>
              </select>
            </label>
          </div>
        ) : null}

        {current.id === 'emergency' ? (
          <div className="ax-reg-fields">
            <label>Emergency contact name<input value={form.emergencyContactName} onChange={(e) => set('emergencyContactName', e.target.value)} /></label>
            <label>Emergency contact phone<input value={form.emergencyContactPhone} onChange={(e) => set('emergencyContactPhone', e.target.value)} /></label>
            <label>
              Relationship
              <select value={form.emergencyContactRelation} onChange={(e) => set('emergencyContactRelation', e.target.value)}>
                <option value="">—</option>
                <option value="SPOUSE">Spouse</option>
                <option value="PARENT">Parent</option>
                <option value="CHILD">Child</option>
                <option value="FRIEND">Friend</option>
                <option value="OTHER">Other</option>
              </select>
            </label>
            <label>Employer<input value={form.employerName} onChange={(e) => set('employerName', e.target.value)} /></label>
            <label>Occupation<input value={form.occupation} onChange={(e) => set('occupation', e.target.value)} /></label>
            <label>Preferred pharmacy<input value={form.preferredPharmacy} onChange={(e) => set('preferredPharmacy', e.target.value)} /></label>
          </div>
        ) : null}

        {current.id === 'consents' ? (
          <div className="ax-reg-fields ax-reg-fields-checks">
            <label className="ax-check ax-reg-span-2">
              <input type="checkbox" checked={form.tpoNotice} onChange={(e) => set('tpoNotice', e.target.checked)} />
              Treatment / payment / operations notice acknowledged
            </label>
            <label className="ax-check ax-reg-span-2">
              <input type="checkbox" checked={form.communicationConsent} onChange={(e) => set('communicationConsent', e.target.checked)} />
              Consent to communicate (SMS / email / portal)
            </label>
            <label className="ax-check ax-reg-span-2">
              <input type="checkbox" checked={form.force} onChange={(e) => set('force', e.target.checked)} />
              Override duplicate review (authorized staff only)
            </label>
          </div>
        ) : null}

        {current.id === 'review' ? (
          <div className="ax-insight-strip">
            <Check size={16} />
            <span>
              {form.firstName} {form.lastName} · DOB {form.dob || '—'} ·{' '}
              {form.planName ? `Coverage ${form.planName} / ${form.memberId || 'no member ID'}` : 'No coverage entered'}
              {missing.length ? ` · Missing: ${missing.join(', ')}` : ''}
            </span>
          </div>
        ) : null}

        <div className="ax-row-actions" style={{ marginTop: 16 }}>
          <button type="button" className="ax-ghost-button" onClick={onCancel}>Cancel</button>
          {step > 0 ? (
            <button type="button" className="ax-ghost-button" onClick={() => setStep((s) => s - 1)}>Back</button>
          ) : null}
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              className="ax-primary-button"
              onClick={() => setStep((s) => s + 1)}
              disabled={step === 0 && missing.length > 0}
            >
              Next
            </button>
          ) : (
            <>
              <button type="button" className="ax-ghost-button" disabled={save.isPending || missing.length > 0} onClick={() => save.mutate(false)}>
                Save draft
              </button>
              <button type="button" className="ax-primary-button" disabled={save.isPending || missing.length > 0} onClick={() => save.mutate(true)} data-testid="button-register-patient">
                {save.isPending ? 'Saving…' : 'Register patient'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
