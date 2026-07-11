import type { Product, ProductLogistics, VehicleClass } from "../types/purchasing";
import { TODAY_ISO } from "../utils/constants";
import { addDaysISO } from "../utils/calculations";

// ============================================================================
//  Datos logísticos de retiro
//  ---------------------------------------------------------------------------
//  En materiales de construcción el retiro físico de la mercadería es parte de
//  la decisión de compra. Este archivo aporta:
//    · el catálogo de vehículos con su capacidad (peso y volumen),
//    · los centros de retiro,
//    · perfiles logísticos por categoría/subcategoría,
//    · overrides por SKU para los productos "difíciles" (estanques, fosas…),
//    · el resolver `productLogistics()` que completa la ficha logística de
//      cualquier producto (usa la explícita si viene, si no la deriva).
// ============================================================================

// ----------------------------------------------------------------------------
//  Catálogo de vehículos
// ----------------------------------------------------------------------------

export interface TruckType {
  class: VehicleClass;
  label: string;
  /** Capacidad máxima de peso (kg). */
  capacityKg: number;
  /** Capacidad máxima de volumen (m³). */
  capacityM3: number;
  /** Costo base estimado del viaje (CLP). */
  baseCost: number;
  /** Puede cargar con pluma / brazo hidráulico. */
  pluma: boolean;
  /** Admite carga sobredimensionada (rampla / plano). */
  sobredimensionado: boolean;
}

export const TRUCKS: Record<VehicleClass, TruckType> = {
  camioneta: {
    class: "camioneta",
    label: "Camioneta",
    capacityKg: 1000,
    capacityM3: 5,
    baseCost: 60000,
    pluma: false,
    sobredimensionado: false,
  },
  camion_3_4: {
    class: "camion_3_4",
    label: "Camión 3/4",
    capacityKg: 3500,
    capacityM3: 14,
    baseCost: 120000,
    pluma: false,
    sobredimensionado: false,
  },
  camion_simple: {
    class: "camion_simple",
    label: "Camión simple",
    capacityKg: 8000,
    capacityM3: 32,
    baseCost: 190000,
    pluma: false,
    sobredimensionado: false,
  },
  camion_rampla: {
    class: "camion_rampla",
    label: "Camión rampla",
    capacityKg: 14000,
    capacityM3: 45,
    baseCost: 210000,
    pluma: false,
    sobredimensionado: true,
  },
  camion_pluma: {
    class: "camion_pluma",
    label: "Camión pluma",
    capacityKg: 12000,
    capacityM3: 42,
    baseCost: 265000,
    pluma: true,
    sobredimensionado: true,
  },
};

/** Costo adicional por cada centro de retiro extra (kilometraje / segunda ruta). */
export const EXTRA_CENTER_COST = 85000;

export const VEHICLE_LABEL: Record<VehicleClass, string> = {
  camioneta: "Camioneta",
  camion_3_4: "Camión 3/4",
  camion_simple: "Camión simple",
  camion_rampla: "Camión rampla",
  camion_pluma: "Camión pluma",
};

export const HANDLING_LABEL: Record<ProductLogistics["manipulacion"], string> = {
  manual: "Carga manual",
  horquilla: "Grúa horquilla",
  pluma: "Camión pluma",
  grua: "Grúa / carga especial",
  rampla: "Rampla / carga lateral",
};

// ----------------------------------------------------------------------------
//  Centros de retiro por proveedor (un mismo proveedor puede despachar desde
//  distintos centros; algunos SKU pesados salen desde una planta distinta).
// ----------------------------------------------------------------------------

const SUPPLIER_CENTER: Record<string, string> = {
  "SUP-01": "CD Talca",
  "SUP-02": "CD Santiago",
  "SUP-03": "CD Santiago",
  "SUP-04": "Bodega San Javier",
  "SUP-05": "CD Santiago",
  "SUP-06": "Planta Curicó",
  "SUP-07": "CD Talca",
  "SUP-08": "Planta Curicó",
};

const DEFAULT_CENTER = "CD Santiago";

// ----------------------------------------------------------------------------
//  Perfil logístico "base" y perfiles por categoría/subcategoría.
//  Los pesos/volúmenes son por unidad de compra (aprox. reales de ferretería).
// ----------------------------------------------------------------------------

type Profile = Omit<ProductLogistics, "centroRetiro" | "fechaDisponible">;

