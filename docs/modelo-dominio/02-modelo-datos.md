# 02 · Modelo de datos lógico — SQL Server, esquema `purchase`

> Diseño lógico completo (el detalle columna a columna, tipado, está en el borrador Prisma
> [`03-schema-draft.prisma`](03-schema-draft.prisma) — **borrador de diseño, no migrar aún**).
> Convenciones D5. Leyenda: **PK** clave primaria · **UX** índice único · **IX** índice ·
> **UXf** único filtrado · FK→ relación física.

## 1. Catálogo de tablas por módulo (47 de dominio + 7 de infraestructura = 54 modelos)

### Purchasing
| Tabla | Claves e índices | Columnas de negocio (resumen) |
|---|---|---|
| `PurchaseProposal` | PK `id` · IX `(buyerId, status, dateModified)` | `status, version, buyerId, title, note, sourceType(manual\|rfq\|duplicate), sourceRef, netTotalClp, landedTotalClp, lineCount, supplierCount, submittedAt, decidedAt, convertedAt, cancelReason` |
| `ProposalLine` | PK `id` · FK→`proposalId` · UX `(proposalId, sku, supplierRef)` · IX `(sku)` | `sku, skuNameSnap, categoryId, supplierRef, qty, packMultiple, moq, unitCostClp?, landedUnitCostClp?, costAsOf?, priceListRef?, subtotalClp?, recommendationId?, stockAsOfSnap(JSON), version` |
| `ProposalComment` | PK `id` · FK→`proposalId` · IX `(proposalId, dateCreated)` | `authorUserId, body` |
| `PurchaseOrder` | PK `id` · FK→`proposalId`, `approvalId?` · UX `number` · IX `(supplierRef, status)` · IX `(status, dateCreated)` | `number, buyerId, supplierRef, sapCardCode, status, version, netTotalClp, landedTotalClp, currency, expectedDate?, sentAt?, closedAt?, cancelReason?, otbBucketId?` |
| `PurchaseOrderLine` | PK `id` · FK→`purchaseOrderId` · IX `(sku)` | copia congelada de `ProposalLine` (+`proposalLineId` FK, `qtyReceivedTotal` derivado) |
| `SapSync` *(embebido en `PurchaseOrder`)* | UX `integrationKey` | `sapStatus, sapDocEntry?, sapDocNum?, integrationKey, sapAttempts, sapLastError?, sapPostedAt?` |

### Governance
| Tabla | Claves e índices | Columnas |
|---|---|---|
| `Approval` | PK `id` · FK→`proposalId` · UXf `(proposalId) WHERE state='pending'` · IX `(state, dateCreated)` | `state, version, requestedByUserId, decidedByUserId?, decidedAt?, note?, reason?` |
| `ApprovalCriterion` | PK `id` · FK→`approvalId` | `code, thresholdJson, actualJson, sku?` (inmutable) |
| `PurchaseRule` | PK `id` · UXf `(scopeType, scopeRef, key) WHERE active=1` · IX `(key)` | `scopeType(global\|category\|supplier\|buyer), scopeRef?, key, valueJson, active, validFrom, reason` |
| `Decision` | PK `id` · FK→`approvalId?`, `proposalId` · IX `(buyerId, dateCreated)` | `buyerId, summary, projectionJson(asOf), resultJson?, windowDays, evaluatedAt?, outcome(pending\|hit\|miss\|mixed)` |

### Replenishment
| Tabla | Claves e índices | Columnas |
|---|---|---|
| `PurchaseRecommendation` | PK `id` · **UXf `(sku, supplierRef) WHERE status IN ('pending','in_cart','snoozed')`** · IX `(buyerId, status, priority)` · IX `(categoryId)` | `sku, supplierRef, categoryId, buyerId, priority, suggestedQty, overrideQty?, coverageDays?, dailyVelocity?, velocitySource(analytics\|materialized), velocityAsOf?, stockAvailable?, stockInTransit?, stockAsOf?, unitCostClp?, costAsOf?, flagsJson, status, snoozeUntil?, computedAt, version` + **materialización para la vista** (flujo 1): `skuNameSnap, brandSnap, categoryNameSnap, supplierNameSnap, stockOnHand?, stockReserved?, salesLast30d?, salesLast90d?, rotation?, marginPct?, reorderPoint?, minStock?, maxStock?, leadTimeDays?, suggestedAmountClp?, reasonText?, riskText?` — snapshots fechados por `computedAt`; la verdad viva sigue en su dueño |
| `RecommendationAction` | PK `id` · FK→`recommendationId` · IX `(recommendationId, dateCreated)` | `action(override\|ignore\|snooze\|restore), qtyBefore?, qtyAfter?, reason, authorUserId` (append-only; alimenta atribución) |

