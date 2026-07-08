import { products } from "./mockProducts";

// ============================================================================
//  Gestión de alzas de precio (#12)
//  --------------------------------------------------------------------------
//  Un proveedor envía una nueva lista de precios. Para cada producto se compara
//  el costo actual (catálogo) contra el costo nuevo propuesto. De ahí se derivan:
//    - alza/baja % del costo
//    - margen actual vs margen nuevo (si NO se cambia el precio de venta)
//    - precio de venta sugerido para mantener el margen objetivo
//
//  Todos los valores son DETERMINISTAS: se derivan del costo del producto del
//  catálogo y de un factor por lista (sin Math.random ni Date.now). Es FRONT-ONLY
//  con datos simulados; las aprobaciones se persisten en localStorage en la página.
// ============================================================================

export type PriceListEstado = "pendiente" | "aprobada" | "rechazada";

export interface PriceListItem {
  sku: string;
  productName: string;
  category: string;
  /** Costo vigente en el catálogo. */
  costoActual: number;
  /** Costo propuesto en la nueva lista del proveedor. */
  costoNuevo: number;
  /** Variación % del costo (derivada). Positiva = alza, negativa = baja. */
  alzaPct: number;
  /** Margen % actual (con el precio de venta vigente). */
  margenActualPct: number;
  /** Margen % que quedaría si el precio de venta NO cambia y sube el costo. */
  margenNuevoPct: number;
  /** Precio de venta sugerido para mantener el margen objetivo de la categoría. */
  precioVentaSugerido: number;
}

export interface PriceList {
  id: string;
  proveedor: string;
  /** Fecha ISO desde la que rige la nueva lista. */
  vigenteDesde: string;
  estado: PriceListEstado;
  items: PriceListItem[];
}

/** Margen objetivo por categoría (mismo criterio que el resto de la app). */
export const TARGET_MARGIN_BY_CATEGORY: Record<string, number> = {
  "Herramientas eléctricas": 32,
  Ferretería: 28,
  Construcción: 22,
  Pinturas: 25,
  Electricidad: 30,
  Gasfitería: 28,
  Jardín: 30,
  "Seguridad industrial": 30,
  Maderas: 25,
  Agrícola: 27,
};

/** Umbral de margen "bajo" usado en KPIs y alertas. */
export const LOW_MARGIN_THRESHOLD = 20;

function targetFor(category: string): number {
  return TARGET_MARGIN_BY_CATEGORY[category] ?? 25;
}

/** Redondea a entero (CLP no usa decimales). */
function clp(value: number): number {
  return Math.round(value);
}

/** Margen % sobre precio de venta: (precio - costo) / precio. */
function marginPct(price: number, cost: number): number {
  if (price <= 0) return 0;
  return Math.round(((price - cost) / price) * 1000) / 10;
}

/** Precio de venta que mantiene el margen objetivo dado un costo. */
function suggestedPrice(cost: number, target: number): number {
  const denom = 1 - target / 100;
  if (denom <= 0) return clp(cost);
  return clp(cost / denom);
}

/**
 * Construye un ítem de lista derivando el costo nuevo del costo de catálogo
 * mediante un delta determinista (en puntos porcentuales, positivo o negativo).
 */
function buildItem(sku: string, deltaPct: number): PriceListItem | null {
  const p = products.find((x) => x.sku === sku);
  if (!p) return null;
  const costoActual = p.cost;
  const costoNuevo = clp(costoActual * (1 + deltaPct / 100));
  const alzaPct =
    costoActual > 0 ? Math.round(((costoNuevo - costoActual) / costoActual) * 1000) / 10 : 0;
  const target = targetFor(p.category);
  return {
    sku,
    productName: p.name,
    category: p.category,
    costoActual,
    costoNuevo,
    alzaPct,
    margenActualPct: marginPct(p.price, costoActual),
    // Si el precio de venta no cambia, el nuevo costo erosiona el margen.
    margenNuevoPct: marginPct(p.price, costoNuevo),
    precioVentaSugerido: suggestedPrice(costoNuevo, target),
  };
}

