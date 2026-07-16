import type { BadgeTone } from "../components/ui/Badge";

// ============================================================================
//  Incorporación de nuevos productos (NPI) — proceso gestionado, no solo una
//  clasificación. Cada propuesta pasa por propuesta → aprobación → piloto →
//  evaluación → escalado o rechazo.
// ============================================================================

export type NpiStage =
  | "propuesta"
  | "aprobada"
  | "piloto"
  | "evaluacion"
  | "escalado"
  | "rechazada";

export const NPI_STAGE: Record<NpiStage, { label: string; tone: BadgeTone; order: number }> = {
  propuesta: { label: "Propuesta", tone: "blue", order: 0 },
  aprobada: { label: "Aprobada", tone: "violet", order: 1 },
  piloto: { label: "En piloto", tone: "amber", order: 2 },
  evaluacion: { label: "En evaluación", tone: "amber", order: 3 },
  escalado: { label: "Escalado", tone: "green", order: 4 },
  rechazada: { label: "Rechazada", tone: "neutral", order: 5 },
};

export type RiskLevel = "bajo" | "medio" | "alto";

export interface ProductIntro {
  id: string;
  name: string;
  category: string;
  supplierName: string;
  cost: number;
  suggestedPrice: number;
  comparable: string; // producto comparable de referencia
  targetMarket: string;
  initialBuy: number; // compra inicial (u.)
  pilotStores: number;
  initialForecast: number; // pronóstico mensual inicial (u.)
  risk: RiskLevel;
  stage: NpiStage;
  pilotResult?: string;
  buyer: string;
  date: string;
}

export const productIntros: ProductIntro[] = [
  {
    id: "NPI-2026-001",
    name: "Taladro inalámbrico brushless 20V",
    category: "Herramientas eléctricas",
    supplierName: "Herramientas Global",
    cost: 38_900,
    suggestedPrice: 69_990,
    comparable: "Taladro percutor Bosch 800W",
    targetMarket: "Maestro y profesional; complementa la línea Bosch",
    initialBuy: 120,
    pilotStores: 6,
    initialForecast: 45,
    risk: "medio",
    stage: "piloto",
    pilotResult: "Semana 3: vende ~12/tienda, sobre lo proyectado. Buena rotación.",
    buyer: "Felipe Rojas",
    date: "2026-06-20",
  },
  {
    id: "NPI-2026-002",
    name: "Pintura esmalte al agua 1 gal (ecológica)",
    category: "Pinturas",
    supplierName: "Pinturas Nacionales",
    cost: 7_200,
    suggestedPrice: 12_990,
    comparable: "Pintura látex blanco 1 galón",
    targetMarket: "Cliente residencial que busca bajo olor / ecológico",
    initialBuy: 200,
    pilotStores: 8,
    initialForecast: 90,
    risk: "bajo",
    stage: "evaluacion",
    pilotResult: "Piloto 30 días: 78% del pronóstico. Falta señalización en sala.",
    buyer: "María González",
    date: "2026-05-28",
  },
  {
    id: "NPI-2026-003",
    name: "Set organizador modular de garage (10 piezas)",
    category: "Ferretería",
    supplierName: "Distribuidora Maule",
    cost: 21_500,
    suggestedPrice: 44_990,
    comparable: "Sin comparable directo (categoría nueva)",
    targetMarket: "Cliente DIY / ordenamiento del hogar",
    initialBuy: 60,
    pilotStores: 4,
    initialForecast: 20,
    risk: "alto",
    stage: "propuesta",
    buyer: "Catalina Saavedra",
    date: "2026-07-08",
  },
  {
    id: "NPI-2026-004",
    name: "Guantes anticorte nivel 5 (importado)",
    category: "Seguridad industrial",
    supplierName: "Industrial del Sur",
    cost: 2_400,
    suggestedPrice: 4_990,
    comparable: "Guantes de seguridad anticorte",
    targetMarket: "Industria y construcción; mejor protección",
    initialBuy: 500,
    pilotStores: 10,
    initialForecast: 160,
    risk: "bajo",
    stage: "escalado",
    pilotResult: "Piloto exitoso: 118% del pronóstico. Escalado a toda la red.",
    buyer: "Catalina Saavedra",
    date: "2026-04-15",
  },
];

export function npiMargin(p: ProductIntro): number {
  return p.suggestedPrice > 0 ? ((p.suggestedPrice - p.cost) / p.suggestedPrice) * 100 : 0;
}
