# 03 · Contratos orientados a vistas y consultas compuestas del BFF

> Cumple los puntos 4 y 5 del encargo. Regla transversal: **el frontend nunca reconstruye lógica de
> negocio** — prioridad, cantidad sugerida, criterios de aprobación, costeo, cumplimiento y estados
> llegan **calculados**. El front solo pinta y dispara comandos.

## 1. Tabla vista → contrato (todas las vistas principales)

Leyenda estrategia: **C** respuesta compuesta BFF · **I** consultas independientes · **L** lazy por
pestaña/sección · **P** paginación server-side · **K** caché BFF · **RT** refresco (polling corto).

| Vista (ruta front) | Carga inicial | Filtros | Detalle | Acciones (comandos) | Estrategia | Si falla dependencia |
|---|---|---|---|---|---|---|
| Login | `POST id-service /auth/login` (vía BFF `POST /auth/login` proxy) + `GET /context` | — | — | login/logout | I | error claro; sin fallback |
| Inicio `/` | `GET /dashboard` | `scope` | — | ir a secciones | C, K(60s agregados) | sección `degraded`, resto OK |
| Mi Cartera | `GET /dashboard/portfolio?focus=` | segmento path | — | — | C, L por foco | ídem |
| Mi Desempeño | `GET /my-performance` | — | — | — | C | secciones degradables |
| Decisiones/Reposición | `POST /replenishment/search` + `GET /replenishment/summary` | body filters (server-side) | drawer usa fila (sin GET extra) | A3.3 override/ignore/snooze · A3.4 add-to-proposal | C, P | stock/costo stale ⇒ warning; purchase caído ⇒ error vista |
| Productos críticos | `POST /products/critical/search` | body | — | add-to-proposal | C, P | §5 |
| Borrador/Órdenes/Seguimiento | `GET /proposals` · `GET /purchase-orders?tab=` (`?oc=` deep-link) | query | `GET /purchase-orders/:id` | C1–C14 | I, P · RT en seguimiento (`sapSync` poll 5–10 s hasta terminal) | lista propia siempre (dueño purchase) |
| Aprobaciones | `GET /approvals?state=pending` | query | `GET /approvals/:id` | approve/reject/request-changes | I, P | dueño purchase: sin degradación |
| Plan de retiro | `GET /proposals/:id/pickup-plan` | — | — | — | C | tms caído ⇒ 200 parcial sin plan, aviso |
| Recepciones | `GET /receptions` (`?rid=`) | query | `GET /receptions/:id` | F8 + PATCH | I, P | — |
| Cotizaciones RFQ | `GET /rfqs?state=` | query | `GET /rfqs/:id` (comparación) | crear/respuesta/adjudicar | I, P | — |
| Reclamos | `GET /claims` | chips=query | `GET /claims/:id` | crear/gestionar/resolver | I, P | — |
| Planificar temporada | `GET /seasons` + `GET /seasons/:id/plan?scenario=` | escenario | — | ajustar forecast | C, L por escenario | demanda externa caída ⇒ plan con último forecast, warning |
| Temporadas y canales | `GET /channel-demand?season=` | — | — | — | C, K(300s) | parcial |
| Importaciones | `GET /imports` | query | `GET /imports/:id` | avanzar etapa, adjuntar doc | I, P | DMS caído ⇒ docs degradados |
| Campañas / Anticipación | `GET /campaign-opportunities` · `GET /campaigns?mine` | query | — | crear campaña | I, P | performance externa ⇒ parcial |
| Productos | `GET /products` | query (server-side) | — | — | C(catalog+lentes), P, K(120s master) | lentes de stock degradables |
| Detalle producto (6 tabs) | `GET /products/:sku?tab=resumen` | `?tab=` | por pestaña | reportar señal, add-to-proposal | **C+L por pestaña** | §4 |
| Categorías / detalle (9 tabs) | `GET /categories` · `GET /categories/:id?tab=` | `?tab=` | por pestaña | — | C+L, K | por pestaña |
| Proveedores | `GET /suppliers` | query | — | — | C(comerce+purchase), P | relación degradable; identidad indispensable |
| Ficha proveedor (7 tabs) | `GET /suppliers/:id?tab=ficha` | `?tab=` | por pestaña | negociación/términos/acuerdos | **C+L por pestaña** | §4 |
| Surtido / Duplicidad / NPI | `GET /assortment…` · `GET /npi` | query | — | alta producto (→catalog, vía BFF) | C, P, K | parcial |
| Análisis inventario | `GET /inventory/analysis` | — | deep-links | — | C, K(300s) | parcial |
| Análisis compra / Ventas / Margen canal / Venta no capturada | `GET /analytics/*` | query | — | — | C, P, K(300s) | analytics caído ⇒ error de vista (es su único dato) |
| Reportes | `GET /reports/:id?range=` | range | — | `POST /reports/:id/export` (202) | C, K por rango | error de vista |
| Presupuesto | `GET /budget?month=` | month/query | — | — | C | OTB indispensable aquí ⇒ 502 |
| Alzas de precio | `GET /price-increases` | query | selección en lista | cargar lista / aprobar / rechazar (proxy pricing) | C(pricing), P | pricing caído ⇒ error de vista |
| Aprendizaje | `GET /learning/*` | `?tab=` | — | registrar decisión | I, P | — |
| Documentos | `GET /documents` | query | — | subir (referencia) | I, P | — |
| Reglas | `GET /rules` | scopeType | — | crear/editar regla | I | — |
| Gobierno | `GET /governance/*` | tab | — | — (solo lectura) | I, P (audit) | trace caído ⇒ bitácora degradada |
| Equipo (todas, líder) | `GET /team/*` | query | — | reasignar, premios CRUD | C, P | secciones degradables |
| Alertas | `GET /alerts` | query | — | ack/resolve/dismiss | I, P · RT campanita (poll 60 s o websocket notification) | — |
| Señales | `GET /signals` | query | hilo por cursor | crear/comentar/estado | I, P(cursor en hilo) | — |

