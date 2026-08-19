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
import './Overview.css';

const CHART_COLORS = ['#2a9d8f', '#1f8fbf', '#1e293b', '#d4a017', '#0ea5e9'];

export function Overview({ onNavigate }: { onNavigate: (view: WorkspaceView) => void }) {
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

