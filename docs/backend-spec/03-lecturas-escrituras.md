# 03 · Operaciones de lectura y escritura, cálculos, reglas, validaciones, permisos, transiciones y eventos

Convención: **R** = lectura, **W** = escritura (create/patch/delete). Cada dominio lista sus
operaciones, su máquina de estados, sus cálculos/validaciones y los eventos que debería emitir.

---

## 1. Reposición / Recomendaciones (núcleo de la decisión)

**R**: listar recomendaciones (filtros `foco,q,cat,prov,estado,prioridad`), KPIs de cartera,
cobertura por SKU, quiebres proyectados. **W**: ajustar cantidad sugerida (`rec-overrides`),
ignorar/posponer recomendación (`rec-ignored`), enviar selección al borrador de OC.

- **Máquina** `RecommendationStatus` (clase de salud, **validado**): `critical | buy_now | review | normal | overstock`.
  El "estado de gestión" (agregado/ignorado/pospuesto) NO es este enum: vive en `compras:rec-overrides`
  (ajuste de qty/monto/proveedor) y `compras:rec-ignored` (lista de ignorados + "Restaurar").
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
- **Reglas de negocio → disparan aprobación** (validado — criterios que el motor **realmente genera** en
  `createOrder`): `monto_alto` (neto de la OC ≥ `APPROVAL_ORDER_AMOUNT_CLP` 10M, evaluado a **nivel OC**
  aunque se marca en cada línea) · `cobertura_excesiva` (cobertura resultante > `APPROVAL_COVERAGE_DAYS` 90d)
  · `desvio_sugerido` (sugerido=0 o |Δ/sugerido| > 20%) · `margen_bajo` (margen < `rule.minMargin`).
  El enum `ApprovalCriterion` **también** define `proveedor_revision | fuera_temporada | producto_nuevo`,
  pero hoy **no se generan** (solo se renderizan) → decisión pendiente si el backend debe emitirlos.
- **Generación atómica (validado)**: un borrador se divide en **N OC (una por proveedor)** en una sola
  acción, y en el mismo acto se crean sus `Approval` (`APR-<n>-<i>`) **y** sus `Decision` (`DEC-<n>-<i>`),
  incluso las que quedan "en criterio". El backend debe modelar esta creación tri-entidad acoplada.
- **IDs generados en cliente (colisionan con backend)**: `OC-2026-{143+n}`, `PO-<n>`, `APR-<n>-<i>` ↔
  `DEC-<n>-<i>`, factura sintética `F-<últimos6>`. La generación de IDs debe pasar al servidor.
- **Validaciones**: proveedor activo; producto activo; MOQ/múltiplo; presupuesto OTB disponible.
- **Permisos**: comprador crea/emite en su cartera; **emitir sobre umbral exige aprobación de líder**.
- **Eventos**: `po.drafted`, `po.submitted_for_approval`, `po.issued`, `po.status_changed`,
  `po.sent_to_supplier` (integra SAP B1 / correo proveedor).

## 3. Aprobaciones

**R**: bandeja de aprobaciones (filtro inicial `pendiente`), detalle con criterios disparados.
**W**: aprobar, rechazar, **observar** (devolver con nota) — `approvals-created`, `approvals`,
`approval-notes`.

- **Máquina** `ApprovalState` (validado): `pendiente → en_analisis | observada | aprobada | rechazada`.
  `OPEN_STATES = [pendiente, en_analisis, observada]`; transiciones libres entre estados abiertos;
  "observada" devuelve al comprador con nota (round-trip solo-UI, sin entidad de re-envío).
- **Escritura acoplada (validado)**: aprobar/rechazar un `APR-` **también** parcha su `DEC-` enlazado
  (approvedBy/reason/resultText) — coupling `APR-<n>-<i>` ↔ `DEC-<n>-<i>` en PurchaseFlowContext.
- **Permisos**: **solo `lider` aprueba/rechaza** (`canApprove = role==="lider"`; comprador ve solo lo
  propio en modo lectura). Hoy gating intra-página; debe ser server-side.
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

