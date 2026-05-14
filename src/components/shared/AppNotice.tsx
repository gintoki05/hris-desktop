import type { ReactNode } from "react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { cn } from "@/lib/utils";

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
  const isError = variant === "error";

  return (
    <Alert
      className={cn(
        "border-l-4 shadow-xs",
        variant === "info" && "border-l-slate-500 bg-slate-50",
        variant === "success" && "border-l-emerald-600 bg-emerald-50 text-emerald-900",
        variant === "warning" && "border-l-amber-600 bg-amber-50 text-amber-900",
        isError && "border-l-orange-600 bg-orange-50"
      )}
      role={isError ? "alert" : "status"}
      variant={isError ? "destructive" : "default"}
    >
      <AlertTitle>{title ?? DEFAULT_TITLES[variant]}</AlertTitle>
      <AlertDescription
        className={cn(
          variant === "success" && "text-emerald-800",
          variant === "warning" && "text-amber-800",
          isError && "text-orange-900",
        )}
      >
        {children}
      </AlertDescription>
    </Alert>
  );
}
