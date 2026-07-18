import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";

import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { Tabs } from "../components/ui/Tabs";
import { ActivityTimeline, type ActivityItem } from "../shared/components/ActivityTimeline";
import { KpiCard } from "../components/business/KpiCard";
import { StatusBadge } from "../components/business/StatusBadge";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";
import { BarList } from "../components/business/BarList";
import { IconPlus, IconInfo, IconAlerts, IconSignal, IconSuppliers, IconCategories } from "../components/ui/icons";

import { supplierPath, categoryPath } from "../utils/entityLinks";

import { SIGNAL_STATUS, SIGNAL_PRIORITY, signalKindMeta } from "../components/business/signalLabels";
import { ALERT_STATUS_UI } from "../components/business/alertBff";
import { useOcDraft } from "../context/OcDraftContext";
import { useToast } from "../context/ToastContext";
import { useProductFicha } from "../hooks/useFichas";
import { useSignalsList } from "../hooks/useSignals";

import { DecisionBanner, MiniStat, Row } from "./productDetail/components";
import { productPriorityUi } from "./productDetail/helpers";
import { formatCurrency, formatDate, formatDays, formatNumber, formatPercent } from "../utils/formatters";

// ============================================================================
//  Ficha de producto (SKU 360, F11) conectada al purchase-bff-service:
//  GET /products/:sku compone identidad, stock (feed vivo o snapshot del
//  motor), costo vigente, ventas, recomendación, OCs y alertas. Las señales
//  de venta del SKU salen de GET /signals?sku=… (F13). Regla de oro:
//  dato sin fuente real ⇒ "—" o estado vacío honesto.
// ============================================================================

const fmtDate = (iso: string | null) => (iso ? formatDate(iso.slice(0, 10)) : "—");

