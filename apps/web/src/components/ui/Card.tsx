import type { ElementType, ReactNode } from 'react';

interface CardProps {
  as?: ElementType;
  className?: string;
  children: ReactNode;
}

export function Card({ as: Tag = 'div', className = '', children }: CardProps) {
  return (
    <Tag className={`rounded-card border border-border bg-surface ${className}`}>{children}</Tag>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-2xs font-semibold uppercase tracking-[0.04em] text-ink-3">
      {children}
    </span>
  );
}
