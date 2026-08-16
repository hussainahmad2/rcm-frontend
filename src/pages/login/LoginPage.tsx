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
import { api } from '@/lib/api';
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
  const {
    ready,
    user,
    login,
    completeMfa,
    completeMfaEnroll,
    beginForcedMfaEnroll,
    mfaPending,
    mfaEnrollPending,
    seedMfaChallenge,
    seedMfaEnroll,
  } = useAuth();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(true);
  const [ssoProviders, setSsoProviders] = useState<Array<{ id: string; label: string }>>([]);
  const [enrollSecret, setEnrollSecret] = useState<{
    secret: string;
    otpauthUrl: string;
    recoveryCodes: string[];
  } | null>(null);

  useEffect(() => {
    if (ready && user) setLocation('/workspace');
  }, [ready, user, setLocation]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ssoError = params.get('ssoError');
    if (ssoError) setError(decodeURIComponent(ssoError));
    const mfaToken = params.get('mfaToken');
    if (mfaToken) seedMfaChallenge(mfaToken);
    const enrollToken = params.get('enrollToken');
    if (enrollToken) seedMfaEnroll(enrollToken);
  }, [seedMfaChallenge, seedMfaEnroll]);

  useEffect(() => {
    void api
      .sessionPolicy()
      .then((policy) => {
        setDemoMode(policy.demoMode !== false && policy.enterpriseMode !== true);
        setSsoProviders((policy as { ssoProviders?: Array<{ id: string; label: string }> }).ssoProviders ?? []);
      })
      .catch(() => setDemoMode(true));
  }, []);

  useEffect(() => {
    if (!mfaEnrollPending || enrollSecret) return;
    void beginForcedMfaEnroll()
      .then((data) => setEnrollSecret(data))
      .catch((err) => setError(formatAuthError(err)));
  }, [mfaEnrollPending, enrollSecret, beginForcedMfaEnroll]);

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
      if (mfaPending) {
        await completeMfa(mfaCode.trim());
        setLocation('/workspace');
        return;
      }
      if (mfaEnrollPending) {
        await completeMfaEnroll(mfaCode.trim());
        setLocation('/workspace');
        return;
      }
      const result = await login(email.trim(), password);
      if (result === 'ok') setLocation('/workspace');
      else setMfaCode('');
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function startSso(provider: string) {
    setError(null);
    try {
      const { authorizeUrl } = await api.startSso({ provider });
      window.location.href = authorizeUrl;
    } catch (err) {
      setError(formatAuthError(err));
    }
  }

  const challengeMode = Boolean(mfaPending || mfaEnrollPending);

  return (
    <AuthShell
      title="Operate the cycle with accountable access."
      body="Short-lived JWT access tokens, httpOnly refresh cookies, MFA, and enterprise SSO protect every workspace route and API call."
      points={[
        { icon: ShieldCheck, text: 'Access token TTL: 10 minutes' },
        { icon: LockKeyhole, text: 'Refresh token: httpOnly cookie, rotated on use' },
        { icon: ShieldCheck, text: 'OIDC SSO + TOTP MFA available' },
      ]}
    >
      <div className="vl-login-topnav">
        <Link href="/" data-testid="link-login-home">
          <ArrowLeft size={14} /> Back to landing page
        </Link>
      </div>

      <header>
        <h2>
          {mfaPending
            ? 'Authenticator check'
            : mfaEnrollPending
              ? 'MFA enrollment required'
              : 'Sign in'}
        </h2>
        <p>
          {mfaPending
            ? `Enter the 6-digit code for ${mfaPending.email}, or a recovery code.`
            : mfaEnrollPending
              ? `This tenant requires MFA. Enroll an authenticator for ${mfaEnrollPending.email}.`
              : 'Use your Velora credentials or enterprise SSO.'}
        </p>
      </header>

      <form onSubmit={onSubmit} noValidate>
        {mfaEnrollPending && enrollSecret ? (
          <div className="vl-login-demo" style={{ marginBottom: 14 }}>
            <span>Secret <code>{enrollSecret.secret}</code></span>
            <span>Recovery: {enrollSecret.recoveryCodes.join(' · ')}</span>
          </div>
        ) : null}
        {challengeMode ? (
          <label>
            <span>{mfaEnrollPending ? 'Confirm authenticator code' : 'Authentication code'}</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={mfaCode}
              onChange={(event) => setMfaCode(event.target.value)}
              required
              data-testid="input-login-mfa"
            />
          </label>
        ) : (
          <>
            <label>
              <span>Work email</span>
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                data-testid="input-login-email"
              />
            </label>
            <div className="vl-label-row">
              <span>Password</span>
              <Link href="/forgot-password" data-testid="link-forgot-password">
                Forgot password?
              </Link>
            </div>
            <div className="vl-password">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                data-testid="input-login-password"
              />
              <button
                type="button"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((open) => !open)}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </>
        )}
        {error ? <p className="vl-login-error">{error}</p> : null}
        <button className="vl-login-submit" type="submit" disabled={submitting} data-testid="button-login-submit">
          {submitting
            ? 'Signing in…'
            : mfaPending
              ? 'Verify and continue'
              : mfaEnrollPending
                ? 'Confirm MFA and continue'
                : 'Sign in'}
        </button>
      </form>

      {!challengeMode && ssoProviders.length ? (
        <div className="vl-login-demo" style={{ marginTop: 16 }}>
          <span>Enterprise SSO</span>
          <div>
            {ssoProviders.map((provider) => (
              <button
                key={provider.id}
                type="button"
                onClick={() => void startSso(provider.id)}
                data-testid={`button-sso-${provider.id}`}
              >
                {provider.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {!challengeMode ? (
        <div className="vl-auth-footer">
          <Link href="/signup" className="vl-auth-action" data-testid="link-signup">
            Request access / Sign up
          </Link>
          <Link href="/contact-admin" className="vl-auth-action" data-testid="link-contact-admin">
            Contact admin
          </Link>
        </div>
      ) : null}

      {!challengeMode && demoMode ? (
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
      ) : !challengeMode ? (
        <p className="vl-login-enterprise-note">
          Enterprise mode · demo credentials are disabled. Contact your administrator for access.
        </p>
      ) : null}
    </AuthShell>
  );
}
