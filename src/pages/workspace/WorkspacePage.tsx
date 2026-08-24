import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  Check,
  ChevronDown,
  ChevronRight,
  KeyRound,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  RefreshCw,
  Settings,
  Sun,
  X,
} from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { api, money } from '@/lib/api';
import { useAuth, isAdminRole } from '@/lib/auth';
import { useAiCopilot } from '@/lib/ai-copilot';
import type { WorkspaceView } from './workspace-types';
import { formatLabel } from './shared/format';
import { navGroups, navItemById } from './shared/nav';
import { BrandLockup } from './shared/ui';
import { Overview } from './screens/overview/Overview';
import { RoleHome } from './screens/overview/RoleHome';
import { WorkQueue } from './screens/queue/WorkQueue';
import { RegistrationDesk } from './screens/registration/RegistrationDesk';
import { Patients } from './screens/patients/Patients';
import { ScheduleBoard } from './screens/schedule/ScheduleBoard';
import { Providers } from './screens/providers/Providers';
import { Payers } from './screens/payers/Payers';
import { Eligibility } from './screens/eligibility/Eligibility';
import { Authorizations } from './screens/authorizations/Authorizations';
import { EncountersBoard } from './screens/encounters/EncountersBoard';
import { Coding } from './screens/coding/Coding';
import { Charges } from './screens/charges/Charges';
import { Claims } from './screens/claims/Claims';
import { Denials } from './screens/denials/Denials';
import { ArQueue } from './screens/ar/ArQueue';
import { Payments } from './screens/payments/Payments';
import { Contracts } from './screens/contracts/Contracts';
import { Leakage } from './screens/leakage/Leakage';
import { Workforce } from './screens/ai/Workforce';
import { CountryPacks } from './screens/packs/CountryPacks';
import { Rules } from './screens/rules/Rules';
import { Operations } from './screens/settings/Operations';
import './WorkspacePage.css';

const THEME_KEY = 'velora-theme';

type AppTheme = 'light' | 'dark';

function readStoredTheme(): AppTheme {
  if (typeof window === 'undefined') return 'light';
  return window.localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
}

function applyTheme(theme: AppTheme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  window.localStorage.setItem(THEME_KEY, theme);
}

function renderView(view: WorkspaceView, setView: (view: WorkspaceView) => void) {
  switch (view) {
    case 'overview':
      return (
        <>
          <Overview onNavigate={setView} />
          <RoleHome onNavigate={setView} />
        </>
      );
    case 'queue':
      return <WorkQueue />;
    case 'registration':
      return <RegistrationDesk />;
    case 'patients':
      return <Patients />;
    case 'schedule':
      return <ScheduleBoard />;
    case 'providers':
      return <Providers />;
    case 'payers':
      return <Payers />;
    case 'eligibility':
      return <Eligibility />;
    case 'authorizations':
      return <Authorizations />;
    case 'encounters':
      return <EncountersBoard />;
    case 'coding':
      return <Coding />;
    case 'charges':
      return <Charges />;
    case 'claims':
      return <Claims />;
    case 'denials':
      return <Denials />;
    case 'ar':
      return <ArQueue />;
    case 'payments':
      return <Payments />;
    case 'contracts':
      return <Contracts />;
    case 'leakage':
      return <Leakage />;
    case 'ai':
      return <Workforce />;
    case 'packs':
      return <CountryPacks />;
    case 'rules':
      return <Rules />;
    case 'settings':
      return <Operations />;
    default:
      return <Overview onNavigate={setView} />;
  }
}

