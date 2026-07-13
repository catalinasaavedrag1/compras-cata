import type { InventoryByGroup } from "../types/purchasing";

export interface InventoryKpis {
  totalInventoryValue: number;
  availableStockValue: number;
  committedStockValue: number;
  deadStockValue: number;
  slowStockValue: number;
  overstockValue: number;
  averageInventoryDays: number;
}

export const inventoryKpis: InventoryKpis = {
  totalInventoryValue: 334900000,
  availableStockValue: 298400000,
  committedStockValue: 36500000,
  deadStockValue: 12800000,
  slowStockValue: 41700000,
  overstockValue: 58300000,
  averageInventoryDays: 62,
};

export const inventoryByCategory: InventoryByGroup[] = [
  {
    label: "Construcción",
    inventoryValue: 64200000,
    availableStock: 5800,
    deadStock: 1200000,
    overstockValue: 6400000,
  },
  {
    label: "Herramientas eléctricas",
    inventoryValue: 52600000,
    availableStock: 1240,
    deadStock: 800000,
    overstockValue: 3100000,
  },
  {
    label: "Ferretería",
    inventoryValue: 41800000,
    availableStock: 9600,
    deadStock: 1900000,
    overstockValue: 11200000,
  },
  {
    label: "Electricidad",
    inventoryValue: 33700000,
    availableStock: 7400,
    deadStock: 600000,
    overstockValue: 9800000,
  },
  {
    label: "Jardín",
    inventoryValue: 31600000,
    availableStock: 2100,
    deadStock: 4200000,
    overstockValue: 12600000,
  },
  {
    label: "Pinturas",
    inventoryValue: 28900000,
    availableStock: 3300,
    deadStock: 700000,
    overstockValue: 5900000,
  },
  {
    label: "Maderas",
    inventoryValue: 26800000,
    availableStock: 1800,
    deadStock: 500000,
    overstockValue: 1400000,
  },
  {
    label: "Gasfitería",
    inventoryValue: 22100000,
    availableStock: 4200,
    deadStock: 300000,
    overstockValue: 1100000,
  },
  {
    label: "Seguridad industrial",
    inventoryValue: 18400000,
    availableStock: 2900,
    deadStock: 1300000,
    overstockValue: 5800000,
  },
  {
    label: "Agrícola",
    inventoryValue: 14300000,
    availableStock: 950,
    deadStock: 1300000,
    overstockValue: 1000000,
  },
];

export const inventoryByWarehouse: InventoryByGroup[] = [
  {
    label: "Centro de Distribución",
    inventoryValue: 168400000,
    availableStock: 21800,
    deadStock: 6400000,
    overstockValue: 29100000,
  },
  {
    label: "Balmaceda San Javier",
    inventoryValue: 92600000,
    availableStock: 11200,
    deadStock: 3700000,
    overstockValue: 16800000,
  },
  {
    label: "Chorrillos San Javier",
    inventoryValue: 73900000,
    availableStock: 9300,
    deadStock: 2700000,
    overstockValue: 12400000,
  },
];

export const inventoryByRotation: InventoryByGroup[] = [
  {
    label: "Alta rotación (>10)",
    inventoryValue: 121300000,
    availableStock: 18400,
    deadStock: 0,
    overstockValue: 2100000,
  },
  {
    label: "Rotación media (4-10)",
    inventoryValue: 109800000,
    availableStock: 14200,
    deadStock: 1200000,
    overstockValue: 12600000,
  },
  {
    label: "Baja rotación (1-4)",
    inventoryValue: 78900000,
    availableStock: 7100,
    deadStock: 6800000,
    overstockValue: 31200000,
  },
  {
    label: "Sin rotación (<1)",
    inventoryValue: 24900000,
    availableStock: 2600,
    deadStock: 4800000,
    overstockValue: 12400000,
  },
];
