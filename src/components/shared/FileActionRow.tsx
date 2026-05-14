import { Button } from "@/components/ui/button";

type FileActionRowProps = {
  actionLabel: string;
  label: string;
  onAction: () => void;
  value: string;
};

export function FileActionRow({ actionLabel, label, onAction, value }: FileActionRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2 text-sm">
      <span className="min-w-0 truncate text-muted-foreground">
        {label}: <strong>{value}</strong>
      </span>
      <Button onClick={onAction} type="button" variant="outline">
        {actionLabel}
      </Button>
    </div>
  );
}
