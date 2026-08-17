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
import { Link, useLocation } from 'wouter';
import { api, asPercent, money } from '@/lib/api';
import { useAuth, isAdminRole } from '@/lib/auth';
import { toast } from '@/hooks/use-toast';
import { useAiCopilot } from '@/lib/ai-copilot';
import type { WorkspaceView } from './workspace-types';
import { AddPatientFlow } from './AddPatientFlow';
import { AddProviderFlow } from './AddProviderFlow';
import { PatientWorkspace } from './PatientWorkspace';
import { PayerMaster } from './PayerMaster';
import { ScheduleBoard } from './ScheduleBoard';
import { EncountersBoard } from './EncountersBoard';
import { RoleHome } from './RoleHome';
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
  { id: 'registration', label: 'Registration desk', icon: ClipboardPlus },
  { id: 'patients', label: 'Patients', icon: UsersRound },
  { id: 'schedule', label: 'Schedule', icon: CalendarDays },
  { id: 'providers', label: 'Providers', icon: Hospital },
  { id: 'payers', label: 'Payers', icon: Building2 },
  { id: 'eligibility', label: 'Eligibility', icon: UserRoundCheck },
  { id: 'authorizations', label: 'Authorizations', icon: ClipboardCheck },
  { id: 'encounters', label: 'Encounters', icon: ClipboardList },
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
    if (headline || summary) {
      return {
        headline: headline || 'Analysis complete',
        summary: summary || headline,
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
  const riskTone =
    insight?.riskLevel === 'high' ? 'coral' : insight?.riskLevel === 'low' ? 'teal' : insight?.riskLevel ? 'amber' : undefined;
  return (
    <div className="ax-insight-card" style={{ gridColumn: '1 / -1' }}>
      <div className="ax-insight-card-top">
        <div>
          <span className="ax-kicker">{title}</span>
          {insight?.headline ? <h3>{insight.headline}</h3> : <h3>Check complete</h3>}
        </div>
        <div className="ax-insight-card-badges">
          {statusLabel ? <StatusPill tone={statusToneValue ?? 'neutral'}>{statusLabel}</StatusPill> : null}
          {insight?.riskLevel ? (
            <StatusPill tone={riskTone as 'coral' | 'amber' | 'teal'}>{formatLabel(insight.riskLevel)} risk</StatusPill>
          ) : null}
          {confidence != null ? <span className="ax-insight-conf">{Math.round(confidence * 100)}% confidence</span> : null}
        </div>
      </div>
      {insight?.summary ? <p className="ax-insight-summary">{insight.summary}</p> : null}
      {(insight?.factors?.length || insight?.recommendations?.length) ? (
        <div className="ax-ai-columns">
          <div>
            <h3>Primary factors</h3>
            <ul>
              {(insight?.factors ?? []).map((factor) => (
                <li key={factor}>{factor}</li>
              ))}
              {!insight?.factors?.length ? <li>No factors returned</li> : null}
            </ul>
          </div>
          <div>
            <h3>Recommendations</h3>
            <ul>
              {(insight?.recommendations ?? []).map((item) => (
                <li key={item}>{item}</li>
              ))}
              {!insight?.recommendations?.length ? <li>No recommendations returned</li> : null}
            </ul>
          </div>
        </div>
      ) : null}
      {insight?.nextAction ? (
        <div className="ax-ai-next">
          <Sparkles size={15} />
          <div>
            <span className="ax-kicker">Next action</span>
            <strong>{insight.nextAction}</strong>
          </div>
        </div>
      ) : null}
      {meta}
    </div>
  );
}

/** Polished result panel for analyze / prevent / appeal / scrub-style jobs — never dump raw JSON. */
function JobResultPanel({
  kicker,
  title,
  subtitle,
  insight,
  confidence,
  offline,
  badges,
  footer,
}: {
  kicker: string;
  title: string;
  subtitle?: string;
  insight: AiInsightView | null;
  confidence?: number;
  offline?: boolean;
  badges?: ReactNode;
  footer?: ReactNode;
}) {
  const riskTone =
    insight?.riskLevel === 'high' ? 'coral' : insight?.riskLevel === 'low' ? 'teal' : 'amber';
  return (
    <section className="ax-ai-result" data-testid="job-result-panel">
      <div className="ax-ai-result-head">
        <div>
          <span className="ax-kicker">{kicker}</span>
          <h2>{insight?.headline ?? title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        <div className="ax-ai-result-badges">
          {offline != null ? (
            <StatusPill tone={offline ? 'amber' : 'teal'}>{offline ? 'Rules fallback' : 'Model online'}</StatusPill>
          ) : null}
          {insight?.riskLevel ? (
            <StatusPill tone={riskTone as 'coral' | 'amber' | 'teal'}>{formatLabel(insight.riskLevel)} risk</StatusPill>
          ) : null}
          {confidence != null ? (
            <span className="ax-insight-conf">{Math.round(confidence * 100)}% confidence</span>
          ) : null}
          {badges}
        </div>
      </div>
      <p className="ax-ai-summary">{insight?.summary ?? 'Job completed.'}</p>
      <div className="ax-ai-columns">
        <div>
          <h3>Primary factors</h3>
          <ul>
            {(insight?.factors ?? []).map((factor) => (
              <li key={factor}>{factor}</li>
            ))}
            {!insight?.factors?.length ? <li>No factors listed</li> : null}
          </ul>
        </div>
        <div>
          <h3>Recommendations</h3>
          <ul>
            {(insight?.recommendations ?? []).map((item) => (
              <li key={item}>{item}</li>
            ))}
            {!insight?.recommendations?.length ? <li>No recommendations listed</li> : null}
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
      {footer}
    </section>
  );
}

function resolveJobInsight(payload: any): AiInsightView | null {
  if (!payload) return null;
  return (
    parseAiInsight(payload.ai?.insight) ||
    parseAiInsight(payload.insight) ||
    parseAiInsight(payload.ai?.raw) ||
    parseAiInsight(payload.ai?.execution?.output) ||
    parseAiInsight(payload.ai?.output) ||
    parseAiInsight(payload.draft) ||
    parseAiInsight(payload.appealDraft) ||
    null
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
  if (s.includes('OPEN') || s.includes('EXCEPTION') || s.includes('DENIED') || s.includes('FAIL') || s.includes('RECOUP')) return 'coral';
  if (s.includes('BLOCK') || s.includes('WARN') || s.includes('PENDING') || s.includes('WORKING') || s.includes('CONFIG') || s.includes('RETIRE') || s.includes('DEGRAD') || s.includes('SANDBOX') || s.includes('PILOT')) return 'amber';
  if (s.includes('READY') || s.includes('ACTIVE') || s.includes('APPROVED') || s.includes('RESOLVED') || s.includes('PAID') || s.includes('CERTIF')) return 'teal';
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

function useTenantScope() {
  const { tenant } = useAuth();
  return tenant?.id ?? 'none';
}

function Overview({ onNavigate }: { onNavigate: (view: WorkspaceView) => void }) {
  const queryClient = useQueryClient();
  const ws = useTenantScope();
  const command = useQuery({ queryKey: ['command-center', ws], queryFn: api.commandCenter });
  const recommendations = useQuery({ queryKey: ['recommendations', ws], queryFn: api.recommendations });
  const revenueMap = useQuery({ queryKey: ['revenue-map', ws], queryFn: api.revenueMap });
  const sla = useQuery({ queryKey: ['sla', ws], queryFn: api.sla });
  const refresh = useMutation({
    mutationFn: api.refreshSignals,
    onSuccess: (data) => {
      if (data?.commandCenter) queryClient.setQueryData(['command-center', ws], data.commandCenter);
      if (data?.recommendations) queryClient.setQueryData(['recommendations', ws], data.recommendations);
      if (data?.revenueMap) queryClient.setQueryData(['revenue-map', ws], data.revenueMap);
      if (data?.leakage) queryClient.setQueryData(['leakage'], data.leakage);
      void sla.refetch();
      void queryClient.invalidateQueries({ queryKey: ['ai-copilot'] });
    },
    onError: () => {
      void command.refetch();
      void recommendations.refetch();
      void revenueMap.refetch();
      void sla.refetch();
    },
  });

  const loading = command.isLoading || recommendations.isLoading || revenueMap.isLoading || sla.isLoading;
  const error = command.error || recommendations.error || revenueMap.error || sla.error;
  const refetchAll = () => {
    if (refresh.isPending) return;
    refresh.mutate();
  };

  if (loading) return <div className="ax-view"><LoadingState label="Loading command center…" /></div>;
  if (error) return <div className="ax-view"><ErrorState error={error} onRetry={refetchAll} /></div>;

  const metrics = command.data?.metrics ?? {};
  const map = revenueMap.data ?? metrics.revenueMap ?? {};
  const actions = recommendations.data?.todaysActions ?? metrics.todaysActions ?? [];
  const signal = recommendations.data?.summary?.[0] ?? 'Review prioritized revenue signals.';
  const signalCategory = recommendations.data?.featuredCategory ?? 'Cycle health';
  const signalTypes = recommendations.data?.types ?? [];
  const activeCategories = new Set(
    (recommendations.data?.signals ?? []).map((row: { category?: string }) => row.category).filter(Boolean),
  );
  const refreshedAt = recommendations.data?.refreshedAt ?? command.data?.refreshedAt;
  const refreshing = refresh.isPending;
  const amountOf = (value: unknown) =>
    typeof value === 'number'
      ? value
      : Number((value as { amount?: number } | null | undefined)?.amount ?? 0) || 0;

  const funnelData = [
    { stage: 'Charges', amount: amountOf(map.totalCharges) },
    { stage: 'Billed', amount: amountOf(map.billed) },
    { stage: 'Outstanding', amount: amountOf(map.outstanding) },
    { stage: 'Paid', amount: amountOf(map.paid) },
  ];
  const riskData = [
    { name: 'At risk', value: amountOf(metrics.atRisk) },
    { name: 'Denied', value: amountOf(metrics.denied) },
    { name: 'Underpay', value: amountOf(metrics.potentialUnderpayment) },
    { name: 'Unbilled', value: amountOf(metrics.unbilled) },
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
        detail="A single operating picture projected from live claims, charges, and the signed ledger."
        action={
          <button
            className="ax-outline-button"
            type="button"
            onClick={refetchAll}
            disabled={refreshing}
            data-testid="button-refresh-overview"
          >
            <RefreshCw size={14} className={refreshing ? 'ax-spin' : undefined} />
            {refreshing ? 'Refreshing…' : 'Refresh signals'}
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
          <span className="ax-kicker">{signalCategory}</span>
          <p>{signal}</p>
          <small>
            {refreshedAt
              ? `Recomputed ${new Date(refreshedAt).toLocaleTimeString()}`
              : 'Refresh recomputes live leakage from claims, charges, denials, eligibility, auths, SLA, and AI.'}
          </small>
        </div>
        <button type="button" className="ax-primary-button" onClick={() => onNavigate('leakage')} data-testid="button-open-signal">
          Open signal <ArrowRight size={13} />
        </button>
      </section>
      {signalTypes.length ? (
        <div className="ax-signal-types" aria-label="Signal types">
          {signalTypes.map((row: { id: string; category: string; detail: string }) => (
            <span
              key={row.id}
              className={activeCategories.has(row.category) ? 'on' : undefined}
              title={row.detail}
            >
              {row.category}
            </span>
          ))}
        </div>
      ) : null}
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
  const ws = useTenantScope();
  const [selectedId, setSelectedId] = useState('');
  const [query, setQuery] = useState('');
  const [module, setModule] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [sortBy, setSortBy] = useState<'impact' | 'priority' | 'due'>('impact');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [actionMessage, setActionMessage] = useState('');

  const workItems = useQuery({ queryKey: ['work-items', ws], queryFn: () => api.workItems() });
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

function RegistrationDesk() {
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const payers = useQuery({ queryKey: ['payers'], queryFn: api.payers });
  const providers = useQuery({ queryKey: ['providers'], queryFn: api.providers });
  const facilities = useQuery({ queryKey: ['facilities'], queryFn: api.facilities });
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    dob: '',
    mrn: '',
    phone: '',
    email: '',
    sex: '',
    planName: '',
    memberId: '',
    payerId: '',
    payerName: '',
    providerId: '',
    facilityId: '',
    serviceFrom: new Date().toISOString().slice(0, 10),
    code: '99213',
    codeSystem: 'CPT',
    description: 'Office visit',
    amount: '175',
    units: '1',
  });

  const register = useMutation({
    mutationFn: () =>
      api.registerVisit({
        patient: {
          firstName: form.firstName,
          lastName: form.lastName,
          dob: form.dob,
          mrn: form.mrn || undefined,
          phone: form.phone || undefined,
          email: form.email || undefined,
          sex: form.sex || undefined,
        },
        coverage:
          form.planName && form.memberId
            ? {
                planName: form.planName,
                memberId: form.memberId,
                payerId: form.payerId || undefined,
                payerName: form.payerName || undefined,
              }
            : undefined,
        encounter: {
          serviceFrom: form.serviceFrom,
          providerId: form.providerId || undefined,
          facilityId: form.facilityId || undefined,
          status: 'OPEN',
        },
        charge: form.code
          ? {
              code: form.code,
              codeSystem: form.codeSystem,
              description: form.description,
              units: Number(form.units) || 1,
              amount: Number(form.amount) || 0,
            }
          : undefined,
      }),
    onSuccess: (data) => {
      if (data?.error) {
        setNote(String(data.error));
        return;
      }
      setNote(
        `Registered ${data.patient?.firstName} ${data.patient?.lastName} · ${data.patient?.mrn}` +
          (data.coverage ? ` · coverage ${data.coverage.planName}` : '') +
          (data.encounter ? ` · encounter ${data.encounter.id}` : '') +
          (data.charge ? ` · charge ${data.charge.code}` : ''),
      );
      setForm((f) => ({
        ...f,
        firstName: '',
        lastName: '',
        dob: '',
        mrn: '',
        phone: '',
        email: '',
        memberId: '',
      }));
      void queryClient.invalidateQueries({ queryKey: ['patients'] });
      void queryClient.invalidateQueries({ queryKey: ['coverages'] });
      void queryClient.invalidateQueries({ queryKey: ['encounters'] });
      void queryClient.invalidateQueries({ queryKey: ['charges'] });
      void queryClient.invalidateQueries({ queryKey: ['payers'] });
      void queryClient.invalidateQueries({ queryKey: ['work-items'] });
    },
    onError: (err: Error) => setNote(err.message),
  });

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="ax-view">
      <SectionHeading
        eyebrow="Standalone front desk"
        title="Registration desk"
        detail="Register a patient, attach coverage, open an encounter, and capture a charge — no EHR required."
      />
      {note ? (
        <div className="ax-insight-strip">
          <ClipboardPlus size={17} />
          <span>{note}</span>
        </div>
      ) : null}
      <section className="ax-panel ax-reg-panel">
        <div className="ax-panel-head">
          <div>
            <span className="ax-kicker">Guided intake</span>
            <h2>New visit</h2>
          </div>
        </div>

        <div className="ax-reg-grid">
          <div className="ax-reg-column">
            <h3 className="ax-reg-section-title">Patient</h3>
            <div className="ax-reg-fields">
              <label>
                First name *
                <input value={form.firstName} onChange={(e) => set('firstName', e.target.value)} data-testid="input-reg-first" />
              </label>
              <label>
                Last name *
                <input value={form.lastName} onChange={(e) => set('lastName', e.target.value)} data-testid="input-reg-last" />
              </label>
              <label>
                Date of birth *
                <input type="date" value={form.dob} onChange={(e) => set('dob', e.target.value)} data-testid="input-reg-dob" />
              </label>
              <label>
                MRN (optional)
                <input value={form.mrn} onChange={(e) => set('mrn', e.target.value)} placeholder="Auto-generated if blank" />
              </label>
              <label>
                Phone
                <input value={form.phone} onChange={(e) => set('phone', e.target.value)} />
              </label>
              <label>
                Email
                <input value={form.email} onChange={(e) => set('email', e.target.value)} />
              </label>
              <label className="ax-reg-span-2">
                Sex
                <select value={form.sex} onChange={(e) => set('sex', e.target.value)}>
                  <option value="">—</option>
                  <option value="F">Female</option>
                  <option value="M">Male</option>
                  <option value="U">Unknown</option>
                </select>
              </label>
            </div>
          </div>

          <div className="ax-reg-column">
            <h3 className="ax-reg-section-title">Coverage</h3>
            <div className="ax-reg-fields">
              <label>
                Plan name
                <input value={form.planName} onChange={(e) => set('planName', e.target.value)} placeholder="Commercial PPO" />
              </label>
              <label>
                Member ID
                <input value={form.memberId} onChange={(e) => set('memberId', e.target.value)} />
              </label>
              <label className="ax-reg-span-2">
                Existing payer
                <select value={form.payerId} onChange={(e) => set('payerId', e.target.value)}>
                  <option value="">Create / default</option>
                  {(payers.data ?? []).map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ax-reg-span-2">
                Or new payer name
                <input value={form.payerName} onChange={(e) => set('payerName', e.target.value)} />
              </label>
            </div>
          </div>

          <div className="ax-reg-column">
            <h3 className="ax-reg-section-title">Encounter</h3>
            <div className="ax-reg-fields">
              <label>
                Provider
                <select value={form.providerId} onChange={(e) => set('providerId', e.target.value)}>
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
                <select value={form.facilityId} onChange={(e) => set('facilityId', e.target.value)}>
                  <option value="">Default</option>
                  {(facilities.data ?? []).map((f: any) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ax-reg-span-2">
                Service date *
                <input type="date" value={form.serviceFrom} onChange={(e) => set('serviceFrom', e.target.value)} />
              </label>
            </div>
          </div>

          <div className="ax-reg-column">
            <h3 className="ax-reg-section-title">Charge</h3>
            <div className="ax-reg-fields">
              <label>
                Charge code
                <input value={form.code} onChange={(e) => set('code', e.target.value)} />
              </label>
              <label>
                Code system
                <select value={form.codeSystem} onChange={(e) => set('codeSystem', e.target.value)}>
                  <option value="CPT">CPT</option>
                  <option value="HCPCS">HCPCS</option>
                  <option value="ICD">ICD</option>
                </select>
              </label>
              <label className="ax-reg-span-2">
                Description
                <input value={form.description} onChange={(e) => set('description', e.target.value)} />
              </label>
              <label>
                Amount
                <input value={form.amount} onChange={(e) => set('amount', e.target.value)} />
              </label>
              <label>
                Units
                <input value={form.units} onChange={(e) => set('units', e.target.value)} />
              </label>
            </div>
          </div>
        </div>

        <div className="ax-reg-actions">
          <button
            className="ax-primary-button"
            type="button"
            disabled={register.isPending || !form.firstName || !form.lastName || !form.dob}
            onClick={() => register.mutate()}
            data-testid="button-register-visit"
          >
            {register.isPending ? 'Saving…' : 'Register patient + visit'}
          </button>
        </div>
      </section>
    </div>
  );
}

function Patients() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [note, setNote] = useState('');
  const [search, setSearch] = useState({ firstName: '', lastName: '', dob: '' });
  const [matches, setMatches] = useState<any[] | null>(null);
  const patients = useQuery({ queryKey: ['patients'], queryFn: api.patients });
  const find = useMutation({
    mutationFn: () => api.searchPatients(search),
    onSuccess: (data) => setMatches(data.matches ?? []),
  });

  if (patients.isLoading) return <div className="ax-view"><LoadingState label="Loading patients…" /></div>;
  if (patients.error) return <div className="ax-view"><ErrorState error={patients.error} onRetry={() => void patients.refetch()} /></div>;

  const list = patients.data ?? [];

  return (
    <div className="ax-view">
      <SectionHeading
        eyebrow="Practice management"
        title="Patients"
        detail={`${list.length} patients · search before you create — duplicate records break eligibility, claims, and A/R`}
      />
      <section className="ax-panel" style={{ marginBottom: 16 }}>
        <div className="ax-panel-head">
          <div>
            <span className="ax-kicker">Patient search</span>
            <h2>Look up before adding</h2>
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
        </div>
        <div className="ax-row-actions" style={{ marginTop: 12 }}>
          <button className="ax-primary-button" type="button" onClick={() => find.mutate()} data-testid="button-patient-search">
            Search
          </button>
        </div>
        {matches ? (
          <div className="ax-search-matches">
            {matches.length === 0 ? <p>No matches. You can add a new patient.</p> : null}
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
      {note ? (
        <div className="ax-insight-strip">
          <UsersRound size={17} />
          <span>{note}</span>
        </div>
      ) : null}
      {showCreate ? (
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
      ) : (
        <div className="ax-queue-layout">
          <section className="ax-panel ax-queue-list">
            <div className="ax-panel-head">
              <div>
                <span className="ax-kicker">Directory</span>
                <h2>{list.length} records</h2>
              </div>
              <button className="ax-primary-button" type="button" onClick={() => setShowCreate(true)} data-testid="button-add-patient">
                Add patient
              </button>
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
                <StatusPill tone={patient.registrationStatus === 'DRAFT' ? 'amber' : 'teal'}>
                  {patient.registrationStatus === 'DRAFT' ? 'Draft' : patient.source === 'MANUAL' ? 'Manual' : 'Active'}
                </StatusPill>
              </button>
            ))}
          </section>
          <aside className="ax-panel ax-inspection">
            {!selectedId ? (
              <div className="ax-empty">
                <PanelLeftOpen size={22} />
                <b>Select a patient</b>
                <p>Open the financial-access workspace: identity, coverage/COB, claims, and activity.</p>
              </div>
            ) : (
              <PatientWorkspace patientId={selectedId} />
            )}
          </aside>
        </div>
      )}
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
            const insight = parseAiInsight(result?.insight ?? result?.ai?.insight ?? result?.ai?.output);
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
                  <button
                    className="ax-outline-button"
                    type="button"
                    onClick={() =>
                      api
                        .manualVerifyCoverage(coverage.id, {
                          method: 'PHONE',
                          representative: 'Payer representative',
                          referenceNumber: `PH-${coverage.id.slice(-4)}`,
                          notes: 'Manual phone verification recorded from eligibility desk',
                        })
                        .then(() => {
                          void queryClient.invalidateQueries({ queryKey: ['coverages'] });
                        })
                    }
                    data-testid={`button-manual-verify-${coverage.id}`}
                  >
                    Manual verify
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
                            Source <b>{result.sourceLabel || result.method || 'Electronic 271'}</b>
                          </span>
                          <span>
                            Member <b>{result.memberIdMasked || coverage.memberId}</b>
                          </span>
                          <span>
                            Snapshot <b>{result.eligibilityCase?.coverageSnapshotId || '—'}</b>
                          </span>
                          <span>
                            Deductible rem. <b>{money(result.patientResponsibilityEstimate.deductible)}</b>
                          </span>
                          <span>
                            Copay <b>{money(result.patientResponsibilityEstimate.copay)}</b>
                          </span>
                          <span>
                            Coinsurance <b>{result.patientResponsibilityEstimate.coinsurancePercent}%</b>
                          </span>
                          {(result.normalizedBenefits ?? []).map((fact: { category: string; remaining?: number; amount?: number; percent?: number }, idx: number) => (
                            <span key={idx}>
                              {fact.category} <b>{fact.remaining ?? fact.amount ?? fact.percent ?? '—'}</b>
                            </span>
                          ))}
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
                      <StatusPill tone={est.clearance === 'HOLD' ? 'coral' : 'blue'}>{est.clearance || 'Estimate'}</StatusPill>
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
              <span className="ax-row-actions">
                {item.status === 'PENDING' ? (
                  <button
                    className="ax-outline-button"
                    type="button"
                    onClick={() =>
                      void api.submitAuthorization(item.id).then(() => queryClient.invalidateQueries({ queryKey: ['authorizations-risk'] }))
                    }
                  >
                    Submit
                  </button>
                ) : null}
                {item.status === 'PENDING' || item.status === 'SUBMITTED' ? (
                  <button
                    className="ax-outline-button"
                    type="button"
                    onClick={() =>
                      void api
                        .approveAuthorization(item.id, { unitsApproved: 2 })
                        .then(() => queryClient.invalidateQueries({ queryKey: ['authorizations-risk'] }))
                    }
                  >
                    Approve
                  </button>
                ) : null}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Providers() {
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [hours, setHours] = useState({ weekday: '1', startTime: '09:00', endTime: '17:00' });
  const providers = useQuery({ queryKey: ['providers'], queryFn: api.providers });
  const schedules = useQuery({
    queryKey: ['provider-schedules', selectedId],
    queryFn: () => api.providerSchedules(selectedId || undefined),
    enabled: Boolean(selectedId),
  });

  if (providers.isLoading) return <div className="ax-view"><LoadingState label="Loading providers…" /></div>;
  if (providers.error) return <div className="ax-view"><ErrorState error={providers.error} onRetry={() => void providers.refetch()} /></div>;

  const list = providers.data ?? [];
  const selected = list.find((provider: any) => provider.id === selectedId);

  return (
    <div className="ax-view">
      <SectionHeading
        eyebrow="Network directory"
        title="Providers"
        detail={`${list.length} billing and rendering providers · typed identifiers, claim roles`}
      />
      {note ? (
        <div className="ax-insight-strip">
          <Hospital size={17} />
          <span>{note}</span>
        </div>
      ) : null}
      {showCreate ? (
        <AddProviderFlow
          onCancel={() => setShowCreate(false)}
          onCreated={(providerId, message) => {
            setNote(message);
            setShowCreate(false);
            setSelectedId(providerId);
            void queryClient.invalidateQueries({ queryKey: ['providers'] });
          }}
        />
      ) : (
        <div className="ax-queue-layout">
          <section className="ax-panel ax-queue-list">
            <div className="ax-panel-head">
              <div>
                <span className="ax-kicker">Directory</span>
                <h2>{list.length} records</h2>
              </div>
              <button className="ax-primary-button" type="button" onClick={() => setShowCreate(true)} data-testid="button-add-provider">
                Add provider
              </button>
            </div>
            {list.map((provider: any) => (
              <button
                type="button"
                className={`ax-queue-row ${selectedId === provider.id ? 'selected' : ''}`}
                key={provider.id}
                onClick={() => setSelectedId(provider.id)}
                data-testid={`row-provider-${provider.id}`}
              >
                <span className="ax-queue-main">
                  <span className="ax-module-icon">
                    <Hospital size={15} />
                  </span>
                  <span>
                    <b>{provider.name}</b>
                    <small>{provider.specialty}</small>
                  </span>
                </span>
                <span className="ax-queue-context">
                  <b>{provider.npi ?? provider.identifiers?.[0]?.identifierValue ?? '—'}</b>
                  <small>{provider.identifiers?.length ? `${provider.identifiers.length} ID(s)` : 'No IDs'}</small>
                </span>
              </button>
            ))}
          </section>
          <aside className="ax-panel ax-inspection">
            {!selected ? (
              <div className="ax-empty">
                <Hospital size={22} />
                <b>Select a provider</b>
                <p>Open a roster record to inspect roles and typed identifiers. Use Add provider to enroll a new one.</p>
              </div>
            ) : (
              <>
                <div className="ax-inspection-title">
                  <div>
                    <h2>{selected.name}</h2>
                    <small>
                      {selected.specialty} · {(selected.roles ?? ['BILLING', 'RENDERING']).join(' · ')}
                    </small>
                  </div>
                </div>
                <div className="ax-detail-list">
                  <div>
                    <span>Primary ID</span>
                    <b>{selected.npi ?? selected.identifiers?.[0]?.identifierValue ?? '—'}</b>
                  </div>
                  <div>
                    <span>Identifiers</span>
                    <b>{selected.identifiers?.length ?? 0}</b>
                  </div>
                </div>
                <div className="ax-reason">
                  <span className="ax-kicker">Typed identifiers</span>
                  {(selected.identifiers ?? []).length === 0 ? (
                    <p>No identifier satellites yet.</p>
                  ) : (
                    (selected.identifiers ?? []).map((ident: { identifierType: string; identifierValue: string; country?: string }) => (
                      <p key={`${ident.identifierType}-${ident.identifierValue}`}>
                        {ident.identifierType} {ident.identifierValue}
                        {ident.country ? ` · ${ident.country}` : ''}
                      </p>
                    ))
                  )}
                </div>
                <div className="ax-reason">
                  <span className="ax-kicker">Working hours</span>
                  {(schedules.data ?? [])
                    .filter((row: any) => row.providerId === selected.id)
                    .map((row: any) => (
                      <p key={row.id}>
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][row.weekday] ?? row.weekday} {row.startTime}–{row.endTime}
                      </p>
                    ))}
                  <div className="ax-inline-controls" style={{ marginTop: 8, flexWrap: 'wrap', gap: 8 }}>
                    <select value={hours.weekday} onChange={(e) => setHours((h) => ({ ...h, weekday: e.target.value }))}>
                      <option value="1">Mon</option>
                      <option value="2">Tue</option>
                      <option value="3">Wed</option>
                      <option value="4">Thu</option>
                      <option value="5">Fri</option>
                    </select>
                    <input value={hours.startTime} onChange={(e) => setHours((h) => ({ ...h, startTime: e.target.value }))} />
                    <input value={hours.endTime} onChange={(e) => setHours((h) => ({ ...h, endTime: e.target.value }))} />
                    <button
                      className="ax-outline-button"
                      type="button"
                      onClick={() =>
                        api
                          .upsertProviderSchedule({
                            providerId: selected.id,
                            weekday: Number(hours.weekday),
                            startTime: hours.startTime,
                            endTime: hours.endTime,
                          })
                          .then(() => {
                            setNote(`Hours saved for ${selected.name}`);
                            void queryClient.invalidateQueries({ queryKey: ['provider-schedules'] });
                          })
                      }
                    >
                      Save hours
                    </button>
                  </div>
                </div>
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

function Payers() {
  return <PayerMaster SectionHeading={SectionHeading} StatusPill={StatusPill} />;
}

function Coding() {
  const queryClient = useQueryClient();
  const [result, setResult] = useState<any>(null);
  const [decisionNote, setDecisionNote] = useState('');
  const encounters = useQuery({ queryKey: ['encounters'], queryFn: api.encounters });
  const encounterList = encounters.data ?? [];
  const [encounterId, setEncounterId] = useState('');

  useEffect(() => {
    if (!encounterId && encounterList[0]?.id) setEncounterId(encounterList[0].id);
  }, [encounterId, encounterList]);

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
      setDecisionNote(`${formatLabel(decision)} recorded for encounter ${data.encounterId}`);
      void queryClient.invalidateQueries({ queryKey: ['audit'] });
      void queryClient.invalidateQueries({ queryKey: ['encounters'] });
      if (result?.ai?.id) {
        void api.decideAiExecution(result.ai.id, { decision }).catch(() => undefined);
      }
    },
    onError: (error) => setDecisionNote((error as Error).message),
  });

  const codingInsight =
    resolveJobInsight(result) ||
    parseAiInsight(result?.insight) ||
    (result
      ? {
          headline: `Coding assist for ${result.encounterId}`,
          summary:
            'Review suggested diagnoses and procedures, resolve warnings, then accept or reject before the codes affect the claim.',
          factors: result.warnings ?? [],
          recommendations: [
            ...(result.suggestions?.diagnoses ?? []).map((d: any) => `Confirm diagnosis ${d.code}`),
            ...(result.suggestions?.procedures ?? []).map((p: any) => `Confirm procedure ${p.code}`),
          ],
          riskLevel: (result.warnings?.length ?? 0) > 1 ? 'medium' : 'low',
          nextAction: 'Accept coding suggestions only after documentation supports medical necessity.',
        }
      : null);

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
              {encounterList.length === 0 ? <option value="">No encounters</option> : null}
              {encounterList.map((enc: any) => (
                <option key={enc.id} value={enc.id}>
                  {enc.id} · {enc.serviceFrom} · {enc.status}
                </option>
              ))}
            </select>
            <button
              className="ax-primary-button"
              type="button"
              disabled={suggest.isPending || !encounterId}
              onClick={() => suggest.mutate(encounterId)}
              data-testid="button-coding-suggest"
            >
              <Sparkles size={14} /> {suggest.isPending ? 'Suggesting…' : 'Suggest codes'}
            </button>
            <button
              className="ax-outline-button"
              type="button"
              disabled={!encounterId}
              onClick={() =>
                void api.reconcileEncounter(encounterId).then((data) => {
                  setDecisionNote(
                    data?.error
                      ? String(data.error)
                      : `Reconciled ${data.encounter?.id} → ${data.encounter?.status}${data.issues?.length ? ` (${data.issues.join('; ')})` : ''}`,
                  );
                  void queryClient.invalidateQueries({ queryKey: ['encounters'] });
                })
              }
            >
              Reconcile
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
          <p>Select an encounter and run suggestions to review diagnoses, procedures, and AI guidance.</p>
        </div>
      ) : null}
      {suggest.isPending ? <LoadingState label="Generating coding suggestions…" /> : null}
      {result ? (
        <div className="ax-coding-layout">
          <section className="ax-panel ax-coding-suggestions">
            <div className="ax-panel-head">
              <div>
                <span className="ax-kicker">Suggested codes</span>
                <h2>Encounter {result.encounterId}</h2>
              </div>
              <StatusPill tone="teal">{asPercent(result.ai?.confidence)}% confidence</StatusPill>
            </div>

            <div className="ax-coding-group">
              <h3>Diagnoses</h3>
              <div className="ax-coding-cards">
                {(result.suggestions?.diagnoses ?? []).map((dx: any) => (
                  <article className="ax-coding-card" key={dx.code}>
                    <div className="ax-coding-card-top">
                      <span className="ax-coding-badge dx">DX</span>
                      <StatusPill tone="teal">{asPercent(dx.confidence)}%</StatusPill>
                    </div>
                    <strong>{dx.code}</strong>
                    <p>{dx.description}</p>
                    <div className="ax-coding-meter">
                      <i style={{ width: `${asPercent(dx.confidence)}%` }} />
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className="ax-coding-group">
              <h3>Procedures</h3>
              <div className="ax-coding-cards">
                {(result.suggestions?.procedures ?? []).map((px: any) => (
                  <article className="ax-coding-card" key={px.code}>
                    <div className="ax-coding-card-top">
                      <span className="ax-coding-badge px">PX</span>
                      <StatusPill tone="blue">{asPercent(px.confidence)}%</StatusPill>
                    </div>
                    <strong>{px.code}</strong>
                    <p>{px.description}</p>
                    <div className="ax-coding-meter">
                      <i style={{ width: `${asPercent(px.confidence)}%` }} />
                    </div>
                  </article>
                ))}
              </div>
            </div>

            {(result.warnings ?? []).length ? (
              <div className="ax-coding-warnings">
                <span className="ax-kicker">Warnings</span>
                <div className="ax-concept-list">
                  {(result.warnings ?? []).map((warning: string) => (
                    <span key={warning}>
                      <AlertCircle size={14} />
                      {warning}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

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

          <JobResultPanel
            kicker="AI coding review"
            title={`Coding assist · ${result.encounterId}`}
            subtitle={result.offline ? 'Rules fallback narrative' : `Model ${result.ai?.model ?? 'assist'}`}
            insight={codingInsight}
            confidence={result.ai?.confidence}
            offline={result.offline}
            badges={<StatusPill tone="blue">Human review</StatusPill>}
          />
        </div>
      ) : null}
    </div>
  );
}

function Charges() {
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
          <div className="ax-setting-fields">
            <label>
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
            <label>
              Service date
              <input type="date" value={encForm.serviceFrom} onChange={(e) => setEncForm((f) => ({ ...f, serviceFrom: e.target.value }))} />
            </label>
            <button
              className="ax-secondary-button"
              type="button"
              disabled={createEncounter.isPending || !encForm.patientId}
              onClick={() => createEncounter.mutate()}
            >
              {createEncounter.isPending ? 'Creating…' : 'Create encounter'}
            </button>
            <label>
              Encounter
              <select value={chgForm.encounterId} onChange={(e) => setChgForm((f) => ({ ...f, encounterId: e.target.value }))}>
                <option value="">Select encounter</option>
                {(encounters.data ?? []).map((e: any) => (
                  <option key={e.id} value={e.id}>
                    {e.id} · {e.serviceFrom} · {e.status}
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
              Description
              <input value={chgForm.description} onChange={(e) => setChgForm((f) => ({ ...f, description: e.target.value }))} />
            </label>
            <label>
              Amount
              <input value={chgForm.amount} onChange={(e) => setChgForm((f) => ({ ...f, amount: e.target.value }))} />
            </label>
            <button
              className="ax-primary-button"
              type="button"
              disabled={createCharge.isPending || !chgForm.encounterId || !chgForm.code}
              onClick={() => createCharge.mutate()}
              data-testid="button-create-charge"
            >
              {createCharge.isPending ? 'Saving…' : 'Save charge'}
            </button>
            <button
              className="ax-secondary-button"
              type="button"
              disabled={!chgForm.encounterId || reconcile.isPending}
              onClick={() => reconcile.mutate(chgForm.encounterId)}
            >
              Reconcile encounter
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
              Capture from fee schedule
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
        `Submitted ${id} via ${gw?.adapter ?? 'adapter'} → ${gw?.clearinghouse ?? gw?.standard ?? 'gateway'}` +
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
  const inquire = useMutation({
    mutationFn: (id: string) => api.inquireClaimStatus(id),
    onSuccess: (data, id) => {
      setActionNote(`276/277 ${id} → payer ${data?.inquiry?.payerStatus ?? data?.claim?.payerStatus} (simulated)`);
      void queryClient.invalidateQueries({ queryKey: ['claims'] });
      void queryClient.invalidateQueries({ queryKey: ['claim', id] });
    },
    onError: (error) => setActionNote((error as Error).message),
  });
  const adjudicate = useMutation({
    mutationFn: (id: string) => api.adjudicateClaim(id),
    onSuccess: (data, id) => {
      setActionNote(`Adjudicated ${id} · ${data?.outcome ?? data?.claim?.status} (simulated)`);
      void queryClient.invalidateQueries({ queryKey: ['claims'] });
      void queryClient.invalidateQueries({ queryKey: ['claim', id] });
      void queryClient.invalidateQueries({ queryKey: ['denials'] });
      void queryClient.invalidateQueries({ queryKey: ['payments'] });
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
                    <button
                      className="ax-outline-button"
                      type="button"
                      disabled={inquire.isPending}
                      onClick={(event) => {
                        event.stopPropagation();
                        inquire.mutate(claim.id);
                      }}
                    >
                      276/277
                    </button>
                    <button
                      className="ax-outline-button"
                      type="button"
                      disabled={adjudicate.isPending}
                      onClick={(event) => {
                        event.stopPropagation();
                        adjudicate.mutate(claim.id);
                      }}
                    >
                      Adjudicate
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
                    {claimDetail.currentVersionNumber || detail.data?.frozenVersion
                      ? ` · frozen v${claimDetail.currentVersionNumber ?? detail.data?.frozenVersion?.versionNumber}`
                      : ' · not frozen'}
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
                <div>
                  <span>Frozen version</span>
                  <b>{detail.data?.frozenVersion ? `v${detail.data.frozenVersion.versionNumber}` : 'None'}</b>
                </div>
                <div>
                  <span>Transmission</span>
                  <b>{formatLabel(claimDetail.transmissionStatus)}</b>
                </div>
                <div>
                  <span>Payer</span>
                  <b>{formatLabel(claimDetail.payerStatus)}</b>
                </div>
                <div>
                  <span>Payment</span>
                  <b>{formatLabel(claimDetail.paymentStatus)}</b>
                </div>
              </div>
              {Array.isArray(detail.data?.journey) ? (
                <div className="ax-reason">
                  <span className="ax-kicker">Claim journey</span>
                  {detail.data.journey.map((step: { id: string; label: string; done: boolean }) => (
                    <p key={step.id}>
                      {step.done ? 'Done · ' : 'Open · '}
                      {step.label}
                    </p>
                  ))}
                </div>
              ) : null}
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
  const ws = useTenantScope();
  const [selected, setSelected] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<any>(null);
  const denials = useQuery({ queryKey: ['denials', ws], queryFn: api.denials });
  const knowledge = useQuery({ queryKey: ['denial-knowledge', ws], queryFn: api.denialKnowledge });
  const analyze = useMutation({
    mutationFn: (id: string) => api.analyzeDenial(id),
    onSuccess: (data) => {
      setAiResult(data);
      void queryClient.invalidateQueries({ queryKey: ['denials', ws] });
      void queryClient.invalidateQueries({ queryKey: ['denial-knowledge', ws] });
      void queryClient.invalidateQueries({ queryKey: ['rules', ws] });
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
        detail="Analyze root cause → write Denial Knowledge Base entry → promote executable scrub RuleVersion so the next claim is blocked before submission."
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
          <small>Denial → scrub feedback</small>
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
                {denial.category} · {denial.id} · {formatLabel(denial.caseStatus || denial.status)}
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
                <button
                  className="ax-outline-button"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelected(denial.id);
                    api.transitionDenial(denial.id, 'ASSIGNED').then(() => {
                      void queryClient.invalidateQueries({ queryKey: ['denials', ws] });
                    });
                  }}
                >
                  Assign
                </button>
                <button
                  className="ax-outline-button"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelected(denial.id);
                    api.transitionDenial(denial.id, 'CLOSED', 'Case closed from denial desk').then(() => {
                      void queryClient.invalidateQueries({ queryKey: ['denials', ws] });
                    });
                  }}
                >
                  Close
                </button>
              </div>
            </button>
          );
        })}
      </div>
      {aiResult ? (
        <div style={{ marginTop: '1rem' }}>
          <JobResultPanel
            kicker="AI assist + prevention"
            title={`${selected ?? 'Denial'} analysis`}
            subtitle={
              aiResult.preventionHint ||
              (aiResult.denial?.nextAction ? String(aiResult.denial.nextAction) : undefined)
            }
            insight={
              resolveJobInsight(aiResult) ?? {
                headline: `${selected ?? 'Denial'} analysis complete`,
                summary: aiResult.preventionHint || 'Denial analyzed and prevention workflow completed.',
                factors: aiResult.knowledge
                  ? [aiResult.knowledge.rootCause, aiResult.knowledge.category, aiResult.knowledge.reasonCode].filter(Boolean)
                  : undefined,
                recommendations: aiResult.preventionRule
                  ? [
                      `Promote ${aiResult.preventionRule.ruleKey} v${aiResult.preventionRule.version}`,
                      aiResult.scrubHint,
                    ].filter(Boolean) as string[]
                  : undefined,
                nextAction: aiResult.denial?.nextAction || aiResult.scrubHint,
              }
            }
            confidence={aiResult.ai?.execution?.confidence ?? aiResult.ai?.confidence}
            offline={aiResult.ai?.offline}
            badges={
              aiResult.preventionRule ? (
                <StatusPill tone={aiResult.preventionRule.severity === 'BLOCKING' ? 'coral' : 'amber'}>
                  {formatLabel(aiResult.preventionRule.severity)} rule
                </StatusPill>
              ) : null
            }
            footer={
              aiResult.preventionRule || aiResult.knowledge ? (
                <div className="ax-job-prevention">
                  {aiResult.preventionRule ? (
                    <div className="ax-job-prevention-card">
                      <span className="ax-kicker">Prevention rule promoted</span>
                      <strong>
                        {aiResult.preventionRule.ruleKey} · v{aiResult.preventionRule.version}
                      </strong>
                      <small>
                        {aiResult.preventionRule.action} · {aiResult.preventionRule.layer} ·{' '}
                        {aiResult.preventionRule.severity}
                      </small>
                      {aiResult.scrubHint ? <p>{aiResult.scrubHint}</p> : null}
                    </div>
                  ) : null}
                  {aiResult.knowledge ? (
                    <div className="ax-job-prevention-card">
                      <span className="ax-kicker">Denial knowledge base</span>
                      <strong>{aiResult.knowledge.rootCause}</strong>
                      <small>
                        {aiResult.knowledge.reasonCode} · {aiResult.knowledge.category} · linked rule{' '}
                        {aiResult.knowledge.preventionRuleKey}
                      </small>
                    </div>
                  ) : null}
                </div>
              ) : null
            }
          />
        </div>
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
  const queryClient = useQueryClient();
  const ar = useQuery({ queryKey: ['ar-queue'], queryFn: api.arQueue });
  const billing = useQuery({ queryKey: ['patient-billing'], queryFn: api.patientBilling });
  const followUps = useQuery({ queryKey: ['follow-ups'], queryFn: () => api.followUps() });
  const [followForm, setFollowForm] = useState({ entityId: '', result: '', representative: '', referenceNumber: '' });
  const [note, setNote] = useState('');

  if (ar.isLoading) return <div className="ax-view"><LoadingState label="Loading A/R queue…" /></div>;
  if (ar.error) return <div className="ax-view"><ErrorState error={ar.error} onRetry={() => void ar.refetch()} /></div>;

  const list = ar.data ?? [];

  return (
    <div className="ax-view">
      <SectionHeading eyebrow="Collections priority" title="A/R queue" detail="Live A/R from claim and ledger projections — insurance vs patient buckets." />
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
            <span>Bucket</span>
            <span>Balance</span>
            <span>Priority</span>
            <span>Denial risk</span>
          </div>
          {list.map((item: any) => (
            <div className="ax-claim-row" key={item.claimId ?? item.id} data-testid={`row-ar-${item.claimId ?? item.id}`}>
              <span>
                <b>{item.claimNumber ?? item.claimId ?? item.id}</b>
                <small>{item.payerName ?? item.payerId ?? 'Outstanding'}</small>
              </span>
              <StatusPill tone={item.bucket === 'PATIENT' ? 'amber' : statusTone(item.status)}>
                {item.bucket === 'PATIENT' ? 'Patient' : formatLabel(item.status)}
              </StatusPill>
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
      <section className="ax-panel ax-table-panel" style={{ marginTop: 14 }}>
        <div className="ax-panel-head">
          <div>
            <span className="ax-kicker">Patient billing</span>
            <h2>{(billing.data ?? []).length} balances</h2>
          </div>
        </div>
        <div className="ax-claims-table">
          <div className="ax-table-head">
            <span>Patient</span>
            <span>PR</span>
            <span>Insurance AR</span>
            <span>Balance</span>
          </div>
          {(billing.data ?? []).map((row: any) => (
            <div className="ax-claim-row" key={row.patientId}>
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
      </section>
      <section className="ax-panel" style={{ marginTop: 14 }}>
        <div className="ax-panel-head">
          <div>
            <span className="ax-kicker">Follow-up activity</span>
            <h2>Phone / portal notes</h2>
          </div>
        </div>
        {note ? <p className="ax-muted">{note}</p> : null}
        <div className="ax-setting-fields">
          <label>
            Claim / denial ID
            <input value={followForm.entityId} onChange={(e) => setFollowForm((f) => ({ ...f, entityId: e.target.value }))} />
          </label>
          <label>
            Result
            <input value={followForm.result} onChange={(e) => setFollowForm((f) => ({ ...f, result: e.target.value }))} />
          </label>
          <label>
            Representative
            <input value={followForm.representative} onChange={(e) => setFollowForm((f) => ({ ...f, representative: e.target.value }))} />
          </label>
          <label>
            Reference
            <input value={followForm.referenceNumber} onChange={(e) => setFollowForm((f) => ({ ...f, referenceNumber: e.target.value }))} />
          </label>
          <button
            className="ax-primary-button"
            type="button"
            onClick={() =>
              api
                .addFollowUp({
                  entityType: 'claim',
                  entityId: followForm.entityId || list[0]?.claimId,
                  method: 'PHONE',
                  result: followForm.result || 'Called payer',
                  representative: followForm.representative,
                  referenceNumber: followForm.referenceNumber,
                })
                .then((data) => {
                  setNote(data?.error ? String(data.error) : `Follow-up recorded ${data.followUp?.id}`);
                  void queryClient.invalidateQueries({ queryKey: ['follow-ups'] });
                })
            }
          >
            Record follow-up
          </button>
        </div>
        <div className="ax-reason">
          {(followUps.data ?? []).slice(0, 8).map((row: any) => (
            <p key={row.id}>
              {row.method} · {row.entityId} · {row.result}
              {row.referenceNumber ? ` · ${row.referenceNumber}` : ''}
            </p>
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
  const [note, setNote] = useState('');
  const payments = useQuery({ queryKey: ['payments'], queryFn: api.payments });
  const contractCheck = useMutation({
    mutationFn: (paymentId: string) => api.contractCheckPayment(paymentId),
    onSuccess: (data, paymentId) => {
      setCheckByPayment((current) => ({ ...current, [paymentId]: data }));
      void queryClient.invalidateQueries({ queryKey: ['payments'] });
      void queryClient.invalidateQueries({ queryKey: ['work-items'] });
    },
  });
  const refund = useMutation({
    mutationFn: (paymentId: string) => api.refundPayment(paymentId),
    onSuccess: (data) => {
      if (data?.error) return setNote(String(data.error));
      setNote(`Refund posted on ${data.claim?.claimNumber ?? data.payment?.claimId}`);
      void queryClient.invalidateQueries({ queryKey: ['payments'] });
      void queryClient.invalidateQueries({ queryKey: ['claims'] });
      void queryClient.invalidateQueries({ queryKey: ['command-center'] });
    },
  });
  const recoup = useMutation({
    mutationFn: (paymentId: string) => api.recoupPayment(paymentId),
    onSuccess: (data) => {
      if (data?.error) return setNote(String(data.error));
      setNote(`Recoupment posted on ${data.claim?.claimNumber ?? data.payment?.claimId}`);
      void queryClient.invalidateQueries({ queryKey: ['payments'] });
      void queryClient.invalidateQueries({ queryKey: ['claims'] });
      void queryClient.invalidateQueries({ queryKey: ['command-center'] });
    },
  });
  const bankRec = useMutation({
    mutationFn: (id: string) => api.reconcileBank(id),
    onSuccess: (data) => {
      if (data?.error) return setNote(String(data.error));
      setNote(`Bank rec ${data.status}: ERA ${money(data.expected ?? 0)} vs ledger ${money(data.posted ?? 0)}`);
      void queryClient.invalidateQueries({ queryKey: ['payments'] });
      void queryClient.invalidateQueries({ queryKey: ['work-items'] });
    },
  });

  if (payments.isLoading) return <div className="ax-view"><LoadingState label="Loading payments…" /></div>;
  if (payments.error) return <div className="ax-view"><ErrorState error={payments.error} onRetry={() => void payments.refetch()} /></div>;

  const remittances = payments.data?.remittances ?? [];
  const paymentRows = payments.data?.payments ?? [];
  const contracts = payments.data?.contracts ?? [];
  const ledgerRows = payments.data?.ledgerEntries ?? [];

  return (
    <div className="ax-view">
      <SectionHeading
        eyebrow="Reimbursement"
        title="ERA posting & payments"
        detail="Ledger-posted remittances, bank rec, contract variance, refunds, and payer recoupments. Money is never edited in place."
      />
      {note ? (
        <div className="ax-insight-strip">
          <BadgeDollarSign size={17} />
          <span>{note}</span>
        </div>
      ) : null}
      <div className="ax-metrics">
        <Metric label="Remittances" value={String(remittances.length)} icon={FileText} />
        <Metric label="Payments" value={String(paymentRows.length)} icon={BadgeDollarSign} tone="coral" />
        <Metric label="Ledger posts" value={String(ledgerRows.length)} icon={CircleDollarSign} tone="teal" />
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
            {remittances.length === 0 ? (
              <div className="ax-empty" style={{ padding: '1.25rem' }}>
                <Receipt size={18} />
                <b>No remittances yet</b>
                <p>ERA files post here when remittance is ingested through the payment gateway.</p>
              </div>
            ) : (
              remittances.map((remit: any) => (
                <div className="ax-opportunity" key={remit.id}>
                  <span className="ax-rank">RM</span>
                  <span>
                    <b>{remit.remittanceNumber ?? remit.id}</b>
                    <small>
                      {[remit.format, remit.bankRecStatus ?? remit.status, remit.checkOrEftNumber].filter(Boolean).join(' · ') ||
                        (remit.receivedAt ? new Date(remit.receivedAt).toLocaleString() : '—')}
                    </small>
                  </span>
                  <strong>{money(remit.paidAmount ?? 0)}</strong>
                  <button
                    className="ax-outline-button"
                    type="button"
                    disabled={bankRec.isPending}
                    onClick={() => bankRec.mutate(remit.id)}
                  >
                    Bank rec
                  </button>
                </div>
              ))
            )}
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
                  {payment.status !== 'REFUNDED' && payment.status !== 'RECOUPED' ? (
                    <>
                      <button
                        className="ax-ghost-button"
                        type="button"
                        disabled={refund.isPending}
                        onClick={() => refund.mutate(payment.id)}
                      >
                        Refund
                      </button>
                      <button
                        className="ax-ghost-button"
                        type="button"
                        disabled={recoup.isPending}
                        onClick={() => recoup.mutate(payment.id)}
                      >
                        Recoup
                      </button>
                    </>
                  ) : null}
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
  const [runningIds, setRunningIds] = useState<string[]>([]);
  const agents = useQuery({ queryKey: ['agents'], queryFn: api.agents });
  const health = useQuery({
    queryKey: ['ai-health'],
    queryFn: api.aiHealth,
    refetchInterval: 15_000,
    retry: 1,
  });
  const copilot = useQuery({
    queryKey: ['ai-copilot'],
    queryFn: api.aiCopilot,
    refetchInterval: 20_000,
    retry: 1,
  });

  if (agents.isLoading) return <div className="ax-view"><LoadingState label="Loading AI workforce…" /></div>;
  if (agents.error) {
    return (
      <div className="ax-view">
        <ErrorState error={agents.error} onRetry={() => { void agents.refetch(); void health.refetch(); }} />
      </div>
    );
  }

  const list = agents.data ?? [];
  const avgConfidence =
    list.length === 0
      ? 0
      : Math.round(list.reduce((sum: number, agent: any) => sum + asPercent(agent.confidenceAvg), 0) / list.length);
  const reviewTotal = list.reduce((sum: number, agent: any) => sum + (agent.reviewRequired ?? 0), 0);
  const insight =
    (runResult?.insight && typeof runResult.insight === 'object'
      ? (runResult.insight as AiInsightView)
      : null) || resolveJobInsight(runResult);
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
          <i /> {health.data?.ok ? 'ONLINE' : 'STANDBY'} · {health.data?.model ?? 'rules'}
        </span>
      </div>
      {!health.data?.ok ? (
        <div className="ax-insight-strip">
          <AlertCircle size={17} />
          <span>
            <b>Fallback rules live:</b> {health.data?.message ?? 'Model offline — instant RCM guidance still runs, and the model refines in the background when available.'}
          </span>
        </div>
      ) : (
        <div className="ax-insight-strip">
          <Sparkles size={17} />
          <span>
            <b>AI copilot is running.</b> Suggestions also appear as toasts and in the notification bell.
            {copilot.data?.suggestions?.[0]?.headline ? ` Latest: ${copilot.data.suggestions[0].headline}` : ''}
          </span>
        </div>
      )}
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
              disabled={runningIds.includes(agent.id)}
              onClick={() => {
                setRunningIds((ids) => [...ids, agent.id]);
                void api
                  .runAgent(agent.id)
                  .then((data) => {
                    setRunResult(data);
                    const next = data?.insight;
                    toast({
                      title: next?.headline ?? agent.name,
                      description: next?.nextAction ?? 'Agent finished. Review the output below.',
                    });
                  })
                  .catch((error: Error) => {
                    toast({
                      title: 'Agent did not finish',
                      description: error.message || 'Try again — fallback rules still apply.',
                    });
                  })
                  .finally(() => {
                    setRunningIds((ids) => ids.filter((id) => id !== agent.id));
                  });
              }}
              data-testid={`button-run-agent-${agent.id}`}
            >
              <Sparkles size={14} /> {runningIds.includes(agent.id) ? 'Running…' : 'Run agent'}
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
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState('');
  const [note, setNote] = useState('');
  const packs = useQuery({ queryKey: ['country-packs'], queryFn: api.countryPacks });
  const adapters = useQuery({ queryKey: ['gateway-adapters'], queryFn: api.gatewayAdapters });
  const transition = useMutation({
    mutationFn: (input: { code: string; name: string; action: 'advance' | 'degrade' | 'retire' | 'restore' }) =>
      api.transitionPackInterface(input.code, input.name, input.action),
    onSuccess: (data) => {
      if (data?.error) return setNote(String(data.error));
      setNote(data.connectivitySummary ?? 'Pack updated');
      void queryClient.invalidateQueries({ queryKey: ['country-packs'] });
    },
    onError: (error: Error) => setNote(error.message),
  });

  if (packs.isLoading) return <div className="ax-view"><LoadingState label="Loading country packs…" /></div>;
  if (packs.error) return <div className="ax-view"><ErrorState error={packs.error} onRetry={() => void packs.refetch()} /></div>;

  const list = packs.data ?? [];
  const pack = list.find((item: any) => item.code === selected) ?? list[0];
  const adapterMeta = (adapters.data?.adapters ?? []).find((a: any) => a.key === pack?.adapterKey);
  const interfaceLabels: Record<string, string> = {
    eligibility: 'Eligibility',
    authorization: 'Authorization',
    claim: 'Claim submission',
    statusInquiry: 'Status inquiry',
    remittance: 'Remittance',
    priorAuthApi: 'CMS Prior Auth API',
  };

  return (
    <div className="ax-view">
      <SectionHeading
        eyebrow="Integration hub"
        title="Country packs"
        detail="A pack is a versioned capability contract: identifiers, coding, claim/eligibility/auth/remit interfaces, and certification state. It is not a live payer connection."
      />
      <div className="ax-pack-disclaimer">
        <Globe2 size={15} />
        <span>
          Certification lifecycle is CONFIG_ONLY → SANDBOX → PILOT → CERTIFIED (plus DEGRADED / RETIRED).
          Even CERTIFIED stays <b>simulated</b> until real credentials exist. Never treat this screen as live clearinghouse connectivity.
        </span>
      </div>
      {note ? (
        <div className="ax-insight-strip">
          <AlertCircle size={16} />
          <span>{note}</span>
        </div>
      ) : null}

      <section className="ax-panel ax-intake-note" style={{ marginBottom: 18 }}>
        <span className="ax-kicker">Data intake</span>
        <h3 style={{ margin: '6px 0 10px', fontFamily: 'var(--app-font-serif)' }}>How data enters Velora</h3>
        <p style={{ marginTop: 0, maxWidth: 720, color: 'var(--ax-soft)', lineHeight: 1.5 }}>
          Day-to-day standalone use happens in <b style={{ color: 'var(--ax-ink)' }}>Registration desk</b> — staff enter
          patients, coverage, encounters, and charges in the UI. No EHR is required.
        </p>
        <p style={{ marginTop: 0, maxWidth: 720, color: 'var(--ax-soft)', lineHeight: 1.5 }}>
          For hospitals that already have an EHR, Velora can also receive clinical data through optional connectors
          (FHIR R4, HL7 ADT/DFT, or partner JSON APIs). Those are integration projects — not something you click here.
        </p>
        <div className="ax-concept-list">
          <span>
            <CheckCircle2 size={14} />
            Registration desk (standalone)
          </span>
          <span>
            <CheckCircle2 size={14} />
            FHIR / HL7 / partner API (optional)
          </span>
        </div>
      </section>

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
              <StatusPill tone={item.liveConnectivity ? 'teal' : 'amber'}>
                {item.liveConnectivity ? 'Live' : 'Simulated'}
              </StatusPill>
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
                <StatusPill tone="amber">{pack.stage} · not live connectivity</StatusPill>
              </div>
            </div>
            <p className="ax-pack-connectivity">{pack.connectivitySummary}</p>
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
                <span className="ax-kicker">Interfaces</span>
                <div className="ax-pack-iface-list">
                  {(pack.interfaces ?? []).map((iface: any) => (
                    <div className="ax-pack-iface" key={iface.name} data-testid={`pack-iface-${pack.code}-${iface.name}`}>
                      <div className="ax-pack-iface-head">
                        <b>{interfaceLabels[iface.name] ?? iface.name}</b>
                        <StatusPill tone={statusTone(iface.certificationStatus)}>{iface.certificationStatus}</StatusPill>
                        <StatusPill tone={iface.connectivity === 'SIMULATED' ? 'blue' : 'amber'}>
                          {iface.connectivity === 'SIMULATED' ? 'Simulated' : 'Not enabled'}
                        </StatusPill>
                      </div>
                      {iface.notes ? <p>{iface.notes}</p> : null}
                      <div className="ax-pack-iface-actions">
                        {iface.certificationStatus === 'CONFIG_ONLY' || iface.certificationStatus === 'SANDBOX' || iface.certificationStatus === 'PILOT' ? (
                          <button
                            type="button"
                            className="ax-outline-button"
                            disabled={transition.isPending}
                            onClick={() => transition.mutate({ code: pack.code, name: iface.name, action: 'advance' })}
                          >
                            Advance
                          </button>
                        ) : null}
                        {iface.certificationStatus === 'CERTIFIED' || iface.certificationStatus === 'SANDBOX' || iface.certificationStatus === 'PILOT' ? (
                          <button
                            type="button"
                            className="ax-ghost-button"
                            disabled={transition.isPending}
                            onClick={() => transition.mutate({ code: pack.code, name: iface.name, action: 'degrade' })}
                          >
                            Degrade
                          </button>
                        ) : null}
                        {iface.certificationStatus === 'DEGRADED' || iface.certificationStatus === 'RETIRED' ? (
                          <button
                            type="button"
                            className="ax-outline-button"
                            disabled={transition.isPending}
                            onClick={() => transition.mutate({ code: pack.code, name: iface.name, action: 'restore' })}
                          >
                            Restore sandbox
                          </button>
                        ) : null}
                        {iface.certificationStatus !== 'RETIRED' ? (
                          <button
                            type="button"
                            className="ax-ghost-button"
                            disabled={transition.isPending}
                            onClick={() => transition.mutate({ code: pack.code, name: iface.name, action: 'retire' })}
                          >
                            Retire
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <span className="ax-kicker">Identifier types</span>
                <div className="ax-concept-list">
                  {(pack.identifierTypes ?? []).map((item: string) => (
                    <span key={item}>
                      <CheckCircle2 size={14} />
                      {item}
                    </span>
                  ))}
                </div>
              </div>
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

function OpsEmpty({ text }: { text: string }) {
  return <p className="ax-ops-empty">{text}</p>;
}

function opsError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error);
  try {
    const parsed = JSON.parse(raw) as { message?: string | string[] };
    if (Array.isArray(parsed.message)) return parsed.message.join(', ');
    if (parsed.message) return parsed.message;
  } catch {
    // plain text from API
  }
  return raw;
}

const STAFF_ROLES = ['admin', 'operator', 'coder', 'biller', 'viewer'] as const;
type StaffRole = (typeof STAFF_ROLES)[number];

function Operations() {
  const { user, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const audit = useQuery({ queryKey: ['audit'], queryFn: api.audit });
  const tenant = useQuery({ queryKey: ['tenant'], queryFn: api.tenant });
  const readiness = useQuery({ queryKey: ['readyz'], queryFn: api.readiness });
  const onboarding = useQuery({
    queryKey: ['onboarding'],
    queryFn: api.onboarding,
    enabled: isAdminRole(user?.role),
  });
  const baa = useQuery({
    queryKey: ['baa'],
    queryFn: api.baaTemplate,
    enabled: isAdminRole(user?.role),
  });
  const users = useQuery({
    queryKey: ['users'],
    queryFn: api.listUsers,
    enabled: isAdminRole(user?.role),
  });
  const breaches = useQuery({
    queryKey: ['breaches'],
    queryFn: api.listBreaches,
    enabled: isAdminRole(user?.role) || user?.role === 'operator',
  });
  const hosting = useQuery({
    queryKey: ['hosting-vendors'],
    queryFn: api.hostingVendors,
    enabled: isAdminRole(user?.role) || user?.role === 'operator',
  });
  const training = useQuery({
    queryKey: ['training'],
    queryFn: api.training,
    enabled: Boolean(user),
  });
  const thirdParty = useQuery({
    queryKey: ['third-party-audits'],
    queryFn: api.thirdPartyAudits,
    enabled: isAdminRole(user?.role) || user?.role === 'operator',
  });
  const retention = useQuery({
    queryKey: ['retention'],
    queryFn: api.retention,
    enabled: isAdminRole(user?.role) || user?.role === 'operator',
  });
  const evidence = useQuery({
    queryKey: ['evidence'],
    queryFn: api.complianceEvidence,
    enabled: isAdminRole(user?.role) || user?.role === 'operator',
  });
  const runbooks = useQuery({
    queryKey: ['runbooks'],
    queryFn: api.runbooks,
    enabled: isAdminRole(user?.role) || user?.role === 'operator',
  });
  const inbox = useQuery({ queryKey: ['integration-messages'], queryFn: api.integrationMessages });
  const orgUnits = useQuery({ queryKey: ['organizations'], queryFn: api.organizations });
  const facilities = useQuery({ queryKey: ['facilities'], queryFn: api.facilities });
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    role: 'operator' as StaffRole,
    title: '',
    password: '',
  });
  const [editUser, setEditUser] = useState({
    name: '',
    email: '',
    role: 'operator' as StaffRole,
    title: '',
    password: '',
  });
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [newOrg, setNewOrg] = useState({ name: '', type: 'HEALTH_SYSTEM' });
  const [editOrg, setEditOrg] = useState({ name: '', type: 'HEALTH_SYSTEM' });
  const [editingOrgId, setEditingOrgId] = useState<string | null>(null);
  const [newFacility, setNewFacility] = useState({ name: '', organizationId: '', country: '' });
  const [editFacility, setEditFacility] = useState({ name: '', organizationId: '', country: '' });
  const [editingFacilityId, setEditingFacilityId] = useState<string | null>(null);
  const [activeFacilityId, setActiveFacilityId] = useState('');
  const [createdTempPassword, setCreatedTempPassword] = useState('');
  const [mfaEnroll, setMfaEnroll] = useState<{
    secret: string;
    otpauthUrl: string;
    recoveryCodes: string[];
  } | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaMessage, setMfaMessage] = useState('');
  const [baaNotes, setBaaNotes] = useState('');
  const [baaCounsel, setBaaCounsel] = useState({ firm: '', email: '', status: 'executed' as 'draft' | 'counsel_review' | 'executed' });
  const [breachForm, setBreachForm] = useState({ title: '', description: '', affectedIndividuals: 0 });
  const createOrganization = useMutation({
    mutationFn: () => api.createOrganization({ name: newOrg.name, type: newOrg.type }),
    onSuccess: (data) => {
      const createdId = data?.organization?.id as string | undefined;
      setNewOrg({ name: '', type: 'HEALTH_SYSTEM' });
      if (createdId) {
        setNewFacility((row) => (row.organizationId ? row : { ...row, organizationId: createdId }));
      }
      void queryClient.invalidateQueries({ queryKey: ['organizations'] });
      void queryClient.invalidateQueries({ queryKey: ['facilities'] });
      void queryClient.invalidateQueries({ queryKey: ['audit'] });
    },
  });
  const createFacility = useMutation({
    mutationFn: () =>
      api.createFacility({
        name: newFacility.name,
        organizationId: newFacility.organizationId,
        country: newFacility.country || undefined,
      }),
    onSuccess: (data) => {
      const createdId = data?.facility?.id as string | undefined;
      setNewFacility((row) => ({ ...row, name: '', country: '' }));
      if (createdId) setActiveFacilityId(createdId);
      void queryClient.invalidateQueries({ queryKey: ['facilities'] });
      void queryClient.invalidateQueries({ queryKey: ['organizations'] });
      void queryClient.invalidateQueries({ queryKey: ['audit'] });
    },
  });
  const updateOrganization = useMutation({
    mutationFn: () => api.updateOrganization(editingOrgId!, { name: editOrg.name, type: editOrg.type }),
    onSuccess: () => {
      setEditingOrgId(null);
      void queryClient.invalidateQueries({ queryKey: ['organizations'] });
      void queryClient.invalidateQueries({ queryKey: ['audit'] });
    },
  });
  const deleteOrganization = useMutation({
    mutationFn: (id: string) => api.deleteOrganization(id),
    onSuccess: () => {
      setEditingOrgId(null);
      void queryClient.invalidateQueries({ queryKey: ['organizations'] });
      void queryClient.invalidateQueries({ queryKey: ['facilities'] });
      void queryClient.invalidateQueries({ queryKey: ['audit'] });
    },
  });
  const updateFacility = useMutation({
    mutationFn: () =>
      api.updateFacility(editingFacilityId!, {
        name: editFacility.name,
        organizationId: editFacility.organizationId,
        country: editFacility.country || undefined,
      }),
    onSuccess: () => {
      setEditingFacilityId(null);
      void queryClient.invalidateQueries({ queryKey: ['facilities'] });
      void queryClient.invalidateQueries({ queryKey: ['audit'] });
    },
  });
  const deleteFacility = useMutation({
    mutationFn: (id: string) => api.deleteFacility(id),
    onSuccess: () => {
      setEditingFacilityId(null);
      void queryClient.invalidateQueries({ queryKey: ['facilities'] });
      void queryClient.invalidateQueries({ queryKey: ['audit'] });
    },
  });
  const createUser = useMutation({
    mutationFn: () =>
      api.createUser({
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        title: newUser.title || undefined,
        password: newUser.password,
      }),
    onSuccess: (data) => {
      setCreatedTempPassword(data.temporaryPassword || '');
      setNewUser({ name: '', email: '', role: 'operator', title: '', password: '' });
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
  const updateUser = useMutation({
    mutationFn: () =>
      api.updateUser(editingUserId!, {
        name: editUser.name,
        email: editUser.email,
        role: editUser.role,
        title: editUser.title || undefined,
        password: editUser.password || undefined,
      }),
    onSuccess: () => {
      setEditingUserId(null);
      setEditUser({ name: '', email: '', role: 'operator', title: '', password: '' });
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
  const deleteUser = useMutation({
    mutationFn: (id: string) => api.deleteUser(id),
    onSuccess: () => {
      setEditingUserId(null);
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
  const acceptBaa = useMutation({
    mutationFn: () =>
      api.acceptBaa({
        notes: baaNotes || undefined,
        signerTitle: user?.title,
        status: baaCounsel.status,
        counselFirm: baaCounsel.firm || undefined,
        counselEmail: baaCounsel.email || undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['onboarding'] });
      void queryClient.invalidateQueries({ queryKey: ['readyz'] });
    },
  });
  const beginMfa = useMutation({
    mutationFn: () => api.beginMfaEnroll(),
    onSuccess: (data) => {
      setMfaEnroll({
        secret: data.secret,
        otpauthUrl: data.otpauthUrl,
        recoveryCodes: data.recoveryCodes,
      });
      setMfaMessage('Scan the secret in your authenticator app, then confirm with a code.');
    },
  });
  const confirmMfa = useMutation({
    mutationFn: () => api.confirmMfaEnroll(mfaCode.trim()),
    onSuccess: async () => {
      setMfaMessage('MFA enabled for your account.');
      setMfaEnroll(null);
      setMfaCode('');
      await refreshProfile();
      void queryClient.invalidateQueries({ queryKey: ['onboarding'] });
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
  const requireMfa = useMutation({
    mutationFn: (required: boolean) => api.setTenantMfaRequired(required),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['onboarding'] });
      void queryClient.invalidateQueries({ queryKey: ['readyz'] });
    },
  });
  const requireSso = useMutation({
    mutationFn: (required: boolean) => api.setTenantSsoRequired(required),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['onboarding'] });
      void queryClient.invalidateQueries({ queryKey: ['readyz'] });
    },
  });
  const openBreach = useMutation({
    mutationFn: () =>
      api.openBreach({
        title: breachForm.title,
        description: breachForm.description,
        affectedIndividuals: breachForm.affectedIndividuals,
      }),
    onSuccess: () => {
      setBreachForm({ title: '', description: '', affectedIndividuals: 0 });
      void queryClient.invalidateQueries({ queryKey: ['breaches'] });
    },
  });
  const runRetention = useMutation({
    mutationFn: (policyId: string) => api.runRetention({ policyId, dryRun: true }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['retention'] }),
  });
  const executeRunbook = useMutation({
    mutationFn: (id: string) => api.executeRunbook(id, { notes: 'Executed from Operations' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['runbooks'] }),
  });
  const rotateKeys = useMutation({
    mutationFn: () => api.rotateKeys('Rotation initiated from Operations'),
  });
  const reencrypt = useMutation({
    mutationFn: () => api.reencryptPhi(),
  });
  const executeHostingBaa = useMutation({
    mutationFn: (id: string) => api.executeHostingBaa(id, { documentVersion: '2026.1', notes: 'Executed from Operations' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['hosting-vendors'] });
      void queryClient.invalidateQueries({ queryKey: ['onboarding'] });
    },
  });
  const assignAllTraining = useMutation({
    mutationFn: (courseId: string) => api.assignTrainingAll(courseId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['training'] }),
  });
  const completeTraining = useMutation({
    mutationFn: (body: { assignmentId?: string; courseId: string }) => api.completeTraining(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['training'] });
      void queryClient.invalidateQueries({ queryKey: ['onboarding'] });
    },
  });
  const completeAudit = useMutation({
    mutationFn: (item: any) =>
      api.upsertThirdPartyAudit({
        id: item.id,
        auditType: item.auditType,
        title: item.title,
        firmName: item.firmName,
        markCompleted: true,
        reportUri: item.reportUri || `internal://velora/audits/${item.id}`,
        opinion: 'attested',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['third-party-audits'] });
      void queryClient.invalidateQueries({ queryKey: ['onboarding'] });
    },
  });
  const attestEvidence = useMutation({
    mutationFn: (item: any) =>
      api.upsertEvidence({
        id: item.id,
        category: item.category,
        framework: item.framework,
        controlId: item.controlId,
        title: item.title,
        status: 'attested',
        evidenceUri: item.evidenceUri || `internal://velora/${item.controlId}`,
        notes: 'Attested in Operations evidence vault',
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['evidence'] }),
  });

  useEffect(() => {
    const firstOrg = orgUnits.data?.[0]?.id;
    if (firstOrg) {
      setNewFacility((row) => (row.organizationId ? row : { ...row, organizationId: firstOrg }));
    }
  }, [orgUnits.data]);

  useEffect(() => {
    const home = tenant.data?.homeCountry;
    if (home) {
      setNewFacility((row) => (row.country ? row : { ...row, country: home }));
    }
  }, [tenant.data?.homeCountry]);

  if (audit.isLoading || tenant.isLoading) return <div className="ax-view"><LoadingState label="Loading operations…" /></div>;
  if (audit.error) return <div className="ax-view"><ErrorState error={audit.error} onRetry={() => void audit.refetch()} /></div>;

  const events = audit.data ?? [];
  const org = tenant.data;
  const checks = readiness.data?.checks ?? [];
  const settings = onboarding.data?.settings;
  const inboxRows = inbox.data ?? [];
  const directory = users.data ?? [];
  const checksPass = checks.filter((check: { ok?: boolean }) => check.ok).length;
  const organizationRows = orgUnits.data ?? [];
  const facilityRows = facilities.data ?? [];
  const selectedFacilityId = activeFacilityId || facilityRows[0]?.id || '';
  const canEditDirectoryUser = (entry: { id: string; role: string }) =>
    user?.role === 'superadmin' || (isAdminRole(user?.role) && entry.role !== 'superadmin');
  const canDeleteDirectoryUser = (entry: { id: string; role: string }) =>
    Boolean(user) && entry.id !== user?.id && entry.role !== 'superadmin' && isAdminRole(user?.role);

  return (
    <div className="ax-view ax-ops">
      <SectionHeading
        eyebrow="Workspace controls"
        title="Operations"
        detail="Organization, people, identity, and compliance — one column, top to bottom."
      />

      <div className="ax-ops-stats">
        <article className="ax-ops-stat">
          <span>Organization</span>
          <b>{org?.name ?? 'Velora'}</b>
          <small>{org?.countryPack ?? '—'} · {org?.currency ?? '—'}</small>
        </article>
        <article className="ax-ops-stat">
          <span>Readiness</span>
          <b>{readiness.data?.ready ? 'Ready' : 'Open'}</b>
          <small>{checksPass}/{checks.length || 0} controls passing</small>
        </article>
        <article className="ax-ops-stat">
          <span>Directory</span>
          <b>{directory.length}</b>
          <small>{user?.mfaEnabled ? 'Your MFA is on' : 'Your MFA is off'}</small>
        </article>
        <article className="ax-ops-stat">
          <span>BAA</span>
          <b>{settings?.baaAccepted ? 'Recorded' : 'Pending'}</b>
          <small>{String(readiness.data?.mode ?? 'enterprise')}</small>
        </article>
      </div>

      <section className="ax-panel">
        <div className="ax-panel-head">
          <div>
            <span className="ax-kicker">Organization</span>
            <h2>{org?.name ?? 'Velora Revenue OS'}</h2>
          </div>
          <Building2 size={19} />
        </div>
        <div className="ax-ops-meta">
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
            <span>Runtime mode</span>
            <b>{readiness.data?.mode ?? 'enterprise'}</b>
          </div>
          <div>
            <span>Data region</span>
            <b>{org?.dataRegion ?? '—'}</b>
          </div>
          <div>
            <span>Timezone</span>
            <b>{org?.timezone ?? '—'}</b>
          </div>
          <label>
            Active facility
            <select
              value={selectedFacilityId}
              onChange={(e) => setActiveFacilityId(e.target.value)}
              data-testid="select-active-facility"
            >
              {facilityRows.length ? (
                facilityRows.map((row: { id: string; name: string }) => (
                  <option key={row.id} value={row.id}>{row.name}</option>
                ))
              ) : (
                <option value="">Add a facility below</option>
              )}
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

      {isAdminRole(user?.role) ? (
        <section className="ax-panel">
          <div className="ax-panel-head">
            <div>
              <span className="ax-kicker">Hospitals and clinics</span>
              <h2>Organizations and facilities</h2>
            </div>
            <Hospital size={19} />
          </div>
          <p className="ax-panel-copy">
            The workspace switcher (Meridian, Gulf, Pacific) is the tenant — country, currency, and data region.
            Add each hospital or clinic as an organization in this tenant, then add facilities (sites) under it.
          </p>
          <div className="ax-ops-fields ax-ops-fields-org">
            <label>
              Organization
              <input
                value={newOrg.name}
                onChange={(e) => setNewOrg((row) => ({ ...row, name: e.target.value }))}
                placeholder="Hospital or clinic name"
                data-testid="input-new-org-name"
              />
            </label>
            <label>
              Type
              <select
                value={newOrg.type}
                onChange={(e) => setNewOrg((row) => ({ ...row, type: e.target.value }))}
                data-testid="select-new-org-type"
              >
                <option value="HEALTH_SYSTEM">Health system</option>
                <option value="HOSPITAL">Hospital</option>
                <option value="CLINIC">Clinic</option>
                <option value="AMBULATORY">Ambulatory</option>
                <option value="GROUP_PRACTICE">Group practice</option>
              </select>
            </label>
            <button
              className="ax-ops-btn"
              type="button"
              disabled={createOrganization.isPending || !newOrg.name.trim()}
              onClick={() => createOrganization.mutate()}
              data-testid="button-create-org"
            >
              {createOrganization.isPending ? 'Saving' : 'Add'}
            </button>
          </div>
          {createOrganization.isError ? <p className="ax-inline-error">{opsError(createOrganization.error)}</p> : null}

          <div className="ax-ops-fields ax-ops-fields-fac">
            <label>
              Facility
              <input
                value={newFacility.name}
                onChange={(e) => setNewFacility((row) => ({ ...row, name: e.target.value }))}
                placeholder="Site name"
                data-testid="input-new-facility-name"
              />
            </label>
            <label>
              Organization
              <select
                value={newFacility.organizationId}
                onChange={(e) => setNewFacility((row) => ({ ...row, organizationId: e.target.value }))}
                data-testid="select-new-facility-org"
              >
                {organizationRows.length ? (
                  organizationRows.map((row: { id: string; name: string }) => (
                    <option key={row.id} value={row.id}>{row.name}</option>
                  ))
                ) : (
                  <option value="">Add an organization first</option>
                )}
              </select>
            </label>
            <label>
              Country
              <input
                value={newFacility.country}
                onChange={(e) => setNewFacility((row) => ({ ...row, country: e.target.value.toUpperCase() }))}
                placeholder={org?.homeCountry ?? 'US'}
                data-testid="input-new-facility-country"
              />
            </label>
            <button
              className="ax-ops-btn"
              type="button"
              disabled={createFacility.isPending || !newFacility.name.trim() || !newFacility.organizationId}
              onClick={() => createFacility.mutate()}
              data-testid="button-create-facility"
            >
              {createFacility.isPending ? 'Saving' : 'Add'}
            </button>
          </div>
          {createFacility.isError ? <p className="ax-inline-error">{opsError(createFacility.error)}</p> : null}
          {updateOrganization.isError ? <p className="ax-inline-error">{opsError(updateOrganization.error)}</p> : null}
          {deleteOrganization.isError ? <p className="ax-inline-error">{opsError(deleteOrganization.error)}</p> : null}
          {updateFacility.isError ? <p className="ax-inline-error">{opsError(updateFacility.error)}</p> : null}
          {deleteFacility.isError ? <p className="ax-inline-error">{opsError(deleteFacility.error)}</p> : null}

          <div className="ax-ops-directory">
            {organizationRows.length ? (
              <div className="ax-ops-rows">
                {organizationRows.map((row: { id: string; name: string; type: string }) => {
                  const sites = facilityRows.filter((site: { id: string; name: string; country: string; organizationId: string }) => site.organizationId === row.id);
                  const editing = editingOrgId === row.id;
                  return (
                    <div className="ax-ops-group" key={row.id}>
                      {editing ? (
                        <div className="ax-ops-fields ax-ops-fields-org">
                          <label>
                            Organization
                            <input value={editOrg.name} onChange={(e) => setEditOrg((current) => ({ ...current, name: e.target.value }))} />
                          </label>
                          <label>
                            Type
                            <select value={editOrg.type} onChange={(e) => setEditOrg((current) => ({ ...current, type: e.target.value }))}>
                              <option value="HEALTH_SYSTEM">Health system</option>
                              <option value="HOSPITAL">Hospital</option>
                              <option value="CLINIC">Clinic</option>
                              <option value="AMBULATORY">Ambulatory</option>
                              <option value="GROUP_PRACTICE">Group practice</option>
                            </select>
                          </label>
                          <div className="ax-ops-row-actions">
                            <button className="ax-ops-btn" type="button" disabled={updateOrganization.isPending || !editOrg.name.trim()} onClick={() => updateOrganization.mutate()}>Save</button>
                            <button className="ax-ops-btn ax-ops-btn-quiet" type="button" onClick={() => setEditingOrgId(null)}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="ax-ops-row">
                          <span>
                            <b>{row.name}</b>
                            <small>{row.type.replace(/_/g, ' ').toLowerCase()}</small>
                          </span>
                          <div className="ax-ops-row-actions">
                            <button
                              className="ax-ops-btn ax-ops-btn-quiet"
                              type="button"
                              onClick={() => {
                                setEditingOrgId(row.id);
                                setEditOrg({ name: row.name, type: row.type });
                              }}
                            >
                              Edit
                            </button>
                            <button
                              className="ax-ops-btn ax-ops-btn-quiet ax-ops-btn-danger"
                              type="button"
                              disabled={deleteOrganization.isPending}
                              onClick={() => {
                                if (window.confirm(`Delete ${row.name} and its facilities?`)) deleteOrganization.mutate(row.id);
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                      {sites.map((site: { id: string; name: string; country: string; organizationId: string }) => (
                        editingFacilityId === site.id ? (
                          <div className="ax-ops-fields ax-ops-fields-fac ax-ops-nested" key={site.id}>
                            <label>
                              Facility
                              <input value={editFacility.name} onChange={(e) => setEditFacility((current) => ({ ...current, name: e.target.value }))} />
                            </label>
                            <label>
                              Organization
                              <select value={editFacility.organizationId} onChange={(e) => setEditFacility((current) => ({ ...current, organizationId: e.target.value }))}>
                                {organizationRows.map((orgRow: { id: string; name: string }) => (
                                  <option key={orgRow.id} value={orgRow.id}>{orgRow.name}</option>
                                ))}
                              </select>
                            </label>
                            <label>
                              Country
                              <input value={editFacility.country} onChange={(e) => setEditFacility((current) => ({ ...current, country: e.target.value.toUpperCase() }))} />
                            </label>
                            <div className="ax-ops-row-actions">
                              <button className="ax-ops-btn" type="button" disabled={updateFacility.isPending || !editFacility.name.trim()} onClick={() => updateFacility.mutate()}>Save</button>
                              <button className="ax-ops-btn ax-ops-btn-quiet" type="button" onClick={() => setEditingFacilityId(null)}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div className="ax-ops-row ax-ops-nested" key={site.id}>
                            <span>
                              <b>{site.name}</b>
                              <small>Facility · {site.country}</small>
                            </span>
                            <div className="ax-ops-row-actions">
                              <button
                                className="ax-ops-btn ax-ops-btn-quiet"
                                type="button"
                                onClick={() => {
                                  setEditingFacilityId(site.id);
                                  setEditFacility({ name: site.name, organizationId: site.organizationId, country: site.country });
                                }}
                              >
                                Edit
                              </button>
                              <button
                                className="ax-ops-btn ax-ops-btn-quiet ax-ops-btn-danger"
                                type="button"
                                disabled={deleteFacility.isPending}
                                onClick={() => {
                                  if (window.confirm(`Delete facility ${site.name}?`)) deleteFacility.mutate(site.id);
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        )
                      ))}
                    </div>
                  );
                })}
              </div>
            ) : (
              <OpsEmpty text="No hospitals or clinics in this workspace yet. Add an organization, then a facility." />
            )}
          </div>
        </section>
      ) : null}

      {isAdminRole(user?.role) ? (
        <section className="ax-panel">
          <div className="ax-panel-head">
            <div>
              <span className="ax-kicker">People</span>
              <h2>Directory</h2>
            </div>
            <StatusPill tone="teal">{directory.length} active</StatusPill>
          </div>
          <p className="ax-panel-copy">Create staff with a name, email, role, and password. Superadmin can edit or delete accounts; the superadmin account itself cannot be deleted.</p>
          <div className="ax-ops-fields ax-ops-fields-user">
            <label>
              Name
              <input value={newUser.name} onChange={(e) => setNewUser((current) => ({ ...current, name: e.target.value }))} placeholder="Full name" data-testid="input-new-user-name" />
            </label>
            <label>
              Email
              <input value={newUser.email} onChange={(e) => setNewUser((current) => ({ ...current, email: e.target.value }))} placeholder="work@email.com" data-testid="input-new-user-email" />
            </label>
            <label>
              Role
              <select value={newUser.role} onChange={(e) => setNewUser((current) => ({ ...current, role: e.target.value as StaffRole }))} data-testid="select-new-user-role">
                {STAFF_ROLES.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </label>
            <label>
              Title
              <input value={newUser.title} onChange={(e) => setNewUser((current) => ({ ...current, title: e.target.value }))} placeholder="Job title" />
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete="new-password"
                value={newUser.password}
                onChange={(e) => setNewUser((current) => ({ ...current, password: e.target.value }))}
                placeholder="Min 8 characters"
                data-testid="input-new-user-password"
              />
            </label>
            <button
              className="ax-ops-btn"
              type="button"
              disabled={createUser.isPending || !newUser.name.trim() || !newUser.email.trim() || newUser.password.length < 8}
              onClick={() => createUser.mutate()}
              data-testid="button-create-user"
            >
              {createUser.isPending ? 'Saving' : 'Add'}
            </button>
          </div>
          {createdTempPassword ? (
            <p className="ax-inline-success">Temporary password issued: {createdTempPassword}</p>
          ) : null}
          {createUser.isError ? <p className="ax-inline-error">{opsError(createUser.error)}</p> : null}
          {updateUser.isError ? <p className="ax-inline-error">{opsError(updateUser.error)}</p> : null}
          {deleteUser.isError ? <p className="ax-inline-error">{opsError(deleteUser.error)}</p> : null}
          <div className="ax-ops-directory">
            {directory.length ? (
              <div className="ax-ops-rows">
                {directory.map((entry: any) => (
                  editingUserId === entry.id ? (
                    <div className="ax-ops-fields ax-ops-fields-user" key={entry.id}>
                      <label>
                        Name
                        <input value={editUser.name} onChange={(e) => setEditUser((current) => ({ ...current, name: e.target.value }))} />
                      </label>
                      <label>
                        Email
                        <input value={editUser.email} onChange={(e) => setEditUser((current) => ({ ...current, email: e.target.value }))} />
                      </label>
                      <label>
                        Role
                        {entry.role === 'superadmin' ? (
                          <input value="superadmin" disabled />
                        ) : (
                          <select value={editUser.role} onChange={(e) => setEditUser((current) => ({ ...current, role: e.target.value as StaffRole }))}>
                            {STAFF_ROLES.map((role) => (
                              <option key={role} value={role}>{role}</option>
                            ))}
                          </select>
                        )}
                      </label>
                      <label>
                        Title
                        <input value={editUser.title} onChange={(e) => setEditUser((current) => ({ ...current, title: e.target.value }))} />
                      </label>
                      <label>
                        Password
                        <input
                          type="password"
                          autoComplete="new-password"
                          value={editUser.password}
                          onChange={(e) => setEditUser((current) => ({ ...current, password: e.target.value }))}
                          placeholder="Leave blank to keep"
                        />
                      </label>
                      <div className="ax-ops-row-actions">
                        <button className="ax-ops-btn" type="button" disabled={updateUser.isPending || !editUser.name.trim() || !editUser.email.trim()} onClick={() => updateUser.mutate()}>Save</button>
                        <button className="ax-ops-btn ax-ops-btn-quiet" type="button" onClick={() => setEditingUserId(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="ax-ops-row" key={entry.id}>
                      <span>
                        <b>{entry.name}</b>
                        <small>
                          {entry.email} · {entry.role}
                          {entry.title ? ` · ${entry.title}` : ''}
                        </small>
                      </span>
                      <div className="ax-ops-row-actions">
                        {canEditDirectoryUser(entry) ? (
                          <button
                            className="ax-ops-btn ax-ops-btn-quiet"
                            type="button"
                            onClick={() => {
                              setEditingUserId(entry.id);
                              setEditUser({
                                name: entry.name,
                                email: entry.email,
                                role: (STAFF_ROLES.includes(entry.role) ? entry.role : 'operator') as StaffRole,
                                title: entry.title || '',
                                password: '',
                              });
                            }}
                          >
                            Edit
                          </button>
                        ) : null}
                        {canDeleteDirectoryUser(entry) ? (
                          <button
                            className="ax-ops-btn ax-ops-btn-quiet ax-ops-btn-danger"
                            type="button"
                            disabled={deleteUser.isPending}
                            onClick={() => {
                              if (window.confirm(`Delete ${entry.name}? They will no longer be able to sign in.`)) deleteUser.mutate(entry.id);
                            }}
                          >
                            Delete
                          </button>
                        ) : null}
                      </div>
                    </div>
                  )
                ))}
              </div>
            ) : (
              <OpsEmpty text="No staff besides you yet. Add an operator to run the front desk." />
            )}
          </div>
        </section>
      ) : null}

      <section className="ax-panel">
        <div className="ax-panel-head">
          <div>
            <span className="ax-kicker">Identity</span>
            <h2>Multi-factor authentication</h2>
          </div>
          <StatusPill tone={user?.mfaEnabled ? 'teal' : 'amber'}>
            {user?.mfaEnabled ? 'Enabled on account' : 'Not enrolled'}
          </StatusPill>
        </div>
        <p className="ax-panel-copy">
          Enroll TOTP for your signed-in account. When tenant MFA is required, password login blocks until enrollment completes.
        </p>
        <div className="ax-ops-actions" style={{ marginBottom: 12 }}>
          {!user?.mfaEnabled && !mfaEnroll ? (
            <button
              className="ax-primary-button"
              type="button"
              disabled={beginMfa.isPending}
              onClick={() => beginMfa.mutate()}
              data-testid="button-mfa-begin"
            >
              {beginMfa.isPending ? 'Preparing…' : 'Start MFA enrollment'}
            </button>
          ) : null}
          {isAdminRole(user?.role) ? (
            <>
              <button
                className="ax-secondary-button"
                type="button"
                disabled={requireMfa.isPending}
                onClick={() => requireMfa.mutate(!settings?.mfaRequired)}
                data-testid="button-mfa-require"
              >
                {settings?.mfaRequired ? 'Clear tenant MFA requirement' : 'Require MFA for this tenant'}
              </button>
              <button
                className="ax-secondary-button"
                type="button"
                disabled={requireSso.isPending}
                onClick={() => requireSso.mutate(!settings?.ssoRequired)}
                data-testid="button-sso-require"
              >
                {settings?.ssoRequired ? 'Clear SSO requirement' : 'Require SSO for this tenant'}
              </button>
            </>
          ) : null}
        </div>
        {mfaEnroll ? (
          <div className="ax-ops-form">
            <div>
              <span className="ax-kicker">Secret</span>
              <b data-testid="text-mfa-secret">{mfaEnroll.secret}</b>
            </div>
            <div className="ax-ops-span-2">
              <span className="ax-kicker">otpauth</span>
              <b style={{ wordBreak: 'break-all', fontSize: 12 }}>{mfaEnroll.otpauthUrl}</b>
            </div>
            <div className="ax-ops-span-2">
              <span className="ax-kicker">Recovery codes</span>
              <b>{mfaEnroll.recoveryCodes.join(' · ')}</b>
            </div>
            <label>
              Confirm with authenticator code
              <input
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                data-testid="input-mfa-confirm"
              />
            </label>
            <div className="ax-ops-actions">
              <button
                className="ax-primary-button"
                type="button"
                disabled={confirmMfa.isPending || mfaCode.trim().length < 6}
                onClick={() => confirmMfa.mutate()}
                data-testid="button-mfa-confirm"
              >
                {confirmMfa.isPending ? 'Confirming…' : 'Confirm MFA'}
              </button>
            </div>
          </div>
        ) : null}
        {mfaMessage ? <p className="ax-panel-copy">{mfaMessage}</p> : null}
      </section>

      <section className="ax-panel">
        <div className="ax-panel-head">
          <div>
            <span className="ax-kicker">Enterprise readiness</span>
            <h2>{readiness.data?.ready ? 'Controls ready' : 'Hardening in progress'}</h2>
          </div>
          <StatusPill tone={readiness.data?.ready ? 'teal' : 'amber'}>
            {String(readiness.data?.mode ?? 'enterprise').toUpperCase()}
          </StatusPill>
        </div>
        {checks.length ? (
          <div className="ax-opportunity-list">
            {checks.map((check: any) => (
              <div className="ax-opportunity" key={check.id}>
                <span className="ax-rank">{check.ok ? 'OK' : '!'}</span>
                <span>
                  <b>{check.label}</b>
                  <small>{check.id}</small>
                </span>
                <StatusPill tone={check.ok ? 'teal' : 'coral'}>{check.ok ? 'Pass' : 'Action'}</StatusPill>
              </div>
            ))}
          </div>
        ) : (
          <OpsEmpty text="Readiness checks will appear when the control plane reports." />
        )}
        {isAdminRole(user?.role) && onboarding.data?.steps?.length ? (
          <div className="ax-opportunity-list" style={{ marginTop: 12 }}>
            {onboarding.data.steps.map((step: any) => (
              <div className="ax-opportunity" key={step.id}>
                <span className="ax-rank">{String(step.status).slice(0, 2).toUpperCase()}</span>
                <span>
                  <b>{step.title}</b>
                  <small>{step.detail}</small>
                </span>
                <StatusPill tone={step.status === 'complete' ? 'teal' : step.status === 'deferred' ? 'neutral' : 'amber'}>
                  {formatLabel(step.status)}
                </StatusPill>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {isAdminRole(user?.role) ? (
        <section className="ax-panel">
          <div className="ax-panel-head">
            <div>
              <span className="ax-kicker">Legal</span>
              <h2>BAA acceptance</h2>
            </div>
            <StatusPill tone={settings?.baaAccepted ? 'teal' : 'amber'}>
              {settings?.baaAccepted ? 'Recorded' : 'Pending'}
            </StatusPill>
          </div>
          <p className="ax-panel-copy">
            {baa.data?.document ?? 'Velora Business Associate Agreement'} · version {baa.data?.version ?? '2026.1'}
          </p>
          {baa.data?.notice ? <p className="ax-panel-copy">{baa.data.notice}</p> : null}
          {!settings?.baaAccepted ? (
            <div className="ax-ops-form">
              <label>
                Workflow status
                <select
                  value={baaCounsel.status}
                  onChange={(e) => setBaaCounsel((c) => ({ ...c, status: e.target.value as any }))}
                  data-testid="select-baa-status"
                >
                  <option value="draft">draft</option>
                  <option value="counsel_review">counsel_review</option>
                  <option value="executed">executed</option>
                </select>
              </label>
              <label>
                Counsel firm
                <input value={baaCounsel.firm} onChange={(e) => setBaaCounsel((c) => ({ ...c, firm: e.target.value }))} data-testid="input-baa-counsel-firm" />
              </label>
              <label>
                Counsel email
                <input value={baaCounsel.email} onChange={(e) => setBaaCounsel((c) => ({ ...c, email: e.target.value }))} data-testid="input-baa-counsel-email" />
              </label>
              <label>
                Acceptance notes
                <input
                  value={baaNotes}
                  onChange={(e) => setBaaNotes(e.target.value)}
                  placeholder="Executed under counsel review / MSA reference"
                  data-testid="input-baa-notes"
                />
              </label>
              <div className="ax-ops-span-2 ax-ops-actions">
                <button
                  className="ax-primary-button"
                  type="button"
                  disabled={acceptBaa.isPending}
                  onClick={() => acceptBaa.mutate()}
                  data-testid="button-accept-baa"
                >
                  {acceptBaa.isPending ? 'Recording…' : 'Record BAA workflow step'}
                </button>
              </div>
            </div>
          ) : (
            <p className="ax-panel-copy">Acceptance is stored for this tenant.</p>
          )}
        </section>
      ) : null}

      {(isAdminRole(user?.role) || user?.role === 'operator') ? (
        <section className="ax-panel">
          <div className="ax-panel-head">
            <div>
              <span className="ax-kicker">Vendors</span>
              <h2>Hosting / subprocessor BAAs</h2>
            </div>
            <StatusPill tone={hosting.data?.summary?.ready ? 'teal' : 'amber'}>
              {hosting.data?.summary?.baaExecuted ?? 0}/{hosting.data?.summary?.phiVendors ?? 0} executed
            </StatusPill>
          </div>
          <p className="ax-panel-copy">Gaps: {hosting.data?.summary?.baaGaps ?? '—'}</p>
          {(hosting.data?.vendors ?? []).length ? (
            <div className="ax-opportunity-list">
              {(hosting.data?.vendors ?? []).map((vendor: any) => (
                <div className="ax-opportunity" key={vendor.id}>
                  <span className="ax-rank">HV</span>
                  <span>
                    <b>{vendor.vendorName}</b>
                    <small>{vendor.category} · BAA {vendor.baaStatus}</small>
                  </span>
                  {vendor.baaStatus !== 'executed' && isAdminRole(user?.role) ? (
                    <button className="ax-secondary-button" type="button" onClick={() => executeHostingBaa.mutate(vendor.id)}>
                      Execute BAA
                    </button>
                  ) : (
                    <StatusPill tone="teal">Executed</StatusPill>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <OpsEmpty text="No hosting vendors on file yet." />
          )}
        </section>
      ) : null}

      {(isAdminRole(user?.role) || user?.role === 'operator') ? (
        <section className="ax-panel">
          <div className="ax-panel-head">
            <div>
              <span className="ax-kicker">Workforce</span>
              <h2>Training</h2>
            </div>
            <StatusPill tone={training.data?.summary?.ready ? 'teal' : 'amber'}>
              {training.data?.summary?.overdue ?? 0} overdue
            </StatusPill>
          </div>
          <p className="ax-panel-copy">
            Courses {training.data?.summary?.courses ?? 0} · Assignments {training.data?.summary?.assignments ?? 0}
          </p>
          {(training.data?.courses ?? []).length ? (
            <div className="ax-opportunity-list">
              {(training.data?.courses ?? []).map((course: any) => (
                <div className="ax-opportunity" key={course.id}>
                  <span className="ax-rank">TR</span>
                  <span>
                    <b>{course.title}</b>
                    <small>{course.code} · {course.durationMinutes} min · cadence {course.cadenceDays}d</small>
                  </span>
                  {isAdminRole(user?.role) ? (
                    <button className="ax-secondary-button" type="button" onClick={() => assignAllTraining.mutate(course.id)}>
                      Assign all users
                    </button>
                  ) : null}
                </div>
              ))}
              {(training.data?.assignments ?? [])
                .filter((a: any) => a.status !== 'completed' && (a.userId === user?.id || isAdminRole(user?.role)))
                .slice(0, 8)
                .map((assignment: any) => (
                  <div className="ax-opportunity" key={assignment.id}>
                    <span className="ax-rank">AS</span>
                    <span>
                      <b>{assignment.userName}</b>
                      <small>Due {new Date(assignment.dueAt).toLocaleDateString()} · {assignment.status}</small>
                    </span>
                    {(assignment.userId === user?.id || isAdminRole(user?.role)) ? (
                      <button
                        className="ax-secondary-button"
                        type="button"
                        onClick={() => completeTraining.mutate({ assignmentId: assignment.id, courseId: assignment.courseId })}
                      >
                        Complete & attest
                      </button>
                    ) : null}
                  </div>
                ))}
            </div>
          ) : (
            <OpsEmpty text="No training courses assigned." />
          )}
        </section>
      ) : null}

      {(isAdminRole(user?.role) || user?.role === 'operator') ? (
        <section className="ax-panel">
          <div className="ax-panel-head">
            <div>
              <span className="ax-kicker">Assurance</span>
              <h2>Third-party audits</h2>
            </div>
            <StatusPill tone={thirdParty.data?.summary?.ready ? 'teal' : 'amber'}>Audits</StatusPill>
          </div>
          {(thirdParty.data?.audits ?? []).length || (thirdParty.data?.findings ?? []).length ? (
            <div className="ax-opportunity-list">
              {(thirdParty.data?.audits ?? []).map((item: any) => (
                <div className="ax-opportunity" key={item.id}>
                  <span className="ax-rank">AU</span>
                  <span>
                    <b>{item.title}</b>
                    <small>{item.firmName} · {item.auditType} · {item.status}</small>
                  </span>
                  {item.status !== 'completed' && isAdminRole(user?.role) ? (
                    <button className="ax-secondary-button" type="button" onClick={() => completeAudit.mutate(item)}>
                      Mark report received
                    </button>
                  ) : (
                    <StatusPill tone="teal">{formatLabel(item.status)}</StatusPill>
                  )}
                </div>
              ))}
              {(thirdParty.data?.findings ?? []).slice(0, 6).map((finding: any) => (
                <div className="ax-opportunity" key={finding.id}>
                  <span className="ax-rank">FD</span>
                  <span>
                    <b>{finding.title}</b>
                    <small>{finding.severity} · {finding.status}</small>
                  </span>
                  {finding.status !== 'closed' && isAdminRole(user?.role) ? (
                    <button
                      className="ax-secondary-button"
                      type="button"
                      onClick={() => void api.closeAuditFinding(finding.id).then(() => queryClient.invalidateQueries({ queryKey: ['third-party-audits'] }))}
                    >
                      Close finding
                    </button>
                  ) : (
                    <StatusPill tone="teal">Closed</StatusPill>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <OpsEmpty text="No audit engagements on file." />
          )}
        </section>
      ) : null}

      {(isAdminRole(user?.role) || user?.role === 'operator') ? (
        <section className="ax-panel">
          <div className="ax-panel-head">
            <div>
              <span className="ax-kicker">Incidents</span>
              <h2>Breach workflow</h2>
            </div>
          </div>
          <p className="ax-panel-copy">HIPAA breach clock is 60 calendar days from discovery.</p>
          <div className="ax-ops-form">
            <label>
              Breach title
              <input value={breachForm.title} onChange={(e) => setBreachForm((f) => ({ ...f, title: e.target.value }))} data-testid="input-breach-title" />
            </label>
            <label>
              Affected individuals
              <input
                type="number"
                value={breachForm.affectedIndividuals}
                onChange={(e) => setBreachForm((f) => ({ ...f, affectedIndividuals: Number(e.target.value) || 0 }))}
                data-testid="input-breach-affected"
              />
            </label>
            <label className="ax-ops-span-2">
              Description
              <input value={breachForm.description} onChange={(e) => setBreachForm((f) => ({ ...f, description: e.target.value }))} data-testid="input-breach-description" />
            </label>
            <div className="ax-ops-span-2 ax-ops-actions">
              <button
                className="ax-primary-button"
                type="button"
                disabled={openBreach.isPending || !breachForm.title || !breachForm.description}
                onClick={() => openBreach.mutate()}
                data-testid="button-open-breach"
              >
                Open breach incident
              </button>
            </div>
          </div>
          {(breaches.data ?? []).length ? (
            <div className="ax-opportunity-list" style={{ marginTop: 14 }}>
              {(breaches.data ?? []).slice(0, 5).map((incident: any) => (
                <div className="ax-opportunity" key={incident.id}>
                  <span className="ax-rank">BR</span>
                  <span>
                    <b>{incident.title}</b>
                    <small>
                      Due {incident.dueAt ? new Date(incident.dueAt).toLocaleDateString() : '—'} · {incident.status} · {incident.affectedIndividuals} individuals
                    </small>
                  </span>
                  <button
                    className="ax-secondary-button"
                    type="button"
                    onClick={() => void api.updateBreach(incident.id, { markCoveredEntityNotified: true })}
                  >
                    Mark CE notified
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <OpsEmpty text="No open breach incidents." />
          )}
        </section>
      ) : null}

      {(isAdminRole(user?.role) || user?.role === 'operator') ? (
        <section className="ax-panel">
          <div className="ax-panel-head">
            <div>
              <span className="ax-kicker">Data lifecycle</span>
              <h2>Retention, evidence & runbooks</h2>
            </div>
          </div>
          <div className="ax-ops-block">
            <h3 className="ax-ops-block-title">Retention policies</h3>
            {(retention.data?.policies ?? []).length ? (
              <div className="ax-opportunity-list">
                {(retention.data?.policies ?? []).map((policy: any) => (
                  <div className="ax-opportunity" key={policy.id}>
                    <span className="ax-rank">RT</span>
                    <span>
                      <b>{policy.resourceType}</b>
                      <small>{policy.retainDays} days · {policy.action}</small>
                    </span>
                    <button className="ax-secondary-button" type="button" onClick={() => runRetention.mutate(policy.id)}>
                      Dry-run
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <OpsEmpty text="No retention policies yet." />
            )}
            <h3 className="ax-ops-block-title">SOC2 / pen-test evidence</h3>
            {(evidence.data?.items ?? []).length ? (
              <div className="ax-opportunity-list">
                {(evidence.data?.items ?? []).slice(0, 8).map((item: any) => (
                  <div className="ax-opportunity" key={item.id}>
                    <span className="ax-rank">{String(item.framework).slice(0, 2)}</span>
                    <span>
                      <b>{item.title}</b>
                      <small>{item.controlId} · {item.status}</small>
                    </span>
                    <button className="ax-secondary-button" type="button" onClick={() => attestEvidence.mutate(item)}>
                      Attest
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <OpsEmpty text="Evidence vault is empty." />
            )}
            <h3 className="ax-ops-block-title">Production runbooks</h3>
            {(runbooks.data?.runbooks ?? []).length ? (
              <div className="ax-opportunity-list">
                {(runbooks.data?.runbooks ?? []).map((book: any) => (
                  <div className="ax-opportunity" key={book.id}>
                    <span className="ax-rank">RB</span>
                    <span>
                      <b>{book.title}</b>
                      <small>{book.cadence} · {book.category}</small>
                    </span>
                    <button className="ax-secondary-button" type="button" onClick={() => executeRunbook.mutate(book.id)}>
                      Execute
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <OpsEmpty text="No runbooks defined." />
            )}
            <div className="ax-ops-actions">
              <button className="ax-secondary-button" type="button" onClick={() => rotateKeys.mutate()} data-testid="button-rotate-keys">
                Record key rotation
              </button>
              <button className="ax-secondary-button" type="button" onClick={() => reencrypt.mutate()} data-testid="button-reencrypt-phi">
                Re-encrypt PHI under current key
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="ax-panel">
        <div className="ax-panel-head">
          <div>
            <span className="ax-kicker">Integrations</span>
            <h2>Message center</h2>
          </div>
          <StatusPill tone={inboxRows.length ? 'amber' : 'neutral'}>{inboxRows.length} messages</StatusPill>
        </div>
        {inboxRows.length ? (
          <div className="ax-claims-table">
            <div className="ax-table-head">
              <span>Type</span>
              <span>Direction</span>
              <span>Entity</span>
              <span>Status</span>
              <span>Action</span>
            </div>
            {inboxRows.slice(0, 12).map((row: any) => (
              <div className="ax-claim-row" key={row.id}>
                <span>
                  <b>{formatLabel(row.messageType)}</b>
                  <small>{row.adapterKey || row.integrationId}</small>
                </span>
                <span>{row.direction}</span>
                <span>{row.internalEntityId || '—'}</span>
                <StatusPill tone={row.status === 'ERROR' ? 'coral' : row.status === 'PROCESSED' ? 'teal' : 'amber'}>
                  {formatLabel(row.status)}
                </StatusPill>
                <button
                  className="ax-outline-button"
                  type="button"
                  onClick={() =>
                    api.retryIntegrationMessage(row.id).then(() => void queryClient.invalidateQueries({ queryKey: ['integration-messages'] }))
                  }
                >
                  Retry
                </button>
              </div>
            ))}
          </div>
        ) : (
          <OpsEmpty text="No integration messages. Partner traffic will land here." />
        )}
      </section>

      <section className="ax-panel">
        <div className="ax-panel-head">
          <div>
            <span className="ax-kicker">Audit trail</span>
            <h2>Recent activity</h2>
          </div>
          <button className="ax-text-button" type="button" onClick={() => void audit.refetch()} data-testid="button-view-audit">
            Refresh <ArrowRight size={14} />
          </button>
        </div>
        {events.length ? (
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
        ) : (
          <OpsEmpty text="No audit events yet. Actions you take will appear here." />
        )}
      </section>

      <div className="ax-security-note">
        <ShieldCheck size={16} />
        <div>
          <b>Governance posture</b>
          <span>Recommendations stay explainable and wait for human approval before a financial record changes.</span>
        </div>
        <StatusPill tone="teal">Controls active</StatusPill>
      </div>
    </div>
  );
}

function renderView(view: WorkspaceView, setView: (view: WorkspaceView) => void) {
  switch (view) {
    case 'overview':
      return (
        <>
          <Overview onNavigate={setView} />
          <RoleHome onNavigate={setView} />
        </>
      );
    case 'queue':
      return <WorkQueue />;
    case 'registration':
      return <RegistrationDesk />;
    case 'patients':
      return <Patients />;
    case 'schedule':
      return <ScheduleBoard />;
    case 'providers':
      return <Providers />;
    case 'payers':
      return <Payers />;
    case 'eligibility':
      return <Eligibility />;
    case 'authorizations':
      return <Authorizations />;
    case 'encounters':
      return <EncountersBoard />;
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
    refetchInterval: 20_000,
  });
  const recommendationsQuery = useQuery({
    queryKey: ['recommendations', 'header-notifications'],
    queryFn: api.recommendations,
    enabled: Boolean(user),
    refetchInterval: 25_000,
  });
  const copilotQuery = useAiCopilot(Boolean(user));

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
    for (const suggestion of (copilotQuery.data?.suggestions ?? []).slice(0, 3)) {
      items.unshift({
        id: `ai-${suggestion.id}`,
        title: suggestion.headline,
        detail: suggestion.nextAction || suggestion.summary,
        view: 'ai' as WorkspaceView,
      });
    }
    const signal = recommendationsQuery.data?.summary?.[0];
    if (signal) {
      items.unshift({
        id: 'signal-primary',
        title: 'Velora signal',
        detail: signal,
        view: 'leakage' as WorkspaceView,
      });
    }
    return items.slice(0, 8);
  }, [workItemsQuery.data, recommendationsQuery.data, copilotQuery.data]);

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
    if (user?.mustChangePassword) {
      setPasswordOpen(true);
      setPasswordError('Your administrator requires a password change before continuing.');
    }
  }, [user?.mustChangePassword]);

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
              {(isAdminRole(user.role) ? tenants : tenants.filter((t) => t.id === tenant.id)).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={item.id === tenant.id}
                  className={item.id === tenant.id ? 'selected' : ''}
                  disabled={!isAdminRole(user.role) || busy}
                  onClick={async () => {
                    if (!isAdminRole(user.role)) return;
                    if (item.id === tenant.id) {
                      setTenantOpen(false);
                      return;
                    }
                    setBusy(true);
                    try {
                      await setTenantId(item.id);
                      // Wipe cached queries so Meridian/Gulf/Pacific data never mixes.
                      queryClient.clear();
                      setView('overview');
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
                      {!isAdminRole(user.role) ? ' · locked to your JWT' : ''}
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
