import type { ReactNode } from "react";
import { cn } from "../../utils/cn";
import { IconInfo, IconBulb } from "../ui/icons";

type Variant = "info" | "tip";

interface HelpNoteProps {
  children: ReactNode;
  title?: string;
  variant?: Variant;
  className?: string;
}

const styles: Record<Variant, { box: string; icon: string }> = {
  info: { box: "bg-brand-50/70 border-brand-100 text-brand-900", icon: "text-brand-500" },
  tip: { box: "bg-amber-50/70 border-amber-100 text-amber-900", icon: "text-amber-500" },
};

/**
 * Caja de ayuda corta y reutilizable. Explica conceptos en lenguaje de negocio
 * sin saturar la pantalla.
 */
export function HelpNote({ children, title, variant = "info", className }: HelpNoteProps) {
  const s = styles[variant];
  const Icon = variant === "tip" ? IconBulb : IconInfo;
  return (
    <div className={cn("flex gap-2.5 rounded-xl border px-4 py-3", s.box, className)}>
      <Icon className={cn("w-4 h-4 mt-0.5 flex-shrink-0", s.icon)} />
      <div className="text-sm leading-snug">
        {title && <span className="font-semibold">{title} </span>}
        {children}
      </div>
    </div>
  );
}
