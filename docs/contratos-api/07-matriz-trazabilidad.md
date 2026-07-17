# 07 · Matriz de trazabilidad

> Cumple el punto 13: **vista → acción/dato → endpoint BFF → endpoint interno → servicio responsable
> → entidad → fuente de datos → permiso → evento → estado**. Cobertura 1:1 con la matriz funcional de
> `../backend-spec/05-matriz.md` (48 filas) — ninguna acción del frontend queda sin contrato o sin
> justificación explícita.
>
> Estados: 🟢 contrato listo (servicio existente verificado) · 🟡 contrato listo (a construir en
> purchase/purchase-bff) · 🟠 contrato definido, **dependencia pendiente de verificación/creación** ·
> 🔵 decisión de negocio abre el detalle (P#).

| # | Vista → acción/dato | Endpoint BFF | Endpoint interno | Servicio resp. | Entidad | Fuente de datos | Permiso | Evento | Estado |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Reposición → listar | `POST /replenishment/search` | `POST /recommendations/search` | purchase | PurchaseRecommendation | motor (inventory+pricing+analytics) | `recommendation:read` | — | 🟡/🟠(P5) |
| 2 | Reposición → ajustar/ignorar | `PATCH /replenishment/recommendations/:id` | ídem | purchase | PurchaseRecommendation | purchase DB | `recommendation:write` | `recommendation.overridden/ignored` | 🟡 |
| 3 | Reposición → enviar a borrador | `POST /replenishment/recommendations:add-to-proposal` | `POST /proposals/:id/lines` | purchase | ProposalLine | purchase DB | `proposal:write` | `proposal.line_added` | 🟡 |
| 4 | Críticos → tabla | `POST /products/critical/search` | recommendations/search + fan-out | purchase-bff | (compuesto) | purchase+catalog+inventory+pricing+analytics | `recommendation:read` | — | 🟡/🟠 |
| 5 | Borrador OC → leer/editar | `GET/PATCH /proposals*` | espejo | purchase | PurchaseProposal | purchase DB | `proposal:read/write` | `proposal.*` | 🟡 |
| 6 | Emitir OC | `POST /proposals/:id/convert` | ídem | purchase→SAP | PurchaseOrder | purchase DB + **SAP (SoR)** | `order:issue` | `order.issued`·`otb.consumed` | 🟡 |
| 7 | OC → estado/seguimiento | `GET /purchase-orders*` + `sap-status` | espejo + `PATCH :id/status` (svc) | purchase | PurchaseOrder+SapSync | purchase DB ← SAP | `order:read` | `order.status_changed` | 🟡 |
| 8 | Aprobaciones → bandeja/decidir | `GET /approvals` · `POST /approvals/:id/*` | espejo | purchase (Governance) | Approval | purchase DB | `proposal:approve` | `approval.*` | 🟡 |
| 9 | Decisiones (aprendizaje) | `GET/POST /learning/decisions` | `GET/POST /decisions` (+`PATCH :id/result` svc) | purchase | Decision | purchase DB (+analytics N-días) | `decision:read/write` | `decision.recorded/evaluated` | 🟡/🟠(P5) |
| 10 | RFQ → crear/comparar/adjudicar | `GET/POST /rfqs*` | espejo | purchase (Sourcing) | Rfq+RfqResponse | purchase DB | `rfq:*` | `rfq.*` | 🟡 |
| 11 | Plan de retiro | `GET /proposals/:id/pickup-plan` | — (composición) | purchase-bff + tms | PickupPlan (efímero) | tms | `proposal:read` | — | 🟠 (tms pdte-verif) |
| 12 | Alzas de precio → listar/cargar/decidir | `GET /price-increases` · `POST /price-lists` · `POST /price-increases/:id/approve\|reject` | — (proxy) | **pricing** | PriceAudit/PriceChange/PriceSheet | pricing DB | `cost:read` + pricing `pricing:price:audit` | `pricing.price-audit.*` | 🟢 |
| 13 | Señales → bandeja/reportar/hilo | `GET/POST/PATCH /signals*` | espejo | purchase (Signals) | SalesSignal | purchase DB | `signal:*` | `signal.*` | 🟡 |
| 14 | Alertas → listar/atender | `GET /alerts` · `POST /alerts/:id/*` | espejo (+`POST /alerts` svc) | purchase (Alerts) + notification (push) | CommercialAlert | purchase DB (R1) | `alert:read/ack` | `alert.*` | 🟡 |
| 15 | Campañas → planes | `GET/POST /campaigns*` | espejo | purchase (Planning) | CampaignPlan | purchase DB | `campaign:*` | `campaign.planned` | 🟡🔵(P-campaña) |
| 16 | Anticipación → oportunidades | `GET /campaign-opportunities` | espejo | purchase (Planning) | CampaignOpportunity | purchase DB (detección) | `campaign:read` | `opportunity.detected` | 🟡 |
| 17 | Rendimiento campañas | dentro de `GET /campaigns` (sección) | — | promotion/marketing/analysis | CampaignPerformance | externo | `campaign:read` | — | 🟠 (pdte-verif) |
| 18 | Temporadas → plan/ajuste forecast | `GET /seasons*` · `PATCH /seasons/forecast-adjustments/:sku` | espejo | purchase (Planning) | Season/ForecastAdjustment | purchase DB | `season:*` | `forecast.adjusted` | 🟡 |
| 19 | Demanda por canal | `GET /channel-demand` | espejo | purchase + analysis + comerce (canales) | ChannelDemand | analytics (🟠) + canal maestro 🟢 | `season:read` | — | 🟠 |
| 20 | Importaciones → torre control | `GET/PATCH /imports*` | espejo | purchase | ImportOrder | purchase DB (+docs DMS 🟠) | `order:read` | `import.stage_advanced` | 🟡 |
| 21 | Productos → catálogo | `GET /products` | — (composición) | catalog (+lentes purchase/inventory) | Product/Sku | catalog 🟢 | `recommendation:read` | — | 🟢 |
| 22 | Producto → negociación (tab) | `GET /products/:sku?tab=negociacion` | — | pricing + purchase | waterfall/terms | pricing 🟢 + purchase 🟡 | `cost:read` | — | 🟢/🟡🔵(P-waterfall) |
| 23 | Producto → margen (tab) | `GET /products/:sku?tab=margen` | — | analysis | ChannelMargin | analytics | `margin:read` | — | 🟠 |
| 24 | Alta de producto (NPI) | `POST` vía BFF → catalog | — | **catalog** | Product | catalog 🟢 (`POST /product` existe) | catalog write | `catalog.product.created` | 🟢 |
| 25 | Categorías / detalle | `GET /categories*` | — + assignments | catalog + purchase | Category (+Assignment) | catalog 🟢 + purchase 🟡 | `recommendation:read` | — | 🟢/🟡 |
| 26 | Proveedores → lista | `GET /suppliers` | `GET /supplier-relations*` | comerce (identidad) + purchase (relación) | Supplier+SupplierRelationship | comerce 🟢 + purchase 🟡 | `recommendation:read` | — | 🟢/🟡🔵(P3) |
| 27 | Proveedor → evaluación | `GET /suppliers/:id?tab=evaluacion` | `GET /supplier-relations/:id/evaluation` | purchase | SupplierEvaluation | purchase (fórmula 🔵 P-int) | `recommendation:read` | — | 🟡🔵 |
| 28 | Proveedor → negociación/términos/acuerdos | `POST /suppliers/:id/negotiations` etc. | espejo | purchase | NegotiationRound/Terms/Agreement | purchase DB | `negotiation:write` | `supplier.*` | 🟡 |
| 29 | Surtido / duplicidad | `GET /assortment*` | — | catalog + purchase | AssortmentView | catalog + cálculo 🔵 | `recommendation:read` | — | 🟡🔵 |
| 30 | NPI listar | `GET /npi` | — | catalog | ProductIntro | catalog | `recommendation:read` | — | 🟢 |
| 31 | Análisis inventario | `GET /inventory/analysis` | — | inventory + purchase (agregación) | InventoryKPIs | inventory 🟢 (stock) + agregado 🟡 | `recommendation:read` | — | 🟡 |
| 32 | Análisis compra | `GET /analytics/purchase` | espejo (agregado propio) | purchase + analysis | PurchaseAnalysis | purchase + analytics | `margin:read` | — | 🟡/🟠 |
| 33 | Ventas | `GET /analytics/sales` | — | analysis | SalesKPIs | analytics | `margin:read` | — | 🟠 |
| 34 | Margen por canal | `GET /analytics/channel-margin` | — | analysis + comerce | ChannelMargin | analytics 🟠 + canales 🟢 | `margin:read` | — | 🟠🔵(P-canales) |
| 35 | Reportes (8) | `GET /reports/:id` + export 202 | — | purchase-bff (agrega) | datasets | mixto | `export` | — | 🟡 |
| 36 | Presupuesto (OTB) | `GET /budget` | `GET /budget` + `/check` | purchase (Budget) | OtbBucket | purchase DB (actuals SAP 🔵) | `budget:read` | `otb.*` | 🟡🔵 |
| 37 | Venta no capturada | `GET /analytics/lost-opportunities` | — | analysis | LostOpportunity | analytics | `margin:read` | — | 🟠 |
| 38 | Calidad de compra | `GET /learning/purchase-quality` | espejo | purchase | PurchaseQuality | purchase (derivado) | `decision:read` | — | 🟡 |
| 39 | Documentos | `GET/POST /documents` | espejo (referencias) | purchase + DMS | ProcurementDoc | doc-generator 🟠 | `order:read` | `import.doc_attached` | 🟠 |
| 40 | Reglas | `GET/POST/PATCH /rules` | espejo | purchase (Governance) | PurchaseRule | purchase DB | `rule:read/admin` | `rule.updated` | 🟡 |
| 41 | Gobierno (roles/matriz/bitácora) | `GET /governance/*` | matriz: espejo; audit: trace | purchase + trace | ApprovalMatrix/AuditEntry | purchase + trace 🟠 | `rule:read` | — | 🟡/🟠 |
| 42 | Equipo → panel/carga/compradores | `GET /team/*` · `PATCH /team/workload/reassign` | espejo | purchase (Team) | Buyer/Workload | purchase DB | `team:read`·`assignment:admin` | `workload.reassigned` | 🟡 |
| 43 | Ranking → premios CRUD | `GET/POST/PATCH/DELETE /team/rewards` | espejo | purchase (Team) | Reward | purchase DB | `reward:admin` | `reward.*` | 🟡 |
| 44 | Metas (OKR) | `GET /team/goals` | espejo | purchase (Team) | Goal | purchase DB | `team:read` | `goal.status_changed` | 🟡 |
| 45 | Alertas de equipo | `GET /team/alerts` | espejo (alerts scope=team) | purchase (Alerts) | TeamAlert | purchase DB | `team:read` | — | 🟡 |
| 46 | Sesión/rol/contexto | `GET /context` · `POST /auth/login` | — | id-service | User/Session | id-service 🟢 | — | — | 🟢 |
| 47 | Bitácora (escritura transversal) | (implícita en comandos) | traza D7 | trace-service | TraceEntry | trace 🟠 | — | — | 🟠 |
| 48 | Notificaciones leídas | `GET /notifications` · `PATCH /notifications/read` | `notification-state` | purchase | NotificationState | purchase DB | — | — | 🟡 |

**Verificación de completitud**: filas 1–48 cubren la matriz funcional completa (`backend-spec/05`).
Ítems sin endpoint propio y su justificación: *guardar borrador* (autosave C6), *plan de retiro
persistente* (v1 solo simulación, tms 🟠), *reasignación offboard* (incluida en fila 42),
*export CSV por vista* (mecanismo único A12.6).
</content>
