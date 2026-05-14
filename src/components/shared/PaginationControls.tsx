type PaginationControlsProps = {
  ariaLabel: string;
  currentPage: number;
  itemLabel: string;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
};

export function PaginationControls({
  ariaLabel,
  currentPage,
  itemLabel,
  onPageChange,
  pageSize,
  totalItems,
}: PaginationControlsProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const effectivePage = Math.min(currentPage, totalPages);
  const visibleItems =
    totalItems === 0 ? 0 : Math.min(pageSize, totalItems - (effectivePage - 1) * pageSize);

  return (
    <div className="pagination-controls" aria-label={ariaLabel}>
      <span>
        Menampilkan {visibleItems} dari {totalItems} {itemLabel}
      </span>
      <div>
        <button
          disabled={effectivePage <= 1}
          onClick={() => onPageChange(Math.max(1, effectivePage - 1))}
          type="button"
        >
          Sebelumnya
        </button>
        <strong>
          Halaman {effectivePage} / {totalPages}
        </strong>
        <button
          disabled={effectivePage >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, effectivePage + 1))}
          type="button"
        >
          Berikutnya
        </button>
      </div>
    </div>
  );
}