### Sourcing
| Tabla | Claves e índices | Columnas |
|---|---|---|
| `Rfq` | PK `id` · UX `number` · IX `(status)` | `title, buyerId, status, dueDate, awardedResponseId?, version` |
| `RfqLine` | PK `id` · FK→`rfqId` | `sku, qty, targetUnitCostClp?` |
| `RfqSupplier` | PK `id` · FK→`rfqId` · UX `(rfqId, supplierRef)` | `supplierRef, invitedAt, respondedAt?` |
| `RfqResponse` | PK `id` · FK→`rfqId`,`rfqSupplierId` | `receivedAt, validUntil?, paymentTermRef?, leadTimeDays?, notes, version` |
| `RfqResponseLine` | PK `id` · FK→`rfqResponseId`,`rfqLineId` | `unitCostClp, minQty?, comment?` |

### Receiving + Claims
| Tabla | Claves e índices | Columnas |
|---|---|---|
| `Reception` | PK `id` · FK→`purchaseOrderId` · UX `displayId` · IX `(status, expectedDate)` · IX `(warehouseId)` | `displayId, warehouseId, packingSlip?, expectedDate?, arrivedAt?, completedAt?, status, hasDiscrepancy, complianceSnapJson?, version` |
| `ReceptionItem` | PK `id` · FK→`receptionId`,`purchaseOrderLineId` | `qtyExpected, qtyReceived, condition(ok\|damaged\|wrong_item), note?` |
| `SupplierClaim` | PK `id` · FK→`purchaseOrderId`,`receptionId?` · IX `(status)` · IX `(supplierRef)` | `supplierRef, type, description, status, resolution?, creditNoteRef?, resolvedAt?, reason?, version` |

### Supplier Relationship
| Tabla | Claves e índices | Columnas |
|---|---|---|
| `SupplierRelationship` | PK `id` · **UX `supplierRef`** · UXf `sapCardCode WHERE NOT NULL` · IX `(status)` | `supplierRef, sapCardCode?, document?, nameSnap, status(active\|on_watch\|blocked), compliancePct?, leadTimeDaysObserved?, pendingAmountClp?, metricsAsOf?, version` |
| `SupplierTerms` | PK `id` · FK→`supplierRelationshipId` · IX `(supplierRelationshipId, validFrom DESC)` | `validFrom, paymentTermRef?, discountPct?, freightPolicy?, currency, notes, version` (histórico; vigente = max `validFrom` ≤ hoy) |
| `SupplierSkuTerms` | PK `id` · UX `(supplierRelationshipId, sku)` | `sku, moq?, packMultiple?, leadTimeDays?, agreedUnitCostClp?, validFrom` (**fuente del MOQ** — R3) |
| `SupplierAgreement` | PK `id` · FK→`supplierRelationshipId` | `title, kind, validFrom, validTo?, docRef?, status` |
| `NegotiationRound` | PK `id` · FK→`supplierRelationshipId` · IX `(dateCreated)` | `status(open\|in_progress\|agreed\|stalled), topic, minutes, outcomeJson?, authorUserId, version` |
| `SupplierEvaluation` | PK `id` · **UX `(supplierRelationshipId, period)`** | `period(char 7), dimensionsJson(calidad\|factura\|documentos\|estabilidad — fórmula P15; shape = interfaz tipada del front), computedAt` — snapshot mensual del batch E9; respalda `GET /supplier-relations/:id/evaluation` (matriz fila 27) |

### Budget + Cartera
| Tabla | Claves e índices | Columnas |
|---|---|---|
| `OtbBucket` | PK `id` · **UX `(month, categoryId)`** | `month(char 7), categoryId, amountClp, version` (`availableClp` derivado por suma de entries) |
| `OtbEntry` | PK `id` · FK→`otbBucketId`, `purchaseOrderId?` · IX `(otbBucketId)` | `type(consume\|release\|reconcile), amountClp(±), note?` (append-only) |
| `CategoryAssignment` | PK `id` · **UX `categoryId`** | `categoryId, buyerId, since, version` |
| `CategoryAssignmentHistory` | PK `id` · IX `(categoryId, changedAt)` | `categoryId, fromBuyerId?, toBuyerId, changedByUserId, reason?` |

