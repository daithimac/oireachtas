import { useMemo } from 'react';
import { Users } from 'lucide-react';
import type { Chamber, Member } from '../types';
import { partyColor } from '../utils/format';
import { memberNoun } from '../utils/dail';

interface CommitteePageProps {
  committeeUri: string;
  committeeName: string;
  chamber: Chamber;
  houseNo?: number;
  allMembers: Member[];
  loadingAllMembers: boolean;
  onSelectMember: (memberUri: string, memberName: string, constituencyCode: string, constituencyName: string) => void;
  onBack: () => void;
}

const ROLE_ORDER: Record<string, number> = {
  Cathaoirleach: 0,
  'Leas-Cathaoirleach': 1,
  Chair: 0,
  'Vice-Chair': 1,
};

export function CommitteePage({
  committeeUri,
  committeeName,
  chamber,
  allMembers,
  loadingAllMembers,
  onSelectMember,
  onBack,
}: CommitteePageProps) {
  const committeeMembers = useMemo(() => {
    const results: { member: Member; role: string }[] = [];
    for (const m of allMembers) {
      if (!m.committees) continue;
      const membership = m.committees.find(c => c.uri === committeeUri);
      if (membership) results.push({ member: m, role: membership.role });
    }
    results.sort((a, b) => {
      const ra = ROLE_ORDER[a.role] ?? 99;
      const rb = ROLE_ORDER[b.role] ?? 99;
      if (ra !== rb) return ra - rb;
      return a.member.lastName.localeCompare(b.member.lastName);
    });
    return results;
  }, [allMembers, committeeUri]);

  return (
    <div className="container">
      <button className="back-btn" onClick={onBack} aria-label="Go back">← Back</button>

      <div className="member-grid-page__header">
        <h2 className="section-heading">{committeeName}</h2>
        {!loadingAllMembers && (
          <p className="section-subheading">
            {committeeMembers.length} {memberNoun(chamber, committeeMembers.length !== 1)}
          </p>
        )}
      </div>

      {loadingAllMembers && (
        <div className="loading-state" role="status" aria-live="polite">
          <div className="spinner" aria-hidden="true" />
          <span>Loading committee members…</span>
        </div>
      )}

      {!loadingAllMembers && committeeMembers.length === 0 && (
        <div className="empty-state">
          <Users className="empty-state__icon" size={40} aria-hidden="true" />
          <p>No current members found for this committee.</p>
        </div>
      )}

      {!loadingAllMembers && committeeMembers.length > 0 && (
        <div className="committee-member-list">
          {committeeMembers.map(({ member: m, role }) => (
            <button
              key={m.uri}
              className="committee-member-card"
              onClick={() => { onSelectMember(m.uri, m.fullName, m.constituencyCode, m.constituency); }}
            >
              <div className="committee-member-card__photo-wrap">
                <img
                  src={m.photoUrl}
                  alt={m.fullName}
                  loading="lazy"
                  className="committee-member-card__photo"
                  onError={(e) => {
                    const el = e.currentTarget;
                    el.style.display = 'none';
                    const fallback = el.nextElementSibling as HTMLElement | null;
                    if (fallback) fallback.style.display = 'flex';
                  }}
                />
                <div className="committee-member-card__initials" style={{ display: 'none' }}>
                  {m.firstName[0]}{m.lastName[0]}
                </div>
              </div>
              <div className="committee-member-card__body">
                <div className="committee-member-card__name">{m.fullName}</div>
                <div className="committee-member-card__meta">
                  <span
                    className="party-badge"
                    style={{ backgroundColor: partyColor(m.party) }}
                  >
                    {m.party}
                  </span>
                  <span className="committee-member-card__constituency">{m.constituency}</span>
                </div>
              </div>
              <div className="committee-member-card__role">{role}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
