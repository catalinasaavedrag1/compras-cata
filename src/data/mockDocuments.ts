// ============================================================================
//  Documentos centralizados (mock determinista)
//  Reúne en un solo lugar los documentos del proceso de compra que hoy viven
//  dispersos en correos y planillas: cotizaciones, OC, guías, facturas,
//  notas de crédito, listas de precios, acuerdos, contratos, fichas técnicas,
//  certificados y correos. Sin Math.random ni Date.now: todo es fijo.
// ============================================================================
import type { BadgeTone } from "../components/ui/Badge";

export type DocType =
  | "cotizacion"
  | "orden_compra"
  | "guia"
  | "factura"
  | "nota_credito"
  | "lista_precios"
  | "acuerdo"
  | "contrato"
  | "ficha_tecnica"
  | "certificado"
  | "correo";

export interface ProcurementDoc {
  id: string;
  nombre: string;
  tipo: DocType;
  proveedor: string;
  /** Fecha del documento en ISO "aaaa-mm-dd". */
  fecha: string;
  /** Entidad relacionada: una OC (ej. "OC-2026-0143"), un proveedor o una categoría. */
  relacionado: string;
  /** Tamaño legible del archivo (ej. "245 KB"). */
  tamano: string;
}

/** Etiqueta legible por tipo de documento. */
export const TYPE_LABELS: Record<DocType, string> = {
  cotizacion: "Cotización",
  orden_compra: "Orden de compra",
  guia: "Guía de despacho",
  factura: "Factura",
  nota_credito: "Nota de crédito",
  lista_precios: "Lista de precios",
  acuerdo: "Acuerdo comercial",
  contrato: "Contrato",
  ficha_tecnica: "Ficha técnica",
  certificado: "Certificado",
  correo: "Correo",
};

/** Tono de badge por tipo de documento (consistente con el resto de la app). */
export const TYPE_TONES: Record<DocType, BadgeTone> = {
  cotizacion: "blue",
  orden_compra: "violet",
  guia: "amber",
  factura: "green",
  nota_credito: "red",
  lista_precios: "neutral",
  acuerdo: "blue",
  contrato: "slate",
  ficha_tecnica: "neutral",
  certificado: "green",
  correo: "neutral",
};

const SUPPLIERS = [
  "Proveedor Andes",
  "FerrePro Chile",
  "Distribuidora Maule",
  "Industrial del Sur",
  "Herramientas Global",
  "Pinturas Nacionales",
  "Agroinsumos Central",
  "Materiales del Pacífico",
] as const;

/** Define cada documento de forma compacta; los campos restantes se derivan. */
interface DocSeed {
  tipo: DocType;
  /** Índice del proveedor en SUPPLIERS. */
  s: number;
  fecha: string;
  /** Sufijo descriptivo para el nombre del archivo. */
  detalle: string;
  relacionado: string;
  /** Tamaño en KB (se formatea a "KB"/"MB"). */
  kb: number;
}

