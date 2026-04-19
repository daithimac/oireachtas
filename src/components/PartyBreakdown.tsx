import { useMemo } from 'react';
import type { Chamber, Member } from '../types';
import { partyColor } from '../utils/format';
import { viewToHash } from '../utils/routing';
import { chamberName, memberNoun } from '../utils/dail';

interface PartyBreakdownProps {
  members: Member[];
  loading: boolean;
  chamber: Chamber;
  houseNo: number;
}

interface PartyGroup {
  party: string;
  count: number;
  color: string;
  pct: number;
}

export function PartyBreakdown({ members, loading, chamber, houseNo }: PartyBreakdownProps) {
  const compositionTitle = `${chamberName(chamber)} Composition`;
  const groups = useMemo<PartyGroup[]>(() => {
    if (!members.length) return [];
    const counts = new Map<string, number>();
    for (const m of members) {
      counts.set(m.party, (counts.get(m.party) ?? 0) + 1);
    }
    const total = members.length;
    return Array.from(counts.entries())
      .map(([party, count]) => ({
        party,
        count,
        color: partyColor(party),
        pct: (count / total) * 100,
      }))
      .sort((a, b) => b.count - a.count);
  }, [members]);

  if (loading) {
    return (
      <div className="party-breakdown party-breakdown--loading">
        <div className="party-breakdown__title">{compositionTitle}</div>
        <div className="party-breakdown__bar party-breakdown__bar--skeleton" />
        <div className="party-breakdown__legend-skeleton">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="party-breakdown__skel-chip" />
          ))}
        </div>
      </div>
    );
  }

  if (!groups.length) return null;

  const total = members.length;

  return (
    <div className="party-breakdown">
      <div className="party-breakdown__header">
        <span className="party-breakdown__title">{compositionTitle}</span>
        <span className="party-breakdown__total">{total} {memberNoun(chamber, true)}</span>
      </div>

      {/* Stacked bar */}
      <div className="party-breakdown__bar" role="img" aria-label="Party composition bar chart">
        {groups.map((g) => (
          <div
            key={g.party}
            className="party-breakdown__segment"
            style={{ width: `${g.pct}%`, backgroundColor: g.color }}
            title={`${g.party}: ${g.count} (${g.pct.toFixed(1)}%)`}
          >
            {g.pct >= 6 && (
              <span className="party-breakdown__segment-label">{g.count}</span>
            )}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="party-breakdown__legend">
        {groups.map((g) => (
          <a key={g.party} className="party-breakdown__legend-item" href={viewToHash({ kind: 'party', partyName: g.party }, chamber, houseNo)} style={{ textDecoration: 'none' }}>
            <span
              className="party-breakdown__legend-swatch"
              style={{ backgroundColor: g.color }}
            />
            <span className="party-breakdown__legend-name" style={{ color: 'var(--color-text-primary)' }}>{g.party}</span>
            <span className="party-breakdown__legend-count" style={{ color: 'var(--color-text-secondary)' }}>{g.count}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
