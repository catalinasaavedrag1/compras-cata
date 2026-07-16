import type { ImportOrder, ImportStage } from "../types/purchasing";
import type { BadgeTone } from "../components/ui/Badge";

// ============================================================================
//  Compras importadas (demo). Seguimiento del proceso desde la proforma hasta
//  la bodega, con los datos para recalcular el costo puesto en bodega.
// ============================================================================

export const IMPORT_STAGE: Record<
  ImportStage,
  { label: string; short: string; tone: BadgeTone; order: number }
> = {
  proforma: { label: "Proforma", short: "Proforma", tone: "slate", order: 0 },
  orden: { label: "Orden internacional", short: "Orden", tone: "neutral", order: 1 },
  produccion: { label: "En producción", short: "Producción", tone: "violet", order: 2 },
  embarque: { label: "Listo para embarque", short: "Embarque", tone: "amber", order: 3 },
  transito: { label: "En tránsito", short: "Tránsito", tone: "blue", order: 4 },
  aduana: { label: "En aduana", short: "Aduana", tone: "amber", order: 5 },
  internacion: { label: "Internación (terrestre)", short: "Internación", tone: "blue", order: 6 },
  bodega: { label: "En bodega", short: "Bodega", tone: "green", order: 7 },
};

/** Orden del pipeline para dibujar la barra de proceso. */
export const IMPORT_PIPELINE: ImportStage[] = [
  "proforma",
  "orden",
  "produccion",
  "embarque",
  "transito",
  "aduana",
  "internacion",
  "bodega",
];

export const imports: ImportOrder[] = [
  {
    id: "IMP-2026-001",
    poNumber: "OC-IMP-0091",
    supplierName: "Bosch Power Tools (DE)",
    origen: "Hamburgo, Alemania",
    incoterm: "FOB",
    moneda: "USD",
    tipoCambio: 955,
    montoFob: 84_000,
    anticipoPct: 30,
    naviera: "Hapag-Lloyd",
    contenedor: "1 × 40' HC",
    puerto: "San Antonio",
    etd: "2026-05-28",
    eta: "2026-07-04",
    fechaBodega: "2026-07-10",
    stage: "transito",
    buyer: "Catalina Saavedra",
    skuCount: 24,
    fleteInternacional: 4_200_000,
    arancelPct: 6,
    gastosPortuarios: 1_350_000,
    transporteTerrestre: 620_000,
    agenteAduana: 480_000,
    docs: [
      { nombre: "Factura comercial", ok: true },
      { nombre: "Packing list", ok: true },
      { nombre: "BL (conocimiento de embarque)", ok: true },
      { nombre: "Certificado de origen", ok: false },
    ],
  },
  {
    id: "IMP-2026-002",
    poNumber: "OC-IMP-0093",
    supplierName: "Makita Corporation (JP)",
    origen: "Nagoya, Japón",
    incoterm: "CIF",
    moneda: "USD",
    tipoCambio: 955,
    montoFob: 52_500,
    anticipoPct: 40,
    naviera: "ONE",
    contenedor: "1 × 20'",
    puerto: "Valparaíso",
    etd: "2026-06-18",
    eta: "2026-07-28",
    stage: "produccion",
    buyer: "Catalina Saavedra",
    skuCount: 15,
    fleteInternacional: 2_600_000,
    arancelPct: 6,
    gastosPortuarios: 980_000,
    transporteTerrestre: 540_000,
    agenteAduana: 420_000,
    docs: [
      { nombre: "Proforma", ok: true },
      { nombre: "Factura comercial", ok: false },
      { nombre: "Packing list", ok: false },
    ],
  },
  {
    id: "IMP-2026-003",
    poNumber: "OC-IMP-0088",
    supplierName: "Rotoplas (MX)",
    origen: "Ciudad de México, México",
    incoterm: "FCA",
    moneda: "USD",
    tipoCambio: 948,
    montoFob: 38_900,
    anticipoPct: 50,
    naviera: "MSC",
    contenedor: "1 × 40'",
    puerto: "San Antonio",
    etd: "2026-05-02",
    eta: "2026-06-20",
    fechaBodega: "2026-06-26",
    stage: "aduana",
    buyer: "Catalina Saavedra",
    skuCount: 8,
    fleteInternacional: 3_100_000,
    arancelPct: 0,
    gastosPortuarios: 1_120_000,
    transporteTerrestre: 700_000,
    agenteAduana: 460_000,
    docs: [
      { nombre: "Factura comercial", ok: true },
      { nombre: "Packing list", ok: true },
      { nombre: "Certificado de origen (TLC)", ok: true },
      { nombre: "BL", ok: true },
    ],
  },
];
