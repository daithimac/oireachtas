import { useCallback, useEffect, useMemo } from 'react';
import { Users } from 'lucide-react';
import type { Chamber, Member } from '../types';
import { fetchAllMembers } from '../api/oireachtas';
import { useAsync } from '../hooks/useAsync';
import { partyColor } from '../utils/format';
import { chamberName, memberNoun, pairedHouse } from '../utils/dail';

interface CommitteePageProps {
  committeeUri: string;
  committeeName: string;
  chamber: Chamber;
  houseNo?: number;
  allMembers: Member[];
  loadingAllMembers: boolean;
  onSelectMember: (memberUri: string, memberName: string, constituencyCode: string, constituencyName: string, targetChamber?: Chamber, targetHouseNo?: number) => void;
  onShareMeta?: (meta: { title: string; description: string }) => void;
}

const ROLE_ORDER: Record<string, number> = {
  Cathaoirleach: 0,
  'Leas-Cathaoirleach': 1,
  Chair: 0,
  'Vice-Chair': 1,
};

function normalizeCommitteeName(value: string): string {
  return value.toLowerCase().replace(/joint committee on\s+/, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function memberDisplayName(member: Member): string {
  if (member.chamber === 'seanad') {
    return member.fullName.startsWith('Senator ') ? member.fullName : `Senator ${member.fullName}`;
  }
  return member.fullName.includes('T.D.') ? member.fullName : `${member.fullName} T.D.`;
}

export function CommitteePage({
  committeeUri,
  committeeName,
  chamber,
  houseNo,
  allMembers,
  loadingAllMembers,
  onSelectMember,
  onShareMeta,
}: CommitteePageProps) {
  const paired = useMemo(() => pairedHouse(chamber, houseNo ?? 0), [chamber, houseNo]);
  const pairedFetcher = useCallback((signal: AbortSignal) => {
    if (!paired) return Promise.resolve([] as Member[]);
    return fetchAllMembers(paired.chamber, paired.houseNo, signal);
  }, [paired]);
  const { data: pairedMembersData, loading: loadingPairedMembers } = useAsync(pairedFetcher);
  const pairedMembers = useMemo(() => pairedMembersData ?? [], [pairedMembersData]);

  const committeeMembers = useMemo(() => {
    const results: { member: Member; role: string }[] = [];
    const seen = new Set<string>();
    const committeeNameKey = normalizeCommitteeName(committeeName);

    for (const m of [...allMembers, ...pairedMembers]) {
      if (seen.has(m.uri)) continue;
      if (!m.committees) continue;
      const membership = m.committees.find(c =>
        c.uri === committeeUri || normalizeCommitteeName(c.name) === committeeNameKey
      );
      if (membership) {
        seen.add(m.uri);
        results.push({ member: m, role: membership.role });
      }
    }
    results.sort((a, b) => {
      const ra = ROLE_ORDER[a.role] ?? 99;
      const rb = ROLE_ORDER[b.role] ?? 99;
      if (ra !== rb) return ra - rb;
      if (a.member.chamber !== b.member.chamber) return a.member.chamber === 'dail' ? -1 : 1;
      return a.member.lastName.localeCompare(b.member.lastName);
    });
    return results;
  }, [allMembers, committeeName, committeeUri, pairedMembers]);

  const loadingMembers = loadingAllMembers || loadingPairedMembers;
  const dailCount = committeeMembers.filter(({ member }) => member.chamber === 'dail').length;
  const seanadCount = committeeMembers.filter(({ member }) => member.chamber === 'seanad').length;
  const membershipSummary = [
    dailCount > 0 ? `${dailCount} ${memberNoun('dail', dailCount !== 1)}` : '',
    seanadCount > 0 ? `${seanadCount} ${memberNoun('seanad', seanadCount !== 1)}` : '',
  ].filter(Boolean).join(' · ');

  useEffect(() => {
    if (!onShareMeta || loadingMembers) return;
    onShareMeta({
      title: `Oireachtas Explorer: ${committeeName}`,
      description: `${committeeName}. ${committeeMembers.length} member${committeeMembers.length !== 1 ? 's' : ''}${membershipSummary ? ` (${membershipSummary})` : ''}.`,
    });
  }, [committeeName, committeeMembers.length, membershipSummary, loadingMembers, onShareMeta]);

  return (
    <div className="container">
      <div className="member-grid-page__header">
        <h2 className="section-heading">{committeeName}</h2>
        {!loadingMembers && (
          <p className="section-subheading">
            {membershipSummary || `${committeeMembers.length} ${memberNoun(chamber, committeeMembers.length !== 1)}`}
          </p>
        )}
      </div>

      {loadingMembers && (
        <div className="loading-state" role="status" aria-live="polite">
          <div className="spinner" aria-hidden="true" />
          <span>Loading committee members…</span>
        </div>
      )}

      {!loadingMembers && committeeMembers.length === 0 && (
        <div className="empty-state">
          <Users className="empty-state__icon" size={40} aria-hidden="true" />
          <p>No current members found for this committee.</p>
        </div>
      )}

      {!loadingMembers && committeeMembers.length > 0 && (
        <div className="committee-member-list">
          {committeeMembers.map(({ member: m, role }) => (
            <button
              key={m.uri}
              className="committee-member-card"
              onClick={() => { onSelectMember(m.uri, m.fullName, m.constituencyCode, m.constituency, m.chamber, m.houseNo); }}
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
                <div className="committee-member-card__name">{memberDisplayName(m)}</div>
                <div className="committee-member-card__meta">
                  <span
                    className="party-badge"
                    style={{ backgroundColor: partyColor(m.party) }}
                  >
                    {m.party}
                  </span>
                  <span className="committee-member-card__constituency">{m.constituency}</span>
                  <span className="committee-member-card__chamber">{chamberName(m.chamber)}</span>
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
