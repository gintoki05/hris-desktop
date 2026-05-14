import type { ReactNode } from "react";
import { Badge } from "../ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { cn } from "../../lib/utils";

type FeaturePanelProps = {
  "aria-label": string;
  badge?: ReactNode;
  children: ReactNode;
  className?: string;
  title: string;
};

export function FeaturePanel({
  "aria-label": ariaLabel,
  badge,
  children,
  className,
  title,
}: FeaturePanelProps) {
  return (
    <Card aria-label={ariaLabel} className={cn("mb-5 overflow-hidden", className)}>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle>{title}</CardTitle>
        {badge ? <CardAction>{badge}</CardAction> : null}
      </CardHeader>
      {children}
    </Card>
  );
}

type PanelBodyProps = {
  children: ReactNode;
  className?: string;
};

export function PanelBody({ children, className }: PanelBodyProps) {
  return <CardContent className={cn("grid gap-4", className)}>{children}</CardContent>;
}

type StatusBadgeProps = {
  children: ReactNode;
  className?: string;
};

export function StatusBadge({ children, className }: StatusBadgeProps) {
  return (
    <Badge className={cn("whitespace-nowrap", className)} variant="outline">
      {children}
    </Badge>
  );
}

type PanelNoteProps = {
  children: ReactNode;
  className?: string;
  tone?: "default" | "muted" | "warning";
};

export function PanelNote({ children, className, tone = "muted" }: PanelNoteProps) {
  return (
    <p
      className={cn(
        "border-t px-4 py-3 text-sm leading-6",
        tone === "muted" && "bg-muted/30 text-muted-foreground",
        tone === "warning" && "bg-amber-50 text-amber-900",
        tone === "default" && "bg-card text-card-foreground",
        className,
      )}
    >
      {children}
    </p>
  );
}

