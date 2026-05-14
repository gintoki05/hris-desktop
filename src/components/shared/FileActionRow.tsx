type FileActionRowProps = {
  actionLabel: string;
  label: string;
  onAction: () => void;
  value: string;
};

export function FileActionRow({ actionLabel, label, onAction, value }: FileActionRowProps) {
  return (
    <div className="file-action-row">
      <span>
        {label}: <strong>{value}</strong>
      </span>
      <button onClick={onAction} type="button">
        {actionLabel}
      </button>
    </div>
  );
}
