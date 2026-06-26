import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { DataTable, type Column } from "../components/ui/Table";
import { StatusBadge } from "../components/business/StatusBadge";
import { Tabs } from "../components/ui/Tabs";
import { Button } from "../components/ui/Button";
import { Drawer } from "../components/ui/Drawer";
import { Modal } from "../components/ui/Modal";
import { Input } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { KpiCard } from "../components/business/KpiCard";
import { HelpNote } from "../components/business/HelpNote";
import { IconPlus, IconReplenish, IconOrders } from "../components/ui/icons";
import { purchaseOrders as seedPOs } from "../data/mockPurchaseOrders";
import { recommendations } from "../data/mockRecommendations";
import { getProductBySku } from "../data/mockProducts";
import { purchaseRules, resolveRuleForProduct } from "../data/mockRules";
import { useOcDraft } from "../context/OcDraftContext";
import { useToast } from "../context/ToastContext";
import { usePurchaseFlow } from "../context/PurchaseFlowContext";
import { coverageDays } from "../utils/calculations";
import { TODAY_ISO } from "../utils/constants";
import type { ApprovalCriterion } from "../data/mockApprovals";
import { useLocalStorage } from "../utils/useLocalStorage";
import {
  formatCurrency,
  formatCurrencyCompact,
  formatDate,
  formatNumber,
} from "../utils/formatters";
import type { PurchaseOrder, PurchaseOrderStatus } from "../types/purchasing";

const TABS = [
  { value: "all", label: "Todas" },
  { value: "draft", label: "Borradores" },
  { value: "open", label: "En curso" },
  { value: "delayed", label: "Atrasadas" },
  { value: "received", label: "Recibidas" },
];

