# 01 · Inventario completo de endpoints

> Clasificación A–E. Cada fila remite a su ficha (`02`), a su vista (`03`) o a su comando (`04`).
> Permisos: catálogo `purchase:*` en `06`. **Q** = soporta `page/pageSize/sort/filtros`.
> Los prefijos se omiten: BFF = `/api/purchase-bff/v1`, dominio = `/api/purchase/v1`.

---

## A. Endpoints públicos del Purchase BFF (lo único que consume el frontend)

### A1. Contexto y transversales
| # | Método y ruta | Objetivo | Notas |
|---|---|---|---|
| A1.1 | `GET /context` | Sesión, rol, permisos `purchase:*`, comprador activo, alcance, plataforma | Compone id-service; sin caché |
| A1.2 | `GET /server-time` | Fecha/hora de servidor | Reemplaza `TODAY_ISO` |
| A1.3 | `GET /notifications` · `PATCH /notifications/read` | Campanita + marcar leídas | Estado leído en purchase (R1) |

### A2. Dashboard del comprador (Inicio / Mi Cartera / Mi Desempeño)
| # | Método y ruta | Objetivo |
|---|---|---|
| A2.1 | `GET /dashboard?scope=` | Bandeja del día: recomendaciones prioritarias + aprobaciones pendientes + alertas + señales + OTB + agenda (compuesto, secciones degradables) |
| A2.2 | `GET /dashboard/portfolio?focus=products\|brands\|suppliers\|opportunities` | Mi Cartera 360 |
| A2.3 | `GET /my-performance` | Score, metas, decisiones recientes y resultado, ahorro |

### A3. Reposición y productos críticos
| # | Método y ruta | Objetivo |
|---|---|---|
| A3.1 | `POST /replenishment/search` **Q** | Tabla de recomendaciones (filtros complejos en body) — núcleo de la decisión |
| A3.2 | `GET /replenishment/summary?scope=` | KPIs de cartera (quiebres proyectados, cobertura media, monto sugerido) |
| A3.3 | `PATCH /replenishment/recommendations/:id` | Override de cantidad / ignorar / posponer (con motivo) |
| A3.4 | `POST /replenishment/recommendations:add-to-proposal` | Enviar selección a la propuesta activa |
| A3.5 | `POST /products/critical/search` **Q** | Productos críticos (quiebre inminente) — compuesto ejemplo §5 de `03` |

### A4. Propuestas de compra (borrador OC) y simulación
| # | Método y ruta | Objetivo |
|---|---|---|
| A4.1 | `GET /proposals` **Q** · `GET /proposals/:id` | Listar / detalle (agrupado por proveedor, costeo, criterios que dispararía) |
| A4.2 | `POST /proposals` | Crear propuesta (comando C1) |
| A4.3 | `PATCH /proposals/:id` | Editar metadatos (comando C2) |
| A4.4 | `POST /proposals/:id/lines` · `PATCH /proposals/:id/lines/:lineId` · `DELETE /proposals/:id/lines/:lineId` | Gestión de líneas (C3–C5) |
| A4.5 | `POST /proposals/:id/submit` | Enviar a revisión (C7) |
| A4.6 | `POST /proposals/:id/cancel` · `POST /proposals/:id/duplicate` | C11, C12 |
| A4.7 | `POST /proposals/:id/convert` | Convertir en orden(es) de compra (C13) |
| A4.8 | `POST /proposals/:id/comments` · `GET /proposals/:id/comments` | Comentarios (C16) |
| A4.9 | `GET /proposals/:id/simulation` | Simulación de la propuesta actual (costeo landed, OTB, cobertura resultante, criterios de aprobación) |
| A4.10 | `POST /simulations/proposal` | Simulación *stateless* de una propuesta hipotética |
| A4.11 | `GET /proposals/:id/pickup-plan` | Plan de retiro (compone tms-service) |

