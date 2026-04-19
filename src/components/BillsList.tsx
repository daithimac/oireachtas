import { useCallback } from 'react';
import { ScrollText } from 'lucide-react';
import { usePaginatedList } from '../hooks/usePaginatedList';
import { fetchLegislation } from '../api/oireachtas';
import type { Bill, Chamber } from '../types';
import { formatDateShort, billStatusLabel, billStatusClass } from '../utils/format';
import { viewToHash } from '../utils/routing';

interface BillsListProps {
  memberUri: string;
  chamber: Chamber;
  houseNo: number;
}

const PAGE_SIZE = 20;

export function BillsList({ memberUri, chamber, houseNo }: BillsListProps) {
  const fetcher = useCallback((skip: number, limit: number, signal?: AbortSignal) =>
    fetchLegislation(memberUri, limit, skip, chamber, houseNo, signal), [memberUri, chamber, houseNo]);

  const { items: allBills, total, loading, error, loadingMore, handleLoadMore } = usePaginatedList<Bill>(fetcher, 'bills', PAGE_SIZE);

  if (loading) {
    return (
      <div className="loading-state" role="status" aria-live="polite">
        <div className="spinner" aria-hidden="true" />
        <span>Loading legislation…</span>
      </div>
    );
  }

  if (error) {
    return <div className="error-banner" role="alert">Failed to load legislation: {error}</div>;
  }

  if (allBills.length === 0) {
    return (
      <div className="empty-state">
        <ScrollText className="empty-state__icon" size={40} aria-hidden="true" />
        <p>No legislation records found for this member.</p>
      </div>
    );
  }

  return (
    <>
      <div className="bill-list">
        {allBills.map((b) => (
          <div key={b.uri} className="bill-item">
            <div className="bill-item__header">
              <span className={`bill-status-badge ${billStatusClass(b.status)}`}>
                {billStatusLabel(b.status)}
              </span>
              <span className="bill-item__source">{b.source}</span>
            </div>
            <a 
              href={viewToHash({ kind: 'bill-viewer', billNo: b.billNo, billYear: b.billYear }, chamber, houseNo)}
              className="bill-item__title"
              style={{ display: 'block', textDecoration: 'none', color: 'var(--color-text-primary)' }}
            >
              {b.title}
            </a>
            <div className="bill-item__meta">
              <span className="bill-item__stage">📋 {b.currentStage}</span>
              <span className="bill-item__date">{formatDateShort(b.lastUpdated)}</span>
            </div>
            {b.sponsors.length > 0 && (
              <div className="bill-item__sponsors">
                Sponsors: {b.sponsors.join(', ')}
              </div>
            )}
          </div>
        ))}
      </div>

      {allBills.length < total && (
        <button className="load-more-btn" onClick={() => { void handleLoadMore(); }} disabled={loadingMore}>
          {loadingMore ? 'Loading…' : `Load more (${total - allBills.length} remaining)`}
        </button>
      )}
    </>
  );
}