- **Máquina** `RfqStatus` (validado): `borrador → enviada → respondida | respondida_parcial →
  en_negociacion → aprobada → convertida` | `rechazada` | `vencida`. `convertToOc` hace **doble escritura**
  (agrega mejor oferta por línea a `compras:oc-draft` **y** marca RFQ `convertida`).
- **Cálculos**: `pickBestForLine` (más barato/más rápido + `tradeoffNote`); convertir usa
  `max(qtyRequested, minimoCompra)`. IDs `RFQ-2026-{9+n}` generados en cliente (colisión).
- **Nota**: las respuestas de proveedor son **solo semilla** (no hay UI para cargarlas → portal de
  proveedor / integración implícita). **Eventos**: `rfq.sent`, `rfq.response_received`, `rfq.awarded`.

## 6. Plan de retiro (Logistics/TMS)

**R**: leer borrador de OC y proponer plan de retiro/flota (hoy estimador en front). **W**: —
(hoy no persiste). **Decisión pendiente**: ¿servicio TMS propio o integración externa? Cálculos de
capacidad/camiones/tarifas hoy simulados (`data/logistics`, `mockWarehouses`).

## 7. Recepciones (SAP/WMS)

**R**: listar recepciones (`alcance,tab,q,prov,desde,hasta`, deep-link `?rid=`). **W**: registrar
recepción contra OC, marcar diferencias, cerrar — **hoy todos los estados solo en la semilla**.

- **Máquina** `ReceptionStatus` (validado): `scheduled | in_transit | received | partial | with_issues |
  delayed`. `ARRIVED_STATUSES = [received, partial, with_issues]`. **Hoy todos estos estados solo existen
  en la semilla** (la UI no los transiciona).
- **Cálculos**: `supplierFulfillment` = Σrecibido/Σesperado (fill rate) + rating; línea faltante =
  esperado − recibido; impacto de quiebre estimado por SKU. % cumplimiento
  (`SUPPLIER_COMPLIANCE_CRITICAL=70`/`WARN=85`).
- **Enlace**: `Reception.poNumber` → OC (string, FK pendiente).
- **Escrituras ocultas (validado)**: "Reordenar" empuja lo no despachado a **`compras:oc-draft`** (acopla
  recepción ↔ carrito), y "Crear reclamo" desde una línea genera un **`SupplierClaim`** con tipo/cantidad/
  valor **inferidos en cliente** (regex sobre el texto libre del problema; 10% heurístico para daño).
- **Eventos**: `reception.arrived`, `reception.checked`, `reception.discrepancy_flagged`,
  `reception.completed` (→ actualiza inventario y estado de OC).

## 8. Reclamos

**R**: listar (chips abiertos/resueltos/todos). **W**: crear (`CreateClaimModal`), gestionar/resolver
(`ManageClaimModal`) — `claims`.

- **Máquinas** (validado) `ClaimStatus`: `abierto | en_gestion | aceptado | resuelto | rechazado`
  (`OPEN = [abierto, en_gestion, aceptado]`); `ClaimResolution`: `pendiente | nota_credito | reposicion |
  descuento | aceptado_sin_ajuste`; `ClaimType`: `faltante | dano | calidad | vencimiento | costo |
  empaque | sobrante | documento`.
- **Reglas**: `suggestedResolution(tipo)` (faltante→reposicion; costo/dano/calidad/vencimiento→nota_credito);
  KPI "recuperado" = Σ valor de reclamos resueltos con resolución ∈ {nota_credito, reposicion, descuento};
  guardia anti-duplicado `exists(poNumber, sku)`.
- **Escritura oculta (validado)**: **cada** creación/cambio de estado escribe una entrada en
  `compras:trace` (bitácora) — auditoría secundaria.
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

- **Máquina** `SignalStatus` (validado): `new → in_review → sourcing → quoted → awaiting_customer →
  accepted → purchased → resolved` | `rejected` (desde cualquier estado abierto). Agrupa
  `to_review = {new, in_review}`, `in_progress = {sourcing, quoted, awaiting_customer, purchased}`.
  `convert-to-OC` → escribe draft y marca `accepted`.
