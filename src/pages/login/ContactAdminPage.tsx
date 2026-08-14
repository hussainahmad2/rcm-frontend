import { type FormEvent, useState } from 'react';
import { Link } from 'wouter';
import { CheckCircle2, Headset, LockKeyhole, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { AuthBackLinks, AuthShell } from './AuthShell';

export default function ContactAdminPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [topic, setTopic] = useState('access');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.contactAdmin({
        name: name.trim(),
        email: email.trim(),
        topic,
        message: message.trim(),
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
      title="Reach your tenant administrator."
      body="Locked accounts, role changes, and emergency access are handled by your Velora admin — not public self-service."
      points={[
        { icon: Headset, text: 'Routed to your organization admin queue' },
        { icon: LockKeyhole, text: 'No password resets without identity checks' },
        { icon: ShieldCheck, text: 'Support tickets are audit-logged' },
      ]}
    >
      <header>
        <h2>Contact admin</h2>
        <p>Describe the issue. Your message is logged for the tenant security owner.</p>
      </header>

      {sent ? (
        <div className="vl-auth-success" data-testid="contact-success">
          <CheckCircle2 size={18} />
          <div>
            <b>Message sent</b>
            <p>
              Your admin has been notified. For urgent lockouts, also call your internal IT / revenue
              operations owner.
            </p>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate>
          <label>
            <span>Your name</span>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)} data-testid="input-contact-name" />
          </label>
          <label>
            <span>Work email</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} data-testid="input-contact-email" />
          </label>
          <label>
            <span>Topic</span>
            <select value={topic} onChange={(e) => setTopic(e.target.value)} data-testid="select-contact-topic">
              <option value="access">Cannot sign in / locked out</option>
              <option value="password">Password reset stuck</option>
              <option value="role">Role or permissions change</option>
              <option value="tenant">Wrong tenant / workspace</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label>
            <span>Message</span>
            <textarea
              required
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Include your organization and what you were trying to do."
              data-testid="input-contact-message"
            />
          </label>
          {error ? <div className="vl-login-error">{error}</div> : null}
          <button type="submit" className="vl-login-submit" disabled={submitting} data-testid="button-contact-submit">
            Send to admin
          </button>
        </form>
      )}

      <div className="vl-auth-footer">
        <Link href="/forgot-password" data-testid="link-contact-forgot">
          Forgot password
        </Link>
        <Link href="/signup" data-testid="link-contact-signup">
          Request access
        </Link>
      </div>
      <AuthBackLinks />
    </AuthShell>
  );
}