/**
 * Helper público: genera ítems para un proveedor aplicando un alza base, con
 * pequeñas variaciones deterministas por posición (algunas bajas, algún sin
 * cambio). Se usa también desde la página para la "carga" simulada de listas.
 */
export function buildPriceListItems(supplier: string, baseAlzaPct: number): PriceListItem[] {
  const fromSupplier = products.filter((p) => p.supplierName === supplier);
  // Patrón determinista de ajustes sobre el alza base (en puntos porcentuales):
  // mayoría alzas, algunas bajas y algún "sin cambio".
  const pattern = [
    0,
    1.5,
    -baseAlzaPct,
    3,
    0.5,
    -1,
    2,
    -baseAlzaPct,
    1,
    4,
    -2,
    0.5,
    2.5,
    1,
    -1.5,
    3,
    0,
    2,
    -0.5,
    1.5,
  ];
  const out: PriceListItem[] = [];
  fromSupplier.forEach((p, i) => {
    const delta = baseAlzaPct + pattern[i % pattern.length];
    const item = buildItem(p.sku, delta);
    if (item) out.push(item);
  });
  return out;
}

// ----------------------------------------------------------------------------
//  Listas sembradas (proveedores reales del catálogo). Distintos % de alza y
//  vigencias. Cada lista toma los productos de su proveedor (8-20 ítems).
// ----------------------------------------------------------------------------
export const PRICE_LISTS: PriceList[] = [
  {
    id: "PL-2026-001",
    proveedor: "FerrePro Chile",
    vigenteDesde: "2026-07-01",
    estado: "pendiente",
    items: buildPriceListItems("FerrePro Chile", 9),
  },
  {
    id: "PL-2026-002",
    proveedor: "Distribuidora Maule",
    vigenteDesde: "2026-07-05",
    estado: "pendiente",
    items: buildPriceListItems("Distribuidora Maule", 6),
  },
  {
    id: "PL-2026-003",
    proveedor: "Proveedor Andes",
    vigenteDesde: "2026-07-10",
    estado: "pendiente",
    items: buildPriceListItems("Proveedor Andes", 12),
  },
  {
    id: "PL-2026-004",
    proveedor: "Herramientas Global",
    vigenteDesde: "2026-06-28",
    estado: "pendiente",
    items: buildPriceListItems("Herramientas Global", 4),
  },
];

/** Proveedores disponibles para la carga simulada (los del catálogo con productos). */
export const SUPPLIERS_WITH_PRODUCTS: string[] = Array.from(
  new Set(products.map((p) => p.supplierName).filter(Boolean))
).sort((a, b) => a.localeCompare(b, "es"));

export interface PriceListSummary {
  /** Nº de productos en la lista. */
  productos: number;
  /** Alza promedio de costo (% , puede ser negativa si predominan bajas). */
  alzaPromedioPct: number;
  /** Nº de productos en alza. */
  enAlza: number;
  /** Nº de productos en baja. */
  enBaja: number;
  /** Nº de productos que quedarían con margen bajo (< umbral) si no cambia el precio. */
  conMargenBajo: number;
  /** Impacto en el margen, en puntos porcentuales (promedio nuevo - actual). */
  impactoMargenPts: number;
}

/** Resumen agregado de una lista de precios. */
export function summarizeList(list: PriceList): PriceListSummary {
  const items = list.items;
  const n = items.length;
  if (n === 0) {
    return {
      productos: 0,
      alzaPromedioPct: 0,
      enAlza: 0,
      enBaja: 0,
      conMargenBajo: 0,
      impactoMargenPts: 0,
    };
  }
  const sumAlza = items.reduce((a, it) => a + it.alzaPct, 0);
  const sumImpacto = items.reduce((a, it) => a + (it.margenNuevoPct - it.margenActualPct), 0);
  return {
    productos: n,
    alzaPromedioPct: Math.round((sumAlza / n) * 10) / 10,
    enAlza: items.filter((it) => it.alzaPct > 0).length,
    enBaja: items.filter((it) => it.alzaPct < 0).length,
    conMargenBajo: items.filter((it) => it.margenNuevoPct < LOW_MARGIN_THRESHOLD).length,
    impactoMargenPts: Math.round((sumImpacto / n) * 10) / 10,
  };
}
