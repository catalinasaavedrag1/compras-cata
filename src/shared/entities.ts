// ============================================================================
//  Capa de navegación contextual entre módulos.
//  Define una referencia genérica de entidad (EntityRef) y resolvers que
//  conectan productos, proveedores, categorías, órdenes, alertas, etc.
//  Permite que cualquier dato pueda abrirse y navegar a lo relacionado.
// ============================================================================

import {
  productService,
  supplierService,
  categoryService,
  purchaseOrderService,
  recommendationService,
  alertService,
  campaignOpportunityService,
} from "../services";

export type EntityType =
  | "product"
  | "supplier"
  | "category"
  | "purchaseOrder"
  | "recommendation"
  | "alert"
  | "campaign";

export interface EntityRef {
  entityType: EntityType;
  entityId: string;
  moduleKey: string;
  displayName: string;
  status?: string;
  route: string;
}

/** Registro de módulos: nombre legible y ruta base. */
export const moduleRegistry: Record<string, { label: string; basePath: string }> = {
  productos: { label: "Productos", basePath: "/productos" },
  proveedores: { label: "Proveedores", basePath: "/proveedores" },
  categorias: { label: "Categorías", basePath: "/categorias" },
  ordenes: { label: "Órdenes de compra", basePath: "/ordenes-compra" },
  reposicion: { label: "Reposición", basePath: "/reposicion" },
  alertas: { label: "Alertas", basePath: "/alertas" },
  campanas: { label: "Campañas", basePath: "/campanas-oportunidades" },
};

const ENTITY_TYPE_LABEL: Record<EntityType, string> = {
  product: "Producto",
  supplier: "Proveedor",
  category: "Categoría",
  purchaseOrder: "Orden de compra",
  recommendation: "Recomendación",
  alert: "Alerta",
  campaign: "Campaña",
};

export function entityTypeLabel(t: EntityType): string {
  return ENTITY_TYPE_LABEL[t];
}

// --- Constructores de referencia por entidad --------------------------------

export function productRef(sku: string): EntityRef | null {
  const p = productService.getBySku(sku);
  if (!p) return null;
  return {
    entityType: "product",
    entityId: p.sku,
    moduleKey: "productos",
    displayName: p.name,
    status: p.purchaseStatus,
    route: `/productos/${p.sku}`,
  };
}

export function supplierRef(name: string): EntityRef | null {
  const s = supplierService.getByName(name);
  if (!s) return null;
  return {
    entityType: "supplier",
    entityId: s.id,
    moduleKey: "proveedores",
    displayName: s.name,
    status: s.status,
    route: "/proveedores",
  };
}

export function categoryRef(name: string): EntityRef | null {
  const c = categoryService.getByName(name);
  if (!c) return null;
  return {
    entityType: "category",
    entityId: c.id,
    moduleKey: "categorias",
    displayName: c.name,
    status: c.status,
    route: "/categorias",
  };
}

// --- Resolver de entidades relacionadas -------------------------------------

/** Devuelve las entidades relacionadas con un producto (otros módulos). */
export function relatedEntitiesForProduct(sku: string): EntityRef[] {
  const p = productService.getBySku(sku);
  if (!p) return [];
  const refs: EntityRef[] = [];

  if (p.supplierName) {
    const s = supplierRef(p.supplierName);
    if (s) refs.push(s);
  }
  const cat = categoryRef(p.category);
  if (cat) refs.push(cat);

  const rec = recommendationService.getBySku(sku);
  if (rec) {
    refs.push({
      entityType: "recommendation",
      entityId: rec.id,
      moduleKey: "reposicion",
      displayName: `Reposición sugerida (${rec.suggestedQuantity} u.)`,
      status: rec.status,
      route: "/reposicion",
    });
  }

  for (const o of purchaseOrderService.bySku(sku)) {
    refs.push({
      entityType: "purchaseOrder",
      entityId: o.id,
      moduleKey: "ordenes",
      displayName: o.number,
      status: o.status,
      route: "/ordenes-compra",
    });
  }

  for (const a of alertService.bySku(sku)) {
    refs.push({
      entityType: "alert",
      entityId: a.id,
      moduleKey: "alertas",
      displayName: a.relatedEntity,
      status: a.status,
      route: "/alertas",
    });
  }

  for (const opp of campaignOpportunityService.bySku(sku)) {
    refs.push({
      entityType: "campaign",
      entityId: opp.id,
      moduleKey: "campanas",
      displayName: opp.campaignName,
      status: opp.status,
      route: "/campanas-oportunidades",
    });
  }

  return refs;
}
