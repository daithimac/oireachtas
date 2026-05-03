import { useCallback, useState } from 'react';
import { ExternalLink, FileText, Library, ScrollText, Share2 } from 'lucide-react';
import { fetchVoteDebateContext, fetchVoteDetail } from '../api/oireachtas';
import { useAsync } from '../hooks/useAsync';
import type { Chamber, Member, View } from '../types';
import { formatDateShort, partyColor } from '../utils/format';
import { viewToHash } from '../utils/routing';
import { parseTellers } from '../utils/votes';
import { ShareModal } from './ShareModal';

interface VoteDetailPageProps {
  voteUri: string;
  title: string;
  chamber: Chamber;
  houseNo: number;
  allMembers: Member[];
  onSelectMember: (memberUri: string, memberName: string, constituencyCode: string, constituencyName: string) => void;
  onNavigate: (view: View) => void;
}

function outcomeClass(outcome: string): string {
  const lower = outcome.toLowerCase();
  if (lower.includes('carried')) return 'outcome-badge--carried';
  if (lower.includes('lost') || lower.includes('defeated') || lower.includes('rejected')) return 'outcome-badge--lost';
  return '';
}

interface TellerEntry {
  name: string;
  member: Member | null;
}

function normalizePersonName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{Letter}\p{Number}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function comparableMemberNames(member: Member): string[] {
  const names = [member.fullName, `${member.firstName} ${member.lastName}`, `${member.lastName} ${member.firstName}`];
  const commaParts = member.fullName.split(',').map((part) => part.trim().replace(/\.$/, ''));
  const last = commaParts[0];
  const first = commaParts[1];
  if (first && last) {
    names.push(`${first} ${last}`, `${last} ${first}`);
  }
  return names.map(normalizePersonName).filter(Boolean);
}

function findMemberByName(name: string, members: Member[]): Member | null {
  const normalized = normalizePersonName(name);
  return members.find((member) => comparableMemberNames(member).includes(normalized)) ?? null;
}

function buildTellerEntries(names: string[], members: Member[]): TellerEntry[] {
  const uniqueMembers = Array.from(new Map(members.map((member) => [member.uri, member])).values());
  return names.map((name) => ({
    name,
    member: findMemberByName(name, uniqueMembers),
  }));
}

function initialsForName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return `${parts[0]?.[0] ?? ''}${parts.at(-1)?.[0] ?? ''}`.toUpperCase();
}

function VoteMemberCard({
  member,
  onSelectMember,
}: {
  member: Member;
  onSelectMember: VoteDetailPageProps['onSelectMember'];
}) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const party = member.party || 'Member';
  const constituency = member.constituency || '';

  return (
    <button
      type="button"
      className="vote-member-card"
      onClick={() => { onSelectMember(member.uri, member.fullName, member.constituencyCode || 'all', member.constituency || 'Votes'); }}
      aria-label={`View profile for ${member.fullName}`}
    >
      <div className="vote-member-card__photo-wrap">
        {!photoFailed ? (
          <img
            src={member.photoUrl}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => { setPhotoFailed(true); }}
          />
        ) : (
          <div className="vote-member-card__initials" aria-hidden="true">
            {member.firstName[0]}{member.lastName[0]}
          </div>
        )}
      </div>
      <div className="vote-member-card__body">
        <strong>{member.fullName}</strong>
        <div className="vote-member-card__meta">
          <span className="party-badge" style={{ backgroundColor: partyColor(member.party) }}>
            {party}
          </span>
          {constituency && <span>{constituency}</span>}
        </div>
      </div>
    </button>
  );
}

function TellerMemberCard({
  entry,
  onSelectMember,
}: {
  entry: TellerEntry;
  onSelectMember: VoteDetailPageProps['onSelectMember'];
}) {
  if (entry.member) {
    return <VoteMemberCard member={entry.member} onSelectMember={onSelectMember} />;
  }

  return (
    <div className="vote-member-card vote-member-card--static">
      <div className="vote-member-card__photo-wrap">
        <div className="vote-member-card__initials" aria-hidden="true">
          {initialsForName(entry.name)}
        </div>
      </div>
      <div className="vote-member-card__body">
        <strong>{entry.name}</strong>
        <div className="vote-member-card__meta">
          <span>Member</span>
        </div>
      </div>
    </div>
  );
}

