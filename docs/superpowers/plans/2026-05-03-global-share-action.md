# Global Share Action Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a shared top-right share action for every non-home route so users can copy a Worker-backed short link for the exact current page state.

**Architecture:** Centralize page-share eligibility and URL resolution in the app shell, then render a single header share action that opens the existing `ShareModal`. Keep current local share affordances in place for now and add focused tests around route eligibility and URL generation.

**Tech Stack:** React, TypeScript, Vite, existing hash-route helpers, existing `ShareModal`, Node test runner

---

### Task 1: Add route-level share resolution helpers

**Files:**
- Modify: `src/utils/routing.ts`
- Test: `src/utils/routing.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
test('treats the chamber landing route as home', () => {
  expect(isHomeView({ kind: 'home' })).toBe(true);
});

test('treats non-home routes as shareable', () => {
  expect(isHomeView({ kind: 'global-votes' })).toBe(false);
});

test('builds the current page URL including search and hash', () => {
  expect(buildCurrentPageUrl('https://oireachtas-explorer.ie', '?q=test', '#/dail/34/votes')).toBe(
    'https://oireachtas-explorer.ie/?q=test#/dail/34/votes',
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm exec -- node --test src/utils/routing.test.ts`
Expected: FAIL because `isHomeView` and `buildCurrentPageUrl` do not exist yet.

- [ ] **Step 3: Write minimal implementation**

Add two helpers to `src/utils/routing.ts`:

```ts
export function isHomeView(view: View): boolean {
  return view.kind === 'home';
}

export function buildCurrentPageUrl(origin: string, search: string, hash: string): string {
  return `${origin}${search}${hash}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm exec -- node --test src/utils/routing.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/routing.ts src/utils/routing.test.ts
git commit -m "test: cover global share route helpers"
```

### Task 2: Add the global header share action

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css`

- [ ] **Step 1: Write the failing test**

Document the expected header logic in a focused routing assertion:

```ts
test('share URL is omitted for the home route', () => {
  expect(resolveGlobalShareUrl({ kind: 'home' }, 'https://oireachtas-explorer.ie', '', '#/dail/34')).toBeNull();
});

test('share URL is returned for a non-home route', () => {
  expect(resolveGlobalShareUrl({ kind: 'global-votes' }, 'https://oireachtas-explorer.ie', '', '#/dail/34/votes')).toBe(
    'https://oireachtas-explorer.ie#/dail/34/votes',
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm exec -- node --test src/utils/routing.test.ts`
Expected: FAIL because `resolveGlobalShareUrl` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

In `src/App.tsx`:

```tsx
const [globalShareOpen, setGlobalShareOpen] = useState(false);

const globalShareUrl = useMemo(
  () => resolveGlobalShareUrl(view, window.location.origin, window.location.search, window.location.hash),
  [view],
);
```

Render a header button only when `globalShareUrl` exists and mount:

```tsx
{globalShareUrl && (
  <button
    type="button"
    className="app-header__share"
    onClick={() => { setGlobalShareOpen(true); }}
    aria-label="Share this page"
  >
    Share
  </button>
)}
{globalShareOpen && globalShareUrl && (
  <ShareModal url={globalShareUrl} onClose={() => { setGlobalShareOpen(false); }} />
)}
```

In `src/App.css`, add layout-safe styles for `.app-header__share` and the mobile header flow.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm exec -- node --test src/utils/routing.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/App.css src/utils/routing.test.ts
git commit -m "feat: add global header share action"
```

### Task 3: Verify layout and exact-state behavior

**Files:**
- Modify: `src/utils/routing.test.ts`
- Test: `src/utils/routing.test.ts`

- [ ] **Step 1: Write the failing test**

Add exact-state coverage:

```ts
test('global share URL preserves filtered query and hash state', () => {
  expect(
    resolveGlobalShareUrl(
      { kind: 'search', query: 'housing' },
      'https://oireachtas-explorer.ie',
      '?filter=recent',
      '#/dail/34/search/housing',
    ),
  ).toBe('https://oireachtas-explorer.ie?filter=recent#/dail/34/search/housing');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm exec -- node --test src/utils/routing.test.ts`
Expected: FAIL if the URL builder drops query or hash state.

- [ ] **Step 3: Write minimal implementation**

Adjust `resolveGlobalShareUrl` or `buildCurrentPageUrl` only if needed so the exact current URL is preserved without special casing specific pages.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm exec -- node --test src/utils/routing.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/routing.ts src/utils/routing.test.ts
git commit -m "test: preserve exact state in global share urls"
```

### Task 4: Final verification

**Files:**
- Modify: `README.md` (only if implementation reveals user-facing behavior worth documenting)

- [ ] **Step 1: Run focused tests**

Run: `npm exec -- node --test src/utils/routing.test.ts worker/src/index.test.js`
Expected: PASS

- [ ] **Step 2: Run production build**

Run: `npm run build`
Expected: PASS with a successful Vite build

- [ ] **Step 3: Review diff for scope**

Run: `git diff -- src/App.tsx src/App.css src/utils/routing.ts src/utils/routing.test.ts`
Expected: only the global share feature changes

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/App.css src/utils/routing.ts src/utils/routing.test.ts README.md
git commit -m "feat: add global non-home share action"
```
