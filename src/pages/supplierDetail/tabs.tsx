import { Link } from "react-router-dom";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
import { StatusBadge } from "../../components/business/StatusBadge";
import { AlertCard } from "../../components/business/AlertCard";
import { RECEPTION_STATUS } from "../../data/mockReceptions";
import { formatCurrency, formatNumber, formatDate } from "../../utils/formatters";
import type {
  CommercialAlert,
  Product,
  PurchaseOrder,
  Reception,
} from "../../types/purchasing";

/** Pestaña "Catálogo": cómo compra Mimbral cada SKU a este proveedor. */
export function SupplierCatalogTab({ products }: { products: Product[] }) {
  return (
    <Card>
      <CardHeader
        title="Catálogo del proveedor"
        description="Cómo compra Mimbral cada producto a este proveedor: código, unidades, múltiplo, costo y equivalencias."
      />
      <CardBody className="space-y-2">
        {products.length === 0 ? (
          <EmptyState title="Sin productos" description="Este proveedor no tiene SKUs asociados." />
        ) : (
          products.map((p) => {
            const costDelta =
              p.costoAnterior && p.costoAnterior !== p.cost
                ? Math.round(((p.cost - p.costoAnterior) / p.costoAnterior) * 100)
                : 0;
            return (
              <div
                key={p.sku}
                className="rounded-lg border border-slate-200 px-3 py-2.5 hover:border-brand-300 hover:bg-brand-50/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <Link to={`/productos/${p.sku}`} className="min-w-0 group">
                    <p className="text-sm font-medium text-slate-800 truncate group-hover:text-brand-700 group-hover:underline">
                      {p.name} <span className="text-slate-400 font-normal">- {p.sku}</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      {p.category} · disp. {formatNumber(p.availableStock)} · vende{" "}
                      {formatNumber(p.salesLast30Days)}/mes
                    </p>
                  </Link>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-slate-800">{formatCurrency(p.cost)}</p>
                    {costDelta !== 0 && (
                      <p
                        className={`text-[11px] font-medium ${costDelta > 0 ? "text-rose-600" : "text-emerald-600"}`}
                      >
                        {costDelta > 0 ? "▲" : "▼"} {Math.abs(costDelta)}% vs{" "}
                        {formatCurrency(p.costoAnterior!)}
                      </p>
                    )}
                    {p.descuentoVigentePct ? (
                      <p className="text-[11px] text-emerald-600">Dscto. {p.descuentoVigentePct}%</p>
                    ) : null}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                  {p.codigoProveedor && (
                    <span>
                      Cód. prov. <b className="text-slate-700 font-mono">{p.codigoProveedor}</b>
                    </span>
                  )}
                  {p.codigoBarras && (
                    <span>
                      EAN <span className="font-mono">{p.codigoBarras}</span>
                    </span>
                  )}
                  {(p.unidadCompra || p.unidadVenta) && (
                    <span>
                      Compra <b className="text-slate-700">{p.unidadCompra ?? "—"}</b> · vende{" "}
                      <b className="text-slate-700">{p.unidadVenta ?? "—"}</b>
                    </span>
                  )}
                  {p.multiploCompra ? (
                    <span>
                      Múltiplo <b className="text-slate-700">{formatNumber(p.multiploCompra)}</b>
                    </span>
                  ) : null}
                  {p.equivalencias && p.equivalencias.length > 0 && (
                    <span
                      className="text-brand-600"
                      title={p.equivalencias
                        .map((e) => `${e.supplierName}: ${formatCurrency(e.costo)}`)
                        .join(" · ")}
                    >
                      {p.equivalencias.length} equivalente
                      {p.equivalencias.length === 1 ? "" : "s"} en otros proveedores
                    </span>
                  )}
                  <span className="ml-auto">
                    <StatusBadge kind="purchase" value={p.purchaseStatus} dot={false} />
                  </span>
                </div>
              </div>
            );
          })
        )}
      </CardBody>
    </Card>
  );
}

/** Pestaña "Órdenes": OC del proveedor con estado y atraso. */
export function SupplierOrdersTab({ orders }: { orders: PurchaseOrder[] }) {
  return (
    <Card>
      <CardBody className="space-y-2">
        {orders.length === 0 ? (
          <EmptyState
            title="Sin órdenes"
            description="No hay órdenes de compra con este proveedor."
          />
        ) : (
          orders.map((o) => (
            <Link
              key={o.id}
              to={`/comprar/seguimiento?oc=${encodeURIComponent(o.number)}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 hover:border-brand-300 hover:bg-brand-50/40"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800">{o.number}</p>
                <p className="text-xs text-slate-500">
                  espera {formatDate(o.expectedDate)} · {formatCurrency(o.totalAmount)}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {o.delayedDays > 0 && <Badge tone="red">{o.delayedDays} d</Badge>}
                <StatusBadge kind="purchaseOrder" value={o.status} dot={false} />
              </div>
            </Link>
          ))
        )}
      </CardBody>
    </Card>
  );
}

/** Pestaña "Recepciones": recepciones registradas del proveedor. */
export function SupplierReceptionsTab({ receptions }: { receptions: Reception[] }) {
  return (
    <Card>
      <CardBody className="space-y-2">
        {receptions.length === 0 ? (
          <EmptyState
            title="Sin recepciones"
            description="No hay recepciones registradas de este proveedor."
          />
        ) : (
          receptions.map((r) => (
            <Link
              key={r.id}
              to={`/recepciones?rid=${encodeURIComponent(r.id)}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 hover:border-brand-300 hover:bg-brand-50/40"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800">{r.poNumber}</p>
                <p className="text-xs text-slate-500">
                  {r.warehouse} · espera {formatDate(r.expectedDate)} ·{" "}
                  {r.qualityOk ? "conforme" : "con observación"}
                </p>
              </div>
              <Badge tone={RECEPTION_STATUS[r.status].tone} dot>
                {RECEPTION_STATUS[r.status].label}
              </Badge>
            </Link>
          ))
        )}
      </CardBody>
    </Card>
  );
}

/** Pestaña "Alertas": alertas comerciales activas del proveedor. */
export function SupplierAlertsTab({ alerts }: { alerts: CommercialAlert[] }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {alerts.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              title="Sin alertas"
              description="Este proveedor no tiene alertas activas."
            />
          </CardBody>
        </Card>
      ) : (
        alerts.map((a) => <AlertCard key={a.id} alert={a} compact />)
      )}
    </div>
  );
}