### A5. Órdenes de compra y seguimiento
| # | Método y ruta | Objetivo |
|---|---|---|
| A5.1 | `GET /purchase-orders` **Q** | Listar por pestaña (borradores/órdenes/seguimiento), `?oc=` deep-link |
| A5.2 | `GET /purchase-orders/:id` | Detalle con líneas, aprobación enlazada, recepciones, `sapSync` |
| A5.3 | `POST /purchase-orders/:id/send` | Enviar a proveedor / disparar SAP (C14 · asíncrono `202`) |
| A5.4 | `GET /purchase-orders/:id/sap-status` | Estado de sincronización SAP (polling) |
| A5.5 | `POST /purchase-orders/:id/cancel` | Cancelar (reglas según estado/SAP) |

### A6. Aprobaciones (líder)
| # | Método y ruta | Objetivo |
|---|---|---|
| A6.1 | `GET /approvals` **Q** · `GET /approvals/:id` | Bandeja (default `state=pending`) / detalle con criterios |
| A6.2 | `POST /approvals/:id/approve` · `/reject` · `/request-changes` | C8–C10 (solo líder; motivo obligatorio en reject/request-changes) |

### A7. Recepciones y reclamos
| # | Método y ruta | Objetivo |
|---|---|---|
| A7.1 | `GET /receptions` **Q** (`?rid=` deep-link) · `GET /receptions/:id` | Listar / detalle vs OC |
| A7.2 | `POST /receptions` · `PATCH /receptions/:id` | Registrar recepción; checking/diferencias/completar |
| A7.3 | `GET /claims` **Q** · `POST /claims` · `GET /claims/:id` · `PATCH /claims/:id` | Reclamos (FK OC + recepción) |

### A8. RFQ / cotizaciones
| # | Método y ruta | Objetivo |
|---|---|---|
| A8.1 | `GET /rfqs` **Q** · `GET /rfqs/:id` | Listar por estado / comparación de ofertas |
| A8.2 | `POST /rfqs` · `POST /rfqs/:id/responses` · `POST /rfqs/:id/award` | Crear, registrar respuesta, adjudicar → genera propuesta/OC |

### A9. Proveedores y negociación
| # | Método y ruta | Objetivo |
|---|---|---|
| A9.1 | `GET /suppliers` **Q** | Performance de proveedores (comerce identidad + purchase relación) |
| A9.2 | `GET /suppliers/:id?tab=` | Ficha 7 pestañas (compuesta) |
| A9.3 | `POST /suppliers/:id/negotiations` | Registrar ronda de negociación (C15) |
| A9.4 | `PUT /suppliers/:id/terms` | Condiciones comerciales: MOQ, lead time, pago, descuentos (C15b) |
| A9.5 | `POST /suppliers/:id/agreements` · `GET /suppliers/:id/agreements` | Acuerdos |

### A10. Alertas, señales y tareas
| # | Método y ruta | Objetivo |
|---|---|---|
| A10.1 | `GET /alerts` **Q** | Centro de alertas con estado (módulo Alerts de purchase — R1) |
| A10.2 | `POST /alerts/:id/acknowledge` · `/resolve` · `/dismiss` | Atender alerta (C17) |
| A10.3 | `GET /signals` **Q** · `POST /signals` · `PATCH /signals/:id` · `POST /signals/:id/comments` | Señales de terreno + hilo |
| A10.4 | `GET /tasks?date=` | Agenda/tareas del día (derivada del dashboard; misma fuente que A2.1) |

### A11. Catálogo, categorías asignadas e inventario (lecturas compuestas)
| # | Método y ruta | Objetivo |
|---|---|---|
| A11.1 | `GET /products` **Q** | Catálogo con lentes de compra (surtido/rol/stock) |
| A11.2 | `GET /products/:sku?tab=` | SKU 360 (6 pestañas compuestas) |
| A11.3 | `GET /categories?scope=` · `GET /categories/:id?tab=` | Categorías / detalle 9 pestañas |
| A11.4 | `GET /assignments` · `PATCH /assignments/:categoryId` | Cartera comprador↔categoría; reasignar (líder, C18) |
| A11.5 | `GET /inventory/analysis` | Cobertura, sobre-stock, stock muerto (agregado) |
| A11.6 | `GET /assortment?tab=` · `GET /assortment/redundancy?categoryId=` | Surtido / duplicidad |
| A11.7 | `GET /npi?tab=` | Altas / salidas de producto |

