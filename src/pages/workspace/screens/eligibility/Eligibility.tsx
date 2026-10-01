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
import './Eligibility.css';

export function Eligibility() {
  const queryClient = useQueryClient();
  const [resultByCoverage, setResultByCoverage] = useState<Record<string, any>>({});
  const [estimateByCoverage, setEstimateByCoverage] = useState<Record<string, any>>({});
  const [manualByCoverage, setManualByCoverage] = useState<Record<string, any>>({});
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
  const manual = useMutation({
    mutationFn: (coverageId: string) =>
      api.manualVerifyCoverage(coverageId, {
        method: 'PHONE',
        representative: 'Payer representative',
        referenceNumber: `PH-${coverageId.slice(-4)}`,
        notes: 'Manual phone verification recorded from eligibility desk',
      }),
    onSuccess: (data, coverageId) => {
      if (data?.error) {
        toast({
          title: 'Verification could not be saved',
          description: String(data.error),
          variant: 'destructive',
        });
        return;
      }
      setManualByCoverage((current) => ({ ...current, [coverageId]: data }));
      toast({
        title: 'Coverage verified',
        description: 'Phone verification recorded. Coverage is marked verified.',
        variant: 'success',
        navigateTo: 'eligibility',
      });
      void queryClient.invalidateQueries({ queryKey: ['coverages'] });
      void queryClient.invalidateQueries({ queryKey: ['work-items'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Verification could not be saved',
        description: error.message,
        variant: 'destructive',
      });
    },
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
            const manualResult = manualByCoverage[coverage.id];
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
                    disabled={manual.isPending}
                    onClick={() => manual.mutate(coverage.id)}
                    data-testid={`button-manual-verify-${coverage.id}`}
                  >
                    {manual.isPending && manual.variables === coverage.id ? 'Recording…' : 'Manual verify'}
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
                {manualResult && !manualResult.error ? (
                  <div className="ax-insight-card ax-insight-card-estimate" style={{ gridColumn: '1 / -1' }}>
                    <div className="ax-insight-card-top">
                      <div>
                        <span className="ax-kicker">Manual verification</span>
                        <h3>Phone verification recorded</h3>
                      </div>
                      <StatusPill tone="teal">Verified</StatusPill>
                    </div>
                    <p className="ax-insight-summary">
                      Staff confirmed this coverage with the payer by phone. This is not an electronic 271. Use it when the
                      payer portal or call is the source of truth.
                    </p>
                    <div className="ax-insight-meta">
                      <span>
                        Method <b>{manualResult.method || 'PHONE'}</b>
                      </span>
                      <span>
                        Reference <b>{manualResult.eligibilityCase?.referenceNumber || '—'}</b>
                      </span>
                      <span>
                        Representative <b>{manualResult.eligibilityCase?.representative || '—'}</b>
                      </span>
                      <span>
                        Coverage <b>{formatLabel(manualResult.coverage?.status || 'ACTIVE')}</b>
                      </span>
                    </div>
                  </div>
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

