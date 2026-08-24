import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  AlertCircle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BadgeDollarSign,
  BarChart3,
  Bell,
  Bot,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  ClipboardList,
  ClipboardPlus,
  Clock3,
  CalendarDays,
  Command,
  FileCheck2,
  FileText,
  Filter,
  Gavel,
  Globe2,
  Handshake,
  Hospital,
  KeyRound,
  LayoutDashboard,
  ListFilter,
  LockKeyhole,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  RefreshCw,
  Search,
  Settings,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Stethoscope,
  Sun,
  UserRoundCheck,
  UsersRound,
  X,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api, asPercent, money } from '@/lib/api';
import { useAuth, isAdminRole } from '@/lib/auth';
import { toast } from '@/hooks/use-toast';
import type { WorkspaceView } from '../../workspace-types';
import { formatLabel, parseAiInsight, priorityTone, resolveJobInsight, statusTone } from '../../shared/format';
import { ErrorState, InsightCard, JobResultPanel, LoadingState, Metric, SectionHeading, StatusPill } from '../../shared/ui';
import { useTenantScope } from '../../shared/use-tenant-scope';
import './CountryPacks.css';

export function CountryPacks() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState('');
  const [note, setNote] = useState('');
  const packs = useQuery({ queryKey: ['country-packs'], queryFn: api.countryPacks });
  const adapters = useQuery({ queryKey: ['gateway-adapters'], queryFn: api.gatewayAdapters });
  const transition = useMutation({
    mutationFn: (input: { code: string; name: string; action: 'advance' | 'degrade' | 'retire' | 'restore' }) =>
      api.transitionPackInterface(input.code, input.name, input.action),
    onSuccess: (data) => {
      if (data?.error) return setNote(String(data.error));
      setNote(data.connectivitySummary ?? 'Pack updated');
      void queryClient.invalidateQueries({ queryKey: ['country-packs'] });
    },
    onError: (error: Error) => setNote(error.message),
  });

  if (packs.isLoading) return <div className="ax-view"><LoadingState label="Loading country packs…" /></div>;
  if (packs.error) return <div className="ax-view"><ErrorState error={packs.error} onRetry={() => void packs.refetch()} /></div>;

  const list = packs.data ?? [];
  const pack = list.find((item: any) => item.code === selected) ?? list[0];
  const adapterMeta = (adapters.data?.adapters ?? []).find((a: any) => a.key === pack?.adapterKey);
  const interfaceLabels: Record<string, string> = {
    eligibility: 'Eligibility',
    authorization: 'Authorization',
    claim: 'Claim submission',
    statusInquiry: 'Status inquiry',
    remittance: 'Remittance',
    priorAuthApi: 'CMS Prior Auth API',
  };

  return (
    <div className="ax-view">
      <SectionHeading
        eyebrow="Setup"
        title="Country settings"
        detail="A pack is a versioned capability contract: identifiers, coding, claim/eligibility/auth/remit interfaces, and certification state. It is not a live payer connection."
      />
      <div className="ax-pack-disclaimer">
        <Globe2 size={15} />
        <span>
          Certification lifecycle is CONFIG_ONLY → SANDBOX → PILOT → CERTIFIED (plus DEGRADED / RETIRED).
          Even CERTIFIED stays <b>simulated</b> until real credentials exist. Never treat this screen as live clearinghouse connectivity.
        </span>
      </div>
      {note ? (
        <div className="ax-insight-strip">
          <AlertCircle size={16} />
          <span>{note}</span>
        </div>
      ) : null}

      <section className="ax-panel ax-intake-note" style={{ marginBottom: 18 }}>
        <span className="ax-kicker">Data intake</span>
        <h3 style={{ margin: '6px 0 10px', fontFamily: 'var(--app-font-serif)' }}>How data enters Velora</h3>
        <p style={{ marginTop: 0, maxWidth: 720, color: 'var(--ax-soft)', lineHeight: 1.5 }}>
          Day-to-day work happens in <b style={{ color: 'var(--ax-ink)' }}>Check-in</b> — staff enter
          patients, insurance, visits, and bills in the app. No EHR is required.
        </p>
        <p style={{ marginTop: 0, maxWidth: 720, color: 'var(--ax-soft)', lineHeight: 1.5 }}>
          For hospitals that already have an EHR, Velora can also receive clinical data through optional connectors
          (FHIR R4, HL7 ADT/DFT, or partner JSON APIs). Those are integration projects — not something you click here.
        </p>
        <div className="ax-concept-list">
          <span>
            <CheckCircle2 size={14} />
            Check-in (this app)
          </span>
          <span>
            <CheckCircle2 size={14} />
            FHIR / HL7 / partner API (optional)
          </span>
        </div>
      </section>

      <div className="ax-packs-layout">
        <div className="ax-pack-list">
          {list.map((item: any) => (
            <button
              type="button"
              className={`ax-pack-row ${(selected || pack?.code) === item.code ? 'selected' : ''}`}
              key={item.code}
              onClick={() => setSelected(item.code)}
              data-testid={`button-country-pack-${item.code}`}
            >
              <span className="ax-country-code">{item.code}</span>
              <span>
                <b>{item.name}</b>
                <small>
                  {item.adapterKey ?? 'generic'} · {item.claimStandard}
                </small>
              </span>
              <StatusPill tone={item.liveConnectivity ? 'teal' : 'amber'}>
                {item.liveConnectivity ? 'Live' : 'Simulated'}
              </StatusPill>
              <ChevronRight size={15} />
            </button>
          ))}
        </div>
        {pack ? (
          <section className="ax-panel ax-pack-detail">
            <div className="ax-pack-hero">
              <span className="ax-country-code large">{pack.code}</span>
              <div>
                <span className="ax-kicker">Selected market layer</span>
                <h2>{pack.name}</h2>
                <StatusPill tone="amber">{pack.stage} · not live connectivity</StatusPill>
              </div>
            </div>
            <p className="ax-pack-connectivity">{pack.connectivitySummary}</p>
            <div className="ax-detail-list" style={{ marginBottom: 16 }}>
              <div>
                <span>Adapter</span>
                <b>{pack.adapterKey ?? 'generic'}</b>
              </div>
              <div>
                <span>Standard</span>
                <b>{pack.claimStandard}</b>
              </div>
              <div>
                <span>Clearinghouse</span>
                <b>{pack.clearinghouse ?? '—'}</b>
              </div>
              <div>
                <span>Adapter label</span>
                <b>{adapterMeta?.label ?? '—'}</b>
              </div>
            </div>
            <div className="ax-pack-sections">
              <div>
                <span className="ax-kicker">Interfaces</span>
                <div className="ax-pack-iface-list">
                  {(pack.interfaces ?? []).map((iface: any) => (
                    <div className="ax-pack-iface" key={iface.name} data-testid={`pack-iface-${pack.code}-${iface.name}`}>
                      <div className="ax-pack-iface-head">
                        <b>{interfaceLabels[iface.name] ?? iface.name}</b>
                        <StatusPill tone={statusTone(iface.certificationStatus)}>{iface.certificationStatus}</StatusPill>
                        <StatusPill tone={iface.connectivity === 'SIMULATED' ? 'blue' : 'amber'}>
                          {iface.connectivity === 'SIMULATED' ? 'Simulated' : 'Not enabled'}
                        </StatusPill>
                      </div>
                      {iface.notes ? <p>{iface.notes}</p> : null}
                      <div className="ax-pack-iface-actions">
                        {iface.certificationStatus === 'CONFIG_ONLY' || iface.certificationStatus === 'SANDBOX' || iface.certificationStatus === 'PILOT' ? (
                          <button
                            type="button"
                            className="ax-outline-button"
                            disabled={transition.isPending}
                            onClick={() => transition.mutate({ code: pack.code, name: iface.name, action: 'advance' })}
                          >
                            Advance
                          </button>
                        ) : null}
                        {iface.certificationStatus === 'CERTIFIED' || iface.certificationStatus === 'SANDBOX' || iface.certificationStatus === 'PILOT' ? (
                          <button
                            type="button"
                            className="ax-ghost-button"
                            disabled={transition.isPending}
                            onClick={() => transition.mutate({ code: pack.code, name: iface.name, action: 'degrade' })}
                          >
                            Degrade
                          </button>
                        ) : null}
                        {iface.certificationStatus === 'DEGRADED' || iface.certificationStatus === 'RETIRED' ? (
                          <button
                            type="button"
                            className="ax-outline-button"
                            disabled={transition.isPending}
                            onClick={() => transition.mutate({ code: pack.code, name: iface.name, action: 'restore' })}
                          >
                            Restore sandbox
                          </button>
                        ) : null}
                        {iface.certificationStatus !== 'RETIRED' ? (
                          <button
                            type="button"
                            className="ax-ghost-button"
                            disabled={transition.isPending}
                            onClick={() => transition.mutate({ code: pack.code, name: iface.name, action: 'retire' })}
                          >
                            Retire
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <span className="ax-kicker">Identifier types</span>
                <div className="ax-concept-list">
                  {(pack.identifierTypes ?? []).map((item: string) => (
                    <span key={item}>
                      <CheckCircle2 size={14} />
                      {item}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <span className="ax-kicker">Configured concepts</span>
                <div className="ax-concept-list">
                  {(pack.concepts ?? []).map((concept: string) => (
                    <span key={concept}>
                      <CheckCircle2 size={14} />
                      {concept}
                    </span>
                  ))}
                </div>
              </div>
              <div className="ax-pack-note">
                <SlidersHorizontal size={17} />
                <span>
                  <b>Designed to be adapted</b>
                  {pack.privacyNote || ' Map your facility, payer and integration conventions here. Velora Revenue OS does not replace local counsel or market-specific review.'}
                </span>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