### A12. Indicadores, análisis y reportes
| # | Método y ruta | Objetivo |
|---|---|---|
| A12.1 | `GET /analytics/purchase?tab=` **Q** | Ranking / liquidación |
| A12.2 | `GET /analytics/sales?period=` | Ventas (KPIs y series) |
| A12.3 | `GET /analytics/channel-margin` **Q** | Margen por canal |
| A12.4 | `GET /analytics/lost-opportunities` **Q** | Venta no capturada |
| A12.5 | `GET /reports/:reportId?range=` | 8 reportes (dataset agregado) |
| A12.6 | `POST /reports/:reportId/export` → `202` · `GET /exports/:jobId` | Exportación asíncrona CSV |
| A12.7 | `GET /budget?month=` | Presupuesto / OTB |
| A12.8 | `GET /learning/purchase-quality` · `GET /learning/decisions` **Q** · `POST /learning/decisions` | Aprendizaje / decisiones |

### A13. Precios y alzas (compone `pricing-service`; la regla vive en pricing)
| # | Método y ruta | Objetivo |
|---|---|---|
| A13.1 | `GET /price-increases` **Q** | Alzas pendientes (PriceAudit de pricing, adaptado a la vista) |
| A13.2 | `POST /price-lists` | Cargar lista de proveedor (crea cambios de precio en pricing) |
| A13.3 | `POST /price-increases/:id/approve` · `/reject` | Proxy 1:1 a `price-audit` de pricing (sin lógica en BFF) |

### A14. Planificación, temporadas y campañas
| # | Método y ruta | Objetivo |
|---|---|---|
| A14.1 | `GET /seasons` · `GET /seasons/:id/plan?scenario=` | Planificador de temporada |
| A14.2 | `PATCH /seasons/forecast-adjustments/:sku` | Ajuste de forecast (auditable) |
| A14.3 | `GET /channel-demand?season=` | Demanda por canal |
| A14.4 | `GET /campaign-opportunities` **Q** · `POST /campaigns` · `GET /campaigns?mine=` | Anticipación / mis campañas |
| A14.5 | `GET /imports` **Q** · `GET /imports/:id` · `PATCH /imports/:id/stage` · `POST /imports/:id/docs` | Torre de control de importaciones |
| A14.6 | `GET /documents` **Q** · `POST /documents` | Documentos (referencia a DMS) |

### A15. Equipo (solo líder) y gobierno
| # | Método y ruta | Objetivo |
|---|---|---|
| A15.1 | `GET /team/dashboard` · `GET /team/workload` · `PATCH /team/workload/reassign` | Panel, carga, reasignación |
| A15.2 | `GET /team/buyers` · `GET /team/ranking` · `GET /team/goals` **Q** · `GET /team/alerts` | Compradores, ranking, metas, alertas de equipo |
| A15.3 | `GET /team/rewards` · `POST` · `PATCH /:id` · `DELETE /:id` | Premios (CRUD) |
| A15.4 | `GET /rules?scopeType=` · `POST /rules` · `PATCH /rules/:id` | Reglas de compra (umbrales como configuración) |
| A15.5 | `GET /governance/roles` · `GET /governance/approval-matrix` · `GET /governance/audit` **Q** | Solo lectura (audit lee trace-service) |

> **~70 endpoints públicos.** Ninguna vista del frontend consume otro servicio: **sin excepciones** al principio #1.

---

## B. Endpoints internos de `purchase-service` (consumidos por el BFF; nunca por el frontend)

Espejo de dominio de los grupos A (el BFF no agrega lógica, solo compone). Se listan por módulo;
los comandos llevan ficha completa en `04`.

