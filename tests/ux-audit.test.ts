import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const css = readFileSync(new URL('../src/App.css', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

test('top-level header navigation exposes current-page state', () => {
  for (const kind of ['global-votes', 'global-legislation', 'compare', 'saved']) {
    assert.match(app, new RegExp(`aria-current=\\{view\\.kind === '${kind}'`));
  }

  assert.match(css, /\.app-header__nav button\[aria-current="page"\]/);
});

test('audit-recommended mobile layouts have explicit responsive rules', () => {
  const requiredRules = [
    /\.app-header[\s\S]*?flex-wrap:\s*wrap/,
    /\.app-header__search[\s\S]*?width:\s*100%/,
    /\.profile-layout[\s\S]*?flex-direction:\s*column/,
    /\.profile-sidebar[\s\S]*?position:\s*static/,
    /\.vote-detail-grid[\s\S]*?grid-template-columns:\s*1fr/,
    /\.vote-tellers__grid[\s\S]*?grid-template-columns:\s*1fr/,
    /\.compare-controls[\s\S]*?grid-template-columns:\s*1fr/,
    /\.compare-grid[\s\S]*?grid-template-columns:\s*1fr/,
    /\.filter-group[\s\S]*?min-width:\s*0/,
    /\.act-grid[\s\S]*?grid-template-columns:\s*repeat\(2,\s*1fr\)/,
    /\.cabinet-grid[\s\S]*?minmax\(min\(100%,\s*260px\),\s*1fr\)/,
    /\.stats-bar[\s\S]*?flex-direction:\s*column/,
    /\.home-research-grid[\s\S]*?grid-template-columns:\s*1fr/,
  ];

  for (const rule of requiredRules) {
    assert.match(css, rule);
  }
});

test('mobile touch targets meet the comfortable 44px target from the audit', () => {
  assert.match(css, /\.app-header__nav button[\s\S]*?min-height:\s*44px/);
  assert.match(css, /\.type-filter-btn[\s\S]*?min-height:\s*44px/);
  assert.match(css, /\.transcript-btn[\s\S]*?min-height:\s*44px/);
  assert.match(css, /\.tab-btn[\s\S]*?min-height:\s*44px/);
});
