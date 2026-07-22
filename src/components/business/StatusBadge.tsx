import { Badge, type BadgeTone } from "../ui/Badge";
import type {
  AlertStatus,
  CategoryStatus,
  ProductStatus,
  PurchaseOrderStatus,
  PurchaseStatus,
  RecommendationStatus,
  SupplierStatus,
} from "../../types/purchasing";

interface Config {
  label: string;
  tone: BadgeTone;
}

const recommendation: Record<RecommendationStatus, Config> = {
  critical: { label: "Crítico", tone: "red" },
  buy_now: { label: "Comprar ahora", tone: "amber" },
  review: { label: "Revisar", tone: "blue" },
  normal: { label: "Normal", tone: "green" },
  overstock: { label: "Sobrestock", tone: "violet" },
};

const product: Record<ProductStatus, Config> = {
  active: { label: "Activo", tone: "green" },
  new: { label: "Nuevo", tone: "blue" },
  discontinued: { label: "Descontinuado", tone: "slate" },
  no_sales: { label: "Sin venta", tone: "red" },
  seasonal: { label: "Temporada", tone: "violet" },
  blocked: { label: "Bloqueado", tone: "neutral" },
};

const purchase: Record<PurchaseStatus, Config> = {
  buy: { label: "Comprar", tone: "amber" },
  do_not_buy: { label: "No comprar", tone: "neutral" },
  review: { label: "Revisar", tone: "blue" },
  on_demand: { label: "Bajo pedido", tone: "slate" },
  overstock: { label: "Sobrestock", tone: "violet" },
};

const purchaseOrder: Record<PurchaseOrderStatus, Config> = {
  draft: { label: "Borrador", tone: "neutral" },
  pending_approval: { label: "Por aprobar", tone: "amber" },
  approved: { label: "Aprobada", tone: "green" },
  sent: { label: "Enviada", tone: "blue" },
  confirmed: { label: "Confirmada", tone: "blue" },
  partially_received: { label: "Parcial", tone: "amber" },
  received: { label: "Recibida", tone: "green" },
  with_difference: { label: "Con diferencia", tone: "amber" },
  closed: { label: "Cerrada", tone: "neutral" },
  delayed: { label: "Atrasada", tone: "red" },
  cancelled: { label: "Cancelada", tone: "neutral" },
};

// Incluye "on_watch" del panel real (GET /suppliers) además de los estados mock.
const supplier: Record<SupplierStatus | "on_watch", Config> = {
  active: { label: "Activo", tone: "green" },
  on_watch: { label: "En observación", tone: "amber" },
  review: { label: "Revisar", tone: "amber" },
  delayed: { label: "Atrasado", tone: "red" },
  blocked: { label: "Bloqueado", tone: "neutral" },
  inactive: { label: "Sin compras", tone: "slate" },
};

const category: Record<CategoryStatus, Config> = {
  healthy: { label: "Saludable", tone: "green" },
  review: { label: "Revisar", tone: "amber" },
  critical: { label: "Crítica", tone: "red" },
  overstock: { label: "Sobrestock", tone: "violet" },
  low_rotation: { label: "Baja rotación", tone: "slate" },
};

const alert: Record<AlertStatus, Config> = {
  new: { label: "Nueva", tone: "blue" },
  in_review: { label: "En revisión", tone: "amber" },
  resolved: { label: "Resuelta", tone: "green" },
  ignored: { label: "Ignorada", tone: "neutral" },
};

type Kind =
  | "recommendation"
  | "product"
  | "purchase"
  | "purchaseOrder"
  | "supplier"
  | "category"
  | "alert";

const maps: Record<Kind, Record<string, Config>> = {
  recommendation,
  product,
  purchase,
  purchaseOrder,
  supplier,
  category,
  alert,
};

interface StatusBadgeProps {
  kind: Kind;
  value: string;
  dot?: boolean;
}

export function StatusBadge({ kind, value, dot = true }: StatusBadgeProps) {
  const cfg = maps[kind][value] ?? { label: value, tone: "neutral" as BadgeTone };
  return (
    <Badge tone={cfg.tone} dot={dot}>
      {cfg.label}
    </Badge>
  );
}
