import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Inbox, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { formatLabel } from '../../shared/format';
import { ErrorState, LoadingState, StatusPill } from '../../shared/ui';
import './Integrations.css';

export function Integrations() {
  const queryClient = useQueryClient();
  const inbox = useQuery({ queryKey: ['integration-messages'], queryFn: api.integrationMessages });

  if (inbox.isLoading) {
    return (
      <div className="ax-view">
        <LoadingState label="Loading integrations…" />
      </div>
    );
  }
  if (inbox.error) {
    return (
      <div className="ax-view">
        <ErrorState error={inbox.error} onRetry={() => void inbox.refetch()} />
      </div>
    );
  }

  const rows = inbox.data ?? [];
  const openCount = rows.filter((row: { status?: string }) => row.status !== 'PROCESSED').length;

  return (
    <div className="ax-view ax-integrations">
      <header className="ax-int-hero">
        <div>
          <span className="ax-int-eyebrow">Connectivity</span>
          <h1>Integrations</h1>
          <p>Clearinghouse and partner message inbox — review traffic and retry failures.</p>
        </div>
        <div className="ax-int-hero-stats">
          <article>
            <span>Open</span>
            <b>{openCount}</b>
          </article>
          <article>
            <span>Total</span>
            <b>{rows.length}</b>
          </article>
        </div>
      </header>

      <section className="ax-int-panel">
        <div className="ax-int-panel-head">
          <div>
            <Inbox size={18} />
            <h2>Message center</h2>
          </div>
          <button className="ax-int-refresh" type="button" onClick={() => void inbox.refetch()}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {rows.length ? (
          <div className="ax-int-table" role="table">
            <div className="ax-int-table-head" role="row">
              <span>Type</span>
              <span>Direction</span>
              <span>Entity</span>
              <span>Status</span>
              <span />
            </div>
            {rows.slice(0, 40).map((row: any) => (
              <div className="ax-int-row" role="row" key={row.id}>
                <div>
                  <b>{formatLabel(row.messageType)}</b>
                  <small>{row.adapterKey || row.integrationId || '—'}</small>
                </div>
                <span>{row.direction ?? '—'}</span>
                <span>{row.internalEntityId || '—'}</span>
                <StatusPill
                  tone={row.status === 'ERROR' ? 'coral' : row.status === 'PROCESSED' ? 'teal' : 'amber'}
                >
                  {formatLabel(row.status)}
                </StatusPill>
                <button
                  className="ax-int-action"
                  type="button"
                  onClick={() =>
                    void api
                      .retryIntegrationMessage(row.id)
                      .then(() => queryClient.invalidateQueries({ queryKey: ['integration-messages'] }))
                  }
                >
                  Retry
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="ax-int-empty">No integration messages yet. Inbound traffic will land here.</p>
        )}
      </section>
    </div>
  );
}
