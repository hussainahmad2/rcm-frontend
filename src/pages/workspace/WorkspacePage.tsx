import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
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
import { Link, useLocation } from 'wouter';
import { api, asPercent, money } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { WorkspaceView } from './workspace-types';
import './WorkspacePage.css';

const THEME_KEY = 'velora-theme';
const CHART_COLORS = ['#2a9d8f', '#1f8fbf', '#1e293b', '#d4a017', '#0ea5e9'];

type AppTheme = 'light' | 'dark';

function readStoredTheme(): AppTheme {
  if (typeof window === 'undefined') return 'light';
  return window.localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
}

function applyTheme(theme: AppTheme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  window.localStorage.setItem(THEME_KEY, theme);
}

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

type AiInsightView = {
  headline: string;
  summary: string;
  factors?: string[];
  recommendations?: string[];
  riskLevel?: string;
  nextAction?: string;
};

function parseAiInsight(raw: unknown): AiInsightView | null {
  if (!raw) return null;
  if (typeof raw === 'object') {
    const value = raw as Record<string, unknown>;
    const headline = String(value.headline ?? '').trim();
    const summary = String(value.summary ?? '').trim();
    if (headline && summary) {
      return {
        headline,
        summary,
        factors: Array.isArray(value.factors) ? value.factors.map(String) : undefined,
        recommendations: Array.isArray(value.recommendations) ? value.recommendations.map(String) : undefined,
        riskLevel: value.riskLevel ? String(value.riskLevel) : undefined,
        nextAction: value.nextAction ? String(value.nextAction) : undefined,
      };
    }
  }
  const text = String(raw).trim();
  if (!text) return null;
  try {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return parseAiInsight(JSON.parse(text.slice(start, end + 1)));
    }
  } catch {
    // fall through to plain text
  }
  const [first, ...rest] = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  return {
    headline: first.slice(0, 120),
    summary: rest.join(' ') || first,
  };
}

