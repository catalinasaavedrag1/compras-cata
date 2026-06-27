import type { ReactNode } from "react";
import { cn } from "../../utils/cn";
import { useDensity } from "../../context/DensityContext";

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return (
    <div
      className={cn(
        "bg-white border border-slate-200 rounded-xl shadow-card",
        className
      )}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function CardHeader({ title, description, action, className }: CardHeaderProps) {
  const { compact } = useDensity();
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 border-b border-slate-100",
        compact ? "px-4 py-2.5" : "px-5 py-4",
        className
      )}
    >
      <div>
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {description && (
          <p className="text-xs text-slate-500 mt-0.5">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function CardBody({ children, className }: CardProps) {
  const { compact } = useDensity();
  return <div className={cn(compact ? "p-3.5" : "p-5", className)}>{children}</div>;
}
