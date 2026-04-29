import { useEffect, useState } from 'react';

function copyViaExecCommand(text: string) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
}

interface ShareModalProps {
  url: string;
  onClose: () => void;
}

export function ShareModal({ url, onClose }: ShareModalProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => { window.removeEventListener('keydown', h); };
  }, [onClose]);

  const handleCopy = () => {
    const finish = () => {
      setCopied(true);
      setTimeout(() => { setCopied(false); }, 2000);
    };
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(finish).catch(() => {
        copyViaExecCommand(url);
        finish();
      });
    } else {
      copyViaExecCommand(url);
      finish();
    }
  };

  return (
    <div className="pdf-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="share-modal">
        <div className="share-modal__hdr">
          <span className="share-modal__title">Share link</span>
          <button className="pdf-modal-close" onClick={onClose} aria-label="Close share dialog">×</button>
        </div>
        <input
          className="share-modal__url"
          readOnly
          value={url}
          onFocus={(e) => { e.currentTarget.select(); }}
        />
        <div className="share-modal__actions">
          <button className="share-modal__copy-btn" onClick={handleCopy}>
            {copied ? 'Copied!' : 'Copy link'}
          </button>
        </div>
      </div>
    </div>
  );
}
