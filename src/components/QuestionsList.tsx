import { useState, useCallback, useMemo, type KeyboardEvent } from 'react';
import { Link } from 'lucide-react';
import { usePaginatedList } from '../hooks/usePaginatedList';
import { useAsync } from '../hooks/useAsync';
import { fetchAllQuestionsForMember, fetchQuestions } from '../api/oireachtas';
import { fetchDebateTranscript } from '../api/transcripts';
import type { Chamber, Question, SpeechSegment } from '../types';
import { formatDateShort } from '../utils/format';
import { viewToHash } from '../utils/routing';
import { ShareModal } from './ShareModal';

interface QuestionsListProps {
  memberUri: string;
  chamber: Chamber;
  houseNo: number;
}

type TypeFilter = 'all' | 'oral' | 'written';

const PAGE_SIZE = 20;

function monthKey(date: string): string {
  return date.slice(0, 7);
}

function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number);
  if (!year || !month) return key;
  return new Intl.DateTimeFormat('en-IE', { month: 'short', year: '2-digit' }).format(new Date(year, month - 1, 1));
}

function questionMatchesType(question: Question, typeFilter: TypeFilter): boolean {
  if (typeFilter === 'oral') return question.questionType.toLowerCase().includes('oral');
  if (typeFilter === 'written') return question.questionType.toLowerCase().includes('written');
  return true;
}

function questionDepartment(question: Question): string {
  return question.department || 'Unspecified department';
}

interface QuestionsInsightsProps {
  questions: Question[];
  total: number;
  loading: boolean;
  activeDepartment: string | null;
  activeMonthFilter: string | null;
  typeFilter: TypeFilter;
  onDepartmentSelect: (department: string) => void;
  onMonthSelect: (month: string, type: TypeFilter) => void;
}

