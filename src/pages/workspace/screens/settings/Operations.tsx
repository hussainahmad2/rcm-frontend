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
import './Operations.css';

export function OpsEmpty({ text }: { text: string }) {
  return <p className="ax-ops-empty">{text}</p>;
}

export function opsError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error);
  try {
    const parsed = JSON.parse(raw) as { message?: string | string[] };
    if (Array.isArray(parsed.message)) return parsed.message.join(', ');
    if (parsed.message) return parsed.message;
  } catch {
    // plain text from API
  }
  return raw;
}

const STAFF_ROLES = ['admin', 'operator', 'coder', 'biller', 'viewer'] as const;
type StaffRole = (typeof STAFF_ROLES)[number];

export function Operations({ onNavigate }: { onNavigate?: (view: import('../../workspace-types').WorkspaceView) => void }) {
  const { user, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const audit = useQuery({ queryKey: ['audit'], queryFn: api.audit });
  const tenant = useQuery({ queryKey: ['tenant'], queryFn: api.tenant });
  const readiness = useQuery({ queryKey: ['readyz'], queryFn: api.readiness });
  const onboarding = useQuery({
    queryKey: ['onboarding'],
    queryFn: api.onboarding,
    enabled: isAdminRole(user?.role),
  });
  const baa = useQuery({
    queryKey: ['baa'],
    queryFn: api.baaTemplate,
    enabled: isAdminRole(user?.role),
  });
  const users = useQuery({
    queryKey: ['users'],
    queryFn: api.listUsers,
    enabled: isAdminRole(user?.role),
  });
  const breaches = useQuery({
    queryKey: ['breaches'],
    queryFn: api.listBreaches,
    enabled: isAdminRole(user?.role) || user?.role === 'operator',
  });
  const hosting = useQuery({
    queryKey: ['hosting-vendors'],
    queryFn: api.hostingVendors,
    enabled: isAdminRole(user?.role) || user?.role === 'operator',
  });
  const training = useQuery({
    queryKey: ['training'],
    queryFn: api.training,
    enabled: Boolean(user),
  });
  const thirdParty = useQuery({
    queryKey: ['third-party-audits'],
    queryFn: api.thirdPartyAudits,
    enabled: isAdminRole(user?.role) || user?.role === 'operator',
  });
  const retention = useQuery({
    queryKey: ['retention'],
    queryFn: api.retention,
    enabled: isAdminRole(user?.role) || user?.role === 'operator',
  });
  const evidence = useQuery({
    queryKey: ['evidence'],
    queryFn: api.complianceEvidence,
    enabled: isAdminRole(user?.role) || user?.role === 'operator',
  });
  const runbooks = useQuery({
    queryKey: ['runbooks'],
    queryFn: api.runbooks,
    enabled: isAdminRole(user?.role) || user?.role === 'operator',
  });
  const inbox = useQuery({ queryKey: ['integration-messages'], queryFn: api.integrationMessages });
  const orgUnits = useQuery({ queryKey: ['organizations'], queryFn: api.organizations });
  const facilities = useQuery({ queryKey: ['facilities'], queryFn: api.facilities });
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    role: 'operator' as StaffRole,
    title: '',
    password: '',
  });
  const [editUser, setEditUser] = useState({
    name: '',
    email: '',
    role: 'operator' as StaffRole,
    title: '',
    password: '',
  });
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [newOrg, setNewOrg] = useState({ name: '', type: 'HEALTH_SYSTEM' });
  const [editOrg, setEditOrg] = useState({ name: '', type: 'HEALTH_SYSTEM' });
  const [editingOrgId, setEditingOrgId] = useState<string | null>(null);
  const [newFacility, setNewFacility] = useState({ name: '', organizationId: '', country: '' });
  const [editFacility, setEditFacility] = useState({ name: '', organizationId: '', country: '' });
  const [editingFacilityId, setEditingFacilityId] = useState<string | null>(null);
  const [activeFacilityId, setActiveFacilityId] = useState('');
  const [createdTempPassword, setCreatedTempPassword] = useState('');
  const [mfaEnroll, setMfaEnroll] = useState<{
    secret: string;
    otpauthUrl: string;
    recoveryCodes: string[];
  } | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaMessage, setMfaMessage] = useState('');
  const [baaNotes, setBaaNotes] = useState('');
  const [baaCounsel, setBaaCounsel] = useState({ firm: '', email: '', status: 'executed' as 'draft' | 'counsel_review' | 'executed' });
  const [breachForm, setBreachForm] = useState({ title: '', description: '', affectedIndividuals: 0 });
  const createOrganization = useMutation({
    mutationFn: () => api.createOrganization({ name: newOrg.name, type: newOrg.type }),
    onSuccess: (data) => {
      const createdId = data?.organization?.id as string | undefined;
      setNewOrg({ name: '', type: 'HEALTH_SYSTEM' });
      if (createdId) {
        setNewFacility((row) => (row.organizationId ? row : { ...row, organizationId: createdId }));
      }
      void queryClient.invalidateQueries({ queryKey: ['organizations'] });
      void queryClient.invalidateQueries({ queryKey: ['facilities'] });
      void queryClient.invalidateQueries({ queryKey: ['audit'] });
    },
  });
  const createFacility = useMutation({
    mutationFn: () =>
      api.createFacility({
        name: newFacility.name,
        organizationId: newFacility.organizationId,
        country: newFacility.country || undefined,
      }),
    onSuccess: (data) => {
      const createdId = data?.facility?.id as string | undefined;
      setNewFacility((row) => ({ ...row, name: '', country: '' }));
      if (createdId) setActiveFacilityId(createdId);
      void queryClient.invalidateQueries({ queryKey: ['facilities'] });
      void queryClient.invalidateQueries({ queryKey: ['organizations'] });
      void queryClient.invalidateQueries({ queryKey: ['audit'] });
    },
  });
  const updateOrganization = useMutation({
    mutationFn: () => api.updateOrganization(editingOrgId!, { name: editOrg.name, type: editOrg.type }),
    onSuccess: () => {
      setEditingOrgId(null);
      void queryClient.invalidateQueries({ queryKey: ['organizations'] });
      void queryClient.invalidateQueries({ queryKey: ['audit'] });
    },
  });
  const deleteOrganization = useMutation({
    mutationFn: (id: string) => api.deleteOrganization(id),
    onSuccess: () => {
      setEditingOrgId(null);
      void queryClient.invalidateQueries({ queryKey: ['organizations'] });
      void queryClient.invalidateQueries({ queryKey: ['facilities'] });
      void queryClient.invalidateQueries({ queryKey: ['audit'] });
    },
  });
  const updateFacility = useMutation({
    mutationFn: () =>
      api.updateFacility(editingFacilityId!, {
        name: editFacility.name,
        organizationId: editFacility.organizationId,
        country: editFacility.country || undefined,
      }),
    onSuccess: () => {
      setEditingFacilityId(null);
      void queryClient.invalidateQueries({ queryKey: ['facilities'] });
      void queryClient.invalidateQueries({ queryKey: ['audit'] });
    },
  });
  const deleteFacility = useMutation({
    mutationFn: (id: string) => api.deleteFacility(id),
    onSuccess: () => {
      setEditingFacilityId(null);
      void queryClient.invalidateQueries({ queryKey: ['facilities'] });
      void queryClient.invalidateQueries({ queryKey: ['audit'] });
    },
  });
  const createUser = useMutation({
    mutationFn: () =>
      api.createUser({
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        title: newUser.title || undefined,
        password: newUser.password,
      }),
    onSuccess: (data) => {
      setCreatedTempPassword(data.temporaryPassword || '');
      setNewUser({ name: '', email: '', role: 'operator', title: '', password: '' });
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
  const updateUser = useMutation({
    mutationFn: () =>
      api.updateUser(editingUserId!, {
        name: editUser.name,
        email: editUser.email,
        role: editUser.role,
        title: editUser.title || undefined,
        password: editUser.password || undefined,
      }),
    onSuccess: () => {
      setEditingUserId(null);
      setEditUser({ name: '', email: '', role: 'operator', title: '', password: '' });
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
  const deleteUser = useMutation({
    mutationFn: (id: string) => api.deleteUser(id),
    onSuccess: () => {
      setEditingUserId(null);
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
  const acceptBaa = useMutation({
    mutationFn: () =>
      api.acceptBaa({
        notes: baaNotes || undefined,
        signerTitle: user?.title,
        status: baaCounsel.status,
        counselFirm: baaCounsel.firm || undefined,
        counselEmail: baaCounsel.email || undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['onboarding'] });
      void queryClient.invalidateQueries({ queryKey: ['readyz'] });
    },
  });
  const beginMfa = useMutation({
    mutationFn: () => api.beginMfaEnroll(),
    onSuccess: (data) => {
      setMfaEnroll({
        secret: data.secret,
        otpauthUrl: data.otpauthUrl,
        recoveryCodes: data.recoveryCodes,
      });
      setMfaMessage('Scan the secret in your authenticator app, then confirm with a code.');
    },
  });
  const confirmMfa = useMutation({
    mutationFn: () => api.confirmMfaEnroll(mfaCode.trim()),
    onSuccess: async () => {
      setMfaMessage('MFA enabled for your account.');
      setMfaEnroll(null);
      setMfaCode('');
      await refreshProfile();
      void queryClient.invalidateQueries({ queryKey: ['onboarding'] });
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
  const requireMfa = useMutation({
    mutationFn: (required: boolean) => api.setTenantMfaRequired(required),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['onboarding'] });
      void queryClient.invalidateQueries({ queryKey: ['readyz'] });
    },
  });
  const requireSso = useMutation({
    mutationFn: (required: boolean) => api.setTenantSsoRequired(required),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['onboarding'] });
      void queryClient.invalidateQueries({ queryKey: ['readyz'] });
    },
  });
  const openBreach = useMutation({
    mutationFn: () =>
      api.openBreach({
        title: breachForm.title,
        description: breachForm.description,
        affectedIndividuals: breachForm.affectedIndividuals,
      }),
    onSuccess: () => {
      setBreachForm({ title: '', description: '', affectedIndividuals: 0 });
      void queryClient.invalidateQueries({ queryKey: ['breaches'] });
    },
  });
  const runRetention = useMutation({
    mutationFn: (policyId: string) => api.runRetention({ policyId, dryRun: true }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['retention'] }),
  });
  const executeRunbook = useMutation({
    mutationFn: (id: string) => api.executeRunbook(id, { notes: 'Executed from Operations' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['runbooks'] }),
  });
  const rotateKeys = useMutation({
    mutationFn: () => api.rotateKeys('Rotation initiated from Operations'),
  });
  const reencrypt = useMutation({
    mutationFn: () => api.reencryptPhi(),
  });
  const executeHostingBaa = useMutation({
    mutationFn: (id: string) => api.executeHostingBaa(id, { documentVersion: '2026.1', notes: 'Executed from Operations' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['hosting-vendors'] });
      void queryClient.invalidateQueries({ queryKey: ['onboarding'] });
    },
  });
  const assignAllTraining = useMutation({
    mutationFn: (courseId: string) => api.assignTrainingAll(courseId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['training'] }),
  });
  const completeTraining = useMutation({
    mutationFn: (body: { assignmentId?: string; courseId: string }) => api.completeTraining(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['training'] });
      void queryClient.invalidateQueries({ queryKey: ['onboarding'] });
    },
  });
  const completeAudit = useMutation({
    mutationFn: (item: any) =>
      api.upsertThirdPartyAudit({
        id: item.id,
        auditType: item.auditType,
        title: item.title,
        firmName: item.firmName,
        markCompleted: true,
        reportUri: item.reportUri || `internal://velora/audits/${item.id}`,
        opinion: 'attested',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['third-party-audits'] });
      void queryClient.invalidateQueries({ queryKey: ['onboarding'] });
    },
  });
  const attestEvidence = useMutation({
    mutationFn: (item: any) =>
      api.upsertEvidence({
        id: item.id,
        category: item.category,
        framework: item.framework,
        controlId: item.controlId,
        title: item.title,
        status: 'attested',
        evidenceUri: item.evidenceUri || `internal://velora/${item.controlId}`,
        notes: 'Attested in Operations evidence vault',
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['evidence'] }),
  });

  useEffect(() => {
    const firstOrg = orgUnits.data?.[0]?.id;
    if (firstOrg) {
      setNewFacility((row) => (row.organizationId ? row : { ...row, organizationId: firstOrg }));
    }
  }, [orgUnits.data]);

  useEffect(() => {
    const home = tenant.data?.homeCountry;
    if (home) {
      setNewFacility((row) => (row.country ? row : { ...row, country: home }));
    }
  }, [tenant.data?.homeCountry]);

  if (audit.isLoading || tenant.isLoading) return <div className="ax-view"><LoadingState label="Loading operations…" /></div>;
  if (audit.error) return <div className="ax-view"><ErrorState error={audit.error} onRetry={() => void audit.refetch()} /></div>;

  const events = audit.data ?? [];
  const org = tenant.data;
  const checks = readiness.data?.checks ?? [];
  const settings = onboarding.data?.settings;
  const inboxRows = inbox.data ?? [];
  const directory = users.data ?? [];
  const checksPass = checks.filter((check: { ok?: boolean }) => check.ok).length;
  const organizationRows = orgUnits.data ?? [];
  const facilityRows = facilities.data ?? [];
  const selectedFacilityId = activeFacilityId || facilityRows[0]?.id || '';
  const canEditDirectoryUser = (entry: { id: string; role: string }) =>
    user?.role === 'superadmin' || (isAdminRole(user?.role) && entry.role !== 'superadmin');
  const canDeleteDirectoryUser = (entry: { id: string; role: string }) =>
    Boolean(user) && entry.id !== user?.id && entry.role !== 'superadmin' && isAdminRole(user?.role);

  return (
    <div className="ax-view ax-ops">
      <SectionHeading
        eyebrow="Workspace controls"
        title="Operations"
        detail="Organization, people, identity, and compliance — one column, top to bottom."
      />

      <div className="ax-ops-stats">
        <article className="ax-ops-stat">
          <span>Organization</span>
          <b>{org?.name ?? 'Velora'}</b>
          <small>{org?.countryPack ?? '—'} · {org?.currency ?? '—'}</small>
        </article>
        <article className="ax-ops-stat">
          <span>Readiness</span>
          <b>{readiness.data?.ready ? 'Ready' : 'Open'}</b>
          <small>{checksPass}/{checks.length || 0} controls passing</small>
        </article>
        <article className="ax-ops-stat">
          <span>Directory</span>
          <b>{directory.length}</b>
          <small>{user?.mfaEnabled ? 'Your MFA is on' : 'Your MFA is off'}</small>
        </article>
        <article className="ax-ops-stat">
          <span>BAA</span>
          <b>{settings?.baaAccepted ? 'Recorded' : 'Pending'}</b>
          <small>{String(readiness.data?.mode ?? 'enterprise')}</small>
        </article>
      </div>

      <section className="ax-panel">
        <div className="ax-panel-head">
          <div>
            <span className="ax-kicker">Organization</span>
            <h2>{org?.name ?? 'Velora Revenue OS'}</h2>
          </div>
          <Building2 size={19} />
        </div>
        <div className="ax-ops-meta">
          <div>
            <span>Home country</span>
            <b>{org?.homeCountry ?? '—'}</b>
          </div>
          <div>
            <span>Country pack</span>
            <b>{org?.countryPack ?? '—'}</b>
          </div>
          <div>
            <span>Currency</span>
            <b>{org?.currency ?? '—'}</b>
          </div>
          <div>
            <span>Runtime mode</span>
            <b>{readiness.data?.mode ?? 'enterprise'}</b>
          </div>
          <div>
            <span>Data region</span>
            <b>{org?.dataRegion ?? '—'}</b>
          </div>
          <div>
            <span>Timezone</span>
            <b>{org?.timezone ?? '—'}</b>
          </div>
          <label>
            Active facility
            <select
              value={selectedFacilityId}
              onChange={(e) => setActiveFacilityId(e.target.value)}
              data-testid="select-active-facility"
            >
              {facilityRows.length ? (
                facilityRows.map((row: { id: string; name: string }) => (
                  <option key={row.id} value={row.id}>{row.name}</option>
                ))
              ) : (
                <option value="">Add a facility below</option>
              )}
            </select>
          </label>
          <label>
            Approval posture
            <select defaultValue="Review all high-value actions" data-testid="select-approval-posture">
              <option>Review all high-value actions</option>
              <option>Review all actions</option>
              <option>Auto-prepare, never auto-commit</option>
            </select>
          </label>
        </div>
      </section>

      {isAdminRole(user?.role) ? (
        <section className="ax-panel">
          <div className="ax-panel-head">
            <div>
              <span className="ax-kicker">Hospitals and clinics</span>
              <h2>Organizations and facilities</h2>
            </div>
            <Hospital size={19} />
          </div>
          <p className="ax-panel-copy">
            The workspace switcher (Meridian, Gulf, Pacific) is the tenant — country, currency, and data region.
            Add each hospital or clinic as an organization in this tenant, then add facilities (sites) under it.
          </p>
          <div className="ax-ops-fields ax-ops-fields-org">
            <label>
              Organization
              <input
                value={newOrg.name}
                onChange={(e) => setNewOrg((row) => ({ ...row, name: e.target.value }))}
                placeholder="Hospital or clinic name"
                data-testid="input-new-org-name"
              />
            </label>
            <label>
              Type
              <select
                value={newOrg.type}
                onChange={(e) => setNewOrg((row) => ({ ...row, type: e.target.value }))}
                data-testid="select-new-org-type"
              >
                <option value="HEALTH_SYSTEM">Health system</option>
                <option value="HOSPITAL">Hospital</option>
                <option value="CLINIC">Clinic</option>
                <option value="AMBULATORY">Ambulatory</option>
                <option value="GROUP_PRACTICE">Group practice</option>
              </select>
            </label>
            <button
              className="ax-ops-btn"
              type="button"
              disabled={createOrganization.isPending || !newOrg.name.trim()}
              onClick={() => createOrganization.mutate()}
              data-testid="button-create-org"
            >
              {createOrganization.isPending ? 'Saving' : 'Add'}
            </button>
          </div>
          {createOrganization.isError ? <p className="ax-inline-error">{opsError(createOrganization.error)}</p> : null}

          <div className="ax-ops-fields ax-ops-fields-fac">
            <label>
              Facility
              <input
                value={newFacility.name}
                onChange={(e) => setNewFacility((row) => ({ ...row, name: e.target.value }))}
                placeholder="Site name"
                data-testid="input-new-facility-name"
              />
            </label>
            <label>
              Organization
              <select
                value={newFacility.organizationId}
                onChange={(e) => setNewFacility((row) => ({ ...row, organizationId: e.target.value }))}
                data-testid="select-new-facility-org"
              >
                {organizationRows.length ? (
                  organizationRows.map((row: { id: string; name: string }) => (
                    <option key={row.id} value={row.id}>{row.name}</option>
                  ))
                ) : (
                  <option value="">Add an organization first</option>
                )}
              </select>
            </label>
            <label>
              Country
              <input
                value={newFacility.country}
                onChange={(e) => setNewFacility((row) => ({ ...row, country: e.target.value.toUpperCase() }))}
                placeholder={org?.homeCountry ?? 'US'}
                data-testid="input-new-facility-country"
              />
            </label>
            <button
              className="ax-ops-btn"
              type="button"
              disabled={createFacility.isPending || !newFacility.name.trim() || !newFacility.organizationId}
              onClick={() => createFacility.mutate()}
              data-testid="button-create-facility"
            >
              {createFacility.isPending ? 'Saving' : 'Add'}
            </button>
          </div>
          {createFacility.isError ? <p className="ax-inline-error">{opsError(createFacility.error)}</p> : null}
          {updateOrganization.isError ? <p className="ax-inline-error">{opsError(updateOrganization.error)}</p> : null}
          {deleteOrganization.isError ? <p className="ax-inline-error">{opsError(deleteOrganization.error)}</p> : null}
          {updateFacility.isError ? <p className="ax-inline-error">{opsError(updateFacility.error)}</p> : null}
          {deleteFacility.isError ? <p className="ax-inline-error">{opsError(deleteFacility.error)}</p> : null}

          <div className="ax-ops-directory">
            {organizationRows.length ? (
              <div className="ax-ops-rows">
                {organizationRows.map((row: { id: string; name: string; type: string }) => {
                  const sites = facilityRows.filter((site: { id: string; name: string; country: string; organizationId: string }) => site.organizationId === row.id);
                  const editing = editingOrgId === row.id;
                  return (
                    <div className="ax-ops-group" key={row.id}>
                      {editing ? (
                        <div className="ax-ops-fields ax-ops-fields-org">
                          <label>
                            Organization
                            <input value={editOrg.name} onChange={(e) => setEditOrg((current) => ({ ...current, name: e.target.value }))} />
                          </label>
                          <label>
                            Type
                            <select value={editOrg.type} onChange={(e) => setEditOrg((current) => ({ ...current, type: e.target.value }))}>
                              <option value="HEALTH_SYSTEM">Health system</option>
                              <option value="HOSPITAL">Hospital</option>
                              <option value="CLINIC">Clinic</option>
                              <option value="AMBULATORY">Ambulatory</option>
                              <option value="GROUP_PRACTICE">Group practice</option>
                            </select>
                          </label>
                          <div className="ax-ops-row-actions">
                            <button className="ax-ops-btn" type="button" disabled={updateOrganization.isPending || !editOrg.name.trim()} onClick={() => updateOrganization.mutate()}>Save</button>
                            <button className="ax-ops-btn ax-ops-btn-quiet" type="button" onClick={() => setEditingOrgId(null)}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="ax-ops-row">
                          <span>
                            <b>{row.name}</b>
                            <small>{row.type.replace(/_/g, ' ').toLowerCase()}</small>
                          </span>
                          <div className="ax-ops-row-actions">
                            <button
                              className="ax-ops-btn ax-ops-btn-quiet"
                              type="button"
                              onClick={() => {
                                setEditingOrgId(row.id);
                                setEditOrg({ name: row.name, type: row.type });
                              }}
                            >
                              Edit
                            </button>
                            <button
                              className="ax-ops-btn ax-ops-btn-quiet ax-ops-btn-danger"
                              type="button"
                              disabled={deleteOrganization.isPending}
                              onClick={() => {
                                if (window.confirm(`Delete ${row.name} and its facilities?`)) deleteOrganization.mutate(row.id);
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                      {sites.map((site: { id: string; name: string; country: string; organizationId: string }) => (
                        editingFacilityId === site.id ? (
                          <div className="ax-ops-fields ax-ops-fields-fac ax-ops-nested" key={site.id}>
                            <label>
                              Facility
                              <input value={editFacility.name} onChange={(e) => setEditFacility((current) => ({ ...current, name: e.target.value }))} />
                            </label>
                            <label>
                              Organization
                              <select value={editFacility.organizationId} onChange={(e) => setEditFacility((current) => ({ ...current, organizationId: e.target.value }))}>
                                {organizationRows.map((orgRow: { id: string; name: string }) => (
                                  <option key={orgRow.id} value={orgRow.id}>{orgRow.name}</option>
                                ))}
                              </select>
                            </label>
                            <label>
                              Country
                              <input value={editFacility.country} onChange={(e) => setEditFacility((current) => ({ ...current, country: e.target.value.toUpperCase() }))} />
                            </label>
                            <div className="ax-ops-row-actions">
                              <button className="ax-ops-btn" type="button" disabled={updateFacility.isPending || !editFacility.name.trim()} onClick={() => updateFacility.mutate()}>Save</button>
                              <button className="ax-ops-btn ax-ops-btn-quiet" type="button" onClick={() => setEditingFacilityId(null)}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div className="ax-ops-row ax-ops-nested" key={site.id}>
                            <span>
                              <b>{site.name}</b>
                              <small>Facility · {site.country}</small>
                            </span>
                            <div className="ax-ops-row-actions">
                              <button
                                className="ax-ops-btn ax-ops-btn-quiet"
                                type="button"
                                onClick={() => {
                                  setEditingFacilityId(site.id);
                                  setEditFacility({ name: site.name, organizationId: site.organizationId, country: site.country });
                                }}
                              >
                                Edit
                              </button>
                              <button
                                className="ax-ops-btn ax-ops-btn-quiet ax-ops-btn-danger"
                                type="button"
                                disabled={deleteFacility.isPending}
                                onClick={() => {
                                  if (window.confirm(`Delete facility ${site.name}?`)) deleteFacility.mutate(site.id);
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        )
                      ))}
                    </div>
                  );
                })}
              </div>
            ) : (
              <OpsEmpty text="No hospitals or clinics in this workspace yet. Add an organization, then a facility." />
            )}
          </div>
        </section>
      ) : null}

      {isAdminRole(user?.role) ? (
        <section className="ax-panel">
          <div className="ax-panel-head">
            <div>
              <span className="ax-kicker">People</span>
              <h2>Directory</h2>
            </div>
            <StatusPill tone="teal">{directory.length} active</StatusPill>
          </div>
          <p className="ax-panel-copy">Create staff with a name, email, role, and password. Superadmin can edit or delete accounts; the superadmin account itself cannot be deleted.</p>
          <div className="ax-ops-fields ax-ops-fields-user">
            <label>
              Name
              <input value={newUser.name} onChange={(e) => setNewUser((current) => ({ ...current, name: e.target.value }))} placeholder="Full name" data-testid="input-new-user-name" />
            </label>
            <label>
              Email
              <input value={newUser.email} onChange={(e) => setNewUser((current) => ({ ...current, email: e.target.value }))} placeholder="work@email.com" data-testid="input-new-user-email" />
            </label>
            <label>
              Role
              <select value={newUser.role} onChange={(e) => setNewUser((current) => ({ ...current, role: e.target.value as StaffRole }))} data-testid="select-new-user-role">
                {STAFF_ROLES.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </label>
            <label>
              Title
              <input value={newUser.title} onChange={(e) => setNewUser((current) => ({ ...current, title: e.target.value }))} placeholder="Job title" />
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete="new-password"
                value={newUser.password}
                onChange={(e) => setNewUser((current) => ({ ...current, password: e.target.value }))}
                placeholder="Min 8 characters"
                data-testid="input-new-user-password"
              />
            </label>
            <button
              className="ax-ops-btn"
              type="button"
              disabled={createUser.isPending || !newUser.name.trim() || !newUser.email.trim() || newUser.password.length < 8}
              onClick={() => createUser.mutate()}
              data-testid="button-create-user"
            >
              {createUser.isPending ? 'Saving' : 'Add'}
            </button>
          </div>
          {createdTempPassword ? (
            <p className="ax-inline-success">Temporary password issued: {createdTempPassword}</p>
          ) : null}
          {createUser.isError ? <p className="ax-inline-error">{opsError(createUser.error)}</p> : null}
          {updateUser.isError ? <p className="ax-inline-error">{opsError(updateUser.error)}</p> : null}
          {deleteUser.isError ? <p className="ax-inline-error">{opsError(deleteUser.error)}</p> : null}
          <div className="ax-ops-directory">
            {directory.length ? (
              <div className="ax-ops-rows">
                {directory.map((entry: any) => (
                  editingUserId === entry.id ? (
                    <div className="ax-ops-fields ax-ops-fields-user" key={entry.id}>
                      <label>
                        Name
                        <input value={editUser.name} onChange={(e) => setEditUser((current) => ({ ...current, name: e.target.value }))} />
                      </label>
                      <label>
                        Email
                        <input value={editUser.email} onChange={(e) => setEditUser((current) => ({ ...current, email: e.target.value }))} />
                      </label>
                      <label>
                        Role
                        {entry.role === 'superadmin' ? (
                          <input value="superadmin" disabled />
                        ) : (
                          <select value={editUser.role} onChange={(e) => setEditUser((current) => ({ ...current, role: e.target.value as StaffRole }))}>
                            {STAFF_ROLES.map((role) => (
                              <option key={role} value={role}>{role}</option>
                            ))}
                          </select>
                        )}
                      </label>
                      <label>
                        Title
                        <input value={editUser.title} onChange={(e) => setEditUser((current) => ({ ...current, title: e.target.value }))} />
                      </label>
                      <label>
                        Password
                        <input
                          type="password"
                          autoComplete="new-password"
                          value={editUser.password}
                          onChange={(e) => setEditUser((current) => ({ ...current, password: e.target.value }))}
                          placeholder="Leave blank to keep"
                        />
                      </label>
                      <div className="ax-ops-row-actions">
                        <button className="ax-ops-btn" type="button" disabled={updateUser.isPending || !editUser.name.trim() || !editUser.email.trim()} onClick={() => updateUser.mutate()}>Save</button>
                        <button className="ax-ops-btn ax-ops-btn-quiet" type="button" onClick={() => setEditingUserId(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="ax-ops-row" key={entry.id}>
                      <span>
                        <b>{entry.name}</b>
                        <small>
                          {entry.email} · {entry.role}
                          {entry.title ? ` · ${entry.title}` : ''}
                        </small>
                      </span>
                      <div className="ax-ops-row-actions">
                        {canEditDirectoryUser(entry) ? (
                          <button
                            className="ax-ops-btn ax-ops-btn-quiet"
                            type="button"
                            onClick={() => {
                              setEditingUserId(entry.id);
                              setEditUser({
                                name: entry.name,
                                email: entry.email,
                                role: (STAFF_ROLES.includes(entry.role) ? entry.role : 'operator') as StaffRole,
                                title: entry.title || '',
                                password: '',
                              });
                            }}
                          >
                            Edit
                          </button>
                        ) : null}
                        {canDeleteDirectoryUser(entry) ? (
                          <button
                            className="ax-ops-btn ax-ops-btn-quiet ax-ops-btn-danger"
                            type="button"
                            disabled={deleteUser.isPending}
                            onClick={() => {
                              if (window.confirm(`Delete ${entry.name}? They will no longer be able to sign in.`)) deleteUser.mutate(entry.id);
                            }}
                          >
                            Delete
                          </button>
                        ) : null}
                      </div>
                    </div>
                  )
                ))}
              </div>
            ) : (
              <OpsEmpty text="No staff besides you yet. Add an operator to run the front desk." />
            )}
          </div>
        </section>
      ) : null}

      <section className="ax-panel">
        <div className="ax-panel-head">
          <div>
            <span className="ax-kicker">Identity</span>
            <h2>Multi-factor authentication</h2>
          </div>
          <StatusPill tone={user?.mfaEnabled ? 'teal' : 'amber'}>
            {user?.mfaEnabled ? 'Enabled on account' : 'Not enrolled'}
          </StatusPill>
        </div>
        <p className="ax-panel-copy">
          Enroll TOTP for your signed-in account. When tenant MFA is required, password login blocks until enrollment completes.
        </p>
        <div className="ax-ops-actions" style={{ marginBottom: 12 }}>
          {!user?.mfaEnabled && !mfaEnroll ? (
            <button
              className="ax-primary-button"
              type="button"
              disabled={beginMfa.isPending}
              onClick={() => beginMfa.mutate()}
              data-testid="button-mfa-begin"
            >
              {beginMfa.isPending ? 'Preparing…' : 'Start MFA enrollment'}
            </button>
          ) : null}
          {isAdminRole(user?.role) ? (
            <>
              <button
                className="ax-secondary-button"
                type="button"
                disabled={requireMfa.isPending}
                onClick={() => requireMfa.mutate(!settings?.mfaRequired)}
                data-testid="button-mfa-require"
              >
                {settings?.mfaRequired ? 'Clear tenant MFA requirement' : 'Require MFA for this tenant'}
              </button>
              <button
                className="ax-secondary-button"
                type="button"
                disabled={requireSso.isPending}
                onClick={() => requireSso.mutate(!settings?.ssoRequired)}
                data-testid="button-sso-require"
              >
                {settings?.ssoRequired ? 'Clear SSO requirement' : 'Require SSO for this tenant'}
              </button>
            </>
          ) : null}
        </div>
        {mfaEnroll ? (
          <div className="ax-ops-form">
            <div>
              <span className="ax-kicker">Secret</span>
              <b data-testid="text-mfa-secret">{mfaEnroll.secret}</b>
            </div>
            <div className="ax-ops-span-2">
              <span className="ax-kicker">otpauth</span>
              <b style={{ wordBreak: 'break-all', fontSize: 12 }}>{mfaEnroll.otpauthUrl}</b>
            </div>
            <div className="ax-ops-span-2">
              <span className="ax-kicker">Recovery codes</span>
              <b>{mfaEnroll.recoveryCodes.join(' · ')}</b>
            </div>
            <label>
              Confirm with authenticator code
              <input
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                data-testid="input-mfa-confirm"
              />
            </label>
            <div className="ax-ops-actions">
              <button
                className="ax-primary-button"
                type="button"
                disabled={confirmMfa.isPending || mfaCode.trim().length < 6}
                onClick={() => confirmMfa.mutate()}
                data-testid="button-mfa-confirm"
              >
                {confirmMfa.isPending ? 'Confirming…' : 'Confirm MFA'}
              </button>
            </div>
          </div>
        ) : null}
        {mfaMessage ? <p className="ax-panel-copy">{mfaMessage}</p> : null}
      </section>

      <section className="ax-panel">
        <div className="ax-panel-head">
          <div>
            <span className="ax-kicker">Enterprise readiness</span>
            <h2>{readiness.data?.ready ? 'Controls ready' : 'Hardening in progress'}</h2>
          </div>
          <StatusPill tone={readiness.data?.ready ? 'teal' : 'amber'}>
            {String(readiness.data?.mode ?? 'enterprise').toUpperCase()}
          </StatusPill>
        </div>
        {checks.length ? (
          <div className="ax-opportunity-list">
            {checks.map((check: any) => (
              <div className="ax-opportunity" key={check.id}>
                <span className="ax-rank">{check.ok ? 'OK' : '!'}</span>
                <span>
                  <b>{check.label}</b>
                  <small>{check.id}</small>
                </span>
                <StatusPill tone={check.ok ? 'teal' : 'coral'}>{check.ok ? 'Pass' : 'Action'}</StatusPill>
              </div>
            ))}
          </div>
        ) : (
          <OpsEmpty text="Readiness checks will appear when the control plane reports." />
        )}
        {isAdminRole(user?.role) && onboarding.data?.steps?.length ? (
          <div className="ax-opportunity-list" style={{ marginTop: 12 }}>
            {onboarding.data.steps.map((step: any) => (
              <div className="ax-opportunity" key={step.id}>
                <span className="ax-rank">{String(step.status).slice(0, 2).toUpperCase()}</span>
                <span>
                  <b>{step.title}</b>
                  <small>{step.detail}</small>
                </span>
                <StatusPill tone={step.status === 'complete' ? 'teal' : step.status === 'deferred' ? 'neutral' : 'amber'}>
                  {formatLabel(step.status)}
                </StatusPill>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {isAdminRole(user?.role) ? (
        <section className="ax-panel">
          <div className="ax-panel-head">
            <div>
              <span className="ax-kicker">Legal</span>
              <h2>BAA acceptance</h2>
            </div>
            <StatusPill tone={settings?.baaAccepted ? 'teal' : 'amber'}>
              {settings?.baaAccepted ? 'Recorded' : 'Pending'}
            </StatusPill>
          </div>
          <p className="ax-panel-copy">
            {baa.data?.document ?? 'Velora Business Associate Agreement'} · version {baa.data?.version ?? '2026.1'}
          </p>
          {baa.data?.notice ? <p className="ax-panel-copy">{baa.data.notice}</p> : null}
          {!settings?.baaAccepted ? (
            <div className="ax-ops-form">
              <label>
                Workflow status
                <select
                  value={baaCounsel.status}
                  onChange={(e) => setBaaCounsel((c) => ({ ...c, status: e.target.value as any }))}
                  data-testid="select-baa-status"
                >
                  <option value="draft">draft</option>
                  <option value="counsel_review">counsel_review</option>
                  <option value="executed">executed</option>
                </select>
              </label>
              <label>
                Counsel firm
                <input value={baaCounsel.firm} onChange={(e) => setBaaCounsel((c) => ({ ...c, firm: e.target.value }))} data-testid="input-baa-counsel-firm" />
              </label>
              <label>
                Counsel email
                <input value={baaCounsel.email} onChange={(e) => setBaaCounsel((c) => ({ ...c, email: e.target.value }))} data-testid="input-baa-counsel-email" />
              </label>
              <label>
                Acceptance notes
                <input
                  value={baaNotes}
                  onChange={(e) => setBaaNotes(e.target.value)}
                  placeholder="Executed under counsel review / MSA reference"
                  data-testid="input-baa-notes"
                />
              </label>
              <div className="ax-ops-span-2 ax-ops-actions">
                <button
                  className="ax-primary-button"
                  type="button"
                  disabled={acceptBaa.isPending}
                  onClick={() => acceptBaa.mutate()}
                  data-testid="button-accept-baa"
                >
                  {acceptBaa.isPending ? 'Recording…' : 'Record BAA workflow step'}
                </button>
              </div>
            </div>
          ) : (
            <p className="ax-panel-copy">Acceptance is stored for this tenant.</p>
          )}
        </section>
      ) : null}

      {(isAdminRole(user?.role) || user?.role === 'operator') ? (
        <section className="ax-panel">
          <div className="ax-panel-head">
            <div>
              <span className="ax-kicker">Vendors</span>
              <h2>Hosting / subprocessor BAAs</h2>
            </div>
            <StatusPill tone={hosting.data?.summary?.ready ? 'teal' : 'amber'}>
              {hosting.data?.summary?.baaExecuted ?? 0}/{hosting.data?.summary?.phiVendors ?? 0} executed
            </StatusPill>
          </div>
          <p className="ax-panel-copy">Gaps: {hosting.data?.summary?.baaGaps ?? '—'}</p>
          {(hosting.data?.vendors ?? []).length ? (
            <div className="ax-opportunity-list">
              {(hosting.data?.vendors ?? []).map((vendor: any) => (
                <div className="ax-opportunity" key={vendor.id}>
                  <span className="ax-rank">HV</span>
                  <span>
                    <b>{vendor.vendorName}</b>
                    <small>{vendor.category} · BAA {vendor.baaStatus}</small>
                  </span>
                  {vendor.baaStatus !== 'executed' && isAdminRole(user?.role) ? (
                    <button className="ax-secondary-button" type="button" onClick={() => executeHostingBaa.mutate(vendor.id)}>
                      Execute BAA
                    </button>
                  ) : (
                    <StatusPill tone="teal">Executed</StatusPill>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <OpsEmpty text="No hosting vendors on file yet." />
          )}
        </section>
      ) : null}

      {(isAdminRole(user?.role) || user?.role === 'operator') ? (
        <section className="ax-panel">
          <div className="ax-panel-head">
            <div>
              <span className="ax-kicker">Workforce</span>
              <h2>Training</h2>
            </div>
            <StatusPill tone={training.data?.summary?.ready ? 'teal' : 'amber'}>
              {training.data?.summary?.overdue ?? 0} overdue
            </StatusPill>
          </div>
          <p className="ax-panel-copy">
            Courses {training.data?.summary?.courses ?? 0} · Assignments {training.data?.summary?.assignments ?? 0}
          </p>
          {(training.data?.courses ?? []).length ? (
            <div className="ax-opportunity-list">
              {(training.data?.courses ?? []).map((course: any) => (
                <div className="ax-opportunity" key={course.id}>
                  <span className="ax-rank">TR</span>
                  <span>
                    <b>{course.title}</b>
                    <small>{course.code} · {course.durationMinutes} min · cadence {course.cadenceDays}d</small>
                  </span>
                  {isAdminRole(user?.role) ? (
                    <button className="ax-secondary-button" type="button" onClick={() => assignAllTraining.mutate(course.id)}>
                      Assign all users
                    </button>
                  ) : null}
                </div>
              ))}
              {(training.data?.assignments ?? [])
                .filter((a: any) => a.status !== 'completed' && (a.userId === user?.id || isAdminRole(user?.role)))
                .slice(0, 8)
                .map((assignment: any) => (
                  <div className="ax-opportunity" key={assignment.id}>
                    <span className="ax-rank">AS</span>
                    <span>
                      <b>{assignment.userName}</b>
                      <small>Due {new Date(assignment.dueAt).toLocaleDateString()} · {assignment.status}</small>
                    </span>
                    {(assignment.userId === user?.id || isAdminRole(user?.role)) ? (
                      <button
                        className="ax-secondary-button"
                        type="button"
                        onClick={() => completeTraining.mutate({ assignmentId: assignment.id, courseId: assignment.courseId })}
                      >
                        Complete & attest
                      </button>
                    ) : null}
                  </div>
                ))}
            </div>
          ) : (
            <OpsEmpty text="No training courses assigned." />
          )}
        </section>
      ) : null}

      {(isAdminRole(user?.role) || user?.role === 'operator') ? (
        <section className="ax-panel">
          <div className="ax-panel-head">
            <div>
              <span className="ax-kicker">Assurance</span>
              <h2>Third-party audits</h2>
            </div>
            <StatusPill tone={thirdParty.data?.summary?.ready ? 'teal' : 'amber'}>Audits</StatusPill>
          </div>
          {(thirdParty.data?.audits ?? []).length || (thirdParty.data?.findings ?? []).length ? (
            <div className="ax-opportunity-list">
              {(thirdParty.data?.audits ?? []).map((item: any) => (
                <div className="ax-opportunity" key={item.id}>
                  <span className="ax-rank">AU</span>
                  <span>
                    <b>{item.title}</b>
                    <small>{item.firmName} · {item.auditType} · {item.status}</small>
                  </span>
                  {item.status !== 'completed' && isAdminRole(user?.role) ? (
                    <button className="ax-secondary-button" type="button" onClick={() => completeAudit.mutate(item)}>
                      Mark report received
                    </button>
                  ) : (
                    <StatusPill tone="teal">{formatLabel(item.status)}</StatusPill>
                  )}
                </div>
              ))}
              {(thirdParty.data?.findings ?? []).slice(0, 6).map((finding: any) => (
                <div className="ax-opportunity" key={finding.id}>
                  <span className="ax-rank">FD</span>
                  <span>
                    <b>{finding.title}</b>
                    <small>{finding.severity} · {finding.status}</small>
                  </span>
                  {finding.status !== 'closed' && isAdminRole(user?.role) ? (
                    <button
                      className="ax-secondary-button"
                      type="button"
                      onClick={() => void api.closeAuditFinding(finding.id).then(() => queryClient.invalidateQueries({ queryKey: ['third-party-audits'] }))}
                    >
                      Close finding
                    </button>
                  ) : (
                    <StatusPill tone="teal">Closed</StatusPill>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <OpsEmpty text="No audit engagements on file." />
          )}
        </section>
      ) : null}

      {(isAdminRole(user?.role) || user?.role === 'operator') ? (
        <section className="ax-panel">
          <div className="ax-panel-head">
            <div>
              <span className="ax-kicker">Incidents</span>
              <h2>Breach workflow</h2>
            </div>
          </div>
          <p className="ax-panel-copy">HIPAA breach clock is 60 calendar days from discovery.</p>
          <div className="ax-ops-form">
            <label>
              Breach title
              <input value={breachForm.title} onChange={(e) => setBreachForm((f) => ({ ...f, title: e.target.value }))} data-testid="input-breach-title" />
            </label>
            <label>
              Affected individuals
              <input
                type="number"
                value={breachForm.affectedIndividuals}
                onChange={(e) => setBreachForm((f) => ({ ...f, affectedIndividuals: Number(e.target.value) || 0 }))}
                data-testid="input-breach-affected"
              />
            </label>
            <label className="ax-ops-span-2">
              Description
              <input value={breachForm.description} onChange={(e) => setBreachForm((f) => ({ ...f, description: e.target.value }))} data-testid="input-breach-description" />
            </label>
            <div className="ax-ops-span-2 ax-ops-actions">
              <button
                className="ax-primary-button"
                type="button"
                disabled={openBreach.isPending || !breachForm.title || !breachForm.description}
                onClick={() => openBreach.mutate()}
                data-testid="button-open-breach"
              >
                Open breach incident
              </button>
            </div>
          </div>
          {(breaches.data ?? []).length ? (
            <div className="ax-opportunity-list" style={{ marginTop: 14 }}>
              {(breaches.data ?? []).slice(0, 5).map((incident: any) => (
                <div className="ax-opportunity" key={incident.id}>
                  <span className="ax-rank">BR</span>
                  <span>
                    <b>{incident.title}</b>
                    <small>
                      Due {incident.dueAt ? new Date(incident.dueAt).toLocaleDateString() : '—'} · {incident.status} · {incident.affectedIndividuals} individuals
                    </small>
                  </span>
                  <button
                    className="ax-secondary-button"
                    type="button"
                    onClick={() => void api.updateBreach(incident.id, { markCoveredEntityNotified: true })}
                  >
                    Mark CE notified
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <OpsEmpty text="No open breach incidents." />
          )}
        </section>
      ) : null}

      {(isAdminRole(user?.role) || user?.role === 'operator') ? (
        <section className="ax-panel">
          <div className="ax-panel-head">
            <div>
              <span className="ax-kicker">Data lifecycle</span>
              <h2>Retention, evidence & runbooks</h2>
            </div>
          </div>
          <div className="ax-ops-block">
            <h3 className="ax-ops-block-title">Retention policies</h3>
            {(retention.data?.policies ?? []).length ? (
              <div className="ax-opportunity-list">
                {(retention.data?.policies ?? []).map((policy: any) => (
                  <div className="ax-opportunity" key={policy.id}>
                    <span className="ax-rank">RT</span>
                    <span>
                      <b>{policy.resourceType}</b>
                      <small>{policy.retainDays} days · {policy.action}</small>
                    </span>
                    <button className="ax-secondary-button" type="button" onClick={() => runRetention.mutate(policy.id)}>
                      Dry-run
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <OpsEmpty text="No retention policies yet." />
            )}
            <h3 className="ax-ops-block-title">SOC2 / pen-test evidence</h3>
            {(evidence.data?.items ?? []).length ? (
              <div className="ax-opportunity-list">
                {(evidence.data?.items ?? []).slice(0, 8).map((item: any) => (
                  <div className="ax-opportunity" key={item.id}>
                    <span className="ax-rank">{String(item.framework).slice(0, 2)}</span>
                    <span>
                      <b>{item.title}</b>
                      <small>{item.controlId} · {item.status}</small>
                    </span>
                    <button className="ax-secondary-button" type="button" onClick={() => attestEvidence.mutate(item)}>
                      Attest
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <OpsEmpty text="Evidence vault is empty." />
            )}
            <h3 className="ax-ops-block-title">Production runbooks</h3>
            {(runbooks.data?.runbooks ?? []).length ? (
              <div className="ax-opportunity-list">
                {(runbooks.data?.runbooks ?? []).map((book: any) => (
                  <div className="ax-opportunity" key={book.id}>
                    <span className="ax-rank">RB</span>
                    <span>
                      <b>{book.title}</b>
                      <small>{book.cadence} · {book.category}</small>
                    </span>
                    <button className="ax-secondary-button" type="button" onClick={() => executeRunbook.mutate(book.id)}>
                      Execute
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <OpsEmpty text="No runbooks defined." />
            )}
            <div className="ax-ops-actions">
              <button className="ax-secondary-button" type="button" onClick={() => rotateKeys.mutate()} data-testid="button-rotate-keys">
                Record key rotation
              </button>
              <button className="ax-secondary-button" type="button" onClick={() => reencrypt.mutate()} data-testid="button-reencrypt-phi">
                Re-encrypt PHI under current key
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="ax-panel">
        <div className="ax-panel-head">
          <div>
            <span className="ax-kicker">Integrations</span>
            <h2>Message center</h2>
          </div>
          <div className="ax-inline-controls">
            <StatusPill tone={inboxRows.length ? 'amber' : 'neutral'}>{inboxRows.length} messages</StatusPill>
            {onNavigate ? (
              <button className="ax-outline-button" type="button" onClick={() => onNavigate('inbox')}>
                Open inbox
              </button>
            ) : null}
          </div>
        </div>
        {inboxRows.length ? (
          <div className="ax-claims-table">
            <div className="ax-table-head">
              <span>Type</span>
              <span>Direction</span>
              <span>Entity</span>
              <span>Status</span>
              <span>Action</span>
            </div>
            {inboxRows.slice(0, 12).map((row: any) => (
              <div className="ax-claim-row" key={row.id}>
                <span>
                  <b>{formatLabel(row.messageType)}</b>
                  <small>{row.adapterKey || row.integrationId}</small>
                </span>
                <span>{row.direction}</span>
                <span>{row.internalEntityId || '—'}</span>
                <StatusPill tone={row.status === 'ERROR' ? 'coral' : row.status === 'PROCESSED' ? 'teal' : 'amber'}>
                  {formatLabel(row.status)}
                </StatusPill>
                <button
                  className="ax-outline-button"
                  type="button"
                  onClick={() =>
                    api.retryIntegrationMessage(row.id).then(() => void queryClient.invalidateQueries({ queryKey: ['integration-messages'] }))
                  }
                >
                  Retry
                </button>
              </div>
            ))}
          </div>
        ) : (
          <OpsEmpty text="No integration messages. Partner traffic will land here." />
        )}
      </section>

      <section className="ax-panel">
        <div className="ax-panel-head">
          <div>
            <span className="ax-kicker">Audit trail</span>
            <h2>Recent activity</h2>
          </div>
          <button className="ax-text-button" type="button" onClick={() => void audit.refetch()} data-testid="button-view-audit">
            Refresh <ArrowRight size={14} />
          </button>
        </div>
        {events.length ? (
          <div className="ax-audit-list">
            {events.map((event: any) => (
              <div className="ax-audit-row" key={event.id}>
                <span className="ax-audit-time">{event.timestamp ? new Date(event.timestamp).toLocaleString() : '—'}</span>
                <span className="ax-audit-avatar">{(event.actorId ?? 'VL').slice(0, 2).toUpperCase()}</span>
                <span>
                  <b>
                    {event.actorId} <em>{event.action}</em>
                  </b>
                  <small>
                    {event.resourceType} · {event.resourceId}
                    {event.reason ? ` · ${event.reason}` : ''}
                  </small>
                </span>
                <ChevronRight size={14} />
              </div>
            ))}
          </div>
        ) : (
          <OpsEmpty text="No audit events yet. Actions you take will appear here." />
        )}
      </section>

      <div className="ax-security-note">
        <ShieldCheck size={16} />
        <div>
          <b>Governance posture</b>
          <span>Recommendations stay explainable and wait for human approval before a financial record changes.</span>
        </div>
        <StatusPill tone="teal">Controls active</StatusPill>
      </div>
    </div>
  );
}
