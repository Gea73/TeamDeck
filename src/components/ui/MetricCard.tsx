import React from 'react';
import { Card } from './Card';

interface MetricCardProps {
  label: string;
  value: string | number;
  helperText?: string;
  icon: React.ReactNode;
  progressPercent?: number;
}

export function MetricCard({
  label,
  value,
  helperText,
  icon,
  progressPercent,
}: MetricCardProps) {
  return (
    <Card padding="md" className="flex flex-col justify-between">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-600 truncate">{label}</p>
          <p className="mt-2 text-2xl sm:text-3xl font-semibold text-slate-900 tabular-nums tracking-tight">
            {value}
          </p>
        </div>
        <div
          className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 text-blue-700 flex items-center justify-center shrink-0"
          aria-hidden="true"
        >
          {icon}
        </div>
      </div>

      {typeof progressPercent === 'number' ? (
        <div className="mt-4">
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-700 rounded-full transition-[width] duration-300"
              style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
            />
          </div>
          {helperText && (
            <p className="mt-2 text-xs text-slate-500">{helperText}</p>
          )}
        </div>
      ) : (
        helperText && <p className="mt-4 text-xs text-slate-500">{helperText}</p>
      )}
    </Card>
  );
}
