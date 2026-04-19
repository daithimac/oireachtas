import { useState, useEffect, useCallback } from 'react';
import './App.css';
import type { Chamber, View, Constituency, Member } from './types';
import { LogoSVG } from './components/Logo';
import { fetchConstituencies, fetchAllMembers } from './api/oireachtas';
import { houseList, LATEST_DAIL, LATEST_SEANAD, chamberName, memberNoun } from './utils/dail';
import { ConstituencyPicker } from './components/ConstituencyPicker';
import { MemberGrid } from './components/MemberGrid';
import { MemberCard } from './components/MemberCard';
import { MemberProfile } from './components/MemberProfile';
import { GlobalDebatesList } from './components/GlobalDebatesList';
import { DebateViewerPage } from './components/DebateViewerPage';
import { BillViewerPage } from './components/BillViewerPage';
import { AttributionFooter } from './components/AttributionFooter';
import { CommitteePage } from './components/CommitteePage';
import { OfficesPage } from './components/OfficesPage';
import { viewToHash, parseHash } from './utils/routing';

function latestForChamber(c: Chamber): number {
  return c === 'seanad' ? LATEST_SEANAD : LATEST_DAIL;
}

export default function App() {
  const initial = parseHash(window.location.hash);
  const [view, setView] = useState<View>(initial.view);
  const [chamber, setChamber] = useState<Chamber>(initial.chamber);
  const [houseNo, setHouseNo] = useState(initial.houseNo);
  const [constituencies, setConstituencies] = useState<Constituency[]>([]);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [loadingConstituencies, setLoadingConstituencies] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [constituenciesError, setConstituenciesError] = useState<string | null>(null);

  useEffect(() => {
    setLoadingConstituencies(true);
    setLoadingMembers(true);
    setConstituenciesError(null);
    fetchConstituencies(chamber, houseNo)
      .then(setConstituencies)
      .catch((err: unknown) => {
        setConstituenciesError(err instanceof Error ? err.message : 'Failed to load constituencies');
        setConstituencies([]);
      })
      .finally(() => { setLoadingConstituencies(false); });
    fetchAllMembers(chamber, houseNo)
      .then(setAllMembers)
      .catch(() => { setAllMembers([]); })
      .finally(() => { setLoadingMembers(false); });
  }, [chamber, houseNo]);

  useEffect(() => {
    function onHashChange() {
      const parsed = parseHash(window.location.hash);
      setView(parsed.view);
      setChamber(parsed.chamber);
      setHouseNo(parsed.houseNo);
    }
    window.addEventListener('hashchange', onHashChange);
    return () => { window.removeEventListener('hashchange', onHashChange); };
  }, []);

  const navigate = useCallback((newView: View, newHouseNo?: number, newChamber?: Chamber) => {
    const c = newChamber ?? chamber;
    const h = newHouseNo ?? houseNo;
    setView(newView);
    if (newChamber !== undefined) setChamber(newChamber);
    if (newHouseNo !== undefined) setHouseNo(newHouseNo);
    window.location.hash = viewToHash(newView, c, h);
  }, [chamber, houseNo]);

  const handleSelectConstituency = useCallback((code: string, name: string) => {
    navigate({ kind: 'members', constituencyCode: code, constituencyName: name });
  }, [navigate]);

  const handleSelectMember = useCallback(
    (memberUri: string, memberName: string, constituencyCode: string, constituencyName: string) => {
      navigate({ kind: 'member', memberUri, memberName, constituencyCode, constituencyName });
    },
    [navigate]
  );

  const handleBack = useCallback(() => {
    window.history.back();
  }, []);

  const handleGoHome = useCallback(() => {
    navigate({ kind: 'home' });
  }, [navigate]);

  const handleHouseChange = useCallback((newHouseNo: number) => {
    navigate({ kind: 'home' }, newHouseNo);
  }, [navigate]);

  const handleChamberToggle = useCallback((newChamber: Chamber) => {
    if (newChamber === chamber) return;
    navigate({ kind: 'home' }, latestForChamber(newChamber), newChamber);
  }, [chamber, navigate]);

  function renderView() {
    if (constituenciesError && view.kind === 'home') {
      return (
        <div className="container">
          <div className="error-banner">Failed to load {chamber === 'seanad' ? 'panels' : 'constituencies'}: {constituenciesError}</div>
        </div>
      );
    }

    switch (view.kind) {
      case 'home':
        return (
          <div className="picker">
            <div className="picker__hero">
              <LogoSVG size={120} className="picker__icon" />
              <h1 className="picker__title">Oireachtas Explorer</h1>
              <p className="picker__description">
                Explore {memberNoun(chamber, true)} from any {chamberName(chamber)} in Irish history — their voting records, speeches, debates, and parliamentary questions.
              </p>
            </div>

            <ConstituencyPicker
              constituencies={constituencies}
              allMembers={allMembers}
              loading={loadingConstituencies}
              loadingMembers={loadingMembers}
              chamber={chamber}
              houseNo={houseNo}
              onSelect={handleSelectConstituency}
            />

            <div className="picker__secondary">
              <h2 className="picker__secondary-title">{chamberName(chamber)} Debates Index</h2>
              <p className="picker__secondary-desc">Read official transcripts from recent plenary and committee debates.</p>
              <button
                className="picker__secondary-btn"
                onClick={() => { navigate({ kind: 'global-debates', houseNo }); }}
              >
                Browse All Debates
              </button>
            </div>
          </div>
        );
      case 'members':
        return (
          <MemberGrid
            constituencyCode={view.constituencyCode}
            constituencyName={view.constituencyName}
            chamber={chamber}
            houseNo={houseNo}
            allMembers={allMembers}
            loadingAllMembers={loadingMembers}
            onSelectMember={handleSelectMember}
            onBack={handleBack}
          />
        );
      case 'member':
        return (
          <MemberProfile
            memberUri={view.memberUri}
            constituencyName={view.constituencyName}
            chamber={chamber}
            houseNo={houseNo}
            onBack={handleBack}
            onNavigate={navigate}
          />
        );
      case 'offices':
        return (
          <OfficesPage
            chamber={chamber}
            houseNo={houseNo}
            allMembers={allMembers}
            loadingAllMembers={loadingMembers}
            onSelectMember={handleSelectMember}
            onBack={handleBack}
          />
        );
      case 'committee':
        return (
          <CommitteePage
            committeeUri={view.committeeUri}
            committeeName={view.committeeName}
            chamber={chamber}
            houseNo={houseNo}
            allMembers={allMembers}
            loadingAllMembers={loadingMembers}
            onSelectMember={handleSelectMember}
            onBack={handleBack}
          />
        );
      case 'global-debates':
        return (
          <div className="container">
            <button className="back-btn" onClick={handleBack}>← Back</button>
            <h1 className="section-heading" style={{ marginBottom: '0.5rem' }}>All {chamberName(chamber)} Debates</h1>
            <p className="section-subheading" style={{ marginBottom: '2rem' }}>Chronological official records of legislative proceedings.</p>
            <GlobalDebatesList
              chamber={chamber}
              houseNo={houseNo}
              onNavigateToDebate={navigate}
            />
          </div>
        );
      case 'party':
        return (
          <div className="container">
            <div className="members-header">
              <button className="back-btn" onClick={handleBack}>← Back</button>
              <h1>{view.partyName} {memberNoun(chamber, true)}</h1>
            </div>
            <div className="member-grid">
              {allMembers.filter(m => m.party === view.partyName).map(m => (
                <MemberCard
                  key={m.memberCode}
                  member={m}
                  onClick={() => { handleSelectMember(m.uri, m.fullName, m.constituencyCode, m.constituency); }}
                />
              ))}
            </div>
          </div>
        );
      case 'debate-viewer':
        return (
          <DebateViewerPage
            xmlUri={view.xmlUri}
            debateSectionUri={view.debateSectionUri}
            title={view.title}
            focusMemberUri={view.focusMemberUri}
            chamber={chamber}
            houseNo={houseNo}
            onBack={handleBack}
          />
        );
      case 'bill-viewer':
        return (
          <BillViewerPage
            billNo={view.billNo}
            billYear={view.billYear}
            onBack={handleBack}
          />
        );
    }
  }

  const currentList = houseList(chamber);
  const latest = latestForChamber(chamber);

  return (
    <div className="app">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <header className="app-header">
        <button
          className="app-header__home"
          onClick={handleGoHome}
          aria-label="Go to home page"
        >
          <LogoSVG size={28} className="color-accent" />
          <span className="app-header__title">Oireachtas Explorer</span>
        </button>
        <div className="app-header__subtitle-container" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div
            role="group"
            aria-label="Select chamber"
            style={{
              display: 'inline-flex',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-pill, 999px)',
              overflow: 'hidden',
              background: 'var(--color-surface, white)',
            }}
          >
            {(['dail', 'seanad'] as Chamber[]).map((c) => {
              const active = c === chamber;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => { handleChamberToggle(c); }}
                  aria-pressed={active}
                  style={{
                    padding: '6px 14px',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    background: active ? 'var(--color-accent)' : 'transparent',
                    color: active ? 'white' : 'var(--color-text-primary)',
                  }}
                >
                  {chamberName(c)}
                </button>
              );
            })}
          </div>
          <select
            className="app-header__subtitle"
            value={houseNo}
            onChange={(e) => { handleHouseChange(parseInt(e.target.value, 10)); }}
            aria-label={`Select ${chamberName(chamber)} session`}
          >
            {currentList.map((d) => (
              <option key={d.houseNo} value={d.houseNo}>
                {d.houseNo}{d.houseNo === latest ? ' (Current)' : ''} {chamberName(chamber)}
              </option>
            ))}
          </select>
        </div>
      </header>
      <main id="main-content" className="page-transition" tabIndex={-1}>{renderView()}</main>
      <AttributionFooter />
    </div>
  );
}
