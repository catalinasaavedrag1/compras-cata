# 00 · Convenciones de API — `purchase-bff-service` y `purchase-service`

> **Objeto.** Este documento fija las convenciones únicas que usan los **dos servicios nuevos** de la
> plataforma de compras. Todo contrato de `01`–`08` y los OpenAPI se rigen por lo definido aquí.
>
> **Procedencia (no se inventa).** Cumpliendo el principio "primero identifica la convención actual y
> reutilízala", cada regla proviene de convenciones **verificadas en código** del monorepo:
> `purchase-bff-service` hereda las de `web-bff-service` (el BFF ya productivo del ecosistema) y
> `purchase-service` hereda las de `pricing-service` / `inventory-service-v3` (servicios de dominio
> NestJS). Las citas de archivo son solo evidencia de procedencia; **el contrato es el de compras**.

## 1. Las dos capas y su convención

| | **purchase-bff-service** (lo único que ve el frontend) | **purchase-service** (interno, dominio) |
|---|---|---|
| Prefijo | `/api/purchase-bff/v1` | `/api/purchase/v1` |
| Éxito | Envoltorio `{ success, data, correlationId }` | DTO **crudo**, sin envoltorio |
| Colección | `data: { items[], meta{page,pageSize,total,totalPages,hasNext,hasPrev} }` | `{ items[], total, page, pageSize }` + header `x-janis-total` |
| Error | `{ success:false, code, message, statusCode, details, retryable, correlationId }` | `{ statusCode, error:{ code, message, details }, timestamp }` |
| Auth | Valida `Authorization: Bearer <jwt>` (id-service) y resuelve permisos | Confía en headers `x-user-id` / `x-client` / `x-user-permissions` que le propaga el BFF |
| Permisos | `purchase:<recurso>:<acción>` | ídem (guard por decorador) |
| Paginación | `page/pageSize` default 24, máx 100 · cursor para feeds | `page/pageSize` default 60, máx 500 (+ alias headers `x-janis-page[-size]`) |
| Idempotencia | reenvía `idempotency-key` del cliente | header `idempotency-key` + hash de payload + respuesta almacenada |
| Concurrencia | reenvía `If-Match` | campo `version` + `If-Match` ⇒ `409 VERSION_CONFLICT` |
| Correlación | `x-correlation-id` in/out (genera si falta) | `x-correlation-id` in/out (eco en header) |

*Procedencia:* envoltorio y filtros del BFF = `web-bff-service/src/common/{interceptors,filters,dto}`;
crudo + `{items,total,page,pageSize}` + `x-janis-*` + idempotencia = `pricing-service/src/shared/*` e
`inventory-service-v3/src/shared/*`. El **frontend nunca consume `purchase-service`** (principio #1;
sin excepciones identificadas — la exportación CSV también sale por el BFF).

## 2. Envoltorios del BFF (cara al frontend)

**Recurso simple**
```json
{ "success": true, "data": { "…": "…" }, "correlationId": "8c2f6e0a-4b1d-4f6e-9a3c-2f1e0d9c8b7a" }
```

**Colección paginada**
```json
{
  "success": true,
  "data": {
    "items": [ { "…": "…" } ],
    "meta": { "page": 1, "pageSize": 24, "total": 240, "totalPages": 10, "hasNext": true, "hasPrev": false }
  },
  "correlationId": "8c2f6e0a-…"
}
```
> Nota deliberada: el arreglo se llama **`items`** (no `data` anidado) para evitar `data.data` y
> alinear con el dominio, que ya usa `items`.

**Respuesta parcial (degradación elegante)** — cuando una dependencia **opcional** falla, la vista se
entrega igual y se declara la sección degradada:
```json
{
  "success": true,
  "data": {
    "items": [ "…" ],
    "meta": {
      "page": 1, "pageSize": 24, "total": 240, "totalPages": 10, "hasNext": true, "hasPrev": false,
      "partial": true,
      "warnings": [
        { "code": "PRICING_UNAVAILABLE", "scope": "items[].cost", "message": "Costo no disponible; margen omitido.", "retryable": true }
      ]
    }
  },
  "correlationId": "8c2f6e0a-…"
}
```

**`timestamp` / fecha de servidor.** No se inyecta en cada payload; se expone
`GET /api/purchase-bff/v1/server-time` (reemplaza el `TODAY_ISO` hardcodeado del front).

## 3. Envoltorio interno de `purchase-service`

- Recurso: DTO crudo. Creación: `{ "id": "…" }` (+ `Location`). Colección:
  `{ "items": [...], "total": 240, "page": 1, "pageSize": 60 }` y header `x-janis-total`.
