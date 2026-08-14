import {
  clearAccessToken,
  getAccessToken,
  setAccessToken,
  accessTokenValid,
} from './token';

const API_BASE = import.meta.env.VITE_API_BASE ?? '/api';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type RequestOptions = RequestInit & { auth?: boolean; retry?: boolean };

let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
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
  const { auth = true, retry = true, headers, ...rest } = init;
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

  const response = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: nextHeaders,
    credentials: 'include',
  });

  if (response.status === 401 && auth && retry) {
    const ok = await refreshAccessToken();
    if (ok) return request<T>(path, { ...init, retry: false });
    clearAccessToken();
    throw new ApiError(401, 'Unauthorized');
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
  role: 'admin' | 'operator' | 'coder' | 'biller' | 'viewer';
  title: string;
  tenantId: string;
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
};

export const api = {
  health: () => request<{ status: string }>('/healthz', { auth: false }),
  login: (body: { email: string; password: string; tenantId?: string }) =>
    request<AuthSessionPayload>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
      auth: false,
    }),
  refresh: () => request<AuthSessionPayload>('/auth/refresh', { method: 'POST', body: '{}', auth: false }),
  logout: () => request<{ ok: boolean }>('/auth/logout', { method: 'POST', body: '{}', auth: false }),
  me: () => request<{ user: AuthUser; tenant: AuthTenant; accessExpiresIn: number }>('/auth/me'),
  tenants: () => request<AuthTenant[]>('/auth/tenants', { auth: false }),
  sessionPolicy: () =>
    request<{
      accessExpiresIn: number;
      refreshExpiresIn: number;
      sessionTimeoutMinutes: number;
      inactivityWarningSeconds: number;
    }>('/auth/session-policy', { auth: false }),
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
  denials: () => request<any[]>('/denials'),
  analyzeDenial: (id: string) => request<any>(`/denials/${id}/analyze`, { method: 'POST', body: '{}' }),
  appealDraft: (id: string) => request<any>(`/denials/${id}/appeal-draft`, { method: 'POST', body: '{}' }),
  leakage: () => request<any>('/intelligence/leakage'),
  recommendations: () => request<any>('/intelligence/recommendations'),
  agents: () => request<any[]>('/ai/agents'),
  aiHealth: () => request<any>('/ai/health'),
  runAgent: (agentId: string, body?: Record<string, string>) =>
    request(`/ai/agents/${agentId}/run`, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  decideAiExecution: (executionId: string, body: { decision: 'ACCEPT' | 'MODIFY' | 'REJECT'; reason?: string }) =>
    request<any>(`/ai/executions/${executionId}/decide`, { method: 'POST', body: JSON.stringify(body) }),
  countryPacks: () => request<any[]>('/country-packs'),
  patients: () => request<any[]>('/patients'),
  patient: (id: string) => request<any>(`/patients/${id}`),
  providers: () => request<any[]>('/providers'),
  payers: () => request<any[]>('/payers'),
  charges: () => request<any[]>('/charges'),
  billCharge: (id: string) => request<any>(`/charges/${id}/bill`, { method: 'POST', body: '{}' }),
  encounters: () => request<any[]>('/encounters'),
  contracts: () => request<any[]>('/contracts'),
  authorizationsRisk: () => request<any>('/authorizations/risk'),
  eligibilityCheck: (coverageId: string) =>
    request('/eligibility/check', { method: 'POST', body: JSON.stringify({ coverageId }) }),
  codingSuggest: (encounterId: string) =>
    request('/coding/suggest', { method: 'POST', body: JSON.stringify({ encounterId }) }),
  codingDecision: (body: {
    encounterId: string;
    decision: 'ACCEPT' | 'MODIFY' | 'REJECT';
    codes?: string[];
    reason?: string;
  }) => request<any>('/coding/decision', { method: 'POST', body: JSON.stringify(body) }),
  arQueue: () => request<any[]>('/ar/queue'),
  payments: () => request<any>('/payments'),
  audit: () => request<any[]>('/audit'),
  rules: () => request<any[]>('/rules'),
  coverages: () => request<any[]>('/coverages'),
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
