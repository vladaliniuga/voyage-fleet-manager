// /components/ui/Modal.jsx
import { useEffect, useId } from 'react';
import Button from './Button';

export default function Modal({ open, title, onClose, children, footer }) {
  const titleId = useId();

  // Close on Esc
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />

      {/* Centering wrapper with page padding; allows page-level scroll if needed */}
      <div className="relative z-10 flex min-h-full items-center justify-center p-4 sm:p-6">
        {/* Panel */}
        <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h3 id={titleId} className="text-base font-semibold">
              {title}
            </h3>
            <Button
              variant="ghost"
              size="square"
              onClick={onClose}
              aria-label="Close"
            >
              ✕
            </Button>
          </div>

          {/* Body (scrolls) */}
          <div className="px-6 py-4 overflow-y-auto">
            <div className="space-y-4">{children}</div>
          </div>

          {/* Footer (sticks to bottom of panel) */}
          {footer && (
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
