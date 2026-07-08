import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { ConfirmModal } from "../components/ui/ConfirmModal";
import { Input } from "../components/ui/Input";
import { EmptyState } from "../components/ui/EmptyState";
import { useLocalStorage } from "../utils/useLocalStorage";
import { useToast } from "../context/ToastContext";
import { StatusBadge } from "../components/business/StatusBadge";
import { suppliers } from "../data/mockSuppliers";
import { products } from "../data/mockProducts";
import { categories } from "../data/mockCategories";
import { purchaseOrders } from "../data/mockPurchaseOrders";
import { supplierFulfillment } from "../utils/supplierPerf";
import { supplierSeasonality } from "../utils/seasonality";
import { hashString as hashN } from "../utils/hash";
import type { Supplier } from "../types/purchasing";
import {
  formatCurrency,
  formatCurrencyCompact,
  formatDate,
  formatDays,
  formatNumber,
  formatPercent,
} from "../utils/formatters";

function GStat({
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
  const problem = supplier.deliveryCompliance < 70 || perf.fillRate < 80;
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
  if (supplier.deliveryCompliance < 85)
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
            />
            <GStat
              label="OTIF"
              value={`${otif}%`}
              tone={otif < 85 ? "warn" : "good"}
              sub="completo y a tiempo"
            />
            <GStat
              label="Cumplimiento"
              value={formatPercent(supplier.deliveryCompliance, 0)}
              tone={
                supplier.deliveryCompliance < 70
                  ? "bad"
                  : supplier.deliveryCompliance < 85
                    ? "warn"
                    : "good"
              }
              sub="a tiempo"
            />
            <GStat
              label="Lead time"
              value={formatDays(supplier.averageLeadTimeDays)}
              tone={supplier.averageLeadTimeDays >= 15 ? "warn" : undefined}
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

/** Vista de estacionalidad: temporadas, cumplimiento en peak y qué negociar antes. */
export function SeasonView({ supplier }: { supplier: Supplier }) {
  const s = supplierSeasonality(supplier.name);
  const last12 = s.series.slice(12);
  const maxSales = Math.max(1, ...s.series.map((p) => p.sales));
  const scoreTone = s.score >= 80 ? "good" : s.score >= 60 ? "warn" : "bad";

  // Curva 24 meses (SVG)
  const W = 240;
  const H = 56;
  const pts = s.series
    .map(
      (p, i) =>
        `${((i / (s.series.length - 1)) * W).toFixed(1)},${(H - (p.sales / maxSales) * H).toFixed(1)}`
    )
    .join(" ");

  return (
    <div className="space-y-4">
      {/* Pre-temporada alerta */}
      {s.preSeason && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          ⏳ <b>Entra en temporada alta en ~{s.preSeason.days} días</b> (peak histórico en{" "}
          {s.preSeason.month}). Stock actual y fill {s.fill}% · lead {formatDays(s.leadTime)}.
          Conviene negociar la OC y el stock reservado ahora.
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2.5">
        <GStat label="Venta 12m" value={formatCurrencyCompact(s.ventaActual)} />
        <GStat
          label="vs 12m previos"
          value={`${s.varPct >= 0 ? "+" : ""}${formatPercent(s.varPct, 0)}`}
          tone={s.varPct >= 0 ? "good" : "bad"}
        />
        <GStat
          label="Margen prom."
          value={formatPercent(s.marginAvg, 0)}
          tone={s.marginAvg < 25 ? "warn" : "good"}
        />
        <GStat
          label="Quiebres 12m"
          value={formatNumber(s.quiebres12)}
          tone={s.quiebres12 >= 8 ? "bad" : "good"}
        />
        <GStat label="Fill rate" value={`${s.fill}%`} tone={s.fill < 90 ? "bad" : "good"} />
        <GStat
          label="Venta perdida"
          value={s.lost12 > 0 ? formatCurrencyCompact(s.lost12) : "—"}
          tone={s.lost12 > 0 ? "bad" : "good"}
          sub="12 meses"
        />
        <GStat label="Score temporada" value={`${s.score}`} tone={scoreTone} sub="0-100" />
      </div>

      {/* Clasificación */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-card p-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Comportamiento
        </span>
        <Badge tone={s.classification.tone}>{s.classification.label}</Badge>
        {s.peakMonths.length > 0 && (
          <span className="text-sm text-slate-600">
            Meses clave: <b className="text-slate-800">{s.peakMonths.join(" · ")}</b>
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Heatmap 12 meses */}
        <Card>
          <CardHeader
            title="Estacionalidad (últimos 12 meses)"
            description="Intensidad de venta y quiebres por mes"
          />
          <CardBody>
            <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
              {last12.map((p) => {
                const intensity = p.sales / maxSales;
                return (
                  <div key={p.ym} className="text-center">
                    <div
                      className="h-10 rounded-md flex items-center justify-center text-[10px] font-semibold"
                      style={{
                        background: `rgba(31,73,214,${0.12 + intensity * 0.8})`,
                        color: intensity > 0.55 ? "#fff" : "#1e3a8a",
                      }}
                      title={`${p.label}: ${formatCurrencyCompact(p.sales)} · ${p.stockouts} quiebres`}
                    >
                      {p.stockouts > 0 ? `⚠${p.stockouts}` : ""}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">{p.label.split(" ")[0]}</p>
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              Más oscuro = más venta. ⚠ = quiebres ese mes.
            </p>
          </CardBody>
        </Card>

        {/* Curva 24 meses */}
        <Card>
          <CardHeader title="Curva de venta (24 meses)" description="Tendencia y temporadas" />
          <CardBody>
            <svg
              viewBox={`0 0 ${W} ${H}`}
              preserveAspectRatio="none"
              className="w-full"
              style={{ height: 90 }}
            >
              <polyline
                points={pts}
                fill="none"
                stroke="#1f49d6"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-slate-400">{s.series[0].label}</span>
              <span className="text-[10px] text-slate-400">
                {s.series[s.series.length - 1].label}
              </span>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Comparación año contra año */}
      <Card>
        <CardHeader
          title="Comparación año contra año"
          description="Mismo mes en cada año: detecta si la temporada crece o se adelanta"
        />
        <CardBody className="overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[560px]">
            <thead>
              <tr className="text-xs text-slate-400">
                <th className="text-left font-medium py-1.5 pr-2">Mes</th>
                {s.years.map((y) => (
                  <th key={y} className="text-right font-medium py-1.5 px-2">
                    {y}
                  </th>
                ))}
                <th className="text-right font-medium py-1.5 pl-2">Var. último año</th>
              </tr>
            </thead>
            <tbody>
              {s.yoyByMonth.map((row) => {
                const last = s.years[s.years.length - 1];
                const prev = s.years[s.years.length - 2];
                const vNow = row.values[last];
                const vPrev = prev != null ? row.values[prev] : null;
                const varPct =
                  vNow != null && vPrev != null && vPrev > 0 ? (vNow / vPrev - 1) * 100 : null;
                const isPeak = s.peakMonths.includes(row.label);
                return (
                  <tr
                    key={row.monthIdx}
                    className={`border-t border-slate-50 ${isPeak ? "bg-brand-50/40" : ""}`}
                  >
                    <td className="py-1.5 pr-2 text-slate-700">
                      {row.label}
                      {isPeak && (
                        <span className="ml-1 text-[10px] text-brand-500 font-semibold">peak</span>
                      )}
                    </td>
                    {s.years.map((y) => (
                      <td key={y} className="text-right py-1.5 px-2 text-slate-600 tabular-nums">
                        {row.values[y] != null ? (
                          formatCurrencyCompact(row.values[y]!)
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    ))}
                    <td className="text-right py-1.5 pl-2 tabular-nums">
                      {varPct != null ? (
                        <span
                          className={
                            varPct >= 0
                              ? "text-emerald-600 font-medium"
                              : "text-rose-600 font-medium"
                          }
                        >
                          {varPct >= 0 ? "+" : ""}
                          {formatPercent(varPct, 0)}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="text-[11px] text-slate-400 mt-2">
            Filas resaltadas = meses de temporada alta. La última columna compara el año en curso
            con el anterior.
          </p>
        </CardBody>
      </Card>

      {/* Estacionalidad por SKU */}
      <Card>
        <CardHeader
          title="Estacionalidad por producto"
          description="Cómo se comporta cada SKU: campañero, estacional o permanente"
        />
        <CardBody className="space-y-1.5">
          {s.skuSeasonality.length === 0 ? (
            <p className="text-sm text-slate-400">Sin productos para clasificar.</p>
          ) : (
            s.skuSeasonality.map((p) => (
              <Link
                key={p.sku}
                to={`/productos/${p.sku}`}
                className="flex items-start gap-3 rounded-lg border border-slate-100 px-3 py-2 hover:border-brand-300 hover:bg-brand-50/40"
              >
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-800 truncate">{p.name}</span>
                    <Badge tone={p.tone}>{p.type}</Badge>
                  </span>
                  <span className="block text-xs text-slate-500 mt-0.5">{p.insight}</span>
                </span>
                <span className="text-right flex-shrink-0">
                  <span className="block text-sm font-semibold text-slate-700">{p.peakMonth}</span>
                  <span className="block text-[11px] text-slate-400">
                    {p.inSeasonPct}% en temporada
                  </span>
                </span>
              </Link>
            ))
          )}
        </CardBody>
      </Card>

      {/* Pre / Temporada / Post */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          {
            t: "Pretemporada",
            c: "border-blue-200 bg-blue-50",
            items: [
              "Negociar costo y stock reservado",
              "Confirmar disponibilidad del proveedor",
              "Crear OC anticipada",
              "Definir campañas",
            ],
          },
          {
            t: "Temporada",
            c: "border-emerald-200 bg-emerald-50",
            items: [
              "Monitorear venta semanal",
              "Reponer rápido para evitar quiebres",
              "Exigir despacho parcial",
              "Activar campañas",
            ],
          },
          {
            t: "Postemporada",
            c: "border-amber-200 bg-amber-50",
            items: [
              "Liquidar productos lentos",
              "Devolver lo acordado",
              "Medir resultado y fill",
              "Evaluar al proveedor",
            ],
          },
        ].map((b) => (
          <div key={b.t} className={`rounded-xl border ${b.c} p-3`}>
            <p className="text-sm font-semibold text-slate-800 mb-1.5">{b.t}</p>
            <ul className="space-y-1">
              {b.items.map((it) => (
                <li key={it} className="text-xs text-slate-600 flex gap-1.5">
                  <span className="text-slate-400">·</span>
                  {it}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Top productos de temporada */}
      <Card>
        <CardHeader
          title="Top productos de temporada"
          description="Qué explica la temporada y qué hacer con cada uno"
        />
        <CardBody className="space-y-1.5">
          {s.topProducts.map((p) => (
            <Link
              key={p.sku}
              to={`/productos/${p.sku}`}
              className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2 hover:border-brand-300 hover:bg-brand-50/40"
            >
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium text-slate-800 truncate">{p.name}</span>
                <span className="block text-xs text-slate-400">
                  {p.type} · margen {formatPercent(p.margin, 0)}
                </span>
              </span>
              <span className="text-sm font-semibold text-slate-700 flex-shrink-0">
                {formatCurrencyCompact(p.sales)}
              </span>
              <Badge tone="blue">{p.action}</Badge>
            </Link>
          ))}
        </CardBody>
      </Card>

      {/* Recomendación */}
      <div className="rounded-xl border border-brand-100 bg-brand-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 mb-1">
          Conclusión y recomendación
        </p>
        <p className="text-sm text-brand-900 leading-relaxed">{s.recommendation}</p>
      </div>
    </div>
  );
}

interface SupplierTerms {
  paymentDays: number;
  freight: string;
  minOrder: string;
  baseDiscount: number;
  rebate: string;
  returns: string;
  marketing: string;
  account: string;
}

interface Agreement {
  id: string;
  date: string;
  objective: string;
  agreed: string;
  followUp: string;
}

const DEFAULT_TERMS: SupplierTerms = {
  paymentDays: 30,
  freight: "Por pagar (cliente)",
  minOrder: "$500.000",
  baseDiscount: 0,
  rebate: "Sin rebate vigente",
  returns: "Solo por falla · 30 días",
  marketing: "Sin apoyo acordado",
  account: "—",
};

/** Condiciones comerciales (editables) + acuerdos y seguimiento, persistidos por proveedor. */
export function SupplierTermsAgreements({ supplier }: { supplier: Supplier }) {
  const toast = useToast();
  const [terms, setTerms] = useLocalStorage<SupplierTerms>(
    `compras:terms:${supplier.id}`,
    DEFAULT_TERMS
  );
  const [agreements, setAgreements] = useLocalStorage<Agreement[]>(
    `compras:agreements:${supplier.id}`,
    []
  );
  const [editTerms, setEditTerms] = useState(false);
  const [draft, setDraft] = useState<SupplierTerms>(terms);
  const [newAgr, setNewAgr] = useState<Agreement | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const termsDirty = JSON.stringify(draft) !== JSON.stringify(terms);
  const openTerms = () => {
    setDraft(terms);
    setEditTerms(true);
  };
  const closeTerms = () => (termsDirty ? setConfirmDiscard(true) : setEditTerms(false));
  const saveTerms = () => {
    setTerms(draft);
    setEditTerms(false);
    toast.success("Condiciones comerciales actualizadas");
  };

  const openAgr = () =>
    setNewAgr({
      id: `ag${Date.now()}`,
      date: "2026-06-26",
      objective: "",
      agreed: "",
      followUp: "",
    });
  const saveAgr = () => {
    if (!newAgr || !newAgr.objective.trim()) {
      toast.warning("Indica al menos el objetivo");
      return;
    }
    setAgreements((prev) => [newAgr, ...prev]);
    setNewAgr(null);
    toast.success("Acuerdo registrado");
  };

  const termRows: { label: string; value: string }[] = [
    { label: "Plazo de pago", value: `${terms.paymentDays} días` },
    { label: "Descuento base", value: `${terms.baseDiscount}%` },
    { label: "Flete", value: terms.freight },
    { label: "Mínimo de compra", value: terms.minOrder },
    { label: "Rebate / bonificación", value: terms.rebate },
    { label: "Devoluciones", value: terms.returns },
    { label: "Apoyo marketing", value: terms.marketing },
    { label: "Ejecutivo asignado", value: terms.account },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Condiciones comerciales */}
      <Card>
        <CardHeader
          title="Condiciones comerciales"
          description="La foto completa de lo acordado hoy"
          action={
            <button
              onClick={openTerms}
              className="text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              Editar
            </button>
          }
        />
        <CardBody>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
            {termRows.map((r) => (
              <div key={r.label} className="flex flex-col">
                <span className="text-[11px] text-slate-400">{r.label}</span>
                <span className="text-sm font-medium text-slate-800">{r.value}</span>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Acuerdos y seguimiento */}
      <Card>
        <CardHeader
          title="Acuerdos y seguimiento"
          description="Qué se pidió, qué se acordó y el próximo seguimiento"
          action={
            <Button size="sm" variant="secondary" onClick={openAgr}>
              + Registrar
            </Button>
          }
        />
        <CardBody>
          {agreements.length === 0 ? (
            <p className="text-sm text-slate-400">
              Sin acuerdos registrados. Registra lo conversado en la próxima reunión.
            </p>
          ) : (
            <div className="space-y-2.5">
              {agreements.map((a) => (
                <div key={a.id} className="rounded-lg border border-slate-200 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-semibold text-slate-700">
                      {formatDate(a.date)}
                    </span>
                    {a.followUp && <Badge tone="amber">Seguir {formatDate(a.followUp)}</Badge>}
                  </div>
                  <p className="text-sm text-slate-800">
                    <span className="text-slate-400">Objetivo:</span> {a.objective}
                  </p>
                  {a.agreed && (
                    <p className="text-sm text-emerald-700 mt-0.5">
                      <span className="text-slate-400">Acordado:</span> {a.agreed}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Modal editar condiciones */}
      <Modal
        open={editTerms}
        onClose={closeTerms}
        title="Editar condiciones comerciales"
        description={supplier.name}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={closeTerms}>
              Cancelar
            </Button>
            <Button onClick={saveTerms} disabled={!termsDirty}>
              {termsDirty ? "Guardar" : "Sin cambios"}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Plazo de pago (días)
            </label>
            <Input
              type="number"
              min={0}
              value={draft.paymentDays}
              onChange={(e) => setDraft({ ...draft, paymentDays: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Descuento base (%)
            </label>
            <Input
              type="number"
              min={0}
              value={draft.baseDiscount}
              onChange={(e) => setDraft({ ...draft, baseDiscount: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Flete</label>
            <Input
              value={draft.freight}
              onChange={(e) => setDraft({ ...draft, freight: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Mínimo de compra
            </label>
            <Input
              value={draft.minOrder}
              onChange={(e) => setDraft({ ...draft, minOrder: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Rebate / bonificación
            </label>
            <Input
              value={draft.rebate}
              onChange={(e) => setDraft({ ...draft, rebate: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Devoluciones
            </label>
            <Input
              value={draft.returns}
              onChange={(e) => setDraft({ ...draft, returns: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Apoyo marketing
            </label>
            <Input
              value={draft.marketing}
              onChange={(e) => setDraft({ ...draft, marketing: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Ejecutivo asignado
            </label>
            <Input
              value={draft.account}
              onChange={(e) => setDraft({ ...draft, account: e.target.value })}
            />
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={confirmDiscard}
        title="Descartar cambios"
        message="Tienes cambios sin guardar en las condiciones comerciales. Si sales ahora se perderán."
        confirmLabel="Descartar cambios"
        cancelLabel="Seguir editando"
        danger
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={() => {
          setConfirmDiscard(false);
          setEditTerms(false);
        }}
      />

      {/* Modal registrar acuerdo */}
      <Modal
        open={!!newAgr}
        onClose={() => setNewAgr(null)}
        title="Registrar acuerdo"
        description={supplier.name}
        footer={
          <>
            <Button variant="secondary" onClick={() => setNewAgr(null)}>
              Cancelar
            </Button>
            <Button onClick={saveAgr}>Guardar</Button>
          </>
        }
      >
        {newAgr && (
          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Fecha</label>
              <Input
                type="date"
                value={newAgr.date}
                onChange={(e) => setNewAgr({ ...newAgr, date: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Objetivo / lo pedido
              </label>
              <Input
                value={newAgr.objective}
                onChange={(e) => setNewAgr({ ...newAgr, objective: e.target.value })}
                placeholder="Ej: Bajar costo 5% y fill 95%"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Lo acordado
              </label>
              <Input
                value={newAgr.agreed}
                onChange={(e) => setNewAgr({ ...newAgr, agreed: e.target.value })}
                placeholder="Ej: 3% + despacho semanal"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Próximo seguimiento
              </label>
              <Input
                type="date"
                value={newAgr.followUp}
                onChange={(e) => setNewAgr({ ...newAgr, followUp: e.target.value })}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
//  Evaluación del proveedor (score 0–100). Cumplimiento de fecha y cantidad
//  usan datos reales; el resto de dimensiones son simuladas (demo) de forma
//  determinista a partir del id del proveedor.
// ---------------------------------------------------------------------------

interface EvalDim {
  label: string;
  value: number;
}

function supplierEvaluation(supplier: Supplier): { score: number; dims: EvalDim[] } {
  const h = hashN(supplier.id);
  const perf = supplierFulfillment(supplier.name);
  const fecha = Math.round(supplier.deliveryCompliance);
  const cantidad =
    perf.fillRate || Math.max(40, Math.round(supplier.deliveryCompliance - 4 + (h % 10)));
  const calidad = 70 + (h % 26); // 70–95
  const factura = 91 + (h % 9); // exactitud de facturación 91–99
  const documentos = 80 + ((h >> 3) % 18); // 80–97
  const precios = 78 + ((h >> 5) % 22); // estabilidad de precios 78–99
  const dims: EvalDim[] = [
    { label: "Cumplimiento de fecha", value: fecha },
    { label: "Cumplimiento de cantidad", value: cantidad },
    { label: "Calidad", value: calidad },
    { label: "Exactitud de factura", value: factura },
    { label: "Exactitud documental", value: documentos },
    { label: "Estabilidad de precios", value: precios },
  ];
  const weights = [0.28, 0.22, 0.18, 0.12, 0.1, 0.1];
  const score = Math.round(dims.reduce((a, d, i) => a + d.value * weights[i], 0));
  return { score, dims };
}

function scoreTone(v: number): "green" | "amber" | "red" {
  if (v >= 85) return "green";
  if (v >= 70) return "amber";
  return "red";
}

const BAR_COLOR: Record<string, string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-rose-500",
};

function ContactCard({
  title,
  contact,
}: {
  title: string;
  contact?: { nombre: string; email: string; telefono: string };
}) {
  return (
    <div className="rounded-lg border border-slate-200 px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{title}</p>
      {contact ? (
        <div className="mt-1">
          <p className="text-sm font-medium text-slate-800">{contact.nombre}</p>
          <p className="text-xs text-slate-500 truncate">{contact.email}</p>
          <p className="text-xs text-slate-500">{contact.telefono}</p>
        </div>
      ) : (
        <p className="text-xs text-slate-400 mt-1">Sin contacto registrado</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
//  Tabla de productos clave para la negociación: permite ver de un vistazo los
//  más vendidos, los que más días de inventario acumulan, los de menor margen
//  y los de mayor ganancia — la información que se pone sobre la mesa al negociar.
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

/** Ficha maestra del proveedor (#1) + evaluación multidimensional (#11). */
export function SupplierMaster({ supplier }: { supplier: Supplier }) {
  const { score, dims } = supplierEvaluation(supplier);
  const minimo =
    supplier.minimoCompra != null
      ? supplier.minimoCompraTipo === "unidades"
        ? `${formatNumber(supplier.minimoCompra)} u.`
        : formatCurrency(supplier.minimoCompra)
      : "—";

  return (
    <div className="space-y-4">
      {/* Datos y contactos */}
      <Card>
        <CardHeader
          title="Ficha del proveedor"
          description="Datos maestros, contactos y condiciones comerciales."
        />
        <CardBody className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-xs text-slate-400">RUT</p>
              <p className="text-slate-800 font-medium">{supplier.rut}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Estado</p>
              <StatusBadge kind="supplier" value={supplier.status} />
            </div>
            <div>
              <p className="text-xs text-slate-400">Condición de pago</p>
              <p className="text-slate-800">{supplier.condicionPago ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Plazo de entrega</p>
              <p className="text-slate-800">
                {supplier.plazoEntregaDias != null
                  ? formatDays(supplier.plazoEntregaDias)
                  : formatDays(supplier.averageLeadTimeDays)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Mínimo de compra</p>
              <p className="text-slate-800">{minimo}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Categorías</p>
              <p className="text-slate-800">{supplier.categories.join(", ")}</p>
            </div>
          </div>

          {supplier.marcas && supplier.marcas.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1.5">Marcas que representa</p>
              <div className="flex flex-wrap gap-1.5">
                {supplier.marcas.map((m) => (
                  <Badge key={m} tone="neutral">
                    {m}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <ContactCard title="Comercial" contact={supplier.contactoComercial} />
            <ContactCard title="Logística" contact={supplier.contactoLogistica} />
            <ContactCard title="Cobranza" contact={supplier.contactoCobranza} />
          </div>
        </CardBody>
      </Card>

      {/* Evaluación (#11) */}
      <Card>
        <CardHeader
          title="Evaluación del proveedor"
          description="Score ponderado. Fecha y cantidad son datos reales; el resto es simulado (demo)."
          action={<Badge tone={scoreTone(score)}>{score}/100</Badge>}
        />
        <CardBody className="space-y-2.5">
          {dims.map((d) => (
            <div key={d.label} className="flex items-center gap-3">
              <span className="w-44 text-sm text-slate-600 flex-shrink-0">{d.label}</span>
              <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full ${BAR_COLOR[scoreTone(d.value)]}`}
                  style={{ width: `${Math.min(100, Math.max(3, d.value))}%` }}
                />
              </div>
              <span className="w-10 text-right text-sm font-medium text-slate-800">{d.value}</span>
            </div>
          ))}
        </CardBody>
      </Card>

      {/* Documentos tributarios y acuerdos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Documentos tributarios" />
          <CardBody className="space-y-2">
            {supplier.documentosTributarios && supplier.documentosTributarios.length > 0 ? (
              supplier.documentosTributarios.map((d) => (
                <div
                  key={`${d.tipo}-${d.numero}`}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="min-w-0">
                    <span className="text-slate-800">{d.tipo}</span>{" "}
                    <span className="text-xs text-slate-400 font-mono">{d.numero}</span>
                    {d.vence && (
                      <span className="text-xs text-slate-400"> · vence {formatDate(d.vence)}</span>
                    )}
                  </span>
                  <Badge tone={d.vigente ? "green" : "red"}>
                    {d.vigente ? "Vigente" : "Vencido"}
                  </Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">Sin documentos registrados.</p>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Acuerdos comerciales" />
          <CardBody className="space-y-2">
            {supplier.acuerdosComerciales && supplier.acuerdosComerciales.length > 0 ? (
              supplier.acuerdosComerciales.map((a) => (
                <div key={a.titulo} className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-sm font-medium text-slate-800">{a.titulo}</p>
                  <p className="text-xs text-slate-500">{a.detalle}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">Sin acuerdos registrados.</p>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
