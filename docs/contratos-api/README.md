# Contratos de API — `purchase-bff-service` y `purchase-service`

> **Paso 3 de la cadena**: levantamiento funcional (`../levantamiento-funcional`, `../backend-spec`)
> → arquitectura (`../arquitectura-backend`) → **este paquete: contratos de API** → siguiente paso:
> modelo de dominio y base de datos. **No hay código**: ni controladores, ni DTOs implementados, ni
> tablas, ni migraciones; los mocks del frontend no se tocan.
>
> Base de evidencia: además de la especificación funcional, se verificó **en código** la convención y
> los endpoints reales de `web-bff-service`, `pricing-service`, `inventory-service-v3`,
> `catalog-service-v1`, `customer-service`, `oms-service`, `comerce-service`, `id-service`,
> `api-gateway`, `notification-service`, `finance-service`, `sap-outbox-worker` e
> `inventory-service` (outbound SAP). Lo no verificado quedó marcado **pendiente de verificación**
> (nunca inventado — principio #10/#11).

## Índice

| Doc | Contenido | Cubre del encargo |
|---|---|---|
| [`00-convenciones.md`](00-convenciones.md) | Convención única por capa: envoltorios, catálogo de errores, identidad/headers, idempotencia, concurrencia, resiliencia/caché, paginación/filtros/orden, versionado, auditoría, realidades del ecosistema | 3 · 9 (convención) · entregables 4–5 |
| [`01-inventario-endpoints.md`](01-inventario-endpoints.md) | Inventario A (BFF público ~70) · B (dominio ~75) · C (servicios existentes con estado ya-existe/ampliar/crear/confirmar/reemplazar) · D (integración interna) · E (webhooks/batch/sync) | 1 · entregable 1 |
| [`02-fichas-endpoints.md`](02-fichas-endpoints.md) | Ficha estándar + fichas completas de los endpoints estructurales con JSON realistas (incl. shape requerido a Analytics) | 2 · entregables 2–3 |
| [`03-vistas-y-composicion.md`](03-vistas-y-composicion.md) | Contrato por vista (carga, filtros, detalle, acciones, refresco, fallos) + composición BFF detallada con el ejemplo completo `products/critical/search` | 4 · 5 |
| [`04-comandos-dominio.md`](04-comandos-dominio.md) | 22 comandos con precondiciones/transiciones/validaciones/permisos/idempotencia/versión/eventos/auditoría + estrategia explícita de concurrencia | 6 · 7 |
| [`05-integracion-sap.md`](05-integracion-sap.md) | Contrato asíncrono OPOR sin exponer SAP: outbox, `U_REF1`, DocEntry/DocNum, reintentos, respuesta perdida, duplicados, cancelación | 8 |
| [`06-seguridad-permisos-auditoria.md`](06-seguridad-permisos-auditoria.md) | Alcances (plataforma/cartera/comprador), catálogo `purchase:*`, matriz por rol, permisos de campo (costos/márgenes), enforcement por capa, qué audita cada comando | 10 · 11 · entregable 6 |
| [`07-matriz-trazabilidad.md`](07-matriz-trazabilidad.md) | Vista → acción → endpoint BFF → interno → servicio → entidad → fuente → permiso → evento → estado (48 filas, cobertura 1:1 con `backend-spec/05`) | 13 · entregable 7 |
| [`08-revision-critica.md`](08-revision-critica.md) | Revisión crítica con correcciones aplicadas, 10 verificaciones pendientes, 16 decisiones funcionales pendientes, riesgos técnicos, **primer flujo vertical recomendado** | 14 · entregables 9–12 |
| [`openapi/purchase-bff-service.yaml`](openapi/purchase-bff-service.yaml) · [`openapi/purchase-service.yaml`](openapi/purchase-service.yaml) | OpenAPI 3.0 preliminar: paths, schemas, parámetros, responses, security, errores y ejemplos del flujo vertical + recursos representativos | 12 · entregable 8 |

## Decisiones estructurales del paquete (resumen)

1. **El frontend consume exclusivamente `purchase-bff-service`** — no se identificó ninguna excepción
   técnica que lo justifique (login y export incluidos pasan por el BFF).
2. **Dos convenciones deliberadas por capa**: BFF `{success,data,correlationId}` (herencia
   `web-bff-service`) y dominio crudo `{items,total,page,pageSize}` (herencia `pricing`/`inventory-v3`);
   el BFF traduce. El front ve **una sola** forma.
3. **CQRS ligero**: consultas (GET/`POST …/search`) separadas de comandos (transición + evento +
   traza); integraciones internas (D) y batch/eventos (E) separados de ambos.
4. **`PurchaseProposal`** es el nombre contractual del "borrador de OC" del front, con máquina
   `draft → in_review → approved → converted` y aprobación por FK real; `PurchaseOrder` nace en la
   conversión (1 por proveedor) con `sapSync` asíncrono.
5. **Concurrencia e idempotencia desde el día uno**: `version`+`If-Match`, `idempotency-key`,
   `integrationKey`, `U_REF1` — patrón nuevo (verificado: hoy nadie usa optimistic locking) pero
   requerido por el enunciado.
6. **Nada inventado**: todo endpoint de servicio existente citado fue leído en su repo; lo no
   verificable quedó en `08 §2` (V1–V10) y toda regla faltante en `08 §3` (P1–P16).

## Primer flujo vertical recomendado

**Reposición → Propuesta → Aprobación → Conversión → SAP → Seguimiento** — detalle y criterio de
done en [`08-revision-critica.md` §5](08-revision-critica.md).
</content>
