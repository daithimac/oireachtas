const fs = require('fs');
let code = fs.readFileSync('src/api/oireachtas.ts', 'utf8');

// Add HouseResult and fetchHouseDateRange
const newFuncs = `
export interface HouseResult {
  house: {
    dateRange: {
      start: string;
      end: string | null;
    };
  };
}

export async function fetchHouseDateRange(chamber: Chamber, houseNo: number, signal?: AbortSignal): Promise<{ start: string; end: string }> {
  try {
    const data = await apiFetch<OireachtasResult<HouseResult>>('/houses', { chamber_id: houseUri(chamber, houseNo) }, signal);
    if (data.results.length > 0) {
      const range = data.results[0].house.dateRange;
      return {
        start: range.start,
        end: range.end ?? new Date().toISOString().split('T')[0],
      };
    }
  } catch (e) {
    // Ignore error and fall back to getHouseDateRange
  }
  return getHouseDateRange(chamber, houseNo);
}
`;

code = code.replace("export function clearApiCache(): void {", newFuncs + "\nexport function clearApiCache(): void {");

// Now update extractParty and extractOffices to accept houseRange
code = code.replace(
  "function extractParty(memberships: MembershipRaw[], chamber: Chamber, houseNo: number): string {",
  "function extractParty(memberships: MembershipRaw[], chamber: Chamber, houseNo: number, houseRange: {start: string, end: string}): string {"
).replace(
  "  const houseRange = getHouseDateRange(chamber, houseNo);\n",
  ""
);

code = code.replace(
  "function extractOffices(memberships: MembershipRaw[], chamber: Chamber, houseNo: number): OfficeHolding[] {",
  "function extractOffices(memberships: MembershipRaw[], chamber: Chamber, houseNo: number, houseRange: {start: string, end: string}): OfficeHolding[] {"
).replace(
  "  const houseRange = getHouseDateRange(chamber, houseNo);\n",
  ""
);

// Update toMember
code = code.replace(
  "function toMember(r: MemberResult, chamber?: Chamber, houseNo?: number): Member {",
  "function toMember(r: MemberResult, chamber?: Chamber, houseNo?: number, houseRange?: {start: string, end: string}): Member {"
).replace(
  "extractParty(m.memberships, chamber, houseNo)",
  "extractParty(m.memberships, chamber, houseNo, houseRange!)"
).replace(
  "extractOffices(m.memberships, chamber, houseNo)",
  "extractOffices(m.memberships, chamber, houseNo, houseRange!)"
);

// Update functions that call toMember
code = code.replace(
  "return data.results.map(r => toMember(r, chamber, resolvedHouseNo));",
  `const houseRange = await fetchHouseDateRange(chamber, resolvedHouseNo, signal);
  return data.results.map(r => toMember(r, chamber, resolvedHouseNo, houseRange));`
);

code = code.replace(
  "return toMember(data.results[0], chamber, houseNo);",
  `const houseRange = await fetchHouseDateRange(chamber, houseNo, signal);
  return toMember(data.results[0], chamber, houseNo, houseRange);`
);

// Update fetchGlobalDebates, fetchCommitteeDebateSearch, fetchCommitteeDebateIndex
code = code.replace(
  "const range = getHouseDateRange(chamber, houseNo);\n    params.date_start = range.start;\n    params.date_end = range.end;",
  "const range = await fetchHouseDateRange(chamber, houseNo, signal);\n    params.date_start = range.start;\n    params.date_end = range.end;"
);

code = code.replace(
  "const range = getHouseDateRange(chamber, houseNo);\n  const pageSize = 100;",
  "const range = await fetchHouseDateRange(chamber, houseNo, signal);\n  const pageSize = 100;"
);

code = code.replace(
  "const range = getHouseDateRange(chamber, houseNo);\n  const params: Record<string, string | number> = {",
  "const range = await fetchHouseDateRange(chamber, houseNo, signal);\n  const params: Record<string, string | number> = {"
);

// Update fetchQuestions, fetchGlobalQuestions
code = code.replace(
  "const { start, end } = getHouseDateRange(chamber, houseNo);\n  const params: Record<string, string | number> = {",
  "const { start, end } = await fetchHouseDateRange(chamber, houseNo, signal);\n  const params: Record<string, string | number> = {"
);

code = code.replace(
  "const { start, end } = getHouseDateRange(chamber, houseNo);\n  const data = await apiFetch<OireachtasResult<QuestionResult>>(",
  "const { start, end } = await fetchHouseDateRange(chamber, houseNo, signal);\n  const data = await apiFetch<OireachtasResult<QuestionResult>>("
);

// Update fetchLegislation
code = code.replace(
  "const { start, end } = getHouseDateRange(chamber, houseNo);\n  applyDateParams(params, dateStart ?? start, dateEnd ?? end);",
  "const { start, end } = await fetchHouseDateRange(chamber, houseNo, signal);\n  applyDateParams(params, dateStart ?? start, dateEnd ?? end);"
);

fs.writeFileSync('src/api/oireachtas.ts', code);
