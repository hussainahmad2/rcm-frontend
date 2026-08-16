import { type FormEvent, useState } from 'react';
import { Link } from 'wouter';
import { Building2, CheckCircle2, ShieldCheck, UserPlus } from 'lucide-react';
import { api } from '@/lib/api';
import { AuthBackLinks, AuthShell } from './AuthShell';

export default function SignUpPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [org, setOrg] = useState('');
  const [role, setRole] = useState('operator');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.signupRequest({
        name: name.trim(),
        email: email.trim(),
        organization: org.trim(),
        role,
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Access is granted, not self-served."
      body="Velora workspaces are tenant-bound. New operators are provisioned by an administrator after identity and role review."
      points={[
        { icon: UserPlus, text: 'Request creates an admin review task' },
        { icon: Building2, text: 'Tied to your organization tenant' },
        { icon: ShieldCheck, text: 'RBAC role assigned before first login' },
      ]}
    >
      <header>
        <h2>Request access</h2>
        <p>Tell us who you are. An admin must approve before you can sign in.</p>
      </header>

      {sent ? (
        <div className="vl-auth-success" data-testid="signup-success">
          <CheckCircle2 size={18} />
          <div>
            <b>Access request submitted</b>
            <p>
              We sent your request for <code>{email}</code> ({org || 'your organization'}) to the
              tenant admin. You will receive credentials only after approval.
            </p>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate>
          <label>
            <span>Full name</span>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)} data-testid="input-signup-name" />
          </label>
          <label>
            <span>Work email</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} data-testid="input-signup-email" />
          </label>
          <label>
            <span>Organization</span>
            <input
              type="text"
              required
              value={org}
              onChange={(e) => setOrg(e.target.value)}
              placeholder="Meridian Care Network"
              data-testid="input-signup-org"
            />
          </label>
          <label>
            <span>Requested role</span>
            <select value={role} onChange={(e) => setRole(e.target.value)} data-testid="select-signup-role">
              <option value="operator">Operator</option>
              <option value="coder">Coder</option>
              <option value="biller">Biller</option>
              <option value="viewer">Viewer</option>
              <option value="admin">Administrator</option>
            </select>
          </label>
          {error ? <div className="vl-login-error">{error}</div> : null}
          <button type="submit" className="vl-login-submit" disabled={submitting} data-testid="button-signup-submit">
            Submit access request
          </button>
        </form>
      )}

      <div className="vl-auth-footer">
        <span>Already provisioned?</span>
        <Link href="/login" className="vl-auth-action" data-testid="link-signup-login">
          Sign in
        </Link>
      </div>
      <AuthBackLinks />
    </AuthShell>
  );
}