const BASE_PROFILE: Profile = {
  pesoUnitarioKg: 2,
  volumenM3: 0.01,
  apilable: true,
  fragil: false,
  sobredimensionado: false,
  cargaPesada: false,
  manipulacion: "manual",
  vehiculoMinimo: "camion_3_4",
  grupoCarga: "general",
  tiempoCargaMin: 5,
};

/** Perfiles por subcategoría (tienen prioridad sobre la categoría). */
const SUBCATEGORY_PROFILES: Record<string, Partial<Profile>> = {
  Cementos: {
    pesoUnitarioKg: 25,
    volumenM3: 0.018,
    unidadesPorPallet: 48,
    cargaPesada: true,
    manipulacion: "horquilla",
    vehiculoMinimo: "camion_rampla",
    grupoCarga: "pesado",
    tiempoCargaMin: 20,
  },
  Áridos: {
    pesoUnitarioKg: 25,
    volumenM3: 0.016,
    unidadesPorPallet: 40,
    cargaPesada: true,
    manipulacion: "horquilla",
    vehiculoMinimo: "camion_rampla",
    grupoCarga: "pesado",
    tiempoCargaMin: 20,
  },
  Acero: {
    pesoUnitarioKg: 3.6,
    volumenM3: 0.012,
    unidadesPorPallet: 150,
    sobredimensionado: true,
    cargaPesada: true,
    manipulacion: "horquilla",
    vehiculoMinimo: "camion_rampla",
    grupoCarga: "largo",
    tiempoCargaMin: 25,
  },
  Ladrillos: {
    pesoUnitarioKg: 3,
    volumenM3: 0.0016,
    unidadesPorPallet: 500,
    cargaPesada: true,
    manipulacion: "horquilla",
    vehiculoMinimo: "camion_rampla",
    grupoCarga: "pesado",
    tiempoCargaMin: 30,
  },
  Tableros: {
    pesoUnitarioKg: 18,
    volumenM3: 0.03,
    unidadesPorPallet: 60,
    sobredimensionado: true,
    manipulacion: "horquilla",
    vehiculoMinimo: "camion_rampla",
    grupoCarga: "largo",
    tiempoCargaMin: 15,
  },
  Dimensionada: {
    pesoUnitarioKg: 4,
    volumenM3: 0.013,
    sobredimensionado: true,
    manipulacion: "horquilla",
    vehiculoMinimo: "camion_rampla",
    grupoCarga: "largo",
    tiempoCargaMin: 15,
  },
  Tuberías: {
    pesoUnitarioKg: 5,
    volumenM3: 0.05,
    sobredimensionado: true,
    apilable: false,
    manipulacion: "manual",
    vehiculoMinimo: "camion_rampla",
    grupoCarga: "voluminoso",
    tiempoCargaMin: 15,
  },
  Cables: {
    pesoUnitarioKg: 12,
    volumenM3: 0.02,
    manipulacion: "manual",
    vehiculoMinimo: "camion_3_4",
    grupoCarga: "general",
  },
  Mallas: {
    pesoUnitarioKg: 15,
    volumenM3: 0.08,
    apilable: false,
    manipulacion: "manual",
    vehiculoMinimo: "camion_simple",
    grupoCarga: "voluminoso",
  },
  Riego: { pesoUnitarioKg: 6, volumenM3: 0.03, grupoCarga: "general" },
  Látex: { pesoUnitarioKg: 5, volumenM3: 0.006, manipulacion: "manual" },
  Esmaltes: { pesoUnitarioKg: 1.5, volumenM3: 0.002, manipulacion: "manual" },
  Selladores: { pesoUnitarioKg: 0.4, volumenM3: 0.0008, manipulacion: "manual" },
  Taladros: { pesoUnitarioKg: 3, volumenM3: 0.02, fragil: true, manipulacion: "manual" },
  Sierras: { pesoUnitarioKg: 4, volumenM3: 0.025, fragil: true, manipulacion: "manual" },
  Esmeriles: { pesoUnitarioKg: 3, volumenM3: 0.02, fragil: true, manipulacion: "manual" },
  Atornilladores: { pesoUnitarioKg: 1.5, volumenM3: 0.008, fragil: true, manipulacion: "manual" },
  Fertilizantes: {
    pesoUnitarioKg: 25,
    volumenM3: 0.02,
    unidadesPorPallet: 40,
    cargaPesada: true,
    manipulacion: "horquilla",
    vehiculoMinimo: "camion_simple",
    grupoCarga: "pesado",
  },
};

