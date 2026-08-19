import type { LucideIcon } from 'lucide-react';
import { AlertCircle, Command, RefreshCw, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import type { AiInsightView, StatusTone } from './format';
import { formatLabel } from './format';

export function BrandLockup() {
  return (
    <span className="ax-brand">
      <span className="ax-brand-mark">
        <Command size={16} />
      </span>
      <span>
        Velora <b>Revenue OS</b>
      </span>
    </span>
  );
}

export function StatusPill({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: StatusTone;
}) {
  return (
    <span className={`ax-pill ${tone}`}>
      <span className="ax-pill-dot" />
      {children}
    </span>
  );
}

export function Metric({
  label,
  value,
  delta,
  icon: Icon,
  tone = 'teal',
}: {
  label: string;
  value: string;
  delta?: string;
  icon: LucideIcon;
  tone?: string;
}) {
  return (
    <article className="ax-metric" data-testid={`metric-${label.toLowerCase().replace(/\s/g, '-')}`}>
      <div className="ax-metric-top">
        <span>{label}</span>
        <span className={`ax-metric-icon ${tone}`}>
          <Icon size={15} />
        </span>
      </div>
      <strong>{value}</strong>
      {delta ? <small className={delta.startsWith('↓') || delta.startsWith('â†“') ? 'positive' : 'warning'}>{delta}</small> : null}
    </article>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  detail,
  action,
}: {
  eyebrow: string;
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className="ax-section-heading">
      <div>
        <span className="ax-kicker">{eyebrow}</span>
        <h1>{title}</h1>
        {detail ? <p>{detail}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="ax-empty">
      <RefreshCw size={22} className="ax-spin" />
      <b>{label}</b>
      <p>Fetching live Velora data.</p>
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : 'Something went wrong';
  return (
    <div className="ax-empty">
      <AlertCircle size={22} />
      <b>Unable to load</b>
      <p>{message}</p>
      {onRetry ? (
        <button className="ax-text-button" type="button" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}

export function InsightCard({
  title,
  statusLabel,
  statusToneValue,
  confidence,
  insight,
  meta,
}: {
  title: string;
  statusLabel?: string;
  statusToneValue?: StatusTone;
  confidence?: number;
  insight: AiInsightView | null;
  meta?: ReactNode;
}) {
  const riskTone =
    insight?.riskLevel === 'high' ? 'coral' : insight?.riskLevel === 'low' ? 'teal' : insight?.riskLevel ? 'amber' : undefined;
  return (
    <div className="ax-insight-card" style={{ gridColumn: '1 / -1' }}>
      <div className="ax-insight-card-top">
        <div>
          <span className="ax-kicker">{title}</span>
          {insight?.headline ? <h3>{insight.headline}</h3> : <h3>Check complete</h3>}
        </div>
        <div className="ax-insight-card-badges">
          {statusLabel ? <StatusPill tone={statusToneValue ?? 'neutral'}>{statusLabel}</StatusPill> : null}
          {insight?.riskLevel ? (
            <StatusPill tone={riskTone as 'coral' | 'amber' | 'teal'}>{formatLabel(insight.riskLevel)} risk</StatusPill>
          ) : null}
          {confidence != null ? <span className="ax-insight-conf">{Math.round(confidence * 100)}% confidence</span> : null}
        </div>
      </div>
      {insight?.summary ? <p className="ax-insight-summary">{insight.summary}</p> : null}
      {(insight?.factors?.length || insight?.recommendations?.length) ? (
        <div className="ax-ai-columns">
          <div>
            <h3>Primary factors</h3>
            <ul>
              {(insight?.factors ?? []).map((factor) => (
                <li key={factor}>{factor}</li>
              ))}
              {!insight?.factors?.length ? <li>No factors returned</li> : null}
            </ul>
          </div>
          <div>
            <h3>Recommendations</h3>
            <ul>
              {(insight?.recommendations ?? []).map((item) => (
                <li key={item}>{item}</li>
              ))}
              {!insight?.recommendations?.length ? <li>No recommendations returned</li> : null}
            </ul>
          </div>
        </div>
      ) : null}
      {insight?.nextAction ? (
        <div className="ax-ai-next">
          <Sparkles size={15} />
          <div>
            <span className="ax-kicker">Next action</span>
            <strong>{insight.nextAction}</strong>
          </div>
        </div>
      ) : null}
      {meta}
    </div>
  );
}

export function JobResultPanel({
  kicker,
  title,
  subtitle,
  insight,
  confidence,
  offline,
  badges,
  footer,
}: {
  kicker: string;
  title: string;
  subtitle?: string;
  insight: AiInsightView | null;
  confidence?: number;
  offline?: boolean;
  badges?: ReactNode;
  footer?: ReactNode;
}) {
  const riskTone =
    insight?.riskLevel === 'high' ? 'coral' : insight?.riskLevel === 'low' ? 'teal' : 'amber';
  return (
    <section className="ax-ai-result" data-testid="job-result-panel">
      <div className="ax-ai-result-head">
        <div>
          <span className="ax-kicker">{kicker}</span>
          <h2>{insight?.headline ?? title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        <div className="ax-ai-result-badges">
          {offline != null ? (
            <StatusPill tone={offline ? 'amber' : 'teal'}>{offline ? 'Rules fallback' : 'Model online'}</StatusPill>
          ) : null}
          {insight?.riskLevel ? (
            <StatusPill tone={riskTone as 'coral' | 'amber' | 'teal'}>{formatLabel(insight.riskLevel)} risk</StatusPill>
          ) : null}
          {confidence != null ? (
            <span className="ax-insight-conf">{Math.round(confidence * 100)}% confidence</span>
          ) : null}
          {badges}
        </div>
      </div>
      <p className="ax-ai-summary">{insight?.summary ?? 'Job completed.'}</p>
      <div className="ax-ai-columns">
        <div>
          <h3>Primary factors</h3>
          <ul>
            {(insight?.factors ?? []).map((factor) => (
              <li key={factor}>{factor}</li>
            ))}
            {!insight?.factors?.length ? <li>No factors listed</li> : null}
          </ul>
        </div>
        <div>
          <h3>Recommendations</h3>
          <ul>
            {(insight?.recommendations ?? []).map((item) => (
              <li key={item}>{item}</li>
            ))}
            {!insight?.recommendations?.length ? <li>No recommendations listed</li> : null}
          </ul>
        </div>
      </div>
      {insight?.nextAction ? (
        <div className="ax-ai-next">
          <Sparkles size={15} />
          <div>
            <span className="ax-kicker">Next action</span>
            <strong>{insight.nextAction}</strong>
          </div>
        </div>
      ) : null}
      {footer}
    </section>
  );
}