**Deep-links** (`?oc=`, `?rid=`, `?sku`, `?tab=`, `?cat=`, `?foco=`, `?prov=`): todo GET de lista los
acepta como filtro/selección inicial y el BFF devuelve la vista ya contextualizada en **una** llamada.

## 2. Reglas de estrategia
- **Compuesta (C)** cuando la vista junta ≥2 fuentes o el front hoy mezclaba mock+cálculo. **Independiente (I)**
  para CRUD de un solo dueño (propuestas, aprobaciones, reclamos, reglas): más simple y cacheable por fila.
- **Lazy (L)**: pestañas de detalle producto/proveedor/categoría cargan **por pestaña** (`?tab=`), nunca
  las 6–9 de una vez (evita respuestas gigantes que mezclan dominios — principio #8).
- **Tiempo real**: no se introduce websocket propio en v1; `sapSync` y campanita usan **polling corto**;
  notification-service puede empujar push como mejora (config `purchase:*` eventKeys).
- **Refresco tras comando**: el comando devuelve la entidad actualizada (read-your-writes); el front no
  vuelve a pedir la lista completa, hace merge por `id+version`.

## 3. Composición del dashboard (`GET /dashboard`)
| Aspecto | Definición |
|---|---|
| Llamadas | 5 **en paralelo** a purchase-service: recommendations/summary · approvals?state=pending (si permiso) · alerts?status=active · signals?status=new · budget/otb + agenda derivada |
| Secuencial | nada (todas independientes) |
| Timeouts | 4 s c/u; total 10 s; presupuesto de composición: primera respuesta completa ~p95 < 1.5 s |
| Indispensable | `replenishment` (sin él ⇒ 502) |
| Opcionales | approvals, alerts, signals, budget, agenda ⇒ `status:"degraded"` por sección |
| Caché | summary/agenda 60 s por `(buyerId, scope)`; alertas/aprobaciones/OTB sin caché |
| Observabilidad | 1 span por dependencia con `x-correlation-id`; métricas: latencia por sección, ratio parcialidad, aperturas de breaker |

## 4. Composición de fichas (producto / proveedor / categoría)
`GET /products/:sku?tab=`:
| Pestaña | Fuentes (paralelo) | Indispensable | Degradable |
|---|---|---|---|
| resumen | catalog (master+imagen) ∥ inventory `GET /stock?skuId=` ∥ analytics venta | catalog | stock (asOf viejo), venta |
| negociacion | pricing (sku-price, price-change) ∥ purchase (terms, reclamos, quiebres) | pricing **o** purchase (una de dos) | la otra |
| margen | analytics margen por canal | analytics | — (pestaña con error propio) |
| senales | purchase signals?sku= | purchase | — |
| relacionados | catalog `sku/:id/related` | catalog | — |
| actividad | trace-service ?entity=sku | — | sí (bitácora vacía + aviso) |

`GET /suppliers/:id?tab=`: identidad (comerce `supplier/:id`) **indispensable en toda pestaña**; el
resto por pestaña: evaluación/términos/negociaciones (purchase) · temporadas (purchase planning) ·
productos (catalog por cardCode ↔ P3) · órdenes/recepciones (purchase) · alertas (purchase alerts).
El BFF une por `supplierId`; ninguna unión se hace en el front.

## 5. Especificación completa del compuesto ejemplo — `POST /products/critical/search`

**Servicios y qué campo aporta cada uno**
| Campo de la fila | Fuente | Llamada |
|---|---|---|
| `recommendationId, priority, suggestedQty, coverageDays, status, version, flags, moq, packMultiple*` | **purchase-service** (motor + SupplierTerms; *pack también existe en catalog `unitMultiplier` — fuente efectiva: purchase, sembrado de catalog) | `POST /recommendations/search` |
| `sku, name, brand, category` | catalog | `GET /product?…referenceId in (page)` (batch por página) |
| `supplier{id,name}` | comerce | `GET /supplier/Listar?referenceId in` (cacheado 300 s) |
| `supplier.sapCardCode` | purchase (cross-ref P3) | incluido en search |
| `stock{available,inTransit,security,asOf}` | inventory | `GET /api/v1/stock?skuId in (page)` |
| `sales{dailyVelocity,source,stale}` | analytics (❓P5) — fallback: materializado del motor | `GET /sales/velocity?skus=` |
| `cost{unitCost,priceListId,asOf}` | pricing | `GET /sku-price/:id` (batch) |

**Orden de llamadas**
1. **Secuencial primero**: `purchase POST /recommendations/search` — define la página (ids+ranking).
2. **Paralelo después** (con los SKUs de la página): catalog ∥ inventory ∥ pricing ∥ analytics ∥ comerce.

**Timeouts**: 4 s por dependencia (2 reintentos); total 10 s. **Presupuesto**: paso 1 ≤ 2 s; paso 2 ≤ 4 s.

**Indispensables**: purchase (sin motor no hay vista ⇒ `502 DOWNSTREAM_SERVICE_ERROR`) y catalog
(sin nombre no hay fila útil ⇒ 502).

**Reglas de faltantes (contractuales, no improvisadas en front):**
| Falta | Comportamiento |
|---|---|
| **Costo** (pricing caído o SKU sin precio) | `cost: null` + warning `PRICING_UNAVAILABLE` por ítem; la fila se muestra; *agregar a propuesta* permitido pero la propuesta **no podrá enviarse a revisión** con líneas sin costo (`COST_MISSING` en submit) |
| **Lead time** (sin SupplierTerms) | `eta: null` + flag `lead_time_unknown`; no bloquea |
| **Sales Analytics no responde** | `sales.source="materialized", stale=true` (último valor del motor) + warning global `ANALYTICS_UNAVAILABLE`; cobertura se muestra con esa base |
| **Stock no responde** | se usa `stockSnapshot` del motor con su `asOf` + warning `STOCK_STALE`; si tampoco existe ⇒ `stock:null` y flag |
| **comerce no responde** | nombre de proveedor desde snapshot del motor; warning |

**Respuesta parcial**: `meta.partial=true` + `warnings[]` (`{code, scope, message, retryable}`) — el
front pinta banner estándar y por-celda "—" con tooltip del warning.

**Caché**: nombres/marca/categoría (catalog) 120 s y proveedor (comerce) 300 s por clave de página;
stock/costo/OTB **nunca**.

**Observabilidad**: `x-correlation-id` propagado a las 6 llamadas; métricas por dependencia
(latencia, error-rate, breaker), contador de respuestas parciales por `warning.code`, y tamaño de página.
</content>
