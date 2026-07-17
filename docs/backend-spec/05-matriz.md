# 05 · Matriz frontend → endpoint → servicio → entidad → fuente de datos

Cumple el requisito #10. **Fuente de datos hoy**: `mock` (import directo), `collection` (pasa por
`useCollection`/backend de referencia), `localStorage` (persistencia real actual), `hash-sim`
(determinista por SKU), `derivado` (agregado calculado). **Servicio destino**: dominio propuesto.

| # | Vista / acción | Endpoint propuesto | Servicio destino | Entidad | Fuente hoy |
|---|---|---|---|---|---|
| 1 | ReplenishmentPage (listar) | `GET /recommendations` | Purchase Core | PurchaseRecommendation | collection + `rec-overrides/ignored` |
| 2 | ReplenishmentPage (ajustar/ignorar) | `PATCH /recommendations/:id` | Purchase Core | PurchaseRecommendation | localStorage |
| 3 | Borrador OC (leer/editar) | `GET/PATCH /purchase-drafts/current` | Purchase Core | PurchaseOrderDraft | `oc-draft` |
| 4 | PurchaseOrdersPage (emitir) | `POST /purchase-orders` | Purchase Core → SAP B1 | PurchaseOrder | `po-created` (+ único `apiCreate`) |
| 5 | PurchaseOrdersPage (estado) | `PATCH /purchase-orders/:id` | Purchase Core → SAP B1 | PurchaseOrder | `po-status` |
| 6 | ApprovalsPage | `GET/PATCH /approvals/:id` | Purchase Governance | Approval | `approvals(-created)`, `approval-notes` |
| 7 | AprendizajePage (decisiones) | `GET/POST /decisions` | Purchase Core | Decision | `decisions-created` |
| 8 | ReceptionsPage | `GET/POST/PATCH /receptions` | SAP B1 / WMS | Reception(+Item) | collection (estados solo semilla) |
| 9 | ClaimsPage | `GET/POST/PATCH /claims` | Supplier / Purchase Core | SupplierClaim | `claims` (mock seed) |
| 10 | RfqPage | `GET/POST/PATCH /rfqs` | Purchase Core / Supplier | Rfq | `rfq`, `rfq-status` (mock seed) |
| 11 | PlanRetiroPage | `GET /bff/pickup-plan` | Logistics/TMS | PickupPlan | hash-sim / `data/logistics` |
| 12 | PriceIncreasesPage | `GET/POST/PATCH /price-lists` | Pricing | PriceList | `price-lists` (mock seed) |
| 13 | SignalsContext (señales) | `GET/POST/PATCH /signals` | Sales / Notification | SalesSignal | collection + `signals` |
| 14 | AlertsPage | `GET/PATCH /alerts/:id` | Notification | CommercialAlert | collection + `alert-status` |
| 15 | CampaignsPage (planes) | `GET/POST /campaign-plans` | Marketing | CampaignPlan | `campaign-plans` (mock seed) |
| 16 | CampaignOpportunitiesPage | `GET /campaign-opportunities` · `POST /campaigns` | Marketing / Planning | CampaignOpportunity, CreatedCampaign | collection + `campaigns` |
| 17 | Campaign performance | `GET /campaign-performance` | Marketing (analytics ext.) | CampaignPerformance | hash-sim |
| 18 | SeasonPlannerPage | `GET /seasons` · `PATCH /forecast-adjustments/:sku` | Planning | Season, ForecastAdjustment | mock + `forecast-adj:{sku}` |
| 19 | SeasonsChannelsPage | `GET /channel-demand` | Planning / Sales | ChannelDemand | hash-sim |
| 20 | ImportsPage | `GET/PATCH /imports` · `POST /imports/:id/docs` | Logistics / DMS | ImportOrder(+Doc) | mock |
| 21 | ProductsPage | `GET /products` | Catalog | Product | collection |
| 22 | ProductDetailPage (negociación) | `GET /products/:sku/negotiation` | Pricing / Supplier | ProductNegotiation | hash-sim |
| 23 | ProductDetailPage (margen) | `GET /products/:sku/margin` | Sales | ChannelMargin | hash-sim / derivado |
| 24 | ProductDetailPage (alta) | `POST /products` | Catalog | Product | mock (NewProducts) |
| 25 | CategoriesPage / detail | `GET /categories(/:id)` | Catalog | Category | collection/mock |
| 26 | SuppliersPage | `GET /suppliers` | Supplier | Supplier | collection |
| 27 | SupplierDetailPage (evaluación) | `GET /suppliers/:id/evaluation` | Supplier | SupplierEvaluation | hash-sim |
| 28 | Supplier (negociación/términos/acuerdos) | `POST /suppliers/:id/negotiation-rounds` · `PUT /terms` · `POST /agreements` | Supplier | NegotiationRound, SupplierTerms, SupplierAgreement | `negotiations/terms/agreements:{id}` |
| 29 | AssortmentPage / CatalogOptimization | `GET /assortment(/redundancy)` | Catalog | AssortmentView | mock + hash-sim |
| 30 | NewProductsPage (NPI) | `GET /npi` · `POST /products` | Catalog | ProductIntro | mock |
| 31 | InventoryAnalysisPage | `GET /inventory/analysis` | Inventory | InventoryKPIs | derivado (mockInventory) |
| 32 | PurchaseAnalysisPage | `GET /purchase-analysis` | Sales / Purchase Core | PurchaseAnalysis | collection(products) + derivado |
| 33 | SalesAnalysisPage | `GET /sales/analysis` | Sales | SalesKPIs | derivado (mockSales) |
| 34 | ChannelMarginPage | `GET /channel-margin` | Sales / Pricing | ChannelMargin | derivado (mockChannelMargin) |
| 35 | ReportsPage | `GET /reports/:report` | BFF (compone varios) | (agregados) | derivado |
| 36 | BudgetPage | `GET /budget` | Purchase Core / Finance | Budget/OTB | derivado + `monthlyPurchaseBudget` (rules) |
| 37 | LostOpportunitiesPage | `GET /lost-opportunities` | Sales / Purchase Core | LostOpportunity | hash-sim (`mesesSinCompra`) |
| 38 | AprendizajePage (calidad) | `GET /purchase-quality` | Purchase Core | PurchaseQuality | derivado |
| 39 | DocumentsPage | `GET/POST /documents` | DMS | ProcurementDoc | mock |
| 40 | SettingsPage (/reglas) | `GET/POST/PATCH /rules` | Purchase Governance | PurchaseRule | collection |
| 41 | GovernancePage | `GET /governance/roles\|approval-matrix` · `GET /audit` | Purchase Governance | Role, ApprovalMatrix, AuditEntry | derivado + `trace` |
| 42 | TeamDashboard/Workload/Buyers | `GET /team/*` · `PATCH /assignments` | Team/Performance | Buyer, Workload | collection(buyers) + mock |
| 43 | RankingPage (premios) | `GET/POST/PATCH/DELETE /rewards` | Team/Gamification | Reward | `rewards` |
| 44 | GoalsPage | `GET /goals` | Team/Performance | Goal (OKR) | mock |
| 45 | TeamAlertsPage | `GET/PATCH /team/alerts` | Team / Notification | TeamAlert | mock |
| 46 | Transversal (sesión/rol) | `GET /session` · `POST /auth/*` | Identity | User/Session | `auth/role/buyer` |
| 47 | Transversal (bitácora) | `POST /audit` · `GET /audit` | Purchase Governance | AuditEntry | `trace` |
| 48 | Transversal (notif leídas) | `PATCH /notifications/read` | Notification | NotificationState | `notif-read` |

## Lectura de la matriz
- **Todo lo que hoy es `localStorage`** (filas 2-16, 28, 43, 47-48) es la lista directa de
  **endpoints de escritura a crear** — no existen aún en ningún servicio.
- **Todo lo que hoy es `hash-sim`** (filas 11, 17, 19, 22-23, 27, 37) requiere un **servicio real**
  que hoy no existe: es la mayor brecha de "inteligencia" de la plataforma.
- **Lo que ya pasa por `collection`** (filas 1, 8, 13-14, 16, 21, 25-26, 40, 42) es lo más cercano a
  "ya existe" — solo falta cablear las 3 páginas restantes y añadir escritura.
