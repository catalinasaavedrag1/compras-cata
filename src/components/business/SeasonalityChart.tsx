import { cn } from "../../utils/cn";
import {
  CHANNEL_META,
  DEMAND_CHANNELS,
  type ChannelMonthly,
  type DemandChannel,
} from "../../utils/channelDemand";

// ============================================================================
//  Gráficos de temporada
//  · MonthlyBars: barras mensuales con peak resaltado y línea de promedio.
//  · StackedChannelBars: barras apiladas por canal (por qué se compra cada mes).
//  Sin dependencias: SVG/flex puro, responsive y con tooltip por barra.
// ============================================================================

export interface MonthBar {
  label: string;
  value: number;
  /** Resalta la barra (p. ej. mes peak o mes actual). */
  highlight?: boolean;
}

export function MonthlyBars({
  data,
  format,
  height = 160,
}: {
  data: MonthBar[];
  format?: (n: number) => string;
  height?: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const avg = data.reduce((a, d) => a + d.value, 0) / (data.length || 1);
  const avgPct = (avg / max) * 100;

  return (
    <div>
      <div className="relative flex items-end gap-1" style={{ height }}>
        {/* Línea de promedio anual (etiqueta a la izquierda, con fondo para no
            solaparse con las barras; bajo la línea si el promedio está muy alto). */}
        <div
          className="pointer-events-none absolute inset-x-0 border-t border-dashed border-slate-300"
          style={{ bottom: `${avgPct}%` }}
        >
          <span
            className={cn(
              "absolute left-0 rounded bg-white/80 px-1 text-[10px] text-slate-400",
              avgPct > 82 ? "top-0.5" : "-top-4"
            )}
          >
            promedio {format ? format(avg) : Math.round(avg)}
          </span>
        </div>
        {data.map((d) => (
          <div key={d.label} className="flex h-full flex-1 flex-col justify-end">
            <div
              title={`${d.label}: ${format ? format(d.value) : d.value}`}
              className={cn(
                "w-full rounded-t transition-colors",
                d.highlight ? "bg-brand-600" : "bg-brand-300 hover:bg-brand-400"
              )}
              style={{ height: `${Math.max(2, (d.value / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1">
        {data.map((d) => (
          <span
            key={d.label}
            className={cn(
              "flex-1 text-center text-[10px]",
              d.highlight ? "font-semibold text-brand-700" : "text-slate-400"
            )}
          >
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function StackedChannelBars({
  monthly,
  height = 180,
  formatUnits,
}: {
  monthly: ChannelMonthly[];
  height?: number;
  formatUnits?: (n: number) => string;
}) {
  const max = Math.max(1, ...monthly.map((m) => m.total));
  const fmt = formatUnits ?? ((n: number) => `${n}`);
  // De abajo hacia arriba: tienda primero. flex-col justify-end apila el último
  // hijo abajo, así que invertimos el orden de los canales.
  const stackOrder = [...DEMAND_CHANNELS].reverse();

  return (
    <div>
      <div className="flex items-end gap-1" style={{ height }}>
        {monthly.map((m) => {
          const tip = DEMAND_CHANNELS.map(
            (ch) => `${CHANNEL_META[ch].short}: ${fmt(m.byChannel[ch])}`
          ).join(" · ");
          // Índice del primer canal (de arriba hacia abajo) con altura > 0,
          // para redondear el tope real de la barra aunque el canal superior sea 0.
          const topIdx = stackOrder.findIndex((ch) => m.byChannel[ch] > 0);
          return (
            <div
              key={m.label}
              className="flex h-full flex-1 flex-col justify-end"
              title={`${m.label} — total ${fmt(m.total)}\n${tip}`}
            >
              {stackOrder.map((ch, i) => {
                const h = (m.byChannel[ch] / max) * 100;
                if (h <= 0) return null;
                return (
                  <div
                    key={ch}
                    className={cn(i === topIdx && "rounded-t")}
                    style={{ height: `${h}%`, background: CHANNEL_META[ch].color }}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-1">
        {monthly.map((m) => (
          <span key={m.label} className="flex-1 text-center text-[10px] text-slate-400">
            {m.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ChannelLegend({
  channels = DEMAND_CHANNELS,
  className,
}: {
  channels?: DemandChannel[];
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-x-4 gap-y-1.5", className)}>
      {channels.map((ch) => (
        <span key={ch} className="inline-flex items-center gap-1.5 text-xs text-slate-600">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: CHANNEL_META[ch].color }} />
          {CHANNEL_META[ch].label}
        </span>
      ))}
    </div>
  );
}