function TellerSide({
  label,
  entries,
  tone,
  onSelectMember,
}: {
  label: string;
  entries: TellerEntry[];
  tone: 'ta' | 'nil';
  onSelectMember: VoteDetailPageProps['onSelectMember'];
}) {
  if (entries.length === 0) return null;

  return (
    <section className={`vote-tellers__side vote-tellers__side--${tone}`}>
      <div className="vote-tellers__side-header">
        <h3>{label}</h3>
        <span>{entries.length}</span>
      </div>
      <div className="vote-member-list vote-member-list--compact">
        {entries.map((entry) => (
          <TellerMemberCard
            key={`${tone}:${entry.name}`}
            entry={entry}
            onSelectMember={onSelectMember}
          />
        ))}
      </div>
    </section>
  );
}

function VoteColumn({
  label,
  count,
  members,
  tone,
  onSelectMember,
}: {
  label: string;
  count: number;
  members: Member[];
  tone: 'ta' | 'nil' | 'staon';
  onSelectMember: VoteDetailPageProps['onSelectMember'];
}) {
  return (
    <section className={`vote-detail-column vote-detail-column--${tone}`}>
      <div className="vote-detail-column__header">
        <h2>{label}</h2>
        <span>{count}</span>
      </div>
      {members.length > 0 ? (
        <div className="vote-member-list">
          {members.map((member) => (
            <VoteMemberCard
              key={member.uri}
              member={member}
              onSelectMember={onSelectMember}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state">No member tallies returned for {label}.</div>
      )}
    </section>
  );
}

export function VoteDetailPage({ voteUri, title, chamber, houseNo, allMembers, onSelectMember, onNavigate }: VoteDetailPageProps) {
  const [shareOpen, setShareOpen] = useState(false);
  const fetcher = useCallback((signal: AbortSignal) =>
    fetchVoteDetail(voteUri, allMembers, signal),
    [voteUri, allMembers]
  );
  const { data: detail, loading, error } = useAsync(fetcher);
  const vote = detail?.vote;
  const contextFetcher = useCallback((signal: AbortSignal) => {
    if (!vote) return Promise.reject(new Error('Vote context is not ready'));
    return fetchVoteDebateContext(vote, signal);
  }, [vote]);
  const { data: context, loading: contextLoading } = useAsync(contextFetcher, { enabled: Boolean(vote) });
  const shareUrl = window.location.origin + window.location.pathname +
    viewToHash({ kind: 'vote-detail', voteUri, title: vote?.title ?? title }, chamber, houseNo);
  const debateSectionUri = context?.debateSectionUri ?? vote?.debateSectionUri;
  const tellers = vote?.tellers && detail
    ? parseTellers(vote.tellers)
    : null;
  const tellerMembers = detail
    ? [...detail.ta, ...detail.nil, ...detail.staon, ...allMembers]
    : allMembers;
  const tellerGroups = tellers
    ? {
      ta: buildTellerEntries(tellers.ta, tellerMembers),
      nil: buildTellerEntries(tellers.nil, tellerMembers),
    }
    : null;
  const hasTellerCards = Boolean(tellerGroups && (tellerGroups.ta.length > 0 || tellerGroups.nil.length > 0));

  return (
    <div className="container vote-detail-page">
      {shareOpen && <ShareModal url={shareUrl} onClose={() => { setShareOpen(false); }} />}

      <div className="vote-detail-hero">
        <div>
          <h1>{vote?.title ?? title}</h1>
          <div className="vote-detail-hero__meta">
            {vote?.date && <span>{formatDateShort(vote.date)}</span>}
            {vote?.outcome && <span className={`outcome-badge ${outcomeClass(vote.outcome)}`}>{vote.outcome}</span>}
            {vote?.category && <span>{vote.category}</span>}
            {vote?.topic && <span>{vote.topic}</span>}
          </div>
        </div>
      </div>

      {loading && (
        <div className="loading-state" role="status" aria-live="polite">
          <div className="spinner" aria-hidden="true" />
          <span>Loading vote members…</span>
        </div>
      )}

      {error && <div className="error-banner" role="alert">Failed to load vote: {error}</div>}

      {!loading && !error && !detail?.vote && (
        <div className="empty-state">No vote details were returned for this vote.</div>
      )}

      {!loading && !error && vote && (
        <>
          <div className="vote-detail-summary" aria-label="Vote totals">
            <div>
              <strong className="vote-count--ta">{vote.tallyFor}</strong>
              <span>Tá</span>
            </div>
            <div>
              <strong className="vote-count--nil">{vote.tallyAgainst}</strong>
              <span>Níl</span>
            </div>
            {vote.tallyAbstain > 0 && (
              <div>
                <strong>{vote.tallyAbstain}</strong>
                <span>Staon</span>
              </div>
            )}
          </div>

          <div className="vote-context-panel">
            <div className="vote-context-panel__actions">
              {vote.xmlUri && debateSectionUri && (
                <button
                  type="button"
                  onClick={() => {
                    onNavigate({
                      kind: 'debate-viewer',
                      xmlUri: vote.xmlUri ?? '',
                      debateSectionUri,
                      title: context?.debateSectionTitle ?? vote.title,
                    });
                  }}
                >
                  <ScrollText size={16} aria-hidden="true" />
                  View debate context
                </button>
              )}
              {context?.relatedBill && (
                <button
                  type="button"
                  onClick={() => {
                    onNavigate({
                      kind: 'bill-viewer',
                      billNo: context.relatedBill?.billNo ?? '',
                      billYear: context.relatedBill?.billYear ?? '',
                    });
                  }}
                >
                  <Library size={16} aria-hidden="true" />
                  View legislation
                </button>
              )}
              {vote.xmlUri && (
                <a href={vote.xmlUri} target="_blank" rel="noreferrer">
                  <FileText size={16} aria-hidden="true" />
                  Official XML
                </a>
              )}
              {vote.pdfUri && (
                <a href={vote.pdfUri} target="_blank" rel="noreferrer">
                  <ExternalLink size={16} aria-hidden="true" />
                  Official PDF
                </a>
              )}
            </div>

            {contextLoading && <div className="vote-context-panel__muted">Loading debate context…</div>}
            {context?.relatedBill && (
              <div className="vote-context-panel__bill">
                <span>Related legislation</span>
                <strong>{context.relatedBill.title}</strong>
              </div>
            )}
            {hasTellerCards && tellerGroups && (
              <div className="vote-tellers">
                <span className="vote-tellers__label">Tellers</span>
                <div className="vote-tellers__grid">
                  <TellerSide
                    label="Tá"
                    entries={tellerGroups.ta}
                    tone="ta"
                    onSelectMember={onSelectMember}
                  />
                  <TellerSide
                    label="Níl"
                    entries={tellerGroups.nil}
                    tone="nil"
                    onSelectMember={onSelectMember}
                  />
                </div>
              </div>
            )}
            {vote.voteNote && (
              <div className="vote-context-panel__note">
                <span>Vote note</span>
                <p>{vote.voteNote}</p>
              </div>
            )}
          </div>

          {context && context.relatedVotes.length > 0 && (
            <section className="related-votes">
              <div className="related-votes__header">
                <h2>Other votes in this debate</h2>
                <span>{context.relatedVotes.length}</span>
              </div>
              <div className="related-votes__list">
                {context.relatedVotes.slice(0, 8).map((relatedVote) => (
                  <button
                    key={relatedVote.uri}
                    type="button"
                    onClick={() => { onNavigate({ kind: 'vote-detail', voteUri: relatedVote.uri, title: relatedVote.title }); }}
                  >
                    <span>{relatedVote.topic || relatedVote.title}</span>
                    {relatedVote.outcome && <span className={`outcome-badge ${outcomeClass(relatedVote.outcome)}`}>{relatedVote.outcome}</span>}
                    <strong>{relatedVote.tallyFor}-{relatedVote.tallyAgainst}</strong>
                  </button>
                ))}
              </div>
            </section>
          )}

          <div className="vote-detail-grid">
            <VoteColumn
              label="Tá"
              count={detail.ta.length}
              members={detail.ta}
              tone="ta"
              onSelectMember={onSelectMember}
            />
            <VoteColumn
              label="Níl"
              count={detail.nil.length}
              members={detail.nil}
              tone="nil"
              onSelectMember={onSelectMember}
            />
          </div>

          {detail.staon.length > 0 && (
            <VoteColumn
              label="Staon"
              count={detail.staon.length}
              members={detail.staon}
              tone="staon"
              onSelectMember={onSelectMember}
            />
          )}
        </>
      )}
    </div>
  );
}
