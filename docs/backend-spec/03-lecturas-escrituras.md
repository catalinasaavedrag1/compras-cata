# 03 · Operaciones de lectura y escritura, cálculos, reglas, validaciones, permisos, transiciones y eventos

Convención: **R** = lectura, **W** = escritura (create/patch/delete). Cada dominio lista sus
operaciones, su máquina de estados, sus cálculos/validaciones y los eventos que debería emitir.

---

## 1. Reposición / Recomendaciones (núcleo de la decisión)

**R**: listar recomendaciones (filtros `foco,q,cat,prov,estado,prioridad`), KPIs de cartera,
cobertura por SKU, quiebres proyectados. **W**: ajustar cantidad sugerida (`rec-overrides`),
ignorar/posponer recomendación (`rec-ignored`), enviar selección al borrador de OC.

- **Máquina** `RecommendationStatus`: `pending → in_cart → ordered` | `ignored` | `snoozed`.
- **Cálculos** (hoy en front, deben ser del servicio): punto de reorden, cobertura en días
  (`stock / venta_diaria`), cantidad sugerida = `max(0, objetivo_cobertura·venta_diaria − stock − en_tránsito)`,
  prioridad (quiebre inminente > bajo stock > oportunidad), `DEFAULT_TARGET_COVERAGE_DAYS=45`.
- **Validaciones**: no sugerir bajo múltiplo de compra / pack; respetar MOQ del proveedor;
  no recomendar productos descontinuados.
- **Permisos**: comprador ve/edita su cartera (`category.buyer`); líder ve todo (`scope=all`).
- **Eventos**: `recommendation.overridden`, `recommendation.ignored`, `recommendation.added_to_draft`.
- **Decisión pendiente**: el override, ¿es efímero (sesión) o histórico auditable? (ver doc 10).

## 2. Borrador de OC (carrito) → Orden de compra

**R**: leer borrador actual (`oc-draft`), agrupar por proveedor, estimar costo/landed.
**W**: agregar/quitar/editar línea, agrupar en OC, **emitir OC** (`po-created`, único write
que hoy toca backend vía `apiCreate`), cambiar estado (`po-status`).

- **Máquina** `PurchaseOrderStatus`: `draft → pending_approval → approved → sent → confirmed →
  (partially_received | received) → closed` | `cancelled` | `rejected`. **Hoy la UI solo alcanza
  `draft`/`pending_approval`/`sent`; `approved` es derivado no persistido; el resto vive solo en la semilla.**
- **Cálculos**: subtotal por línea (`qty·costo`), neto por grupo/proveedor, `importCost` (orden, CLP),
  vs `landedCost` (unidad, con logística) — **dos costeos a unificar** (doc 10). Descuentos por
  volumen, condición de pago.
- **Reglas de negocio → disparan aprobación** (doc 6/gobierno): `netGroup ≥ APPROVAL_ORDER_AMOUNT_CLP
  (10M)` ⇒ criterio `monto_alto`; cobertura resultante `> APPROVAL_COVERAGE_DAYS (90)` ⇒
  `cobertura_excesiva`; proveedor nuevo / sin acuerdo vigente; producto fuera de surtido.
- **Validaciones**: proveedor activo; producto activo; MOQ/múltiplo; presupuesto OTB disponible.
- **Permisos**: comprador crea/emite en su cartera; **emitir sobre umbral exige aprobación de líder**.
- **Eventos**: `po.drafted`, `po.submitted_for_approval`, `po.issued`, `po.status_changed`,
  `po.sent_to_supplier` (integra SAP B1 / correo proveedor).

## 3. Aprobaciones

**R**: bandeja de aprobaciones (filtro inicial `pendiente`), detalle con criterios disparados.
**W**: aprobar, rechazar, **observar** (devolver con nota) — `approvals-created`, `approvals`,
`approval-notes`.

- **Máquina** `ApprovalState`: `pending → approved | rejected | observed(→ vuelve a pending)`.
- **`ApprovalCriterion`**: `monto_alto | cobertura_excesiva | proveedor_nuevo | fuera_surtido | …`
  (varios criterios por aprobación).
- **Permisos**: **solo `lider` aprueba/rechaza** (hoy gating intra-página; debe ser server-side).
- **Regla de cierre**: aprobación aprobada ⇒ OC pasa a `approved` (hoy no persiste el enlace;
  enlace `APR-<n>-<i>` por string — FK pendiente, doc 10).
- **Eventos**: `approval.requested`, `approval.approved`, `approval.rejected`, `approval.observed`.

## 4. Decisiones (cierre de ciclo de aprendizaje)

