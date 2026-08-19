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
import './Coding.css';

export function Coding() {
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

