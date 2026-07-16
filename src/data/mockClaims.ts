import type {
  ClaimResolution,
  ClaimStatus,
  ClaimType,
  SupplierClaim,
} from "../types/purchasing";
import type { BadgeTone } from "../components/ui/Badge";

// ============================================================================
//  Reclamos al proveedor (demo). Cierran el ciclo recepción → diferencia →
//  reclamo → evaluación del proveedor. Un proveedor puede tener buen precio
//  pero generar pérdidas operativas por faltantes, daños o reposiciones.
// ============================================================================

export const CLAIM_TYPE: Record<ClaimType, { label: string; tone: BadgeTone }> = {
  faltante: { label: "Faltante", tone: "red" },
  dano: { label: "Dañado", tone: "red" },
  calidad: { label: "Calidad", tone: "amber" },
  vencimiento: { label: "Vencimiento", tone: "amber" },
  costo: { label: "Costo incorrecto", tone: "violet" },
  empaque: { label: "Empaque", tone: "slate" },
  sobrante: { label: "Sobrante", tone: "blue" },
  documento: { label: "Documento", tone: "slate" },
};

export const CLAIM_STATUS: Record<ClaimStatus, { label: string; tone: BadgeTone }> = {
  abierto: { label: "Abierto", tone: "red" },
  en_gestion: { label: "En gestión", tone: "amber" },
  aceptado: { label: "Aceptado", tone: "blue" },
  resuelto: { label: "Resuelto", tone: "green" },
  rechazado: { label: "Rechazado", tone: "neutral" },
};

export const CLAIM_RESOLUTION: Record<ClaimResolution, string> = {
  pendiente: "Pendiente",
  nota_credito: "Nota de crédito",
  reposicion: "Reposición",
  descuento: "Descuento compensatorio",
  aceptado_sin_ajuste: "Aceptado sin ajuste",
};

/** Un reclamo está cerrado (no cuenta como abierto) si está resuelto o rechazado. */
export const CLAIM_OPEN_STATES: ClaimStatus[] = ["abierto", "en_gestion", "aceptado"];

// Accesores seguros: si un reclamo persistido trae un valor fuera de rango
// (datos antiguos/corruptos en localStorage), no rompen la UI.
export const claimTypeMeta = (t: ClaimType) =>
  CLAIM_TYPE[t] ?? { label: t, tone: "neutral" as BadgeTone };
export const claimStatusMeta = (s: ClaimStatus) =>
  CLAIM_STATUS[s] ?? { label: s, tone: "neutral" as BadgeTone };
export const claimResolutionLabel = (r: ClaimResolution) => CLAIM_RESOLUTION[r] ?? String(r);

export const claims: SupplierClaim[] = [
  {
    id: "REC-CLM-001",
    poNumber: "OC-2026-0139",
    receptionId: "REC-002",
    supplierName: "Distribuidora Maule",
    sku: "ELE-001",
    productName: "Cable eléctrico THHN 2.5 mm (rollo 100 m)",
    tipo: "faltante",
    cantidad: 18,
    motivo: "Llegaron 42 de 60 rollos. Faltan 18 y se agota el stock en 3 días.",
    valorReclamado: 570_000,
    responsable: "Andrea Muñoz",
    fecha: "2026-06-25",
    fechaLimite: "2026-06-30",
    estado: "en_gestion",
    resolucion: "pendiente",
    evidencia: "Guía de despacho 88231",
  },
  {
    id: "REC-CLM-002",
    poNumber: "OC-2026-0137",
    receptionId: "REC-004",
    supplierName: "FerrePro Chile",
    sku: "FER-006",
    productName: "Huincha de medir 5 m",
    tipo: "dano",
    cantidad: 25,
    motivo: "25 unidades con carcasa quebrada por mal embalaje.",
    valorReclamado: 62_500,
    responsable: "Catalina Saavedra",
    fecha: "2026-06-22",
    fechaLimite: "2026-06-28",
    estado: "aceptado",
    resolucion: "reposicion",
  },
  {
    id: "REC-CLM-003",
    poNumber: "OC-2026-0131",
    supplierName: "Proveedor Andes",
    sku: "CON-003",
    productName: "Fierro estriado 8 mm x 6 m",
    tipo: "costo",
    cantidad: 580,
    motivo: "Se facturó a $4.490 en vez del precio pactado $4.190. Diferencia de $0,3M.",
    valorReclamado: 174_000,
    responsable: "Catalina Saavedra",
    fecha: "2026-06-15",
    estado: "resuelto",
    resolucion: "nota_credito",
    notaCredito: "NC-2026-0412",
  },
  {
    id: "REC-CLM-004",
    poNumber: "OC-2026-0128",
    supplierName: "Distribuidora Maule",
    sku: "PIN-001",
    productName: "Pintura látex blanco 1 galón",
    tipo: "calidad",
    cantidad: 40,
    motivo: "Lote con separación de fase; ventas reportó reclamos de clientes.",
    valorReclamado: 359_600,
    responsable: "Andrea Muñoz",
    fecha: "2026-06-10",
    estado: "resuelto",
    resolucion: "descuento",
  },
];
