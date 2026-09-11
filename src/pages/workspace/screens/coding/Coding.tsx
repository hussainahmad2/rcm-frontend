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

type WorkCode = { code: string; description: string; kind: 'DX' | 'PX'; modifiers: string[] };

const MODIFIERS = ['25', '59', 'LT', 'RT', '50', '76', '77', '91', '26', 'TC'];

function toWorkCodes(result: any): WorkCode[] {
  return [
    ...(result?.suggestions?.diagnoses ?? []).map((row: any) => ({
      code: row.code,
      description: row.description ?? row.code,
      kind: 'DX' as const,
      modifiers: [] as string[],
    })),
    ...(result?.suggestions?.procedures ?? []).map((row: any) => ({
      code: row.code,
      description: row.description ?? row.code,
      kind: 'PX' as const,
      modifiers: [] as string[],
    })),
  ];
}

export function Coding() {
  const queryClient = useQueryClient();
  const [result, setResult] = useState<any>(null);
  const [decisionNote, setDecisionNote] = useState('');
  const [workCodes, setWorkCodes] = useState<WorkCode[]>([]);
  const [search, setSearch] = useState('');
  const [system, setSystem] = useState('');
  const encounters = useQuery({ queryKey: ['encounters'], queryFn: api.encounters });
  const encounterList = encounters.data ?? [];
  const [encounterId, setEncounterId] = useState('');

  useEffect(() => {
    if (!encounterId && encounterList[0]?.id) setEncounterId(encounterList[0].id);
  }, [encounterId, encounterList]);

  const catalog = useQuery({
    queryKey: ['coding-codes', search, system],
    queryFn: () => api.searchCodes(search, system || undefined),
    enabled: search.trim().length >= 1,
  });

  const suggest = useMutation({
    mutationFn: (id: string) => api.codingSuggest(id),
    onSuccess: (data) => {
      setResult(data);
      setWorkCodes(toWorkCodes(data));
      setDecisionNote('');
    },
  });
  const decide = useMutation({
    mutationFn: (decision: 'ACCEPT' | 'MODIFY' | 'REJECT') =>
      api.codingDecision({
        encounterId,
        decision,
        codes: workCodes.map((row) => row.code),
        modifiers: [...new Set(workCodes.flatMap((row) => row.modifiers))],
        procedureModifiers: Object.fromEntries(
          workCodes.filter((row) => row.kind === 'PX' && row.modifiers.length).map((row) => [row.code, row.modifiers]),
        ),
        reason: `Operator ${decision.toLowerCase()} on coding workbench`,
      }),
    onSuccess: (data, decision) => {
      setDecisionNote(
        `${formatLabel(decision)} recorded for encounter ${data.encounterId}${
          workCodes.some((row) => row.modifiers.length)
            ? ` · modifiers ${[...new Set(workCodes.flatMap((row) => row.modifiers))].join(', ')}`
            : ''
        }`,
      );
      void queryClient.invalidateQueries({ queryKey: ['audit'] });
      void queryClient.invalidateQueries({ queryKey: ['encounters'] });
      if (result?.ai?.id) {
        void api.decideAiExecution(result.ai.id, { decision }).catch(() => undefined);
      }
    },
    onError: (error) => setDecisionNote((error as Error).message),
  });

  const addCode = (row: any) => {
    if (workCodes.some((item) => item.code === row.code)) return;
    setWorkCodes((current) => [
      ...current,
      {
        code: row.code,
        description: row.description ?? row.code,
        kind: row.kind === 'PX' || /^\d/.test(row.code) ? 'PX' : 'DX',
        modifiers: [],
      },
    ]);
  };

  const removeCode = (code: string) => setWorkCodes((current) => current.filter((row) => row.code !== code));
  const toggleModifier = (code: string, modifier: string) =>
    setWorkCodes((current) =>
      current.map((row) =>
        row.code !== code
          ? row
          : {
              ...row,
              modifiers: row.modifiers.includes(modifier)
                ? row.modifiers.filter((item) => item !== modifier)
                : [...row.modifiers, modifier],
            },
      ),
    );

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
      {suggest.isPending ? <LoadingState label="Generating coding suggestions…" /> : null}
      <div className="ax-coding-layout">
          <section className="ax-panel ax-coding-suggestions">
            <div className="ax-panel-head">
              <div>
                <span className="ax-kicker">Coder workbench</span>
                <h2>Encounter {encounterId || '—'}</h2>
              </div>
              {result?.ai?.confidence != null ? (
                <StatusPill tone="teal">{asPercent(result.ai.confidence)}% confidence</StatusPill>
              ) : (
                <StatusPill tone="blue">Search or suggest</StatusPill>
              )}
            </div>

            <div className="ax-coding-search">
              <label>
                Search ICD / CPT
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="M17.11, 99214, knee, office visit"
                  data-testid="input-coding-search"
                />
              </label>
              <label>
                System
                <select value={system} onChange={(event) => setSystem(event.target.value)}>
                  <option value="">All</option>
                  <option value="ICD">ICD-10-CM</option>
                  <option value="CPT">CPT</option>
                </select>
              </label>
            </div>
            {search.trim() && (catalog.data?.results ?? []).length ? (
              <div className="ax-coding-results">
                {(catalog.data.results as any[]).slice(0, 8).map((row) => (
                  <button type="button" key={`${row.system}-${row.code}`} onClick={() => addCode(row)}>
                    <b>{row.code}</b>
                    <small>{row.description}</small>
                    <span>{row.kind ?? row.system}</span>
                  </button>
                ))}
              </div>
            ) : null}

            <div className="ax-coding-group">
              <h3>Working diagnoses</h3>
              <div className="ax-coding-cards">
                {workCodes.filter((row) => row.kind === 'DX').map((dx) => (
                  <article className="ax-coding-card" key={dx.code}>
                    <div className="ax-coding-card-top">
                      <span className="ax-coding-badge dx">DX</span>
                      <button className="ax-ghost-button" type="button" onClick={() => removeCode(dx.code)}>
                        Remove
                      </button>
                    </div>
                    <strong>{dx.code}</strong>
                    <p>{dx.description}</p>
                  </article>
                ))}
                {workCodes.every((row) => row.kind !== 'DX') ? <p className="ax-muted">Search and add an ICD code.</p> : null}
              </div>
            </div>

            <div className="ax-coding-group">
              <h3>Working procedures</h3>
              <div className="ax-coding-cards">
                {workCodes.filter((row) => row.kind === 'PX').map((px) => (
                  <article className="ax-coding-card" key={px.code}>
                    <div className="ax-coding-card-top">
                      <span className="ax-coding-badge px">PX</span>
                      <button className="ax-ghost-button" type="button" onClick={() => removeCode(px.code)}>
                        Remove
                      </button>
                    </div>
                    <strong>{px.code}</strong>
                    <p>{px.description}</p>
                    <div className="ax-modifier-row">
                      {MODIFIERS.map((modifier) => (
                        <button
                          key={modifier}
                          type="button"
                          className={px.modifiers.includes(modifier) ? 'ax-filter-active' : 'ax-outline-button'}
                          onClick={() => toggleModifier(px.code, modifier)}
                        >
                          {modifier}
                        </button>
                      ))}
                    </div>
                  </article>
                ))}
                {workCodes.every((row) => row.kind !== 'PX') ? <p className="ax-muted">Search and add a CPT code.</p> : null}
              </div>
            </div>

            {(result?.warnings ?? []).length ? (
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
                disabled={decide.isPending || !encounterId || workCodes.length === 0}
                onClick={() => decide.mutate('ACCEPT')}
                data-testid="button-coding-accept"
              >
                <Check size={14} /> Accept
              </button>
              <button
                className="ax-outline-button"
                type="button"
                disabled={decide.isPending || !encounterId || workCodes.length === 0}
                onClick={() => decide.mutate('MODIFY')}
                data-testid="button-coding-modify"
              >
                Modify
              </button>
              <button
                className="ax-outline-button"
                type="button"
                disabled={decide.isPending || !encounterId}
                onClick={() => decide.mutate('REJECT')}
                data-testid="button-coding-reject"
              >
                <X size={14} /> Reject
              </button>
            </div>
          </section>

          {result ? (
            <JobResultPanel
              kicker="AI coding review"
              title={`Coding assist · ${result.encounterId}`}
              subtitle={result.offline ? 'Rules fallback narrative' : `Model ${result.ai?.model ?? 'assist'}`}
              insight={codingInsight}
              confidence={result.ai?.confidence}
              offline={result.offline}
              badges={<StatusPill tone="blue">Human review</StatusPill>}
            />
          ) : (
            <div className="ax-panel">
              <div className="ax-empty">
                <Stethoscope size={22} />
                <b>Search or suggest</b>
                <p>Add ICD/CPT codes from search, attach modifiers, then accept. Suggest fills a starting set from the encounter.</p>
              </div>
            </div>
          )}
        </div>
    </div>
  );
}

