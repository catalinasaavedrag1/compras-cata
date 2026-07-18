import type { SignalChannel, SignalPriority, SignalType } from "../../types/purchasing";
import type { SignalBffStatus } from "../../services/purchaseBff";
import type { BadgeTone } from "../ui/Badge";

// ============================================================================
//  Etiquetas, tonos y lógica visual de las Señales de Ventas.
//  Centraliza el "idioma" del módulo: cómo se nombra y se colorea cada cosa,
//  para que la vista sea consistente y entendible por usuarios no técnicos.
// ============================================================================

export type SignalGroup = "Quiebre" | "Demanda" | "Sugerencia" | "Precio" | "Liquidación";

export interface SignalTypeMeta {
  label: string; // nombre completo
  short: string; // etiqueta corta para chips
  tone: BadgeTone;
  group: SignalGroup;
  /** Pista que se muestra al vendedor al elegir el tipo. */
  hint: string;
}

export const SIGNAL_TYPE: Record<SignalType, SignalTypeMeta> = {
  stockout: {
    label: "Quiebre detectado",
    short: "Quiebre",
    tone: "red",
    group: "Quiebre",
    hint: "No hay stock en sala y hay clientes buscándolo",
  },
  asked_no_stock: {
    label: "Cliente preguntó sin stock",
    short: "Sin stock",
    tone: "red",
    group: "Quiebre",
    hint: "Un cliente pidió un producto que no estaba disponible",
  },
  high_demand: {
    label: "Producto muy solicitado",
    short: "Muy pedido",
    tone: "blue",
    group: "Demanda",
    hint: "Se está pidiendo más de lo normal",
  },
  unexpected_demand: {
    label: "Demanda inesperada",
    short: "Demanda",
    tone: "blue",
    group: "Demanda",
    hint: "Repunte de ventas que no estaba previsto",
  },
  restock: {
    label: "Recomendado reponer",
    short: "Reponer",
    tone: "amber",
    group: "Sugerencia",
    hint: "Conviene volver a comprar este producto",
  },
  customer_suggested: {
    label: "Sugerido por cliente",
    short: "Nuevo",
    tone: "green",
    group: "Sugerencia",
    hint: "Un cliente pidió algo que no tenemos en el surtido",
  },
  campaign: {
    label: "Candidato a campaña",
    short: "Campaña",
    tone: "violet",
    group: "Sugerencia",
    hint: "Buen producto para una próxima campaña",
  },
  price_error: {
    label: "Posible error de precio",
    short: "Precio",
    tone: "amber",
    group: "Precio",
    hint: "El precio se ve mal (muy alto o muy bajo)",
  },
  liquidation: {
    label: "Candidato a liquidación",
    short: "Liquidar",
    tone: "violet",
    group: "Liquidación",
    hint: "No se mueve, conviene liquidarlo",
  },
  low_rotation: {
    label: "Baja rotación",
    short: "Baja rotación",
    tone: "slate",
    group: "Liquidación",
    hint: "Lleva tiempo sin venderse",
  },
};

/**
 * El backend acepta kinds abiertos (string): si llega uno fuera del catálogo
 * conocido, se muestra tal cual sin romper la vista.
 */
export function signalKindMeta(kind: string): SignalTypeMeta {
  return (
    (SIGNAL_TYPE as Record<string, SignalTypeMeta>)[kind] ?? {
      label: kind,
      short: kind,
      tone: "neutral",
      group: "Sugerencia",
      hint: "",
    }
  );
}

export const SIGNAL_CHANNEL: Record<SignalChannel, string> = {
  store: "Tienda",
  web: "Web",
  marketplace: "Marketplace",
  call_center: "Call center",
};

/** Canal legible desde details.channel (string libre del backend). */
export function signalChannelLabel(channel: string | undefined | null): string | null {
  if (!channel) return null;
  return SIGNAL_CHANNEL[channel as SignalChannel] ?? channel;
}

export interface SignalStatusMeta {
  label: string;
  tone: BadgeTone;
}

/** Máquina real del backend: new → in_review → actioned | dismissed. */
export const SIGNAL_STATUS: Record<SignalBffStatus, SignalStatusMeta> = {
  new: { label: "Nueva", tone: "blue" },
  in_review: { label: "En revisión", tone: "amber" },
  actioned: { label: "Accionada", tone: "green" },
  dismissed: { label: "Descartada", tone: "slate" },
};

export const SIGNAL_PRIORITY: Record<SignalPriority, { label: string; tone: BadgeTone }> = {
  high: { label: "Alta", tone: "red" },
  medium: { label: "Media", tone: "amber" },
  low: { label: "Baja", tone: "neutral" },
};

/** Tipos que representan un quiebre / falta de stock. */
export const STOCKOUT_TYPES: SignalType[] = ["stockout", "asked_no_stock"];

/** Tipos que representan presión de demanda. */
export const DEMAND_TYPES: SignalType[] = ["high_demand", "unexpected_demand", "restock"];

/**
 * Lógica de prioridad visible y explicable:
 *  - Alta  → quiebre + alta demanda (o error de precio): hay venta perdida ahora.
 *  - Media → varias solicitudes pero todavía hay stock.
 *  - Baja  → observación o sugerencia comercial.
 */
export function suggestPriority(input: {
  type: SignalType;
  customersAsking?: number;
  stock?: number;
}): { priority: SignalPriority; reason: string } {
  const asking = input.customersAsking ?? 0;
  const hasStock = (input.stock ?? 0) > 0;
  const isStockout = STOCKOUT_TYPES.includes(input.type);
  const isDemand = DEMAND_TYPES.includes(input.type);

  if (isStockout && (asking >= 3 || !hasStock)) {
    return {
      priority: "high",
      reason: "Quiebre con clientes pidiéndolo: hay venta perdida ahora.",
    };
  }
  if (input.type === "price_error") {
    return {
      priority: "high",
      reason: "Un precio mal puesto afecta margen o venta de inmediato.",
    };
  }
  if (isStockout || (isDemand && asking >= 3)) {
    return {
      priority: "medium",
      reason: "Varias solicitudes, pero todavía queda algo de stock.",
    };
  }
  if (isDemand) {
    return {
      priority: "medium",
      reason: "Demanda al alza que conviene anticipar.",
    };
  }
  return {
    priority: "low",
    reason: "Observación o sugerencia comercial para evaluar.",
  };
}
