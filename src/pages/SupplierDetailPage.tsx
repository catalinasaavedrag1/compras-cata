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
import { IconOrders, IconInventory, IconSuppliers, IconSales, IconBox } from "../components/ui/icons";

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

  // ---- Resumen comercial para atender al proveedor ----
  const sales30Amount = (p: (typeof supProducts)[number]) => p.salesLast30Days * p.price;
  const utility30 = (p: (typeof supProducts)[number]) => p.salesLast30Days * (p.price - p.cost);
  const ventas30 = supProducts.reduce((a, p) => a + sales30Amount(p), 0);
  const utilidad30 = supProducts.reduce((a, p) => a + utility30(p), 0);
  const margenProm = ventas30 > 0 ? (utilidad30 / ventas30) * 100 : 0;

  const topSold = [...supProducts].filter((p) => p.salesLast30Days > 0).sort((a, b) => sales30Amount(b) - sales30Amount(a)).slice(0, 5);
  const detenidos = supProducts.filter((p) => p.purchaseStatus === "overstock" || (p.salesLast30Days === 0 && p.availableStock > 0));
  const delayedPOs = supPOs.filter((o) => o.status === "delayed" || o.delayedDays > 0);

  // Nivel de importancia: combina compra (90d) vs el mayor del panel y tamaño del surtido
  const maxBuy = Math.max(1, ...suppliers.map((s) => s.purchasedAmountLast90Days));
  const share = supplier.purchasedAmountLast90Days / maxBuy;
  const importance =
    share >= 0.6 || supplier.associatedSkus >= 200
      ? { label: "Estratégico", tone: "violet" as const }
      : share >= 0.3 || supplier.associatedSkus >= 100
        ? { label: "Importante", tone: "blue" as const }
        : { label: "Secundario", tone: "neutral" as const };

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

      {/* Resumen para atender al proveedor */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-card p-4 mb-4">
        <p className="text-sm font-semibold text-slate-800 mb-3">Para atender al proveedor</p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="rounded-lg bg-slate-50 px-3 py-2.5">
            <p className="text-xs text-slate-400">Importancia</p>
            <div className="mt-1"><Badge tone={importance.tone}>{importance.label}</Badge></div>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2.5">
            <p className="text-xs text-slate-400">Venta 30 días</p>
            <p className="text-lg font-semibold text-slate-800">{formatCurrencyCompact(ventas30)}</p>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2.5">
            <p className="text-xs text-slate-400">Margen promedio</p>
            <p className="text-lg font-semibold text-emerald-700">{formatPercent(margenProm, 1)}</p>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2.5">
            <p className="text-xs text-slate-400">Utilidad 30 días</p>
            <p className="text-lg font-semibold text-emerald-700">{formatCurrencyCompact(utilidad30)}</p>
          </div>
          <button onClick={() => setTab("ordenes")} className="rounded-lg bg-slate-50 px-3 py-2.5 text-left hover:bg-slate-100">
            <p className="text-xs text-slate-400">OC atrasadas</p>
            <p className={`text-lg font-semibold ${delayedPOs.length > 0 ? "text-rose-600" : "text-slate-800"}`}>{formatNumber(delayedPOs.length)}</p>
          </button>
        </div>
      </div>

      {/* Más vendidos / Productos detenidos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card>
          <CardBody>
            <div className="flex items-center gap-2 mb-2.5">
              <IconSales className="w-4 h-4 text-emerald-600" />
              <p className="text-sm font-semibold text-slate-800">Más vendidos (30 días)</p>
            </div>
            {topSold.length === 0 ? (
              <p className="text-sm text-slate-400">Sin ventas registradas.</p>
            ) : (
              <div className="space-y-1.5">
                {topSold.map((p, i) => (
                  <Link key={p.sku} to={`/productos/${p.sku}`} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                    <span className="w-5 text-center text-xs font-bold text-slate-400">{i + 1}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-slate-800 truncate">{p.name}</span>
                      <span className="block text-xs text-slate-400">{formatNumber(p.salesLast30Days)} u. · margen {formatPercent(p.margin, 0)}</span>
                    </span>
                    <span className="text-sm font-semibold text-slate-700 flex-shrink-0">{formatCurrencyCompact(sales30Amount(p))}</span>
                  </Link>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex items-center gap-2 mb-2.5">
              <IconBox className="w-4 h-4 text-violet-600" />
              <p className="text-sm font-semibold text-slate-800">Productos detenidos</p>
              {detenidos.length > 0 && <Badge tone="violet">{detenidos.length}</Badge>}
            </div>
            {detenidos.length === 0 ? (
              <p className="text-sm text-slate-400">Sin sobrestock ni productos sin venta. 👍</p>
            ) : (
              <div className="space-y-1.5">
                {detenidos.slice(0, 5).map((p) => (
                  <Link key={p.sku} to={`/productos/${p.sku}`} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-slate-800 truncate">{p.name}</span>
                      <span className="block text-xs text-slate-400">disp. {formatNumber(p.availableStock)} · vende {formatNumber(p.salesLast30Days)}/mes</span>
                    </span>
                    <Badge tone={p.salesLast30Days === 0 ? "red" : "violet"}>{p.salesLast30Days === 0 ? "Sin venta" : "Sobrestock"}</Badge>
                  </Link>
                ))}
                {detenidos.length > 5 && <p className="text-xs text-slate-400 pt-0.5">+{detenidos.length - 5} más · ver pestaña Productos</p>}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

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
