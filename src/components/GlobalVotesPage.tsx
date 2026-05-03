import { useCallback, useEffect, useState } from 'react';
import { Link, Share2, Vote } from 'lucide-react';
import { fetchChamberVotes, fetchHouseDateRange } from '../api/oireachtas';
import type { ChamberType } from '../api/oireachtas';
import { usePaginatedList } from '../hooks/usePaginatedList';
import type { Chamber, ChamberVote, View } from '../types';
import { getHouseDateRange, chamberName } from '../utils/dail';
import { formatDateShort } from '../utils/format';
import { viewToHash } from '../utils/routing';
import { ShareModal } from './ShareModal';

interface GlobalVotesPageProps {
  chamber: Chamber;
  houseNo: number;
  onNavigate: (view: View) => void;
}

const PAGE_SIZE = 50;

function outcomeClass(outcome: string): string {
  const lower = outcome.toLowerCase();
  if (lower.includes('carried')) return 'outcome-badge--carried';
  if (lower.includes('lost') || lower.includes('defeated') || lower.includes('rejected')) return 'outcome-badge--lost';
  return '';
}



export function GlobalVotesPage({ chamber, houseNo, onNavigate }: GlobalVotesPageProps) {
  const [range, setRange] = useState(() => getHouseDateRange(chamber, houseNo));
  const [dateStart, setDateStart] = useState(() => getHouseDateRange(chamber, houseNo).start);
  const [dateEnd, setDateEnd] = useState(() => getHouseDateRange(chamber, houseNo).end);

  useEffect(() => {
    let active = true;
    void fetchHouseDateRange(chamber, houseNo).then(r => {
      if (!active) return;
      setRange(r);
      setDateStart(r.start);
      setDateEnd(r.end);
    });
    return () => { active = false; };
  }, [chamber, houseNo]);
  const [outcome, setOutcome] = useState('');
  const [chamberType, setChamberType] = useState<Extract<ChamberType, 'house' | 'committee'>>('house');
  const [query, setQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [shareContext, setShareContext] = useState<{ url: string; title?: string; description?: string } | null>(null);

  const fetcher = useCallback((skip: number, limit: number, signal?: AbortSignal) =>
    fetchChamberVotes(limit, skip, chamber, houseNo, signal, dateStart, dateEnd, outcome, chamberType, searchQuery),
    [chamber, houseNo, dateStart, dateEnd, outcome, chamberType, searchQuery]
  );

  const { items: votes, total, loading, error, loadingMore, handleLoadMore } =
    usePaginatedList<ChamberVote>(fetcher, 'votes', PAGE_SIZE);

  const openShare = (vote: ChamberVote) => {
    const url = window.location.origin + window.location.pathname +
      viewToHash({ kind: 'vote-detail', voteUri: vote.uri, title: vote.title }, chamber, houseNo);
    const title = `Oireachtas Explorer: ${vote.title} vote`;
    const description = `Outcome: ${vote.outcome}. Tá: ${vote.tallyFor}, Níl: ${vote.tallyAgainst}.`;
    setShareContext({ url, title, description });
  };

  return (
    <div className="container votes-page">
      {shareContext && (
        <ShareModal 
          url={shareContext.url} 
          title={shareContext.title} 
          description={shareContext.description} 
          onClose={() => { setShareContext(null); }} 
        />
      )}

      <div className="votes-page__header">
        <div>
          <h1 className="section-heading section-heading--tight">{chamberName(chamber)} Votes</h1>
          <p className="section-subheading section-subheading--spaced">
            Chronological chamber votes for the selected session.
          </p>
        </div>
      </div>

      <div className="votes-toolbar">
        <label>
          <span>Scope</span>
          <select
            value={chamberType}
            onChange={(event) => { setChamberType(event.target.value === 'committee' ? 'committee' : 'house'); }}
          >
            <option value="house">{chamber === 'dail' ? 'Dáil' : 'Seanad'}</option>
            <option value="committee">Committees</option>
          </select>
        </label>
        <label>
          <span>From</span>
          <input type="date" value={dateStart} min={range.start} max={range.end}
            onChange={(event) => { setDateStart(event.target.value); }} />
        </label>
        <label>
          <span>To</span>
          <input type="date" value={dateEnd} min={range.start} max={range.end}
            onChange={(event) => { setDateEnd(event.target.value); }} />
        </label>
        <label>
          <span>Outcome</span>
          <select value={outcome} onChange={(event) => { setOutcome(event.target.value); }}>
            <option value="">All outcomes</option>
            <option value="Carried">Carried</option>
            <option value="Lost">Lost</option>
          </select>
        </label>
        <label className="votes-toolbar__search">
          <span>Search</span>
          <input type="search" value={query} placeholder="Search votes..."
            onChange={(event) => { setQuery(event.target.value); }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                setSearchQuery(query);
              }
            }}
          />
        </label>
      </div>

      {loading && (
        <div className="loading-state" role="status" aria-live="polite">
          <div className="spinner" aria-hidden="true" />
          <span>Loading votes…</span>
        </div>
      )}

      {error && <div className="error-banner" role="alert">Failed to load votes: {error}</div>}

      {!loading && !error && votes.length === 0 && (
        <div className="empty-state">No votes were found for this date range.</div>
      )}

      {!loading && !error && votes.length > 0 && (
        <div className="chamber-vote-list">
          {votes.map((vote) => (
            <article key={vote.uri} className="chamber-vote-row">
              <button
                className="chamber-vote-row__main"
                onClick={() => { onNavigate({ kind: 'vote-detail', voteUri: vote.uri, title: vote.title }); }}
              >
                <div className="chamber-vote-row__icon" aria-hidden="true">
                  <Vote size={18} />
                </div>
                <div className="chamber-vote-row__body">
                  <h2>{vote.title}</h2>
                  <div className="chamber-vote-row__meta">
                    <span>{formatDateShort(vote.date)}</span>
                    {vote.outcome && <span className={`outcome-badge ${outcomeClass(vote.outcome)}`}>{vote.outcome}</span>}
                    {(vote.topic || vote.category) && <span>{vote.topic || vote.category}</span>}
                  </div>
                </div>
                <div className="chamber-vote-row__tally" aria-label={`${vote.tallyFor} Tá and ${vote.tallyAgainst} Níl`}>
                  <strong className="vote-count vote-count--ta">{vote.tallyFor}</strong>
                  <span>Tá</span>
                  <strong className="vote-count vote-count--nil">{vote.tallyAgainst}</strong>
                  <span>Níl</span>
                </div>
              </button>
              <div className="chamber-vote-row__actions">
                <button type="button" onClick={() => { openShare(vote); }} aria-label={`Share ${vote.title}`}>
                  <Share2 size={15} aria-hidden="true" />
                  Share
                </button>
                <button type="button" onClick={() => { onNavigate({ kind: 'vote-detail', voteUri: vote.uri, title: vote.title }); }}>
                  <Link size={15} aria-hidden="true" />
                  View voters
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {!loading && !error && votes.length < total && (
        <button className="load-more-btn" onClick={() => { void handleLoadMore(); }} disabled={loadingMore}>
          {loadingMore ? 'Loading…' : `Load more (${total - votes.length} remaining)`}
        </button>
      )}
    </div>
  );
}
