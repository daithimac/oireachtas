import test from 'node:test';
import assert from 'node:assert/strict';

import worker, { shortLinkUrl } from './index.js';

test('shortLinkUrl prefers configured SHORTLINK_BASE_URL', () => {
  const request = new Request('https://oireachtas-explorer-transcripts.oireachtas-explorer.workers.dev/shortlinks');
  const env = { SHORTLINK_BASE_URL: 'https://go.oireachtas-explorer.ie/' };

  assert.equal(shortLinkUrl(request, env, 'b3acbaeabc'), 'https://go.oireachtas-explorer.ie/s/b3acbaeabc');
});

test('shortLinkUrl falls back to request origin when SHORTLINK_BASE_URL is empty', () => {
  const request = new Request('https://oireachtas-explorer-transcripts.oireachtas-explorer.workers.dev/shortlinks');

  assert.equal(
    shortLinkUrl(request, { SHORTLINK_BASE_URL: '' }, 'b3acbaeabc'),
    'https://oireachtas-explorer-transcripts.oireachtas-explorer.workers.dev/s/b3acbaeabc',
  );
});

test('short links return Open Graph metadata for regular user agents', async () => {
  const request = new Request('https://go.oireachtas-explorer.ie/s/b3acbaeabc', {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  const env = {
    RESEARCH_COLLECTIONS: {
      async get(key, type) {
        assert.equal(key, 'shortlink:b3acbaeabc');
        assert.equal(type, 'json');
        return {
          targetUrl: 'https://oireachtas-explorer.ie/#/dail/34/votes',
          title: 'Oireachtas Explorer: Dáil Votes',
          description: 'Division results and tallies from the 34th Dáil.',
        };
      },
    },
  };

  const response = await worker.fetch(request, env);
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get('Content-Type'), /text\/html/);
  assert.match(html, /<meta property="og:title" content="Oireachtas Explorer: Dáil Votes">/);
  assert.match(html, /<meta property="og:description" content="Division results and tallies from the 34th Dáil\.">/);
  assert.match(html, /<meta property="og:image" content="https:\/\/oireachtas-explorer\.ie\/og-image\.png">/);
});

test('short links use a trusted custom Open Graph image when provided', async () => {
  const request = new Request('https://go.oireachtas-explorer.ie/s/b3acbaeabc');
  const env = {
    RESEARCH_COLLECTIONS: {
      async get() {
        return {
          targetUrl: 'https://oireachtas-explorer.ie/#/dail/34/debate/example',
          title: 'Oireachtas Explorer: A member contribution',
          description: 'A short quote from the transcript.',
          imageUrl: 'https://data.oireachtas.ie/ie/oireachtas/member/id/Some_Member/image/thumb',
        };
      },
    },
  };

  const response = await worker.fetch(request, env);
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /<meta property="og:image" content="https:\/\/data\.oireachtas\.ie\/ie\/oireachtas\/member\/id\/Some_Member\/image\/thumb">/);
});