const SEEDS: DocSeed[] = [
  // Cotizaciones
  {
    tipo: "cotizacion",
    s: 0,
    fecha: "2026-06-18",
    detalle: "cemento-y-aridos",
    relacionado: "Construcción",
    kb: 184,
  },
  {
    tipo: "cotizacion",
    s: 4,
    fecha: "2026-06-12",
    detalle: "taladros-percutores",
    relacionado: "Herramientas eléctricas",
    kb: 212,
  },
  {
    tipo: "cotizacion",
    s: 1,
    fecha: "2026-05-29",
    detalle: "tornilleria-inox",
    relacionado: "Ferretería",
    kb: 96,
  },
  {
    tipo: "cotizacion",
    s: 5,
    fecha: "2026-06-03",
    detalle: "esmaltes-al-agua",
    relacionado: "Pinturas",
    kb: 143,
  },
  // Órdenes de compra
  {
    tipo: "orden_compra",
    s: 0,
    fecha: "2026-06-20",
    detalle: "OC-2026-0143",
    relacionado: "OC-2026-0143",
    kb: 78,
  },
  {
    tipo: "orden_compra",
    s: 3,
    fecha: "2026-06-15",
    detalle: "OC-2026-0139",
    relacionado: "OC-2026-0139",
    kb: 81,
  },
  {
    tipo: "orden_compra",
    s: 4,
    fecha: "2026-06-09",
    detalle: "OC-2026-0131",
    relacionado: "OC-2026-0131",
    kb: 74,
  },
  {
    tipo: "orden_compra",
    s: 2,
    fecha: "2026-05-27",
    detalle: "OC-2026-0118",
    relacionado: "OC-2026-0118",
    kb: 69,
  },
  {
    tipo: "orden_compra",
    s: 6,
    fecha: "2026-05-21",
    detalle: "OC-2026-0112",
    relacionado: "OC-2026-0112",
    kb: 72,
  },
  // Guías de despacho
  {
    tipo: "guia",
    s: 0,
    fecha: "2026-06-23",
    detalle: "GD-58210",
    relacionado: "OC-2026-0143",
    kb: 54,
  },
  {
    tipo: "guia",
    s: 3,
    fecha: "2026-06-18",
    detalle: "GD-58104",
    relacionado: "OC-2026-0139",
    kb: 49,
  },
  {
    tipo: "guia",
    s: 4,
    fecha: "2026-06-13",
    detalle: "GD-57998",
    relacionado: "OC-2026-0131",
    kb: 51,
  },
  {
    tipo: "guia",
    s: 2,
    fecha: "2026-05-30",
    detalle: "GD-57612",
    relacionado: "OC-2026-0118",
    kb: 47,
  },
  // Facturas
  {
    tipo: "factura",
    s: 0,
    fecha: "2026-06-24",
    detalle: "F-90412",
    relacionado: "OC-2026-0143",
    kb: 132,
  },
  {
    tipo: "factura",
    s: 3,
    fecha: "2026-06-19",
    detalle: "F-90388",
    relacionado: "OC-2026-0139",
    kb: 128,
  },
  {
    tipo: "factura",
    s: 4,
    fecha: "2026-06-14",
    detalle: "F-90301",
    relacionado: "OC-2026-0131",
    kb: 121,
  },
  {
    tipo: "factura",
    s: 2,
    fecha: "2026-05-31",
    detalle: "F-89977",
    relacionado: "OC-2026-0118",
    kb: 118,
  },
  {
    tipo: "factura",
    s: 6,
    fecha: "2026-05-24",
    detalle: "F-89840",
    relacionado: "OC-2026-0112",
    kb: 115,
  },
  // Notas de crédito
  {
    tipo: "nota_credito",
    s: 2,
    fecha: "2026-06-05",
    detalle: "NC-2031-diferencia",
    relacionado: "OC-2026-0118",
    kb: 88,
  },
  {
    tipo: "nota_credito",
    s: 6,
    fecha: "2026-05-28",
    detalle: "NC-2018-merma",
    relacionado: "OC-2026-0112",
    kb: 84,
  },
  // Listas de precios
  {
    tipo: "lista_precios",
    s: 1,
    fecha: "2026-06-01",
    detalle: "tarifa-julio-2026",
    relacionado: "FerrePro Chile",
    kb: 356,
  },
  {
    tipo: "lista_precios",
    s: 5,
    fecha: "2026-06-01",
    detalle: "tarifa-q3-2026",
    relacionado: "Pinturas Nacionales",
    kb: 298,
  },
  {
    tipo: "lista_precios",
    s: 7,
    fecha: "2026-05-15",
    detalle: "tarifa-materiales-2026",
    relacionado: "Materiales del Pacífico",
    kb: 410,
  },
  // Acuerdos comerciales
  {
    tipo: "acuerdo",
    s: 0,
    fecha: "2026-04-10",
    detalle: "rebate-volumen-2026",
    relacionado: "Proveedor Andes",
    kb: 240,
  },
  {
    tipo: "acuerdo",
    s: 4,
    fecha: "2026-03-22",
    detalle: "descuento-temporada",
    relacionado: "Herramientas Global",
    kb: 196,
  },
  // Contratos
  {
    tipo: "contrato",
    s: 0,
    fecha: "2026-01-15",
    detalle: "suministro-anual-2026",
    relacionado: "Proveedor Andes",
    kb: 1280,
  },
  {
    tipo: "contrato",
    s: 3,
    fecha: "2026-02-03",
    detalle: "marco-distribucion",
    relacionado: "Industrial del Sur",
    kb: 1144,
  },
  {
    tipo: "contrato",
    s: 7,
    fecha: "2025-12-18",
    detalle: "exclusividad-zona-centro",
    relacionado: "Materiales del Pacífico",
    kb: 980,
  },
  // Fichas técnicas
  {
    tipo: "ficha_tecnica",
    s: 0,
    fecha: "2026-05-09",
    detalle: "cemento-especial-25kg",
    relacionado: "Construcción",
    kb: 612,
  },
  {
    tipo: "ficha_tecnica",
    s: 4,
    fecha: "2026-05-02",
    detalle: "taladro-industrial-18v",
    relacionado: "Herramientas eléctricas",
    kb: 540,
  },
  {
    tipo: "ficha_tecnica",
    s: 5,
    fecha: "2026-04-27",
    detalle: "latex-premium-interior",
    relacionado: "Pinturas",
    kb: 488,
  },
  {
    tipo: "ficha_tecnica",
    s: 6,
    fecha: "2026-04-19",
    detalle: "fertilizante-npk",
    relacionado: "Agrícola",
    kb: 432,
  },
  // Certificados
  {
    tipo: "certificado",
    s: 3,
    fecha: "2026-03-30",
    detalle: "iso-9001-vigente",
    relacionado: "Industrial del Sur",
    kb: 320,
  },
  {
    tipo: "certificado",
    s: 0,
    fecha: "2026-02-28",
    detalle: "calidad-cemento-inn",
    relacionado: "Proveedor Andes",
    kb: 276,
  },
  {
    tipo: "certificado",
    s: 4,
    fecha: "2026-04-05",
    detalle: "seguridad-electrica-sec",
    relacionado: "Herramientas eléctricas",
    kb: 264,
  },
  // Correos
  {
    tipo: "correo",
    s: 1,
    fecha: "2026-06-22",
    detalle: "confirmacion-despacho",
    relacionado: "OC-2026-0139",
    kb: 24,
  },
  {
    tipo: "correo",
    s: 0,
    fecha: "2026-06-16",
    detalle: "reclamo-faltante",
    relacionado: "OC-2026-0143",
    kb: 31,
  },
  {
    tipo: "correo",
    s: 2,
    fecha: "2026-06-04",
    detalle: "negociacion-precios",
    relacionado: "Distribuidora Maule",
    kb: 28,
  },
  {
    tipo: "correo",
    s: 7,
    fecha: "2026-05-20",
    detalle: "aviso-quiebre-stock",
    relacionado: "Materiales del Pacífico",
    kb: 22,
  },
];

