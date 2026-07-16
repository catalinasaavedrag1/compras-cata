import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
import { MetricHint } from "../../components/business/supplierMetricHelp";
import { GStat } from "./GStat";
import { suppliers } from "../../data/mockSuppliers";
import { products } from "../../data/mockProducts";
import { categories } from "../../data/mockCategories";
import { purchaseOrders } from "../../data/mockPurchaseOrders";
import { supplierFulfillment } from "../../utils/supplierPerf";
import {
  SUPPLIER_COMPLIANCE_CRITICAL,
  SUPPLIER_COMPLIANCE_WARN,
  SUPPLIER_LEAD_TIME_WARN_DAYS,
} from "../../utils/constants";
import type { Supplier } from "../../types/purchasing";
import { formatCurrencyCompact, formatDays, formatNumber, formatPercent } from "../../utils/formatters";

/** Vista global del proveedor como cuenta comercial para preparar la negociación. */
export function SupplierNegotiation({ supplier }: { supplier: Supplier }) {
  const sales30Amount = (p: (typeof products)[number]) => p.salesLast30Days * p.price;
  const supProducts = products.filter((p) => p.supplierName === supplier.name);
  const ventas30 = supProducts.reduce((a, p) => a + sales30Amount(p), 0);
  const utilidad30 = supProducts.reduce((a, p) => a + p.salesLast30Days * (p.price - p.cost), 0);
  const margenProm = ventas30 > 0 ? (utilidad30 / ventas30) * 100 : 0;
  const ventaAnual = ventas30 * 12;

  const perf = supplierFulfillment(supplier.name);
  const otif =
    supplier.deliveryCompliance && perf.fillRate
      ? Math.round((supplier.deliveryCompliance * perf.fillRate) / 100)
      : 0;
  const delayedPOs = purchaseOrders.filter(
    (o) => o.supplierName === supplier.name && (o.status === "delayed" || o.delayedDays > 0)
  );
  const conQuiebre = supProducts.filter((p) => p.availableStock <= 0 && p.salesLast30Days > 0);
  const ventaPerdida = conQuiebre.reduce((a, p) => a + p.salesLast30Days * p.price, 0);
  const sinRotacion = supProducts.filter((p) => p.salesLast30Days === 0 && p.availableStock > 0);
  const enCaida = supProducts.filter(
    (p) =>
      p.salesLast90Days > 0 &&
      p.salesLast30Days > 0 &&
      p.salesLast30Days < (p.salesLast90Days / 3) * 0.8
  );
  const topSold = [...supProducts]
    .filter((p) => p.salesLast30Days > 0)
    .sort((a, b) => sales30Amount(b) - sales30Amount(a))
    .slice(0, 5);

  const rankingProv =
    [...suppliers]
      .sort((a, b) => b.purchasedAmountLast90Days - a.purchasedAmountLast90Days)
      .findIndex((s) => s.id === supplier.id) + 1;
  const compraAnual = supplier.purchasedAmountLast90Days * 4;
  const alternativas = suppliers.filter(
    (s) =>
      s.id !== supplier.id &&
      s.status !== "inactive" &&
      s.categories.some((c) => supplier.categories.includes(c))
  );

  // Participación por categoría
  const participacion = supplier.categories
    .map((cat) => {
      const catProducts = products.filter((p) => p.category === cat);
      const catTotal = catProducts.reduce((a, p) => a + sales30Amount(p), 0);
      const supCat = supProducts
        .filter((p) => p.category === cat)
        .reduce((a, p) => a + sales30Amount(p), 0);
      const catMeta = categories.find((c) => c.name === cat);
      return {
        cat,
        part: catTotal > 0 ? (supCat / catTotal) * 100 : 0,
        catMargin: catMeta?.averageMargin ?? 0,
      };
    })
    .sort((a, b) => b.part - a.part);
  const maxPart = participacion[0]?.part ?? 0;

  // Rol del proveedor
  const maxBuy = Math.max(1, ...suppliers.map((s) => s.purchasedAmountLast90Days));
  const share = supplier.purchasedAmountLast90Days / maxBuy;
  const problem = supplier.deliveryCompliance < SUPPLIER_COMPLIANCE_CRITICAL || perf.fillRate < 80;
  const strategic = share >= 0.6 || supplier.associatedSkus >= 200;
  const relevant = share >= 0.3 || supplier.associatedSkus >= 100;
  const role =
    problem && relevant
      ? {
          label: "Problemático",
          tone: "red" as const,
          tip: "Controlar riesgo: exigir cumplimiento, aplicar penalidades y desarrollar un proveedor alternativo.",
        }
      : strategic
        ? {
            label: "Estratégico",
            tone: "violet" as const,
            tip: "Relación de largo plazo: crecimiento conjunto, campañas, exclusividad y abastecimiento asegurado.",
          }
        : relevant
          ? {
              label: "Crítico",
              tone: "amber" as const,
              tip: "Priorizar continuidad, cumplimiento y stock; el precio es secundario.",
            }
          : alternativas.length > 0
            ? {
                label: "Reemplazable",
                tone: "blue" as const,
                tip: "Negociar fuerte costo, plazo, flete y bonificaciones; hay alternativas.",
              }
            : {
                label: "De oportunidad",
                tone: "slate" as const,
                tip: "Compras tácticas: liquidaciones y campañas puntuales.",
              };

  // Objetivos / palancas
  const objetivos: string[] = [];
  if (perf.fillRate < 95)
    objetivos.push(`Asegurar fill rate ≥ 95% (hoy ${perf.fillRate}%) con despacho completo`);
  if (supplier.deliveryCompliance < SUPPLIER_COMPLIANCE_WARN)
    objetivos.push(
      `Subir cumplimiento de entrega a 95% (hoy ${formatPercent(supplier.deliveryCompliance, 0)})`
    );
  if (supplier.averageLeadTimeDays >= 12)
    objetivos.push(
      `Reducir lead time (${formatDays(supplier.averageLeadTimeDays)}) o acordar despacho semanal`
    );
  if (ventaPerdida > 0)
    objetivos.push(
      `Stock de seguridad para frenar venta perdida (~${formatCurrencyCompact(ventaPerdida)}/mes)`
    );
  if (sinRotacion.length > 0)
    objetivos.push(
      `Apoyo del proveedor para liquidar ${sinRotacion.length} producto(s) sin rotación`
    );
  objetivos.push(
    `Usar el volumen (~${formatCurrencyCompact(compraAnual)}/año) para rebate, plazo 60 días y flete`
  );

  const palancas: string[] = [
    `Le compras ~${formatCurrencyCompact(compraAnual)} al año (proveedor #${rankingProv} por compra)`,
    alternativas.length > 0
      ? `Tienes ${alternativas.length} proveedor(es) alternativo(s) en sus categorías`
      : "Sin alternativas: cuidar la relación y asegurar continuidad",
    maxPart > 0
      ? `Representa ${formatPercent(maxPart, 0)} de la venta de ${participacion[0].cat}`
      : "",
  ].filter(Boolean);

  return (
    <div className="space-y-4">
      {/* Rol + objetivo */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-card p-4">
        <div className="flex flex-wrap items-center gap-2 mb-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Rol del proveedor
          </span>
          <Badge tone={role.tone}>{role.label}</Badge>
          <span className="text-xs text-slate-400">· proveedor #{rankingProv} por compra</span>
        </div>
        <p className="text-sm text-slate-700">{role.tip}</p>
      </div>

      {/* Resultado comercial */}
      <Card>
        <CardHeader
          title="Resultado comercial"
          description="Cuánto mueve y cuánto deja este proveedor"
        />
        <CardBody>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
            <GStat label="Venta anual (est.)" value={formatCurrencyCompact(ventaAnual)} />
            <GStat label="Venta 30 días" value={formatCurrencyCompact(ventas30)} />
            <GStat
              label="Margen promedio"
              value={formatPercent(margenProm, 1)}
              tone={margenProm < 25 ? "warn" : "good"}
            />
            <GStat label="Utilidad 30 días" value={formatCurrencyCompact(utilidad30)} tone="good" />
            <GStat
              label="Compra anual (est.)"
              value={formatCurrencyCompact(compraAnual)}
              sub="lo que le compras"
            />
          </div>
        </CardBody>
      </Card>

      {/* Cumplimiento / abastecimiento */}
      <Card>
        <CardHeader
          title="Cumplimiento y abastecimiento"
          description="¿Ayuda o perjudica la disponibilidad?"
        />
        <CardBody>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2.5">
            <GStat
              label="Fill rate"
              value={perf.arrivedOrders > 0 ? `${perf.fillRate}%` : "—"}
              tone={perf.fillRate < 90 ? "bad" : "good"}
              sub="despacho completo"
              hint={<MetricHint metric="fillRate" />}
            />
            <GStat
              label="OTIF"
              value={`${otif}%`}
              tone={otif < 85 ? "warn" : "good"}
              sub="completo y a tiempo"
              hint={<MetricHint metric="otif" />}
            />
            <GStat
              label="Cumplimiento"
              value={formatPercent(supplier.deliveryCompliance, 0)}
              tone={
                supplier.deliveryCompliance < SUPPLIER_COMPLIANCE_CRITICAL
                  ? "bad"
                  : supplier.deliveryCompliance < SUPPLIER_COMPLIANCE_WARN
                    ? "warn"
                    : "good"
              }
              sub="a tiempo"
              hint={<MetricHint metric="cumplimiento" />}
            />
            <GStat
              label="Lead time"
              value={formatDays(supplier.averageLeadTimeDays)}
              tone={supplier.averageLeadTimeDays >= SUPPLIER_LEAD_TIME_WARN_DAYS ? "warn" : undefined}
              hint={<MetricHint metric="leadTime" />}
            />
            <GStat
              label="OC atrasadas"
              value={formatNumber(delayedPOs.length)}
              tone={delayedPOs.length > 0 ? "bad" : "good"}
            />
            <GStat
              label="Venta perdida"
              value={ventaPerdida > 0 ? formatCurrencyCompact(ventaPerdida) : "—"}
              tone={ventaPerdida > 0 ? "bad" : "good"}
              sub={`${conQuiebre.length} SKU en quiebre`}
            />
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Participación por categoría */}
        <Card>
          <CardHeader
            title="Participación por categoría"
            description="Su peso e impacto en margen"
          />
          <CardBody className="space-y-2.5">
            {participacion.map((p) => (
              <div key={p.cat}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-slate-700">{p.cat}</span>
                  <span className="font-semibold text-slate-800">{formatPercent(p.part, 0)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-brand-500"
                    style={{ width: `${Math.max(3, Math.min(100, p.part))}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Margen proveedor {formatPercent(margenProm, 0)} vs categoría{" "}
                  {formatPercent(p.catMargin, 0)}
                </p>
              </div>
            ))}
          </CardBody>
        </Card>

        {/* Mix */}
        <Card>
          <CardHeader title="Mix de productos" description="Qué potenciar, mantener o liquidar" />
          <CardBody>
            <div className="grid grid-cols-3 gap-2.5 mb-3">
              <GStat
                label="En quiebre"
                value={formatNumber(conQuiebre.length)}
                tone={conQuiebre.length > 0 ? "bad" : "good"}
              />
              <GStat
                label="Sin rotación"
                value={formatNumber(sinRotacion.length)}
                tone={sinRotacion.length > 0 ? "warn" : "good"}
              />
              <GStat
                label="En caída"
                value={formatNumber(enCaida.length)}
                tone={enCaida.length > 0 ? "warn" : "good"}
              />
            </div>
            <p className="text-xs font-semibold text-slate-500 mb-1.5">Top vendidos</p>
            <div className="space-y-1">
              {topSold.length === 0 ? (
                <p className="text-sm text-slate-400">Sin ventas registradas.</p>
              ) : (
                topSold.map((p, i) => (
                  <Link
                    key={p.sku}
                    to={`/productos/${p.sku}`}
                    className="flex items-center gap-2 text-sm rounded px-1.5 py-1 hover:bg-slate-50"
                  >
                    <span className="w-4 text-center text-xs font-bold text-slate-400">
                      {i + 1}
                    </span>
                    <span className="flex-1 min-w-0 truncate text-slate-700">{p.name}</span>
                    <span className="text-xs font-semibold text-slate-600">
                      {formatCurrencyCompact(sales30Amount(p))}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Productos clave para negociar */}
      <NegotiationProductTable prods={supProducts} />

      {/* Riesgo + Próxima negociación */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Riesgo y dependencia" />
          <CardBody className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2.5">
              <GStat
                label="Dependencia"
                value={maxPart >= 40 ? "Alta" : maxPart >= 20 ? "Media" : "Baja"}
                tone={maxPart >= 40 ? "bad" : maxPart >= 20 ? "warn" : "good"}
                sub={`${formatPercent(maxPart, 0)} de su categoría top`}
              />
              <GStat
                label="Alternativas"
                value={formatNumber(alternativas.length)}
                tone={alternativas.length === 0 ? "warn" : "good"}
                sub="proveedores que pueden cubrir"
              />
            </div>
            {alternativas.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1.5">
                  Proveedores alternativos
                </p>
                <div className="space-y-1.5">
                  {alternativas.map((s) => (
                    <Link
                      key={s.id}
                      to={`/proveedores/${s.id}`}
                      className="flex items-center gap-2 text-sm rounded-lg border border-slate-200 px-2.5 py-1.5 hover:border-brand-300 hover:bg-brand-50/40"
                    >
                      <span className="flex-1 min-w-0 truncate text-slate-700">{s.name}</span>
                      <span className="text-xs text-slate-400">
                        lead {formatDays(s.averageLeadTimeDays)} · cumple{" "}
                        {formatPercent(s.deliveryCompliance, 0)}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Próxima negociación" description="Qué exigir y con qué argumentos" />
          <CardBody>
            <p className="text-xs font-semibold text-slate-500 mb-1.5">Objetivos sugeridos</p>
            <ul className="space-y-1.5 mb-3">
              {objetivos.map((o, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="text-brand-500 mt-0.5">▸</span>
                  <span>{o}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs font-semibold text-slate-500 mb-1.5">Palancas a tu favor</p>
            <ul className="space-y-1.5">
              {palancas.map((p, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                  <span className="text-emerald-500 mt-0.5">✓</span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}


// ---------------------------------------------------------------------------
type NegView = "venta" | "dias" | "margen" | "ganancia";

const NEG_VIEWS: { key: NegView; label: string }[] = [
  { key: "venta", label: "Más vendidos" },
  { key: "dias", label: "Más días de inventario" },
  { key: "margen", label: "Menor margen" },
  { key: "ganancia", label: "Mayor ganancia" },
];

function NegotiationProductTable({ prods }: { prods: typeof products }) {
  const [view, setView] = useState<NegView>("venta");

  const rows = prods.map((p) => ({
    p,
    venta: p.salesLast30Days * p.price,
    dias: p.inventoryDays,
    margen: p.margin,
    ganancia: p.salesLast30Days * (p.price - p.cost),
  }));
  const sorted = [...rows]
    .sort((a, b) => (view === "margen" ? a.margen - b.margen : b[view] - a[view]))
    .slice(0, 10);

  const colClass = (k: NegView) => (view === k ? "text-brand-700 font-semibold" : "text-slate-500");

  return (
    <Card>
      <CardHeader
        title="Datos clave para negociar"
        description="Top 10 según la vista elegida. Ordena por lo que quieras poner sobre la mesa."
      />
      <CardBody className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {NEG_VIEWS.map((v) => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                view === v.key
                  ? "bg-brand-600 text-white border-brand-600"
                  : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        {sorted.length === 0 ? (
          <EmptyState title="Sin productos" description="Este proveedor no tiene SKUs asociados." />
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="border-b border-slate-200 text-xs">
                  <th className="text-left font-medium text-slate-500 py-2 pl-1">Producto</th>
                  <th className={`text-right font-medium py-2 px-2 ${colClass("venta")}`}>
                    Venta 30d
                  </th>
                  <th className={`text-right font-medium py-2 px-2 ${colClass("dias")}`}>
                    Días inv.
                  </th>
                  <th className={`text-right font-medium py-2 px-2 ${colClass("margen")}`}>
                    Margen
                  </th>
                  <th className={`text-right font-medium py-2 px-2 pr-1 ${colClass("ganancia")}`}>
                    Ganancia 30d
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sorted.map(({ p, venta, dias, margen, ganancia }) => (
                  <tr key={p.sku} className="hover:bg-slate-50">
                    <td className="py-2 pl-1 min-w-0">
                      <Link to={`/productos/${p.sku}`} className="group block">
                        <span className="text-slate-800 group-hover:text-brand-700 group-hover:underline">
                          {p.name}
                        </span>
                        <span className="block text-xs text-slate-400">
                          {p.sku} · vende {formatNumber(p.salesLast30Days)}/mes
                        </span>
                      </Link>
                    </td>
                    <td
                      className={`text-right py-2 px-2 tabular-nums ${view === "venta" ? "font-semibold text-slate-900" : "text-slate-600"}`}
                    >
                      {formatCurrencyCompact(venta)}
                    </td>
                    <td
                      className={`text-right py-2 px-2 tabular-nums ${dias >= 90 ? "text-amber-600 font-medium" : "text-slate-600"} ${view === "dias" ? "font-semibold" : ""}`}
                    >
                      {formatNumber(dias)}
                    </td>
                    <td
                      className={`text-right py-2 px-2 tabular-nums ${margen < 20 ? "text-rose-600 font-medium" : margen < 30 ? "text-amber-600" : "text-slate-600"} ${view === "margen" ? "font-semibold" : ""}`}
                    >
                      {formatPercent(margen, 0)}
                    </td>
                    <td
                      className={`text-right py-2 px-2 pr-1 tabular-nums ${view === "ganancia" ? "font-semibold text-emerald-700" : "text-slate-600"}`}
                    >
                      {formatCurrencyCompact(ganancia)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

