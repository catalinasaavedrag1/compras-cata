import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { KpiCard } from "../components/business/KpiCard";
import { DataTable, type Column } from "../components/ui/Table";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { HelpNote } from "../components/business/HelpNote";
import { StatusBadge } from "../components/business/StatusBadge";
import { PriorityGuide, type GuideStep } from "../components/business/PriorityGuide";
import {
  IconAlerts,
  IconBox,
  IconOrders,
  IconSuppliers,
  IconReplenish,
  IconCheck,
  IconPlus,
  IconChevronRight,
} from "../components/ui/icons";
import { products } from "../data/mockProducts";
import { recommendations } from "../data/mockRecommendations";
import { suppliers } from "../data/mockSuppliers";
import { purchaseOrders } from "../data/mockPurchaseOrders";
import { categories } from "../data/mockCategories";
import { useBuyer } from "../context/BuyerContext";
import { useOcDraft } from "../context/OcDraftContext";
import { useToast } from "../context/ToastContext";
import {
  coverageDays,
  estimatedStockoutDate,
  calculateSuggestedPurchase,
} from "../utils/calculations";
import { TODAY_ISO } from "../utils/constants";
import {
  formatCurrencyCompact,
  formatDate,
  formatDays,
  formatNumber,
} from "../utils/formatters";
import type { Product } from "../types/purchasing";

interface RiskRow {
  product: Product;
  coverage: number;
  stockoutDate: string | null;
  suggestedQty: number;
  coverageAfter: number;
}

