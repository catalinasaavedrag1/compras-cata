# 04 · Endpoints propuestos por vista (propuesta, sin implementar)

> Notación REST orientativa. `Q` = query params de filtro/orden/paginación (el backend **debe**
> soportarlos server-side; hoy todo es client-side). Los endpoints marcados **[BFF]** son
> composiciones que agrega el Purchase BFF (ver doc 07). No se implementa nada aquí.

## Convenciones transversales
- Filtro/orden/paginación estándar: `?q=&sort=&order=&page=&pageSize=` + filtros por vista.
- Escritura audita: toda `POST/PATCH` relevante crea entrada de bitácora (`POST /audit`).
- `GET /session` (Identity) y `GET /server-time` (fecha real; hoy `TODAY_ISO` hardcoded).

---

| Vista | Endpoints propuestos |
|---|---|
| **LoginPage** | `POST /auth/login` · `POST /auth/logout` · `GET /session` (Identity) |
| **MyPanelPage (Inicio/Cartera)** | **[BFF]** `GET /bff/home?buyer=&scope=` (bandeja + agenda + KPIs) compone recommendations, alerts, approvals pendientes, signals, budget |
| **MyPerformancePage** | **[BFF]** `GET /bff/my-performance?buyer=` (score, metas, decisiones, ahorro) |
| **ReplenishmentPage** | `GET /recommendations?foco&q&cat&prov&estado&prioridad&scope` · `PATCH /recommendations/:id` (override/ignore/snooze) · `POST /purchase-drafts/:id/lines` (enviar a borrador) |
| **PurchaseOrdersPage** | `GET /purchase-orders?tab&scope&oc=` · `GET /purchase-orders/:id` · `GET /purchase-drafts/current` · `POST /purchase-orders` (emitir) · `PATCH /purchase-orders/:id` (estado) · `PATCH/DELETE /purchase-drafts/current/lines/:lineId` |
| **ApprovalsPage** | `GET /approvals?estado=pendiente` · `GET /approvals/:id` · `PATCH /approvals/:id` (approve/reject/observe) — **guard líder** |
| **PlanRetiroPage** | **[BFF]** `GET /bff/pickup-plan?draft=current` (Logistics/TMS, hoy estimador front) |
| **ReceptionsPage** | `GET /receptions?alcance&tab&q&prov&desde&hasta&rid=` · `GET /receptions/:id` · `POST /receptions` · `PATCH /receptions/:id` (estado/diferencias) |
| **RfqPage** | `GET /rfqs?estado` · `GET /rfqs/:id` (comparación) · `POST /rfqs` · `PATCH /rfqs/:id` (respuestas/adjudicar) |
| **SeasonPlannerPage** | `GET /seasons` · `GET /seasons/:id/plan?escenario=` · `PATCH /forecast-adjustments/:sku` |
| **ClaimsPage** | `GET /claims?estado` · `POST /claims` · `PATCH /claims/:id` (gestionar/resolver) |
| **ImportsPage** | `GET /imports` · `GET /imports/:id` · `PATCH /imports/:id` (etapa) · `POST /imports/:id/docs` |
| **CampaignsPage** | `GET /campaign-plans?tab` · `POST /campaign-plans` · `GET /campaign-performance?campaign=` (integración analytics) |
| **CampaignOpportunitiesPage** | `GET /campaign-opportunities?query&channel&type&status&category&supplier` · `POST /campaigns` (CreatedCampaign) · `GET /campaigns?mine` |
| **SeasonsChannelsPage** | `GET /channel-demand?season=` (Planning/Sales) |
| **ProductsPage** | `GET /products?q&cat&sub&marca&prov&comercial&compra&stock` (ya usa `useCollection`) |
| **ProductDetailPage** | **[BFF]** `GET /bff/products/:sku?tab=` compone: master (Catalog), `GET /products/:sku/negotiation` (Pricing/Supplier), `/margin` (Sales), `/signals`, `/related`, `/activity` |
| **CategoriesPage** | `GET /categories?scope` |
| **CategoryDetailPage** | **[BFF]** `GET /bff/categories/:id?tab=` (9 pestañas: surtido, rol, proveedores, márgenes, etc.) |
| **SuppliersPage** | `GET /suppliers?q&estado` (ya usa `useCollection`) |
| **SupplierDetailPage** | **[BFF]** `GET /bff/suppliers/:id?tab=` compone ficha, `GET /suppliers/:id/evaluation`, `/seasonality`, `/products`, `/orders`, `/receptions`, `/alerts` · `POST /suppliers/:id/negotiation-rounds` · `PUT /suppliers/:id/terms` · `POST /suppliers/:id/agreements` |
| **AssortmentPage** | `GET /assortment?tab&scope` (rol/tiendas/marca-propia/line-review) |
| **CatalogOptimizationPage** | `GET /assortment/redundancy?cat=` |
| **NewProductsPage** | `GET /npi?tab` · `POST /products` (alta) |
| **InventoryAnalysisPage** | `GET /inventory/analysis` (KPIs + distribución categoría/bodega/rotación) |
| **PurchaseAnalysisPage** | `GET /purchase-analysis?tab&q&cat&marca&prov&scope` (ranking/liquidación) |
| **SalesAnalysisPage** | `GET /sales/analysis?period=30\|90\|180&tab` |
| **ChannelMarginPage** | `GET /channel-margin?alcance&tab&q&canal&estado&cat&prov&scope` |
| **ReportsPage** | `GET /reports/:report?range=` (8 reportes) + export CSV desde el set filtrado |
| **BudgetPage** | `GET /budget?month&query&estado` (OTB) |
| **PriceIncreasesPage** | `GET /price-lists?estado` · `POST /price-lists` (cargar) · `PATCH /price-lists/:id` / `PATCH /price-increases/:id` (aprobar/rechazar) |
| **LostOpportunitiesPage** | `GET /lost-opportunities?q&motivo` (incluye `mesesSinCompra`, hoy simulado) |
| **AprendizajePage** | `GET /purchase-quality` · `GET /decisions?tab` · `POST /decisions` |
| **DocumentsPage** | `GET /documents?filtros` · `POST /documents` (DMS, hoy simulado) |
| **SettingsPage (/reglas)** | `GET /rules?scopeType` · `PATCH /rules/:id` · `POST /rules` · auto-fix |
| **GovernancePage (/gobierno)** | `GET /governance/roles` · `GET /governance/approval-matrix` · `GET /audit?…` (solo lectura) |
| **TeamDashboardPage** | **[BFF]** `GET /bff/team/dashboard` — **guard líder** |
| **WorkloadPage** | `GET /team/workload` · `PATCH /team/assignments` (reasignar/offboard) — **líder** |
| **BuyersPage** | `GET /buyers` — **líder** |
| **RankingPage** | `GET /team/ranking` · `GET/POST/PATCH/DELETE /rewards` — **líder** |
| **GoalsPage** | `GET /goals?comprador&estado` — **líder** |
| **TeamAlertsPage** | `GET /team/alerts` · `PATCH /team/alerts/:id` (enrutar) — **líder** |

## Notas de contrato
- **Paginación server-side obligatoria** en las tablas grandes (Reposición, Productos, Análisis,
  Ranking, Margen-canal, Recepciones) — hoy renderizan el set completo.
- **Deep-links** (`?oc=`, `?rid=`, `?sku`, `?tab=`, `?cat=`, `?foco=`, `?prov=`) implican que los
  `GET` de detalle acepten esos selectores; el BFF debe permitir cargar una vista con contexto
  pre-seleccionado en una sola llamada.
- **Export CSV** se resuelve en cliente sobre datos ya cargados; si el set crece, exponer
  `GET …/export?format=csv` server-side.
