import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Badge, type BadgeTone } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Skeleton } from "../../components/ui/Skeleton";
import { StatusBadge } from "../../components/business/StatusBadge";
import { ALERT_STATUS_UI } from "../../components/business/alertBff";
import { RECEPTION_STATUS_UI } from "../receptions/helpers";
import { formatCurrency, formatDate, formatNumber } from "../../utils/formatters";
import { productPath } from "../../utils/entityLinks";
import {
  listPurchaseOrders,
  listReceptions,
  toPurchaseBffError,
  type PurchaseBffError,
  type PurchaseOrderView,
  type ReceptionSummaryView,
  type SupplierCatalogRow,
  type SupplierFichaAlert,
} from "../../services/purchaseBff";

// ============================================================================
//  Pestañas de la ficha de proveedor (F11) sobre datos reales del BFF.
//  Catálogo y Alertas llegan compuestos en GET /suppliers/:id; Órdenes y
//  Recepciones se piden aparte con su filtro supplierId (listas ya conectadas).
// ============================================================================

const fmtDate = (iso: string | null) => (iso ? formatDate(iso.slice(0, 10)) : "—");

/** Prioridad del motor → chip (tolerante a valores nuevos). */
const PRIORITY_UI: Record<string, { label: string; tone: BadgeTone }> = {
  stockout_imminent: { label: "Quiebre inminente", tone: "red" },
  low_stock: { label: "Stock bajo", tone: "amber" },
  opportunity: { label: "Oportunidad", tone: "blue" },
};

function priorityUi(priority: string): { label: string; tone: BadgeTone } {
  return PRIORITY_UI[priority] ?? { label: priority, tone: "neutral" };
}

/** Severidad de alerta del contrato → chip (tolerante a valores nuevos). */
const SEVERITY_UI: Record<string, { label: string; tone: BadgeTone }> = {
  critical: { label: "Crítica", tone: "red" },
  warning: { label: "Advertencia", tone: "amber" },
  info: { label: "Informativa", tone: "neutral" },
};

// ----------------------------------------------------------------------------
//  Fetch local reutilizado por Órdenes y Recepciones (loading/error/empty).
// ----------------------------------------------------------------------------

