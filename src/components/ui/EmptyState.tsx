import type { ReactNode } from "react";
import { IconBox } from "./icons";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-8 px-4">
      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 mb-3">
        {icon ?? <IconBox className="w-6 h-6" />}
      </div>
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {description && (
        <p className="text-xs text-slate-500 mt-1 max-w-sm">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
