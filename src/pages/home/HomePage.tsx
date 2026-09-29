import { useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BrainCircuit,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  FileSearch,
  Globe2,
  Layers3,
  LockKeyhole,
  Menu,
  Network,
  Play,
  ShieldCheck,
  Sparkles,
  Target,
  UsersRound,
  X,
} from 'lucide-react';
import { Link } from 'wouter';
import { Brand } from '@/components/brand/Brand';
import './HomePage.css';

type IconType = typeof BrainCircuit;

const systemItems: { number: string; title: string; body: string; icon: IconType }[] = [
  { number: '01', title: 'Revenue Intelligence Engine', body: 'A living signal layer that connects access, clinical, billing and payment events so operators see what is changing before cash does.', icon: BrainCircuit },
  { number: '02', title: 'Revenue Leakage Engine', body: 'Finds preventable loss across denials, underpayments, missed charges and slow follow-up—with a clear owner and next action.', icon: Target },
  { number: '03', title: 'A specialized AI workforce', body: 'Purpose-built digital workers handle repetitive review, routing and preparation. People stay in control of decisions that matter.', icon: UsersRound },
];

const countryRows = [
  { name: 'United States', code: 'US pack', className: 'pin-us' },
  { name: 'Saudi Arabia', code: 'SA pack', className: 'pin-sa' },
  { name: 'United Arab Emirates', code: 'UAE pack', className: 'pin-uae' },
  { name: 'Australia', code: 'AU pack', className: 'pin-au' },
  { name: 'Canada', code: 'CA pack', className: 'pin-ca' },
  { name: 'United Kingdom', code: 'UK pack', className: 'pin-uk' },
];

function SiteNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);
  return (
    <header className="topbar">
      <div className="container nav">
        <Link href="/" data-testid="link-home-brand" onClick={closeMenu}><Brand /></Link>
        <nav className={`nav-links ${menuOpen ? 'open' : ''}`} aria-label="Primary navigation">
          <a href="#system" data-testid="link-nav-system" onClick={closeMenu}>The system</a>
          <a href="#twin" data-testid="link-nav-twin" onClick={closeMenu}>Financial twin</a>
          <a href="#global" data-testid="link-nav-global" onClick={closeMenu}>Global by design</a>
          <a href="#governance" data-testid="link-nav-governance" onClick={closeMenu}>Governance</a>
        </nav>
        <div className="nav-actions">
          <a className="nav-ghost" href="#contact" data-testid="link-nav-contact">Talk to us</a>
          <Link className="nav-cta" href="/demo" data-testid="link-nav-demo" onClick={closeMenu}>Book a demo <ArrowUpRight size={14} /></Link>
          <button className="menu-button" type="button" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} data-testid="button-mobile-menu" onClick={() => setMenuOpen((open) => !open)}>
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>
    </header>
  );
}

