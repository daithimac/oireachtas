import assert from 'node:assert/strict';
import test from 'node:test';
import type { DebateResult, VoteResult } from '../src/types.ts';
import { extractVoteDebateContext, mapVoteResults, parseTellers, splitVoteMembers } from '../src/utils/votes.ts';

function voteResult(overrides: Partial<VoteResult['division']>): VoteResult {
  return {
    contextDate: '2025-04-09',
    division: {
      uri: 'https://data.oireachtas.ie/ie/oireachtas/division/house/dail/34/2025-04-09/vote_43',
      date: '2025-04-09',
      datetime: '2025-04-09T18:00:00Z',
      outcome: 'Carried',
      chamber: { uri: '', showAs: 'Dáil Éireann' },
      house: { uri: '', houseNo: '34', houseCode: 'dail', showAs: '34th Dáil' },
      debate: {
        uri: 'https://data.oireachtas.ie/ie/oireachtas/debateRecord/dail/2025-04-09/debate/main',
        showAs: 'Motion re Housing',
        debateSection: 'https://data.oireachtas.ie/ie/oireachtas/debateRecord/dail/2025-04-09/debate/main',
      },
      subject: { uri: null, showAs: 'Housing' },
      tallies: {
        taVotes: { tally: 88, showAs: 'Tá' },
        nilVotes: { tally: 62, showAs: 'Níl' },
        staonVotes: { tally: 0, showAs: 'Staon' },
      },
      voteId: 'vote_43',
      isBill: false,
      category: 'Motion',
      ...overrides,
    },
  };
}

test('maps and deduplicates vote list rows by vote uri', () => {
  const rows = mapVoteResults([
    voteResult({ memberTally: { member: { memberCode: 'a', showAs: 'A', uri: 'member-a' }, showAs: 'Tá' } }),
    voteResult({ memberTally: { member: { memberCode: 'b', showAs: 'B', uri: 'member-b' }, showAs: 'Níl' } }),
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, 'Motion re Housing');
  assert.equal(rows[0].topic, 'Housing');
  assert.equal(rows[0].category, 'Motion');
  assert.equal(rows[0].tallyFor, 88);
  assert.equal(rows[0].tallyAgainst, 62);
});

test('splits vote detail member tallies into Tá, Níl, and Staon buckets', () => {
  const split = splitVoteMembers([
    voteResult({ memberTally: { member: { memberCode: 'a', showAs: 'Alice Example', uri: 'member-a' }, showAs: 'Tá' } }),
    voteResult({ memberTally: { member: { memberCode: 'b', showAs: 'Brian Example', uri: 'member-b' }, showAs: 'Níl' } }),
    voteResult({ memberTally: { member: { memberCode: 'c', showAs: 'Cara Example', uri: 'member-c' }, showAs: 'Staon' } }),
  ]);

  assert.deepEqual(split.ta.map((member) => member.fullName), ['Alice Example']);
  assert.deepEqual(split.nil.map((member) => member.fullName), ['Brian Example']);
  assert.deepEqual(split.staon.map((member) => member.fullName), ['Cara Example']);
});

test('splits vote detail members from the /votes tallies arrays', () => {
  const split = splitVoteMembers([
    voteResult({
      tallies: {
        taVotes: {
          tally: 1,
          showAs: 'Tá',
          members: [{ member: { memberCode: 'a', showAs: 'Aird, William.', uri: 'member-a' } }],
        },
        nilVotes: {
          tally: 1,
          showAs: 'Níl',
          members: [{ member: { memberCode: 'b', showAs: 'Bacik, Ivana.', uri: 'member-b' } }],
        },
        staonVotes: {
          tally: 0,
          showAs: 'Staon',
          members: [],
        },
      },
    }),
  ]);

  assert.deepEqual(split.ta.map((member) => member.fullName), ['Aird, William.']);
  assert.deepEqual(split.nil.map((member) => member.fullName), ['Bacik, Ivana.']);
});

test('extracts debate and bill context for a vote debate section', () => {
  const vote = mapVoteResults([
    voteResult({
      debate: {
        uri: 'https://data.oireachtas.ie/akn/ie/debateRecord/dail/2026-04-15/debate/main',
        showAs: 'International Protection Bill 2026: From the Seanad',
        debateSection: 'dbsect_18',
        formats: {
          xml: { uri: 'https://data.oireachtas.ie/akn/ie/debateRecord/dail/2026-04-15/debate/mul@/main.xml' },
          pdf: { uri: 'https://data.oireachtas.ie/ie/oireachtas/debateRecord/dail/2026-04-15/debate/mul@/main.pdf' },
        },
      },
    }),
  ])[0];
  const debate: DebateResult = {
    debateRecord: {
      uri: 'https://data.oireachtas.ie/akn/ie/debateRecord/dail/2026-04-15/debate/main',
      date: '2026-04-15',
      debateType: 'debate',
      debateSections: [
        {
          debateSection: {
            debateSectionId: 'dbsect_18',
            showAs: 'International Protection Bill 2026: From the Seanad',
            uri: 'https://data.oireachtas.ie/akn/ie/debateRecord/dail/2026-04-15/debate/dbsect_18',
            debateType: 'debate',
            bill: {
              uri: 'https://data.oireachtas.ie/ie/oireachtas/bill/2026/6',
              event: {
                uri: 'https://data.oireachtas.ie/ie/oireachtas/bill/2026/6/dail/seanad_amd',
                isBillStage: false,
                stage: 'seanad_amd',
                houseCode: 'dail',
                showAs: 'International Protection Bill 2026: From the Seanad (Dáil)',
              },
            },
          },
        },
      ],
    },
  };

  const context = extractVoteDebateContext(vote, debate, []);

  assert.equal(context.debateTitle, 'International Protection Bill 2026: From the Seanad');
  assert.deepEqual(context.relatedBill, {
    uri: 'https://data.oireachtas.ie/ie/oireachtas/bill/2026/6',
    billYear: '2026',
    billNo: '6',
    title: 'International Protection Bill 2026: From the Seanad (Dáil)',
    stage: 'seanad_amd',
  });
});

test('parses Tá and Níl tellers from the vote teller text', () => {
  const parsed = parseTellers('Tellers: Tá, Deputies Mary Butler and Emer Currie; Níl, Deputies Pádraig Mac Lochlainn and Aengus Ó Snodaigh.');

  assert.deepEqual(parsed.ta, ['Mary Butler', 'Emer Currie']);
  assert.deepEqual(parsed.nil, ['Pádraig Mac Lochlainn', 'Aengus Ó Snodaigh']);
});
