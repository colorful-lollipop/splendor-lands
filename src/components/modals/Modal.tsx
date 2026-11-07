import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../Ornaments';

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  width,
  hideClose,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onClose?: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
  hideClose?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
    >
      <div className="modal" style={width ? { width: `min(${width}px, 94vw)` } : undefined} role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <div className="modal-title">{title}</div>
            {subtitle && <div style={{ fontSize: 10.5, color: 'var(--dim)', letterSpacing: '0.08em', marginTop: 3 }}>{subtitle}</div>}
          </div>
          {!hideClose && onClose && (
            <button className="modal-close" onClick={onClose} aria-label="关闭">
              <Icon name="close" size={14} />
            </button>
          )}
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}