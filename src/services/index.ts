// ============================================================================
//  Capa de servicios por dominio.
//  Los componentes y hooks consumen estos servicios, nunca los datos mock
//  directamente. Cambiar a backend real = cambiar solo esta capa.
// ============================================================================

import { getMock } from "./apiClient";
import { products } from "../data/mockProducts";
import { suppliers } from "../data/mockSuppliers";
import { categories } from "../data/mockCategories";
import { purchaseOrders } from "../data/mockPurchaseOrders";
import { recommendations } from "../data/mockRecommendations";
import { alerts } from "../data/mockAlerts";
import { campaignOpportunities } from "../data/mockCampaignOpportunities";
import { signals } from "../data/mockSignals";

export const productService = {
  list: () => getMock(products),
  getBySku: (sku: string) => products.find((p) => p.sku === sku),
};

export const supplierService = {
  list: () => getMock(suppliers),
  getByName: (name: string) => suppliers.find((s) => s.name === name),
};

export const categoryService = {
  list: () => getMock(categories),
  getByName: (name: string) => categories.find((c) => c.name === name),
};

export const purchaseOrderService = {
  list: () => getMock(purchaseOrders),
  bySku: (sku: string) => purchaseOrders.filter((o) => o.lines?.some((l) => l.sku === sku)),
  bySupplier: (name: string) => purchaseOrders.filter((o) => o.supplierName === name),
};

export const recommendationService = {
  list: () => getMock(recommendations),
  getBySku: (sku: string) => recommendations.find((r) => r.sku === sku),
};

export const alertService = {
  list: () => getMock(alerts),
  bySku: (sku: string) => alerts.filter((a) => a.relatedSku === sku),
};

export const campaignOpportunityService = {
  list: () => getMock(campaignOpportunities),
  bySku: (sku: string) => campaignOpportunities.filter((o) => o.sku === sku),
};

export const signalService = {
  list: () => getMock(signals),
  bySku: (sku: string) => signals.filter((s) => s.sku === sku),
};
