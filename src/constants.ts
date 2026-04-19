// Shared application constants.

export const DEFAULT_PAGE_SIZE = 20;
export const VOTES_PAGE_SIZE = 200;

// Upper-bound page size when fully paginating a member's voting history
// for the donut breakdown. Chosen empirically as a robust batch size.
export const VOTE_HISTORY_CHUNK_LIMIT = 500;

// SVG geometry for the vote-breakdown donut on the member overview.
export const VOTE_DONUT_RADIUS = 40;
