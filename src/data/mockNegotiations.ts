import type {
  NegotiationBenefit,
  NegotiationLever,
  NegotiationRound,
  NegotiationStatus,
} from "../types/purchasing";

// ============================================================================
//  Registro de negociación por proveedor (demo). Rondas con condición inicial,
//  objetivo, propuesta del proveedor y condición final, diferenciando el TIPO
//  de beneficio para no mezclar ahorro real con bonificaciones o plazos.
// ============================================================================

export const NEGOTIATION_LEVER: Record<NegotiationLever, string> = {
  precio: "Precio",
  descuento: "Descuento",
  volumen: "Escala por volumen",
  plazo_pago: "Plazo de pago",
  flete: "Flete",
  bonificacion: "Bonificación",
  rebate: "Rebate",
  devoluciones: "Devoluciones",
  marketing: "Aporte marketing",
  exclusividad: "Exclusividad",
};

export const NEGOTIATION_BENEFIT: Record<
  NegotiationBenefit,
  { label: string; tone: "green" | "blue" | "violet" | "amber" | "slate"; real: boolean }
> = {
  ahorro_real: { label: "Ahorro real", tone: "green", real: true },
  bonificacion: { label: "Bonificación futura", tone: "violet", real: false },
  plazo: { label: "Mejora de plazo", tone: "blue", real: false },
  logistico: { label: "Beneficio logístico", tone: "amber", real: false },
  promo: { label: "Aporte promocional", tone: "slate", real: false },
};

export const NEGOTIATION_STATUS: Record<
  NegotiationStatus,
  { label: string; tone: "green" | "amber" | "blue" | "neutral" }
> = {
  propuesta: { label: "Propuesta", tone: "blue" },
  en_curso: { label: "En curso", tone: "amber" },
  acordado: { label: "Acordado", tone: "green" },
  rechazado: { label: "Rechazado", tone: "neutral" },
};

/** Rondas semilla por id de proveedor. */
export const negotiationsBySupplier: Record<string, NegotiationRound[]> = {
  "SUP-01": [
    {
      id: "NEG-01-1",
      date: "2026-06-12",
      lever: "descuento",
      initial: "Descuento 3% sobre lista",
      target: "Descuento 6%",
      supplierOffer: "5% + 1% por pronto pago",
      final: "Descuento 5%",
      benefit: "ahorro_real",
      valueClp: 4_200_000,
      status: "acordado",
      responsible: "Catalina Saavedra",
    },
    {
      id: "NEG-01-2",
      date: "2026-06-12",
      lever: "rebate",
      initial: "Sin rebate",
      target: "Rebate 3% anual > $300M",
      supplierOffer: "2% liquidación trimestral",
      final: "Rebate 2% trimestral",
      benefit: "bonificacion",
      valueClp: 1_750_000,
      status: "acordado",
      responsible: "Catalina Saavedra",
    },
    {
      id: "NEG-01-3",
      date: "2026-06-20",
      lever: "flete",
      initial: "Flete por pagar",
      target: "Flete sin costo > $1M",
      supplierOffer: "Sin costo > $1M a CD",
      final: "Sin costo > $1M a CD",
      benefit: "logistico",
      valueClp: 900_000,
      status: "acordado",
      responsible: "Catalina Saavedra",
    },
    {
      id: "NEG-01-4",
      date: "2026-07-02",
      lever: "plazo_pago",
      initial: "30 días fecha factura",
      target: "60 días",
      supplierOffer: "45 días",
      final: "45 días (en revisión)",
      benefit: "plazo",
      valueClp: 620_000,
      status: "en_curso",
      responsible: "Catalina Saavedra",
    },
  ],
  "SUP-02": [
    {
      id: "NEG-02-1",
      date: "2026-06-05",
      lever: "precio",
      initial: "Costo lista +5% vigente",
      target: "Congelar precio 2026",
      supplierOffer: "Congela 6 meses",
      final: "Protección de precio 6 meses",
      benefit: "ahorro_real",
      valueClp: 2_100_000,
      status: "acordado",
      responsible: "Catalina Saavedra",
    },
    {
      id: "NEG-02-2",
      date: "2026-06-28",
      lever: "marketing",
      initial: "Sin aporte",
      target: "Aporte campaña invierno",
      supplierOffer: "$800K en exhibición",
      final: "$800K en exhibición",
      benefit: "promo",
      valueClp: 800_000,
      status: "acordado",
      responsible: "Catalina Saavedra",
    },
  ],
};

export function negotiationsForSupplier(id: string): NegotiationRound[] {
  return negotiationsBySupplier[id] ?? [];
}
