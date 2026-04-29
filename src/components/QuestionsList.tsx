import { useState, useCallback } from 'react';
import { Link } from 'lucide-react';
import { usePaginatedList } from '../hooks/usePaginatedList';
import { fetchQuestions } from '../api/oireachtas';
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
      {shareOpen && <ShareModal url={shareUrl} onClose={() => { setShareOpen(false); }} />}
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

  const fetcher = useCallback((skip: number, limit: number, signal?: AbortSignal) =>
    fetchQuestions(memberUri, limit, skip, chamber, houseNo, signal), [memberUri, chamber, houseNo]);

  const { items: allQuestions, total, loading, error, loadingMore, handleLoadMore } = usePaginatedList<Question>(fetcher, 'questions', PAGE_SIZE);

  const filtered = typeFilter === 'all' ? allQuestions : allQuestions.filter((q) =>
    typeFilter === 'oral'
      ? q.questionType.toLowerCase().includes('oral')
      : q.questionType.toLowerCase().includes('written')
  );

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

      <div className="question-list">
        {filtered.map((q) => <QuestionItem key={q.uri} q={q} chamber={chamber} houseNo={houseNo} memberUri={memberUri} />)}
      </div>

      {allQuestions.length < total && (
        <button className="load-more-btn" onClick={() => { void handleLoadMore(); }} disabled={loadingMore}>
          {loadingMore ? 'Loading…' : `Load more (${total - allQuestions.length} remaining)`}
        </button>
      )}
    </>
  );
}
