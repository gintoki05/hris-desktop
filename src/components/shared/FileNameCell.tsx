type FileNameCellProps = {
  path: string;
};

export function FileNameCell({ path }: FileNameCellProps) {
  const fileName = fileNameFromPath(path);

  if (fileName === "-") {
    return <span className="file-name-cell" data-empty="true">-</span>;
  }

  return (
    <span className="file-name-cell" title={fileName}>
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
