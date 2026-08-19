export type StatusTone = 'coral' | 'amber' | 'neutral' | 'teal' | 'blue';

export type AiInsightView = {
  headline: string;
  summary: string;
  factors?: string[];
  recommendations?: string[];
  riskLevel?: string;
  nextAction?: string;
};

export function formatLabel(value?: string) {
  if (!value) return '—';
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function parseAiInsight(raw: unknown): AiInsightView | null {
  if (!raw) return null;
  if (typeof raw === 'object') {
    const value = raw as Record<string, unknown>;
    const headline = String(value.headline ?? '').trim();
    const summary = String(value.summary ?? '').trim();
    if (headline || summary) {
      return {
        headline: headline || 'Analysis complete',
        summary: summary || headline,
        factors: Array.isArray(value.factors) ? value.factors.map(String) : undefined,
        recommendations: Array.isArray(value.recommendations) ? value.recommendations.map(String) : undefined,
        riskLevel: value.riskLevel ? String(value.riskLevel) : undefined,
        nextAction: value.nextAction ? String(value.nextAction) : undefined,
      };
    }
  }
  const text = String(raw).trim();
  if (!text) return null;
  try {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return parseAiInsight(JSON.parse(text.slice(start, end + 1)));
    }
  } catch {
    // fall through to plain text
  }
  const [first, ...rest] = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  return {
    headline: first.slice(0, 120),
    summary: rest.join(' ') || first,
  };
}

export function resolveJobInsight(payload: any): AiInsightView | null {
  if (!payload) return null;
  return (
    parseAiInsight(payload.ai?.insight) ||
    parseAiInsight(payload.insight) ||
    parseAiInsight(payload.ai?.raw) ||
    parseAiInsight(payload.ai?.execution?.output) ||
    parseAiInsight(payload.ai?.output) ||
    parseAiInsight(payload.draft) ||
    parseAiInsight(payload.appealDraft) ||
    null
  );
}

export function priorityTone(priority?: string): StatusTone {
  const p = (priority ?? '').toUpperCase();
  if (p === 'HIGH') return 'coral';
  if (p === 'MEDIUM') return 'amber';
  if (p === 'LOW') return 'teal';
  return 'neutral';
}

export function statusTone(status?: string): StatusTone {
  const s = (status ?? '').toUpperCase();
  if (s.includes('OPEN') || s.includes('EXCEPTION') || s.includes('DENIED') || s.includes('FAIL') || s.includes('RECOUP')) return 'coral';
  if (s.includes('BLOCK') || s.includes('WARN') || s.includes('PENDING') || s.includes('WORKING') || s.includes('CONFIG') || s.includes('RETIRE') || s.includes('DEGRAD') || s.includes('SANDBOX') || s.includes('PILOT')) return 'amber';
  if (s.includes('READY') || s.includes('ACTIVE') || s.includes('APPROVED') || s.includes('RESOLVED') || s.includes('PAID') || s.includes('CERTIF')) return 'teal';
  if (s.includes('SUBMIT') || s.includes('PROGRESS')) return 'blue';
  return 'neutral';
}
