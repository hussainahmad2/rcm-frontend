import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Inbox, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { formatLabel, statusTone } from '../../shared/format';
import { ErrorState, LoadingState, SectionHeading, StatusPill } from '../../shared/ui';

export function MessageCenter() {
  const queryClient = useQueryClient();
  const inbox = useQuery({ queryKey: ['integration-messages'], queryFn: api.integrationMessages });
  const [status, setStatus] = useState('ALL');

  const rows = useMemo(() => {
    const list = inbox.data ?? [];
    if (status === 'ALL') return list;
    return list.filter((row: any) => row.status === status);
  }, [inbox.data, status]);

  if (inbox.isLoading) return <div className="ax-view"><LoadingState label="Loading message center…" /></div>;
  if (inbox.error) return <div className="ax-view"><ErrorState error={inbox.error} onRetry={() => void inbox.refetch()} /></div>;

  const filters = ['ALL', 'RECEIVED', 'PROCESSED', 'ERROR', 'RETRY'];

  return (
    <div className="ax-view">
      <SectionHeading
        eyebrow="Operations inbox"
        title="Message center"
        detail="Clearinghouse, eligibility, and partner traffic land here. Retry failed messages without leaving the workspace."
        action={
          <button className="ax-outline-button" type="button" onClick={() => void inbox.refetch()}>
            <RefreshCw size={14} /> Refresh
          </button>
        }
      />
      <div className="ax-inline-controls" style={{ marginBottom: 12 }}>
        {filters.map((value) => (
          <button
            key={value}
            type="button"
            className={status === value ? 'ax-filter-active' : 'ax-outline-button'}
            onClick={() => setStatus(value)}
          >
            {formatLabel(value)}
          </button>
        ))}
      </div>
      <section className="ax-panel ax-table-panel">
        <div className="ax-panel-head">
          <div>
            <span className="ax-kicker">Integration traffic</span>
            <h2>{rows.length} messages</h2>
          </div>
        </div>
        {rows.length === 0 ? (
          <div className="ax-empty">
            <Inbox size={22} />
            <b>Inbox is quiet</b>
            <p>Partner traffic, 277 acknowledgements, and retryable errors appear here after a submit or eligibility check.</p>
          </div>
        ) : (
          <div className="ax-claims-table">
            <div className="ax-table-head">
              <span>Type</span>
              <span>Direction</span>
              <span>Entity</span>
              <span>Status</span>
              <span>Action</span>
            </div>
            {rows.map((row: any) => (
              <div className="ax-claim-row" key={row.id} data-testid={`row-inbox-${row.id}`}>
                <span>
                  <b>{formatLabel(row.messageType)}</b>
                  <small>{row.adapterKey || row.integrationId}</small>
                </span>
                <span>{row.direction}</span>
                <span>{row.internalEntityId || '—'}</span>
                <StatusPill tone={statusTone(row.status)}>{formatLabel(row.status)}</StatusPill>
                <button
                  className="ax-outline-button"
                  type="button"
                  onClick={() =>
                    api.retryIntegrationMessage(row.id).then(() => void queryClient.invalidateQueries({ queryKey: ['integration-messages'] }))
                  }
                >
                  Retry
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
