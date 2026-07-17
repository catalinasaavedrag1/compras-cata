# 10 · Decisiones pendientes de negocio / modelado

> Cumple la restricción del enunciado: **no inventar lógica faltante en silencio**. Cada punto no
> resuelto en el frontend se marca aquí como **decisión pendiente** con una **alternativa razonable
> propuesta** (no vinculante). Nada de esto debe asumirse al diseñar contratos hasta confirmarlo.

## Modelado de datos (bloquean el modelo de datos)

### 1. Enlaces por string vs claves foráneas reales
- **Hoy**: OC↔aprobación/decisión por convención `APR-<n>-<i>`/`DEC-<n>-<i>`; recepción→OC por
  `poNumber`; reclamo→OC+recepción por strings.
- **Riesgo**: integridad referencial nula, imposible garantizar consistencia en backend.
- **Propuesta**: introducir FK reales (`purchaseOrderId`, `approvalId`, `receptionId`) y tratar los
  códigos legibles como atributo de presentación, no como clave. **Resolver en Fase 0-1.**

### 2. Cuatro+ taxonomías de canal incompatibles (validado)
- **Hoy** conviven, sin conversión entre sí:
  - **demanda** `DemandChannel` (5): `tienda/ecommerce/marketplace/empresa/licitaciones` (Temporadas, SeasonPlanner).
  - **promo** `PromoChannelKey` (4): `redes/ml/web/tienda` (CampaignsPage; performance añade `google_ads/email`).
  - **margen** `MarginChannelKey` (3): `marketplace/web/store` (ChannelMargin).
  - **oportunidad/creada** `CampaignChannel` (7) / `PromoChannel` (10, +`google_ads/meta/tiktok`) (Anticipación).
  - **señal** `SignalChannel` (4): `store/web/marketplace/call_center` (SalesSignals).
- **Propuesta**: definir un **catálogo único de canales** con mapeo a los alias por contexto; una tabla
  `channels` maestra y vistas que proyecten sus subconjuntos. Confirmar la lista canónica con negocio.

### 3. Dos modelos de campaña y dos costeos "landed"
- **Campaña**: `CampaignPlan` (espacios publicitarios/banner/presupuesto por canal) vs `CreatedCampaign`
  (campaña sobre oportunidad detectada) — sin relación.
- **Landed cost**: `importCost` (nivel orden, CLP) vs `landedCost` (por unidad, con logística).
- **Propuesta**: unificar campaña en una entidad con `type = espacio_publicitario | oportunidad`; y un
  único costeo landed por unidad, derivando el total de orden. Confirmar con Comercial y Costos.

## Reglas de negocio / cálculo (bloquean lógica de servicio)

### 4. Umbrales de política como configuración, no constantes
- **Hoy** en `utils/constants.ts`: `DEFAULT_TARGET_COVERAGE_DAYS=45`, `SUPPLIER_COMPLIANCE_CRITICAL=70`/
  `WARN=85`, `SUPPLIER_PENDING_WARN_CLP=20M`, `SUPPLIER_LEAD_TIME_WARN_DAYS=15`,
  `APPROVAL_ORDER_AMOUNT_CLP=10M`, `APPROVAL_COVERAGE_DAYS=90`, `LOW_MARGIN_THRESHOLD=20`,
  `TARGET_MARGIN_BY_CATEGORY`, metas/prioridades.
- **Propuesta**: mover a **configuración de servidor** (tabla de parámetros por scope: global/categoría/
  proveedor/comprador), editable en `/reglas` con auditoría. Los valores actuales son el default inicial.

### 5. Naturaleza del override de recomendación
- **Hoy**: `rec-overrides`/`rec-ignored` en localStorage, sin historial.
- **Pregunta**: ¿el ajuste de cantidad/ignorar es **efímero** (preferencia de sesión) o **auditable**
  (queda como decisión histórica que alimenta aprendizaje/atribución)?
- **Propuesta**: auditable — persistir con autor, timestamp y motivo; feed de `buyerAttribution`.

### 6. Modelo de resultado de una decisión
- **Hoy**: comparación "vs período anterior" hardcodeada; sin KPI real.
- **Propuesta**: la decisión captura proyección al momento; un job posterior (a N días, p. ej. 30/90)
  registra el **resultado real** desde Sales/Inventory y calcula acierto/desvío. Confirmar ventana N.

### 7. Toda la "inteligencia" hash-simulada — fórmula real desconocida
- **Hoy inventado en front** (prohibido asumir): `productNegotiation` (waterfall de costo neto,
  precio competencia, condiciones, devoluciones, reclamos, quiebres, proyección); `supplierEvaluation`
  (calidad/factura/documentos/estabilidad de precio); `buyerAttribution` (reparto de quiebres);
  `skuProfile` (ABC/XYZ); `seasonPlan/tracking`, `seasonalFactor`, `channelDemand`,
  `supplierSeasonality`; `campaignPerformance` (CTR/ROAS); `lostOpportunities.mesesSinCompra`;
  historiales de costo (`cost*0.94`…).
