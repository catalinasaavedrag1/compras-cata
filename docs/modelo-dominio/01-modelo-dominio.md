# 01 · Modelo de dominio — agregados, invariantes y máquinas de estado

> Bounded context **Compras** (monolito modular). Un agregado = una raíz transaccional = una unidad
> de consistencia; entre agregados, consistencia **eventual por eventos** (Outbox). Los nombres del
> código van en inglés; el lenguaje ubicuo mapea al español del negocio.

## 0. Lenguaje ubicuo (mapa ES ↔ modelo)

| Negocio (front) | Agregado/Entidad | Nota |
|---|---|---|
| Recomendación de reposición | `PurchaseRecommendation` | materializada por el motor |
| Borrador de OC / carrito | `PurchaseProposal` (status `draft`) | mismo agregado en todo su ciclo |
| Orden de compra | `PurchaseOrder` | nace en `convert`; espejo SAP |
| Aprobación | `Approval` (+`ApprovalCriterion`) | FK a la propuesta |
| Decisión (aprendizaje) | `Decision` | proyección vs resultado |
| Cotización | `Rfq` (+`RfqLine`,`RfqResponse`) | |
| Recepción | `Reception` (+`ReceptionItem`) | contra OC |
| Reclamo | `SupplierClaim` | FK OC + recepción |
| Relación proveedor / condiciones / acuerdos / negociación | `SupplierRelationship` (+`SupplierTerms`, `SupplierSkuTerms`, `SupplierAgreement`, `NegotiationRound`) | identidad en comerce/SAP |
| Presupuesto (OTB) | `OtbBucket` (+`OtbEntry`) | |
| Cartera | `CategoryAssignment` | fuente del alcance |
| Temporada / ajuste forecast | `Season`, `SeasonPlan`, `ForecastAdjustment` | |
| Oportunidad / campaña | `CampaignOpportunity`, `Campaign` (unificada, `type`) | P14 |
| Importación | `ImportOrder` (+`ImportDoc`) | docs = referencia DMS |
| Señal de venta | `SalesSignal` (+`SignalMessage`) | |
| Alerta comercial | `CommercialAlert` | inbox con estado (R1) |
| Regla de compra / matriz | `PurchaseRule` | umbral como configuración |
| Comprador / meta / premio | `BuyerProfile`, `Goal`, `Reward`, `ScoreSnapshot` | identidad en id-service |

## 1. Agregados núcleo (módulo Purchasing + Governance)

### `PurchaseProposal` (raíz) — con `ProposalLine[]`, `ProposalComment[]`
**Invariantes (se cumplen dentro de la transacción del agregado):**
1. Solo editable en `draft`/`changes_requested`; inmutable desde `in_review` (salvo transiciones).
2. `submit` exige: ≥1 línea · ninguna línea con `unitCostClp NULL` · validación OTB OK · MOQ/múltiplo
   por proveedor OK · proveedor `active`.
3. Una línea referencia un `sku` + `supplierRef` + `categoryId` **congelados al agregarla** (snapshot
   con `asOf`); recosteos actualizan `unitCostClp` + `costAsOf` solo en estados editables.
4. Totales por proveedor y globales son **derivados persistidos** (recalculados en la misma
   transacción que muta líneas — nunca por el cliente).
5. `version` de raíz +1 en toda mutación; `version` de línea +1 en mutación de línea.
6. Solo el buyer con cartera de la categoría (o líder) puede mutarla.

**Máquina:** `draft → in_review → approved → converted` · `in_review → rejected` ·
`in_review → changes_requested(→ draft*)` · `draft|in_review|approved → cancelled`.
**Eventos:** `proposal.created/updated/line_*/submitted/cancelled` + los de aprobación.

### `Approval` (raíz) — con `ApprovalCriterion[]` (inmutables)
1. Nace solo desde `submit` con ≥1 criterio disparado; FK `proposalId` (1:1 activa).
2. `pending` es el único estado decidible; decisión exige permiso `approve` y **decididor ≠ autor** (P8).
3. La decisión propaga a la propuesta **en la misma transacción** (mismo módulo/BD): es el único
   cruce de agregados síncrono permitido, documentado como tal.
**Máquina:** `pending → approved | rejected | observed(→ nueva ronda si re-submit)`.

### `PurchaseOrder` (raíz) — con `PurchaseOrderLine[]` + VO `SapSync`
1. Nace **solo** de `convert` (o adjudicación RFQ): 1 OC = 1 proveedor; líneas copiadas con snapshot
   de costo **congelado** (lo aprobado = lo emitido).
2. Inmutable desde `sent` salvo: `cancel`, transiciones de recepción y conciliación (`x-service-*`).
3. `number` (OC-2026-NNNN) por secuencia, único, atributo de presentación.
4. `SapSync` (VO embebido): `status, docEntry, docNum, integrationKey, attempts, lastError, postedAt`
   — solo lo muta el worker/conciliación, nunca un comando de usuario (salvo re-`send`).
5. Consumo OTB registrado como `OtbEntry(consume)` en la transacción de `convert`; `release` al cancelar.
**Máquina negocio:** `approved → sent → confirmed → partially_received → received → closed | cancelled`.
**Máquina sapSync:** `pending → processing → posted | failed(retry) | rejected` (+`cancelled`).

### `PurchaseRecommendation` (raíz, materializada) — con `RecommendationAction[]` (historial)
1. **Única activa por `(sku, supplierRef)`** (índice único filtrado) — el motor upserta.
2. Override/ignore/snooze exigen `reason` y generan `RecommendationAction` (auditable, alimenta atribución).
3. `in_cart`/`ordered` los setea el flujo de propuesta (evento interno), no el usuario.
4. Campos calculados (`coverageDays`, `dailyVelocity`, `stockSnapshot`, `unitCostClp`) llevan `asOf`
   y `source` (`analytics|materialized`) — la frescura es parte del dato.
