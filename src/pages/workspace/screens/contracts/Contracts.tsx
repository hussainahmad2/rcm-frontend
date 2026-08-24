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
import './Contracts.css';

export function Contracts() {
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
        eyebrow="Setup"
        title="Payer contracts"
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

