import type { Chamber, ChamberVote, DebateResult, Member, VoteDebateContext, VoteMemberSplit, VoteRelatedBill, VoteResult } from '../types';

interface VoteMemberRef {
  memberCode: string | null;
  showAs: string;
  uri: string | null;
}

export function matchesVoteHouse(result: VoteResult, chamber: Chamber, houseNo: number): boolean {
  return result.division.house.houseCode === chamber && result.division.house.houseNo === String(houseNo);
}

export function parseVoteTally(showAs: string | undefined): 'ta' | 'nil' | 'staon' {
  const normalized = (showAs ?? '').trim().toLowerCase();
  if (normalized === 'tá' || normalized === 'ta') return 'ta';
  if (normalized === 'níl' || normalized === 'nil') return 'nil';
  return 'staon';
}

function stripTellerPrefix(name: string): string {
  return name
    .replace(/^(Deputies|Deputy|Senators|Senator|s:)\s+/i, '')
    .replace(/\.$/, '')
    .trim();
}

function splitTellerNames(text: string): string[] {
  return text
    .split(/\s+and\s+|,\s+(?=(?:Deputy|Deputies|Senator|Senators)\s+)/i)
    .map(stripTellerPrefix)
    .filter(Boolean);
}

export function parseTellers(tellers: string): { ta: string[]; nil: string[] } {
  const normalized = tellers
    .replace(/^Tellers:\s*/i, '')
    .replace(/^[-—:]\s*/, '')
    .trim();
  const taMatch = /(?:^|;\s*)Tá[:,]\s*(.*?)(?=(?:;|\.)?\s*Níl[:,]|$)/i.exec(normalized);
  const nilMatch = /(?:^|[;.]\s*)Níl[:,]\s*(.*)$/i.exec(normalized);
  return {
    ta: taMatch?.[1] ? splitTellerNames(taMatch[1]) : [],
    nil: nilMatch?.[1] ? splitTellerNames(nilMatch[1]) : [],
  };
}

export function mapVoteResult(result: VoteResult): ChamberVote {
  const division = result.division;
  const title = division.debate?.showAs ?? division.subject?.showAs ?? division.voteId;
  return {
    uri: division.uri,
    voteId: division.voteId,
    date: division.date,
    datetime: division.datetime,
    title,
    topic: division.subject?.showAs ?? '',
    category: division.category,
    outcome: division.outcome ?? '',
    tallyFor: division.tallies?.taVotes?.tally ?? 0,
    tallyAgainst: division.tallies?.nilVotes?.tally ?? 0,
    tallyAbstain: division.tallies?.staonVotes?.tally ?? 0,
    isBill: division.isBill,
    voteNote: division.voteNote ?? '',
    tellers: division.tellers ?? '',
    xmlUri: division.debate?.formats?.xml?.uri,
    pdfUri: division.debate?.formats?.pdf?.uri,
    debateSectionUri: division.debate?.debateSection,
    debateUri: division.debate?.uri,
  };
}

function billFromUri(uri: string | null | undefined, title: string, stage: string): VoteRelatedBill | null {
  if (!uri) return null;
  const match = /\/bill\/(\d{4})\/(\d+)(?:\/)?$/.exec(uri);
  if (!match) return null;
  return {
    uri,
    billYear: match[1],
    billNo: match[2],
    title,
    stage,
  };
}

export function extractVoteDebateContext(
  vote: ChamberVote,
  debate: DebateResult | null,
  relatedVotes: ChamberVote[]
): VoteDebateContext {
  const sectionId = vote.debateSectionUri?.split('/').pop();
  const sections = debate?.debateRecord.debateSections ?? [];
  const section = sections.find((item) => {
    const candidate = item.debateSection;
    return candidate.debateSectionId === sectionId || candidate.uri === vote.debateSectionUri;
  })?.debateSection;

  const bill = section?.bill;
  const relatedBill = billFromUri(
    bill?.uri,
    bill?.event?.showAs ?? bill?.showAs ?? section?.showAs ?? vote.title,
    bill?.event?.stage ?? ''
  );

  return {
    debateTitle: section?.showAs ?? vote.title,
    debateSectionTitle: section?.showAs ?? vote.title,
    debateSectionUri: section?.uri ?? vote.debateSectionUri,
    relatedBill,
    relatedVotes: relatedVotes.filter((relatedVote) => relatedVote.uri !== vote.uri),
  };
}

export function mapVoteResults(results: VoteResult[]): ChamberVote[] {
  const votes = new Map<string, ChamberVote>();
  for (const result of results) {
    const vote = mapVoteResult(result);
    if (!votes.has(vote.uri)) votes.set(vote.uri, vote);
  }
  return Array.from(votes.values());
}

function splitDisplayName(showAs: string): { firstName: string; lastName: string } {
  const [last, first] = showAs.split(',').map((part) => part.trim().replace(/\.$/, ''));
  if (first && last) return { firstName: first, lastName: last };

  const parts = showAs.trim().split(/\s+/);
  return {
    firstName: parts[0] ?? showAs,
    lastName: parts.at(-1)?.replace(/\.$/, '') ?? '',
  };
}