export default function WorkspacePage() {
  const {
    ready,
    user,
    tenant,
    tenants,
    roleLabel,
    canAccess,
    setTenantId,
    logout,
    inactivityWarning,
    secondsToTimeout,
    staySignedIn,
    sessionTimeoutMinutes,
  } = useAuth();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [view, setView] = useState<WorkspaceView>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ today: true });
  const [tenantOpen, setTenantOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [theme, setTheme] = useState<AppTheme>(() => readStoredTheme());
  const [busy, setBusy] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);
  const tenantRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const visibleGroups = useMemo(
    () =>
      navGroups
        .map((group) => ({
          ...group,
          items: group.itemIds.map((id) => navItemById(id)!).filter((item) => item && canAccess(item.id)),
        }))
        .filter((group) => group.items.length > 0),
    [canAccess],
  );
  const visibleNav = useMemo(() => visibleGroups.flatMap((group) => group.items), [visibleGroups]);

  const workItemsQuery = useQuery({
    queryKey: ['work-items', 'header-notifications'],
    queryFn: () => api.workItems(),
    enabled: Boolean(user),
    refetchInterval: 20_000,
  });
  const recommendationsQuery = useQuery({
    queryKey: ['recommendations', 'header-notifications'],
    queryFn: api.recommendations,
    enabled: Boolean(user),
    refetchInterval: 25_000,
  });
  const copilotQuery = useAiCopilot(Boolean(user));

  const notifications = useMemo(() => {
    const items = (workItemsQuery.data ?? [])
      .filter((item: any) => item.status !== 'COMPLETED' && (item.priority === 'HIGH' || item.status === 'BLOCKED'))
      .slice(0, 6)
      .map((item: any) => ({
        id: `wi-${item.id}`,
        title: item.title,
        detail: `${item.id} · ${formatLabel(item.priority)} · ${money(item.valueAtRisk ?? 0)}`,
        view: 'queue' as WorkspaceView,
      }));
    for (const suggestion of (copilotQuery.data?.suggestions ?? []).slice(0, 3)) {
      items.unshift({
        id: `ai-${suggestion.id}`,
        title: suggestion.headline,
        detail: suggestion.nextAction || suggestion.summary,
        view: 'ai' as WorkspaceView,
      });
    }
    const signal = recommendationsQuery.data?.summary?.[0];
    if (signal) {
      items.unshift({
        id: 'signal-primary',
        title: 'Velora signal',
        detail: signal,
        view: 'leakage' as WorkspaceView,
      });
    }
    return items.slice(0, 8);
  }, [workItemsQuery.data, recommendationsQuery.data, copilotQuery.data]);

  const unreadCount = notifications.filter((n) => !readNotificationIds.includes(n.id)).length;

  const changePassword = useMutation({
    mutationFn: () =>
      api.changePassword({
        currentPassword: passwordForm.current,
        newPassword: passwordForm.next,
      }),
    onSuccess: () => {
      setPasswordSuccess('Password updated successfully.');
      setPasswordError('');
      setPasswordForm({ current: '', next: '', confirm: '' });
    },
    onError: (error: Error) => {
      setPasswordError(error.message || 'Unable to change password.');
      setPasswordSuccess('');
    },
  });

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (user?.mustChangePassword) {
      setPasswordOpen(true);
      setPasswordError('Your administrator requires a password change before continuing.');
    }
  }, [user?.mustChangePassword]);

  useEffect(() => {
    if (ready && !user) setLocation('/login');
  }, [ready, user, setLocation]);

  useEffect(() => {
    if (!canAccess(view) && visibleNav[0]) setView(visibleNav[0].id);
  }, [canAccess, view, visibleNav]);

  useEffect(() => {
    const activeGroup = visibleGroups.find((group) => group.items.some((item) => item.id === view));
    if (activeGroup) {
      setOpenGroups((current) => ({ ...current, [activeGroup.id]: true }));
    }
  }, [view, visibleGroups]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (tenantRef.current && !tenantRef.current.contains(target)) setTenantOpen(false);
      if (profileRef.current && !profileRef.current.contains(target)) setProfileOpen(false);
      if (notifRef.current && !notifRef.current.contains(target)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  if (!ready) {
    return (
      <main className="axiom-workspace ax-boot">
        <div className="ax-boot-card">
          <RefreshCw size={18} className="ax-spin" />
          Validating secure session…
        </div>
      </main>
    );
  }

  if (!user || !tenant) return null;

  const submitPassword = (event: FormEvent) => {
    event.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');
    if (passwordForm.next.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }
    if (passwordForm.next !== passwordForm.confirm) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }
    changePassword.mutate();
  };

  const currentPage = visibleNav.find((item) => item.id === view);
  const currentGroup = visibleGroups.find((group) => group.items.some((item) => item.id === view));

  return (
    <main className="axiom-workspace">
      {inactivityWarning ? (
        <div className="ax-session-banner" role="alertdialog" aria-live="assertive">
          <div>
            <b>Session expiring</b>
            <span>
              No activity for almost {sessionTimeoutMinutes} minutes. You will be signed out in{' '}
              {secondsToTimeout ?? 0}s.
            </span>
          </div>
          <button type="button" onClick={() => void staySignedIn()} data-testid="button-stay-signed-in">
            Stay signed in
          </button>
        </div>
      ) : null}

      <header className="ax-topbar">
        <button className="ax-menu-trigger" type="button" aria-label="Open navigation" onClick={() => setSidebarOpen(true)} data-testid="button-open-sidebar">
          <Menu size={18} />
        </button>
        <Link href="/" className="ax-brand-link" data-testid="link-workspace-brand">
          <BrandLockup />
        </Link>
        <div className={`ax-clinic-switcher ${tenantOpen ? 'open' : ''}`} ref={tenantRef}>
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={tenantOpen}
            disabled={busy}
            onClick={() => {
              setTenantOpen((open) => !open);
              setProfileOpen(false);
            }}
            data-testid="button-workspace-switcher"
          >
            <span>
              <small>Clinic</small>
              <b>{tenant.name}</b>
            </span>
            <ChevronDown size={14} />
          </button>
          {tenantOpen ? (
            <div className="ax-dropdown" role="listbox" aria-label="Select clinic">
              {(isAdminRole(user.role) ? tenants : tenants.filter((t) => t.id === tenant.id)).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={item.id === tenant.id}
                  className={item.id === tenant.id ? 'selected' : ''}
                  disabled={!isAdminRole(user.role) || busy}
                  onClick={async () => {
                    if (!isAdminRole(user.role)) return;
                    if (item.id === tenant.id) {
                      setTenantOpen(false);
                      return;
                    }
                    setBusy(true);
                    try {
                      await setTenantId(item.id);
                      queryClient.clear();
                      setView('overview');
                      setTenantOpen(false);
                    } catch {
                      setTenantOpen(false);
                    } finally {
                      setBusy(false);
                    }
                  }}
                  data-testid={`button-tenant-${item.id}`}
                >
                  <span>
                    <b>{item.name}</b>
                    <small>
                      {item.region} · {item.pack}
                      {!isAdminRole(user.role) ? ' · locked to your clinic' : ''}
                    </small>
                  </span>
                  {item.id === tenant.id ? <Check size={14} /> : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="ax-breadcrumb">
          <span>{currentGroup?.label ?? 'Desk'}</span>
          <ChevronRight size={13} />
          <b>{currentPage?.label ?? 'Home'}</b>
        </div>
        <div className="ax-topbar-actions">
          <span className="ax-status-online">
            <i /> Live
          </span>
            <div className={`ax-topbar-menu ${notifOpen ? 'open' : ''}`} ref={notifRef}>
              <button
                className="ax-icon-button"
                type="button"
                aria-label="Notifications"
                aria-expanded={notifOpen}
                onClick={() => {
                  setNotifOpen((open) => !open);
                  setProfileOpen(false);
                }}
                data-testid="button-notifications"
              >
                <Bell size={17} />
                {unreadCount > 0 ? <i className="ax-notification-dot" /> : null}
              </button>
              {notifOpen ? (
                <div className="ax-popover" role="menu" aria-label="Notifications">
                  <div className="ax-popover-head">
                    <div>
                      <b>Notifications</b>
                      <small>{unreadCount} unread</small>
                    </div>
                    <button
                      type="button"
                      className="ax-text-button"
                      onClick={() => setReadNotificationIds(notifications.map((n) => n.id))}
                      data-testid="button-mark-notifications-read"
                    >
                      Mark all read
                    </button>
                  </div>
                  {notifications.length === 0 ? (
                    <div className="ax-popover-empty">No active alerts.</div>
                  ) : (
                    notifications.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        role="menuitem"
                        className={readNotificationIds.includes(item.id) ? 'read' : ''}
                        onClick={() => {
                          setReadNotificationIds((ids) => (ids.includes(item.id) ? ids : [...ids, item.id]));
                          setView(item.view);
                          setNotifOpen(false);
                        }}
                        data-testid={`button-notification-${item.id}`}
                      >
                        <span>
                          <b>{item.title}</b>
                          <small>{item.detail}</small>
                        </span>
                        {!readNotificationIds.includes(item.id) ? <i className="ax-unread-dot" /> : null}
                      </button>
                    ))
                  )}
                </div>
              ) : null}
            </div>
            <div className={`ax-topbar-menu ${profileOpen ? 'open' : ''}`} ref={profileRef}>
              <button
                type="button"
                className="ax-topbar-avatar"
                aria-label="Profile menu"
                aria-haspopup="menu"
                aria-expanded={profileOpen}
                onClick={() => {
                  setProfileOpen((open) => !open);
                  setNotifOpen(false);
                }}
                data-testid="button-profile-menu"
              >
                {user.initials}
              </button>
              {profileOpen ? (
                <div className="ax-popover ax-popover-profile" role="menu" aria-label="Profile">
                  <div className="ax-popover-static">
                    <b>{user.name}</b>
                    <small>
                      {roleLabel} · {user.email}
                    </small>
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setView('settings');
                      setProfileOpen(false);
                    }}
                    data-testid="button-profile-settings"
                  >
                    <Settings size={14} /> Settings
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
                    }}
                    data-testid="button-toggle-theme"
                  >
                    {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                    {theme === 'dark' ? 'Light mode' : 'Dark mode'}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setPasswordOpen(true);
                      setProfileOpen(false);
                      setPasswordError('');
                      setPasswordSuccess('');
                    }}
                    data-testid="button-change-password"
                  >
                    <KeyRound size={14} /> Change password
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="ax-dropdown-danger"
                    onClick={async () => {
                      await logout();
                      setLocation('/login');
                    }}
                    data-testid="button-logout"
                  >
                    <LogOut size={14} /> Sign out
                  </button>
                </div>
              ) : null}
            </div>
          </div>
      </header>

      <aside className={`ax-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="ax-sidebar-top">
          <span className="ax-sidebar-title">Menu</span>
          <button className="ax-sidebar-close" type="button" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} data-testid="button-close-sidebar">
            <PanelLeftClose size={16} />
          </button>
        </div>
        <nav className="ax-sidebar-nav" aria-label="Workspace navigation">
          {visibleGroups.map((group) => {
            const expanded = openGroups[group.id] !== false;
            return (
              <div className="ax-nav-group" key={group.id}>
                <button
                  type="button"
                  className="ax-nav-group-toggle"
                  aria-expanded={expanded}
                  onClick={() => setOpenGroups((current) => ({ ...current, [group.id]: !expanded }))}
                >
                  <span>{group.label}</span>
                  <ChevronDown size={13} className={expanded ? 'open' : ''} />
                </button>
                {expanded
                  ? group.items.map(({ id, label, icon: Icon }) => (
                      <button
                        type="button"
                        className={`ax-sidebar-item ${view === id ? 'active' : ''}`}
                        key={id}
                        onClick={() => {
                          setView(id);
                          setSidebarOpen(false);
                        }}
                        data-testid={`button-nav-${id}`}
                      >
                        <Icon size={15} />
                        <span>{label}</span>
                      </button>
                    ))
                  : null}
              </div>
            );
          })}
        </nav>
      </aside>

      <div className="ax-main">
        {renderView(view, setView)}
        <footer className="ax-footer">
          <span className="ax-footer-brand">Velora Desk · money that can be explained.</span>
          <span className="ax-footer-meta">
            {tenant.name} · <b>{roleLabel}</b>
          </span>
        </footer>
      </div>

      {passwordOpen ? (
        <div className="ax-modal-backdrop" role="presentation" onClick={() => setPasswordOpen(false)}>
          <div
            className="ax-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ax-password-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="ax-modal-head">
              <div>
                <span className="ax-kicker">Account security</span>
                <h2 id="ax-password-title">Change password</h2>
              </div>
              <button className="ax-icon-button" type="button" aria-label="Close" onClick={() => setPasswordOpen(false)}>
                <X size={15} />
              </button>
            </div>
            <form className="ax-modal-form" onSubmit={submitPassword}>
              <label>
                Current password
                <input
                  type="password"
                  autoComplete="current-password"
                  value={passwordForm.current}
                  onChange={(event) => setPasswordForm((form) => ({ ...form, current: event.target.value }))}
                  required
                  data-testid="input-current-password"
                />
              </label>
              <label>
                New password
                <input
                  type="password"
                  autoComplete="new-password"
                  value={passwordForm.next}
                  onChange={(event) => setPasswordForm((form) => ({ ...form, next: event.target.value }))}
                  required
                  minLength={8}
                  data-testid="input-new-password"
                />
              </label>
              <label>
                Confirm new password
                <input
                  type="password"
                  autoComplete="new-password"
                  value={passwordForm.confirm}
                  onChange={(event) => setPasswordForm((form) => ({ ...form, confirm: event.target.value }))}
                  required
                  minLength={8}
                  data-testid="input-confirm-password"
                />
              </label>
              {passwordError ? <p className="ax-inline-error">{passwordError}</p> : null}
              {passwordSuccess ? <p className="ax-inline-success">{passwordSuccess}</p> : null}
              <div className="ax-modal-actions">
                <button className="ax-outline-button" type="button" onClick={() => setPasswordOpen(false)}>
                  Cancel
                </button>
                <button className="ax-primary-button" type="submit" disabled={changePassword.isPending} data-testid="button-submit-password">
                  {changePassword.isPending ? 'Saving…' : 'Update password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}
