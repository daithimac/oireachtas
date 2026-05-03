const fs = require('fs');

// Patch src/utils/dail.ts
let dail = fs.readFileSync('src/utils/dail.ts', 'utf8');
dail = dail.replace(
  "export function getHousePresetYearRange(chamber: Chamber, houseNo: number): { start: string; end: string } {",
  "export function getHousePresetYearRange(range: { start: string; end: string }): { start: string; end: string } {"
).replace(
  "  const today = isoDate(new Date());\n  const range = getHouseDateRange(chamber, houseNo);\n  const currentYearStart = `${today.slice(0, 4)}-01-01`;",
  "  const today = isoDate(new Date());\n  const currentYearStart = `${today.slice(0, 4)}-01-01`;"
);
fs.writeFileSync('src/utils/dail.ts', dail);

// Patch src/components/GlobalDebatesList.tsx
let gdl = fs.readFileSync('src/components/GlobalDebatesList.tsx', 'utf8');
gdl = gdl.replace(
  "import { fetchCommitteeDebateIndex, fetchCommitteeDebateSearch, fetchGlobalDebates, type ChamberType, type CommitteeDebateIndexItem } from '../api/oireachtas';",
  "import { fetchCommitteeDebateIndex, fetchCommitteeDebateSearch, fetchGlobalDebates, fetchHouseDateRange, type ChamberType, type CommitteeDebateIndexItem } from '../api/oireachtas';"
).replace(
  "import { getHouseDateRange, chamberName } from '../utils/dail';",
  "import { chamberName } from '../utils/dail';"
).replace(
  `  useEffect(() => {
    const range = getHouseDateRange(chamber, houseNo);
    setDateStart(range.start);
    const today = new Date().toISOString().split('T')[0];
    setDateEnd(range.end > today ? today : range.end);
  }, [chamber, houseNo]);`,
  `  useEffect(() => {
    let active = true;
    void fetchHouseDateRange(chamber, houseNo).then(range => {
      if (!active) return;
      setDateStart(range.start);
      const today = new Date().toISOString().split('T')[0];
      setDateEnd(range.end > today ? today : range.end);
    });
    return () => { active = false; };
  }, [chamber, houseNo]);`
);
fs.writeFileSync('src/components/GlobalDebatesList.tsx', gdl);

// Patch src/components/GlobalVotesPage.tsx
let gvp = fs.readFileSync('src/components/GlobalVotesPage.tsx', 'utf8');
gvp = gvp.replace(
  "import { fetchChamberVotes } from '../api/oireachtas';",
  "import { fetchChamberVotes, fetchHouseDateRange } from '../api/oireachtas';"
).replace(
  "import { getHouseDateRange, chamberName } from '../utils/dail';",
  "import { chamberName } from '../utils/dail';"
).replace(
  "import { useCallback, useMemo, useState } from 'react';",
  "import { useCallback, useEffect, useMemo, useState } from 'react';"
).replace(
  "  const range = useMemo(() => getHouseDateRange(chamber, houseNo), [chamber, houseNo]);\n  const [dateStart, setDateStart] = useState(range.start);\n  const [dateEnd, setDateEnd] = useState(range.end);",
  `  const [range, setRange] = useState({ start: '', end: '' });
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  useEffect(() => {
    let active = true;
    void fetchHouseDateRange(chamber, houseNo).then(r => {
      if (!active) return;
      setRange(r);
      setDateStart(r.start);
      setDateEnd(r.end);
    });
    return () => { active = false; };
  }, [chamber, houseNo]);`
);
fs.writeFileSync('src/components/GlobalVotesPage.tsx', gvp);

// Patch src/components/GlobalLegislationPage.tsx
let glp = fs.readFileSync('src/components/GlobalLegislationPage.tsx', 'utf8');
glp = glp.replace(
  "import { fetchGlobalLegislation } from '../api/oireachtas';",
  "import { fetchGlobalLegislation, fetchHouseDateRange } from '../api/oireachtas';"
).replace(
  "import { getHouseDateRange, getHousePresetYearRange, houseLabel } from '../utils/dail';",
  "import { getHousePresetYearRange, houseLabel } from '../utils/dail';"
).replace(
  `  const houseRange = useMemo(() => getHouseDateRange(chamber, houseNo), [chamber, houseNo]);
  const presetYear = useMemo(() => getHousePresetYearRange(chamber, houseNo), [chamber, houseNo]);
  const [activeTab, setActiveTab] = useState<LegislationTab>('All');
  const [dateStart, setDateStart] = useState(presetYear.start);
  const [dateEnd, setDateEnd] = useState(presetYear.end);

  useEffect(() => {
    setDateStart(presetYear.start);
    setDateEnd(presetYear.end);
    setActiveTab('All');
  }, [presetYear.start, presetYear.end]);`,
  `  const [houseRange, setHouseRange] = useState({ start: '', end: '' });
  const [presetYear, setPresetYear] = useState({ start: '', end: '' });
  const [activeTab, setActiveTab] = useState<LegislationTab>('All');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  useEffect(() => {
    let active = true;
    void fetchHouseDateRange(chamber, houseNo).then(r => {
      if (!active) return;
      setHouseRange(r);
      const py = getHousePresetYearRange(r);
      setPresetYear(py);
      setDateStart(py.start);
      setDateEnd(py.end);
      setActiveTab('All');
    });
    return () => { active = false; };
  }, [chamber, houseNo]);`
);
fs.writeFileSync('src/components/GlobalLegislationPage.tsx', glp);

// Patch src/components/CompareMembersPage.tsx
let cmp = fs.readFileSync('src/components/CompareMembersPage.tsx', 'utf8');
cmp = cmp.replace(
  "import { fetchAllMembers, fetchAllQuestionsForMember, fetchDebates, fetchDivisions } from '../api/oireachtas';",
  "import { fetchAllMembers, fetchAllQuestionsForMember, fetchDebates, fetchDivisions, fetchHouseDateRange } from '../api/oireachtas';"
).replace(
  "import { getHouseDateRange, getHousePresetYearRange } from '../utils/dail';",
  "import { getHousePresetYearRange } from '../utils/dail';"
).replace(
  "import { useMemo, useState } from 'react';",
  "import { useEffect, useMemo, useState } from 'react';"
).replace(
  `  const houseRange = useMemo(() => getHouseDateRange(chamber, houseNo), [chamber, houseNo]);
  const presetYear = useMemo(() => getHousePresetYearRange(chamber, houseNo), [chamber, houseNo]);
  const [dateStart, setDateStart] = useState(presetYear.start);
  const [dateEnd, setDateEnd] = useState(presetYear.end);`,
  `  const [houseRange, setHouseRange] = useState({ start: '', end: '' });
  const [presetYear, setPresetYear] = useState({ start: '', end: '' });
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  useEffect(() => {
    let active = true;
    void fetchHouseDateRange(chamber, houseNo).then(r => {
      if (!active) return;
      setHouseRange(r);
      const py = getHousePresetYearRange(r);
      setPresetYear(py);
      setDateStart(py.start);
      setDateEnd(py.end);
    });
    return () => { active = false; };
  }, [chamber, houseNo]);`
);
fs.writeFileSync('src/components/CompareMembersPage.tsx', cmp);

