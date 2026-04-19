import { useCallback, useState, useEffect, useMemo } from 'react';
import { usePaginatedList } from '../hooks/usePaginatedList';
import { fetchGlobalDebates, type ChamberType } from '../api/oireachtas';
import type { Chamber, Debate, View } from '../types';
import { formatDateShort } from '../utils/format';
import { getHouseDateRange, chamberName } from '../utils/dail';
import { DEFAULT_PAGE_SIZE } from '../constants';

interface GlobalDebatesListProps {
  chamber: Chamber;
  houseNo: number;
  onNavigateToDebate: (view: View) => void;
}

// Extract a committee code from an Oireachtas debate URI.
// Shape: https://data.oireachtas.ie/akn/ie/debateRecord/{chamber_or_committee}/{date}/...
// Chamber segments are 'dail' or 'seanad'; anything else is a committee slug.
function committeeCodeFromUri(uri: string): string | null {
  const match = /\/debateRecord\/([a-z][a-z0-9_]+)\//i.exec(uri);
  if (!match) return null;
  const seg = match[1].toLowerCase();
  if (seg === 'dail' || seg === 'seanad') return null;
  return seg;
}

function humanizeCommittee(code: string): string {
  return code
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function committeeCodeForDebate(d: Debate): string | null {
  const fromUri = committeeCodeFromUri(d.uri);
  if (fromUri) return fromUri;
  for (const s of d.sections) {
    const code = committeeCodeFromUri(s.uri);
    if (code) return code;
  }
  return null;
}

interface DebateRow {
  key: string;
  debate: Debate;
  sectionUri: string;
  title: string;
  committeeCode: string | null;
}

function flattenDebates(debates: Debate[]): DebateRow[] {
  const rows: DebateRow[] = [];
  for (const d of debates) {
    const fallbackCode = committeeCodeForDebate(d);
    if (d.sections.length > 0) {
      for (const s of d.sections) {
        rows.push({
          key: `${d.uri}::${s.uri}`,
          debate: d,
          sectionUri: s.uri,
          title: s.title,
          committeeCode: committeeCodeFromUri(s.uri) ?? fallbackCode,
        });
      }
    } else if (d.debateSectionUri) {
      rows.push({
        key: d.uri,
        debate: d,
        sectionUri: d.debateSectionUri,
        title: d.title,
        committeeCode: fallbackCode,
      });
    }
  }
  return rows;
}

export function GlobalDebatesList({ chamber, houseNo, onNavigateToDebate }: GlobalDebatesListProps) {
  const [chamberType, setChamberType] = useState<ChamberType>('house');
  const [committeeCode, setCommitteeCode] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const range = getHouseDateRange(chamber, houseNo);
    setDateStart(range.start);
    const today = new Date().toISOString().split('T')[0];
    setDateEnd(range.end > today ? today : range.end);
  }, [chamber, houseNo]);

  useEffect(() => {
    const t = setTimeout(() => { setSearchTerm(searchInput.trim()); }, 200);
    return () => { clearTimeout(t); };
  }, [searchInput]);

  // Reset committee filter when chamber changes
  useEffect(() => {
    setCommitteeCode('');
  }, [chamberType]);

  const fetcher = useCallback((skip: number, limit: number, signal?: AbortSignal) =>
    fetchGlobalDebates(limit, skip, chamber, houseNo, chamberType, dateStart || undefined, dateEnd || undefined, signal),
  [chamber, houseNo, chamberType, dateStart, dateEnd]);

  const { items: allDebates, total, loading, error, loadingMore, handleLoadMore } = usePaginatedList<Debate>(fetcher, 'debates', DEFAULT_PAGE_SIZE);

  const allRows = useMemo(() => flattenDebates(allDebates), [allDebates]);

  // Committee dropdown: count per-section rows so the tallies reflect what
  // the user actually sees, not the number of sitting days.
  const availableCommittees = useMemo(() => {
    if (chamberType !== 'committee') return [];
    const counts = new Map<string, number>();
    for (const r of allRows) {
      if (r.committeeCode) counts.set(r.committeeCode, (counts.get(r.committeeCode) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([code, count]) => ({ code, name: humanizeCommittee(code), count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [allRows, chamberType]);

  const term = searchTerm.toLowerCase();

  const filteredRows = useMemo(() => {
    return allRows.filter((r) => {
      if (chamberType === 'committee' && committeeCode) {
        if (r.committeeCode !== committeeCode) return false;
      }
      if (!term) return true;
      if (r.title.toLowerCase().includes(term)) return true;
      if (r.debate.chamber.toLowerCase().includes(term)) return true;
      if (r.debate.date.includes(term)) return true;
      return false;
    });
  }, [allRows, chamberType, committeeCode, term]);

  if (loading) {
    return (
      <div className="loading-state" role="status" aria-live="polite">
        <div className="spinner" aria-hidden="true" />
        <span>Loading all debates…</span>
      </div>
    );
  }

  if (error) {
    return <div className="error-banner" role="alert">Failed to load debates: {error}</div>;
  }

  return (
    <>
      <div style={{ marginBottom: '24px', padding: '20px', borderRadius: '12px', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '16px' }}>
          <div style={{ flex: '1 1 180px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>Chamber Type</label>
            <select
              value={chamberType}
              onChange={e => { setChamberType(e.target.value as ChamberType); }}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '2px solid var(--color-border)', fontFamily: 'inherit', color: 'var(--color-text)', background: 'white' }}
            >
              <option value="house">{chamberName(chamber)} Plenary</option>
              <option value="committee">Committees</option>
              <option value="">All Debates</option>
            </select>
          </div>

          {chamberType === 'committee' && (
            <div style={{ flex: '1 1 220px', animation: 'fadeInUp 0.2s ease' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                Committee {availableCommittees.length > 0 && `(${availableCommittees.length} loaded)`}
              </label>
              <select
                value={committeeCode}
                onChange={e => { setCommitteeCode(e.target.value); }}
                disabled={availableCommittees.length === 0}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '2px solid var(--color-border)', fontFamily: 'inherit', color: 'var(--color-text)', background: 'white' }}
              >
                <option value="">All committees in loaded results</option>
                {availableCommittees.map(c => (
                  <option key={c.code} value={c.code}>{c.name} ({c.count})</option>
                ))}
              </select>
              {availableCommittees.length === 0 && (
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                  Load more results to populate committees.
                </div>
              )}
            </div>
          )}

          <div style={{ flex: '1 1 140px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>Start Date</label>
            <input
              type="date"
              value={dateStart}
              onChange={e => { setDateStart(e.target.value); }}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-md)', border: '2px solid var(--color-border)', fontFamily: 'inherit', color: 'var(--color-text)' }}
            />
          </div>

          <div style={{ flex: '1 1 140px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>End Date</label>
            <input
              type="date"
              value={dateEnd}
              onChange={e => { setDateEnd(e.target.value); }}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-md)', border: '2px solid var(--color-border)', fontFamily: 'inherit', color: 'var(--color-text)' }}
            />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
            Search
            {term && (
              <span style={{ marginLeft: 8, fontWeight: 400, color: 'var(--color-text-secondary)' }}>
                — {filteredRows.length} of {allRows.length} loaded match
              </span>
            )}
          </label>
          <input
            type="text"
            placeholder="Search loaded debates by title, section, chamber or date (YYYY-MM-DD)…"
            value={searchInput}
            onChange={e => { setSearchInput(e.target.value); }}
            style={{ width: '100%', padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '2px solid var(--color-border)', fontFamily: 'inherit', fontSize: '15px' }}
          />
        </div>
      </div>

      <div className="debate-list">
        {filteredRows.length === 0 ? (
           <div className="error-banner">No debates match your filters in the loaded results. Try clearing the search, changing committee, or loading more.</div>
        ) : filteredRows.map((r) => {
          const canRead = !!r.debate.xmlUri;
          return (
            <div key={r.key} className="debate-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="debate-item__title" style={{ fontWeight: 600 }}>{r.title}</div>
                <div className="debate-item__meta" style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                  <span>{formatDateShort(r.debate.date)}</span>
                  <span style={{ margin: '0 6px' }}>·</span>
                  <span>{r.debate.chamber}</span>
                </div>
              </div>
              {canRead && (
                <button
                  className="read-transcript-btn"
                  onClick={() => { onNavigateToDebate({
                    kind: 'debate-viewer',
                    xmlUri: r.debate.xmlUri ?? '',
                    debateSectionUri: r.sectionUri,
                    title: r.title,
                  }); }}
                  style={{ fontSize: '0.8rem', padding: '6px 12px', borderRadius: 'var(--radius-pill)', background: 'var(--color-accent)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600, flexShrink: 0 }}
                >
                  Transcript
                </button>
              )}
            </div>
          );
        })}
      </div>

      {allDebates.length < total && (
        <button className="load-more-btn" style={{ marginTop: '1rem' }} onClick={() => { void handleLoadMore(); }} disabled={loadingMore}>
          {loadingMore ? 'Loading…' : `Load more (${total - allDebates.length} days remaining)`}
        </button>
      )}
    </>
  );
}
