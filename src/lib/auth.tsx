import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  api,
  clearAccessToken,
  setAccessToken,
  type AuthTenant,
  type AuthUser,
} from '@/lib/api';
import type { WorkspaceView } from '@/pages/workspace/workspace-types';

export type RoleId = AuthUser['role'];

const ROLE_VIEWS: Record<RoleId, WorkspaceView[]> = {
  admin: [
    'overview', 'queue', 'patients', 'providers', 'payers', 'eligibility', 'authorizations',
    'coding', 'charges', 'claims', 'denials', 'ar', 'payments', 'contracts', 'leakage',
    'ai', 'packs', 'rules', 'settings',
  ],
  operator: [
    'overview', 'queue', 'patients', 'providers', 'payers', 'eligibility', 'authorizations',
    'claims', 'denials', 'ar', 'payments', 'leakage', 'ai', 'settings',
  ],
  coder: [
    'overview', 'queue', 'patients', 'providers', 'coding', 'charges', 'claims', 'authorizations', 'ai',
  ],
  biller: [
    'overview', 'queue', 'patients', 'payers', 'charges', 'claims', 'denials', 'ar', 'payments', 'contracts', 'leakage',
  ],
  viewer: [
    'overview', 'patients', 'providers', 'payers', 'claims', 'denials', 'ar', 'payments', 'leakage', 'packs',
  ],
};

const ROLE_LABELS: Record<RoleId, string> = {
  admin: 'Administrator',
  operator: 'Operator',
  coder: 'Coder',
  biller: 'Biller',
  viewer: 'Viewer',
};

type AuthContextValue = {
  ready: boolean;
  user: AuthUser | null;
  tenant: AuthTenant | null;
  tenants: AuthTenant[];
  roleLabel: string;
  allowedViews: WorkspaceView[];
  sessionTimeoutMinutes: number;
  inactivityWarning: boolean;
  secondsToTimeout: number | null;
  canAccess: (view: WorkspaceView) => boolean;
  login: (email: string, password: string, tenantId?: string) => Promise<void>;
  logout: () => Promise<void>;
  setTenantId: (tenantId: string) => Promise<void>;
  staySignedIn: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tenant, setTenant] = useState<AuthTenant | null>(null);
  const [tenants, setTenants] = useState<AuthTenant[]>([]);
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState(15);
  const [lastActivityAt, setLastActivityAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const touchInFlight = useRef(false);

  const applySession = useCallback((payload: {
    accessToken: string;
    accessExpiresIn: number;
    user: AuthUser;
    tenant: AuthTenant;
    sessionTimeoutMinutes?: number;
  }) => {
    setAccessToken(payload.accessToken, payload.accessExpiresIn);
    setUser(payload.user);
    setTenant(payload.tenant);
    if (payload.sessionTimeoutMinutes) setSessionTimeoutMinutes(payload.sessionTimeoutMinutes);
    setLastActivityAt(Date.now());
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      clearAccessToken();
      setUser(null);
      setTenant(null);
    }
  }, []);

  const markActivity = useCallback(async () => {
    setLastActivityAt(Date.now());
    if (!user || touchInFlight.current) return;
    touchInFlight.current = true;
    try {
      await api.touch();
    } catch {
      // refresh/inactivity handler will catch hard failures
    } finally {
      touchInFlight.current = false;
    }
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [list, policy] = await Promise.all([api.tenants(), api.sessionPolicy()]);
        if (!cancelled) {
          setTenants(list);
          setSessionTimeoutMinutes(policy.sessionTimeoutMinutes);
        }
      } catch {
        if (!cancelled) setTenants([]);
      }

      try {
        const refreshed = await api.refresh();
        if (cancelled) return;
        applySession(refreshed);
      } catch {
        clearAccessToken();
        if (!cancelled) {
          setUser(null);
          setTenant(null);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applySession]);

  // Tick clock while signed in
  useEffect(() => {
    if (!user) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [user]);

  // Activity listeners
  useEffect(() => {
    if (!user) return;
    const events: Array<keyof WindowEventMap> = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
    let throttle: number | null = null;
    const onActivity = () => {
      if (throttle) return;
      throttle = window.setTimeout(() => {
        throttle = null;
        void markActivity();
      }, 5000);
      setLastActivityAt(Date.now());
    };
    for (const event of events) window.addEventListener(event, onActivity, { passive: true });
    return () => {
      for (const event of events) window.removeEventListener(event, onActivity);
      if (throttle) window.clearTimeout(throttle);
    };
  }, [markActivity, user]);

  const timeoutMs = sessionTimeoutMinutes * 60_000;
  const remainingMs = user ? timeoutMs - (now - lastActivityAt) : null;
  const secondsToTimeout = remainingMs == null ? null : Math.max(0, Math.ceil(remainingMs / 1000));
  const inactivityWarning = Boolean(user && secondsToTimeout != null && secondsToTimeout <= 60);

  // Auto logout on inactivity
  useEffect(() => {
    if (!user || secondsToTimeout == null) return;
    if (secondsToTimeout > 0) return;
    void logout();
  }, [logout, secondsToTimeout, user]);

  const value = useMemo<AuthContextValue>(() => {
    const allowedViews = user ? ROLE_VIEWS[user.role] : [];
    return {
      ready,
      user,
      tenant,
      tenants,
      roleLabel: user ? ROLE_LABELS[user.role] : '',
      allowedViews,
      sessionTimeoutMinutes,
      inactivityWarning,
      secondsToTimeout,
      canAccess: (view) => Boolean(user && ROLE_VIEWS[user.role].includes(view)),
      login: async (email, password, tenantId) => {
        const payload = await api.login({ email, password, tenantId });
        applySession(payload);
      },
      logout,
      setTenantId: async (tenantId) => {
        const payload = await api.switchTenant(tenantId);
        applySession(payload);
      },
      staySignedIn: async () => {
        await markActivity();
      },
    };
  }, [
    applySession,
    inactivityWarning,
    logout,
    markActivity,
    ready,
    secondsToTimeout,
    sessionTimeoutMinutes,
    tenant,
    tenants,
    user,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export { ROLE_LABELS };
