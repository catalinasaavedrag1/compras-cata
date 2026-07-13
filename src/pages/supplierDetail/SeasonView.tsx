import { Link } from "react-router-dom";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { MonthlyBars } from "../../components/business/SeasonalityChart";
import { MetricHint } from "../../components/business/supplierMetricHelp";
import { GStat } from "./GStat";
import { supplierSeasonality } from "../../utils/seasonality";
import type { Supplier } from "../../types/purchasing";
import { formatCurrencyCompact, formatDays, formatNumber, formatPercent } from "../../utils/formatters";

/** Vista de estacionalidad: temporadas, cumplimiento en peak y qué negociar antes. */
export function SeasonView({ supplier }: { supplier: Supplier }) {
  const s = supplierSeasonality(supplier.name);
  const last12 = s.series.slice(12);
  const maxSales = Math.max(1, ...s.series.map((p) => p.sales));
  const last12avg = last12.reduce((a, p) => a + p.sales, 0) / (last12.length || 1);
  const scoreTone = s.score >= 80 ? "good" : s.score >= 60 ? "warn" : "bad";

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
        <GStat
          label="Fill rate"
          value={`${s.fill}%`}
          tone={s.fill < 90 ? "bad" : "good"}
          hint={<MetricHint metric="fillRate" />}
        />
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

        {/* Curva de venta (12 meses) */}
        <Card>
          <CardHeader title="Curva de venta (12 meses)" description="Tendencia y meses peak" />
          <CardBody>
            <MonthlyBars
              data={last12.map((p) => ({
                label: p.label.split(" ")[0],
                value: p.sales,
                highlight: p.sales >= (last12avg || 1) * 1.1,
              }))}
              format={(n) => formatCurrencyCompact(n)}
              height={120}
            />
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
