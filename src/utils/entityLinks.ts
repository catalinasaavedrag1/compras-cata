// ============================================================================
//  Rutas de detalle por entidad, sin depender de los mocks.
//  Las fichas reales usan los ids del purchase-bff (proveedor "SUP-…",
//  categoría "cat-…"). Si el call site solo tiene un nombre, cae a la lista
//  (nunca a un 404): la conectividad plena llega cuando la fila trae el id.
// ============================================================================

export function supplierPath(idOrName: string | null | undefined): string {
  if (!idOrName) return "/proveedores";
  // Solo el id real del proveedor (SUP-001, …) enlaza a la ficha.
  return /^SUP-/i.test(idOrName) ? `/proveedores/${idOrName}` : "/proveedores";
}

export function categoryPath(idOrName: string | null | undefined): string {
  if (!idOrName) return "/categorias";
  // Id real (cat-gasfiteria, …) → ficha; nombre → lista prefiltrada.
  return /^cat-/i.test(idOrName)
    ? `/categorias/${idOrName}`
    : `/categorias?cat=${encodeURIComponent(idOrName)}`;
}

export function productPath(sku: string | undefined): string {
  return sku ? `/productos/${sku}` : "/productos";
}
