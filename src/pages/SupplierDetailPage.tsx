import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody } from "../components/ui/Card";
import { KpiCard } from "../components/business/KpiCard";
import { Tabs } from "../components/ui/Tabs";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { StatusBadge } from "../components/business/StatusBadge";
import { AlertCard } from "../components/business/AlertCard";
import { suppliers } from "../data/mockSuppliers";
import { products } from "../data/mockProducts";
import { purchaseOrders } from "../data/mockPurchaseOrders";
import { receptions, RECEPTION_STATUS } from "../data/mockReceptions";
import { alerts } from "../data/mockAlerts";
import {
  formatCurrency,
  formatCurrencyCompact,
  formatDate,
  formatDays,
  formatNumber,
  formatPercent,
} from "../utils/formatters";
import { IconOrders, IconInventory, IconSuppliers } from "../components/ui/icons";

export function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState("productos");

  const supplier = suppliers.find((s) => s.id === id);

  if (!supplier) {
    return (
      <div className="py-10">
        <EmptyState
          title="Proveedor no encontrado"
          description={`No existe el proveedor "${id}".`}
          action={<Button onClick={() => navigate("/proveedores")}>Volver a proveedores</Button>}
        />
      </div>
    );
  }

  const supProducts = products.filter((p) => p.supplierName === supplier.name);
  const supSkus = new Set(supProducts.map((p) => p.sku));
  const supPOs = purchaseOrders.filter((o) => o.supplierName === supplier.name);
  const openPOs = supPOs.filter((o) => !["received", "cancelled"].includes(o.status));
  const supReceptions = receptions.filter((r) => r.supplierName === supplier.name);
  const supAlerts = alerts.filter((a) => a.relatedEntity === supplier.name || (a.relatedSku && supSkus.has(a.relatedSku)));
  const riskProducts = supProducts.filter((p) => p.availableStock <= 0 && p.salesLast30Days > 0).length;

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: "Proveedores", to: "/proveedores" }, { label: supplier.name }]}
        title={supplier.name}
        description={`${supplier.rut} · ${supplier.categories.join(", ")}`}
        action={<StatusBadge kind="supplier" value={supplier.status} />}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KpiCard title="Cumplimiento" value={formatPercent(supplier.deliveryCompliance, 0)} tone={supplier.deliveryCompliance < 70 ? "bad" : supplier.deliveryCompliance < 85 ? "warn" : "good"} icon={<IconSuppliers className="w-4 h-4" />} description="Entregas a tiempo" />
        <KpiCard title="Lead time" value={formatDays(supplier.averageLeadTimeDays)} tone={supplier.averageLeadTimeDays >= 15 ? "warn" : "neutral"} icon={<IconInventory className="w-4 h-4" />} description="Promedio de entrega" />
        <KpiCard title="OC abiertas" value={formatNumber(openPOs.length)} tone="info" icon={<IconOrders className="w-4 h-4" />} description="Ver órdenes" onClick={() => setTab("ordenes")} active={tab === "ordenes"} />
        <KpiCard title="Monto pendiente" value={formatCurrencyCompact(supplier.pendingAmount)} tone={supplier.pendingAmount > 20000000 ? "warn" : "neutral"} icon={<IconOrders className="w-4 h-4" />} />
      </div>

      {/* Motivo de revisión si aplica */}
      {(supplier.status === "delayed" || supplier.status === "review" || supplier.deliveryCompliance < 70) && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <b>Revisar proveedor:</b> cumplimiento {formatPercent(supplier.deliveryCompliance, 0)}
          {supplier.averageLeadTimeDays >= 15 && <> · lead time alto ({formatDays(supplier.averageLeadTimeDays)})</>}
          {riskProducts > 0 && <> · {riskProducts} SKU en quiebre</>}
          {" · "}última compra {formatDate(supplier.lastPurchaseDate)}.
        </div>
      )}

      <Tabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "productos", label: "Productos", count: supProducts.length },
          { value: "ordenes", label: "Órdenes", count: supPOs.length },
          { value: "recepciones", label: "Recepciones", count: supReceptions.length },
          { value: "alertas", label: "Alertas", count: supAlerts.length },
        ]}
      />

      {tab === "productos" && (
        <Card>
          <CardBody className="space-y-2">
            {supProducts.length === 0 ? (
              <EmptyState title="Sin productos" description="Este proveedor no tiene SKUs asociados." />
            ) : (
              supProducts.map((p) => (
                <Link key={p.sku} to={`/productos/${p.sku}`} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 hover:border-brand-300 hover:bg-brand-50/40">
                  <div className="min-w-0">
                    <span className="text-xs font-mono text-slate-400">{p.sku}</span>
                    <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
                    <p className="text-xs text-slate-500">{p.category} · disp. {formatNumber(p.availableStock)} · vende {formatNumber(p.salesLast30Days)}/mes</p>
                  </div>
                  <StatusBadge kind="purchase" value={p.purchaseStatus} dot={false} />
                </Link>
              ))
            )}
          </CardBody>
        </Card>
      )}

      {tab === "ordenes" && (
        <Card>
          <CardBody className="space-y-2">
            {supPOs.length === 0 ? (
              <EmptyState title="Sin órdenes" description="No hay órdenes de compra con este proveedor." />
            ) : (
              supPOs.map((o) => (
                <Link key={o.id} to="/ordenes-compra" className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 hover:border-brand-300 hover:bg-brand-50/40">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800">{o.number}</p>
                    <p className="text-xs text-slate-500">espera {formatDate(o.expectedDate)} · {formatCurrency(o.totalAmount)}</p>
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
      )}

      {tab === "recepciones" && (
        <Card>
          <CardBody className="space-y-2">
            {supReceptions.length === 0 ? (
              <EmptyState title="Sin recepciones" description="No hay recepciones registradas de este proveedor." />
            ) : (
              supReceptions.map((r) => (
                <Link key={r.id} to="/recepciones" className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 hover:border-brand-300 hover:bg-brand-50/40">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800">{r.poNumber}</p>
                    <p className="text-xs text-slate-500">{r.warehouse} · espera {formatDate(r.expectedDate)} · {r.qualityOk ? "conforme" : "con observación"}</p>
                  </div>
                  <Badge tone={RECEPTION_STATUS[r.status].tone} dot>{RECEPTION_STATUS[r.status].label}</Badge>
                </Link>
              ))
            )}
          </CardBody>
        </Card>
      )}

      {tab === "alertas" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {supAlerts.length === 0 ? (
            <Card><CardBody><EmptyState title="Sin alertas" description="Este proveedor no tiene alertas activas." /></CardBody></Card>
          ) : (
            supAlerts.map((a) => <AlertCard key={a.id} alert={a} compact />)
          )}
        </div>
      )}
    </div>
  );
}
