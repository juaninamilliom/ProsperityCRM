import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

interface OverlayProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}

/** A popout anchored to the bottom-right corner. Deliberately lays NO scrim
 *  over the page: these panels are worked alongside the record behind them, so
 *  the page stays lit and clickable. Dismiss by Escape or by clicking away. */
export function Overlay({ isOpen, onClose, children, width = 620 }: OverlayProps) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    function onPointerDown(event: MouseEvent) {
      if (!panel.current?.contains(event.target as Node)) onClose();
    }

    document.addEventListener('keydown', onKeyDown);
    // mousedown, not click: the panel must not close before a button inside a
    // row has finished handling its own click.
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={panel}
      role="dialog"
      aria-modal="false"
      className="fixed bottom-4 right-4 z-50 w-[calc(100%-2rem)] animate-[overlay-in_140ms_ease-out]"
      style={{ maxWidth: width }}
    >
      {children}
    </div>
  );
}
