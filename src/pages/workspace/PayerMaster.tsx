import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2 } from 'lucide-react';
import { api } from '@/lib/api';
import { AddPayerFlow } from './AddPayerFlow';

export function PayerMaster({
  SectionHeading,
  StatusPill,
}: {
  SectionHeading: (props: { eyebrow: string; title: string; detail?: string }) => ReactNode;
  StatusPill: (props: { children: ReactNode; tone?: 'neutral' | 'teal' | 'coral' | 'amber' | 'blue' }) => ReactNode;
}) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [planForm, setPlanForm] = useState({ planName: '', planCode: '', authCodes: '70553' });
  const payers = useQuery({ queryKey: ['payers'], queryFn: api.payers });
  const detail = useQuery({
    queryKey: ['payer', selectedId],
    queryFn: () => api.payer(selectedId),
    enabled: Boolean(selectedId),
  });

  const activate = useMutation({
    mutationFn: (id: string) => api.activatePayer(id),
    onSuccess: (data) => {
      if (data?.error) return setNote(String(data.error));
      setNote(`Payer ${data.payer?.name} is ${data.payer?.status}`);
      void queryClient.invalidateQueries({ queryKey: ['payers'] });
      void queryClient.invalidateQueries({ queryKey: ['payer', selectedId] });
    },
  });
  const addPlan = useMutation({
    mutationFn: () =>
      api.createPayerPlan(selectedId, {
        planName: planForm.planName,
        planCode: planForm.planCode || undefined,
        authProcedureCodes: planForm.authCodes
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      }),
    onSuccess: (data) => {
      if (data?.error) return setNote(String(data.error));
      setNote(`Plan draft ${data.plan?.planName}`);
      setPlanForm({ planName: '', planCode: '', authCodes: '70553' });
      setShowPlanForm(false);
      void queryClient.invalidateQueries({ queryKey: ['payer', selectedId] });
    },
  });
  const publish = useMutation({
    mutationFn: (planId: string) => api.publishPayerPlan(planId),
    onSuccess: (data) => {
      if (data?.error) return setNote(String(data.error));
      setNote(`Published ${data.plan?.planName}`);
      void queryClient.invalidateQueries({ queryKey: ['payer', selectedId] });
    },
  });

  const list = payers.data ?? [];
  const selected = detail.data?.error ? null : detail.data;

  return (
    <div className="ax-view">
      <SectionHeading
        eyebrow="Master data"
        title="Payers & plans"
        detail="Draft → Active lifecycle. Plans publish independently. Routing identifiers are financial controls."
      />
      {note ? (
        <div className="ax-insight-strip">
          <Building2 size={17} />
          <span>{note}</span>
        </div>
      ) : null}
      {showCreate ? (
        <AddPayerFlow
          onCancel={() => setShowCreate(false)}
          onCreated={(payerId, message) => {
            setNote(message);
            setShowCreate(false);
            setSelectedId(payerId);
            void queryClient.invalidateQueries({ queryKey: ['payers'] });
          }}
        />
      ) : (
        <div className="ax-queue-layout">
          <section className="ax-panel ax-queue-list">
            <div className="ax-panel-head">
              <div>
                <span className="ax-kicker">Directory</span>
                <h2>{list.length} payers</h2>
              </div>
              <button className="ax-primary-button" type="button" onClick={() => setShowCreate(true)} data-testid="button-add-payer">
                Add payer
              </button>
            </div>
            {list.map((payer: { id: string; name: string; country: string; status?: string; claimStandard: string }) => (
              <button
                type="button"
                className={`ax-queue-row ${selectedId === payer.id ? 'selected' : ''}`}
                key={payer.id}
                onClick={() => setSelectedId(payer.id)}
                data-testid={`row-payer-${payer.id}`}
              >
                <span className="ax-queue-main">
                  <span>
                    <b>{payer.name}</b>
                    <small>{payer.claimStandard}</small>
                  </span>
                </span>
                <span className="ax-queue-context">
                  <b>{payer.country}</b>
                  <small>{payer.status ?? 'ACTIVE'}</small>
                </span>
              </button>
            ))}
          </section>
          <aside className="ax-panel ax-inspection">
            {!selected ? (
              <div className="ax-empty">
                <b>Select a payer</b>
                <p>Plans, identifiers, and capability badges live here — not as a flat name list.</p>
              </div>
            ) : (
              <>
                <div className="ax-inspection-title">
                  <div>
                    <h2>{selected.name}</h2>
                    <small>
                      {selected.payerType} · {selected.claimStandard} · {selected.status}
                    </small>
                  </div>
                </div>
                <div className="ax-tabs">
                  <StatusPill tone="teal">{selected.capabilities?.eligibility ? 'Eligibility' : 'No elig.'}</StatusPill>
                  <StatusPill tone="blue">{selected.capabilities?.claim ? 'Claim' : 'No claim'}</StatusPill>
                  <StatusPill tone="amber">{selected.capabilities?.authorization ? 'Auth' : 'No auth'}</StatusPill>
                  <StatusPill tone={selected.capabilities?.remittance ? 'teal' : 'neutral'}>
                    {selected.capabilities?.remittance ? 'Remit' : 'No remit'}
                  </StatusPill>
                </div>
                {selected.status !== 'ACTIVE' ? (
                  <button className="ax-primary-button" type="button" onClick={() => activate.mutate(selected.id)}>
                    Activate payer
                  </button>
                ) : null}
                <div className="ax-reason">
                  <span className="ax-kicker">Plans</span>
                  {(selected.plans ?? []).map(
                    (plan: { id: string; planName: string; status: string; planCode: string; authProcedureCodes?: string[] }) => (
                      <div key={plan.id} className="ax-opportunity" style={{ marginTop: 8 }}>
                        <span className="ax-rank">{plan.status[0]}</span>
                        <span>
                          <b>{plan.planName}</b>
                          <small>
                            {plan.planCode} · auth {plan.authProcedureCodes?.join(', ') || 'none'}
                          </small>
                        </span>
                        {plan.status !== 'PUBLISHED' ? (
                          <button className="ax-outline-button" type="button" onClick={() => publish.mutate(plan.id)}>
                            Publish
                          </button>
                        ) : null}
                      </div>
                    ),
                  )}
                  {showPlanForm ? (
                    <div className="ax-setting-fields" style={{ marginTop: 10 }}>
                      <label>
                        New plan name
                        <input value={planForm.planName} onChange={(e) => setPlanForm((p) => ({ ...p, planName: e.target.value }))} />
                      </label>
                      <label>
                        Auth procedure codes
                        <input value={planForm.authCodes} onChange={(e) => setPlanForm((p) => ({ ...p, authCodes: e.target.value }))} />
                      </label>
                      <div className="ax-reg-actions">
                        <button className="ax-ghost-button" type="button" onClick={() => setShowPlanForm(false)}>
                          Cancel
                        </button>
                        <button
                          className="ax-primary-button"
                          type="button"
                          disabled={!planForm.planName || addPlan.isPending}
                          onClick={() => addPlan.mutate()}
                        >
                          Save plan draft
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button className="ax-primary-button" type="button" style={{ marginTop: 10 }} onClick={() => setShowPlanForm(true)}>
                      Add plan
                    </button>
                  )}
                </div>
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