/** Formatea KB a un tamaño legible ("245 KB" o "1,3 MB"). */
function formatSize(kb: number): string {
  if (kb >= 1024) {
    return `${(kb / 1024).toLocaleString("es-CL", { maximumFractionDigits: 1 })} MB`;
  }
  return `${kb} KB`;
}

/** Construye un nombre de archivo legible a partir del seed. */
function buildName(seed: DocSeed): string {
  const ext = seed.tipo === "correo" ? "eml" : seed.tipo === "lista_precios" ? "xlsx" : "pdf";
  return `${TYPE_LABELS[seed.tipo]} ${seed.detalle}.${ext}`;
}

export const documents: ProcurementDoc[] = SEEDS.map((seed, i) => ({
  id: `DOC-${String(i + 1).padStart(4, "0")}`,
  nombre: buildName(seed),
  tipo: seed.tipo,
  proveedor: SUPPLIERS[seed.s],
  fecha: seed.fecha,
  relacionado: seed.relacionado,
  tamano: formatSize(seed.kb),
})).sort((a, b) => b.fecha.localeCompare(a.fecha));

/** Lista única de proveedores presentes en los documentos. */
export const documentSuppliers: string[] = [...SUPPLIERS];

/** Orden de los tipos para selectores y agrupaciones. */
export const DOC_TYPE_ORDER: DocType[] = [
  "cotizacion",
  "orden_compra",
  "guia",
  "factura",
  "nota_credito",
  "lista_precios",
  "acuerdo",
  "contrato",
  "ficha_tecnica",
  "certificado",
  "correo",
];
