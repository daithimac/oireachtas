import { useState, useCallback } from 'react';
import { usePaginatedList } from '../hooks/usePaginatedList';
import { fetchDivisions } from '../api/oireachtas';
import type { Chamber, Division } from '../types';
import { formatDateShort } from '../utils/format';
import { viewToHash } from '../utils/routing';
import { fetchDebateTranscript } from '../api/transcripts';

interface VotesListProps {
  memberUri: string;
  chamber: Chamber;
  houseNo: number;
}

// Matches fetchVoteBreakdown's page size so the first-page request URL is
// identical, letting the session cache serve both from a single network call.
const PAGE_SIZE = 200;

function voteIcon(v: string) {
  if (v === 'ta') return '✅';
  if (v === 'nil') return '❌';
  return '➖';
}

function voteClass(v: string) {
  if (v === 'ta') return 'vote-indicator--ta';
  if (v === 'nil') return 'vote-indicator--nil';
  return 'vote-indicator--staon';
}

function outcomeClass(o: string) {
  const lower = o.toLowerCase();
  if (lower.includes('carried')) return 'outcome-badge--carried';
  if (lower.includes('lost')) return 'outcome-badge--lost';
  return '';
}

export function VotesList({ memberUri, chamber, houseNo }: VotesListProps) {
  const [spokeStatus, setSpokeStatus] = useState<Partial<Record<string, 'loading' | 'spoke' | 'did-not-speak'>>>({});

  const fetcher = useCallback((skip: number, limit: number, signal?: AbortSignal) =>
    fetchDivisions(memberUri, limit, skip, chamber, houseNo, signal), [memberUri, chamber, houseNo]);

  const handleCheckSpoke = useCallback(async (d: Division) => {
    if (!d.xmlUri || !d.debateSectionUri) return;
    setSpokeStatus(prev => ({ ...prev, [d.uri]: 'loading' }));
    try {
      const segments = await fetchDebateTranscript(d.xmlUri, d.debateSectionUri, memberUri);
      if (segments.length > 0) {
        setSpokeStatus(prev => ({ ...prev, [d.uri]: 'spoke' }));
      } else {
        setSpokeStatus(prev => ({ ...prev, [d.uri]: 'did-not-speak' }));
      }
    } catch {
      setSpokeStatus(prev => ({ ...prev, [d.uri]: 'did-not-speak' }));
    }
  }, [memberUri]);

  const { items: allDivisions, total, loading, error, loadingMore, handleLoadMore } = usePaginatedList<Division>(fetcher, 'divisions', PAGE_SIZE);

  if (loading) {
    return (
      <div className="loading-state" role="status" aria-live="polite">
        <div className="spinner" aria-hidden="true" />
        <span>Loading voting record…</span>
      </div>
    );
  }

  if (error) {
    return <div className="error-banner" role="alert">Failed to load votes: {error}</div>;
  }

  if (allDivisions.length === 0) {
    return <div className="empty-state">No voting records found.</div>;
  }

  return (
    <>
      <div className="vote-list">
        {allDivisions.map((d) => {
          const canRead = !!(d.xmlUri && d.debateSectionUri);
          const status = spokeStatus[d.uri];
          return (
            <div key={d.uri} className="vote-item">
              <div className={`vote-indicator ${voteClass(d.voteType)}`} title={d.voteLabel}>
                {voteIcon(d.voteType)}
              </div>
              <div className="vote-item__body">
                <div className="vote-item__title">{d.title}</div>
                <div className="vote-item__meta">
                  <span className="vote-item__date">{formatDateShort(d.date)}</span>
                  {d.outcome && (
                    <span className={`outcome-badge ${outcomeClass(d.outcome)}`}>
                      {d.outcome}
                    </span>
                  )}
                </div>
                {canRead && (
                  <div className="vote-item__actions" style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <a 
                      className="read-context-btn" 
                      href={viewToHash({ kind: 'debate-viewer', xmlUri: d.xmlUri ?? '', debateSectionUri: d.debateSectionUri ?? '', title: d.title, focusMemberUri: memberUri }, chamber, houseNo)}
                      style={{ display: 'inline-block', fontSize: '0.85rem', padding: '4px 12px', borderRadius: '4px', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', textDecoration: 'none', border: '1px solid var(--color-border)', cursor: 'pointer' }}
                    >
                      ↗ View Debate Background
                    </a>

                    {!status && (
                      <button 
                        onClick={() => { void handleCheckSpoke(d); }}
                        style={{ fontSize: '0.85rem', padding: '4px 8px', borderRadius: '4px', background: 'transparent', color: 'var(--color-text-secondary)', border: '1px dashed var(--color-border)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        🎤 Check if Spoke?
                      </button>
                    )}
                    {status === 'loading' && (
                      <span style={{ fontSize: '0.85rem', color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>Checking...</span>
                    )}
                    {status === 'spoke' && (
                      <span style={{ fontSize: '0.85rem', color: 'var(--color-success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        🗣️ Spoke in context
                      </span>
                    )}
                    {status === 'did-not-speak' && (
                      <span style={{ fontSize: '0.85rem', color: 'var(--color-text-tertiary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        😶 Did not speak
                      </span>
                    )}
                  </div>
                )}
              </div>
              {(d.tallyFor > 0 || d.tallyAgainst > 0) && (
                <div className="vote-tally">
                  <span style={{ color: 'var(--color-vote-for)' }}>{d.tallyFor}</span>
                  {' – '}
                  <span style={{ color: 'var(--color-vote-against)' }}>{d.tallyAgainst}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {allDivisions.length < total && (
        <button className="load-more-btn" onClick={() => { void handleLoadMore(); }} disabled={loadingMore}>
          {loadingMore ? 'Loading…' : `Load more (${total - allDivisions.length} remaining)`}
        </button>
      )}
    </>
  );
}
