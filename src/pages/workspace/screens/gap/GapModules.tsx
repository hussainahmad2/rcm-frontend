import type { ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  BadgeDollarSign,
  CircleDollarSign,
  Handshake,
  Inbox,
  ShieldAlert,
  UsersRound,
} from 'lucide-react';
import { api, money } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { formatLabel, statusTone } from '../../shared/format';
import { ErrorState, LoadingState, Metric, SectionHeading, StatusPill } from '../../shared/ui';
import './GapModules.css';

function ModuleShell({
  eyebrow,
  title,
  subtitle,
  loading,
  error,
  onRetry,
  metrics,
  actions,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  metrics?: Array<{ label: string; value: string | number; tone?: string }>;
  actions?: ReactNode;
  children: ReactNode;
}) {
  if (loading) return <div className="ax-view"><LoadingState label={`Loading ${title}…`} /></div>;
  if (error) return <div className="ax-view"><ErrorState error={error} onRetry={onRetry} /></div>;
  return (
    <div className="ax-view gap-view">
      <div className="gap-hero">
        <SectionHeading eyebrow={eyebrow} title={title} detail={subtitle} />
        {actions ? <div className="gap-hero-actions">{actions}</div> : null}
      </div>
      {metrics?.length ? (
        <div className="gap-metrics ax-metrics">
          {metrics.map((m) => (
            <Metric key={m.label} label={m.label} value={m.value} tone={m.tone} />
          ))}
        </div>
      ) : null}
      {children}
    </div>
  );
}

