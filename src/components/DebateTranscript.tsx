import { useCallback } from 'react';
import { useAsync } from '../hooks/useAsync';
import { fetchDebateTranscript } from '../api/transcripts';
import { getMemberPhotoUrl } from '../api/oireachtas';

interface DebateTranscriptProps {
  xmlUri: string;
  debateSectionUri: string;
  memberUri: string;
  onClose: () => void;
}

export function DebateTranscript({ xmlUri, debateSectionUri, memberUri, onClose }: DebateTranscriptProps) {
  const fetcher = useCallback((signal: AbortSignal) => 
    fetchDebateTranscript(xmlUri, debateSectionUri, memberUri, signal), 
    [xmlUri, debateSectionUri, memberUri]
  );
  
  const { data: segments, loading, error } = useAsync(fetcher);

  return (
    <div className="transcript-viewer">
      <div className="transcript-viewer__header">
        <h4 className="transcript-viewer__title">Official Transcript</h4>
        <button className="transcript-viewer__close" onClick={onClose} aria-label="Close transcript">✕</button>
      </div>
      
      {loading && (
        <div className="loading-state--small" role="status">
          <div className="spinner" aria-hidden="true" />
          <span>Loading official record…</span>
        </div>
      )}
      
      {error && (
        <div className="error-banner transcript-viewer__error" role="alert">
           {error}
        </div>
      )}
      
      {!loading && !error && segments?.length === 0 && (
         <div className="empty-state--small">
           No matching spoken record could be extracted for this section.
         </div>
      )}

      {!loading && !error && segments && segments.length > 0 && (
        <div className="transcript-viewer__content">
          {segments.map((s, idx) => (
            <div key={idx} className="transcript-segment" style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'flex-start' }}>
              <div className="transcript-segment__avatar" style={{ flexShrink: 0, width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--color-bg-tertiary)', overflow: 'hidden' }}>
                {s.memberUri ? (
                  <img src={getMemberPhotoUrl(s.memberUri)} alt={s.speakerName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-tertiary)', fontSize: '0.8rem' }}>M</div>
                )}
              </div>
              <div className="transcript-segment__body" style={{ flex: 1, minWidth: 0 }}>
                <strong className="transcript-segment__speaker" style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-primary)' }}>
                  {s.speakerName}
                </strong>
                {s.paragraphs.map((p, i) => (
                  <p key={i} className="transcript-viewer__paragraph" style={{ marginBottom: '0.75rem', lineHeight: 1.5, color: 'var(--color-text-secondary)' }}>{p}</p>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
