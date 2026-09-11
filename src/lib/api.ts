import {
  clearAccessToken,
  getAccessToken,
  setAccessToken,
  accessTokenValid,
} from './token';

function resolveApiBase(raw?: string): string {
  const trimmed = (raw ?? '').trim().replace(/\/+$/, '');
  const fallback = '/api';
  if (!trimmed) return fallback;
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      const pathname = url.pathname.replace(/\/+$/, '') || '/api';
      return `${url.origin}${pathname === '/' ? '/api' : pathname}`;
    } catch {
      return fallback;
    }
  }
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

const API_BASE = resolveApiBase(import.meta.env.VITE_API_BASE);

function apiUrl(path: string): string {
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type RequestOptions = RequestInit & { auth?: boolean; retry?: boolean; timeoutMs?: number };

let refreshPromise: Promise<boolean> | null = null;
const DEFAULT_TIMEOUT_MS = 25_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function refreshAccessToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const response = await fetch(apiUrl('/auth/refresh'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!response.ok) {
        clearAccessToken();
        return false;
      }
      const data = (await response.json()) as {
        accessToken: string;
        accessExpiresIn: number;
      };
      setAccessToken(data.accessToken, data.accessExpiresIn);
      return true;
    } catch {
      clearAccessToken();
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

export async function request<T>(path: string, init: RequestOptions = {}): Promise<T> {
  const { auth = true, retry = true, timeoutMs = DEFAULT_TIMEOUT_MS, headers, ...rest } = init;
  const nextHeaders = new Headers(headers);
  if (!nextHeaders.has('Content-Type') && rest.body) {
    nextHeaders.set('Content-Type', 'application/json');
  }

  if (auth) {
    if (!accessTokenValid()) {
      const ok = await refreshAccessToken();
      if (!ok) throw new ApiError(401, 'Session expired');
    }
    const token = getAccessToken();
    if (token) nextHeaders.set('Authorization', `Bearer ${token}`);
  }

  const method = String(rest.method ?? 'GET').toUpperCase();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (rest.signal) {
    const incoming = rest.signal;
    if (incoming.aborted) controller.abort();
    else incoming.addEventListener('abort', () => controller.abort(), { once: true });
  }

  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      ...rest,
      signal: controller.signal,
      headers: nextHeaders,
      credentials: 'include',
    });
  } catch (error) {
    clearTimeout(timer);
    const retryable = retry && method === 'GET';
    if (retryable) {
      await sleep(400);
      return request<T>(path, { ...init, retry: false });
    }
    throw new ApiError(0, error instanceof Error && error.name === 'AbortError' ? 'Request timed out' : 'Network error');
  }
  clearTimeout(timer);

  if (response.status === 401 && auth && retry) {
    const ok = await refreshAccessToken();
    if (ok) return request<T>(path, { ...init, retry: false });
    clearAccessToken();
    throw new ApiError(401, 'Unauthorized');
  }

  if (!response.ok && retry && method === 'GET' && (response.status === 502 || response.status === 503 || response.status === 504)) {
    await sleep(500);
    return request<T>(path, { ...init, retry: false });
  }

  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(response.status, text || `Request failed: ${response.status}`);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  initials: string;
  role: 'superadmin' | 'admin' | 'operator' | 'coder' | 'biller' | 'viewer';
  title: string;
  tenantId: string;
  mustChangePassword?: boolean;
  mfaEnabled?: boolean;
};

export type AuthTenant = {
  id: string;
  name: string;
  region: string;
  pack: string;
};

export type AuthSessionPayload = {
  accessToken: string;
  accessExpiresIn: number;
  tokenType: 'Bearer';
  user: AuthUser;
  tenant: AuthTenant;
  sessionTimeoutMinutes?: number;
  mustChangePassword?: boolean;
};

export type AuthMfaChallenge = {
  mfaRequired: true;
  mfaToken: string;
  mfaExpiresIn: number;
  user: { id: string; email: string; name: string; mfaEnabled: boolean };
  tenant: AuthTenant;
};

export type AuthMfaEnrollChallenge = {
  mfaEnrollmentRequired: true;
  enrollToken: string;
  enrollExpiresIn: number;
  user: { id: string; email: string; name: string; mfaEnabled: boolean };
  tenant: AuthTenant;
};

