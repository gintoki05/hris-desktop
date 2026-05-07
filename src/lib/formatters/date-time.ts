export function formatLocalDateTimeFromUtc(value: string): string {
  const date = new Date(normalizeUtcTimestamp(value));

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function normalizeUtcTimestamp(value: string): string {
  if (value.endsWith("Z") || value.includes("+")) {
    return value;
  }

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(value)) {
    return `${value.replace(" ", "T")}Z`;
  }

  return value;
}
