import type { DemandChannel } from "../utils/channelDemand";

// ============================================================================
//  Temporadas comerciales (encabezado del planificador)
//  ---------------------------------------------------------------------------
//  Define una temporada como un evento de compra: qué se espera vender, en qué
//  ventana, cuándo hay que comprar, con qué categorías/canales/bodegas y con
//  qué presupuesto. Es el marco sobre el que se planifica la demanda.
// ============================================================================

export interface Season {
  id: string;
  name: string;
  /** Ventana de venta esperada (ISO). */
  saleFrom: string;
  saleTo: string;
  /** Ventana en que debe realizarse la compra (ISO). */
  buyFrom: string;
  buyTo: string;
  /** Fecha límite para emitir las órdenes de compra (ISO). */
  ocDeadline: string;
  categories: string[];
  channels: DemandChannel[];
  warehouses: string[];
  /** Lead time representativo de los proveedores de la temporada (días). */
  leadTimeDays: number;
  /** Presupuesto disponible para la temporada (CLP). */
  budget: number;
  /** Crecimiento esperado de la categoría vs la temporada anterior (%). */
  expectedGrowthPct: number;
}

const ALL_CHANNELS: DemandChannel[] = [
  "tienda",
  "ecommerce",
  "marketplace",
  "empresa",
  "licitaciones",
];

export const seasons: Season[] = [
  {
    id: "riego-2026",
    name: "Riego 2026",
    saleFrom: "2026-09-01",
    saleTo: "2027-01-31",
    buyFrom: "2026-07-01",
    buyTo: "2026-10-31",
    ocDeadline: "2026-08-15",
    categories: ["Jardín", "Gasfitería", "Agrícola"],
    channels: ALL_CHANNELS,
    warehouses: ["Centro de Distribución", "Bodega Santiago", "Bodega Sur"],
    leadTimeDays: 21,
    budget: 180000000,
    expectedGrowthPct: 12,
  },
  {
    id: "construccion-primavera-2026",
    name: "Construcción primavera 2026",
    saleFrom: "2026-09-01",
    saleTo: "2026-12-31",
    buyFrom: "2026-07-01",
    buyTo: "2026-10-15",
    ocDeadline: "2026-08-20",
    categories: ["Construcción", "Maderas", "Ferretería"],
    channels: ALL_CHANNELS,
    warehouses: ["Centro de Distribución", "Bodega Norte"],
    leadTimeDays: 14,
    budget: 320000000,
    expectedGrowthPct: 8,
  },
  {
    id: "pintura-verano-2026",
    name: "Pintura verano 2026",
    saleFrom: "2026-11-01",
    saleTo: "2027-02-28",
    buyFrom: "2026-09-01",
    buyTo: "2026-12-15",
    ocDeadline: "2026-10-10",
    categories: ["Pinturas"],
    channels: ["tienda", "ecommerce", "marketplace", "empresa"],
    warehouses: ["Centro de Distribución", "Bodega Santiago"],
    leadTimeDays: 10,
    budget: 60000000,
    expectedGrowthPct: 6,
  },
  {
    id: "vuelta-obra-2026",
    name: "Vuelta a la obra 2026",
    saleFrom: "2026-08-01",
    saleTo: "2026-11-30",
    buyFrom: "2026-06-15",
    buyTo: "2026-09-30",
    ocDeadline: "2026-07-20",
    categories: ["Herramientas eléctricas", "Electricidad", "Seguridad industrial"],
    channels: ALL_CHANNELS,
    warehouses: ["Centro de Distribución", "Bodega Santiago", "Bodega Norte"],
    leadTimeDays: 18,
    budget: 140000000,
    expectedGrowthPct: 10,
  },
];

export function getSeasonById(id: string): Season | undefined {
  return seasons.find((s) => s.id === id);
}

/** Meses (aprox.) que dura la ventana de venta de la temporada. */
export function seasonSaleMonths(s: Season): number {
  const from = new Date(`${s.saleFrom}T00:00:00`);
  const to = new Date(`${s.saleTo}T00:00:00`);
  const months =
    (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) + 1;
  return Math.max(1, months);
}
