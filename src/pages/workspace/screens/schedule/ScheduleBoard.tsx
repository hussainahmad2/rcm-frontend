import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import './Schedule.css';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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
  const [hoursForm, setHoursForm] = useState({ weekday: '1', startTime: '09:00', endTime: '17:00' });
  const [timeOffForm, setTimeOffForm] = useState({ date: '', startTime: '', endTime: '', reason: '' });

  const providers = useQuery({ queryKey: ['providers', tenant?.id], queryFn: api.providers });
  const patients = useQuery({ queryKey: ['patients', tenant?.id], queryFn: api.patients });
  const types = useQuery({ queryKey: ['appointment-types', tenant?.id], queryFn: api.appointmentTypes });
  const schedules = useQuery({
    queryKey: ['provider-schedules', tenant?.id, providerId],
    queryFn: () => api.providerSchedules(providerId || undefined),
    enabled: Boolean(providerId),
  });
  const timeOff = useQuery({
    queryKey: ['provider-time-off', tenant?.id, providerId],
    queryFn: () => api.providerTimeOff(providerId || undefined),
    enabled: Boolean(providerId),
  });
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

  const saveHours = useMutation({
    mutationFn: () =>
      api.upsertProviderSchedule({
        providerId,
        weekday: Number(hoursForm.weekday),
        startTime: hoursForm.startTime,
        endTime: hoursForm.endTime,
      }),
    onSuccess: (data) => {
      if (data?.error) return setNote(String(data.error));
      setNote(`Hours saved · ${WEEKDAYS[Number(hoursForm.weekday)]} ${hoursForm.startTime}–${hoursForm.endTime}`);
      void queryClient.invalidateQueries({ queryKey: ['provider-schedules'] });
      void queryClient.invalidateQueries({ queryKey: ['availability'] });
    },
  });
  const addTimeOff = useMutation({
    mutationFn: () =>
      api.addProviderTimeOff({
        providerId,
        date: timeOffForm.date,
        startTime: timeOffForm.startTime || undefined,
        endTime: timeOffForm.endTime || undefined,
        reason: timeOffForm.reason || 'Time off',
      }),
    onSuccess: (data) => {
      if (data?.error) return setNote(String(data.error));
      setNote(`Time off recorded for ${timeOffForm.date}`);
      setTimeOffForm({ date: '', startTime: '', endTime: '', reason: '' });
      void queryClient.invalidateQueries({ queryKey: ['provider-time-off'] });
      void queryClient.invalidateQueries({ queryKey: ['availability'] });
    },
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
      <div className="ax-schedule-admin">
        <section className="ax-panel">
          <div className="ax-panel-head">
            <div>
              <span className="ax-kicker">Working hours</span>
              <h2>{WEEKDAYS[Number(hoursForm.weekday)]} template</h2>
            </div>
          </div>
          <div className="ax-reg-fields">
            <label>
              Weekday
              <select value={hoursForm.weekday} onChange={(e) => setHoursForm((f) => ({ ...f, weekday: e.target.value }))}>
                {WEEKDAYS.map((label, index) => (
                  <option key={label} value={String(index)}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Start
              <input type="time" value={hoursForm.startTime} onChange={(e) => setHoursForm((f) => ({ ...f, startTime: e.target.value }))} />
            </label>
            <label>
              End
              <input type="time" value={hoursForm.endTime} onChange={(e) => setHoursForm((f) => ({ ...f, endTime: e.target.value }))} />
            </label>
          </div>
          <button className="ax-primary-button" type="button" disabled={!providerId || saveHours.isPending} onClick={() => saveHours.mutate()}>
            Save hours
          </button>
          <div className="ax-hours-list" style={{ marginTop: 12 }}>
            {(schedules.data ?? []).map((row: any) => (
              <div className="ax-hours-row" key={row.id}>
                <b>{WEEKDAYS[row.weekday] ?? row.weekday}</b>
                <span>
                  {row.startTime}–{row.endTime}
                </span>
                <button
                  className="ax-ghost-button"
                  type="button"
                  onClick={() =>
                    api.deleteProviderSchedule(row.id).then(() => {
                      void queryClient.invalidateQueries({ queryKey: ['provider-schedules'] });
                      void queryClient.invalidateQueries({ queryKey: ['availability'] });
                    })
                  }
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </section>
        <section className="ax-panel">
          <div className="ax-panel-head">
            <div>
              <span className="ax-kicker">Time off</span>
              <h2>Blocks that close the book</h2>
            </div>
          </div>
          <div className="ax-reg-fields">
            <label>
              Date
              <input type="date" value={timeOffForm.date} onChange={(e) => setTimeOffForm((f) => ({ ...f, date: e.target.value }))} />
            </label>
            <label>
              Start
              <input type="time" value={timeOffForm.startTime} onChange={(e) => setTimeOffForm((f) => ({ ...f, startTime: e.target.value }))} />
            </label>
            <label>
              End
              <input type="time" value={timeOffForm.endTime} onChange={(e) => setTimeOffForm((f) => ({ ...f, endTime: e.target.value }))} />
            </label>
            <label className="ax-reg-span-2">
              Reason
              <input value={timeOffForm.reason} onChange={(e) => setTimeOffForm((f) => ({ ...f, reason: e.target.value }))} placeholder="Clinic closed / PTO" />
            </label>
          </div>
          <button
            className="ax-outline-button"
            type="button"
            disabled={!providerId || !timeOffForm.date || addTimeOff.isPending}
            onClick={() => addTimeOff.mutate()}
          >
            Add time off
          </button>
          <div className="ax-hours-list" style={{ marginTop: 12 }}>
            {(timeOff.data ?? []).length === 0 ? <p className="ax-muted">No time-off blocks for this provider.</p> : null}
            {(timeOff.data ?? []).map((row: any) => (
              <div className="ax-hours-row" key={row.id}>
                <b>{row.date}</b>
                <span>
                  {row.startTime || 'All day'}
                  {row.endTime ? `–${row.endTime}` : ''} · {row.reason}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
