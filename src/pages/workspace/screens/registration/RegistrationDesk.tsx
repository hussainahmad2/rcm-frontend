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
import './RegistrationDesk.css';

export function RegistrationDesk() {
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const payers = useQuery({ queryKey: ['payers'], queryFn: api.payers });
  const providers = useQuery({ queryKey: ['providers'], queryFn: api.providers });
  const facilities = useQuery({ queryKey: ['facilities'], queryFn: api.facilities });
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    dob: '',
    mrn: '',
    phone: '',
    email: '',
    sex: '',
    planName: '',
    memberId: '',
    payerId: '',
    payerName: '',
    providerId: '',
    facilityId: '',
    serviceFrom: new Date().toISOString().slice(0, 10),
    code: '99213',
    codeSystem: 'CPT',
    description: 'Office visit',
    amount: '175',
    units: '1',
  });

  const register = useMutation({
    mutationFn: () =>
      api.registerVisit({
        patient: {
          firstName: form.firstName,
          lastName: form.lastName,
          dob: form.dob,
          mrn: form.mrn || undefined,
          phone: form.phone || undefined,
          email: form.email || undefined,
          sex: form.sex || undefined,
        },
        coverage:
          form.planName && form.memberId
            ? {
                planName: form.planName,
                memberId: form.memberId,
                payerId: form.payerId || undefined,
                payerName: form.payerName || undefined,
              }
            : undefined,
        encounter: {
          serviceFrom: form.serviceFrom,
          providerId: form.providerId || undefined,
          facilityId: form.facilityId || undefined,
          status: 'OPEN',
        },
        charge: form.code
          ? {
              code: form.code,
              codeSystem: form.codeSystem,
              description: form.description,
              units: Number(form.units) || 1,
              amount: Number(form.amount) || 0,
            }
          : undefined,
      }),
    onSuccess: (data) => {
      if (data?.error) {
        setNote(String(data.error));
        return;
      }
      setNote(
        `Registered ${data.patient?.firstName} ${data.patient?.lastName} · ${data.patient?.mrn}` +
          (data.coverage ? ` · coverage ${data.coverage.planName}` : '') +
          (data.encounter ? ` · encounter ${data.encounter.id}` : '') +
          (data.charge ? ` · charge ${data.charge.code}` : ''),
      );
      setForm((f) => ({
        ...f,
        firstName: '',
        lastName: '',
        dob: '',
        mrn: '',
        phone: '',
        email: '',
        memberId: '',
      }));
      void queryClient.invalidateQueries({ queryKey: ['patients'] });
      void queryClient.invalidateQueries({ queryKey: ['coverages'] });
      void queryClient.invalidateQueries({ queryKey: ['encounters'] });
      void queryClient.invalidateQueries({ queryKey: ['charges'] });
      void queryClient.invalidateQueries({ queryKey: ['payers'] });
      void queryClient.invalidateQueries({ queryKey: ['work-items'] });
    },
    onError: (err: Error) => setNote(err.message),
  });

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="ax-view">
      <SectionHeading
        eyebrow="Front desk"
        title="Check-in"
        detail="Register a patient, attach coverage, open an encounter, and capture a charge — no EHR required."
      />
      {note ? (
        <div className="ax-insight-strip">
          <ClipboardPlus size={17} />
          <span>{note}</span>
        </div>
      ) : null}
      <section className="ax-panel ax-reg-panel">
        <div className="ax-panel-head">
          <div>
            <span className="ax-kicker">Guided intake</span>
            <h2>New visit</h2>
          </div>
        </div>

        <div className="ax-reg-grid">
          <div className="ax-reg-column">
            <h3 className="ax-reg-section-title">Patient</h3>
            <div className="ax-reg-fields">
              <label>
                First name *
                <input value={form.firstName} onChange={(e) => set('firstName', e.target.value)} data-testid="input-reg-first" />
              </label>
              <label>
                Last name *
                <input value={form.lastName} onChange={(e) => set('lastName', e.target.value)} data-testid="input-reg-last" />
              </label>
              <label>
                Date of birth *
                <input type="date" value={form.dob} onChange={(e) => set('dob', e.target.value)} data-testid="input-reg-dob" />
              </label>
              <label>
                Chart number (optional)
                <input value={form.mrn} onChange={(e) => set('mrn', e.target.value)} placeholder="Filled in if you leave this blank" />
              </label>
              <label>
                Phone
                <input value={form.phone} onChange={(e) => set('phone', e.target.value)} />
              </label>
              <label>
                Email
                <input value={form.email} onChange={(e) => set('email', e.target.value)} />
              </label>
              <label className="ax-reg-span-2">
                Sex
                <select value={form.sex} onChange={(e) => set('sex', e.target.value)}>
                  <option value="">—</option>
                  <option value="F">Female</option>
                  <option value="M">Male</option>
                  <option value="U">Unknown</option>
                </select>
              </label>
            </div>
          </div>

          <div className="ax-reg-column">
            <h3 className="ax-reg-section-title">Insurance</h3>
            <div className="ax-reg-fields">
              <label>
                Insurance plan
                <input value={form.planName} onChange={(e) => set('planName', e.target.value)} placeholder="Blue Cross PPO" />
              </label>
              <label>
                Insurance member ID
                <input value={form.memberId} onChange={(e) => set('memberId', e.target.value)} />
              </label>
              <label className="ax-reg-span-2">
                Insurance company
                <select value={form.payerId} onChange={(e) => set('payerId', e.target.value)}>
                  <option value="">Add a new company</option>
                  {(payers.data ?? []).map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ax-reg-span-2">
                Or type a new company name
                <input value={form.payerName} onChange={(e) => set('payerName', e.target.value)} />
              </label>
            </div>
          </div>

          <div className="ax-reg-column">
            <h3 className="ax-reg-section-title">Visit</h3>
            <div className="ax-reg-fields">
              <label>
                Clinician
                <select value={form.providerId} onChange={(e) => set('providerId', e.target.value)}>
                  <option value="">Default</option>
                  {(providers.data ?? []).map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Facility
                <select value={form.facilityId} onChange={(e) => set('facilityId', e.target.value)}>
                  <option value="">Default</option>
                  {(facilities.data ?? []).map((f: any) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ax-reg-span-2">
                Service date *
                <input type="date" value={form.serviceFrom} onChange={(e) => set('serviceFrom', e.target.value)} />
              </label>
            </div>
          </div>

          <div className="ax-reg-column">
            <h3 className="ax-reg-section-title">Bill</h3>
            <div className="ax-reg-fields">
              <label>
                Bill code
                <input value={form.code} onChange={(e) => set('code', e.target.value)} />
              </label>
              <label>
                Code system
                <select value={form.codeSystem} onChange={(e) => set('codeSystem', e.target.value)}>
                  <option value="CPT">CPT</option>
                  <option value="HCPCS">HCPCS</option>
                  <option value="ICD">ICD</option>
                </select>
              </label>
              <label className="ax-reg-span-2">
                Description
                <input value={form.description} onChange={(e) => set('description', e.target.value)} />
              </label>
              <label>
                Amount
                <input value={form.amount} onChange={(e) => set('amount', e.target.value)} />
              </label>
              <label>
                Units
                <input value={form.units} onChange={(e) => set('units', e.target.value)} />
              </label>
            </div>
          </div>
        </div>

        <div className="ax-reg-actions">
          <button
            className="ax-primary-button"
            type="button"
            disabled={register.isPending || !form.firstName || !form.lastName || !form.dob}
            onClick={() => register.mutate()}
            data-testid="button-register-visit"
          >
            {register.isPending ? 'Saving…' : 'Save patient and visit'}
          </button>
        </div>
      </section>
    </div>
  );
}

