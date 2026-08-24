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
import './Authorizations.css';

export function Authorizations() {
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
        eyebrow="Before the visit"
        title="Prior auths"
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

