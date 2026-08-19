import { useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  Receipt,
  RefreshCw,
  ShieldAlert,
  Stethoscope,
  UserRoundCheck,
  UsersRound,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { WorkspaceView } from '../../workspace-types';

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

export function TodayBoard({ onNavigate }: { onNavigate: (view: WorkspaceView) => void }) {
  const { tenant } = useAuth();
  const queryClient = useQueryClient();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const board = useQuery({
    queryKey: ['today-board', tenant?.id, date],
    queryFn: () => api.todayBoard(date),
  });
  const checkIn = useMutation({
    mutationFn: (id: string) => api.checkInAppointment(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['today-board'] });
      void queryClient.invalidateQueries({ queryKey: ['appointments'] });
      void queryClient.invalidateQueries({ queryKey: ['encounters'] });
      void queryClient.invalidateQueries({ queryKey: ['clinical-encounters'] });
    },
  });

  const tiles = useMemo(() => {
    const counts = board.data?.counts ?? {};
    return [
      { key: 'appointments', label: "Today's appointments", value: counts.appointments ?? 0, view: 'schedule' as WorkspaceView, icon: CalendarDays },
      { key: 'checkedIn', label: 'Patients checked in', value: counts.patientsCheckedIn ?? 0, view: 'schedule' as WorkspaceView, icon: UsersRound },
      { key: 'elig', label: 'Eligibility issues', value: counts.eligibilityIssues ?? 0, view: 'eligibility' as WorkspaceView, icon: UserRoundCheck },
      { key: 'auth', label: 'Auth required', value: counts.authRequired ?? 0, view: 'authorizations' as WorkspaceView, icon: ClipboardCheck },
      { key: 'docs', label: 'Documentation pending', value: counts.documentationPending ?? 0, view: 'encounters' as WorkspaceView, icon: Stethoscope },
      { key: 'coding', label: 'Coding pending', value: counts.codingPending ?? 0, view: 'coding' as WorkspaceView, icon: FileCheck2 },
      { key: 'ready', label: 'Claims ready', value: counts.claimsReady ?? 0, view: 'claims' as WorkspaceView, icon: Receipt },
      { key: 'rejected', label: 'Claims rejected', value: counts.claimsRejected ?? 0, view: 'claims' as WorkspaceView, icon: ShieldAlert },
      { key: 'denials', label: 'New denials', value: counts.newDenials ?? 0, view: 'denials' as WorkspaceView, icon: AlertCircle },
      { key: 'ar', label: 'A/R follow-ups due', value: counts.arFollowUpsDue ?? 0, view: 'ar' as WorkspaceView, icon: Clock3 },
      { key: 'pay', label: 'Payments to review', value: counts.paymentsToReview ?? 0, view: 'payments' as WorkspaceView, icon: CheckCircle2 },
    ];
  }, [board.data]);

  if (board.isLoading) {
    return (
      <div className="ax-view">
        <div className="ax-empty">
          <RefreshCw size={22} className="ax-spin" />
          <b>Loading today's board…</b>
        </div>
      </div>
    );
  }

  const appointments = board.data?.queues?.todaysAppointments ?? [];

  return (
    <div className="ax-view">
      <div className="ax-section-heading">
        <div>
          <span className="ax-kicker">Practice + RCM operations</span>
          <h1>Today</h1>
          <p>Click a count to open the work queue. Appointment, encounter, claim, and payment stay separate engines.</p>
        </div>
        <label className="ax-date-filter">
          Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} data-testid="input-today-date" />
        </label>
      </div>
      <div className="ax-today-grid">
        {tiles.map((tile) => (
          <button
            key={tile.key}
            type="button"
            className="ax-today-tile"
            onClick={() => onNavigate(tile.view)}
            data-testid={`tile-${tile.key}`}
          >
            <span className="ax-today-tile-icon">
              <tile.icon size={16} />
            </span>
            <strong>{tile.value}</strong>
            <small>{tile.label}</small>
          </button>
        ))}
      </div>
      <section className="ax-panel ax-table-panel">
        <div className="ax-panel-head">
          <div>
            <span className="ax-kicker">Front desk</span>
            <h2>Today's appointments</h2>
          </div>
          <button className="ax-outline-button" type="button" onClick={() => onNavigate('schedule')}>
            Open schedule
          </button>
        </div>
        <div className="ax-claims-table">
          <div className="ax-table-head ax-table-head-5">
            <span>Time</span>
            <span>Patient</span>
            <span>Provider</span>
            <span>Clearance</span>
            <span>Action</span>
          </div>
          {appointments.length === 0 ? (
            <div className="ax-empty">
              <CalendarDays size={22} />
              <b>No appointments for this date</b>
              <p>Schedule a visit from Patients or Schedule.</p>
            </div>
          ) : (
            appointments.map((row: any) => (
              <div className="ax-claim-row ax-claim-row-5" key={row.id} data-testid={`row-today-apt-${row.id}`}>
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
                  <StatusPill tone={row.authorizationStatus === 'REQUIRED' || row.authorizationStatus === 'PENDING' ? 'amber' : 'teal'}>
                    Auth {formatLabel(row.authorizationStatus)}
                  </StatusPill>
                  <StatusPill tone={row.status === 'CHECKED_IN' || row.status === 'COMPLETED' ? 'teal' : 'neutral'}>
                    {formatLabel(row.status)}
                  </StatusPill>
                </span>
                <span className="ax-row-actions">
                  {row.status === 'CHECKED_IN' || row.encounterId ? (
                    <button className="ax-outline-button" type="button" onClick={() => onNavigate('encounters')}>
                      Open encounter
                    </button>
                  ) : row.status === 'CANCELLED' || row.status === 'NO_SHOW' ? (
                    <span>—</span>
                  ) : (
                    <button
                      className="ax-primary-button"
                      type="button"
                      disabled={checkIn.isPending}
                      onClick={() => checkIn.mutate(row.id)}
                      data-testid={`button-checkin-${row.id}`}
                    >
                      Check in
                    </button>
                  )}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