function useSupplierList<T>(
  supplierId: string,
  fetcher: (supplierId: string) => Promise<{ items: T[] }>
) {
  const [items, setItems] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<PurchaseBffError | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetcher(supplierId)
      .then((data) => {
        if (!cancelled) setItems(data.items);
      })
      .catch((err) => {
        if (!cancelled) setError(toPurchaseBffError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [supplierId, fetcher, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { items, loading, error, retry };
}

function ListSkeleton({ label }: { label: string }) {
  return (
    <div className="space-y-2.5 p-1" aria-busy="true" aria-label={label}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-24" />
        </div>
      ))}
    </div>
  );
}

function ListError({ error, onRetry }: { error: PurchaseBffError; onRetry: () => void }) {
  return (
    <div className="p-4 text-center">
      <p className="text-sm font-semibold text-slate-800">No se pudo cargar la lista</p>
      <p className="mt-1 text-sm text-slate-500">{error.message}</p>
      <Button className="mt-3" size="sm" onClick={onRetry}>
        Reintentar
      </Button>
    </div>
  );
}

// ----------------------------------------------------------------------------
//  Pestaña "Catálogo": el catálogo conocido del proveedor según el motor.
// ----------------------------------------------------------------------------

export function SupplierCatalogTab({ items }: { items: SupplierCatalogRow[] }) {
  return (
    <Card>
      <CardHeader
        title="Catálogo del proveedor"
        description="SKUs conocidos según el motor de reposición: stock, velocidad, cobertura, costo y condiciones."
      />
      <CardBody>
        {items.length === 0 ? (
          <EmptyState
            title="Sin catálogo conocido"
            description="El motor todavía no asocia SKUs a este proveedor."
          />
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-sm min-w-[860px]">
              <thead>
                <tr className="border-b border-slate-200 text-xs">
                  <th className="text-left font-medium text-slate-500 py-2 pl-1">Producto</th>
                  <th className="text-right font-medium text-slate-500 py-2 px-2">Stock</th>
                  <th className="text-right font-medium text-slate-500 py-2 px-2">Vel. diaria</th>
                  <th className="text-right font-medium text-slate-500 py-2 px-2">Cobertura</th>
                  <th className="text-right font-medium text-slate-500 py-2 px-2">Costo</th>
                  <th className="text-right font-medium text-slate-500 py-2 px-2">MOQ / pack</th>
                  <th className="text-right font-medium text-slate-500 py-2 pr-1">Prioridad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {items.map((p) => {
                  const prio = priorityUi(p.priority);
                  return (
                    <tr key={p.sku} className="hover:bg-slate-50">
                      <td className="py-2 pl-1 min-w-0">
                        <Link to={productPath(p.sku)} className="group block">
                          <span className="text-slate-800 group-hover:text-brand-700 group-hover:underline">
                            {p.name ?? p.sku}
                          </span>
                          <span className="block text-xs text-slate-400">
                            {p.sku}
                            {p.brand && <> · {p.brand}</>}
                            {p.categoryName && <> · {p.categoryName}</>}
                          </span>
                        </Link>
                      </td>
                      <td className="text-right py-2 px-2 tabular-nums text-slate-600">
                        {p.stockAvailable !== null ? formatNumber(p.stockAvailable) : "—"}
                      </td>
                      <td className="text-right py-2 px-2 tabular-nums text-slate-600">
                        {p.dailyVelocity !== null
                          ? p.dailyVelocity.toLocaleString("es-CL", { maximumFractionDigits: 1 })
                          : "—"}
                      </td>
                      <td className="text-right py-2 px-2 tabular-nums text-slate-600">
                        {p.coverageDays !== null ? `${formatNumber(p.coverageDays)} d` : "—"}
                      </td>
                      <td className="text-right py-2 px-2 tabular-nums text-slate-600">
                        {p.unitCostClp !== null ? formatCurrency(p.unitCostClp) : "—"}
                      </td>
                      <td className="text-right py-2 px-2 tabular-nums text-slate-600">
                        {p.moq !== null ? formatNumber(p.moq) : "—"}
                        {" / "}
                        {p.packMultiple !== null ? formatNumber(p.packMultiple) : "—"}
                      </td>
                      <td className="text-right py-2 pr-1">
                        <Badge tone={prio.tone}>{prio.label}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// ----------------------------------------------------------------------------
//  Pestaña "Órdenes": OC reales del proveedor (GET /purchase-orders?supplierId=).
// ----------------------------------------------------------------------------

const fetchOrders = (supplierId: string) => listPurchaseOrders({ supplierId, pageSize: 50 });

export function SupplierOrdersTab({ supplierId }: { supplierId: string }) {
  const { items, loading, error, retry } = useSupplierList<PurchaseOrderView>(
    supplierId,
    fetchOrders
  );

  return (
    <Card>
      <CardBody className="space-y-2">
        {loading && !items ? (
          <ListSkeleton label="Cargando órdenes del proveedor" />
        ) : error && !items ? (
          <ListError error={error} onRetry={retry} />
        ) : !items || items.length === 0 ? (
          <EmptyState
            title="Sin órdenes"
            description="No hay órdenes de compra con este proveedor."
          />
        ) : (
          items.map((o) => (
            <Link
              key={o.id}
              to={`/comprar/seguimiento?oc=${encodeURIComponent(o.number)}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 hover:border-brand-300 hover:bg-brand-50/40"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800">{o.number}</p>
                <p className="text-xs text-slate-500">
                  creada {fmtDate(o.createdAt)}
                  {o.expectedDate && <> · espera {fmtDate(o.expectedDate)}</>} ·{" "}
                  {o.netTotalClp !== null ? formatCurrency(o.netTotalClp) : "—"}
                </p>
              </div>
              <StatusBadge kind="purchaseOrder" value={o.status} dot={false} />
            </Link>
          ))
        )}
      </CardBody>
    </Card>
  );
}

// ----------------------------------------------------------------------------
//  Pestaña "Recepciones": recepciones reales (GET /receptions?supplierId=).
// ----------------------------------------------------------------------------

const fetchReceptions = (supplierId: string) => listReceptions({ supplierId, pageSize: 50 });

export function SupplierReceptionsTab({ supplierId }: { supplierId: string }) {
  const { items, loading, error, retry } = useSupplierList<ReceptionSummaryView>(
    supplierId,
    fetchReceptions
  );

  return (
    <Card>
      <CardBody className="space-y-2">
        {loading && !items ? (
          <ListSkeleton label="Cargando recepciones del proveedor" />
        ) : error && !items ? (
          <ListError error={error} onRetry={retry} />
        ) : !items || items.length === 0 ? (
          <EmptyState
            title="Sin recepciones"
            description="No hay recepciones registradas de este proveedor."
          />
        ) : (
          items.map((r) => {
            const st = RECEPTION_STATUS_UI[r.status] ?? { label: r.status, tone: "neutral" as const };
            return (
              <Link
                key={r.id}
                to={`/recepciones?rid=${encodeURIComponent(r.displayId)}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 hover:border-brand-300 hover:bg-brand-50/40"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">
                    {r.displayId}
                    {r.poNumber && <span className="text-slate-400 font-normal"> · {r.poNumber}</span>}
                  </p>
                  <p className="text-xs text-slate-500">
                    {r.warehouseId} · espera {fmtDate(r.expectedDate)} · {r.itemCount} línea
                    {r.itemCount === 1 ? "" : "s"}
                    {r.hasDiscrepancy && <> · con diferencias</>}
                  </p>
                </div>
                <Badge tone={st.tone} dot>
                  {st.label}
                </Badge>
              </Link>
            );
          })
        )}
      </CardBody>
    </Card>
  );
}

// ----------------------------------------------------------------------------
//  Pestaña "Alertas": alertas activas del proveedor desde la ficha compuesta.
// ----------------------------------------------------------------------------

export function SupplierAlertsTab({ alerts }: { alerts: SupplierFichaAlert[] }) {
  return (
    <Card>
      <CardBody className="space-y-2">
        {alerts.length === 0 ? (
          <EmptyState title="Sin alertas" description="Este proveedor no tiene alertas activas." />
        ) : (
          alerts.map((a) => {
            const st =
              a.status && a.status in ALERT_STATUS_UI
                ? ALERT_STATUS_UI[a.status as keyof typeof ALERT_STATUS_UI]
                : { label: a.status ?? "—", tone: "neutral" as BadgeTone };
            return (
              <div
                key={a.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {a.title ?? "Alerta comercial"}
                  </p>
                  <p className="text-xs text-slate-500">{fmtDate(a.dateCreated)}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {a.severity && (
                    <Badge tone={(SEVERITY_UI[a.severity] ?? { tone: "neutral" as BadgeTone }).tone}>
                      {SEVERITY_UI[a.severity]?.label ?? a.severity}
                    </Badge>
                  )}
                  <Badge tone={st.tone} dot>
                    {st.label}
                  </Badge>
                </div>
              </div>
            );
          })
        )}
      </CardBody>
    </Card>
  );
}
