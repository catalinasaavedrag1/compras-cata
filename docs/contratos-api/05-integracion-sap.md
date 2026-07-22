# 05 · Integración con SAP B1 (contratos, sin exponer SAP)

> Cumple el punto 8. **El frontend jamás ve SAP**: ni OPOR, ni DocEntry como concepto, ni Service
> Layer. Ve una OC de la plataforma con un bloque `sapSync` neutro. Patrón adoptado = el ya **probado**
> en el monorepo: outbox en BD + worker → SAP Service Layer, con `U_REF1` = id interno y
> `DocEntry/DocNum` de vuelta (así lo hacen `inventory-service` outbound y `finance-service`), más el
> egreso SAP→Kafka de `sap-outbox-worker`.

## 1. Los cuatro objetos, claramente separados

| Objeto | Dueño | Qué es |
|---|---|---|
| **Orden interna de Purchase** (`PurchaseOrder`, `po-2026-000789`) | purchase-service | La OC de la plataforma: líneas, costeo, estados de negocio |
| **Solicitud de creación en SAP** (`SapOutboxJob`) | purchase-service (tabla outbox) | Intención encolada: `integrationKey`, payload OPOR, reintentos |
| **OPOR creada en SAP** (`DocEntry`/`DocNum`) | **SAP B1** (system of record contable) | El documento oficial |
| **Estado de sincronización** (`sapSync`) | purchase-service | Proyección para UI/API del avance de la solicitud |

## 2. Contrato hacia el frontend (BFF)

- `POST /proposals/:id/convert` (F6) ⇒ **`202`** con OC(s) `sapSync.status="pending"`.
- `GET /purchase-orders/:id/sap-status` (F7) ⇒ polling liviano.
- Bloque `sapSync` (única ventana a SAP, sin modelos internos):
```json
{ "status": "pending|processing|posted|failed|rejected|cancelled",
  "docNum": 45021, "docEntry": 18342,
  "attempts": 2, "lastError": null, "postedAt": "2026-07-17T12:06:40Z" }
```
> `docNum` se muestra al usuario como "N° SAP"; `docEntry` se expone solo como referencia técnica
> (id de correlación soporte). Nada más de SAP cruza el BFF.

## 3. Endpoint interno de solicitud + worker

- La **transacción de `convert`** escribe OC + fila de outbox `{ integrationKey:"po:po-2026-000789:opor",
  sapObject:"PurchaseOrders", payload, status:"PENDING", attempts:0, maxRetries, nextAttemptAt }`.
  Índice **único** por `integrationKey` (anti-duplicado estructural).
- **Worker E11** (proceso del propio purchase-service): reclama lote `PENDING|FAILED` con
  `nextAttemptAt<=now` y `attempts<maxRetries` (UPDATE condicional = lock optimista, patrón
  `inventory-service`), hace login Service Layer (`B1SESSION` cacheada) y `POST /PurchaseOrders`.

**Payload OPOR** (mapper interno; forma ya probada en `inventory-service/sapMapper.buildPurchaseOrder`
+ `U_REF1` de finance):
```json
{
  "CardCode": "PV00023",
  "DocDate": "2026-07-17",
  "DocDueDate": "2026-08-05",
  "Comments": "OC-2026-0789 · Plataforma de Compras",
  "U_REF1": "po-2026-000789",
  "DocumentLines": [
    { "ItemCode": "HT-TAL-0450", "Quantity": 96, "UnitPrice": 38990, "WarehouseCode": "BOD-01" }
  ]
}
```

## 4. Respuesta, correlación y sincronización del número

- Éxito ⇒ SAP devuelve el documento (`Prefer: return=representation`): se persiste
  `sapDocEntry/sapDocNum`, outbox ⇒ `POSTED`, `sapSync.status="posted"`, evento
  `purchase.order.sap_posted`, snapshot request/response en tabla de auditoría SAP (patrón
  `dbo.SapDocuments`).
