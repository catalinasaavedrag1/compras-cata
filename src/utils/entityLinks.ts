import { getSupplierByName } from "../data/mockSuppliers";
import { categories } from "../data/mockCategories";

// ============================================================================
//  Rutas de detalle por entidad, resolviendo nombre → ruta.
//  Centraliza la conectividad: cualquier nombre de proveedor/categoría/producto
//  enlaza a su ficha. Si no se resuelve el id, cae a la lista (nunca a un 404).
// ============================================================================

export function supplierPath(name: string | undefined): string {
  if (!name) return "/proveedores";
  const id = getSupplierByName(name)?.id;
  return id ? `/proveedores/${id}` : "/proveedores";
}

export function categoryPath(name: string | undefined): string {
  if (!name) return "/categorias";
  const id = categories.find((c) => c.name === name)?.id;
  return id ? `/categorias/${id}` : `/categorias?cat=${encodeURIComponent(name)}`;
}

export function productPath(sku: string | undefined): string {
  return sku ? `/productos/${sku}` : "/productos";
}
