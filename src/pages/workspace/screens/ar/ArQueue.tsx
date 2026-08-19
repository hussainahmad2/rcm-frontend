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
import './ArQueue.css';

export function ArQueue() {
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

