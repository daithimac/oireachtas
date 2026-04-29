import { useMemo } from 'react';
import { Landmark } from 'lucide-react';
import { houseLabel, memberNoun } from '../utils/dail';
import { MemberCard } from './MemberCard';
import type { Chamber, Member } from '../types';

interface MemberGridProps {
  constituencyCode: string;
  constituencyName: string;
  chamber: Chamber;
  houseNo: number;
  allMembers: Member[];
  loadingAllMembers: boolean;
  onSelectMember: (memberId: string, memberName: string, constituencyCode: string, constituencyName: string) => void;
  onBack: () => void;
}

export function MemberGrid({
  constituencyCode,
  constituencyName,
  chamber,
  houseNo,
  allMembers,
  loadingAllMembers,
  onSelectMember,
  onBack,
}: MemberGridProps) {
  const nounSingular = memberNoun(chamber);
  const nounPlural = memberNoun(chamber, true);
  const members = useMemo(
    () => allMembers.filter((m) => m.constituencyCode === constituencyCode),
    [allMembers, constituencyCode]
  );

  return (
    <div className="container">
      <button className="back-btn" onClick={onBack} aria-label="Back to all constituencies">← All constituencies</button>

      <div className="member-grid-page__header">
        <h2 className="section-heading">{constituencyName}</h2>
        <p className="section-subheading">
          {!loadingAllMembers ? `${members.length} ${members.length === 1 ? nounSingular : nounPlural}` : ''}
          {' · '}{houseLabel(chamber, houseNo)}
        </p>
      </div>

      {loadingAllMembers && (
        <div className="loading-state" role="status" aria-live="polite">
          <div className="spinner" aria-hidden="true" />
          <span>Loading representatives…</span>
        </div>
      )}

      {!loadingAllMembers && members.length === 0 && (
        <div className="empty-state">
          <Landmark className="empty-state__icon" size={40} aria-hidden="true" />
          <p>No {nounPlural} found for this constituency in the {houseLabel(chamber, houseNo)}.</p>
        </div>
      )}

      {!loadingAllMembers && members.length > 0 && (
        <div className="member-grid" aria-label={`${nounPlural} for ${constituencyName}`}>
          {members.map((m) => (
            <MemberCard
              key={m.memberCode}
              member={m}
              chamber={chamber}
              houseNo={houseNo}
              constituencyCode={constituencyCode}
              constituencyName={constituencyName}
              onClick={() => { onSelectMember(m.uri, m.fullName, constituencyCode, constituencyName); }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
