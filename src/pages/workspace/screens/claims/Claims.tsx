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
import './Claims.css';

export function Claims() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string>('');
  const [actionNote, setActionNote] = useState<string>('');
  const [lastScrub, setLastScrub] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const claims = useQuery({ queryKey: ['claims'], queryFn: api.claims });
  const detail = useQuery({
    queryKey: ['claim', selectedId],
    queryFn: () => api.claim(selectedId),
    enabled: Boolean(selectedId),
  });
  const scrub = useMutation({
    mutationFn: (id: string) => api.scrubClaim(id),
    onSuccess: (data, id) => {
      setLastScrub(data);
      const blocked = data?.blockingCount ?? 0;
      const warned = data?.warningCount ?? 0;
      const score = data?.claim?.qualityScore ?? data?.qualityScore ?? '—';
      setActionNote(
        `Scrubbed ${id}: score ${score} · ${data?.evaluatedRules ?? 0} rules evaluated · ${blocked} blocking · ${warned} warnings${data?.ready ? ' · READY' : ' · held as DRAFT'}`,
      );
      setSelectedId(id);
      void queryClient.invalidateQueries({ queryKey: ['claims'] });
      void queryClient.invalidateQueries({ queryKey: ['claim', id] });
      void queryClient.invalidateQueries({ queryKey: ['work-items'] });
    },
    onError: (error) => setActionNote((error as Error).message),
  });
  const submit = useMutation({
    mutationFn: (id: string) => api.submitClaim(id),
    onSuccess: (data, id) => {
      const ack = data?.acknowledgement;
      const gw = data?.gateway;
      setActionNote(
        `Submitted ${id} via ${gw?.adapter ?? 'adapter'} → ${gw?.clearinghouse ?? gw?.standard ?? 'gateway'}` +
          (ack
            ? ` · ACK ${ack.outcome} (${ack.ackCode})`
            : ''),
      );
      setLastScrub(null);
      void queryClient.invalidateQueries({ queryKey: ['claims'] });
      void queryClient.invalidateQueries({ queryKey: ['claim', id] });
      void queryClient.invalidateQueries({ queryKey: ['work-items'] });
      void queryClient.invalidateQueries({ queryKey: ['gateway-submissions'] });
    },
    onError: (error) => setActionNote((error as Error).message),
  });
  const inquire = useMutation({
    mutationFn: (id: string) => api.inquireClaimStatus(id),
    onSuccess: (data, id) => {
      setActionNote(`276/277 ${id} → payer ${data?.inquiry?.payerStatus ?? data?.claim?.payerStatus} (simulated)`);
      void queryClient.invalidateQueries({ queryKey: ['claims'] });
      void queryClient.invalidateQueries({ queryKey: ['claim', id] });
    },
    onError: (error) => setActionNote((error as Error).message),
  });
  const freeze = useMutation({
    mutationFn: (id: string) => api.freezeClaim(id),
    onSuccess: (data, id) => {
      if (data?.error) return setActionNote(String(data.error));
      setActionNote(`Frozen ${id} as v${data.version?.versionNumber ?? data.claim?.currentVersionNumber ?? '—'}`);
      setSelectedId(id);
      void queryClient.invalidateQueries({ queryKey: ['claims'] });
      void queryClient.invalidateQueries({ queryKey: ['claim', id] });
    },
    onError: (error) => setActionNote((error as Error).message),
  });
  const adjudicate = useMutation({
    mutationFn: (id: string) => api.adjudicateClaim(id),
    onSuccess: (data, id) => {
      setActionNote(`Adjudicated ${id} · ${data?.outcome ?? data?.claim?.status} (simulated)`);
      void queryClient.invalidateQueries({ queryKey: ['claims'] });
      void queryClient.invalidateQueries({ queryKey: ['claim', id] });
      void queryClient.invalidateQueries({ queryKey: ['denials'] });
      void queryClient.invalidateQueries({ queryKey: ['payments'] });
    },
    onError: (error) => setActionNote((error as Error).message),
  });
  const submissions = useQuery({
    queryKey: ['gateway-submissions', selectedId],
    queryFn: () => api.gatewaySubmissions(selectedId),
    enabled: Boolean(selectedId),
  });

  if (claims.isLoading) return <div className="ax-view"><LoadingState label="Loading claims…" /></div>;
  if (claims.error) return <div className="ax-view"><ErrorState error={claims.error} onRetry={() => void claims.refetch()} /></div>;

  const inventory = claims.data ?? [];
  const list = statusFilter === 'ALL' ? inventory : inventory.filter((claim: any) => claim.status === statusFilter);
  const total = list.reduce((sum: number, claim: any) => sum + (claim.grossAmount?.amount ?? 0), 0);
  const statusFilters = ['ALL', ...Array.from(new Set(inventory.map((claim: any) => claim.status).filter(Boolean)))] as string[];
  const isFrozen = (claim: any) => Boolean(claim.frozen || claim.currentVersionNumber || claim.frozenVersion);
  const claimDetail = detail.data?.claim;
  const events = detail.data?.events ?? [];
  const validations = detail.data?.validations ?? [];
  const lines = detail.data?.lines ?? [];
  const firedFromEvent = [...events]
    .reverse()
    .find((event: any) => event.eventType === 'ClaimValidated' && Array.isArray(event.payload?.firedRules))
    ?.payload?.firedRules;
  const firedRules =
    (lastScrub?.claim?.id === selectedId ? lastScrub?.firedRules : null) ??
    firedFromEvent ??
    [];

  return (
    <div className="ax-view">
      <SectionHeading
        eyebrow="Billing engine"
        title="Claims"
        detail="Executable RuleVersion scrub — quality, payer context and denial risk before submission."
        action={
          <button className="ax-outline-button" type="button" onClick={() => void claims.refetch()} data-testid="button-export-claims">
            <RefreshCw size={14} /> Refresh
          </button>
        }
      />
      {actionNote ? <div className="ax-insight-strip"><Sparkles size={17} /><span>{actionNote}</span></div> : null}
      <div className="ax-queue-layout">
        <section className="ax-panel ax-table-panel">
          <div className="ax-panel-head">
            <div>
              <span className="ax-kicker">Claim inventory</span>
              <h2>
                {list.length} claims in motion <em>· {money(total)} total</em>
              </h2>
            </div>
            <div className="ax-inline-controls">
              {statusFilters.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={statusFilter === value ? 'ax-filter-active' : 'ax-outline-button'}
                  onClick={() => setStatusFilter(value)}
                  data-testid={value === 'ALL' ? 'button-claims-quality-filter' : undefined}
                >
                  {formatLabel(value)}
                </button>
              ))}
            </div>
          </div>
          <div className="ax-claims-table ax-claims-gate-table">
            <div className="ax-table-head">
              <span>Claim</span>
              <span>Amount</span>
              <span>Status</span>
              <span>Transmission</span>
              <span>Payer</span>
              <span>Frozen</span>
              <span>Actions</span>
            </div>
            {list.map((claim: any) => {
              const frozen = isFrozen(claim);
              return (
                <div
                  className={`ax-claim-row ${selectedId === claim.id ? 'selected' : ''}`}
                  key={claim.id}
                  data-testid={`row-claim-${claim.id}`}
                  onClick={() => setSelectedId(claim.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') setSelectedId(claim.id);
                  }}
                >
                  <span>
                    <b>{claim.claimNumber ?? claim.id}</b>
                    <small>{claim.countryId} · {claim.claimType}</small>
                  </span>
                  <strong>{money(claim.grossAmount ?? 0)}</strong>
                  <StatusPill tone={statusTone(claim.status)}>{formatLabel(claim.status)}</StatusPill>
                  <small>{formatLabel(claim.transmissionStatus)}</small>
                  <small>{formatLabel(claim.payerStatus)}</small>
                  <StatusPill tone={frozen ? 'teal' : 'amber'}>{frozen ? `v${claim.frozenVersion || claim.currentVersionNumber}` : 'Open'}</StatusPill>
                  <span className="ax-row-actions">
                    <button
                      className="ax-outline-button"
                      type="button"
                      disabled={scrub.isPending}
                      onClick={(event) => {
                        event.stopPropagation();
                        scrub.mutate(claim.id);
                      }}
                      data-testid={`button-scrub-${claim.id}`}
                    >
                      Scrub
                    </button>
                    <button
                      className="ax-outline-button"
                      type="button"
                      disabled={freeze.isPending || frozen}
                      onClick={(event) => {
                        event.stopPropagation();
                        freeze.mutate(claim.id);
                      }}
                    >
                      Freeze
                    </button>
                    <button
                      className="ax-primary-button"
                      type="button"
                      disabled={submit.isPending || claim.status !== 'READY' || !frozen}
                      title={claim.status !== 'READY' ? 'Scrub until READY' : frozen ? 'Submit frozen claim' : 'Freeze before submit'}
                      onClick={(event) => {
                        event.stopPropagation();
                        submit.mutate(claim.id);
                      }}
                      data-testid={`button-submit-${claim.id}`}
                    >
                      Submit
                    </button>
                    <button
                      className="ax-outline-button"
                      type="button"
                      disabled={inquire.isPending}
                      onClick={(event) => {
                        event.stopPropagation();
                        inquire.mutate(claim.id);
                      }}
                    >
                      276/277
                    </button>
                    <button
                      className="ax-outline-button"
                      type="button"
                      disabled={adjudicate.isPending}
                      onClick={(event) => {
                        event.stopPropagation();
                        adjudicate.mutate(claim.id);
                      }}
                    >
                      Adjudicate
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        </section>
        <aside className="ax-panel ax-inspection">
          {!selectedId ? (
            <div className="ax-empty">
              <FileCheck2 size={22} />
              <b>Select a claim</b>
              <p>Open a claim to inspect scrub layers, fired rules and line detail.</p>
            </div>
          ) : detail.isLoading ? (
            <LoadingState label="Loading claim…" />
          ) : detail.error ? (
            <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />
          ) : claimDetail ? (
            <>
              <div className="ax-inspection-top">
                <span className="ax-kicker">Claim detail</span>
                <StatusPill tone={statusTone(claimDetail.status)}>{formatLabel(claimDetail.status)}</StatusPill>
              </div>
              <div className="ax-inspection-title">
                <span className="ax-module-icon large">
                  <FileCheck2 size={18} />
                </span>
                <div>
                  <h2>{claimDetail.claimNumber ?? claimDetail.id}</h2>
                  <small>
                    {claimDetail.countryId} · Quality {claimDetail.qualityScore} · Risk{' '}
                    {asPercent(claimDetail.denialProbability)}%
                    {claimDetail.currentVersionNumber || detail.data?.frozenVersion
                      ? ` · frozen v${claimDetail.currentVersionNumber ?? detail.data?.frozenVersion?.versionNumber}`
                      : ' · not frozen'}
                  </small>
                </div>
              </div>
              <div className="ax-detail-list">
                <div>
                  <span>Gross</span>
                  <b>{money(claimDetail.grossAmount ?? 0)}</b>
                </div>
                <div>
                  <span>Balance</span>
                  <b>{money(claimDetail.balance ?? 0)}</b>
                </div>
                <div>
                  <span>Lines</span>
                  <b>{lines.length}</b>
                </div>
                <div>
                  <span>Events</span>
                  <b>{events.length}</b>
                </div>
                <div>
                  <span>Frozen version</span>
                  <b>{detail.data?.frozenVersion ? `v${detail.data.frozenVersion.versionNumber}` : 'None'}</b>
                </div>
                <div>
                  <span>Transmission</span>
                  <b>{formatLabel(claimDetail.transmissionStatus)}</b>
                </div>
                <div>
                  <span>Payer</span>
                  <b>{formatLabel(claimDetail.payerStatus)}</b>
                </div>
                <div>
                  <span>Payment</span>
                  <b>{formatLabel(claimDetail.paymentStatus)}</b>
                </div>
              </div>
              {Array.isArray(detail.data?.journey) ? (
                <div className="ax-reason">
                  <span className="ax-kicker">Claim journey</span>
                  {detail.data.journey.map((step: { id: string; label: string; done: boolean }) => (
                    <p key={step.id}>
                      {step.done ? 'Done · ' : 'Open · '}
                      {step.label}
                    </p>
                  ))}
                </div>
              ) : null}
              <div className="ax-reason">
                <span className="ax-kicker">Scrub layers</span>
                <div className="ax-scrub-layers">
                  {validations.length === 0 ? (
                    <p>No scrub results yet — run Scrub to evaluate RuleVersions.</p>
                  ) : (
                    validations.map((layer: any) => (
                      <div className="ax-scrub-layer" key={layer.id ?? layer.layer}>
                        <StatusPill tone={statusTone(layer.status)}>{formatLabel(layer.status)}</StatusPill>
                        <span>
                          <b>{layer.layer}</b>
                          <small>
                            {layer.message}
                            {layer.ruleId ? ` · ${layer.ruleId}` : ''}
                          </small>
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
              {firedRules.length > 0 ? (
                <div className="ax-reason">
                  <span className="ax-kicker">Fired rules</span>
                  <div className="ax-scrub-layers">
                    {firedRules.map((rule: any) => (
                      <div className="ax-scrub-layer" key={`${rule.ruleKey}-${rule.action}`}>
                        <StatusPill
                          tone={
                            rule.severity === 'BLOCKING' ? 'coral' : rule.severity === 'WARNING' ? 'amber' : 'teal'
                          }
                        >
                          {formatLabel(rule.severity)}
                        </StatusPill>
                        <span>
                          <b>{rule.ruleKey}</b>
                          <small>
                            {rule.layer} · {rule.action} · {rule.message}
                          </small>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="ax-reason">
                <span className="ax-kicker">Gateway / clearinghouse</span>
                {(submissions.data ?? []).length === 0 ? (
                  <p>No submissions yet — Submit a READY claim to translate via country adapter.</p>
                ) : (
                  <div className="ax-scrub-layers">
                    {(submissions.data ?? []).slice(0, 3).map((row: any) => (
                      <div className="ax-scrub-layer" key={row.id}>
                        <StatusPill
                          tone={
                            row.status === 'ACK_ACCEPTED'
                              ? 'teal'
                              : row.status === 'ACK_REJECTED'
                                ? 'coral'
                                : 'amber'
                          }
                        >
                          {formatLabel(row.status)}
                        </StatusPill>
                        <span>
                          <b>
                            {row.adapterKey} · {row.outboundFormat}
                          </b>
                          <small>
                            {row.clearinghouse}
                            {row.ackCode ? ` · ACK ${row.ackCode}` : ''}
                            {row.ackMessage ? ` — ${row.ackMessage}` : ''}
                            {row.controlNumber ? ` · ctl ${row.controlNumber}` : ''}
                          </small>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="ax-reason">
                <span className="ax-kicker">Events</span>
                {events.length === 0 ? (
                  <p>No events recorded.</p>
                ) : (
                  <div className="ax-event-list">
                    {events.slice(0, 8).map((event: any) => (
                      <span key={event.id}>
                        <b>{event.eventType}</b> · {event.eventSource} ·{' '}
                        {event.eventTimestamp?.slice(0, 16)?.replace('T', ' ')}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <ErrorState error={new Error(detail.data?.error ?? 'Claim not found')} />
          )}
        </aside>
      </div>
    </div>
  );
}