function HeroDashboard() {
  return (
    <div className="control-room" data-testid="visual-control-room">
      <div className="control-room-card">
        <div className="window-bar">
          <span className="window-dot" /><span className="window-dot" /><span className="window-dot" />
          <span className="window-title">VELORA / REVENUE CONTROL ROOM / LIVE</span>
        </div>
        <div className="room-body">
          <div className="room-head">
            <div>
              <span className="room-kicker">Network command view</span>
              <h3>Revenue health, in one frame.</h3>
              <p>Global provider network · 18 operating entities · updated moments ago</p>
            </div>
            <span className="room-live"><span className="live-dot" /> Signal live</span>
          </div>
          <div className="room-stats">
            <div className="room-stat"><small>Focus metric</small><strong>Clean claim rate</strong><span className="stat-note">Measured in your pilot workspace</span></div>
            <div className="room-stat"><small>Focus metric</small><strong>Denial rate</strong><span className="stat-note">Tracked after live ERA posting</span></div>
            <div className="room-stat"><small>Focus metric</small><strong>Days in A/R</strong><span className="stat-note">From claim submit to cash</span></div>
            <div className="room-stat"><small>Focus metric</small><strong>Net collection</strong><span className="stat-note">Ledger-projected in command center</span></div>
          </div>
          <div className="room-grid">
            <div className="room-panel">
              <div className="panel-label"><span>Net collections / 12 weeks</span><b>+14.2%</b></div>
              <div className="chart">
                <svg viewBox="0 0 480 145" preserveAspectRatio="none" aria-label="Collections trend chart">
                  <path className="chart-line-2" d="M0 112 C40 108 59 119 89 104 S135 100 160 91 S208 104 237 87 S282 90 310 66 S354 76 382 47 S426 60 480 25" />
                  <path className="chart-line" d="M0 126 C36 121 60 121 88 110 S130 116 160 102 S200 106 234 99 S275 82 308 88 S354 61 383 68 S424 38 480 45" />
                  <circle cx="480" cy="45" r="4" fill="hsl(var(--accent))" />
                </svg>
              </div>
              <div className="chart-caption"><span>JAN 08</span><span>MAR 29</span></div>
            </div>
            <div className="room-panel">
              <div className="panel-label"><span>Leakage signals by source</span><b>1,284 open</b></div>
              <div className="leak-list">
                <div className="leak-row"><div className="leak-name"><span>Eligibility gaps</span><b>38%</b></div><div className="bar-track"><div className="bar-fill" style={{ width: '76%' }} /></div></div>
                <div className="leak-row"><div className="leak-name"><span>Underpayment variance</span><b>26%</b></div><div className="bar-track"><div className="bar-fill coral" style={{ width: '58%' }} /></div></div>
                <div className="leak-row"><div className="leak-name"><span>Denial recurrence</span><b>21%</b></div><div className="bar-track"><div className="bar-fill" style={{ width: '46%' }} /></div></div>
                <div className="leak-row"><div className="leak-name"><span>Documentation drift</span><b>15%</b></div><div className="bar-track"><div className="bar-fill coral" style={{ width: '34%' }} /></div></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <>
      <section className="hero" id="top">
        <SiteNav />
        <div className="container hero-content">
          <div className="hero-copy">
            <span className="eyebrow">The revenue cycle operating system</span>
            <h1>Make every dollar <em>visible.</em></h1>
            <p className="hero-lede">Velora Revenue OS gives healthcare operators one intelligent view of revenue—from financial clearance through reimbursement, across every market you serve.</p>
            <div className="hero-buttons">
              <Link className="button-primary" href="/login" data-testid="link-hero-workspace">Open the control room <ArrowRight size={16} /></Link>
              <a className="button-outline" href="#system" data-testid="link-hero-system"><Play size={14} /> Explore the system</a>
            </div>
            <span className="hero-footnote"><ShieldCheck size={13} /> Built for accountable human oversight</span>
          </div>
          <HeroDashboard />
        </div>
      </section>
      <div className="ticker">
        <div className="container ticker-inner">
          <span className="ticker-label">One connected view</span>
          <div className="ticker-words">
            <span>Clearance</span><span>Claims</span><span>Denials</span><span>Payments</span><span>Performance</span>
          </div>
        </div>
      </div>
    </>
  );
}

