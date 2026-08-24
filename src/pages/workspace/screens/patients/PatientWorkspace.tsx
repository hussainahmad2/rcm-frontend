import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, AlertCircle, ShieldAlert, UsersRound } from 'lucide-react';
import { api, money } from '@/lib/api';

const TABS = [
  'Overview',
  'Identity',
  'Coverage',
  'Eligibility',
  'Encounters',
  'Claims',
  'Billing',
  'Activity',
] as const;

type Tab = (typeof TABS)[number];

function timelineText(event: { templateKey?: string; eventType?: string; paramsSafe?: Record<string, unknown> }) {
  const params = event.paramsSafe ?? {};
  if (event.templateKey === 'patient.registered') return `Patient registered · MRN ${params.mrn ?? ''}`;
  if (event.templateKey === 'patient.draft') return `Registration draft saved · MRN ${params.mrn ?? ''}`;
  if (event.templateKey === 'coverage.added') return `Coverage added · ${params.planName ?? ''} (${params.memberId ?? ''})`;
  if (event.templateKey === 'charge.captured') return `Charge captured · ${params.code ?? ''} (${params.amount ?? ''})`;
  return event.eventType || 'Event';
}

export function PatientWorkspace({
  patientId,
  onClose,
}: {
  patientId: string;
  onClose?: () => void;
}) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('Overview');
  const [note, setNote] = useState('');
  const [coverage, setCoverage] = useState({
    planName: '',
    memberId: '',
    payerId: '',
    payerName: '',
    cobPriority: '1',
    relationshipToSubscriber: 'SELF',
  });
  const [payAmount, setPayAmount] = useState('');
  const payers = useQuery({ queryKey: ['payers'], queryFn: api.payers });
  const detail = useQuery({
    queryKey: ['patient', patientId],
    queryFn: () => api.patient(patientId),
    enabled: Boolean(patientId),
  });
  const statement = useQuery({
    queryKey: ['patient-statement', patientId],
    queryFn: () => api.patientStatement(patientId),
    enabled: Boolean(patientId),
  });

  const createCoverage = useMutation({
    mutationFn: () =>
      api.createCoverage({
        patientId,
        planName: coverage.planName,
        memberId: coverage.memberId,
        payerId: coverage.payerId || undefined,
        payerName: coverage.payerName || undefined,
        cobPriority: Number(coverage.cobPriority) || 1,
        relationshipToSubscriber: coverage.relationshipToSubscriber,
      }),
    onSuccess: (data) => {
      if (data?.error) {
        setNote(String(data.error));
        return;
      }
      setNote(`Coverage added: ${data.coverage?.planName}`);
      setCoverage({ planName: '', memberId: '', payerId: '', payerName: '', cobPriority: '1', relationshipToSubscriber: 'SELF' });
      void queryClient.invalidateQueries({ queryKey: ['patient', patientId] });
      void queryClient.invalidateQueries({ queryKey: ['coverages'] });
    },
  });
  const patientPay = useMutation({
    mutationFn: () => api.recordPatientPayment(patientId, Number(payAmount)),
    onSuccess: (data) => {
      if (data?.error) {
        setNote(String(data.error));
        return;
      }
      setNote(`Patient payment posted ${payAmount}`);
      setPayAmount('');
      void queryClient.invalidateQueries({ queryKey: ['patient-statement', patientId] });
      void queryClient.invalidateQueries({ queryKey: ['ar-queue'] });
      void queryClient.invalidateQueries({ queryKey: ['command-center'] });
    },
  });

  if (detail.isLoading) return <div className="ax-empty">Loading financial-access workspace…</div>;
  if (detail.error) return <div className="ax-empty">Unable to load patient.</div>;
  const selected = detail.data?.patient;
  if (!selected) return <div className="ax-empty">Select a patient.</div>;

  const identity = detail.data?.identity;
  const alerts = identity?.alerts ?? [];
  const timeline = identity?.timeline ?? [];

  return (
    <div className="ax-patient-workspace">
      <div className="ax-inspection-top">
        <span className="ax-kicker">Patient financial access</span>
        {onClose ? (
          <button className="ax-ghost-button" type="button" onClick={onClose}>
            Close
          </button>
        ) : null}
      </div>
      <div className="ax-inspection-title">
        <span className="ax-module-icon large">
          <UsersRound size={18} />
        </span>
        <div>
          <h2>
            {selected.firstName} {selected.lastName}
          </h2>
          <small>
            {selected.mrn} · DOB {selected.dob} · {selected.registrationStatus || 'REGISTERED'}
          </small>
        </div>
      </div>

      {note ? (
        <div className="ax-insight-strip">
          <AlertCircle size={16} />
          <span>{note}</span>
        </div>
      ) : null}

      <div className="ax-tabs">
        {TABS.map((entry) => (
          <button key={entry} type="button" className={tab === entry ? 'active' : ''} onClick={() => setTab(entry)}>
            {entry}
          </button>
        ))}
      </div>

      {tab === 'Overview' ? (
        <>
          <div className="ax-detail-list">
            <div>
              <span>Identity confidence</span>
              <b>{selected.duplicateReviewState === 'NONE' ? 'Clear' : selected.duplicateReviewState}</b>
            </div>
            <div>
              <span>Active coverage</span>
              <b>{detail.data?.coverages?.length ?? 0}</b>
            </div>
            <div>
              <span>Open authorizations</span>
              <b>{detail.data?.authorizations?.length ?? 0}</b>
            </div>
            <div>
              <span>Patient balance</span>
              <b>{money(selected.balance ?? 0)}</b>
            </div>
            <div>
              <span>Open claims</span>
              <b>{detail.data?.claims?.length ?? 0}</b>
            </div>
            <div>
              <span>Open work</span>
              <b>{detail.data?.workItems?.length ?? 0}</b>
            </div>
          </div>
          {alerts.length ? (
            <div className="ax-reason">
              <span className="ax-kicker">Alerts</span>
              {alerts.map((alert: { id: string; severity: string; message: string }) => (
                <p key={alert.id}>
                  <ShieldAlert size={12} /> {alert.severity}: {alert.message}
                </p>
              ))}
            </div>
          ) : (
            <div className="ax-reason">
              <span className="ax-kicker">Alerts</span>
              <p>No hard-stop identity or legal-hold alerts.</p>
            </div>
          )}
        </>
      ) : null}

      {tab === 'Identity' ? (
        <div className="ax-detail-list">
          <div>
            <span>Legal name</span>
            <b>
              {selected.namePrefix} {selected.firstName} {selected.middleName} {selected.lastName} {selected.nameSuffix}
            </b>
          </div>
          <div>
            <span>Phone</span>
            <b>{selected.phone || '—'}</b>
          </div>
          <div>
            <span>Email</span>
            <b>{selected.email || '—'}</b>
          </div>
          <div>
            <span>Country / pack</span>
            <b>{selected.country}</b>
          </div>
          <div>
            <span>Typed identifiers</span>
            <b>{(identity?.identifiers ?? []).map((row: { identifierType: string; identifierValue: string }) => `${row.identifierType}:${row.identifierValue}`).join(' · ') || selected.mrn}</b>
          </div>
          <div>
            <span>Provenance</span>
            <b>
              {selected.source || 'MANUAL'} · {selected.sourceSystem || 'velora-ui'}
            </b>
          </div>
        </div>
      ) : null}

      {tab === 'Coverage' ? (
        <>
          <div className="ax-opportunity-list">
            {(detail.data?.coverages ?? []).map((row: { id: string; planName: string; memberId: string; cobPriority?: number; verificationStatus?: string; status: string }) => (
              <div className="ax-opportunity" key={row.id}>
                <span className="ax-rank">{row.cobPriority ?? 1}</span>
                <span>
                  <b>{row.planName}</b>
                  <small>
                    {row.memberId} · {row.status} · {row.verificationStatus || 'UNVERIFIED'}
                  </small>
                </span>
                <button
                  className="ax-outline-button"
                  type="button"
                  onClick={() =>
                    void api.verifyCoverage(row.id).then(() => queryClient.invalidateQueries({ queryKey: ['patient', patientId] }))
                  }
                >
                  Verify
                </button>
              </div>
            ))}
          </div>
          <div className="ax-setting-fields" style={{ marginTop: 12 }}>
            <label>
              Insurance plan name
              <input value={coverage.planName} onChange={(e) => setCoverage((c) => ({ ...c, planName: e.target.value }))} />
            </label>
            <label>
              Insurance member ID
              <input value={coverage.memberId} onChange={(e) => setCoverage((c) => ({ ...c, memberId: e.target.value }))} />
            </label>
            <label>
              Insurance company
              <select value={coverage.payerId} onChange={(e) => setCoverage((c) => ({ ...c, payerId: e.target.value }))}>
                <option value="">New / default</option>
                {(payers.data ?? []).map((payer: { id: string; name: string }) => (
                  <option key={payer.id} value={payer.id}>
                    {payer.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Which plan pays first
              <select value={coverage.cobPriority} onChange={(e) => setCoverage((c) => ({ ...c, cobPriority: e.target.value }))}>
                <option value="1">Primary</option>
                <option value="2">Secondary</option>
                <option value="3">Tertiary</option>
              </select>
            </label>
            <button
              className="ax-primary-button"
              type="button"
              disabled={createCoverage.isPending || !coverage.planName || !coverage.memberId}
              onClick={() => createCoverage.mutate()}
            >
              Add coverage
            </button>
          </div>
        </>
      ) : null}

      {tab === 'Eligibility' ? (
        <div className="ax-reason">
          <span className="ax-kicker">Normalized benefits</span>
          <p>
            Eligibility is a case against a coverage snapshot — it does not overwrite member IDs. Use Coverage → Verify
            to request a check.
          </p>
          {(detail.data?.coverages ?? []).map(
            (row: { id: string; planName: string; verificationStatus?: string; cobPriority?: number }) => (
              <p key={row.id}>
                P{row.cobPriority ?? 1} {row.planName}: {row.verificationStatus || 'UNVERIFIED'}
              </p>
            ),
          )}
        </div>
      ) : null}

      {tab === 'Encounters' ? (
        <div className="ax-opportunity-list">
          {(detail.data?.encounters ?? []).map((row: { id: string; serviceFrom: string; status: string }) => (
            <div className="ax-opportunity" key={row.id}>
              <span className="ax-rank">E</span>
              <span>
                <b>{row.serviceFrom}</b>
                <small>
                  {row.id} · {row.status}
                </small>
              </span>
            </div>
          ))}
          {!(detail.data?.encounters ?? []).length ? <p className="ax-muted">No encounters yet.</p> : null}
        </div>
      ) : null}

      {tab === 'Claims' ? (
        <div className="ax-opportunity-list">
          {(detail.data?.claims ?? []).map((row: { id: string; claimNumber: string; status: string }) => (
            <div className="ax-opportunity" key={row.id}>
              <span className="ax-rank">C</span>
              <span>
                <b>{row.claimNumber}</b>
                <small>{row.status}</small>
              </span>
            </div>
          ))}
          {!(detail.data?.claims ?? []).length ? <p className="ax-muted">No claims linked.</p> : null}
        </div>
      ) : null}

      {tab === 'Billing' ? (
        <div className="ax-reason">
          <span className="ax-kicker">Patient statement</span>
          <div className="ax-detail-list">
            <div>
              <span>Insurance AR</span>
              <b>{money(statement.data?.insuranceAr ?? 0)}</b>
            </div>
            <div>
              <span>Patient share</span>
              <b>{money(statement.data?.patientResponsibility ?? 0)}</b>
            </div>
            <div>
              <span>Unbilled</span>
              <b>{money(statement.data?.unbilled ?? 0)}</b>
            </div>
            <div>
              <span>Total</span>
              <b>{money(statement.data?.balance ?? 0)}</b>
            </div>
          </div>
          <div className="ax-setting-fields" style={{ marginTop: 12 }}>
            <label>
              Record patient payment
              <input value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="Amount" />
            </label>
            <button
              className="ax-primary-button"
              type="button"
              disabled={patientPay.isPending || !Number(payAmount)}
              onClick={() => patientPay.mutate()}
            >
              Post payment
            </button>
          </div>
          <p className="ax-muted">Patient payments post as signed PATIENT_PAYMENT ledger entries — balances are never edited in place.</p>
        </div>
      ) : null}

      {tab === 'Activity' ? (
        <div className="ax-activity-list">
          {timeline.map((event: { id: string; occurredAt: string; category: string; templateKey?: string; eventType?: string; paramsSafe?: Record<string, unknown> }) => (
            <div key={event.id} className="ax-activity-row">
              <Activity size={14} />
              <div>
                <b>{timelineText(event)}</b>
                <small>
                  {event.category} · {new Date(event.occurredAt).toLocaleString()}
                </small>
              </div>
            </div>
          ))}
          {!timeline.length ? <p className="ax-muted">No timeline events yet. Activity is a projection — audit remains immutable elsewhere.</p> : null}
        </div>
      ) : null}
    </div>
  );
}
