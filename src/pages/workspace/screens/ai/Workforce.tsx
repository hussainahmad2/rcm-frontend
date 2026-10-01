import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bot,
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
import { formatLabel, resolveJobInsight, type AiInsightView } from '../../shared/format';
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

function statusTone(status: FloorAgent['status']) {
  if (status === 'REVIEW') return 'amber' as const;
  if (status === 'WATCHING') return 'teal' as const;
  return 'neutral' as const;
}

export function Workforce() {
  const queryClient = useQueryClient();
  const [runResult, setRunResult] = useState<any>(null);
  const [runningId, setRunningId] = useState('');
  const resultRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!runResult) return;
    resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [runResult]);

  const floor = useQuery({
    queryKey: ['ai-floor'],
    queryFn: api.aiFloor,
    refetchInterval: 10_000,
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
        description: data?.insight?.nextAction ?? 'Review the output below. Nothing posts until you approve.',
        variant: 'success',
      });
      void queryClient.invalidateQueries({ queryKey: ['ai-floor'] });
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

  if (floor.isLoading) return <div className="ax-view"><LoadingState label="Loading AI floor…" /></div>;
  if (floor.error) {
    return (
      <div className="ax-view">
        <ErrorState error={floor.error} onRetry={() => void floor.refetch()} />
      </div>
    );
  }

  const agents: FloorAgent[] = floor.data?.agents ?? [];
  const feed: FloorEvent[] = floor.data?.feed ?? [];
  const summary = floor.data?.summary ?? { agentCount: 0, watching: 0, review: 0, executionsToday: 0, workItems: 0 };
  const suggestions = floor.data?.suggestions ?? [];
  const watchingAgents = agents.filter((row) => row.status !== 'IDLE');
  const insight =
    (runResult?.insight && typeof runResult.insight === 'object'
      ? (runResult.insight as AiInsightView)
      : null) || resolveJobInsight(runResult);

  return (
    <div className="ax-view ax-ai-floor">
      <header className={`ax-ai-command ${floor.data?.ok ? 'online' : 'standby'}`}>
        <div className="ax-ai-command-top">
          <div>
            <span className="ax-kicker">Operations floor</span>
            <h1>AI workforce</h1>
            <p>Agents watch every lane of the cash cycle. They prepare work. People approve what changes the record.</p>
          </div>
          <span className="ax-ai-live">
            <i />
            {floor.data?.ok ? 'Model online' : 'Rules standby'}
            <em>{floor.data?.model ?? 'fallback-rules'}</em>
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
            <span>Human review</span>
            <strong>{summary.review}</strong>
          </div>
          <div>
            <span>Open work</span>
            <strong>{summary.workItems}</strong>
          </div>
        </div>
      </header>

      <div className="ax-ai-floor-body">
        <section className="ax-panel ax-ai-panel">
          <div className="ax-panel-head">
            <div>
              <span className="ax-kicker">Live activity</span>
              <h2>Background work</h2>
            </div>
            <StatusPill tone="teal">{feed.length} events</StatusPill>
          </div>
          {feed.length ? (
            <ol className="ax-ai-feed">
              {feed.map((event) => (
                <li key={event.id}>
                  <span className="ax-ai-feed-rail" aria-hidden="true" />
                  <span className="ax-ai-feed-time">{relativeTime(event.at)}</span>
                  <span>
                    <b>{event.headline}</b>
                    <small>
                      {event.screen} · {event.agentName} · {event.detail}
                    </small>
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <div className="ax-empty">
              <b>No background runs yet</b>
              <p>Register a patient, check eligibility, or assemble a claim — agents attach to that work automatically.</p>
            </div>
          )}
        </section>

        <aside className="ax-ai-side">
          <section className="ax-panel ax-ai-panel">
            <div className="ax-panel-head">
              <div>
                <span className="ax-kicker">On watch</span>
                <h2>{watchingAgents.length ? `${watchingAgents.length} lanes live` : 'All lanes idle'}</h2>
              </div>
            </div>
            <div className="ax-ai-watch">
              {(watchingAgents.length ? watchingAgents : agents.slice(0, 4)).map((agent) => (
                <div className={`ax-ai-watch-row is-${agent.status.toLowerCase()}`} key={agent.id}>
                  <span className="ax-ai-watch-dot" />
                  <span>
                    <b>{agent.name}</b>
                    <small>
                      {agent.screen} · {agent.watchingLabel}
                    </small>
                    <em>{agent.lastSignal}</em>
                  </span>
                  <StatusPill tone={statusTone(agent.status)}>{formatLabel(agent.status)}</StatusPill>
                </div>
              ))}
            </div>
          </section>
          {suggestions[0] ? (
            <section className="ax-ai-copilot-card">
              <span className="ax-kicker">Copilot</span>
              <strong>{suggestions[0].headline}</strong>
              <p>{suggestions[0].nextAction || suggestions[0].summary}</p>
            </section>
          ) : (
            <section className="ax-ai-copilot-card quiet">
              <span className="ax-kicker">Copilot</span>
              <strong>Standing by</strong>
              <p>Quiet until there is operational work in this tenant. No invented alerts.</p>
            </section>
          )}
        </aside>
      </div>

      <section className="ax-panel ax-ai-panel">
        <div className="ax-panel-head">
          <div>
            <span className="ax-kicker">Agent board</span>
            <h2>One worker per revenue lane</h2>
          </div>
        </div>
        <div className="ax-ai-board">
          <div className="ax-ai-board-head">
            <span>Agent</span>
            <span>Lane</span>
            <span>Watching</span>
            <span>Last signal</span>
            <span />
          </div>
          {agents.map((agent) => {
            const Icon = AGENT_ICON[agent.id] ?? Bot;
            return (
              <div className={`ax-ai-board-row is-${agent.status.toLowerCase()}`} key={agent.id}>
                <span className="ax-ai-board-agent">
                  <span className="ax-agent-icon">
                    <Icon size={16} />
                  </span>
                  <span>
                    <b>{agent.name}</b>
                    <small>{agent.description}</small>
                  </span>
                </span>
                <span>
                  <StatusPill tone={statusTone(agent.status)}>{formatLabel(agent.status)}</StatusPill>
                  <small>{agent.screen}</small>
                </span>
                <span>
                  <b>{agent.watchingLabel}</b>
                  <small>
                    {agent.checksToday
                      ? `${agent.checksToday} run${agent.checksToday === 1 ? '' : 's'} · ${asPercent(agent.confidenceAvg)}%`
                      : 'No runs yet'}
                  </small>
                </span>
                <span className="ax-ai-board-signal">{agent.lastSignal}</span>
                <span>
                  <button
                    type="button"
                    className="ax-outline-button"
                    disabled={runningId === agent.id}
                    onClick={() => run.mutate(agent.id)}
                    data-testid={`button-run-agent-${agent.id}`}
                  >
                    <Sparkles size={14} /> {runningId === agent.id ? 'Running…' : 'Run'}
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {runResult ? (
        <section ref={resultRef} className="ax-ai-result" data-testid="ai-run-result">
          <div className="ax-ai-result-head">
            <div>
              <span className="ax-kicker">Last run</span>
              <h2>{insight?.headline ?? runResult.agent?.name ?? 'Agent result'}</h2>
              <p>
                {runResult.agent?.name} · {formatLabel(runResult.decisionBand)} ·{' '}
                {asPercent(runResult.confidence ?? runResult.execution?.confidence)}% confidence
                {runResult.latencyMs != null ? ` · ${runResult.latencyMs} ms` : ''}
              </p>
            </div>
            <StatusPill tone={runResult.offline ? 'amber' : 'teal'}>
              {runResult.offline ? 'Rules fallback' : 'Model online'}
            </StatusPill>
          </div>
          <p className="ax-ai-summary">{insight?.summary ?? runResult.output ?? 'No output.'}</p>
          <div className="ax-ai-columns">
            <div>
              <h3>Primary factors</h3>
              <ul>
                {(insight?.factors ?? runResult.factors ?? []).map((factor: string) => (
                  <li key={factor}>{factor}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Recommendations</h3>
              <ul>
                {(insight?.recommendations ?? []).map((item: string) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
          {insight?.nextAction ? (
            <div className="ax-ai-next">
              <Sparkles size={15} />
              <div>
                <span className="ax-kicker">Next action</span>
                <strong>{insight.nextAction}</strong>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