- **Persistencia patch-overlay (validado)**: `compras:signals` = `{created[], patches{}, extraMessages{},
  extraEvents{}}` sobre semilla inmutable — el backend debe replicar la semántica de merge.
- **Sub-entidades**: hilo de mensajes (`SignalMessage`, rol seller|buyer), timeline/auditoría
  (`SignalEvent`: created/status/assigned/priority/comment/converted), sub-registro de solicitud
  (cliente/qty/fecha/precio objetivo/proveedor sugerido/costo cotizado) y evidencia (clientes preguntando,
  venta perdida estimada). `suggestPriority` = motor de reglas. Canal `SignalChannel` =
  `store | web | marketplace | call_center`.
- **Eventos**: `signal.reported`, `signal.commented`, `signal.status_changed`, `signal.converted`.

## 11. Alertas comerciales (Notification/derivado)

**R**: listar alertas. **W**: cambiar estado/atender (`alert-status`, override).

- **Máquina** `AlertStatus` (validado): `new | in_review | resolved | ignored` (`active = {new, in_review}`;
  resolved/ignored terminales, sin "des-resolver"). Persistencia = **overlay `compras:alert-status`**
  (`Record<alertId, AlertStatus>`) sobre semilla; la UI **no crea** alertas.
- **Origen y tipos**: hoy semilla; en producción **derivadas por reglas**. **16 `AlertType`**: stockout,
  stockout_risk, overstock, low_margin, cost_increase, supplier_delay, no_sales, unexpected_demand,
  no_supplier, po_delayed, high_suggested_purchase, dead_stock, outdated_cost, no_recent_purchase,
  season_approaching, lost_opportunity. Cada tipo enruta su acción primaria (rec→OC; po_delayed→seguimiento;
  supplier_delay→proveedor; lost_opportunity/no_recent_purchase→venta-no-capturada; else→producto).
- **Distinción clave**: Alertas = **sistema/automáticas** (read-only + overlay de estado); Señales =
  **humano/terreno** (creación + hilo + timeline). Sus tipos se solapan (stockout, unexpected_demand).
- **Eventos**: `alert.raised`, `alert.acknowledged`, `alert.resolved`.

## 12. Campañas — dos modelos (Marketing/Comercial)

**R**: `CampaignsPage` (plan/perf), `CampaignOpportunitiesPage` (anticipación + "Mis campañas").
**W**: crear plan (`campaign-plans`), crear campaña (`campaigns`/`CreatedCampaign`).

- **Máquina** `CampaignOpportunityStatus` (validado — clase de recomendación, no ciclo de vida):
  `ready_for_campaign | buy_before_campaign | stockout_risk | liquidate | boost | review_margin |
  review_supplier | not_recommended` (con `STATUS_URGENCY` 0–7). Las oportunidades son **read-only**; las
  acciones solo marcan `done` local (no persiste) o escriben a OC draft / `compras:campaigns`.
  `CreatedCampaignStatus`: `draft | scheduled | active` (según startDate vs hoy).
- **Regla clave (validado)**: consolidación por proveedor con flag **lead-time-crítico**
  (`averageLeadTimeDays ≥ díasACampaña` ⇒ "no llega a tiempo", ordenado crítico-primero).
- **Dos modelos a unificar** (doc 10): `CampaignPlan` (espacios publicitarios/banner/presupuesto por
  canal, `compras:campaign-plans`, reordenamiento de banner por `order` — estado persistido real) vs
  `CreatedCampaign` (`compras:campaigns`, campaña sobre oportunidad). `campaignPerformance` (impresiones,
  clics, CTR, conversiones, ROAS) 100% simulado (FNV-1a hash) → integración con Web analytics, Google Ads,
  Meta/TikTok, mailing, Mercado Libre, POS.
- **Eventos**: `campaign.planned`, `campaign.launched`, `campaign.performance_updated`.