**R**: histórico de decisiones (`/aprendizaje?tab=decisiones`). **W**: registrar resultado de una
decisión (`decisions-created`), enlazado a la aprobación (`DEC-<n>-<i>` ↔ `APR-<n>-<i>`).

- **Cálculos**: acierto/desvío vs proyección (comparación "vs período anterior" hoy hardcodeada).
- **Eventos**: `decision.recorded`. **Decisión pendiente**: modelo de resultado (KPI real de venta/margen
  a N días) requiere integración con Sales — hoy simulado.

## 5. RFQ / Cotizaciones

**R**: listar RFQ por estado, comparar ofertas (`ComparisonDrawer`). **W**: crear RFQ
(`CreateRfqModal`), registrar respuestas, adjudicar → generar OC — `rfq`, `rfq-status`.

- **Máquina** `RfqStatus`: `draft → sent → (partially_)responded → awarded | cancelled | expired`.
- **Cálculos**: comparación multi-proveedor (precio, lead time, condición), ranking de oferta.
- **Eventos**: `rfq.sent`, `rfq.response_received`, `rfq.awarded` (→ crea OC).

## 6. Plan de retiro (Logistics/TMS)

**R**: leer borrador de OC y proponer plan de retiro/flota (hoy estimador en front). **W**: —
(hoy no persiste). **Decisión pendiente**: ¿servicio TMS propio o integración externa? Cálculos de
capacidad/camiones/tarifas hoy simulados (`data/logistics`, `mockWarehouses`).

## 7. Recepciones (SAP/WMS)

**R**: listar recepciones (`alcance,tab,q,prov,desde,hasta`, deep-link `?rid=`). **W**: registrar
recepción contra OC, marcar diferencias, cerrar — **hoy todos los estados solo en la semilla**.

- **Máquina** `ReceptionStatus`: `expected → in_transit → arrived → checking → completed |
  discrepancy | rejected`.
- **Cálculos**: cantidad recibida vs pedida, diferencias, % cumplimiento proveedor
  (`SUPPLIER_COMPLIANCE_CRITICAL=70`/`WARN=85`).
- **Enlace**: `Reception.poNumber` → OC (string, FK pendiente).
- **Eventos**: `reception.arrived`, `reception.checked`, `reception.discrepancy_flagged`,
  `reception.completed` (→ actualiza inventario y estado de OC).

## 8. Reclamos

**R**: listar (chips abiertos/resueltos/todos). **W**: crear (`CreateClaimModal`), gestionar/resolver
(`ManageClaimModal`) — `claims`.

- **Máquinas** `ClaimStatus`: `open → in_review → resolved | rejected`; `ClaimResolution`:
  `credit_note | replacement | return | none`.
- **Enlace**: `Claim.poNumber` + `Claim.receptionId` (strings, FK pendiente).
- **Eventos**: `claim.opened`, `claim.resolved`.

## 9. Alzas de precio (Pricing)

**R**: listar alzas propuestas, comparar vs lista vigente. **W**: cargar lista (`Cargar-lista`),
aprobar/rechazar alza — `price-lists`.

- **Máquina**: lista `pending → approved | rejected`; alza por SKU `pending/approved/rejected`.
- **Cálculos**: % variación vs costo actual, impacto en margen (`LOW_MARGIN_THRESHOLD=20`,
  `TARGET_MARGIN_BY_CATEGORY`).
- **Eventos**: `pricelist.uploaded`, `priceincrease.approved/rejected` (→ actualiza costo maestro).

## 10. Señales de venta (Sales terreno)

**R**: bandeja de señales. **W**: reportar señal (`Reportar-señal`), comentar, cambiar estado —
`signals` (created + patches + messages + timeline).

- **Máquina** `SignalStatus`: `new → in_review → actioned | dismissed`.
- **Estructura**: `messages[]` (hilo), `timeline[]` (eventos). **Decisión pendiente**: ¿mensajería
  propia o integración con Notification/chat?
- **Eventos**: `signal.reported`, `signal.commented`, `signal.status_changed`.

## 11. Alertas comerciales (Notification/derivado)

**R**: listar alertas. **W**: cambiar estado/atender (`alert-status`, override).

- **Máquina** `AlertStatus`: `active → acknowledged → resolved | dismissed`.
- **Origen**: hoy mock; en producción **derivadas por reglas** (quiebre, sobre-stock, margen bajo,
  desvío de campaña) — servicio de reglas + Notification.
- **Eventos**: `alert.raised`, `alert.acknowledged`, `alert.resolved`.

## 12. Campañas — dos modelos (Marketing/Comercial)

**R**: `CampaignsPage` (plan/perf), `CampaignOpportunitiesPage` (anticipación + "Mis campañas").
**W**: crear plan (`campaign-plans`), crear campaña (`campaigns`/`CreatedCampaign`).

