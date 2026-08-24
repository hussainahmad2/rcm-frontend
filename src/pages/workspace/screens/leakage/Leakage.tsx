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
import './Leakage.css';

export function Leakage() {
  const leakage = useQuery({ queryKey: ['leakage'], queryFn: api.leakage });

  if (leakage.isLoading) return <div className="ax-view"><LoadingState label="Loading leakage…" /></div>;
  if (leakage.error) return <div className="ax-view"><ErrorState error={leakage.error} onRetry={() => void leakage.refetch()} /></div>;

  const data = leakage.data ?? {};
  const signals = data.signals ?? [];
  const total = data.potentialLeakage ?? 0;

  return (
    <div className="ax-view">
      <SectionHeading
        eyebrow="Setup"
        title="Lost money"
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

