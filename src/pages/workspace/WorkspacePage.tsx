import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
  Clock3,
  Command,
  FileCheck2,
  FileText,
  Filter,
  Gavel,
  Globe2,
  Handshake,
  Hospital,
  LayoutDashboard,
  ListFilter,
  LockKeyhole,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  RefreshCw,
  Search,
  Settings2,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Stethoscope,
  UserRoundCheck,
  UsersRound,
  X,
} from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { api, asPercent, money } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { WorkspaceView } from './workspace-types';
import './WorkspacePage.css';

const navItems: { id: WorkspaceView; label: string; icon: LucideIcon }[] = [
  { id: 'overview', label: 'Command center', icon: LayoutDashboard },
  { id: 'queue', label: 'Work queue', icon: ListFilter },
  { id: 'patients', label: 'Patients', icon: UsersRound },
  { id: 'providers', label: 'Providers', icon: Hospital },
  { id: 'payers', label: 'Payers', icon: Building2 },
  { id: 'eligibility', label: 'Eligibility', icon: UserRoundCheck },
  { id: 'authorizations', label: 'Authorizations', icon: ClipboardCheck },
  { id: 'coding', label: 'Coding', icon: Stethoscope },
  { id: 'charges', label: 'Charges', icon: Receipt },
  { id: 'claims', label: 'Claims', icon: FileCheck2 },
  { id: 'denials', label: 'Denials & appeals', icon: ShieldAlert },
  { id: 'ar', label: 'A/R queue', icon: BarChart3 },
  { id: 'payments', label: 'Payments', icon: BadgeDollarSign },
  { id: 'contracts', label: 'Contracts', icon: Handshake },
  { id: 'leakage', label: 'Revenue leakage', icon: CircleDollarSign },
  { id: 'ai', label: 'AI workforce', icon: Bot },
  { id: 'packs', label: 'Country packs', icon: Globe2 },
  { id: 'rules', label: 'Rules', icon: Gavel },
  { id: 'settings', label: 'Operations', icon: Settings2 },
];