export function MyPanelPage() {
  const navigate = useNavigate();
  const { buyer, myCategories } = useBuyer();
  const { addItem, hasItem } = useOcDraft();
  const toast = useToast();

  const myProducts = useMemo(
    () => products.filter((p) => myCategories.includes(p.category)),
    [myCategories]
  );

  const myCats = categories.filter((c) => c.buyer === buyer);

  // Riesgo de quiebre: sin stock con venta, o cobertura corta vs lead time
  const riskRows = useMemo<RiskRow[]>(() => {
    return myProducts
      .filter((p) => {
        if (p.salesLast30Days <= 0) return false;
        const cover = coverageDays(p.availableStock, p.salesLast30Days);
        return p.availableStock <= 0 || cover <= p.supplierLeadTimeDays * 2;
      })
      .map((p) => {
        const cover = coverageDays(p.availableStock, p.salesLast30Days);
        const rec = recommendations.find((r) => r.sku === p.sku);
        const calc = calculateSuggestedPurchase({
          availableStock: p.availableStock,
          committedStock: p.committedStock,
          monthlySales: p.salesLast30Days,
          leadTimeDays: p.supplierLeadTimeDays,
          targetInventoryDays: 45,
          minStock: p.minStock,
          maxStock: p.maxStock,
        });
        const suggestedQty = rec?.suggestedQuantity ?? calc.suggestedQuantity;
        const coverageAfter =
          p.salesLast30Days > 0
            ? Math.round(((p.availableStock + suggestedQty) / (p.salesLast30Days / 30)) * 10) / 10
            : 0;
        return {
          product: p,
          coverage: cover,
          stockoutDate: estimatedStockoutDate(p.availableStock, p.salesLast30Days, TODAY_ISO),
          suggestedQty,
          coverageAfter,
        };
      })
      .sort((a, b) => a.coverage - b.coverage);
  }, [myProducts]);

  const overstockProducts = myProducts.filter((p) => p.purchaseStatus === "overstock");

  const myOpenOrders = purchaseOrders.filter(
    (o) =>
      o.buyerName === buyer &&
      !["received", "cancelled"].includes(o.status)
  );
  const myDelayedPOs = myOpenOrders.filter((o) => o.status === "delayed");

  const mySuppliersToReview = suppliers.filter(
    (s) =>
      s.categories.some((c) => myCategories.includes(c)) &&
      ["review", "delayed", "inactive"].includes(s.status)
  );

  const noSupplierProducts = myProducts.filter((p) => !p.supplierName);

  const handleAdd = (p: Product, qty: number) => {
    addItem({
      sku: p.sku,
      productName: p.name,
      supplierName: p.supplierName,
      quantity: qty,
      unitCost: p.cost,
    });
    toast.success(`${p.name} agregado al borrador de OC`);
  };

  // Tareas consolidadas del comprador
  const tasks: GuideStep[] = [
    {
      title: "Comprar productos en riesgo de quiebre",
      detail: "SKUs sin stock o con cobertura menor al doble del lead time.",
      count: riskRows.length,
      countLabel: `${riskRows.length} productos`,
      to: "#riesgo",
      tone: "red",
    },
    {
      title: "Seguir órdenes de compra sin recibir",
      detail: "Mercadería que aún no llega. Revisa las atrasadas primero.",
      count: myOpenOrders.length,
      countLabel: `${myOpenOrders.length} órdenes`,
      to: "#ordenes",
      tone: myDelayedPOs.length > 0 ? "red" : "amber",
    },
    {
      title: "Revisar proveedores con problemas",
      detail: "Proveedores de mis categorías a revisar este mes.",
      count: mySuppliersToReview.length,
      countLabel: `${mySuppliersToReview.length} proveedores`,
      to: "#proveedores",
      tone: "amber",
    },
    {
      title: "Gestionar sobrestock",
      detail: "Inventario inmovilizado: liquidar o dejar de comprar.",
      count: overstockProducts.length,
      countLabel: `${overstockProducts.length} productos`,
      to: "#sobrestock",
      tone: "violet",
    },
    {
      title: "Asignar proveedor a productos sin proveedor",
      detail: "No se pueden reponer hasta tener proveedor.",
      count: noSupplierProducts.length,
      countLabel: `${noSupplierProducts.length} productos`,
      to: "/productos?prov=&compra=",
      tone: "neutral",
    },
  ];

  const riskColumns: Column<RiskRow>[] = [
    {
      key: "product",
      header: "Producto",
      render: ({ product: p }) => (
        <div className="min-w-[200px]">
          <span className="text-xs font-mono text-slate-400">{p.sku}</span>
          <p className="font-medium text-slate-800 leading-snug">{p.name}</p>
          <p className="text-xs text-slate-500">{p.category} · {p.supplierName || "Sin proveedor"}</p>
        </div>
      ),
    },
    {
      key: "stock",
      header: "Stock disp.",
      align: "right",
      render: ({ product: p }) => (
        <span className={p.availableStock <= 0 ? "text-rose-600 font-semibold" : "text-slate-700"}>
          {formatNumber(p.availableStock)}
        </span>
      ),
    },
    {
      key: "sales",
      header: "Venta 30d",
      align: "right",
      hideOnMobile: true,
      render: ({ product: p }) => formatNumber(p.salesLast30Days),
    },
    {
      key: "stockout",
      header: "Quiebre estimado",
      align: "right",
      render: (r) => (
        <div className="text-sm">
          <p className={r.coverage <= r.product.supplierLeadTimeDays ? "text-rose-600 font-semibold" : "text-amber-600 font-medium"}>
            {r.product.availableStock <= 0 ? "En quiebre" : formatDate(r.stockoutDate ?? "")}
          </p>
          <p className="text-xs text-slate-400">
            cubre {formatDays(r.coverage)} · lead {formatDays(r.product.supplierLeadTimeDays)}
          </p>
        </div>
      ),
    },
    {
      key: "suggested",
      header: "Compra sugerida",
      align: "right",
      render: (r) => (
        <div className="text-sm">
          <p className="font-semibold text-slate-900">{formatNumber(r.suggestedQty)} u.</p>
          <p className="text-xs text-slate-400">para ~{formatDays(r.coverageAfter)}</p>
        </div>
      ),
    },
    {
      key: "action",
      header: "",
      render: (r) => (
        <div className="flex flex-col gap-1 min-w-[130px]">
          <Button
            size="sm"
            variant={hasItem(r.product.sku) ? "secondary" : "primary"}
            disabled={hasItem(r.product.sku) || r.suggestedQty <= 0}
            onClick={(e) => {
              e.stopPropagation();
              handleAdd(r.product, r.suggestedQty);
            }}
            icon={hasItem(r.product.sku) ? <IconCheck className="w-3.5 h-3.5" /> : <IconPlus className="w-3.5 h-3.5" />}
          >
            {hasItem(r.product.sku) ? "En OC" : "Agregar a OC"}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={`Mi panel · ${buyer}`}
        description="Tus tareas como comprador: qué comprar, qué órdenes seguir, qué proveedores revisar y qué inventario gestionar, solo de tus categorías asignadas."
        action={
          <Button variant="secondary" onClick={() => navigate("/reposicion")} icon={<IconReplenish className="w-4 h-4" />}>
            Ir a reposición
          </Button>
        }
      />

      {/* Mis categorías asignadas */}
      <Card className="mb-4">
        <CardHeader title="Mis categorías asignadas" description={`${myCats.length} categoría${myCats.length === 1 ? "" : "s"} bajo tu gestión`} />
        <CardBody>
          {myCats.length === 0 ? (
            <p className="text-sm text-slate-500">No tienes categorías asignadas. Cambia de comprador en la barra superior.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {myCats.map((c) => (
                <Link
                  key={c.id}
                  to="/categorias"
                  className="group flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 hover:border-brand-300 hover:bg-brand-50/40"
                >
                  <span className="text-sm font-medium text-slate-800">{c.name}</span>
                  {c.stockoutSkus > 0 && <Badge tone="red">{c.stockoutSkus} quiebre</Badge>}
                  {c.riskSkus > 0 && <Badge tone="amber">{c.riskSkus} riesgo</Badge>}
                  <StatusBadge kind="category" value={c.status} dot={false} />
                  <IconChevronRight className="w-4 h-4 text-slate-300 group-hover:text-brand-500" />
                </Link>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* KPIs de tareas (cliqueables) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiCard title="En riesgo de quiebre" value={formatNumber(riskRows.length)} tone="bad" icon={<IconAlerts className="w-4 h-4" />} description="Ver abajo" to="#riesgo" />
        <KpiCard title="OC sin recibir" value={formatNumber(myOpenOrders.length)} tone={myDelayedPOs.length ? "bad" : "warn"} icon={<IconOrders className="w-4 h-4" />} description={`${myDelayedPOs.length} atrasadas`} to="#ordenes" />
        <KpiCard title="Proveedores por revisar" value={formatNumber(mySuppliersToReview.length)} tone="warn" icon={<IconSuppliers className="w-4 h-4" />} description="Este mes" to="#proveedores" />
        <KpiCard title="Con sobrestock" value={formatNumber(overstockProducts.length)} tone="warn" icon={<IconBox className="w-4 h-4" />} description="Capital inmovilizado" to="#sobrestock" />
      </div>

      {/* Todas mis tareas */}
      <Card className="mb-5">
        <CardHeader title="Todas mis tareas" description="Ordenadas por urgencia. Empieza por arriba." />
        <PriorityGuide steps={tasks} />
      </Card>

      {/* Riesgo de quiebre */}
      <div id="riesgo" className="mb-5">
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="text-sm font-semibold text-slate-800">Mis productos en riesgo de quiebre</h3>
          <Link to="/reposicion" className="text-xs font-medium text-brand-600 hover:text-brand-700">Ver reposición</Link>
        </div>
        <HelpNote className="mb-3">
          La <b>fecha de quiebre</b> estima cuándo te quedas sin stock según la venta reciente. La{" "}
          <b>compra sugerida</b> indica cuántas unidades comprar y para cuántos días de cobertura, considerando
          el lead time del proveedor.
        </HelpNote>
        <Card>
          <DataTable
            columns={riskColumns}
            data={riskRows}
            rowKey={(r) => r.product.sku}
            onRowClick={(r) => navigate(`/productos/${r.product.sku}`)}
            rowClassName={(r) => (r.product.availableStock <= 0 ? "bg-rose-50/40" : undefined)}
            emptyMessage="No tienes productos en riesgo de quiebre. ¡Bien!"
          />
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        {/* OC sin recibir */}
        <div id="ordenes">
          <h3 className="text-sm font-semibold text-slate-800 mb-2.5">Órdenes de compra sin recibir</h3>
          <Card>
            <CardBody className="space-y-2">
              {myOpenOrders.length === 0 ? (
                <EmptyState icon={<IconCheck className="w-6 h-6" />} title="Sin órdenes pendientes" description="No tienes mercadería por recibir." />
              ) : (
                myOpenOrders
                  .sort((a, b) => b.delayedDays - a.delayedDays)
                  .map((o) => (
                    <Link key={o.id} to="/ordenes-compra" className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 hover:border-brand-300 hover:bg-brand-50/40">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800">{o.number}</p>
                        <p className="text-xs text-slate-500 truncate">{o.supplierName} · espera {formatDate(o.expectedDate)}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {o.delayedDays > 0 && <Badge tone="red">{o.delayedDays} d atraso</Badge>}
                        <StatusBadge kind="purchaseOrder" value={o.status} dot={false} />
                      </div>
                    </Link>
                  ))
              )}
            </CardBody>
          </Card>
        </div>

        {/* Proveedores por revisar */}
        <div id="proveedores">
          <h3 className="text-sm font-semibold text-slate-800 mb-2.5">Proveedores por revisar este mes</h3>
          <Card>
            <CardBody className="space-y-2">
              {mySuppliersToReview.length === 0 ? (
                <EmptyState icon={<IconCheck className="w-6 h-6" />} title="Proveedores al día" description="Ninguno de tus proveedores requiere revisión ahora." />
              ) : (
                mySuppliersToReview
                  .sort((a, b) => a.deliveryCompliance - b.deliveryCompliance)
                  .map((s) => (
                    <Link key={s.id} to="/proveedores" className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 hover:border-brand-300 hover:bg-brand-50/40">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{s.name}</p>
                        <p className="text-xs text-slate-500">Cumple {s.deliveryCompliance}% · última compra {formatDate(s.lastPurchaseDate)}</p>
                      </div>
                      <StatusBadge kind="supplier" value={s.status} dot={false} />
                    </Link>
                  ))
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Sobrestock */}
      <div id="sobrestock">
        <h3 className="text-sm font-semibold text-slate-800 mb-2.5">Mi inventario con sobrestock</h3>
        <Card>
          <CardBody className="space-y-2">
            {overstockProducts.length === 0 ? (
              <EmptyState icon={<IconCheck className="w-6 h-6" />} title="Sin sobrestock" description="No tienes capital inmovilizado relevante." />
            ) : (
              overstockProducts
                .sort((a, b) => b.availableStock * b.cost - a.availableStock * a.cost)
                .map((p) => (
                  <Link key={p.sku} to={`/productos/${p.sku}`} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 hover:border-brand-300 hover:bg-brand-50/40">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
                      <p className="text-xs text-slate-500">Disp. {formatNumber(p.availableStock)} · {formatNumber(p.inventoryDays)} días inv.</p>
                    </div>
                    <span className="text-sm font-semibold text-violet-600 flex-shrink-0">{formatCurrencyCompact(p.availableStock * p.cost)}</span>
                  </Link>
                ))
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
