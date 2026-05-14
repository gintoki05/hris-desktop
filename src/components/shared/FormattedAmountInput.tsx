import type { InputHTMLAttributes } from "react";

type FormattedAmountInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "inputMode" | "min" | "onChange" | "type" | "value"
> & {
  disabled?: boolean;
  min?: number;
  value: number;
  onChange: (value: number) => void;
};

const idNumberFormatter = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 0,
});

export function FormattedAmountInput({
  disabled = false,
  min = 0,
  onChange,
  value,
  ...inputProps
}: FormattedAmountInputProps) {
  return (
    <input
      {...inputProps}
      disabled={disabled}
      inputMode="numeric"
      onChange={(event) => onChange(parseFormattedAmount(event.target.value, min))}
      type="text"
      value={formatAmountInputValue(value)}
    />
  );
}

export function parseFormattedAmount(value: string, min = 0): number {
  const digits = value.replace(/\D/g, "");

  if (digits === "") {
    return min;
  }

  const parsed = Number(digits);
  if (!Number.isFinite(parsed)) {
    return min;
  }

  return Math.max(min, parsed);
}

export function formatAmountInputValue(value: number): string {
  return value === 0 ? "" : idNumberFormatter.format(value);
}
