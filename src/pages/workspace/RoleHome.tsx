import { useMemo, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  CalendarDays,
  ClipboardCheck,
  FileCheck2,
  LayoutDashboard,
  Receipt,
  RefreshCw,
  ShieldAlert,
  Stethoscope,
  UserRoundCheck,
  UsersRound,
} from 'lucide-react';
import { api, money } from '@/lib/api';
import { useAuth, type RoleId } from '@/lib/auth';
import type { WorkspaceView } from './workspace-types';

const TILE_ICONS: Record<string, typeof CalendarDays> = {
  appointments: CalendarDays,
  checkedIn: UsersRound,
  elig: UserRoundCheck,
  auth: ClipboardCheck,
  docs: Stethoscope,
  coding: FileCheck2,
  unbilled: Receipt,
  ready: FileCheck2,
  rejected: ShieldAlert,
  denials: AlertCircle,
  ar: LayoutDashboard,
  pay: Receipt,
};

function formatLabel(value?: string) {
  if (!value) return '—';
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function StatusPill({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) {
  return (
    <span className={`ax-pill ${tone}`}>
      <span className="ax-pill-dot" />
      {children}
    </span>
  );
}

function eligibilityTone(status?: string) {
  if (status === 'ACTIVE') return 'teal';
  if (status === 'MANUAL') return 'blue';
  if (status === 'PENDING') return 'amber';
  return 'coral';
}

export const ROLE_HOME_LABEL: Record<RoleId, string> = {
  superadmin: 'Command center',
  admin: 'Command center',
  operator: 'Front desk',
  coder: 'Coding desk',
  biller: 'Billing desk',
  viewer: 'Analyst view',
};

export function RoleHome({ onNavigate }: { onNavigate: (view: WorkspaceView) => void }) {
  const { user, tenant, roleLabel, canAccess } = useAuth();
  const queryClient = useQueryClient();
  const home = useQuery({
    queryKey: ['role-home', tenant?.id, user?.role],
    queryFn: api.roleHome,
  });
  const checkIn = useMutation({
    mutationFn: (id: string) => api.checkInAppointment(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['role-home'] });
      void queryClient.invalidateQueries({ queryKey: ['today-board'] });
      void queryClient.invalidateQueries({ queryKey: ['appointments'] });
      void queryClient.invalidateQueries({ queryKey: ['clinical-encounters'] });
    },
  });

  const persona = home.data?.persona;
  const tiles = useMemo(
    () => (home.data?.tiles ?? []).filter((tile: { view: WorkspaceView }) => canAccess(tile.view)),
    [home.data, canAccess],
  );
  const canAct = persona?.canAct !== false && user?.role !== 'viewer';
  const role = user?.role ?? 'operator';

  if (role === 'admin' || role === 'superadmin' || role === 'viewer') return null;

  if (home.isLoading) {
    return (
      <div className="ax-view">
        <div className="ax-empty">
          <RefreshCw size={22} className="ax-spin" />
          <b>Loading your desk…</b>
        </div>
      </div>
    );
  }

  if (home.error) {
    return (
      <div className="ax-view">
        <div className="ax-empty">
          <AlertCircle size={22} />
          <b>Unable to load dashboard</b>
          <p>{home.error instanceof Error ? home.error.message : 'Retry shortly.'}</p>
        </div>
      </div>
    );
  }

  const queues = home.data?.queues ?? {};

  return (
    <div className="ax-view">
      <div className="ax-section-heading">
        <div>
          <span className="ax-kicker">{persona?.eyebrow || roleLabel}</span>
          <h1>{persona?.title || ROLE_HOME_LABEL[role]}</h1>
          <p>{persona?.detail}{canAct ? '' : ' Read only.'}</p>
        </div>
      </div>
      <div className="ax-metrics">
        {tiles.map((tile: { key: string; label: string; value: number; view: WorkspaceView }) => {
          const Icon = TILE_ICONS[tile.key] ?? LayoutDashboard;
          return (
            <button
              key={tile.key}
              type="button"
              className="ax-metric"
              onClick={() => onNavigate(tile.view)}
              data-testid={`tile-${tile.key}`}
            >
              <div className="ax-metric-top">
                <span>{tile.label}</span>
                <span className="ax-metric-icon">
                  <Icon size={15} />
                </span>
              </div>
              <strong>{tile.value}</strong>
            </button>
          );
        })}
      </div>

      {persona?.showAppointments ? (
        <QueuePanel
          kicker="Practice management"
          title="Today's appointments"
          actionLabel="Open schedule"
          onAction={() => onNavigate('schedule')}
          empty="No appointments for this desk today."
        >
          {(queues.appointments ?? []).map((row: any) => (
            <div className="ax-claim-row ax-claim-row-5" key={row.id} data-testid={`row-home-apt-${row.id}`}>
              <span>
                <b>{row.startTime}</b>
                <small>{row.appointmentTypeName}</small>
              </span>
              <span>
                <b>{row.patientName}</b>
                <small>{row.mrn} · {row.reason || '—'}</small>
              </span>
              <span>
                <b>{row.providerName}</b>
                <small>{row.facilityName}</small>
              </span>
              <span className="ax-clearance-pills">
                <StatusPill tone={eligibilityTone(row.eligibilityStatus)}>Elig {formatLabel(row.eligibilityStatus)}</StatusPill>
                <StatusPill tone={row.status === 'CHECKED_IN' || row.status === 'COMPLETED' ? 'teal' : 'neutral'}>
                  {formatLabel(row.status)}
                </StatusPill>
              </span>
              <span className="ax-row-actions">
                {row.encounterId || row.status === 'CHECKED_IN' ? (
                  <button className="ax-outline-button" type="button" onClick={() => onNavigate('encounters')}>
                    Encounter
                  </button>
                ) : canAct && ['SCHEDULED', 'CONFIRMED', 'ARRIVED'].includes(row.status) ? (
                  <button
                    className="ax-primary-button"
                    type="button"
                    disabled={checkIn.isPending}
                    onClick={() => checkIn.mutate(row.id)}
                    data-testid={`button-checkin-${row.id}`}
                  >
                    Check in
                  </button>
                ) : (
                  <small>—</small>
                )}
              </span>
            </div>
          ))}
        </QueuePanel>
      ) : null}

      {persona?.showCoding ? (
        <QueuePanel
          kicker="Clinical coding"
          title="Encounters awaiting coding"
          actionLabel="Open coding"
          onAction={() => onNavigate('coding')}
          empty="No encounters are waiting for codes."
        >
          {(queues.codingPending ?? []).map((row: any) => (
            <div className="ax-claim-row ax-claim-row-5" key={row.id} data-testid={`row-home-coding-${row.id}`}>
              <span>
                <b>{row.patientName}</b>
                <small>{row.displayId || row.id}</small>
              </span>
              <span>
                <b>{row.providerName}</b>
                <small>{row.serviceFrom}</small>
              </span>
              <span>
                <b>{formatLabel(row.clinicalSource || 'MANUAL')}</b>
                <small>Source must not be a native-EHR requirement</small>
              </span>
              <StatusPill tone="amber">{formatLabel(row.billingStatus || row.status)}</StatusPill>
              <span className="ax-row-actions">
                {canAct && canAccess('coding') ? (
                  <button className="ax-primary-button" type="button" onClick={() => onNavigate('coding')}>
                    Code visit
                  </button>
                ) : (
                  <small>View only</small>
                )}
              </span>
            </div>
          ))}
        </QueuePanel>
      ) : null}

      {persona?.showClaims ? (
        <div className="ax-schedule-layout">
          <QueuePanel
            kicker="Claims"
            title="Ready / rejected"
            actionLabel="Open claims"
            onAction={() => onNavigate('claims')}
            empty="No claims sitting in ready or rejected."
          >
            {[...(queues.claimsReady ?? []), ...(queues.claimsRejected ?? [])].slice(0, 10).map((row: any) => (
              <div className="ax-claim-row ax-claim-row-5" key={row.id} data-testid={`row-home-claim-${row.id}`}>
                <span>
                  <b>{row.claimNumber || row.id}</b>
                  <small>{row.serviceFrom}</small>
                </span>
                <span>
                  <b>{formatLabel(row.status)}</b>
                  <small>{row.claimType}</small>
                </span>
                <span>
                  <b>{money(row.grossAmount ?? 0)}</b>
                  <small>Charge ≠ allowed ≠ paid</small>
                </span>
                <StatusPill tone={row.status === 'REJECTED' ? 'coral' : 'teal'}>{formatLabel(row.status)}</StatusPill>
                <span className="ax-row-actions">
                  <button className="ax-outline-button" type="button" onClick={() => onNavigate('claims')}>
                    {canAct ? 'Work claim' : 'View'}
                  </button>
                </span>
              </div>
            ))}
          </QueuePanel>
          <QueuePanel
            kicker="Follow-up"
            title="Open denials"
            actionLabel="Open denials"
            onAction={() => onNavigate('denials')}
            empty="No open denial cases."
          >
            {(queues.denials ?? []).map((row: any) => (
              <div className="ax-claim-row ax-claim-row-5" key={row.id} data-testid={`row-home-denial-${row.id}`}>
                <span>
                  <b>{row.claimId}</b>
                  <small>{row.reasonCode}</small>
                </span>
                <span>
                  <b>{row.category}</b>
                  <small>{row.rootCause}</small>
                </span>
                <span>
                  <b>{money(row.amount ?? 0)}</b>
                  <small>{row.nextAction}</small>
                </span>
                <StatusPill tone="coral">{formatLabel(row.status)}</StatusPill>
                <span className="ax-row-actions">
                  <button className="ax-outline-button" type="button" onClick={() => onNavigate('denials')}>
                    {canAct ? 'Work denial' : 'View'}
                  </button>
                </span>
              </div>
            ))}
          </QueuePanel>
        </div>
      ) : null}
    </div>
  );
}

function QueuePanel({
  kicker,
  title,
  actionLabel,
  onAction,
  empty,
  children,
}: {
  kicker: string;
  title: string;
  actionLabel: string;
  onAction: () => void;
  empty: string;
  children: ReactNode;
}) {
  const hasRows = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <section className="ax-panel ax-table-panel">
      <div className="ax-panel-head">
        <div>
          <span className="ax-kicker">{kicker}</span>
          <h2>{title}</h2>
        </div>
        <button className="ax-outline-button" type="button" onClick={onAction}>
          {actionLabel}
        </button>
      </div>
      <div className="ax-claims-table">
        {hasRows ? children : (
          <div className="ax-empty">
            <b>{empty}</b>
          </div>
        )}
      </div>
    </section>
  );
}
