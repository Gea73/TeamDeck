import { CheckCircle2, Clock, FileEdit, PlayCircle } from 'lucide-react';
import { ContentSectionStatus, ProjectStatus, RehearsalStatus } from '../../types';

type AnyStatus = ProjectStatus | RehearsalStatus | ContentSectionStatus | string;

interface StatusIndicatorProps {
  status: AnyStatus;
}

export function StatusIndicator({ status }: StatusIndicatorProps) {
  switch (status) {
    case ProjectStatus.COMPLETED:
    case RehearsalStatus.DONE:
    case ContentSectionStatus.READY:
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 whitespace-nowrap shrink-0">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
          <span>{status}</span>
        </span>
      );
    case ProjectStatus.REHEARSING:
    case RehearsalStatus.CONFIRMED:
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 whitespace-nowrap shrink-0">
          <PlayCircle className="w-3.5 h-3.5 text-blue-700 shrink-0" aria-hidden="true" />
          <span>{status}</span>
        </span>
      );
    case ProjectStatus.IN_PROGRESS:
    case ContentSectionStatus.DRAFTING:
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-800 whitespace-nowrap shrink-0">
          <FileEdit className="w-3.5 h-3.5 text-blue-600 shrink-0" aria-hidden="true" />
          <span>{status}</span>
        </span>
      );
    case ProjectStatus.PLANNING:
    case RehearsalStatus.PENDING:
    case ContentSectionStatus.PENDING:
    default:
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 whitespace-nowrap shrink-0">
          <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" aria-hidden="true" />
          <span>{status}</span>
        </span>
      );
  }
}
