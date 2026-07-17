# Modelo de dominio y datos — `purchase-service`

> **Paso 4 de la cadena**: levantamiento (`../levantamiento-funcional`, `../backend-spec`) →
> arquitectura (`../arquitectura-backend`) → contratos (`../contratos-api`) → **este paquete:
> modelo de dominio y base de datos** → siguiente paso: implementación del primer flujo vertical.
> `purchase-bff-service` no aparece aquí: **no tiene persistencia** (por diseño).
>
> Sigue siendo diseño: **no hay migraciones** ni cliente Prisma generado; el `.prisma` es un
> borrador validado sintácticamente (`prisma validate` OK contra provider `sqlserver`).

| Doc | Contenido |
|---|---|
| [`00-decisiones-modelado.md`](00-decisiones-modelado.md) | D1–D6: FK reales + códigos como atributo (cierra P1) · N propuestas activas (cierra P2) · identidad de proveedor `supplierRef`+`sapCardCode` (cierra P3) · OTB con entries append-only (cierra P16) · convenciones de esquema · qué NO se modela. Las que requieren ratificación de negocio van marcadas **[RATIFICAR]** con su costo de cambio |
| [`01-modelo-dominio.md`](01-modelo-dominio.md) | Lenguaje ubicuo ES↔EN · 20+ agregados con invariantes y máquinas de estado · reglas de transacción (1 tx = 1 agregado, excepciones documentadas) · tablas de infraestructura (Outbox, idempotencia, SAP outbox) |
| [`02-modelo-datos.md`](02-modelo-datos.md) | 32 tablas de dominio + 7 de infraestructura con claves/índices (incl. únicos filtrados críticos: recomendación activa por sku×proveedor, alerta viva por dedupeKey, approval pending por propuesta) · diagrama de relaciones · qué escribe cada transacción crítica · volumetría y retención · mapa evento↔escritura |
| [`03-schema-draft.prisma`](03-schema-draft.prisma) | Borrador Prisma completo (39 modelos, **validado**) para SQL Server: sin enums nativos ni Json (restricciones reales del provider, igual que pricing/inventory-v3), `onDelete/onUpdate: NoAction` (coherente con "nada se borra"), UXf documentados para crear por SQL en la migración |

## Decisiones clave del modelo (resumen)

1. **Snapshot fechado, nunca maestro**: `skuNameSnap`, `unitCostClp+costAsOf`, `stockAsOfSnapJson` viven
   dentro del documento transaccional; la verdad viva se lee del servicio dueño.
2. **Costo congelado al aprobar**: `PurchaseOrderLine` copia el costeo de la propuesta aprobada — lo
   que el líder aprobó es lo que se emite (deriva controlada por regla `price_drift_pct`, P11).
3. **Append-only donde importa auditar**: `RecommendationAction`, `OtbEntry`,
   `CategoryAssignmentHistory`, `ForecastAdjustment` — el estado actual se deriva, la historia no se
   reescribe.
4. **Dedupe estructural**: únicos filtrados para recomendación activa, alerta viva, approval pendiente
   y `integrationKey` SAP — las invariantes viven en la BD, no solo en el código.
5. **`SapSync` embebido en la OC** (no tabla aparte): 1:1 estricto, se lee siempre junto; el job de
   integración sí es tabla propia (`SapOutboxJob`) porque tiene ciclo de vida y reintentos propios.

## Estado de pendientes tras este paso

- Cerradas por diseño: P1, P2*, P3*, P16* (las * requieren ratificación de negocio — ver [RATIFICAR]).
- Sin cambios: V1–V10 (verificaciones) y P4–P15 — ninguna bloquea el primer vertical, que usa
  exclusivamente tablas de este modelo ya definidas.
</content>