function formatLabel(value?: string) {
  if (!value) return '—';
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function priorityTone(priority?: string): 'coral' | 'amber' | 'neutral' | 'teal' {
  const p = (priority ?? '').toUpperCase();
  if (p === 'HIGH') return 'coral';
  if (p === 'MEDIUM') return 'amber';
  if (p === 'LOW') return 'teal';
  return 'neutral';
}

function statusTone(status?: string): 'coral' | 'amber' | 'neutral' | 'teal' | 'blue' {
  const s = (status ?? '').toUpperCase();
  if (s.includes('OPEN') || s.includes('EXCEPTION') || s.includes('DENIED') || s.includes('FAIL')) return 'coral';
  if (s.includes('BLOCK') || s.includes('WARN') || s.includes('PENDING') || s.includes('WORKING')) return 'amber';
  if (s.includes('READY') || s.includes('ACTIVE') || s.includes('APPROVED') || s.includes('RESOLVED') || s.includes('PAID')) return 'teal';
  if (s.includes('SUBMIT') || s.includes('PROGRESS')) return 'blue';
  return 'neutral';
}

function BrandLockup() {
  return (
    <span className="ax-brand">
      <span className="ax-brand-mark">
        <Command size={16} />
      </span>
      <span>
        Velora <b>Revenue OS</b>
      </span>
    </span>
  );
}

function StatusPill({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'teal' | 'coral' | 'amber' | 'blue';
}) {
  return (
    <span className={`ax-pill ${tone}`}>
      <span className="ax-pill-dot" />
      {children}
    </span>
  );
}

function Metric({
  label,
  value,
  delta,
  icon: Icon,
  tone = 'teal',
}: {
  label: string;
  value: string;
  delta?: string;
  icon: LucideIcon;
  tone?: string;
}) {
  return (
    <article className="ax-metric" data-testid={`metric-${label.toLowerCase().replace(/\s/g, '-')}`}>
      <div className="ax-metric-top">
        <span>{label}</span>
        <span className={`ax-metric-icon ${tone}`}>
          <Icon size={15} />
        </span>
      </div>
      <strong>{value}</strong>
      {delta ? <small className={delta.startsWith('↓') ? 'positive' : 'warning'}>{delta}</small> : null}
    </article>
  );
}

function SectionHeading({
  eyebrow,
  title,
  detail,
  action,
}: {
  eyebrow: string;
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className="ax-section-heading">
      <div>
        <span className="ax-kicker">{eyebrow}</span>
        <h1>{title}</h1>
        {detail ? <p>{detail}</p> : null}
      </div>
      {action}
    </div>
  );
}

function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="ax-empty">
      <RefreshCw size={22} className="ax-spin" />
      <b>{label}</b>
      <p>Fetching live Velora data.</p>
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : 'Something went wrong';
  return (
    <div className="ax-empty">
      <AlertCircle size={22} />
      <b>Unable to load</b>
      <p>{message}</p>
      {onRetry ? (
        <button className="ax-text-button" type="button" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}

function Overview({ onNavigate }: { onNavigate: (view: WorkspaceView) => void }) {
  const command = useQuery({ queryKey: ['command-center'], queryFn: api.commandCenter });
  const recommendations = useQuery({ queryKey: ['recommendations'], queryFn: api.recommendations });
  const revenueMap = useQuery({ queryKey: ['revenue-map'], queryFn: api.revenueMap });
  const sla = useQuery({ queryKey: ['sla'], queryFn: api.sla });

  const loading = command.isLoading || recommendations.isLoading || revenueMap.isLoading || sla.isLoading;
  const error = command.error || recommendations.error || revenueMap.error || sla.error;
  const refetchAll = () => {
    void command.refetch();
    void recommendations.refetch();
    void revenueMap.refetch();
    void sla.refetch();
  };

  if (loading) return <div className="ax-view"><LoadingState label="Loading command center…" /></div>;
  if (error) return <div className="ax-view"><ErrorState error={error} onRetry={refetchAll} /></div>;

  const metrics = command.data?.metrics ?? {};
  const map = revenueMap.data ?? metrics.revenueMap ?? {};
  const actions = recommendations.data?.todaysActions ?? metrics.todaysActions ?? [];
  const signal = recommendations.data?.summary?.[0] ?? 'Review prioritized revenue signals.';

  return (
    <div className="ax-view">
      <SectionHeading
        eyebrow="Network pulse"
        title="Command center"
        detail="A single operating picture for the revenue cycle. Prioritized by cash impact and operator attention."
        action={
          <button className="ax-outline-button" type="button" onClick={refetchAll} data-testid="button-refresh-overview">
            <RefreshCw size={14} /> Refresh signals
          </button>
        }
      />
      <div className="ax-metrics">
        <Metric label="Total AR" value={money(metrics.totalAr ?? 0)} icon={CircleDollarSign} />
        <Metric label="Expected collection" value={money(metrics.expectedCollection ?? 0)} icon={ArrowUpRight} tone="coral" />
        <Metric label="At-risk revenue" value={money(metrics.atRisk ?? 0)} icon={ShieldAlert} tone="amber" />
        <Metric label="Potential underpayment" value={money(metrics.potentialUnderpayment ?? 0)} icon={BadgeDollarSign} tone="blue" />
        <Metric label="Unbilled revenue" value={money(metrics.unbilled ?? 0)} icon={FileText} />
        <Metric label="Denied revenue" value={money(metrics.denied ?? 0)} icon={ArrowDownRight} tone="coral" />
        <Metric label="Clean claim rate" value={`${metrics.cleanClaimRate ?? 0}%`} icon={CheckCircle2} />
        <Metric label="Days in AR" value={`${metrics.daysInAr ?? 0}`} icon={Clock3} tone="amber" />
        <Metric label="Denial rate" value={`${metrics.denialRate ?? 0}%`} icon={AlertCircle} tone="blue" />
      </div>
      <div className="ax-dashboard-grid">
        <section className="ax-panel ax-flow-panel">
          <div className="ax-panel-head">
            <div>
              <span className="ax-kicker">Financial twin</span>
              <h2>Revenue flow</h2>
            </div>
            <button className="ax-icon-button" aria-label="Revenue flow details" type="button" data-testid="button-flow-details">
              <ArrowUpRight size={16} />
            </button>
          </div>
          <div className="ax-flow">
            {[
              ['01', 'Charges', money(map.totalCharges ?? 0), `Unbilled ${money(map.unbilled ?? 0)}`],
              ['02', 'Billed', money(map.billed ?? 0), `Pending ${money(map.pending ?? 0)}`],
              ['03', 'Outstanding', money(map.outstanding ?? 0), `At risk ${money(map.atRisk ?? 0)}`],
              ['04', 'Paid', money(map.paid ?? 0), `Denied ${money(map.denied ?? 0)}`],
            ].map(([number, title, amount, caption], index) => (
              <div className="ax-flow-node" key={title}>
                <span className="ax-flow-index">{number}</span>
                <div className="ax-flow-orb">
                  <span />
                </div>
                <strong>{title}</strong>
                <b>{amount}</b>
                <small>{caption}</small>
                {index < 3 ? <ChevronRight className="ax-flow-arrow" size={16} /> : null}
              </div>
            ))}
          </div>
          <div className="ax-flow-foot">
            <span>
              <i className="ax-dot teal" /> On track {sla.data?.onTrack ?? 0}
            </span>
            <span>
              <i className="ax-dot coral" /> At risk {sla.data?.atRisk ?? 0} · Breached {sla.data?.breached ?? 0}
            </span>
            <span className="ax-mono">Due today {sla.data?.dueToday ?? 0}</span>
          </div>
        </section>
        <section className="ax-panel ax-actions-panel">
          <div className="ax-panel-head">
            <div>
              <span className="ax-kicker">Operator focus</span>
              <h2>
                Today’s actions <em>{String(actions.length).padStart(2, '0')}</em>
              </h2>
            </div>
            <button className="ax-text-button" type="button" onClick={() => onNavigate('queue')} data-testid="button-view-all-actions">
              View work queue <ArrowRight size={14} />
            </button>
          </div>
          <div className="ax-action-list">
            {actions.slice(0, 6).map((item: any, index: number) => (
              <button
                className="ax-action-row"
                type="button"
                key={`${item.label}-${index}`}
                onClick={() => onNavigate('queue')}
                data-testid={`button-action-${index}`}
              >
                <span className="ax-action-flag high">
                  <AlertCircle size={14} />
                </span>
                <span className="ax-action-copy">
                  <b>{item.label}</b>
                  <small>{item.count != null ? `${item.count} items` : 'Priority action'}</small>
                </span>
                <span className="ax-action-value">
                  {item.amount ? money(item.amount) : '—'}
                  <small>Today</small>
                </span>
                <ChevronRight size={15} />
              </button>
            ))}
          </div>
        </section>
      </div>
      <div className="ax-insight-strip">
        <Sparkles size={17} />
        <span>
          <b>Velora signal:</b> {signal}
        </span>
        <button type="button" onClick={() => onNavigate('leakage')} data-testid="button-open-signal">
          Open signal <ArrowRight size={13} />
        </button>
      </div>
      {(recommendations.data?.summary ?? []).length > 1 ? (
        <section className="ax-panel" style={{ marginTop: '1rem' }}>
          <div className="ax-panel-head">
            <div>
              <span className="ax-kicker">Recommendations</span>
              <h2>Intelligence feed</h2>
            </div>
          </div>
          <div className="ax-opportunity-list">
            {(recommendations.data?.summary ?? []).slice(1).map((line: string, index: number) => (
              <div className="ax-opportunity" key={line}>
                <span className="ax-rank">0{index + 1}</span>
                <span>
                  <b>{line}</b>
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function WorkQueue() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState('');
  const [query, setQuery] = useState('');
  const [module, setModule] = useState('All modules');
  const [status, setStatus] = useState('All statuses');
  const [priority, setPriority] = useState('All priorities');

  const workItems = useQuery({ queryKey: ['work-items'], queryFn: () => api.workItems() });
  const complete = useMutation({
    mutationFn: (id: string) => api.updateWorkItem(id, { status: 'COMPLETED' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['work-items'] }),
  });

  const items = (workItems.data ?? []).filter((item: any) => item.status !== 'COMPLETED');
  const modules = useMemo(
    () => Array.from(new Set(items.map((item: any) => item.module).filter(Boolean))) as string[],
    [items],
  );
  const visible = useMemo(
    () =>
      items
        .filter((item: any) =>
          [item.title, item.id, item.payer, item.reason, item.module].join(' ').toLowerCase().includes(query.toLowerCase()),
        )
        .filter((item: any) => module === 'All modules' || item.module === module)
        .filter((item: any) => status === 'All statuses' || item.status === status)
        .filter((item: any) => priority === 'All priorities' || item.priority === priority),
    [items, query, module, status, priority],
  );
  const selected = items.find((item: any) => item.id === selectedId) ?? visible[0];

  if (workItems.isLoading) return <div className="ax-view"><LoadingState label="Loading work queue…" /></div>;
  if (workItems.error) return <div className="ax-view"><ErrorState error={workItems.error} onRetry={() => void workItems.refetch()} /></div>;

  return (
    <div className="ax-view">
      <SectionHeading
        eyebrow="Human-in-the-loop operations"
        title="Work queue"
        detail={`${visible.length} active work items · ranked by value, urgency and confidence`}
        action={
          <button className="ax-primary-button" type="button" onClick={() => void workItems.refetch()} data-testid="button-run-prioritization">
            <Sparkles size={14} /> Refresh queue
          </button>
        }
      />
      <div className="ax-queue-toolbar">
        <div className="ax-search">
          <Search size={16} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search work items, payers or episodes"
            aria-label="Search work items"
            data-testid="input-work-queue-search"
          />
        </div>
        <select value={module} onChange={(event) => setModule(event.target.value)} aria-label="Filter by module" data-testid="select-filter-module">
          <option>All modules</option>
          {modules.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter by status" data-testid="select-filter-status">
          <option>All statuses</option>
          {['OPEN', 'IN_PROGRESS', 'READY', 'BLOCKED'].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        <select value={priority} onChange={(event) => setPriority(event.target.value)} aria-label="Filter by priority" data-testid="select-filter-priority">
          <option>All priorities</option>
          {['HIGH', 'MEDIUM', 'LOW'].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        <button className="ax-icon-button" type="button" aria-label="More filters" data-testid="button-more-filters">
          <Filter size={16} />
        </button>
      </div>
      <div className="ax-queue-layout">
        <section className="ax-panel ax-queue-list">
          <div className="ax-panel-head">
            <div>
              <span className="ax-kicker">Active queue</span>
              <h2>
                {visible.length} items{' '}
                <em>
                  · {money(visible.reduce((sum: number, item: any) => sum + (item.valueAtRisk?.amount ?? 0), 0))} value
                </em>
              </h2>
            </div>
            <span className="ax-mono">SORT: IMPACT</span>
          </div>
          <div className="ax-table-head">
            <span>Work item</span>
            <span>Market / payer</span>
            <span>Value</span>
            <span>Status</span>
          </div>
          {visible.length === 0 ? (
            <div className="ax-empty">
              <CheckCircle2 size={22} />
              <b>Queue is clear</b>
              <p>No work items match these filters.</p>
            </div>
          ) : (
            visible.map((item: any) => (
              <button
                type="button"
                className={`ax-queue-row ${selected?.id === item.id ? 'selected' : ''}`}
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                data-testid={`row-work-item-${item.id}`}
              >
                <span className="ax-queue-main">
                  <span className="ax-module-icon">
                    <ClipboardCheck size={15} />
                  </span>
                  <span>
                    <b>{item.title}</b>
                    <small>
                      {item.id} · {item.module} · {item.workType}
                    </small>
                  </span>
                </span>
                <span className="ax-queue-context">
                  <b>{item.country}</b>
                  <small>{item.payer ?? '—'}</small>
                </span>
                <span className="ax-queue-amount">
                  {money(item.valueAtRisk ?? 0)}
                  <small>{formatLabel(item.priority)} priority</small>
                </span>
                <StatusPill tone={statusTone(item.status)}>{formatLabel(item.status)}</StatusPill>
              </button>
            ))
          )}
        </section>
        <aside className="ax-panel ax-inspection">
          {selected ? (
            <>
              <div className="ax-inspection-top">
                <span className="ax-kicker">Inspection view</span>
                <button className="ax-icon-button" type="button" aria-label="Close inspection" onClick={() => setSelectedId('')} data-testid="button-close-inspection">
                  <X size={15} />
                </button>
              </div>
              <div className="ax-inspection-title">
                <span className="ax-module-icon large">
                  <ClipboardCheck size={18} />
                </span>
                <div>
                  <h2>{selected.title}</h2>
                  <small>
                    {selected.id} · {selected.module}
                  </small>
                </div>
              </div>
              <div className="ax-inspection-value">
                <span>Value in motion</span>
                <strong>{money(selected.valueAtRisk ?? 0)}</strong>
                <StatusPill tone={priorityTone(selected.priority)}>{formatLabel(selected.priority)} priority</StatusPill>
              </div>
              <div className="ax-detail-list">
                <div>
                  <span>Entity</span>
                  <b>
                    {selected.entityType} · {selected.entityId}
                  </b>
                </div>
                <div>
                  <span>Payer</span>
                  <b>{selected.payer ?? '—'}</b>
                </div>
                <div>
                  <span>Market layer</span>
                  <b>{selected.country}</b>
                </div>
                <div>
                  <span>Owner</span>
                  <b>{selected.assignedUser ?? selected.assignedTeam ?? 'Unassigned'}</b>
                </div>
                <div>
                  <span>Due</span>
                  <b>{selected.dueAt ? new Date(selected.dueAt).toLocaleString() : '—'}</b>
                </div>
              </div>
              <div className="ax-reason">
                <span className="ax-kicker">Why this surfaced</span>
                <p>{selected.reason}</p>
              </div>
              <div className="ax-inspection-actions">
                <button
                  className="ax-primary-button"
                  type="button"
                  disabled={complete.isPending}
                  onClick={() => complete.mutate(selected.id)}
                  data-testid={`button-complete-${selected.id}`}
                >
                  <Check size={15} /> {complete.isPending ? 'Completing…' : 'Mark complete'}
                </button>
                <button className="ax-outline-button" type="button" data-testid={`button-escalate-${selected.id}`}>
                  <ArrowUpRight size={14} /> Escalate
                </button>
              </div>
              {complete.isError ? <p className="ax-inline-error">{(complete.error as Error).message}</p> : null}
            </>
          ) : (
            <div className="ax-empty">
              <PanelLeftOpen size={22} />
              <b>Select a work item</b>
              <p>Choose an item from the queue to inspect its evidence and next action.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Patients() {
  const [selectedId, setSelectedId] = useState('');
  const patients = useQuery({ queryKey: ['patients'], queryFn: api.patients });
  const detail = useQuery({
    queryKey: ['patient', selectedId],
    queryFn: () => api.patient(selectedId),
    enabled: Boolean(selectedId),
  });

  if (patients.isLoading) return <div className="ax-view"><LoadingState label="Loading patients…" /></div>;
  if (patients.error) return <div className="ax-view"><ErrorState error={patients.error} onRetry={() => void patients.refetch()} /></div>;

  const list = patients.data ?? [];
  const selected = detail.data?.patient;

  return (
    <div className="ax-view">
      <SectionHeading eyebrow="Patient access" title="Patients" detail={`${list.length} patients in the active tenant`} />
      <div className="ax-queue-layout">
        <section className="ax-panel ax-queue-list">
          <div className="ax-panel-head">
            <div>
              <span className="ax-kicker">Directory</span>
              <h2>{list.length} records</h2>
            </div>
          </div>
          <div className="ax-table-head">
            <span>Patient</span>
            <span>MRN / market</span>
            <span>Balance</span>
            <span>Status</span>
          </div>
          {list.map((patient: any) => (
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
                  <small>{patient.id}</small>
                </span>
              </span>
              <span className="ax-queue-context">
                <b>{patient.mrn}</b>
                <small>{patient.country}</small>
              </span>
              <span className="ax-queue-amount">{money(patient.balance ?? 0)}</span>
              <StatusPill tone="teal">Active</StatusPill>
            </button>
          ))}
        </section>
        <aside className="ax-panel ax-inspection">
          {!selectedId ? (
            <div className="ax-empty">
              <PanelLeftOpen size={22} />
              <b>Select a patient</b>
              <p>Open a record to inspect coverages, authorizations and claims.</p>
            </div>
          ) : detail.isLoading ? (
            <LoadingState label="Loading patient…" />
          ) : detail.error ? (
            <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />
          ) : selected ? (
            <>
              <div className="ax-inspection-top">
                <span className="ax-kicker">Patient chart</span>
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
                    {selected.mrn} · DOB {selected.dob}
                  </small>
                </div>
              </div>
              <div className="ax-detail-list">
                <div>
                  <span>Country</span>
                  <b>{selected.country}</b>
                </div>
                <div>
                  <span>Balance</span>
                  <b>{money(selected.balance ?? 0)}</b>
                </div>
                <div>
                  <span>Coverages</span>
                  <b>{detail.data?.coverages?.length ?? 0}</b>
                </div>
                <div>
                  <span>Authorizations</span>
                  <b>{detail.data?.authorizations?.length ?? 0}</b>
                </div>
                <div>
                  <span>Claims</span>
                  <b>{detail.data?.claims?.length ?? 0}</b>
                </div>
              </div>
              <div className="ax-reason">
                <span className="ax-kicker">Recent claims</span>
                <p>
                  {(detail.data?.claims ?? [])
                    .slice(0, 3)
                    .map((claim: any) => `${claim.claimNumber} (${claim.status})`)
                    .join(' · ') || 'No claims linked.'}
                </p>
              </div>
            </>
          ) : (
            <ErrorState error={new Error('Patient not found')} />
          )}
        </aside>
      </div>
    </div>
  );
}

function Eligibility() {
  const [resultByCoverage, setResultByCoverage] = useState<Record<string, any>>({});
  const coverages = useQuery({ queryKey: ['coverages'], queryFn: api.coverages });
  const check = useMutation({
    mutationFn: (coverageId: string) => api.eligibilityCheck(coverageId),
    onSuccess: (data, coverageId) => setResultByCoverage((current) => ({ ...current, [coverageId]: data })),
  });

  if (coverages.isLoading) return <div className="ax-view"><LoadingState label="Loading coverages…" /></div>;
  if (coverages.error) return <div className="ax-view"><ErrorState error={coverages.error} onRetry={() => void coverages.refetch()} /></div>;

  const list = coverages.data ?? [];

  return (
    <div className="ax-view">
      <SectionHeading eyebrow="Access integrity" title="Eligibility" detail="Verify coverage status and estimated patient responsibility before claim creation." />
      <section className="ax-panel ax-table-panel">
        <div className="ax-panel-head">
          <div>
            <span className="ax-kicker">Coverage inventory</span>
            <h2>{list.length} coverages</h2>
          </div>
        </div>
        <div className="ax-claims-table">
          <div className="ax-table-head">
            <span>Coverage</span>
            <span>Plan / member</span>
            <span>Responsibility</span>
            <span>Status</span>
            <span>Action</span>
          </div>
          {list.map((coverage: any) => {
            const result = resultByCoverage[coverage.id];
            return (
              <div className="ax-claim-row" key={coverage.id} data-testid={`row-coverage-${coverage.id}`}>
                <span>
                  <b>{coverage.id}</b>
                  <small>Patient {coverage.patientId}</small>
                </span>
                <span>
                  <b>{coverage.planName}</b>
                  <small>{coverage.memberId}</small>
                </span>
                <strong>
                  {money(coverage.deductibleRemaining ?? 0)}
                  <small style={{ display: 'block', fontWeight: 400 }}>
                    Copay {money(coverage.copay ?? 0)} · Coins {coverage.coinsurancePercent}%
                  </small>
                </strong>
                <StatusPill tone={statusTone(coverage.status)}>{formatLabel(coverage.status)}</StatusPill>
                <button
                  className="ax-outline-button"
                  type="button"
                  disabled={check.isPending}
                  onClick={() => check.mutate(coverage.id)}
                  data-testid={`button-eligibility-${coverage.id}`}
                >
                  {check.isPending && check.variables === coverage.id ? 'Checking…' : 'Run check'}
                </button>
                {result ? (
                  <span className="ax-mono" style={{ gridColumn: '1 / -1' }}>
                    Result: {result.active ? 'ACTIVE' : 'INACTIVE'} · AI conf{' '}
                    {Math.round((result.ai?.confidence ?? 0) * 100)}%
                    {result.ai?.output ? ` · ${String(result.ai.output).slice(0, 120)}` : ''}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Authorizations() {
  const auth = useQuery({ queryKey: ['authorizations-risk'], queryFn: api.authorizationsRisk });

  if (auth.isLoading) return <div className="ax-view"><LoadingState label="Loading authorizations…" /></div>;
  if (auth.error) return <div className="ax-view"><ErrorState error={auth.error} onRetry={() => void auth.refetch()} /></div>;

  const data = auth.data ?? {};
  const items = data.items ?? [];

  return (
    <div className="ax-view">
      <SectionHeading eyebrow="Prior auth risk" title="Authorizations" detail="Expiring, exhausted and pending authorizations that can block clean claim flow." />
      <div className="ax-metrics">
        <Metric label="Expires in 7 days" value={String(data.expiresWithin7Days ?? 0)} icon={Clock3} tone="amber" />
        <Metric label="Missing / denied" value={String(data.missingAuthorization ?? 0)} icon={ShieldAlert} tone="coral" />
        <Metric label="Visits almost exhausted" value={String(data.visitsAlmostExhausted ?? 0)} icon={AlertCircle} tone="amber" />
        <Metric label="Pending payer" value={String(data.pendingPayerResponse ?? 0)} icon={Activity} tone="blue" />
      </div>
      <section className="ax-panel ax-table-panel">
        <div className="ax-panel-head">
          <div>
            <span className="ax-kicker">Authorization register</span>
            <h2>{items.length} records</h2>
          </div>
        </div>
        <div className="ax-claims-table">
          <div className="ax-table-head">
            <span>Auth</span>
            <span>Codes</span>
            <span>Units</span>
            <span>Window</span>
            <span>Status</span>
          </div>
          {items.map((item: any) => (
            <div className="ax-claim-row" key={item.id} data-testid={`row-auth-${item.id}`}>
              <span>
                <b>{item.id}</b>
                <small>Patient {item.patientId}</small>
              </span>
              <span>
                <b>{item.procedureCode}</b>
                <small>{item.diagnosisCode}</small>
              </span>
              <strong>
                {item.unitsUsed}/{item.unitsApproved}
              </strong>
              <span>
                <b>{item.effectiveFrom?.slice(0, 10)}</b>
                <small>to {item.effectiveTo?.slice(0, 10)}</small>
              </span>
              <StatusPill tone={statusTone(item.status)}>{formatLabel(item.status)}</StatusPill>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Providers() {
  const providers = useQuery({ queryKey: ['providers'], queryFn: api.providers });

  if (providers.isLoading) return <div className="ax-view"><LoadingState label="Loading providers…" /></div>;
  if (providers.error) return <div className="ax-view"><ErrorState error={providers.error} onRetry={() => void providers.refetch()} /></div>;

  const list = providers.data ?? [];

  return (
    <div className="ax-view">
      <SectionHeading eyebrow="Network directory" title="Providers" detail={`${list.length} billing and rendering providers in the tenant.`} />
      <section className="ax-panel ax-table-panel">
        <div className="ax-panel-head">
          <div>
            <span className="ax-kicker">Provider roster</span>
            <h2>{list.length} active</h2>
          </div>
          <button className="ax-outline-button" type="button" onClick={() => void providers.refetch()}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
        <div className="ax-claims-table">
          <div className="ax-table-head">
            <span>Provider</span>
            <span>Specialty</span>
            <span>NPI / IDs</span>
            <span>Status</span>
          </div>
          {list.map((provider: any) => (
            <div className="ax-claim-row" key={provider.id} data-testid={`row-provider-${provider.id}`}>
              <span>
                <b>{provider.name}</b>
                <small>{provider.id}</small>
              </span>
              <span>{provider.specialty}</span>
              <span>
                <b>{provider.npi ?? provider.identifiers?.[0]?.identifierValue ?? '—'}</b>
                <small>{provider.identifiers?.length ? `${provider.identifiers.length} identifier(s)` : 'No IDs'}</small>
              </span>
              <StatusPill tone="teal">{formatLabel(provider.identifiers?.[0]?.status ?? 'ACTIVE')}</StatusPill>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Payers() {
  const payers = useQuery({ queryKey: ['payers'], queryFn: api.payers });

  if (payers.isLoading) return <div className="ax-view"><LoadingState label="Loading payers…" /></div>;
  if (payers.error) return <div className="ax-view"><ErrorState error={payers.error} onRetry={() => void payers.refetch()} /></div>;

  const list = payers.data ?? [];

  return (
    <div className="ax-view">
      <SectionHeading eyebrow="Payer network" title="Payers" detail="Claim standards and market coverage for connected payers." />
      <section className="ax-panel ax-table-panel">
        <div className="ax-panel-head">
          <div>
            <span className="ax-kicker">Payer directory</span>
            <h2>{list.length} payers</h2>
          </div>
        </div>
        <div className="ax-claims-table">
          <div className="ax-table-head">
            <span>Payer</span>
            <span>Market</span>
            <span>Claim standard</span>
            <span>Id</span>
          </div>
          {list.map((payer: any) => (
            <div className="ax-claim-row" key={payer.id} data-testid={`row-payer-${payer.id}`}>
              <span>
                <b>{payer.name}</b>
                <small>{payer.id}</small>
              </span>
              <span>
                <b>{payer.country}</b>
              </span>
              <StatusPill tone="blue">{payer.claimStandard}</StatusPill>
              <span className="ax-mono">{payer.id}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Coding() {
  const queryClient = useQueryClient();
  const [result, setResult] = useState<any>(null);
  const [decisionNote, setDecisionNote] = useState('');
  const [encounterId, setEncounterId] = useState('enc-1');
  const encounters = useQuery({ queryKey: ['encounters'], queryFn: api.encounters });
  const suggest = useMutation({
    mutationFn: (id: string) => api.codingSuggest(id),
    onSuccess: (data) => {
      setResult(data);
      setDecisionNote('');
    },
  });
  const decide = useMutation({
    mutationFn: (decision: 'ACCEPT' | 'MODIFY' | 'REJECT') =>
      api.codingDecision({
        encounterId: result?.encounterId ?? encounterId,
        decision,
        codes: [
          ...(result?.suggestions?.diagnoses ?? []).map((d: any) => d.code),
          ...(result?.suggestions?.procedures ?? []).map((p: any) => p.code),
        ],
        reason: `Operator ${decision.toLowerCase()} on coding suggestions`,
      }),
    onSuccess: (data, decision) => {
      setDecisionNote(`${decision} recorded for ${data.encounterId}`);
      void queryClient.invalidateQueries({ queryKey: ['audit'] });
      if (result?.ai?.id) {
        void api.decideAiExecution(result.ai.id, { decision }).catch(() => undefined);
      }
    },
    onError: (error) => setDecisionNote((error as Error).message),
  });

  const encounterList = encounters.data ?? [];

  return (
    <div className="ax-view">
      <SectionHeading
        eyebrow="Clinical coding assist"
        title="Coding"
        detail="Generate diagnosis and procedure suggestions, then accept, modify or reject with an audit trail."
        action={
          <div className="ax-inline-controls">
            <select
              value={encounterId}
              onChange={(event) => setEncounterId(event.target.value)}
              data-testid="select-coding-encounter"
            >
              {(encounterList.length ? encounterList : [{ id: 'enc-1' }]).map((enc: any) => (
                <option key={enc.id} value={enc.id}>
                  {enc.id}
                </option>
              ))}
            </select>
            <button
              className="ax-primary-button"
              type="button"
              disabled={suggest.isPending}
              onClick={() => suggest.mutate(encounterId)}
              data-testid="button-coding-suggest"
            >
              <Sparkles size={14} /> {suggest.isPending ? 'Suggesting…' : 'Suggest codes'}
            </button>
          </div>
        }
      />
      {suggest.isError ? <ErrorState error={suggest.error} onRetry={() => suggest.mutate(encounterId)} /> : null}
      {decisionNote ? (
        <div className="ax-insight-strip">
          <ClipboardList size={17} />
          <span>{decisionNote}</span>
        </div>
      ) : null}
      {!result && !suggest.isPending && !suggest.isError ? (
        <div className="ax-empty">
          <Stethoscope size={22} />
          <b>Ready for coding assist</b>
          <p>Run suggestions against an encounter to review diagnoses, procedures and warnings.</p>
        </div>
      ) : null}
      {suggest.isPending ? <LoadingState label="Generating coding suggestions…" /> : null}
      {result ? (
        <div className="ax-leakage-layout">
          <section className="ax-panel">
            <div className="ax-panel-head">
              <div>
                <span className="ax-kicker">Suggestions</span>
                <h2>Encounter {result.encounterId}</h2>
              </div>
            </div>
            <div className="ax-opportunity-list">
              {(result.suggestions?.diagnoses ?? []).map((dx: any) => (
                <div className="ax-opportunity" key={dx.code}>
                  <span className="ax-rank">DX</span>
                  <span>
                    <b>
                      {dx.code} · {dx.description}
                    </b>
                    <small>Confidence {asPercent(dx.confidence)}%</small>
                  </span>
                </div>
              ))}
              {(result.suggestions?.procedures ?? []).map((px: any) => (
                <div className="ax-opportunity" key={px.code}>
                  <span className="ax-rank">PX</span>
                  <span>
                    <b>
                      {px.code} · {px.description}
                    </b>
                    <small>Confidence {asPercent(px.confidence)}%</small>
                  </span>
                </div>
              ))}
            </div>
            <div className="ax-inspection-actions" style={{ marginTop: '1rem' }}>
              <button
                className="ax-primary-button"
                type="button"
                disabled={decide.isPending}
                onClick={() => decide.mutate('ACCEPT')}
                data-testid="button-coding-accept"
              >
                <Check size={14} /> Accept
              </button>
              <button
                className="ax-outline-button"
                type="button"
                disabled={decide.isPending}
                onClick={() => decide.mutate('MODIFY')}
                data-testid="button-coding-modify"
              >
                Modify
              </button>
              <button
                className="ax-outline-button"
                type="button"
                disabled={decide.isPending}
                onClick={() => decide.mutate('REJECT')}
                data-testid="button-coding-reject"
              >
                <X size={14} /> Reject
              </button>
            </div>
          </section>
          <section className="ax-panel">
            <div className="ax-panel-head">
              <div>
                <span className="ax-kicker">Warnings & AI</span>
                <h2>Review before commit</h2>
              </div>
            </div>
            <div className="ax-leakage-bars">
              {(result.warnings ?? []).map((warning: string) => (
                <div className="ax-leakage-bar" key={warning}>
                  <div className="ax-leakage-label">
                    <span>
                      <AlertCircle size={15} />
                      {warning}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="ax-reason">
              <span className="ax-kicker">AI output</span>
              <p>
                Confidence {asPercent(result.ai?.confidence)}% · Model {result.ai?.model ?? '—'}
                <br />
                {result.ai?.output ?? 'No AI narrative returned.'}
              </p>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function Charges() {
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const charges = useQuery({ queryKey: ['charges'], queryFn: api.charges });
  const bill = useMutation({
    mutationFn: (id: string) => api.billCharge(id),
    onSuccess: (data, id) => {
      setNote(
        data?.claim
          ? `Billed ${id} → draft claim ${data.claim.claimNumber ?? data.claim.id}`
          : `Billed ${id}`,
      );
      void queryClient.invalidateQueries({ queryKey: ['charges'] });
      void queryClient.invalidateQueries({ queryKey: ['claims'] });
      void queryClient.invalidateQueries({ queryKey: ['audit'] });
    },
    onError: (error) => setNote((error as Error).message),
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

function Claims() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string>('');
  const [actionNote, setActionNote] = useState<string>('');
  const claims = useQuery({ queryKey: ['claims'], queryFn: api.claims });
  const detail = useQuery({
    queryKey: ['claim', selectedId],
    queryFn: () => api.claim(selectedId),
    enabled: Boolean(selectedId),
  });
  const scrub = useMutation({
    mutationFn: (id: string) => api.scrubClaim(id),
    onSuccess: (data, id) => {
      setActionNote(`Scrubbed ${id}: quality ${data?.claim?.qualityScore ?? data?.qualityScore ?? 'updated'}`);
      setSelectedId(id);
      void queryClient.invalidateQueries({ queryKey: ['claims'] });
      void queryClient.invalidateQueries({ queryKey: ['claim', id] });
    },
    onError: (error) => setActionNote((error as Error).message),
  });
  const submit = useMutation({
    mutationFn: (id: string) => api.submitClaim(id),
    onSuccess: (data, id) => {
      setActionNote(`Submitted ${id} via ${data?.gateway?.standard ?? 'gateway'}`);
      void queryClient.invalidateQueries({ queryKey: ['claims'] });
      void queryClient.invalidateQueries({ queryKey: ['claim', id] });
    },
    onError: (error) => setActionNote((error as Error).message),
  });

  if (claims.isLoading) return <div className="ax-view"><LoadingState label="Loading claims…" /></div>;
  if (claims.error) return <div className="ax-view"><ErrorState error={claims.error} onRetry={() => void claims.refetch()} /></div>;

  const list = claims.data ?? [];
  const total = list.reduce((sum: number, claim: any) => sum + (claim.grossAmount?.amount ?? 0), 0);
  const claimDetail = detail.data?.claim;
  const events = detail.data?.events ?? [];
  const validations = detail.data?.validations ?? [];
  const lines = detail.data?.lines ?? [];

  return (
    <div className="ax-view">
      <SectionHeading
        eyebrow="Submission control"
        title="Claims"
        detail="Quality, payer context and denial risk before a claim leaves the building."
        action={
          <button className="ax-outline-button" type="button" onClick={() => void claims.refetch()} data-testid="button-export-claims">
            <RefreshCw size={14} /> Refresh
          </button>
        }
      />
      {actionNote ? <div className="ax-insight-strip"><Sparkles size={17} /><span>{actionNote}</span></div> : null}
      <div className="ax-queue-layout">
        <section className="ax-panel ax-table-panel">
          <div className="ax-panel-head">
            <div>
              <span className="ax-kicker">Claim inventory</span>
              <h2>
                {list.length} claims in motion <em>· {money(total)} total</em>
              </h2>
            </div>
            <div className="ax-inline-controls">
              <button className="ax-filter-active" type="button" data-testid="button-claims-quality-filter">
                <CheckCircle2 size={14} /> Quality view
              </button>
            </div>
          </div>
          <div className="ax-claims-table">
            <div className="ax-table-head">
              <span>Claim</span>
              <span>Market</span>
              <span>Amount</span>
              <span>Quality</span>
              <span>Risk</span>
              <span>Status</span>
              <span>Actions</span>
            </div>
            {list.map((claim: any) => {
              const score = claim.qualityScore ?? 0;
              const risk = claim.denialProbability >= 0.7 ? 'High' : claim.denialProbability >= 0.4 ? 'Medium' : 'Low';
              return (
                <div
                  className={`ax-claim-row ${selectedId === claim.id ? 'selected' : ''}`}
                  key={claim.id}
                  data-testid={`row-claim-${claim.id}`}
                  onClick={() => setSelectedId(claim.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') setSelectedId(claim.id);
                  }}
                >
                  <span>
                    <b>{claim.claimNumber ?? claim.id}</b>
                    <small>{claim.id}</small>
                  </span>
                  <span>
                    <b>{claim.countryId}</b>
                    <small>{claim.claimType}</small>
                  </span>
                  <strong>{money(claim.grossAmount ?? 0)}</strong>
                  <span className="ax-score">
                    <i style={{ width: `${score}%` }} />
                    <b>{score}</b>
                  </span>
                  <StatusPill tone={risk === 'High' ? 'coral' : risk === 'Medium' ? 'amber' : 'teal'}>{risk}</StatusPill>
                  <StatusPill tone={statusTone(claim.status)}>{formatLabel(claim.status)}</StatusPill>
                  <span style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <button
                      className="ax-outline-button"
                      type="button"
                      disabled={scrub.isPending}
                      onClick={(event) => {
                        event.stopPropagation();
                        scrub.mutate(claim.id);
                      }}
                      data-testid={`button-scrub-${claim.id}`}
                    >
                      Scrub
                    </button>
                    <button
                      className="ax-primary-button"
                      type="button"
                      disabled={submit.isPending || claim.status !== 'READY'}
                      onClick={(event) => {
                        event.stopPropagation();
                        submit.mutate(claim.id);
                      }}
                      data-testid={`button-submit-${claim.id}`}
                    >
                      Submit
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        </section>
        <aside className="ax-panel ax-inspection">
          {!selectedId ? (
            <div className="ax-empty">
              <FileCheck2 size={22} />
              <b>Select a claim</b>
              <p>Open a claim to inspect scrub layers, events and line detail.</p>
            </div>
          ) : detail.isLoading ? (
            <LoadingState label="Loading claim…" />
          ) : detail.error ? (
            <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />
          ) : claimDetail ? (
            <>
              <div className="ax-inspection-top">
                <span className="ax-kicker">Claim detail</span>
                <StatusPill tone={statusTone(claimDetail.status)}>{formatLabel(claimDetail.status)}</StatusPill>
              </div>
              <div className="ax-inspection-title">
                <span className="ax-module-icon large">
                  <FileCheck2 size={18} />
                </span>
                <div>
                  <h2>{claimDetail.claimNumber ?? claimDetail.id}</h2>
                  <small>
                    {claimDetail.countryId} · Quality {claimDetail.qualityScore} · Risk{' '}
                    {asPercent(claimDetail.denialProbability)}%
                  </small>
                </div>
              </div>
              <div className="ax-detail-list">
                <div>
                  <span>Gross</span>
                  <b>{money(claimDetail.grossAmount ?? 0)}</b>
                </div>
                <div>
                  <span>Balance</span>
                  <b>{money(claimDetail.balance ?? 0)}</b>
                </div>
                <div>
                  <span>Lines</span>
                  <b>{lines.length}</b>
                </div>
                <div>
                  <span>Events</span>
                  <b>{events.length}</b>
                </div>
              </div>
              <div className="ax-reason">
                <span className="ax-kicker">Scrub layers</span>
                <div className="ax-scrub-layers">
                  {validations.length === 0 ? (
                    <p>No scrub results yet — run Scrub to populate layers.</p>
                  ) : (
                    validations.map((layer: any) => (
                      <div className="ax-scrub-layer" key={layer.id ?? layer.layer}>
                        <StatusPill tone={statusTone(layer.status)}>{formatLabel(layer.status)}</StatusPill>
                        <span>
                          <b>{layer.layer}</b>
                          <small>{layer.message}</small>
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="ax-reason">
                <span className="ax-kicker">Events</span>
                {events.length === 0 ? (
                  <p>No events recorded.</p>
                ) : (
                  <div className="ax-event-list">
                    {events.slice(0, 8).map((event: any) => (
                      <span key={event.id}>
                        <b>{event.eventType}</b> · {event.eventSource} ·{' '}
                        {event.eventTimestamp?.slice(0, 16)?.replace('T', ' ')}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <ErrorState error={new Error(detail.data?.error ?? 'Claim not found')} />
          )}
        </aside>
      </div>
    </div>
  );
}

function Denials() {
  const [selected, setSelected] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<any>(null);
  const denials = useQuery({ queryKey: ['denials'], queryFn: api.denials });
  const analyze = useMutation({
    mutationFn: (id: string) => api.analyzeDenial(id),
    onSuccess: setAiResult,
  });
  const appeal = useMutation({
    mutationFn: (id: string) => api.appealDraft(id),
    onSuccess: setAiResult,
  });

  if (denials.isLoading) return <div className="ax-view"><LoadingState label="Loading denials…" /></div>;
  if (denials.error) return <div className="ax-view"><ErrorState error={denials.error} onRetry={() => void denials.refetch()} /></div>;

  const list = denials.data ?? [];
  const valueAtRisk = list.reduce((sum: number, denial: any) => sum + (denial.amount?.amount ?? 0), 0);
  const avgRecovery =
    list.length === 0
      ? 0
      : Math.round((list.reduce((sum: number, denial: any) => sum + (denial.recoveryProbability ?? 0), 0) / list.length) * 100);

  return (
    <div className="ax-view">
      <SectionHeading
        eyebrow="Recovery command"
        title="Denials & appeals"
        detail={`${money(valueAtRisk)} of denial value is open for operator decision.`}
      />
      <div className="ax-denial-summary">
        <div>
          <span>Open denials</span>
          <strong>{list.length}</strong>
          <small>Live inventory</small>
        </div>
        <div>
          <span>Recovery probability</span>
          <strong>{avgRecovery}%</strong>
          <small>Average across open cases</small>
        </div>
        <div>
          <span>Value at risk</span>
          <strong>{money(valueAtRisk)}</strong>
          <small>Gross denial exposure</small>
        </div>
        <div>
          <span>Appeals ready</span>
          <strong>{list.filter((d: any) => d.status === 'APPEALED' || d.nextAction?.toLowerCase().includes('appeal')).length}</strong>
          <small>Next-action signal</small>
        </div>
      </div>
      <div className="ax-denial-grid">
        {list.map((denial: any) => {
          const probability = Math.round((denial.recoveryProbability ?? 0) * 100);
          const tone = probability >= 75 ? 'teal' : probability >= 50 ? 'amber' : 'coral';
          return (
            <button
              type="button"
              className={`ax-denial-card ${selected === denial.id ? 'selected' : ''}`}
              key={denial.id}
              onClick={() => setSelected(denial.id)}
              data-testid={`card-denial-${denial.id}`}
            >
              <div className="ax-denial-card-top">
                <span className={`ax-code ${tone}`}>{denial.reasonCode}</span>
                <span className="ax-mono">{denial.dueAt ? new Date(denial.dueAt).toLocaleDateString() : '—'}</span>
              </div>
              <h2>{denial.rootCause || denial.category}</h2>
              <p>
                {denial.category} · {denial.id}
              </p>
              <div className="ax-denial-value">
                <span>Value at risk</span>
                <strong>{money(denial.amount ?? 0)}</strong>
              </div>
              <div className="ax-probability">
                <span>
                  Recovery probability <b>{probability}%</b>
                </span>
                <div>
                  <i className={tone} style={{ width: `${probability}%` }} />
                </div>
              </div>
              <div className="ax-denial-next">
                <span>Next action</span>
                <b>{denial.nextAction}</b>
                <ArrowRight size={14} />
              </div>
              <div className="ax-inspection-actions" style={{ marginTop: '0.75rem' }}>
                <button
                  className="ax-outline-button"
                  type="button"
                  disabled={analyze.isPending}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelected(denial.id);
                    analyze.mutate(denial.id);
                  }}
                  data-testid={`button-analyze-${denial.id}`}
                >
                  Analyze
                </button>
                <button
                  className="ax-primary-button"
                  type="button"
                  disabled={appeal.isPending}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelected(denial.id);
                    appeal.mutate(denial.id);
                  }}
                  data-testid={`button-appeal-${denial.id}`}
                >
                  Appeal draft
                </button>
              </div>
            </button>
          );
        })}
      </div>
      {aiResult ? (
        <section className="ax-panel" style={{ marginTop: '1rem' }}>
          <div className="ax-panel-head">
            <div>
              <span className="ax-kicker">AI assist</span>
              <h2>{selected ?? 'Denial'} analysis / draft</h2>
            </div>
          </div>
          <div className="ax-reason">
            <p>
              {(aiResult.ai?.output || aiResult.draft || aiResult.appealDraft || JSON.stringify(aiResult).slice(0, 500))}
            </p>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ArQueue() {
  const ar = useQuery({ queryKey: ['ar-queue'], queryFn: api.arQueue });

  if (ar.isLoading) return <div className="ax-view"><LoadingState label="Loading A/R queue…" /></div>;
  if (ar.error) return <div className="ax-view"><ErrorState error={ar.error} onRetry={() => void ar.refetch()} /></div>;

  const list = ar.data ?? [];

  return (
    <div className="ax-view">
      <SectionHeading eyebrow="Collections priority" title="A/R queue" detail="Highest-value outstanding balances ranked for follow-up." />
      <section className="ax-panel ax-table-panel">
        <div className="ax-panel-head">
          <div>
            <span className="ax-kicker">Priority accounts</span>
            <h2>{list.length} items</h2>
          </div>
        </div>
        <div className="ax-claims-table">
          <div className="ax-table-head">
            <span>Claim</span>
            <span>Status</span>
            <span>Balance</span>
            <span>Priority</span>
            <span>Denial risk</span>
          </div>
          {list.map((item: any) => (
            <div className="ax-claim-row" key={item.claimId ?? item.id} data-testid={`row-ar-${item.claimId ?? item.id}`}>
              <span>
                <b>{item.claimId ?? item.claimNumber ?? item.id}</b>
                <small>{item.payerName ?? item.payerId ?? 'Outstanding'}</small>
              </span>
              <StatusPill tone={statusTone(item.status)}>{formatLabel(item.status)}</StatusPill>
              <strong>{money(item.amount ?? item.balance ?? 0)}</strong>
              <span>
                <b>{item.priority ?? item.priorityScore ?? '—'}</b>
                <small>Priority score</small>
              </span>
              <span>{asPercent(item.denialProbability)}%</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Contracts() {
  const contracts = useQuery({ queryKey: ['contracts'], queryFn: api.contracts });
  const payments = useQuery({ queryKey: ['payments'], queryFn: api.payments });
  const payers = useQuery({ queryKey: ['payers'], queryFn: api.payers });
  const providers = useQuery({ queryKey: ['providers'], queryFn: api.providers });

  if (contracts.isLoading || payments.isLoading) {
    return <div className="ax-view"><LoadingState label="Loading contracts…" /></div>;
  }
  if (contracts.error) {
    return <div className="ax-view"><ErrorState error={contracts.error} onRetry={() => void contracts.refetch()} /></div>;
  }

  const list = contracts.data ?? [];
  const paymentRows = payments.data?.payments ?? [];
  const underpayments = paymentRows.filter((p: any) => p.status === 'UNDERPAYMENT' || (p.variance?.amount ?? 0) < 0);
  const underpaymentTotal = underpayments.reduce(
    (sum: number, p: any) => sum + Math.abs(p.variance?.amount ?? (p.expectedAmount?.amount ?? 0) - (p.amount?.amount ?? 0)),
    0,
  );
  const payerName = (id: string) => payers.data?.find((p: any) => p.id === id)?.name ?? id;
  const providerName = (id: string) => providers.data?.find((p: any) => p.id === id)?.name ?? id;

  return (
    <div className="ax-view">
      <SectionHeading
        eyebrow="Expected vs actual"
        title="Contracts"
        detail={`${money(underpaymentTotal)} underpayment variance against contracted expectations.`}
      />
      <div className="ax-metrics">
        <Metric label="Contracts" value={String(list.length)} icon={Handshake} />
        <Metric label="Underpayments" value={String(underpayments.length)} icon={ArrowDownRight} tone="coral" />
        <Metric label="Variance" value={money(underpaymentTotal)} icon={CircleDollarSign} tone="amber" />
      </div>
      <div className="ax-leakage-layout">
        <section className="ax-panel ax-table-panel">
          <div className="ax-panel-head">
            <div>
              <span className="ax-kicker">Fee schedules</span>
              <h2>{list.length} contracts</h2>
            </div>
          </div>
          <div className="ax-claims-table">
            <div className="ax-table-head">
              <span>Contract</span>
              <span>Parties</span>
              <span>Methodology</span>
              <span>Effective</span>
            </div>
            {list.map((contract: any) => (
              <div className="ax-claim-row" key={contract.id} data-testid={`row-contract-${contract.id}`}>
                <span>
                  <b>{contract.id}</b>
                  <small>{contract.feeScheduleNote}</small>
                </span>
                <span>
                  <b>{payerName(contract.payerId)}</b>
                  <small>{providerName(contract.providerId)}</small>
                </span>
                <StatusPill tone="blue">{formatLabel(contract.methodology)}</StatusPill>
                <span className="ax-mono">{contract.effectiveFrom?.slice(0, 10)}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="ax-panel">
          <div className="ax-panel-head">
            <div>
              <span className="ax-kicker">Payment variance</span>
              <h2>Expected vs actual</h2>
            </div>
          </div>
          <div className="ax-opportunity-list">
            {paymentRows.length === 0 ? (
              <div className="ax-empty">
                <Handshake size={22} />
                <b>No payment variances</b>
                <p>Posted remittances will appear here with expected vs actual amounts.</p>
              </div>
            ) : (
              paymentRows.map((payment: any) => (
                <div className="ax-opportunity" key={payment.id} data-testid={`row-contract-pay-${payment.id}`}>
                  <span className="ax-rank">VR</span>
                  <span>
                    <b>{payment.claimId}</b>
                    <small>
                      Expected {money(payment.expectedAmount ?? 0)} · Paid {money(payment.amount ?? 0)}
                    </small>
                  </span>
                  <strong>{money(payment.variance ?? 0)}</strong>
                  <StatusPill tone={statusTone(payment.status)}>{formatLabel(payment.status)}</StatusPill>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Payments() {
  const payments = useQuery({ queryKey: ['payments'], queryFn: api.payments });

  if (payments.isLoading) return <div className="ax-view"><LoadingState label="Loading payments…" /></div>;
  if (payments.error) return <div className="ax-view"><ErrorState error={payments.error} onRetry={() => void payments.refetch()} /></div>;

  const remittances = payments.data?.remittances ?? [];
  const paymentRows = payments.data?.payments ?? [];
  const contracts = payments.data?.contracts ?? [];

  return (
    <div className="ax-view">
      <SectionHeading eyebrow="Cash application" title="Payments" detail="Remittances, posted payments and contract references." />
      <div className="ax-metrics">
        <Metric label="Remittances" value={String(remittances.length)} icon={FileText} />
        <Metric label="Payments" value={String(paymentRows.length)} icon={BadgeDollarSign} tone="coral" />
        <Metric label="Contracts" value={String(contracts.length)} icon={Building2} tone="blue" />
      </div>
      <div className="ax-leakage-layout">
        <section className="ax-panel">
          <div className="ax-panel-head">
            <div>
              <span className="ax-kicker">Remittances</span>
              <h2>{remittances.length} received</h2>
            </div>
          </div>
          <div className="ax-opportunity-list">
            {remittances.map((remit: any) => (
              <div className="ax-opportunity" key={remit.id}>
                <span className="ax-rank">RM</span>
                <span>
                  <b>{remit.remittanceNumber ?? remit.id}</b>
                  <small>{remit.receivedAt ? new Date(remit.receivedAt).toLocaleString() : '—'}</small>
                </span>
                <strong>{money(remit.paidAmount ?? 0)}</strong>
              </div>
            ))}
          </div>
        </section>
        <section className="ax-panel">
          <div className="ax-panel-head">
            <div>
              <span className="ax-kicker">Payment variances</span>
              <h2>{paymentRows.length} postings</h2>
            </div>
          </div>
          <div className="ax-claims-table">
            {paymentRows.map((payment: any) => (
              <div className="ax-claim-row" key={payment.id} data-testid={`row-payment-${payment.id}`}>
                <span>
                  <b>{payment.claimId}</b>
                  <small>{payment.id}</small>
                </span>
                <strong>{money(payment.amount ?? 0)}</strong>
                <span>
                  Expected {money(payment.expectedAmount ?? 0)}
                  <small style={{ display: 'block' }}>Variance {money(payment.variance ?? 0)}</small>
                </span>
                <StatusPill tone={statusTone(payment.status)}>{formatLabel(payment.status)}</StatusPill>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Leakage() {
  const leakage = useQuery({ queryKey: ['leakage'], queryFn: api.leakage });

  if (leakage.isLoading) return <div className="ax-view"><LoadingState label="Loading leakage…" /></div>;
  if (leakage.error) return <div className="ax-view"><ErrorState error={leakage.error} onRetry={() => void leakage.refetch()} /></div>;

  const data = leakage.data ?? {};
  const signals = data.signals ?? [];
  const total = data.potentialLeakage ?? 0;

  return (
    <div className="ax-view">
      <SectionHeading
        eyebrow="Preventable value"
        title="Revenue leakage"
        detail="A prioritized view of where expected cash is diverging from the operating model."
      />
      <div className="ax-leakage-layout">
        <section className="ax-panel">
          <div className="ax-panel-head">
            <div>
              <span className="ax-kicker">Signal sources</span>
              <h2>
                {money(total)} identified <em>· {signals.length} signals</em>
              </h2>
            </div>
            <span className="ax-mono">CONFIDENCE BANDS</span>
          </div>
          <div className="ax-leakage-bars">
            {(['HIGH', 'MEDIUM', 'LOW'] as const).map((band) => {
              const value = data.byConfidence?.[band] ?? 0;
              const share = total ? Math.round((value / total) * 100) : 0;
              return (
                <div className="ax-leakage-bar" key={band}>
                  <div className="ax-leakage-label">
                    <span>
                      <CircleDollarSign size={15} />
                      {formatLabel(band)} confidence
                    </span>
                    <b>{money(value)}</b>
                  </div>
                  <div className="ax-bar-track">
                    <i style={{ width: `${Math.max(share, 4)}%` }} />
                  </div>
                  <small>
                    {share}% of identified leakage{' '}
                    <StatusPill tone={band === 'HIGH' ? 'teal' : band === 'MEDIUM' ? 'amber' : 'neutral'}>{band}</StatusPill>
                  </small>
                </div>
              );
            })}
          </div>
        </section>
        <section className="ax-panel">
          <div className="ax-panel-head">
            <div>
              <span className="ax-kicker">Opportunity queue</span>
              <h2>Where to act first</h2>
            </div>
          </div>
          <div className="ax-opportunity-list">
            {signals.map((signal: any, index: number) => (
              <button type="button" className="ax-opportunity" key={signal.id} data-testid={`button-opportunity-${index}`}>
                <span className="ax-rank">{String(index + 1).padStart(2, '0')}</span>
                <span>
                  <b>{signal.title}</b>
                  <small>
                    {signal.scope} · {formatLabel(signal.confidence)} confidence
                  </small>
                </span>
                <strong>{money(signal.amount ?? 0)}</strong>
                <ArrowRight size={14} />
              </button>
            ))}
          </div>
        </section>
      </div>
      <div className="ax-notice">
        <LockKeyhole size={15} />
        <span>
          Signals are model suggestions, not a financial or compliance determination. Your configured rules and operator review remain the source of action.
        </span>
      </div>
    </div>
  );
}

function Workforce() {
  const [runResult, setRunResult] = useState<any>(null);
  const agents = useQuery({ queryKey: ['agents'], queryFn: api.agents });
  const health = useQuery({ queryKey: ['ai-health'], queryFn: api.aiHealth });
  const run = useMutation({
    mutationFn: (agentId: string) => api.runAgent(agentId),
    onSuccess: setRunResult,
  });

  if (agents.isLoading || health.isLoading) return <div className="ax-view"><LoadingState label="Loading AI workforce…" /></div>;
  if (agents.error || health.error) {
    return (
      <div className="ax-view">
        <ErrorState error={agents.error || health.error} onRetry={() => { void agents.refetch(); void health.refetch(); }} />
      </div>
    );
  }

  const list = agents.data ?? [];
  const avgConfidence =
    list.length === 0
      ? 0
      : Math.round(list.reduce((sum: number, agent: any) => sum + asPercent(agent.confidenceAvg), 0) / list.length);
  const reviewTotal = list.reduce((sum: number, agent: any) => sum + (agent.reviewRequired ?? 0), 0);
  const insight = runResult?.insight;
  const riskTone =
    insight?.riskLevel === 'high' ? 'coral' : insight?.riskLevel === 'low' ? 'teal' : 'amber';

  return (
    <div className="ax-view">
      <SectionHeading
        eyebrow="Specialized digital workers"
        title="AI workforce"
        detail="Purpose-built agents prepare the work. Your team approves the decisions that change the record."
      />
      <div className="ax-workforce-header">
        <div>
          <span className="ax-kicker">Network workforce</span>
          <strong>{list.length} agents active</strong>
        </div>
        <div>
          <span className="ax-kicker">Human review</span>
          <strong>{reviewTotal} decisions</strong>
        </div>
        <div>
          <span className="ax-kicker">Average confidence</span>
          <strong>{avgConfidence}%</strong>
        </div>
        <span className="ax-live">
          <i /> {health.data?.ok ? 'ONLINE' : 'OFFLINE'} · {health.data?.model ?? 'model'}
        </span>
      </div>
      {!health.data?.ok ? (
        <div className="ax-insight-strip">
          <AlertCircle size={17} />
          <span>
            <b>Offline mode:</b> {health.data?.message ?? 'AI runtime unavailable — fallback rules will be used.'}
          </span>
        </div>
      ) : null}
      <div className="ax-agent-grid">
        {list.map((agent: any) => (
          <article className="ax-agent-card" key={agent.id}>
            <div className="ax-agent-top">
              <span className="ax-agent-icon">
                <Bot size={18} />
              </span>
              <StatusPill tone={(agent.reviewRequired ?? 0) > 5 ? 'amber' : 'teal'}>
                {agent.reviewRequired ? `${agent.reviewRequired} review${agent.reviewRequired > 1 ? 's' : ''}` : 'No review'}
              </StatusPill>
            </div>
            <h2>{agent.name}</h2>
            <p>{agent.description}</p>
            <div className="ax-agent-activity">
              <Activity size={14} />
              {agent.checksToday ?? 0} checks today
            </div>
            <div className="ax-confidence">
              <span>
                Confidence <b>{asPercent(agent.confidenceAvg)}%</b>
              </span>
              <div>
                <i style={{ width: `${asPercent(agent.confidenceAvg)}%` }} />
              </div>
            </div>
            <button
              type="button"
              className="ax-approval-button"
              disabled={run.isPending}
              onClick={() => run.mutate(agent.id)}
              data-testid={`button-run-agent-${agent.id}`}
            >
              <Sparkles size={14} /> {run.isPending && run.variables === agent.id ? 'Running…' : 'Run agent'}
            </button>
          </article>
        ))}
      </div>
      {runResult ? (
        <section className="ax-ai-result" data-testid="ai-run-result">
          <div className="ax-ai-result-head">
            <div>
              <span className="ax-kicker">Agent output</span>
              <h2>{insight?.headline ?? runResult.agent?.name ?? 'Agent result'}</h2>
              <p>
                {runResult.agent?.name ?? 'Agent'} · {formatLabel(runResult.decisionBand)} ·{' '}
                {asPercent(runResult.confidence ?? runResult.execution?.confidence)}% confidence
                {runResult.latencyMs != null ? ` · ${runResult.latencyMs} ms` : ''}
              </p>
            </div>
            <div className="ax-ai-result-badges">
              <StatusPill tone={runResult.offline ? 'amber' : 'teal'}>
                {runResult.offline ? 'Rules fallback' : 'Model online'}
              </StatusPill>
              {insight?.riskLevel ? <StatusPill tone={riskTone as any}>{formatLabel(insight.riskLevel)} risk</StatusPill> : null}
            </div>
          </div>

          <p className="ax-ai-summary">{insight?.summary ?? runResult.output ?? 'No output.'}</p>

          <div className="ax-ai-columns">
            <div>
              <h3>Primary factors</h3>
              <ul>
                {(insight?.factors ?? runResult.factors ?? []).map((factor: string) => (
                  <li key={factor}>{factor}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Recommendations</h3>
              <ul>
                {(insight?.recommendations ?? []).map((item: string) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>

          {insight?.nextAction ? (
            <div className="ax-ai-next">
              <Sparkles size={15} />
              <div>
                <span className="ax-kicker">Next action</span>
                <strong>{insight.nextAction}</strong>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function CountryPacks() {
  const [selected, setSelected] = useState('');
  const packs = useQuery({ queryKey: ['country-packs'], queryFn: api.countryPacks });

  if (packs.isLoading) return <div className="ax-view"><LoadingState label="Loading country packs…" /></div>;
  if (packs.error) return <div className="ax-view"><ErrorState error={packs.error} onRetry={() => void packs.refetch()} /></div>;

  const list = packs.data ?? [];
  const pack = list.find((item: any) => item.code === selected) ?? list[0];

  return (
    <div className="ax-view">
      <SectionHeading
        eyebrow="Configurable market architecture"
        title="Country packs"
        detail="Market layers keep local concepts configurable while your command center stays consistent."
      />
      <div className="ax-pack-disclaimer">
        <Globe2 size={15} />
        <span>
          These packs are configurable architecture and integration concepts, not claims of legal or regulatory compliance. Availability depends on your operating environment.
        </span>
      </div>
      <div className="ax-packs-layout">
        <div className="ax-pack-list">
          {list.map((item: any) => (
            <button
              type="button"
              className={`ax-pack-row ${(selected || pack?.code) === item.code ? 'selected' : ''}`}
              key={item.code}
              onClick={() => setSelected(item.code)}
              data-testid={`button-country-pack-${item.code}`}
            >
              <span className="ax-country-code">{item.code}</span>
              <span>
                <b>{item.name}</b>
                <small>
                  {item.claimStandard} · v{item.version}
                </small>
              </span>
              <StatusPill tone={item.stage === 'Active' ? 'teal' : 'amber'}>{item.stage}</StatusPill>
              <ChevronRight size={15} />
            </button>
          ))}
        </div>
        {pack ? (
          <section className="ax-panel ax-pack-detail">
            <div className="ax-pack-hero">
              <span className="ax-country-code large">{pack.code}</span>
              <div>
                <span className="ax-kicker">Selected market layer</span>
                <h2>{pack.name}</h2>
                <StatusPill tone={pack.stage === 'Active' ? 'teal' : 'amber'}>{pack.stage} configuration</StatusPill>
              </div>
            </div>
            <div className="ax-pack-sections">
              <div>
                <span className="ax-kicker">Configured concepts</span>
                <div className="ax-concept-list">
                  {(pack.concepts ?? []).map((concept: string) => (
                    <span key={concept}>
                      <CheckCircle2 size={14} />
                      {concept}
                    </span>
                  ))}
                </div>
              </div>
              <div className="ax-pack-note">
                <SlidersHorizontal size={17} />
                <span>
                  <b>Designed to be adapted</b>
                  {pack.privacyNote || ' Map your facility, payer and integration conventions here. Velora Revenue OS does not replace local counsel or market-specific review.'}
                </span>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function Rules() {
  const rules = useQuery({ queryKey: ['rules'], queryFn: api.rules });

  if (rules.isLoading) return <div className="ax-view"><LoadingState label="Loading rules…" /></div>;
  if (rules.error) return <div className="ax-view"><ErrorState error={rules.error} onRetry={() => void rules.refetch()} /></div>;

  const list = rules.data ?? [];

  return (
    <div className="ax-view">
      <SectionHeading eyebrow="Policy engine" title="Rules" detail="Versioned payer, country and specialty rules that drive scrub and routing decisions." />
      <section className="ax-panel ax-table-panel">
        <div className="ax-panel-head">
          <div>
            <span className="ax-kicker">Rule inventory</span>
            <h2>{list.length} versions</h2>
          </div>
        </div>
        <div className="ax-claims-table">
          <div className="ax-table-head">
            <span>Rule</span>
            <span>Scope</span>
            <span>Action</span>
            <span>Severity</span>
            <span>Effective</span>
          </div>
          {list.map((rule: any) => (
            <div className="ax-claim-row" key={rule.id} data-testid={`row-rule-${rule.id}`}>
              <span>
                <b>{rule.ruleKey}</b>
                <small>
                  v{rule.version} · {rule.id}
                </small>
              </span>
              <span>
                <b>{rule.country}</b>
                <small>
                  {[rule.payerId, rule.specialty].filter(Boolean).join(' · ') || 'All payers'}
                </small>
              </span>
              <span>
                <b>{rule.action}</b>
                <small>{rule.conditions}</small>
              </span>
              <StatusPill tone={rule.severity === 'BLOCKING' ? 'coral' : rule.severity === 'WARNING' ? 'amber' : 'teal'}>
                {formatLabel(rule.severity)}
              </StatusPill>
              <span className="ax-mono">{rule.effectiveFrom?.slice(0, 10)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Operations() {
  const audit = useQuery({ queryKey: ['audit'], queryFn: api.audit });
  const tenant = useQuery({ queryKey: ['tenant'], queryFn: api.tenant });

  if (audit.isLoading || tenant.isLoading) return <div className="ax-view"><LoadingState label="Loading operations…" /></div>;
  if (audit.error) return <div className="ax-view"><ErrorState error={audit.error} onRetry={() => void audit.refetch()} /></div>;

  const events = audit.data ?? [];
  const org = tenant.data;

  return (
    <div className="ax-view">
      <SectionHeading
        eyebrow="Workspace controls"
        title="Operations"
        detail="Keep the operating context, approval posture and audit trail close to the work."
      />
      <div className="ax-settings-grid">
        <section className="ax-panel ax-context-card">
          <div className="ax-panel-head">
            <div>
              <span className="ax-kicker">Organization context</span>
              <h2>{org?.name ?? 'Velora Revenue OS'}</h2>
            </div>
            <Building2 size={19} />
          </div>
          <div className="ax-detail-list">
            <div>
              <span>Home country</span>
              <b>{org?.homeCountry ?? '—'}</b>
            </div>
            <div>
              <span>Country pack</span>
              <b>{org?.countryPack ?? '—'}</b>
            </div>
            <div>
              <span>Currency</span>
              <b>{org?.currency ?? '—'}</b>
            </div>
            <div>
              <span>Data region</span>
              <b>{org?.dataRegion ?? '—'}</b>
            </div>
            <div>
              <span>Timezone</span>
              <b>{org?.timezone ?? '—'}</b>
            </div>
          </div>
          <div className="ax-setting-fields">
            <label>
              Active facility
              <select defaultValue="Primary facility" data-testid="select-active-facility">
                <option>Primary facility</option>
                <option>Ambulatory center</option>
              </select>
            </label>
            <label>
              Approval posture
              <select defaultValue="Review all high-value actions" data-testid="select-approval-posture">
                <option>Review all high-value actions</option>
                <option>Review all actions</option>
                <option>Auto-prepare, never auto-commit</option>
              </select>
            </label>
          </div>
        </section>
        <section className="ax-panel ax-audit-card">
          <div className="ax-panel-head">
            <div>
              <span className="ax-kicker">Audit trail</span>
              <h2>Recent activity</h2>
            </div>
            <button className="ax-text-button" type="button" onClick={() => void audit.refetch()} data-testid="button-view-audit">
              Refresh <ArrowRight size={14} />
            </button>
          </div>
          <div className="ax-audit-list">
            {events.map((event: any) => (
              <div className="ax-audit-row" key={event.id}>
                <span className="ax-audit-time">{event.timestamp ? new Date(event.timestamp).toLocaleString() : '—'}</span>
                <span className="ax-audit-avatar">{(event.actorId ?? 'VL').slice(0, 2).toUpperCase()}</span>
                <span>
                  <b>
                    {event.actorId} <em>{event.action}</em>
                  </b>
                  <small>
                    {event.resourceType} · {event.resourceId}
                    {event.reason ? ` · ${event.reason}` : ''}
                  </small>
                </span>
                <ChevronRight size={14} />
              </div>
            ))}
          </div>
        </section>
      </div>
      <div className="ax-security-note">
        <ShieldAlert size={16} />
        <div>
          <b>Governance posture</b>
          <span>All recommendations are explainable, attributable and held for human approval before a financial record changes.</span>
        </div>
        <StatusPill tone="teal">Controls active</StatusPill>
      </div>
    </div>
  );
}

function renderView(view: WorkspaceView, setView: (view: WorkspaceView) => void) {
  switch (view) {
    case 'overview':
      return <Overview onNavigate={setView} />;
    case 'queue':
      return <WorkQueue />;
    case 'patients':
      return <Patients />;
    case 'providers':
      return <Providers />;
    case 'payers':
      return <Payers />;
    case 'eligibility':
      return <Eligibility />;
    case 'authorizations':
      return <Authorizations />;
    case 'coding':
      return <Coding />;
    case 'charges':
      return <Charges />;
    case 'claims':
      return <Claims />;
    case 'denials':
      return <Denials />;
    case 'ar':
      return <ArQueue />;
    case 'payments':
      return <Payments />;
    case 'contracts':
      return <Contracts />;
    case 'leakage':
      return <Leakage />;
    case 'ai':
      return <Workforce />;
    case 'packs':
      return <CountryPacks />;
    case 'rules':
      return <Rules />;
    case 'settings':
      return <Operations />;
    default:
      return <Overview onNavigate={setView} />;
  }
}

export default function WorkspacePage() {
  const {
    ready,
    user,
    tenant,
    tenants,
    roleLabel,
    canAccess,
    setTenantId,
    logout,
    inactivityWarning,
    secondsToTimeout,
    staySignedIn,
    sessionTimeoutMinutes,
  } = useAuth();
  const [, setLocation] = useLocation();
  const [view, setView] = useState<WorkspaceView>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tenantOpen, setTenantOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const tenantRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  const visibleNav = useMemo(
    () => navItems.filter((item) => canAccess(item.id)),
    [canAccess],
  );

  useEffect(() => {
    if (ready && !user) setLocation('/login');
  }, [ready, user, setLocation]);

  useEffect(() => {
    if (!canAccess(view) && visibleNav[0]) setView(visibleNav[0].id);
  }, [canAccess, view, visibleNav]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (tenantRef.current && !tenantRef.current.contains(target)) setTenantOpen(false);
      if (userRef.current && !userRef.current.contains(target)) setUserOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  if (!ready) {
    return (
      <main className="axiom-workspace ax-boot">
        <div className="ax-boot-card">
          <RefreshCw size={18} className="ax-spin" />
          Validating secure session…
        </div>
      </main>
    );
  }

  if (!user || !tenant) return null;

  return (
    <main className="axiom-workspace">
      {inactivityWarning ? (
        <div className="ax-session-banner" role="alertdialog" aria-live="assertive">
          <div>
            <b>Session expiring</b>
            <span>
              No activity for almost {sessionTimeoutMinutes} minutes. You will be signed out in{' '}
              {secondsToTimeout ?? 0}s.
            </span>
          </div>
          <button type="button" onClick={() => void staySignedIn()} data-testid="button-stay-signed-in">
            Stay signed in
          </button>
        </div>
      ) : null}
      <aside className={`ax-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="ax-sidebar-top">
          <Link href="/" className="ax-brand-link" data-testid="link-workspace-brand">
            <BrandLockup />
          </Link>
          <button className="ax-sidebar-close" type="button" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} data-testid="button-close-sidebar">
            <PanelLeftClose size={16} />
          </button>
        </div>
        <div className={`ax-workspace-label ${tenantOpen ? 'open' : ''}`} ref={tenantRef}>
          <span className="ax-kicker">Workspace</span>
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={tenantOpen}
            disabled={busy}
            onClick={() => {
              setTenantOpen((open) => !open);
              setUserOpen(false);
            }}
            data-testid="button-workspace-switcher"
          >
            <span>{tenant.name}</span>
            <ChevronDown size={14} />
          </button>
          {tenantOpen ? (
            <div className="ax-dropdown" role="listbox" aria-label="Select tenant">
              {(user.role === 'admin' ? tenants : tenants.filter((t) => t.id === tenant.id)).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={item.id === tenant.id}
                  className={item.id === tenant.id ? 'selected' : ''}
                  disabled={user.role !== 'admin' || busy}
                  onClick={async () => {
                    if (user.role !== 'admin') return;
                    setBusy(true);
                    try {
                      await setTenantId(item.id);
                      setTenantOpen(false);
                    } catch {
                      setTenantOpen(false);
                    } finally {
                      setBusy(false);
                    }
                  }}
                  data-testid={`button-tenant-${item.id}`}
                >
                  <span>
                    <b>{item.name}</b>
                    <small>
                      {item.region} · {item.pack}
                      {user.role !== 'admin' ? ' · locked to your JWT' : ''}
                    </small>
                  </span>
                  {item.id === tenant.id ? <Check size={14} /> : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <nav className="ax-sidebar-nav" aria-label="Workspace navigation">
          {visibleNav.map(({ id, label, icon: Icon }) => (
            <button
              type="button"
              className={`ax-sidebar-item ${view === id ? 'active' : ''}`}
              key={id}
              onClick={() => {
                setView(id);
                setSidebarOpen(false);
              }}
              data-testid={`button-nav-${id}`}
            >
              <Icon size={15} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="ax-sidebar-bottom">
          <div className="ax-signal-mini">
            <span>
              <i /> Signal health
            </span>
            <strong>Live API · JWT</strong>
            <small>{tenant.name}</small>
          </div>
          <Link href="/" className="ax-back-site" data-testid="link-back-to-site">
            <ArrowRight size={14} style={{ transform: 'rotate(180deg)' }} /> Back to site
          </Link>
          <div className={`ax-user-wrap ${userOpen ? 'open' : ''}`} ref={userRef}>
            <button
              type="button"
              className="ax-user"
              aria-haspopup="menu"
              aria-expanded={userOpen}
              onClick={() => {
                setUserOpen((open) => !open);
                setTenantOpen(false);
              }}
              data-testid="button-user-menu"
            >
              <span className="ax-user-avatar">{user.initials}</span>
              <span>
                <b>{user.name}</b>
                <small>
                  {roleLabel} · {user.title}
                </small>
              </span>
              <ChevronDown size={13} />
            </button>
            {userOpen ? (
              <div className="ax-dropdown ax-dropdown-up" role="menu" aria-label="Account">
                <div className="ax-dropdown-label">Signed in</div>
                <div className="ax-dropdown-static">
                  <b>{user.email}</b>
                  <small>Role is bound to your JWT — sign out to change identity</small>
                </div>
                <button
                  type="button"
                  role="menuitem"
                  className="ax-dropdown-danger"
                  onClick={async () => {
                    await logout();
                    setLocation('/login');
                  }}
                  data-testid="button-logout"
                >
                  <LogOut size={14} /> Sign out
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </aside>
      <div className="ax-main">
        <header className="ax-topbar">
          <button className="ax-menu-trigger" type="button" aria-label="Open navigation" onClick={() => setSidebarOpen(true)} data-testid="button-open-sidebar">
            <Menu size={18} />
          </button>
          <div className="ax-breadcrumb">
            <span>Velora Revenue OS</span>
            <ChevronRight size={13} />
            <b>{visibleNav.find((item) => item.id === view)?.label ?? 'Workspace'}</b>
          </div>
          <div className="ax-topbar-actions">
            <span className="ax-status-online">
              <i /> Live data
            </span>
            <button className="ax-icon-button" type="button" aria-label="Notifications" data-testid="button-notifications">
              <Bell size={17} />
              <i className="ax-notification-dot" />
            </button>
            <span className="ax-topbar-avatar">{user.initials}</span>
          </div>
        </header>
        {renderView(view, setView)}
        <footer className="ax-footer">
          <span>Velora Revenue OS · Revenue, made accountable.</span>
          <span>
            {tenant.name} · <b>{roleLabel}</b>
          </span>
        </footer>
      </div>
    </main>
  );
}
