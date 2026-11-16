interface ProgressBarProps {
  value: number;
  showLabel?: boolean;
  size?: 'sm' | 'md';
  labelText?: string;
}

export function ProgressBar({
  value,
  showLabel = true,
  size = 'md',
  labelText,
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, Math.round(value)));
  const heightClass = size === 'sm' ? 'h-1.5' : 'h-2';

  return (
    <div className="w-full">
      {(showLabel || labelText) && (
        <div className="flex items-center justify-between gap-2 mb-1.5 text-xs">
          {labelText ? (
            <span className="text-slate-600 font-medium truncate">{labelText}</span>
          ) : (
            <span className="text-slate-500">Progresso</span>
          )}
          {showLabel && (
            <span className="text-slate-800 font-semibold tabular-nums shrink-0">
              {clamped}%
            </span>
          )}
        </div>
      )}
      <div
        className={`w-full ${heightClass} bg-slate-100 rounded-full overflow-hidden`}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${
            clamped === 100 ? 'bg-emerald-600' : 'bg-blue-700'
          }`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