## 13. Temporadas / Planning

**R**: `SeasonPlannerPage`, `SeasonsChannelsPage` (demanda por canal). **W**: ajustar forecast
(`forecast-adj:{sku}`), plan por escenario.

- **Sin máquina de estado persistida**: el estado de temporada se deriva inline (Quiebre~S{n}/Sobre máx./
  Atraso/En línea). Enums de plan: `ConfidenceLevel` (alta/media/baja), `SeasonRisk`
  (alto_quiebre/medio/sobrestock/normal), `ScenarioKey` (conservador/probable/agresivo).
- **Cálculos** (hoy hash-simulados): `planSeason` (hashString + `seasonalFactor`; origen del forecast:
  confirmada/histórica/probable/campañas/stock estratégico), `seasonTracking` (`SEASON_PROGRESS=0.45`
  fija el progreso 45%, varianza plan-vs-real ±8%), `channelDemand`, `supplierSeasonality`.
- **Escritura real (validado)**: `compras:forecast-adj:{sku}` (ForecastAdjustment con reason obligatorio +
  autor hardcodeado + fecha, logueado a bitácora). Botones "Replan" son toast-only (simulados).
- **Eventos**: `forecast.adjusted`, `season.plan_updated`.

## 14. Importaciones (torre de control)

**R**: `ImportsPage` (detalle por etapa + documentos). **W**: avanzar etapa, adjuntar documento —
hoy mock (`mockImports`).

- **Máquina** `ImportStage` (validado, 8): `proforma → orden → produccion → embarque → transito → aduana →
  internacion → bodega` + `ImportOrder.docs[]` (`{nombre, ok}`, sin entidad/upload real).
- **Cálculo landed (validado)**: `importLanded` = FOB·TC + arancel + flete + portuarios + terrestre + aduana;
  el **simulador de tipo de cambio es efímero** (no persiste) y **no hay fuente de FX** — el backend debe
  poseer la fórmula canónica y la tasa. Hoy `ImportsPage` **no escribe nada** (0 writes).
- **Eventos**: `import.stage_advanced`, `import.doc_attached`.

## 15. Proveedor — términos, acuerdos, negociación

**R**: ficha, evaluación, temporadas, productos, órdenes, recepciones, alertas (7 pestañas).
**W**: registrar ronda de negociación (`negotiations:{id}`), guardar términos (`terms:{id}`),
acuerdos (`agreements:{id}`).

- **Máquinas** (validado) `SupplierStatus`: `active | review | delayed | blocked | inactive`;
  `NegotiationStatus`: `propuesta | en_curso | acordado | rechazado`. Clasificación derivada
  `SupplierClass`: `estrategico | confiable | en_desarrollo | riesgoso | critico | sustituible | bloqueado`
  (por OTIF, reclamos abiertos, compra 90d). Registro de ronda usa `NegotiationLever` (10: precio,
  descuento, volumen, plazo_pago, flete, bonificacion, rebate, devoluciones, marketing, exclusividad) y
  `NegotiationBenefit` (5: ahorro_real, bonificacion, plazo, logistico, promo — distingue "ahorro real").
- **Cálculos** (hoy hash-simulados): `supplierEvaluation` (**4 de 6 dimensiones fabricadas** por hash del
  id — calidad, factura, documentos, estabilidad de precio; fecha/cantidad sí son reales), OTIF =
  compliance·fillRate, `supplierSeasonality` (serie 24 meses sintética). Umbrales:
  `SUPPLIER_PENDING_WARN_CLP=20M`, `SUPPLIER_LEAD_TIME_WARN_DAYS=15`.
- **Persistencia real (validado)**: `compras:terms:{id}` (SupplierTerms), `compras:agreements:{id}`
  (Agreement[]), `compras:negotiations:{id}` (NegotiationRound[], id `NEG-<Date.now()>`).
- **Eventos**: `supplier.negotiation_round_logged`, `supplier.terms_updated`, `supplier.agreement_signed`.

