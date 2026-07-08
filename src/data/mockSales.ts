import type { SalesPoint, TopProduct } from "../types/purchasing";

export interface SalesKpis {
  salesLast30Days: number;
  salesLast90Days: number;
  salesLast180Days: number;
  topGrowthCategory: string;
  topProduct: string;
  topDropProduct: string;
  averageMargin: number;
  lostSalesByStockout: number;
}

export const salesKpis: SalesKpis = {
  salesLast30Days: 191400000,
  salesLast90Days: 574800000,
  salesLast180Days: 1098200000,
  topGrowthCategory: "Herramientas eléctricas",
  topProduct: "Cemento Polpaico 25 kg",
  topDropProduct: "Carretilla reforzada 90 litros",
  averageMargin: 33.7,
  lostSalesByStockout: 14600000,
};

export const salesByCategory: SalesPoint[] = [
  {
    category: "Herramientas eléctricas",
    last30Days: 41200000,
    last90Days: 119500000,
    last180Days: 224800000,
    growth: 14.2,
  },
  {
    category: "Construcción",
    last30Days: 38400000,
    last90Days: 112800000,
    last180Days: 218600000,
    growth: 8.7,
  },
  {
    category: "Ferretería",
    last30Days: 22900000,
    last90Days: 68100000,
    last180Days: 132400000,
    growth: 3.1,
  },
  {
    category: "Electricidad",
    last30Days: 19800000,
    last90Days: 59400000,
    last180Days: 114900000,
    growth: 6.5,
  },
  {
    category: "Maderas",
    last30Days: 17300000,
    last90Days: 51900000,
    last180Days: 99700000,
    growth: 5.2,
  },
  {
    category: "Gasfitería",
    last30Days: 16500000,
    last90Days: 48700000,
    last180Days: 93100000,
    growth: 9.8,
  },
  {
    category: "Agrícola",
    last30Days: 9100000,
    last90Days: 27800000,
    last180Days: 51200000,
    growth: -2.4,
  },
  {
    category: "Seguridad industrial",
    last30Days: 6200000,
    last90Days: 19100000,
    last180Days: 38900000,
    growth: -1.1,
  },
  {
    category: "Jardín",
    last30Days: 5400000,
    last90Days: 24300000,
    last180Days: 89500000,
    growth: -18.6,
  },
  {
    category: "Pinturas",
    last30Days: 14600000,
    last90Days: 43200000,
    last180Days: 85100000,
    growth: 1.9,
  },
];

export interface SalesBySupplier {
  supplier: string;
  last90Days: number;
  share: number;
}

export const salesBySupplier: SalesBySupplier[] = [
  { supplier: "Proveedor Andes", last90Days: 142600000, share: 24.8 },
  { supplier: "Herramientas Global", last90Days: 98400000, share: 17.1 },
  { supplier: "FerrePro Chile", last90Days: 86700000, share: 15.1 },
  { supplier: "Distribuidora Maule", last90Days: 79200000, share: 13.8 },
  { supplier: "Industrial del Sur", last90Days: 71300000, share: 12.4 },
  { supplier: "Pinturas Nacionales", last90Days: 43200000, share: 7.5 },
  { supplier: "Agroinsumos Central", last90Days: 31900000, share: 5.5 },
  { supplier: "Materiales del Pacífico", last90Days: 21500000, share: 3.7 },
];

export const topProducts: TopProduct[] = [
  {
    sku: "CON-001",
    name: "Cemento Polpaico 25 kg",
    category: "Construcción",
    unitsLast30Days: 540,
    amountLast30Days: 3234600,
    growth: 11.4,
  },
  {
    sku: "ELE-002",
    name: "Ampolleta LED 12W luz fría",
    category: "Electricidad",
    unitsLast30Days: 180,
    amountLast30Days: 448200,
    growth: 6.2,
  },
  {
    sku: "ELE-004",
    name: "Cinta aisladora negra 19 mm",
    category: "Electricidad",
    unitsLast30Days: 150,
    amountLast30Days: 178500,
    growth: 4.8,
  },
  {
    sku: "GAS-001",
    name: "Tubería PVC sanitaria 110 mm",
    category: "Gasfitería",
    unitsLast30Days: 130,
    amountLast30Days: 1038700,
    growth: 9.1,
  },
  {
    sku: "FER-002",
    name: "Clavo corriente 2 pulgadas",
    category: "Ferretería",
    unitsLast30Days: 120,
    amountLast30Days: 238800,
    growth: -2.0,
  },
  {
    sku: "MAD-001",
    name: "Plancha OSB 9,5 mm",
    category: "Maderas",
    unitsLast30Days: 90,
    amountLast30Days: 1619100,
    growth: 7.6,
  },
  {
    sku: "GAS-004",
    name: "Teflón gasfitería 12 mm",
    category: "Gasfitería",
    unitsLast30Days: 90,
    amountLast30Days: 152100,
    growth: 28.0,
  },
  {
    sku: "HER-003",
    name: "Disco corte metal 4 1/2",
    category: "Herramientas eléctricas",
    unitsLast30Days: 75,
    amountLast30Days: 899250,
    growth: 5.4,
  },
];

export interface ProductTrend {
  sku: string;
  name: string;
  category: string;
  growth: number;
  note: string;
}

export const growingProducts: ProductTrend[] = [
  {
    sku: "GAS-004",
    name: "Teflón gasfitería 12 mm",
    category: "Gasfitería",
    growth: 28.0,
    note: "Demanda inesperada: subió 28% sobre el promedio.",
  },
  {
    sku: "CON-001",
    name: "Cemento Polpaico 25 kg",
    category: "Construcción",
    growth: 11.4,
    note: "Crecimiento sostenido por proyectos de la zona.",
  },
  {
    sku: "GAS-001",
    name: "Tubería PVC sanitaria 110 mm",
    category: "Gasfitería",
    growth: 9.1,
    note: "Alza estacional de remodelaciones.",
  },
  {
    sku: "MAD-001",
    name: "Plancha OSB 9,5 mm",
    category: "Maderas",
    growth: 7.6,
    note: "Mayor demanda en construcción liviana.",
  },
];

export const decliningProducts: ProductTrend[] = [
  {
    sku: "JAR-004",
    name: "Manguera jardín 1/2",
    category: "Jardín",
    growth: -34.0,
    note: "Caída de temporada: fin de primavera/verano.",
  },
  {
    sku: "JAR-003",
    name: "Carretilla reforzada 90 litros",
    category: "Jardín",
    growth: -22.5,
    note: "Baja venta y sobrestock acumulado.",
  },
  {
    sku: "SEG-001",
    name: "Guantes de seguridad anticorte",
    category: "Seguridad industrial",
    growth: -9.8,
    note: "Demanda débil; revisar surtido.",
  },
  {
    sku: "PIN-002",
    name: "Esmalte sintético negro",
    category: "Pinturas",
    growth: -4.1,
    note: "Margen bajo y venta plana.",
  },
];

export const seasonalProducts: ProductTrend[] = [
  {
    sku: "JAR-001",
    name: "Malla raschel 80%",
    category: "Jardín",
    growth: -52.0,
    note: "Producto de temporada (primavera-verano).",
  },
  {
    sku: "JAR-004",
    name: "Manguera jardín 1/2",
    category: "Jardín",
    growth: -34.0,
    note: "Riego: peak en temporada cálida.",
  },
  {
    sku: "AGR-001",
    name: "Fertilizante agrícola NPK 25 kg",
    category: "Agrícola",
    growth: 12.0,
    note: "Peak en temporada de siembra.",
  },
];