| Módulo | Endpoints | Notas |
|---|---|---|
| **Recommendations** | `POST /recommendations/search` **Q** · `GET /recommendations/:id` · `PATCH /recommendations/:id` (override/ignore/snooze) · `GET /recommendations/summary` · `POST /recommendations/engine/run` (`x-service-*`: pasada E7 on-demand) | El motor materializa; search devuelve página rankeada con datos precalculados |
| **Proposals** | `GET /proposals` **Q** · `GET /proposals/:id` · `POST /proposals` · `PATCH /proposals/:id` · `POST /proposals/:id/lines` · `PATCH /proposals/:id/lines/:lineId` · `DELETE …/lines/:lineId` · `POST /proposals/:id/submit` · `/cancel` · `/duplicate` · `/convert` · `GET /proposals/:id/simulation` · `POST /simulations` · `POST /proposals/:id/comments` | Todas las transiciones con `If-Match` + `idempotency-key` |
| **Purchase Orders** | `GET /purchase-orders` **Q** · `GET /purchase-orders/:id` · `POST /purchase-orders/:id/send` · `/cancel` · `GET /purchase-orders/:id/sap-status` · `PATCH /purchase-orders/:id/status` (interno: conciliación) | `PATCH status` solo `x-service-*` (workers/eventos) |
| **Approvals** | `GET /approvals` **Q** · `GET /approvals/:id` · `POST /approvals/:id/approve` · `/reject` · `/request-changes` | Guard líder server-side |
| **Decisions** | `GET /decisions` **Q** · `POST /decisions` · `PATCH /decisions/:id/result` (batch a N días) | `result` solo `x-service-*` |
| **RFQs** | CRUD + `POST /rfqs/:id/responses` · `POST /rfqs/:id/award` | Award crea proposal/PO |
| **Receptions** | `GET /receptions` **Q** · `GET /receptions/:id` · `POST /receptions` · `PATCH /receptions/:id` | Al completar emite evento → inventory/SAP |
| **Claims** | CRUD + `PATCH /claims/:id/resolve` | Resolución `credit_note` emite evento a finance/SAP |
| **Supplier Relations** | `GET /supplier-relations` **Q** · `GET /supplier-relations/:supplierId` (incluye terms/skuTerms/acuerdos/rondas + última evaluación y métricas de cumplimiento) · `PUT …/terms` (C15b, append-only) · `POST …/negotiations` (C15) · `GET/POST …/agreements` | `supplierId` = ReferenceId de comerce (P3) |
| **Budget/OTB** | `GET /budget?month&categoryId` · `GET /budget/months` · `GET /budget/supplier-spend?days&scope` · `POST /budget/check` (validación de disponibilidad) · `PATCH /budget/:bucketId` (admin; If-Match, emite `purchase.otb.adjusted`) | `check` lo usa submit/convert; `months`/`supplier-spend` alimentan la vista A12.7 |
| **Assignments** | `GET /assignments` (lectura implementada) · `PUT /assignments/:categoryId` (C18, flujo de equipo) | Cartera; alimenta el alcance |
| **Alerts** | `GET /alerts` **Q** · `POST /alerts/:id/acknowledge` · `/resolve` · `/dismiss` · `POST /alerts` (`x-service-*`: motor de reglas) | Estado del alerta vive aquí (R1) |
| **Signals** | CRUD + `POST /signals/:id/comments` | Hilo con cursor |
| **Seasons/Planning** | `GET /seasons` · `GET /seasons/:id/plan` · `PATCH /forecast-adjustments/:sku` · `GET /channel-demand` | Forecast auditable |
| **Opportunities/Campaigns** | `GET /campaign-opportunities` **Q** · `PATCH /campaign-opportunities/:id/status` · `POST /campaigns` · `GET /campaigns` | Detección propia; ejecución externa |
| **Imports** | `GET /imports` **Q** · `GET /imports/:id` · `PATCH /imports/:id/stage` · `POST /imports/:id/docs` | Docs = referencia a DMS |
| **Rules/Governance** | `GET /rules` · `POST /rules` · `PATCH /rules/:id` · `GET /approval-matrix` | Config parametrizable versionada |
| **Team** | `GET /team/workload` · `PATCH /team/workload/reassign` · `GET /team/buyers` · `GET /team/goals` · `GET /team/ranking` · CRUD `/team/rewards` | Solo líder (permiso) |
| **Notifications-state** | `GET /notification-state` · `PATCH /notification-state/read` | Set de leídas por usuario |

> **~75 endpoints internos.** Regla: el BFF hace fan-out de lecturas y **pasa** los comandos 1:1 al
> dominio (traduce envoltorio, no reglas).

