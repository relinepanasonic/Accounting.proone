/** The sort arrow of a table header: an up triangle above a down triangle. The direction in use is lit. */
export function SortArrows({ dir }: { dir: 'asc' | 'desc' | null }) {
  const lit = '#f5d77f', dim = '#5b6f9a';
  return (
    <svg width="9" height="14" viewBox="0 0 9 14" aria-hidden="true" className="shrink-0">
      <path d="M4.5 0.5 L8.5 5.5 L0.5 5.5 Z" fill={dir === 'asc' ? lit : dim} />
      <path d="M4.5 13.5 L0.5 8.5 L8.5 8.5 Z" fill={dir === 'desc' ? lit : dim} />
    </svg>
  );
}
