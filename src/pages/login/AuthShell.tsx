import { Link } from 'wouter';
import { ArrowLeft, Command, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import './LoginPage.css';

export function AuthShell({
  title,
  body,
  points,
  children,
}: {
  title: string;
  body: string;
  points: { icon: LucideIcon; text: string }[];
  children: ReactNode;
}) {
  return (
    <main className="vl-login">
      <section className="vl-login-shell">
        <aside className="vl-login-aside">
          <div className="vl-login-brand">
            <span className="vl-login-mark">
              <Command size={18} />
            </span>
            <div>
              <strong>Velora Revenue OS</strong>
              <span>Revenue control room</span>
            </div>
          </div>
          <h1>{title}</h1>
          <p>{body}</p>
          <ul>
            {points.map(({ icon: Icon, text }) => (
              <li key={text}>
                <Icon size={16} /> {text}
              </li>
            ))}
          </ul>
        </aside>
        <div className="vl-login-card">{children}</div>
      </section>
    </main>
  );
}

export function AuthBackLinks({ showHome = true }: { showHome?: boolean }) {
  return (
    <div className="vl-auth-links">
      {showHome ? (
        <Link href="/" data-testid="link-auth-home">
          <ArrowLeft size={14} /> Back to landing page
        </Link>
      ) : null}
      <Link href="/login" data-testid="link-auth-login">
        Back to sign in
      </Link>
    </div>
  );
}
