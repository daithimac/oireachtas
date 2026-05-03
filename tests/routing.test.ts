import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHash, viewToHash } from '../src/utils/routing.ts';

test('builds and parses the chamber votes route', () => {
  const hash = viewToHash({ kind: 'global-votes' }, 'dail', 34);

  assert.equal(hash, '#/dail/34/votes');
  assert.deepEqual(parseHash(hash), {
    chamber: 'dail',
    houseNo: 34,
    view: { kind: 'global-votes' },
  });
});

test('builds and parses a shareable vote detail route', () => {
  const voteUri = 'https://data.oireachtas.ie/ie/oireachtas/division/house/dail/34/2025-04-09/vote_43';
  const title = 'That the Bill be now read a Second Time';
  const hash = viewToHash({ kind: 'vote-detail', voteUri, title }, 'dail', 34);

  assert.equal(
    hash,
    `#/dail/34/vote/${encodeURIComponent(voteUri)}/${encodeURIComponent(title)}`
  );
  assert.deepEqual(parseHash(hash), {
    chamber: 'dail',
    houseNo: 34,
    view: { kind: 'vote-detail', voteUri, title },
  });
});
