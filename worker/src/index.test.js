import test from 'node:test';
import assert from 'node:assert/strict';

import { shortLinkUrl } from './index.js';

test('shortLinkUrl prefers configured SHORTLINK_BASE_URL', () => {
  const request = new Request('https://oireachtas-explorer-transcripts.oireachtas-explorer.workers.dev/shortlinks');
  const env = { SHORTLINK_BASE_URL: 'https://go.oireachtas-explorer.ie/' };

  assert.equal(shortLinkUrl(request, env, 'b3acbaeabc'), 'https://go.oireachtas-explorer.ie/s/b3acbaeabc');
});

test('shortLinkUrl falls back to request origin when SHORTLINK_BASE_URL is unset', () => {
  const request = new Request('https://oireachtas-explorer-transcripts.oireachtas-explorer.workers.dev/shortlinks');

  assert.equal(
    shortLinkUrl(request, {}, 'b3acbaeabc'),
    'https://oireachtas-explorer-transcripts.oireachtas-explorer.workers.dev/s/b3acbaeabc',
  );
});