export type AuthLoginResult = AuthSessionPayload | AuthMfaChallenge | AuthMfaEnrollChallenge;

export const api = {
  health: () => request<{ status: string }>('/healthz', { auth: false }),
  login: (body: { email: string; password: string; tenantId?: string }) =>
    request<AuthLoginResult>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
      auth: false,
    }),
  verifyMfa: (body: { mfaToken: string; code: string }) =>
    request<AuthSessionPayload>('/auth/mfa/verify', {
      method: 'POST',
      body: JSON.stringify(body),
      auth: false,
    }),
  beginMfaBootstrap: (enrollToken: string) =>
    request<{ secret: string; otpauthUrl: string; recoveryCodes: string[]; expiresIn: number }>(
      '/auth/mfa/enroll-bootstrap',
      { method: 'POST', body: JSON.stringify({ enrollToken }), auth: false },
    ),
  confirmMfaBootstrap: (body: { enrollToken: string; code: string }) =>
    request<AuthSessionPayload>('/auth/mfa/confirm-bootstrap', {
      method: 'POST',
      body: JSON.stringify(body),
      auth: false,
    }),
  ssoProviders: () =>
    request<Array<{ id: string; label: string; configured: boolean }>>('/auth/sso/providers', {
      auth: false,
    }),
  startSso: (body: { provider: string; tenantId?: string }) =>
    request<{ authorizeUrl: string; state: string; provider: string }>('/auth/sso/start', {
      method: 'POST',
      body: JSON.stringify(body),
      auth: false,
    }),
  beginMfaEnroll: () =>
    request<{ secret: string; otpauthUrl: string; recoveryCodes: string[]; expiresIn: number }>(
      '/auth/mfa/enroll',
      { method: 'POST', body: '{}' },
    ),
  confirmMfaEnroll: (code: string) =>
    request<{ ok: boolean; mfaEnabled: boolean }>('/auth/mfa/confirm', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),
  disableMfa: (body: { password: string; code?: string }) =>
    request<{ ok: boolean; mfaEnabled: boolean }>('/auth/mfa/disable', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  acceptBaa: (body?: {
    signerTitle?: string;
    notes?: string;
    status?: 'draft' | 'counsel_review' | 'executed';
    counselFirm?: string;
    counselEmail?: string;
    documentUri?: string;
  }) =>
    request<{ ok: boolean; id: string; documentVersion: string; acceptedAt: string; status?: string }>(
      '/ops/baa/accept',
      {
        method: 'POST',
        body: JSON.stringify(body ?? {}),
      },
    ),
  setTenantMfaRequired: (required: boolean) =>
    request<any>('/ops/tenant/mfa-required', {
      method: 'POST',
      body: JSON.stringify({ required }),
    }),
  setTenantSsoRequired: (required: boolean) =>
    request<any>('/ops/tenant/sso-required', {
      method: 'POST',
      body: JSON.stringify({ required }),
    }),
  listBreaches: () => request<any[]>('/compliance/breaches'),
  openBreach: (body: {
    title: string;
    description: string;
    affectedIndividuals?: number;
    phiTypes?: string[];
    severity?: string;
  }) =>
    request<any>('/compliance/breaches', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateBreach: (id: string, body: Record<string, unknown>) =>
    request<any>(`/compliance/breaches/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  retention: () => request<any>('/compliance/retention'),
  runRetention: (body: { policyId?: string; resourceType?: string; dryRun?: boolean }) =>
    request<any>('/compliance/retention/run', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  complianceEvidence: () => request<any>('/compliance/evidence'),
  upsertEvidence: (body: Record<string, unknown>) =>
    request<any>('/compliance/evidence', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  runbooks: () => request<any>('/compliance/runbooks'),
  runbookExecutions: () => request<any[]>('/compliance/runbooks/executions'),
  executeRunbook: (id: string, body?: { checklist?: Record<string, boolean>; notes?: string }) =>
    request<any>(`/compliance/runbooks/${id}/execute`, {
      method: 'POST',
      body: JSON.stringify(body ?? {}),
    }),
  rotateKeys: (notes?: string) =>
    request<any>('/compliance/keys/rotate', {
      method: 'POST',
      body: JSON.stringify({ notes }),
    }),
  reencryptPhi: () => request<any>('/compliance/keys/reencrypt', { method: 'POST', body: '{}' }),
  programReadiness: () => request<any>('/compliance/program/readiness'),
  hostingVendors: () => request<any>('/compliance/hosting-vendors'),
  upsertHostingVendor: (body: Record<string, unknown>) =>
    request<any>('/compliance/hosting-vendors', { method: 'POST', body: JSON.stringify(body) }),
  executeHostingBaa: (id: string, body?: { documentUri?: string; documentVersion?: string; notes?: string }) =>
    request<any>(`/compliance/hosting-vendors/${id}/execute-baa`, {
      method: 'POST',
      body: JSON.stringify(body ?? {}),
    }),
  training: () => request<any>('/compliance/training'),
  assignTraining: (body: {
    courseId: string;
    userId: string;
    userEmail: string;
    userName: string;
    dueAt?: string;
  }) => request<any>('/compliance/training/assign', { method: 'POST', body: JSON.stringify(body) }),
  assignTrainingAll: (courseId: string) =>
    request<any>('/compliance/training/assign-all', {
      method: 'POST',
      body: JSON.stringify({ courseId }),
    }),
  completeTraining: (body: { assignmentId?: string; courseId: string; scorePercent?: number }) =>
    request<any>('/compliance/training/complete', { method: 'POST', body: JSON.stringify(body) }),
  issueSanction: (body: { userId: string; userEmail: string; reason: string; severity?: string }) =>
    request<any>('/compliance/training/sanctions', { method: 'POST', body: JSON.stringify(body) }),
  thirdPartyAudits: () => request<any>('/compliance/third-party-audits'),
  upsertThirdPartyAudit: (body: Record<string, unknown>) =>
    request<any>('/compliance/third-party-audits', { method: 'POST', body: JSON.stringify(body) }),
  addAuditFinding: (body: { auditId: string; title: string; severity?: string; description?: string }) =>
    request<any>('/compliance/third-party-audits/findings', { method: 'POST', body: JSON.stringify(body) }),
  closeAuditFinding: (id: string, evidenceUri?: string) =>
    request<any>(`/compliance/third-party-audits/findings/${id}/close`, {
      method: 'POST',
      body: JSON.stringify({ evidenceUri }),
    }),
  refresh: () => request<AuthSessionPayload>('/auth/refresh', { method: 'POST', body: '{}', auth: false }),
  logout: () => request<{ ok: boolean }>('/auth/logout', { method: 'POST', body: '{}', auth: false }),
  me: () => request<{ user: AuthUser; tenant: AuthTenant; accessExpiresIn: number }>('/auth/me'),
  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    request<{ ok: boolean }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  tenants: () => request<AuthTenant[]>('/auth/tenants', { auth: false }),
  sessionPolicy: () =>
    request<{
      accessExpiresIn: number;
      refreshExpiresIn: number;
      sessionTimeoutMinutes: number;
      inactivityWarningSeconds: number;
      enterpriseMode?: boolean;
      demoMode?: boolean;
      passwordPolicy?: {
        minLength: number;
        requireUpper: boolean;
        requireLower: boolean;
        requireNumber: boolean;
        requireSpecial: boolean;
      };
    }>('/auth/session-policy', { auth: false }),
  listUsers: () => request<AuthUser[]>('/auth/users'),
  createUser: (body: {
    email: string;
    name: string;
    role: AuthUser['role'];
    title?: string;
    tenantId?: string;
    password?: string;
    temporaryPassword?: string;
  }) =>
    request<{ user: AuthUser; temporaryPassword?: string }>('/auth/users', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateUser: (id: string, body: {
    email?: string;
    name?: string;
    role?: AuthUser['role'];
    title?: string;
    password?: string;
  }) =>
    request<{ user: AuthUser }>(`/auth/users/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteUser: (id: string) =>
    request<{ ok: boolean }>(`/auth/users/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  readiness: () => request<any>('/readyz', { auth: false }),
  onboarding: () => request<any>('/ops/onboarding'),
  baaTemplate: () => request<any>('/ops/baa'),
  slaPolicy: () => request<any>('/ops/sla'),
  touch: () => request<{ ok: boolean; sessionTimeoutMinutes: number }>('/auth/touch', { method: 'POST', body: '{}', auth: false }),
  forgotPassword: (email: string) =>
    request<{ ok: boolean }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
      auth: false,
    }),
  signupRequest: (body: { name: string; email: string; organization: string; role: string }) =>
    request<{ ok: boolean }>('/auth/signup-request', {
      method: 'POST',
      body: JSON.stringify(body),
      auth: false,
    }),
  contactAdmin: (body: { name: string; email: string; topic: string; message: string }) =>
    request<{ ok: boolean }>('/auth/contact-admin', {
      method: 'POST',
      body: JSON.stringify(body),
      auth: false,
    }),
  switchTenant: (tenantId: string) =>
    request<AuthSessionPayload>('/auth/switch-tenant', {
      method: 'POST',
      body: JSON.stringify({ tenantId }),
    }),
  tenant: () => request<any>('/tenant'),
  commandCenter: () => request<any>('/dashboard/command-center'),
  todayBoard: (date?: string) =>
    request<any>(date ? `/dashboard/today?date=${encodeURIComponent(date)}` : '/dashboard/today'),
  roleHome: () => request<any>('/dashboard/home'),
  revenueMap: () => request<any>('/dashboard/revenue-map'),
  sla: () => request<any>('/dashboard/sla'),
  workItems: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : '';
    return request<any[]>(`/workflow/work-items${qs}`);
  },
  updateWorkItem: (id: string, body: Record<string, string>) =>
    request(`/workflow/work-items/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  claims: () => request<any[]>('/claims'),
  claim: (id: string) => request<any>(`/claims/${id}`),
  scrubClaim: (id: string) => request<any>(`/claims/${id}/scrub`, { method: 'POST', body: '{}' }),
  submitClaim: (id: string) => request<any>(`/claims/${id}/submit`, { method: 'POST', body: '{}' }),
  freezeClaim: (id: string) => request<any>(`/claims/${id}/freeze`, { method: 'POST', body: '{}' }),
  claimVersions: (id: string) => request<any>(`/claims/${id}/versions`),
  gatewayAdapters: () => request<any>('/gateway/adapters'),
  gatewaySubmissions: (claimId?: string) =>
    request<any[]>(claimId ? `/gateway/submissions?claimId=${encodeURIComponent(claimId)}` : '/gateway/submissions'),
  ingestAcknowledgement: (body: {
    submissionId?: string;
    claimId?: string;
    outcome?: 'ACCEPTED' | 'REJECTED';
    ackCode?: string;
    ackMessage?: string;
  }) => request<any>('/gateway/acknowledgements', { method: 'POST', body: JSON.stringify(body) }),
  denials: () => request<any[]>('/denials'),
  analyzeDenial: (id: string) => request<any>(`/denials/${id}/analyze`, { method: 'POST', body: '{}' }),
  promoteDenialPrevention: (id: string) =>
    request<any>(`/denials/${id}/prevent`, { method: 'POST', body: '{}' }),
  denialKnowledge: () => request<any[]>('/denials/knowledge'),
  appealDraft: (id: string) => request<any>(`/denials/${id}/appeal-draft`, { method: 'POST', body: '{}' }),
  leakage: () => request<any>('/intelligence/leakage'),
  recommendations: () => request<any>('/intelligence/recommendations'),
  refreshSignals: () =>
    request<any>('/intelligence/refresh', { method: 'POST', body: '{}', timeoutMs: 12_000 }),
  agents: () => request<any[]>('/ai/agents'),
  aiFloor: () => request<any>('/ai/floor', { timeoutMs: 8_000 }),
  aiAllowlist: () => request<any>('/ai/allowlist'),
  aiHealth: () => request<any>('/ai/health', { timeoutMs: 8_000 }),
  aiCopilot: () => request<any>('/ai/copilot', { timeoutMs: 8_000 }),
  runAgent: (agentId: string, body?: Record<string, string>) =>
    request<any>(`/ai/agents/${agentId}/run`, { method: 'POST', body: JSON.stringify(body ?? {}), timeoutMs: 12_000 }),
  decideAiExecution: (executionId: string, body: { decision: 'ACCEPT' | 'MODIFY' | 'REJECT'; reason?: string }) =>
    request<any>(`/ai/executions/${executionId}/decide`, { method: 'POST', body: JSON.stringify(body) }),
  countryPacks: () => request<any[]>('/country-packs'),
  countryPack: (code: string) => request<any>(`/country-packs/${encodeURIComponent(code)}`),
  transitionPackInterface: (code: string, name: string, action: 'advance' | 'degrade' | 'retire' | 'restore') =>
    request<any>(`/country-packs/${encodeURIComponent(code)}/interfaces/${encodeURIComponent(name)}/transition`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    }),
  patients: () => request<any[]>('/patients'),
  searchPatients: (body: Record<string, string>) =>
    request<any>('/patients/search', { method: 'POST', body: JSON.stringify(body) }),
  patient: (id: string) => request<any>(`/patients/${id}`),
  createPatient: (body: Record<string, unknown>) =>
    request<any>('/patients', { method: 'POST', body: JSON.stringify(body) }),
  updatePatient: (id: string, body: Record<string, unknown>) =>
    request<any>(`/patients/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  finalizePatient: (id: string) => request<any>(`/patients/${id}/finalize`, { method: 'POST', body: '{}' }),
  patientDuplicates: (body: Record<string, string>) =>
    request<any>('/patients/duplicates', { method: 'POST', body: JSON.stringify(body) }),
  fieldDefinitions: (screen = 'add_patient', country?: string) =>
    request<any>(`/field-definitions?screen=${encodeURIComponent(screen)}${country ? `&country=${country}` : ''}`),
  legalEntities: () => request<any[]>('/legal-entities'),
  providers: () => request<any[]>('/providers'),
  createProvider: (body: Record<string, unknown>) =>
    request<any>('/providers', { method: 'POST', body: JSON.stringify(body) }),
  payers: () => request<any[]>('/payers'),
  createPayer: (body: Record<string, unknown>) =>
    request<any>('/payers', { method: 'POST', body: JSON.stringify(body) }),
  payer: (id: string) => request<any>(`/payers/${id}`),
  activatePayer: (id: string) => request<any>(`/payers/${id}/activate`, { method: 'POST', body: '{}' }),
  suspendPayer: (id: string) => request<any>(`/payers/${id}/suspend`, { method: 'POST', body: '{}' }),
  addPayerIdentifier: (id: string, body: Record<string, string>) =>
    request<any>(`/payers/${id}/identifiers`, { method: 'POST', body: JSON.stringify(body) }),
  createPayerPlan: (payerId: string, body: Record<string, unknown>) =>
    request<any>(`/payers/${payerId}/plans`, { method: 'POST', body: JSON.stringify(body) }),
  publishPayerPlan: (planId: string) =>
    request<any>(`/payer-plans/${planId}/publish`, { method: 'POST', body: '{}' }),
  coverageResolution: (patientId: string, serviceDate?: string) =>
    request<any>(
      `/coverage-resolution?patientId=${encodeURIComponent(patientId)}${serviceDate ? `&serviceDate=${serviceDate}` : ''}`,
    ),
  verifyCoverage: (id: string) => request<any>(`/coverages/${id}/verify`, { method: 'POST', body: '{}' }),
  submitAuthorization: (id: string) => request<any>(`/authorizations/${id}/submit`, { method: 'POST', body: '{}' }),
  approveAuthorization: (id: string, body?: Record<string, unknown>) =>
    request<any>(`/authorizations/${id}/approve`, { method: 'POST', body: JSON.stringify(body ?? { unitsApproved: 1 }) }),
  denyAuthorization: (id: string, body?: Record<string, unknown>) =>
    request<any>(`/authorizations/${id}/deny`, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  facilities: () => request<any[]>('/facilities'),
  organizations: () => request<any[]>('/organizations'),
  createOrganization: (body: { name: string; type?: string }) =>
    request<any>('/organizations', { method: 'POST', body: JSON.stringify(body) }),
  createFacility: (body: { name: string; organizationId: string; country?: string }) =>
    request<any>('/facilities', { method: 'POST', body: JSON.stringify(body) }),
  updateOrganization: (id: string, body: { name?: string; type?: string }) =>
    request<any>(`/organizations/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteOrganization: (id: string) =>
    request<any>(`/organizations/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  updateFacility: (id: string, body: { name?: string; organizationId?: string; country?: string }) =>
    request<any>(`/facilities/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteFacility: (id: string) =>
    request<any>(`/facilities/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  charges: () => request<any[]>('/charges'),
  createCharge: (body: Record<string, unknown>) =>
    request<any>('/charges', { method: 'POST', body: JSON.stringify(body) }),
  billCharge: (id: string) => request<any>(`/charges/${id}/bill`, { method: 'POST', body: '{}' }),
  encounters: () => request<any[]>('/encounters'),
  clinicalEncounters: () => request<any[]>('/clinical/encounters'),
  createEncounter: (body: Record<string, unknown>) =>
    request<any>('/encounters', { method: 'POST', body: JSON.stringify(body) }),
  completeDocumentation: (id: string, body?: Record<string, unknown>) =>
    request<any>(`/encounters/${id}/complete-documentation`, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  appointmentTypes: () => request<any[]>('/appointment-types'),
  providerSchedules: (providerId?: string) =>
    request<any[]>(providerId ? `/provider-schedules?providerId=${encodeURIComponent(providerId)}` : '/provider-schedules'),
  appointments: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : '';
    return request<any[]>(`/appointments${qs}`);
  },
  appointment: (id: string) => request<any>(`/appointments/${id}`),
  scheduleAvailability: (body: { providerId: string; date: string; appointmentTypeId?: string; durationMinutes?: number }) =>
    request<any>('/schedule/availability', { method: 'POST', body: JSON.stringify(body) }),
  createAppointment: (body: Record<string, unknown>) =>
    request<any>('/appointments', { method: 'POST', body: JSON.stringify(body) }),
  transitionAppointment: (id: string, status: string, reason?: string) =>
    request<any>(`/appointments/${id}/transition`, { method: 'POST', body: JSON.stringify({ status, reason }) }),
  checkInAppointment: (id: string) =>
    request<any>(`/appointments/${id}/check-in`, { method: 'POST', body: '{}' }),
  feeSchedules: () => request<any[]>('/fee-schedules'),
  integrationMessages: () => request<any[]>('/integration-messages'),
  manualVerifyCoverage: (id: string, body: Record<string, unknown>) =>
    request<any>(`/coverages/${id}/manual-verify`, { method: 'POST', body: JSON.stringify(body) }),
  reconcileEncounter: (id: string) =>
    request<any>(`/encounters/${id}/reconcile`, { method: 'POST', body: '{}' }),
  assembleClaim: (id: string) =>
    request<any>(`/encounters/${id}/assemble-claim`, { method: 'POST', body: '{}' }),
  registerVisit: (body: Record<string, unknown>) =>
    request<any>('/registration/visit', { method: 'POST', body: JSON.stringify(body) }),
  contracts: () => request<any[]>('/contracts'),
  authorizationsRisk: () => request<any>('/authorizations/risk'),
  authorizations: () => request<any[]>('/authorizations'),
  evaluateAuthorization: (body: {
    patientId: string;
    procedureCode: string;
    diagnosisCode?: string;
    payerId?: string;
  }) => request<any>('/authorizations/evaluate', { method: 'POST', body: JSON.stringify(body) }),
  createEstimate: (body: { coverageId: string; chargedAmount: number }) =>
    request<any>('/estimates', { method: 'POST', body: JSON.stringify(body) }),
  eligibilityCheck: (coverageId: string) =>
    request('/eligibility/check', { method: 'POST', body: JSON.stringify({ coverageId }) }),
  codingSystems: () => request<any>('/coding/systems'),
  searchCodes: (q?: string, system?: string) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (system) params.set('system', system);
    const qs = params.toString();
    return request<any>(`/coding/codes${qs ? `?${qs}` : ''}`);
  },
  codingSuggest: (encounterId: string) =>
    request('/coding/suggest', { method: 'POST', body: JSON.stringify({ encounterId }) }),
  codingDecision: (body: {
    encounterId: string;
    decision: 'ACCEPT' | 'MODIFY' | 'REJECT';
    codes?: string[];
    modifiers?: string[];
    procedureModifiers?: Record<string, string[]>;
    reason?: string;
  }) => request<any>('/coding/decision', { method: 'POST', body: JSON.stringify(body) }),
  captureCharges: (encounterId: string) =>
    request<any>(`/encounters/${encounterId}/capture-charges`, { method: 'POST', body: '{}' }),
  inquireClaimStatus: (id: string) =>
    request<any>(`/claims/${id}/status-inquiry`, { method: 'POST', body: '{}' }),
  adjudicateClaim: (id: string) =>
    request<any>(`/claims/${id}/adjudicate`, { method: 'POST', body: '{}' }),
  transitionDenial: (id: string, status: string, note?: string) =>
    request<any>(`/denials/${id}/transition`, { method: 'POST', body: JSON.stringify({ status, note }) }),
  followUps: (entityId?: string) =>
    request<any[]>(entityId ? `/follow-ups?entityId=${encodeURIComponent(entityId)}` : '/follow-ups'),
  addFollowUp: (body: Record<string, unknown>) =>
    request<any>('/follow-ups', { method: 'POST', body: JSON.stringify(body) }),
  patientBilling: () => request<any[]>('/patient-billing'),
  upsertProviderSchedule: (body: Record<string, unknown>) =>
    request<any>('/provider-schedules', { method: 'POST', body: JSON.stringify(body) }),
  deleteProviderSchedule: (id: string) =>
    request<any>(`/provider-schedules/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  addProviderTimeOff: (body: Record<string, unknown>) =>
    request<any>('/provider-time-off', { method: 'POST', body: JSON.stringify(body) }),
  retryIntegrationMessage: (id: string) =>
    request<any>(`/integration-messages/${id}/retry`, { method: 'POST', body: '{}' }),
  arQueue: () => request<any[]>('/ar/queue'),
  payments: () => request<any>('/payments'),
  refundPayment: (id: string, amount?: number) =>
    request<any>(`/payments/${id}/refund`, { method: 'POST', body: JSON.stringify(amount != null ? { amount } : {}) }),
  recoupPayment: (id: string, amount?: number) =>
    request<any>(`/payments/${id}/recoup`, { method: 'POST', body: JSON.stringify(amount != null ? { amount } : {}) }),
  reconcileBank: (id: string) =>
    request<any>(`/era/${id}/reconcile-bank`, { method: 'POST', body: '{}' }),
  patientStatement: (id: string) => request<any>(`/patients/${id}/statement`),
  recordPatientPayment: (id: string, amount: number) =>
    request<any>(`/patients/${id}/patient-payment`, { method: 'POST', body: JSON.stringify({ amount }) }),
  contractCheckPayment: (paymentId: string) =>
    request<any>(`/payments/${paymentId}/contract-check`, { method: 'POST', body: '{}' }),
  eraRemittances: () => request<any[]>('/era/remittances'),
  eraIngest: (body: Record<string, unknown>) =>
    request<any>('/era/ingest', { method: 'POST', body: JSON.stringify(body) }),
  eraDemo: (claimId?: string) =>
    request<any>(claimId ? `/era/demo/${encodeURIComponent(claimId)}` : '/era/demo', {
      method: 'POST',
      body: '{}',
    }),
  openDemoDenial: (claimId?: string) =>
    request<any>('/denials/demo', { method: 'POST', body: JSON.stringify(claimId ? { claimId } : {}) }),
  providerTimeOff: (providerId?: string) =>
    request<any[]>(
      providerId ? `/provider-time-off?providerId=${encodeURIComponent(providerId)}` : '/provider-time-off',
    ),
  audit: () => request<any[]>('/audit'),
  rules: () => request<any[]>('/rules'),
  coverages: () => request<any[]>('/coverages'),
  createCoverage: (body: Record<string, unknown>) =>
    request<any>('/coverages', { method: 'POST', body: JSON.stringify(body) }),
};

export function money(value: { amount: number; currency?: string } | number, currency = 'USD') {
  if (typeof value === 'number') {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: value.currency ?? currency,
    maximumFractionDigits: 0,
  }).format(value.amount);
}

export function asPercent(value?: number) {
  if (value == null || Number.isNaN(value)) return 0;
  return value <= 1 ? Math.round(value * 100) : Math.round(value);
}

export { refreshAccessToken, setAccessToken, clearAccessToken, getAccessToken };
