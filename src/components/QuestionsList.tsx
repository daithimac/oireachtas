import { useState, useCallback } from 'react';
import { usePaginatedList } from '../hooks/usePaginatedList';
import { fetchQuestions } from '../api/oireachtas';
import { fetchDebateTranscript } from '../api/transcripts';
import type { Chamber, Question, SpeechSegment } from '../types';
import { formatDateShort } from '../utils/format';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface QuestionsListProps {
  memberUri: string;
  chamber: Chamber;
  houseNo: number;
}

type RoleFilter = 'all' | 'asked';

const PAGE_SIZE = 20;

function QuestionItem({ q }: { q: Question }) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [responses, setResponses] = useState<SpeechSegment[]>([]);

  const handleExpand = async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (responses.length > 0 || !q.xmlUri || !q.debateSectionUri) return;
    
    setLoading(true);
    try {
      const transcript = await fetchDebateTranscript(q.xmlUri, q.debateSectionUri);
      // We assume the question was asked by the member, or the responses come from the minister answering.
      // Easiest heuristic: drop segments where the speaker is the one who asked it.
      const answers = transcript.filter(s => {
        // If we know the exact name, filter it out. Often the asker's name is in the XML.
        // Some flexibility: exclude if it matches the asker closely.
        const speakerLower = s.speakerName.toLowerCase();
        const askerLower = q.askedBy.toLowerCase();
        // Just checking if 'Deputy Gary Gannon' contains 'Gary Gannon'
        if (askerLower && speakerLower.includes(askerLower.replace('deputy ', '').trim())) {
          return false;
        }
        return true;
      });
      setResponses(answers);
    } catch (err) {
      console.error('Failed to load response transcript', err);
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="question-item">
      <div className="question-item__meta">
        <span className="question-item__date">{formatDateShort(q.date)}</span>
        <span className={`role-badge role-badge--${q.role}`}>
          {q.role === 'asked' ? 'Asked' : 'Answered'}
        </span>
        <span className="type-badge">{q.questionType}</span>
      </div>
      {q.questionText && (
        <p className="question-item__text">{q.questionText}</p>
      )}
      {q.department && (
        <div className="question-item__dept">To: {q.department}</div>
      )}
      
      {q.xmlUri && q.debateSectionUri && (
        <div style={{ marginTop: '1rem' }}>
          <button 
            onClick={() => { void handleExpand(); }}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'transparent', border: 'none', color: 'var(--color-accent)', fontWeight: 600, cursor: 'pointer', padding: 0, fontSize: '0.9rem' }}
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            {expanded ? 'Hide Response' : 'View Official Response'}
          </button>
          
          {expanded && (
            <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--color-accent)' }}>
              {loading ? (
                <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>Loading response...</div>
              ) : responses.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {responses.map((r, i) => (
                    <div key={i}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px', color: 'var(--color-text-primary)' }}>{r.speakerName}</div>
                      {r.paragraphs.map((p, j) => (
                        <p key={j} style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', lineHeight: 1.5, color: 'var(--color-text-secondary)' }} dangerouslySetInnerHTML={{ __html: p }} />
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>No recorded response transcript found.</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function QuestionsList({ memberUri, chamber, houseNo }: QuestionsListProps) {
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');

  const fetcher = useCallback((skip: number, limit: number, signal?: AbortSignal) =>
    fetchQuestions(memberUri, limit, skip, chamber, houseNo, signal), [memberUri, chamber, houseNo]);

  const { items: allQuestions, total, loading, error, loadingMore, handleLoadMore } = usePaginatedList<Question>(fetcher, 'questions', PAGE_SIZE);

  const filtered = roleFilter === 'all'
    ? allQuestions
    : allQuestions.filter((q) => q.role === roleFilter);

  if (loading) {
    return (
      <div className="loading-state" role="status" aria-live="polite">
        <div className="spinner" aria-hidden="true" />
        <span>Loading questions…</span>
      </div>
    );
  }

  if (error) {
    return <div className="error-banner" role="alert">Failed to load questions: {error}</div>;
  }

  if (allQuestions.length === 0) {
    return <div className="empty-state">No parliamentary questions found.</div>;
  }

  return (
    <>
      <div className="questions-filters" role="group" aria-label="Filter questions by role">
        {(['all', 'asked'] as RoleFilter[]).map((f) => (
          <button
            key={f}
            type="button"
            className={`filter-btn ${roleFilter === f ? 'filter-btn--active' : ''}`}
            onClick={() => { setRoleFilter(f); }}
            aria-pressed={roleFilter === f}
          >
            {f === 'all' ? 'All' : 'Asked by Member'}
          </button>
        ))}
      </div>

      <div className="question-list">
        {filtered.map((q) => (
          <QuestionItem key={q.uri} q={q} />
        ))}
      </div>

      {allQuestions.length < total && (
        <button className="load-more-btn" onClick={() => { void handleLoadMore(); }} disabled={loadingMore}>
          {loadingMore ? 'Loading…' : `Load more (${total - allQuestions.length} remaining)`}
        </button>
      )}
    </>
  );
}