function InsightCard({
  title,
  statusLabel,
  statusToneValue,
  confidence,
  insight,
  meta,
}: {
  title: string;
  statusLabel?: string;
  statusToneValue?: 'coral' | 'amber' | 'neutral' | 'teal' | 'blue';
  confidence?: number;
  insight: AiInsightView | null;
  meta?: ReactNode;
}) {
  return (
    <div className="ax-insight-card" style={{ gridColumn: '1 / -1' }}>
      <div className="ax-insight-card-top">
        <div>
          <span className="ax-kicker">{title}</span>
          {insight?.headline ? <h3>{insight.headline}</h3> : <h3>Check complete</h3>}
        </div>
        <div className="ax-insight-card-badges">
          {statusLabel ? <StatusPill tone={statusToneValue ?? 'neutral'}>{statusLabel}</StatusPill> : null}
          {confidence != null ? <span className="ax-insight-conf">{Math.round(confidence * 100)}% confidence</span> : null}
        </div>
      </div>
      {insight?.summary ? <p className="ax-insight-summary">{insight.summary}</p> : null}
      {insight?.nextAction ? (
        <p className="ax-insight-next">
          <b>Next action:</b> {insight.nextAction}
        </p>
      ) : null}
      {meta}
    </div>
  );
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
      {delta ? <small className={delta.startsWith('â†“') ? 'positive' : 'warning'}>{delta}</small> : null}
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

  const funnelData = [
    { stage: 'Charges', amount: Number(map.totalCharges ?? 0) },
    { stage: 'Billed', amount: Number(map.billed ?? 0) },
    { stage: 'Outstanding', amount: Number(map.outstanding ?? 0) },
    { stage: 'Paid', amount: Number(map.paid ?? 0) },
  ];
  const riskData = [
    { name: 'At risk', value: Number(metrics.atRisk ?? 0) },
    { name: 'Denied', value: Number(metrics.denied ?? 0) },
    { name: 'Underpay', value: Number(metrics.potentialUnderpayment ?? 0) },
    { name: 'Unbilled', value: Number(metrics.unbilled ?? 0) },
  ].filter((d) => d.value > 0);
  const kpiData = [
    { name: 'Clean claim %', value: Number(metrics.cleanClaimRate ?? 0) },
    { name: 'Denial %', value: Number(metrics.denialRate ?? 0) },
    { name: 'Days in AR', value: Number(metrics.daysInAr ?? 0) },
  ];

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
      <div className="ax-chart-grid">
        <section className="ax-panel ax-chart-panel">
          <div className="ax-panel-head">
            <div>
              <span className="ax-kicker">Cash path</span>
              <h2>Revenue funnel</h2>
            </div>
          </div>
          <div className="ax-chart-frame">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={funnelData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="axFunnelFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2a9d8f" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#2a9d8f" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="stage" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
                <Tooltip formatter={(value: number) => money(value)} contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))' }} />
                <Area type="monotone" dataKey="amount" stroke="#2a9d8f" fill="url(#axFunnelFill)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="ax-panel ax-chart-panel">
          <div className="ax-panel-head">
            <div>
              <span className="ax-kicker">Exposure mix</span>
              <h2>At-risk composition</h2>
            </div>
          </div>
          <div className="ax-chart-frame ax-chart-split">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={riskData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={78} paddingAngle={3}>
                  {riskData.map((entry, index) => (
                    <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => money(value)} contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))' }} />
              </PieChart>
            </ResponsiveContainer>
            <ul className="ax-chart-legend">
              {riskData.map((entry, index) => (
                <li key={entry.name}>
                  <i style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} />
                  <span>{entry.name}</span>
                  <b>{money(entry.value)}</b>
                </li>
              ))}
            </ul>
          </div>
        </section>
        <section className="ax-panel ax-chart-panel">
          <div className="ax-panel-head">
            <div>
              <span className="ax-kicker">Quality</span>
              <h2>Operating KPIs</h2>
            </div>
          </div>
          <div className="ax-chart-frame">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={kpiData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))' }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="#1f8fbf" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
      <div className="ax-dashboard-grid">
        <section className="ax-panel ax-flow-panel">
          <div className="ax-panel-head">
            <div>
              <span className="ax-kicker">Financial twin</span>
              <h2>Revenue flow</h2>
            </div>
            <button
              className="ax-outline-button"
              type="button"
              onClick={() => onNavigate('leakage')}
              data-testid="button-flow-details"
            >
              Inspect leakage <ArrowUpRight size={14} />
            </button>
          </div>
          <div className="ax-flow">
            {[
              {
                number: '01',
                title: 'Charges',
                amount: map.totalCharges ?? 0,
                caption: `Unbilled ${money(map.unbilled ?? 0)}`,
                icon: Receipt,
                share: 100,
              },
              {
                number: '02',
                title: 'Billed',
                amount: map.billed ?? 0,
                caption: `Pending ${money(map.pending ?? 0)}`,
                icon: FileCheck2,
                share: Number(map.totalCharges?.amount ?? map.totalCharges ?? 0)
                  ? Math.round(
                      (Number(map.billed?.amount ?? map.billed ?? 0) /
                        Number(map.totalCharges?.amount ?? map.totalCharges ?? 1)) *
                        100,
                    )
                  : 0,
              },
              {
                number: '03',
                title: 'Outstanding',
                amount: map.outstanding ?? 0,
                caption: `At risk ${money(map.atRisk ?? 0)}`,
                icon: Clock3,
                share: Number(map.totalCharges?.amount ?? map.totalCharges ?? 0)
                  ? Math.round(
                      (Number(map.outstanding?.amount ?? map.outstanding ?? 0) /
                        Number(map.totalCharges?.amount ?? map.totalCharges ?? 1)) *
                        100,
                    )
                  : 0,
              },
              {
                number: '04',
                title: 'Paid',
                amount: map.paid ?? 0,
                caption: `Denied ${money(map.denied ?? 0)}`,
                icon: CircleDollarSign,
                share: Number(map.totalCharges?.amount ?? map.totalCharges ?? 0)
                  ? Math.round(
                      (Number(map.paid?.amount ?? map.paid ?? 0) /
                        Number(map.totalCharges?.amount ?? map.totalCharges ?? 1)) *
                        100,
                    )
                  : 0,
              },
            ].map((stage, index, list) => (
              <div className="ax-flow-node" key={stage.title}>
                <span className="ax-flow-index">{stage.number}</span>
                <div className="ax-flow-orb">
                  <stage.icon size={18} />
                </div>
                <strong>{stage.title}</strong>
                <b>{money(stage.amount)}</b>
                <small>{stage.caption}</small>
                <div className="ax-flow-meter" aria-hidden>
                  <i style={{ width: `${Math.max(stage.share, 8)}%` }} />
                </div>
                <em>{stage.share}% of charges</em>
                {index < list.length - 1 ? <ChevronRight className="ax-flow-arrow" size={16} /> : null}
              </div>
            ))}
          </div>
          <div className="ax-flow-chart">
            <div className="ax-flow-chart-head">
              <span className="ax-kicker">Stage conversion</span>
              <strong>Cash movement across the cycle</strong>
            </div>
            <ResponsiveContainer width="100%" height={170}>
              <BarChart
                data={[
                  { stage: 'Charges', amount: Number(map.totalCharges?.amount ?? map.totalCharges ?? 0) },
                  { stage: 'Billed', amount: Number(map.billed?.amount ?? map.billed ?? 0) },
                  { stage: 'Outstanding', amount: Number(map.outstanding?.amount ?? map.outstanding ?? 0) },
                  { stage: 'Paid', amount: Number(map.paid?.amount ?? map.paid ?? 0) },
                ]}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="stage" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
                <Tooltip formatter={(value: number) => money(value)} contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))' }} />
                <Bar dataKey="amount" radius={[7, 7, 0, 0]} fill="#2a9d8f" />
              </BarChart>
            </ResponsiveContainer>
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
                Today's actions <em>{String(actions.length).padStart(2, '0')}</em>
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
      <section className="ax-signal-card" aria-label="Velora signal">
        <div className="ax-signal-card-icon">
          <Sparkles size={18} />
        </div>
        <div className="ax-signal-card-body">
          <span className="ax-kicker">Velora signal</span>
          <p>{signal}</p>
          <small>Prioritized from leakage, SLA pressure and open work-item value.</small>
        </div>
        <button type="button" className="ax-primary-button" onClick={() => onNavigate('leakage')} data-testid="button-open-signal">
          Open signal <ArrowRight size={13} />
        </button>
      </section>
      {(recommendations.data?.summary ?? []).length > 1 ? (
        <section className="ax-panel">
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
  const [module, setModule] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [sortBy, setSortBy] = useState<'impact' | 'priority' | 'due'>('impact');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [actionMessage, setActionMessage] = useState('');

  const workItems = useQuery({ queryKey: ['work-items'], queryFn: () => api.workItems() });
  const complete = useMutation({
    mutationFn: (id: string) => api.updateWorkItem(id, { status: 'COMPLETED' }),
    onSuccess: () => {
      setActionMessage('Work item marked complete.');
      void queryClient.invalidateQueries({ queryKey: ['work-items'] });
    },
  });
  const escalate = useMutation({
    mutationFn: (id: string) => api.updateWorkItem(id, { status: 'IN_PROGRESS', assignedUser: 'Escalation desk' }),
    onSuccess: () => {
      setActionMessage('Work item escalated to the escalation desk.');
      void queryClient.invalidateQueries({ queryKey: ['work-items'] });
    },
  });
  const startWork = useMutation({
    mutationFn: (id: string) => api.updateWorkItem(id, { status: 'IN_PROGRESS' }),
    onSuccess: () => {
      setActionMessage('Work item moved to In progress.');
      void queryClient.invalidateQueries({ queryKey: ['work-items'] });
    },
  });

  const items = (workItems.data ?? []).filter((item: any) => item.status !== 'COMPLETED');
  const modules = useMemo(
    () => Array.from(new Set(items.map((item: any) => item.module).filter(Boolean))) as string[],
    [items],
  );
  const statuses = useMemo(
    () => Array.from(new Set(items.map((item: any) => item.status).filter(Boolean))) as string[],
    [items],
  );
  const priorities = useMemo(
    () => Array.from(new Set(items.map((item: any) => item.priority).filter(Boolean))) as string[],
    [items],
  );

  const priorityRank: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

  const visible = useMemo(() => {
    const filtered = items
      .filter((item: any) =>
        [item.title, item.id, item.payer, item.reason, item.module].join(' ').toLowerCase().includes(query.toLowerCase()),
      )
      .filter((item: any) => !module || item.module === module)
      .filter((item: any) => !status || item.status === status)
      .filter((item: any) => !priority || item.priority === priority);

    return [...filtered].sort((a: any, b: any) => {
      if (sortBy === 'priority') {
        return (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9);
      }
      if (sortBy === 'due') {
        return new Date(a.dueAt ?? 0).getTime() - new Date(b.dueAt ?? 0).getTime();
      }
      return Number(b.valueAtRisk?.amount ?? b.valueAtRisk ?? 0) - Number(a.valueAtRisk?.amount ?? a.valueAtRisk ?? 0);
    });
  }, [items, query, module, status, priority, sortBy]);

  const selected = items.find((item: any) => item.id === selectedId) ?? visible[0];
  const filtersActive = Boolean(module || status || priority || query);

  const clearFilters = () => {
    setQuery('');
    setModule('');
    setStatus('');
    setPriority('');
  };

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
        <label className="ax-filter-field">
          <span>Module</span>
          <select value={module} onChange={(event) => setModule(event.target.value)} aria-label="Filter by module" data-testid="select-filter-module">
            <option value="">All modules</option>
            {modules.map((value) => (
              <option key={value} value={value}>
                {formatLabel(value)}
              </option>
            ))}
          </select>
        </label>
        <label className="ax-filter-field">
          <span>Status</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter by status" data-testid="select-filter-status">
            <option value="">All statuses</option>
            {(statuses.length ? statuses : ['OPEN', 'IN_PROGRESS', 'READY', 'BLOCKED']).map((value) => (
              <option key={value} value={value}>
                {formatLabel(value)}
              </option>
            ))}
          </select>
        </label>
        <label className="ax-filter-field">
          <span>Priority</span>
          <select value={priority} onChange={(event) => setPriority(event.target.value)} aria-label="Filter by priority" data-testid="select-filter-priority">
            <option value="">All priorities</option>
            {(priorities.length ? priorities : ['HIGH', 'MEDIUM', 'LOW']).map((value) => (
              <option key={value} value={value}>
                {formatLabel(value)}
              </option>
            ))}
          </select>
        </label>
        <button
          className={`ax-icon-button ${showAdvanced || filtersActive ? 'ax-filter-active' : ''}`}
          type="button"
          aria-label="More filters"
          aria-pressed={showAdvanced}
          onClick={() => setShowAdvanced((open) => !open)}
          data-testid="button-more-filters"
        >
          <Filter size={16} />
        </button>
      </div>
      {showAdvanced ? (
        <div className="ax-queue-advanced">
          <label className="ax-filter-field">
            <span>Sort</span>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value as 'impact' | 'priority' | 'due')} aria-label="Sort work items" data-testid="select-sort-queue">
              <option value="impact">Impact (value)</option>
              <option value="priority">Priority</option>
              <option value="due">Due date</option>
            </select>
          </label>
          <button className="ax-outline-button" type="button" onClick={clearFilters} disabled={!filtersActive} data-testid="button-clear-filters">
            Clear filters
          </button>
        </div>
      ) : null}
      {actionMessage ? <p className="ax-inline-success">{actionMessage}</p> : null}
      <div className="ax-queue-layout">
        <section className="ax-panel ax-queue-list">
          <div className="ax-panel-head">
            <div>
              <span className="ax-kicker">Active queue</span>
              <h2>
                {visible.length} items{' '}
                <em>
                  · {money(visible.reduce((sum: number, item: any) => sum + (item.valueAtRisk?.amount ?? item.valueAtRisk ?? 0), 0))} value
                </em>
              </h2>
            </div>
            <span className="ax-sort-label">Sort · {formatLabel(sortBy)}</span>
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
              {filtersActive ? (
                <button className="ax-outline-button" type="button" onClick={clearFilters}>
                  Reset filters
                </button>
              ) : null}
            </div>
          ) : (
            visible.map((item: any) => (
              <button
                type="button"
                className={`ax-queue-row ${selected?.id === item.id ? 'selected' : ''}`}
                key={item.id}
                onClick={() => {
                  setSelectedId(item.id);
                  setActionMessage('');
                }}
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
                {selected.status === 'OPEN' || selected.status === 'READY' ? (
                  <button
                    className="ax-outline-button"
                    type="button"
                    disabled={startWork.isPending}
                    onClick={() => startWork.mutate(selected.id)}
                    data-testid={`button-start-${selected.id}`}
                  >
                    <Activity size={14} /> {startWork.isPending ? 'Starting…' : 'Start work'}
                  </button>
                ) : null}
                <button
                  className="ax-primary-button"
                  type="button"
                  disabled={complete.isPending}
                  onClick={() => complete.mutate(selected.id)}
                  data-testid={`button-complete-${selected.id}`}
                >
                  <Check size={15} /> {complete.isPending ? 'Completing…' : 'Mark complete'}
                </button>
                <button
                  className="ax-outline-button"
                  type="button"
                  disabled={escalate.isPending}
                  onClick={() => escalate.mutate(selected.id)}
                  data-testid={`button-escalate-${selected.id}`}
                >
                  <ArrowUpRight size={14} /> {escalate.isPending ? 'Escalating…' : 'Escalate'}
                </button>
              </div>
              {complete.isError || escalate.isError || startWork.isError ? (
                <p className="ax-inline-error">
                  {((complete.error || escalate.error || startWork.error) as Error).message}
                </p>
              ) : null}
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
  const queryClient = useQueryClient();
  const [resultByCoverage, setResultByCoverage] = useState<Record<string, any>>({});
  const [estimateByCoverage, setEstimateByCoverage] = useState<Record<string, any>>({});
  const coverages = useQuery({ queryKey: ['coverages'], queryFn: api.coverages });
  const check = useMutation({
    mutationFn: (coverageId: string) => api.eligibilityCheck(coverageId),
    onSuccess: (data, coverageId) => {
      setResultByCoverage((current) => ({ ...current, [coverageId]: data }));
      void queryClient.invalidateQueries({ queryKey: ['work-items'] });
      void queryClient.invalidateQueries({ queryKey: ['coverages'] });
    },
  });
  const estimate = useMutation({
    mutationFn: (body: { coverageId: string; chargedAmount: number }) => api.createEstimate(body),
    onSuccess: (data, vars) => setEstimateByCoverage((current) => ({ ...current, [vars.coverageId]: data })),
  });

  if (coverages.isLoading) return <div className="ax-view"><LoadingState label="Loading coverages…" /></div>;
  if (coverages.error) return <div className="ax-view"><ErrorState error={coverages.error} onRetry={() => void coverages.refetch()} /></div>;

  const list = coverages.data ?? [];

  return (
    <div className="ax-view">
      <SectionHeading
        eyebrow="Patient financial access"
        title="Eligibility & estimates"
        detail="Verify coverage, then estimate patient responsibility before service — Layer 1 of the RCM platform."
      />
      <section className="ax-panel ax-table-panel">
        <div className="ax-panel-head">
          <div>
            <span className="ax-kicker">Coverage inventory</span>
            <h2>{list.length} coverages</h2>
          </div>
        </div>
        <div className="ax-claims-table">
          <div className="ax-table-head ax-table-head-5">
            <span>Coverage</span>
            <span>Plan / member</span>
            <span>Responsibility</span>
            <span>Status</span>
            <span>Action</span>
          </div>
          {list.map((coverage: any) => {
            const result = resultByCoverage[coverage.id];
            const est = estimateByCoverage[coverage.id];
            const insight = parseAiInsight(result?.insight ?? result?.ai?.output);
            return (
              <div className="ax-claim-row ax-claim-row-5" key={coverage.id} data-testid={`row-coverage-${coverage.id}`}>
                <span>
                  <b>{coverage.id}</b>
                  <small>Patient {coverage.patientId}</small>
                </span>
                <span>
                  <b>{coverage.planName}</b>
                  <small>{coverage.memberId}</small>
                </span>
                <strong className="ax-claim-amount">
                  {money(coverage.deductibleRemaining ?? 0)}
                  <small>
                    Copay {money(coverage.copay ?? 0)} · Coins {coverage.coinsurancePercent}%
                  </small>
                </strong>
                <StatusPill tone={statusTone(coverage.status)}>{formatLabel(coverage.status)}</StatusPill>
                <span className="ax-row-actions">
                  <button
                    className="ax-outline-button"
                    type="button"
                    disabled={check.isPending}
                    onClick={() => check.mutate(coverage.id)}
                    data-testid={`button-eligibility-${coverage.id}`}
                  >
                    {check.isPending && check.variables === coverage.id ? 'Checking…' : 'Run check'}
                  </button>
                  <button
                    className="ax-outline-button"
                    type="button"
                    disabled={estimate.isPending}
                    onClick={() => estimate.mutate({ coverageId: coverage.id, chargedAmount: 1000 })}
                    data-testid={`button-estimate-${coverage.id}`}
                  >
                    {estimate.isPending && estimate.variables?.coverageId === coverage.id ? 'Estimating…' : 'Estimate $1k'}
                  </button>
                </span>
                {result ? (
                  <InsightCard
                    title="Eligibility result"
                    statusLabel={result.active ? 'Active' : 'Inactive'}
                    statusToneValue={result.active ? 'teal' : 'coral'}
                    confidence={result.ai?.confidence}
                    insight={insight}
                    meta={
                      result.patientResponsibilityEstimate ? (
                        <div className="ax-insight-meta">
                          <span>
                            Deductible rem. <b>{money(result.patientResponsibilityEstimate.deductible)}</b>
                          </span>
                          <span>
                            Copay <b>{money(result.patientResponsibilityEstimate.copay)}</b>
                          </span>
                          <span>
                            Coinsurance <b>{result.patientResponsibilityEstimate.coinsurancePercent}%</b>
                          </span>
                        </div>
                      ) : null
                    }
                  />
                ) : null}
                {est && !est.error ? (
                  <div className="ax-insight-card ax-insight-card-estimate" style={{ gridColumn: '1 / -1' }}>
                    <div className="ax-insight-card-top">
                      <div>
                        <span className="ax-kicker">Patient estimate</span>
                        <h3>Responsibility on a $1,000 charge</h3>
                      </div>
                      <StatusPill tone="blue">Estimate</StatusPill>
                    </div>
                    <div className="ax-insight-meta">
                      <span>
                        Patient pays <b>{money(est.patientResponsibility)}</b>
                      </span>
                      <span>
                        Payer expected <b>{money(est.expectedPayerPayment)}</b>
                      </span>
                      <span>
                        Deductible applied <b>{money(est.breakdown?.deductibleApplied)}</b>
                      </span>
                      <span>
                        Copay <b>{money(est.breakdown?.copay)}</b>
                      </span>
                      <span>
                        Coinsurance <b>{money(est.breakdown?.coinsurance)}</b>
                      </span>
                    </div>
                  </div>
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
  const queryClient = useQueryClient();
  const [evalResult, setEvalResult] = useState<any>(null);
  const auth = useQuery({ queryKey: ['authorizations-risk'], queryFn: api.authorizationsRisk });
  const patients = useQuery({ queryKey: ['patients'], queryFn: api.patients });
  const evaluate = useMutation({
    mutationFn: api.evaluateAuthorization,
    onSuccess: (data) => {
      setEvalResult(data);
      void queryClient.invalidateQueries({ queryKey: ['authorizations-risk'] });
      void queryClient.invalidateQueries({ queryKey: ['work-items'] });
    },
  });

  if (auth.isLoading) return <div className="ax-view"><LoadingState label="Loading authorizations…" /></div>;
  if (auth.error) return <div className="ax-view"><ErrorState error={auth.error} onRetry={() => void auth.refetch()} /></div>;

  const data = auth.data ?? {};
  const items = data.items ?? [];
  const firstPatientId = patients.data?.[0]?.id as string | undefined;

  return (
    <div className="ax-view">
      <SectionHeading
        eyebrow="Patient financial access"
        title="Authorizations"
        detail="Evaluate auth rules before service. Missing auth creates an AUTH_REQUIRED work item — denial prevented."
      />
      <div className="ax-metrics">
        <Metric label="Expires in 7 days" value={String(data.expiresWithin7Days ?? 0)} icon={Clock3} tone="amber" />
        <Metric label="Missing / denied" value={String(data.missingAuthorization ?? 0)} icon={ShieldAlert} tone="coral" />
        <Metric label="Visits almost exhausted" value={String(data.visitsAlmostExhausted ?? 0)} icon={AlertCircle} tone="amber" />
        <Metric label="Pending payer" value={String(data.pendingPayerResponse ?? 0)} icon={Activity} tone="blue" />
      </div>
      <section className="ax-panel" style={{ marginBottom: 16 }}>
        <div className="ax-panel-head">
          <div>
            <span className="ax-kicker">Pre-service rules</span>
            <h2>Evaluate MRI authorization</h2>
          </div>
          <button
            className="ax-outline-button"
            type="button"
            disabled={!firstPatientId || evaluate.isPending}
            onClick={() =>
              firstPatientId &&
              evaluate.mutate({ patientId: firstPatientId, procedureCode: '70553', diagnosisCode: 'M54.5' })
            }
            data-testid="button-evaluate-auth"
          >
            {evaluate.isPending ? 'Evaluating…' : 'Run auth rules (70553)'}
          </button>
        </div>
        {evalResult ? (
          <p className="ax-mono" style={{ padding: '0 16px 16px', margin: 0 }}>
            Required: {String(evalResult.authorizationRequired)} · Work item:{' '}
            {evalResult.workItem?.id ?? 'none'} · {evalResult.workItem?.title ?? evalResult.existingAuthorization?.status ?? '—'}
          </p>
        ) : null}
      </section>
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
          ? `Billed ${id} â†’ draft claim ${data.claim.claimNumber ?? data.claim.id}`
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
  const [lastScrub, setLastScrub] = useState<any>(null);
  const claims = useQuery({ queryKey: ['claims'], queryFn: api.claims });
  const detail = useQuery({
    queryKey: ['claim', selectedId],
    queryFn: () => api.claim(selectedId),
    enabled: Boolean(selectedId),
  });
  const scrub = useMutation({
    mutationFn: (id: string) => api.scrubClaim(id),
    onSuccess: (data, id) => {
      setLastScrub(data);
      const blocked = data?.blockingCount ?? 0;
      const warned = data?.warningCount ?? 0;
      const score = data?.claim?.qualityScore ?? data?.qualityScore ?? '—';
      setActionNote(
        `Scrubbed ${id}: score ${score} · ${data?.evaluatedRules ?? 0} rules evaluated · ${blocked} blocking · ${warned} warnings${data?.ready ? ' · READY' : ' · held as DRAFT'}`,
      );
      setSelectedId(id);
      void queryClient.invalidateQueries({ queryKey: ['claims'] });
      void queryClient.invalidateQueries({ queryKey: ['claim', id] });
      void queryClient.invalidateQueries({ queryKey: ['work-items'] });
    },
    onError: (error) => setActionNote((error as Error).message),
  });
  const submit = useMutation({
    mutationFn: (id: string) => api.submitClaim(id),
    onSuccess: (data, id) => {
      const ack = data?.acknowledgement;
      const gw = data?.gateway;
      setActionNote(
        `Submitted ${id} via ${gw?.adapter ?? 'adapter'} â†’ ${gw?.clearinghouse ?? gw?.standard ?? 'gateway'}` +
          (ack
            ? ` · ACK ${ack.outcome} (${ack.ackCode})`
            : ''),
      );
      setLastScrub(null);
      void queryClient.invalidateQueries({ queryKey: ['claims'] });
      void queryClient.invalidateQueries({ queryKey: ['claim', id] });
      void queryClient.invalidateQueries({ queryKey: ['work-items'] });
      void queryClient.invalidateQueries({ queryKey: ['gateway-submissions'] });
    },
    onError: (error) => setActionNote((error as Error).message),
  });
  const submissions = useQuery({
    queryKey: ['gateway-submissions', selectedId],
    queryFn: () => api.gatewaySubmissions(selectedId),
    enabled: Boolean(selectedId),
  });

  if (claims.isLoading) return <div className="ax-view"><LoadingState label="Loading claims…" /></div>;
  if (claims.error) return <div className="ax-view"><ErrorState error={claims.error} onRetry={() => void claims.refetch()} /></div>;

  const list = claims.data ?? [];
  const total = list.reduce((sum: number, claim: any) => sum + (claim.grossAmount?.amount ?? 0), 0);
  const claimDetail = detail.data?.claim;
  const events = detail.data?.events ?? [];
  const validations = detail.data?.validations ?? [];
  const lines = detail.data?.lines ?? [];
  const firedFromEvent = [...events]
    .reverse()
    .find((event: any) => event.eventType === 'ClaimValidated' && Array.isArray(event.payload?.firedRules))
    ?.payload?.firedRules;
  const firedRules =
    (lastScrub?.claim?.id === selectedId ? lastScrub?.firedRules : null) ??
    firedFromEvent ??
    [];

  return (
    <div className="ax-view">
      <SectionHeading
        eyebrow="Billing engine"
        title="Claims"
        detail="Executable RuleVersion scrub — quality, payer context and denial risk before submission."
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
              <p>Open a claim to inspect scrub layers, fired rules and line detail.</p>
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
                    <p>No scrub results yet — run Scrub to evaluate RuleVersions.</p>
                  ) : (
                    validations.map((layer: any) => (
                      <div className="ax-scrub-layer" key={layer.id ?? layer.layer}>
                        <StatusPill tone={statusTone(layer.status)}>{formatLabel(layer.status)}</StatusPill>
                        <span>
                          <b>{layer.layer}</b>
                          <small>
                            {layer.message}
                            {layer.ruleId ? ` · ${layer.ruleId}` : ''}
                          </small>
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
              {firedRules.length > 0 ? (
                <div className="ax-reason">
                  <span className="ax-kicker">Fired rules</span>
                  <div className="ax-scrub-layers">
                    {firedRules.map((rule: any) => (
                      <div className="ax-scrub-layer" key={`${rule.ruleKey}-${rule.action}`}>
                        <StatusPill
                          tone={
                            rule.severity === 'BLOCKING' ? 'coral' : rule.severity === 'WARNING' ? 'amber' : 'teal'
                          }
                        >
                          {formatLabel(rule.severity)}
                        </StatusPill>
                        <span>
                          <b>{rule.ruleKey}</b>
                          <small>
                            {rule.layer} · {rule.action} · {rule.message}
                          </small>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="ax-reason">
                <span className="ax-kicker">Gateway / clearinghouse</span>
                {(submissions.data ?? []).length === 0 ? (
                  <p>No submissions yet — Submit a READY claim to translate via country adapter.</p>
                ) : (
                  <div className="ax-scrub-layers">
                    {(submissions.data ?? []).slice(0, 3).map((row: any) => (
                      <div className="ax-scrub-layer" key={row.id}>
                        <StatusPill
                          tone={
                            row.status === 'ACK_ACCEPTED'
                              ? 'teal'
                              : row.status === 'ACK_REJECTED'
                                ? 'coral'
                                : 'amber'
                          }
                        >
                          {formatLabel(row.status)}
                        </StatusPill>
                        <span>
                          <b>
                            {row.adapterKey} · {row.outboundFormat}
                          </b>
                          <small>
                            {row.clearinghouse}
                            {row.ackCode ? ` · ACK ${row.ackCode}` : ''}
                            {row.ackMessage ? ` — ${row.ackMessage}` : ''}
                            {row.controlNumber ? ` · ctl ${row.controlNumber}` : ''}
                          </small>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {(submissions.data ?? [])[0]?.wirePreview ? (
                  <pre
                    className="ax-mono"
                    style={{
                      marginTop: 10,
                      maxHeight: 160,
                      overflow: 'auto',
                      whiteSpace: 'pre-wrap',
                      fontSize: 11,
                      opacity: 0.85,
                    }}
                  >
                    {(submissions.data ?? [])[0].wirePreview}
                  </pre>
                ) : null}
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
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<any>(null);
  const denials = useQuery({ queryKey: ['denials'], queryFn: api.denials });
  const knowledge = useQuery({ queryKey: ['denial-knowledge'], queryFn: api.denialKnowledge });
  const analyze = useMutation({
    mutationFn: (id: string) => api.analyzeDenial(id),
    onSuccess: (data) => {
      setAiResult(data);
      void queryClient.invalidateQueries({ queryKey: ['denials'] });
      void queryClient.invalidateQueries({ queryKey: ['denial-knowledge'] });
      void queryClient.invalidateQueries({ queryKey: ['rules'] });
    },
  });
  const appeal = useMutation({
    mutationFn: (id: string) => api.appealDraft(id),
    onSuccess: setAiResult,
  });

  if (denials.isLoading) return <div className="ax-view"><LoadingState label="Loading denials…" /></div>;
  if (denials.error) return <div className="ax-view"><ErrorState error={denials.error} onRetry={() => void denials.refetch()} /></div>;

  const list = denials.data ?? [];
  const knowledgeRows = knowledge.data ?? [];
  const valueAtRisk = list.reduce((sum: number, denial: any) => sum + (denial.amount?.amount ?? 0), 0);
  const avgRecovery =
    list.length === 0
      ? 0
      : Math.round((list.reduce((sum: number, denial: any) => sum + (denial.recoveryProbability ?? 0), 0) / list.length) * 100);

  return (
    <div className="ax-view">
      <SectionHeading
        eyebrow="Recovery + prevention"
        title="Denials & appeals"
        detail="Analyze root cause â†’ write Denial Knowledge Base entry â†’ promote executable scrub RuleVersion so the next claim is blocked before submission."
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
          <span>Prevention rules</span>
          <strong>{knowledgeRows.length}</strong>
          <small>Denial â†’ scrub feedback</small>
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
                  Analyze + prevent
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
              <span className="ax-kicker">AI assist + prevention</span>
              <h2>{selected ?? 'Denial'} analysis</h2>
            </div>
          </div>
          <div className="ax-reason">
            <p>
              {(aiResult.ai?.output || aiResult.draft || aiResult.appealDraft || JSON.stringify(aiResult).slice(0, 500))}
            </p>
            {aiResult.preventionRule ? (
              <p className="ax-mono" style={{ marginTop: 12 }}>
                Prevention rule: {aiResult.preventionRule.ruleKey} v{aiResult.preventionRule.version} ·{' '}
                {aiResult.preventionRule.action} · {aiResult.preventionRule.severity}
                {aiResult.scrubHint ? ` — ${aiResult.scrubHint}` : ''}
              </p>
            ) : null}
          </div>
        </section>
      ) : null}
      {knowledgeRows.length > 0 ? (
        <section className="ax-panel ax-table-panel" style={{ marginTop: '1rem' }}>
          <div className="ax-panel-head">
            <div>
              <span className="ax-kicker">Denial knowledge base</span>
              <h2>{knowledgeRows.length} prevention links</h2>
            </div>
          </div>
          <div className="ax-claims-table">
            <div className="ax-table-head">
              <span>Denial</span>
              <span>Root cause</span>
              <span>Prevention rule</span>
              <span>Procedures</span>
            </div>
            {knowledgeRows.map((row: any) => (
              <div className="ax-claim-row" key={row.id} data-testid={`row-dkb-${row.id}`}>
                <span>
                  <b>{row.denialId}</b>
                  <small>{row.reasonCode}</small>
                </span>
                <span>
                  <b>{row.rootCause}</b>
                  <small>{row.category}</small>
                </span>
                <span>
                  <b>{row.preventionRuleKey}</b>
                  <small>{row.summary}</small>
                </span>
                <span className="ax-mono">{(row.procedureCodes ?? []).join(', ') || '—'}</span>
              </div>
            ))}
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
  const queryClient = useQueryClient();
  const [checkByPayment, setCheckByPayment] = useState<Record<string, any>>({});
  const [eraNote, setEraNote] = useState('');
  const [lastEra, setLastEra] = useState<any>(null);
  const payments = useQuery({ queryKey: ['payments'], queryFn: api.payments });
  const claims = useQuery({ queryKey: ['claims'], queryFn: api.claims });
  const contractCheck = useMutation({
    mutationFn: (paymentId: string) => api.contractCheckPayment(paymentId),
    onSuccess: (data, paymentId) => {
      setCheckByPayment((current) => ({ ...current, [paymentId]: data }));
      void queryClient.invalidateQueries({ queryKey: ['payments'] });
      void queryClient.invalidateQueries({ queryKey: ['work-items'] });
    },
  });
  const postEra = useMutation({
    mutationFn: (claimId: string) => api.eraDemoPost(claimId, true),
    onSuccess: (data) => {
      if (data?.error) {
        setEraNote(String(data.error));
        return;
      }
      setLastEra(data);
      setEraNote(
        `ERA ${data?.remittance?.remittanceNumber ?? ''} posted · ${data?.postedCount ?? 0} payment(s)` +
          (data?.underpaymentCount ? ` · ${data.underpaymentCount} underpayment work item(s)` : ''),
      );
      void queryClient.invalidateQueries({ queryKey: ['payments'] });
      void queryClient.invalidateQueries({ queryKey: ['claims'] });
      void queryClient.invalidateQueries({ queryKey: ['work-items'] });
    },
    onError: (error) => setEraNote((error as Error).message),
  });

  if (payments.isLoading) return <div className="ax-view"><LoadingState label="Loading payments…" /></div>;
  if (payments.error) return <div className="ax-view"><ErrorState error={payments.error} onRetry={() => void payments.refetch()} /></div>;

  const remittances = payments.data?.remittances ?? [];
  const paymentRows = payments.data?.payments ?? [];
  const contracts = payments.data?.contracts ?? [];
  const eraTargets = (claims.data ?? []).filter((c: any) =>
    ['READY', 'ACCEPTED', 'SUBMITTED', 'PENDING', 'ADJUDICATED'].includes(c.status),
  );
  const preferredTarget =
    eraTargets.find((c: any) => c.id === 'CLM-240816') ??
    eraTargets.find((c: any) => c.countryId === 'US') ??
    eraTargets[0];

  return (
    <div className="ax-view">
      <SectionHeading
        eyebrow="Reimbursement"
        title="ERA posting & payments"
        detail="Ingest remittance (835-shaped), auto-post to claims, compare to contract expected, open UNDERPAYMENT_REVIEW when short."
        action={
          <button
            className="ax-primary-button"
            type="button"
            disabled={!preferredTarget || postEra.isPending}
            onClick={() => preferredTarget && postEra.mutate(preferredTarget.id)}
            data-testid="button-era-demo-post"
          >
            {postEra.isPending
              ? 'Posting ERA…'
              : preferredTarget
                ? `Post demo ERA (${preferredTarget.id})`
                : 'No eligible claim'}
          </button>
        }
      />
      {eraNote ? (
        <div className="ax-insight-strip">
          <Sparkles size={17} />
          <span>{eraNote}</span>
        </div>
      ) : null}
      <div className="ax-metrics">
        <Metric label="Remittances" value={String(remittances.length)} icon={FileText} />
        <Metric label="Payments" value={String(paymentRows.length)} icon={BadgeDollarSign} tone="coral" />
        <Metric label="Contracts" value={String(contracts.length)} icon={Building2} tone="blue" />
      </div>
      <div className="ax-leakage-layout">
        <section className="ax-panel">
          <div className="ax-panel-head">
            <div>
              <span className="ax-kicker">Remittances / ERA</span>
              <h2>{remittances.length} received</h2>
            </div>
          </div>
          <div className="ax-opportunity-list">
            {remittances.map((remit: any) => (
              <div className="ax-opportunity" key={remit.id}>
                <span className="ax-rank">RM</span>
                <span>
                  <b>{remit.remittanceNumber ?? remit.id}</b>
                  <small>
                    {[remit.format, remit.status, remit.checkOrEftNumber].filter(Boolean).join(' · ') ||
                      (remit.receivedAt ? new Date(remit.receivedAt).toLocaleString() : '—')}
                  </small>
                </span>
                <strong>{money(remit.paidAmount ?? 0)}</strong>
              </div>
            ))}
          </div>
          {(lastEra?.remittance?.wirePreview ?? remittances[0]?.wirePreview) ? (
            <pre
              className="ax-mono"
              style={{
                margin: '12px 16px 16px',
                maxHeight: 140,
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                fontSize: 11,
                opacity: 0.85,
              }}
            >
              {lastEra?.remittance?.wirePreview ?? remittances[0]?.wirePreview}
            </pre>
          ) : null}
        </section>
        <section className="ax-panel">
          <div className="ax-panel-head">
            <div>
              <span className="ax-kicker">Payment variances</span>
              <h2>{paymentRows.length} postings</h2>
            </div>
          </div>
          <div className="ax-claims-table">
            {paymentRows.map((payment: any) => {
              const checked = checkByPayment[payment.id];
              return (
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
                  <button
                    className="ax-outline-button"
                    type="button"
                    disabled={contractCheck.isPending}
                    onClick={() => contractCheck.mutate(payment.id)}
                    data-testid={`button-contract-check-${payment.id}`}
                  >
                    {contractCheck.isPending && contractCheck.variables === payment.id ? 'Checking…' : 'Contract check'}
                  </button>
                  {checked ? (
                    <span className="ax-mono" style={{ gridColumn: '1 / -1' }}>
                      {checked.underpaid ? 'Underpaid' : 'On contract'} · gap{' '}
                      {money(checked.underpaymentAmount ?? 0)}
                      {checked.workItem ? ` · work ${checked.workItem.id}` : ''}
                    </span>
                  ) : null}
                </div>
              );
            })}
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
  const adapters = useQuery({ queryKey: ['gateway-adapters'], queryFn: api.gatewayAdapters });

  if (packs.isLoading) return <div className="ax-view"><LoadingState label="Loading country packs…" /></div>;
  if (packs.error) return <div className="ax-view"><ErrorState error={packs.error} onRetry={() => void packs.refetch()} /></div>;

  const list = packs.data ?? [];
  const pack = list.find((item: any) => item.code === selected) ?? list[0];
  const adapterMeta = (adapters.data?.adapters ?? []).find((a: any) => a.key === pack?.adapterKey);

  return (
    <div className="ax-view">
      <SectionHeading
        eyebrow="Integration hub"
        title="Country packs"
        detail="Each pack binds a claim standard, coding systems, and a country adapter that translates the canonical claim for clearinghouse submission."
      />
      <div className="ax-pack-disclaimer">
        <Globe2 size={15} />
        <span>
          Adapters produce simulated X12 / NPHIES / DHA payloads today. Wire previews are for architecture validation, not production clearinghouse certification.
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
                  {item.adapterKey ?? 'generic'} · {item.claimStandard}
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
            <div className="ax-detail-list" style={{ marginBottom: 16 }}>
              <div>
                <span>Adapter</span>
                <b>{pack.adapterKey ?? 'generic'}</b>
              </div>
              <div>
                <span>Standard</span>
                <b>{pack.claimStandard}</b>
              </div>
              <div>
                <span>Clearinghouse</span>
                <b>{pack.clearinghouse ?? '—'}</b>
              </div>
              <div>
                <span>Adapter label</span>
                <b>{adapterMeta?.label ?? '—'}</b>
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
      <SectionHeading
        eyebrow="Policy engine"
        title="Rules"
        detail="Executable RuleVersions drive claim scrub. Latest effective version per ruleKey is evaluated by layer."
      />
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
            <span>Layer / scope</span>
            <span>Predicate</span>
            <span>Severity</span>
            <span>Source</span>
          </div>
          {list.map((rule: any) => (
            <div className="ax-claim-row" key={rule.id} data-testid={`row-rule-${rule.id}`}>
              <span>
                <b>{rule.ruleKey}</b>
                <small>
                  v{rule.version} · {rule.action}
                </small>
              </span>
              <span>
                <b>{rule.layer ?? '—'}</b>
                <small>
                  {[rule.country, rule.payerId, rule.specialty].filter(Boolean).join(' · ') || 'All'}
                </small>
              </span>
              <span>
                <b>{rule.predicate?.kind ?? '—'}</b>
                <small>{rule.conditions}</small>
              </span>
              <StatusPill tone={rule.severity === 'BLOCKING' ? 'coral' : rule.severity === 'WARNING' ? 'amber' : 'teal'}>
                {formatLabel(rule.severity)}
              </StatusPill>
              <span>
                <StatusPill tone={rule.source === 'DENIAL_FEEDBACK' ? 'coral' : 'blue'}>
                  {formatLabel(rule.source ?? 'SEED')}
                </StatusPill>
                <small style={{ display: 'block' }}>{rule.effectiveFrom?.slice(0, 10)}</small>
              </span>
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
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [view, setView] = useState<WorkspaceView>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tenantOpen, setTenantOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [theme, setTheme] = useState<AppTheme>(() => readStoredTheme());
  const [busy, setBusy] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);
  const tenantRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const visibleNav = useMemo(
    () => navItems.filter((item) => canAccess(item.id)),
    [canAccess],
  );

  const workItemsQuery = useQuery({
    queryKey: ['work-items', 'header-notifications'],
    queryFn: () => api.workItems(),
    enabled: Boolean(user),
  });
  const recommendationsQuery = useQuery({
    queryKey: ['recommendations', 'header-notifications'],
    queryFn: api.recommendations,
    enabled: Boolean(user),
  });

  const notifications = useMemo(() => {
    const items = (workItemsQuery.data ?? [])
      .filter((item: any) => item.status !== 'COMPLETED' && (item.priority === 'HIGH' || item.status === 'BLOCKED'))
      .slice(0, 6)
      .map((item: any) => ({
        id: `wi-${item.id}`,
        title: item.title,
        detail: `${item.id} · ${formatLabel(item.priority)} · ${money(item.valueAtRisk ?? 0)}`,
        view: 'queue' as WorkspaceView,
      }));
    const signal = recommendationsQuery.data?.summary?.[0];
    if (signal) {
      items.unshift({
        id: 'signal-primary',
        title: 'Velora signal',
        detail: signal,
        view: 'leakage' as WorkspaceView,
      });
    }
    return items;
  }, [workItemsQuery.data, recommendationsQuery.data]);

  const unreadCount = notifications.filter((n) => !readNotificationIds.includes(n.id)).length;

  const changePassword = useMutation({
    mutationFn: () =>
      api.changePassword({
        currentPassword: passwordForm.current,
        newPassword: passwordForm.next,
      }),
    onSuccess: () => {
      setPasswordSuccess('Password updated successfully.');
      setPasswordError('');
      setPasswordForm({ current: '', next: '', confirm: '' });
    },
    onError: (error: Error) => {
      setPasswordError(error.message || 'Unable to change password.');
      setPasswordSuccess('');
    },
  });

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

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
      if (profileRef.current && !profileRef.current.contains(target)) setProfileOpen(false);
      if (notifRef.current && !notifRef.current.contains(target)) setNotifOpen(false);
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

  const submitPassword = (event: FormEvent) => {
    event.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');
    if (passwordForm.next.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }
    if (passwordForm.next !== passwordForm.confirm) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }
    changePassword.mutate();
  };

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
                      await queryClient.invalidateQueries();
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
            <div className={`ax-topbar-menu ${notifOpen ? 'open' : ''}`} ref={notifRef}>
              <button
                className="ax-icon-button"
                type="button"
                aria-label="Notifications"
                aria-expanded={notifOpen}
                onClick={() => {
                  setNotifOpen((open) => !open);
                  setProfileOpen(false);
                }}
                data-testid="button-notifications"
              >
                <Bell size={17} />
                {unreadCount > 0 ? <i className="ax-notification-dot" /> : null}
              </button>
              {notifOpen ? (
                <div className="ax-popover" role="menu" aria-label="Notifications">
                  <div className="ax-popover-head">
                    <div>
                      <b>Notifications</b>
                      <small>{unreadCount} unread</small>
                    </div>
                    <button
                      type="button"
                      className="ax-text-button"
                      onClick={() => setReadNotificationIds(notifications.map((n) => n.id))}
                      data-testid="button-mark-notifications-read"
                    >
                      Mark all read
                    </button>
                  </div>
                  {notifications.length === 0 ? (
                    <div className="ax-popover-empty">No active alerts.</div>
                  ) : (
                    notifications.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        role="menuitem"
                        className={readNotificationIds.includes(item.id) ? 'read' : ''}
                        onClick={() => {
                          setReadNotificationIds((ids) => (ids.includes(item.id) ? ids : [...ids, item.id]));
                          setView(item.view);
                          setNotifOpen(false);
                        }}
                        data-testid={`button-notification-${item.id}`}
                      >
                        <span>
                          <b>{item.title}</b>
                          <small>{item.detail}</small>
                        </span>
                        {!readNotificationIds.includes(item.id) ? <i className="ax-unread-dot" /> : null}
                      </button>
                    ))
                  )}
                </div>
              ) : null}
            </div>
            <div className={`ax-topbar-menu ${profileOpen ? 'open' : ''}`} ref={profileRef}>
              <button
                type="button"
                className="ax-topbar-avatar"
                aria-label="Profile menu"
                aria-haspopup="menu"
                aria-expanded={profileOpen}
                onClick={() => {
                  setProfileOpen((open) => !open);
                  setNotifOpen(false);
                }}
                data-testid="button-profile-menu"
              >
                {user.initials}
              </button>
              {profileOpen ? (
                <div className="ax-popover ax-popover-profile" role="menu" aria-label="Profile">
                  <div className="ax-popover-static">
                    <b>{user.name}</b>
                    <small>
                      {roleLabel} · {user.email}
                    </small>
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setView('settings');
                      setProfileOpen(false);
                    }}
                    data-testid="button-profile-settings"
                  >
                    <Settings size={14} /> Settings
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
                    }}
                    data-testid="button-toggle-theme"
                  >
                    {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                    {theme === 'dark' ? 'Light mode' : 'Dark mode'}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setPasswordOpen(true);
                      setProfileOpen(false);
                      setPasswordError('');
                      setPasswordSuccess('');
                    }}
                    data-testid="button-change-password"
                  >
                    <KeyRound size={14} /> Change password
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>
        {renderView(view, setView)}
        <footer className="ax-footer">
          <span className="ax-footer-brand">Velora Revenue OS · Revenue, made accountable.</span>
          <span className="ax-footer-meta">
            {tenant.name} · <b>{roleLabel}</b>
          </span>
        </footer>
      </div>

      {passwordOpen ? (
        <div className="ax-modal-backdrop" role="presentation" onClick={() => setPasswordOpen(false)}>
          <div
            className="ax-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ax-password-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="ax-modal-head">
              <div>
                <span className="ax-kicker">Account security</span>
                <h2 id="ax-password-title">Change password</h2>
              </div>
              <button className="ax-icon-button" type="button" aria-label="Close" onClick={() => setPasswordOpen(false)}>
                <X size={15} />
              </button>
            </div>
            <form className="ax-modal-form" onSubmit={submitPassword}>
              <label>
                Current password
                <input
                  type="password"
                  autoComplete="current-password"
                  value={passwordForm.current}
                  onChange={(event) => setPasswordForm((form) => ({ ...form, current: event.target.value }))}
                  required
                  data-testid="input-current-password"
                />
              </label>
              <label>
                New password
                <input
                  type="password"
                  autoComplete="new-password"
                  value={passwordForm.next}
                  onChange={(event) => setPasswordForm((form) => ({ ...form, next: event.target.value }))}
                  required
                  minLength={8}
                  data-testid="input-new-password"
                />
              </label>
              <label>
                Confirm new password
                <input
                  type="password"
                  autoComplete="new-password"
                  value={passwordForm.confirm}
                  onChange={(event) => setPasswordForm((form) => ({ ...form, confirm: event.target.value }))}
                  required
                  minLength={8}
                  data-testid="input-confirm-password"
                />
              </label>
              {passwordError ? <p className="ax-inline-error">{passwordError}</p> : null}
              {passwordSuccess ? <p className="ax-inline-success">{passwordSuccess}</p> : null}
              <div className="ax-modal-actions">
                <button className="ax-outline-button" type="button" onClick={() => setPasswordOpen(false)}>
                  Cancel
                </button>
                <button className="ax-primary-button" type="submit" disabled={changePassword.isPending} data-testid="button-submit-password">
                  {changePassword.isPending ? 'Saving…' : 'Update password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}
