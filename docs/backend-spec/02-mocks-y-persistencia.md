# 02 · Mocks, datos hardcoded, servicios simulados y persistencia

## A. La costura de backend existente

- **Contrato REST genérico** (`src/services/apiClient.ts`): `apiGet(col)`, `apiGetOne(col,id)`,
  `apiCreate(col,body)` (POST), `apiPatch(col,id,body)` (merge), `apiDelete(col,id)`, `apiHealth()`.
  `backendEnabled` según `VITE_API_URL`.
- **Servidor de referencia** (`server/index.ts`): Express + `db.json`, `GET /api/:collection?campo=valor`,
  POST autogenera id `{col}-{Date.now()}` si falta, persistencia con debounce.
- **`useCollection(col, fallback)`** (`DataContext`): hidrata 13 colecciones o cae al mock.
  **Hoy solo lo consumen 3 páginas** (products×2, suppliers). El resto importa mocks directo.

## B. Entidades / colecciones canónicas (13, con id_field)

| Colección | id_field | Mock | Clasificación |
|---|---|---|---|
| products | **sku** | mockProducts | maestro (Catalog) — entidad central |
| suppliers | id | mockSuppliers | maestro (Supplier) |
| categories | id | mockCategories | maestro (Catalog) — contiene `buyer` (string) |
| buyers | id | mockBuyers | maestro (Identity/Team) — `CURRENT_BUYER_ID="catalina"` |
| rules | id | mockRules | config (Governance) — + `monthlyPurchaseBudget`, `specialRules` |
| purchase-orders | id | mockPurchaseOrders | transaccional (Purchase/SAP) — `number`, `lines[]` |
| recommendations | id (+sku) | mockRecommendations | derivado/transaccional (motor reposición) |
| approvals | id | mockApprovals | transaccional (Purchase) |
| decisions | id | mockDecisions | transaccional (Purchase, cierre de ciclo) |
| receptions | id | mockReceptions | transaccional (SAP/WMS) — `items[]` |
| alerts | id | mockAlerts | transaccional (Notification/derivado) |
| signals | id | mockSignals | transaccional (Sales terreno) — `messages[]`, `timeline[]` |
| campaign-opportunities | id (+sku) | mockCampaignOpportunities | derivado (Marketing/Planning) |

## C. Entidades con mock pero SIN colección/servicio (viven en localStorage o solo lectura)

**Transaccionales que necesitan colección + endpoints de escritura:**
`PriceList` (mockPriceLists), `Rfq` (mockRfq), `SupplierClaim` (mockClaims), `ImportOrder`
(mockImports), `ProductIntro`/NPI (mockNpi), `CampaignPlan` (mockCampaignPlans),
`CreatedCampaign`, `NegotiationRound` (mockNegotiations), `Reward` (mockRewards),
`SupplierTerms`/`SupplierAgreement`, `ProcurementDoc` (mockDocuments), `Season` (mockSeasons),
`ForecastAdjustment`, `TraceEntry` (bitácora).

**Derivado/analítico read-only (agregados o simulados):**
mockInventory (KPIs + distribución por categoría/bodega/rotación), mockSales (KPIs + series),
mockChannelMargin, mockCampaignPerformance, mockChallenges/mockCompetitionFeed/mockLeaderAlerts/
mockSeasonHistory (gamificación/equipo), mockOcHistory (auditoría OC), mockWarehouses (capacidad),
data/logistics (camiones/tarifas).

## D. Datos simulados-deterministas por hash del SKU (NO son datos reales)

En producción requieren un servicio real; hoy se generan en front:
- `productNegotiation` (panel de negociación de producto: costo neto/waterfall, precio competencia,
  precio vendido, condiciones pago, devoluciones, reclamos, quiebres, proyección) — `utils/negotiation.ts`.
