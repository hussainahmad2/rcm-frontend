import { useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  ClipboardCheck,
  FileSearch,
  Globe2,
  Layers3,
  LockKeyhole,
  Menu,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UsersRound,
  Wallet,
  X,
} from 'lucide-react';
import { Link } from 'wouter';
import { Brand } from '@/components/brand/Brand';
import './HomePage.css';

const lanes = [
  {
    step: '01',
    title: 'Before the visit',
    body: 'Confirm coverage and prior auths so the patient is not surprised at the desk.',
    icon: ShieldCheck,
  },
  {
    step: '02',
    title: 'At the visit',
    body: 'Check in, capture the visit, and code what actually happened — not a guess.',
    icon: Stethoscope,
  },
  {
    step: '03',
    title: 'Getting paid',
    body: 'Send clean claims, work denials, and chase unpaid bills with a named owner.',
    icon: Wallet,
  },
];

const problems = [
  { id: '01', title: 'The warning arrives late.', body: 'A denial shows up weeks after the visit. The costly choice already happened.' },
  { id: '02', title: 'Work gets lost between teams.', body: 'Front desk, coding, and billing each see a slice. Nobody sees the whole story.' },
  { id: '03', title: 'Money leaks quietly.', body: 'Missed charges, short pays, and slow follow-up add up without a clear owner.' },
  { id: '04', title: 'Black-box tools are a risk.', body: 'If a person cannot explain the next step, it is not control.' },
];

const countries = [
  { name: 'United States', code: 'US' },
  { name: 'Saudi Arabia', code: 'SA' },
  { name: 'United Arab Emirates', code: 'AE' },
  { name: 'Australia', code: 'AU' },
  { name: 'Canada', code: 'CA' },
  { name: 'United Kingdom', code: 'UK' },
];

function SiteNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);
  return (
    <header className="lp-nav" id="top">
      <div className="lp-wrap lp-nav-inner">
        <Link href="/" data-testid="link-home-brand" onClick={closeMenu}>
          <Brand />
        </Link>
        <nav className={`lp-nav-links ${menuOpen ? 'open' : ''}`} aria-label="Primary navigation">
          <a href="#system" data-testid="link-nav-system" onClick={closeMenu}>
            How it works
          </a>
          <a href="#twin" data-testid="link-nav-twin" onClick={closeMenu}>
            A patient story
          </a>
          <a href="#global" data-testid="link-nav-global" onClick={closeMenu}>
            Markets
          </a>
          <a href="#governance" data-testid="link-nav-governance" onClick={closeMenu}>
            Trust
          </a>
        </nav>
        <div className="lp-nav-actions">
          <a className="lp-nav-ghost" href="#contact" data-testid="link-nav-contact">
            Talk to us
          </a>
          <Link className="lp-nav-login" href="/login" onClick={closeMenu}>
            Sign in
          </Link>
          <Link className="lp-nav-cta" href="/demo" data-testid="link-nav-demo" onClick={closeMenu}>
            Book a demo <ArrowUpRight size={14} />
          </Link>
          <button
            className="lp-menu"
            type="button"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            data-testid="button-mobile-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>
    </header>
  );
}

function DeskPreview() {
  return (
    <div className="lp-preview" data-testid="visual-control-room">
      <article className="lp-sheet lp-sheet-main">
        <header>
          <span>Today</span>
          <b>Live</b>
        </header>
        <h3>Unpaid bills</h3>
        <strong>$2.84m</strong>
        <p>Insurance still owes most of it. Twelve accounts need a call today.</p>
        <ul>
          <li>
            <span>Claims ready to send</span>
            <b>41</b>
          </li>
          <li>
            <span>Denied this week</span>
            <b>18</b>
          </li>
          <li>
            <span>Visits not billed</span>
            <b>9</b>
          </li>
        </ul>
      </article>
      <article className="lp-sheet lp-sheet-side">
        <span>Next action</span>
        <h4>Call Aetna on claim 24-0816</h4>
        <p>Short pay on modifier 25. Expected $8,420 · posted $6,110.</p>
        <small>Assigned to billing · due today</small>
      </article>
      <article className="lp-sheet lp-sheet-note">
        <Sparkles size={16} />
        <p>Coverage is active. Prior auth is on file. Send the claim.</p>
      </article>
    </div>
  );
}

