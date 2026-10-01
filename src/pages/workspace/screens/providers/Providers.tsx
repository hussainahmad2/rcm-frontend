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
import { AddProviderFlow } from './AddProviderFlow';
import './Providers.css';

const WEEKDAY_OPTIONS = [
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
  { value: '0', label: 'Sunday' },
];

export function weekdaySortIndex(weekday: number) {
  const index = WEEKDAY_OPTIONS.findIndex((day) => Number(day.value) === weekday);
  return index < 0 ? 99 : index;
}

export function nextAfternoonWindow(endTime: string) {
  const [hours, minutes] = endTime.split(':').map(Number);
  const end = hours * 60 + (minutes || 0);
  if (end <= 12 * 60) return { startTime: '14:00', endTime: '17:00' };
  return { startTime: endTime, endTime };
}

export function Providers() {
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [hours, setHours] = useState({ weekday: '1', startTime: '09:00', endTime: '17:00' });
  const [editingHoursId, setEditingHoursId] = useState('');
  const [editHours, setEditHours] = useState({ startTime: '09:00', endTime: '17:00' });
  const [hoursDelete, setHoursDelete] = useState<{
    id: string;
    dayLabel: string;
    startTime: string;
    endTime: string;
  } | null>(null);
  const [hoursDeleting, setHoursDeleting] = useState(false);
  const providers = useQuery({ queryKey: ['providers'], queryFn: api.providers });
  const schedules = useQuery({
    queryKey: ['provider-schedules', selectedId],
    queryFn: () => api.providerSchedules(selectedId || undefined),
    enabled: Boolean(selectedId),
  });

  useEffect(() => {
    setHours({ weekday: '1', startTime: '09:00', endTime: '17:00' });
    setEditingHoursId('');
    setHoursDelete(null);
    setHoursDeleting(false);
  }, [selectedId]);

  if (providers.isLoading) return <div className="ax-view"><LoadingState label="Loading providers…" /></div>;
  if (providers.error) return <div className="ax-view"><ErrorState error={providers.error} onRetry={() => void providers.refetch()} /></div>;

  const list = providers.data ?? [];
  const selected = list.find((provider: any) => provider.id === selectedId);
  const savedHours = (schedules.data ?? [])
    .filter((row: any) => row.providerId === selected?.id)
    .slice()
    .sort((a: any, b: any) => {
      const day = weekdaySortIndex(Number(a.weekday)) - weekdaySortIndex(Number(b.weekday));
      if (day) return day;
      return String(a.startTime).localeCompare(String(b.startTime));
    });

  return (
    <div className="ax-view">
      <SectionHeading
        eyebrow="Network directory"
        title="Providers"
        detail={`${list.length} billing and rendering providers · typed identifiers, claim roles`}
      />
      {note ? (
        <div className="ax-insight-strip">
          <Hospital size={17} />
          <span>{note}</span>
        </div>
      ) : null}
      {showCreate ? (
        <AddProviderFlow
          onCancel={() => setShowCreate(false)}
          onCreated={(providerId, message) => {
            setNote(message);
            setShowCreate(false);
            setSelectedId(providerId);
            void queryClient.invalidateQueries({ queryKey: ['providers'] });
          }}
        />
      ) : (
        <div className="ax-queue-layout">
          <section className="ax-panel ax-queue-list">
            <div className="ax-panel-head">
              <div>
                <span className="ax-kicker">Directory</span>
                <h2>{list.length} records</h2>
              </div>
              <button className="ax-primary-button" type="button" onClick={() => setShowCreate(true)} data-testid="button-add-provider">
                Add provider
              </button>
            </div>
            {list.map((provider: any) => (
              <button
                type="button"
                className={`ax-queue-row ${selectedId === provider.id ? 'selected' : ''}`}
                key={provider.id}
                onClick={() => setSelectedId(provider.id)}
                data-testid={`row-provider-${provider.id}`}
              >
                <span className="ax-queue-main">
                  <span className="ax-module-icon">
                    <Hospital size={15} />
                  </span>
                  <span>
                    <b>{provider.name}</b>
                    <small>{provider.specialty}</small>
                  </span>
                </span>
                <span className="ax-queue-context">
                  <b>{provider.npi ?? provider.identifiers?.[0]?.identifierValue ?? '—'}</b>
                  <small>{provider.identifiers?.length ? `${provider.identifiers.length} ID(s)` : 'No IDs'}</small>
                </span>
              </button>
            ))}
          </section>
          <aside className="ax-panel ax-inspection">
            {!selected ? (
              <div className="ax-empty">
                <Hospital size={22} />
                <b>Select a provider</b>
                <p>Open a roster record to inspect roles and typed identifiers. Use Add provider to enroll a new one.</p>
              </div>
            ) : (
              <>
                <div className="ax-inspection-title">
                  <div>
                    <h2>{selected.name}</h2>
                    <small>
                      {selected.specialty} · {(selected.roles ?? ['BILLING', 'RENDERING']).join(' · ')}
                    </small>
                  </div>
                </div>
                <div className="ax-detail-list">
                  <div>
                    <span>Primary ID</span>
                    <b>{selected.npi ?? selected.identifiers?.[0]?.identifierValue ?? '—'}</b>
                  </div>
                  <div>
                    <span>Identifiers</span>
                    <b>{selected.identifiers?.length ?? 0}</b>
                  </div>
                </div>
                <div className="ax-reason">
                  <span className="ax-kicker">Typed identifiers</span>
                  {(selected.identifiers ?? []).length === 0 ? (
                    <p>No identifier satellites yet.</p>
                  ) : (
                    (selected.identifiers ?? []).map((ident: { identifierType: string; identifierValue: string; country?: string }) => (
                      <p key={`${ident.identifierType}-${ident.identifierValue}`}>
                        {ident.identifierType} {ident.identifierValue}
                        {ident.country ? ` · ${ident.country}` : ''}
                      </p>
                    ))
                  )}
                </div>
                <div className="ax-reason">
                  <span className="ax-kicker">Working hours</span>
                  {savedHours.length ? (
                    <div className="ax-hours-list">
                      {savedHours.map((row: any) => {
                        const dayLabel =
                          WEEKDAY_OPTIONS.find((day) => Number(day.value) === Number(row.weekday))?.label ?? row.weekday;
                        const editing = editingHoursId === row.id;
                        return (
                          <div className="ax-hours-row" key={row.id}>
                            {editing ? (
                              <>
                                <span>{dayLabel}</span>
                                <input
                                  type="time"
                                  value={editHours.startTime}
                                  onChange={(e) => setEditHours((current) => ({ ...current, startTime: e.target.value }))}
                                />
                                <input
                                  type="time"
                                  value={editHours.endTime}
                                  onChange={(e) => setEditHours((current) => ({ ...current, endTime: e.target.value }))}
                                />
                                <div className="ax-hours-row-actions">
                                  <button
                                    className="ax-primary-button"
                                    type="button"
                                    onClick={() =>
                                      void api
                                        .upsertProviderSchedule({
                                          id: row.id,
                                          providerId: selected.id,
                                          weekday: Number(row.weekday),
                                          startTime: editHours.startTime,
                                          endTime: editHours.endTime,
                                        })
                                        .then((data) => {
                                          if (data?.error) {
                                            toast({
                                              title: 'Hours not updated',
                                              description: String(data.error),
                                              variant: 'destructive',
                                            });
                                            return;
                                          }
                                          setEditingHoursId('');
                                          toast({
                                            title: 'Schedule updated',
                                            description: `${dayLabel} ${editHours.startTime}–${editHours.endTime} saved for ${selected.name}.`,
                                            variant: 'success',
                                          });
                                          void queryClient.invalidateQueries({ queryKey: ['provider-schedules'] });
                                        })
                                        .catch((error: Error) =>
                                          toast({
                                            title: 'Hours not updated',
                                            description: error.message,
                                            variant: 'destructive',
                                          }),
                                        )
                                    }
                                  >
                                    Save
                                  </button>
                                  <button className="ax-ghost-button" type="button" onClick={() => setEditingHoursId('')}>
                                    Cancel
                                  </button>
                                </div>
                              </>
                            ) : (
                              <>
                                <p>
                                  {dayLabel} {row.startTime}–{row.endTime}
                                </p>
                                <div className="ax-hours-row-actions">
                                  <button
                                    className="ax-ghost-button"
                                    type="button"
                                    onClick={() => {
                                      setEditingHoursId(row.id);
                                      setEditHours({ startTime: row.startTime, endTime: row.endTime });
                                    }}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    className="ax-ghost-button"
                                    type="button"
                                    onClick={() =>
                                      setHoursDelete({
                                        id: row.id,
                                        dayLabel,
                                        startTime: row.startTime,
                                        endTime: row.endTime,
                                      })
                                    }
                                  >
                                    Delete
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p>No hours yet. Add a block below. The same day can have more than one, for example Monday 09:00–11:00 and 14:00–17:00.</p>
                  )}
                  <div className="ax-hours-editor">
                    <span className="ax-kicker">{savedHours.length ? 'Add another block' : 'Add hours'}</span>
                    <p>Split days are two blocks: morning, then afternoon.</p>
                    <div className="ax-inline-controls">
                      <select
                        value={hours.weekday}
                        onChange={(e) => setHours((h) => ({ ...h, weekday: e.target.value }))}
                      >
                        {WEEKDAY_OPTIONS.map((day) => (
                          <option key={day.value} value={day.value}>
                            {day.label}
                          </option>
                        ))}
                      </select>
                      <input
                        type="time"
                        value={hours.startTime}
                        onChange={(e) => setHours((h) => ({ ...h, startTime: e.target.value }))}
                      />
                      <input
                        type="time"
                        value={hours.endTime}
                        onChange={(e) => setHours((h) => ({ ...h, endTime: e.target.value }))}
                      />
                      <button
                        className="ax-outline-button"
                        type="button"
                        onClick={() => {
                          const weekday = Number(hours.weekday);
                          const dayLabel = WEEKDAY_OPTIONS.find((day) => Number(day.value) === weekday)?.label ?? 'day';
                          void api
                            .upsertProviderSchedule({
                              providerId: selected.id,
                              weekday,
                              startTime: hours.startTime,
                              endTime: hours.endTime,
                            })
                            .then((data) => {
                              if (data?.error) {
                                toast({
                                  title: 'Hours not added',
                                  description: String(data.error),
                                  variant: 'destructive',
                                });
                                return;
                              }
                              const next = nextAfternoonWindow(hours.endTime);
                              setHours({
                                weekday: String(weekday),
                                startTime: next.startTime,
                                endTime: next.endTime,
                              });
                              toast({
                                title: 'Schedule hours added',
                                description: `${dayLabel} ${hours.startTime}–${hours.endTime} saved for ${selected.name}.`,
                                variant: 'success',
                              });
                              void queryClient.invalidateQueries({ queryKey: ['provider-schedules'] });
                            })
                            .catch((error: Error) =>
                              toast({
                                title: 'Hours not added',
                                description: error.message,
                                variant: 'destructive',
                              }),
                            );
                        }}
                      >
                        Add hours
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </aside>
        </div>
      )}
      {hoursDelete && selected ? (
        <div
          className="ax-modal-backdrop"
          role="presentation"
          onClick={() => {
            if (!hoursDeleting) setHoursDelete(null);
          }}
        >
          <div
            className="ax-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ax-hours-delete-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="ax-modal-head">
              <div>
                <span className="ax-kicker">Working hours</span>
                <h2 id="ax-hours-delete-title">Delete this block?</h2>
              </div>
              <button
                className="ax-icon-button"
                type="button"
                aria-label="Close"
                disabled={hoursDeleting}
                onClick={() => setHoursDelete(null)}
              >
                <X size={15} />
              </button>
            </div>
            <p className="ax-modal-copy">
              Remove {hoursDelete.dayLabel} {hoursDelete.startTime}–{hoursDelete.endTime} for {selected.name}? This does not
              delete the provider.
            </p>
            <div className="ax-modal-actions">
              <button
                className="ax-ghost-button"
                type="button"
                disabled={hoursDeleting}
                onClick={() => setHoursDelete(null)}
              >
                Cancel
              </button>
              <button
                className="ax-danger-button"
                type="button"
                disabled={hoursDeleting}
                onClick={() => {
                  setHoursDeleting(true);
                  void api
                    .deleteProviderSchedule(hoursDelete.id)
                    .then(() => {
                      if (editingHoursId === hoursDelete.id) setEditingHoursId('');
                      toast({
                        title: 'Schedule hours removed',
                        description: `${hoursDelete.dayLabel} ${hoursDelete.startTime}–${hoursDelete.endTime} removed for ${selected.name}.`,
                        variant: 'success',
                      });
                      setHoursDelete(null);
                      void queryClient.invalidateQueries({ queryKey: ['provider-schedules'] });
                    })
                    .catch((error: Error) =>
                      toast({
                        title: 'Hours not deleted',
                        description: error.message,
                        variant: 'destructive',
                      }),
                    )
                    .finally(() => setHoursDeleting(false));
                }}
              >
                {hoursDeleting ? 'Deleting…' : 'Delete hours'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