export function PurchaseOrdersPage() {
  const navigate = useNavigate();
  const { items, count, totalAmount, updateQuantity, removeItem, clear, addItem, hasItem } = useOcDraft();
  const toast = useToast();
  const { addApproval, addDecision, approvals, approvalState } = usePurchaseFlow();

  // Persistente: órdenes creadas por el usuario + cambios de estado sobre las semilla
  const [createdOrders, setCreatedOrders] = useLocalStorage<PurchaseOrder[]>(
    "compras:po-created",
    []
  );
  const [statusOverrides, setStatusOverrides] = useLocalStorage<
    Record<string, PurchaseOrderStatus>
  >("compras:po-status", {});

  const [tab, setTab] = useState("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detail, setDetail] = useState<PurchaseOrder | null>(null);
  const [createdNumber, setCreatedNumber] = useState<string | null>(null);

  // Estado derivado de aprobación: una OC "por aprobar" pasa a "aprobada" cuando
  // todas sus líneas con solicitud quedan aprobadas (mismo número en el id APR-).
  const approvalDerivedStatus = (o: PurchaseOrder): PurchaseOrderStatus => {
    if (o.status !== "pending_approval") return o.status;
    const linked = approvals.filter((a) => a.id.startsWith(`APR-${o.number}-`));
    if (linked.length === 0) return o.status;
    const states = linked.map((a) => approvalState[a.id] ?? "pendiente");
    if (states.every((s) => s === "aprobada")) return "approved";
    return "pending_approval";
  };

  const orders = useMemo<PurchaseOrder[]>(() => {
    const apply = (o: PurchaseOrder) => {
      if (statusOverrides[o.id]) return { ...o, status: statusOverrides[o.id] };
      const derived = approvalDerivedStatus(o);
      return derived !== o.status ? { ...o, status: derived } : o;
    };
    return [...createdOrders.map(apply), ...seedPOs.map(apply)];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createdOrders, statusOverrides, approvals, approvalState]);

  const counts = useMemo(() => {
    const open: PurchaseOrderStatus[] = ["sent", "confirmed", "partially_received", "with_difference"];
    return {
      all: orders.length,
      draft: orders.filter((o) => o.status === "draft").length,
      open: orders.filter((o) => open.includes(o.status)).length,
      delayed: orders.filter((o) => o.status === "delayed").length,
      received: orders.filter((o) => o.status === "received" || o.status === "closed").length,
    };
  }, [orders]);

  const filtered = useMemo(() => {
    const open: PurchaseOrderStatus[] = ["sent", "confirmed", "partially_received", "with_difference"];
    switch (tab) {
      case "draft":
        return orders.filter((o) => o.status === "draft");
      case "open":
        return orders.filter((o) => open.includes(o.status));
      case "delayed":
        return orders.filter((o) => o.status === "delayed");
      case "received":
        return orders.filter((o) => o.status === "received" || o.status === "closed");
      default:
        return orders;
    }
  }, [orders, tab]);

  const totalOpenAmount = orders
    .filter((o) => !["received", "cancelled"].includes(o.status))
    .reduce((a, o) => a + o.totalAmount, 0);
  const delayedCount = orders.filter((o) => o.status === "delayed").length;
  const draftCount = orders.filter((o) => o.status === "draft").length;

  const markAsSent = (id: string) => {
    setStatusOverrides((prev) => ({ ...prev, [id]: "sent" }));
    setDetail(null);
    toast.success("Orden de compra marcada como enviada");
  };

  // Sugerencias que aún no están en el borrador
  const pendingSuggestions = recommendations.filter(
    (r) => r.suggestedQuantity > 0 && !hasItem(r.sku)
  );

  const createOrder = () => {
    if (count === 0) return;
    const num = `OC-2026-${String(143 + createdOrders.length).padStart(4, "0")}`;
    const buyerName = "Catalina Saavedra";

    // Cerrar el ciclo: por cada línea, evaluar desvío vs sugerido y criterio.
    let approvalsCreated = 0;
    items.forEach((i, idx) => {
      const rec = recommendations.find((r) => r.sku === i.sku);
      const p = getProductBySku(i.sku);
      const suggested = rec?.suggestedQuantity ?? i.quantity;
      const diff = i.quantity - suggested;
      const diffPct = suggested > 0 ? Math.abs(diff / suggested) : i.quantity > 0 ? 1 : 0;

      const rule = p ? resolveRuleForProduct(p, purchaseRules) : null;
      const objetivo = rule?.targetInventoryDays ?? 45;
      const coverAfter = p && p.salesLast30Days > 0 ? coverageDays(p.availableStock + i.quantity, p.salesLast30Days) : 0;
      const margin = p ? p.margin : 100;
      const minMargin = rule?.minMargin ?? 0;
      const lineAmount = i.quantity * i.unitCost;

      const criteria: ApprovalCriterion[] = [];
      if (suggested === 0 || diffPct > 0.2) criteria.push("desvio_sugerido");
      if (lineAmount >= 5000000) criteria.push("monto_alto");
      if (coverAfter > objetivo * 1.3) criteria.push("cobertura_excesiva");
      if (margin < minMargin) criteria.push("margen_bajo");

      addDecision({
        id: `DEC-${num}-${idx}`,
        date: TODAY_ISO,
        sku: i.sku,
        productName: i.productName,
        supplierName: i.supplierName,
        buyerName,
        approvedBy: criteria.length > 0 ? "Pendiente" : "—",
        suggestedQty: suggested,
        purchasedQty: i.quantity,
        unitCost: i.unitCost,
        reason: criteria.length > 0 ? `Desvío vs sugerido en ${num}` : `Compra alineada al sugerido (${num})`,
        resultDays: 0,
        outcome: "pendiente",
        resultText: `Compra recién creada en ${num}. Resultado en medición.`,
        learning: "—",
      });

      if (criteria.length > 0) {
        approvalsCreated++;
        addApproval({
          id: `APR-${num}-${idx}`,
          date: TODAY_ISO,
          sku: i.sku,
          productName: i.productName,
          supplierName: i.supplierName,
          buyerName,
          suggestedQty: suggested,
          requestedQty: i.quantity,
          unitCost: i.unitCost,
          amount: lineAmount,
          coberturaResultante: Math.round(coverAfter),
          coberturaObjetivo: objetivo,
          margin: Math.round(margin),
          minMargin,
          criteria,
          justification: "Pendiente de justificar por el comprador",
        });
      }
    });

    const newOrder: PurchaseOrder = {
      id: `PO-${num}`,
      number: num,
      supplierName: items[0]?.supplierName || "Varios proveedores",
      createdAt: TODAY_ISO,
      expectedDate: "2026-07-05",
      status: approvalsCreated > 0 ? "pending_approval" : "draft",
      totalAmount,
      skuCount: count,
      destinationWarehouse: "Centro de Distribución",
      buyerName,
      delayedDays: 0,
      lines: items.map((i) => ({ sku: i.sku, productName: i.productName, quantity: i.quantity, unitCost: i.unitCost })),
    };
    setCreatedOrders((prev) => [newOrder, ...prev]);

    setCreatedNumber(num);
    clear();
    setDrawerOpen(false);
    setTab("draft");
    toast.success(
      `Borrador ${num} creado con ${newOrder.skuCount} producto${newOrder.skuCount === 1 ? "" : "s"}` +
        (approvalsCreated > 0 ? ` · ${approvalsCreated} requiere${approvalsCreated === 1 ? "" : "n"} aprobación` : ""),
      approvalsCreated > 0 ? { label: "Ver aprobaciones", onClick: () => navigate("/aprobaciones") } : undefined
    );
  };

  const columns: Column<PurchaseOrder>[] = [
    {
      key: "number",
      header: "N° OC",
      render: (o) => (
        <div>
          <p className="font-medium text-slate-800">{o.number}</p>
          <p className="text-xs text-slate-400">{o.buyerName}</p>
        </div>
      ),
    },
    { key: "supplier", header: "Proveedor", render: (o) => <span className="text-sm text-slate-700">{o.supplierName}</span> },
    {
      key: "dates",
      header: "Creación / Esperada",
      hideOnMobile: true,
      render: (o) => (
        <div className="text-sm">
          <p className="text-slate-700">{formatDate(o.createdAt)}</p>
          <p className="text-xs text-slate-400">espera {formatDate(o.expectedDate)}</p>
        </div>
      ),
    },
    { key: "skus", header: "SKUs", align: "right", hideOnMobile: true, render: (o) => formatNumber(o.skuCount) },
    { key: "warehouse", header: "Bodega destino", hideOnMobile: true, render: (o) => <span className="text-sm text-slate-600">{o.destinationWarehouse}</span> },
    {
      key: "amount",
      header: "Monto total",
      align: "right",
      render: (o) => <span className="font-semibold text-slate-900">{formatCurrency(o.totalAmount)}</span>,
    },
    {
      key: "delay",
      header: "Atraso",
      align: "center",
      render: (o) => (o.delayedDays > 0 ? <Badge tone="red">{o.delayedDays} d</Badge> : <span className="text-slate-300">—</span>),
    },
    { key: "status", header: "Estado", render: (o) => <StatusBadge kind="purchaseOrder" value={o.status} /> },
    {
      key: "actions",
      header: "",
      render: (o) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setDetail(o);
          }}
          className="text-xs font-medium text-brand-600 hover:text-brand-700"
        >
          Ver detalle
        </button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Órdenes de compra"
        description="Seguimiento de OC y creación desde sugerencias."
        action={
          <Button onClick={() => setDrawerOpen(true)} icon={<IconPlus className="w-4 h-4" />}>
            Crear OC desde sugerencias
            {count > 0 && (
              <span className="ml-1 rounded-full bg-white/20 px-1.5 text-xs">{count}</span>
            )}
          </Button>
        }
      />

      {createdNumber && (
        <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-sm text-emerald-800">
            Borrador <span className="font-semibold">{createdNumber}</span> creado correctamente. Puedes revisarlo en la pestaña Borradores.
          </p>
          <button onClick={() => setCreatedNumber(null)} className="text-xs font-medium text-emerald-700 hover:text-emerald-900">
            Cerrar
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiCard title="Monto en curso" value={formatCurrencyCompact(totalOpenAmount)} tone="info" icon={<IconOrders className="w-4 h-4" />} description="Ver en curso" active={tab === "open"} onClick={() => setTab("open")} />
        <KpiCard title="Atrasadas" value={formatNumber(delayedCount)} tone="bad" icon={<IconReplenish className="w-4 h-4" />} description="Ver atrasadas" active={tab === "delayed"} onClick={() => setTab("delayed")} />
        <KpiCard title="Borradores" value={formatNumber(draftCount)} tone="warn" icon={<IconPlus className="w-4 h-4" />} description="Ver borradores" active={tab === "draft"} onClick={() => setTab("draft")} />
        <KpiCard title="Total OC" value={formatNumber(orders.length)} tone="neutral" icon={<IconOrders className="w-4 h-4" />} description="Ver todas" active={tab === "all"} onClick={() => setTab("all")} />
      </div>

      <HelpNote className="mb-4">
        Una OC pasa por: <b>borrador → enviada → confirmada → recibida</b>. Las <b>atrasadas</b> (rojo)
        superaron su fecha esperada y pueden provocar quiebre: priorízalas. Crea nuevas OC desde las
        sugerencias de reposición con el botón de arriba.
      </HelpNote>

      <div className="mb-3">
        <Tabs
          tabs={TABS.map((t) => ({ ...t, count: counts[t.value as keyof typeof counts] }))}
          value={tab}
          onChange={setTab}
        />
      </div>

      <Card>
        <DataTable
          columns={columns}
          data={filtered}
          rowKey={(o) => o.id}
          onRowClick={(o) => setDetail(o)}
          rowClassName={(o) => (o.status === "delayed" ? "bg-rose-50/40" : undefined)}
          emptyMessage={
            tab === "delayed"
              ? "No hay órdenes de compra atrasadas. Todas están dentro de su fecha esperada de entrega."
              : tab === "draft"
              ? "No tienes borradores. Crea uno desde las sugerencias de reposición."
              : "No hay órdenes de compra en esta vista."
          }
        />
      </Card>

      {/* Drawer crear OC desde sugerencias */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Crear OC desde sugerencias"
        description="Revisa los productos del borrador, ajusta cantidades y genera la orden."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDrawerOpen(false)}>
              Cerrar
            </Button>
            <Button onClick={createOrder} disabled={count === 0}>
              Crear borrador ({formatCurrency(totalAmount)})
            </Button>
          </>
        }
      >
        {count === 0 ? (
          <EmptyState
            title="El borrador está vacío"
            description="Agrega productos desde la página de Reposición sugerida o desde las sugerencias de abajo."
            action={<Button onClick={() => { setDrawerOpen(false); navigate("/reposicion"); }}>Ir a reposición</Button>}
          />
        ) : (
          <div className="space-y-3">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Productos en el borrador ({count})
            </p>
            {items.map((it) => (
              <div key={it.sku} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-xs font-mono text-slate-400">{it.sku}</span>
                    <p className="text-sm font-medium text-slate-800">{it.productName}</p>
                    <p className="text-xs text-slate-500">{it.supplierName}</p>
                  </div>
                  <button onClick={() => removeItem(it.sku)} className="text-xs text-rose-500 hover:text-rose-700">
                    Quitar
                  </button>
                </div>
                <div className="flex items-center justify-between gap-3 mt-2">
                  <div className="w-28">
                    <Input
                      type="number"
                      min={0}
                      value={it.quantity}
                      onChange={(e) => updateQuantity(it.sku, Number(e.target.value))}
                    />
                  </div>
                  <span className="text-sm font-semibold text-slate-900">
                    {formatCurrency(it.quantity * it.unitCost)}
                  </span>
                </div>
              </div>
            ))}
            <div className="flex justify-between items-center rounded-lg bg-slate-50 px-3 py-2.5">
              <span className="text-sm font-medium text-slate-600">Total estimado</span>
              <span className="text-base font-semibold text-slate-900">{formatCurrency(totalAmount)}</span>
            </div>
          </div>
        )}

        {pendingSuggestions.length > 0 && (
          <div className="mt-6">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
              Sugerencias para agregar
            </p>
            <div className="space-y-2">
              {pendingSuggestions.slice(0, 6).map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 p-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{r.productName}</p>
                    <p className="text-xs text-slate-500">
                      {formatNumber(r.suggestedQuantity)} u. · {formatCurrency(r.suggestedPurchaseAmount)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<IconPlus className="w-3.5 h-3.5" />}
                    onClick={() => {
                      addItem({
                        sku: r.sku,
                        productName: r.productName,
                        supplierName: r.supplierName,
                        quantity: r.suggestedQuantity,
                        unitCost: r.unitCost,
                      });
                      toast.success(`${r.productName} agregado al borrador`);
                    }}
                  >
                    Agregar
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </Drawer>

      {/* Modal detalle OC */}
      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.number ?? ""}
        description={detail ? `${detail.supplierName} · ${detail.destinationWarehouse}` : ""}
        footer={
          detail && (
            <>
              <Button variant="secondary" onClick={() => setDetail(null)}>
                Cerrar
              </Button>
              {detail.status === "pending_approval" && (
                <Button variant="primary" onClick={() => navigate("/aprobaciones")}>Ver aprobaciones</Button>
              )}
              {(detail.status === "draft" || detail.status === "approved" || detail.status === "confirmed") && (
                <Button onClick={() => markAsSent(detail.id)}>Marcar como enviada</Button>
              )}
            </>
          )
        }
      >
        {detail && (
          <div className="space-y-4">
            {detail.status === "pending_approval" && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
                ⏳ Esta orden tiene líneas fuera de criterio y <b>requiere aprobación</b> antes de enviarse al proveedor. Apruébalas en Aprobaciones.
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <DetailField label="Estado" value={<StatusBadge kind="purchaseOrder" value={detail.status} />} />
              <DetailField label="Comprador" value={detail.buyerName} />
              <DetailField label="Creación" value={formatDate(detail.createdAt)} />
              <DetailField label="Fecha esperada" value={formatDate(detail.expectedDate)} />
              {detail.confirmedDate && <DetailField label="Confirmada proveedor" value={formatDate(detail.confirmedDate)} />}
              <DetailField label="Monto total" value={<span className="font-semibold">{formatCurrency(detail.totalAmount)}</span>} />
              <DetailField label="N° de SKUs" value={formatNumber(detail.skuCount)} />
              {detail.discountPct != null && <DetailField label="Descuento" value={`${detail.discountPct}%`} />}
              {detail.paymentTerms && <DetailField label="Pago" value={detail.paymentTerms} />}
            </div>

            {detail.comments && (
              <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <span className="text-xs text-slate-400">Comentarios: </span>{detail.comments}
              </div>
            )}
            {detail.documents && detail.documents.length > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">Documentos</p>
                <div className="flex flex-wrap gap-1.5">
                  {detail.documents.map((d) => (
                    <span key={d} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600">📎 {d}</span>
                  ))}
                </div>
              </div>
            )}

            {detail.lines && detail.lines.length > 0 ? (() => {
              const hasReception = detail.lines.some((l) => l.receivedQty != null);
              return (
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                    {hasReception ? "Productos y diferencias de recepción" : "Productos"}
                  </p>
                  <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                    {detail.lines.map((l) => {
                      const diff = l.receivedQty != null ? l.receivedQty - l.quantity : null;
                      return (
                        <div key={l.sku} className="flex items-center justify-between gap-2 px-3 py-2">
                          <div className="min-w-0">
                            <span className="text-xs font-mono text-slate-400">{l.sku}</span>
                            <p className="text-sm text-slate-700 truncate">{l.productName}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            {hasReception ? (
                              <>
                                <p className="text-sm text-slate-700">
                                  Pedido {formatNumber(l.quantity)} · Recibido <b>{formatNumber(l.receivedQty ?? 0)}</b>
                                </p>
                                <p className={`text-xs font-medium ${diff != null && diff < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                                  {diff != null && diff < 0 ? `Faltan ${formatNumber(-diff)}` : "Completo"}
                                </p>
                              </>
                            ) : (
                              <>
                                <p className="text-sm font-medium text-slate-800">{formatNumber(l.quantity)} u.</p>
                                <p className="text-xs text-slate-400">{formatCurrency(l.unitCost)} c/u</p>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })() : (
              <p className="text-sm text-slate-400">
                El detalle de líneas de esta orden no está disponible en la demo.
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <div className="text-sm text-slate-800 mt-0.5">{value}</div>
    </div>
  );
}
