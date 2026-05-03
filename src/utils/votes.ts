import type { Chamber, ChamberVote, DebateResult, Member, VoteDebateContext, VoteMemberSplit, VoteRelatedBill, VoteResult } from '../types';

interface VoteMemberRef {
  memberCode: string;
  showAs: string;
  uri: string;
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
  const normalized = tellers.replace(/^Tellers:\s*/i, '').trim();
  const taMatch = /(?:^|;\s*)Tá,\s*(.*?)(?=;\s*Níl,|$)/i.exec(normalized);
  const nilMatch = /(?:^|;\s*)Níl,\s*(.*)$/i.exec(normalized);
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

function memberFromRaw(rawMember: VoteMemberRef, result: VoteResult): Member {
  const name = splitDisplayName(rawMember.showAs);
  return {
    uri: rawMember.uri,
    memberCode: rawMember.memberCode,
    fullName: rawMember.showAs,
    firstName: name.firstName,
    lastName: name.lastName,
    chamber: result.division.house.houseCode === 'seanad' ? 'seanad' : 'dail',
    houseNo: Number(result.division.house.houseNo) || 0,
    party: '',
    constituency: '',
    constituencyCode: '',
    photoUrl: `${rawMember.uri}/image/thumb`,
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
    const member = byUri.get(rawMember.uri) ?? memberFromRaw(rawMember, result);
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
    const member = byUri.get(tally.member.uri) ?? memberFromVoteResult(result);
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