function ProblemSection() {
  const cards = [
    { number: '01 / SIGNAL', title: 'The warning arrives late.', body: 'By the time a denial lands, the costly decision happened weeks ago.', icon: BarChart3 },
    { number: '02 / HANDOFF', title: 'The work disappears.', body: 'Critical context breaks between teams, systems and markets.', icon: Network },
    { number: '03 / LEAKAGE', title: 'The margin quietly moves.', body: 'Small variances compound into material revenue left behind.', icon: CircleDollarSign },
    { number: '04 / TRUST', title: 'The black box is a risk.', body: 'Automation without an accountable operator is not control.', icon: LockKeyhole },
  ];
  return (
    <section className="section problem" id="problem">
      <div className="container problem-layout">
        <div className="problem-copy">
          <span className="eyebrow">Why the old stack breaks</span>
          <h2>The revenue cycle is not a line. It is a <em className="display" style={{ color: 'hsl(var(--secondary))' }}>system.</em></h2>
          <p>Modern providers operate across fragmented data, payer logic and human workflows. Velora turns that complexity into an operating picture your team can act on.</p>
          <span className="annotation">Designed for the moments between systems</span>
        </div>
        <div className="loss-stack">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <article className="loss-card" key={card.number} data-testid={`card-problem-${card.number.split(' ')[0]}`}>
                <Icon className="loss-icon" size={22} />
                <span className="card-number">{card.number}</span>
                <h3>{card.title}</h3>
                <p>{card.body}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function SystemSection() {
  const [active, setActive] = useState(0);
  return (
    <section className="section system" id="system">
      <div className="container system-layout">
        <div className="system-visual" aria-label="Velora connected system visualization" data-testid="visual-system-orbit">
          <div className="orb" />
          <div className="orb-center"><div><strong>Revenue OS</strong><span>one control plane</span></div></div>
          <span className="orbit-dot one"><BrainCircuit size={17} /></span><span className="orbit-label one">INTELLIGENCE</span>
          <span className="orbit-dot two"><CircleDollarSign size={17} /></span><span className="orbit-label two">LEAKAGE</span>
          <span className="orbit-dot three"><UsersRound size={17} /></span><span className="orbit-label three">WORKFORCE</span>
          <span className="orbit-dot four"><Globe2 size={17} /></span><span className="orbit-label four">MARKETS</span>
        </div>
        <div>
          <div className="section-heading">
            <span className="eyebrow">The Velora system</span>
            <h2>One plane for every revenue decision.</h2>
            <p>Not another point solution. A connected intelligence layer that helps your people see the full picture, prioritize the right work and move with confidence.</p>
          </div>
          <div className="system-list">
            {systemItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <button className={`system-item ${active === index ? 'active' : ''}`} type="button" key={item.number} onClick={() => setActive(index)} data-testid={`button-system-${index + 1}`}>
                  <span className="system-item-number">{item.number}</span>
                  <span><h3>{item.title}</h3><p>{active === index ? item.body : `${item.body.split('—')[0]}— see how it works.`}</p></span>
                  <Icon size={18} />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function TwinSection() {
  return (
    <section className="section twin" id="twin">
      <div className="container twin-layout">
        <div className="twin-copy">
          <span className="eyebrow">A model that thinks in context</span>
          <h2>Your revenue, with a memory.</h2>
          <p>The financial digital twin holds the relationships between a patient journey, a claim, a payer rule and a payment. It shows what happened, what is likely next and why.</p>
          <div className="twin-quote">“The best recommendation is one an operator can explain in the next huddle.”</div>
        </div>
        <div className="twin-canvas" data-testid="visual-financial-twin">
          <div className="twin-header">
            <div className="twin-avatar">MR</div>
            <div><strong>Episode 24-0816</strong><span>Orthopedics · US East · commercial</span></div>
            <div className="twin-amount"><strong>$8,420</strong><span>expected reimbursement</span></div>
          </div>
          <div className="twin-flow">
            <div className="flow-node"><small>01 / clearance</small><strong>Coverage verified</strong><span>92% confidence</span></div>
            <div className="flow-node"><small>02 / claim</small><strong>Modifier review</strong><span style={{ color: 'hsl(var(--accent))' }}>Action suggested</span></div>
            <div className="flow-node"><small>03 / payment</small><strong>Within expected band</strong><span>Model aligned</span></div>
          </div>
          <div className="twin-note"><Sparkles size={13} style={{ color: 'hsl(var(--accent))', verticalAlign: 'middle', marginRight: 7 }} /> Recommendation: review modifier 25 before submission. Based on 47 comparable episodes and current payer behavior.</div>
        </div>
      </div>
    </section>
  );
}

function GlobalSection() {
  return (
    <section className="section countries" id="global">
      <div className="container">
        <div className="country-top">
          <div className="section-heading"><span className="eyebrow">Global by design</span><h2>Local logic. One accountable view.</h2></div>
          <p>Country-adaptive architecture lets teams configure the language of their market without losing the operating discipline of the whole network.</p>
        </div>
        <div className="country-layout">
          <div className="map-panel" aria-label="Global market coverage visualization" data-testid="visual-global-markets">
            <div className="map-swoop" />
            {countryRows.map((country) => <span key={country.name} className={`map-pin ${country.className}`} title={country.name} />)}
            <span className="map-caption">CONFIGURABLE MARKET LAYERS / NOT A COMPLIANCE CLAIM</span>
          </div>
          <div>
            <div className="country-list">
              {countryRows.map((country) => (
                <div className="country-row" key={country.name}>
                  <span style={{ color: 'hsl(var(--foreground))', font: '14px var(--app-font-serif)' }}>{country.name}</span>
                  <span>{country.code} <ChevronRight size={14} style={{ verticalAlign: 'middle', marginLeft: 8 }} /></span>
                </div>
              ))}
            </div>
            <p className="country-disclaimer">Integrations and country packs are designed for markets such as the US, Saudi Arabia, UAE, Australia, Canada and the UK. Availability and configuration depend on your operating environment; this is not a claim of legal or regulatory compliance.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function SlidersIcon(props: { size?: number }) {
  return <Layers3 {...props} />;
}

function GovernanceSection() {
  const items = [
    { title: 'Explainable recommendations', body: 'Every signal carries its evidence, confidence and the path to a decision.', icon: FileSearch },
    { title: 'Configurable rules', body: 'Encode the operating logic your team trusts, then change it without a services project.', icon: SlidersIcon },
    { title: 'Human-in-the-loop governance', body: 'Set approval thresholds, named owners and a visible audit trail for every action.', icon: ClipboardCheck },
  ];
  return (
    <section className="section governance" id="governance">
      <div className="container governance-layout">
        <div className="governance-copy">
          <span className="eyebrow">Automation with accountability</span>
          <h2>Fast is good. <span style={{ color: 'hsl(var(--secondary))' }}>Explainable</span> is better.</h2>
          <p>Velora is built around the operators who own the outcome. AI does the repetitive work and surfaces the trade-offs. Your team sets the rules and makes the call.</p>
        </div>
        <div className="governance-list">
          {items.map((item, index) => {
            const Icon = item.icon;
            return (
              <article className="governance-item" key={item.title} data-testid={`card-governance-${index + 1}`}>
                <Icon size={21} />
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ClosingSection() {
  return (
    <>
      <section className="closing" id="contact">
        <div className="container closing-inner">
          <span className="eyebrow">Take the next operating step</span>
          <h2>See what your revenue is trying to tell you.</h2>
          <p>Bring your hardest revenue question. We will show you how the control room turns it into a clear, owned next move.</p>
          <Link className="button-primary" href="/demo" data-testid="link-closing-demo">Book your working session <ArrowRight size={16} /></Link>
        </div>
      </section>
      <footer className="footer">
        <div className="container footer-row">
          <Brand />
          <small>© 2025 Velora Revenue OS · Revenue, made accountable.</small>
          <div className="footer-links">
            <a href="#top" data-testid="link-footer-top">Back to top</a>
            <a href="#governance" data-testid="link-footer-governance">Governance</a>
          </div>
        </div>
      </footer>
    </>
  );
}

export default function HomePage() {
  return (
    <main className="site-shell">
      <Hero />
      <ProblemSection />
      <SystemSection />
      <TwinSection />
      <GlobalSection />
      <GovernanceSection />
      <ClosingSection />
    </main>
  );
}