## 16. Catálogo — productos, categorías, surtido, NPI

**R**: `ProductsPage`/`ProductDetailPage` (6 tabs), `CategoriesPage`/`CategoryDetailPage` (9 tabs),
`AssortmentPage`, `CatalogOptimizationPage`, `NewProductsPage`. **W**: alta de producto
(`ProductFormModal`), altas/salidas NPI.

- **Máquinas** (validado): `ProductStatus` (active|new|discontinued|no_sales|seasonal|blocked),
  `PurchaseStatus` (buy|do_not_buy|review|on_demand|overstock), `NpiStage`
  (propuesta→aprobada→piloto→evaluacion→escalado|rechazada), `PurchaseClass`
  (saludable|corta|alta|sobrecompra|sin_venta), `RedundancyAction` (liquidate|discontinue|review),
  `PriceTier` (low|mid|high).
- **Cálculos** (hoy hash-simulados): `skuProfile` (ABC/XYZ determinista), redundancia de surtido
  (`analyzeCatalog`, descuento liquidación 30% hardcodeado), roles de producto/categoría, historia de
  costo (`cost*0.94/*0.89`) y ventas (`sales90/3`) fabricadas.
- **Escrituras solo-bitácora (validado)**: en ProductDetail el menú "MoreActions" (detener/reactivar compra,
  marcar estacional/descontinuado, transferir, liquidación, devolución) **solo escribe a `compras:trace`**
  sin mutación real; NewProducts "Programar salida" igual (trace + set en memoria). El backend necesita
  endpoints reales de transición para estas acciones. "Agregar a OC" sí escribe `compras:oc-draft`;
  CategoryDetail/CatalogOptimization "Crear campaña de liquidación" escribe `compras:campaigns`.
- **Eventos**: `product.created`, `product.role_changed`, `assortment.reviewed`.

## 17. Equipo / Gobierno (solo líder)

**R**: dashboard, carga, compradores, ranking, metas, alertas de equipo; gobierno (roles/matriz/bitácora).
**W**: premios (`rewards`, CRUD), reasignar/offboard (simulado), editar reglas (`SettingsPage`),
bitácora (`trace`, append-only cap 200).

- **Máquina** `GoalStatus` (validado): `done | on_track | risk`.
- **Cálculos** (hoy simulados en `teamScore.ts`): score (pesos 30/20/20/15/10/5), ligas
  (Bronce/Plata/Oro/Elite/Leyenda), `okrScore`, `buyerAttribution` con **`scoreAdjust`** = regla de
  equidad ("quiebres causados por el proveedor no penalizan al comprador"), retos, leaderboard,
  `seasonStatus` (ascenso/descenso vs `prevSeasonScore`). El backend debe **poseer estas fórmulas o
  aceptar divergencia**.
- **Permisos**: **todo `/equipo/*` exige `lider` (RoleGate)** — la única guarda de ruta real. `/reglas`
  y `/gobierno` **no** tienen RoleGate (cualquier rol autenticado entra).
- **Persistencia/gaps (validado)**: premios → `compras:rewards` (**no** escriben bitácora, inconsistente).
  Reglas de SettingsPage viven en **`useState` (no persisten**; solo la bitácora sobrevive). Reasignar/
  offboard en WorkloadPage son **toast-only** (sin store ni evento). Actor de bitácora **hardcodeado
  "Catalina Saavedra"** sin importar la persona activa → debe venir de la sesión.
- **Eventos**: `reward.created/updated/deleted`, `rule.updated`, `workload.reassigned`,
  `audit.entry_appended`.

---

## Transversal — Notificaciones, bitácora, sesión

- `compras:notif-read` (set de notificaciones leídas por usuario) → servicio Notification.
- `compras:trace` (bitácora append-only) → servicio de auditoría/Governance; **toda W relevante
  debería emitir una entrada de bitácora** (patrón event-sourcing ligero).
- `compras:auth/role/buyer` → Identity (sesión, rol, comprador activo). **Hoy auth es falsa y el rol
  no se valida en servidor.**
