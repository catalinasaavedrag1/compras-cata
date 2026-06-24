import { Link } from "react-router-dom";
import { entityTypeLabel, type EntityRef, type EntityType } from "../entities";
import { Badge } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
import {
  IconProducts,
  IconSuppliers,
  IconCategories,
  IconOrders,
  IconReplenish,
  IconAlerts,
  IconCampaign,
  IconChevronRight,
} from "../../components/ui/icons";

const ENTITY_ICON: Record<EntityType, (p: { className?: string }) => JSX.Element> = {
  product: IconProducts,
  supplier: IconSuppliers,
  category: IconCategories,
  purchaseOrder: IconOrders,
  recommendation: IconReplenish,
  alert: IconAlerts,
  campaign: IconCampaign,
};

const ORDER: EntityType[] = [
  "recommendation",
  "supplier",
  "category",
  "purchaseOrder",
  "alert",
  "campaign",
  "product",
];

/**
 * Panel de entidades relacionadas: conecta el registro actual con otros módulos.
 * Cada item es cliqueable y navega al módulo correspondiente.
 */
export function RelatedEntitiesPanel({ entities }: { entities: EntityRef[] }) {
  if (entities.length === 0) {
    return (
      <EmptyState
        title="Sin entidades relacionadas"
        description="Este registro no tiene vínculos con otros módulos por ahora."
      />
    );
  }

  const groups = ORDER.map((type) => ({
    type,
    items: entities.filter((e) => e.entityType === type),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-4">
      {groups.map((g) => {
        const Icon = ENTITY_ICON[g.type];
        return (
          <div key={g.type}>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              {entityTypeLabel(g.type)}
            </p>
            <div className="space-y-1.5">
              {g.items.map((e) => (
                <Link
                  key={`${e.entityType}-${e.entityId}`}
                  to={e.route}
                  className="group flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 hover:border-brand-300 hover:bg-brand-50/40 transition-colors"
                >
                  <Icon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span className="text-sm font-medium text-slate-800 truncate flex-1">
                    {e.displayName}
                  </span>
                  {e.status && <Badge tone="neutral">{e.status}</Badge>}
                  <IconChevronRight className="w-4 h-4 text-slate-300 group-hover:text-brand-500 flex-shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
