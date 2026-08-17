import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

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

export function ScheduleBoard() {
  const { tenant } = useAuth();
  const queryClient = useQueryClient();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [providerId, setProviderId] = useState('');
  const [typeId, setTypeId] = useState('');
  const [patientId, setPatientId] = useState('');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');

  const providers = useQuery({ queryKey: ['providers', tenant?.id], queryFn: api.providers });
  const patients = useQuery({ queryKey: ['patients', tenant?.id], queryFn: api.patients });
  const types = useQuery({ queryKey: ['appointment-types', tenant?.id], queryFn: api.appointmentTypes });
  const appointments = useQuery({
    queryKey: ['appointments', tenant?.id, date, providerId],
    queryFn: () => api.appointments({ date, ...(providerId ? { providerId } : {}) }),
  });

  useEffect(() => {
    if (!providerId && providers.data?.[0]?.id) setProviderId(providers.data[0].id);
    if (!typeId && types.data?.[0]?.id) setTypeId(types.data[0].id);
  }, [providers.data, types.data, providerId, typeId]);

  const availability = useQuery({
    queryKey: ['availability', tenant?.id, providerId, date, typeId],
    queryFn: () => api.scheduleAvailability({ providerId, date, appointmentTypeId: typeId || undefined }),
    enabled: Boolean(providerId && date),
  });

  const create = useMutation({
    mutationFn: () =>
      api.createAppointment({
        patientId,
        providerId,
        appointmentTypeId: typeId,
        date,
        startTime: selectedSlot,
        reason,
      }),
    onSuccess: (data) => {
      if (data?.error) {
        setNote(String(data.error));
        return;
      }
      setNote(`Scheduled ${data.appointment?.displayId} at ${data.appointment?.startTime}`);
      setSelectedSlot('');
      setReason('');
      void queryClient.invalidateQueries({ queryKey: ['appointments'] });
      void queryClient.invalidateQueries({ queryKey: ['availability'] });
      void queryClient.invalidateQueries({ queryKey: ['today-board'] });
    },
    onError: (err: Error) => setNote(err.message),
  });

  const checkIn = useMutation({
    mutationFn: (id: string) => api.checkInAppointment(id),
    onSuccess: (data) => {
      setNote(data.message || `Checked in · encounter ${data.encounter?.id}`);
      void queryClient.invalidateQueries({ queryKey: ['appointments'] });
      void queryClient.invalidateQueries({ queryKey: ['today-board'] });
      void queryClient.invalidateQueries({ queryKey: ['clinical-encounters'] });
    },
  });

  const slots = availability.data?.slots ?? [];
  const list = appointments.data ?? [];
  const weekdayLabel = useMemo(
    () => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }),
    [date],
  );

  return (
    <div className="ax-view">
      <div className="ax-section-heading">
        <div>
          <span className="ax-kicker">Practice management</span>
          <h1>Schedule</h1>
          <p>Working hours minus booked slots, lunch, and time off. Appointments are planned activity — not encounters or claims.</p>
        </div>
      </div>
      {note ? (
        <div className="ax-insight-strip">
          <CalendarDays size={17} />
          <span>{note}</span>
        </div>
      ) : null}
      <div className="ax-schedule-layout">
        <section className="ax-panel">
          <div className="ax-panel-head">
            <div>
              <span className="ax-kicker">Book</span>
              <h2>{weekdayLabel}</h2>
            </div>
          </div>
          <div className="ax-reg-fields">
            <label>
              Date
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} data-testid="input-schedule-date" />
            </label>
            <label>
              Provider
              <select value={providerId} onChange={(e) => setProviderId(e.target.value)} data-testid="select-schedule-provider">
                {(providers.data ?? []).map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Appointment type
              <select value={typeId} onChange={(e) => setTypeId(e.target.value)}>
                {(types.data ?? []).map((t: any) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.durationMinutes} min)
                  </option>
                ))}
              </select>
            </label>
            <label>
              Patient
              <select value={patientId} onChange={(e) => setPatientId(e.target.value)} data-testid="select-schedule-patient">
                <option value="">Select patient</option>
                {(patients.data ?? []).map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.firstName} {p.lastName} · {p.mrn}
                  </option>
                ))}
              </select>
            </label>
            <label className="ax-reg-span-2">
              Reason
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Chest discomfort" />
            </label>
          </div>
          <div className="ax-slot-grid">
            {availability.isLoading ? (
              <div className="ax-empty">
                <RefreshCw size={18} className="ax-spin" />
                <b>Loading slots…</b>
              </div>
            ) : slots.length === 0 ? (
              <p className="ax-muted">{availability.data?.reason || 'No working hours for this weekday.'}</p>
            ) : (
              slots.map((slot: any) => (
                <button
                  key={slot.startTime}
                  type="button"
                  className={`ax-slot ${slot.available ? '' : 'booked'} ${selectedSlot === slot.startTime ? 'selected' : ''}`}
                  disabled={!slot.available}
                  onClick={() => setSelectedSlot(slot.startTime)}
                  data-testid={`slot-${slot.startTime}`}
                >
                  <b>{slot.startTime}</b>
                  <small>{slot.available ? 'Available' : slot.reason || 'Booked'}</small>
                </button>
              ))
            )}
          </div>
          <button
            className="ax-primary-button"
            type="button"
            disabled={!patientId || !selectedSlot || create.isPending}
            onClick={() => create.mutate()}
            data-testid="button-book-appointment"
          >
            {create.isPending ? 'Booking…' : 'Save appointment'}
          </button>
        </section>
        <section className="ax-panel ax-table-panel">
          <div className="ax-panel-head">
            <div>
              <span className="ax-kicker">Day list</span>
              <h2>{list.length} appointments</h2>
            </div>
          </div>
          <div className="ax-claims-table">
            {list.map((row: any) => (
              <div className="ax-claim-row ax-claim-row-5" key={row.id} data-testid={`row-apt-${row.id}`}>
                <span>
                  <b>{row.startTime}–{row.endTime}</b>
                  <small>{row.displayId}</small>
                </span>
                <span>
                  <b>{row.patientName}</b>
                  <small>{row.reason || row.appointmentTypeName}</small>
                </span>
                <span>
                  <b>{row.providerName}</b>
                  <small>{row.department || row.facilityName}</small>
                </span>
                <StatusPill tone={row.status === 'CHECKED_IN' || row.status === 'COMPLETED' ? 'teal' : row.status === 'CANCELLED' ? 'coral' : 'blue'}>
                  {formatLabel(row.status)}
                </StatusPill>
                <span className="ax-row-actions">
                  {row.encounterId ? (
                    <small>Encounter created</small>
                  ) : ['SCHEDULED', 'CONFIRMED', 'ARRIVED'].includes(row.status) ? (
                    <button className="ax-outline-button" type="button" onClick={() => checkIn.mutate(row.id)}>
                      Check in
                    </button>
                  ) : (
                    <small>—</small>
                  )}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
