import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { Tabs } from "../components/ui/Tabs";
import { RelatedEntitiesPanel } from "../shared/components/RelatedEntitiesPanel";
import { ActivityTimeline, type ActivityItem } from "../shared/components/ActivityTimeline";
import { relatedEntitiesForProduct } from "../shared/entities";
import { channelMarginsForSku, CHANNEL_LABELS, MARGIN_STATUS } from "../data/mockChannelMargin";
import { KpiCard } from "../components/business/KpiCard";
import { StatusBadge } from "../components/business/StatusBadge";
import { RecommendationBadge } from "../components/business/RecommendationBadge";
import { AlertCard } from "../components/business/AlertCard";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { BarList } from "../components/business/BarList";
import { IconPlus, IconInfo, IconAlerts, IconSignal } from "../components/ui/icons";
import { getProductBySku, products } from "../data/mockProducts";
import { suppliers, getSupplierByName } from "../data/mockSuppliers";
import { supplierFulfillment } from "../utils/supplierPerf";
import { purchaseRules, resolveRuleForProduct } from "../data/mockRules";
import { receptions } from "../data/mockReceptions";
import { skuOptimizationStatus, ACTION_LABEL, TIER_LABEL } from "../utils/catalogOptimization";
import { recommendations } from "../data/mockRecommendations";
import { alerts } from "../data/mockAlerts";
import { signalService } from "../services";
import {
  SIGNAL_TYPE,
  SIGNAL_STATUS,
  SIGNAL_PRIORITY,
  SIGNAL_CHANNEL,
} from "../components/business/signalLabels";
import { purchaseOrders } from "../data/mockPurchaseOrders";
import { useOcDraft } from "../context/OcDraftContext";
import { coverageDays } from "../utils/calculations";
import { IconCheck } from "../components/ui/icons";
import type { Product, PurchaseRecommendation } from "../types/purchasing";
import {
  formatCurrency,
  formatCurrencyCompact,
  formatDate,
  formatDays,
  formatNumber,
  formatPercent,
} from "../utils/formatters";

