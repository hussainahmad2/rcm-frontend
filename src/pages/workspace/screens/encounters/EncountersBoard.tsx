import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stethoscope } from 'lucide-react';
import { api, money } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import './Encounters.css';

function formatLabel(value?: string) {
  if (!value) return '—';
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function StatusPill({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) {
  return (
    <span className={`ax-pill ${tone}`}>
      <span className="ax-pill-dot" />
      {children}
    </span>
  );
}

export function EncountersBoard() {
  const { tenant } = useAuth();
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const encounters = useQuery({
    queryKey: ['clinical-encounters', tenant?.id],
    queryFn: api.clinicalEncounters,
  });
  const complete = useMutation({
    mutationFn: (id: string) => api.completeDocumentation(id),
    onSuccess: (data) => {
      if (data?.error) {
        setNote(String(data.error));
        return;
      }
      setNote(`Encounter ready for coding · clinical ${data.encounter?.clinicalStatus} · billing ${data.encounter?.billingStatus}`);
      void queryClient.invalidateQueries({ queryKey: ['clinical-encounters'] });
      void queryClient.invalidateQueries({ queryKey: ['encounters'] });
      void queryClient.invalidateQueries({ queryKey: ['today-board'] });
      void queryClient.invalidateQueries({ queryKey: ['work-items'] });
    },
  });

  const list = encounters.data ?? [];
  const selected = list.find((row: any) => row.id === selectedId) ?? list[0];

  return (
    <div className="ax-view">
      <div className="ax-section-heading">
        <div>
          <span className="ax-kicker">Clinical layer · optional native EHR later</span>
          <h1>Encounters</h1>
          <p>
            An appointment is planned care. An encounter is care that happened. Claims are created only after coding and charges.
          </p>
        </div>
      </div>
      {note ? (
        <div className="ax-insight-strip">
          <Stethoscope size={17} />
          <span>{note}</span>
        </div>
      ) : null}
      <div className="ax-queue-layout">
        <section className="ax-panel ax-queue-list">
          <div className="ax-panel-head">
            <div>
              <span className="ax-kicker">Visit log</span>
              <h2>{list.length} encounters</h2>
            </div>
          </div>
          {list.map((row: any) => (
            <button
              type="button"
              key={row.id}
              className={`ax-queue-row ${selected?.id === row.id ? 'selected' : ''}`}
              onClick={() => setSelectedId(row.id)}
              data-testid={`row-encounter-${row.id}`}
            >
              <span className="ax-queue-main">
                <span>
                  <b>{row.patientName}</b>
                  <small>{row.displayId || row.id} · {row.serviceFrom}</small>
                </span>
              </span>
              <StatusPill tone={row.billingStatus === 'CODING_REQUIRED' ? 'amber' : row.clinicalStatus === 'COMPLETED' ? 'teal' : 'blue'}>
                {formatLabel(row.billingStatus || row.status)}
              </StatusPill>
            </button>
          ))}
        </section>
        <section className="ax-panel">
          {selected ? (
            <>
              <div className="ax-panel-head">
                <div>
                  <span className="ax-kicker">{selected.displayId || selected.id}</span>
                  <h2>{selected.patientName}</h2>
                </div>
              </div>
              <dl className="ax-detail-list">
                <div>
                  <dt>MRN</dt>
                  <dd>{selected.mrn}</dd>
                </div>
                <div>
                  <dt>Provider</dt>
                  <dd>{selected.providerName}</dd>
                </div>
                <div>
                  <dt>Appointment</dt>
                  <dd>{selected.appointmentDisplayId || 'Walk-in / imported'}</dd>
                </div>
                <div>
                  <dt>Clinical source</dt>
                  <dd>{formatLabel(selected.clinicalSource || 'MANUAL')}</dd>
                </div>
                <div>
                  <dt>Clinical status</dt>
                  <dd>{formatLabel(selected.clinicalStatus || selected.status)}</dd>
                </div>
                <div>
                  <dt>Billing status</dt>
                  <dd>{formatLabel(selected.billingStatus || 'NOT_READY')}</dd>
                </div>
                <div>
                  <dt>Chief complaint</dt>
                  <dd>{selected.chiefComplaint || '—'}</dd>
                </div>
                <div>
                  <dt>Charges</dt>
                  <dd>
                    {selected.chargeCount ?? 0} · {money({ amount: selected.chargeTotal ?? 0, currency: selected.currency })}
                  </dd>
                </div>
              </dl>
              <p className="ax-muted">
                Do not submit a claim from check-in. Complete documentation, then coding, then charge capture, then claim generation.
              </p>
              {(selected.clinicalStatus === 'IN_PROGRESS' || selected.clinicalStatus === 'DOCUMENTATION_PENDING' || selected.status === 'OPEN' || selected.status === 'IN_PROGRESS') &&
              selected.billingStatus !== 'CLAIM_CREATED' ? (
                <button
                  className="ax-primary-button"
                  type="button"
                  disabled={complete.isPending}
                  onClick={() => complete.mutate(selected.id)}
                  data-testid="button-complete-documentation"
                >
                  Mark documentation complete
                </button>
              ) : null}
            </>
          ) : (
            <div className="ax-empty">
              <Stethoscope size={22} />
              <b>No encounters yet</b>
              <p>Check a patient in from Today's appointments to create one.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