export function ProductDetailPage() {
  const { sku } = useParams<{ sku: string }>();
  const navigate = useNavigate();
  const { addItem, hasItem } = useOcDraft();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get("tab") ?? "resumen");

  const { data, loading, error, notFound, configured, refetch } = useProductFicha(sku);

  // Señales de venta reales del SKU (antes de los early-returns: es un hook).
  const {
    signals: productSignals,
    loading: signalsLoading,
    error: signalsError,
  } = useSignalsList({ sku }, { enabled: !!sku });

  const pageTitle = data?.name ?? sku ?? "Producto";
  const breadcrumbs = [{ label: "Productos", to: "/productos" }, { label: sku ?? "—" }];

  // --------------------------------------------------------------------------
  //  Estados de conexión: sin configurar, cargando, error y 404 (patrón F1).
  // --------------------------------------------------------------------------
  if (!configured) {
    return (
      <div>
        <PageHeader breadcrumbs={breadcrumbs} title={pageTitle} />
        <Card>
          <div className="p-6 text-center">
            <p className="text-sm font-semibold text-slate-800">Conexión no configurada</p>
            <p className="mt-1 text-sm text-slate-500">
              Configura <code className="font-mono text-slate-700">VITE_PURCHASE_BFF_URL</code> para
              ver la ficha real del producto.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div>
        <PageHeader breadcrumbs={breadcrumbs} title={pageTitle} />
        <Card>
          <div className="space-y-2.5 p-4" aria-busy="true" aria-label="Cargando ficha del producto">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="py-10">
        <EmptyState
          title="Producto no encontrado"
          description={`El servicio de compras no conoce el SKU "${sku}".`}
          action={<Button onClick={() => navigate("/productos")}>Volver a productos</Button>}
        />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div>
        <PageHeader breadcrumbs={breadcrumbs} title={pageTitle} />
        <Card>
          <div className="p-6 text-center">
            <p className="text-sm font-semibold text-slate-800">
              No se pudo cargar la ficha del producto
            </p>
            <p className="mt-1 text-sm text-slate-500">{error.message}</p>
            <Button className="mt-4" onClick={refetch}>
              Reintentar
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!data || !sku) return null;

  const rec = data.recommendation;

  // Cobertura: la del motor o disponible/velocidad si ambos existen.
  const coverage =
    rec?.coverageDays ??
    (data.stock.available !== null &&
    data.sales.dailyVelocity !== null &&
    data.sales.dailyVelocity > 0
      ? Math.round(data.stock.available / data.sales.dailyVelocity)
      : null);

  const added = hasItem(data.sku);
  const handleAdd = () => {
    const ok = addItem({
      sku: data.sku,
      productName: data.name ?? data.sku,
      supplierName: data.supplier.name ?? "",
      quantity: rec?.suggestedQty ?? 1,
      unitCost: data.cost.unitCostClp ?? 0,
      recommendationId: rec?.id,
      supplierId: data.supplier.id ?? undefined,
      categoryId: data.category.id ?? undefined,
    });
    if (!ok) return;
    toast.success(`${data.name ?? data.sku} agregado al borrador de OC`, {
      label: "Ver borrador OC",
      onClick: () => navigate("/comprar/borradores"),
    });
  };

  // Actividad real: costo vigente, OCs con el SKU y alertas.
  const activity: ActivityItem[] = [
    ...(data.cost.asOf
      ? [
          {
            date: data.cost.asOf.slice(0, 10),
            title: "Actualización de costo",
            description: `Costo vigente ${
              data.cost.unitCostClp !== null ? formatCurrency(data.cost.unitCostClp) : "—"
            }${data.cost.priceListId ? ` (lista ${data.cost.priceListId})` : ""}`,
            tone: "blue" as const,
          },
        ]
      : []),
    ...data.orders
      .filter((o) => o.createdAt)
      .map((o) => ({
        date: (o.createdAt ?? "").slice(0, 10),
        title: `Orden de compra ${o.number ?? o.purchaseOrderId ?? ""}`,
        description: `${o.qty !== null ? formatNumber(o.qty) : "—"} unidades${
          o.unitCostClp !== null ? ` a ${formatCurrency(o.unitCostClp)} c/u` : ""
        }`,
        tone: "neutral" as const,
      })),
    ...data.alerts
      .filter((a) => a.dateCreated)
      .map((a) => ({
        date: (a.dateCreated ?? "").slice(0, 10),
        title: "Alerta comercial",
        description: a.title ?? "—",
        tone: "amber" as const,
      })),
  ].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div>
      <PageHeader
        breadcrumbs={breadcrumbs}
        title={pageTitle}
        description={
          [data.category.name, data.brand].filter(Boolean).join(" · ") || undefined
        }
        action={
          rec && rec.suggestedQty > 0 ? (
            <Button
              onClick={handleAdd}
              disabled={added}
              variant={added ? "secondary" : "primary"}
              icon={<IconPlus className="w-4 h-4" />}
            >
              {added ? "Agregado a OC" : "Agregar a OC"}
            </Button>
          ) : undefined
        }
      />

      {/* Encabezado: chips de identidad con links reales */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <span className="text-xs font-mono text-slate-500 bg-slate-100 rounded px-2 py-1">
          {data.sku}
        </span>
        {data.supplier.name || data.supplier.id ? (
          <Link
            to={supplierPath(data.supplier.id)}
            className="text-xs text-brand-600 hover:text-brand-700 font-medium"
          >
            Proveedor: {data.supplier.name ?? data.supplier.id}
          </Link>
        ) : (
          <Badge tone="red">Sin proveedor asignado</Badge>
        )}
        {data.category.name && (
          <Link
            to={categoryPath(data.category.id)}
            className="text-xs text-brand-600 hover:text-brand-700 font-medium"
          >
            Categoría: {data.category.name}
          </Link>
        )}
        {data.stock.fromSnapshot && (
          <Badge tone="amber" dot>
            Stock desde snapshot del motor
          </Badge>
        )}
      </div>

      {/* Decisión recomendada — lo primero que debe ver el comprador */}
      <DecisionBanner data={data} added={added} onAdd={handleAdd} />

      <Tabs
        className="mb-5"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "resumen", label: "Resumen" },
          { value: "negociacion", label: "Negociación" },
          { value: "margen", label: "Margen por canal" },
          { value: "senales", label: "Señales de ventas", count: productSignals.length },
          { value: "relacionados", label: "Relacionados" },
          { value: "actividad", label: "Actividad", count: activity.length },
        ]}
      />

      {tab === "resumen" && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <KpiCard
              title="Stock disponible"
              value={data.stock.available !== null ? formatNumber(data.stock.available) : "—"}
              tone={
                data.stock.available === null
                  ? "neutral"
                  : data.stock.available <= 0
                    ? "bad"
                    : "good"
              }
              description={data.stock.fromSnapshot ? "Snapshot del motor" : undefined}
            />
            <KpiCard
              title="En tránsito"
              value={data.stock.inTransit !== null ? formatNumber(data.stock.inTransit) : "—"}
              tone="neutral"
            />
            <KpiCard
              title="Venta 30 días"
              value={
                data.sales.salesLast30d !== null ? formatNumber(data.sales.salesLast30d) : "—"
              }
              tone="info"
              description={
                data.sales.salesLast90d !== null
                  ? `${formatNumber(data.sales.salesLast90d)} en 90 días`
                  : undefined
              }
            />
            <KpiCard
              title="Cobertura"
              value={coverage !== null ? formatDays(coverage) : "—"}
              tone={
                coverage === null ? "neutral" : coverage < 7 ? "bad" : coverage > 120 ? "warn" : "good"
              }
            />
            <KpiCard
              title="Margen"
              value={data.sales.marginPct !== null ? formatPercent(data.sales.marginPct) : "—"}
              tone={
                data.sales.marginPct === null
                  ? "neutral"
                  : data.sales.marginPct < 25
                    ? "warn"
                    : "good"
              }
            />
            <KpiCard
              title="Costo vigente"
              value={data.cost.unitCostClp !== null ? formatCurrency(data.cost.unitCostClp) : "—"}
              tone="neutral"
              description={
                data.cost.priceListId
                  ? `Lista ${data.cost.priceListId} · ${fmtDate(data.cost.asOf)}`
                  : fmtDate(data.cost.asOf)
              }
            />
            <KpiCard
              title="Velocidad diaria"
              value={
                data.sales.dailyVelocity !== null
                  ? data.sales.dailyVelocity.toLocaleString("es-CL", { maximumFractionDigits: 1 })
                  : "—"
              }
              tone="neutral"
              description="Unidades por día"
            />
            <KpiCard
              title="Rotación"
              value={
                data.sales.rotation !== null
                  ? data.sales.rotation.toLocaleString("es-CL", { maximumFractionDigits: 1 })
                  : "—"
              }
              tone="neutral"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
            {/* Recomendación de compra real del motor */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader
                  title="Recomendación de compra"
                  description="Qué hacer con este producto y por qué (motor de reposición)"
                />
                <CardBody>
                  {rec ? (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <Badge tone={productPriorityUi(rec.priority).tone} dot>
                          {productPriorityUi(rec.priority).label}
                        </Badge>
                        <div>
                          <p className="text-2xl font-semibold text-slate-900">
                            {formatNumber(rec.suggestedQty)} unidades
                          </p>
                          <p className="text-sm text-slate-500">
                            {data.cost.unitCostClp !== null
                              ? formatCurrency(rec.suggestedQty * data.cost.unitCostClp)
                              : "monto según costo vigente no disponible"}
                            {data.supplier.name && <> · {data.supplier.name}</>}
                            {data.terms.leadTimeDays !== null && (
                              <> (lead time {formatDays(data.terms.leadTimeDays)})</>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {rec.reason && (
                          <div className="flex gap-2.5 rounded-lg border-l-2 border-slate-300 bg-slate-50 px-3 py-2">
                            <IconInfo className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-slate-700">
                              <span className="font-medium text-slate-500">Motivo: </span>
                              {rec.reason}
                            </p>
                          </div>
                        )}
                        {rec.risk && (
                          <div className="flex gap-2.5 rounded-lg border-l-2 border-rose-400 bg-rose-50 px-3 py-2">
                            <IconAlerts className="w-4 h-4 text-rose-500 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-slate-700">
                              <span className="font-medium text-rose-600">
                                Riesgo si no compras:{" "}
                              </span>
                              {rec.risk}
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <MiniStat
                          label="MOQ"
                          value={data.terms.moq !== null ? formatNumber(data.terms.moq) : "—"}
                        />
                        <MiniStat
                          label="Múltiplo de compra"
                          value={
                            data.terms.packMultiple !== null
                              ? formatNumber(data.terms.packMultiple)
                              : "—"
                          }
                        />
                        <MiniStat
                          label="Cobertura sugerida"
                          value={
                            rec.coverageDays != null ? formatDays(rec.coverageDays) : "—"
                          }
                        />
                      </div>
                    </div>
                  ) : (
                    <EmptyState
                      title="Sin recomendación activa"
                      description="El motor de reposición no tiene una recomendación pendiente para este SKU."
                    />
                  )}
                </CardBody>
              </Card>
            </div>

            {/* Stock real (feed vivo o snapshot) */}
            <Card>
              <CardHeader
                title="Stock"
                description={
                  data.stock.fromSnapshot
                    ? "Snapshot del motor (feed vivo caído)"
                    : "Saldo según el feed de inventario"
                }
              />
              <CardBody className="space-y-2">
                <Row
                  label="Disponible"
                  value={data.stock.available !== null ? formatNumber(data.stock.available) : "—"}
                  strong
                />
                <Row
                  label="En tránsito"
                  value={data.stock.inTransit !== null ? formatNumber(data.stock.inTransit) : "—"}
                />
                <Row
                  label="Stock de seguridad"
                  value={data.stock.security !== null ? formatNumber(data.stock.security) : "—"}
                />
                <Row label="Actualizado" value={fmtDate(data.stock.asOf)} />
              </CardBody>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
            {/* Ventas reales: solo las ventanas publicadas (sin inventar meses) */}
            <Card>
              <CardHeader title="Ventas" description="Unidades por ventana publicada" />
              <CardBody>
                {data.sales.salesLast30d === null && data.sales.salesLast90d === null ? (
                  <p className="text-sm text-slate-400 py-4 text-center">
                    Sin ventas publicadas para este SKU.
                  </p>
                ) : (
                  <>
                    <BarList
                      items={[
                        ...(data.sales.salesLast30d !== null
                          ? [
                              {
                                label: "Últimos 30 días",
                                value: data.sales.salesLast30d,
                                display: `${formatNumber(data.sales.salesLast30d)} u.`,
                                tone: "blue" as const,
                              },
                            ]
                          : []),
                        ...(data.sales.salesLast90d !== null
                          ? [
                              {
                                label: "Últimos 90 días",
                                value: data.sales.salesLast90d,
                                display: `${formatNumber(data.sales.salesLast90d)} u.`,
                                tone: "blue" as const,
                              },
                            ]
                          : []),
                      ]}
                    />
                    <p className="mt-2 text-xs text-slate-400">
                      La serie mensual se publica desde analytics; pendiente.
                    </p>
                  </>
                )}
              </CardBody>
            </Card>

            {/* Historial de compras real */}
            <Card>
              <CardHeader title="Últimas compras" description="Órdenes con este SKU" />
              <CardBody className="space-y-2">
                {data.orders.length > 0 ? (
                  data.orders.map((o, i) => (
                    <div
                      key={o.purchaseOrderId ?? i}
                      className="flex items-center justify-between text-sm py-1.5 border-b border-slate-50 last:border-0"
                    >
                      <div>
                        <p className="font-medium text-slate-700">{o.number ?? "—"}</p>
                        <p className="text-xs text-slate-400">
                          {fmtDate(o.createdAt)}
                          {o.status && (
                            <>
                              {" · "}
                              <StatusBadge kind="purchaseOrder" value={o.status} dot={false} />
                            </>
                          )}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-slate-700">
                          {o.qty !== null ? `${formatNumber(o.qty)} u.` : "—"}
                        </p>
                        <p className="text-xs text-slate-400">
                          {o.unitCostClp !== null ? `${formatCurrency(o.unitCostClp)} c/u` : "—"}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-400 py-4 text-center">
                    Sin compras registradas con este SKU.
                  </p>
                )}
              </CardBody>
            </Card>

            {/* Costo vigente (sin serie histórica todavía) */}
            <Card>
              <CardHeader title="Cambios de costo" description="Evolución del costo unitario" />
              <CardBody className="space-y-2">
                {data.cost.unitCostClp !== null ? (
                  <div className="flex items-center justify-between text-sm py-1.5">
                    <div>
                      <p className="font-medium text-slate-700">
                        {formatCurrency(data.cost.unitCostClp)}
                      </p>
                      <p className="text-xs text-slate-400">
                        {data.cost.priceListId ? `Lista ${data.cost.priceListId}` : "Costo vigente"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400">{fmtDate(data.cost.asOf)}</p>
                      <Badge tone="green">Vigente</Badge>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 py-4 text-center">
                    Sin costo vigente publicado.
                  </p>
                )}
                <p className="text-xs text-slate-400">
                  El historial estará disponible cuando pricing publique versiones de lista.
                </p>
              </CardBody>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Alertas reales del SKU */}
            <div>
              <h3 className="text-sm font-semibold text-slate-800 mb-2.5">Alertas relacionadas</h3>
              <Card>
                <CardBody className="space-y-2">
                  {data.alerts.length > 0 ? (
                    data.alerts.map((a) => {
                      const st =
                        a.status && a.status in ALERT_STATUS_UI
                          ? ALERT_STATUS_UI[a.status as keyof typeof ALERT_STATUS_UI]
                          : { label: a.status ?? "—", tone: "neutral" as const };
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
                          <Badge tone={st.tone} dot>
                            {st.label}
                          </Badge>
                        </div>
                      );
                    })
                  ) : (
                    <EmptyState
                      title="Sin alertas"
                      description="Este producto no tiene alertas comerciales activas."
                    />
                  )}
                </CardBody>
              </Card>
            </div>

            {/* OC relacionadas reales */}
            <div>
              <h3 className="text-sm font-semibold text-slate-800 mb-2.5">
                Órdenes de compra relacionadas
              </h3>
              <Card>
                <CardBody className="space-y-2">
                  {data.orders.length > 0 ? (
                    data.orders.map((o, i) => (
                      <Link
                        key={o.purchaseOrderId ?? i}
                        to={
                          o.number
                            ? `/comprar/seguimiento?oc=${encodeURIComponent(o.number)}`
                            : "/comprar/seguimiento"
                        }
                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 p-2.5 hover:border-brand-300 hover:bg-brand-50/40"
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-800">{o.number ?? "—"}</p>
                          <p className="text-xs text-slate-500">
                            creada {fmtDate(o.createdAt)}
                            {o.expectedDate && <> · espera {fmtDate(o.expectedDate)}</>}
                          </p>
                        </div>
                        {o.status && (
                          <StatusBadge kind="purchaseOrder" value={o.status} dot={false} />
                        )}
                      </Link>
                    ))
                  ) : (
                    <EmptyState
                      title="Sin órdenes"
                      description="No hay órdenes de compra con este producto."
                    />
                  )}
                </CardBody>
              </Card>
            </div>
          </div>
        </>
      )}

      {tab === "negociacion" && (
        <Card>
          <CardBody>
            <EmptyState
              title="Negociación por proveedor"
              description="Las rondas y condiciones se registran en la ficha del proveedor."
              action={
                data.supplier.id ? (
                  <Button onClick={() => navigate(`${supplierPath(data.supplier.id)}?tab=negociacion`)}>
                    Ir a la ficha del proveedor
                  </Button>
                ) : undefined
              }
            />
          </CardBody>
        </Card>
      )}

      {tab === "margen" && (
        <Card>
          <CardHeader
            title="Margen por canal"
            description="Precio y margen del mismo SKU en cada canal"
          />
          <CardBody>
            <EmptyState
              title="Sin datos de canal"
              description="El margen por canal se publica desde analytics; pendiente de conexión."
            />
          </CardBody>
        </Card>
      )}

      {tab === "senales" && (
        <Card>
          <CardHeader
            title="Señales de ventas de este producto"
            description="Lo que el equipo de ventas ha reportado desde el terreno sobre este SKU"
            action={
              <Link
                to="/senales-ventas"
                className="text-xs font-medium text-brand-600 hover:text-brand-700"
              >
                Ir a Señales de Ventas
              </Link>
            }
          />
          <CardBody>
            {signalsLoading && productSignals.length === 0 ? (
              <div className="space-y-2.5" aria-busy="true" aria-label="Cargando señales">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
              </div>
            ) : signalsError && productSignals.length === 0 ? (
              <EmptyState
                icon={<IconSignal className="w-6 h-6" />}
                title="No se pudieron cargar las señales"
                description={signalsError.message}
              />
            ) : productSignals.length === 0 ? (
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
                    to={`/senales-ventas?sig=${encodeURIComponent(s.id)}`}
                    className="block rounded-lg border border-slate-200 p-3 hover:border-brand-300 hover:bg-brand-50/40"
                  >
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <Badge tone={SIGNAL_PRIORITY[s.priority].tone}>
                        {SIGNAL_PRIORITY[s.priority].label}
                      </Badge>
                      <Badge tone={signalKindMeta(s.kind).tone}>{signalKindMeta(s.kind).short}</Badge>
                      <div className="flex-1" />
                      <Badge tone={SIGNAL_STATUS[s.status].tone} dot>
                        {SIGNAL_STATUS[s.status].label}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-700">{s.body}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {[s.reporterName ?? s.reporterUserId, s.storeRef].filter(Boolean).join(" · ")}
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
          <CardHeader
            title="Entidades relacionadas"
            description="Conexiones de este producto con otros módulos"
          />
          <CardBody className="space-y-2">
            {data.supplier.id || data.supplier.name ? (
              <Link
                to={supplierPath(data.supplier.id)}
                className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5 hover:border-brand-300 hover:bg-brand-50/40"
              >
                <IconSuppliers className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-slate-400">Proveedor</span>
                  <span className="block text-sm font-medium text-slate-800 truncate">
                    {data.supplier.name ?? data.supplier.id}
                  </span>
                </span>
              </Link>
            ) : null}
            {data.category.id || data.category.name ? (
              <Link
                to={categoryPath(data.category.id)}
                className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5 hover:border-brand-300 hover:bg-brand-50/40"
              >
                <IconCategories className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-slate-400">Categoría</span>
                  <span className="block text-sm font-medium text-slate-800 truncate">
                    {data.category.name ?? data.category.id}
                  </span>
                </span>
              </Link>
            ) : null}
            {!data.supplier.id && !data.supplier.name && !data.category.id && !data.category.name && (
              <EmptyState
                title="Sin entidades relacionadas"
                description="La ficha no trae proveedor ni categoría asociados."
              />
            )}
          </CardBody>
        </Card>
      )}

      {tab === "actividad" && (
        <Card>
          <CardHeader
            title="Actividad del producto"
            description="Eventos reales: costo vigente, órdenes y alertas"
          />
          <CardBody>
            {activity.length === 0 ? (
              <EmptyState
                title="Sin actividad registrada"
                description="Todavía no hay eventos reales para este SKU."
              />
            ) : (
              <ActivityTimeline items={activity} />
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
