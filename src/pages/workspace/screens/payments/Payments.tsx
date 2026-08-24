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
import './Payments.css';

export function Payments() {
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
        eyebrow="Getting paid"
        title="Payments"
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