export function ProductDetailPage() {
  const { sku } = useParams<{ sku: string }>();
  const navigate = useNavigate();
  const { addItem, hasItem } = useOcDraft();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get("tab") ?? "resumen");

  const product = sku ? getProductBySku(sku) : undefined;

  if (!product) {
    return (
      <div className="py-10">
        <EmptyState
          title="Producto no encontrado"
          description={`No existe un SKU "${sku}" en el catálogo.`}
          action={<Button onClick={() => navigate("/productos")}>Volver a productos</Button>}
        />
      </div>
    );
  }

  const rec = recommendations.find((r) => r.sku === product.sku);
  const relatedAlerts = alerts.filter((a) => a.relatedSku === product.sku);
  const productSignals = signalService.bySku(product.sku);
  const relatedPOs = purchaseOrders.filter((o) =>
    o.lines?.some((l) => l.sku === product.sku)
  );

  // Historiales simples (mock)
  const salesHistory = [
    { period: "Junio 2026", units: product.salesLast30Days },
    { period: "Mayo 2026", units: Math.round(product.salesLast90Days / 3) },
    { period: "Abril 2026", units: Math.round((product.salesLast90Days - product.salesLast30Days) / 2.2) },
  ];
  const purchaseHistory = relatedPOs.map((o) => {
    const line = o.lines?.find((l) => l.sku === product.sku);
    return { date: o.createdAt, number: o.number, qty: line?.quantity ?? 0, cost: line?.unitCost ?? product.cost };
  });
  const costHistory = [
    { date: product.costUpdatedAt, cost: product.cost, note: "Costo vigente" },
    { date: "2026-03-15", cost: Math.round(product.cost * 0.94), note: "Lista anterior" },
    { date: "2025-12-01", cost: Math.round(product.cost * 0.89), note: "Lista 2025" },
  ];

  // Entidades relacionadas (conexión con otros módulos)
  const related = relatedEntitiesForProduct(product.sku);

  // Estado en el catálogo optimizado (surtido redundante / a reactivar)
  const optStatus = skuOptimizationStatus(product.sku, products);
  const optLink = optStatus.category
    ? `/catalogo-optimizado?cat=${encodeURIComponent(optStatus.category)}`
    : "/catalogo-optimizado";

  // Margen por canal
  const channelMargin = channelMarginsForSku(product.sku);
  const bestChannel = [...channelMargin].sort((a, b) => b.marginPct - a.marginPct)[0];
  const worstChannel = [...channelMargin].sort((a, b) => a.marginPct - b.marginPct)[0];

  // Actividad / auditoría básica del producto
  const activity: ActivityItem[] = [
    { date: product.costUpdatedAt, title: "Actualización de costo", description: `Costo vigente ${formatCurrency(product.cost)}`, tone: "blue" as const },
    ...purchaseHistory.map((h) => ({
      date: h.date,
      title: `Orden de compra ${h.number}`,
      description: `${formatNumber(h.qty)} unidades a ${formatCurrency(h.cost)} c/u`,
      tone: "neutral" as const,
    })),
    ...relatedAlerts.map((a) => ({
      date: a.date,
      title: "Alerta comercial",
      description: a.description,
      tone: "amber" as const,
    })),
  ].sort((a, b) => (a.date < b.date ? 1 : -1));

  const handleAdd = () => {
    if (!rec) return;
    addItem({
      sku: product.sku,
      productName: product.name,
      supplierName: product.supplierName,
      quantity: rec.suggestedQuantity || product.reorderPoint,
      unitCost: product.cost,
    });
  };

  return (
    <div>
      <PageHeader
        breadcrumbs={[
          { label: "Productos", to: "/productos" },
          { label: product.sku },
        ]}
        title={product.name}
        description={`${product.category} · ${product.subcategory} · ${product.brand}`}
        action={
          rec && rec.suggestedQuantity > 0 ? (
            <Button
              onClick={handleAdd}
              disabled={hasItem(product.sku)}
              variant={hasItem(product.sku) ? "secondary" : "primary"}
              icon={<IconPlus className="w-4 h-4" />}
            >
              {hasItem(product.sku) ? "Agregado a OC" : "Agregar a OC"}
            </Button>
          ) : undefined
        }
      />

      {/* Encabezado: chips */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <span className="text-xs font-mono text-slate-500 bg-slate-100 rounded px-2 py-1">{product.sku}</span>
        <StatusBadge kind="product" value={product.productStatus} />
        <StatusBadge kind="purchase" value={product.purchaseStatus} dot={false} />
        {product.supplierName ? (
          <Link to="/proveedores" className="text-xs text-brand-600 hover:text-brand-700 font-medium">
            Proveedor: {product.supplierName}
          </Link>
        ) : (
          <Badge tone="red">Sin proveedor asignado</Badge>
        )}
        {optStatus.kind === "redundant" && (
          <Link to={optLink} title={`Gama ${TIER_LABEL[optStatus.segment!]} ya cubierta por “${optStatus.leaderName}”`}>
            <Badge tone="amber" dot>Redundante · {ACTION_LABEL[optStatus.action!]}</Badge>
          </Link>
        )}
        {optStatus.kind === "reactivate" && (
          <Link to={optLink} title="Es el mejor de su gama pero está en “no comprar”">
            <Badge tone="amber" dot>Reactivar compra</Badge>
          </Link>
        )}
      </div>

      {/* Decisión recomendada — lo primero que debe ver el comprador */}
      <DecisionBanner
        product={product}
        rec={rec}
        added={hasItem(product.sku)}
        onAdd={handleAdd}
      />

      <Tabs
        className="mb-5"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "resumen", label: "Resumen" },
          { value: "negociacion", label: "Negociación" },
          { value: "margen", label: "Margen por canal", count: channelMargin.length },
          { value: "senales", label: "Señales de ventas", count: productSignals.length },
          { value: "relacionados", label: "Relacionados", count: related.length },
          { value: "actividad", label: "Actividad", count: activity.length },
        ]}
      />

      {tab === "resumen" && (
      <>
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <KpiCard title="Stock total" value={formatNumber(product.totalStock)} tone="neutral" />
        <KpiCard title="Stock disponible" value={formatNumber(product.availableStock)} tone={product.availableStock <= 0 ? "bad" : "good"} description={`${formatNumber(product.committedStock)} comprometido`} />
        <KpiCard title="Venta 30 días" value={formatNumber(product.salesLast30Days)} tone="info" description={`${formatNumber(product.salesLast90Days)} en 90 días`} />
        <KpiCard title="Días de inventario" value={formatNumber(product.inventoryDays)} tone={product.inventoryDays < 7 ? "bad" : product.inventoryDays > 120 ? "warn" : "good"} />
        <KpiCard title="Margen" value={formatPercent(product.margin)} tone={product.margin < 25 ? "warn" : "good"} />
        <KpiCard title="Costo actual" value={formatCurrency(product.cost)} tone="neutral" description={`Actualizado ${formatDate(product.costUpdatedAt)}`} />
        <KpiCard title="Precio venta" value={formatCurrency(product.price)} tone="neutral" />
        <KpiCard title="Cantidad sugerida" value={rec ? `${formatNumber(rec.suggestedQuantity)} u.` : "—"} tone="info" description={rec ? formatCurrency(rec.suggestedPurchaseAmount) : "Sin recomendación activa"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
        {/* Recomendación de compra */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader title="Recomendación de compra" description="Qué hacer con este producto y por qué" />
            <CardBody>
              {rec ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <RecommendationBadge status={rec.status} />
                    <div>
                      <p className="text-2xl font-semibold text-slate-900">
                        {formatNumber(rec.suggestedQuantity)} unidades
                      </p>
                      <p className="text-sm text-slate-500">
                        {formatCurrency(rec.suggestedPurchaseAmount)} · {rec.supplierName} (lead time {rec.supplierLeadTimeDays} días)
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex gap-2.5 rounded-lg border-l-2 border-slate-300 bg-slate-50 px-3 py-2">
                      <IconInfo className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-slate-700">
                        <span className="font-medium text-slate-500">Motivo: </span>
                        {rec.reason}
                      </p>
                    </div>
                    <div className="flex gap-2.5 rounded-lg border-l-2 border-rose-400 bg-rose-50 px-3 py-2">
                      <IconAlerts className="w-4 h-4 text-rose-500 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-slate-700">
                        <span className="font-medium text-rose-600">Riesgo si no compras: </span>
                        {rec.risk}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <MiniStat label="Stock mínimo" value={formatNumber(rec.minStock)} />
                    <MiniStat label="Punto reposición" value={formatNumber(rec.reorderPoint)} />
                    <MiniStat label="Stock máximo" value={formatNumber(rec.maxStock)} />
                  </div>
                </div>
              ) : (
                <EmptyState
                  title="Sin recomendación activa"
                  description="Este producto no tiene una recomendación de compra pendiente. Su stock cubre la venta esperada."
                />
              )}
            </CardBody>
          </Card>
        </div>

        {/* Stock por ubicación */}
        <Card>
          <CardHeader title="Stock por ubicación" description="Disponible vs comprometido" />
          <CardBody className="space-y-3">
            {product.stockByLocation.map((loc) => (
              <div key={loc.locationName}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-slate-700">{loc.locationName}</span>
                  <span className="text-sm font-medium text-slate-900">{formatNumber(loc.stock)}</span>
                </div>
                <div className="flex h-2 rounded-full overflow-hidden bg-slate-100">
                  <div className="bg-emerald-500 h-full" style={{ width: `${(loc.available / Math.max(loc.stock, 1)) * 100}%` }} />
                  <div className="bg-amber-400 h-full" style={{ width: `${(loc.committed / Math.max(loc.stock, 1)) * 100}%` }} />
                </div>
                <div className="flex justify-between text-xs text-slate-400 mt-0.5">
                  <span>Disp. {formatNumber(loc.available)}</span>
                  <span>Comp. {formatNumber(loc.committed)}</span>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
        {/* Historial ventas */}
        <Card>
          <CardHeader title="Últimas ventas" description="Unidades por mes" />
          <CardBody>
            <BarList
              items={salesHistory.map((s) => ({
                label: s.period,
                value: s.units,
                display: `${formatNumber(s.units)} u.`,
                tone: "blue",
              }))}
            />
          </CardBody>
        </Card>

        {/* Historial compras */}
        <Card>
          <CardHeader title="Últimas compras" description="Órdenes con este SKU" />
          <CardBody className="space-y-2">
            {purchaseHistory.length > 0 ? (
              purchaseHistory.map((h) => (
                <div key={h.number} className="flex items-center justify-between text-sm py-1.5 border-b border-slate-50 last:border-0">
                  <div>
                    <p className="font-medium text-slate-700">{h.number}</p>
                    <p className="text-xs text-slate-400">{formatDate(h.date)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-700">{formatNumber(h.qty)} u.</p>
                    <p className="text-xs text-slate-400">{formatCurrency(h.cost)} c/u</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400 py-4 text-center">Sin compras recientes registradas.</p>
            )}
          </CardBody>
        </Card>

        {/* Historial costo */}
        <Card>
          <CardHeader title="Cambios de costo" description="Evolución del costo unitario" />
          <CardBody className="space-y-2">
            {costHistory.map((c, i) => (
              <div key={c.date} className="flex items-center justify-between text-sm py-1.5 border-b border-slate-50 last:border-0">
                <div>
                  <p className="font-medium text-slate-700">{formatCurrency(c.cost)}</p>
                  <p className="text-xs text-slate-400">{c.note}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">{formatDate(c.date)}</p>
                  {i === 0 && <Badge tone="green">Vigente</Badge>}
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Alertas relacionadas */}
        <div>
          <h3 className="text-sm font-semibold text-slate-800 mb-2.5">Alertas relacionadas</h3>
          {relatedAlerts.length > 0 ? (
            <div className="space-y-3">
              {relatedAlerts.map((a) => (
                <AlertCard key={a.id} alert={a} compact />
              ))}
            </div>
          ) : (
            <Card>
              <CardBody>
                <EmptyState title="Sin alertas" description="Este producto no tiene alertas comerciales activas." />
              </CardBody>
            </Card>
          )}
        </div>

        {/* OC relacionadas */}
        <div>
          <h3 className="text-sm font-semibold text-slate-800 mb-2.5">Órdenes de compra relacionadas</h3>
          <Card>
            <CardBody className="space-y-2">
              {relatedPOs.length > 0 ? (
                relatedPOs.map((o) => (
                  <Link
                    key={o.id}
                    to="/ordenes-compra"
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 p-2.5 hover:border-brand-300 hover:bg-brand-50/40"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-800">{o.number}</p>
                      <p className="text-xs text-slate-500">{o.supplierName} · espera {formatDate(o.expectedDate)}</p>
                    </div>
                    <StatusBadge kind="purchaseOrder" value={o.status} dot={false} />
                  </Link>
                ))
              ) : (
                <EmptyState title="Sin órdenes" description="No hay órdenes de compra con este producto." />
              )}
            </CardBody>
          </Card>
        </div>
      </div>
      </>
      )}

      {tab === "negociacion" && <NegotiationPanel product={product} rec={rec} />}

      {tab === "margen" && (
        <Card>
          <CardHeader
            title="Margen por canal"
            description="Precio y margen del mismo SKU en cada canal, con precio sugerido para alcanzar el objetivo"
            action={
              <Link to={`/margen-canal?q=${product.sku}`} className="text-xs font-medium text-brand-600 hover:text-brand-700">
                Ver comparador
              </Link>
            }
          />
          <CardBody>
            {channelMargin.length === 0 ? (
              <EmptyState title="Sin datos de canal" description="Este producto no tiene margen por canal cargado." />
            ) : (
              <>
                {bestChannel && worstChannel && bestChannel.channel !== worstChannel.channel && (
                  <div className="mb-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                    Mejor margen en <b>{CHANNEL_LABELS[bestChannel.channel]}</b> ({formatPercent(bestChannel.marginPct)});
                    el más bajo en <b>{CHANNEL_LABELS[worstChannel.channel]}</b> ({formatPercent(worstChannel.marginPct)}).
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {channelMargin.map((c) => (
                    <div key={c.channel} className="rounded-xl border border-slate-200 p-3">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-sm font-semibold text-slate-800">{CHANNEL_LABELS[c.channel]}</span>
                        <Badge tone={MARGIN_STATUS[c.status].tone} dot>{MARGIN_STATUS[c.status].label}</Badge>
                      </div>
                      <div className="space-y-1 text-sm">
                        <Row label="Precio" value={formatCurrency(c.finalPrice)} />
                        <Row label="Costo" value={formatCurrency(c.cost)} />
                        {c.commission > 0 && <Row label="Comisión" value={formatCurrency(c.commission)} />}
                        {c.discount > 0 && <Row label="Descuento" value={formatCurrency(c.discount)} />}
                        <Row label="Margen" value={formatPercent(c.marginPct)} strong tone={c.marginPct < 0 ? "bad" : c.status === "low" ? "warn" : "good"} />
                        <Row label="Objetivo" value={formatPercent(c.targetMarginPct, 0)} />
                        <Row label="Venta 30d" value={`${formatNumber(c.sales30)} u.`} />
                      </div>
                      {(c.status === "low" || c.status === "negative") && (
                        <div className="mt-2 rounded-lg bg-brand-50 border border-brand-100 px-2.5 py-1.5">
                          <p className="text-xs text-brand-800">Precio sugerido: <b>{formatCurrency(c.suggestedPrice)}</b></p>
                        </div>
                      )}
                      <p className="text-xs text-slate-500 mt-2 leading-snug">{c.cause}</p>
                      <p className="text-xs font-medium text-slate-700 mt-1">Acción: {c.action}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardBody>
        </Card>
      )}

      {tab === "senales" && (
        <Card>
          <CardHeader
            title="Señales de ventas de este producto"
            description="Lo que el equipo de ventas ha reportado desde el terreno sobre este SKU"
            action={
              <Link to="/senales-ventas" className="text-xs font-medium text-brand-600 hover:text-brand-700">
                Ir a Señales de Ventas
              </Link>
            }
          />
          <CardBody>
            {productSignals.length === 0 ? (
              <EmptyState
                icon={<IconSignal className="w-6 h-6" />}
                title="Sin señales de ventas"
                description="El equipo de ventas no ha reportado nada sobre este producto."
              />
            ) : (
              <div className="space-y-2">
                {productSignals.map((s) => (
                  <Link
                    key={s.id}
                    to="/senales-ventas"
                    className="block rounded-lg border border-slate-200 p-3 hover:border-brand-300 hover:bg-brand-50/40"
                  >
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <Badge tone={SIGNAL_PRIORITY[s.priority].tone}>{SIGNAL_PRIORITY[s.priority].label}</Badge>
                      <Badge tone={SIGNAL_TYPE[s.type].tone}>{SIGNAL_TYPE[s.type].short}</Badge>
                      <div className="flex-1" />
                      <Badge tone={SIGNAL_STATUS[s.status].tone} dot>{SIGNAL_STATUS[s.status].label}</Badge>
                    </div>
                    <p className="text-sm text-slate-700">{s.comment}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {s.reportedBy} · {SIGNAL_CHANNEL[s.channel]} · {s.store}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {tab === "relacionados" && (
        <Card>
          <CardHeader title="Entidades relacionadas" description="Conexiones de este producto con otros módulos" />
          <CardBody>
            <RelatedEntitiesPanel entities={related} />
          </CardBody>
        </Card>
      )}

      {tab === "actividad" && (
        <Card>
          <CardHeader title="Actividad del producto" description="Auditoría básica de eventos y cambios" />
          <CardBody>
            <ActivityTimeline items={activity} />
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "good" | "warn" | "bad";
}) {
  const toneClass = tone === "bad" ? "text-rose-600" : tone === "warn" ? "text-amber-600" : tone === "good" ? "text-emerald-600" : "text-slate-700";
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`${strong ? "font-semibold" : ""} ${toneClass}`}>{value}</span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-base font-semibold text-slate-800">{value}</p>
    </div>
  );
}

function NStat({ label, value, tone, sub }: { label: string; value: string; tone?: "good" | "warn" | "bad"; sub?: string }) {
  const c = tone === "bad" ? "text-rose-700" : tone === "warn" ? "text-amber-700" : tone === "good" ? "text-emerald-700" : "text-slate-800";
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2.5">
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`text-lg font-semibold ${c}`}>{value}</p>
      {sub && <p className="text-[11px] text-slate-400 leading-tight">{sub}</p>}
    </div>
  );
}

/**
 * Panel de negociación: reúne lo que el comprador necesita para llegar a la
 * reunión con argumentos — venta, margen, inventario, proveedor, alternativas,
 * objetivos sugeridos y la próxima decisión.
 */
function NegotiationPanel({ product, rec }: { product: Product; rec?: PurchaseRecommendation }) {
  const sales30 = product.salesLast30Days;
  const sales90 = product.salesLast90Days;
  const tendencia = sales90 > 0 ? (sales30 / (sales90 / 3) - 1) * 100 : 0;
  const ranking = [...products].sort((a, b) => b.salesLast30Days - a.salesLast30Days).findIndex((p) => p.sku === product.sku) + 1;

  const rule = resolveRuleForProduct(product, purchaseRules);
  const objetivo = rule.minMargin;
  const brecha = objetivo - product.margin;
  const costoObjetivo = Math.round(product.price * (1 - objetivo / 100));
  const bajaCosto = product.cost > costoObjetivo ? ((product.cost - costoObjetivo) / product.cost) * 100 : 0;

  const enTransito = receptions
    .filter((r) => ["in_transit", "scheduled"].includes(r.status))
    .flatMap((r) => r.items ?? [])
    .filter((it) => it.sku === product.sku)
    .reduce((a, it) => a + Math.max(0, it.expected - it.received), 0);
  const enQuiebre = product.availableStock <= 0 && sales30 > 0;
  const ventaPerdida = enQuiebre ? sales30 * product.price : 0;

  const master = product.supplierName ? getSupplierByName(product.supplierName) : undefined;
  const perf = product.supplierName ? supplierFulfillment(product.supplierName) : null;
  const compraAnual = master ? master.purchasedAmountLast90Days * 4 : 0;

  const alternativas = suppliers.filter((s) => s.name !== product.supplierName && s.status !== "inactive" && s.categories.includes(product.category));

  // Objetivos de negociación sugeridos
  const objetivos: string[] = [];
  if (brecha > 0 && bajaCosto > 0) objetivos.push(`Bajar el costo ~${formatPercent(bajaCosto, 0)} (a ${formatCurrency(costoObjetivo)}) para alcanzar el margen objetivo de ${formatPercent(objetivo, 0)}`);
  if (perf && perf.fillRate < 95) objetivos.push(`Mejorar el fill rate de ${perf.fillRate}% a 95% (despacho completo)`);
  if (master && master.deliveryCompliance < 90) objetivos.push(`Subir cumplimiento de entrega de ${formatPercent(master.deliveryCompliance, 0)} a 95%`);
  if (master && master.averageLeadTimeDays >= 12) objetivos.push(`Reducir lead time (${formatDays(master.averageLeadTimeDays)}) o acordar despacho semanal`);
  if (enQuiebre) objetivos.push("Stock de seguridad o despacho parcial para frenar la venta perdida");
  if (sales30 >= 50) objetivos.push("Bonificación por volumen o rebate por crecimiento");
  objetivos.push("Plazo de pago 60 días o descuento por pronto pago");

  // Próxima decisión sugerida
  const decisiones: { label: string; on: boolean }[] = [
    { label: "Comprar", on: !!rec && rec.suggestedQuantity > 0 && rec.status !== "overstock" },
    { label: "Renegociar costo", on: brecha > 0 },
    { label: "Liquidar", on: product.purchaseStatus === "overstock" },
    { label: "Cambiar proveedor", on: (perf?.fillRate ?? 100) < 80 || (master?.deliveryCompliance ?? 100) < 70 },
    { label: "Pedir campaña", on: tendencia > 15 },
    { label: "Mantener", on: true },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-900">
        <b>Panel de negociación.</b> Todo lo que necesitas para llegar a la reunión con argumentos: cuánto vende, cuánto rinde, qué stock hay, qué tan confiable es el proveedor y qué alternativas tienes.
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Venta */}
        <Card>
          <CardHeader title="Venta y demanda" />
          <CardBody>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <NStat label="Venta 30 días" value={`${formatNumber(sales30)} u.`} />
              <NStat label="Venta 90 días" value={`${formatNumber(sales90)} u.`} />
              <NStat label="Tendencia" value={`${tendencia >= 0 ? "+" : ""}${formatPercent(tendencia, 0)}`} tone={tendencia >= 0 ? "good" : "bad"} sub="30d vs prom. 90d" />
              <NStat label="Ranking" value={`#${ranking}`} sub={`de ${products.length} SKUs`} />
            </div>
          </CardBody>
        </Card>

        {/* Margen */}
        <Card>
          <CardHeader title="Margen y precio" />
          <CardBody>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <NStat label="Precio venta" value={formatCurrency(product.price)} />
              <NStat label="Costo actual" value={formatCurrency(product.cost)} />
              <NStat label="Margen actual" value={formatPercent(product.margin, 0)} tone={product.margin < objetivo ? "warn" : "good"} />
              <NStat label="Margen objetivo" value={formatPercent(objetivo, 0)} sub={brecha > 0 ? `faltan ${formatPercent(brecha, 0)}` : "cumplido"} />
            </div>
            {brecha > 0 && (
              <p className="text-xs text-slate-500 mt-2.5">Para llegar al objetivo, el costo debería bajar ~<b className="text-slate-700">{formatPercent(bajaCosto, 0)}</b> (a {formatCurrency(costoObjetivo)}).</p>
            )}
          </CardBody>
        </Card>

        {/* Inventario */}
        <Card>
          <CardHeader title="Inventario" />
          <CardBody>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <NStat label="Disponible" value={formatNumber(product.availableStock)} tone={product.availableStock <= 0 ? "bad" : undefined} sub={`${formatNumber(product.committedStock)} comprometido`} />
              <NStat label="Días inventario" value={formatNumber(product.inventoryDays)} tone={product.inventoryDays < 7 ? "bad" : product.inventoryDays > 120 ? "warn" : "good"} />
              <NStat label="En tránsito" value={formatNumber(enTransito)} sub="OC por llegar" />
              <NStat label={enQuiebre ? "Venta perdida" : "Estado"} value={enQuiebre ? formatCurrencyCompact(ventaPerdida) : product.purchaseStatus === "overstock" ? "Sobrestock" : "OK"} tone={enQuiebre ? "bad" : product.purchaseStatus === "overstock" ? "warn" : "good"} sub={enQuiebre ? "por quiebre / mes" : undefined} />
            </div>
          </CardBody>
        </Card>

        {/* Proveedor */}
        <Card>
          <CardHeader title={`Proveedor — ${product.supplierName || "sin asignar"}`} />
          <CardBody>
            {master ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <NStat label="Lead time" value={formatDays(master.averageLeadTimeDays)} tone={master.averageLeadTimeDays >= 15 ? "warn" : undefined} />
                <NStat label="Cumplimiento" value={formatPercent(master.deliveryCompliance, 0)} tone={master.deliveryCompliance < 70 ? "bad" : master.deliveryCompliance < 85 ? "warn" : "good"} sub="a tiempo" />
                <NStat label="Fill rate" value={perf ? `${perf.fillRate}%` : "—"} tone={perf && perf.fillRate < 90 ? "bad" : "good"} sub="despacho completo" />
                <NStat label="Compra anual" value={formatCurrencyCompact(compraAnual)} sub="estimada" />
              </div>
            ) : (
              <p className="text-sm text-rose-600">Sin proveedor asignado: no se puede negociar ni reponer.</p>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Alternativas + Objetivos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Proveedores alternativos" description="Tu poder de negociación: no dependes de uno solo" />
          <CardBody>
            {alternativas.length === 0 ? (
              <p className="text-sm text-slate-400">No hay proveedores alternativos para esta categoría.</p>
            ) : (
              <div className="space-y-2">
                {alternativas.map((s) => {
                  const f = supplierFulfillment(s.name);
                  return (
                    <Link key={s.id} to={`/proveedores/${s.id}`} className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 hover:border-brand-300 hover:bg-brand-50/40">
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-slate-800 truncate">{s.name}</span>
                        <span className="block text-xs text-slate-400">lead {formatDays(s.averageLeadTimeDays)} · cumple {formatPercent(s.deliveryCompliance, 0)} · fill {f.arrivedOrders > 0 ? `${f.fillRate}%` : "s/d"}</span>
                      </span>
                      <Badge tone={s.deliveryCompliance >= 85 ? "green" : s.deliveryCompliance >= 70 ? "amber" : "red"}>{s.deliveryCompliance >= 85 ? "Buena opción" : "Revisar"}</Badge>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Objetivos de la negociación" description="Lleva pedidos concretos, no solo 'descuento'" />
          <CardBody>
            <ul className="space-y-2">
              {objetivos.map((o, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="text-brand-500 mt-0.5">▸</span>
                  <span>{o}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4">
              <p className="text-xs font-semibold text-slate-500 mb-2">Próxima decisión</p>
              <div className="flex flex-wrap gap-2">
                {decisiones.filter((d) => d.on).map((d) => (
                  <span key={d.label} className="inline-flex items-center rounded-full bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200 px-3 py-1 text-xs font-medium">{d.label}</span>
                ))}
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

/**
 * Banner "Decisión recomendada": resume en una frase qué hacer y por qué,
 * con la acción a un clic. Es lo primero que debe ver el comprador.
 */
function DecisionBanner({
  product,
  rec,
  added,
  onAdd,
}: {
  product: Product;
  rec?: PurchaseRecommendation;
  added: boolean;
  onAdd: () => void;
}) {
  const cover = coverageDays(product.availableStock, product.salesLast30Days);
  const lead = product.supplierLeadTimeDays;

  // Caso 1: hay recomendación de compra
  if (rec && rec.suggestedQuantity > 0) {
    const urgent = rec.status === "critical";
    return (
      <div
        className={`mb-5 rounded-xl border p-4 ${
          urgent ? "bg-rose-50 border-rose-200" : "bg-amber-50 border-amber-200"
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Decisión recomendada
              </span>
              <RecommendationBadge status={rec.status} />
            </div>
            <p className="text-base font-semibold text-slate-900">
              Comprar {formatNumber(rec.suggestedQuantity)} unidades a {rec.supplierName} ·{" "}
              {formatCurrency(rec.suggestedPurchaseAmount)}
            </p>
            <p className="text-sm text-slate-600 mt-0.5">
              El stock disponible cubre {product.salesLast30Days > 0 ? formatDays(cover) : "—"} y el
              proveedor demora {formatDays(lead)} en entregar. {rec.reason}
            </p>
          </div>
          <Button
            onClick={onAdd}
            disabled={added}
            variant={added ? "secondary" : "primary"}
            icon={added ? <IconCheck className="w-4 h-4" /> : <IconPlus className="w-4 h-4" />}
          >
            {added ? "Agregado a OC" : "Agregar a OC"}
          </Button>
        </div>
      </div>
    );
  }

  // Caso 2: sobrestock — no comprar
  if (product.purchaseStatus === "overstock" || (rec && rec.status === "overstock")) {
    return (
      <div className="mb-5 rounded-xl border border-violet-200 bg-violet-50 p-4">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Decisión recomendada
        </span>
        <p className="text-base font-semibold text-slate-900 mt-1">No comprar — hay sobrestock</p>
        <p className="text-sm text-slate-600 mt-0.5">
          Hay {formatNumber(product.availableStock)} unidades disponibles para{" "}
          {formatNumber(product.inventoryDays)} días de venta. Conviene esperar y, si la rotación
          sigue baja, evaluar promoción o redistribución.
        </p>
      </div>
    );
  }

  // Caso 3: sin proveedor con venta activa
  if (!product.supplierName && product.salesLast30Days > 0) {
    return (
      <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-4">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Decisión recomendada
        </span>
        <p className="text-base font-semibold text-slate-900 mt-1">Asignar proveedor</p>
        <p className="text-sm text-slate-600 mt-0.5">
          Este producto vende {formatNumber(product.salesLast30Days)} unidades al mes pero no tiene
          proveedor asignado, por lo que no se puede generar reposición.
        </p>
      </div>
    );
  }

  // Caso 4: todo en orden
  return (
    <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Decisión recomendada
      </span>
      <p className="text-base font-semibold text-slate-900 mt-1">Sin acción por ahora</p>
      <p className="text-sm text-slate-600 mt-0.5">
        El stock disponible cubre la venta esperada{" "}
        {product.salesLast30Days > 0 && `(${formatDays(cover)} de cobertura)`}. No requiere compra.
      </p>
    </div>
  );
}
