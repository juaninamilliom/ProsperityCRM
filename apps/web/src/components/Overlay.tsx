import type { ReactNode } from 'react';

interface OverlayProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Matches the artboard's frame width. */
  width?: number;
}

/** A centred backdrop that adds NO chrome of its own - the child supplies its
 *  whole surface. Modal is a bottom-right anchored panel with its own card,
 *  header and close button, so putting a self-contained card inside it doubles
 *  every one of those. */
export function Overlay({ isOpen, onClose, children, width = 720 }: OverlayProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full"
        style={{ maxWidth: width }}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
