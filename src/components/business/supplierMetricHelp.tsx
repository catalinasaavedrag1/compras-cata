import type { ReactNode } from "react";
import { InfoHint } from "./InfoHint";

// ============================================================================
//  Ayuda contextual de los indicadores del proveedor.
//  Cada indicador tiene su propia explicación, corta y legible. Cumplimiento y
//  Despacho comparten además una "Interpretación" con las 4 combinaciones
//  posibles, porque solo juntos describen al proveedor.
//  Se consume con <MetricHint metric="..." /> junto a la etiqueta del dato.
// ============================================================================

function P({ children }: { children: ReactNode }) {
  return <p className="text-slate-600">{children}</p>;
}

function SubTitle({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
      {children}
    </p>
  );
}

/** Las 4 combinaciones de Cumplimiento × Despacho. */
function Interpretacion() {
  const rows: { badge: string; tone: string; text: string }[] = [
    {
      badge: "Ambos altos",
      tone: "bg-emerald-50 text-emerald-700 border-emerald-200",
      text: "Proveedor confiable: entrega a tiempo y completo.",
    },
    {
      badge: "Cumple, despacho bajo",
      tone: "bg-amber-50 text-amber-700 border-amber-200",
      text: "Entrega a tiempo pero incompleta: llegan las fechas, faltan unidades.",
    },
    {
      badge: "No cumple, despacho alto",
      tone: "bg-amber-50 text-amber-700 border-amber-200",
      text: "Entrega completa pero atrasada: llega todo, pero fuera de fecha.",
    },
    {
      badge: "Ambos bajos",
      tone: "bg-rose-50 text-rose-700 border-rose-200",
      text: "Proveedor crítico: ni a tiempo ni completo. A revisar.",
    },
  ];
  return (
    <div>
      <SubTitle>Cómo interpretarlos juntos</SubTitle>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.badge} className="flex flex-col gap-1">
            <span
              className={`inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${r.tone}`}
            >
              {r.badge}
            </span>
            <span className="text-sm leading-snug text-slate-600">{r.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface MetricHelp {
  label: string;
  body: ReactNode;
}

const SUPPLIER_METRIC_HELP: Record<string, MetricHelp> = {
  cumplimiento: {
    label: "Cumplimiento",
    body: (
      <>
        <P>
          Porcentaje de órdenes entregadas dentro de la fecha comprometida. Mide{" "}
          <b>puntualidad</b>.
        </P>
        <P>No mide si el proveedor entregó toda la cantidad solicitada.</P>
        <Interpretacion />
      </>
    ),
  },
  despacho: {
    label: "Despacho",
    body: (
      <>
        <P>
          Porcentaje de unidades efectivamente despachadas respecto a las unidades solicitadas.
        </P>
        <P>
          Un proveedor puede cumplir la fecha comprometida pero despachar solo una parte del
          pedido.
        </P>
        <Interpretacion />
      </>
    ),
  },
  fillRate: {
    label: "Fill rate",
    body: (
      <>
        <P>
          Porcentaje de unidades efectivamente despachadas respecto a las unidades solicitadas. Es
          la medida de <b>despacho completo</b>.
        </P>
        <P>
          Se calcula desde las recepciones: si pediste 100 y llegaron 90, el fill rate es 90%.
        </P>
        <Interpretacion />
      </>
    ),
  },
  leadTime: {
    label: "Lead time",
    body: (
      <>
        <P>
          Días promedio entre que emites la orden y la mercadería llega a bodega.
        </P>
        <P>
          Un lead time alto obliga a anticipar la compra: hay que pedir con más días de holgura
          para no quebrar stock.
        </P>
      </>
    ),
  },
  otif: {
    label: "OTIF",
    body: (
      <>
        <P>
          <b>On Time In Full</b>: combina las dos exigencias en un solo número: entregar{" "}
          <b>a tiempo</b> y <b>completo</b>.
        </P>
        <P>
          Es el estándar más duro. Un proveedor con buen cumplimiento y buen despacho por separado
          puede tener OTIF más bajo si no coinciden en la misma orden.
        </P>
      </>
    ),
  },
  pendiente: {
    label: "Monto pendiente",
    body: (
      <>
        <P>
          Valor de las órdenes ya emitidas a este proveedor que todavía no se reciben. Es dinero
          comprometido en tránsito.
        </P>
        <P>
          Un monto muy alto concentra riesgo: si el proveedor falla, hay mucho pedido dependiendo
          de él.
        </P>
      </>
    ),
  },
};

/**
 * Icono ⓘ con la explicación de un indicador de proveedor. Se pone junto a la
 * etiqueta del dato (encabezado de tabla, título de KPI, etiqueta de tarjeta).
 */
export function MetricHint({
  metric,
  className,
  size,
}: {
  metric: keyof typeof SUPPLIER_METRIC_HELP;
  className?: string;
  size?: "sm" | "md";
}) {
  const help = SUPPLIER_METRIC_HELP[metric];
  return (
    <InfoHint label={help.label} className={className} size={size}>
      {help.body}
    </InfoHint>
  );
}