**Máquina:** `pending → in_cart → ordered` · `pending → ignored | snoozed(until→pending)`.

## 2. Agregados de ciclo físico

### `Reception` (raíz) — con `ReceptionItem[]`
1. FK `purchaseOrderId`; cada item FK a `purchaseOrderLineId`; `qtyReceived ≥ 0`.
2. `complete` calcula diferencias: alguna `qtyReceived ≠ qtyExpected` o `condition ≠ ok` ⇒
   `discrepancy`, si no `completed`; y actualiza la OC (`partially_received/received`) **vía evento**
   (consistencia eventual entre agregados, mismo servicio).
3. Al completar emite `reception.completed` → inventory (efecto físico) y SAP GRN (P6).
**Máquina:** `expected → in_transit → arrived → checking → completed | discrepancy | rejected`.

### `SupplierClaim` (raíz)
1. FK `purchaseOrderId` + `receptionId` (nullable si reclamo no ligado a recepción — [RATIFICAR]).
2. `resolve` exige `resolution ∈ {credit_note, replacement, return, none}`; `credit_note` emite evento
   a finance/SAP y guarda `creditNoteRef` cuando vuelve.
**Máquina:** `open → in_review → resolved | rejected`.

## 3. Relación con proveedor

### `SupplierRelationship` (raíz, clave natural `supplierRef`)
- Cross-ref D3 (`sapCardCode`, `document`) + `status: active|on_watch|blocked` + métricas derivadas
  (`compliancePct`, `leadTimeDaysObserved`, `pendingAmountClp`) recalculadas por batch (E9/E12) con `asOf`.
- Hijos: `SupplierTerms` (vigencia por `validFrom`, histórico completo: pago, descuento, flete),
  `SupplierSkuTerms` (**aquí vive el MOQ** y pack/lead-time por SKU — R3), `SupplierAgreement`,
  `NegotiationRound`.
- Invariante: un solo `SupplierTerms` vigente por proveedor (el de `validFrom` máximo ≤ hoy).

## 4. Presupuesto, cartera y gobierno

### `OtbBucket` (raíz) + `OtbEntry[]` (append-only)
- Clave natural `(month, categoryId)` única. `availableClp = amountClp − Σ(entries)`.
- `check` (F-budget) lee dentro de la transacción de `submit/convert` con bloqueo de fila del bucket
  (evita sobre-consumo concurrente — es el **único** lock pesimista del modelo, de vida corta).

### `CategoryAssignment` (raíz mínima)
- `categoryId` único → `buyerId` + `since`. Historia en `CategoryAssignmentHistory` (para atribución).
- Fuente única del alcance de autorización (00-contratos §5).

### `PurchaseRule` (raíz, configuración versionada)
- `(scopeType, scopeRef, key)` único vigente; valores JSON tipados por `key`
  (`approval.high_amount_clp=10000000`, `approval.excessive_coverage_days=90`,
  `replenishment.target_coverage_days=45`, `pricing.price_drift_pct=0` (P11), etc.).
- Cambio de regla = nueva versión + traza con `reason` (auditoría obligatoria).

## 5. Planning, señales, alertas, equipo (agregados simples)

- `Season`/`SeasonPlan` (escenarios JSON por canal), `ForecastAdjustment` (por `sku`, histórico, autor+motivo).
- `CampaignOpportunity` (`detected→planned→active→closed|dismissed`) y `Campaign` unificada
  (`type: ad_space|opportunity`, P14).
- `ImportOrder` (`stage: po→production→shipping→customs→warehouse`) + `ImportDoc` (referencia DMS).
- `SalesSignal` + `SignalMessage[]` (hilo, cursor); máquina `new→in_review→actioned|dismissed`.
- `CommercialAlert`: `dedupeKey` único activo (regla+entidad) — el motor no duplica alertas vivas;
  máquina `active→acknowledged→resolved|dismissed`.
- `BuyerProfile` (buyerId↔userId id-service), `Goal`, `Reward`, `ScoreSnapshot`, `WorkloadSnapshot`
  (estos dos últimos: proyecciones batch, no editables).
- `NotificationRead` (userId × notifId — set de leídas).
- `ChannelMap` (P13): `frontTaxonomy, frontValue → channelRef comerce` (tabla de mapeo, config).

## 6. Infraestructura transaccional (mismo esquema, no dominio)

| Tabla | Rol | Patrón de origen |
|---|---|---|
| `OutboxEvent` | eventos `purchase.*` (Outbox transaccional) | pricing/dom |
| `ProcessedEvent` | idempotencia de consumo Kafka (E1–E6) | `dom_processed_events` |
| `IdempotencyKey` | replay de comandos (key+ruta+método+hash+respuesta) | inventory-v3 |
| `SapOutboxJob` | cola OPOR/cancelaciones (`integrationKey` único) | inventory outbound `IntegrationQueue` |
| `SapDocumentSnapshot` | auditoría request/response SAP | `dbo.SapDocuments` |
| `DocSequence` | secuencias de códigos humanos (`OC-2026-…`) | — |
| `ExportJob` | exportaciones asíncronas (A12.6) | — |

## 7. Reglas de oro del modelo

1. **Una transacción = un agregado** (excepción documentada: Approval→Proposal, y OtbBucket dentro de
   submit/convert).
2. **Todo cruce de módulo por evento** (Outbox) — nada de joins entre módulos en comandos.
3. **Ningún maestro externo persistido**: solo referencias + snapshots fechados en documentos.
4. **Nada se borra**: estados terminales + higiene programada.
5. **Todo lo calculado lleva `asOf`/`source`** — la frescura es contrato, no detalle.
</content>
