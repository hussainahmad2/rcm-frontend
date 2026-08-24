import { Link } from 'wouter';
import { type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Brand } from '@/components/brand/Brand';
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
      <header className="vl-chrome">
        <Link href="/" className="vl-chrome-brand">
          <Brand />
        </Link>
        <Link href="/" className="vl-chrome-back">
          Back home
        </Link>
      </header>
      <section className="vl-stage">
        <div className="vl-intro">
          <h1>{title}</h1>
          <p>{body}</p>
          <ul>
            {points.map(({ icon: Icon, text }) => (
              <li key={text}>
                <Icon size={14} /> {text}
              </li>
            ))}
          </ul>
        </div>
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
          Back to landing page
        </Link>
      ) : null}
      <Link href="/login" data-testid="link-auth-login">
        Back to sign in
      </Link>
    </div>
  );
}
