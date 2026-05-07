import type { ReactNode } from "react";

type MasterSectionProps = {
  actionLabel: string;
  canEdit: boolean;
  children: ReactNode;
  title: string;
  onAdd: () => void;
};

export function MasterSection({ actionLabel, canEdit, children, onAdd, title }: MasterSectionProps) {
  return (
    <div className="master-section">
      <div className="master-section-header">
        <h3>{title}</h3>
        {canEdit ? (
          <button onClick={onAdd} type="button">
            {actionLabel}
          </button>
        ) : null}
      </div>
      <div className="master-row-list">{children}</div>
    </div>
  );
}

type TextInputProps = {
  disabled: boolean;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
};

export function TextInput({ disabled, label, onChange, type = "text", value }: TextInputProps) {
  return (
    <label>
      {label}
      <input disabled={disabled} onChange={(event) => onChange(event.target.value)} type={type} value={value} />
    </label>
  );
}

type NumberInputProps = {
  disabled: boolean;
  label: string;
  step?: string;
  value: number;
  onChange: (value: number) => void;
};

export function NumberInput({ disabled, label, onChange, step = "1", value }: NumberInputProps) {
  return (
    <label>
      {label}
      <input
        disabled={disabled}
        min={0}
        onChange={(event) => onChange(readNumber(event.target.value, 0))}
        step={step}
        type="number"
        value={value}
      />
    </label>
  );
}

type SelectInputProps = {
  disabled: boolean;
  label: string;
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
};

export function SelectInput({ disabled, label, onChange, options, value }: SelectInputProps) {
  return (
    <label>
      {label}
      <select disabled={disabled} onChange={(event) => onChange(event.target.value)} value={value}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

type BooleanInputProps = {
  checked: boolean;
  disabled: boolean;
  label: string;
  onChange: (value: boolean) => void;
};

export function BooleanInput({ checked, disabled, label, onChange }: BooleanInputProps) {
  return (
    <label className="inline-check">
      <input
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      {label}
    </label>
  );
}

function readNumber(value: string, fallback: number): number {
  if (value.trim() === "") {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
