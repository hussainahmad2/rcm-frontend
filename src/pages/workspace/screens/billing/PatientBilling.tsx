import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleDollarSign, Receipt } from 'lucide-react';
import { api, money } from '@/lib/api';
import { ErrorState, LoadingState, Metric, SectionHeading } from '../../shared/ui';

export function PatientBilling() {
  const queryClient = useQueryClient();
  const queue = useQuery({ queryKey: ['patient-billing'], queryFn: api.patientBilling });
  const [selectedId, setSelectedId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const statement = useQuery({
    queryKey: ['patient-statement', selectedId],
    queryFn: () => api.patientStatement(selectedId),
    enabled: Boolean(selectedId),
  });

  const pay = useMutation({
    mutationFn: () => api.recordPatientPayment(selectedId, Number(amount)),
    onSuccess: (data) => {
      if (data?.error) return setNote(String(data.error));
      setNote(`Posted ${money(Number(amount))} to the patient ledger`);
      setAmount('');
      void queryClient.invalidateQueries({ queryKey: ['patient-billing'] });
      void queryClient.invalidateQueries({ queryKey: ['patient-statement', selectedId] });
    },
    onError: (error: Error) => setNote(error.message),
  });

  if (queue.isLoading) return <div className="ax-view"><LoadingState label="Loading patient billing…" /></div>;
  if (queue.error) return <div className="ax-view"><ErrorState error={queue.error} onRetry={() => void queue.refetch()} /></div>;

  const rows = queue.data ?? [];
  const totalPr = rows.reduce((sum: number, row: any) => sum + (row.patientResponsibility ?? 0), 0);

  return (
    <div className="ax-view">
      <SectionHeading
        eyebrow="Patient financials"
        title="Patient billing"
        detail="Staff-facing statement and payment posting. There is no patient portal, payment plan, or collections letter in this build."
      />
      {note ? (
        <div className="ax-insight-strip">
          <CircleDollarSign size={17} />
          <span>{note}</span>
        </div>
      ) : null}
      <div className="ax-metrics">
        <Metric label="Balances" value={String(rows.length)} icon={Receipt} />
        <Metric label="Patient share" value={money(totalPr)} icon={CircleDollarSign} tone="coral" />
      </div>
      <div className="ax-queue-layout">
        <section className="ax-panel ax-table-panel">
          <div className="ax-panel-head">
            <div>
              <span className="ax-kicker">Statement queue</span>
              <h2>{rows.length} patients with a balance</h2>
            </div>
          </div>
          {rows.length === 0 ? (
            <div className="ax-empty">
              <Receipt size={22} />
              <b>No patient balances</b>
              <p>PR appears after an ERA posts a patient responsibility, or after you ingest a demo remittance.</p>
            </div>
          ) : (
            <div className="ax-claims-table">
              <div className="ax-table-head">
                <span>Patient</span>
                <span>PR</span>
                <span>Insurance AR</span>
                <span>Balance</span>
              </div>
              {rows.map((row: any) => (
                <div
                  className={`ax-claim-row ${selectedId === row.patientId ? 'selected' : ''}`}
                  key={row.patientId}
                  role="button"
                  tabIndex={0}
                  data-testid={`row-billing-${row.patientId}`}
                  onClick={() => setSelectedId(row.patientId)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') setSelectedId(row.patientId);
                  }}
                >
                  <span>
                    <b>{row.name}</b>
                    <small>{row.mrn}</small>
                  </span>
                  <strong>{money(row.patientResponsibility ?? 0)}</strong>
                  <span>{money(row.insuranceAr ?? 0)}</span>
                  <span>{money(row.balance ?? 0)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
        <aside className="ax-panel ax-inspection">
          {!selectedId ? (
            <div className="ax-empty">
              <Receipt size={22} />
              <b>Select a patient</b>
              <p>Open a row to see the statement and post a patient payment to the ledger.</p>
            </div>
          ) : statement.isLoading ? (
            <LoadingState label="Loading statement…" />
          ) : statement.error ? (
            <ErrorState error={statement.error} onRetry={() => void statement.refetch()} />
          ) : (
            <>
              <div className="ax-inspection-top">
                <span className="ax-kicker">Statement</span>
              </div>
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
                  <input value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Amount" />
                </label>
                <button
                  className="ax-primary-button"
                  type="button"
                  disabled={pay.isPending || !Number(amount)}
                  onClick={() => pay.mutate()}
                >
                  Post payment
                </button>
              </div>
              <p className="ax-muted">Payments post as signed PATIENT_PAYMENT ledger entries. Balances are never edited in place.</p>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
