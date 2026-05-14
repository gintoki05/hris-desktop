import { PanelNote } from "../../../components/shared/FeaturePanel";
import { Button } from "../../../components/ui/button";
import type { EmployeeImportPreview } from "../services/employee-excel.service";

type EmployeeImportSummary = {
  errorCount: number;
  validCount: number;
};

type EmployeeImportPreviewPanelProps = {
  disabled: boolean;
  importPreview: EmployeeImportPreview;
  importSummary: EmployeeImportSummary;
  isImporting: boolean;
  onCancel: () => void;
  onSave: () => void;
};

export function EmployeeImportPreviewPanel({
  disabled,
  importPreview,
  importSummary,
  isImporting,
  onCancel,
  onSave,
}: EmployeeImportPreviewPanelProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Preview Import Excel</h3>
          <p className="text-sm text-muted-foreground">
            {importPreview.sourceFileName} - Sheet {importPreview.sheetName} - {importSummary.validCount} valid -{" "}
            {importSummary.errorCount} perlu diperbaiki
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={disabled || importSummary.errorCount > 0 || importSummary.validCount === 0}
            onClick={onSave}
            type="button"
          >
            Simpan Import
          </Button>
          <Button disabled={isImporting} onClick={onCancel} type="button" variant="outline">
            Batal
          </Button>
        </div>
      </div>
      {importSummary.errorCount > 0 ? (
        <PanelNote tone="warning">Perbaiki baris error di Excel lalu import ulang. Data belum disimpan.</PanelNote>
      ) : null}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="py-2 pr-3 font-medium">Baris</th>
              <th className="py-2 pr-3 font-medium">NIK</th>
              <th className="py-2 pr-3 font-medium">Nama</th>
              <th className="py-2 pr-3 font-medium">Aksi</th>
              <th className="py-2 pr-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {importPreview.rows.slice(0, 8).map((row) => (
              <tr className="border-b border-border last:border-0" key={row.rowNumber}>
                <td className="py-2 pr-3">{row.rowNumber}</td>
                <td className="py-2 pr-3">{row.nik || "-"}</td>
                <td className="py-2 pr-3">{row.name || "-"}</td>
                <td className="py-2 pr-3">{row.action === "create" ? "Tambah" : "Update"}</td>
                <td className="py-2 pr-3">{row.status === "valid" ? "Valid" : row.errorMessage}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {importPreview.rows.length > 8 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Menampilkan 8 dari {importPreview.rows.length} baris. Semua baris valid akan disimpan.
        </p>
      ) : null}
    </div>
  );
}
