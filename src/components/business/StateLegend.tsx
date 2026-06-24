import { useState } from "react";
import { Badge } from "../ui/Badge";
import { recommendationMeaning } from "./statusInfo";
import { IconInfo, IconChevronRight } from "../ui/icons";
import { cn } from "../../utils/cn";

/**
 * Leyenda desplegable que explica qué significa cada estado de recomendación.
 * Ayuda a un comprador nuevo a interpretar la tabla sin adivinar.
 */
export function StateLegend() {
  const [open, setOpen] = useState(false);
  const states = Object.values(recommendationMeaning);

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left"
      >
        <IconInfo className="w-4 h-4 text-slate-400" />
        <span className="text-sm font-medium text-slate-700">
          ¿Qué significa cada estado?
        </span>
        <div className="flex-1" />
        <IconChevronRight
          className={cn(
            "w-4 h-4 text-slate-400 transition-transform",
            open && "rotate-90"
          )}
        />
      </button>
      {open && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 px-4 pb-4 pt-1">
          {states.map((s) => (
            <div key={s.label} className="rounded-lg bg-slate-50 p-2.5">
              <Badge tone={s.tone} dot>
                {s.label}
              </Badge>
              <p className="mt-1.5 text-xs text-slate-600 leading-snug">{s.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
