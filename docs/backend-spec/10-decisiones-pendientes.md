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

### 2. Tres taxonomías de canal incompatibles
- **Hoy**: promo (`redes/ml/web/tienda`), demanda (`tienda/ecommerce/marketplace/empresa/licitaciones`),
  margen (`marketplace/web/store`) + enum extendido `CampaignChannel`.
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