### Planning + Signals + Alerts + Team
| Tabla | Claves e índices | Columnas |
|---|---|---|
| `Season` | PK `id` · UX `code` | `code, name, salesFrom, salesTo, buyFrom, buyTo, status` |
| `SeasonPlan` | PK `id` · UX `(seasonId, scenario)` | `scenario, planJson(asOf), trackingJson?, version` |
| `ForecastAdjustment` | PK `id` · IX `(sku, dateCreated DESC)` | `sku, seasonId?, adjustmentPct, reason, authorUserId` (append-only, vigente = último) |
| `CampaignOpportunity` | PK `id` · UXf `(dedupeKey) WHERE status IN ('detected','planned','active')` · IX `(status)` | `dedupeKey, sku?, categoryId?, channelRef?, kind, windowFrom, windowTo, evidenceJson, status, version` |
| `Campaign` | PK `id` · IX `(status)` | `type(ad_space\|opportunity), opportunityId?, title, channelRef?, budgetClp?, startsAt, endsAt, status, version` (P14 — **absorbe** al `CampaignPlan` del front como `type=ad_space` y a `CreatedCampaign` como `type=opportunity`; matriz fila 15) |
| `ImportOrder` | PK `id` · FK→`purchaseOrderId?` · IX `(stage)` | `stage, etaDate?, forwarderRef?, stageHistoryJson, version` |
| `ImportDoc` | PK `id` · FK→`importOrderId` | `kind, dmsRef, uploadedByUserId` (referencia; binario en DMS) |
| `ProcurementDoc` | PK `id` · IX `(refEntity, refId)` · IX `(supplierRef)` | `kind(oc_pdf\|invoice\|certificate\|customs\|price_list\|other), title, refEntity?, refId?, supplierRef?, dmsRef, uploadedByUserId` — respalda la vista Documentos (matriz fila 39); doc suelto o ligado a OC/recepción/reclamo/importación/proveedor |
| `SalesSignal` | PK `id` · IX `(status, dateCreated)` · IX `(sku)` | `sku?, supplierRef?, storeRef?, kind, body, reporterUserId, status, version` |
| `SignalMessage` | PK `id` · FK→`signalId` · IX `(signalId, dateCreated)` | `authorUserId, body` (cursor por `dateCreated,id`) |
| `CommercialAlert` | PK `id` · **UXf `(dedupeKey) WHERE status='active'`** · IX `(buyerId, status, severity)` | `dedupeKey, ruleKey, type, severity, title, refEntity, refId, buyerId?, status, acknowledgedBy?, resolvedAt?, dismissReason?, version` |
| `BuyerProfile` | PK `id` · UX `buyerId` · UX `userId` | `buyerId, userId, displayName, active` |
| `Goal` | PK `id` · IX `(buyerId, period)` | `buyerId, period, kind, targetJson, progressJson?, status(on_track\|at_risk\|off_track\|achieved), version` |
| `Reward` | PK `id` | `title, description, criteriaJson, active, version` |
| `ScoreSnapshot` / `WorkloadSnapshot` | PK `id` · UX `(buyerId, period)` | proyecciones batch (`metricsJson, computedAt`) — read-only |
| `NotificationRead` | PK `(userId, notifId)` | marca de leído |
| `ChannelMap` | PK `id` · UX `(taxonomy, frontValue)` | `taxonomy(promo\|demand\|margin\|campaign), frontValue, channelRef` (P13, config) |

### Infraestructura
| Tabla | Claves e índices | Columnas |
|---|---|---|
| `OutboxEvent` | PK `id` · IX `(status, dateCreated)` | `topic, eventType, aggregateId, payloadJson, status(PENDING\|SENT\|ERROR), attempts, sentAt?` |
| `ProcessedEvent` | PK `id` · **UX `(topic, messageKey, consumerGroup)`** | idempotencia de consumo |
| `IdempotencyKey` | PK `id` · **UX `(key, route, method)`** | `requestHash, statusCode, responseBody, expiresAt` |
| `SapOutboxJob` | PK `id` · **UX `integrationKey`** · IX `(status, nextAttemptAt)` | `integrationKey, sapObject, sourceType, sourceId, payloadJson, status(PENDING\|PROCESSING\|POSTED\|FAILED\|REJECTED\|CANCELLED), attempts, maxRetries, nextAttemptAt?, sapDocEntry?, sapDocNum?, lastError?, lockedAt?, workerName?` |
| `SapDocumentSnapshot` | PK `id` · IX `(jobId)` | `jobId, requestJson, responseJson?, httpStatus?, docEntry?, docNum?` (auditoría por intento) |
| `DocSequence` | PK `(kind, year)` | `nextValue` (genera `OC-2026-NNNN`, `REC-…`, `RFQ-…`) |
| `ExportJob` | PK `id` · IX `(status)` | `reportId, paramsJson, requestedByUserId, status, fileRef?, error?, expiresAt` |

## 2. Diagrama de relaciones (núcleo)

