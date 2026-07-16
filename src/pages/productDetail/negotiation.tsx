import { Link } from "react-router-dom";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { products } from "../../data/mockProducts";
import { supplierFulfillment } from "../../utils/supplierPerf";
import { seasonalFactor, demandType } from "../../utils/seasonality";
import type { Product } from "../../types/purchasing";
import {
  formatCurrency,
  formatCurrencyCompact,
  formatDate,
  formatDays,
  formatNumber,
  formatPercent,
} from "../../utils/formatters";
import type { NegotiationData } from "./negotiationData";

/** Estadística compacta del panel de negociación (label, valor coloreado y sub). */
export function NStat({
  label,
  value,
  tone,
  sub,
}: {
  label: string;
  value: string;
  tone?: "good" | "warn" | "bad";
  sub?: string;
}) {
  const c =
    tone === "bad"
      ? "text-rose-700"
      : tone === "warn"
        ? "text-amber-700"
        : tone === "good"
          ? "text-emerald-700"
          : "text-slate-800";
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2.5">
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`text-lg font-semibold ${c}`}>{value}</p>
      {sub && <p className="text-[11px] text-slate-400 leading-tight">{sub}</p>}
    </div>
  );
}

/** Fila 1: venta, margen, inventario y proveedor (4 tarjetas de indicadores). */
export function NegKpiRow({ product, data }: { product: Product; data: NegotiationData }) {
  const { sales30, sales90, tendencia, ranking, objetivo, brecha, costoObjetivo, bajaCosto } = data;
  const { enTransito, enQuiebre, ventaPerdida, master, perf, compraAnual } = data;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Venta */}
      <Card>
        <CardHeader title="Venta y demanda" />
        <CardBody>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <NStat label="Venta 30 días" value={`${formatNumber(sales30)} u.`} />
            <NStat label="Venta 90 días" value={`${formatNumber(sales90)} u.`} />
            <NStat
              label="Tendencia"
              value={`${tendencia >= 0 ? "+" : ""}${formatPercent(tendencia, 0)}`}
              tone={tendencia >= 0 ? "good" : "bad"}
              sub="30d vs prom. 90d"
            />
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
            <NStat
              label="Margen actual"
              value={formatPercent(product.margin, 0)}
              tone={product.margin < objetivo ? "warn" : "good"}
            />
            <NStat
              label="Margen objetivo"
              value={formatPercent(objetivo, 0)}
              sub={brecha > 0 ? `faltan ${formatPercent(brecha, 0)}` : "cumplido"}
            />
          </div>
          {brecha > 0 && (
            <p className="text-xs text-slate-500 mt-2.5">
              Para llegar al objetivo, el costo debería bajar ~
              <b className="text-slate-700">{formatPercent(bajaCosto, 0)}</b> (a{" "}
              {formatCurrency(costoObjetivo)}).
            </p>
          )}
        </CardBody>
      </Card>

      {/* Inventario */}
      <Card>
        <CardHeader title="Inventario" />
        <CardBody>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <NStat
              label="Disponible"
              value={formatNumber(product.availableStock)}
              tone={product.availableStock <= 0 ? "bad" : undefined}
              sub={`${formatNumber(product.committedStock)} comprometido`}
            />
            <NStat
              label="Días inventario"
              value={formatNumber(product.inventoryDays)}
              tone={product.inventoryDays < 7 ? "bad" : product.inventoryDays > 120 ? "warn" : "good"}
            />
            <NStat label="En tránsito" value={formatNumber(enTransito)} sub="OC por llegar" />
            <NStat
              label={enQuiebre ? "Venta perdida" : "Estado"}
              value={
                enQuiebre
                  ? formatCurrencyCompact(ventaPerdida)
                  : product.purchaseStatus === "overstock"
                    ? "Sobrestock"
                    : "OK"
              }
              tone={enQuiebre ? "bad" : product.purchaseStatus === "overstock" ? "warn" : "good"}
              sub={enQuiebre ? "por quiebre / mes" : undefined}
            />
          </div>
        </CardBody>
      </Card>

      {/* Proveedor */}
      <Card>
        <CardHeader title={`Proveedor — ${product.supplierName || "sin asignar"}`} />
        <CardBody>
          {master ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <NStat
                label="Lead time"
                value={formatDays(master.averageLeadTimeDays)}
                tone={master.averageLeadTimeDays >= 15 ? "warn" : undefined}
              />
              <NStat
                label="Cumplimiento"
                value={formatPercent(master.deliveryCompliance, 0)}
                tone={
                  master.deliveryCompliance < 70
                    ? "bad"
                    : master.deliveryCompliance < 85
                      ? "warn"
                      : "good"
                }
                sub="a tiempo"
              />
              <NStat
                label="Fill rate"
                value={perf ? `${perf.fillRate}%` : "—"}
                tone={perf && perf.fillRate < 90 ? "bad" : "good"}
                sub="despacho completo"
              />
              <NStat label="Compra anual" value={formatCurrencyCompact(compraAnual)} sub="estimada" />
            </div>
          ) : (
            <p className="text-sm text-rose-600">
              Sin proveedor asignado: no se puede negociar ni reponer.
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

/** Fila 2: costo neto real (desglose) y precio/costo/historial. */
export function NegCostPriceRow({ product, data }: { product: Product; data: NegotiationData }) {
  const { neg, objetivo } = data;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader
          title="Costo neto real"
          description="El descuento no es el costo: mira lo que pagas de verdad"
        />
        <CardBody>
          <div className="space-y-1">
            {neg.costLines.map((l) => {
              const isTotal = l.kind === "total";
              const color =
                l.kind === "discount"
                  ? "text-emerald-600"
                  : l.kind === "extra"
                    ? "text-rose-600"
                    : "text-slate-800";
              return (
                <div
                  key={l.label}
                  className={`flex items-center justify-between py-1 ${isTotal ? "border-t border-slate-200 mt-1 pt-1.5" : ""}`}
                >
                  <span
                    className={`text-sm ${isTotal ? "font-semibold text-slate-800" : "text-slate-600"}`}
                  >
                    {l.label}
                  </span>
                  <span
                    className={`text-sm tabular-nums ${isTotal ? "font-semibold text-slate-900" : color}`}
                  >
                    {l.amount < 0 ? "−" : ""}
                    {formatCurrency(Math.abs(l.amount))}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2.5 flex items-center justify-between">
            <span className="text-xs text-slate-500">Margen nominal vs real</span>
            <span className="text-sm font-semibold">
              <span className="text-slate-500">{formatPercent(neg.margenNominal, 0)}</span>
              <span className="text-slate-300 mx-1.5">→</span>
              <span className={neg.margenReal < objetivo ? "text-rose-600" : "text-emerald-700"}>
                {formatPercent(neg.margenReal, 0)}
              </span>
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            El costo real suma el flete, el arancel y el manejo sobre el costo de factura — el mismo{" "}
            <b>costo puesto en bodega</b> que verás en la línea de la orden de compra. Negocia sobre
            este costo, no sobre el descuento de lista.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Precio, costo e historial"
          description="Para comparar contra costo, mercado y precio real de venta"
        />
        <CardBody>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <NStat
              label="Costo actual"
              value={formatCurrency(product.cost)}
              sub={`act. ${formatDate(product.costUpdatedAt)}`}
            />
            <NStat label="Último costo" value={formatCurrency(neg.ultimoCosto)} />
            <NStat
              label="Variación costo"
              value={`${neg.varCostoPct >= 0 ? "+" : ""}${formatPercent(neg.varCostoPct, 0)}`}
              tone={neg.varCostoPct > 5 ? "bad" : neg.varCostoPct > 0 ? "warn" : "good"}
              sub="vs compra anterior"
            />
            <NStat label="Precio venta" value={formatCurrency(product.price)} />
            <NStat
              label="Precio prom. vendido"
              value={formatCurrency(neg.precioPromedioVendido)}
              sub={`−${formatPercent(neg.descuentoPromVenta, 0)} desc. medio`}
            />
            <NStat
              label="Precio competencia"
              value={formatCurrency(neg.precioCompetencia)}
              tone={neg.vsCompetenciaPct > 3 ? "warn" : "good"}
              sub={neg.vsCompetenciaPct >= 0 ? "estás más caro" : "estás más barato"}
            />
          </div>
          {neg.varCostoPct > 5 && (
            <p className="text-xs text-amber-700 mt-2.5">
              ⚠ El costo subió {formatPercent(neg.varCostoPct, 0)}: pide justificación del alza o
              congela precio por volumen.
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

/** Fila 3: stock por ubicación y calidad/condiciones del proveedor. */
export function NegStockQualityRow({ product, data }: { product: Product; data: NegotiationData }) {
  const { locations, maxLocStock, neg, master } = data;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader
          title="Stock por tienda / CD"
          description="Dónde falta y dónde sobra — argumento de venta perdida"
        />
        <CardBody>
          {locations.length === 0 ? (
            <p className="text-sm text-slate-400">Sin desglose por ubicación.</p>
          ) : (
            <div className="space-y-2">
              {locations.map((l) => (
                <div key={l.locationName}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-slate-700">{l.locationName}</span>
                    <span
                      className={`font-medium ${l.available <= 0 ? "text-rose-600" : "text-slate-700"}`}
                    >
                      {formatNumber(l.available)} disp.
                      {l.committed > 0 && (
                        <span className="text-slate-400"> · {formatNumber(l.committed)} comp.</span>
                      )}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${l.available <= 0 ? "bg-rose-400" : "bg-brand-500"}`}
                      style={{ width: `${Math.max(3, (l.stock / maxLocStock) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 grid grid-cols-3 gap-2.5">
            <NStat label="Stock mín." value={formatNumber(product.minStock)} />
            <NStat label="Stock máx." value={formatNumber(product.maxStock)} />
            <NStat label="Punto reorden" value={formatNumber(product.reorderPoint)} />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Calidad y condiciones del proveedor"
          description="Lo que puedes exigir además del precio"
        />
        <CardBody>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <NStat label="Condiciones pago" value={`${neg.condicionesPago} días`} />
            <NStat
              label="Devoluciones"
              value={formatPercent(neg.devolucionesPct, 1)}
              tone={neg.devolucionesPct > 3 ? "warn" : "good"}
              sub="del despacho"
            />
            <NStat
              label="Notas de crédito"
              value={formatNumber(neg.notasCredito)}
              tone={neg.notasCredito > 2 ? "warn" : "good"}
              sub="últimos 90 días"
            />
            <NStat
              label="Reclamos"
              value={formatNumber(neg.reclamos)}
              tone={neg.reclamos > 1 ? "warn" : "good"}
              sub="abiertos"
            />
            <NStat
              label="Quiebres provocados"
              value={formatNumber(neg.quiebresProvocados)}
              tone={neg.quiebresProvocados > 2 ? "bad" : "good"}
              sub="por no despachar"
            />
            <NStat
              label="Lead time"
              value={master ? formatDays(master.averageLeadTimeDays) : "—"}
              tone={master && master.averageLeadTimeDays >= 15 ? "warn" : undefined}
            />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

/** Fila 4: demanda futura (con estacionalidad) y productos sustitutos. */
export function NegDemandRow({ product, data }: { product: Product; data: NegotiationData }) {
  const { neg, master } = data;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader title="Demanda futura" description="Anticipa: no negocies solo mirando el pasado" />
        <CardBody>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <NStat label="Venta 180 días" value={`${formatNumber(product.salesLast180Days)} u.`} />
            <NStat
              label="Proyección 90d"
              value={`${formatNumber(neg.proyeccion90)} u.`}
              sub="según tendencia"
            />
            <NStat
              label="Tendencia"
              value={`${neg.tendenciaPct >= 0 ? "+" : ""}${formatPercent(neg.tendenciaPct, 0)}`}
              tone={neg.tendenciaPct >= 0 ? "good" : "bad"}
            />
            <NStat label="Rotación" value={`${formatNumber(product.rotation)}x`} sub="al año" />
          </div>
          {(() => {
            const sf = seasonalFactor(product.category);
            const dt = demandType(product.category);
            const dtLabel =
              dt === "constante"
                ? "Venta constante"
                : dt === "permanente_peak"
                  ? "Permanente con peak"
                  : "Estacional fuerte";
            const pct = Math.round((sf - 1) * 100);
            return (
              <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Demanda estacional ({dtLabel})</span>
                  <span
                    className={`font-semibold ${sf >= 1.1 ? "text-emerald-700" : sf <= 0.9 ? "text-rose-600" : "text-slate-700"}`}
                  >
                    {pct >= 0 ? "+" : ""}
                    {pct}% próx. meses
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {sf >= 1.1
                    ? "Entra a temporada alta: el sugerido sube el objetivo de cobertura para no quebrar en el peak."
                    : sf <= 0.9
                      ? "Saliendo de temporada: el sugerido baja la compra para no quedar con sobrestock."
                      : "Sin ajuste estacional relevante para los próximos meses."}
                </p>
              </div>
            );
          })()}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge
              tone={
                neg.demandTag.tone === "good"
                  ? "green"
                  : neg.demandTag.tone === "bad"
                    ? "red"
                    : "neutral"
              }
            >
              {neg.demandTag.label}
            </Badge>
            {product.supplierName && master && (
              <Link
                to={`/proveedores/${master.id}?tab=temporadas`}
                className="text-xs font-medium text-brand-600 hover:text-brand-700"
              >
                Ver estacionalidad del proveedor →
              </Link>
            )}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Productos sustitutos"
          description="Alternativas si el proveedor falla o sube el costo"
        />
        <CardBody>
          {neg.sustitutos.length === 0 ? (
            <p className="text-sm text-slate-400">
              No hay sustitutos en la subcategoría {product.subcategory}.
            </p>
          ) : (
            <div className="space-y-2">
              {neg.sustitutos.map((s) => (
                <Link
                  key={s.sku}
                  to={`/productos/${s.sku}`}
                  className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 hover:border-brand-300 hover:bg-brand-50/40"
                >
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-slate-800 truncate">
                      {s.name}
                    </span>
                    <span className="block text-xs text-slate-400 truncate">
                      {s.supplierName} · margen {formatPercent(s.margin, 0)}
                    </span>
                  </span>
                  <span className="text-sm font-semibold text-slate-700 flex-shrink-0">
                    {formatCurrency(s.price)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

/** Fila 5: proveedores alternativos y objetivos/decisión de la negociación. */
export function NegAltObjectivesRow({ data }: { data: NegotiationData }) {
  const { alternativas, objetivos, decisiones } = data;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader
          title="Proveedores alternativos"
          description="Tu poder de negociación: no dependes de uno solo"
        />
        <CardBody>
          {alternativas.length === 0 ? (
            <p className="text-sm text-slate-400">
              No hay proveedores alternativos para esta categoría.
            </p>
          ) : (
            <div className="space-y-2">
              {alternativas.map((s) => {
                const f = supplierFulfillment(s.name);
                return (
                  <Link
                    key={s.id}
                    to={`/proveedores/${s.id}`}
                    className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 hover:border-brand-300 hover:bg-brand-50/40"
                  >
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-slate-800 truncate">
                        {s.name}
                      </span>
                      <span className="block text-xs text-slate-400">
                        lead {formatDays(s.averageLeadTimeDays)} · cumple{" "}
                        {formatPercent(s.deliveryCompliance, 0)} · fill{" "}
                        {f.arrivedOrders > 0 ? `${f.fillRate}%` : "s/d"}
                      </span>
                    </span>
                    <Badge
                      tone={
                        s.deliveryCompliance >= 85
                          ? "green"
                          : s.deliveryCompliance >= 70
                            ? "amber"
                            : "red"
                      }
                    >
                      {s.deliveryCompliance >= 85 ? "Buena opción" : "Revisar"}
                    </Badge>
                  </Link>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Objetivos de la negociación"
          description="Lleva pedidos concretos, no solo 'descuento'"
        />
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
              {decisiones
                .filter((d) => d.on)
                .map((d) => (
                  <span
                    key={d.label}
                    className="inline-flex items-center rounded-full bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200 px-3 py-1 text-xs font-medium"
                  >
                    {d.label}
                  </span>
                ))}
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