---

## C. Endpoints requeridos en servicios existentes

Estados: ✅ **ya existe** (verificado en código) · 🔧 **debe ampliarse** · 🆕 **debe crearse** ·
❓ **debe confirmarse / pendiente de verificación** · ↔️ **reemplazable por otro existente**.

### Catalog Service (`catalog-service-v1`)
| Necesidad | Endpoint | Estado |
|---|---|---|
| Listar productos con filtros (categoría, marca, q, canal, `includeSkus`) | `GET /api/catalog-service/v1/product` | ✅ |
| Producto por id (marca, categoría, skus, `catalogCodes{cardCode}`) | `GET …/product/:id` | ✅ |
| SKU por referencia (`?referenceId=`), por id, atributos, relacionados | `GET …/sku`, `…/sku/:id`, `…/sku/:id/related` | ✅ |
| Categorías (árbol, roots/leaves) | `GET …/category(/:id)` | ✅ |
| Filtro de productos **por proveedor** (cardCode) | — | 🔧 (hoy `cardCode` no es filtro de lista; alternativa ↔️: resolver SKUs del proveedor vía purchase/pricing y pedir por `referenceId` CSV) |
| MOQ / mínimo de compra | — | 🆕 **no va en catalog**: se modela en `SupplierTerms` (purchase). Pack/múltiplo ✅ ya existe (`unitMultiplier`) |
| `Category.buyer` (cartera) | — | 🆕 **no va en catalog**: `CategoryAssignment` (purchase) |

### Inventory Service (`inventory-service-v3`)
| Necesidad | Endpoint | Estado |
|---|---|---|
| Stock por SKU+bodega (`availableStock`, `inTransit`, `securityStock`, `inOrder`) | `GET /api/v1/stock?skuId&warehouseId` (+`skuData/warehouseData`) | ✅ |
| Agregado por SKU (todas las bodegas) | `GET /api/v1/sku-stock/:skuId` | ✅ / 🔧 (omite `inTransit` y `securityStock`; ampliar o usar `GET /stock`) |
| Cobertura / rotación / punto de reorden | — | 🆕 **no va en inventory**: los calcula purchase (motor) |
| Recepción física / GRN | `POST /api/v1/order-receiving` + `/:id/receive` · o `supplying` (`supplierId`, `items[]`) | ✅ / ❓ **confirmar cuál usa purchase** (P6): `supplying` ya modela PO de SAP con proveedor |
| Encolar PO/recepción a SAP | `POST /api/v1/sap/sync/supplying/:id/purchase-order` · `…/receipt` | ✅ (evaluar reuso vs outbox propio — P6) |
| Eventos de stock | `wms.stock.updated` · `inventory.availability.changed` | ✅ |
| Rutas `po/*` (open-lines, by-docnum) | `GET /api/v1/po/…` | ❌ **stubs `NotImplemented` — no usar** |

### Pricing Service (`pricing-service`)
| Necesidad | Endpoint | Estado |
|---|---|---|
| Costo/precio vigente por SKU (resolver) | `GET /api/pricing/sku-price/:id` | ✅ |
| Precio base (cost, listPrice, markup) | `GET /api/pricing/base-price` | ✅ |
| Listas de precio (↔ SAP PriceList) | `GET/POST /api/pricing/price-sheet` | ✅ |
| Alzas: crear cambios + workflow aprobación | `POST /api/pricing/price(-batch)` · `GET /api/pricing/price-audit` · `POST …/price-audit/:id/approve\|reject` | ✅ |
| Histórico de cambios de costo | `GET /api/pricing/price-change` | ✅ |
| Waterfall de costo neto / margen objetivo por categoría | — | ❓ **confirmar**: hoy hay `markup` por BasePrice y `SapItemCost`; el waterfall visual del front puede requerir 🔧 endpoint agregado o componerse en BFF |
| Costo espejo SAP | módulos `sap-item-cost`, `sap-special-price` | ✅ (lectura) |

