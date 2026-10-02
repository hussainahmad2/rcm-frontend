import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Bot,
  ChevronRight,
  ClipboardCheck,
  FileCheck2,
  Handshake,
  ShieldAlert,
  Sparkles,
  Stethoscope,
  UserRoundCheck,
  BarChart3,
  BadgeDollarSign,
  Settings2,
} from 'lucide-react';
import { api, asPercent } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { navigateWorkspace, viewForAiUseCase } from '@/lib/workspace-nav';
import { formatLabel, parseAiInsight, resolveJobInsight, type AiInsightView } from '../../shared/format';
import { ErrorState, LoadingState, StatusPill } from '../../shared/ui';
import './Workforce.css';

type FloorAgent = {
  id: string;
  name: string;
  description: string;
  useCase: string;
  checksToday: number;
  reviewRequired: number;
  confidenceAvg: number;
  screen: string;
  status: 'WATCHING' | 'IDLE' | 'REVIEW';
  watchingLabel: string;
  lastSignal: string;
};

type FloorEvent = {
  id: string;
  at: string;
  screen: string;
  agentId: string;
  agentName: string;
  headline: string;
  detail: string;
};

type ExecutionRow = {
  id: string;
  agentId: string;
  useCase: string;
  output: string;
  confidence: number;
  humanReviewRequired: boolean;
  decision?: string;
  latencyMs?: number;
  createdAt: string;
};

type Playbook = {
  reads: string;
  prepares: string;
  decision: string;
  steps: { title: string; detail: string }[];
};

const AGENT_ICON: Record<string, typeof Bot> = {
  'agent-eligibility': UserRoundCheck,
  'agent-authorization': ClipboardCheck,
  'agent-coding-qa': Stethoscope,
  'agent-claim-qa': FileCheck2,
  'agent-denial': ShieldAlert,
  'agent-appeal': ShieldAlert,
  'agent-payment': BadgeDollarSign,
  'agent-ar': BarChart3,
  'agent-contract': Handshake,
  'agent-audit': Settings2,
};

