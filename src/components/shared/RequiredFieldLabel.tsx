import type { ReactNode } from "react";

type RequiredFieldLabelProps = {
  children: ReactNode;
};

export function RequiredFieldLabel({ children }: RequiredFieldLabelProps) {
  return (
    <span className="field-label">
      {children}
      <span aria-hidden="true" className="required-label">
        *
      </span>
      <span className="sr-only">wajib</span>
    </span>
  );
}
