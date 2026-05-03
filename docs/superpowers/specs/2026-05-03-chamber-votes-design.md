# Chamber Votes Explorer Design

## Goal

Add a chamber-level votes explorer to the web app so users can browse votes for the selected Dail or Seanad session, filter the list, share individual votes, and drill into a Tá/Níl member split.

## Scope

The feature is web-only for this pass. Existing member profile voting records remain powered by their current code path. The new explorer uses the Oireachtas `/votes` endpoint as the source of truth.

## User Flow

1. The home page and header expose a `Votes` or `See Votes` option.
2. Selecting it opens a chamber/session votes page.
3. The votes page shows one chronological list, newest first.
4. Users can filter by date range, search vote titles/subjects/categories, filter by topic/category, and optionally filter by outcome.
5. Each vote row shows title, date, outcome, category/topic when available, Tá/Níl totals, a share action, and a detail action.
6. Selecting a vote opens a vote detail route.
7. The detail page shows vote metadata and member cards split into Tá and Níl columns, with abstentions shown below if returned.

## API Design

Use `GET /votes`.

List query parameters:

- `chamber_type=house`
- `chamber=dail` or `chamber=seanad`
- `date_start` and `date_end`
- `outcome` when the user chooses Carried or Lost
- `skip` and `limit`

Detail query parameters:

- `vote_id=<division.uri>`
- `limit=500`

The response maps through `division`. The list view deduplicates by `division.uri` so it remains correct whether the endpoint returns one row per vote or one row per member tally. The detail view groups `division.memberTally` entries by `Tá`, `Níl`, and `Staon`.

## Routes

- `#/dail/34/votes`
- `#/dail/34/vote/<encoded vote uri>/<encoded title>`

The same route shape works for Seanad by replacing the chamber/session segment.

## Components

- `GlobalVotesPage`: page shell, filters, pagination, list, share modal.
- `VoteDetailPage`: detail fetch, metadata summary, Tá/Níl split layout, member cards.

The implementation should reuse existing utilities for dates, routing, member photos, party colours, and short-link sharing.

## States

- Loading, error, empty list, loading more.
- Filtered empty state when search/topic filters hide all loaded results.
- Vote detail loading, missing vote, and missing member tally states.

## Verification

- Route serialization and parsing for the two new views.
- `/votes` mapping and detail grouping.
- TypeScript build and ESLint.
- Local browser check for the votes list and vote detail route.