- **Máquina** `CampaignOpportunityStatus`: `detected → planned → active → closed | dismissed`.
- **Dos modelos a unificar** (doc 10): `CampaignPlan` (espacios publicitarios/banner/presupuesto por
  canal) vs `CreatedCampaign` (campaña sobre oportunidad). `campaignPerformance` (impresiones, clics,
  CTR, conversiones, ROAS) hoy 100% simulado → integración con Web analytics, Google Ads, Meta/TikTok,
  mailing, Mercado Libre, POS.
- **Eventos**: `campaign.planned`, `campaign.launched`, `campaign.performance_updated`.

## 13. Temporadas / Planning

**R**: `SeasonPlannerPage`, `SeasonsChannelsPage` (demanda por canal). **W**: ajustar forecast
(`forecast-adj:{sku}`), plan por escenario.

- **Máquina** `ImportStage` (torre de control de importaciones): `po → production → shipping →
  customs → warehouse` (+ documentos por etapa).
- **Cálculos** (hoy hash-simulados): `seasonPlan`, `seasonTracking` (`SEASON_PROGRESS=0.45`, desvíos),
  `seasonalFactor`, `channelDemand`, `supplierSeasonality`.
- **Eventos**: `forecast.adjusted`, `season.plan_updated`.

## 14. Importaciones (torre de control)

**R**: `ImportsPage` (detalle por etapa + documentos). **W**: avanzar etapa, adjuntar documento —
hoy mock (`mockImports`).

- **Máquina** `ImportStage` (arriba) + `ImportOrder.docs[]` (DMS).
- **Eventos**: `import.stage_advanced`, `import.doc_attached`.

## 15. Proveedor — términos, acuerdos, negociación

**R**: ficha, evaluación, temporadas, productos, órdenes, recepciones, alertas (7 pestañas).
**W**: registrar ronda de negociación (`negotiations:{id}`), guardar términos (`terms:{id}`),
acuerdos (`agreements:{id}`).

- **Máquinas** `SupplierStatus`: `active | on_watch | blocked`; `NegotiationStatus`:
  `open → in_progress → agreed | stalled`.
- **Cálculos** (hoy hash-simulados): `supplierEvaluation` (calidad, factura, documentos, estabilidad
  de precio), `supplierSeasonality`. Umbrales: `SUPPLIER_PENDING_WARN_CLP=20M`,
  `SUPPLIER_LEAD_TIME_WARN_DAYS=15`.
- **Eventos**: `supplier.negotiation_round_logged`, `supplier.terms_updated`, `supplier.agreement_signed`.

## 16. Catálogo — productos, categorías, surtido, NPI

**R**: `ProductsPage`/`ProductDetailPage` (6 tabs), `CategoriesPage`/`CategoryDetailPage` (9 tabs),
`AssortmentPage`, `CatalogOptimizationPage`, `NewProductsPage`. **W**: alta de producto
(`ProductFormModal`), altas/salidas NPI.

- **Máquina** `PurchaseStatus` (rol/estado de compra del producto) + roles de producto/categoría.
- **Cálculos** (hoy hash-simulados): `skuProfile` (ABC/XYZ), redundancia de surtido, line review.
- **Eventos**: `product.created`, `product.role_changed`, `assortment.reviewed`.

## 17. Equipo / Gobierno (solo líder)

**R**: dashboard, carga, compradores, ranking, metas, alertas de equipo; gobierno (roles/matriz/bitácora).
**W**: premios (`rewards`, CRUD), reasignar/offboard (simulado), editar reglas (`SettingsPage`),
bitácora (`trace`, append-only cap 200).

- **Máquina** `GoalStatus`: `on_track | at_risk | off_track | achieved`.
- **Cálculos** (hoy simulados): score, ligas, `buyerAttribution` (reparto de quiebres
  comprador/proveedor/demanda), retos, leaderboard.
- **Permisos**: **todo `/equipo/*` exige `lider` (RoleGate)** — hoy la única guarda de ruta real.
- **Eventos**: `reward.created/updated/deleted`, `rule.updated`, `workload.reassigned`,
  `audit.entry_appended`.

---

## Transversal — Notificaciones, bitácora, sesión

- `compras:notif-read` (set de notificaciones leídas por usuario) → servicio Notification.
- `compras:trace` (bitácora append-only) → servicio de auditoría/Governance; **toda W relevante
  debería emitir una entrada de bitácora** (patrón event-sourcing ligero).
- `compras:auth/role/buyer` → Identity (sesión, rol, comprador activo). **Hoy auth es falsa y el rol
  no se valida en servidor.**
