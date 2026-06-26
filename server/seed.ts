// ============================================================================
//  Semilla del backend: toma los datos mock del front (fuente única) y arma
//  el "db.json" que sirve el servidor. Ejecutar: npm run seed
// ============================================================================
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { products } from "../src/data/mockProducts";
import { suppliers } from "../src/data/mockSuppliers";
import { categories } from "../src/data/mockCategories";
import { purchaseOrders } from "../src/data/mockPurchaseOrders";
import { recommendations } from "../src/data/mockRecommendations";
import { alerts } from "../src/data/mockAlerts";
import { campaignOpportunities } from "../src/data/mockCampaignOpportunities";
import { signals } from "../src/data/mockSignals";
import { approvalRequests } from "../src/data/mockApprovals";
import { purchaseDecisions } from "../src/data/mockDecisions";
import { buyers } from "../src/data/mockBuyers";
import { purchaseRules } from "../src/data/mockRules";
import { receptions } from "../src/data/mockReceptions";

export interface Db {
  [collection: string]: unknown[];
}

// Cada colección con su campo identificador (para GET/:id, PATCH, DELETE).
export const ID_FIELD: Record<string, string> = {
  products: "sku",
  suppliers: "id",
  categories: "id",
  "purchase-orders": "id",
  recommendations: "id",
  alerts: "id",
  "campaign-opportunities": "id",
  signals: "id",
  approvals: "id",
  decisions: "id",
  buyers: "id",
  rules: "id",
  receptions: "id",
};

export function buildDb(): Db {
  return {
    products: [...products],
    suppliers: [...suppliers],
    categories: [...categories],
    "purchase-orders": [...purchaseOrders],
    recommendations: [...recommendations],
    alerts: [...alerts],
    "campaign-opportunities": [...campaignOpportunities],
    signals: [...signals],
    approvals: [...approvalRequests],
    decisions: [...purchaseDecisions],
    buyers: [...buyers],
    rules: [...purchaseRules],
    receptions: [...receptions],
  };
}

export const DB_PATH = join(dirname(fileURLToPath(import.meta.url)), "db.json");

// Si se ejecuta directamente, escribe el archivo.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const db = buildDb();
  writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
  const total = Object.values(db).reduce((a, c) => a + c.length, 0);
  console.log(`✓ db.json generado: ${Object.keys(db).length} colecciones, ${total} registros`);
}