function QuestionsInsights({
  questions,
  total,
  loading,
  activeDepartment,
  activeMonthFilter,
  typeFilter,
  onDepartmentSelect,
  onMonthSelect,
}: QuestionsInsightsProps) {
  const [hoverMonth, setHoverMonth] = useState<string | null>(null);
  const askedQuestions = useMemo(() => questions.filter((q) => q.role === 'asked'), [questions]);
  const questionsForDepartmentChart = useMemo(() => {
    return askedQuestions.filter((question) => {
      if (!questionMatchesType(question, typeFilter)) return false;
      if (activeMonthFilter && monthKey(question.date) !== activeMonthFilter) return false;
      return true;
    });
  }, [activeMonthFilter, askedQuestions, typeFilter]);
  const questionsForMonthlyChart = useMemo(() => {
    return askedQuestions.filter((question) => {
      if (activeDepartment && questionDepartment(question) !== activeDepartment) return false;
      return true;
    });
  }, [activeDepartment, askedQuestions]);
  const departmentStats = useMemo(() => {
    const counts = new Map<string, number>();
    for (const question of questionsForDepartmentChart) {
      const department = questionDepartment(question);
      counts.set(department, (counts.get(department) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([department, count]) => ({ department, count }))
      .sort((a, b) => b.count - a.count || a.department.localeCompare(b.department))
      .slice(0, 8);
  }, [questionsForDepartmentChart]);

  const monthlyStats = useMemo(() => {
    const counts = new Map<string, { total: number; oral: number }>();
    for (const question of questionsForMonthlyChart) {
      const key = monthKey(question.date);
      if (!key) continue;
      const current = counts.get(key) ?? { total: 0, oral: 0 };
      current.total += 1;
      if (question.questionType.toLowerCase().includes('oral')) current.oral += 1;
      counts.set(key, current);
    }
    return Array.from(counts.entries())
      .map(([month, count]) => ({ month, total: count.total, oral: count.oral }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [questionsForMonthlyChart]);

  const maxDepartment = Math.max(1, ...departmentStats.map((item) => item.count));
  const maxMonthly = Math.max(1, ...monthlyStats.map((item) => item.total));
  const chartWidth = 640;
  const chartHeight = 180;
  const chartPadX = 44;
  const chartPadY = 28;
  const yTicks = Array.from(new Set([0, Math.ceil(maxMonthly / 2), maxMonthly])).sort((a, b) => a - b);
  const points = monthlyStats.map((item, index) => {
    const x = monthlyStats.length === 1
      ? chartWidth / 2
      : chartPadX + (index / (monthlyStats.length - 1)) * (chartWidth - chartPadX * 2);
    const y = chartHeight - chartPadY - (item.total / maxMonthly) * (chartHeight - chartPadY * 2);
    const oralY = chartHeight - chartPadY - (item.oral / maxMonthly) * (chartHeight - chartPadY * 2);
    return { ...item, x, y, oralY };
  });
  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
  const oralLinePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.oralY.toFixed(1)}`).join(' ');
  const activePoint = points.find((point) => point.month === hoverMonth);
  const tooltipLeft = activePoint ? (activePoint.x / chartWidth) * 100 : 0;
  const tooltipTop = activePoint ? (Math.min(activePoint.y, activePoint.oralY) / chartHeight) * 100 : 0;

  const handleMonthHover = (month: string) => {
    setHoverMonth(month);
  };

  const handleMonthLeave = (month: string) => {
    setHoverMonth((current) => current === month ? null : current);
  };

  const handleTooltipKeyDown = (event: KeyboardEvent<SVGCircleElement>, month: string, filterType: TypeFilter) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onMonthSelect(month, filterType);
    } else if (event.key === 'Escape') {
      setHoverMonth(null);
    }
  };

  if (loading && questions.length === 0) {
    return (
      <div className="questions-insights">
        <div className="questions-insights__loading">
          <div className="spinner" aria-hidden="true" />
          <span>Preparing question insights...</span>
        </div>
      </div>
    );
  }

  if (askedQuestions.length === 0) return null;

  return (
    <section className="questions-insights" aria-label="Question activity visualisations">
      <div className="questions-insights__header">
        <div>
          <h3>Question activity</h3>
          <p>
            {askedQuestions.length} asked question{askedQuestions.length !== 1 ? 's' : ''} analysed
            {total > questions.length ? ` from the first ${questions.length} loaded records` : ''}
          </p>
        </div>
      </div>

      <div className="questions-insights__grid">
        <div className="questions-chart">
          <div className="questions-chart__title">
            Departments asked
            {(activeMonthFilter !== null || typeFilter !== 'all') && (
              <span className="questions-chart__context">
                {activeMonthFilter ? monthLabel(activeMonthFilter) : ''}
                {activeMonthFilter && typeFilter !== 'all' ? ' · ' : ''}
                {typeFilter !== 'all' ? typeFilter : ''}
              </span>
            )}
          </div>
          <div className="dept-bars">
            {departmentStats.map((item) => (
              <button
                key={item.department}
                type="button"
                className={`dept-bar${activeDepartment === item.department ? ' dept-bar--active' : ''}`}
                onClick={() => { onDepartmentSelect(item.department); }}
                aria-pressed={activeDepartment === item.department}
              >
                <div className="dept-bar__label">
                  <span>{item.department}</span>
                  <strong>{item.count}</strong>
                </div>
                <div className="dept-bar__track">
                  <div className="dept-bar__fill" style={{ width: `${Math.max(5, (item.count / maxDepartment) * 100)}%` }} />
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="questions-chart">
          <div className="questions-chart__title-row">
            <div className="questions-chart__title">
              Questions by month
              {activeDepartment && <span className="questions-chart__context">{activeDepartment}</span>}
            </div>
            <div className="monthly-chart__legend" aria-hidden="true">
              <span><i className="monthly-chart__legend-line monthly-chart__legend-line--total" />Total</span>
              <span><i className="monthly-chart__legend-line monthly-chart__legend-line--oral" />Oral</span>
            </div>
          </div>
          {monthlyStats.length > 0 ? (
            <div className="monthly-chart" role="img" aria-label="Line chart showing monthly parliamentary questions asked">
              <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none">
                {yTicks.map((tick) => {
                  const y = chartHeight - chartPadY - (tick / maxMonthly) * (chartHeight - chartPadY * 2);
                  return (
                    <g key={tick}>
                      <line x1={chartPadX} y1={y} x2={chartWidth - chartPadY} y2={y} className="monthly-chart__grid" />
                      <text x={chartPadX - 10} y={y + 4} textAnchor="end" className="monthly-chart__tick">{tick}</text>
                    </g>
                  );
                })}
                <line x1={chartPadX} y1={chartHeight - chartPadY} x2={chartWidth - chartPadY} y2={chartHeight - chartPadY} className="monthly-chart__axis" />
                <line x1={chartPadX} y1={chartPadY} x2={chartPadX} y2={chartHeight - chartPadY} className="monthly-chart__axis" />
                {linePath && <path d={linePath} className="monthly-chart__line" />}
                {oralLinePath && <path d={oralLinePath} className="monthly-chart__line monthly-chart__line--oral" />}
                {points.map((point) => (
                  <g key={point.month}>
                    <line x1={point.x} y1={chartPadY} x2={point.x} y2={chartHeight - chartPadY} className={`monthly-chart__hover-line${hoverMonth === point.month || activeMonthFilter === point.month ? ' monthly-chart__hover-line--active' : ''}`} />
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r="8"
                      className="monthly-chart__hit-area"
                      tabIndex={0}
                      role="button"
                      aria-label={`Filter to all questions in ${monthLabel(point.month)}: ${point.total} questions`}
                      onMouseEnter={() => { handleMonthHover(point.month); }}
                      onMouseLeave={() => { handleMonthLeave(point.month); }}
                      onFocus={() => { handleMonthHover(point.month); }}
                      onBlur={() => { handleMonthLeave(point.month); }}
                      onClick={() => { onMonthSelect(point.month, 'all'); }}
                      onKeyDown={(event) => { handleTooltipKeyDown(event, point.month, 'all'); }}
                    />
                    <circle cx={point.x} cy={point.y} r="4" className={`monthly-chart__dot${hoverMonth === point.month || (activeMonthFilter === point.month && typeFilter === 'all') ? ' monthly-chart__dot--active' : ''}`} />
                    <circle
                      cx={point.x}
                      cy={point.oralY}
                      r="8"
                      className="monthly-chart__hit-area"
                      tabIndex={0}
                      role="button"
                      aria-label={`Filter to oral questions in ${monthLabel(point.month)}: ${point.oral} questions`}
                      onMouseEnter={() => { handleMonthHover(point.month); }}
                      onMouseLeave={() => { handleMonthLeave(point.month); }}
                      onFocus={() => { handleMonthHover(point.month); }}
                      onBlur={() => { handleMonthLeave(point.month); }}
                      onClick={() => { onMonthSelect(point.month, 'oral'); }}
                      onKeyDown={(event) => { handleTooltipKeyDown(event, point.month, 'oral'); }}
                    />
                    <circle cx={point.x} cy={point.oralY} r="3.5" className={`monthly-chart__dot monthly-chart__dot--oral${hoverMonth === point.month || (activeMonthFilter === point.month && typeFilter === 'oral') ? ' monthly-chart__dot--active' : ''}`} />
                  </g>
                ))}
              </svg>
              {activePoint && (
                <div
                  className={`monthly-chart__tooltip${tooltipLeft > 72 ? ' monthly-chart__tooltip--right' : ''}`}
                  style={{ left: `${tooltipLeft}%`, top: `${tooltipTop}%` }}
                >
                  <strong>{monthLabel(activePoint.month)}</strong>
                  <span>Total: {activePoint.total}</span>
                  <span>Oral: {activePoint.oral}</span>
                </div>
              )}
              <div className="monthly-chart__labels">
                <span>{monthLabel(monthlyStats[0].month)}</span>
                <span>{monthLabel(monthlyStats.at(-1)?.month ?? monthlyStats[0].month)}</span>
              </div>
            </div>
          ) : (
            <div className="empty-state">No monthly question pattern available yet.</div>
          )}
        </div>
      </div>
    </section>
  );
}

function QuestionItem({ q, chamber, houseNo, memberUri }: { q: Question; chamber: Chamber; houseNo: number; memberUri: string }) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [responses, setResponses] = useState<SpeechSegment[]>([]);
  const [shareOpen, setShareOpen] = useState(false);

  const shareUrl = q.xmlUri && q.debateSectionUri
    ? window.location.origin + window.location.pathname + viewToHash({ kind: 'debate-viewer', xmlUri: q.xmlUri, debateSectionUri: q.debateSectionUri, title: q.questionText.slice(0, 80), focusMemberUri: memberUri }, chamber, houseNo)
    : window.location.origin + window.location.pathname + viewToHash({ kind: 'member', memberUri, memberName: q.askedBy, constituencyCode: '', constituencyName: '' }, chamber, houseNo);

  const handleExpand = async () => {
    if (expanded) { setExpanded(false); return; }
    setExpanded(true);
    if (responses.length > 0 || !q.xmlUri || !q.debateSectionUri) return;
    setLoading(true);
    try {
      const transcript = await fetchDebateTranscript(q.xmlUri, q.debateSectionUri);
      setResponses(transcript);
    } catch (err) {
      console.error('Failed to load response transcript', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {shareOpen && <ShareModal url={shareUrl} title={`Oireachtas Explorer: ${q.questionType} Question${q.department ? ` to ${q.department}` : ''}`} description={q.questionText ? q.questionText.slice(0, 160) + (q.questionText.length > 160 ? '\u2026' : '') : `By ${q.askedBy}${q.department ? ` to ${q.department}` : ''}, ${formatDateShort(q.date)}.`} onClose={() => { setShareOpen(false); }} />}
      <div className="qa-card" style={{ position: 'relative' }}>
        <button className="card-link-btn" onClick={() => { setShareOpen(true); }} aria-label="Copy link to this question">
          <Link size={14} />
        </button>
      <div className="qa-header">
        <span className="type-badge">{q.questionType}</span>
        <span className={`role-badge role-badge--${q.role}`}>
          {q.role === 'asked' ? 'Asked' : 'Answered'}
        </span>
        <span className="li-date">{formatDateShort(q.date)}</span>
        {q.department && <span className="qa-dept">{q.department}</span>}
      </div>

      {q.questionText && (
        <div className="qa-section">
          <div className="qa-section-label">Question</div>
          <p className="qa-text">{q.questionText}</p>
        </div>
      )}

      {q.xmlUri && q.debateSectionUri && (
        <div style={{ padding: '0 20px 18px' }}>
          <button
            onClick={() => { void handleExpand(); }}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              background: 'transparent', border: 'none', color: 'var(--g700)',
              fontWeight: 600, cursor: 'pointer', padding: 0, fontSize: '0.875rem',
              fontFamily: 'var(--fi)',
            }}
          >
            {expanded ? '▲ Hide Response' : '▼ View Official Response'}
          </button>
        </div>
      )}

      {expanded && (
        <div className="qa-response">
          <div className="qa-section-label qa-section-label--response">Response</div>
          {loading ? (
            <p className="qa-response-text" style={{ color: 'var(--text4)' }}>Loading response…</p>
          ) : responses.length > 0 ? (
            responses.map((r, i) => (
              <div key={i} style={{ marginBottom: i < responses.length - 1 ? 16 : 0 }}>
                <div className="qa-response-meta">
                  <span className="qa-response-from">{r.speakerName}</span>
                </div>
                {r.paragraphs.map((p, j) => (
                  <p key={j} className="qa-response-text" style={{ marginBottom: j < r.paragraphs.length - 1 ? 8 : 0 }}
                    dangerouslySetInnerHTML={{ __html: p }} />
                ))}
              </div>
            ))
          ) : (
            <p className="qa-response-text" style={{ color: 'var(--text4)' }}>No recorded response transcript found.</p>
          )}
        </div>
      )}
      </div>
    </>
  );
}

export function QuestionsList({ memberUri, chamber, houseNo }: QuestionsListProps) {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string | null>(null);
  const [monthFilter, setMonthFilter] = useState<string | null>(null);

  const fetcher = useCallback((skip: number, limit: number, signal?: AbortSignal) =>
    fetchQuestions(memberUri, limit, skip, chamber, houseNo, signal), [memberUri, chamber, houseNo]);

  const { items: allQuestions, total, loading, error, loadingMore, handleLoadMore } = usePaginatedList<Question>(fetcher, 'questions', PAGE_SIZE);
  const analyticsFetcher = useCallback((signal: AbortSignal) =>
    fetchAllQuestionsForMember(memberUri, chamber, houseNo, signal), [memberUri, chamber, houseNo]);
  const { data: analyticsData, loading: loadingAnalytics } = useAsync(analyticsFetcher);

  const chartFilterActive = Boolean(departmentFilter ?? monthFilter);
  const listQuestions = chartFilterActive && analyticsData?.questions
    ? analyticsData.questions
    : allQuestions;

  const filtered = listQuestions.filter((q) => {
    if (!questionMatchesType(q, typeFilter)) return false;
    if (departmentFilter && questionDepartment(q) !== departmentFilter) return false;
    if (monthFilter && monthKey(q.date) !== monthFilter) return false;
    return true;
  });

  const clearChartFilters = () => {
    setDepartmentFilter(null);
    setMonthFilter(null);
    setTypeFilter('all');
  };

  const handleDepartmentSelect = (department: string) => {
    setDepartmentFilter((current) => current === department ? null : department);
  };

  const handleMonthSelect = (month: string, nextType: TypeFilter) => {
    setMonthFilter((current) => current === month && typeFilter === nextType ? null : month);
    setTypeFilter(nextType);
  };

  if (loading) {
    return (
      <div className="loading-state" role="status" aria-live="polite">
        <div className="spinner" aria-hidden="true" />
        <span>Loading questions…</span>
      </div>
    );
  }

  if (error) return <div className="error-banner" role="alert">Failed to load questions: {error}</div>;
  if (allQuestions.length === 0) return <div className="empty-state">No parliamentary questions found.</div>;

  return (
    <>
      <QuestionsInsights
        questions={analyticsData?.questions ?? allQuestions}
        total={analyticsData?.total ?? total}
        loading={loadingAnalytics}
        activeDepartment={departmentFilter}
        activeMonthFilter={monthFilter}
        typeFilter={typeFilter}
        onDepartmentSelect={handleDepartmentSelect}
        onMonthSelect={handleMonthSelect}
      />

      <div className="questions-filters" role="group" aria-label="Filter questions by type">
        {(['all', 'oral', 'written'] as TypeFilter[]).map((f) => (
          <button key={f} type="button"
            className={`filter-btn ${typeFilter === f ? 'filter-btn--active' : ''}`}
            onClick={() => { setTypeFilter(f); }} aria-pressed={typeFilter === f}>
            {f === 'all' ? 'All' : f === 'oral' ? 'Oral' : 'Written'}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text3)', alignSelf: 'center' }}>
          {filtered.length} question{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {chartFilterActive && (
        <div className="questions-active-filters">
          <span>Showing</span>
          {departmentFilter && <strong>{departmentFilter}</strong>}
          {monthFilter && <strong>{monthLabel(monthFilter)}</strong>}
          {typeFilter !== 'all' && <strong>{typeFilter}</strong>}
          <button type="button" onClick={clearChartFilters}>Clear filters</button>
        </div>
      )}

      <div className="question-list">
        {filtered.map((q) => <QuestionItem key={q.uri} q={q} chamber={chamber} houseNo={houseNo} memberUri={memberUri} />)}
      </div>

      {filtered.length === 0 && (
        <div className="empty-state">No questions match the current filters.</div>
      )}

      {!chartFilterActive && allQuestions.length < total && (
        <button className="load-more-btn" onClick={() => { void handleLoadMore(); }} disabled={loadingMore}>
          {loadingMore ? 'Loading…' : `Load more (${total - allQuestions.length} remaining)`}
        </button>
      )}
    </>
  );
}
