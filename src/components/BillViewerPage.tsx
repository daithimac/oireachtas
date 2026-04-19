import { useAsync } from '../hooks/useAsync';
import { fetchBill } from '../api/oireachtas';
import { useCallback } from 'react';
import { formatDateShort, billStatusLabel, billStatusClass } from '../utils/format';
import { FileText, Download } from 'lucide-react';

interface BillViewerPageProps {
  billNo: string;
  billYear: string;
  onBack: () => void;
}

export function BillViewerPage({ billNo, billYear, onBack }: BillViewerPageProps) {
  const fetcher = useCallback((signal: AbortSignal) => fetchBill(billNo, billYear, signal), [billNo, billYear]);
  const { data: bill, loading, error } = useAsync(fetcher);

  if (loading) {
    return (
      <div className="container">
        <button className="back-button" onClick={onBack} style={{ marginBottom: '1.5rem', background: 'transparent', border: 'none', color: 'var(--color-accent)', cursor: 'pointer', padding: 0, fontSize: '1rem', fontWeight: 600 }}>
          ← Back
        </button>
        <div className="loading-state" role="status">
          <div className="spinner" aria-hidden="true" />
          <span>Loading legislation record…</span>
        </div>
      </div>
    );
  }

  if (error || !bill) {
    return (
      <div className="container">
        <button className="back-button" onClick={onBack} style={{ marginBottom: '1.5rem', background: 'transparent', border: 'none', color: 'var(--color-accent)', cursor: 'pointer', padding: 0, fontSize: '1rem', fontWeight: 600 }}>
          ← Back
        </button>
        <div className="error-banner">Failed to load bill: {error ?? 'Not found'}</div>
      </div>
    );
  }

  // Pick the most recent document to show in the iframe. "As Initiated" is usually the first version.
  // We bias towards the first version PDF. If they want others, we can add a document switcher later.
  const activePdfUrl = bill.versions?.[0]?.pdfUri ?? bill.relatedDocs?.[0]?.pdfUri;

  return (
    <div className="container" style={{ maxWidth: '1200px', animation: 'fadeInUp 0.3s ease' }}>
      <button className="back-button" onClick={onBack} style={{ marginBottom: '1.5rem', background: 'transparent', border: 'none', color: 'var(--color-accent)', cursor: 'pointer', padding: 0, fontSize: '1rem', fontWeight: 600 }}>
        ← Back
      </button>

      <div style={{ padding: '2rem', background: 'var(--color-surface)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-md)', marginBottom: '2rem', border: '1px solid var(--color-border)' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem' }}>
              <span className={`bill-status-badge ${billStatusClass(bill.status)}`}>
                {billStatusLabel(bill.status)}
              </span>
              <span style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                {bill.source} • Bill {bill.billNo} of {bill.billYear}
              </span>
            </div>
            <h1 style={{ fontSize: '2.2rem', color: 'var(--color-text-primary)', marginBottom: '1rem', lineHeight: 1.2, letterSpacing: '-0.02em' }}>
              {bill.title}
            </h1>
          </div>
        </div>

        {bill.longTitleEn && (
          <div 
            style={{ fontSize: '1.1rem', color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: '2rem', padding: '1.5rem', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)' }}
            dangerouslySetInnerHTML={{ __html: bill.longTitleEn }}
          />
        )}

        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '300px' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--color-text-primary)' }}>Sponsors</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {bill.sponsors.map((s, i) => (
                <span key={i} style={{ padding: '6px 14px', background: 'var(--color-green-50)', color: 'var(--color-accent)', borderRadius: 'var(--radius-pill)', fontSize: '0.9rem', fontWeight: 600, border: '1px solid var(--color-green-100)' }}>
                  {s}
                </span>
              ))}
            </div>
          </div>
          
          <div style={{ flex: 1, minWidth: '300px' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--color-text-primary)' }}>Current Status</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--color-border)' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Origin House</span>
                <span style={{ fontWeight: 600 }}>{bill.originHouse}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--color-border)' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Current Stage</span>
                <span style={{ fontWeight: 600, color: 'var(--color-accent)' }}>{bill.currentStage}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Last Updated</span>
                <span style={{ fontWeight: 600 }}>{formatDateShort(bill.lastUpdated)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: '2rem', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', height: '800px', background: 'var(--color-surface)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-md)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-bg-secondary)' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.2rem' }}>
              <FileText size={20} className="color-accent" />
              Official Document
            </h3>
            {activePdfUrl && (
              <a 
                href={activePdfUrl} 
                target="_blank" 
                rel="noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', color: 'var(--color-accent)', textDecoration: 'none', fontWeight: 600 }}
              >
                <Download size={16} /> Open externally
              </a>
            )}
          </div>
          {activePdfUrl ? (
            <iframe 
              src={activePdfUrl} 
              style={{ width: '100%', height: '100%', border: 'none', background: '#f5f5f5' }}
              title="Bill PDF Viewer"
            />
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-tertiary)' }}>
              No PDF document available for this bill.
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-xl)', padding: '1.5rem', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--color-border)' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--color-text-primary)' }}>Versions</h3>
            {bill.versions && bill.versions.length > 0 ? (
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: 0 }}>
                {bill.versions.map((v, i) => (
                  <li key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{v.title}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>{formatDateShort(v.date)}</div>
                    </div>
                    {v.pdfUri && (
                      <a href={v.pdfUri} target="_blank" rel="noreferrer" style={{ padding: '6px 10px', background: 'var(--color-bg-secondary)', borderRadius: '6px', color: 'var(--color-accent)', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600 }}>
                        PDF
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <div style={{ fontSize: '0.9rem', color: 'var(--color-text-tertiary)' }}>No versions found.</div>
            )}
          </div>

          <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-xl)', padding: '1.5rem', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--color-border)' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--color-text-primary)' }}>Related Documents</h3>
            {bill.relatedDocs && bill.relatedDocs.length > 0 ? (
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: 0 }}>
                {bill.relatedDocs.map((d, i) => (
                  <li key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{d.title}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>{formatDateShort(d.date)}</div>
                    </div>
                    {d.pdfUri && (
                      <a href={d.pdfUri} target="_blank" rel="noreferrer" style={{ padding: '6px 10px', background: 'var(--color-bg-secondary)', borderRadius: '6px', color: 'var(--color-accent)', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600 }}>
                        PDF
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <div style={{ fontSize: '0.9rem', color: 'var(--color-text-tertiary)' }}>No related documents.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
