# 02 · Fichas de endpoint y ejemplos JSON

> **Mecánica.** Con ~145 endpoints (inventario `01`), repetir 28 atributos por ficha ocultaría lo
> importante. Se define una **ficha estándar** (S) cuyos valores aplican por defecto a todos los
> endpoints, y se desarrollan **fichas completas** para los endpoints estructurales (los que fijan
> patrón). Cada endpoint restante hereda S y declara solo sus diferencias en el OpenAPI
> (`openapi/*.yaml`), que es la fuente formal de schemas/parámetros/responses/ejemplos.

---

## S · Ficha estándar (defaults de toda la plataforma)

| Atributo | Default BFF (`purchase-bff-service`) | Default dominio (`purchase-service`) |
|---|---|---|
| Autenticación | `Authorization: Bearer <jwt>` (id-service), validado en BFF | Headers `x-user-id`/`x-client`/`x-user-permissions` (propagados por BFF) o `x-service-api-key/-secret/-client` |
| Permiso | Tabla en `06` (formato `purchase:<recurso>:<acción>`) | ídem (guard por decorador) |
| Headers | `x-correlation-id` (in/out), `x-plataforma-id`, `x-buyer-id`, `x-scope` | los mismos, recibidos del BFF |
| Idempotencia | GET: natural. Comandos de creación/efecto: `idempotency-key` obligatorio | ídem (guard: falta ⇒ 409) |
| Concurrencia | Transiciones/ediciones: `If-Match: "<version>"` | ídem ⇒ `409 VERSION_CONFLICT` |
| Paginación | `page/pageSize` (24/100) o body de search | `page/pageSize` (60/500) + `x-janis-total` |
| Códigos HTTP | 200 · 201 (+`Location`) · 202 (async) · 204 · 400 · 401 · 403 · 404 · 409 · 422 · 429 · 5xx | ídem |
| Errores | catálogo `00` §4 (funcionales) + técnicos (`DOWNSTREAM_SERVICE_ERROR`, `INTERNAL_ERROR`, timeout ⇒ 504) | catálogo interno (`error-codes`) |
| Timeout | total 10 s; por dependencia 4 s + 2 reintentos | request 10 s; a SAP: solo vía worker (sin HTTP síncrono) |
| Caché | solo lecturas de maestros/agregados (TTLs `00` §8); comandos y saldos: **nunca** | sin caché (dueño del dato) |
| Consistencia | lectura compuesta: **eventual** entre secciones (cada una fresca de su dueño); tras comando: **read-your-writes** vía dominio | fuerte sobre datos propios (transacción + Outbox) |
| Eventos | no emite (los emite el dominio) | según comando (`04`) vía Outbox |
| Auditoría | no (la emite el dominio; excepción: export/lecturas sensibles → traza de acceso ❓P9) | todo comando ⇒ traza a trace-service |
| Observabilidad | métricas RED + `x-correlation-id` + log estructurado por dependencia | ídem + lag de consumers |

---

## F1 · `POST /api/purchase-bff/v1/products/critical/search` — Búsqueda de productos críticos

| | |
|---|---|
| Nombre funcional | Buscar productos críticos (quiebre inminente / bajo stock) |
| Servicio responsable | purchase-bff-service (composición); ranking y cálculo: purchase-service |
| Consumidor | Frontend (vistas Decisiones/Reposición foco "críticos", Inicio) |
| Objetivo | Una sola llamada por página de tabla, con todos los campos de la fila |
| Método/Ruta | `POST /products/critical/search` (POST-search por filtros complejos) |
| Auth/Permiso | S · `purchase:recommendation:read` |
| Idempotencia | natural (lectura) |
| Path params | — |
| Query params | — (todo en body) |
| Headers | S |
| Paginación/Orden | body `page/pageSize/sort[]` (24/100) |
| Filtros | body `filters` (ver ejemplo) |
| Códigos | 200 · 200 parcial (`meta.partial`) · 400 · 401 · 403 · 502 |
| Errores funcionales | `PRICING_UNAVAILABLE`, `STOCK_UNAVAILABLE` (degradación); `VALIDATION_ERROR` |
| Timeout | S (dependencias en paralelo, ver `03` §5) |
| Caché | no (saldos de decisión) — solo nombres/imagen de catálogo cacheados aparte |
| Consistencia | recomendación materializada (≤ minutos) + stock/costo frescos |
| Dependencias | purchase (indispensable) · catalog (indispensable) · inventory, pricing, analytics (opcionales degradables) |
| Eventos | — |
| Auditoría | — |
| Observaciones | El BFF **no** recalcula prioridad/cantidad: vienen del motor |
| Decisión pendiente | P5 (fuente real de velocidad de venta) |