function Panel({
  kicker,
  title,
  action,
  children,
  className = '',
}: {
  kicker: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`ax-panel gap-panel ${className}`.trim()}>
      <div className="ax-panel-head">
        <div>
          <span className="ax-kicker">{kicker}</span>
          <h2>{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function EmptyRows({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="gap-empty-inline">
      <b>{title}</b>
      <p>{detail}</p>
    </div>
  );
}

function Note({ children }: { children: ReactNode }) {
  return (
    <div className="gap-note">
      <AlertCircle size={16} />
      <span>{children}</span>
    </div>
  );
}

function cell(value: unknown) {
  if (value == null || value === '') return '—';
  if (typeof value === 'object' && value && 'amount' in (value as object)) return money(value as any);
  if (typeof value === 'object') return JSON.stringify(value).slice(0, 72);
  return String(value);
}

export function IdentityVerification() {
  const qc = useQueryClient();
  const cases = useQuery({ queryKey: ['identity-cases'], queryFn: () => api.identityCases() });
  const matches = useQuery({ queryKey: ['member-matches'], queryFn: () => api.memberMatches() });
  const patients = useQuery({ queryKey: ['patients'], queryFn: api.patients });
  const coverages = useQuery({ queryKey: ['coverages'], queryFn: api.coverages });
  const verify = useMutation({
    mutationFn: () => {
      const patientId = patients.data?.[0]?.id;
      const coverageId = coverages.data?.find((c: any) => c.patientId === patientId)?.id;
      if (!patientId) throw new Error('No patient');
      return api.identityVerify({ patientId, coverageId, method: 'MEMBER_ID_DOB' });
    },
    onSuccess: () => {
      toast({ title: 'Identity verification ran' });
      void qc.invalidateQueries({ queryKey: ['identity-cases'] });
    },
    onError: (e: any) => toast({ title: 'Verify failed', description: String(e.message ?? e), variant: 'destructive' }),
  });
  const rows = cases.data ?? [];
  const failed = rows.filter((c: any) => c.status === 'FAILED' || c.status === 'ESCALATED').length;

  return (
    <ModuleShell
      eyebrow="Patient access"
      title="Identity verification"
      subtitle="Member matching and mismatch investigation. OTP/photo only when the country pack allows."
      loading={cases.isLoading}
      error={cases.error}
      onRetry={() => void cases.refetch()}
      metrics={[
        { label: 'Cases', value: rows.length, tone: 'teal' },
        { label: 'Matches', value: matches.data?.length ?? 0, tone: 'blue' },
        { label: 'Failed / escalated', value: failed, tone: failed ? 'coral' : 'teal' },
      ]}
      actions={
        <button className="ax-primary-button" type="button" onClick={() => verify.mutate()} disabled={verify.isPending}>
          <ShieldAlert size={15} />
          {verify.isPending ? 'Verifying…' : 'Verify first patient'}
        </button>
      }
    >
      <Note>Member ID + date of birth is the default method. Escalations open an identity work item.</Note>
      <div className="gap-split">
        <Panel kicker="Verification cases" title={`${rows.length} open investigations`}>
          {!rows.length ? (
            <EmptyRows title="No identity cases yet" detail="Run a verify to create the first case." />
          ) : (
            <div className="gap-table gap-cols-3">
              <div className="gap-table-head">
                <span>Case</span>
                <span>Method</span>
                <span>Status</span>
              </div>
              {rows.slice(0, 40).map((row: any) => (
                <div className="gap-table-row" key={row.id}>
                  <span>
                    <b>{row.patientId || row.id}</b>
                    <small>{row.id}</small>
                  </span>
                  <span>
                    <b>{formatLabel(row.method || row.verificationMethod || 'MEMBER_ID_DOB')}</b>
                    <small>{cell(row.reason || row.result || '')}</small>
                  </span>
                  <StatusPill tone={statusTone(row.status)}>{formatLabel(row.status)}</StatusPill>
                </div>
              ))}
            </div>
          )}
        </Panel>
        <Panel kicker="Member matches" title={`${matches.data?.length ?? 0} candidates`}>
          {!(matches.data ?? []).length ? (
            <EmptyRows title="No matches on file" detail="Matches appear after payer member lookup." />
          ) : (
            <div className="gap-table gap-cols-3">
              <div className="gap-table-head">
                <span>Match</span>
                <span>Confidence</span>
                <span>Status</span>
              </div>
              {(matches.data ?? []).slice(0, 20).map((row: any) => (
                <div className="gap-table-row" key={row.id}>
                  <span>
                    <b>{row.memberId || row.patientId || row.id}</b>
                    <small>{row.payerId || 'Payer match'}</small>
                  </span>
                  <span><b>{cell(row.confidence || row.score || '—')}</b></span>
                  <StatusPill tone={statusTone(row.status)}>{formatLabel(row.status || 'MATCHED')}</StatusPill>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </ModuleShell>
  );
}

export function FinancialEstimates() {
  const estimates = useQuery({ queryKey: ['estimates'], queryFn: () => api.listEstimates() });
  const coverages = useQuery({ queryKey: ['coverages'], queryFn: api.coverages });
  const qc = useQueryClient();
  const create = useMutation({
    mutationFn: () => {
      const coverageId = coverages.data?.[0]?.id;
      if (!coverageId) throw new Error('No coverage');
      return api.createEstimate({ coverageId, chargedAmount: 1000, allowedAmount: 800 });
    },
    onSuccess: (data) => {
      toast({ title: 'Estimate created', description: `Patient pays ${money(data.patientResponsibility)}` });
      void qc.invalidateQueries({ queryKey: ['estimates'] });
    },
  });
  const rows = estimates.data ?? [];

  return (
    <ModuleShell
      eyebrow="Patient access"
      title="Financial estimates"
      subtitle="Patient responsibility on allowed amount after contractual adjustment."
      loading={estimates.isLoading}
      error={estimates.error}
      onRetry={() => void estimates.refetch()}
      metrics={[{ label: 'Estimates', value: rows.length, tone: 'teal' }]}
      actions={
        <button className="ax-primary-button" type="button" onClick={() => create.mutate()} disabled={create.isPending}>
          <BadgeDollarSign size={15} />
          {create.isPending ? 'Estimating…' : 'Demo $1,000 → $800 allowed'}
        </button>
      }
    >
      <Panel kicker="Responsibility calculator" title={`${rows.length} estimates`}>
        {!rows.length ? (
          <EmptyRows title="No estimates yet" detail="Create a demo estimate from the first coverage on file." />
        ) : (
          <div className="gap-table gap-cols-5">
            <div className="gap-table-head">
              <span>Estimate</span>
              <span>Charged</span>
              <span>Allowed</span>
              <span>Patient pays</span>
              <span>Status</span>
            </div>
            {rows.slice(0, 40).map((row: any) => (
              <div className="gap-table-row" key={row.id}>
                <span>
                  <b>{row.coverageId || row.id}</b>
                  <small>{row.id}</small>
                </span>
                <span><b>{cell(row.chargedAmount ?? row.charged)}</b></span>
                <span><b>{cell(row.allowedAmount ?? row.allowed)}</b></span>
                <span><b>{cell(row.patientResponsibility)}</b></span>
                <StatusPill tone={statusTone(row.status || 'READY')}>{formatLabel(row.status || 'READY')}</StatusPill>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </ModuleShell>
  );
}

export function ReferralsCob() {
  const cob = useQuery({ queryKey: ['cob'], queryFn: () => api.listCob() });
  const referrals = useQuery({ queryKey: ['referrals'], queryFn: () => api.listReferrals() });
  const secondary = useQuery({ queryKey: ['secondary-links'], queryFn: () => api.secondaryLinks() });
  const patients = useQuery({ queryKey: ['patients'], queryFn: api.patients });
  const qc = useQueryClient();
  const determine = useMutation({
    mutationFn: () => api.cobDetermine(patients.data?.[0]?.id),
    onSuccess: () => {
      toast({ title: 'COB determined' });
      void qc.invalidateQueries({ queryKey: ['cob'] });
    },
  });

  return (
    <ModuleShell
      eyebrow="Patient access"
      title="Referrals & COB"
      subtitle="Primary/secondary payer order and specialist referral tracking."
      loading={cob.isLoading}
      error={cob.error}
      metrics={[
        { label: 'COB rows', value: cob.data?.length ?? 0, tone: 'teal' },
        { label: 'Referrals', value: referrals.data?.length ?? 0, tone: 'blue' },
        { label: 'Secondary links', value: secondary.data?.length ?? 0, tone: 'amber' },
      ]}
      actions={
        <button className="ax-primary-button" type="button" onClick={() => determine.mutate()} disabled={determine.isPending}>
          <Handshake size={15} />
          {determine.isPending ? 'Determining…' : 'Determine COB'}
        </button>
      }
    >
      <div className="gap-split">
        <Panel kicker="Coordination of benefits" title={`${cob.data?.length ?? 0} determinations`}>
          {!(cob.data ?? []).length ? (
            <EmptyRows title="No COB rows" detail="Run determine on the first patient to order payers." />
          ) : (
            <div className="gap-table gap-cols-3">
              <div className="gap-table-head">
                <span>Patient</span>
                <span>Priority</span>
                <span>Status</span>
              </div>
              {(cob.data ?? []).slice(0, 40).map((row: any) => (
                <div className="gap-table-row" key={row.id}>
                  <span>
                    <b>{row.patientId || row.id}</b>
                    <small>{row.payerId || row.coverageId || ''}</small>
                  </span>
                  <span><b>{cell(row.cobPriority ?? row.priority)}</b></span>
                  <StatusPill tone={statusTone(row.status)}>{formatLabel(row.status || 'ACTIVE')}</StatusPill>
                </div>
              ))}
            </div>
          )}
        </Panel>
        <Panel kicker="Referrals" title={`${referrals.data?.length ?? 0} specialty referrals`}>
          {!(referrals.data ?? []).length ? (
            <EmptyRows title="No referrals" detail="Plan-required specialty referrals appear here." />
          ) : (
            <div className="gap-table gap-cols-3">
              <div className="gap-table-head">
                <span>Referral</span>
                <span>Specialty</span>
                <span>Status</span>
              </div>
              {(referrals.data ?? []).slice(0, 40).map((row: any) => (
                <div className="gap-table-row" key={row.id}>
                  <span>
                    <b>{row.patientId || row.id}</b>
                    <small>{row.id}</small>
                  </span>
                  <span><b>{cell(row.specialty || row.service || '—')}</b></span>
                  <StatusPill tone={statusTone(row.status)}>{formatLabel(row.status)}</StatusPill>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </ModuleShell>
  );
}

export function RevenueIntegrity() {
  const runs = useQuery({ queryKey: ['revenue-integrity'], queryFn: () => api.revenueIntegrity() });
  const late = useQuery({ queryKey: ['late-charges'], queryFn: () => api.lateCharges() });
  const encounters = useQuery({ queryKey: ['encounters'], queryFn: api.encounters });
  const qc = useQueryClient();
  const run = useMutation({
    mutationFn: () => api.runRevenueIntegrity(encounters.data?.[0]?.id),
    onSuccess: () => {
      toast({ title: 'Revenue integrity ran' });
      void qc.invalidateQueries({ queryKey: ['revenue-integrity'] });
    },
  });
  const rows = runs.data ?? [];
  const gaps = rows.filter((r: any) => r.status === 'GAPS').length;

  return (
    <ModuleShell
      eyebrow="Charge integrity"
      title="Revenue integrity"
      subtitle="Missing, duplicate, and late charge detection before claim assemble."
      loading={runs.isLoading}
      error={runs.error}
      metrics={[
        { label: 'Runs', value: rows.length, tone: 'teal' },
        { label: 'Late charges', value: late.data?.length ?? 0, tone: 'amber' },
        { label: 'Gaps', value: gaps, tone: gaps ? 'coral' : 'teal' },
      ]}
      actions={
        <button className="ax-primary-button" type="button" onClick={() => run.mutate()} disabled={run.isPending}>
          <CircleDollarSign size={15} />
          {run.isPending ? 'Reconciling…' : 'Reconcile first encounter'}
        </button>
      }
    >
      <Panel kicker="Integrity runs" title={`${rows.length} reconciliations`}>
        {!rows.length ? (
          <EmptyRows title="No integrity runs" detail="Reconcile an encounter to surface missing or late charges." />
        ) : (
          <div className="gap-table">
            <div className="gap-table-head">
              <span>Encounter</span>
              <span>Finding</span>
              <span>Late</span>
              <span>Status</span>
            </div>
            {rows.slice(0, 40).map((row: any) => (
              <div className="gap-table-row" key={row.id}>
                <span>
                  <b>{row.encounterId || row.id}</b>
                  <small>{row.id}</small>
                </span>
                <span>
                  <b>{cell(row.finding || row.summary || row.status)}</b>
                  <small>{cell(row.missingCount != null ? `${row.missingCount} missing` : '')}</small>
                </span>
                <span><b>{cell(row.lateChargeCount ?? late.data?.length ?? 0)}</b></span>
                <StatusPill tone={statusTone(row.status)}>{formatLabel(row.status)}</StatusPill>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </ModuleShell>
  );
}

export function PaymentReconciliation() {
  const deposits = useQuery({ queryKey: ['bank-deposits'], queryFn: () => api.bankDeposits() });
  const unapplied = useQuery({ queryKey: ['unapplied-cash'], queryFn: () => api.unappliedCash() });
  const credits = useQuery({ queryKey: ['credit-balances'], queryFn: () => api.creditBalances() });

  return (
    <ModuleShell
      eyebrow="Cash application"
      title="Payment reconciliation"
      subtitle="ERA vs bank deposit matching, unapplied cash, and credit balances."
      loading={deposits.isLoading}
      error={deposits.error}
      metrics={[
        { label: 'Deposits', value: deposits.data?.length ?? 0, tone: 'teal' },
        { label: 'Unapplied', value: unapplied.data?.length ?? 0, tone: 'amber' },
        { label: 'Credits', value: credits.data?.length ?? 0, tone: 'blue' },
      ]}
    >
      <div className="gap-split">
        <Panel kicker="Bank deposits" title={`${deposits.data?.length ?? 0} deposits`}>
          {!(deposits.data ?? []).length ? (
            <EmptyRows title="No deposits" detail="Matched bank deposits against remittances will list here." />
          ) : (
            <div className="gap-table gap-cols-3">
              <div className="gap-table-head">
                <span>Deposit</span>
                <span>Amount</span>
                <span>Status</span>
              </div>
              {(deposits.data ?? []).slice(0, 40).map((row: any) => (
                <div className="gap-table-row" key={row.id}>
                  <span>
                    <b>{row.reference || row.id}</b>
                    <small>{row.depositDate || row.createdAt || ''}</small>
                  </span>
                  <span><b>{cell(row.amount ?? row.depositAmount)}</b></span>
                  <StatusPill tone={statusTone(row.status)}>{formatLabel(row.status || 'OPEN')}</StatusPill>
                </div>
              ))}
            </div>
          )}
        </Panel>
        <Panel kicker="Credit balances" title={`${credits.data?.length ?? 0} overcollections`}>
          {!(credits.data ?? []).length ? (
            <EmptyRows title="No credit balances" detail="Overpayments and refund candidates appear here." />
          ) : (
            <div className="gap-table gap-cols-3">
              <div className="gap-table-head">
                <span>Patient</span>
                <span>Balance</span>
                <span>Status</span>
              </div>
              {(credits.data ?? []).slice(0, 40).map((row: any) => (
                <div className="gap-table-row" key={row.id}>
                  <span>
                    <b>{row.patientId || row.id}</b>
                    <small>{row.id}</small>
                  </span>
                  <span><b>{cell(row.amount ?? row.balance)}</b></span>
                  <StatusPill tone={statusTone(row.status)}>{formatLabel(row.status || 'OPEN')}</StatusPill>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </ModuleShell>
  );
}

export function PatientCollections() {
  const statements = useQuery({ queryKey: ['patient-statements'], queryFn: () => api.patientStatements() });
  const plans = useQuery({ queryKey: ['collection-plans'], queryFn: () => api.collectionPlans() });
  const rows = statements.data ?? [];

  return (
    <ModuleShell
      eyebrow="Patient billing"
      title="Patient collections"
      subtitle="Statements after adjudication, payment plans, assistance, and handoffs."
      loading={statements.isLoading}
      error={statements.error}
      metrics={[
        { label: 'Statements', value: rows.length, tone: 'teal' },
        { label: 'Payment plans', value: plans.data?.length ?? 0, tone: 'blue' },
      ]}
    >
      <Panel
        kicker="Statements"
        title={`${rows.length} patient statements`}
        action={<UsersRound size={16} className="ax-soft" />}
      >
        {!rows.length ? (
          <EmptyRows title="No statements yet" detail="Statements generate after primary adjudication leaves patient balance." />
        ) : (
          <div className="gap-table">
            <div className="gap-table-head">
              <span>Patient</span>
              <span>Balance</span>
              <span>Cycle</span>
              <span>Status</span>
            </div>
            {rows.slice(0, 40).map((row: any) => (
              <div className="gap-table-row" key={row.id}>
                <span>
                  <b>{row.patientId || row.id}</b>
                  <small>{row.statementNumber || row.id}</small>
                </span>
                <span><b>{cell(row.balance ?? row.amountDue)}</b></span>
                <span><b>{cell(row.cycle || row.agingBucket || '—')}</b></span>
                <StatusPill tone={statusTone(row.status)}>{formatLabel(row.status || 'OPEN')}</StatusPill>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </ModuleShell>
  );
}

export function ArWorkbench() {
  const board = useQuery({ queryKey: ['ar-workbench'], queryFn: () => api.arWorkbench() });
  const aging = useQuery({ queryKey: ['ar-workbench-aging'], queryFn: () => api.arWorkbenchAging() });
  const agingMetrics = Object.entries(aging.data ?? {}).map(([k, v]: any) => ({
    label: formatLabel(k),
    value: `${v.count} · ${money(v.balance)}`,
    tone: k.includes('120') || k.includes('90') ? 'coral' : 'teal',
  }));

  return (
    <ModuleShell
      eyebrow="Accounts receivable"
      title="A/R workbench"
      subtitle="Aging buckets, timely filing / appeal deadlines, and priority scoring."
      loading={board.isLoading}
      error={board.error}
      metrics={agingMetrics.length ? agingMetrics : [{ label: 'Work items', value: board.data?.length ?? 0, tone: 'teal' }]}
    >
      <Panel kicker="Priority board" title={`${board.data?.length ?? 0} scored balances`}>
        {!(board.data ?? []).length ? (
          <EmptyRows title="Workbench is clear" detail="Aged balances with deadlines will score into this board." />
        ) : (
          <div className="gap-table gap-cols-5">
            <div className="gap-table-head">
              <span>Account</span>
              <span>Balance</span>
              <span>Age</span>
              <span>Score</span>
              <span>Priority</span>
            </div>
            {(board.data ?? []).slice(0, 40).map((row: any) => (
              <div className="gap-table-row" key={row.id}>
                <span>
                  <b>{row.patientId || row.claimId || row.id}</b>
                  <small>{row.payerId || row.id}</small>
                </span>
                <span><b>{cell(row.balance ?? row.amount)}</b></span>
                <span><b>{cell(row.ageDays ?? row.agingBucket ?? '—')}</b></span>
                <span><b>{cell(row.score ?? row.priorityScore ?? '—')}</b></span>
                <StatusPill tone={statusTone(row.priority || row.status)}>{formatLabel(row.priority || row.status || 'OPEN')}</StatusPill>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </ModuleShell>
  );
}

export function AuditCompliance() {
  const catalog = useQuery({ queryKey: ['perm-catalog'], queryFn: () => api.permissionCatalog() });
  const grants = useQuery({ queryKey: ['perm-grants'], queryFn: () => api.permissionGrants() });

  return (
    <ModuleShell
      eyebrow="Governance"
      title="Audit & compliance"
      subtitle="Fine-grained permissions, PHI field controls, and role grants."
      loading={catalog.isLoading}
      error={catalog.error}
      metrics={[
        { label: 'Permissions', value: catalog.data?.length ?? 0, tone: 'teal' },
        { label: 'Grants', value: grants.data?.length ?? 0, tone: 'blue' },
      ]}
    >
      <div className="gap-split">
        <Panel kicker="Permission catalog" title={`${catalog.data?.length ?? 0} controls`}>
          {!(catalog.data ?? []).length ? (
            <EmptyRows title="Catalog empty" detail="Permission definitions load from the compliance matrix." />
          ) : (
            <div className="gap-table gap-cols-3">
              <div className="gap-table-head">
                <span>Permission</span>
                <span>Scope</span>
                <span>Risk</span>
              </div>
              {(catalog.data ?? []).slice(0, 40).map((row: any) => (
                <div className="gap-table-row" key={row.id || row.key || row.code}>
                  <span>
                    <b>{row.label || row.key || row.code || row.id}</b>
                    <small>{row.description?.slice?.(0, 80) || row.resource || ''}</small>
                  </span>
                  <span><b>{formatLabel(row.scope || row.category || 'TENANT')}</b></span>
                  <StatusPill tone={statusTone(row.risk || row.sensitivity)}>{formatLabel(row.risk || row.sensitivity || 'STANDARD')}</StatusPill>
                </div>
              ))}
            </div>
          )}
        </Panel>
        <Panel kicker="Role grants" title={`${grants.data?.length ?? 0} default grants`}>
          {!(grants.data ?? []).length ? (
            <EmptyRows title="No grants listed" detail="Default role → permission matrix appears here." />
          ) : (
            <div className="gap-table gap-cols-3">
              <div className="gap-table-head">
                <span>Role</span>
                <span>Permission</span>
                <span>Effect</span>
              </div>
              {(grants.data ?? []).slice(0, 40).map((row: any, i: number) => (
                <div className="gap-table-row" key={row.id || `${row.role}-${row.permission}-${i}`}>
                  <span><b>{formatLabel(row.role)}</b></span>
                  <span><b>{row.permission || row.key || '—'}</b></span>
                  <StatusPill tone={row.effect === 'DENY' ? 'coral' : 'teal'}>{formatLabel(row.effect || 'ALLOW')}</StatusPill>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </ModuleShell>
  );
}

export function ClearinghouseTracking() {
  const claims = useQuery({ queryKey: ['claims'], queryFn: api.claims });
  const rows = (claims.data ?? []).map((c: any) => ({
    id: c.id,
    claimNumber: c.claimNumber,
    status: c.status,
    transmissionStatus: c.transmissionStatus,
    payerStatus: c.payerStatus,
    clearinghouseAcceptedAt: c.clearinghouseAcceptedAt,
    payerReceivedAt: c.payerReceivedAt,
  }));

  return (
    <ModuleShell
      eyebrow="Claim transmission"
      title="Clearinghouse tracking"
      subtitle="Clearinghouse acceptance is not the same as payer receipt or adjudication."
      loading={claims.isLoading}
      error={claims.error}
      metrics={[
        { label: 'Claims', value: rows.length, tone: 'teal' },
        {
          label: 'CH accepted',
          value: rows.filter((r) => r.clearinghouseAcceptedAt || String(r.transmissionStatus || '').includes('ACCEPT')).length,
          tone: 'blue',
        },
        {
          label: 'Payer received',
          value: rows.filter((r) => r.payerReceivedAt).length,
          tone: 'amber',
        },
      ]}
    >
      <Note>Track clearinghouse ACK separately from payer receipt — a CH accept does not mean the payer has the claim.</Note>
      <Panel
        kicker="Transmission ledger"
        title={`${rows.length} claims`}
        action={<Inbox size={16} />}
      >
        {!rows.length ? (
          <EmptyRows title="No claims to track" detail="Submitted claims show clearinghouse and payer timestamps here." />
        ) : (
          <div className="gap-table gap-cols-5">
            <div className="gap-table-head">
              <span>Claim</span>
              <span>Claim status</span>
              <span>Transmission</span>
              <span>Payer</span>
              <span>CH / payer dates</span>
            </div>
            {rows.slice(0, 40).map((row) => (
              <div className="gap-table-row" key={row.id}>
                <span>
                  <b>{row.claimNumber || row.id}</b>
                  <small>{row.id}</small>
                </span>
                <StatusPill tone={statusTone(row.status)}>{formatLabel(row.status)}</StatusPill>
                <span><b>{formatLabel(row.transmissionStatus || '—')}</b></span>
                <span><b>{formatLabel(row.payerStatus || '—')}</b></span>
                <span>
                  <b>{row.clearinghouseAcceptedAt ? 'CH ok' : '—'}</b>
                  <small>{row.payerReceivedAt ? 'Payer received' : 'Awaiting payer'}</small>
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </ModuleShell>
  );
}
