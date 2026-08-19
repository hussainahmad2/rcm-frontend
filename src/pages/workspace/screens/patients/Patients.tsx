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
import { AddPatientFlow } from './AddPatientFlow';
import { PatientWorkspace } from './PatientWorkspace';
import './Patients.css';

export function Patients() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [note, setNote] = useState('');
  const [search, setSearch] = useState({ firstName: '', lastName: '', dob: '' });
  const [matches, setMatches] = useState<any[] | null>(null);
  const patients = useQuery({ queryKey: ['patients'], queryFn: api.patients });
  const find = useMutation({
    mutationFn: () => api.searchPatients(search),
    onSuccess: (data) => setMatches(data.matches ?? []),
  });

  if (patients.isLoading) return <div className="ax-view"><LoadingState label="Loading patients…" /></div>;
  if (patients.error) return <div className="ax-view"><ErrorState error={patients.error} onRetry={() => void patients.refetch()} /></div>;

  const list = patients.data ?? [];

  return (
    <div className="ax-view">
      <SectionHeading
        eyebrow="Practice management"
        title="Patients"
        detail={`${list.length} patients · search before you create — duplicate records break eligibility, claims, and A/R`}
      />
      <section className="ax-panel" style={{ marginBottom: 16 }}>
        <div className="ax-panel-head">
          <div>
            <span className="ax-kicker">Patient search</span>
            <h2>Look up before adding</h2>
          </div>
        </div>
        <div className="ax-reg-fields">
          <label>
            First name
            <input value={search.firstName} onChange={(e) => setSearch((s) => ({ ...s, firstName: e.target.value }))} data-testid="input-patient-search-first" />
          </label>
          <label>
            Last name
            <input value={search.lastName} onChange={(e) => setSearch((s) => ({ ...s, lastName: e.target.value }))} data-testid="input-patient-search-last" />
          </label>
          <label>
            DOB
            <input type="date" value={search.dob} onChange={(e) => setSearch((s) => ({ ...s, dob: e.target.value }))} />
          </label>
        </div>
        <div className="ax-row-actions" style={{ marginTop: 12 }}>
          <button className="ax-primary-button" type="button" onClick={() => find.mutate()} data-testid="button-patient-search">
            Search
          </button>
        </div>
        {matches ? (
          <div className="ax-search-matches">
            {matches.length === 0 ? <p>No matches. You can add a new patient.</p> : null}
            {matches.map((patient: any) => (
              <button key={patient.id} type="button" className="ax-queue-row" onClick={() => setSelectedId(patient.id)}>
                <span>
                  <b>{patient.firstName} {patient.lastName}</b>
                  <small>{patient.dob} · {patient.mrn}</small>
                </span>
                <StatusPill tone="teal">Open</StatusPill>
              </button>
            ))}
          </div>
        ) : null}
      </section>
      {note ? (
        <div className="ax-insight-strip">
          <UsersRound size={17} />
          <span>{note}</span>
        </div>
      ) : null}
      {showCreate ? (
        <AddPatientFlow
          onCancel={() => setShowCreate(false)}
          onCreated={(patientId, message) => {
            setNote(message);
            setShowCreate(false);
            setSelectedId(patientId);
            void queryClient.invalidateQueries({ queryKey: ['patients'] });
            void queryClient.invalidateQueries({ queryKey: ['coverages'] });
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
              <button className="ax-primary-button" type="button" onClick={() => setShowCreate(true)} data-testid="button-add-patient">
                Add patient
              </button>
            </div>
            <div className="ax-table-head">
              <span>Patient</span>
              <span>MRN / market</span>
              <span>Balance</span>
              <span>Status</span>
            </div>
            {list.map((patient: any) => (
              <button
                type="button"
                className={`ax-queue-row ${selectedId === patient.id ? 'selected' : ''}`}
                key={patient.id}
                onClick={() => setSelectedId(patient.id)}
                data-testid={`row-patient-${patient.id}`}
              >
                <span className="ax-queue-main">
                  <span className="ax-module-icon">
                    <UsersRound size={15} />
                  </span>
                  <span>
                    <b>
                      {patient.firstName} {patient.lastName}
                    </b>
                    <small>{patient.id}</small>
                  </span>
                </span>
                <span className="ax-queue-context">
                  <b>{patient.mrn}</b>
                  <small>{patient.country}</small>
                </span>
                <span className="ax-queue-amount">{money(patient.balance ?? 0)}</span>
                <StatusPill tone={patient.registrationStatus === 'DRAFT' ? 'amber' : 'teal'}>
                  {patient.registrationStatus === 'DRAFT' ? 'Draft' : patient.source === 'MANUAL' ? 'Manual' : 'Active'}
                </StatusPill>
              </button>
            ))}
          </section>
          <aside className="ax-panel ax-inspection">
            {!selectedId ? (
              <div className="ax-empty">
                <PanelLeftOpen size={22} />
                <b>Select a patient</b>
                <p>Open the financial-access workspace: identity, coverage/COB, claims, and activity.</p>
              </div>
            ) : (
              <PatientWorkspace patientId={selectedId} />
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

