export function formatDate(isoDate: string): string {
  if (!isoDate) return '';
  return new Date(isoDate).toLocaleDateString('en-IE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatDateShort(isoDate: string): string {
  if (!isoDate) return '';
  return new Date(isoDate).toLocaleDateString('en-IE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const PARTY_COLORS: Record<string, string> = {
  'fianna': '#006633',
  'fine gael': '#004899',
  'sinn féin': '#326760',
  'sinn fein': '#326760',
  'labour': '#cc0000',
  'green': '#337738',
  'social democrat': '#752f8f',
  'aontú': '#007c4c',
  'aontu': '#007c4c',
  'people before profit': '#e63329',
  'solidarity': '#e63329',
  'right to change': '#f58220',
  'independent ireland': '#1a237e',
};

export function partyColor(partyName: string): string {
  const name = partyName.toLowerCase();
  for (const [key, color] of Object.entries(PARTY_COLORS)) {
    if (name.includes(key)) return color;
  }
  return '#555555';
}

/** Returns a human-readable label for a bill status */
export function billStatusLabel(status: string): string {
  const s = status.toLowerCase();
  if (s === 'current' || s === 'published') return 'In Progress';
  if (s === 'enacted') return 'Enacted';
  if (s === 'defeated') return 'Defeated';
  if (s === 'rejected') return 'Rejected';
  if (s === 'withdrawn') return 'Withdrawn';
  if (s === 'lapsed') return 'Lapsed';
  return status;
}

export function billStatusClass(status: string): string {
  const s = status.toLowerCase();
  if (s === 'enacted') return 'bill-status--enacted';
  if (s === 'current' || s === 'published') return 'bill-status--current';
  if (s === 'defeated' || s === 'rejected') return 'bill-status--defeated';
  return 'bill-status--other';
}
