import type { ReactNode } from 'react';

interface OverlayProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Matches the artboard's frame width. */
  width?: number;
}

/** Anchored bottom-right rather than centred: these panels are worked
 *  alongside the record behind them, not instead of it, so the page stays
 *  visible. Adds NO chrome of its own - the child supplies its whole surface,
 *  which is what made nesting one inside Modal produce two of everything. */
export function Overlay({ isOpen, onClose, children, width = 620 }: OverlayProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} role="presentation">
      <div
        className="absolute bottom-4 right-4 w-[calc(100%-2rem)] animate-[overlay-in_140ms_ease-out]"
        style={{ maxWidth: width }}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
