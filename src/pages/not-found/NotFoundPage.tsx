import { Link } from 'wouter';
import './NotFoundPage.css';

export default function NotFoundPage() {
  return (
    <main className="not-found-page" data-testid="page-not-found">
      <div className="not-found-card">
        <span className="not-found-code">404</span>
        <h1>Page not found</h1>
        <p>This route is not part of Velora Revenue OS. Return home or open the control room.</p>
        <div className="not-found-actions">
          <Link href="/" data-testid="link-not-found-home">
            Back to home
          </Link>
          <Link href="/login" data-testid="link-not-found-workspace">
            Open workspace
          </Link>
        </div>
      </div>
    </main>
  );
}
