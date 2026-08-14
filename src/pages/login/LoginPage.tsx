import { type FormEvent, useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import {
  ArrowLeft,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  LoaderCircle,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { AuthShell } from './AuthShell';
import './LoginPage.css';

const DEMO_ACCOUNTS = [
  { email: 'ava.lang@meridian.care', role: 'Administrator' },
  { email: 'omar.reyes@meridian.care', role: 'Operator' },
  { email: 'casey.nguyen@meridian.care', role: 'Coder' },
  { email: 'blake.ortiz@meridian.care', role: 'Biller' },
  { email: 'vera.quinn@meridian.care', role: 'Viewer' },
];

function formatAuthError(err: unknown) {
  const raw = err instanceof Error ? err.message : 'Sign-in failed';
  try {
    const parsed = JSON.parse(raw) as { message?: string | string[] };
    if (Array.isArray(parsed.message)) return parsed.message.join(', ');
    if (parsed.message) return parsed.message;
  } catch {
    // plain text
  }
  return raw.replace(/^"|"$/g, '');
}

export default function LoginPage() {
  const { ready, user, login } = useAuth();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('omar.reyes@meridian.care');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && user) setLocation('/workspace');
  }, [ready, user, setLocation]);

  if (!ready) {
    return (
      <main className="vl-login">
        <div className="vl-login-loading">
          <LoaderCircle className="vl-spin" size={22} />
          <span>Checking secure session…</span>
        </div>
      </main>
    );
  }

  if (user) return null;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      setLocation('/workspace');
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Operate the cycle with accountable access."
      body="Short-lived JWT access tokens, httpOnly refresh cookies, and role-based module gates protect every workspace route and API call."
      points={[
        { icon: ShieldCheck, text: 'Access token TTL: 10 minutes' },
        { icon: LockKeyhole, text: 'Refresh token: httpOnly cookie, rotated on use' },
        { icon: ShieldCheck, text: 'API rejects unauthenticated routing bypasses' },
      ]}
    >
      <div className="vl-login-topnav">
        <Link href="/" data-testid="link-login-home">
          <ArrowLeft size={14} /> Back to landing page
        </Link>
      </div>

      <header>
        <h2>Sign in</h2>
        <p>Use your Velora credentials to open the workspace.</p>
      </header>

      <form onSubmit={onSubmit} noValidate>
        <label>
          <span>Work email</span>
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            data-testid="input-login-email"
          />
        </label>

        <label>
          <span className="vl-label-row">
            Password
            <Link href="/forgot-password" data-testid="link-forgot-password">
              Forgot password?
            </Link>
          </span>
          <div className="vl-password">
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              data-testid="input-login-password"
            />
            <button
              type="button"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </label>

        {error ? (
          <div className="vl-login-error" role="alert">
            {error}
          </div>
        ) : null}

        <button type="submit" className="vl-login-submit" disabled={submitting} data-testid="button-login-submit">
          {submitting ? (
            <>
              <LoaderCircle className="vl-spin" size={16} /> Authenticating…
            </>
          ) : (
            'Enter control room'
          )}
        </button>
      </form>

      <div className="vl-auth-footer">
        <Link href="/signup" data-testid="link-signup">
          Request access / Sign up
        </Link>
        <Link href="/contact-admin" data-testid="link-contact-admin">
          Contact admin
        </Link>
      </div>

      <div className="vl-login-demo">
        <span>
          Demo accounts · password <code>Velora!2026</code>
        </span>
        <div>
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.email}
              type="button"
              onClick={() => {
                setEmail(account.email);
                setPassword('Velora!2026');
              }}
              data-testid={`button-fill-${account.role.toLowerCase()}`}
            >
              {account.role}
            </button>
          ))}
        </div>
      </div>
    </AuthShell>
  );
}
