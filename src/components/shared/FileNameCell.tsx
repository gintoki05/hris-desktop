import { cn } from "@/lib/utils";

type FileNameCellProps = {
  path: string;
};

export function FileNameCell({ path }: FileNameCellProps) {
  const fileName = fileNameFromPath(path);

  if (fileName === "-") {
    return <span className="text-muted-foreground">-</span>;
  }

  return (
    <span className={cn("block max-w-64 truncate text-sm")} title={fileName}>
      {fileName}
    </span>
  );
}

function fileNameFromPath(path: string): string {
  if (!path.trim()) {
    return "-";
  }

  const normalized = path.replace(/\\/g, "/");
  return normalized.split("/").pop() || "-";
}
