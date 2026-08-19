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
import './Denials.css';

export function Denials() {
  const queryClient = useQueryClient();
  const ws = useTenantScope();
  const [selected, setSelected] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<any>(null);
  const denials = useQuery({ queryKey: ['denials', ws], queryFn: api.denials });
  const knowledge = useQuery({ queryKey: ['denial-knowledge', ws], queryFn: api.denialKnowledge });
  const analyze = useMutation({
    mutationFn: (id: string) => api.analyzeDenial(id),
    onSuccess: (data) => {
      setAiResult(data);
      void queryClient.invalidateQueries({ queryKey: ['denials', ws] });
      void queryClient.invalidateQueries({ queryKey: ['denial-knowledge', ws] });
      void queryClient.invalidateQueries({ queryKey: ['rules', ws] });
    },
  });
  const appeal = useMutation({
    mutationFn: (id: string) => api.appealDraft(id),
    onSuccess: setAiResult,
  });

  if (denials.isLoading) return <div className="ax-view"><LoadingState label="Loading denials…" /></div>;
  if (denials.error) return <div className="ax-view"><ErrorState error={denials.error} onRetry={() => void denials.refetch()} /></div>;

  const list = denials.data ?? [];
  const knowledgeRows = knowledge.data ?? [];
  const valueAtRisk = list.reduce((sum: number, denial: any) => sum + (denial.amount?.amount ?? 0), 0);
  const avgRecovery =
    list.length === 0
      ? 0
      : Math.round((list.reduce((sum: number, denial: any) => sum + (denial.recoveryProbability ?? 0), 0) / list.length) * 100);

  return (
    <div className="ax-view">
      <SectionHeading
        eyebrow="Recovery + prevention"
        title="Denials & appeals"
        detail="Analyze root cause → write Denial Knowledge Base entry → promote executable scrub RuleVersion so the next claim is blocked before submission."
      />
      <div className="ax-denial-summary">
        <div>
          <span>Open denials</span>
          <strong>{list.length}</strong>
          <small>Live inventory</small>
        </div>
        <div>
          <span>Recovery probability</span>
          <strong>{avgRecovery}%</strong>
          <small>Average across open cases</small>
        </div>
        <div>
          <span>Value at risk</span>
          <strong>{money(valueAtRisk)}</strong>
          <small>Gross denial exposure</small>
        </div>
        <div>
          <span>Prevention rules</span>
          <strong>{knowledgeRows.length}</strong>
          <small>Denial → scrub feedback</small>
        </div>
      </div>
      <div className="ax-denial-grid">
        {list.map((denial: any) => {
          const probability = Math.round((denial.recoveryProbability ?? 0) * 100);
          const tone = probability >= 75 ? 'teal' : probability >= 50 ? 'amber' : 'coral';
          return (
            <button
              type="button"
              className={`ax-denial-card ${selected === denial.id ? 'selected' : ''}`}
              key={denial.id}
              onClick={() => setSelected(denial.id)}
              data-testid={`card-denial-${denial.id}`}
            >
              <div className="ax-denial-card-top">
                <span className={`ax-code ${tone}`}>{denial.reasonCode}</span>
                <span className="ax-mono">{denial.dueAt ? new Date(denial.dueAt).toLocaleDateString() : '—'}</span>
              </div>
              <h2>{denial.rootCause || denial.category}</h2>
              <p>
                {denial.category} · {denial.id} · {formatLabel(denial.caseStatus || denial.status)}
              </p>
              <div className="ax-denial-value">
                <span>Value at risk</span>
                <strong>{money(denial.amount ?? 0)}</strong>
              </div>
              <div className="ax-probability">
                <span>
                  Recovery probability <b>{probability}%</b>
                </span>
                <div>
                  <i className={tone} style={{ width: `${probability}%` }} />
                </div>
              </div>
              <div className="ax-denial-next">
                <span>Next action</span>
                <b>{denial.nextAction}</b>
                <ArrowRight size={14} />
              </div>
              <div className="ax-inspection-actions" style={{ marginTop: '0.75rem' }}>
                <button
                  className="ax-outline-button"
                  type="button"
                  disabled={analyze.isPending}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelected(denial.id);
                    analyze.mutate(denial.id);
                  }}
                  data-testid={`button-analyze-${denial.id}`}
                >
                  Analyze + prevent
                </button>
                <button
                  className="ax-primary-button"
                  type="button"
                  disabled={appeal.isPending}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelected(denial.id);
                    appeal.mutate(denial.id);
                  }}
                  data-testid={`button-appeal-${denial.id}`}
                >
                  Appeal draft
                </button>
                <button
                  className="ax-outline-button"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelected(denial.id);
                    api.transitionDenial(denial.id, 'ASSIGNED').then(() => {
                      void queryClient.invalidateQueries({ queryKey: ['denials', ws] });
                    });
                  }}
                >
                  Assign
                </button>
                <button
                  className="ax-outline-button"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelected(denial.id);
                    api.transitionDenial(denial.id, 'CLOSED', 'Case closed from denial desk').then(() => {
                      void queryClient.invalidateQueries({ queryKey: ['denials', ws] });
                    });
                  }}
                >
                  Close
                </button>
              </div>
            </button>
          );
        })}
      </div>
      {aiResult ? (
        <div style={{ marginTop: '1rem' }}>
          <JobResultPanel
            kicker="AI assist + prevention"
            title={`${selected ?? 'Denial'} analysis`}
            subtitle={
              aiResult.preventionHint ||
              (aiResult.denial?.nextAction ? String(aiResult.denial.nextAction) : undefined)
            }
            insight={
              resolveJobInsight(aiResult) ?? {
                headline: `${selected ?? 'Denial'} analysis complete`,
                summary: aiResult.preventionHint || 'Denial analyzed and prevention workflow completed.',
                factors: aiResult.knowledge
                  ? [aiResult.knowledge.rootCause, aiResult.knowledge.category, aiResult.knowledge.reasonCode].filter(Boolean)
                  : undefined,
                recommendations: aiResult.preventionRule
                  ? [
                      `Promote ${aiResult.preventionRule.ruleKey} v${aiResult.preventionRule.version}`,
                      aiResult.scrubHint,
                    ].filter(Boolean) as string[]
                  : undefined,
                nextAction: aiResult.denial?.nextAction || aiResult.scrubHint,
              }
            }
            confidence={aiResult.ai?.execution?.confidence ?? aiResult.ai?.confidence}
            offline={aiResult.ai?.offline}
            badges={
              aiResult.preventionRule ? (
                <StatusPill tone={aiResult.preventionRule.severity === 'BLOCKING' ? 'coral' : 'amber'}>
                  {formatLabel(aiResult.preventionRule.severity)} rule
                </StatusPill>
              ) : null
            }
            footer={
              aiResult.preventionRule || aiResult.knowledge ? (
                <div className="ax-job-prevention">
                  {aiResult.preventionRule ? (
                    <div className="ax-job-prevention-card">
                      <span className="ax-kicker">Prevention rule promoted</span>
                      <strong>
                        {aiResult.preventionRule.ruleKey} · v{aiResult.preventionRule.version}
                      </strong>
                      <small>
                        {aiResult.preventionRule.action} · {aiResult.preventionRule.layer} ·{' '}
                        {aiResult.preventionRule.severity}
                      </small>
                      {aiResult.scrubHint ? <p>{aiResult.scrubHint}</p> : null}
                    </div>
                  ) : null}
                  {aiResult.knowledge ? (
                    <div className="ax-job-prevention-card">
                      <span className="ax-kicker">Denial knowledge base</span>
                      <strong>{aiResult.knowledge.rootCause}</strong>
                      <small>
                        {aiResult.knowledge.reasonCode} · {aiResult.knowledge.category} · linked rule{' '}
                        {aiResult.knowledge.preventionRuleKey}
                      </small>
                    </div>
                  ) : null}
                </div>
              ) : null
            }
          />
        </div>
      ) : null}
      {knowledgeRows.length > 0 ? (
        <section className="ax-panel ax-table-panel" style={{ marginTop: '1rem' }}>
          <div className="ax-panel-head">
            <div>
              <span className="ax-kicker">Denial knowledge base</span>
              <h2>{knowledgeRows.length} prevention links</h2>
            </div>
          </div>
          <div className="ax-claims-table">
            <div className="ax-table-head">
              <span>Denial</span>
              <span>Root cause</span>
              <span>Prevention rule</span>
              <span>Procedures</span>
            </div>
            {knowledgeRows.map((row: any) => (
              <div className="ax-claim-row" key={row.id} data-testid={`row-dkb-${row.id}`}>
                <span>
                  <b>{row.denialId}</b>
                  <small>{row.reasonCode}</small>
                </span>
                <span>
                  <b>{row.rootCause}</b>
                  <small>{row.category}</small>
                </span>
                <span>
                  <b>{row.preventionRuleKey}</b>
                  <small>{row.summary}</small>
                </span>
                <span className="ax-mono">{(row.procedureCodes ?? []).join(', ') || '—'}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

