import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PanelLeftOpen, Search, UsersRound, X } from 'lucide-react';
import { api, money } from '@/lib/api';
import { ErrorState, LoadingState, SectionHeading, StatusPill } from '../../shared/ui';
import { AddPatientFlow } from './AddPatientFlow';
import { PatientWorkspace } from './PatientWorkspace';
import './Patients.css';

export function Patients() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [note, setNote] = useState('');
  const [search, setSearch] = useState({ firstName: '', lastName: '', dob: '', mrn: '' });
  const [matches, setMatches] = useState<any[] | null>(null);
  const patients = useQuery({ queryKey: ['patients'], queryFn: api.patients });
  const find = useMutation({
    mutationFn: () => api.searchPatients(search),
    onSuccess: (data) => setMatches(data.matches ?? []),
  });

  if (patients.isLoading) return <div className="ax-view"><LoadingState label="Loading patients…" /></div>;
  if (patients.error) return <div className="ax-view"><ErrorState error={patients.error} onRetry={() => void patients.refetch()} /></div>;

  const list = patients.data ?? [];
  const filtered = list.filter((patient: any) => {
    const qFirst = search.firstName.trim().toLowerCase();
    const qLast = search.lastName.trim().toLowerCase();
    const qMrn = search.mrn.trim().toLowerCase();
    if (qFirst && !String(patient.firstName ?? '').toLowerCase().includes(qFirst)) return false;
    if (qLast && !String(patient.lastName ?? '').toLowerCase().includes(qLast)) return false;
    if (search.dob && patient.dob !== search.dob) return false;
    if (qMrn && !String(patient.mrn ?? '').toLowerCase().includes(qMrn)) return false;
    return true;
  });

  return (
    <div className="ax-view">
      <SectionHeading
        eyebrow="Front desk"
        title="Patients"
        detail={`${list.length} registered · search first, then register from this desk`}
        action={
          <button className="ax-primary-button" type="button" onClick={() => setShowCreate(true)} data-testid="button-add-patient">
            Register patient
          </button>
        }
      />

      {note ? (
        <div className="ax-insight-strip" style={{ marginBottom: 16 }}>
          <UsersRound size={17} />
          <span>{note}</span>
        </div>
      ) : null}

      <section className="ax-panel" style={{ marginBottom: 16 }}>
        <div className="ax-panel-head">
          <div>
            <span className="ax-kicker">Directory filter</span>
            <h2>Find a patient</h2>
          </div>
        </div>
        <div className="ax-reg-fields">
          <label>
            First name
            <input value={search.firstName} onChange={(e) => setSearch((s) => ({ ...s, firstName: e.target.value }))} data-testid="input-patient-search-first" />
          </label>
          <label>
            Last name
            <input value={search.lastName} onChange={(e) => setSearch((s) => ({ ...s, lastName: e.target.value }))} data-testid="input-patient-search-last" />
          </label>
          <label>
            DOB
            <input type="date" value={search.dob} onChange={(e) => setSearch((s) => ({ ...s, dob: e.target.value }))} />
          </label>
          <label>
            MRN
            <input value={search.mrn} onChange={(e) => setSearch((s) => ({ ...s, mrn: e.target.value }))} />
          </label>
        </div>
        <div className="ax-row-actions" style={{ marginTop: 12 }}>
          <button className="ax-outline-button" type="button" onClick={() => find.mutate()} data-testid="button-patient-search">
            <Search size={14} /> Duplicate check
          </button>
        </div>
        {matches ? (
          <div className="ax-search-matches">
            {matches.length === 0 ? <p>No matches. Safe to register a new patient.</p> : null}
            {matches.map((patient: any) => (
              <button key={patient.id} type="button" className="ax-queue-row" onClick={() => setSelectedId(patient.id)}>
                <span>
                  <b>{patient.firstName} {patient.lastName}</b>
                  <small>{patient.dob} · {patient.mrn}</small>
                </span>
                <StatusPill tone="teal">Open</StatusPill>
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <div className="ax-queue-layout">
        <section className="ax-panel ax-queue-list">
          <div className="ax-panel-head">
            <div>
              <span className="ax-kicker">Registered patients</span>
              <h2>{filtered.length} records</h2>
            </div>
          </div>
          <div className="ax-table-head">
            <span>Patient</span>
            <span>MRN / market</span>
            <span>Balance</span>
            <span>Status</span>
          </div>
          {filtered.length === 0 ? (
            <div className="ax-empty" style={{ padding: 24 }}>
              <UsersRound size={22} />
              <b>No patients yet</b>
              <p>Register the first patient to open eligibility, coverage, and billing.</p>
              <button className="ax-primary-button" type="button" onClick={() => setShowCreate(true)}>
                Register patient
              </button>
            </div>
          ) : (
            filtered.map((patient: any) => (
              <button
                type="button"
                className={`ax-queue-row ${selectedId === patient.id ? 'selected' : ''}`}
                key={patient.id}
                onClick={() => setSelectedId(patient.id)}
                data-testid={`row-patient-${patient.id}`}
              >
                <span className="ax-queue-main">
                  <span className="ax-module-icon">
                    <UsersRound size={15} />
                  </span>
                  <span>
                    <b>
                      {patient.firstName} {patient.lastName}
                    </b>
                    <small>
                      {patient.sex || '—'} · DOB {patient.dob}
                      {patient.phone ? ` · ${patient.phone}` : ''}
                    </small>
                  </span>
                </span>
                <span className="ax-queue-context">
                  <b>{patient.mrn}</b>
                  <small>{patient.country}</small>
                </span>
                <span className="ax-queue-amount">{money(patient.balance ?? 0)}</span>
                <StatusPill tone={patient.registrationStatus === 'DRAFT' ? 'amber' : 'teal'}>
                  {patient.registrationStatus === 'DRAFT' ? 'Draft' : patient.source === 'MANUAL' ? 'Manual' : 'Active'}
                </StatusPill>
              </button>
            ))
          )}
        </section>
        <aside className="ax-panel ax-inspection">
          {!selectedId ? (
            <div className="ax-empty">
              <PanelLeftOpen size={22} />
              <b>Select a patient</b>
              <p>Open identity, demographics, coverage/COB, claims, and activity.</p>
            </div>
          ) : (
            <PatientWorkspace patientId={selectedId} onClose={() => setSelectedId('')} />
          )}
        </aside>
      </div>

      {showCreate ? (
        <div className="ax-modal-backdrop" role="presentation" onClick={() => setShowCreate(false)}>
          <div
            className="ax-modal ax-register-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Register patient"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ax-modal-head">
              <div>
                <span className="ax-kicker">Registration</span>
                <h2>Register patient</h2>
              </div>
              <button className="ax-ghost-button" type="button" onClick={() => setShowCreate(false)} aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <AddPatientFlow
              onCancel={() => setShowCreate(false)}
              onCreated={(patientId, message) => {
                setNote(message);
                setShowCreate(false);
                setSelectedId(patientId);
                void queryClient.invalidateQueries({ queryKey: ['patients'] });
                void queryClient.invalidateQueries({ queryKey: ['coverages'] });
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
