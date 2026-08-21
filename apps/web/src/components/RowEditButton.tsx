/** A quiet pencil that sits at the end of a row. Rows that are links keep
 *  their link; this sits outside it so an edit never navigates by accident. */
export function RowEditButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="focus-ring flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] text-ink-3 transition hover:bg-surface-3 hover:text-ink-2"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 20h4l10-10a2.8 2.8 0 10-4-4L4 16z" />
        <path d="M13.5 6.5l4 4" />
      </svg>
    </button>
  );
}