/** Perfiles por categoría (fallback si la subcategoría no está mapeada). */
const CATEGORY_PROFILES: Record<string, Partial<Profile>> = {
  Construcción: {
    pesoUnitarioKg: 20,
    volumenM3: 0.02,
    cargaPesada: true,
    manipulacion: "horquilla",
    vehiculoMinimo: "camion_rampla",
    grupoCarga: "pesado",
  },
  Cementos: { pesoUnitarioKg: 25, cargaPesada: true, grupoCarga: "pesado" },
  Acero: { sobredimensionado: true, cargaPesada: true, grupoCarga: "largo" },
  Áridos: { pesoUnitarioKg: 25, cargaPesada: true, grupoCarga: "pesado" },
  Maderas: {
    pesoUnitarioKg: 12,
    volumenM3: 0.02,
    sobredimensionado: true,
    manipulacion: "horquilla",
    vehiculoMinimo: "camion_rampla",
    grupoCarga: "largo",
  },
  Pinturas: { pesoUnitarioKg: 4, volumenM3: 0.005, manipulacion: "manual" },
  Gasfitería: { pesoUnitarioKg: 3, volumenM3: 0.02 },
  "Herramientas eléctricas": {
    pesoUnitarioKg: 3,
    volumenM3: 0.02,
    fragil: true,
    manipulacion: "manual",
  },
  Electricidad: { pesoUnitarioKg: 4, volumenM3: 0.01 },
  Ferretería: { pesoUnitarioKg: 2, volumenM3: 0.008 },
  Jardín: { pesoUnitarioKg: 6, volumenM3: 0.03 },
  Agrícola: { pesoUnitarioKg: 15, volumenM3: 0.02, grupoCarga: "pesado" },
  "Seguridad industrial": { pesoUnitarioKg: 1, volumenM3: 0.005 },
};

// ----------------------------------------------------------------------------
//  Overrides por SKU: productos con logística particular (los "difíciles").
// ----------------------------------------------------------------------------

const SKU_OVERRIDES: Record<string, Partial<ProductLogistics>> = {
  // Estanque de agua: voluminoso, frágil (rotomoldeado), no apilar carga encima,
  // no puede viajar bajo cemento/áridos; sale desde una planta distinta y con
  // disponibilidad diferida.
  "CON-006": {
    pesoUnitarioKg: 85,
    volumenM3: 6.5,
    apilable: false,
    fragil: true,
    sobredimensionado: true,
    cargaPesada: false,
    manipulacion: "grua",
    vehiculoMinimo: "camion_rampla",
    grupoCarga: "sobredimensionado",
    incompatibleCon: ["pesado"],
    centroRetiro: "Planta Curicó",
    fechaDisponible: addDaysISO(TODAY_ISO, 2),
    tiempoCargaMin: 40,
  },
  // Fosa séptica: pesada, sobredimensionada y requiere camión pluma para cargar.
  "CON-007": {
    pesoUnitarioKg: 120,
    volumenM3: 4.2,
    apilable: false,
    fragil: false,
    sobredimensionado: true,
    cargaPesada: true,
    manipulacion: "pluma",
    vehiculoMinimo: "camion_pluma",
    grupoCarga: "sobredimensionado",
    incompatibleCon: ["pesado"],
    centroRetiro: "CD Talca",
    fechaDisponible: addDaysISO(TODAY_ISO, 4),
    tiempoCargaMin: 45,
  },
};

// ----------------------------------------------------------------------------
//  Resolver
// ----------------------------------------------------------------------------

function centerForProduct(p: Product): string {
  return SUPPLIER_CENTER[p.supplierId] ?? DEFAULT_CENTER;
}

/**
 * Devuelve la ficha logística completa de un producto. Prioridad:
 *   1. `product.logistica` explícita (si viene),
 *   2. override por SKU,
 *   3. perfil por subcategoría,
 *   4. perfil por categoría,
 *   5. perfil base.
 * El centro y la fecha se completan por proveedor si no vienen definidos.
 */
export function productLogistics(p: Product): ProductLogistics {
  const merged: Profile = {
    ...BASE_PROFILE,
    ...(CATEGORY_PROFILES[p.category] ?? {}),
    ...(SUBCATEGORY_PROFILES[p.subcategory] ?? {}),
  };

  const base: ProductLogistics = {
    ...merged,
    centroRetiro: centerForProduct(p),
    fechaDisponible: TODAY_ISO,
  };

  return {
    ...base,
    ...(p.logistica ?? {}),
    ...(SKU_OVERRIDES[p.sku] ?? {}),
  };
}