```
PurchaseRecommendation ──(recommendationId)──▶ ProposalLine ∈ PurchaseProposal ◀─1:1 activa─ Approval ─▶ ApprovalCriterion
                                                     │ convert (tx: OC + OtbEntry + SapOutboxJob)
                                                     ▼
                              OtbEntry ◀── PurchaseOrder ──▶ PurchaseOrderLine ◀── ReceptionItem ∈ Reception
                                  │              │ U_REF1 / integrationKey                     │
                              OtbBucket      SapOutboxJob ──▶ SAP (DocEntry/DocNum)      SupplierClaim
PurchaseProposal/Approval ──▶ Decision (aprendizaje)          SupplierRelationship ──▶ Terms/SkuTerms/Agreement/NegotiationRound
```

## 3. Transacciones críticas (qué escribe cada una, en una sola tx)

| Comando | Escrituras en la misma transacción |
|---|---|
| C7 `submit` | `PurchaseProposal(status,version)` + `Approval`+`ApprovalCriterion[]` (si aplica) + lectura bloqueante `OtbBucket` (check) + `OutboxEvent` + `IdempotencyKey` |
| C8–C10 decisión | `Approval` + `PurchaseProposal.status` (cruce documentado) + `OutboxEvent` |
| C13 `convert` | `PurchaseProposal(status)` + `PurchaseOrder[]`+`Line[]` + `OtbEntry(consume)[]` + `SapOutboxJob[]` + `DocSequence` + `OutboxEvent[]` + `IdempotencyKey` |
| C14b `cancel` OC | `PurchaseOrder(status)` + `OtbEntry(release)` + `SapOutboxJob(cancel)` si posted + `OutboxEvent` |
| C21 `complete` recepción | `Reception`+`Items` + `OutboxEvent` (la OC se actualiza por consumidor interno del evento) |
| Worker E11 | `SapOutboxJob(status,attempts)` + `SapDocumentSnapshot` + `PurchaseOrder.sapSync` + `OutboxEvent(sap_posted)` |

## 4. Volumetría estimada e implicaciones

| Tabla | Volumen (año 1, orden de magnitud) | Implicación |
|---|---|---|
| `PurchaseRecommendation` | ~20–50 k filas vivas (1 por sku×prov activo), churn diario | upsert masivo del motor: índice UXf + `computedAt`; sin historial en la tabla (historial = acciones + eventos) |
| `RecommendationAction`, `OtbEntry`, `OutboxEvent` | 10⁵–10⁶/año (append-only) | particionado lógico por fecha + purga programada (E14): Outbox `SENT` > 30 d; acciones nunca (auditoría) |
| `Proposal*`/`PurchaseOrder*` | 10³–10⁴/año | sin problema; índices por bandeja (`buyerId,status`) |
| `CommercialAlert` | 10⁴–10⁵/año | UXf de dedupe evita explosión; purga `dismissed/resolved` > 180 d [RATIFICAR] |
| `IdempotencyKey` | churn alto | `expiresAt` + purga E14 (retención 7 d) |
| `SapDocumentSnapshot` | 1–5 por OC | retención 24 m [RATIFICAR] |

## 5. Mapa evento ↔ escritura (consistencia eventual interna)

| Evento (Outbox) | Productor (tabla) | Consumidores internos |
|---|---|---|
| `proposal.line_added/removed` | ProposalLine | Recommendation (`status=in_cart`/restore) |
| `order.issued` | PurchaseOrder | Recommendation (`ordered`), Alerts (seguimiento), Team (score) |
| `reception.completed/discrepancy` | Reception | PurchaseOrder (estado), SupplierRelationship (métricas E9), Alerts |
| `approval.*` | Approval | Notification trigger (D6), Team |
| `otb.consumed/exceeded` | OtbEntry | Alerts, Dashboard |
| `sap_posted / sap_rejected` | SapOutboxJob→PurchaseOrder | Alerts (rechazo), Notification |
| (consumo externo E1–E6) | — | Recommendation (recompute), ProposalLine (recosteo draft), PurchaseOrder (cancel SAP) |

## 6. Qué falta decidir antes de migrar (además de D2–D4 [RATIFICAR])

1. Retenciones marcadas [RATIFICAR] (§4).
2. P6 (GRN vía inventory vs outbox propio) — afecta solo si se agrega `SapOutboxJob.sapObject='PurchaseDeliveryNotes'`.
3. Colación/`NVARCHAR` vs `VARCHAR` para texto de negocio (español) — default propuesto: `NVARCHAR`.
4. Confirmar contra el modelo físico de `pricing-service` el patrón exacto de `OutboxEvent` para
   reutilizar su publisher tal cual (V-nuevo, verificación de bajo costo).
5. Gamificación avanzada (retos, feed de competencia, ligas): el levantamiento la clasifica como
   derivado/simulado read-only (P15) — se sirve desde `ScoreSnapshot` + cálculo; **sin tablas
   propias en v1**. Si negocio define retos configurables, se añade `Challenge` (aditivo).
</content>
