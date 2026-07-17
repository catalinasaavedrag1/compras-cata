# 08 · Revisión crítica final, pendientes y riesgos

> Cumple el punto 14 y los entregables 9–11. La revisión se hizo **contra los propios contratos** de
> `01`–`07` antes de cerrarlos; las correcciones ya están aplicadas en los documentos y aquí se deja
> el registro de qué se detectó y qué se corrigió.

## 1. Hallazgos de la revisión y correcciones aplicadas

| Hallazgo | Corrección aplicada |
|---|---|
| **Duplicado**: A3.1 `replenishment/search` vs A3.5 `products/critical/search` se solapan (críticos = reposición con `priority=stockout_imminent`) | Se mantienen ambos **como rutas**, pero A3.5 queda definido como *alias curado* del mismo compuesto (mismo backend, filtro fijo) — un solo contrato de composición (`03` §5). Si en implementación no aporta, eliminar A3.5 es cambio no-rompiente |
| **Duplicado**: `GET /tasks` (A10.4) repetía la agenda del dashboard | Se declaró misma fuente/contrato que `dashboard.sections.agenda`; endpoint separado solo para refresco liviano |
| **Demasiado específico**: un endpoint por tarjeta del panel (tentación inicial) | Un solo `GET /dashboard` con `sections{}` degradables; el front renderiza por sección |
| **Demasiado grande**: detalle de producto/proveedor/categoría con todas las pestañas | Carga **por pestaña** (`?tab=`), prohibido componer 6–9 dominios en una respuesta (principio #8) |
| **Lógica de negocio en el front**: front decidía criterios de aprobación, prioridad, cobertura | Todo llega calculado (`approvalPreview`, `priority`, `coverageDays`); front solo pinta |
| **Responsabilidad incorrecta en BFF**: la 1ª versión ponía "validar OTB" en el BFF | Movido a dominio (`POST /budget/check` invocado por submit/convert); el BFF no valida reglas |
| **Acoplamiento SAP**: exponer `DocEntry`/OPOR al front | Reducido al bloque `sapSync` neutro; `docNum` como "N° SAP" (único dato visible de SAP) |
| **Maestro duplicado**: riesgo de copiar nombre/costo/stock del proveedor-producto en purchase | Contratos usan snapshots **fechados** (`asOf`) solo en documentos transaccionales; lecturas siempre del dueño |
| **Respuestas inconsistentes**: dominio `{items,total,page,pageSize}` vs BFF `meta{}` rico | Declarado **deliberado** por capa (00 §1); el BFF normaliza; el front ve una sola forma |
| **Falta de paginación**: front actual renderiza sets completos | Toda colección con tope duro (24/100 BFF, 60/500 dominio); export asíncrono para sets grandes |
| **Falta de permisos**: aprobar era gating de UI | `purchase:proposal:approve` server-side + alcance de cartera + (P8) segregación de autor |
| **Falta de idempotencia**: emisión/duplicación de OC | `idempotency-key` + `integrationKey` + `U_REF1` (tres capas, `05` §8) |
| **Rendimiento**: fan-out N×SKU por fila | Batch por página (ids CSV a catalog/inventory/pricing), motor materializado, caché de maestros; presupuestos de latencia en `03` |
| **Inconsistencia de nombres**: `data.data` del envoltorio heredado | Normalizado a `items` (00 §2) |

## 2. Endpoints existentes que deben **confirmarse** antes de implementar (entregable 9)

| # | Qué confirmar | Dónde | Impacto si difiere |
|---|---|---|---|
| V1 | ~~`analysis-service`: existencia/forma de venta por SKU~~ — **VERIFICADA**: es un backend de dashboards sobre réplica SAP (`SBO_INTER_MIM`, tablas `INV1`/`OINV`, refresh por cron). **Ya calcula velocidad diaria por SKU** (`GET /v1/api/resumen-producto`: `PromedioDiario = (venta 14d ×0.8 + mismo período año anterior ×0.2)/14` + `CoberturaEnDias`) y serie diaria por SKU con ventanas (`GET /v1/api/pv/historico`, `7D..6M`). Margen por canal ✅ (`/informes/productos-por-canal-margen`); canal **derivado** de `WhsCode+SlpCode` (mapeo hardcodeado). **Sin** oportunidades perdidas ni KPIs de decisión; **sin Kafka, sin auth, sin envoltorio**. Veredicto F-EXT-1: **AMPLIAR** (multi-SKU `skus=` CSV + unidades/día), no crear | verificado en código | Motor puede adoptar la fórmula real (cierra parte de P15-velocidad); vistas 33/34 viables; 37 (venta no capturada) sigue 🆕 |
| V2 | `trace-service`: contrato de escritura/consulta de trazas (HTTP vs Kafka, shape) | repo `trace-service` | Formato de auditoría D7; bitácora de `/gobierno` |
| V3 | `tms-service`: capacidad/tarifas para plan de retiro | repo `tms-service` | A4.11 queda simulado hasta confirmar |
| V4 | `document-generator-service`: subida/generación y referencia de documentos | repo | A14.6 / docs de importación |
| V5 | `pricing-service`: ¿expone waterfall de costo neto o solo `markup`+`SapItemCost`? | módulos `sap-item-cost/special-price` | Pestaña negociación (fila 22) |
| V6 | `inventory-v3 supplying` + `sap-sync`: ¿sirven como vía de GRN de compras? (P6) | código ya leído; falta decisión operativa | Fase 2 (recepciones) |
| V7 | Registro de plataforma/módulos/endpoints de Compras en `id-service` + rutas BFF en `api-gateway` | config | Sin esto no hay RBAC de gateway |
| V8 | `notification-service`: alta de `eventKey purchase:*` por cliente y exposición vía gateway | config + gateway | Push de aprobaciones/alertas |
| V9 | Header exacto de identidad aceptado por servicios Express sin auth (R7) | catalog/comerce/oms | Solo defensa en profundidad |
| V10 | SAP: política de cancelación de OPOR con recepciones parciales (P7a) y UDF `U_REF1` disponible en OPOR | administrador SAP | C14b y §5 de `05` |

## 3. Decisiones funcionales pendientes (entregable 10 — ninguna bloquea el diseño, todas marcadas en los contratos)

> **Actualización (paso modelo de dominio):** P1, P2, P3 y P16 quedaron **resueltas por diseño** en
> `../modelo-dominio/00-decisiones-modelado.md` (D1–D4), con costo de cambio explícito; siguen
> marcadas **[RATIFICAR]** con negocio pero ya no bloquean nada.

| # | Decisión | Propuesta no vinculante | Bloquea |
|---|---|---|---|
| P1 | FK vs string — **resuelta (D1)**: FK reales, códigos legibles como atributo | ratificar | — |
| P2 | ¿Una propuesta activa por comprador o varias? — **resuelta (D2)**: N activas; "borrador activo" = la más reciente | ratificar | — |
| P3 | Identidad canónica de proveedor — **resuelta (D3)**: `supplierRef` (comerce) canónica + `sapCardCode` obligatorio para emitir | ratificar | — |
| P4 | Alta de proveedor: ¿upsert `cSupplier` a SAP o exigir CardCode preexistente? | v1: exigir preexistente; upsert = fase posterior | emisión a proveedores nuevos |
| P5 | Fuente real de velocidad de venta (analysis vs feed OMS vs POS) | definir con dueño de analysis (V1); shape F-EXT-1 fijado | precisión del motor |
| P6 | GRN/recepción: ¿la origina purchase o inventory `supplying`? | purchase registra negocio; efecto físico+SAP vía inventory sap-sync | fase 2 |
| P7 | Eventos SAP `PurchaseOrder.Created/Updated/Closed` (ampliar TransactionNotification) | sí, para conciliación; mientras tanto conciliación batch | conciliación fina |
| P8 | Segregación: ¿el líder puede aprobar su propia propuesta? | no (regla anti-autoaprobación) | C8 |
| P9 | ¿Auditar `ip/device`? | no en v1 (gateway no lo propaga) | auditoría extendida |
| P10 | Adjudicar RFQ: ¿la propuesta resultante salta aprobación? | no salta: pasa por Governance normal | C20 |
| P11 | Tolerancia de deriva de costo entre aprobación y conversión (`price_drift_pct`) | 0% (cualquier cambio re-somete); parametrizable en reglas | C13 |
| P12 | ¿Alcance por sucursal/bodega en permisos? | no en v1 (solo filtro) | matriz permisos |
| P13 | Taxonomía única de canales (heredada #2): mapear las 3 del front a `comerce sales-channel.ReferenceId` | tabla de mapeo en purchase config | margen canal, demanda |
| P14 | Unificación de campaña y costeo landed (heredadas #3): una entidad con `type`; landed **por unidad** | ya reflejada en contratos | fase 5 |
| P15 | Fórmulas de "inteligencia" simulada (evaluación proveedor, atribución, ABC/XYZ, temporada) | contrato por indicador con negocio; el shape tipado del front es el contrato de salida | fases 3–6 |
| P16 | OTB: fuente de actuals — **resuelta (D4)**: OC convertidas con `OtbEntry` append-only + conciliación mensual SAP | ratificar | — |

## 4. Riesgos técnicos (entregable 11)

| # | Riesgo | Severidad | Mitigación en contrato |
|---|---|---|---|
| R-A | **Brecha de identidad**: gateway no propaga identidad; servicios de dominio confían en headers falsificables dentro de la red | Alta | BFF como frontera única; `x-service-*` para S2S; recomendación explícita: cerrar R7/V9 en plataforma (fuera del alcance de compras pero señalado) |
| R-B | `analysis-service` sin verificar: el motor puede nacer sin venta real | Alta | Fallback contractual visible (`stale=true`), nunca dato inventado; V1 primero en el plan |
| R-C | Latencia del compuesto crítico (5–6 dependencias) | Media | Motor materializado + batch por página + presupuestos de latencia + parcialidad |
| R-D | SAP indisponible prolongado | Media | Outbox con backoff, OC no se bloquea (`202`), alerta operativa, reintento manual |
| R-E | Doble fuente de proveedor (P3) genera duplicidad de identidad | Media | Cross-ref obligatoria en `SupplierRelationship`; validación al emitir (sin CardCode ⇒ 422) |
| R-F | Deriva de convenciones entre BFF y dominio (dos envoltorios) | Baja | Deliberado y documentado (00 §1); el front solo ve una |
| R-G | Crecimiento del BFF hacia mini-monolito de pantallas | Media | Regla dura: BFF sin reglas ni persistencia; revisión de PRs contra `03` |
| R-H | Volumen de auditoría (traza por comando) | Baja | trace-service ya es el patrón del ecosistema; muestreo no permitido en comandos de negocio |

## 5. Recomendación: primer flujo vertical a implementar (entregable 12)

**Vertical estrella: Reposición → Propuesta → Aprobación → Conversión → SAP → Seguimiento.**
Endpoints mínimos (en orden de construcción):
1. Habilitadores: `GET /context` · `GET /server-time` (+ registro gateway/id-service V7).
2. `POST /api/purchase/v1/recommendations/search` (motor con velocity fallback) + BFF `POST /replenishment/search`.
3. Propuesta completa: C1–C7 (con idempotencia + If-Match desde el día uno — retrofitear es caro).
4. Governance mínimo: reglas `high_amount`/`excessive_coverage` parametrizadas + C8–C10.
5. C13 `convert` + outbox SAP (E11) + F7 `sap-status` + consumo `sap.purchaseorder.cancelled` (E5).
6. `GET /dashboard` (secciones replenishment+approvals) para cerrar la experiencia.

Por qué este: es el corazón del producto (así lo prioriza `backend-spec/09` Fase 1), ejercita **todas**
las convenciones nuevas (envoltorios, permisos, idempotencia, versión, outbox, parcialidad, SAP async)
y deja pruebas de contrato reutilizables para el resto. Criterio de done: un comprador arma una
propuesta real, el líder la aprueba, se emite a SAP y el `DocNum` vuelve a la UI — con trazas en
trace-service y eventos en el bus.
</content>
