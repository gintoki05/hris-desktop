import { Button } from "@/components/ui/button";

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
    <div
      className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2 shadow-xs"
      aria-label={ariaLabel}
    >
      <span className="text-sm text-muted-foreground">
        Menampilkan {visibleItems} dari {totalItems} {itemLabel}
      </span>
      <div className="flex items-center gap-2">
        <Button
          disabled={effectivePage <= 1}
          onClick={() => onPageChange(Math.max(1, effectivePage - 1))}
          type="button"
          variant="outline"
        >
          Sebelumnya
        </Button>
        <strong className="min-w-28 text-center text-sm font-medium text-foreground">
          Halaman {effectivePage} / {totalPages}
        </strong>
        <Button
          disabled={effectivePage >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, effectivePage + 1))}
          type="button"
          variant="outline"
        >
          Berikutnya
        </Button>
      </div>
    </div>
  );
}