function normalizeVoteMemberName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^\p{Letter}\p{Number}\s']/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function comparableMemberNames(member: Member): string[] {
  return [
    member.fullName,
    `${member.firstName} ${member.lastName}`,
    `${member.lastName} ${member.firstName}`,
  ].map(normalizeVoteMemberName).filter(Boolean);
}

function nameTokens(name: string): string[] {
  return normalizeVoteMemberName(name).split(' ').filter(Boolean);
}

function scoreVoteMemberName(rawName: string, member: Member): number {
  const rawTokens = nameTokens(rawName);
  const memberTokens = nameTokens(member.fullName);
  if (rawTokens.length === 0 || memberTokens.length === 0) return 0;

  const rawFirst = rawTokens[0];
  const memberFirst = memberTokens[0];
  const rawLast = rawTokens.at(-1);
  const memberLast = memberTokens.at(-1);
  let score = 0;

  if (rawLast && memberLast && rawLast === memberLast) score += 50;
  if (rawFirst === memberFirst) score += 30;
  else if (rawFirst[0] && memberFirst.startsWith(rawFirst[0])) score += 15;

  for (const token of rawTokens) {
    if (token.length > 1 && memberTokens.includes(token)) score += 5;
  }

  return score;
}

function findCanonicalVoteMember(rawMember: VoteMemberRef, allMembers: Member[]): Member | null {
  const rawName = normalizeVoteMemberName(rawMember.showAs);
  if (!rawName) return null;
  const exact = allMembers.find((member) => comparableMemberNames(member).includes(rawName));
  if (exact) return exact;

  const ranked = allMembers
    .map((member) => ({ member, score: scoreVoteMemberName(rawMember.showAs, member) }))
    .filter((candidate) => candidate.score >= 85)
    .sort((a, b) => b.score - a.score);

  if (ranked.length === 0) return null;
  if (ranked.length > 1 && ranked[0].score === ranked[1].score) return null;
  return ranked[0].member;
}

function stableVoteMemberUri(rawMember: VoteMemberRef, result: VoteResult): string {
  if (rawMember.uri) return rawMember.uri;
  const identity = normalizeVoteMemberName(rawMember.showAs) || rawMember.showAs.trim();
  return `vote-member:${result.division.uri}:${encodeURIComponent(identity)}`;
}

function memberFromRaw(rawMember: VoteMemberRef, result: VoteResult): Member {
  const name = splitDisplayName(rawMember.showAs);
  const uri = stableVoteMemberUri(rawMember, result);
  return {
    uri,
    memberCode: rawMember.memberCode ?? uri,
    fullName: rawMember.showAs,
    firstName: name.firstName,
    lastName: name.lastName,
    chamber: result.division.house.houseCode === 'seanad' ? 'seanad' : 'dail',
    houseNo: Number(result.division.house.houseNo) || 0,
    party: '',
    constituency: '',
    constituencyCode: '',
    photoUrl: rawMember.uri ? `${rawMember.uri}/image/thumb` : '',
    hasPhoto: Boolean(rawMember.uri),
    offices: [],
  };
}

function memberFromVoteResult(result: VoteResult): Member | null {
  const rawMember = result.division.memberTally?.member;
  if (!rawMember) return null;
  return memberFromRaw(rawMember, result);
}

export function splitVoteMembers(results: VoteResult[], allMembers: Member[] = []): VoteMemberSplit {
  const byUri = new Map(allMembers.map((member) => [member.uri, member]));
  const split: VoteMemberSplit = {
    vote: results[0] ? mapVoteResult(results[0]) : null,
    ta: [],
    nil: [],
    staon: [],
  };
  const seen = new Set<string>();

  const addMember = (result: VoteResult, rawMember: VoteMemberRef, bucket: 'ta' | 'nil' | 'staon') => {
    const member = (rawMember.uri ? byUri.get(rawMember.uri) : undefined)
      ?? findCanonicalVoteMember(rawMember, allMembers)
      ?? memberFromRaw(rawMember, result);
    if (seen.has(`${bucket}:${member.uri}`)) return;
    seen.add(`${bucket}:${member.uri}`);
    split[bucket].push(member);
  };

  for (const result of results) {
    for (const item of result.division.tallies?.taVotes?.members ?? []) {
      addMember(result, item.member, 'ta');
    }
    for (const item of result.division.tallies?.nilVotes?.members ?? []) {
      addMember(result, item.member, 'nil');
    }
    for (const item of result.division.tallies?.staonVotes?.members ?? []) {
      addMember(result, item.member, 'staon');
    }

    const tally = result.division.memberTally;
    if (!tally) continue;
    const member = (tally.member.uri ? byUri.get(tally.member.uri) : undefined)
      ?? findCanonicalVoteMember(tally.member, allMembers)
      ?? memberFromVoteResult(result);
    const bucket = parseVoteTally(tally.showAs);
    if (!member || seen.has(`${bucket}:${member.uri}`)) continue;
    seen.add(`${bucket}:${member.uri}`);

    split[bucket].push(member);
  }

  const sortMembers = (a: Member, b: Member) => a.lastName.localeCompare(b.lastName) || a.fullName.localeCompare(b.fullName);
  split.ta.sort(sortMembers);
  split.nil.sort(sortMembers);
  split.staon.sort(sortMembers);
  return split;
}