- `supplierEvaluation` (dimensiones calidad/factura/documentos/estabilidad de precio) — `supplierDetail/SupplierMaster`.
- `supplierSeasonality`, `seasonalFactor`, `channelDemand` (series/temporada/mezcla por canal).
- `seasonPlan` (componentes campaña/licitación), `seasonTracking` (`SEASON_PROGRESS=0.45`, desvíos por canal).
- `campaignPerformance` (impresiones/clics/CTR/conversiones/ROAS).
- `buyerAttribution` (reparto de quiebres comprador/proveedor/demanda), `skuProfile` (ABC/XYZ).
- `lostOpportunities.mesesSinCompra`, historiales de costo en ProductDetail (`cost*0.94`…),
  comparación "vs período anterior" hardcodeada, reparto venta/stock por canal en margen.

## E. Persistencia real hoy — claves `localStorage` `compras:*`

### Sesión / preferencias
`compras:auth` (User/Session) · `compras:role` (rol) · `compras:buyer` (comprador activo) ·
`compras:density` `compras:scope` `compras:section:*` `compras:sidebar-panel-open` (UI).

### Entidades transaccionales (cada una → endpoints de escritura)
| Clave | Escritor | Entidad → colección propuesta |
|---|---|---|
| `compras:oc-draft` / `compras:oc-draft-meta` | OcDraftContext | Borrador de OC (carrito) |
| `compras:po-created` | PurchaseOrdersPage | PurchaseOrder emitidas |
| `compras:po-status` | PurchaseOrdersPage | Override de estado de OC |
| `compras:approvals-created` | PurchaseFlowContext | Approval |
| `compras:approvals` | PurchaseFlowContext | Approval.state |
| `compras:approval-notes` | PurchaseFlowContext | Approval.note (observación) |
| `compras:decisions-created` | PurchaseFlowContext | Decision |
| `compras:rec-overrides` / `compras:rec-ignored` | ReplenishmentPage | Ajuste/estado de Recommendation |
| `compras:rfq` / `compras:rfq-status` | RfqPage | Rfq (+ estado) |
| `compras:claims` | ClaimsContext | Claim |
| `compras:price-lists` | PriceIncreasesPage | PriceList (+ estado) |
| `compras:alert-status` | AlertsPage | Alert.status (override) |
| `compras:signals` | SignalsContext | SalesSignal (created + patches + messages + events) |
| `compras:campaign-plans` | CampaignsPage | CampaignPlan |
| `compras:campaigns` | CampaignOpportunitiesPage | CreatedCampaign |
| `compras:rewards` | RankingPage | Reward |
| `compras:trace` | TraceContext | AuditLog (append-only, cap 200) |
| `compras:notif-read` | NotificationContext | Set de notificaciones leídas (por usuario) |
| `compras:terms:{supplierId}` | SupplierTermsAgreements | SupplierTerms |
| `compras:agreements:{supplierId}` | SupplierTermsAgreements | SupplierAgreement[] |
| `compras:negotiations:{supplierId}` | SupplierNegotiationRecord | NegotiationRound[] |
| `compras:forecast-adj:{sku}` | SeasonPlanner | ForecastAdjustment |

**Patrón universal**: *seed mock + parches/creados en localStorage*. Al migrar, cada
"created" → `POST`, cada "override/patch/status" → `PATCH`. Es el mapa directo a la API.

## F. Umbrales de política (hoy constantes) → deben ser configuración de servidor
`utils/constants.ts`: `DEFAULT_TARGET_COVERAGE_DAYS=45`, `SUPPLIER_COMPLIANCE_CRITICAL=70`/`WARN=85`,
`SUPPLIER_PENDING_WARN_CLP=20M`, `SUPPLIER_LEAD_TIME_WARN_DAYS=15`, `APPROVAL_ORDER_AMOUNT_CLP=10M`,
`APPROVAL_COVERAGE_DAYS=90`. Más umbrales dispersos hardcodeados: `LOW_MARGIN_THRESHOLD=20`,
roles de producto/categoría, metas, prioridades de agenda, `TARGET_MARGIN_BY_CATEGORY`.
