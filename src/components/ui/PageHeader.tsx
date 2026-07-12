import type { ReactNode } from "react";
import { Breadcrumbs, type Crumb } from "./Breadcrumbs";
import { useDensity } from "../../context/DensityContext";

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  breadcrumbs?: Crumb[];
  /** Ayuda educativa opcional (un ⓘ junto al título). Úsala para mover
   *  intros y glosarios fuera de la vista, dejando el espacio a lo operativo. */
  help?: ReactNode;
}

export function PageHeader({ title, description, action, breadcrumbs, help }: PageHeaderProps) {
  const { compact } = useDensity();
  return (
    <div className={compact ? "mb-3" : "mb-5"}>
      {breadcrumbs && breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} />}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className={`${compact ? "text-lg" : "text-xl"} font-semibold text-slate-900`}>
              {title}
            </h1>
            {help}
          </div>
          {/* En modo compacto se oculta la descripción larga para ganar densidad. */}
          {description && !compact && (
            <p className="text-sm text-slate-500 mt-1 max-w-3xl">{description}</p>
          )}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
    </div>
  );
}
