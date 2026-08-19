import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  AlertCircle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BadgeDollarSign,
  BarChart3,
  Bell,
  Bot,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  ClipboardList,
  ClipboardPlus,
  Clock3,
  CalendarDays,
  Command,
  FileCheck2,
  FileText,
  Filter,
  Gavel,
  Globe2,
  Handshake,
  Hospital,
  KeyRound,
  LayoutDashboard,
  ListFilter,
  LockKeyhole,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  RefreshCw,
  Search,
  Settings,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Stethoscope,
  Sun,
  UserRoundCheck,
  UsersRound,
  X,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api, asPercent, money } from '@/lib/api';
import { useAuth, isAdminRole } from '@/lib/auth';
import { toast } from '@/hooks/use-toast';
import type { WorkspaceView } from '../../workspace-types';
import { formatLabel, parseAiInsight, priorityTone, resolveJobInsight, statusTone } from '../../shared/format';
import { ErrorState, InsightCard, JobResultPanel, LoadingState, Metric, SectionHeading, StatusPill } from '../../shared/ui';
import { useTenantScope } from '../../shared/use-tenant-scope';
import './Charges.css';

export function Charges() {
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const [showCapture, setShowCapture] = useState(false);
  const [encForm, setEncForm] = useState({ patientId: '', providerId: '', facilityId: '', serviceFrom: new Date().toISOString().slice(0, 10) });
  const [chgForm, setChgForm] = useState({
    encounterId: '',
    code: '99213',
    codeSystem: 'CPT',
    description: 'Office visit',
    units: '1',
    amount: '175',
  });
  const charges = useQuery({ queryKey: ['charges'], queryFn: api.charges });
  const encounters = useQuery({ queryKey: ['encounters'], queryFn: api.encounters });
  const patients = useQuery({ queryKey: ['patients'], queryFn: api.patients });
  const providers = useQuery({ queryKey: ['providers'], queryFn: api.providers });
  const facilities = useQuery({ queryKey: ['facilities'], queryFn: api.facilities });
  const fees = useQuery({ queryKey: ['fee-schedules'], queryFn: api.feeSchedules });

  const createEncounter = useMutation({
    mutationFn: () => api.createEncounter(encForm),
    onSuccess: (data) => {
      if (data?.error) {
        setNote(String(data.error));
        return;
      }
      setNote(`Encounter created ${data.encounter?.id}`);
      setChgForm((f) => ({ ...f, encounterId: data.encounter?.id ?? f.encounterId }));
      void queryClient.invalidateQueries({ queryKey: ['encounters'] });
      void queryClient.invalidateQueries({ queryKey: ['work-items'] });
    },
    onError: (e: Error) => setNote(e.message),
  });

  const createCharge = useMutation({
    mutationFn: () =>
      api.createCharge({
        encounterId: chgForm.encounterId,
        code: chgForm.code,
        codeSystem: chgForm.codeSystem,
        description: chgForm.description,
        units: Number(chgForm.units) || 1,
        amount: Number(chgForm.amount) || 0,
      }),
    onSuccess: (data) => {
      if (data?.error) {
        setNote(String(data.error));
        return;
      }
      setNote(`Charge captured ${data.charge?.code} · ${money(data.charge?.amount ?? 0)}`);
      void queryClient.invalidateQueries({ queryKey: ['charges'] });
    },
    onError: (e: Error) => setNote(e.message),
  });

  const bill = useMutation({
    mutationFn: (id: string) => api.billCharge(id),
    onSuccess: (data, id) => {
      setNote(
        data?.claim
          ? `Assembled ${id} → claim ${data.claim.claimNumber ?? data.claim.id} v${data.version?.versionNumber ?? data.claim.currentVersionNumber ?? 1}`
          : data?.error
            ? String(data.error)
            : `Billed ${id}`,
      );
      void queryClient.invalidateQueries({ queryKey: ['charges'] });
      void queryClient.invalidateQueries({ queryKey: ['claims'] });
      void queryClient.invalidateQueries({ queryKey: ['encounters'] });
      void queryClient.invalidateQueries({ queryKey: ['audit'] });
    },
    onError: (error) => setNote((error as Error).message),
  });

  const reconcile = useMutation({
    mutationFn: (id: string) => api.reconcileEncounter(id),
    onSuccess: (data) => {
      if (data?.error) return setNote(String(data.error));
      setNote(
        data.issues?.length
          ? `Reconcile ${data.encounter?.id}: ${data.issues.join('; ')}`
          : `Encounter ${data.encounter?.id} is ${data.encounter?.status}`,
      );
      void queryClient.invalidateQueries({ queryKey: ['encounters'] });
      void queryClient.invalidateQueries({ queryKey: ['work-items'] });
    },
  });

  const assemble = useMutation({
    mutationFn: (id: string) => api.assembleClaim(id),
    onSuccess: (data) => {
      if (data?.error) return setNote(String(data.error));
      setNote(
        `Claim ${data.claim?.claimNumber ?? data.claim?.id} frozen as v${data.version?.versionNumber ?? data.claim?.currentVersionNumber}`,
      );
      void queryClient.invalidateQueries({ queryKey: ['charges'] });
      void queryClient.invalidateQueries({ queryKey: ['claims'] });
      void queryClient.invalidateQueries({ queryKey: ['encounters'] });
    },
  });

  if (charges.isLoading) return <div className="ax-view"><LoadingState label="Loading charges…" /></div>;
  if (charges.error) return <div className="ax-view"><ErrorState error={charges.error} onRetry={() => void charges.refetch()} /></div>;

  const list = charges.data ?? [];
  const unbilled = list.filter((c: any) => c.status === 'UNBILLED' || c.status === 'CAPTURED');
  const unbilledTotal = unbilled.reduce((sum: number, c: any) => sum + (c.amount?.amount ?? 0), 0);

  return (
    <div className="ax-view">
      <SectionHeading
        eyebrow="Charge capture"
        title="Charges"
        detail={`${unbilled.length} unbilled · ${money(unbilledTotal)} waiting for claim creation.`}
      />
      {note ? (
        <div className="ax-insight-strip">
          <Receipt size={17} />
          <span>{note}</span>
        </div>
      ) : null}
      <section className="ax-panel" style={{ marginBottom: 14 }}>
        <div className="ax-panel-head">
          <div>
            <span className="ax-kicker">Manual capture</span>
            <h2>Encounter + charge</h2>
          </div>
          <button className="ax-outline-button" type="button" onClick={() => setShowCapture((v) => !v)}>
            {showCapture ? 'Hide form' : 'Capture charge'}
          </button>
        </div>
        {showCapture ? (
          <div className="ax-capture-form">
            <div className="ax-reg-grid">
              <div className="ax-reg-column">
                <h3 className="ax-reg-section-title">1. Encounter</h3>
                <p className="ax-muted">Open or create the visit first. An encounter is not a claim.</p>
                <div className="ax-reg-fields">
                  <label className="ax-reg-span-2">
                    Patient
                    <select value={encForm.patientId} onChange={(e) => setEncForm((f) => ({ ...f, patientId: e.target.value }))}>
                      <option value="">Select patient</option>
                      {(patients.data ?? []).map((p: any) => (
                        <option key={p.id} value={p.id}>
                          {p.lastName}, {p.firstName} ({p.mrn})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Provider
                    <select value={encForm.providerId} onChange={(e) => setEncForm((f) => ({ ...f, providerId: e.target.value }))}>
                      <option value="">Default</option>
                      {(providers.data ?? []).map((p: any) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Facility
                    <select value={encForm.facilityId} onChange={(e) => setEncForm((f) => ({ ...f, facilityId: e.target.value }))}>
                      <option value="">Default</option>
                      {(facilities.data ?? []).map((f: any) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="ax-reg-span-2">
                    Service date
                    <input type="date" value={encForm.serviceFrom} onChange={(e) => setEncForm((f) => ({ ...f, serviceFrom: e.target.value }))} />
                  </label>
                </div>
                <div className="ax-reg-actions">
                  <button className="ax-ghost-button" type="button" onClick={() => setShowCapture(false)}>
                    Cancel
                  </button>
                  <button
                    className="ax-outline-button"
                    type="button"
                    disabled={createEncounter.isPending || !encForm.patientId}
                    onClick={() => createEncounter.mutate()}
                  >
                    {createEncounter.isPending ? 'Creating…' : 'Create encounter'}
                  </button>
                </div>
              </div>

              <div className="ax-reg-column">
                <h3 className="ax-reg-section-title">2. Charge</h3>
                <p className="ax-muted">Attach a code and amount to that encounter.</p>
                <div className="ax-reg-fields">
                  <label className="ax-reg-span-2">
                    Encounter
                    <select value={chgForm.encounterId} onChange={(e) => setChgForm((f) => ({ ...f, encounterId: e.target.value }))}>
                      <option value="">Select encounter</option>
                      {(encounters.data ?? []).map((e: any) => (
                        <option key={e.id} value={e.id}>
                          {e.patientName || e.patientId} · {e.serviceFrom} · {formatLabel(e.status)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Code
                    <input
                      value={chgForm.code}
                      onChange={(e) => {
                        const code = e.target.value;
                        const fee = (fees.data ?? []).find((row: any) => String(row.code).toUpperCase() === code.trim().toUpperCase());
                        setChgForm((f) => ({
                          ...f,
                          code,
                          description: fee?.description ?? f.description,
                          amount: fee?.standardCharge?.amount != null ? String(fee.standardCharge.amount) : f.amount,
                        }));
                      }}
                    />
                  </label>
                  <label>
                    Code system
                    <select value={chgForm.codeSystem} onChange={(e) => setChgForm((f) => ({ ...f, codeSystem: e.target.value }))}>
                      <option value="CPT">CPT</option>
                      <option value="HCPCS">HCPCS</option>
                      <option value="ICD">ICD</option>
                    </select>
                  </label>
                  <label className="ax-reg-span-2">
                    Description
                    <input value={chgForm.description} onChange={(e) => setChgForm((f) => ({ ...f, description: e.target.value }))} />
                  </label>
                  <label>
                    Amount
                    <input value={chgForm.amount} onChange={(e) => setChgForm((f) => ({ ...f, amount: e.target.value }))} />
                  </label>
                  <label>
                    Units
                    <input value={chgForm.units} onChange={(e) => setChgForm((f) => ({ ...f, units: e.target.value }))} />
                  </label>
                </div>
                <div className="ax-reg-actions">
                  <button
                    className="ax-primary-button"
                    type="button"
                    disabled={createCharge.isPending || !chgForm.encounterId || !chgForm.code}
                    onClick={() => createCharge.mutate()}
                    data-testid="button-create-charge"
                  >
                    {createCharge.isPending ? 'Saving…' : 'Save charge'}
                  </button>
                </div>
              </div>
            </div>

            <div className="ax-capture-followup">
              <div>
                <span className="ax-kicker">After charges exist</span>
                <p className="ax-muted">Optional. Reconcile the visit, pull fee-schedule lines, or assemble a draft claim.</p>
              </div>
              <div className="ax-reg-actions">
                <button
                  className="ax-ghost-button"
                  type="button"
                  disabled={!chgForm.encounterId || reconcile.isPending}
                  onClick={() => reconcile.mutate(chgForm.encounterId)}
                >
                  Reconcile
                </button>
                <button
                  className="ax-outline-button"
                  type="button"
                  disabled={!chgForm.encounterId}
                  onClick={() =>
                    api.captureCharges(chgForm.encounterId).then((data) => {
                      setNote(
                        data?.error
                          ? String(data.error)
                          : `Fee-schedule capture · ${(data.created ?? []).length} new charge(s)`,
                      );
                      void queryClient.invalidateQueries({ queryKey: ['charges'] });
                      void queryClient.invalidateQueries({ queryKey: ['encounters'] });
                    })
                  }
                >
                  Fee schedule
                </button>
                <button
                  className="ax-primary-button"
                  type="button"
                  disabled={!chgForm.encounterId || assemble.isPending}
                  onClick={() => assemble.mutate(chgForm.encounterId)}
                  data-testid="button-assemble-claim"
                >
                  {assemble.isPending ? 'Assembling…' : 'Assemble claim'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </section>
      <section className="ax-panel ax-table-panel">
        <div className="ax-panel-head">
          <div>
            <span className="ax-kicker">Charge inventory</span>
            <h2>{list.length} charges</h2>
          </div>
        </div>
        <div className="ax-claims-table">
          <div className="ax-table-head">
            <span>Charge</span>
            <span>Encounter / code</span>
            <span>Amount</span>
            <span>Status</span>
            <span>Action</span>
          </div>
          {list.map((charge: any) => (
            <div className="ax-claim-row" key={charge.id} data-testid={`row-charge-${charge.id}`}>
              <span>
                <b>{charge.description}</b>
                <small>{charge.id}</small>
              </span>
              <span>
                <b>{charge.encounterId}</b>
                <small>
                  {charge.codeSystem} {charge.code} · {charge.units}u
                </small>
              </span>
              <strong>{money(charge.amount ?? 0)}</strong>
              <StatusPill tone={statusTone(charge.status)}>{formatLabel(charge.status)}</StatusPill>
              <span>
                {charge.status !== 'BILLED' ? (
                  <button
                    className="ax-primary-button"
                    type="button"
                    disabled={bill.isPending}
                    onClick={() => bill.mutate(charge.id)}
                    data-testid={`button-bill-${charge.id}`}
                  >
                    Bill
                  </button>
                ) : (
                  <span className="ax-mono">Posted</span>
                )}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

