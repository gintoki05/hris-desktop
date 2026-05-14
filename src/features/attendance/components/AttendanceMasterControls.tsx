import { useId, type ReactNode } from "react";
import { Button } from "../../../components/ui/button";
import { Checkbox } from "../../../components/ui/checkbox";
import { Input } from "../../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";

type MasterSectionProps = {
  addDisabled?: boolean;
  actionLabel: string;
  canEdit: boolean;
  children: ReactNode;
  description?: string;
  itemCount?: number;
  saveDisabled?: boolean;
  saveLabel?: string;
  title: string;
  onAdd: () => void;
  onSave?: () => void;
};

export function MasterSection({
  addDisabled = false,
  actionLabel,
  canEdit,
  children,
  description,
  itemCount,
  onAdd,
  onSave,
  saveDisabled = false,
  saveLabel = "Simpan Perubahan",
  title,
}: MasterSectionProps) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <h3 className="font-semibold leading-none">{title}</h3>
          {typeof itemCount === "number" ? (
            <span className="text-sm text-muted-foreground">{itemCount} item tersimpan di master</span>
          ) : null}
        </div>
        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            {onSave ? (
              <Button disabled={saveDisabled} onClick={onSave} size="sm" type="button">
                {saveLabel}
              </Button>
            ) : null}
            <Button disabled={addDisabled} onClick={onAdd} size="sm" type="button" variant="outline">
              {actionLabel}
            </Button>
          </div>
        ) : null}
      </div>
      {description ? <p className="mt-3 text-sm text-muted-foreground">{description}</p> : null}
      <div className="mt-4 grid gap-3">{children}</div>
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
      <Input disabled={disabled} onChange={(event) => onChange(event.target.value)} type={type} value={value} />
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
      <Input
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
      <Select disabled={disabled} onValueChange={onChange} value={value}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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
  const id = useId();

  return (
    <label className="flex items-center gap-2 text-sm font-medium text-foreground" htmlFor={id}>
      <Checkbox
        checked={checked}
        disabled={disabled}
        id={id}
        onCheckedChange={(value) => onChange(value === true)}
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