- **Propuesta**: cada uno es un **contrato de servicio a definir con el dueño de negocio**; el front
  solo fija el **shape de salida esperado** (las interfaces ya tipadas), no la fórmula. Documentar
  entradas/salidas por indicador antes de implementar.

### 12. Fuente de verdad única de las OC (validado — inconsistencia real)
- **Hoy**: `ReportsPage` lee `mockPurchaseOrders` directo (las OC creadas en sesión **no** aparecen en
  reportes), mientras `BudgetPage`/OTB **sí** incluye las OC de `compras:po-created`. La misma entidad
  tiene dos fuentes según la vista.
- **Propuesta**: una sola colección `purchase-orders` como fuente; reportes y OTB la consumen igual.

### 13. IDs generados en cliente
- **Hoy**: `OC-2026-{143+n}`, `RFQ-2026-{9+n}`, `CLM-`, `NEG-<Date.now()>`, `CAMP-<hash>`, factura
  `F-<últimos6>`, señales `uid=Date.now()`. Colisionan entre sesiones/servidor.
- **Propuesta**: el **servidor** genera todos los IDs; el cliente nunca los inventa.

### 14. Escrituras "fantasma" (acción sin persistencia)
- **Hoy**: varias acciones solo hacen `toast` o solo escriben bitácora sin mutar estado real:
  WorkloadPage reasignar/offboard, ChannelMargin "crear tarea", PriceIncreases aprobar (no actualiza costo),
  SeasonPlanner "replan", ProductDetail MoreActions, NewProducts "programar salida", SettingsPage (reglas
  en `useState`, no persisten). Documentos "Ver/Descargar" son no-op.
- **Propuesta**: decidir para cada una si debe tener endpoint real (transición de estado + evento) o
  quedar como acción informativa. Ninguna debe "parecer" que guardó sin hacerlo.

### 15. Alcance/scoping inconsistente entre vistas
- **Hoy**: solo algunas vistas filtran por comprador/rol (MyPanel, Productos, Análisis-compra, Margen-canal,
  Calidad, Decisiones vía scope/`buyer`); Inventario, Ventas, Reportes, Presupuesto, Alzas, Venta-no-capturada,
  Alertas son **globales** pese a que las categorías tienen `buyer`.
- **Propuesta**: definir una política de scoping uniforme (qué es "mi cartera" en cada vista) y aplicarla
  server-side.

## Seguridad / permisos

### 8. Autorización server-side
- **Hoy**: auth falsa; rol y scoping (`buyer`, `scope=mine|all`) resueltos en cliente; solo
  `/equipo/*` tiene `RoleGate`.
- **Propuesta**: mover **toda** la autorización al backend: quién aprueba (líder), qué cartera ve cada
  comprador (`category.buyer`), qué acciones habilita cada rol. El gating de UI queda como conveniencia,
  no como control.

## Integraciones (contrato externo por confirmar)

### 9. Alcance de la integración SAP B1
- ¿SAP es sistema de registro de OC/recepción/factura, o solo espejo? ¿Emisión síncrona o por evento?
- **Propuesta**: SAP como sistema de registro; Purchase Core emite OC y **publica evento**; recepción
  (GRN) y factura fluyen desde SAP hacia la plataforma. Confirmar dirección y latencia.

### 10. Fuente de venta/demanda real (multi-canal)
- **Propuesta**: definir el bus de datos de venta (POS + e-commerce + Mercado Libre) y su granularidad
  (SKU × canal × día) para alimentar Reposición, Margen, Señales y Decisiones. Confirmar disponibilidad.

### 11. Rendimiento de campañas (ad platforms)
- **Propuesta**: integración con Web analytics + Google Ads + Meta/TikTok + mailing + POS; definir qué
  métricas son autoritativas (impresiones/clics/CTR/conversión/ROAS) y su ventana de atribución.

---

## Índice de bloqueo → fase
| Decisión | Bloquea | Resolver antes de |
|---|---|---|
| #1 FK vs string | Modelo de datos completo | Fase 0-1 |
| #4 Umbrales config | Governance / reglas | Fase 1 |
| #8 Autorización | Aprobaciones, scoping | Fase 0-1 |
| #9 SAP | Emisión/recepción OC | Fase 1-2 |
| #2 Canales | Margen, demanda, campañas | Fase 4-5 |
| #3 Campaña/landed | Marketing, costeo | Fase 4-5 |
| #7 Inteligencia sim | Negociación, temporada, atribución | por indicador, Fases 3-6 |
| #5 Override, #6 Resultado, #10 Venta, #11 Ads | Aprendizaje / analítica | Fases 2-5 |