const PLAYBOOKS: Record<string, Playbook> = {
  eligibility_check: {
    reads: 'Coverage on file, payer response, and the registration for the visit.',
    prepares: 'A discrepancy list: inactive coverage, plan mismatch, date gaps, and auth that may be required.',
    decision: 'Coverage is not updated until a person accepts the finding.',
    steps: [
      { title: 'Watch the eligibility lane', detail: 'New registrations and upcoming visits enter this queue.' },
      { title: 'Read coverage', detail: 'Plan, status, and effective dates are compared with what was captured at registration.' },
      { title: 'Flag the gap', detail: 'Inactive coverage, a wrong plan, or a likely auth requirement is called out with the reason.' },
      { title: 'Hand it over', detail: 'Registration staff clear the exception. The agent does not rewrite coverage.' },
    ],
  },
  coding_qa: {
    reads: 'Encounter documentation and the codes already on the charge.',
    prepares: 'Specificity, modifier, and documentation-support notes, plus a denial-risk read.',
    decision: 'Coding QA always waits for a coder to accept, modify, or reject before release.',
    steps: [
      { title: 'Watch encounters in coding', detail: 'Charges sitting before release are the work.' },
      { title: 'Read the note and the lines', detail: 'CPT, ICD, and modifiers are checked against what the documentation supports.' },
      { title: 'Score the risk', detail: 'Weak specificity or a bad payer pairing is called out before the claim is built.' },
      { title: 'Hold for a coder', detail: 'Release stays blocked until a person decides. Nothing posts on its own.' },
    ],
  },
  claim_qa: {
    reads: 'Claim status, quality score, denial probability, and the amount.',
    prepares: 'A pre-submit read: hold, or ready for an operator to transmit.',
    decision: 'The agent does not submit. An operator transmits the claim.',
    steps: [
      { title: 'Watch claims before send', detail: 'Draft and ready claims are the lane.' },
      { title: 'Read quality and risk', detail: 'Completeness, edits, and denial probability are reviewed together.' },
      { title: 'Recommend hold or ready', detail: 'The output says what would block a clean pass.' },
      { title: 'Wait for submit', detail: 'Transmission stays with the biller.' },
    ],
  },
  authorization_risk: {
    reads: 'The service, payer auth rules, and any auth already on file.',
    prepares: 'A proceed-or-hold recommendation when auth is missing, wrong, or about to expire.',
    decision: 'Billing waits until a person confirms the auth path.',
    steps: [
      { title: 'Watch services that need auth', detail: 'Scheduled and coded services are matched to payer rules.' },
      { title: 'Check what is on file', detail: 'Status, units, and expiration are read against the date of service.' },
      { title: 'Flag the risk', detail: 'Missing, expired, or insufficient auth is named before the claim moves.' },
      { title: 'Hold billing', detail: 'A person obtains or confirms auth. The agent does not create an authorization.' },
    ],
  },
  denial_analysis: {
    reads: 'The payer response: reason code, category, root cause, and amount.',
    prepares: 'A recovery path with the factors behind it.',
    decision: 'Denial analysis always waits for a person before correction or appeal.',
    steps: [
      { title: 'Watch new payer responses', detail: 'Denials and rejections land in this lane.' },
      { title: 'Read the reason', detail: 'Code, category, and dollars are tied to a root cause.' },
      { title: 'Suggest recovery', detail: 'Correct and resubmit, appeal, or write off — with the reason for that path.' },
      { title: 'Wait for review', detail: 'No correction or appeal starts until someone accepts it.' },
    ],
  },
  appeal_draft: {
    reads: 'The denial and any analysis already on that case.',
    prepares: 'An appeal outline and the evidence a reviewer should attach.',
    decision: 'Appeal drafts always wait for a person. Nothing is filed by the agent.',
    steps: [
      { title: 'Watch denials ready to appeal', detail: 'Only cases with a denial to answer are in this lane.' },
      { title: 'Read the case', detail: 'Reason code and prior analysis set the argument.' },
      { title: 'Draft the outline', detail: 'Points and evidence checkpoints are written for a reviewer.' },
      { title: 'Stop at approval', detail: 'Filing happens only after a person accepts the draft.' },
    ],
  },
  payment_variance: {
    reads: 'Posted remittance against the expected allowed amount.',
    prepares: 'Underpayment and variance follow-up for the payment team.',
    decision: 'Posting and takeback stay with the payment team.',
    steps: [
      { title: 'Watch posted remits', detail: 'Payments that have landed are the input.' },
      { title: 'Compare to expected', detail: 'Paid amount is set against the allowed amount for that claim.' },
      { title: 'Flag the variance', detail: 'Short pays and odd adjustments are listed with the gap.' },
      { title: 'Hand off follow-up', detail: 'The payment team works the variance. The agent does not post.' },
    ],
  },
  ar_prioritize: {
    reads: 'Open balances, age, timely filing, and payer behavior.',
    prepares: 'A ranked queue and a next action for each account.',
    decision: 'Collectors work the accounts. The agent does not contact payers.',
    steps: [
      { title: 'Watch open balances', detail: 'Unpaid accounts are the lane.' },
      { title: 'Score the account', detail: 'Amount, age, filing limit, and payer pattern set the rank.' },
      { title: 'Order the queue', detail: 'The highest-recovery work is placed first.' },
      { title: 'Suggest the next call', detail: 'Collectors take the action. Outreach is not sent automatically.' },
    ],
  },
  contract_variance: {
    reads: 'What was paid versus the contracted rate on that service.',
    prepares: 'Lines where the allowed amount diverges from the contract.',
    decision: 'Contract rates are not changed by the agent. Variance goes to contract review.',
    steps: [
      { title: 'Watch paid claims', detail: 'Payments with a contract on file are in scope.' },
      { title: 'Compare to the rate', detail: 'Allowed amount is set against the expected contracted rate.' },
      { title: 'Highlight the gap', detail: 'Each variance is named with the dollars involved.' },
      { title: 'Route to contracts', detail: 'A person reviews the rate. The contract is not edited automatically.' },
    ],
  },
  audit_anomaly: {
    reads: 'Recent claim and denial activity in this workspace.',
    prepares: 'Unusual patterns, each with an explanation an operator can check.',
    decision: 'A finding does not change a record. Operations decides what to do with it.',
    steps: [
      { title: 'Watch recent activity', detail: 'Claim, denial, and payment movement is the input.' },
      { title: 'Look for the unusual', detail: 'Spikes, repeated edits, and odd patterns are separated from normal work.' },
      { title: 'Explain the finding', detail: 'Each item says what was seen and why it is worth a look.' },
      { title: 'Leave the decision', detail: 'Operations reviews it. The agent does not correct the record.' },
    ],
  },
};

