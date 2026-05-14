type DateInput = Date | string | null | undefined;

export type DateRangeInputValue = {
  startDate: string;
  endDate: string;
};

export type PeriodDateDefaults = DateRangeInputValue & {
  label: string;
};

export function formatDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getCurrentMonthDateRange(referenceDate = new Date()): DateRangeInputValue {
  return {
    startDate: formatDateInputValue(
      new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1),
    ),
    endDate: formatDateInputValue(
      new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0),
    ),
  };
}

export function createDisplayDateRangeLabel(prefix: string, range: DateRangeInputValue): string {
  return `${prefix} ${formatDisplayDateRange(range.startDate, range.endDate)}`;
}

export function createCurrentMonthPeriodDefaults(
  prefix: string,
  referenceDate = new Date(),
): PeriodDateDefaults {
  const range = getCurrentMonthDateRange(referenceDate);
  return {
    ...range,
    label: createDisplayDateRangeLabel(prefix, range),
  };
}

export function formatDisplayDate(value: DateInput): string {
  if (!value) {
    return "-";
  }

  const date = value instanceof Date ? value : parseDateValue(value);

  if (!date || Number.isNaN(date.getTime())) {
    return String(value);
  }

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).padStart(4, "0");
  return `${day}-${month}-${year}`;
}

export function formatDisplayDateRange(startDate: DateInput, endDate: DateInput): string {
  return `${formatDisplayDate(startDate)} s.d. ${formatDisplayDate(endDate)}`;
}

export function formatDisplayDateText(value: string): string {
  return value.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (_match, year, month, day) => {
    return `${day}-${month}-${year}`;
  });
}

export function formatLocalDateTimeFromUtc(value: string): string {
  const date = new Date(normalizeUtcTimestamp(value));

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${formatDisplayDate(date)} ${hours}:${minutes}`;
}

function parseDateValue(value: string): Date | null {
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  const date = new Date(normalizeUtcTimestamp(value));
  return Number.isNaN(date.getTime()) ? null : date;
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
