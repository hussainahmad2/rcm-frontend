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
import './WorkQueue.css';

export function WorkQueue() {
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
        eyebrow="Today"
        title="My work"
        detail={`${visible.length} open items · sorted by money at risk and how soon they are due`}
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
            placeholder="Search tasks, insurance, or visits"
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
                  <span>Insurance</span>
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