const FALLBACK_PLAYBOOK: Playbook = {
  reads: 'The work currently in this lane.',
  prepares: 'A recommendation with the factors behind it.',
  decision: 'A person accepts, modifies, or rejects the output. The record does not change on its own.',
  steps: [
    { title: 'Watch the lane', detail: 'Open work for this agent is the queue.' },
    { title: 'Read the case', detail: 'Only the facts needed for this use case are pulled in.' },
    { title: 'Prepare the output', detail: 'The recommendation and its reasons are written for review.' },
    { title: 'Wait for a person', detail: 'Nothing is posted until someone decides.' },
  ],
};

function relativeTime(iso: string) {
  const delta = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(delta) || delta < 0) return 'just now';
  const mins = Math.floor(delta / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function firstLine(text: string, fallback = '') {
  const line = String(text ?? '')
    .split('\n')
    .map((row) => row.trim())
    .find(Boolean);
  if (!line) return fallback;
  return line.length > 140 ? `${line.slice(0, 137)}…` : line;
}

function sliceSection(text: string, label: string, stops: string[]) {
  const start = text.toLowerCase().indexOf(label.toLowerCase());
  if (start < 0) return '';
  let rest = text.slice(start + label.length);
  let end = rest.length;
  for (const stop of stops) {
    const at = rest.toLowerCase().indexOf(stop.toLowerCase());
    if (at >= 0 && at < end) end = at;
  }
  return rest.slice(0, end).trim();
}

function bullets(text: string) {
  return text
    .split(/\s+-\s+/)
    .map((item) => item.replace(/^[-•]\s*/, '').trim())
    .filter(Boolean);
}

function presentInsight(insight: AiInsightView | null, raw?: string): AiInsightView | null {
  const base = insight ?? (raw ? { headline: firstLine(raw, 'Latest output'), summary: raw } : null);
  if (!base || base.factors?.length || base.recommendations?.length) return base;
  const source = `${base.summary ?? ''}\n${raw ?? ''}`;
  const factorText = sliceSection(source, 'Primary factors:', ['Recommendations:', 'Next action:', 'Risk:']);
  const recommendationText = sliceSection(source, 'Recommendations:', ['Next action:', 'Risk:']);
  const nextAction = sliceSection(source, 'Next action:', ['Risk:']);
  if (!factorText && !recommendationText && !nextAction) return base;
  const summary = source.split(/primary factors:/i)[0].trim();
  return {
    ...base,
    summary: summary || base.summary,
    factors: bullets(factorText),
    recommendations: bullets(recommendationText),
    nextAction: nextAction || base.nextAction,
  };
}

function statusTone(status: FloorAgent['status']) {
  if (status === 'REVIEW') return 'amber' as const;
  if (status === 'WATCHING') return 'teal' as const;
  return 'neutral' as const;
}

function playbookFor(agent: FloorAgent) {
  return PLAYBOOKS[agent.useCase] ?? FALLBACK_PLAYBOOK;
}

function cardFoot(agent: FloorAgent) {
  if (agent.checksToday) {
    return `${agent.checksToday} run${agent.checksToday === 1 ? '' : 's'} · ${asPercent(agent.confidenceAvg)}%`;
  }
  if (agent.status === 'REVIEW') return 'Waiting on a person';
  if (agent.status === 'WATCHING') return 'On watch';
  return 'Standing by';
}

function agentExecutions(agent: FloorAgent, executions: ExecutionRow[]) {
  return executions
    .filter((row) => row.agentId === agent.id || row.useCase === agent.useCase)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

type LogRow = {
  id: string;
  at: string;
  headline: string;
  detail: string;
  kind: 'review' | 'decided' | 'run' | 'audit';
};

function buildLog(agent: FloorAgent, feed: FloorEvent[], executions: ExecutionRow[]): LogRow[] {
  const fromExec: LogRow[] = executions
    .filter((row) => row.agentId === agent.id || row.useCase === agent.useCase)
    .map((row) => ({
      id: row.id,
      at: row.createdAt,
      headline: firstLine(row.output, `${agent.name} completed a run`),
      detail: row.decision
        ? `${formatLabel(row.decision)} · ${asPercent(row.confidence)}%`
        : row.humanReviewRequired
          ? 'Waiting on a person'
          : `${asPercent(row.confidence)}% confidence${row.latencyMs != null ? ` · ${row.latencyMs} ms` : ''}`,
      kind: row.decision ? 'decided' : row.humanReviewRequired ? 'review' : 'run',
    }));
  const seen = new Set(fromExec.map((row) => row.id));
  const fromFeed: LogRow[] = feed
    .filter((event) => (event.agentId === agent.id || event.agentName === agent.name) && !seen.has(event.id))
    .map((event) => ({
      id: event.id,
      at: event.at,
      headline: event.headline,
      detail: event.detail,
      kind: 'audit' as const,
    }));
  return [...fromExec, ...fromFeed]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 40);
}

export function Workforce() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<any>(null);
  const [runningId, setRunningId] = useState('');

  const floor = useQuery({
    queryKey: ['ai-floor'],
    queryFn: api.aiFloor,
    refetchInterval: 10_000,
    retry: 1,
  });

  const executions = useQuery({
    queryKey: ['ai-executions'],
    queryFn: api.aiExecutions,
    enabled: Boolean(selectedId),
    refetchInterval: selectedId ? 10_000 : false,
    retry: 1,
  });

  const run = useMutation({
    mutationFn: (agentId: string) => api.runAgent(agentId),
    onMutate: (agentId) => setRunningId(agentId),
    onSuccess: (data) => {
      if (data?.error) {
        toast({
          title: 'Agent run incomplete',
          description: String(data.error),
          variant: 'destructive',
        });
        return;
      }
      setRunResult(data);
      toast({
        title: data?.insight?.headline ?? data?.agent?.name ?? 'Agent completed',
        description: data?.insight?.nextAction ?? 'Review the output on this agent. Nothing posts until you approve.',
        variant: 'success',
        navigateTo: 'ai',
      });
      void queryClient.invalidateQueries({ queryKey: ['ai-floor'] });
      void queryClient.invalidateQueries({ queryKey: ['ai-executions'] });
      void queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Agent run incomplete',
        description: error.message,
        variant: 'destructive',
      });
    },
    onSettled: () => setRunningId(''),
  });

  const decide = useMutation({
    mutationFn: (body: { executionId: string; decision: 'ACCEPT' | 'MODIFY' | 'REJECT' }) =>
      api.decideAiExecution(body.executionId, { decision: body.decision }),
    onSuccess: (data, variables) => {
      if (data?.error) {
        toast({ title: 'Decision not saved', description: String(data.error), variant: 'destructive' });
        return;
      }
      setRunResult((prev: any) =>
        prev?.execution?.id === variables.executionId
          ? { ...prev, execution: { ...prev.execution, decision: variables.decision } }
          : prev,
      );
      toast({
        title: `Marked ${formatLabel(variables.decision).toLowerCase()}`,
        description: 'The decision is on the activity log. The record is unchanged until the lane acts on it.',
        variant: 'success',
      });
      void queryClient.invalidateQueries({ queryKey: ['ai-floor'] });
      void queryClient.invalidateQueries({ queryKey: ['ai-executions'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Decision not saved', description: error.message, variant: 'destructive' });
    },
  });

  useEffect(() => {
    if (!selectedId) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId]);

  if (floor.isLoading) return <div className="ax-view"><LoadingState label="Loading AI workforce…" /></div>;
  if (floor.error) {
    return (
      <div className="ax-view">
        <ErrorState error={floor.error} onRetry={() => void floor.refetch()} />
      </div>
    );
  }

  const agents: FloorAgent[] = floor.data?.agents ?? [];
  const feed: FloorEvent[] = floor.data?.feed ?? [];
  const summary = floor.data?.summary ?? { agentCount: 0, watching: 0, review: 0, executionsToday: 0 };
  const selected = agents.find((agent) => agent.id === selectedId) ?? null;

  if (selected) {
    return (
      <AgentDesk
        agent={selected}
        feed={feed}
        executions={(executions.data ?? []) as ExecutionRow[]}
        model={floor.data?.ok ? floor.data?.model : 'Rules standby'}
        online={Boolean(floor.data?.ok)}
        running={runningId === selected.id}
        runResult={runResult?.agent?.id === selected.id ? runResult : null}
        deciding={decide.isPending}
        onBack={() => setSelectedId(null)}
        onRun={() => run.mutate(selected.id)}
        onDecide={(executionId, decision) => decide.mutate({ executionId, decision })}
      />
    );
  }

  return (
    <div className="ax-view ax-ai-floor">
      <header className={`ax-ai-command ${floor.data?.ok ? 'online' : 'standby'}`}>
        <div className="ax-ai-command-top">
          <div>
            <span className="ax-kicker">Operations</span>
            <h1>AI workforce</h1>
            <p>One agent per revenue lane. Open an agent for its workflow, what it is doing now, and its activity log.</p>
          </div>
          <span className="ax-ai-live">
            <i />
            {floor.data?.ok ? 'Model online' : 'Rules standby'}
          </span>
        </div>
        <div className="ax-ai-command-stats">
          <div>
            <span>Agents</span>
            <strong>{summary.agentCount}</strong>
          </div>
          <div>
            <span>Watching</span>
            <strong>{summary.watching}</strong>
          </div>
          <div>
            <span>Needs review</span>
            <strong>{summary.review}</strong>
          </div>
          <div>
            <span>Runs today</span>
            <strong>{summary.executionsToday}</strong>
          </div>
        </div>
      </header>

      {agents.length ? (
        <div className="ax-ai-roster">
          {agents.map((agent) => {
            const Icon = AGENT_ICON[agent.id] ?? Bot;
            return (
              <button
                key={agent.id}
                type="button"
                className={`ax-ai-card is-${agent.status.toLowerCase()}`}
                onClick={() => setSelectedId(agent.id)}
                data-testid={`button-open-agent-${agent.id}`}
              >
                <span className="ax-ai-card-top">
                  <span className="ax-agent-icon">
                    <Icon size={16} />
                  </span>
                  <StatusPill tone={statusTone(agent.status)}>{formatLabel(agent.status)}</StatusPill>
                </span>
                <strong>{agent.name}</strong>
                <p>{agent.description}</p>
                <span className="ax-ai-card-meta">
                  <b>{agent.screen}</b>
                  <span>{agent.watchingLabel}</span>
                </span>
                <span className="ax-ai-card-signal">{agent.lastSignal}</span>
                <span className="ax-ai-card-foot">
                  <span>{cardFoot(agent)}</span>
                  <ChevronRight size={16} />
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="ax-empty">
          <b>No agents on this floor</b>
          <p>Agents appear when the workspace is ready. Each one watches a single lane.</p>
        </div>
      )}
    </div>
  );
}

function AgentDesk({
  agent,
  feed,
  executions,
  model,
  online,
  running,
  runResult,
  deciding,
  onBack,
  onRun,
  onDecide,
}: {
  agent: FloorAgent;
  feed: FloorEvent[];
  executions: ExecutionRow[];
  model?: string;
  online: boolean;
  running: boolean;
  runResult: any;
  deciding: boolean;
  onBack: () => void;
  onRun: () => void;
  onDecide: (executionId: string, decision: 'ACCEPT' | 'MODIFY' | 'REJECT') => void;
}) {
  const playbook = playbookFor(agent);
  const Icon = AGENT_ICON[agent.id] ?? Bot;
  const log = useMemo(() => buildLog(agent, feed, executions), [agent, feed, executions]);
  const mine = useMemo(() => agentExecutions(agent, executions), [agent, executions]);
  const latest = mine[0];
  const today = new Date().toISOString().slice(0, 10);
  const runsToday = Math.max(agent.checksToday, mine.filter((row) => row.createdAt?.startsWith(today)).length);
  const needsPerson = mine.length
    ? mine.filter((row) => row.humanReviewRequired && !row.decision).length
    : agent.reviewRequired;
  const confidencePool = mine.length ? mine : [];
  const confidenceAvg = confidencePool.length
    ? confidencePool.reduce((sum, row) => sum + (Number(row.confidence) || 0), 0) / confidencePool.length
    : agent.checksToday
      ? agent.confidenceAvg
      : null;

  const pending =
    (runResult?.execution?.humanReviewRequired && !runResult?.execution?.decision
      ? (runResult.execution as ExecutionRow)
      : null) ||
    [...executions]
      .filter(
        (row) =>
          (row.agentId === agent.id || row.useCase === agent.useCase) &&
          row.humanReviewRequired &&
          !row.decision,
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  const insight: AiInsightView | null = presentInsight(
    (runResult?.insight && typeof runResult.insight === 'object' ? (runResult.insight as AiInsightView) : null) ||
      resolveJobInsight(runResult) ||
      parseAiInsight(latest?.output),
    latest?.output,
  );

  const outputSummary = insight?.summary || (latest ? firstLine(latest.output, '') : '');
  const showOutput = Boolean(runResult || latest);

  return (
    <div className="ax-view ax-agent-desk">
      <button type="button" className="ax-agent-back" onClick={onBack}>
        <ArrowLeft size={15} />
        AI workforce
      </button>

      <header className="ax-panel ax-agent-identity">
        <div className="ax-agent-identity-main">
          <span className={`ax-agent-icon is-${agent.status.toLowerCase()}`}>
            <Icon size={18} />
          </span>
          <div>
            <div className="ax-agent-identity-line">
              <span className="ax-kicker">{agent.screen}</span>
              <StatusPill tone={statusTone(agent.status)}>{formatLabel(agent.status)}</StatusPill>
              <span className={`ax-ai-live compact ${online ? '' : 'standby'}`}>
                <i />
                {online ? 'Model online' : 'Rules standby'}
              </span>
            </div>
            <h1>{agent.name}</h1>
            <p>{agent.description}</p>
          </div>
        </div>
        <div className="ax-agent-actions">
          <button
            type="button"
            className="ax-outline-button"
            onClick={() => navigateWorkspace(viewForAiUseCase(agent.useCase))}
          >
            Open {agent.screen}
          </button>
          <button
            type="button"
            className="ax-primary-button"
            disabled={running}
            onClick={onRun}
            data-testid={`button-run-agent-${agent.id}`}
          >
            <Sparkles size={14} />
            {running ? 'Running…' : 'Run agent'}
          </button>
        </div>
      </header>

      <section className="ax-agent-metrics" aria-label="Agent activity">
        <div>
          <span>Runs today</span>
          <strong>{runsToday}</strong>
        </div>
        <div>
          <span>Needs a person</span>
          <strong>{needsPerson}</strong>
        </div>
        <div>
          <span>Confidence</span>
          <strong>{confidenceAvg == null ? '—' : `${asPercent(confidenceAvg)}%`}</strong>
        </div>
        <div>
          <span>Watching</span>
          <strong className="is-text">{agent.watchingLabel}</strong>
        </div>
      </section>

      <div className="ax-agent-work">
        <section className="ax-panel">
          <div className="ax-panel-head">
            <div>
              <span className="ax-kicker">Workflow</span>
              <h2>How this agent works</h2>
            </div>
          </div>
          <ol className="ax-agent-steps">
            {playbook.steps.map((step, index) => (
              <li key={step.title} className="ax-agent-step">
                <span className="ax-agent-step-mark" aria-hidden="true">
                  <span>{index + 1}</span>
                </span>
                <span>
                  <b>{step.title}</b>
                  <small>{step.detail}</small>
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section className="ax-panel">
          <div className="ax-panel-head">
            <div>
              <span className="ax-kicker">Operating now</span>
              <h2>{formatLabel(agent.status)}</h2>
            </div>
          </div>
          <dl className="ax-agent-facts">
            <div>
              <dt>Right now</dt>
              <dd>{agent.lastSignal}</dd>
            </div>
            <div>
              <dt>Reads</dt>
              <dd>{playbook.reads}</dd>
            </div>
            <div>
              <dt>Prepares</dt>
              <dd>{playbook.prepares}</dd>
            </div>
            <div>
              <dt>Who decides</dt>
              <dd>{playbook.decision}</dd>
            </div>
            {model ? (
              <div>
                <dt>Engine</dt>
                <dd>{model}</dd>
              </div>
            ) : null}
          </dl>
        </section>
      </div>

      <section className="ax-panel">
        <div className="ax-panel-head">
          <div>
            <span className="ax-kicker">Activity log</span>
            <h2>{agent.name}</h2>
          </div>
          <StatusPill tone={log.length ? 'teal' : 'neutral'}>{log.length} events</StatusPill>
        </div>
        {log.length ? (
          <ol className="ax-ai-feed">
            {log.map((event) => (
              <li key={event.id} className={`is-${event.kind}`}>
                <span className="ax-ai-feed-rail" aria-hidden="true" />
                <span className="ax-ai-feed-time">{relativeTime(event.at)}</span>
                <span>
                  <b>{event.headline}</b>
                  <small>{event.detail}</small>
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <div className="ax-empty ax-agent-empty">
            <b>No activity yet</b>
            <p>Run this agent, or work its lane. Completions and audit events show up here.</p>
          </div>
        )}
      </section>

      {showOutput ? (
        <section className="ax-ai-result" data-testid="ai-run-result">
          <div className="ax-ai-result-head">
            <div>
              <span className="ax-kicker">{runResult ? 'This run' : 'Latest output'}</span>
              <h2>{insight?.headline ?? agent.name}</h2>
              <p>
                {agent.name}
                {runResult?.decisionBand ? ` · ${formatLabel(runResult.decisionBand)}` : ''}
                {runResult
                  ? ` · ${asPercent(runResult.confidence ?? runResult.execution?.confidence)}% confidence`
                  : latest
                    ? ` · ${asPercent(latest.confidence)}% confidence`
                    : ''}
                {runResult?.latencyMs != null ? ` · ${runResult.latencyMs} ms` : ''}
              </p>
            </div>
            <StatusPill tone={runResult?.offline ? 'amber' : pending ? 'amber' : 'teal'}>
              {runResult?.offline ? 'Rules fallback' : pending ? 'Waiting on you' : latest?.decision ? formatLabel(latest.decision) : 'Recorded'}
            </StatusPill>
          </div>
          {outputSummary ? <p className="ax-ai-summary">{outputSummary}</p> : null}
          {insight?.factors?.length || insight?.recommendations?.length ? (
            <div className="ax-ai-columns">
              <div>
                <h3>Factors</h3>
                <ul>
                  {(insight?.factors ?? []).map((factor) => (
                    <li key={factor}>{factor}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3>Recommendations</h3>
                <ul>
                  {(insight?.recommendations ?? []).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
          {insight?.nextAction ? (
            <div className="ax-ai-next">
              <Sparkles size={15} />
              <div>
                <span className="ax-kicker">Next action</span>
                <strong>{insight.nextAction}</strong>
              </div>
            </div>
          ) : null}
          {pending ? (
            <div className="ax-agent-decide">
              <div>
                <span className="ax-kicker">Your decision</span>
                <strong>This does not change the record until the lane acts on it.</strong>
              </div>
              <div className="ax-agent-decide-actions">
                <button
                  type="button"
                  className="ax-primary-button"
                  disabled={deciding}
                  onClick={() => onDecide(pending.id, 'ACCEPT')}
                >
                  Accept
                </button>
                <button
                  type="button"
                  className="ax-outline-button"
                  disabled={deciding}
                  onClick={() => onDecide(pending.id, 'MODIFY')}
                >
                  Modify
                </button>
                <button
                  type="button"
                  className="ax-outline-button"
                  disabled={deciding}
                  onClick={() => onDecide(pending.id, 'REJECT')}
                >
                  Reject
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