**Request**
```json
{
  "filters": {
    "q": "taladro",
    "categoryIds": ["cat-herramientas"],
    "supplierIds": ["SUP-023"],
    "priority": ["stockout_imminent", "low_stock"],
    "status": ["pending"],
    "warehouseId": null
  },
  "scope": "mine",
  "page": 1,
  "pageSize": 24,
  "sort": [ { "field": "priority", "order": "desc" }, { "field": "coverageDays", "order": "asc" } ]
}
```

**Response 200 (parcial: analytics caído)**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "recommendationId": "rec-2026-018842",
        "sku": "HT-TAL-0450",
        "name": "Taladro percutor 850W",
        "brand": "Bauker",
        "category": { "id": "cat-herramientas", "name": "Herramientas eléctricas" },
        "supplier": { "id": "SUP-023", "name": "Importadora Andes Ltda.", "sapCardCode": "PV00023" },
        "stock": { "available": 14, "inTransit": 24, "security": 6, "asOf": "2026-07-17T11:58:02Z" },
        "sales": { "dailyVelocity": 3.2, "source": "materialized", "stale": true },
        "coverageDays": 4.4,
        "priority": "stockout_imminent",
        "suggestedQty": 96,
        "packMultiple": 12,
        "moq": 48,
        "cost": { "unitCost": 38990, "currency": "CLP", "priceListId": "PL-07", "asOf": "2026-07-17T11:58:02Z" },
        "flags": ["below_target_coverage"],
        "status": "pending",
        "version": 3
      }
    ],
    "meta": {
      "page": 1, "pageSize": 24, "total": 87, "totalPages": 4, "hasNext": true, "hasPrev": false,
      "partial": true,
      "warnings": [
        { "code": "ANALYTICS_UNAVAILABLE", "scope": "items[].sales", "message": "Velocidad de venta con último valor materializado.", "retryable": true }
      ]
    }
  },
  "correlationId": "8c2f6e0a-4b1d-4f6e-9a3c-2f1e0d9c8b7a"
}
```
Procedencia de cada campo, paralelismo y reglas de faltantes: `03-vistas-y-composicion.md` §5.

---

## F2 · `GET /api/purchase-bff/v1/dashboard` — Panel del comprador

| | |
|---|---|
| Nombre funcional | Bandeja diaria del comprador / líder |
| Servicio responsable | purchase-bff-service |
| Consumidor | Frontend (Inicio) |
| Método/Ruta | `GET /dashboard?scope=mine\|all` |
| Auth/Permiso | S · `purchase:recommendation:read` (secciones adicionales filtradas por permiso: aprobaciones solo si `purchase:proposal:approve`) |
| Códigos | 200 (siempre; secciones degradables) · 401 · 403 |
| Caché | secciones de agregados ≤ 60 s; alertas/aprobaciones/OTB frescos |
| Dependencias | purchase (recomendaciones, aprobaciones, señales, OTB, alertas) — todas **opcionales** salvo recomendaciones |
| Observaciones | Una sola llamada para la portada; `sections[]` permite render por sección (skeleton) |

**Response 200**
```json
{
  "success": true,
  "data": {
    "asOf": "2026-07-17T12:00:00Z",
    "sections": {
      "replenishment": { "status": "ok", "pendingCount": 87, "stockoutImminent": 12, "suggestedAmountClp": 48200000, "top": [ { "sku": "HT-TAL-0450", "priority": "stockout_imminent", "coverageDays": 4.4 } ] },
      "approvals":     { "status": "ok", "pendingCount": 3, "oldestAt": "2026-07-15T09:10:00Z" },
      "alerts":        { "status": "ok", "activeCount": 9, "bySeverity": { "critical": 2, "warning": 7 } },
      "signals":       { "status": "ok", "newCount": 4 },
      "budget":        { "status": "degraded", "warning": { "code": "DOWNSTREAM_SERVICE_ERROR", "message": "OTB no disponible", "retryable": true } },
      "agenda":        { "status": "ok", "items": [ { "type": "reception_due", "refId": "rec-000311", "dueDate": "2026-07-17" } ] }
    }
  },
  "correlationId": "…"
}
```

---

## F3 · `POST /api/purchase-bff/v1/proposals` — Crear propuesta de compra

| | |
|---|---|
| Nombre funcional | Crear propuesta (borrador de OC) |
| Servicio responsable | BFF (pasa 1:1) → purchase-service (regla y persistencia) |
| Consumidor | Frontend |
| Método/Ruta | `POST /proposals` → interno `POST /api/purchase/v1/proposals` |
| Auth/Permiso | S · `purchase:proposal:write` + alcance de cartera sobre las categorías de las líneas |
| Idempotencia | **`idempotency-key` obligatorio** |
| Request body | `{ title?, note?, lines?: [{ sku, qty, recommendationId? }] }` |
| Códigos | 201 (+`Location`) · 400 · 401 · 403 · 409 (`IDEMPOTENCY_*`) · 422 (`MOQ_NOT_MET`, `SUPPLIER_INACTIVE`) |
| Consistencia | fuerte (transacción); respuesta = estado persistido |
| Eventos | `purchase.proposal.created` (Outbox) |
| Auditoría | traza `proposal.created` |
| Decisión pendiente | P2 (¿una propuesta activa por comprador o N?) — contrato soporta N |

**Request** (`idempotency-key: 4f0a…`)
```json
{ "title": "Reposición herramientas julio", "lines": [ { "sku": "HT-TAL-0450", "qty": 96, "recommendationId": "rec-2026-018842" } ] }
```
**Response 201**
```json
{
  "success": true,
  "data": {
    "id": "prop-2026-000123",
    "status": "draft",
    "version": 1,
    "buyerId": "catalina",
    "title": "Reposición herramientas julio",
    "supplierGroups": [
      {
        "supplierId": "SUP-023",
        "supplierName": "Importadora Andes Ltda.",
        "sapCardCode": "PV00023",
        "netTotalClp": 3743040,
        "lines": [
          {
            "lineId": "ln-0001",
            "sku": "HT-TAL-0450",
            "name": "Taladro percutor 850W",
            "qty": 96,
            "unitCostClp": 38990,
            "landedUnitCostClp": 41220,
            "subtotalClp": 3743040,
            "recommendationId": "rec-2026-018842",
            "version": 1
          }
        ]
      }
    ],
    "totals": { "netClp": 3743040, "landedClp": 3957120, "lineCount": 1, "supplierCount": 1 },
    "approvalPreview": { "wouldRequireApproval": false, "criteria": [] },
    "createdAt": "2026-07-17T12:03:11Z"
  },
  "correlationId": "…"
}
```

---

## F4 · `POST /api/purchase-bff/v1/proposals/:id/submit` — Enviar a revisión

| | |
|---|---|
| Nombre funcional | Enviar propuesta a revisión/aprobación |
| Servicio responsable | purchase-service (Governance evalúa criterios) |
| Método/Ruta | `POST /proposals/:id/submit` |
| Auth/Permiso | S · `purchase:proposal:submit` + cartera |
| Idempotencia | `idempotency-key` obligatorio |
| Concurrencia | **`If-Match` obligatorio** |
| Precondición | `status=draft` · ≥1 línea · toda línea con costo (`COST_MISSING`) · OTB disponible (`OTB_EXCEEDED`) · proveedor activo · MOQ/múltiplo OK |
| Transición | criterios disparados ⇒ `in_review` + crea `Approval(pending)`; sin criterios ⇒ `approved` directo |
| Códigos | 200 · 401 · 403 · 404 · 409 (`PURCHASE_PROPOSAL_INVALID_STATE`, `VERSION_CONFLICT`) · 422 |
| Eventos | `purchase.proposal.submitted` (+ `purchase.approval.requested` si aplica) |
| Auditoría | traza con criterios evaluados (cumple "por qué pidió aprobación") |

**Response 200 (disparó aprobación)**
```json
{
  "success": true,
  "data": {
    "id": "prop-2026-000123",
    "status": "in_review",
    "version": 7,
    "approval": {
      "id": "apr-2026-000455",
      "state": "pending",
      "criteria": [
        { "code": "high_amount", "thresholdClp": 10000000, "actualClp": 12400000 },
        { "code": "excessive_coverage", "thresholdDays": 90, "actualDays": 112, "sku": "HT-TAL-0450" }
      ]
    }
  },
  "correlationId": "…"
}
```

---

## F5 · `POST /api/purchase-bff/v1/approvals/:id/approve` — Aprobar (líder)

| | |
|---|---|
| Servicio responsable | purchase-service |
| Auth/Permiso | S · **`purchase:proposal:approve`** (solo líder; validado server-side, jamás solo en UI) |
| Idempotencia | `idempotency-key` obligatorio |
| Concurrencia | `If-Match` sobre la aprobación |
| Precondición | `approval.state=pending`; el aprobador **no** puede ser el autor de la propuesta (❓P8: confirmar regla de segregación) |
| Transición | `pending→approved`; la propuesta pasa a `approved` (FK real, no string) |
| Body | `{ "note": "OK, negociar flete en próxima" }` (opcional) |
| Códigos | 200 · 403 · 404 · 409 |
| Eventos | `purchase.approval.approved` → notification trigger al autor |
| Auditoría | traza `approval.approved` (before/after de estado) |

`/reject` y `/request-changes` idénticos con `reason` **obligatorio**; `request-changes` devuelve la
propuesta a `draft` (estado `changes_requested` visible) conservando líneas y versión histórica.

---

## F6 · `POST /api/purchase-bff/v1/proposals/:id/convert` — Convertir en orden(es) de compra

| | |
|---|---|
| Nombre funcional | Convertir propuesta aprobada en OC (1 por proveedor) y encolar emisión a SAP |
| Servicio responsable | purchase-service (transacción: crea PO(s), consume OTB, encola outbox SAP) |
| Auth/Permiso | S · `purchase:order:issue` + cartera |
| Idempotencia | `idempotency-key` + `integrationKey` por OC (`po:<id>:opor`) |
| Concurrencia | `If-Match` |
| Precondición | `status=approved` · re-validación fresca de costo/stock/OTB (revalidar-al-confirmar) |
| Transición | proposal → `converted`; cada PO nace `approved` con `sapSync.status="pending"` |
| Respuesta | **`202 Accepted`**: la emisión a SAP es asíncrona (ver `05`) |
| Códigos | 202 · 409 · 422 (`OTB_EXCEEDED` si cambió el contexto) |
| Eventos | `purchase.order.issued` (por OC) · `purchase.otb.consumed` |
| Auditoría | traza por OC con snapshot de costeo |

**Response 202**
```json
{
  "success": true,
  "data": {
    "proposalId": "prop-2026-000123",
    "status": "converted",
    "purchaseOrders": [
      {
        "id": "po-2026-000789",
        "number": "OC-2026-0789",
        "supplierId": "SUP-023",
        "status": "approved",
        "netTotalClp": 12400000,
        "sapSync": { "status": "pending", "docEntry": null, "docNum": null, "attempts": 0 }
      }
    ]
  },
  "correlationId": "…"
}
```

---

## F7 · `GET /api/purchase-bff/v1/purchase-orders/:id/sap-status` — Estado de sincronización SAP

| | |
|---|---|
| Objetivo | Polling liviano del estado asíncrono de emisión (sin exponer SAP) |
| Auth/Permiso | S · `purchase:order:read` |
| Caché | **nunca** |
| Códigos | 200 · 404 |
| Observaciones | El detalle de OC (A5.2) incluye el mismo bloque `sapSync`; este endpoint existe para poll barato |

**Response 200 (confirmada)**
```json
{
  "success": true,
  "data": {
    "purchaseOrderId": "po-2026-000789",
    "sapSync": {
      "status": "posted",
      "docEntry": 18342,
      "docNum": 45021,
      "postedAt": "2026-07-17T12:06:40Z",
      "attempts": 1,
      "lastError": null
    }
  },
  "correlationId": "…"
}
```
**Estados**: `pending → processing → posted | failed (retryable) | rejected (SAP_VALIDATION_ERROR) | cancelled`.

---

## F8 · `POST /api/purchase-bff/v1/receptions` — Registrar recepción contra OC

| | |
|---|---|
| Servicio responsable | purchase-service (registro + diferencias); efecto de stock: inventory (evento); GRN: SAP (P6) |
| Auth/Permiso | S · `purchase:reception:write` |
| Idempotencia | `idempotency-key` obligatorio |
| Body | `{ purchaseOrderId, warehouseId, packingSlip?, items: [{ lineId, qtyReceived, condition?, note? }] }` |
| Precondición | OC en `sent\|confirmed\|partially_received`; `lineId` de la OC; `qtyReceived ≥ 0` |
| Transición | crea `Reception(checking)`; al `PATCH …/:id {action:"complete"}` ⇒ `completed` o `discrepancy` y OC ⇒ `partially_received\|received` |
| Códigos | 201 · 409 · 422 |
| Eventos | `purchase.reception.completed` · `purchase.reception.discrepancy_flagged` |
| Auditoría | traza con pedido-vs-recibido por línea |

---

## F9 · `POST /api/purchase-bff/v1/alerts/:id/acknowledge` — Atender alerta

Permiso `purchase:alert:ack` · idempotente por transición (`active→acknowledged`; repetir ⇒ 200 sin
cambio) · evento `purchase.alert.acknowledged` · traza. `resolve`/`dismiss` análogos (`dismiss` exige `reason`).

---

## F10 · Interno · `POST /api/purchase/v1/recommendations/search`

Envoltorio **crudo** de dominio (el BFF lo traduce). Permiso `purchase:recommendation:read`.
```json
{
  "items": [
    {
      "id": "rec-2026-018842", "sku": "HT-TAL-0450", "supplierId": "SUP-023",
      "categoryId": "cat-herramientas", "buyerId": "catalina",
      "priority": "stockout_imminent", "suggestedQty": 96, "coverageDays": 4.4,
      "dailyVelocity": 3.2, "velocityAsOf": "2026-07-16T23:59:59Z",
      "stockSnapshot": { "available": 14, "inTransit": 24, "asOf": "2026-07-17T11:20:00Z" },
      "unitCostClp": 38990, "status": "pending", "version": 3
    }
  ],
  "total": 87, "page": 1, "pageSize": 60
}
```

## F-EXT-1 · Requerido en Sales/Analytics (✅ verificado — **AMPLIAR** `analysis-service`)

**Verificación V1 (código real):** `analysis-service` ya computa la velocidad — `GET /v1/api/resumen-producto?itemCode=` devuelve `PromedioDiario` (fórmula vigente del negocio: `(venta 14 días ×0.8 + mismo período año anterior ×0.2)/14`) y `CoberturaEnDias`; `GET /v1/api/pv/historico` da la serie diaria por SKU con ventanas `7D|14D|1M|3M|6M`. Falta: entrada **multi-SKU** (`skus=` CSV), salida en **unidades/día** (hoy la serie es monto), y forma normalizada. Todo es aditivo sobre el mismo SQL (`SUM(INV1.Quantity)` agrupado por `ItemCode`, join `OINV` con `CANCELED='N'`).

Shape a exponer al ampliar (`analysis-service`, misma BD réplica SAP):
`GET /v1/api/sales/velocity?skus=HT-TAL-0450,…&window=30d&channel=all`
```json
{ "items": [ { "sku": "HT-TAL-0450", "window": "30d", "unitsPerDay": 3.2, "byChannel": [ { "channelReferenceId": "MER-001", "unitsPerDay": 1.1 } ], "asOf": "2026-07-16" } ] }
```
Notas de la verificación: el "canal" en analysis es **derivado** de `WhsCode+SlpCode` (mapeo hardcodeado en controladores) — conciliarlo vía `ChannelMap` (P13); el servicio no tiene auth ni envoltorio (raw arrays) — el consumo es interno (purchase/BFF), nunca del frontend.
Fallback contractual mientras la ampliación no esté desplegada: el motor usa la última velocidad materializada y toda respuesta marca `sales.source="materialized", stale=true`. El motor de purchase-service **adopta la misma fórmula 80/20** como cálculo materializado (deja de ser inventada: es la del negocio — cierra la parte "velocidad" de P15).
</content>
