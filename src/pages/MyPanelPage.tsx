import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { KpiCard } from "../components/business/KpiCard";
import { DataTable, type Column } from "../components/ui/Table";
import { Tabs } from "../components/ui/Tabs";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
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
import { useSignals } from "../context/SignalsContext";
import {
  SIGNAL_TYPE,
  SIGNAL_STATUS,
  SIGNAL_PRIORITY,
} from "../components/business/signalLabels";
import { IconSignal } from "../components/ui/icons";
import {
  coverageDays,
  coverageSentence,
  estimatedStockoutDate,
  calculateSuggestedPurchase,
  addDaysISO,
} from "../utils/calculations";
import { TODAY_ISO } from "../utils/constants";
import { useState } from "react";
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
  const { signals } = useSignals();

  // Señales de ventas que me tocan: asignadas a mí, o de mis categorías sin asignar.
  const mySignals = useMemo(() => {
    const order = { high: 0, medium: 1, low: 2 } as const;
    return signals
      .filter(
        (s) =>
          (s.status === "new" || s.status === "in_review") &&
          (s.assignedBuyer === buyer ||
            (!s.assignedBuyer && myCategories.includes(s.category)))
      )
      .sort((a, b) => {
        const p = order[a.priority] - order[b.priority];
        return p !== 0 ? p : a.date < b.date ? 1 : -1;
      })
      .slice(0, 5);
  }, [signals, buyer, myCategories]);
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

  // ---- Agenda por horizonte de tiempo ----
  const [horizon, setHorizon] = useState<"hoy" | "semana" | "mes" | "trimestre">("hoy");
  const daysTo = (iso: string) =>
    Math.round((new Date(`${iso}T00:00:00`).getTime() - new Date(`${TODAY_ISO}T00:00:00`).getTime()) / 86400000);

  interface AgendaItem {
    id: string;
    dueDate: string;
    days: number;
    kind: string;
    title: string;
    detail: string;
    to: string;
    tone: "red" | "amber" | "violet" | "blue";
  }

  const agenda: AgendaItem[] = [];
  riskRows.forEach((r) => {
    const due = r.product.availableStock <= 0 ? TODAY_ISO : r.stockoutDate ?? TODAY_ISO;
    agenda.push({
      id: `q-${r.product.sku}`,
      dueDate: due,
      days: Math.max(daysTo(due), r.product.availableStock <= 0 ? -1 : daysTo(due)),
      kind: "Quiebre",
      title: r.product.name,
      detail: `Riesgo de quiebre · comprar ${formatNumber(r.suggestedQty)} u.`,
      to: `/productos/${r.product.sku}`,
      tone: "red",
    });
  });
  myOpenOrders.forEach((o) => {
    agenda.push({
      id: `oc-${o.id}`,
      dueDate: o.expectedDate,
      days: daysTo(o.expectedDate),
      kind: "OC",
      title: o.number,
      detail: `${o.supplierName} · ${o.delayedDays > 0 ? `atrasada ${o.delayedDays} d` : "por recibir"}`,
      to: "/ordenes-compra",
      tone: o.delayedDays > 0 ? "red" : "amber",
    });
  });
  mySuppliersToReview.forEach((s) => {
    const add = s.status === "delayed" ? 0 : s.status === "review" ? 14 : 30;
    const due = addDaysISO(TODAY_ISO, add);
    agenda.push({
      id: `prov-${s.id}`,
      dueDate: due,
      days: daysTo(due),
      kind: "Proveedor",
      title: s.name,
      detail: `Revisar proveedor · cumple ${s.deliveryCompliance}%`,
      to: "/proveedores",
      tone: "amber",
    });
  });
  overstockProducts.forEach((p) => {
    const due = addDaysISO(TODAY_ISO, 30);
    agenda.push({
      id: `over-${p.sku}`,
      dueDate: due,
      days: daysTo(due),
      kind: "Sobrestock",
      title: p.name,
      detail: `Sobrestock · ${formatCurrencyCompact(p.availableStock * p.cost)} inmovilizado`,
      to: `/productos/${p.sku}`,
      tone: "violet",
    });
  });

  const horizonMax = { hoy: 0, semana: 7, mes: 30, trimestre: 90 };
  const agendaCounts = {
    hoy: agenda.filter((a) => a.days <= 0).length,
    semana: agenda.filter((a) => a.days <= 7).length,
    mes: agenda.filter((a) => a.days <= 30).length,
    trimestre: agenda.filter((a) => a.days <= 90).length,
  };
  const agendaItems = agenda
    .filter((a) => a.days <= horizonMax[horizon])
    .sort((a, b) => a.days - b.days);

  const handleAdd = (p: Product, qty: number) => {
    addItem({
      sku: p.sku,
      productName: p.name,
      supplierName: p.supplierName,
      quantity: qty,
      unitCost: p.cost,
    });
    toast.success(`${p.name} agregado al borrador de OC`, { label: "Ver borrador OC", onClick: () => navigate("/ordenes-compra") });
  };

  // Acción recomendada del día (lo más urgente) + resumen compacto
  const topRisk = riskRows[0];
  const quiebresHoy = riskRows.filter((r) => r.product.availableStock <= 0).length;
  const ocPorLlegar = myOpenOrders.length;
  const criticalActions = quiebresHoy + myDelayedPOs.length + mySuppliersToReview.filter((s) => s.status === "delayed").length;

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
          <span className="text-xs font-mono text-slate-500">{p.sku}</span>
          <p className="font-medium text-slate-800 leading-snug">{p.name}</p>
          <p className="text-xs text-slate-500">{p.category} · {p.supplierName || "Sin proveedor"}</p>
          <p className="text-xs mt-0.5 leading-snug text-rose-600">
            {coverageSentence(p.availableStock, p.salesLast30Days)}
          </p>
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
          <p className="text-xs text-slate-500">
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
          <p className="text-xs text-slate-500">para ~{formatDays(r.coverageAfter)}</p>
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
        title={`Mi jornada de compras · ${buyer}`}
        description={criticalActions > 0 ? `Hoy tienes ${criticalActions} acción${criticalActions === 1 ? "" : "es"} crítica${criticalActions === 1 ? "" : "s"}.` : "Sin acciones críticas para hoy."}
        action={
          <Button variant="secondary" onClick={() => navigate("/reposicion")} icon={<IconReplenish className="w-4 h-4" />}>
            Ir a reposición
          </Button>
        }
      />

      {/* Resumen compacto del día (chips cliqueables) */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 mb-3 pb-0.5">
        <Chip tone="red" label={`${quiebresHoy} quiebres hoy`} onClick={() => { setHorizon("hoy"); }} />
        <Chip tone="amber" label={`${riskRows.length} en riesgo`} to="#riesgo" />
        <Chip tone="blue" label={`${ocPorLlegar} OC sin recibir`} to="#ordenes" />
        <Chip tone="amber" label={`${mySuppliersToReview.length} proveedores`} to="#proveedores" />
        <Chip tone="violet" label={`${overstockProducts.length} sobrestock`} to="#sobrestock" />
      </div>

      {/* Acción recomendada hoy */}
      {topRisk && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-600 mb-1">Acción recomendada hoy</p>
          <p className="text-lg font-semibold text-slate-900">
            Comprar {formatNumber(topRisk.suggestedQty)} u. de {topRisk.product.name}
          </p>
          <p className="text-sm text-slate-600 mt-0.5">
            {topRisk.product.availableStock <= 0 ? "Quiebre hoy" : `Quiebre estimado ${formatDate(topRisk.stockoutDate ?? "")}`} · stock {formatNumber(topRisk.product.availableStock)} u. · lead time proveedor {formatDays(topRisk.product.supplierLeadTimeDays)} · cubre ~{formatDays(topRisk.coverageAfter)}
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <Button
              size="sm"
              disabled={hasItem(topRisk.product.sku)}
              variant={hasItem(topRisk.product.sku) ? "secondary" : "primary"}
              onClick={() => handleAdd(topRisk.product, topRisk.suggestedQty)}
              icon={hasItem(topRisk.product.sku) ? <IconCheck className="w-3.5 h-3.5" /> : <IconPlus className="w-3.5 h-3.5" />}
            >
              {hasItem(topRisk.product.sku) ? "En OC" : "Crear OC"}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => navigate(`/productos/${topRisk.product.sku}`)}>Revisar SKU</Button>
            <Button size="sm" variant="ghost" onClick={() => navigate("/reposicion?foco=urgent")}>Ver reposición</Button>
          </div>
        </div>
      )}

      {/* Agenda por horizonte: qué revisar hoy / semana / mes / 3 meses */}
      <Card className="mb-4">
        <CardHeader title="Qué tengo que ver" description="Tus pendientes ordenados por cuándo vencen. Empieza por hoy." />
        <div className="px-4 pt-1">
          <Tabs
            value={horizon}
            onChange={(v) => setHorizon(v as typeof horizon)}
            tabs={[
              { value: "hoy", label: "Hoy / vencido", count: agendaCounts.hoy },
              { value: "semana", label: "Esta semana", count: agendaCounts.semana },
              { value: "mes", label: "Este mes", count: agendaCounts.mes },
              { value: "trimestre", label: "Próx. 3 meses", count: agendaCounts.trimestre },
            ]}
          />
        </div>
        <CardBody>
          {agendaItems.length === 0 ? (
            <EmptyState
              icon={<IconCheck className="w-6 h-6" />}
              title="Nada pendiente en este plazo"
              description="No tienes tareas para este horizonte. Revisa un plazo más amplio."
            />
          ) : (
            <div className="space-y-1.5">
              {agendaItems.map((a) => {
                const toneClass = a.tone === "red" ? "bg-rose-500" : a.tone === "amber" ? "bg-amber-500" : a.tone === "violet" ? "bg-violet-500" : "bg-brand-500";
                const when = a.days < 0 ? `vencido ${Math.abs(a.days)}d` : a.days === 0 ? "hoy" : `en ${a.days}d`;
                return (
                  <Link
                    key={a.id}
                    to={a.to}
                    className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 hover:border-brand-300 hover:bg-brand-50/40"
                  >
                    <span className={`w-1.5 h-8 rounded-full flex-shrink-0 ${toneClass}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge tone="neutral">{a.kind}</Badge>
                        <span className="text-sm font-medium text-slate-800 truncate">{a.title}</span>
                      </div>
                      <p className="text-xs text-slate-500 truncate">{a.detail}</p>
                    </div>
                    <span className={`text-xs font-medium flex-shrink-0 ${a.days <= 0 ? "text-rose-600" : "text-slate-500"}`}>
                      {when}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>

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

      {/* Señales de ventas para mí */}
      <Card className="mb-4">
        <CardHeader
          title="Señales de ventas para mí"
          description="Lo que ventas reportó en tus categorías y aún espera tu decisión"
          action={
            <Link to="/senales-ventas" className="text-xs font-medium text-brand-600 hover:text-brand-700">
              Ver todas
            </Link>
          }
        />
        <CardBody>
          {mySignals.length === 0 ? (
            <p className="text-sm text-slate-500">
              No tienes señales de ventas pendientes. Todo al día por aquí.
            </p>
          ) : (
            <div className="space-y-2">
              {mySignals.map((s) => (
                <Link
                  key={s.id}
                  to="/senales-ventas"
                  className="flex items-start gap-2 rounded-lg border border-slate-200 p-2.5 hover:border-brand-300 hover:bg-brand-50/40"
                >
                  <IconSignal className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge tone={SIGNAL_PRIORITY[s.priority].tone}>{SIGNAL_PRIORITY[s.priority].label}</Badge>
                      <Badge tone={SIGNAL_TYPE[s.type].tone}>{SIGNAL_TYPE[s.type].short}</Badge>
                      <span className="text-sm font-medium text-slate-800 truncate">{s.productName}</span>
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">{s.comment}</p>
                  </div>
                  <Badge tone={SIGNAL_STATUS[s.status].tone} dot>{SIGNAL_STATUS[s.status].label}</Badge>
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

      {/* Bloque inferior en 2 columnas (escritorio aprovecha el ancho) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 space-y-5">
      {/* Riesgo de quiebre */}
      <div id="riesgo">
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="text-sm font-semibold text-slate-800">Mis productos en riesgo de quiebre</h3>
          <Link to="/reposicion" className="text-xs font-medium text-brand-600 hover:text-brand-700">Ver reposición</Link>
        </div>
        <Card>
          <DataTable
            columns={riskColumns}
            data={riskRows}
            rowKey={(r) => r.product.sku}
            onRowClick={(r) => navigate(`/productos/${r.product.sku}`)}
            rowClassName={(r) => (r.product.availableStock <= 0 ? "bg-rose-50/40" : undefined)}
            emptyMessage="No tienes productos en riesgo de quiebre. ¡Bien!"
            mobileCard={(r) => (
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-xs font-mono text-slate-500">{r.product.sku}</span>
                    <p className="font-medium text-slate-800 leading-snug">{r.product.name}</p>
                    <p className="text-xs text-slate-500">{r.product.category} · {r.product.supplierName || "Sin proveedor"}</p>
                    <p className="text-xs mt-0.5 leading-snug text-rose-600 font-medium">
                      {coverageSentence(r.product.availableStock, r.product.salesLast30Days)}
                    </p>
                  </div>
                  <Badge tone="red" dot>{r.product.availableStock <= 0 ? "Quiebre" : "Riesgo"}</Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2 text-sm">
                  <div><p className="text-xs text-slate-500">Stock</p><p className={r.product.availableStock <= 0 ? "text-rose-600 font-semibold" : "text-slate-700"}>{formatNumber(r.product.availableStock)}</p></div>
                  <div><p className="text-xs text-slate-500">Quiebre</p><p className="text-slate-700">{r.product.availableStock <= 0 ? "hoy" : formatDate(r.stockoutDate ?? "")}</p></div>
                  <div><p className="text-xs text-slate-500">Comprar</p><p className="font-semibold text-slate-900">{formatNumber(r.suggestedQty)} u.</p></div>
                </div>
                <p className="text-xs text-slate-500 mt-1">Cubre ~{formatDays(r.coverageAfter)} · lead {formatDays(r.product.supplierLeadTimeDays)}</p>
                <Button
                  size="sm"
                  className="mt-2 w-full"
                  variant={hasItem(r.product.sku) ? "secondary" : "primary"}
                  disabled={hasItem(r.product.sku) || r.suggestedQty <= 0}
                  onClick={(e) => { e.stopPropagation(); handleAdd(r.product, r.suggestedQty); }}
                  icon={hasItem(r.product.sku) ? <IconCheck className="w-3.5 h-3.5" /> : <IconPlus className="w-3.5 h-3.5" />}
                >
                  {hasItem(r.product.sku) ? "En OC" : "Agregar a OC"}
                </Button>
              </div>
            )}
          />
        </Card>
      </div>

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
      </div>{/* fin columna izquierda */}

      <div className="space-y-5">
        {/* Proveedores por revisar */}
        <div id="proveedores">
          <h3 className="text-sm font-semibold text-slate-800 mb-2.5">Proveedores por revisar</h3>
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
      </div>{/* fin columna derecha */}
      </div>{/* fin grid 2 columnas */}
    </div>
  );
}

function Chip({
  label,
  tone,
  to,
  onClick,
}: {
  label: string;
  tone: "red" | "amber" | "blue" | "violet";
  to?: string;
  onClick?: () => void;
}) {
  const toneClass = {
    red: "bg-rose-50 text-rose-700 border-rose-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    blue: "bg-brand-50 text-brand-700 border-brand-200",
    violet: "bg-violet-50 text-violet-700 border-violet-200",
  }[tone];
  const cls = `whitespace-nowrap flex-shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium ${toneClass}`;
  if (to) return <a href={to} className={cls}>{label}</a>;
  return <button onClick={onClick} className={cls}>{label}</button>;
}
