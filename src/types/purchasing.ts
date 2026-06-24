// ============================================================================
//  Tipos centrales de la Plataforma de Compras
//  Todo el dominio de negocio (productos, proveedores, OC, alertas, etc.)
// ============================================================================

export type ProductStatus =
  | "active"
  | "new"
  | "discontinued"
  | "no_sales"
  | "seasonal"
  | "blocked";

export type PurchaseStatus =
  | "buy"
  | "do_not_buy"
  | "review"
  | "on_demand"
  | "overstock";

export type RecommendationStatus =
  | "critical"
  | "buy_now"
  | "review"
  | "normal"
  | "overstock";

export type Priority = "high" | "medium" | "low";

export type PurchaseOrderStatus =
  | "draft"
  | "sent"
  | "confirmed"
  | "partially_received"
  | "received"
  | "delayed"
  | "cancelled";

export type AlertSeverity = "high" | "medium" | "low";

export type AlertStatus = "new" | "in_review" | "resolved" | "ignored";

export type SupplierStatus =
  | "active"
  | "review"
  | "delayed"
  | "blocked"
  | "inactive";

export type CategoryStatus =
  | "healthy"
  | "review"
  | "critical"
  | "overstock"
  | "low_rotation";

export type AlertType =
  | "stockout"
  | "stockout_risk"
  | "overstock"
  | "low_margin"
  | "cost_increase"
  | "supplier_delay"
  | "no_sales"
  | "unexpected_demand"
  | "no_supplier"
  | "po_delayed"
  | "high_suggested_purchase"
  | "dead_stock"
  | "outdated_cost";

export interface StockByLocation {
  locationName: string;
  stock: number;
  available: number;
  committed: number;
}

export interface Product {
  sku: string;
  name: string;
  category: string;
  subcategory: string;
  brand: string;
  supplierId: string;
  supplierName: string;
  cost: number;
  price: number;
  margin: number; // porcentaje 0-100
  totalStock: number;
  availableStock: number;
  committedStock: number;
  monthlySales: number;
  salesLast30Days: number;
  salesLast90Days: number;
  salesLast180Days: number;
  rotation: number; // veces al año
  inventoryDays: number;
  minStock: number;
  maxStock: number;
  reorderPoint: number;
  supplierLeadTimeDays: number;
  costUpdatedAt: string; // fecha ISO
  productStatus: ProductStatus;
  purchaseStatus: PurchaseStatus;
  stockByLocation: StockByLocation[];
}

export interface PurchaseRecommendation {
  id: string;
  sku: string;
  productName: string;
  category: string;
  brand: string;
  supplierName: string;
  currentStock: number;
  committedStock: number;
  availableStock: number;
  salesLast30Days: number;
  salesLast90Days: number;
  rotation: number;
  inventoryDays: number;
  minStock: number;
  maxStock: number;
  reorderPoint: number;
  supplierLeadTimeDays: number;
  suggestedQuantity: number;
  unitCost: number;
  suggestedPurchaseAmount: number;
  margin: number;
  priority: Priority;
  status: RecommendationStatus;
  reason: string;
  risk: string;
}

export interface Supplier {
  id: string;
  name: string;
  rut: string;
  categories: string[];
  associatedSkus: number;
  openPurchaseOrders: number;
  deliveryCompliance: number; // porcentaje 0-100
  averageLeadTimeDays: number;
  lastPurchaseDate: string;
  purchasedAmountLast90Days: number;
  pendingAmount: number;
  status: SupplierStatus;
}

export interface PurchaseOrderLine {
  sku: string;
  productName: string;
  quantity: number;
  unitCost: number;
}

export interface PurchaseOrder {
  id: string;
  number: string;
  supplierName: string;
  createdAt: string;
  expectedDate: string;
  status: PurchaseOrderStatus;
  totalAmount: number;
  skuCount: number;
  destinationWarehouse: string;
  buyerName: string;
  delayedDays: number;
  lines?: PurchaseOrderLine[];
}

export interface CommercialAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  relatedEntity: string;
  relatedSku?: string;
  description: string;
  recommendation: string;
  date: string;
  responsible: string;
  status: AlertStatus;
}

export interface Category {
  id: string;
  name: string;
  buyer: string;
  activeSkus: number;
  salesLast30Days: number;
  salesLast90Days: number;
  averageMargin: number;
  inventoryValue: number;
  stockoutSkus: number;
  riskSkus: number;
  overstockSkus: number;
  averageRotation: number;
  suggestedPurchase: number;
  status: CategoryStatus;
}

export interface SalesPoint {
  category: string;
  last30Days: number;
  last90Days: number;
  last180Days: number;
  growth: number; // variación % vs período anterior
}

export interface TopProduct {
  sku: string;
  name: string;
  category: string;
  unitsLast30Days: number;
  amountLast30Days: number;
  growth: number;
}

export interface InventoryByGroup {
  label: string;
  inventoryValue: number;
  availableStock: number;
  deadStock: number;
  overstockValue: number;
}

export interface PurchaseRule {
  id: string;
  scope: string; // categoría o "Global"
  targetInventoryDays: number;
  minStock: number;
  maxStock: number;
  minMargin: number; // %
  leadTimeDays: number;
  notes: string;
}

// ============================================================================
//  Campañas y oportunidades comerciales
// ============================================================================

export type CampaignChannel =
  | "web"
  | "marketplace"
  | "store"
  | "omnichannel"
  | "b2b"
  | "social"
  | "email";

export type CampaignOpportunityType =
  | "planned_campaign"
  | "liquidation_suggested"
  | "accelerated_growth"
  | "stockout_risk"
  | "star_product"
  | "review_before_campaign"
  | "not_recommended";

export type CampaignOpportunityStatus =
  | "ready_for_campaign"
  | "buy_before_campaign"
  | "stockout_risk"
  | "liquidate"
  | "boost"
  | "review_margin"
  | "review_supplier"
  | "not_recommended";

export interface CampaignOpportunity {
  id: string;
  sku: string;
  productName: string;
  category: string;
  brand: string;
  supplierName: string;
  opportunityType: CampaignOpportunityType;
  channel: CampaignChannel;
  campaignName: string;
  campaignDate: string; // fecha ISO
  daysToCampaign: number; // días hasta la campaña
  availableStock: number;
  salesLast30Days: number;
  previousPeriodSales: number;
  growthRate: number; // % vs período anterior
  estimatedCampaignSales: number;
  requiredStock: number;
  stockGap: number; // requiredStock - availableStock (positivo = falta)
  suggestedPurchaseQuantity: number;
  unitCost: number;
  margin: number;
  status: CampaignOpportunityStatus;
  risk: string;
  recommendation: string;
  actionLabel: string;
}