- Error: `{ "statusCode": 409, "error": { "code": "CONFLICT_ERROR", "message": "…", "details": [...] }, "timestamp": "2026-07-17T12:00:00Z" }`.
- El BFF **traduce** siempre ese crudo al envoltorio §2 — el frontend jamás ve la forma interna
  (tampoco modelos SAP, entidades Prisma ni formas de otros microservicios; principio #5).

## 4. Catálogo de errores (canónico — este es el catálogo completo de la plataforma)

Códigos funcionales expuestos por el BFF y su mapeo al código interno del dominio:

| `code` (BFF) | HTTP | `retryable` | código interno | Significado |
|---|---|---|---|---|
| `VALIDATION_ERROR` | 400 | no | `VALIDATION_ERROR` | Body/params inválidos → `details[] {field,issue,actual}` |
| `UNAUTHENTICATED` | 401 | no | `UNAUTHENTICATED` | JWT ausente/expirado/revocado |
| `FORBIDDEN` | 403 | no | `PERMISSION_DENIED` | Permiso o alcance de cartera insuficiente |
| `NOT_FOUND` | 404 | no | `RESOURCE_NOT_FOUND` | Entidad inexistente |
| `PURCHASE_PROPOSAL_INVALID_STATE` | 409 | no | `CONFLICT` | Transición no permitida desde el estado actual |
| `VERSION_CONFLICT` | 409 | no | `CONFLICT` | `If-Match` no coincide (edición concurrente) |
| `IDEMPOTENCY_KEY_MISSING` | 409 | no | `CONFLICT` | Comando sin `idempotency-key` |
| `IDEMPOTENCY_KEY_REUSED` | 409 | no | `CONFLICT` | Misma key con **payload distinto** |
| `APPROVAL_REQUIRED` | 409 | no | `CONFLICT` | La acción exige aprobación previa |
| `OTB_EXCEEDED` | 422 | no | `VALIDATION_ERROR` | Presupuesto abierto insuficiente |
| `SUPPLIER_INACTIVE` | 422 | no | `VALIDATION_ERROR` | Proveedor bloqueado / sin acuerdo vigente |
| `MOQ_NOT_MET` | 422 | no | `VALIDATION_ERROR` | Cantidad bajo mínimo / múltiplo de compra |
| `COST_MISSING` | 422 | no | `VALIDATION_ERROR` | Línea sin costo vigente: no se puede enviar a revisión |
| `PRICING_UNAVAILABLE` | 200 parcial / 502 | sí | — | Pricing caído (lectura: degradar; comando: fallar) |
| `STOCK_UNAVAILABLE` | 200 parcial / 502 | sí | — | Inventory caído |
| `DOWNSTREAM_SERVICE_ERROR` | 502 | sí | — | Dependencia indispensable caída |
| `SAP_SYNC_PENDING` | 202 | sí | — | Documento aún no confirmado por SAP |
| `SAP_VALIDATION_ERROR` | 422 | no | — | SAP rechazó el documento (detalle en `details`) |
| `RATE_LIMITED` | 429 | sí | `RATE_LIMITED` | Exceso de peticiones |
| `INTERNAL_ERROR` | 500 | sí | `INTERNAL_ERROR` | Error inesperado |

*Procedencia:* enum de códigos internos = `inventory-service-v3/src/shared/errors/error-codes.ts`;
`retryable` es la **única extensión** al envoltorio base (exigida por el enunciado).

### 4.1 Códigos de warning (respuesta parcial — viajan en `meta.warnings[]` / `sections[].warning`, nunca como error HTTP)

| `code` (warning) | Significado | Efecto en la vista |
|---|---|---|
| `PRICING_UNAVAILABLE` | pricing caído o SKU sin precio en una lectura | `cost: null` por ítem; submit posterior fallará con `COST_MISSING` |
| `STOCK_UNAVAILABLE` | inventory caído y sin snapshot utilizable | `stock: null` + flag |
| `STOCK_STALE` | inventory caído; se usa `stockSnapshot` del motor con su `asOf` | dato mostrado con marca de antigüedad |
| `ANALYTICS_UNAVAILABLE` | Sales/Analytics no responde | `sales.source="materialized", stale=true` |
| `SUPPLIER_DATA_STALE` | comerce no responde; identidad de proveedor desde snapshot | nombre/estado con marca de antigüedad |
| `DOWNSTREAM_SERVICE_ERROR` | sección **opcional** de un compuesto caída (p. ej. `budget` del dashboard) | `sections[x].status="degraded"` |

Todos los warnings son `retryable: true` por definición (reflejan indisponibilidad transitoria).
La misma dependencia caída en un dato **indispensable** no genera warning: genera el error HTTP 502
`DOWNSTREAM_SERVICE_ERROR` de la tabla principal (qué es indispensable por endpoint: `03` §5).

## 5. Identidad, sesión y propagación ⚠️ (realidad verificada — condiciona el contrato)

Hechos comprobados en código:
1. El JWT de `id-service` trae **solo** `{ usuarioId, correo, nombre, plataformaId }` — sin roles,
   permisos, empresa/sucursal, categorías. Es revocable (se valida contra `TOKENS_ACTIVOS`).
2. El `api-gateway` **no** inyecta identidad downstream (solo `X-Request-Id`); deja pasar el
   `Authorization` original. Su RBAC es por **(método + path)** vía
   `GET /api/idservice/endpoints/allowedEndpoints?user&plat`, con alcance **por plataforma**.
3. Los guards de dominio (patrón pricing/inventory-v3) esperan `x-user-id/x-client/x-user-permissions`
   — headers que hoy nadie envía (caen a `['*']`).

**Contrato de compras (cierra la brecha sin tocar el gateway):**
- **Frontend → BFF**: `Authorization: Bearer <jwt>` + `x-correlation-id` (opcional; el BFF genera).
- **BFF**: valida el JWT, resuelve el perfil de permisos en `id-service`
  (`GET /users/:userId/permissions/:platformId`, caché ≤ 60 s en memoria de request, jamás persistente),
  lo **traduce** al catálogo `purchase:*` y propaga a `purchase-service`:
  `x-user-id`, `x-client`, `x-user-permissions`, `x-plataforma-id`, `x-correlation-id`,
  `x-buyer-id` (comprador activo) y `x-scope` (`mine|all`).
- **purchase-service**: confía en esos headers (mismo modelo de confianza que pricing) y aplica
  **permiso + alcance de cartera** server-side. El alcance por categoría/comprador **no existe** en
  id-service ⇒ lo posee `purchase-service` mediante su entidad `CategoryAssignment`
  (verificado: `catalog.Category` **no tiene** campo `buyer`). Ver `06-seguridad-permisos-auditoria.md`.
- Servicio-a-servicio sin usuario (workers, Kafka): `x-service-api-key/-secret/-client`
  (patrón `ApiKeyGuard` de inventory-v3).

## 6. Idempotencia

- Header **`idempotency-key`** (minúsculas) **obligatorio** en todo comando de creación o con efecto
  externo (crear/duplicar/convertir propuesta, aprobar/rechazar, adjudicar RFQ, registrar recepción,
  crear reclamo, enviar a SAP). Falta ⇒ `409 IDEMPOTENCY_KEY_MISSING`.
- Semántica (patrón `IdempotencyGuard` de inventory-v3, clave `(key, ruta, método)` + hash de payload):
  reintento idéntico ⇒ **replay** de la respuesta almacenada (mismo status); misma key con payload
  distinto ⇒ `409 IDEMPOTENCY_KEY_REUSED`.
- La emisión a SAP añade además una **`integrationKey` de negocio** (`po:<id>:opor`) con índice único
  en el outbox — doble barrera anti-duplicado (patrón `inventory-service` outbound / `sap-outbox-worker`).

## 7. Control de concurrencia (patrón nuevo — no existe hoy en el ecosistema; ver `04-comandos-dominio.md` §7)

- Toda entidad editable (`PurchaseProposal`, línea, `PurchaseOrder`, `Approval`, `Claim`,
  `NegotiationRound`, `SupplierTerms`, `PurchaseRule`) lleva **`version`** (entero, +1 por escritura).
- GET de detalle ⇒ `ETag: "<version>"` y `data.version`. PATCH/PUT/DELETE/transición ⇒
  **`If-Match: "<version>"`** obligatorio; desajuste ⇒ `409 VERSION_CONFLICT` con
  `details: { expectedVersion, currentVersion }`.
- Simulaciones: *stateless*, sin bloqueo; **revalidar al confirmar** (stock/costo/OTB frescos) —
  puede devolver `409/422` si el contexto cambió.
- Doble aprobación / doble envío a SAP: máquina de estados + `idempotency-key` + `integrationKey`.

## 8. Resiliencia y caché del BFF (defaults heredados y adoptados)

- Timeout por dependencia **4000 ms** · **2 reintentos** (backoff 200 ms) · circuit breaker por
  servicio (umbral 5, reset 15 000 ms) · timeout total de request **10 000 ms**.
- **Caché de lectura** (Redis) con TTL corto e invalidación por evento: maestros de catálogo (~120 s),
  categorías (~180 s), maestro de proveedor (~300 s), canales (~600 s), agregados de reportes por rango
  (~300 s). **Nunca**: stock/`inTransit`/cobertura, costo al costear, OTB restante, estados de
  propuesta/OC/aprobación, nada recién escrito, permisos/sesión.
- Dependencia **indispensable** caída ⇒ `502 DOWNSTREAM_SERVICE_ERROR`; **opcional** ⇒ respuesta
  parcial §2 con `warnings[]`. Qué es indispensable por endpoint: `03-vistas-y-composicion.md`.

## 9. Paginación, filtros, orden y exportación

- **Página** (default): `?page&pageSize`. BFF 24/100; dominio 60/500. Meta según capa (§1).
- **Cursor**: `?cursor=<opaco>&limit=` solo para feeds append-only (bitácora, hilo de señales).
- **Sin límite: prohibido** — todo listado aplica tope; pedir más ⇒ se recorta al máximo (documentado).
- **Filtros**: params explícitos (`categoryId[]`, `supplierId[]`, `status[]`, `priority[]`,
  `warehouseId`, `buyerId`, `desde`/`hasta` ISO-8601); búsqueda textual `q`. Los search complejos de
  tabla usan **`POST …/search`** con body de filtros (evita URLs enormes y facilita contrato tipado).
- **Orden**: `sort` multi-campo `?sort=priority,-coverageDays` (prefijo `-` = desc) o
  `[{field,order}]` en body de search.
- **Exportación**: `POST …/export` **asíncrono** ⇒ `202 { jobId }` + `GET /exports/:jobId` (estado y
  URL de descarga). Nada de re-paginar en el cliente.

## 10. Versionado, nombres y compatibilidad

- Versión mayor en ruta (`/v1`). Cambios aditivos no rompen contrato; ruptura ⇒ `/v2`.
- Recursos en inglés-kebab plural (`purchase-orders`, `price-increases`) — coherente con el monorepo;
  textos de negocio (mensajes, labels) en español.
- Fechas ISO-8601 UTC; montos en **CLP enteros** (sin decimales) salvo indicación; cantidades con
  `unit` explícita cuando aplique.

## 11. Auditoría (resumen; detalle en `06-seguridad-permisos-auditoria.md`)

Todo comando (POST/PATCH/PUT/DELETE de negocio) emite traza a **`trace-service`**:
`{ userId, timestamp, action, entity, entityId, before, after, changedFields[], reason?, source, correlationId }`.
No sustituible por logs técnicos. `reason` es **obligatorio** en: rechazar, solicitar corrección,
cancelar, ignorar recomendación, resolver reclamo, override de cantidad.

## 12. Realidades del ecosistema que condicionan contratos (verificadas; detalle en `08-revision-critica.md`)

| # | Hecho verificado | Consecuencia de contrato |
|---|---|---|
| R1 | `notification-service` es **solo despacho** (`POST /notification/trigger`, headers `janis-*`; sin inbox ni estados ack/resolve) | El **centro de alertas** con estado (`active→acknowledged→resolved|dismissed`) es del módulo Alerts de `purchase-service`; notification solo hace push |
| R2 | Maestro de proveedor **sí existe** en `comerce-service` (`GET /supplier/Listar`, `/:id` — `ReferenceId`, `Document`, `Status`) y **además** catalog referencia proveedor vía `ProductCatalogCode.cardCode` (SAP) | La ficha de proveedor compone comerce (identidad) + purchase (relación); **conciliar `ReferenceId` ↔ `cardCode` es decisión pendiente P3** |
| R3 | `catalog` **no tiene** MOQ ni `Category.buyer`; sí tiene `unitMultiplier`/`sellingUnitMultiplier` (pack) | MOQ vive en `SupplierTerms` (purchase); la cartera vive en `CategoryAssignment` (purchase) |
| R4 | **No existe** venta-por-SKU/velocidad de venta en catalog/oms/customer/comerce; `analysis-service` sin verificar | Endpoint de Sales/Analytics marcado **pendiente de verificación / debe crearse**; los contratos definen el shape esperado y el fallback |
| R5 | `inventory-v3` expone stock por SKU+bodega (`GET /stock`, `GET /sku-stock/:skuId`) con campos `availableStock`, `inTransit`, `securityStock`… pero el agregado `sku-stock` **omite `inTransit`** y **no hay cobertura** | El motor de compras usa `GET /stock` (detalle) y calcula cobertura; pedir ampliación del agregado es opcional |
| R6 | SAP: patrón probado de salida = outbox + Service Layer `POST /PurchaseOrders` con `DocEntry/DocNum` de vuelta; egreso SAP→Kafka existe **solo** para `PurchaseOrder.Cancelled` | Contrato SAP asíncrono (`05-integracion-sap.md`); eventos `Created/Updated` desde SAP = **debe ampliarse** en el TransactionNotification |
| R7 | catalog/customer/oms/comerce **no imponen auth** en código hoy | El BFF es la frontera de seguridad; no asumir que el dato interno está protegido — riesgo señalado |
</content>
