// ============================================================================
//  Capacidad física de las bodegas (m³). Una compra puede ser correcta
//  financieramente pero imposible de almacenar: este modelo permite alertar
//  cuando una compra excede el espacio disponible en el centro de destino.
//
//  Los nombres coinciden con `stockByLocation[].locationName` de mockProducts,
//  para poder cruzar el volumen de la compra con la bodega correspondiente.
// ============================================================================

export interface WarehouseCapacity {
  label: string;
  /** Capacidad total de almacenamiento (m³). */
  capacityM3: number;
  /** Ocupación actual (m³). */
  usedM3: number;
}

export const warehouseCapacity: WarehouseCapacity[] = [
  { label: "Centro de Distribución", capacityM3: 9000, usedM3: 8250 },
  { label: "Balmaceda San Javier", capacityM3: 4200, usedM3: 3450 },
  { label: "Chorrillos San Javier", capacityM3: 3600, usedM3: 3100 },
];

const byLabel = new Map(warehouseCapacity.map((w) => [w.label, w]));

export function getWarehouseCapacity(label: string): WarehouseCapacity | undefined {
  return byLabel.get(label);
}

/** Espacio libre (m³) en la bodega indicada. */
export function warehouseHeadroomM3(label: string): number | null {
  const w = byLabel.get(label);
  if (!w) return null;
  return Math.max(0, w.capacityM3 - w.usedM3);
}
