import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCurrentPageUrl, isHomeView, parseHash, resolveGlobalShareUrl } from './routing.ts';

test('treats the chamber landing route as home', () => {
  assert.equal(isHomeView({ kind: 'home' }), true);
});

test('treats non-home routes as shareable', () => {
  assert.equal(isHomeView({ kind: 'global-votes' }), false);
});

test('builds the current page URL including search and hash', () => {
  assert.equal(
    buildCurrentPageUrl('https://oireachtas-explorer.ie', '?q=test', '#/dail/34/votes'),
    'https://oireachtas-explorer.ie?q=test#/dail/34/votes',
  );
});

test('share URL is omitted for the home route', () => {
  assert.equal(
    resolveGlobalShareUrl({ kind: 'home' }, 'https://oireachtas-explorer.ie', '', '#/dail/34'),
    null,
  );
});

test('share URL is returned for a non-home route', () => {
  assert.equal(
    resolveGlobalShareUrl({ kind: 'global-votes' }, 'https://oireachtas-explorer.ie', '', '#/dail/34/votes'),
    'https://oireachtas-explorer.ie#/dail/34/votes',
  );
});

test('global share URL preserves filtered query and hash state', () => {
  assert.equal(
    resolveGlobalShareUrl(
      { kind: 'search', query: 'housing' },
      'https://oireachtas-explorer.ie',
      '?filter=recent',
      '#/dail/34/search/housing',
    ),
    'https://oireachtas-explorer.ie?filter=recent#/dail/34/search/housing',
  );
});

test('parseHash still identifies the chamber home route', () => {
  const parsed = parseHash('#/dail/34');
  assert.equal(parsed.view.kind, 'home');
});
