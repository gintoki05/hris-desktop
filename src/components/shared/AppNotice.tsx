import type { ReactNode } from "react";

export type AppNoticeVariant = "error" | "success" | "info" | "warning";

type AppNoticeProps = {
  children: ReactNode;
  title?: string;
  variant?: AppNoticeVariant;
};

const DEFAULT_TITLES: Record<AppNoticeVariant, string> = {
  error: "Perlu Dicek",
  info: "Info",
  success: "Berhasil",
  warning: "Perhatian",
};

export function AppNotice({ children, title, variant = "info" }: AppNoticeProps) {
  return (
    <div className="app-notice" data-variant={variant} role={variant === "error" ? "alert" : "status"}>
      <strong>{title ?? DEFAULT_TITLES[variant]}</strong>
      <span>{children}</span>
    </div>
  );
}