### Supplier (maestro) — **`comerce-service`** *(el análisis original suponía un "Supplier Service"; no existe: el maestro vive aquí + SAP BP)*
| Necesidad | Endpoint | Estado |
|---|---|---|
| Listar proveedores (búsqueda por nombre/RUT/ReferenceId) | `GET /api/comerce-service/supplier/Listar` | ✅ |
| Proveedor por id | `GET …/supplier/:id` | ✅ |
| Estado enriquecido (bloqueado/observado), contacto, condiciones | — | 🔧 o ↔️ purchase `SupplierRelationship` (elegido: purchase posee la **relación**; comerce la identidad) |
| Cruce `ReferenceId` ↔ `cardCode` SAP | — | 🆕 campo/cross-ref — **decisión pendiente P3** |
| Canales de venta (catálogo único para conciliar taxonomías) | `GET …/sales-channel/ListarSimple` | ✅ |
| Bodegas / locations | `GET …/locations`, `…/locations/:id/warehouses` | ✅ |

### Sales / Analytics (`analysis-service` — **pendiente de verificación**, no fue explorado)
| Necesidad | Endpoint | Estado |
|---|---|---|
| Venta diaria / velocidad por SKU (× canal × período) | — | ❓/🆕 **shape requerido definido en `02` (ficha F-EXT-1)**; sin esto el motor no calcula cobertura con venta real |
| Margen por canal, series de venta, KPIs | — | ❓/🆕 |
| Oportunidades perdidas / meses sin compra | — | ❓/🆕 |
| Resultado real de decisión a N días | — | ❓/🆕 (batch E5) |
> `oms-service` **confirmado**: solo lectura de órdenes (`GET /orders/summary`), **sin** agregación por SKU/proveedor — ↔️ no sirve como fuente de velocidad de venta.

### Identity (`id-service`) + `api-gateway`
| Necesidad | Endpoint | Estado |
|---|---|---|
| Login / renovar / logout | `POST /api/idservice/auth/login` · `/renovar` · `/logout` | ✅ |
| Permisos efectivos del usuario | `GET /api/idservice/users/:userId/permissions/:platformId` | ✅ |
| Allow-list para gateway | `GET /api/idservice/endpoints/allowedEndpoints?user&plat` | ✅ (registrar plataforma/módulos/endpoints de Compras = tarea de configuración) |
| Alcance por categoría/comprador | — | 🆕 **no va en id-service**: `CategoryAssignment` (purchase) |
| Registro de rutas del BFF en el gateway (`requireAuth`, `requireRbac`) | `api-gateway/src/config/services.js` | 🔧 (config) |

### Notification Service (`notification-service`)
| Necesidad | Endpoint | Estado |
|---|---|---|
| Despachar push/websocket por evento | `POST /notification/trigger` (headers `janis-*`; `eventKey` `purchase:<entidad>:<evento>`) | ✅ (crear la **configuración de eventos** por cliente: 🔧 config) |
| Inbox de alertas con estado (ack/resolve) | — | 🆕 **no va en notification**: módulo Alerts (purchase) — R1 |
| Ruta en gateway | — | 🔧 hoy no está registrada en el gateway |

### SAP B1 Integration
| Necesidad | Mecanismo | Estado |
|---|---|---|
| Crear OC (OPOR, ObjType 22) | Service Layer `POST /PurchaseOrders` desde outbox propio de purchase (patrón inventory outbound) | 🆕 (patrón ✅ probado; ver `05`) |
| Evento SAP→plataforma `PurchaseOrder.Cancelled` | `sap-outbox-worker` → Kafka `sap.purchaseorder.cancelled` | ✅ |
| Eventos `PurchaseOrder.Created/Updated/Closed` desde SAP | TransactionNotification + índice outbox | 🔧 **debe ampliarse** (P7) |
| GRN (PurchaseDeliveryNotes) | vía `inventory sap-sync` ✅ o outbox de purchase 🆕 | ❓ P6 |
| Upsert proveedor `cSupplier` | — | 🆕 o **exigir CardCode preexistente** (P4) |
| Maestro costo/proveedor desde SAP | espejo pricing (`SapItemCost`) ✅ | ✅ |

