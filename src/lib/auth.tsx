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

export function isAdminRole(role?: string | null): boolean {
  return role === 'admin' || role === 'superadmin';
}

const ADMIN_VIEWS: WorkspaceView[] = [
  'overview', 'queue', 'registration', 'patients', 'schedule', 'providers', 'payers', 'eligibility', 'authorizations',
  'encounters', 'coding', 'charges', 'claims', 'denials', 'ar', 'billing', 'payments', 'contracts', 'leakage',
  'ai', 'inbox', 'packs', 'rules', 'settings',
];

const ROLE_VIEWS: Record<RoleId, WorkspaceView[]> = {
  superadmin: ADMIN_VIEWS,
  admin: ADMIN_VIEWS,
  operator: [
    'overview', 'queue', 'registration', 'patients', 'schedule', 'providers', 'payers', 'eligibility', 'authorizations',
    'encounters', 'coding', 'charges', 'claims', 'denials', 'ar', 'billing', 'payments', 'leakage', 'ai', 'inbox', 'settings',
  ],
  coder: [
    'overview', 'queue', 'registration', 'patients', 'schedule', 'providers', 'encounters', 'coding', 'charges', 'claims', 'authorizations', 'ai', 'inbox',
  ],
  biller: [
    'overview', 'queue', 'registration', 'patients', 'schedule', 'payers', 'eligibility', 'encounters', 'charges', 'claims', 'denials', 'ar', 'billing', 'payments', 'contracts', 'leakage', 'inbox',
  ],
  viewer: [
    'overview', 'patients', 'schedule', 'providers', 'payers', 'encounters', 'claims', 'denials', 'ar', 'billing', 'payments', 'leakage', 'packs',
  ],
};

const ROLE_LABELS: Record<RoleId, string> = {
  superadmin: 'Super administrator',
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
  login: (email: string, password: string, tenantId?: string) => Promise<'ok' | 'mfa' | 'mfa-enroll'>;
  completeMfa: (code: string) => Promise<void>;
  completeMfaEnroll: (code: string) => Promise<void>;
  beginForcedMfaEnroll: () => Promise<{ secret: string; otpauthUrl: string; recoveryCodes: string[] }>;
  refreshProfile: () => Promise<void>;
  mfaPending: { mfaToken: string; email: string } | null;
  mfaEnrollPending: { enrollToken: string; email: string } | null;
  seedMfaChallenge: (mfaToken: string, email?: string) => void;
  seedMfaEnroll: (enrollToken: string, email?: string) => void;
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
  const [mfaPending, setMfaPending] = useState<{ mfaToken: string; email: string } | null>(null);
  const [mfaEnrollPending, setMfaEnrollPending] = useState<{ enrollToken: string; email: string } | null>(null);
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
        if ('mfaRequired' in payload && payload.mfaRequired) {
          setMfaPending({ mfaToken: payload.mfaToken, email: payload.user.email });
          setMfaEnrollPending(null);
          return 'mfa';
        }
        if ('mfaEnrollmentRequired' in payload && payload.mfaEnrollmentRequired) {
          setMfaEnrollPending({ enrollToken: payload.enrollToken, email: payload.user.email });
          setMfaPending(null);
          return 'mfa-enroll';
        }
        setMfaPending(null);
        setMfaEnrollPending(null);
        applySession(payload as {
          accessToken: string;
          accessExpiresIn: number;
          user: AuthUser;
          tenant: AuthTenant;
          sessionTimeoutMinutes?: number;
        });
        return 'ok';
      },
      completeMfa: async (code) => {
        if (!mfaPending) throw new Error('No MFA challenge pending');
        const payload = await api.verifyMfa({ mfaToken: mfaPending.mfaToken, code });
        setMfaPending(null);
        applySession(payload);
      },
      beginForcedMfaEnroll: async () => {
        if (!mfaEnrollPending) throw new Error('No MFA enrollment pending');
        const data = await api.beginMfaBootstrap(mfaEnrollPending.enrollToken);
        return {
          secret: data.secret,
          otpauthUrl: data.otpauthUrl,
          recoveryCodes: data.recoveryCodes,
        };
      },
      completeMfaEnroll: async (code) => {
        if (!mfaEnrollPending) throw new Error('No MFA enrollment pending');
        const payload = await api.confirmMfaBootstrap({
          enrollToken: mfaEnrollPending.enrollToken,
          code,
        });
        setMfaEnrollPending(null);
        applySession(payload);
      },
      refreshProfile: async () => {
        const me = await api.me();
        setUser(me.user);
        setTenant(me.tenant);
      },
      mfaPending,
      mfaEnrollPending,
      seedMfaChallenge: (mfaToken, email) => {
        setMfaPending({ mfaToken, email: email ?? 'sso-user' });
        setMfaEnrollPending(null);
      },
      seedMfaEnroll: (enrollToken, email) => {
        setMfaEnrollPending({ enrollToken, email: email ?? 'sso-user' });
        setMfaPending(null);
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
    mfaPending,
    mfaEnrollPending,
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