- **`U_REF1` = id interno** viaja en el documento ⇒ SAP queda auto-descriptivo y habilita la
  recuperación idempotente (§5).

## 5. Timeout, reintentos, respuesta perdida y duplicados

| Situación | Contrato |
|---|---|
| Timeout / 5xx de SAP | outbox ⇒ `FAILED`, `attempts+1`, backoff (`nextAttemptAt = now + 5 min`, exponencial hasta `maxRetries`); `sapSync.status="failed"` con `lastError` (retryable) |
| **Respuesta perdida** (POST enviado, respuesta no llegó) | antes de re-postear, el worker **consulta** `GET /PurchaseOrders?$filter=U_REF1 eq 'po-2026-000789'`; si existe ⇒ adopta su `DocEntry/DocNum` (patrón finance `getInvoiceByRef1`) — **jamás doble OPOR** |
| Documento duplicado (carrera residual) | índice único `integrationKey` + verificación por `U_REF1`; si aún así se detectan 2, alerta operativa + conciliación manual (runbook) |
| `maxRetries` agotado | `sapSync.status="failed"` terminal-operativo ⇒ alerta E10 al líder + reintento manual (`POST /purchase-orders/:id/send` re-encola) |
| Error de **validación SAP** (400 Service Layer) | outbox ⇒ `REJECTED` (no reintenta); `sapSync.status="rejected"`, `lastError` con el mensaje SAP mapeado a `SAP_VALIDATION_ERROR` (`details` saneados, sin payload interno SAP) |
| Error técnico (login/red) | reintento con backoff; breaker del worker pausa el drenaje, no pierde jobs |

## 6. Estado asincrónico — máquina de `sapSync`

```
pending ──worker toma──▶ processing ──201──▶ posted (terminal OK)
   ▲                        │ │
   └──requeue (backoff) ────┘ ├─4xx validación──▶ rejected (terminal, acción humana)
                              └─5xx/timeout──▶ failed (retryable) ──agota──▶ failed(final)
posted ──sap.purchaseorder.cancelled──▶ cancelled
```

## 7. Cancelación y actualización posterior

- **Cancelación originada en la plataforma** (C14b): si `sapSync≠posted` ⇒ cancela local y marca el
  job `CANCELLED` (no se envía). Si `posted` ⇒ solicitud de cancelación a SAP vía Service Layer
  (`POST /PurchaseOrders(<DocEntry>)/Cancel`) por el mismo outbox — **❓P7a pendiente de confirmación**
  con el administrador SAP (política de cancelación de OPOR con recepciones parciales).
- **Cancelación originada en SAP**: ya cubierta — `sap-outbox-worker` publica
  `sap.purchaseorder.cancelled` (ObjType 22, índice único en `Integration.IntegrationOutbox`);
  purchase-service consume (E5), concilia OC ⇒ `cancelled`, reintegra OTB y alerta al comprador.
- **Actualizaciones posteriores en SAP** (cambios de cantidad/fecha hechos en SAP): **no** hay egreso
  hoy (`PurchaseOrder.Updated` no existe en el TransactionNotification) ⇒ **🔧 debe ampliarse** (P7).
  Mientras no exista, el contrato declara: SAP no debe editar OPOR de la plataforma (política), y la
  conciliación nocturna (E12/E7) detecta divergencias y alerta.
- **Recepción/GRN**: la vía preferida es reutilizar `inventory-service sap-sync`
  (`POST /api/v1/sap/sync/...receipt`) — **❓P6**: confirmar si el GRN lo origina inventory (al
  completar la recepción física) o purchase (al completar `Reception`); el contrato de eventos soporta
  ambas direcciones sin cambiar la API pública.

## 8. Idempotency key — capas

1. **HTTP**: `idempotency-key` del comando (`convert`/`send`) — protege el borde API.
2. **Outbox**: `integrationKey` única (`po:<id>:opor`) — protege el encolado.
3. **SAP**: `U_REF1` consultable — protege el documento (recuperación tras respuesta perdida).
</content>
