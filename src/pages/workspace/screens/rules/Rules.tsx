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
import './Rules.css';

export function Rules() {
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