### trace-service / tms-service / document-generator-service
| Necesidad | Estado |
|---|---|
| Escribir traza de auditoría (`trace-service`) | ❓ **pendiente de verificación** del contrato exacto (el patrón existe: todos los servicios de `ARQUITECTURA_INTEGRACIONES.md` escriben trazas) |
| Capacidad/tarifas para plan de retiro (`tms-service`) | ❓ **pendiente de verificación** |
| Generación de documentos (OC PDF) (`document-generator-service`) | ❓ **pendiente de verificación** |

---

## D. Endpoints internos de integración (nunca expuestos al frontend)

| # | Operación | Dirección | Mecanismo |
|---|---|---|---|
| D1 | Resolución de permisos | BFF → id-service | HTTP `GET /users/:id/permissions/:platformId` (caché ≤60 s por request) |
| D2 | Lecturas de maestros | BFF/purchase → catalog·pricing·inventory·comerce | HTTP con headers `x-service-*` + `x-correlation-id` |
| D3 | Conciliación de estado de OC | worker purchase → `PATCH /api/purchase/v1/purchase-orders/:id/status` | HTTP interno (solo `x-service-*`) |
| D4 | Registro de resultado de decisión | batch E5 → `PATCH /api/purchase/v1/decisions/:id/result` | HTTP interno |
| D5 | Creación de alertas por regla | motor de reglas → `POST /api/purchase/v1/alerts` | interno (mismo proceso o `x-service-*`) |
| D6 | Disparo de notificación | purchase → notification | HTTP `POST /notification/trigger` (headers `janis-*`) |
| D7 | Traza de auditoría | purchase/BFF → trace-service | HTTP (contrato ❓ pdte-verif) |
| D8 | Emisión SAP | worker outbox purchase → SAP Service Layer | HTTPS `POST /PurchaseOrders` (login `B1SESSION`, `U_REF1` = id interno) |

## E. Webhooks, procesos batch y sincronizaciones

### E-Kafka (consumo de eventos — reaccionar, no pollear)
| # | Topic | Reacción de purchase-service |
|---|---|---|
| E1 | `wms.stock.updated` · `inventory.availability.changed` | Recomputar cobertura/prioridad del SKU (incremental) |
| E2 | `pricing.price.updated` · `pricing.base-price.updated` | Recostear recomendaciones y líneas de propuesta en `draft` |
| E3 | `pricing.price-audit.approved` | Recostear + generar alerta de alza aprobada |
| E4 | `catalog.sku.updated` · `catalog.product.updated` | Invalidar caché BFF; revisar surtido/estado de compra |
| E5 | `sap.purchaseorder.cancelled` | Conciliar OC → `cancelled` + alerta |
| E6 | `oms.order.created/invoiced` *(o feed de analysis — P5)* | Alimentar velocidad de venta del motor |

### E-Batch (programados)
| # | Proceso | Frecuencia | Efecto |
|---|---|---|---|
| E7 | Generación/refresco de recomendaciones | nocturno + incremental por E1/E2 | Materializa el ranking de reposición |
| E8 | Evaluación de resultado de decisiones (N días) | diario | `PATCH /decisions/:id/result` + evento |
| E9 | Recalculo de cumplimiento de proveedor | diario | `SupplierRelationship.compliance` |
| E10 | Evaluación de reglas de alerta (quiebre, sobre-stock, margen, OC atrasada) | horario | `POST /alerts` + `notification/trigger` |
| E11 | Drenaje del outbox SAP (OPOR) | continuo (worker) | `POST /PurchaseOrders`, reintentos backoff, `DocEntry/DocNum` sync-back |
| E12 | Actualización de lead time observado (recepciones vs prometido) | semanal | `SupplierRelationship.leadTimeDays` |
| E13 | Jobs de exportación CSV | on-demand (`202`) | `GET /exports/:jobId` |
| E14 | Limpieza de `idempotency-keys` y snapshots vencidos | diario | Higiene |
| E15 | Avance de temporada / tracking de plan | diario | `seasonTracking` |

### E-Salida (eventos que publica purchase-service — Outbox)
Catálogo conceptual ya fijado en `../arquitectura-backend/README.md` §8 (`purchase.*`); payloads
mínimos en el OpenAPI (`components.schemas.Event*`).
</content>
