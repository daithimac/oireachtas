# Global Share Action Design

## Goal

Add a consistent top-right share action to every navigable web-app page except the home page, so users can copy a persistent Worker-backed short link for the exact current page state.

The feature should support the app's core sharing use cases across debates, votes, legislation, members, party views, committee views, saved/public collections, and filtered list pages used by politicians, journalists, academics, students, and activists.

## Requirements

1. Every non-home navigable page should show a top-right share action styled consistently with the existing vote-detail share control.
2. The home page should never show the global share action.
3. The shared URL must represent the exact current state when that state is already encoded in the URL, including route path, hash segments, and query parameters if present.
4. The existing `ShareModal` and Cloudflare Worker short-link flow should remain the single mechanism for resolving and copying share URLs.
5. Existing route-specific share buttons may remain during the rollout to avoid accidental loss of local functionality; cleanup can happen later.
6. The change should minimize page-by-page duplication and make it difficult to forget future routes.

## Current Context

The app already has several local share entry points:

- `VoteDetailPage`
- `DebateViewerPage`
- `DebatesList`
- `GlobalVotesPage`
- `QuestionsList`
- `BillCard`
- `MemberCard`

These currently open `ShareModal` with route-specific URLs assembled inline. The app shell and routing live primarily in `src/App.tsx`, making it the best place to centralize a page-level share action.

The Worker-backed short-link flow is already configured and now supports a canonical branded short-link host via `SHORTLINK_BASE_URL`.

## Recommended Approach

Use a centralized route-metadata-style share resolver in `src/App.tsx` that computes whether the current page is shareable and, if so, returns the canonical current URL. Render one shared top-right share action in the app header or page shell using that resolved URL.

This is preferred over per-page wiring because it:

- keeps eligibility rules in one place
- ensures new routes are less likely to be missed
- reduces repetitive local share-button state
- guarantees consistent UX and copy behavior

## Design

### 1. Share Resolution

Introduce a small helper layer that derives:

- `isHomeRoute`
- `pageShareUrl`
- optional `pageShareLabel` for accessibility text

The simplest canonical URL rule is:

- use `window.location.origin + window.location.pathname + window.location.hash`
- preserve `window.location.search` too if query parameters are present

This ensures the exact current state is shared when the URL already encodes filters, selected tabs, route segments, or focused content.

### 2. Eligibility Rules

The global share action is shown for every navigable route except the home route.

The home route is defined as the top-level chamber landing view with no deeper view segment beyond the current house number. For example:

- share disabled: `#/34`
- share enabled: `#/34/debates`
- share enabled: `#/34/member/...`
- share enabled: `#/34/party/...`
- share enabled: `#/34/committee/...`
- share enabled: `#/34/votes/...`
- share enabled: `#/34/legislation`
- share enabled: `#/34/search/...`
- share enabled: `#/34/saved`

If the router already computes a parsed route object, the helper should use that route shape instead of brittle string-only checks where practical.

### 3. UI Placement

Render the global share action in the upper-right app chrome near the existing header controls so it feels like a page action, not page content.

The control should:

- use the same visual language as the vote-detail share action
- be keyboard accessible
- have a stable hit target on mobile and desktop
- include a clear accessible label such as `Share this page`

The control opens the existing `ShareModal`.

### 4. State Ownership

The global share modal state should live in `App.tsx` or the shared shell component that renders the top-level header.

That state should include:

- `isShareOpen`
- `pageShareUrl`

This avoids each page creating its own share modal for the global header action.

### 5. Existing Local Share Buttons

Do not remove current local share controls in this change unless they conflict visually or functionally. They serve different scopes in some places:

- card-level share actions can still be useful inside lists
- item-level share actions inside a composite page can coexist with the page share action

After the global action lands, we can audit duplicates and decide which local buttons still earn their place.

## Implementation Outline

1. Add a share-resolution helper in `App.tsx` or a small new utility module.
2. Detect whether the current route is home or non-home.
3. Compute the exact current page URL from browser location.
4. Add a global header action button that appears only when `pageShareUrl` exists.
5. Open `ShareModal` from the header action using that URL.
6. Keep existing local share buttons unchanged in this pass.
7. Add focused tests for route eligibility and URL resolution if the current test setup supports it.

## Error Handling

- If short links are not configured, `ShareModal` already falls back to copying the long URL.
- If the Worker is temporarily unavailable, the user should still be able to copy the canonical current URL through the existing fallback behavior.
- If a route cannot be resolved confidently, the safe fallback is to hide the global share action for that route rather than emit an incorrect URL.

## Testing

Verify at minimum:

1. Home route does not show the global share button.
2. Major non-home routes do show it.
3. The resolved URL includes exact current hash/query state.
4. Opening the action launches `ShareModal`.
5. Copy flow still works with and without Worker short-link availability.
6. Header layout remains coherent on mobile and desktop.

## Scope Boundaries

Included:

- global header/page-shell share action for non-home routes
- exact-state URL sharing
- reuse of existing short-link modal and Worker integration

Not included:

- removing all local share buttons
- redesigning route encoding
- adding analytics or share destination presets

## Open Decision Resolved

Exact current state should be shared whenever the URL already captures it. This applies to filtered and drill-down views, not just simple detail pages.
