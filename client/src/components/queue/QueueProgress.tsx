interface QueueProgressProps {
  current: number;
  total: number;
}

export function QueueProgress({ current, total }: QueueProgressProps) {
  if (total === 0) return null;

  const progress = ((current + 1) / total) * 100;

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-mono text-theme-dim">
        {current + 1} of {total} idle
      </span>
      <div className="flex-1 h-1 bg-surface-600 rounded-full overflow-hidden max-w-[100px]">
        <div
          className="h-full bg-frost-4 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
