import { type FormEvent, useState } from 'react';
import { Link } from 'wouter';
import { CheckCircle2, KeyRound, Mail, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { AuthBackLinks, AuthShell } from './AuthShell';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.forgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Reset access without exposing the control room."
      body="Password resets are admin-mediated for healthcare workspaces. We never email live JWTs or temporary workspace keys."
      points={[
        { icon: KeyRound, text: 'Reset links expire in 30 minutes' },
        { icon: Mail, text: 'Delivered only to verified work emails' },
        { icon: ShieldCheck, text: 'Admin can revoke pending resets anytime' },
      ]}
    >
      <header>
        <h2>Forgot password</h2>
        <p>Enter your work email. An administrator will approve the reset.</p>
      </header>

      {sent ? (
        <div className="vl-auth-success" data-testid="forgot-success">
          <CheckCircle2 size={18} />
          <div>
            <b>Request received</b>
            <p>
              If <code>{email}</code> is registered, your Velora admin will receive a reset approval
              task. Check your inbox after approval.
            </p>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate>
          <label>
            <span>Work email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@organization.care"
              data-testid="input-forgot-email"
            />
          </label>
          {error ? <div className="vl-login-error">{error}</div> : null}
          <button type="submit" className="vl-login-submit" disabled={submitting} data-testid="button-forgot-submit">
            Request password reset
          </button>
        </form>
      )}

      <div className="vl-auth-footer">
        <Link href="/contact-admin" className="vl-auth-action" data-testid="link-forgot-contact">
          Need help? Contact admin
        </Link>
      </div>
      <AuthBackLinks />
    </AuthShell>
  );
}