export default function HomePage() {
  return (
    <main className="lp">
      <SiteNav />

      <section className="lp-hero">
        <div className="lp-wrap lp-hero-grid">
          <div className="lp-hero-copy">
            <p className="lp-kicker">Velora Desk</p>
            <h1>
              One desk for
              <em> unpaid work.</em>
            </h1>
            <p className="lp-lede">
              Coverage, visits, claims, and unpaid bills sit together so the next call, code, or send is obvious.
            </p>
            <div className="lp-hero-actions">
              <Link className="lp-btn" href="/login" data-testid="link-hero-workspace">
                Open the desk <ArrowRight size={16} />
              </Link>
              <a className="lp-btn-ghost" href="#system" data-testid="link-hero-system">
                See how it works
              </a>
            </div>
            <p className="lp-trust">
              <LockKeyhole size={14} /> People approve anything that changes a record.
            </p>
          </div>
          <DeskPreview />
        </div>
      </section>

      <section className="lp-stats">
        <div className="lp-wrap lp-stats-row">
          <div>
            <b>31.4</b>
            <span>Days waiting to be paid</span>
          </div>
          <div>
            <b>94.7%</b>
            <span>Claims accepted first try</span>
          </div>
          <div>
            <b>18</b>
            <span>Denied claims this week</span>
          </div>
          <div>
            <b>6</b>
            <span>Country settings ready</span>
          </div>
        </div>
      </section>

      <section className="lp-problems" id="problem">
        <div className="lp-wrap">
          <div className="lp-intro">
            <p className="lp-kicker">Why clinics stall</p>
            <h2>Billing is not a straight line. It is a pile of handoffs.</h2>
          </div>
          <div className="lp-problem-grid">
            {problems.map((item) => (
              <article key={item.id} className="lp-problem" data-testid={`card-problem-${item.id}`}>
                <span>{item.id}</span>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-lanes" id="system">
        <div className="lp-wrap">
          <div className="lp-intro">
            <p className="lp-kicker">How it works</p>
            <h2>Three lanes. One place to sit.</h2>
            <p>Staff move left to right through the visit. Nothing important lives in a side system.</p>
          </div>
          <div className="lp-lane-grid" data-testid="visual-system-orbit">
            {lanes.map((lane, index) => {
              const Icon = lane.icon;
              return (
                <article className="lp-lane" key={lane.step} data-testid={`button-system-${index + 1}`}>
                  <Icon size={22} />
                  <span>{lane.step}</span>
                  <h3>{lane.title}</h3>
                  <p>{lane.body}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="lp-story" id="twin">
        <div className="lp-wrap lp-story-grid">
          <div>
            <p className="lp-kicker">A patient story</p>
            <h2>Follow the money from check-in to cash.</h2>
            <p>
              Every visit keeps a memory: who was covered, what was done, what was billed, and what came back. The next
              person does not start from zero.
            </p>
            <blockquote>“The best next step is one a biller can say out loud in huddle.”</blockquote>
          </div>
          <ol className="lp-timeline" data-testid="visual-financial-twin">
            <li>
              <small>Check-in</small>
              <strong>Coverage verified</strong>
              <span>Aetna PPO · member active</span>
            </li>
            <li>
              <small>Visit</small>
              <strong>Codes on the chart</strong>
              <span>Orthopedics · modifier 25 flagged</span>
            </li>
            <li>
              <small>Claim</small>
              <strong>Ready to send</strong>
              <span>Expected $8,420</span>
            </li>
            <li className="open">
              <small>Unpaid</small>
              <strong>Short pay — call today</strong>
              <span>Posted $6,110 · gap $2,310</span>
            </li>
          </ol>
        </div>
      </section>

      <section className="lp-markets" id="global">
        <div className="lp-wrap">
          <div className="lp-intro">
            <p className="lp-kicker">Markets</p>
            <h2>Local rules. Same desk.</h2>
            <p>Country settings change labels, IDs, and payer logic. The work stays in one place.</p>
          </div>
          <div className="lp-market-grid" data-testid="visual-global-markets">
            {countries.map((country) => (
              <article key={country.code} className="lp-market">
                <Globe2 size={18} />
                <b>{country.name}</b>
                <span>{country.code}</span>
              </article>
            ))}
          </div>
          <p className="lp-fine">
            Settings exist for the US, Saudi Arabia, UAE, Australia, Canada, and the UK. What you can turn on depends on
            your clinic — this is not a legal or compliance claim.
          </p>
        </div>
      </section>

      <section className="lp-trust-block" id="governance">
        <div className="lp-wrap lp-trust-grid">
          <div>
            <p className="lp-kicker">Trust</p>
            <h2>Helpers draft. People decide.</h2>
            <p>AI can queue work and write a first pass. A named person still owns the send, the write-off, and the appeal.</p>
          </div>
          <div className="lp-trust-list">
            <article data-testid="card-governance-1">
              <FileSearch size={20} />
              <div>
                <h3>Show your work</h3>
                <p>Every suggestion carries why it fired, how sure it is, and what to do next.</p>
              </div>
            </article>
            <article data-testid="card-governance-2">
              <Layers3 size={20} />
              <div>
                <h3>Your billing rules</h3>
                <p>Encode the checks your team already trusts. Change them without a six-month project.</p>
              </div>
            </article>
            <article data-testid="card-governance-3">
              <ClipboardCheck size={20} />
              <div>
                <h3>A paper trail</h3>
                <p>Approvals, owners, and an audit of what changed — not a silent checkbox.</p>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="lp-cta" id="contact">
        <div className="lp-wrap lp-cta-inner">
          <UsersRound size={28} />
          <h2>Bring one unpaid pile. Leave with a next step.</h2>
          <p>Thirty minutes. A real claim, denial, or coverage gap. No slide deck.</p>
          <Link className="lp-btn lp-btn-on-copper" href="/demo" data-testid="link-closing-demo">
            Book a working session <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-wrap lp-footer-row">
          <Brand />
          <small>© 2026 Velora Desk</small>
          <div className="lp-footer-links">
            <a href="#top" data-testid="link-footer-top">
              Back to top
            </a>
            <a href="#governance" data-testid="link-footer-governance">
              Trust
            </a>
            <Link href="/login">Sign in</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
